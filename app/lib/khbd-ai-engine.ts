export type KhbdRequestLike = {
  task?: "lesson" | "ppct";
  form?: {
    level?: string;
    subject?: string;
    grade?: string;
    title?: string;
    periods?: string;
    book?: string;
    core?: string;
    columns?: string;
    template?: string;
    device?: string;
    systemInstruction?: string;
    ppctIntegrationText?: string;
    sourceMaterials?: Array<{ name?: string; kind?: string; text?: string; structure?: string }>;
  };
  options?: string[];
  [key: string]: unknown;
};

const OPTION_RULES: Record<string, string> = {
  digital: "Năng lực số chỉ được tích hợp khi HS thực hiện hành vi số thực tế trong chính hoạt động đó. Mỗi mã NLS đi vào đúng một khối tích hợp 🔴 đủ 5 phân khối, đặt ngay sau Bước 2 của một hoạt động; không rải mã sang mục tiêu, sản phẩm hay đánh giá của hoạt động khác và không ghép nhiều mã NLS vào một khối.",
  aiEducation: "Mỗi mã AI đi vào đúng một khối tích hợp 🔴 đủ 5 phân khối, đặt ngay sau Bước 2 của một hoạt động, kèm câu lệnh mẫu đặt trong ngoặc kép, yêu cầu HS kiểm chứng lại với SGK và cảnh báo không nhập thông tin cá nhân thật. Một khối được mang đồng thời một mã NLS và một mã AI khi hoạt động thực sự có cả hai hành vi.",
  defense: "Chỉ tích hợp GDQP-AN khi có liên hệ tự nhiên với nội dung bài; nếu không phù hợp thì không ép tích hợp và phải giữ trọng tâm môn học.",
  inclusive: "Đề xuất hỗ trợ sư phạm theo hướng UDL, không chẩn đoán. Chỉ điều chỉnh cách tiếp cận, phương tiện, thời gian hoặc hình thức trả lời nhưng giữ mục tiêu cốt lõi.",
  warmup: "Khởi động phải ngắn, kích hoạt kiến thức nền và dẫn trực tiếp vào nội dung bài; không tạo trò chơi chỉ để giải trí.",
  questions: "Củng cố phải có câu hỏi/đáp án hoặc sản phẩm kiểm tra nhanh bám đúng nội dung đã học, không hỏi ngoài bài.",
  active: "Chỉ nêu phương pháp/kĩ thuật thực sự được dùng trong tiến trình; hoạt động phải thể hiện đúng phương pháp đã nêu.",
  timeline: "Phân bổ thời gian phải nhất quán với tổng số tiết; không để tổng thời lượng hoạt động vượt hoặc thiếu đáng kể so với thời lượng bài.",
  mindmap: "Sơ đồ/infographic phải là đặc tả nội dung cụ thể, có chủ đề trung tâm và nhánh/khối thông tin đúng kiến thức bài; không dùng sơ đồ ASCII làm sản phẩm cuối.",
  stem: "Chỉ áp dụng STEM khi bài thực sự có vấn đề, thiết kế, thử nghiệm hoặc sản phẩm. Nếu không phù hợp thì không ép STEM.",
  game: "Trò chơi phải có tên, mục tiêu, thời gian, cách tổ chức, luật, nội dung câu hỏi/nhiệm vụ, đáp án và cách tính điểm; phải phục vụ YCCĐ.",
  slides: "Kịch bản slide phải ngắn gọn, 1 slide = 1 ý lớn, bám tiến trình KHBD; không chép nguyên giáo án lên slide.",
};

function gradeNumberOf(value?: string) {
  const match = String(value || "").match(/\d{1,2}/);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : 0;
}

function levelOf(body: KhbdRequestLike) {
  const declared = String(body.form?.level || "").toLowerCase();
  if (declared.includes("tiểu")) return "primary" as const;
  if (declared.includes("thcs")) return "lower" as const;
  if (declared.includes("thpt")) return "upper" as const;
  const grade = gradeNumberOf(body.form?.grade);
  if (grade && grade <= 5) return "primary" as const;
  if (grade && grade <= 9) return "lower" as const;
  return "upper" as const;
}

