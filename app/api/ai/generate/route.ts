import { NextRequest, NextResponse } from "next/server";
import { refundGeneration, requireApiUser, reserveGeneration } from "@/app/lib/auth";
import {
  aiCodesForGrade,
  aiPromptCatalogForGrade,
  chooseOfficialAiCode,
  digitalLevelForGrade,
  digitalPromptCatalogForGrade,
  gradeNumber,
  isGeneratedDigitalCode,
  isGradeCompatibleDigitalCode,
  isOfficialAiCode,
  normalizeDigitalCode,
} from "@/app/lib/competency-codes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Provider = "openai" | "gemini" | "kimi" | "kira";

type SourceMaterial = {
  name?: string;
  kind?: "ppct" | "sgk" | "khbd" | "hoclieu";
  text?: string;
  structure?: string;
};

type PpctForm = {
  school?: string;
  department?: string;
  teacher?: string;
  subject?: string;
  grade?: string;
  book?: string;
  schoolYear?: string;
  semester1Weeks?: string;
  semester2Weeks?: string;
  sourceFileName?: string;
  sourceText?: string;
  textbookFileName?: string;
  textbookSourceText?: string;
  rewriteRequirements?: boolean;
};

type RequestBody = {
  task?: "lesson" | "ppct";
  provider?: Provider | "auto";
  model?: string;
  form?: {
    level?: string;
    subject?: string;
    grade?: string;
    title?: string;
    periods?: string;
    book?: string;
    core?: string;
    teacher?: string;
    school?: string;
    department?: string;
    columns?: string;
    template?: string;
    attachment?: string;
    ppctIntegrationFileName?: string;
    ppctIntegrationText?: string;
    sourceMaterials?: SourceMaterial[];
  };
  options?: string[];
  clientKeys?: Partial<Record<Provider, string[]>>;
  ppct?: PpctForm;
};

const ENV_KEYS: Record<Provider, string[]> = {
  openai: ["OPENAI_API_KEY", "OPENAI_API_KEY_2", "OPENAI_API_KEY_3"],
  gemini: ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"],
  kimi: ["KIMI_API_KEY", "KIMI_API_KEY_2", "KIMI_API_KEY_3"],
  kira: ["KIRA_API_KEY", "KIRA_API_KEY_2", "KIRA_API_KEY_3"],
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5-mini",
  gemini: "gemini-3.6-flash",
  kimi: "kimi-k2-0905-preview",
  kira: "kira-3.5-flash",
};

const optionNames: Record<string, string> = {
  digital: "mã hóa chỉ báo năng lực số theo Thông tư 02/2025/TT-BGDĐT và Công văn 3456/BGDĐT-GDPT",
  aiEducation: "mã hóa chỉ báo năng lực trí tuệ nhân tạo theo Quyết định 2422/QĐ-BGDĐT",
  defense: "giáo dục quốc phòng và an ninh",
  questions: "câu hỏi củng cố kèm đáp án",
  active: "phương pháp dạy học tích cực",
  game: "trò chơi học tập",
  inclusive: "điều chỉnh cho học sinh khuyết tật/học sinh cần hỗ trợ",
  warmup: "hoạt động khởi động sôi nổi",
  timeline: "timeline phân bổ thời gian chi tiết",
  mindmap: "gợi ý infographic và sơ đồ tư duy",
  stem: "quy trình bài học STEM",
  slides: "kịch bản slide bài giảng",
};

function getKeys(provider: Provider, clientKeys: string[] = []) {
  const serverKeys = ENV_KEYS[provider].map((name) => process.env[name]?.trim()).filter((key): key is string => Boolean(key));
  const sessionKeys = clientKeys.map((key) => key.trim()).filter(Boolean);
  return [...new Set([...sessionKeys, ...serverKeys])];
}

function kiraApiBase() {
  const configured = (process.env.KIRA_BASE_URL || "https://kiraai.vn/api/v1").replace(/\/+$/, "");
  return configured.endsWith("/api/v1") ? configured : `${configured}/api/v1`;
}