/** Minutes per period: 35 at primary level, 45 at lower and upper secondary. */
export function periodMinutes(body: KhbdRequestLike) {
  return levelOf(body) === "primary" ? 35 : 45;
}

/** Section ② of the standard: how far learners may operate AI themselves, by grade band. */
function aiOperationRule(grade: number) {
  if (grade >= 1 && grade <= 2) return "Lớp 1–2: HS CHƯA tự thao tác AI. GV là người nhập câu lệnh và trình chiếu kết quả; HS quan sát màn hình, trả lời miệng, nhận xét đúng/sai. Tuyệt đối không yêu cầu HS đăng nhập bất kỳ tài khoản nào.";
  if (grade >= 3 && grade <= 5) return "Lớp 3–5: HS thao tác theo nhóm dưới sự giám sát trực tiếp của GV và chỉ dùng câu lệnh mẫu GV cho sẵn, không tự soạn câu lệnh.";
  if (grade >= 6 && grade <= 7) return "Lớp 6–7: HS dùng câu lệnh mẫu có sẵn và chỉ chỉnh sửa nhẹ; bắt buộc đối chiếu kết quả với SGK.";
  if (grade >= 8 && grade <= 9) return "Lớp 8–9: HS tự viết câu lệnh, so sánh hai kết quả AI và chỉ ra chỗ AI trả lời sai.";
  return "Lớp 10–12: HS tự thiết kế câu lệnh, tinh chỉnh nhiều lượt, phản biện kết quả AI, phân tích mặt trái của công nghệ và lập luận đa chiều.";
}

function levelParameters(body: KhbdRequestLike) {
  const level = levelOf(body);
  const grade = gradeNumberOf(body.form?.grade);
  if (level === "primary") return [
    "Cấp Tiểu học – bám Công văn 2345/BGDĐT-GDTH.",
    "Cấu trúc: I. YÊU CẦU CẦN ĐẠT | II. ĐỒ DÙNG DẠY HỌC | III. CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU (Khởi động – Khám phá/Hình thành kiến thức – Luyện tập, thực hành – Vận dụng, trải nghiệm) | IV. ĐIỀU CHỈNH SAU BÀI DẠY.",
    "1 tiết = 35 phút.",
    aiOperationRule(grade || 1),
    "Câu chữ ngắn, từ ngữ đời thường, mỗi nhiệm vụ tối đa 2 câu. Sản phẩm là nói miệng, tranh vẽ, phiếu tô màu hoặc thẻ chữ.",
    "Trọng tâm NLS/AI: nhận biết – an toàn – ứng xử. KHÔNG bàn về thuật toán hay đạo đức AI ở mức phân tích.",
  ];
  if (level === "lower") return [
    "Cấp THCS – bám Công văn 5512/BGDĐT-GDTrH.",
    "Cấu trúc: I. MỤC TIÊU (1. Kiến thức – 2. Năng lực – 3. Phẩm chất) | II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU | III. TIẾN TRÌNH DẠY HỌC (1. Khởi động – 2. Hình thành kiến thức mới – 3. Luyện tập – 4. Vận dụng – 5. Hướng dẫn tự học).",
    "1 tiết = 45 phút.",
    aiOperationRule(grade || 6),
    "Trọng tâm NLS/AI: khai thác thông tin – kiểm chứng – an toàn dữ liệu cá nhân – nhận biết AI tạo sinh.",
  ];
  return [
    "Cấp THPT – bám Công văn 5512/BGDĐT-GDTrH.",
    "Cấu trúc: I. MỤC TIÊU (1. Kiến thức – 2. Năng lực – 3. Phẩm chất) | II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU | III. TIẾN TRÌNH DẠY HỌC (1. Khởi động – 2. Hình thành kiến thức mới – 3. Luyện tập – 4. Vận dụng – 5. Hướng dẫn tự học).",
    "1 tiết = 45 phút.",
    aiOperationRule(grade || 10),
    "Trọng tâm NLS/AI: đánh giá nguồn – đạo đức AI – trách nhiệm số – ứng dụng AI giải quyết vấn đề thực tiễn.",
  ];
}