async function getKiraChatModels(key?: string) {
  try {
    const response = await fetch(`${kiraApiBase()}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ id?: string; type?: string; status?: string }> };
    return (Array.isArray(payload.data) ? payload.data : [])
      .filter((item) => item.id && (!item.type || item.type === "chat") && (!item.status || item.status === "active") && !/(?:image|video|tts)/i.test(String(item.id)))
      .map((item) => String(item.id));
  } catch { return []; }
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

const superscriptCharacters: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ" };
const subscriptCharacters: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎" };

function mapScientificScript(value: string, characters: Record<string, string>) {
  return [...value].map((character) => characters[character] || character).join("");
}

function normalizeScientificNotation(input: string) {
  let value = input;
  value = value.replace(/\\ce\{([^{}]+)\}/g, (_, formula: string) => formula.replace(/(\d+)/g, (digits) => mapScientificScript(digits, subscriptCharacters)));
  for (let index = 0; index < 4; index += 1) {
    value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
    value = value.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");
    value = value.replace(/\\vec\{([^{}]+)\}/g, "$1⃗");
  }
  const replacements: Array<[RegExp, string]> = [
    [/\\times\b/g, "×"], [/\\cdot\b/g, "·"], [/\\pm\b/g, "±"], [/\\div\b/g, "÷"],
    [/\\leq?\b/g, "≤"], [/\\geq?\b/g, "≥"], [/\\neq?\b/g, "≠"], [/\\approx\b/g, "≈"],
    [/\\rightarrow\b|\\to\b/g, "→"], [/\\leftarrow\b/g, "←"], [/\\leftrightarrow\b/g, "↔"],
    [/\\infty\b/g, "∞"], [/\\sum\b/g, "∑"], [/\\int\b/g, "∫"], [/\\partial\b/g, "∂"],
    [/\\Delta\b/g, "Δ"], [/\\delta\b/g, "δ"], [/\\alpha\b/g, "α"], [/\\beta\b/g, "β"],
    [/\\gamma\b/g, "γ"], [/\\lambda\b/g, "λ"], [/\\mu\b/g, "μ"], [/\\rho\b/g, "ρ"],
    [/\\sigma\b/g, "σ"], [/\\omega\b/g, "ω"], [/\\theta\b/g, "θ"], [/\\pi\b/g, "π"],
  ];
  replacements.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
  value = value.replace(/\^\{([^{}]+)\}/g, (_, script: string) => mapScientificScript(script, superscriptCharacters));
  value = value.replace(/_\{([^{}]+)\}/g, (_, script: string) => mapScientificScript(script, subscriptCharacters));
  value = value.replace(/\^([0-9+\-=()ni]+)/g, (_, script: string) => mapScientificScript(script, superscriptCharacters));
  value = value.replace(/_([0-9+\-=()]+)/g, (_, script: string) => mapScientificScript(script, subscriptCharacters));
  return value.replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, "").replace(/\$/g, "").trim();
}

function normalizeScientificTree(value: unknown): unknown {
  if (typeof value === "string") return normalizeScientificNotation(value);
  if (Array.isArray(value)) return value.map(normalizeScientificTree);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeScientificTree(item)]));
  return value;
}

function isEnglishSubject(value?: string) {
  return value === "Tiếng Anh";
}

function promptForPpct(body: RequestBody) {
  const form = body.ppct || {};
  const englishOutput = isEnglishSubject(form.subject);
  const grade = gradeNumber(form.grade);
  const digitalCodes = digitalPromptCatalogForGrade(form.grade);
  const aiCodes = aiPromptCatalogForGrade(form.grade);
  return `Bạn là chuyên gia xây dựng phân phối chương trình (PPCT) theo Chương trình GDPT 2018.

Hãy đọc PPCT nguồn và tạo lại PPCT có tích hợp Năng lực số và Trí tuệ nhân tạo. Chỉ trả về JSON hợp lệ, không Markdown và không giải thích ngoài JSON.

Thông tin cấu hình:
- Trường/đơn vị: ${form.school || "Chưa khai báo"}
- Tổ chuyên môn: ${form.department || "Chưa khai báo"}
- Giáo viên bộ môn: ${form.teacher || "Chưa khai báo"}
- Môn học: ${form.subject || "Chưa xác định"}
- Lớp: ${form.grade || "Chưa xác định"}
- Bộ sách: ${form.book || "Kết nối tri thức với cuộc sống"}
- Năm học: ${form.schoolYear || "2026–2027"}
- Học kì I: ${form.semester1Weeks || "18"} tuần
- Học kì II: ${form.semester2Weeks || "17"} tuần
- Tệp nguồn: ${form.sourceFileName || "PPCT do giáo viên cung cấp"}
- Tệp SGK/học liệu: ${form.textbookFileName || "SGK do giáo viên cung cấp"}
- Chế độ cột Yêu cầu cần đạt: ${form.rewriteRequirements ? "Chỉnh sửa, chuẩn hóa lại theo PPCT và SGK" : "Giữ nguyên văn nội dung trong PPCT nguồn"}

NỘI DUNG PPCT NGUỒN (các ô trong một hàng được phân cách bằng ký hiệu ||; ký hiệu ⏎ là vị trí xuống dòng trong cùng một ô):
${String(form.sourceText || "").slice(0, 100000)}

NỘI DUNG SGK ĐÃ ĐƯỢC LỌC THEO CÁC BÀI TRONG PPCT:
${String(form.textbookSourceText || "").slice(0, 90000)}

Yêu cầu bắt buộc:
0. ${englishOutput ? "Môn học là Tiếng Anh: toàn bộ nội dung PPCT đầu ra bắt buộc viết hoàn toàn bằng tiếng Anh tự nhiên, chuẩn học thuật; gồm tiêu đề, tên bài/unit/lesson, yêu cầu cần đạt, thiết bị, mô tả Năng lực số, mô tả tích hợp AI và ghi chú. Dịch cả nội dung PPCT nguồn tiếng Việt sang tiếng Anh nhưng giữ nguyên tên riêng, số tuần, số tiết và các mã." : "Môn học không phải Tiếng Anh: toàn bộ nội dung PPCT đầu ra viết bằng tiếng Việt chuẩn mực."}
1. Giữ nguyên tuyệt đối thứ tự tuần, bài học/chủ đề, tiết dạy và số tiết của PPCT nguồn. Chỉ chuẩn hóa lỗi chính tả và ô bị lệch cột; không tự ý bỏ bài, gộp bài hoặc đổi số tiết.
2. ${form.rewriteRequirements
    ? "Người dùng đã chọn chỉnh sửa Yêu cầu cần đạt: với từng hàng PPCT, tìm đúng bài/chủ đề tương ứng trong SGK; đối chiếu nội dung gốc, chuẩn hóa bằng động từ quan sát được, bổ sung ý còn thiếu nhưng không lấy nội dung của bài khác. Mỗi yêu cầu cần đạt riêng biệt phải nằm trên một dòng riêng trong chuỗi requirements, ngăn cách bằng ký tự xuống dòng \\n."
    : englishOutput
      ? "Người dùng KHÔNG chọn chỉnh sửa Yêu cầu cần đạt: giữ nguyên ý nghĩa và phạm vi của ô Yêu cầu cần đạt trong PPCT nguồn nhưng dịch chính xác toàn bộ sang tiếng Anh; không bổ sung, rút gọn hoặc lấy nội dung bài khác. Đổi mỗi ký hiệu ⏎ thành ký tự xuống dòng \\n để từng yêu cầu giữ một dòng riêng."
      : "Người dùng KHÔNG chọn chỉnh sửa Yêu cầu cần đạt: trường requirements phải sao chép NGUYÊN VĂN ô Yêu cầu cần đạt tương ứng trong PPCT nguồn, kể cả khi ô trống; tuyệt đối không viết lại, bổ sung, rút gọn hay lấy nội dung SGK thay thế. Đổi mỗi ký hiệu ⏎ thành ký tự xuống dòng \\n để từng yêu cầu giữ một dòng riêng. SGK chỉ dùng để hiểu bài và ánh xạ mã NLS/AI."}
3. Thiết bị dạy học phải bám đúng hoạt động, học liệu và phương tiện xuất hiện hoặc cần thiết cho bài trong SGK.
4. Giữ các hàng tiêu đề “CHỦ ĐỀ ...”, “HỌC KÌ ...” và đánh dấu rowType tương ứng là section hoặc semester; các bài học dùng rowType lesson. Mỗi hàng bài học có đúng 8 trường nội dung: tuần; bài học; tiết dạy; số tiết; yêu cầu cần đạt; thiết bị dạy học; năng lực số; tích hợp AI.
5. Mỗi bài học phải có ít nhất 01 mã Năng lực số và 01 mã Năng lực AI phù hợp trực tiếp với yêu cầu cần đạt. Có thể dùng 2–6 mã NLS và 1–3 mã AI khi bài có nhiều yêu cầu riêng biệt; không nhồi mã, không trùng mã trong cùng ô và không gán một bộ mã giống nhau cho toàn bộ PPCT. Hàng ôn tập, kiểm tra hoặc dự phòng được để trống mã nếu không có minh chứng tích hợp thật sự.
6. Năng lực số chỉ dùng ĐÚNG mã trong danh mục đã xác nhận cho lớp ${grade}: ${digitalCodes}. Không tự đổi mức, không tự thêm hậu tố b/c/d. Viết mỗi mã trên một dòng theo mẫu “mã. Biểu hiện hoặc sản phẩm số ngắn gọn, quan sát được”. Không được chép lại tên bài, câu văn, các mục KIẾN THỨC/KĨ NĂNG/PHẨM CHẤT hoặc toàn bộ nội dung từ cột Yêu cầu cần đạt; không dùng cụm “yêu cầu cần đạt của Bài...”.
7. Năng lực AI chỉ dùng ĐÚNG mã có thật của lớp ${grade} trong Quyết định 2422: ${aiCodes}. Không được lấy mã của lớp khác hoặc tự tạo số thứ tự. Viết mỗi mã trên một dòng theo mẫu “mã. Hoạt động/sản phẩm AI ngắn gọn, quan sát được”. Không được chép lại tên bài, câu văn, các mục KIẾN THỨC/KĨ NĂNG/PHẨM CHẤT hoặc toàn bộ nội dung từ cột Yêu cầu cần đạt; không dùng cụm “AI hỗ trợ yêu cầu cần đạt của Bài...”.
8. Không tích hợp hình thức. Mỗi mã phải có biểu hiện hoặc sản phẩm quan sát được; nội dung AI phải nêu kiểm chứng, trách nhiệm con người, dữ liệu cá nhân hoặc bản quyền khi phù hợp.
9. Phân bổ tuần và tổng số tiết phải nhất quán. Giữ các hàng kiểm tra, ôn tập và dự phòng nếu có trong nguồn.
10. ${englishOutput ? "Tiếng Anh chuẩn mực, tự nhiên và ngắn gọn" : "Tiếng Việt chuẩn mực, ngắn gọn"} để vừa bảng Word khổ A4 ngang theo đúng mẫu giáo viên cung cấp. Trong trường requirements, mỗi ý/yêu cầu riêng (đánh số 1., 2., 3.; gạch đầu dòng; hoặc từng yêu cầu trích từ SGK) bắt buộc xuống dòng bằng \\n, không nối nhiều yêu cầu trên cùng một dòng. Mỗi mô tả NLS/AI tối đa 35 từ và chỉ nêu hành vi, công cụ, minh chứng hoặc cách kiểm chứng đặc trưng; không diễn giải lại cột Yêu cầu cần đạt.
11. Với môn Toán, Vật lí, Hóa học, Sinh học: bắt buộc giữ đúng ký hiệu và công thức khoa học. Ưu tiên ký tự Unicode tương thích Word như x², aₙ, √, ∑, ∫, Δ, F⃗, v = s/t, H₂SO₄, 2H₂ + O₂ → 2H₂O, ADN, kiểu gen AaBb. Không viết sai chỉ số trên/dưới, đơn vị, dấu phản ứng hoặc biến số.

JSON phải đúng cấu trúc:
{
  "title": "${englishOutput ? "ENGLISH CURRICULUM DISTRIBUTION – GRADE ..." : "PHÂN PHỐI CHƯƠNG TRÌNH MÔN ... LỚP ..."}",
  "semester1Periods": "string",
  "semester2Periods": "string",
  "rows": [{
    "rowType": "lesson|section|semester",
    "week": "string",
    "lesson": "string",
    "teachingPeriod": "string",
    "periodCount": "string",
    "requirements": "${englishOutput ? "one learning outcome per line, separated by \\n" : "mỗi yêu cầu cần đạt trên một dòng, phân cách bằng \\n"}",
    "equipment": "string",
    "digitalCompetency": "${englishOutput ? "one or more lines containing a digital competence code and an English description" : "một hoặc nhiều dòng mã NLS và mô tả"}",
    "aiIntegration": "${englishOutput ? "one or more lines containing an AI competence code and an English activity/product" : "một hoặc nhiều dòng mã AI và hoạt động/sản phẩm"}"
  }],
  "notes": ["string"]
}`;
}

function matchedSourceContext(material: SourceMaterial, title: string) {
  const text = String(material.text || "").replace(/\r/g, "").trim();
  const kind = material.kind || "hoclieu";
  if (!text) return { ...material, kind, matched: false, score: 0, excerpt: "" };
  let chunks = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (chunks.length < 6) chunks = text.split(/(?<=[.!?;:])\s+(?=[A-ZÀ-ỸĐ0-9])/).map((line) => line.trim()).filter(Boolean);
  const candidates = chunks.map((chunk, index) => ({ index, score: lessonMatchScore(chunk.slice(0, 500), title) })).sort((left, right) => right.score - left.score);
  const best = candidates[0] || { index: 0, score: 0 };
  const matched = best.score >= 0.35;
  if (!matched && kind !== "hoclieu") return { ...material, kind, matched: false, score: best.score, excerpt: "" };
  const start = matched ? Math.max(0, best.index - 8) : 0;
  const end = matched ? Math.min(chunks.length, best.index + 55) : Math.min(chunks.length, 65);
  return { ...material, kind, matched, score: best.score, excerpt: chunks.slice(start, end).join("\n").slice(0, 32000) };
}

function promptFor(body: RequestBody) {
  if (body.task === "ppct") return promptForPpct(body);
  const form = body.form || {};
  const englishOutput = isEnglishSubject(form.subject);
  const selected = (body.options || []).map((id) => optionNames[id]).filter(Boolean);
  const grade = gradeNumber(form.grade);
  const digitalLevel = digitalLevelForGrade(form.grade);
  const digitalCodes = digitalPromptCatalogForGrade(form.grade);
  const aiCodes = aiPromptCatalogForGrade(form.grade);
  const ppctMatch = matchIntegratedPpct(form.ppctIntegrationText || "", form.title || "", form.grade);
  const sourceContexts = (form.sourceMaterials || []).map((material) => matchedSourceContext(material, form.title || ""));
  const matchedSources = sourceContexts.filter((source) => source.excerpt && (source.kind === "hoclieu" || source.matched));
  const unmatchedSources = sourceContexts.filter((source) => source.kind !== "hoclieu" && !source.matched).map((source) => source.name).filter(Boolean);
  const uploadedSourceInstructions = sourceContexts.length ? `
NGUỒN HỌC LIỆU ĐÃ DÒ THEO TÊN BÀI “${form.title || ""}”:
${matchedSources.map((source, index) => `--- NGUỒN ${index + 1}: ${source.name || "Không tên"} | loại: ${source.kind === "ppct" ? "PPCT" : source.kind === "sgk" ? "SGK" : source.kind === "khbd" ? "KHBD cũ/mẫu" : "học liệu"} | ${source.matched ? "đã khớp tên bài" : "nguồn tham khảo chung"}
Cấu trúc nhận diện: ${source.structure || "Không có mô tả cấu trúc"}
${source.excerpt}`).join("\n\n") || "Không có nguồn nào khớp tên bài."}
${unmatchedSources.length ? `Các tệp không tìm thấy bài tương ứng và KHÔNG ĐƯỢC dùng nội dung: ${unmatchedSources.join(", ")}.` : ""}
QUY TẮC KHAI THÁC NGUỒN:
- Ưu tiên theo thứ tự: Yêu cầu cần đạt trong PPCT hoặc nội dung giáo viên nhập → đúng bài trong SGK → đúng bài trong KHBD cũ → học liệu tham khảo.
- Chỉ lấy nội dung nằm trong đoạn đã khớp tên bài; không trộn kiến thức, công thức, thí nghiệm hoặc bài tập của bài khác.
- Tự tổng hợp đúng các ý cốt lõi, công thức/kí hiệu, thí nghiệm, hướng dẫn bài tập và gợi ý hình minh họa phục vụ trực tiếp Yêu cầu cần đạt.
- Nếu có KHBD cũ/mẫu khớp bài: giữ thứ tự mục, cách đặt tiêu đề, logic hoạt động và bố cục bảng/cột thể hiện trong nguồn; không viết lại vô cớ. Chỉ bổ sung đúng các Tùy chọn nâng cao giáo viên đã đánh dấu.
- Nếu không có KHBD cũ/mẫu khớp bài: dùng đúng nội dung SGK đã khớp tên bài để viết Sản phẩm dự kiến cụ thể cho từng hoạt động; phải thể hiện các ý chính, khái niệm, công thức/kí hiệu, kết quả thí nghiệm hoặc hướng giải bài tập cần đạt, không chỉ ghi chung chung “phiếu học tập”, “câu trả lời” hay “sản phẩm của học sinh”.
` : "\nKhông có SGK, KHBD cũ hoặc học liệu đính kèm. Chỉ dùng nội dung giáo viên nhập và kiến thức phù hợp chương trình.\n";
  const ppctInstructions = form.ppctIntegrationText?.trim()
    ? `\nNGUỒN PPCT TÍCH HỢP DO GIÁO VIÊN CUNG CẤP:\n- Tệp: ${form.ppctIntegrationFileName || "PPCT tích hợp"}\n- Bài đối chiếu: ${ppctMatch.matchedLesson || "Không tìm thấy dòng bài học tương ứng"}\n- Yêu cầu cần đạt đúng bài: ${ppctMatch.requirements || "Không có trong dòng đã khớp; dùng nội dung giáo viên nhập hoặc SGK đúng bài"}\n- Mã Năng lực số tìm thấy: ${ppctMatch.digital.map((item) => `${item.code}. ${item.indicator}`).join(" | ") || "Không có"}\n- Mã Năng lực AI tìm thấy: ${ppctMatch.ai.map((item) => `${item.code}. ${item.indicator}`).join(" | ") || "Không có"}\nQuy tắc ưu tiên: mục tiêu, nội dung, hoạt động và đánh giá phải đáp ứng đầy đủ Yêu cầu cần đạt của đúng dòng bài học. Nếu nhóm mã nào có dữ liệu ở trên thì phải dùng ĐÚNG các mã, không thay mã và không thêm mã khác. ${englishOutput ? "Dịch biểu hiện, minh chứng và công cụ đánh giá tương ứng hoàn toàn sang tiếng Anh trước khi đưa vào KHBD." : "Giữ đúng biểu hiện tương ứng từ PPCT."} Nhóm nào không có dữ liệu thì AI tự tạo phù hợp với bài.\n`
    : "\nKhông có PPCT tích hợp do giáo viên cung cấp: AI tự tạo mã Năng lực số và Năng lực AI phù hợp với bài dạy.\n";
  return `Bạn là chuyên gia giáo dục Việt Nam và thiết kế kế hoạch bài dạy theo Chương trình GDPT 2018.

Hãy tạo một kế hoạch bài dạy chuyên sâu, khả thi, tiếng Việt chuẩn mực và tuyệt đối chỉ trả về JSON hợp lệ, không Markdown, không giải thích bên ngoài JSON.

Thông tin:
- Cấp học: ${form.level || "Chưa xác định"}
- Môn: ${form.subject || "Chưa xác định"}
- Lớp: ${form.grade || "Chưa xác định"}
- Tên bài: ${form.title || "Chưa xác định"}
- Thời lượng: ${form.periods || "1"} tiết
- Bộ sách: ${form.book || "Bộ sách hiện hành"}
- Bố cục kế hoạch: ${form.columns || "2 cột"}
- Mẫu kế hoạch: ${form.template || "Tự động theo cấp học"}
- Nội dung cốt lõi/yêu cầu cần đạt: ${form.core || "Tự xác định phù hợp bài học"}
- Học liệu đính kèm: ${form.attachment || "Không có"}
- Giáo viên: ${form.teacher || "Chưa khai báo"}
- Trường: ${form.school || "Chưa khai báo"}
- Tổ chuyên môn: ${form.department || "Chưa khai báo"}
- Nội dung tích hợp: ${selected.join(", ") || "Không có yêu cầu riêng"}
${ppctInstructions}
${uploadedSourceInstructions}

Yêu cầu chuyên môn:
${englishOutput ? "QUY TẮC NGÔN NGỮ TUYỆT ĐỐI: Môn học là Tiếng Anh. Mọi chuỗi trong JSON đầu ra phải viết hoàn toàn bằng tiếng Anh tự nhiên, chuẩn sư phạm, gồm tiêu đề, tóm tắt, mục tiêu, phẩm chất, thiết bị, tên và nội dung hoạt động, lời giáo viên/học sinh, sản phẩm, đánh giá, phân hóa, câu hỏi, đáp án, slide, ghi chú và toàn bộ mô tả Năng lực số/Năng lực AI. Giữ nguyên tên riêng, mã chỉ báo và số liệu; không để sót nhãn hoặc câu tiếng Việt trong nội dung." : "QUY TẮC NGÔN NGỮ: Toàn bộ nội dung JSON đầu ra viết bằng tiếng Việt chuẩn mực."}
0. Chỉ tạo và đưa vào KHBD những Tùy chọn nâng cao có trong mục “Nội dung tích hợp” ở trên. Mục nào giáo viên không chọn thì tuyệt đối không tự bổ sung nội dung đặc thù của mục đó. Các thành phần bắt buộc của KHBD gồm mục tiêu, thiết bị, bốn hoạt động và đánh giá vẫn phải đầy đủ.
1. Nếu là Tiểu học, bám Công văn 2345; nếu là THCS/THPT, bám Công văn 5512.
2. Mục tiêu phải bám sát yêu cầu cần đạt của bài học, gồm kiến thức, năng lực chung, năng lực đặc thù và phẩm chất; dùng động từ quan sát/đánh giá được, không viết chung chung.
3. Có đủ bốn hoạt động lớn: Mở đầu/Khởi động; Hình thành kiến thức mới; Luyện tập; Vận dụng. Riêng B. Hình thành kiến thức mới phải đọc đúng mục lục, đề mục và nội dung của bài trong SGK đã khớp tên, sau đó chia thành 2–5 tiểu hoạt động B.1, B.2, B.3... theo đúng thứ tự các mục kiến thức; không gom toàn bộ kiến thức vào một hoạt động B chung chung. Với mỗi tiết tăng thêm, phải mở rộng nội dung và thời lượng tương ứng, không lặp lại máy móc.
4. Mỗi hoạt động A/C/D và từng tiểu hoạt động B.1/B.2... bắt buộc có: a) Mục tiêu; b) Nội dung; c) Sản phẩm học tập; d) Tổ chức thực hiện đúng bốn bước: Chuyển giao nhiệm vụ; Thực hiện nhiệm vụ; Báo cáo, thảo luận; Kết luận, nhận định; và Kiểm tra, đánh giá. Không được chỉ ghi tên phiếu học tập hoặc “HS trả lời”.
5. Tổng thời lượng các hoạt động phù hợp số tiết.
6. Cách tổ chức phải cụ thể: giáo viên nói/làm gì, học sinh thực hiện cá nhân/cặp/nhóm ra sao, câu lệnh hoặc câu hỏi nào được dùng, sản phẩm nào phải nộp và tiêu chí nào để đánh giá.
7. Bố cục ${form.columns || "2 cột"}: dữ liệu procedure vẫn phải đủ bốn bước; giao diện sẽ tự trình bày đúng số cột giáo viên chọn.
8. Thể hiện rõ các nội dung tích hợp đã chọn; với timeline phải phân bổ thời gian nhất quán, với STEM phải có quy trình phù hợp, với mindmap/infographic phải mô tả sản phẩm trực quan khả thi.
9. Nếu được yêu cầu, bổ sung tối thiểu 5 câu hỏi có đáp án, trò chơi có luật/cách chấm, năng lực số, giáo dục AI, GDQP&AN, hỗ trợ hòa nhập và kịch bản slide từ 8 đến 12 trang.
10. Có phương pháp/kĩ thuật dạy học, kế hoạch kiểm tra đánh giá, nhiệm vụ tự học sau bài và ghi chú tích hợp. Không bịa văn bản pháp luật hoặc trích dẫn không chắc chắn.
11. Nếu chọn năng lực số: ${ppctMatch.digital.length ? (englishOutput ? "ưu tiên các mã Năng lực số đã đối chiếu từ PPCT và dịch chính xác biểu hiện sang tiếng Anh" : "ưu tiên các mã và biểu hiện Năng lực số đã đối chiếu từ PPCT ở trên") : `chỉ chọn những chỉ báo thật sự phù hợp bài học; chỉ dùng mã đã xác nhận cho lớp ${grade}: ${digitalCodes}; không tự thêm hậu tố khác`}. Mỗi mã là một chỉ báo độc lập, gắn với đúng một hoạt động A/B/C/D và không dùng chung hoạt động với mã năng lực khác. Nếu không chọn thì trả về mảng rỗng.
12. Nếu chọn năng lực AI: ${ppctMatch.ai.length ? (englishOutput ? "ưu tiên các mã Năng lực AI đã đối chiếu từ PPCT và dịch chính xác biểu hiện sang tiếng Anh" : "ưu tiên các mã và biểu hiện Năng lực AI đã đối chiếu từ PPCT ở trên") : `chỉ chọn những chỉ báo phù hợp bài học; chỉ dùng mã có thật riêng của lớp ${grade} theo Quyết định 2422: ${aiCodes}`}. Không lấy mã của lớp khác và không tự tạo số thứ tự. Mỗi mã là một chỉ báo độc lập, gắn với đúng một hoạt động A/B/C/D và không dùng chung hoạt động với mã năng lực khác. Nếu tổng số mã Năng lực số và AI vượt quá số hoạt động, chỉ giữ tối đa bốn mã phù hợp trực tiếp nhất, không dồn nhiều mã vào một hoạt động. Nếu không chọn thì trả về mảng rỗng.
13. Trường assessment của từng hoạt động chỉ mô tả cách đánh giá tự nhiên, không lặp lại mã chỉ báo Năng lực số hoặc Năng lực AI; mỗi mã chỉ xuất hiện trong một đoạn tích hợp riêng của tiến trình.
14. Với môn Toán, Vật lí, Hóa học, Sinh học: mọi mục tiêu, nội dung, câu hỏi, đáp án và sản phẩm phải giữ đúng công thức, ký hiệu, chỉ số trên/dưới, vectơ, đơn vị và phương trình phản ứng. Ưu tiên Unicode tương thích trình duyệt và Word: x², aₙ, √, ∑, ∫, Δ, F⃗, v = s/t, H₂SO₄, 2H₂ + O₂ → 2H₂O, ADN, kiểu gen AaBb. Không dùng hình ảnh thay cho công thức.
15. Nếu có nguồn đã khớp tên bài, trường sourceSynthesis phải rút ra đúng nội dung phục vụ Yêu cầu cần đạt: các đề mục SGK; ý chính cốt lõi theo từng đề mục; công thức/kí hiệu; thí nghiệm hoặc thực hành; hướng dẫn bài tập; hình/sơ đồ minh họa nên dùng và vị trí chèn. Đây chỉ là dữ liệu nội bộ: phải phân bổ nội dung phù hợp vào mục tiêu, thiết bị và các hoạt động; KHÔNG tạo một mục riêng có tên “Nội dung cốt lõi đã đối chiếu”. Khi không có KHBD cũ/mẫu khớp bài, trường product của từng tiểu hoạt động B.1/B.2... phải nêu cụ thể kiến thức HS cần trình bày hoặc kết luận từ đúng mục SGK tương ứng, gồm khái niệm, đặc điểm, quy tắc, công thức, kết quả thí nghiệm hay cách giải nếu có; không chỉ ghi “phiếu học tập”, “câu trả lời” hoặc “sản phẩm nhóm”. Không bịa chi tiết không có căn cứ và không lấy nội dung của bài khác.
16. advancedContent phải tuân thủ từng lựa chọn: warmup chỉ có dữ liệu khi chọn Khởi động; timeline chỉ khi chọn Dòng thời gian; mindMap chỉ khi chọn Đồ họa thông tin/Sơ đồ tư duy; stemProcess chỉ khi chọn Bài học STEM; learningGame chỉ khi chọn Trò chơi học tập; defenseIntegration chỉ khi chọn Giáo dục quốc phòng và an ninh. Mục không chọn phải trả về mảng rỗng hoặc đối tượng rỗng.
17. Nếu có KHBD cũ/mẫu đã khớp, nội dung mới phải bám bố cục, thứ tự mục và cách tổ chức của mẫu. Giữ nguyên các mục a) Mục tiêu, b) Nội dung, c) Sản phẩm, d) Tổ chức thực hiện; nội dung tích hợp phải hòa vào hoạt động phù hợp, không tạo phần thuyết minh kỹ thuật tách rời làm vỡ cấu trúc mẫu.
18. MỖI mã Năng lực số hoặc Năng lực AI phải được tích hợp RIÊNG LẺ tại Bước 1 – Chuyển giao nhiệm vụ của một hoạt động phù hợp. Tiêu đề chỉ chứa đúng một mã, ví dụ “Tích hợp giáo dục AI (10.C4.1): …”; tuyệt đối không viết “(10.C4.1, 10.C4.MR1)” và không ghép biểu hiện của nhiều mã trong cùng đoạn. Mỗi hoạt động chỉ được chứa tối đa một mã năng lực; các mã khác phải phân bổ sang hoạt động A/B/C/D còn trống. Mỗi đoạn phải liền mạch, ngắn gọn, nêu rõ việc GV giao nhiệm vụ và HS thực hiện trong bối cảnh bài học; không lặp sang bước khác, sản phẩm, đánh giá hoặc mục thuyết minh riêng. Với mã 12.C2.1, nhiệm vụ yêu cầu HS đề xuất một công cụ AI giải quyết việc cụ thể ở trường/địa phương, xác định đầu vào, đầu ra, dữ liệu huấn luyện và nguyên tắc đạo đức cần lưu ý. Phải tự viết nhiệm vụ đúng tên bài, môn học, yêu cầu cần đạt và đúng biểu hiện của riêng mã đó; không sao chép tình huống không liên quan. Không tạo câu hay tiêu đề “Thể hiện đủ: Hoạt động của giáo viên; Hoạt động của học sinh; Sản phẩm/minh chứng; Công cụ và tiêu chí đánh giá”.
19. MỖI Tùy chọn nâng cao đã chọn chỉ được hòa vào đúng MỘT lần, thành MỘT đoạn liền mạch trong đúng MỘT bước của MỘT hoạt động phù hợp. Có thể dùng tiêu đề ngắn như “Khởi động:”, “Củng cố:”, “Sơ đồ tư duy:”, “Bài học STEM:” để nhận diện; không lặp nội dung sang bước khác, sản phẩm, đánh giá, không dùng nhãn kỹ thuật đặt trong ngoặc vuông và không tạo bản tóm tắt bên ngoài tiến trình.
20. Chỉ trả về đúng bốn hoạt động lớn A, B, C, D: Mở đầu/Khởi động; Hình thành kiến thức mới; Luyện tập; Vận dụng. Không tạo hoạt động lớn thứ năm hoặc mục tích hợp độc lập; riêng hoạt động B bắt buộc được phép và phải chia thành các tiểu hoạt động B.1, B.2... theo đề mục SGK. Khi bố cục là 2 cột, cột trái là “Sản phẩm dự kiến” chứa kiến thức cụ thể của từng tiểu hoạt động, cột phải là “Hoạt động của giáo viên và học sinh” chứa đủ bốn bước và nội dung tích hợp đúng vị trí. Khi bố cục là 3 cột, tách đúng hoạt động GV, hoạt động HS và Sản phẩm dự kiến của từng bước. Phiếu học tập hoặc bảng kiểm chỉ đưa vào phụ lục khi thật sự phục vụ hoạt động.

JSON phải đúng cấu trúc:
{
  "title": "string",
  "summary": "string",
  "objectives": {
    "knowledge": ["string"],
    "generalCompetencies": ["string"],
    "specificCompetencies": ["string"],
    "qualities": ["string"]
  },
  "equipment": ["string"],
  "activities": [{
    "code": "A|B|C|D",
    "title": "string",
    "duration": "string",
    "objective": "string",
    "content": "string",
    "teacherActions": ["string"],
    "studentActions": ["string"],
    "product": "string",
    "assessment": "string",
    "differentiation": "string",
    "procedure": [
      {"step": "${englishOutput ? "Assign the task" : "Chuyển giao nhiệm vụ"}", "teacher": "string", "student": "string", "product": "string"},
      {"step": "${englishOutput ? "Perform the task" : "Thực hiện nhiệm vụ"}", "teacher": "string", "student": "string", "product": "string"},
      {"step": "${englishOutput ? "Report and discuss" : "Báo cáo, thảo luận"}", "teacher": "string", "student": "string", "product": "string"},
      {"step": "${englishOutput ? "Conclude and provide feedback" : "Kết luận, nhận định"}", "teacher": "string", "student": "string", "product": "string"}
    ],
    "subActivities": [{
      "code": "B.1",
      "title": "đúng tên đề mục SGK",
      "duration": "string",
      "objective": "string",
      "content": "string",
      "teacherActions": ["string"],
      "studentActions": ["string"],
      "product": "nội dung kiến thức cụ thể HS phải nêu được theo đúng đề mục SGK",
      "assessment": "string",
      "differentiation": "string",
      "procedure": [
        {"step": "${englishOutput ? "Assign the task" : "Chuyển giao nhiệm vụ"}", "teacher": "string", "student": "string", "product": "string"},
        {"step": "${englishOutput ? "Perform the task" : "Thực hiện nhiệm vụ"}", "teacher": "string", "student": "string", "product": "string"},
        {"step": "${englishOutput ? "Report and discuss" : "Báo cáo, thảo luận"}", "teacher": "string", "student": "string", "product": "string"},
        {"step": "${englishOutput ? "Conclude and provide feedback" : "Kết luận, nhận định"}", "teacher": "string", "student": "string", "product": "string"}
      ]
    }]
  }],
  "questions": [{"question": "string", "answer": "string"}],
  "slides": [{"number": 1, "title": "string", "bullets": ["string"], "visualSuggestion": "string"}],
  "accommodations": ["string"],
  "teachingMethods": ["string"],
  "assessmentPlan": ["string"],
  "homework": ["string"],
  "integrationNotes": ["string"],
  "sourceSynthesis": {
    "coreKnowledge": ["string"],
    "formulas": ["string"],
    "experiments": ["string"],
    "guidedExercises": ["string"],
    "visualAids": [{"title": "string", "description": "string", "placement": "string"}]
  },
  "advancedContent": {
    "warmup": ["string"],
    "timeline": [{"activity": "string", "duration": "string", "purpose": "string"}],
    "mindMap": {"centralTopic": "string", "branches": ["string"]},
    "stemProcess": ["string"],
    "learningGame": {"name": "string", "objective": "string", "rules": ["string"], "scoring": "string"},
    "defenseIntegration": ["string"]
  },
  "digitalCompetencyIndicators": [{
    "code": "1.1.${digitalLevel}a",
    "domain": "${englishOutput ? "Information and data literacy" : "Khai thác dữ liệu và thông tin"}",
    "indicator": "string",
    "evidence": "${englishOutput ? "observable evidence or learning product" : "sản phẩm hoặc biểu hiện quan sát được"}",
    "activityCodes": ["A", "B"],
    "assessmentTool": "${englishOutput ? "checklist/rubric/questions/observation sheet" : "bảng kiểm/rubric/câu hỏi/phiếu quan sát"}"
  }],
  "aiCompetencyIndicators": [{
    "code": "${grade}.A1.1",
    "domain": "${englishOutput ? "Human-centred mindset" : "Tư duy lấy con người làm trung tâm"}",
    "indicator": "string",
    "evidence": "${englishOutput ? "observable evidence or learning product" : "sản phẩm hoặc biểu hiện quan sát được"}",
    "activityCodes": ["B", "D"],
    "assessmentTool": "${englishOutput ? "checklist/rubric/questions/observation sheet" : "bảng kiểm/rubric/câu hỏi/phiếu quan sát"}"
  }]
}`;
}

async function callOpenAI(key: string, model: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: "Bạn là chuyên gia giáo dục Việt Nam, tạo nội dung chính xác và chỉ trả về JSON hợp lệ." }] },
        { role: "user", content: [{ type: "input_text", text: prompt }] },
      ],
      max_output_tokens: 30000,
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(readApiError(data, response.status)), { status: response.status });
  const direct = typeof data.output_text === "string" ? data.output_text : "";
  const nested = Array.isArray(data.output)
    ? data.output.flatMap((item) => {
        if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) return [];
        return item.content.map((content: unknown) => content && typeof content === "object" && "text" in content ? String((content as { text?: unknown }).text) : "");
      }).join("")
    : "";
  return direct || nested;
}

async function callGemini(key: string, model: string, prompt: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 30000, thinkingConfig: { thinkingLevel: "medium" } },
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(readApiError(data, response.status)), { status: response.status });
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  return first?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function callKimi(key: string, model: string, prompt: string) {
  const baseUrl = (process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Bạn là chuyên gia giáo dục Việt Nam, tạo nội dung chính xác và chỉ trả về JSON hợp lệ." },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 30000,
      response_format: { type: "json_object" },
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(readApiError(data, response.status)), { status: response.status });
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as { message?: { content?: string } } | undefined;
  return first?.message?.content || "";
}

async function callKira(key: string, model: string, prompt: string) {
  const response = await fetch(`${kiraApiBase()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Bạn là chuyên gia giáo dục Việt Nam. Chỉ trả về một đối tượng JSON hợp lệ, không dùng Markdown." },
        { role: "user", content: prompt },
      ],
      stream: false,
      temperature: 0.35,
      max_tokens: 30000,
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(readApiError(data, response.status)), { status: response.status });
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as { message?: { content?: string } } | undefined;
  return first?.message?.content || "";
}

function readApiError(data: Record<string, unknown>, status: number) {
  const error = data.error && typeof data.error === "object" ? data.error as Record<string, unknown> : null;
  return String(error?.message || data.message || `Nhà cung cấp AI trả về lỗi ${status}`);
}

function shouldTryNextKey(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return [401, 403, 429].includes(status) || /quota|rate.?limit|token|credit|billing|insufficient/.test(message);
}

function shouldTryNextModel(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return [400, 404].includes(status) && /model|not available|not found|unsupported|newer model/.test(message);
}

function strings(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : fallback;
}

type Indicator = {
  code: string;
  domain: string;
  indicator: string;
  evidence: string;
  activityCodes: string[];
  assessmentTool: string;
};

type PpctCompetencyMatch = {
  digital: Indicator[];
  ai: Indicator[];
  matchedLesson: string;
  requirements: string;
};

function digitalDomain(code: string, english = false) {
  const domain = Number(code.split(".")[0]);
  if (english) return ({
    1: "Information and data literacy",
    2: "Digital communication and collaboration",
    3: "Digital content creation",
    4: "Digital safety and security",
    5: "Problem solving with digital technology",
    6: "Artificial intelligence application",
  } as Record<number, string>)[domain] || "Digital competence";
  return ({
    1: "Khai thác dữ liệu và thông tin",
    2: "Giao tiếp và hợp tác trong môi trường số",
    3: "Sáng tạo nội dung số",
    4: "An toàn và bảo mật số",
    5: "Giải quyết vấn đề với công nghệ số",
    6: "Ứng dụng trí tuệ nhân tạo",
  } as Record<number, string>)[domain] || "Năng lực số";
}

function aiDomain(code: string, english = false) {
  const group = code.match(/^\d+\.([ABCD])/i)?.[1]?.toUpperCase();
  if (english) return ({ A: "Human-centred mindset", B: "AI ethics", C: "AI techniques and applications", D: "AI system design" } as Record<string, string>)[group || ""] || "AI competence";
  return ({ A: "Tư duy lấy con người làm trung tâm", B: "Đạo đức AI", C: "Kĩ thuật và ứng dụng AI", D: "Thiết kế hệ thống AI" } as Record<string, string>)[group || ""] || "Năng lực AI";
}