function columnRule(body: KhbdRequestLike) {
  const columns = String(body.form?.columns || "2 cột").trim();
  if (columns.startsWith("1")) return "KIỂU 1 CỘT: không kẻ bảng, viết mạch dọc theo bốn bước “* Bước 1: Chuyển giao nhiệm vụ – GV: … – HS: …”, “* Bước 2: Thực hiện nhiệm vụ”, “* Bước 3: Báo cáo, thảo luận”, “* Bước 4: Kết luận, nhận định”. Khối tích hợp 🔴 chèn ngay sau Bước 2.";
  if (columns.startsWith("3")) return "KIỂU 3 CỘT: bảng “Hoạt động của giáo viên | Hoạt động của học sinh | Sản phẩm dự kiến”. Hai cột đầu viết song song theo bốn bước, dòng nào của GV thì đối ứng dòng đó của HS. Khối tích hợp 🔴 chèn ở dòng Bước 2 và tách theo cột: phần “Giáo viên hướng dẫn” đặt cột 1, phần “Học sinh thực hiện” đặt cột 2, phần “Sản phẩm số hoặc sản phẩm AI” đặt cột 3, phần “Tích hợp NLS & AI” và “Đánh giá” đặt ở cột 1 dưới cùng.";
  return "KIỂU 2 CỘT: bảng “Sản phẩm dự kiến | Hoạt động của giáo viên và học sinh”. Cột trái chứa toàn bộ nội dung kiến thức chốt, bảng biểu và kết luận. Cột phải chứa đủ bốn bước; khối tích hợp 🔴 chèn trong cột phải, ngay sau Bước 2.";
}