function indicatorsFromPpctCell(value: string, kind: "digital" | "ai", gradeValue?: string) {
  const grade = gradeNumber(gradeValue);
  const level = digitalLevelForGrade(gradeValue);
  const pattern = kind === "digital"
    ? new RegExp(`(?:1\\.[123]|2\\.[1-6]|3\\.[1-4]|4\\.[1-4]|5\\.[1-4]|6\\.[1-3])\\.${level}[a-d]`, "gi")
    : new RegExp(`${grade}\\.[ABCD]\\d\\.(?:MR)?\\d`, "gi");
  const text = String(value || "").replace(/\s*⏎\s*/g, "\n").trim();
  const matches = [...text.matchAll(pattern)];
  const seen = new Set<string>();
  return matches.map((match, index) => {
    const rawCode = match[0];
    const code = kind === "digital" ? normalizeDigitalCode(rawCode) : rawCode.toUpperCase();
    if (kind === "digital" ? !isGradeCompatibleDigitalCode(code, grade) : !isOfficialAiCode(code, grade)) return null;
    if (seen.has(code)) return null;
    seen.add(code);
    const start = (match.index || 0) + rawCode.length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
    const description = text.slice(start, end).replace(/^[\]\s:;,.–—-]+/, "").replace(/[\[\]\n]+$/g, "").replace(/\s+/g, " ").trim()
      || (kind === "digital" ? "Sử dụng công cụ số phù hợp để thực hiện nhiệm vụ và kiểm chứng kết quả." : "Sử dụng AI có trách nhiệm, kiểm chứng kết quả và giữ quyền quyết định cuối cùng.");
    return {
      code,
      domain: kind === "digital" ? digitalDomain(code) : aiDomain(code),
      indicator: description,
      evidence: `Sản phẩm hoặc biểu hiện quan sát được: ${description}`,
      activityCodes: kind === "digital" ? ["B", "C"] : ["C", "D"],
      assessmentTool: "Bảng kiểm quan sát kết hợp rubric đánh giá sản phẩm.",
    } satisfies Indicator;
  }).filter((item): item is Indicator => Boolean(item));
}

function lessonMatchScore(candidate: string, requested: string) {
  const normalizeLesson = (value: string) => plainVietnamese(value)
    .replace(/^(?:tuan\s+\d+\s+)?(?:bai|chu de)\s*\d+[a-z]?\s*/i, "")
    .replace(/\b(?:tiet|so tiet|yeu cau can dat)\b.*$/i, "")
    .trim();
  const left = normalizeLesson(candidate);
  const right = normalizeLesson(requested);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left))) return 0.92;
  const stop = new Set(["bai", "chu", "de", "mot", "so", "va", "voi", "cua", "trong", "hoc", "tap"]);
  const tokens = [...new Set(right.split(" ").filter((word) => word.length >= 3 && !stop.has(word)))];
  const candidateTokens = new Set(left.split(" "));
  const overlap = tokens.length ? tokens.filter((word) => candidateTokens.has(word)).length / tokens.length : 0;
  const requestedNumber = plainVietnamese(requested).match(/\b(?:bai|chu de)\s*(\d+[a-z]?)\b/)?.[1];
  const candidateNumber = plainVietnamese(candidate).match(/\b(?:bai|chu de)\s*(\d+[a-z]?)\b/)?.[1];
  if (requestedNumber && candidateNumber && requestedNumber !== candidateNumber) return overlap * 0.35;
  return Math.min(1, overlap + (requestedNumber && requestedNumber === candidateNumber ? 0.28 : 0));
}

function matchIntegratedPpct(sourceText: string, title: string, gradeValue?: string): PpctCompetencyMatch {
  if (!sourceText.trim() || !title.trim()) return { digital: [], ai: [], matchedLesson: "", requirements: "" };
  const rows = sourceText.split(/\r?\n/)
    .map((line) => line.replace(/^HÀNG\s+\d+\s*:\s*/i, "").split(/\s*\|\|\s*/).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3);
  const headerIndex = rows.findIndex((cells) => cells.some((cell) => /nang luc so|\bnls\b/.test(plainVietnamese(cell))) && cells.some((cell) => /tri tue nhan tao|tich hop ai|nang luc ai/.test(plainVietnamese(cell))));
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const findColumn = (pattern: RegExp, fallback: number) => {
    const index = header.findIndex((cell) => pattern.test(plainVietnamese(cell)));
    return index >= 0 ? index : fallback;
  };
  const lessonColumn = findColumn(/bai hoc|noi dung|ten bai|chu de/, 1);
  const requirementColumn = findColumn(/yeu cau can dat|muc tieu|learning outcomes?/, Math.max(0, (header.length || 8) - 4));
  const digitalColumn = findColumn(/nang luc so|\bnls\b/, Math.max(0, (header.length || 8) - 2));
  const aiColumn = findColumn(/tri tue nhan tao|tich hop ai|nang luc ai/, Math.max(0, (header.length || 8) - 1));
  const candidates = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0)
    .map((cells) => ({ cells, lesson: cells[lessonColumn] || "", score: lessonMatchScore(cells[lessonColumn] || "", title) }))
    .filter((row) => row.lesson && !/^(chu de|hoc ki|tuan)$/.test(plainVietnamese(row.lesson)))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best && best.score >= 0.48) {
    return {
      digital: indicatorsFromPpctCell(best.cells[digitalColumn] || "", "digital", gradeValue),
      ai: indicatorsFromPpctCell(best.cells[aiColumn] || "", "ai", gradeValue),
      matchedLesson: best.lesson,
      requirements: formatRequirementLines(best.cells[requirementColumn] || ""),
    };
  }

  const titleNumber = plainVietnamese(title).match(/\b(?:bai|chu de)\s*(\d+[a-z]?)\b/)?.[1];
  const directPattern = titleNumber ? new RegExp(`(?:bài|bai|chủ đề|chu de)\\s*${titleNumber}\\b`, "i") : null;
  const directMatch = directPattern?.exec(sourceText);
  if (!directMatch) return { digital: [], ai: [], matchedLesson: "", requirements: "" };
  const window = sourceText.slice(Math.max(0, directMatch.index - 300), Math.min(sourceText.length, directMatch.index + 4000));
  return {
    digital: indicatorsFromPpctCell(window, "digital", gradeValue),
    ai: indicatorsFromPpctCell(window, "ai", gradeValue),
    matchedLesson: title,
    requirements: "",
  };
}

function normalizeIndicators(value: unknown, kind: "digital" | "ai", gradeValue?: string, english = false, fromUploadedPpct = false) {
  const grade = gradeNumber(gradeValue);
  return (Array.isArray(value) ? value : []).map((itemValue) => {
    const item = itemValue && typeof itemValue === "object" ? itemValue as Record<string, unknown> : {};
    const rawCode = String(item.code || "").replace(/[\[\]]/g, "").trim();
    const code = kind === "digital" ? normalizeDigitalCode(rawCode) : rawCode.toUpperCase();
    const valid = kind === "digital"
      ? (fromUploadedPpct ? isGradeCompatibleDigitalCode(code, grade) : isGeneratedDigitalCode(code, grade))
      : isOfficialAiCode(code, grade);
    if (!valid) return null;
    return {
      code,
      domain: String(item.domain || (kind === "digital" ? (english ? "Digital competence" : "Năng lực số") : (english ? "AI competence" : "Năng lực AI"))).trim(),
      indicator: String(item.indicator || "").trim(),
      evidence: String(item.evidence || (english ? "A learning product and observable performance produced during the activity." : "Sản phẩm học tập và biểu hiện quan sát được trong hoạt động.")).trim(),
      activityCodes: strings(item.activityCodes).map((activity) => activity.toUpperCase()).filter((activity) => /^[A-D]$/.test(activity)).slice(0, 4),
      assessmentTool: String(item.assessmentTool || (english ? "Observation checklist and product-assessment rubric." : "Bảng kiểm kết hợp quan sát và đánh giá sản phẩm.")).trim(),
    } satisfies Indicator;
  }).filter((item): item is Indicator => Boolean(item?.indicator));
}

function fallbackDigitalIndicators(gradeValue?: string, english = false): Indicator[] {
  const level = digitalLevelForGrade(gradeValue);
  if (english) return [
    { code: `1.1.${level}a`, domain: "Information and data literacy", indicator: "Identify information needs and use an appropriate search strategy to complete the learning task.", evidence: "A keyword log, a source list, and information selected for the stated purpose.", activityCodes: ["B"], assessmentTool: "Source checklist and observation record." },
    { code: `1.2.${level}a`, domain: "Evaluating digital information and data", indicator: "Analyse, compare, and evaluate the reliability of digital information, data, and content.", evidence: "A source-comparison sheet addressing authorship, date, evidence, and reliability.", activityCodes: ["B", "C"], assessmentTool: "Source-evaluation rubric." },
    { code: `2.2.${level}a`, domain: "Digital communication and collaboration", indicator: "Share digital information and content through an appropriate tool while acknowledging sources.", evidence: "A group product shared with suitable access permissions and source attribution.", activityCodes: ["C", "D"], assessmentTool: "Digital-product and collaboration-history checklist." },
    { code: `4.2.${level}a`, domain: "Digital safety and security", indicator: "Apply measures that protect personal data and privacy in a digital learning environment.", evidence: "The learner avoids sensitive data, sets suitable permissions, and explains the safety choices made.", activityCodes: ["A", "D"], assessmentTool: "Digital-safety observation checklist." },
    { code: `6.3.${level}a`, domain: "Artificial intelligence application", indicator: "Critically evaluate the reliability, bias, and suitability of generative AI content.", evidence: "An AI-response verification sheet using at least two independent sources and a reasoned conclusion.", activityCodes: ["C", "D"], assessmentTool: "AI-content verification rubric." },
  ];
  return [
    { code: `1.1.${level}a`, domain: "Khai thác dữ liệu và thông tin", indicator: "Xác định nhu cầu thông tin và sử dụng chiến lược tìm kiếm phù hợp để giải quyết nhiệm vụ học tập.", evidence: "Nhật kí từ khóa, danh mục nguồn và thông tin được chọn đúng mục đích.", activityCodes: ["B"], assessmentTool: "Bảng kiểm nguồn tin và quan sát thao tác." },
    { code: `1.2.${level}a`, domain: "Đánh giá dữ liệu, thông tin và nội dung số", indicator: "Phân tích, so sánh và đánh giá độ tin cậy của dữ liệu, thông tin và nội dung số.", evidence: "Phiếu đối chiếu nguồn có tiêu chí tác giả, thời điểm, bằng chứng và mức độ tin cậy.", activityCodes: ["B", "C"], assessmentTool: "Rubric đánh giá nguồn tin." },
    { code: `2.2.${level}a`, domain: "Giao tiếp và hợp tác trong môi trường số", indicator: "Chia sẻ dữ liệu, thông tin và nội dung số bằng công cụ phù hợp, có ghi nguồn.", evidence: "Sản phẩm nhóm được chia sẻ đúng quyền truy cập và có trích dẫn nguồn.", activityCodes: ["C", "D"], assessmentTool: "Bảng kiểm sản phẩm số và lịch sử cộng tác." },
    { code: `4.2.${level}a`, domain: "An toàn và bảo mật số", indicator: "Áp dụng biện pháp bảo vệ dữ liệu cá nhân và quyền riêng tư khi học tập trên môi trường số.", evidence: "Học sinh không nhập dữ liệu nhạy cảm, thiết lập quyền chia sẻ phù hợp và giải thích được lựa chọn.", activityCodes: ["A", "D"], assessmentTool: "Phiếu quan sát hành vi an toàn số." },
    { code: `6.3.${level}a`, domain: "Ứng dụng trí tuệ nhân tạo", indicator: "Phân tích, đánh giá có tư duy phản biện về độ tin cậy, sai lệch và tính phù hợp của nội dung do AI tạo sinh.", evidence: "Bảng kiểm chứng câu trả lời AI với ít nhất hai nguồn độc lập và kết luận có lí giải.", activityCodes: ["C", "D"], assessmentTool: "Rubric kiểm chứng nội dung AI." },
  ];
}

function fallbackAiIndicators(gradeValue?: string, english = false): Indicator[] {
  const grade = gradeNumber(gradeValue);
  const selected = [
    chooseOfficialAiCode("vai trò và trách nhiệm của con người", grade),
    chooseOfficialAiCode("đạo đức an toàn dữ liệu cá nhân quyền riêng tư", grade),
    chooseOfficialAiCode("công cụ ứng dụng AI trong học tập", grade),
    chooseOfficialAiCode("thiết kế giải pháp và sản phẩm", grade),
    ...aiCodesForGrade(grade).filter((code) => !code.includes(".MR")),
  ].filter((code, index, list): code is string => Boolean(code) && list.indexOf(code) === index).slice(0, 4);
  return selected.map((code) => {
    const group = code.match(/^\d+\.([ABCD])/)?.[1] || "A";
    const content = english
      ? ({
          A: ["Recognise human agency and responsibility when using AI support.", "A reflection identifying AI support, human verification, and final responsibility."],
          B: ["Use AI safely, ethically, and with respect for privacy and copyright.", "A safe-use checklist showing protected data, acknowledged sources, and responsible decisions."],
          C: ["Use and evaluate an age-appropriate AI technique or application for the learning task.", "A tested AI-assisted product with recorded prompts, checks, and revisions."],
          D: ["Help identify, design, test, and improve an AI-supported solution.", "A solution sketch or prototype with testing evidence and learner-led improvements."],
        } as Record<string, [string, string]>)[group]
      : ({
          A: ["Nhận thức vai trò chủ động và trách nhiệm của con người khi sử dụng AI hỗ trợ.", "Phiếu phản tư nêu rõ phần AI hỗ trợ, phần con người kiểm chứng và trách nhiệm cuối cùng."],
          B: ["Sử dụng AI an toàn, có đạo đức, tôn trọng quyền riêng tư và bản quyền.", "Bảng kiểm thể hiện dữ liệu được bảo vệ, nguồn được ghi nhận và quyết định sử dụng có trách nhiệm."],
          C: ["Sử dụng và đánh giá kĩ thuật hoặc ứng dụng AI phù hợp lứa tuổi để thực hiện nhiệm vụ học tập.", "Sản phẩm có AI hỗ trợ kèm câu lệnh, bước kiểm chứng và nội dung đã điều chỉnh."],
          D: ["Tham gia nhận diện, thiết kế, thử nghiệm và cải tiến giải pháp có AI hỗ trợ.", "Bản phác thảo hoặc sản phẩm thử có minh chứng kiểm tra và điều chỉnh do học sinh thực hiện."],
        } as Record<string, [string, string]>)[group];
    return {
      code,
      domain: aiDomain(code, english),
      indicator: content[0],
      evidence: content[1],
      activityCodes: group === "A" ? ["A", "D"] : ["B", "C"],
      assessmentTool: english ? "Observation checklist and product-assessment rubric." : "Bảng kiểm quan sát kết hợp rubric đánh giá sản phẩm.",
    } satisfies Indicator;
  });
}

function englishPpctIndicators(ppctIndicators: Indicator[], generatedIndicators: Indicator[], kind: "digital" | "ai") {
  return ppctIndicators.map((item) => generatedIndicators.find((generated) => generated.code.toUpperCase() === item.code.toUpperCase()) || {
    code: item.code,
    domain: kind === "digital" ? digitalDomain(item.code, true) : aiDomain(item.code, true),
    indicator: kind === "digital"
      ? "Apply this digital competency appropriately to complete and verify the English-language learning task."
      : "Apply this AI competency responsibly, verify the output, and retain human responsibility for the final decision.",
    evidence: "An observable English-language learning product showing appropriate and responsible use of the selected competence.",
    activityCodes: kind === "digital" ? ["B", "C"] : ["C", "D"],
    assessmentTool: "Observation checklist and product-assessment rubric.",
  });
}

function normalizePlan(value: unknown, body: RequestBody) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const englishOutput = isEnglishSubject(body.form?.subject);
  const objectives = source.objectives && typeof source.objectives === "object" ? source.objectives as Record<string, unknown> : {};
  const activities = Array.isArray(source.activities) ? source.activities : [];
  const digitalRequested = (body.options || []).includes("digital");
  const aiRequested = (body.options || []).includes("aiEducation");
  const questionRequested = (body.options || []).includes("questions");
  const slideRequested = (body.options || []).includes("slides");
  const inclusiveRequested = (body.options || []).includes("inclusive");
  const methodRequested = (body.options || []).includes("active");
  const warmupRequested = (body.options || []).includes("warmup");
  const timelineRequested = (body.options || []).includes("timeline");
  const mindMapRequested = (body.options || []).includes("mindmap");
  const stemRequested = (body.options || []).includes("stem");
  const gameRequested = (body.options || []).includes("game");
  const defenseRequested = (body.options || []).includes("defense");
  const integrationRequested = (body.options || []).some((option) => ["defense", "warmup", "timeline", "mindmap", "stem", "game"].includes(option));
  const matchedLessonSources = (body.form?.sourceMaterials || []).map((material) => matchedSourceContext(material, body.form?.title || ""));
  const hasMatchedOldLessonPlan = matchedLessonSources.some((material) => material.kind === "khbd" && material.matched && material.excerpt);
  const sourceSynthesis = source.sourceSynthesis && typeof source.sourceSynthesis === "object" ? source.sourceSynthesis as Record<string, unknown> : {};
  const advancedContent = source.advancedContent && typeof source.advancedContent === "object" ? source.advancedContent as Record<string, unknown> : {};
  const mindMap = advancedContent.mindMap && typeof advancedContent.mindMap === "object" ? advancedContent.mindMap as Record<string, unknown> : {};
  const learningGame = advancedContent.learningGame && typeof advancedContent.learningGame === "object" ? advancedContent.learningGame as Record<string, unknown> : {};
  const digitalIndicators = normalizeIndicators(source.digitalCompetencyIndicators, "digital", body.form?.grade, englishOutput);
  const aiIndicators = normalizeIndicators(source.aiCompetencyIndicators, "ai", body.form?.grade, englishOutput);
  const ppctMatch = matchIntegratedPpct(body.form?.ppctIntegrationText || "", body.form?.title || "", body.form?.grade);
  const ppctDigitalIndicators = normalizeIndicators(ppctMatch.digital, "digital", body.form?.grade, false, true);
  const ppctAiIndicators = normalizeIndicators(ppctMatch.ai, "ai", body.form?.grade, false, true);
  const lessonDigitalIndicators = englishOutput ? englishPpctIndicators(ppctDigitalIndicators, digitalIndicators, "digital") : ppctDigitalIndicators;
  const lessonAiIndicators = englishOutput ? englishPpctIndicators(ppctAiIndicators, aiIndicators, "ai") : ppctAiIndicators;
  const plan = {
    title: String(source.title || (englishOutput ? "Lesson Plan" : "Kế hoạch bài dạy")),
    summary: String(source.summary || (englishOutput ? "This lesson plan is designed to develop learners' competences and personal qualities." : "Kế hoạch được thiết kế theo định hướng phát triển phẩm chất và năng lực học sinh.")),
    objectives: {
      knowledge: strings(objectives.knowledge),
      generalCompetencies: strings(objectives.generalCompetencies),
      specificCompetencies: strings(objectives.specificCompetencies),
      qualities: strings(objectives.qualities),
    },
    equipment: strings(source.equipment),
    activities: activities.map((activityValue, index) => {
      const activity = activityValue && typeof activityValue === "object" ? activityValue as Record<string, unknown> : {};
      const procedure = Array.isArray(activity.procedure) ? activity.procedure : [];
      const subActivities = Array.isArray(activity.subActivities) ? activity.subActivities : [];
      const normalizeProcedure = (items: unknown[], fallbackProduct: unknown) => items.map((stepValue, stepIndex) => {
        const step = stepValue && typeof stepValue === "object" ? stepValue as Record<string, unknown> : {};
        return {
          step: String(step.step || (englishOutput ? ["Assign the task", "Perform the task", "Report and discuss", "Conclude and provide feedback"] : ["Chuyển giao nhiệm vụ", "Thực hiện nhiệm vụ", "Báo cáo, thảo luận", "Kết luận, nhận định"])[stepIndex] || (englishOutput ? `Step ${stepIndex + 1}` : `Bước ${stepIndex + 1}`)),
          teacher: String(step.teacher || (englishOutput ? "The teacher organises, monitors, and supports the activity." : "Giáo viên tổ chức, theo dõi và hỗ trợ.")),
          student: String(step.student || (englishOutput ? "Learners complete the task and present their product." : "Học sinh thực hiện nhiệm vụ và báo cáo sản phẩm.")),
          product: String(step.product || fallbackProduct || (englishOutput ? "Learning product." : "Sản phẩm học tập.")),
        };
      });
      return {
        code: String(activity.code || String.fromCharCode(65 + index)),
        title: String(activity.title || (englishOutput ? `Activity ${index + 1}` : `Hoạt động ${index + 1}`)),
        duration: String(activity.duration || (englishOutput ? "As allocated by the teacher" : "Theo phân bổ của giáo viên")),
        objective: String(activity.objective || (englishOutput ? "Meet the intended learning outcome for this activity." : "Đạt yêu cầu cần đạt của hoạt động.")),
        content: String(activity.content || (englishOutput ? "Lesson content." : "Nội dung bài học.")),
        teacherActions: strings(activity.teacherActions),
        studentActions: strings(activity.studentActions),
        product: String(activity.product || (englishOutput ? "Learners' learning product." : "Sản phẩm học tập của học sinh.")),
        assessment: String(activity.assessment || (englishOutput ? "Observation and product-based assessment." : "Quan sát và đánh giá theo sản phẩm học tập.")),
        differentiation: String(activity.differentiation || (englishOutput ? "Support is adjusted to learners' levels of readiness." : "Hỗ trợ phù hợp theo mức độ đáp ứng của học sinh.")),
        procedure: normalizeProcedure(procedure, activity.product),
        subActivities: subActivities.map((subValue, subIndex) => {
          const sub = subValue && typeof subValue === "object" ? subValue as Record<string, unknown> : {};
          const subProcedure = Array.isArray(sub.procedure) ? sub.procedure : [];
          return {
            code: String(sub.code || `B.${subIndex + 1}`),
            title: String(sub.title || (englishOutput ? `Knowledge topic ${subIndex + 1}` : `Nội dung ${subIndex + 1}`)),
            duration: String(sub.duration || ""),
            objective: String(sub.objective || ""),
            content: String(sub.content || ""),
            teacherActions: strings(sub.teacherActions),
            studentActions: strings(sub.studentActions),
            product: String(sub.product || ""),
            assessment: String(sub.assessment || ""),
            differentiation: String(sub.differentiation || ""),
            procedure: normalizeProcedure(subProcedure, sub.product),
          };
        }).filter((sub) => sub.title || sub.content || sub.product),
      };
    }),
    questions: questionRequested ? (Array.isArray(source.questions) ? source.questions : []).map((itemValue) => {
      const item = itemValue && typeof itemValue === "object" ? itemValue as Record<string, unknown> : {};
      return { question: String(item.question || ""), answer: String(item.answer || "") };
    }).filter((item) => item.question) : [],
    slides: slideRequested ? (Array.isArray(source.slides) ? source.slides : []).map((slideValue, index) => {
      const slide = slideValue && typeof slideValue === "object" ? slideValue as Record<string, unknown> : {};
      return { number: Number(slide.number || index + 1), title: String(slide.title || (englishOutput ? `Slide ${index + 1}` : `Trang ${index + 1}`)), bullets: strings(slide.bullets), visualSuggestion: String(slide.visualSuggestion || "") };
    }) : [],
    accommodations: inclusiveRequested ? strings(source.accommodations) : [],
    teachingMethods: methodRequested ? strings(source.teachingMethods) : [],
    assessmentPlan: strings(source.assessmentPlan),
    homework: strings(source.homework),
    integrationNotes: integrationRequested ? strings(source.integrationNotes) : [],
    sourceSynthesis: {
      coreKnowledge: strings(sourceSynthesis.coreKnowledge),
      formulas: strings(sourceSynthesis.formulas),
      experiments: strings(sourceSynthesis.experiments),
      guidedExercises: strings(sourceSynthesis.guidedExercises),
      visualAids: (Array.isArray(sourceSynthesis.visualAids) ? sourceSynthesis.visualAids : []).map((itemValue) => {
        const item = itemValue && typeof itemValue === "object" ? itemValue as Record<string, unknown> : {};
        return { title: String(item.title || "").trim(), description: String(item.description || "").trim(), placement: String(item.placement || "").trim() };
      }).filter((item) => item.title || item.description),
    },
    advancedContent: {
      warmup: warmupRequested ? strings(advancedContent.warmup) : [],
      timeline: timelineRequested ? (Array.isArray(advancedContent.timeline) ? advancedContent.timeline : []).map((itemValue) => {
        const item = itemValue && typeof itemValue === "object" ? itemValue as Record<string, unknown> : {};
        return { activity: String(item.activity || "").trim(), duration: String(item.duration || "").trim(), purpose: String(item.purpose || "").trim() };
      }).filter((item) => item.activity) : [],
      mindMap: mindMapRequested ? { centralTopic: String(mindMap.centralTopic || "").trim(), branches: strings(mindMap.branches) } : { centralTopic: "", branches: [] },
      stemProcess: stemRequested ? strings(advancedContent.stemProcess) : [],
      learningGame: gameRequested ? { name: String(learningGame.name || "").trim(), objective: String(learningGame.objective || "").trim(), rules: strings(learningGame.rules), scoring: String(learningGame.scoring || "").trim() } : { name: "", objective: "", rules: [], scoring: "" },
      defenseIntegration: defenseRequested ? strings(advancedContent.defenseIntegration) : [],
    },
    digitalCompetencyIndicators: digitalRequested ? (lessonDigitalIndicators.length ? lessonDigitalIndicators : digitalIndicators.length ? digitalIndicators : fallbackDigitalIndicators(body.form?.grade, englishOutput)) : [],
    aiCompetencyIndicators: aiRequested ? (lessonAiIndicators.length ? lessonAiIndicators : aiIndicators.length ? aiIndicators : fallbackAiIndicators(body.form?.grade, englishOutput)) : [],
  };

  const activityDefaults = englishOutput
    ? [
        ["A", "Warm-up", "5 minutes"],
        ["B", "Knowledge formation", "25 minutes"],
        ["C", "Practice and consolidation", "10 minutes"],
        ["D", "Application", "5 minutes"],
      ]
    : [
        ["A", "Khởi động", "5 phút"],
        ["B", "Hình thành kiến thức mới", "25 phút"],
        ["C", "Luyện tập và củng cố", "10 phút"],
        ["D", "Vận dụng", "5 phút"],
      ];
  const defaultSteps = englishOutput
    ? ["Assign the task", "Perform the task", "Report and discuss", "Conclude and provide feedback"]
    : ["Chuyển giao nhiệm vụ", "Thực hiện nhiệm vụ", "Báo cáo, thảo luận", "Kết luận, nhận định"];
  const seenActivityCodes = new Set<string>();
  plan.activities = plan.activities.filter((activity) => {
    const code = activity.code.trim().toUpperCase();
    if (!/^[ABCD]$/.test(code) || seenActivityCodes.has(code)) return false;
    activity.code = code;
    seenActivityCodes.add(code);
    return true;
  });
  activityDefaults.forEach(([code, title, duration]) => {
    if (plan.activities.some((activity) => activity.code.toUpperCase() === code)) return;
    plan.activities.push({
      code,
      title,
      duration,
      objective: englishOutput ? "Meet the intended learning outcome for this activity." : "Đạt yêu cầu cần đạt của hoạt động.",
      content: englishOutput ? `Learning tasks for ${body.form?.title || "the lesson"}.` : `Nhiệm vụ học tập phù hợp với ${body.form?.title || "bài học"}.`,
      teacherActions: [],
      studentActions: [],
      product: englishOutput ? "Learners' learning product." : "Sản phẩm học tập của học sinh.",
      assessment: englishOutput ? "Observation and product-based assessment." : "Quan sát và đánh giá theo sản phẩm học tập.",
      differentiation: englishOutput ? "Support is adjusted to learners' levels of readiness." : "Hỗ trợ phù hợp theo mức độ đáp ứng của học sinh.",
      procedure: defaultSteps.map((step) => ({
        step,
        teacher: englishOutput ? "The teacher organises, monitors, and supports the activity." : "Giáo viên tổ chức, theo dõi và hỗ trợ.",
        student: englishOutput ? "Learners complete the task and present their product." : "Học sinh thực hiện nhiệm vụ và báo cáo sản phẩm.",
        product: englishOutput ? "Learning product." : "Sản phẩm học tập.",
      })),
      subActivities: [],
    });
  });
  plan.activities.sort((left, right) => "ABCD".indexOf(left.code.toUpperCase()) - "ABCD".indexOf(right.code.toUpperCase()));
  plan.activities.forEach((activity) => {
    if (activity.procedure.length) return;
    activity.procedure = defaultSteps.map((step) => ({
      step,
      teacher: activity.teacherActions.join(" ") || (englishOutput ? "The teacher assigns and supports the task." : "Giáo viên giao nhiệm vụ và hỗ trợ học sinh."),
      student: activity.studentActions.join(" ") || (englishOutput ? "Learners complete and report the task." : "Học sinh thực hiện và báo cáo nhiệm vụ."),
      product: activity.product,
    }));
  });

  const knowledgeActivity = plan.activities.find((activity) => activity.code.toUpperCase() === "B");
  const lessonKnowledge = plan.sourceSynthesis.coreKnowledge.length ? plan.sourceSynthesis.coreKnowledge : plan.objectives.knowledge;
  if (knowledgeActivity) {
    const genericProduct = /^(?:sản phẩm học tập|phiếu học tập|câu trả lời|learning product|worksheet|answers?)(?: của học sinh)?[.!]?$/i;
    const compactHeading = (value: string, index: number) => {
      const cleaned = value.replace(/^\s*(?:\d+(?:\.\d+)*|[IVX]+|[-–—•])\s*[.):\-–—]?\s*/i, "").trim();
      return (cleaned.split(/[:.;]/)[0].trim() || (englishOutput ? `Knowledge topic ${index + 1}` : `Nội dung ${index + 1}`)).slice(0, 100);
    };
    if (!knowledgeActivity.subActivities.length) {
      const sourceItems = lessonKnowledge.length ? lessonKnowledge.slice(0, 5) : [knowledgeActivity.content];
      knowledgeActivity.subActivities = sourceItems.map((item, index) => {
        const product = englishOutput ? `Learners accurately state and explain: ${item}.` : `HS nêu và giải thích chính xác: ${item}.`;
        return {
          code: `B.${index + 1}`,
          title: compactHeading(item, index),
          duration: "",
          objective: englishOutput ? `Explain and apply: ${item}.` : `Trình bày, giải thích và vận dụng được: ${item}.`,
          content: item,
          teacherActions: [],
          studentActions: [],
          product,
          assessment: englishOutput ? `Assess the accuracy of the explanation and its evidence for ${item}.` : `Đánh giá độ chính xác của nội dung, lập luận và minh chứng về ${item}.`,
          differentiation: knowledgeActivity.differentiation,
          procedure: defaultSteps.map((step, stepIndex) => ({
            step,
            teacher: stepIndex === 0
              ? (englishOutput ? `Assign a task to explore “${item}” using the matching textbook section.` : `GV giao nhiệm vụ tìm hiểu “${item}” theo đúng đề mục tương ứng trong SGK.`)
              : stepIndex === 1 ? (englishOutput ? "Monitor, question, and support learners while they analyse the textbook evidence." : "GV theo dõi, đặt câu hỏi gợi mở và hỗ trợ HS phân tích minh chứng trong SGK.")
              : stepIndex === 2 ? (englishOutput ? "Invite groups to present and organise peer discussion." : "GV mời đại diện trình bày, tổ chức nhận xét và thảo luận.")
              : (englishOutput ? `Confirm the core knowledge: ${item}.` : `GV chuẩn hóa kiến thức trọng tâm: ${item}.`),
            student: stepIndex === 0
              ? (englishOutput ? "Receive the task and identify the relevant textbook heading." : "HS tiếp nhận nhiệm vụ, xác định đề mục SGK cần nghiên cứu.")
              : stepIndex === 1 ? (englishOutput ? "Read, discuss, and record the relevant evidence." : "HS đọc SGK, thảo luận và ghi lại thông tin, minh chứng liên quan.")
              : stepIndex === 2 ? (englishOutput ? "Present the result, question peers, and revise the response." : "HS trình bày kết quả, trao đổi, phản biện và điều chỉnh câu trả lời.")
              : (englishOutput ? "Record and use the confirmed knowledge." : "HS ghi nhận và vận dụng kiến thức đã được chuẩn hóa."),
            product,
          })),
        };
      });
    }
    knowledgeActivity.subActivities = knowledgeActivity.subActivities.slice(0, 5).map((sub, index) => {
      const assignedKnowledge = lessonKnowledge[index] || sub.content || sub.title;
      const specificProduct = englishOutput ? `Learners accurately state and explain: ${assignedKnowledge}.` : `HS nêu và giải thích chính xác: ${assignedKnowledge}.`;
      sub.code = `B.${index + 1}`;
      sub.title = compactHeading(sub.title || assignedKnowledge, index);
      sub.objective ||= englishOutput ? `Explain and apply: ${assignedKnowledge}.` : `Trình bày, giải thích và vận dụng được: ${assignedKnowledge}.`;
      sub.content ||= assignedKnowledge;
      if (!sub.product || genericProduct.test(sub.product.trim())) sub.product = specificProduct;
      sub.assessment ||= englishOutput ? `Assess accuracy and evidence for ${assignedKnowledge}.` : `Đánh giá độ chính xác của nội dung và minh chứng về ${assignedKnowledge}.`;
      if (!sub.procedure.length) sub.procedure = defaultSteps.map((step) => ({ step, teacher: englishOutput ? "The teacher assigns, monitors, discusses, and confirms the textbook task." : "GV giao nhiệm vụ, theo dõi, tổ chức thảo luận và chuẩn hóa kiến thức theo SGK.", student: englishOutput ? "Learners read, discuss, present, and revise the result." : "HS đọc SGK, thảo luận, trình bày và hoàn thiện kết quả.", product: sub.product }));
      sub.procedure.forEach((step) => { if (!step.product || genericProduct.test(step.product.trim())) step.product = sub.product; });
      return sub;
    });
    knowledgeActivity.content = knowledgeActivity.subActivities.map((sub) => `${sub.code}. ${sub.title}`).join("; ");
    knowledgeActivity.product = knowledgeActivity.subActivities.map((sub) => `${sub.code}: ${sub.product}`).join(" ");
  }

  const findActivity = (code: string, fallback: string) => plan.activities.find((activity) => activity.code.toUpperCase() === code.toUpperCase()) || plan.activities.find((activity) => activity.code.toUpperCase() === fallback) || plan.activities[0];
  if (!hasMatchedOldLessonPlan) {
    const coreKnowledge = plan.sourceSynthesis.coreKnowledge.length ? plan.sourceSynthesis.coreKnowledge : plan.objectives.knowledge;
    const formulas = plan.sourceSynthesis.formulas;
    const experiments = plan.sourceSynthesis.experiments;
    const guidedExercises = plan.sourceSynthesis.guidedExercises;
    const appendExpectedProduct = (code: string, details: string) => {
      const activity = findActivity(code, code);
      if (!activity || !details || activity.product.includes(details)) return;
      activity.product = `${activity.product}${activity.product ? " " : ""}${details}`.trim();
      const conclusion = activity.procedure[3] || activity.procedure[activity.procedure.length - 1];
      if (conclusion) conclusion.product = activity.product;
    };
    if (coreKnowledge.length) {
      appendExpectedProduct("A", englishOutput ? `Initial response or prediction related to: ${coreKnowledge[0]}.` : `Câu trả lời hoặc dự đoán ban đầu liên quan đến: ${coreKnowledge[0]}.`);
      appendExpectedProduct(
        "B",
        englishOutput
          ? `A presentation or worksheet accurately stating: ${coreKnowledge.slice(0, 8).join("; ")}${formulas.length ? `. Formulae and symbols: ${formulas.slice(0, 6).join("; ")}` : ""}${experiments.length ? `. Experimental or practical findings: ${experiments.slice(0, 4).join("; ")}` : ""}.`
          : `Bản trình bày hoặc phiếu học tập nêu chính xác: ${coreKnowledge.slice(0, 8).join("; ")}${formulas.length ? `. Công thức và kí hiệu: ${formulas.slice(0, 6).join("; ")}` : ""}${experiments.length ? `. Kết quả thí nghiệm hoặc thực hành: ${experiments.slice(0, 4).join("; ")}` : ""}.`,
      );
      appendExpectedProduct(
        "C",
        guidedExercises.length
          ? (englishOutput ? `Completed exercises with reasoning: ${guidedExercises.slice(0, 5).join("; ")}.` : `Bài tập đã hoàn thành kèm cách làm hoặc lập luận: ${guidedExercises.slice(0, 5).join("; ")}.`)
          : (englishOutput ? `Practice responses that correctly apply: ${coreKnowledge.slice(-2).join("; ")}.` : `Câu trả lời luyện tập vận dụng đúng: ${coreKnowledge.slice(-2).join("; ")}.`),
      );
      appendExpectedProduct("D", englishOutput ? `An application product demonstrating: ${coreKnowledge.slice(-2).join("; ")}.` : `Sản phẩm vận dụng thể hiện được: ${coreKnowledge.slice(-2).join("; ")}.`);
    }
  }
  const integrationLabels = [
    "Tích hợp năng lực số", "Digital competence integration", "Tích hợp giáo dục AI", "AI education integration",
    "Khởi động", "Warm-up", "Củng cố", "Consolidation", "Phương pháp", "Teaching method",
    "Phân bổ thời gian", "Time allocation", "Sơ đồ tư duy", "Mind map", "Bài học STEM", "STEM learning activity",
    "Trò chơi học tập", "Learning game", "Hỗ trợ học sinh", "Learner support",
    "Tích hợp giáo dục quốc phòng và an ninh", "National defence and security integration",
    "Sử dụng slide", "Slide support",
  ];
  const escapedIntegrationLabels = integrationLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const integrationPattern = new RegExp(`\\s*(?:${escapedIntegrationLabels})(?:\\s*\\([^)]+\\))?\\s*:\\s*`, "i");
  const stripIntegrationTail = (value: string) => {
    const match = integrationPattern.exec(value || "");
    return match ? value.slice(0, match.index).trim() : value;
  };
  const allIndicatorCodesToStrip = [...plan.digitalCompetencyIndicators, ...plan.aiCompetencyIndicators].map((indicator) => indicator.code).filter(Boolean);
  const activityCapacity = Math.min(4, plan.activities.length);
  const selectSeparateCompetencies = () => {
    const digital = [...plan.digitalCompetencyIndicators];
    const ai = [...plan.aiCompetencyIndicators];
    if (!activityCapacity) return { digital: [] as Indicator[], ai: [] as Indicator[] };
    if (!digital.length) return { digital: [] as Indicator[], ai: ai.slice(0, activityCapacity) };
    if (!ai.length) return { digital: digital.slice(0, activityCapacity), ai: [] as Indicator[] };

    const selectedDigital = digital.slice(0, Math.min(digital.length, Math.ceil(activityCapacity / 2)));
    const selectedAi = ai.slice(0, Math.min(ai.length, activityCapacity - selectedDigital.length));
    let remaining = activityCapacity - selectedDigital.length - selectedAi.length;
    if (remaining > 0) {
      const extraDigital = digital.slice(selectedDigital.length, selectedDigital.length + remaining);
      selectedDigital.push(...extraDigital);
      remaining -= extraDigital.length;
    }
    if (remaining > 0) selectedAi.push(...ai.slice(selectedAi.length, selectedAi.length + remaining));
    return { digital: selectedDigital, ai: selectedAi };
  };
  const selectedCompetencies = selectSeparateCompetencies();
  plan.digitalCompetencyIndicators = selectedCompetencies.digital;
  plan.aiCompetencyIndicators = selectedCompetencies.ai;

  const placementQueue: Array<{ kind: "digital" | "ai"; indicator: Indicator }> = [];
  const maxCompetencyCount = Math.max(plan.digitalCompetencyIndicators.length, plan.aiCompetencyIndicators.length);
  for (let index = 0; index < maxCompetencyCount; index += 1) {
    const digitalIndicator = plan.digitalCompetencyIndicators[index];
    const aiIndicator = plan.aiCompetencyIndicators[index];
    if (digitalIndicator) placementQueue.push({ kind: "digital", indicator: digitalIndicator });
    if (aiIndicator) placementQueue.push({ kind: "ai", indicator: aiIndicator });
  }
  const usedCompetencyActivities = new Set<string>();
  const competencyPlacements: Array<{ kind: "digital" | "ai"; indicator: Indicator; activityCode: string }> = [];
  placementQueue.forEach(({ kind, indicator }) => {
    const preferredCodes = indicator.activityCodes.map((code) => code.toUpperCase()).filter((code) => /^[A-D]$/.test(code));
    const fallbackCodes = kind === "digital" ? ["B", "C", "A", "D"] : ["D", "C", "B", "A"];
    const activityCode = [...preferredCodes, ...fallbackCodes]
      .find((code) => !usedCompetencyActivities.has(code) && plan.activities.some((activity) => activity.code.toUpperCase() === code));
    if (!activityCode) return;
    usedCompetencyActivities.add(activityCode);
    indicator.activityCodes = [activityCode];
    competencyPlacements.push({ kind, indicator, activityCode });
  });
  plan.digitalCompetencyIndicators = competencyPlacements.filter((item) => item.kind === "digital").map((item) => item.indicator);
  plan.aiCompetencyIndicators = competencyPlacements.filter((item) => item.kind === "ai").map((item) => item.indicator);

  const selectedIndicatorCodes = allIndicatorCodesToStrip;
  const stripIndicatorTail = (value: string) => {
    const positions = selectedIndicatorCodes.map((code) => (value || "").indexOf(code)).filter((position) => position >= 0);
    return positions.length ? value.slice(0, Math.min(...positions)).trim() : value;
  };
  plan.activities.forEach((activity) => {
    [activity, ...activity.subActivities].forEach((part) => {
      part.teacherActions = part.teacherActions.filter((item) => !integrationPattern.test(item) && !selectedIndicatorCodes.some((code) => item.includes(code)));
      part.studentActions = part.studentActions.filter((item) => !integrationPattern.test(item) && !selectedIndicatorCodes.some((code) => item.includes(code)));
      part.product = stripIndicatorTail(stripIntegrationTail(part.product));
      part.assessment = stripIndicatorTail(stripIntegrationTail(part.assessment));
      part.procedure.forEach((step) => {
        step.teacher = stripIndicatorTail(stripIntegrationTail(step.teacher));
        step.student = stripIndicatorTail(stripIntegrationTail(step.student));
        step.product = stripIndicatorTail(stripIntegrationTail(step.product));
      });
    });
  });
  const injectIntoActivity = (code: string, label: string, teacher: string, student: string, product: string, assessment: string, fallback = "B", stepIndex = 3) => {
    const activity = findActivity(code, fallback);
    if (!activity) return;
    const targetPart = activity.code.toUpperCase() === "B" && activity.subActivities.length ? activity.subActivities[0] : activity;
    const targetStep = targetPart.procedure[stepIndex] || targetPart.procedure[0] || targetPart.procedure[targetPart.procedure.length - 1];
    if (!targetStep) return;
    const teacherParagraph = `${label} ${teacher}`.replace(/\s+/g, " ").trim();
    targetStep.teacher = `${targetStep.teacher}${targetStep.teacher ? " " : ""}${teacherParagraph}`;
    targetStep.student = `${targetStep.student}${targetStep.student ? " " : ""}${student}`.replace(/\s+/g, " ").trim();
  };

  competencyPlacements.forEach(({ kind, indicator, activityCode }) => {
    const isAiDesignTask = kind === "ai" && /(?:^|\.)C2\.1$/i.test(indicator.code);
    if (kind === "digital") {
      injectIntoActivity(
        activityCode,
        englishOutput ? `Digital competence integration (${indicator.code}):` : `Tích hợp năng lực số (${indicator.code}):`,
        englishOutput ? `The teacher assigns a digital task directly linked to this indicator: ${indicator.indicator}.` : `GV giao một nhiệm vụ số gắn trực tiếp với chỉ báo này: ${indicator.indicator}.`,
        englishOutput ? `Learners use an appropriate tool and explain the result${indicator.evidence ? ` through ${indicator.evidence}` : ""}.` : `HS sử dụng công cụ phù hợp, thực hiện và giải thích kết quả${indicator.evidence ? ` qua ${indicator.evidence}` : ""}.`,
        "", "", activityCode, 0,
      );
      return;
    }
    injectIntoActivity(
      activityCode,
      englishOutput ? `AI education integration (${indicator.code}):` : `Tích hợp giáo dục AI (${indicator.code}):`,
      isAiDesignTask
        ? (englishOutput ? "The teacher asks each group to propose a simple AI tool that solves a specific school or local problem." : "GV yêu cầu mỗi nhóm đề xuất một công cụ AI đơn giản giúp giải quyết một việc cụ thể ở trường hoặc địa phương.")
        : (englishOutput ? `The teacher assigns one AI-related task aligned with this indicator: ${indicator.indicator}, requiring reliable-source checking and human oversight.` : `GV giao một nhiệm vụ AI riêng phù hợp với chỉ báo này: ${indicator.indicator}, đồng thời yêu cầu kiểm chứng bằng nguồn tin cậy và giữ vai trò quyết định của con người.`),
      isAiDesignTask
        ? (englishOutput ? "Learners state the tool's input and output, identify the training data it needs, and explain the ethical principle that deserves particular attention." : "HS nêu đầu vào, đầu ra của công cụ, xác định dữ liệu cần để huấn luyện và giải thích nguyên tắc đạo đức cần đặc biệt lưu ý.")
        : (englishOutput ? "Learners complete this task responsibly, compare the result with lesson evidence, and explain their conclusion." : "HS thực hiện riêng nhiệm vụ này, đối chiếu kết quả với minh chứng của bài học và giải thích kết luận."),
      "", "", activityCode, 0,
    );
  });

  if (warmupRequested && !plan.advancedContent.warmup.length) plan.advancedContent.warmup = [englishOutput ? `The teacher presents a short situation related to ${plan.title}; learners observe, predict, and state an initial question.` : `Giáo viên trình chiếu tình huống ngắn liên quan đến ${plan.title}; học sinh quan sát, dự đoán và nêu câu hỏi ban đầu.`];
  if (warmupRequested) injectIntoActivity("A", englishOutput ? "Warm-up:" : "Khởi động:", plan.advancedContent.warmup.join(" "), englishOutput ? "Learners observe, respond quickly, and explain their prediction." : "Học sinh quan sát, phản hồi nhanh và giải thích dự đoán.", englishOutput ? "Initial responses and learning questions." : "Câu trả lời ban đầu và câu hỏi học tập.", englishOutput ? "Use an observation checklist for engagement and relevance." : "Dùng bảng kiểm mức độ tham gia và tính phù hợp của câu trả lời.", "A");

  if (questionRequested && !plan.questions.length) plan.questions = [1, 2, 3, 4, 5].map((number) => ({ question: englishOutput ? `${number}. State one key idea from ${plan.title} and give an example.` : `${number}. Nêu một ý trọng tâm của ${plan.title} và cho ví dụ.`, answer: englishOutput ? "Answer according to the lesson's key content and evidence." : "Trả lời theo kiến thức trọng tâm và minh chứng trong bài học." }));
  if (questionRequested) injectIntoActivity("C", englishOutput ? "Consolidation:" : "Củng cố:", englishOutput ? "The teacher organises the selected consolidation questions and reveals the answers after learners respond." : "Giáo viên tổ chức bộ câu hỏi củng cố đã chọn và công bố đáp án sau khi học sinh trả lời.", englishOutput ? "Learners answer individually or in teams, explain their choices, and self-correct." : "Học sinh trả lời cá nhân hoặc theo đội, giải thích lựa chọn và tự sửa lỗi.", englishOutput ? "Answers to the consolidation questions." : "Phiếu/câu trả lời củng cố.", englishOutput ? "Compare responses with the answer key and record misconceptions." : "Đối chiếu đáp án, ghi nhận lỗi sai và mức độ hoàn thành.", "C");

  if (methodRequested && !plan.teachingMethods.length) plan.teachingMethods = englishOutput ? ["Problem-based learning", "Collaborative learning"] : ["Dạy học giải quyết vấn đề", "Dạy học hợp tác"];
  if (methodRequested) injectIntoActivity("B", englishOutput ? "Teaching method:" : "Phương pháp:", englishOutput ? `The teacher organises ${plan.teachingMethods.join(", ")} with a clear task, roles, and reporting criteria.` : `Giáo viên tổ chức ${plan.teachingMethods.join(", ")} với nhiệm vụ, vai trò và tiêu chí báo cáo rõ ràng.`, englishOutput ? "Learners work individually, in pairs, or in groups according to assigned roles and provide peer feedback." : "Học sinh làm việc cá nhân, cặp hoặc nhóm theo vai trò được giao và phản hồi đồng đẳng.", englishOutput ? "Collaborative learning product and peer feedback." : "Sản phẩm hợp tác và phiếu phản hồi đồng đẳng.", englishOutput ? "Use a process checklist and product rubric." : "Dùng bảng kiểm quá trình và rubric sản phẩm.");

  if (timelineRequested && !plan.advancedContent.timeline.length) plan.advancedContent.timeline = plan.activities.map((activity) => ({ activity: `${activity.code}. ${activity.title}`, duration: activity.duration, purpose: activity.objective }));
  if (timelineRequested) plan.advancedContent.timeline.forEach((item, index) => {
    const target = plan.activities[index] || plan.activities[0];
    if (!target) return;
    if (item.duration) target.duration = item.duration;
  });
  if (timelineRequested) injectIntoActivity(
    "A",
    englishOutput ? "Time allocation:" : "Phân bổ thời gian:",
    englishOutput ? `The teacher announces and monitors the lesson milestones: ${plan.advancedContent.timeline.map((item) => `${item.activity} – ${item.duration}`).join("; ")}.` : `GV công bố và theo dõi các mốc thời gian của bài học: ${plan.advancedContent.timeline.map((item) => `${item.activity} – ${item.duration}`).join("; ")}.`,
    englishOutput ? "Learners manage their work according to these milestones." : "HS tự quản lí nhiệm vụ theo các mốc đã công bố.",
    "", "", "A",
  );

  if (mindMapRequested && !plan.advancedContent.mindMap.branches.length) plan.advancedContent.mindMap = { centralTopic: plan.title, branches: plan.objectives.knowledge.slice(0, 5) };
  if (mindMapRequested) injectIntoActivity("B", englishOutput ? "Mind map:" : "Sơ đồ tư duy:", englishOutput ? `The teacher provides criteria for a mind map centred on “${plan.advancedContent.mindMap.centralTopic}”.` : `Giáo viên giao tiêu chí lập sơ đồ tư duy với chủ đề trung tâm “${plan.advancedContent.mindMap.centralTopic}”.`, englishOutput ? `Learners organise the content into these branches: ${plan.advancedContent.mindMap.branches.join("; ")}.` : `Học sinh hệ thống nội dung theo các nhánh: ${plan.advancedContent.mindMap.branches.join("; ")}.`, englishOutput ? "A labelled mind map showing accurate relationships." : "Sơ đồ tư duy có nhãn và thể hiện đúng quan hệ kiến thức.", englishOutput ? "Assess accuracy, hierarchy, connections, and presentation." : "Đánh giá độ chính xác, phân cấp, liên kết và cách trình bày.");

  if (stemRequested && !plan.advancedContent.stemProcess.length) plan.advancedContent.stemProcess = englishOutput ? ["Identify the problem", "Research background knowledge", "Propose and select a solution", "Create and test a product", "Share and improve"] : ["Xác định vấn đề", "Nghiên cứu kiến thức nền", "Đề xuất và lựa chọn giải pháp", "Chế tạo/thực hiện và thử nghiệm", "Chia sẻ và cải tiến"];
  if (stemRequested) injectIntoActivity("D", englishOutput ? "STEM learning activity:" : "Bài học STEM:", englishOutput ? `The teacher assigns a STEM challenge and guides the process: ${plan.advancedContent.stemProcess.join(" → ")}.` : `Giáo viên giao nhiệm vụ STEM và hướng dẫn quy trình: ${plan.advancedContent.stemProcess.join(" → ")}.`, englishOutput ? "Learners design, create or simulate, test, record results, and improve their solution." : "Học sinh thiết kế, chế tạo hoặc mô phỏng, thử nghiệm, ghi kết quả và cải tiến giải pháp.", englishOutput ? "A tested STEM product/model with an improvement log." : "Sản phẩm/mô hình STEM đã thử nghiệm kèm nhật kí cải tiến.", englishOutput ? "Assess the process, product, evidence from testing, and improvement." : "Đánh giá quy trình, sản phẩm, minh chứng thử nghiệm và mức độ cải tiến.", "D");

  if (gameRequested && !plan.advancedContent.learningGame.name) plan.advancedContent.learningGame = { name: englishOutput ? "Knowledge Challenge" : "Thử thách kiến thức", objective: englishOutput ? `Consolidate the core content of ${plan.title}.` : `Củng cố nội dung trọng tâm của ${plan.title}.`, rules: englishOutput ? ["Teams take turns answering within the time limit.", "A correct answer earns one point; another team may answer after an incorrect response."] : ["Các đội lần lượt trả lời trong thời gian quy định.", "Trả lời đúng được 1 điểm; đội khác được quyền trả lời khi đội trước trả lời sai."], scoring: englishOutput ? "The team with the highest total wins." : "Đội có tổng điểm cao nhất chiến thắng." };
  if (gameRequested) injectIntoActivity("C", englishOutput ? "Learning game:" : "Trò chơi học tập:", englishOutput ? `The teacher organises “${plan.advancedContent.learningGame.name}”, explains the rules, timing, and scoring.` : `Giáo viên tổ chức “${plan.advancedContent.learningGame.name}”, công bố luật, thời gian và cách tính điểm.`, englishOutput ? "Learners participate in teams, answer, justify, and challenge responses according to the rules." : "Học sinh tham gia theo đội, trả lời, giải thích và phản biện theo luật chơi.", englishOutput ? "Team answers and score sheet." : "Câu trả lời của các đội và bảng điểm.", plan.advancedContent.learningGame.scoring, "C");

  if (inclusiveRequested && !plan.accommodations.length) plan.accommodations = [englishOutput ? "Provide simplified instructions, visual support, additional response time, and an accessible product format according to individual needs." : "Cung cấp hướng dẫn ngắn gọn, hỗ trợ trực quan, thêm thời gian và hình thức sản phẩm phù hợp theo nhu cầu cá nhân."];
  if (inclusiveRequested) injectIntoActivity("B", englishOutput ? "Learner support:" : "Hỗ trợ học sinh:", englishOutput ? `The teacher provides differentiated support: ${plan.accommodations.join(" ")}` : `Giáo viên thực hiện hỗ trợ phân hóa: ${plan.accommodations.join(" ")}`, englishOutput ? "Learners use the assigned accessible material or response format and complete an equivalent task." : "Học sinh sử dụng học liệu hoặc hình thức phản hồi phù hợp và hoàn thành nhiệm vụ tương đương.", englishOutput ? "An accessible but equivalent learning product." : "Sản phẩm học tập tương đương, phù hợp khả năng tiếp cận.", englishOutput ? "Assess the same core outcome with adapted evidence." : "Đánh giá cùng yêu cầu cốt lõi bằng minh chứng đã điều chỉnh.");

  if (defenseRequested && !plan.advancedContent.defenseIntegration.length) plan.advancedContent.defenseIntegration = [englishOutput ? `Connect ${plan.title} with responsible use of information, technology, and national security where pedagogically relevant.` : `Liên hệ ${plan.title} với trách nhiệm sử dụng thông tin, công nghệ và bảo vệ an ninh quốc gia ở mức phù hợp.`];
  if (defenseRequested) injectIntoActivity("D", englishOutput ? "National defence and security integration:" : "Tích hợp giáo dục quốc phòng và an ninh:", englishOutput ? `The teacher assigns a contextual application: ${plan.advancedContent.defenseIntegration.join(" ")}` : `Giáo viên giao nhiệm vụ vận dụng theo bối cảnh: ${plan.advancedContent.defenseIntegration.join(" ")}`, englishOutput ? "Learners analyse the situation, identify responsible conduct, and present a justified response." : "Học sinh phân tích tình huống, xác định cách ứng xử có trách nhiệm và trình bày lí do.", englishOutput ? "A justified contextual response." : "Câu trả lời vận dụng có lập luận.", englishOutput ? "Assess relevance, responsibility, and reasoning." : "Đánh giá tính phù hợp, trách nhiệm và lập luận.", "D");

  if (slideRequested && !plan.slides.length) plan.slides = plan.activities.flatMap((activity, index) => [
    { number: index * 2 + 1, title: activity.title, bullets: [activity.objective, activity.content], visualSuggestion: englishOutput ? "Use a relevant diagram or source image." : "Dùng sơ đồ hoặc hình ảnh nguồn phù hợp." },
    { number: index * 2 + 2, title: englishOutput ? `${activity.title} – task` : `${activity.title} – nhiệm vụ`, bullets: [activity.product, activity.assessment], visualSuggestion: englishOutput ? "Show task steps and product criteria." : "Thể hiện các bước và tiêu chí sản phẩm." },
  ]);
  if (slideRequested) injectIntoActivity("B", englishOutput ? "Slide support:" : "Sử dụng slide:", englishOutput ? `The teacher uses slides ${plan.slides.map((slide) => slide.number).join(", ")} according to the lesson sequence, with readable visuals and source notes.` : `Giáo viên sử dụng các slide ${plan.slides.map((slide) => slide.number).join(", ")} theo tiến trình, hình ảnh dễ đọc và có ghi nguồn.`, englishOutput ? "Learners observe, interact with prompts, and record the key content rather than copying the entire slide." : "Học sinh quan sát, tương tác với câu hỏi và ghi nội dung trọng tâm, không chép toàn bộ slide.", englishOutput ? "Responses to slide prompts and concise learning notes." : "Câu trả lời theo câu hỏi trên slide và ghi chép ngắn gọn.", englishOutput ? "Check responses and note-taking against the slide objectives." : "Đối chiếu câu trả lời và ghi chép với mục tiêu từng slide.");

  return plan;
}