export function buildKhbdMegaInstruction(body: KhbdRequestLike) {
  if (body.task === "ppct") return "";
  const options = Array.isArray(body.options) ? body.options : [];
  const selectedRules = options.map((id) => OPTION_RULES[id]).filter(Boolean);
  const periods = Number(String(body.form?.periods || "1").match(/\d+/)?.[0] || 1);
  const minutes = periodMinutes(body);
  const device = String(body.form?.device || "").trim();
  const hasSourcePlan = (body.form?.sourceMaterials || []).some((material) => material.kind === "khbd" && String(material.text || "").trim());
  return [
    "CHỈ DẪN CHẤT LƯỢNG KHBD CẤP HỆ THỐNG:",
    "Bạn là chuyên gia thiết kế và tích hợp Năng lực số (NLS) và Trí tuệ nhân tạo (AI) vào Kế hoạch bài dạy theo Chương trình GDPT 2018, Thông tư 02/2025/TT-BGDĐT (Khung NLS cho người học) và Quyết định 2422/QĐ-BGDĐT (Khung nội dung giáo dục AI cho HS phổ thông).",
    "",
    "A. THAM SỐ THEO CẤP – LỚP (tự áp dụng, không hỏi lại):",
    ...levelParameters(body).map((rule) => `- ${rule}`),
    `- Tổng thời lượng các hoạt động phải bằng ${periods} tiết × ${minutes} phút = ${periods * minutes} phút. Cuối bài ghi phép cộng kiểm tra thời lượng.`,
    "- QUY TẮC BẬC NLS: dùng đúng bậc ghi trong danh mục mã được cung cấp. Nếu danh mục không ghi bậc, giữ nguyên mã không kèm bậc và nêu rõ trong ghi chú; tuyệt đối không tự gán bậc.",
    "",
    `B. KIỂU BẢNG “d) Tổ chức thực hiện”: ${columnRule(body)} Ngoài phần Tổ chức thực hiện, mọi mục khác giữ cách trình bày phân cấp thông thường.`,
    "",
    "C. NGUYÊN TẮC BẤT DI BẤT DỊCH:",
    hasSourcePlan
      ? "1. Có giáo án gốc: KHÔNG sửa, rút gọn hay diễn đạt lại bất kỳ câu chữ nào của giáo án gốc, kể cả tiêu đề, bảng kiến thức, câu hỏi và bài tập. Chỉ được CHÈN THÊM khối tích hợp."
      : "1. Không có giáo án gốc: soạn mới từ đầu theo đúng cấu trúc của cấp học, bám SGK và Yêu cầu cần đạt của đúng bài.",
    "2. CHỈ dùng mã NLS và mã AI có trong danh mục được cung cấp. Không tự đặt mã mới, không suy đoán nội dung chỉ báo. Thiếu dữ liệu thì để trống và ghi rõ lí do, không bịa.",
    "3. KHÔNG ép tích hợp. Hoạt động thuần thao tác tính toán hoặc ghi nhớ mà dùng AI là khiên cưỡng thì ghi rõ ở Phần 1: “(Không ép tích hợp AI vì …)” và chỉ gắn mã NLS.",
    "4. Mức độ thao tác AI của HS phải đúng theo tham số lớp ở mục A.",
    `5. Mọi khối tích hợp phải khả thi với điều kiện thiết bị đã khai báo: ${device || "chưa khai báo, giả định lớp chỉ có máy chiếu của GV"}. Nếu lớp không có thiết bị cho HS, nêu phương án thay thế là GV trình chiếu kết quả đã chuẩn bị trước.`,
    "6. Mọi hoạt động dùng AI đều phải kèm yêu cầu HS kiểm chứng lại với SGK và cảnh báo không nhập thông tin cá nhân thật.",
    "",
    "D. CẤU TRÚC SẢN PHẨM:",
    "- PHẦN 1. BẢNG ĐỊNH HƯỚNG TÍCH HỢP (trường integrationPlan), bảng 6 cột: Hoạt động | Nội dung tích hợp | Mã NLS | Mã AI (nếu có) | Sản phẩm dự kiến | Lưu ý đạo đức số / đạo đức AI. Mã NLS ghi dạng “(NLS 6.1 – Ứng dụng trí tuệ nhân tạo – Bậc …)”; mã AI ghi dạng “(NLc – Các kĩ thuật và ứng dụng AI: Tương tác với AI tạo sinh)”. Cột lưu ý đạo đức nêu một nguyên tắc cụ thể, không viết chung chung.",
    "- PHẦN 2. KHBD hoàn chỉnh đã chèn tích hợp, trình bày đúng cấu trúc cấp học và đúng kiểu bảng đã chọn. Bổ sung vào Mục tiêu/Yêu cầu cần đạt một mục “Năng lực số & AI” ghi mã kèm nguyên văn nội dung chỉ báo.",
    "",
    "E. KHUÔN MẪU KHỐI TÍCH HỢP (trường integrationBlock, giữ nguyên ký hiệu 🔴 và ●, đủ 5 phân khối theo thứ tự):",
    "🔴 [Tích hợp NLS & AI] — ● NLS: (mã – tên chỉ báo – Bậc …); ● AI: (mã – tên năng lực thành phần: biểu hiện cụ thể); ● Biểu hiện: HS làm gì trong chính hoạt động này để thể hiện năng lực đó.",
    "🔴 [Giáo viên hướng dẫn] — ● Giáo viên giao nhiệm vụ: nguyên văn lời GV, kèm CÂU LỆNH mẫu đặt trong ngoặc kép, độ dài và độ khó đúng theo lớp; ● Giáo viên nhắc nhở an toàn hoặc đạo đức số; ● Giáo viên tổ chức kiểm chứng và nhận xét.",
    "🔴 [Học sinh thực hiện] — 3–4 gạch đầu dòng: thao tác; nhập hoặc nghe câu lệnh; ghi chép và đối chiếu SGK; trình bày trước lớp bằng một câu mẫu. Riêng lớp 1–2 thay bằng: quan sát màn hình; trả lời miệng; nhận xét đúng/sai.",
    "🔴 [Sản phẩm số hoặc sản phẩm AI] — sản phẩm cụ thể HS nộp được, phù hợp lứa tuổi.",
    "🔴 [Đánh giá] — ● Tiêu chí; ● Đạt NLS; ● Đạt năng lực AI; ● Đánh giá bằng hành vi: hành vi quan sát được, phân biệt rõ HS hiểu bài với HS chép nguyên văn kết quả AI.",
    "",
    "F. TỰ KIỂM TRA TRƯỚC KHI XUẤT (trường selfCheck, mỗi dòng ghi passed true/false và lí do nếu false): đúng cấu trúc cấp học; đúng kiểu bảng đã chọn; mức độ thao tác AI đúng với lớp; mọi mã NLS/AI nằm trong danh mục và có ghi bậc; mỗi dòng Phần 1 đều có khối 🔴 tương ứng ở Phần 2 và ngược lại; mỗi khối 🔴 đủ 5 phân khối; có prompt mẫu cụ thể kèm yêu cầu kiểm chứng và lưu ý an toàn; có phương án thay thế khi thiếu thiết bị; tổng thời lượng khớp số tiết; giáo án gốc còn nguyên văn nếu có. Mục nào chưa đạt thì tự sửa nội dung rồi mới trả kết quả.",
    "",
    "G. QUY TẮC NỀN:",
    "1. Ưu tiên nguồn theo thứ tự: PPCT/YCCĐ giáo viên cung cấp -> SGK đúng bài -> KHBD cũ đúng bài -> học liệu tham khảo -> kiến thức chương trình. Không trộn nội dung của bài khác.",
    "2. Trước khi viết, phải ngầm lập ma trận truy vết YCCĐ -> mục tiêu -> hoạt động -> nhiệm vụ -> sản phẩm -> đánh giá. Mọi mục tiêu phải xuất hiện trong hoạt động và mọi hoạt động phải phục vụ mục tiêu.",
    "3. Sản phẩm dự kiến phải là kiến thức hoặc sản phẩm kiểm tra được, ví dụ bảng so sánh, sơ đồ, công thức, kết luận, đoạn văn, đoạn hội thoại, mã nguồn, phiếu học tập có nội dung cụ thể; không dùng các câu chung chung như 'HS trả lời', 'HS thảo luận', 'HS hoàn thành nhiệm vụ'.",
    "4. Riêng phần Hình thành kiến thức mới phải tách thành 2-5 hoạt động nhỏ theo đúng các đề mục nội dung của bài trong SGK. Mỗi hoạt động nhỏ có đủ: a) Mục tiêu; b) Nội dung; c) Sản phẩm học tập; d) Tổ chức thực hiện với 4 bước; Kiểm tra, đánh giá.",
    "5. Bước 1 phải ghi rõ GV giao nhiệm vụ gì, câu hỏi/câu lệnh nào, tài liệu/công cụ nào, hình thức tổ chức, thời gian và sản phẩm cần nộp. Bước 4 phải ghi rõ nội dung kiến thức được chốt, không chỉ viết 'GV chốt kiến thức'.",
    "6. Không bịa trang SGK, tác giả, YCCĐ, số tiết PPCT, mã năng lực số, mã AI, số liệu, thí nghiệm hoặc văn bản pháp lý.",
    "7. Chỉ đưa vào KHBD các tùy chọn nâng cao đã được người dùng bật; không tự thêm module chưa chọn.",
    "8. Đọc nội dung chữ, bảng, công thức, sơ đồ và chú thích từ SGK, KHBD hoặc hình ảnh giáo viên tải lên; phân bổ ý chính và hình minh họa phù hợp vào Sản phẩm dự kiến của từng hoạt động.",
    "9. Văn phong hành chính – sư phạm, tiếng Việt chuẩn mực, xưng “GV” và “HS”, sẵn sàng dán vào Word. Giữ ký hiệu 🔴 và ● để nhận diện phần chèn thêm.",
    "10. Ưu tiên tính khả thi trong lớp học thực tế, không làm bài dạy quá tải và không biến nội dung tích hợp thành phần trang trí.",
    ...selectedRules.map((rule, index) => `${11 + index}. ${rule}`),
  ].join("\n");
}