function plainVietnamese(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatRequirementLines(value: string) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\s*⏎\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+(?=(?:\d{1,2}[.)]|[a-zA-Z][.)])\s+(?:KIẾN THỨC|KĨ NĂNG|KỸ NĂNG|PHẨM CHẤT|NĂNG LỰC)\b)/gi, "\n")
    .replace(/\s+(?=\d{1,2}[.)]\s+[A-ZÀ-ỸĐ])/g, "\n")
    .replace(/\s+(?=[–—•▪◦]\s+)/g, "\n")
    .replace(/\s+(?=-\s+[A-ZÀ-ỸĐ])/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function sourceRequirementRows(sourceText: string) {
  const rows = sourceText.split(/\r?\n/).map((line) => line.replace(/^HÀNG\s+\d+\s*:\s*/i, "").split(/\s*\|\|\s*/).map((cell) => cell.trim())).filter((cells) => cells.length >= 5);
  const headerIndex = rows.findIndex((cells) => cells.some((cell) => /yeu cau can dat|learning outcomes?/.test(plainVietnamese(cell))));
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const findColumn = (pattern: RegExp, fallback: number) => {
    const index = header.findIndex((cell) => pattern.test(plainVietnamese(cell)));
    return index >= 0 ? index : fallback;
  };
  const lessonColumn = findColumn(/bai hoc|noi dung|ten bai|unit|lesson|topic/, 1);
  const periodColumn = findColumn(/tiet day|tiet ppct|tiet hoc|teaching period/, 2);
  const requirementColumn = findColumn(/yeu cau can dat|learning outcomes?/, 4);
  return rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0).map((cells) => ({
    lesson: String(cells[lessonColumn] || "").trim(),
    teachingPeriod: String(cells[periodColumn] || "").trim(),
    requirements: formatRequirementLines(String(cells[requirementColumn] || "")),
  })).filter((row) => row.lesson && !/^(chu de|hoc ki|unit|topic|semester)$/.test(plainVietnamese(row.lesson)));
}

function conciseCompetencyDescription(description: string, kind: "digital" | "ai", requirements: string, english = false) {
  const fallback = () => {
    const normalized = plainVietnamese(requirements);
    if (english) {
      if (kind === "digital") {
        if (/string|program|algorithm|code|coding/.test(normalized)) return "Use a programming environment to complete the task, test the output, and verify the result.";
        if (/search|data|information|source/.test(normalized)) return "Search for, select, and verify digital information required for the learning task.";
        if (/design|product|present|video|diagram/.test(normalized)) return "Create and present an appropriate digital product, then self-assess it against defined criteria.";
        if (/share|collaborat|group|discuss/.test(normalized)) return "Collaborate and share digital products responsibly with suitable access permissions.";
        return "Use an appropriate digital tool to complete the task and verify the result.";
      }
      if (/string|program|algorithm|code|coding/.test(normalized)) return "Use AI to suggest a solution or code, then test, compare, and take responsibility for the final result.";
      if (/search|data|information|source/.test(normalized)) return "Use AI to synthesise information, cross-check sources, and reject unsupported results.";
      if (/design|product|project/.test(normalized)) return "Use AI to suggest options; learners select, revise, and take responsibility for the final product.";
      return "Use AI to support the task, verify the output, and retain human responsibility for the final decision.";
    }
    if (kind === "digital") {
      if (/xau ki tu|lap trinh|thuat toan|chuong trinh|ma lenh/.test(normalized)) return "Sử dụng môi trường lập trình để thực hiện nhiệm vụ, chạy thử và kiểm chứng kết quả.";
      if (/tim kiem|du lieu|thong tin|nguon/.test(normalized)) return "Tìm kiếm, lựa chọn và kiểm chứng thông tin số phục vụ nhiệm vụ học tập.";
      if (/thiet ke|san pham|trinh bay|video|so do/.test(normalized)) return "Tạo và trình bày sản phẩm số phù hợp; tự đánh giá bằng tiêu chí đã xác định.";
      if (/chia se|hop tac|nhom|thao luan/.test(normalized)) return "Cộng tác, chia sẻ sản phẩm số đúng quyền truy cập và có trách nhiệm.";
      return "Sử dụng công cụ số phù hợp để thực hiện nhiệm vụ và kiểm chứng kết quả.";
    }
    if (/xau ki tu|lap trinh|thuat toan|chuong trinh|ma lenh/.test(normalized)) return "Dùng AI gợi ý cách giải hoặc mã lệnh; chạy thử, đối chiếu và tự chịu trách nhiệm về kết quả.";
    if (/tim kiem|du lieu|thong tin|nguon/.test(normalized)) return "Dùng AI hỗ trợ tổng hợp thông tin; đối chiếu nguồn và loại bỏ kết quả thiếu căn cứ.";
    if (/thiet ke|san pham|du an/.test(normalized)) return "Dùng AI hỗ trợ đề xuất phương án; người học lựa chọn, chỉnh sửa và chịu trách nhiệm về sản phẩm.";
    return "Dùng AI hỗ trợ thực hiện nhiệm vụ; kiểm chứng kết quả và giữ quyền quyết định cuối cùng.";
  };

  let cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback();
  const normalizedDescription = plainVietnamese(cleaned);
  const requirementTokens = new Set(plainVietnamese(requirements).split(/\s+/).filter((word) => word.length >= 4));
  const descriptionTokens = [...new Set(normalizedDescription.split(/\s+/).filter((word) => word.length >= 4))];
  const overlap = descriptionTokens.length ? descriptionTokens.filter((word) => requirementTokens.has(word)).length / descriptionTokens.length : 0;
  if (/yeu cau can dat cua bai|learning outcomes? (?:of|for)|\b1 kien thuc\b|\b2 ki nang\b|\b3 pham chat\b/.test(normalizedDescription) || overlap >= 0.68) return fallback();
  cleaned = cleaned.replace(/^(?:của|cho)\s+bài\s+\d+[^:]*:\s*/i, "").trim();
  if (cleaned.length > 260) cleaned = `${cleaned.slice(0, 257).replace(/\s+\S*$/, "")}…`;
  return cleaned || fallback();
}