export type QualityIssue = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
};

function textArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

export function validateKhbdPlan(plan: unknown, body: KhbdRequestLike) {
  const issues: QualityIssue[] = [];
  const data = plan && typeof plan === "object" ? plan as Record<string, unknown> : {};
  const activities = Array.isArray(data.activities) ? data.activities as Array<Record<string, unknown>> : [];
  if (activities.length < 4) issues.push({ code: "MISSING_ACTIVITIES", severity: "high", message: "KHBD chưa đủ tối thiểu 4 hoạt động cốt lõi." });

  const genericProduct = /^(?:hs\s+)?(?:trả lời|thảo luận|hoàn thành(?: nhiệm vụ)?|phiếu học tập|sản phẩm(?: của học sinh)?)[.!]?$/i;
  for (const [index, activity] of activities.entries()) {
    const product = String(activity.product || "").trim();
    if (!product || genericProduct.test(product)) issues.push({ code: "GENERIC_PRODUCT", severity: "high", message: `Hoạt động ${index + 1} có Sản phẩm dự kiến quá chung chung.` });
    const procedure = Array.isArray(activity.procedure) ? activity.procedure as Array<Record<string, unknown>> : [];
    if (procedure.length < 4) issues.push({ code: "INCOMPLETE_PROCEDURE", severity: "high", message: `Hoạt động ${index + 1} chưa đủ 4 bước tổ chức thực hiện.` });
    const conclusion = procedure[3];
    const conclusionText = `${String(conclusion?.teacher || "")} ${String(conclusion?.product || "")}`.trim();
    if (conclusion && /(?:chốt kiến thức|kết luận|nhận xét)\.?$/i.test(conclusionText) && conclusionText.length < 90) {
      issues.push({ code: "VAGUE_CONCLUSION", severity: "medium", message: `Hoạt động ${index + 1} chưa nêu rõ nội dung kiến thức cần chốt.` });
    }
  }
  const knowledgeActivity = activities.find((activity) => String(activity.code || "").trim().toUpperCase() === "B");
  const subActivities = Array.isArray(knowledgeActivity?.subActivities) ? knowledgeActivity.subActivities as Array<Record<string, unknown>> : [];
  if (!subActivities.length) issues.push({ code: "KNOWLEDGE_NOT_SPLIT", severity: "high", message: "Phần B chưa được tách thành các hoạt động nhỏ theo đề mục SGK." });
  subActivities.forEach((subActivity, index) => {
    const required = ["objective", "content", "product", "assessment"].filter((field) => !String(subActivity[field] || "").trim());
    if (required.length) issues.push({ code: "INCOMPLETE_KNOWLEDGE_SUBACTIVITY", severity: "high", message: `Hoạt động B.${index + 1} còn thiếu mục a, b, c hoặc Kiểm tra, đánh giá.` });
    const product = String(subActivity.product || "").trim();
    if (!product || genericProduct.test(product)) issues.push({ code: "GENERIC_SUBACTIVITY_PRODUCT", severity: "high", message: `Sản phẩm dự kiến của hoạt động B.${index + 1} chưa nêu kiến thức cụ thể từ SGK.` });
    const procedure = Array.isArray(subActivity.procedure) ? subActivity.procedure as Array<Record<string, unknown>> : [];
    if (procedure.length < 4) issues.push({ code: "INCOMPLETE_SUBACTIVITY_PROCEDURE", severity: "high", message: `Hoạt động B.${index + 1} chưa đủ 4 bước tổ chức thực hiện.` });
  });

  const options = new Set(Array.isArray(body.options) ? body.options : []);
  const digital = textArray(data.digitalCompetencyIndicators);
  const ai = textArray(data.aiCompetencyIndicators);
  if (options.has("digital") && !Array.isArray(data.digitalCompetencyIndicators)) issues.push({ code: "DIGITAL_MISSING", severity: "high", message: "Đã chọn Năng lực số nhưng đầu ra chưa có dữ liệu chỉ báo NLS." });
  if (options.has("aiEducation") && !Array.isArray(data.aiCompetencyIndicators)) issues.push({ code: "AI_MISSING", severity: "high", message: "Đã chọn Năng lực AI nhưng đầu ra chưa có dữ liệu chỉ báo AI." });
  if (!options.has("digital") && digital.length) issues.push({ code: "DIGITAL_UNSELECTED", severity: "medium", message: "Có nội dung NLS dù người dùng không chọn tùy chọn này." });
  if (!options.has("aiEducation") && ai.length) issues.push({ code: "AI_UNSELECTED", severity: "medium", message: "Có nội dung AI dù người dùng không chọn tùy chọn này." });

  const integrationRequested = options.has("digital") || options.has("aiEducation");
  const integrationPlan = Array.isArray(data.integrationPlan) ? data.integrationPlan as Array<Record<string, unknown>> : [];
  const blocks: Array<{ owner: string; block: Record<string, unknown> }> = [];
  for (const activity of activities) {
    const parts = [{ label: String(activity.code || "").trim() || "?", value: activity }, ...(Array.isArray(activity.subActivities) ? activity.subActivities as Array<Record<string, unknown>> : []).map((sub) => ({ label: String(sub.code || "").trim() || "?", value: sub }))];
    for (const part of parts) {
      for (const step of (Array.isArray(part.value.procedure) ? part.value.procedure as Array<Record<string, unknown>> : [])) {
        const block = step.integration;
        if (block && typeof block === "object") blocks.push({ owner: part.label, block: block as Record<string, unknown> });
      }
    }
  }

  if (integrationRequested) {
    if (!integrationPlan.length) issues.push({ code: "INTEGRATION_PLAN_MISSING", severity: "high", message: "Thiếu Phần 1 – Bảng định hướng tích hợp." });
    if (!blocks.length) issues.push({ code: "INTEGRATION_BLOCK_MISSING", severity: "high", message: "Tiến trình chưa có khối tích hợp 🔴 nào ở Phần 2." });
    if (integrationPlan.length && blocks.length && integrationPlan.length !== blocks.length) {
      issues.push({ code: "INTEGRATION_PLAN_MISMATCH", severity: "high", message: `Phần 1 có ${integrationPlan.length} dòng nhưng Phần 2 có ${blocks.length} khối tích hợp; hai phần phải tương ứng một–một.` });
    }
    integrationPlan.forEach((row, index) => {
      const missing = ["activity", "content", "product", "ethicsNote"].filter((field) => !String(row[field] || "").trim());
      if (missing.length) issues.push({ code: "INTEGRATION_PLAN_INCOMPLETE", severity: "medium", message: `Dòng ${index + 1} của Bảng định hướng tích hợp còn thiếu: ${missing.join(", ")}.` });
      if (!String(row.digitalCode || "").trim() && !String(row.aiCode || "").trim()) {
        issues.push({ code: "INTEGRATION_PLAN_NO_CODE", severity: "high", message: `Dòng ${index + 1} của Bảng định hướng tích hợp không có mã NLS lẫn mã AI.` });
      }
    });
    blocks.forEach(({ owner, block }) => {
      const emptyText = ["manifestation", "criteria", "behaviour", "ethicsNote"].filter((field) => !String(block[field] || "").trim());
      const emptyLists = ["teacherGuidance", "studentActions", "digitalProduct"].filter((field) => !textArray(block[field]).length);
      if (emptyText.length || emptyLists.length) {
        issues.push({ code: "INTEGRATION_BLOCK_INCOMPLETE", severity: "high", message: `Khối tích hợp của hoạt động ${owner} chưa đủ 5 phân khối; còn thiếu: ${[...emptyText, ...emptyLists].join(", ")}.` });
      }
      const guidance = textArray(block.teacherGuidance).join(" ");
      if (guidance && !/["“”']/.test(guidance)) {
        issues.push({ code: "INTEGRATION_BLOCK_NO_PROMPT", severity: "medium", message: `Khối tích hợp của hoạt động ${owner} chưa có câu lệnh mẫu đặt trong ngoặc kép.` });
      }
    });
  }

  const selfCheck = Array.isArray(data.selfCheck) ? data.selfCheck as Array<Record<string, unknown>> : [];
  selfCheck.filter((item) => item.passed === false).forEach((item) => {
    issues.push({ code: "SELF_CHECK_FAILED", severity: "medium", message: `Tự kiểm tra chưa đạt: ${String(item.label || "mục không tên").trim()}${item.note ? ` – ${String(item.note).trim()}` : ""}.` });
  });

  const high = issues.filter((issue) => issue.severity === "high").length;
  const medium = issues.filter((issue) => issue.severity === "medium").length;
  const low = issues.filter((issue) => issue.severity === "low").length;
  const score = Math.max(0, 100 - high * 15 - medium * 7 - low * 2);
  return {
    score,
    valid: high === 0 && score >= 90,
    needsReview: high > 0 || score < 90,
    issues,
  };
}