function normalizePpct(value: unknown, body: RequestBody) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rows = Array.isArray(source.rows) ? source.rows : [];
  const subject = body.ppct?.subject || "Môn học";
  const englishOutput = isEnglishSubject(body.ppct?.subject);
  const grade = body.ppct?.grade || "";
  const digitalLevel = digitalLevelForGrade(body.ppct?.grade);
  const numericGrade = gradeNumber(body.ppct?.grade);
  const originalRows = sourceRequirementRows(body.ppct?.sourceText || "");
  let originalLessonIndex = 0;
  const competencyList = (value: unknown, kind: "digital" | "ai", requirements: string) => {
    const raw = Array.isArray(value)
      ? value.map((item) => typeof item === "object" && item ? Object.values(item as Record<string, unknown>).join(" ") : String(item || "")).join("\n")
      : typeof value === "object" && value
        ? Object.values(value as Record<string, unknown>).join("\n")
        : String(value || "");
    const text = raw.replace(/\r/g, "\n").trim();
    const pattern = kind === "digital"
      ? new RegExp(`(?:1\\.[123]|2\\.[1-6]|3\\.[1-4]|4\\.[1-4]|5\\.[1-4]|6\\.[1-3])\\.${digitalLevel}[a-d]`, "gi")
      : new RegExp(`${numericGrade}\\.[ABCD]\\d\\.(?:MR)?\\d`, "gi");
    const matches = [...text.matchAll(pattern)];
    const unique = new Set<string>();
    const results: string[] = [];
    matches.forEach((match, index) => {
      const code = kind === "digital" ? normalizeDigitalCode(match[0]) : match[0].toUpperCase();
      if (kind === "digital" ? !isGeneratedDigitalCode(code, numericGrade) : !isOfficialAiCode(code, numericGrade)) return;
      if (unique.has(code)) return;
      unique.add(code);
      const start = (match.index || 0) + match[0].length;
      const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
      const description = text.slice(start, end)
        .replace(/^[\]\s:;,.–—-]+/, "")
        .replace(/[\[\]\n]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      results.push(`${code}. ${conciseCompetencyDescription(description, kind, requirements, englishOutput)}`.trim());
    });
    if (results.length) return results.slice(0, kind === "digital" ? 6 : 3).join("\n");

    const normalized = plainVietnamese(requirements);
    if (kind === "digital") {
      const code = /an toan|bao mat|du lieu ca nhan|quyen rieng/.test(normalized) ? `4.2.${digitalLevel}a`
        : /tim kiem|thong tin|du lieu|nguon|tra cuu/.test(normalized) ? `1.2.${digitalLevel}a`
          : /chia se|hop tac|nhom|thao luan/.test(normalized) ? `2.2.${digitalLevel}a`
            : /thiet ke|tao san pham|trinh bay|video|so do/.test(normalized) ? `3.1.${digitalLevel}a`
              : /thuat toan|lap trinh|chuong trinh|ma lenh/.test(normalized) ? `3.4.${digitalLevel}a`
                : /mo phong|giai quyet|su co|ki thuat/.test(normalized) ? `5.1.${digitalLevel}a`
                : `1.1.${digitalLevel}a`;
      return `${code}. ${conciseCompetencyDescription("", kind, requirements, englishOutput)}`;
    }
    const code = chooseOfficialAiCode(requirements, numericGrade);
    return `${code}. ${conciseCompetencyDescription("", kind, requirements, englishOutput)}`;
  };
  return {
    title: String(source.title || (englishOutput ? `ENGLISH CURRICULUM DISTRIBUTION – GRADE ${grade}` : `PHÂN PHỐI CHƯƠNG TRÌNH MÔN ${subject.toUpperCase()} LỚP ${grade}`)).trim(),
    semester1Periods: String(source.semester1Periods || "").trim(),
    semester2Periods: String(source.semester2Periods || "").trim(),
    rows: rows.map((rowValue, index) => {
      const row = rowValue && typeof rowValue === "object" ? rowValue as Record<string, unknown> : {};
      const lesson = String(row.lesson || row.title || row.week || (englishOutput ? `Content ${index + 1}` : `Nội dung ${index + 1}`)).trim();
      const normalizedLesson = lesson.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const explicitType = String(row.rowType || "").toLowerCase();
      const rowType = explicitType === "section" || explicitType === "semester"
        ? explicitType
        : /^chu de\b/.test(normalizedLesson) ? "section"
          : /^(hoc ki|semester)\b/.test(normalizedLesson) ? "semester"
            : /^(unit|topic)\b/.test(normalizedLesson) && !String(row.teachingPeriod || "").trim() ? "section"
            : "lesson";
      if (rowType !== "lesson") {
        return { rowType, week: "", lesson, teachingPeriod: "", periodCount: "", requirements: "", equipment: "", digitalCompetency: "", aiIntegration: "" };
      }
      const generatedRequirements = String(row.requirements || "").trim();
      const normalizedTeachingPeriod = plainVietnamese(String(row.teachingPeriod || ""));
      const normalizedLessonKey = plainVietnamese(lesson).replace(/^bai\s+\d+\s*/, "");
      const matchedOriginal = originalRows.find((original) => {
        const sourceLessonKey = plainVietnamese(original.lesson).replace(/^bai\s+\d+\s*/, "");
        return sourceLessonKey === normalizedLessonKey || (sourceLessonKey.length >= 10 && (sourceLessonKey.includes(normalizedLessonKey) || normalizedLessonKey.includes(sourceLessonKey)));
      }) || originalRows.find((original) => normalizedTeachingPeriod && plainVietnamese(original.teachingPeriod) === normalizedTeachingPeriod) || originalRows[originalLessonIndex];
      originalLessonIndex += 1;
      const requirements = formatRequirementLines(englishOutput
        ? (generatedRequirements || matchedOriginal?.requirements || "")
        : body.ppct?.rewriteRequirements
          ? (generatedRequirements || matchedOriginal?.requirements || "")
          : (matchedOriginal?.requirements ?? generatedRequirements));
      const skipCompetency = /on tap|kiem tra|du phong|review|test|exam|reserve/.test(normalizedLesson);
      return {
        rowType,
        week: String(row.week || "").trim(),
        lesson,
        teachingPeriod: String(row.teachingPeriod || "").trim(),
        periodCount: String(row.periodCount || "1").trim(),
        requirements,
        equipment: String(row.equipment || (englishOutput ? "Textbook, computer, and presentation equipment." : "Sách giáo khoa, máy tính và thiết bị trình chiếu.")).trim(),
        digitalCompetency: skipCompetency ? "" : competencyList(row.digitalCompetency, "digital", requirements),
        aiIntegration: skipCompetency ? "" : competencyList(row.aiIntegration, "ai", requirements),
      };
    }).filter((row) => row.week || row.lesson || row.teachingPeriod),
    notes: strings(source.notes),
  };
}

async function runProvider(provider: Provider, model: string, prompt: string, body: RequestBody, clientKeys: string[] = []) {
  const keys = getKeys(provider, clientKeys);
  if (!keys.length) throw Object.assign(new Error(`Chưa cấu hình khóa ${provider.toUpperCase()}.`), { status: 503 });
  let lastError: unknown;
  const kiraModels = provider === "kira" ? await getKiraChatModels(keys[0]) : [];
  const models = provider === "gemini"
    ? [...new Set([model, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])]
    : provider === "kira"
      ? [...new Set([model, ...kiraModels, "kira-3.5-flash", "kira-mini-1.0"])]
      : [model];
  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    for (let index = 0; index < keys.length; index += 1) {
      try {
        const activeModel = models[modelIndex];
        const text = provider === "openai"
          ? await callOpenAI(keys[index], activeModel, prompt)
          : provider === "gemini"
            ? await callGemini(keys[index], activeModel, prompt)
            : provider === "kimi"
              ? await callKimi(keys[index], activeModel, prompt)
              : await callKira(keys[index], activeModel, prompt);
        if (!text) throw new Error("AI không trả về nội dung.");
        const parsed = normalizeScientificTree(JSON.parse(stripJsonFence(text)));
        return { plan: body.task === "ppct" ? normalizePpct(parsed, body) : normalizePlan(parsed, body), keySlot: index + 1, model: activeModel };
      } catch (error) {
        lastError = error;
        if (shouldTryNextModel(error) && modelIndex < models.length - 1) break;
        if (!shouldTryNextKey(error) || index === keys.length - 1) break;
      }
    }
    if (!shouldTryNextModel(lastError)) break;
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  try {
    const body = await request.json() as RequestBody;
    if (body.task === "ppct") {
      if (!body.ppct?.subject?.trim() || !body.ppct?.grade?.trim()) return NextResponse.json({ error: "Vui lòng chọn môn học và lớp." }, { status: 400 });
      if (!body.ppct?.sourceText?.trim()) return NextResponse.json({ error: "Vui lòng tải PPCT nguồn hoặc nhập nội dung PPCT." }, { status: 400 });
      if (!body.ppct?.textbookSourceText?.trim()) return NextResponse.json({ error: "Vui lòng tải SGK để đối chiếu yêu cầu cần đạt của từng bài." }, { status: 400 });
    } else if (!body.form?.title?.trim()) return NextResponse.json({ error: "Vui lòng nhập tên bài dạy." }, { status: 400 });
    const requested = body.provider || "auto";
    const providers: Provider[] = requested === "auto"
      ? (["kira", "openai", "gemini", "kimi"] as Provider[]).filter((provider) => getKeys(provider, body.clientKeys?.[provider]).length > 0)
      : [requested];
    if (!providers.length) return NextResponse.json({ error: "Chưa có khóa AI nào được cấu hình cho website." }, { status: 503 });

    const quotaTask = body.task === "ppct" ? "ppct" : "khbd";
    const quota = await reserveGeneration(auth.user!, quotaTask);
    if (!quota.ok) return NextResponse.json({ error: `Thầy/Cô đã sử dụng hết 5 lượt tạo ${quotaTask === "ppct" ? "PPCT" : "KHBD"} miễn phí. Vui lòng gửi yêu cầu kích hoạt không giới hạn qua Zalo 0965653750.`, code: "FREE_LIMIT_REACHED", zaloUrl: "https://zalo.me/0965653750" }, { status: 429 });

    const prompt = promptFor(body);
    let lastError: unknown;
    let completed = false;
    for (const provider of providers) {
      const configuredModel = process.env[`${provider.toUpperCase()}_MODEL`];
      const model = body.model?.trim() || configuredModel || DEFAULT_MODELS[provider];
      try {
        const result = await runProvider(provider, model, prompt, body, body.clientKeys?.[provider]);
        completed = true;
        return NextResponse.json({ ...result, provider, quota: { plan: quota.unlimited ? "unlimited" : "free", remaining: quota.remaining, task: quotaTask } });
      } catch (error) {
        lastError = error;
        if (requested !== "auto") break;
      }
    }
    if (!completed) await refundGeneration(auth.user!, quotaTask);
    const message = lastError instanceof Error ? lastError.message : body.task === "ppct" ? "Không thể tạo PPCT tích hợp." : "Không thể tạo kế hoạch bài dạy.";
    return NextResponse.json({ error: message }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ hoặc phản hồi AI chưa đúng định dạng JSON." }, { status: 400 });
  }
}
