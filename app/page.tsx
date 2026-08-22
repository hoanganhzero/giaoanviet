"use client";

import { useEffect, useRef, useState } from "react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import AccountControls, { useAccountGate } from "@/app/components/AccountControls";
import BrandLogo from "@/app/components/BrandLogo";

const features = [
  { icon: "✦", title: "Soạn kế hoạch bài dạy thông minh", text: "Tạo kế hoạch bài dạy mạch lạc theo Công văn 2345 và 5512, đủ mục tiêu, thiết bị và tiến trình." },
  { icon: "▦", title: "Đủ 4 hoạt động", text: "Tự động xây dựng Khởi động, Hình thành kiến thức, Luyện tập và Vận dụng theo định hướng phát triển năng lực." },
  { icon: "↗", title: "Xuất bản thuận tiện", text: "Xem trước, sao chép nội dung và tải bản Word để tiếp tục chỉnh sửa, in ấn hoặc nộp chuyên môn." },
];

const steps = [
  ["01", "Khai báo bài dạy", "Chọn cấp học, môn, lớp, bộ sách và số tiết."],
  ["02", "Tinh chỉnh yêu cầu", "Bổ sung nội dung cốt lõi, năng lực số và phương pháp."],
  ["03", "Nhận bản hoàn chỉnh", "Kiểm tra, chỉnh sửa và xuất tài liệu theo nhu cầu."],
];

const options = [
  ["digital", "Mã hóa năng lực số", "Chỉ báo theo Thông tư 02/2025 và Công văn 3456", "▣"],
  ["aiEducation", "Mã hóa năng lực AI", "Khung hiện hành theo Quyết định 2422/QĐ-BGDĐT", "✦"],
  ["defense", "Giáo dục quốc phòng và an ninh", "Theo Thông tư 08/2024/TT-BGDĐT", "◇"],
  ["inclusive", "Hỗ trợ học sinh khuyết tật", "Theo Thông tư 03/2018/TT-BGDĐT", "♡"],
  ["warmup", "Khởi động", "Hoạt động mở đầu sôi nổi", "✣"],
  ["questions", "Củng cố", "Bộ câu hỏi có đáp án", "?"],
  ["active", "Phương pháp", "Dạy học tích cực", "☀"],
  ["timeline", "Dòng thời gian", "Gợi ý phân bổ thời gian", "◷"],
  ["mindmap", "Đồ họa thông tin · Sơ đồ tư duy", "Khái quát nội dung kiến thức", "⌘"],
  ["stem", "Bài học STEM", "Quy trình STEM theo bài học", "⬡"],
  ["game", "Trò chơi học tập", "Tương tác sinh động", "◆"],
  ["slides", "Gợi ý slide", "Kịch bản trình chiếu theo tiến trình", "▤"],
];

const subjects = [
  "Toán", "Ngữ văn", "Tiếng Anh", "Ngoại ngữ khác", "Vật lí", "Hóa học", "Sinh học",
  "Lịch sử", "Địa lí", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ",
  "Giáo dục thể chất", "Giáo dục quốc phòng và an ninh", "Âm nhạc", "Mĩ thuật",
  "Hoạt động trải nghiệm, hướng nghiệp", "Nội dung giáo dục của địa phương",
];

const bookSeries = [
  "Kết nối tri thức với cuộc sống", "Global Success",
];

type LessonForm = {
  level: string;
  subject: string;
  grade: string;
  title: string;
  periods: string;
  book: string;
  core: string;
  teacher: string;
  school: string;
  department: string;
  columns: string;
  template: string;
  attachment: string;
};

type Provider = "auto" | "openai" | "gemini" | "kimi" | "kira";

type CompetencyIndicator = {
  code: string;
  domain: string;
  indicator: string;
  evidence: string;
  activityCodes: string[];
  assessmentTool: string;
};

type LessonProcedureStep = {
  step: string;
  teacher: string;
  student: string;
  product: string;
};

type LessonActivity = {
  code: string;
  title: string;
  duration: string;
  objective: string;
  content: string;
  teacherActions: string[];
  studentActions: string[];
  product: string;
  assessment: string;
  differentiation: string;
  procedure?: LessonProcedureStep[];
  subActivities?: LessonActivity[];
  illustrations?: SourceIllustration[];
};

type SourceIllustration = {
  dataUrl: string;
  caption: string;
  sourceName: string;
};

type AIPlan = {
  title: string;
  summary: string;
  objectives: {
    knowledge: string[];
    generalCompetencies: string[];
    specificCompetencies: string[];
    qualities: string[];
  };
  equipment: string[];
  activities: LessonActivity[];
  questions: Array<{ question: string; answer: string }>;
  slides: Array<{ number: number; title: string; bullets: string[]; visualSuggestion: string }>;
  accommodations: string[];
  teachingMethods?: string[];
  assessmentPlan?: string[];
  homework?: string[];
  integrationNotes?: string[];
  sourceSynthesis?: {
    coreKnowledge: string[];
    formulas: string[];
    experiments: string[];
    guidedExercises: string[];
    visualAids: Array<{ title: string; description: string; placement: string }>;
  };
  advancedContent?: {
    warmup: string[];
    timeline: Array<{ activity: string; duration: string; purpose: string }>;
    mindMap: { centralTopic: string; branches: string[] };
    stemProcess: string[];
    learningGame: { name: string; objective: string; rules: string[]; scoring: string };
    defenseIntegration: string[];
  };
  digitalCompetencyIndicators?: CompetencyIndicator[];
  aiCompetencyIndicators?: CompetencyIndicator[];
};

type SourceKind = "ppct" | "sgk" | "khbd" | "hoclieu";

type SourceFile = {
  name: string;
  size: number;
  status: "Đang đọc" | "Đã đọc nội dung" | "Đã ghi nhận" | "Không đọc được";
  characters: number;
  kind: SourceKind;
  text: string;
  structure: string;
  illustrations: SourceIllustration[];
  rawFile?: File;
};

type PpctIntegrationFile = {
  name: string;
  size: number;
  rows: number;
  text: string;
};

type ProviderStatus = Record<"openai" | "gemini" | "kimi" | "kira", {
  name: string;
  configuredKeys: number;
  model: string;
  models?: Array<{ id: string; name: string; description: string; isFree: boolean }>;
  automaticModels?: boolean;
  websiteKeyAvailable?: boolean;
  baseUrl?: string;
}>;

type ManualKeys = Record<"openai" | "gemini" | "kimi" | "kira", string[]>;

const initialForm: LessonForm = {
  level: "THPT",
  subject: "Tiếng Anh",
  grade: "10",
  title: "",
  periods: "1",
  book: "Global Success",
  core: "",
  teacher: "Trần Quốc Hoàng Anh",
  school: "",
  department: "Tổ Ngoại ngữ",
  columns: "2 cột",
  template: "Tự động theo cấp học",
  attachment: "",
};

export default function Home() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"home" | "planner">("home");
  const [form, setForm] = useState<LessonForm>(initialForm);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiGuideOpen, setApiGuideOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("auto");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [generationMeta, setGenerationMeta] = useState({ provider: "", model: "", keySlot: 0 });
  const [contentTab, setContentTab] = useState<"text" | "file">("text");
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [khbdTemplateFile, setKhbdTemplateFile] = useState<File | null>(null);
  const [ppctIntegrationFile, setPpctIntegrationFile] = useState<PpctIntegrationFile | null>(null);
  const [readingPpct, setReadingPpct] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [editingPlan, setEditingPlan] = useState(false);
  const [manualKeys, setManualKeys] = useState<ManualKeys>({ openai: ["", "", ""], gemini: ["", "", ""], kimi: ["", "", ""], kira: ["", "", ""] });
  const [keyEditor, setKeyEditor] = useState<"openai" | "gemini" | "kimi" | "kira">("openai");
  const documentRef = useRef<HTMLElement | null>(null);
  const englishDocument = form.subject === "Tiếng Anh";
  const account = useAccountGate("/?soan-khbd=1", mode === "planner");
  const docText = englishDocument ? {
    lessonPlan: "LESSON PLAN", teacher: "Teacher", subject: "Subject", grade: "Grade", duration: "Duration", periods: "period(s)",
    objectives: "I. OBJECTIVES", knowledge: "1. Knowledge", generalCompetencies: "2. General competences", specificCompetencies: "3. Subject-specific competences", qualities: "Personal qualities",
    digital: "Digital competence — coded indicators", digitalSource: "Under Circular No. 02/2025/TT-BGDĐT and the guidance in Official Dispatch No. 3456/BGDĐT-GDPT.",
    ai: "Artificial intelligence (AI) competence — coded indicators", aiSource: "Under the current AI Education Framework issued with Decision No. 2422/QĐ-BGDĐT dated 18 August 2026.",
    evidence: "Evidence", activities: "Activities", assessmentTool: "Assessment tool", crosswalk: "Indicator – activity – evidence – assessment crosswalk", indicatorCode: "Indicator code", activity: "Activity", evidenceProduct: "Observable evidence/product",
    equipment: "II. TEACHING EQUIPMENT AND LEARNING MATERIALS", methods: "Teaching methods and techniques", procedure: "III. TEACHING AND LEARNING PROCEDURE",
    objective: "Objective", content: "Content", learningProduct: "Learning product", expectedProduct: "Expected learning product", implementation: "Implementation", step: "Procedure step", teacherActivity: "Teacher's activities", learnerActivity: "Learners' activities", combinedActivity: "Teacher and learner activities", assessment: "Assessment", differentiation: "Differentiation/support", productEvidence: "Product/evidence", productCriteria: "Learning product and assessment criteria included",
    review: "IV. CONSOLIDATION QUESTIONS", answer: "Answer", support: "V. ADAPTATIONS AND LEARNER SUPPORT", assessmentPlan: "VI. ASSESSMENT PLAN", homework: "VII. SELF-STUDY GUIDANCE AND FOLLOW-UP TASKS", integration: "VIII. INTEGRATION NOTES AND ORGANISATIONAL GUIDANCE", slides: "SLIDE DECK OUTLINE",
  } : {
    lessonPlan: "KẾ HOẠCH BÀI DẠY", teacher: "Giáo viên", subject: "Môn", grade: "Lớp", duration: "Thời lượng", periods: "tiết",
    objectives: "I. MỤC TIÊU", knowledge: "1. Kiến thức", generalCompetencies: "2. Năng lực chung", specificCompetencies: "3. Năng lực đặc thù", qualities: "Phẩm chất",
    digital: "Năng lực số — mã hóa chỉ báo", digitalSource: "Theo Thông tư 02/2025/TT-BGDĐT và hướng dẫn tại Công văn 3456/BGDĐT-GDPT.",
    ai: "Năng lực trí tuệ nhân tạo (AI) — mã hóa chỉ báo", aiSource: "Theo Khung nội dung giáo dục AI hiện hành, ban hành kèm Quyết định 2422/QĐ-BGDĐT ngày 18/08/2026.",
    evidence: "Biểu hiện/minh chứng", activities: "Hoạt động", assessmentTool: "Công cụ đánh giá", crosswalk: "Bảng đối chiếu chỉ báo – hoạt động – minh chứng – đánh giá", indicatorCode: "Mã chỉ báo", activity: "Hoạt động", evidenceProduct: "Biểu hiện/sản phẩm minh chứng",
    equipment: "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU", methods: "Phương pháp, kĩ thuật dạy học", procedure: "III. TIẾN TRÌNH DẠY HỌC",
    objective: "Mục tiêu", content: "Nội dung", learningProduct: "Sản phẩm học tập", expectedProduct: "Sản phẩm dự kiến", implementation: "Tổ chức thực hiện", step: "Bước tổ chức", teacherActivity: "Hoạt động của giáo viên", learnerActivity: "Hoạt động của học sinh", combinedActivity: "Hoạt động của giáo viên và học sinh", assessment: "Kiểm tra, đánh giá", differentiation: "Phân hóa/hỗ trợ", productEvidence: "Sản phẩm/minh chứng", productCriteria: "Có sản phẩm và tiêu chí đánh giá",
    review: "IV. CÂU HỎI CỦNG CỐ", answer: "Đáp án", support: "V. ĐIỀU CHỈNH VÀ HỖ TRỢ HỌC SINH", assessmentPlan: "VI. KẾ HOẠCH KIỂM TRA, ĐÁNH GIÁ", homework: "VII. HƯỚNG DẪN TỰ HỌC VÀ NHIỆM VỤ SAU BÀI HỌC", integration: "VIII. NỘI DUNG TÍCH HỢP VÀ LƯU Ý TỔ CHỨC", slides: "KỊCH BẢN SLIDE BÀI GIẢNG",
  };

  const renderProcedureText = (value: string) => {
    const sections = value.split(/(?=(?:Tích hợp năng lực số|Tích hợp giáo dục AI|Digital competence integration|AI education integration)\s*\([^)]+\):)/gi);
    return <>{sections.map((section, index) => {
      const match = section.match(/^((?:Tích hợp năng lực số|Tích hợp giáo dục AI|Digital competence integration|AI education integration)\s*\([^)]+\):)\s*/i);
      if (!match) return <span key={`${index}-${section.slice(0, 20)}`}>{section}</span>;
      return <span className="integrated-procedure-note" key={`${index}-${match[1]}`}>{index > 0 && <br />}<strong><em>{match[1]}</em></strong><br />{section.slice(match[0].length)}</span>;
    })}</>;
  };

  const renderActivityDetails = (activity: LessonActivity, keyPrefix: string) => (
    <>
      <p><b>a) {docText.objective}:</b> {activity.objective}</p>
      <p><b>b) {docText.content}:</b> {activity.content}</p>
      <p><b>c) {docText.learningProduct}:</b> {activity.product}</p>
      {form.columns.startsWith("1") && activity.illustrations?.map((illustration, index) => <figure className="product-illustration" key={`${keyPrefix}-image-${index}`}><img src={illustration.dataUrl} alt={illustration.caption} /><figcaption>{illustration.caption} <small>({illustration.sourceName})</small></figcaption></figure>)}
      <p><b>d) {docText.implementation}:</b></p>
      {activity.procedure?.length ? <div className={`procedure-layout columns-${form.columns.charAt(0)}`}>
        {form.columns.startsWith("1") ? <ol>{activity.procedure.map((step, index) => <li key={`${keyPrefix}-${index}`}><b>{step.step}:</b> {renderProcedureText(step.teacher)} {renderProcedureText(step.student)}</li>)}</ol>
          : form.columns.startsWith("2") ? <table><thead><tr><th>{docText.expectedProduct}</th><th>{docText.combinedActivity}</th></tr></thead><tbody><tr><td><p>{activity.product}</p>{activity.illustrations?.map((illustration, index) => <figure className="product-illustration" key={`${keyPrefix}-image-${index}`}><img src={illustration.dataUrl} alt={illustration.caption} /><figcaption>{illustration.caption} <small>({illustration.sourceName})</small></figcaption></figure>)}</td><td><ol>{activity.procedure.map((step, index) => <li key={`${keyPrefix}-${index}`}><b>{step.step}:</b> {renderProcedureText(step.teacher)} {renderProcedureText(step.student)}</li>)}</ol></td></tr></tbody></table>
            : <table><thead><tr><th>{docText.teacherActivity}</th><th>{docText.learnerActivity}</th><th>{docText.expectedProduct}</th></tr></thead><tbody>{activity.procedure.map((step, index) => <tr key={`${keyPrefix}-${index}`}><td><b>{step.step}:</b> {renderProcedureText(step.teacher)}</td><td><b>{step.step}:</b> {renderProcedureText(step.student)}</td><td>{step.product || activity.product}{index === 0 && activity.illustrations?.map((illustration, imageIndex) => <figure className="product-illustration" key={`${keyPrefix}-image-${imageIndex}`}><img src={illustration.dataUrl} alt={illustration.caption} /><figcaption>{illustration.caption} <small>({illustration.sourceName})</small></figcaption></figure>)}</td></tr>)}</tbody></table>}
      </div> : <div className="action-columns"><div><b>{docText.teacherActivity}</b><ol>{activity.teacherActions.map((item) => <li key={item}>{renderProcedureText(item)}</li>)}</ol></div><div><b>{docText.learnerActivity}</b><ol>{activity.studentActions.map((item) => <li key={item}>{renderProcedureText(item)}</li>)}</ol></div></div>}
      <p><b>{docText.assessment}:</b> {activity.assessment}</p>
      {enabled.includes("inclusive") && <p><b>{docText.differentiation}:</b> {activity.differentiation}</p>}
    </>
  );

  const refreshProviderStatus = () => {
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((data) => setProviderStatus(data.providers || null))
      .catch(() => setProviderStatus(null));
  };

  useEffect(() => {
    if (!settingsOpen) return;
    refreshProviderStatus();
  }, [settingsOpen]);

  useEffect(() => {
    if (mode === "planner") refreshProviderStatus();
  }, [mode]);

  useEffect(() => {
    if (!account) return;
    setForm((current) => ({ ...current, teacher: account.fullName || current.teacher, school: account.school || current.school, department: account.department || current.department }));
  }, [account]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("giao-an-ai-session-keys");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ManualKeys>;
        setManualKeys({
          openai: parsed.openai || ["", "", ""],
          gemini: parsed.gemini || ["", "", ""],
          kimi: parsed.kimi || ["", "", ""],
          kira: parsed.kira || ["", "", ""],
        });
      }
    } catch { /* Trình duyệt đang chặn lưu phiên. */ }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("soan-khbd") === "1") setMode("planner");
    if (window.sessionStorage.getItem("open-ai-settings") === "1") {
      setMode("planner");
      setSettingsOpen(true);
      window.sessionStorage.removeItem("open-ai-settings");
    }
  }, []);

  const begin = () => {
    setGuideOpen(false);
    setMode("planner");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateForm = (key: keyof LessonForm, value: string) => setForm((current) => key === "subject"
    ? { ...current, subject: value, book: value === "Tiếng Anh" ? "Global Success" : "Kết nối tri thức với cuộc sống" }
    : { ...current, [key]: value });

  const toggleOption = (id: string) => setEnabled((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const extractSourceText = async (file: File) => {
    if (/\.(txt|md|csv|json|html?)$/i.test(file.name)) return file.text();
    if (/\.(docx|pptx)$/i.test(file.name)) {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const paths = Object.keys(archive)
        .filter((path) => file.name.toLowerCase().endsWith(".docx") ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/i.test(path))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return paths.map((path) => {
        const xml = new DOMParser().parseFromString(strFromU8(archive[path]), "application/xml");
        const paragraphs = Array.from(xml.getElementsByTagName("*")).filter((node) => node.localName === "p");
        return paragraphs.map((paragraph) => Array.from(paragraph.getElementsByTagName("*")).filter((node) => node.localName === "t").map((node) => node.textContent || "").join("").trim()).filter(Boolean).join("\n");
      }).join("\n");
    }
    if (/\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages: string[] = [];
      for (let index = 1; index <= Math.min(pdf.numPages, 80); index += 1) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
      }
      return pages.join("\n");
    }
    return "";
  };

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const compactImageDataUrl = async (blob: Blob) => {
    const sourceUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Không đọc được hình ảnh")); image.src = sourceUrl; });
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const extractSourceIllustrations = async (file: File): Promise<SourceIllustration[]> => {
    if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      return [{ dataUrl: await compactImageDataUrl(file), caption: `Hình minh họa từ ${file.name}`, sourceName: file.name }];
    }
    if (!/\.docx$/i.test(file.name)) return [];
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const documentFile = archive["word/document.xml"];
    const relationFile = archive["word/_rels/document.xml.rels"];
    if (!documentFile || !relationFile) return [];
    const parser = new DOMParser();
    const documentXml = parser.parseFromString(strFromU8(documentFile), "application/xml");
    const relationXml = parser.parseFromString(strFromU8(relationFile), "application/xml");
    const relationTargets = new Map<string, string>();
    Array.from(relationXml.getElementsByTagName("*")).filter((node) => node.localName === "Relationship").forEach((node) => {
      const id = node.getAttribute("Id");
      const target = node.getAttribute("Target");
      if (id && target && /media\//i.test(target)) relationTargets.set(id, `word/${target.replace(/^\.\.\//, "")}`.replace(/\/\.\//g, "/"));
    });
    const normalizedTitle = form.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const paragraphs = Array.from(documentXml.getElementsByTagName("*")).filter((node) => node.localName === "p");
    const paragraphTextValue = (paragraph: Element) => Array.from(paragraph.getElementsByTagName("*")).filter((node) => node.localName === "t").map((node) => node.textContent || "").join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const lessonStart = normalizedTitle ? paragraphs.findIndex((paragraph) => paragraphTextValue(paragraph).includes(normalizedTitle) || normalizedTitle.includes(paragraphTextValue(paragraph))) : -1;
    const candidates = paragraphs.slice(lessonStart >= 0 ? lessonStart : 0, lessonStart >= 0 ? lessonStart + 90 : 90);
    const mediaPaths: string[] = [];
    candidates.forEach((paragraph) => Array.from(paragraph.getElementsByTagName("*")).filter((node) => node.localName === "blip").forEach((node) => {
      const relationId = Array.from(node.attributes).find((attribute) => attribute.localName === "embed")?.value;
      const mediaPath = relationId ? relationTargets.get(relationId) : undefined;
      if (mediaPath && archive[mediaPath] && !mediaPaths.includes(mediaPath)) mediaPaths.push(mediaPath);
    }));
    const results: SourceIllustration[] = [];
    for (const mediaPath of mediaPaths.slice(0, 4)) {
      const extension = mediaPath.split(".").pop()?.toLowerCase();
      const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
      try {
        results.push({ dataUrl: await compactImageDataUrl(new Blob([archive[mediaPath]], { type: mime })), caption: `Hình minh họa trích từ ${file.name}`, sourceName: file.name });
      } catch { /* bỏ qua định dạng ảnh Word không được trình duyệt hỗ trợ */ }
    }
    return results;
  };

  const sourceKindOf = (file: File, text: string): SourceKind => {
    const normalized = `${file.name} ${text.slice(0, 18000)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
    if (/\bppct\b|phan phoi chuong trinh|ke hoach giao duc.*mon|tuan.*tiet.*yeu cau can dat/.test(normalized)) return "ppct";
    if (/khbd|ke hoach bai day|giao an|lesson plan|tien trinh day hoc|hoat dong cua giao vien|to chuc thuc hien|muc tieu.*thiet bi day hoc|san pham hoc tap/.test(normalized)) return "khbd";
    if (/\bsgk\b|sach giao khoa|student'?s book|global success|ket noi tri thuc voi cuoc song/.test(normalized)) return "sgk";
    return "hoclieu";
  };

  const sourceStructureOf = (file: File, text: string) => {
    const extension = file.name.split(".").pop()?.toUpperCase() || "TỆP";
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const headings = lines.filter((line) => /^(?:[IVX]+\.|\d+\.|[A-D][.)]|BÀI\s+\d+|UNIT\s+\d+|LESSON\s+\d+)/i.test(line)).slice(0, 18);
    return `${extension}; ${lines.length.toLocaleString("vi-VN")} đoạn; tiêu đề/mục phát hiện: ${headings.join(" | ") || "không xác định"}`;
  };

  const xmlElements = (parent: Document | Element, localName: string) => Array.from(parent.getElementsByTagName("*")).filter((node) => node.localName === localName);

  const rowsToPpctText = (rows: string[][]) => rows
    .map((row) => row.map((cell) => cell.replace(/\r?\n+/g, " ⏎ ").replace(/[ \t]+/g, " ").trim()))
    .filter((row) => row.some(Boolean))
    .map((row, index) => `HÀNG ${index + 1}: ${row.join(" || ")}`)
    .join("\n");

  const extractPpctIntegration = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".docx")) {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const source = archive["word/document.xml"];
      if (!source) return { text: "", rows: 0 };
      const xml = new DOMParser().parseFromString(strFromU8(source), "application/xml");
      const rows = xmlElements(xml, "tr").map((row) => xmlElements(row, "tc").map((cell) => xmlElements(cell, "p")
        .map((paragraph) => xmlElements(paragraph, "t").map((node) => node.textContent || "").join("").replace(/[ \t]+/g, " ").trim())
        .filter(Boolean).join("\n"))).filter((row) => row.some(Boolean));
      return { text: rowsToPpctText(rows), rows: rows.length };
    }
    if (lower.endsWith(".xlsx")) {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const parser = new DOMParser();
      const sharedFile = archive["xl/sharedStrings.xml"];
      const shared = sharedFile ? xmlElements(parser.parseFromString(strFromU8(sharedFile), "application/xml"), "si").map((item) => xmlElements(item, "t").map((node) => node.textContent || "").join("")) : [];
      const sheetPath = Object.keys(archive).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).sort()[0];
      if (!sheetPath) return { text: "", rows: 0 };
      const sheet = parser.parseFromString(strFromU8(archive[sheetPath]), "application/xml");
      const rows = xmlElements(sheet, "row").map((row) => {
        const values: string[] = [];
        xmlElements(row, "c").forEach((cell) => {
          const letters = (cell.getAttribute("r") || "A1").match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
          let column = 0;
          for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
          const raw = xmlElements(cell, "v")[0]?.textContent || xmlElements(cell, "t").map((node) => node.textContent || "").join("");
          values[column - 1] = cell.getAttribute("t") === "s" ? shared[Number(raw)] || raw : raw;
        });
        return values.map((value) => String(value || "").trim());
      }).filter((row) => row.some(Boolean));
      return { text: rowsToPpctText(rows), rows: rows.length };
    }
    const text = (await extractSourceText(file)).trim();
    return { text, rows: text.split(/\r?\n/).filter((line) => line.trim()).length };
  };

  const handlePpctIntegration = async (file?: File) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return showNotice("Tệp PPCT vượt quá 100 MB. Vui lòng chọn tệp nhỏ hơn.");
    setReadingPpct(true);
    try {
      const parsed = await extractPpctIntegration(file);
      const text = parsed.text.trim().slice(0, 350000);
      if (!text) return showNotice("Không đọc được PPCT. Vui lòng dùng DOCX, XLSX, PDF, TXT hoặc CSV.");
      setPpctIntegrationFile({ name: file.name, size: file.size, rows: parsed.rows, text });
      showNotice("Đã đọc PPCT tích hợp. Hệ thống sẽ đối chiếu đúng tên bài khi tạo KHBD.");
    } catch {
      showNotice("Không thể đọc tệp PPCT này. PDF dạng ảnh quét cần được nhận dạng chữ trước.");
    } finally {
      setReadingPpct(false);
    }
  };

  const handleAttachments = async (files?: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).filter((file) => file.size <= 100 * 1024 * 1024).slice(0, 5);
    if (!selected.length) return showNotice("Tệp vượt quá 100 MB. Vui lòng chọn tệp nhỏ hơn.");
    setSourceFiles((current) => [...current, ...selected.map((file) => ({ name: file.name, size: file.size, status: "Đang đọc" as const, characters: 0, kind: "hoclieu" as const, text: "", structure: "", illustrations: [], rawFile: file }))].slice(-5));
    let extractedCount = 0;
    for (const file of selected) {
      try {
        const text = (await extractSourceText(file)).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        const kind = sourceKindOf(file, text);
        const illustrations = await extractSourceIllustrations(file);
        if (text || illustrations.length) extractedCount += 1;
        if (kind === "khbd" && /\.docx$/i.test(file.name)) setKhbdTemplateFile(file);
        setSourceFiles((current) => current.map((item) => item.name === file.name ? { ...item, kind, text: text.slice(0, 350000), structure: sourceStructureOf(file, text), illustrations, status: text || illustrations.length ? "Đã đọc nội dung" : "Đã ghi nhận", characters: text.length } : item));
      } catch {
        setSourceFiles((current) => current.map((item) => item.name === file.name ? { ...item, status: "Không đọc được" } : item));
      }
    }
    updateForm("attachment", [...sourceFiles.map((item) => item.name), ...selected.map((file) => file.name)].slice(-5).join(", "));
    if (extractedCount) showNotice(`Đã đọc và phân loại ${extractedCount} tệp. AI sẽ dò đúng tên bài trước khi sử dụng.`);
    else showNotice("Đã ghi nhận tệp nguồn. Hãy bổ sung mô tả nếu tệp chỉ chứa hình ảnh.");
  };

  const removeSourceFile = (name: string) => {
    const next = sourceFiles.filter((file) => file.name !== name);
    setSourceFiles(next);
    if (khbdTemplateFile?.name === name) setKhbdTemplateFile(null);
    updateForm("attachment", next.map((file) => file.name).join(", "));
  };

  const useAsKhbdTemplate = (name: string) => {
    const source = sourceFiles.find((file) => file.name === name && /\.docx$/i.test(file.name));
    if (!source?.rawFile) return showNotice("Không tìm thấy tệp DOCX gốc để tạo KHBD mới.");
    setKhbdTemplateFile(source.rawFile);
    setSourceFiles((current) => current.map((file) => file.name === name ? { ...file, kind: "khbd" } : file));
    showNotice("Đã chọn KHBD cũ. Hệ thống sẽ sao chép toàn bộ tài liệu để tạo KHBD mới và chèn mã năng lực vào hoạt động phù hợp.");
  };

  const updateManualKey = (providerId: keyof ManualKeys, slot: number, value: string) => {
    setManualKeys((current) => {
      const next = { ...current, [providerId]: current[providerId].map((item, index) => index === slot ? value : item) };
      try { window.sessionStorage.setItem("giao-an-ai-session-keys", JSON.stringify(next)); } catch { /* Không lưu được phiên. */ }
      return next;
    });
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const generatePlan = async () => {
    if (!form.title.trim()) {
      showNotice("Vui lòng nhập tên bài dạy.");
      return;
    }
    setGenerating(true);
    setGenerationStep(1);
    const progressTimers = [
      window.setTimeout(() => setGenerationStep(2), 900),
      window.setTimeout(() => setGenerationStep(3), 2600),
      window.setTimeout(() => setGenerationStep(4), 5200),
    ];
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          form: {
            ...form,
            ppctIntegrationFileName: ppctIntegrationFile?.name || "",
            ppctIntegrationText: ppctIntegrationFile?.text || "",
            sourceMaterials: sourceFiles.filter((file) => file.text || file.illustrations.length).map((file) => ({ name: file.name, kind: file.kind, text: file.text, structure: file.structure, imageDataUrls: file.illustrations.map((image) => image.dataUrl) })),
          },
          options: enabled,
          clientKeys: manualKeys,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tạo kế hoạch bài dạy.");
      const generatedPlan = data.plan as AIPlan;
      if (!khbdTemplateFile) {
        const illustrations = sourceFiles.flatMap((file) => file.illustrations).slice(0, 6);
        const visualAids = generatedPlan.sourceSynthesis?.visualAids || [];
        const knowledgeParts = generatedPlan.activities.find((activity) => activity.code.toUpperCase() === "B")?.subActivities || [];
        illustrations.forEach((illustration, index) => {
          const target = knowledgeParts[index % Math.max(1, knowledgeParts.length)];
          if (!target) return;
          const suggestion = visualAids[index];
          target.illustrations = [...(target.illustrations || []), { ...illustration, caption: suggestion?.description || suggestion?.title || illustration.caption }];
        });
      }
      setPlan(generatedPlan);
      setGenerationMeta({ provider: data.provider, model: data.model, keySlot: data.keySlot });
      setGenerated(true);
      setEditingPlan(false);
      setGenerationStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không thể kết nối dịch vụ AI.");
      if (/chưa.*khóa|cấu hình/i.test(error instanceof Error ? error.message : "")) setSettingsOpen(true);
    } finally {
      progressTimers.forEach((timer) => window.clearTimeout(timer));
      setGenerating(false);
    }
  };

  const copyPlan = async () => {
    if (!plan) return;
    if (documentRef.current?.innerText) {
      await navigator.clipboard.writeText(documentRef.current.innerText);
      showNotice("Đã sao chép toàn bộ kế hoạch bài dạy.");
      return;
    }
    const text = [
      docText.lessonPlan,
      plan.title,
      `${docText.subject}: ${englishDocument ? "English" : form.subject} – ${docText.grade} ${form.grade} – ${form.periods} ${docText.periods}`,
      "",
      docText.objectives,
      ...plan.objectives.knowledge.map((item) => `- ${item}`),
      "",
      docText.equipment,
      ...plan.equipment.map((item) => `- ${item}`),
      "",
      docText.procedure,
      ...plan.activities.flatMap((activity) => [
        `${activity.code}. ${activity.title} (${activity.duration})`,
        `${docText.objective}: ${activity.objective}`,
        `${docText.learningProduct}: ${activity.product}`,
      ]),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    showNotice("Đã sao chép kế hoạch bài dạy.");
  };

  const downloadPlan = async () => {
    if (!plan) return;
    if (khbdTemplateFile) {
      try {
        const archive = unzipSync(new Uint8Array(await khbdTemplateFile.arrayBuffer()));
        const documentXml = archive["word/document.xml"];
        if (!documentXml) throw new Error("Tệp KHBD cũ không có nội dung Word hợp lệ.");
        const wordXml = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
        if (wordXml.getElementsByTagName("parsererror").length) throw new Error("Không đọc được cấu trúc Word của KHBD cũ.");
        const wordNamespace = wordXml.documentElement.namespaceURI || "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        const allParagraphs = xmlElements(wordXml, "p") as Element[];
        const normalizeAnchorText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const paragraphText = (paragraph: Element) => xmlElements(paragraph, "t").map((node) => node.textContent || "").join(" ").trim();
        const body = xmlElements(wordXml, "body")[0] as Element | undefined;
        if (!body) throw new Error("KHBD cũ không có phần thân tài liệu.");
        const createWordParagraph = (value: string, anchor?: Element, bold = false) => {
          const paragraph = anchor ? anchor.cloneNode(false) as Element : wordXml.createElementNS(wordNamespace, "w:p");
          const paragraphProperties = anchor ? Array.from(anchor.children).find((node) => node.localName === "pPr") : undefined;
          if (paragraphProperties) paragraph.appendChild(paragraphProperties.cloneNode(true));
          const run = wordXml.createElementNS(wordNamespace, "w:r");
          const sourceRun = anchor ? xmlElements(anchor, "r")[0] as Element | undefined : undefined;
          const sourceRunProperties = sourceRun ? Array.from(sourceRun.children).find((node) => node.localName === "rPr") : undefined;
          const runProperties = sourceRunProperties ? sourceRunProperties.cloneNode(true) as Element : wordXml.createElementNS(wordNamespace, "w:rPr");
          if (bold && !Array.from(runProperties.children).some((node) => node.localName === "b")) runProperties.appendChild(wordXml.createElementNS(wordNamespace, "w:b"));
          if (runProperties.childNodes.length) run.appendChild(runProperties);
          const text = wordXml.createElementNS(wordNamespace, "w:t");
          text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          text.textContent = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
          run.appendChild(text);
          paragraph.appendChild(run);
          return paragraph;
        };
        const anchorTails = new Map<Element, Node>();
        let addedSectionCount = 0;
        const insertSection = (title: string, lines: string[], anchors: string[]) => {
          const cleanLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
          if (!cleanLines.length && !title.trim()) return;
          const normalizedAnchors = anchors.map(normalizeAnchorText);
          let anchor: Element | undefined;
          for (const keyword of normalizedAnchors) {
            anchor = allParagraphs.find((paragraph) => normalizeAnchorText(paragraphText(paragraph)).includes(keyword));
            if (anchor) break;
          }
          const nodes = [createWordParagraph(title, anchor, true), ...cleanLines.map((line) => createWordParagraph(line, anchor))];
          if (anchor?.parentNode) {
            let tail = anchorTails.get(anchor) || anchor;
            nodes.forEach((node) => {
              anchor.parentNode!.insertBefore(node, tail.nextSibling);
              tail = node;
            });
            anchorTails.set(anchor, tail);
          } else {
            const sectionProperties = Array.from(body.children).find((node) => node.localName === "sectPr") || null;
            nodes.forEach((node) => body.insertBefore(node, sectionProperties));
          }
          addedSectionCount += 1;
        };
        const directChildren = (element: Element, localName: string) => Array.from(element.children).filter((node) => node.localName === localName) as Element[];
        const elementText = (element: Element) => xmlElements(element, "t").map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
        const insertIntoTemplateTable = (title: string, teacherLines: string[], studentLines: string[], productLines: string[], anchors: string[]) => {
          const normalizedAnchors = anchors.map(normalizeAnchorText);
          for (const table of xmlElements(wordXml, "tbl") as Element[]) {
            const rows = directChildren(table, "tr");
            let productIndex = -1;
            let combinedIndex = -1;
            let teacherIndex = -1;
            let studentIndex = -1;
            let headerRowIndex = -1;
            rows.forEach((row, rowIndex) => {
              const cells = directChildren(row, "tc");
              const labels = cells.map((cell) => normalizeAnchorText(elementText(cell)));
              const nextProduct = labels.findIndex((label) => label.includes("san pham du kien") || label.includes("san pham hoc tap") || label.includes("expected learning product"));
              const nextCombined = labels.findIndex((label) => (label.includes("giao vien") && label.includes("hoc sinh")) || label.includes("teacher and learner"));
              const nextTeacher = labels.findIndex((label) => (label.includes("hoat dong cua giao vien") || label.includes("teacher activit")) && !label.includes("hoc sinh") && !label.includes("learner"));
              const nextStudent = labels.findIndex((label) => label.includes("hoat dong cua hoc sinh") || label.includes("learner activit") || label.includes("student activit"));
              if (nextProduct >= 0 && (nextCombined >= 0 || (nextTeacher >= 0 && nextStudent >= 0))) {
                productIndex = nextProduct;
                combinedIndex = nextCombined;
                teacherIndex = nextTeacher;
                studentIndex = nextStudent;
                headerRowIndex = rowIndex;
              }
            });
            if (headerRowIndex < 0) continue;
            const anchorRowIndex = rows.findIndex((row) => normalizedAnchors.some((anchor) => normalizeAnchorText(elementText(row)).includes(anchor)));
            if (anchorRowIndex < 0) continue;
            const minimumCellCount = Math.max(productIndex, combinedIndex, teacherIndex, studentIndex) + 1;
            const targetRow = rows.slice(anchorRowIndex).find((row, offset) => anchorRowIndex + offset > headerRowIndex && directChildren(row, "tc").length >= minimumCellCount);
            if (!targetRow) continue;
            const cells = directChildren(targetRow, "tc");
            const appendLines = (cellIndex: number, lines: string[]) => {
              if (cellIndex < 0 || !cells[cellIndex]) return;
              const cell = cells[cellIndex];
              const anchor = (xmlElements(cell, "p") as Element[]).at(-1);
              lines.map((line) => String(line || "").trim()).filter(Boolean).forEach((line, index) => cell.appendChild(createWordParagraph(line, anchor, index === 0)));
            };
            if (productLines.length) appendLines(productIndex, [title, ...productLines]);
            if (combinedIndex >= 0) appendLines(combinedIndex, [title, ...teacherLines, ...studentLines]);
            else {
              appendLines(teacherIndex, [title, ...teacherLines]);
              if (studentLines.length) appendLines(studentIndex, [title, ...studentLines]);
            }
            addedSectionCount += 1;
            return true;
          }
          return false;
        };
        const allActivityParts = plan.activities.flatMap((activity) => [activity, ...(activity.subActivities || [])]);
        const integrationAnchors = (activityCodes: string[]) => {
          const activityCode = activityCodes.find((code) => /^[A-D]$/i.test(code))?.toUpperCase();
          if (activityCode === "A") return ["hoạt động 1", "activity 1", "khởi động", "warm up", "mở đầu", "opening"];
          if (activityCode === "C") return ["hoạt động 3", "activity 3", "luyện tập", "practice", "củng cố", "consolidation"];
          if (activityCode === "D") return ["hoạt động 4", "activity 4", "vận dụng", "application"];
          return ["hoạt động 2", "activity 2", "hình thành kiến thức", "knowledge formation"];
        };
        const insertCompetencyIntoTemplate = (item: CompetencyIndicator, kind: "digital" | "ai") => {
          const label = kind === "digital" ? ["Tích hợp năng lực số", "Digital competence integration"] : ["Tích hợp giáo dục AI", "AI education integration"];
          const matchingStep = allActivityParts.flatMap((part) => part.procedure || []).find((step) => {
            const text = `${step.teacher} ${step.student}`;
            return text.includes(item.code) && label.some((value) => normalizeAnchorText(text).includes(normalizeAnchorText(value)));
          });
          const title = englishDocument ? `${kind === "digital" ? "Digital competence integration" : "AI education integration"} (${item.code})` : `${kind === "digital" ? "Tích hợp năng lực số" : "Tích hợp giáo dục AI"} (${item.code})`;
          const rawTeacher = matchingStep?.teacher || item.indicator;
          const cuePattern = kind === "digital" ? /(?:Tích hợp năng lực số|Digital competence integration)\s*\([^)]+\)\s*:\s*(.+)$/i : /(?:Tích hợp giáo dục AI|AI education integration)\s*\([^)]+\)\s*:\s*(.+)$/i;
          const cue = rawTeacher.match(cuePattern)?.[1]?.trim() || rawTeacher;
          const teacherCue = `${title}: ${cue}`;
          if (!insertIntoTemplateTable(teacherCue, [], [], [], integrationAnchors(item.activityCodes))) insertSection(teacherCue, [], integrationAnchors(item.activityCodes));
        };
        if (enabled.includes("digital")) (plan.digitalCompetencyIndicators || []).forEach((item) => insertCompetencyIntoTemplate(item, "digital"));
        if (enabled.includes("aiEducation")) (plan.aiCompetencyIndicators || []).forEach((item) => insertCompetencyIntoTemplate(item, "ai"));
        archive["word/document.xml"] = strToU8(new XMLSerializer().serializeToString(wordXml));
        const output = zipSync(archive, { level: 6 });
        const url = URL.createObjectURL(new Blob([output.slice().buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `KHBD-MOI-${form.title.replace(/[^a-zA-Z0-9]+/g, "-") || "tich-hop"}.docx`;
        anchor.click();
        URL.revokeObjectURL(url);
        showNotice(addedSectionCount ? `Đã tạo KHBD mới từ toàn bộ nội dung cũ và chèn ${addedSectionCount} câu dẫn năng lực vào hoạt động phù hợp.` : "Đã tạo KHBD mới từ toàn bộ nội dung cũ; chưa có mã năng lực được chọn để chèn.");
        return;
      } catch {
        showNotice("Không thể sao chép định dạng KHBD cũ; hệ thống sẽ tạo một tệp Word mới theo nội dung đã soạn.");
      }
    }
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
    const list = (items: string[]) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
    const activityHtml = (activity: LessonActivity) => `<h4>${escape(activity.code)}. ${escape(activity.title)}${activity.duration ? ` (${escape(activity.duration)})` : ""}</h4><p><b>a) ${docText.objective}:</b> ${escape(activity.objective)}</p><p><b>b) ${docText.content}:</b> ${escape(activity.content)}</p><p><b>c) ${docText.learningProduct}:</b> ${escape(activity.product)}</p><p><b>d) ${docText.implementation}:</b></p><table><thead><tr><th>${docText.expectedProduct}</th><th>${docText.combinedActivity}</th></tr></thead><tbody><tr><td>${escape(activity.product)}${(activity.illustrations || []).map((illustration) => `<figure><img src="${illustration.dataUrl}" alt="${escape(illustration.caption)}" style="max-width:100%;height:auto"><figcaption>${escape(illustration.caption)} (${escape(illustration.sourceName)})</figcaption></figure>`).join("")}</td><td><ol>${(activity.procedure || []).map((step) => `<li><b>${escape(step.step)}:</b> ${escape(`${step.teacher} ${step.student}`)}</li>`).join("")}</ol></td></tr></tbody></table><p><b>${docText.assessment}:</b> ${escape(activity.assessment)}</p>`;
    const activities = plan.activities.map((activity) => activity.code.toUpperCase() === "B" && activity.subActivities?.length
      ? `<h4>${escape(activity.code)}. ${escape(activity.title)} (${escape(activity.duration)})</h4>${activity.subActivities.map(activityHtml).join("")}`
      : activityHtml(activity)).join("");
    const editedBody = documentRef.current?.innerHTML;
    const fallbackBody = `<h1>${docText.lessonPlan}</h1><h2>${escape(plan.title)}</h2><p><b>${docText.subject}:</b> ${escape(englishDocument ? "English" : form.subject)} &nbsp; <b>${docText.grade}:</b> ${escape(form.grade)} &nbsp; <b>${docText.duration}:</b> ${escape(form.periods)} ${docText.periods}</p><h3>${docText.objectives}</h3><h4>${docText.knowledge}</h4>${list(plan.objectives.knowledge)}<h4>${docText.generalCompetencies}</h4>${list(plan.objectives.generalCompetencies)}<h4>${docText.specificCompetencies}</h4>${list(plan.objectives.specificCompetencies)}<h4>4. ${docText.qualities}</h4>${list(plan.objectives.qualities)}<h3>${docText.equipment}</h3>${list(plan.equipment)}<h3>${docText.procedure}</h3>${activities}<p><b>${docText.teacher}:</b> ${escape(form.teacher)}</p>`;
    const html = `<html lang="${englishDocument ? "en" : "vi"}"><head><meta charset="utf-8"><style>@page{size:A4;margin:2cm}body{font-family:"Times New Roman","Cambria Math",serif;font-size:13pt;line-height:1.5}h1,h2{text-align:center}h3{margin-top:18pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:7px;vertical-align:top}li{margin:3px 0}.competency-panel{margin:10px 0;padding:10px;border:1px solid #9fded7;background:#f2fbfa}.competency-panel.ai{border-color:#c7c1f4;background:#f7f6ff}.indicator-item{margin:8px 0;padding:8px;border-left:4px solid #159989;background:#fff}.competency-panel.ai .indicator-item{border-left-color:#655cf0}.indicator-code{font-weight:700}.indicator-meta{font-size:10pt;color:#555}.competency-crosswalk th{background:#eee}</style></head><body>${editedBody || fallbackBody}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Ke-hoach-bai-day-${form.title.replace(/[^a-zA-Z0-9]+/g, "-")}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice("Đã tạo bản Word để tải xuống.");
  };

  const printPlan = () => {
    if (!documentRef.current) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return showNotice("Trình duyệt đang chặn cửa sổ in.");
    popup.document.write(`<html lang="${englishDocument ? "en" : "vi"}"><head><title>${form.title}</title><style>@page{size:A4;margin:2cm}body{font-family:"Times New Roman","Cambria Math",serif;font-size:13pt;line-height:1.5}h1,h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:7px;vertical-align:top}.competency-panel{margin:10px 0;padding:10px;border:1px solid #9fded7;background:#f2fbfa}.competency-panel.ai{border-color:#c7c1f4;background:#f7f6ff}.indicator-item{margin:8px 0;padding:8px;border-left:4px solid #159989;background:#fff}.competency-panel.ai .indicator-item{border-left-color:#655cf0}.indicator-code{font-weight:700}.indicator-meta{font-size:10pt;color:#555}.competency-crosswalk th{background:#eee}</style></head><body>${documentRef.current.innerHTML}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  if (mode === "planner") {
    if (!account) return <main className="auth-loading">Đang kiểm tra tài khoản...</main>;
    return (
      <main className="planner-shell">
        <header className="studio-topbar">
          <button className="studio-brand" onClick={() => setMode("home")} aria-label="Về trang giới thiệu">
            <BrandLogo /><span><strong>TẠO GIÁO ÁN VIỆT</strong><small>Nền tảng giáo án số • Bản chính thức</small></span>
          </button>
          <div className="studio-nav">
            <button onClick={() => setProfileOpen(true)}>♙ Hồ sơ</button>
            <button onClick={() => setGuideOpen(true)}>? Hướng dẫn</button>
            <a href="/ppct">▦ Tạo PPCT</a>
            <button onClick={() => showNotice("Mẫu bài đang được chọn tự động theo cấp học và Công văn hiện hành.")}>▦ Thư viện mẫu</button>
            <span className={(providerStatus && Object.values(providerStatus).some((item) => item.configuredKeys > 0)) || Object.values(manualKeys).some((items) => items.some((item) => item.trim())) ? "ai-live" : "ai-offline"}>● {(providerStatus && Object.values(providerStatus).some((item) => item.configuredKeys > 0)) || Object.values(manualKeys).some((items) => items.some((item) => item.trim())) ? "AI sẵn sàng" : "Chưa có khóa"}</span>
            <button className="key-button" onClick={() => setSettingsOpen(true)}>⚙ Cấu hình AI</button>
            <AccountControls user={account} />
          </div>
          <div className="header-support"><b>BẢN QUYỀN: TRẦN QUỐC HOÀNG ANH</b><a href="tel:0965653750">ĐT: 0965653750</a><a href="https://zalo.me/0965653750">ZALO HỖ TRỢ</a></div>
        </header>

        <div className="teacher-info-bar">
          <div><span>▦</span> Trường: <b>{form.school || "Chưa cập nhật"}</b><i /> <span>⌘</span> Tổ chuyên môn: <b>{form.department || "Chưa cập nhật"}</b><i /> <span>♙</span> Giáo viên: <b>{form.teacher}</b></div>
          <button onClick={() => setProfileOpen(true)}>✎ Sửa thông tin</button>
        </div>

        {account.plan === "free" && <div className="free-plan-bar"><span>Miễn phí: còn <b>{Math.max(0, 5 - account.khbdUsed)}/5 lượt KHBD</b> và <b>{Math.max(0, 5 - account.ppctUsed)}/5 lượt PPCT</b></span><a href="https://zalo.me/0965653750">Yêu cầu kích hoạt không giới hạn qua Zalo</a></div>}

        <section className="studio-page">
          <form className="studio-config" onSubmit={(event) => { event.preventDefault(); generatePlan(); }}>
            <div className="studio-panel-head"><div><span>✦</span><h1>Cấu hình bài soạn</h1></div><small>ĐẦY ĐỦ TÍNH NĂNG</small></div>

            <div className="config-guide"><span>?</span><div><b>Gợi ý điền nhanh</b><p>Thầy/Cô chỉ cần chọn đúng môn, lớp, số tiết và nhập yêu cầu cần đạt. Bộ sách và mẫu KHBD sẽ được hệ thống tự động xác định.</p></div></div>

            <label className="studio-label full">Tên bài soạn <em>*</em><input value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="Ví dụ: Bài 15 – Sự nở vì nhiệt của chất rắn" /><small className="field-help">Nhập đúng tên bài hoặc chủ đề trong phân phối chương trình.</small></label>
            <div className="studio-fields">
              <label className="studio-label">Môn học <em>*</em><select value={form.subject} onChange={(e) => updateForm("subject", e.target.value)}>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select><small className="field-help">Chọn môn đang dạy; bộ sách sẽ đổi tự động.</small></label>
              <label className="studio-label">Lớp<select value={form.grade} onChange={(e) => updateForm("grade", e.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>Lớp {index + 1}</option>)}</select><small className="field-help">Chọn đúng khối lớp để AI điều chỉnh yêu cầu cần đạt.</small></label>
              <label className="studio-label">Cấp học<select value={form.level} onChange={(e) => updateForm("level", e.target.value)}><option>Tiểu học</option><option>THCS</option><option>THPT</option></select><small className="field-help">Quyết định mẫu Công văn 2345 hoặc 5512.</small></label>
              <label className="studio-label">Số tiết<select value={form.periods} onChange={(e) => updateForm("periods", e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select><small className="field-help">Chọn theo phân phối chương trình thực tế.</small></label>
              <label className="studio-label full">Bộ sách<select value={form.book} disabled aria-describedby="book-help">{bookSeries.map((book) => <option key={book}>{book}</option>)}</select><small className="field-help" id="book-help">Tự động: Tiếng Anh dùng Global Success; các môn còn lại dùng Kết nối tri thức với cuộc sống.</small></label>
            </div>
            <p className="curriculum-note">▣ Đang áp dụng: <b>{form.subject === "Tiếng Anh" ? "Global Success" : "Kết nối tri thức với cuộc sống"}</b> theo Chương trình giáo dục phổ thông 2018.</p>

            <div className="studio-fields">
              <label className="studio-label">Số cột KHBD<select value={form.columns} onChange={(e) => updateForm("columns", e.target.value)}><option>1 cột (mặc định)</option><option>2 cột</option><option>3 cột</option></select><small className="field-help">1 cột: trình bày tuần tự; 2–3 cột: đối chiếu hoạt động và sản phẩm.</small></label>
              <label className="studio-label">Mẫu KHBD<select value={form.template} onChange={(e) => updateForm("template", e.target.value)}><option>Tự động theo cấp học</option><option>Công văn 2345</option><option>Công văn 5512</option><option>Mẫu rút gọn</option></select><small className="field-help">Nên chọn “Tự động theo cấp học” để dùng đúng mẫu.</small></label>
            </div>
            <div className="template-badge"><span>●</span> Áp dụng: <b>{form.template === "Tự động theo cấp học" ? (form.level === "Tiểu học" ? "Mẫu Công văn 2345" : "Mẫu Công văn 5512") : form.template}</b></div>

            <div className="content-box">
              <div className="content-box-title">Nội dung cốt lõi <em>*</em></div>
              <div className="content-tabs"><button type="button" className={contentTab === "text" ? "active" : ""} onClick={() => setContentTab("text")}>▤ Nhập nội dung</button><button type="button" className={contentTab === "file" ? "active" : ""} onClick={() => setContentTab("file")}>⌁ Đính kèm tệp</button></div>
              {contentTab === "text" ? <label className="studio-textarea"><textarea rows={5} value={form.core} onChange={(e) => updateForm("core", e.target.value)} placeholder="Nhập các mục chính, kiến thức trọng tâm hoặc dán yêu cầu cần đạt..." /><small>{form.core.length}/24000 ký tự</small></label> : <>
                <label className="upload-zone"><input type="file" multiple accept=".txt,.md,.csv,.json,.html,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp" onChange={(e) => handleAttachments(e.target.files)} /><span>⇧</span><b>Chọn PPCT, SGK, KHBD cũ hoặc học liệu</b><small>Tối đa 5 tệp, mỗi tệp 100 MB. Hệ thống tự phân loại và dò đúng tên bài trước khi đưa nội dung vào KHBD.</small></label>
                {sourceFiles.length > 0 && <div className="source-file-list">{sourceFiles.map((file) => <div key={file.name}>
                  <span>{file.kind === "ppct" ? "P" : file.kind === "sgk" ? "S" : file.kind === "khbd" ? "K" : "▤"}</span>
                  <p><b>{file.name}</b><small><em className={`source-kind ${file.kind}`}>{file.kind === "ppct" ? "PPCT" : file.kind === "sgk" ? "SGK" : file.kind === "khbd" ? "KHBD cũ → KHBD mới" : "Học liệu"}</em> • {(file.size / 1024 / 1024).toFixed(2)} MB • {file.status}{file.characters ? ` • ${file.characters.toLocaleString("vi-VN")} ký tự` : ""}</small>{/\.docx$/i.test(file.name) && file.kind !== "khbd" && <button type="button" className="template-source-button" onClick={() => useAsKhbdTemplate(file.name)}>Dùng KHBD cũ để tạo bản mới</button>}</p>
                  <button type="button" aria-label={`Xóa ${file.name}`} onClick={() => removeSourceFile(file.name)}>×</button>
                </div>)}</div>}
                {khbdTemplateFile && <p className="template-preserve-note">✓ Đang dùng <b>{khbdTemplateFile.name}</b> làm mẫu Word gốc. Khi tải xuống, hệ thống giữ nguyên bố cục, bảng, hình ảnh, đầu trang và chân trang; từng mục đã chọn được chèn vào khu vực phù hợp trong mẫu.</p>}
              </>}
              <p>✎ Nhập trực tiếp hoặc đính kèm học liệu; nội dung càng cụ thể thì bài soạn càng sát thực tế.</p>
            </div>

            <div className="khbd-ppct-box">
              <div className="khbd-ppct-head"><span>▦</span><div><b>PPCT tích hợp Năng lực số và AI</b><small>Không bắt buộc · ưu tiên mã đúng bài học</small></div></div>
              {!ppctIntegrationFile ? <label className={`khbd-ppct-upload ${readingPpct ? "reading" : ""}`}>
                <input type="file" accept=".docx,.xlsx,.pdf,.txt,.csv" disabled={readingPpct} onChange={(event) => handlePpctIntegration(event.target.files?.[0])} />
                <span>{readingPpct ? "…" : "⇧"}</span><b>{readingPpct ? "Đang đọc PPCT..." : "Tải PPCT đã tích hợp từ máy"}</b><small>DOCX, XLSX, PDF, TXT, CSV · Tối đa 100 MB</small>
              </label> : <div className="khbd-ppct-ready"><span>✓</span><p><b>{ppctIntegrationFile.name}</b><small>{ppctIntegrationFile.rows.toLocaleString("vi-VN")} hàng/dòng · {(ppctIntegrationFile.size / 1024 / 1024).toFixed(2)} MB · Sẵn sàng đối chiếu</small></p><button type="button" aria-label="Xóa PPCT tích hợp" onClick={() => setPpctIntegrationFile(null)}>×</button></div>}
              <p><b>Có PPCT:</b> dùng đúng mã Năng lực số và AI của bài tương ứng. <b>Không có hoặc không khớp:</b> AI tự tạo mã phù hợp với bài dạy.</p>
            </div>

            <div className="advanced-title"><span>Tùy chọn nâng cao</span><small>{enabled.length}/{options.length} đã chọn</small></div>
            <p className="option-rule">Chỉ những mục được đánh dấu mới được AI đưa vào kế hoạch bài dạy.</p>
            <div className="studio-option-grid">
              {options.map(([id, title, text, icon]) => <button type="button" key={id} className={enabled.includes(id) ? "studio-option active" : "studio-option"} onClick={() => toggleOption(id)}><i>{enabled.includes(id) ? "✓" : ""}</i><span className="option-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span></button>)}
            </div>

            <button className="studio-generate" type="submit" disabled={generating}>{generating ? <><span className="spinner" /> AI đang xây dựng bài dạy chuyên sâu...</> : <>✦ Bắt đầu tạo bài dạy</>}</button>
            {generating && <div className="generation-progress" role="status"><div>{["Kiểm tra thông tin", "Đọc học liệu", "Thiết kế hoạt động", "Chuẩn hóa KHBD"].map((label, index) => <span key={label} className={generationStep > index + 1 ? "done" : generationStep === index + 1 ? "active" : ""}><i>{generationStep > index + 1 ? "✓" : index + 1}</i>{label}</span>)}</div><p>Đang soạn nội dung chi tiết theo mẫu {form.level === "Tiểu học" ? "Công văn 2345" : "Công văn 5512"}. Thầy/Cô vui lòng chờ trong giây lát.</p></div>}
            <p className="ai-provider-note">{provider === "auto" ? "Ưu tiên Kira AI; nếu không khả dụng sẽ tự chuyển OpenAI → Gemini → Kimi và dùng khóa dự phòng." : `Ưu tiên ${provider.toUpperCase()} và tự động dùng khóa dự phòng.`}</p>
          </form>

          <section className="studio-result">
            <div className="studio-result-head"><div><span>▤</span><h2>Kết quả soạn thảo</h2></div>{plan && <div>{!khbdTemplateFile && <button onClick={() => setEditingPlan((current) => !current)}>{editingPlan ? "✓ Hoàn tất" : "✎ Chỉnh sửa"}</button>}<button onClick={copyPlan}>▣ Sao chép</button>{!khbdTemplateFile && <button onClick={printPlan}>▤ In</button>}<button className="download-button" onClick={downloadPlan}>↓ {khbdTemplateFile ? "Tải KHBD mới" : "Tải Word"}</button></div>}</div>
            {!plan ? generating ? <div className="studio-empty studio-composing"><span>✦</span><b>Đang soạn thảo chi tiết</b><p>AI đang phân tích học liệu, thiết kế hoạt động và kiểm tra cấu trúc KHBD.</p><div><i /> Mục tiêu đo lường được <i /> Tổ chức 4 bước <i /> Đánh giá theo sản phẩm</div></div> : <div className="studio-empty"><span>▤</span><b>Chưa có dữ liệu</b><p>Vui lòng điền thông tin bên trái và nhấn<br />“Bắt đầu tạo bài dạy”.</p><div><i /> Mục tiêu & năng lực <i /> 4 hoạt động <i /> Đánh giá & học liệu</div></div> : <div className="studio-document-wrap">
              <div className="generation-chip">✦ {generationMeta.provider.toUpperCase()} • {generationMeta.model} • Khóa {generationMeta.keySlot}</div>
              {khbdTemplateFile && <div className="template-result-note"><b>Chế độ tạo KHBD mới từ KHBD cũ:</b> Hệ thống sao chép toàn bộ hoạt động, bảng, hình ảnh, đầu trang và chân trang của tài liệu cũ; sau đó chèn từng câu dẫn năng lực vào hoạt động phù hợp. Nút “Tải KHBD mới” trả về tệp DOCX hoàn chỉnh.</div>}
              {editingPlan && <div className="editing-hint">✎ Chế độ chỉnh sửa đang bật — Thầy/Cô có thể nhấp vào nội dung bên dưới để sửa trực tiếp trước khi in hoặc tải Word.</div>}
              <article ref={documentRef} className={`document-preview ${editingPlan ? "is-editing" : ""}`} contentEditable={editingPlan} suppressContentEditableWarning>
                <header><p>{form.school || (englishDocument ? "SCHOOL: ................................................" : "TRƯỜNG: ................................................")}</p><p><b>{docText.teacher}:</b> {form.teacher}</p><h2>{docText.lessonPlan}</h2><h1>{plan.title}</h1><div><span><b>{docText.subject}:</b> {englishDocument ? "English" : form.subject}</span><span><b>{docText.grade}:</b> {form.grade}</span><span><b>{docText.duration}:</b> {form.periods} {docText.periods}</span></div></header>
                <section><p className="plan-summary">{plan.summary}</p><h3>{docText.objectives}</h3><h4>{docText.knowledge}</h4><ul>{plan.objectives.knowledge.map((item) => <li key={item}>{item}</li>)}</ul><h4>{docText.generalCompetencies}</h4><ul>{plan.objectives.generalCompetencies.map((item) => <li key={item}>{item}</li>)}</ul><h4>{docText.specificCompetencies}</h4><ul>{plan.objectives.specificCompetencies.map((item) => <li key={item}>{item}</li>)}</ul>
                  {(plan.digitalCompetencyIndicators?.length || 0) > 0 && <div className="competency-panel digital"><h4>4. {docText.digital}</h4><p className="competency-source">{docText.digitalSource}</p><table><thead><tr><th>{englishDocument ? "Indicator code" : "Mã chỉ báo"}</th><th>{englishDocument ? "Expected outcome" : "Yêu cầu cần đạt"}</th></tr></thead><tbody>{plan.digitalCompetencyIndicators!.map((item) => <tr key={`digital-${item.code}`}><td><b>{item.code}</b></td><td>{item.indicator}</td></tr>)}</tbody></table></div>}
                  {(plan.aiCompetencyIndicators?.length || 0) > 0 && <div className="competency-panel ai"><h4>{(plan.digitalCompetencyIndicators?.length || 0) > 0 ? "5" : "4"}. {docText.ai}</h4><p className="competency-source">{docText.aiSource}</p><table><thead><tr><th>{englishDocument ? "Outcome code" : "Mã YCCĐ"}</th><th>{englishDocument ? "Expected outcome" : "Yêu cầu cần đạt"}</th></tr></thead><tbody>{plan.aiCompetencyIndicators!.map((item) => <tr key={`ai-${item.code}`}><td><b>{item.code}</b></td><td>{item.indicator}</td></tr>)}</tbody></table></div>}
                  <h4>{4 + Number((plan.digitalCompetencyIndicators?.length || 0) > 0) + Number((plan.aiCompetencyIndicators?.length || 0) > 0)}. {docText.qualities}</h4><ul>{plan.objectives.qualities.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section><h3>{docText.equipment}</h3><ul>{plan.equipment.map((item) => <li key={item}>{item}</li>)}</ul>{(plan.teachingMethods?.length || 0) > 0 && <><h4>{docText.methods}</h4><ul>{plan.teachingMethods!.map((item) => <li key={item}>{item}</li>)}</ul></>}</section>
                <section><h3>{docText.procedure}</h3>{plan.activities.map((activity) => <div className="activity-block" key={`${activity.code}-${activity.title}`}>
                  <h4><span>{activity.code}</span>{activity.title} ({activity.duration})</h4>
                  {activity.code.toUpperCase() === "B" && activity.subActivities?.length
                    ? activity.subActivities.map((subActivity, index) => <div className="knowledge-subactivity" key={`${subActivity.code}-${subActivity.title}`}><h4>{subActivity.code}. {subActivity.title}{subActivity.duration ? ` (${subActivity.duration})` : ""}</h4>{renderActivityDetails(subActivity, `sub-${index}`)}</div>)
                    : renderActivityDetails(activity, `activity-${activity.code}`)}
                </div>)}</section>
                {plan.questions.length > 0 && <section className="question-section"><h3>{docText.review}</h3>{plan.questions.map((item, index) => <details key={`${index}-${item.question}`}><summary>{index + 1}. {item.question}</summary><p><b>{docText.answer}:</b> {item.answer}</p></details>)}</section>}
                {plan.accommodations.length > 0 && <section><h3>{docText.support}</h3><ul>{plan.accommodations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
                {(plan.assessmentPlan?.length || 0) > 0 && <section><h3>{docText.assessmentPlan}</h3><ul>{plan.assessmentPlan!.map((item) => <li key={item}>{item}</li>)}</ul></section>}
                {(plan.homework?.length || 0) > 0 && <section><h3>{docText.homework}</h3><ul>{plan.homework!.map((item) => <li key={item}>{item}</li>)}</ul></section>}
                {plan.slides.length > 0 && <section className="slide-suggestion"><h3>✦ {docText.slides}</h3><div>{plan.slides.map((slide) => <span key={slide.number}>{String(slide.number).padStart(2, "0")}<br /><b>{slide.title}</b><small>{slide.bullets.join(" • ")}</small></span>)}</div></section>}
              </article>
            </div>}
          </section>
        </section>

        <footer className="planner-footer"><strong>PHÁT TRIỂN BỞI: THẦY GIÁO: TRẦN QUỐC HOÀNG ANH • ZALO: 0965653750 •</strong></footer>
        {notice && <div className="toast" role="status">ⓘ {notice}</div>}
        {guideOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}>
            <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="planner-guide-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="modal-close" aria-label="Đóng hướng dẫn" onClick={() => setGuideOpen(false)}>×</button><span className="section-kicker">CẨM NANG NHANH</span><h2 id="planner-guide-title">Soạn bài theo từng bước</h2><p>Hoàn thành ba nhóm thông tin, chọn các nội dung tích hợp rồi nhấn “Tạo kế hoạch bài dạy”.</p>
              <div className="guide-list">{steps.map(([number, title, text]) => <div key={number}><span>{number}</span><p><b>{title}</b><small>{text}</small></p></div>)}</div><button className="button button-primary full-button" onClick={() => setGuideOpen(false)}>Đã hiểu</button>
            </section>
          </div>
        )}
        {settingsOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
            <section className="guide-modal ai-settings-modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="modal-close" aria-label="Đóng cấu hình AI" onClick={() => setSettingsOpen(false)}>×</button>
              <span className="section-kicker">TRUNG TÂM CẤU HÌNH</span>
              <h2 id="ai-settings-title">Dịch vụ trí tuệ nhân tạo</h2>
              <p>Chọn chế độ vận hành. “Tự động” sẽ chuyển nhà cung cấp hoặc khóa dự phòng khi dịch vụ chính hết hạn mức.</p>
              <div className="provider-choice">
                {[
                  ["auto", "Tự động", "Kira → OpenAI → Gemini → Kimi"],
                  ["openai", "OpenAI", providerStatus?.openai.model || "gpt-5-mini"],
                  ["gemini", "Gemini", providerStatus?.gemini.model || "gemini-3.6-flash"],
                  ["kimi", "Kimi", providerStatus?.kimi.model || "kimi-k2"],
                  ["kira", "Kira AI", providerStatus?.kira.model || "kira-3.5-flash"],
                ].map(([id, name, detail]) => <button key={id} className={provider === id ? "active" : ""} onClick={() => setProvider(id as Provider)}><i>{provider === id ? "✓" : ""}</i><span><b>{name}</b><small>{detail}</small></span></button>)}
              </div>
              <div className="provider-status-grid">
                {(["openai", "gemini", "kimi", "kira"] as const).map((id) => {
                  const info = providerStatus?.[id];
                  const count = (info?.configuredKeys || 0) + manualKeys[id].filter((item) => item.trim()).length;
                  return <article key={id}><div><b>{info?.name || id.toUpperCase()}</b><span className={count ? "connected" : "not-connected"}>{count ? "● Đã kết nối" : "○ Chưa có khóa"}</span></div><p>Mô hình: {info?.model || "Đang kiểm tra..."}</p><strong>{count} khóa khả dụng</strong><div className="key-slots">{[1, 2, 3].map((slot) => <i key={slot} className={slot <= Math.min(count, 3) ? "filled" : ""}>{slot}</i>)}</div></article>;
                })}
              </div>
              <div className="kira-auto-config">
                <div><span>✦</span><p><b>Kira AI tự động cấu hình mô hình</b><small>{manualKeys.kira.some((key) => key.trim()) ? "Đang ưu tiên khóa Kira của người dùng; khóa website sẽ tự dự phòng." : providerStatus?.kira.websiteKeyAvailable ? "Chưa nhập khóa cá nhân: hệ thống đang dùng khóa Kira của website." : "Chưa có khóa Kira của website; vui lòng nhập khóa cá nhân bên dưới."}</small></p></div>
                <p>Endpoint: {providerStatus?.kira.baseUrl || "https://kiraai.vn/api/v1"}</p>
                <div className="kira-model-list">{(providerStatus?.kira.models || []).slice(0, 6).map((model) => <span key={model.id} className={model.id === providerStatus?.kira.model ? "active" : ""}>{model.name}{model.isFree ? " • Miễn phí" : ""}</span>)}</div>
              </div>
              <div className="backup-guide">
                <b>Thêm khóa chính và khóa dự phòng trong phiên</b>
                <p>Nếu nhập khóa cá nhân, hệ thống sẽ ưu tiên khóa đó trước; khi hết token hoặc gặp giới hạn mới dùng khóa website và chuyển khóa dự phòng. Khóa nhập tại đây chỉ lưu trong phiên của trình duyệt này.</p>
                <button type="button" className="api-key-guide-button" aria-expanded={apiGuideOpen} onClick={() => setApiGuideOpen((open) => !open)}><span>?</span> Hướng dẫn lấy API Key <i>{apiGuideOpen ? "Thu gọn" : "Xem hướng dẫn"}</i></button>
                {apiGuideOpen && <div className="api-key-guide" role="region" aria-label="Hướng dẫn lấy API Key">
                  <article>
                    <div><span className="api-provider-icon openai-icon">O</span><p><b>ChatGPT / OpenAI</b><small>Khóa API được tạo trên OpenAI Platform, tách biệt với gói ChatGPT.</small></p></div>
                    <ol><li>Đăng nhập OpenAI Platform.</li><li>Chọn <b>Create new secret key</b>.</li><li>Sao chép khóa và dán vào ô OPENAI.</li></ol>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Mở trang tạo khóa OpenAI ↗</a>
                  </article>
                  <article>
                    <div><span className="api-provider-icon gemini-icon">G</span><p><b>Google Gemini</b><small>Tạo khóa Gemini API trong Google AI Studio.</small></p></div>
                    <ol><li>Đăng nhập bằng tài khoản Google.</li><li>Chọn <b>Create API key</b> và dự án.</li><li>Sao chép khóa và dán vào ô GEMINI.</li></ol>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Mở Google AI Studio ↗</a>
                  </article>
                  <article>
                    <div><span className="api-provider-icon kimi-icon">K</span><p><b>Kimi / Moonshot AI</b><small>Dùng khóa Open Platform; không dùng khóa Kimi Code hoặc ứng dụng trò chuyện.</small></p></div>
                    <ol><li>Đăng nhập Kimi Open Platform.</li><li>Chọn <b>Create API Key</b>.</li><li>Sao chép khóa và dán vào ô KIMI.</li></ol>
                    <a href="https://platform.kimi.ai/console/api-keys" target="_blank" rel="noopener noreferrer">Mở trang tạo khóa Kimi ↗</a>
                  </article>
                  <p className="api-security-note">🔒 Không gửi khóa qua Zalo, ảnh chụp hoặc đăng công khai. Nếu nghi ngờ bị lộ, hãy thu hồi khóa và tạo khóa mới.</p>
                </div>}
                <div className="key-editor-tabs">{(["openai", "gemini", "kimi", "kira"] as const).map((id) => <button type="button" key={id} className={keyEditor === id ? "active" : ""} onClick={() => setKeyEditor(id)}>{id === "kira" ? "KIRA AI" : id.toUpperCase()}</button>)}</div>
                <div className="session-key-inputs">{manualKeys[keyEditor].map((value, index) => <label key={index}>Khóa {index === 0 ? "chính" : `dự phòng ${index}`}<input type="password" autoComplete="off" value={value} onChange={(event) => updateManualKey(keyEditor, index, event.target.value)} placeholder={`${keyEditor.toUpperCase()} API key ${index + 1}`} /></label>)}</div>
                <small>Khóa được gửi qua HTTPS trực tiếp đến máy chủ tạo nội dung, không hiển thị lại và không ghi vào mã nguồn.</small>
              </div>
              <div className="settings-actions"><button onClick={refreshProviderStatus}>↻ Kiểm tra lại</button><button className="button button-primary" onClick={() => { setSettingsOpen(false); showNotice("Đã lưu lựa chọn dịch vụ AI."); }}>Lưu cấu hình</button></div>
            </section>
          </div>
        )}
        {profileOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setProfileOpen(false)}>
            <section className="guide-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="modal-close" aria-label="Đóng hồ sơ" onClick={() => setProfileOpen(false)}>×</button><span className="section-kicker">HỒ SƠ GIÁO VIÊN</span><h2 id="profile-title">Thông tin trên giáo án</h2>
              <div className="profile-fields"><label>Họ và tên giáo viên<input value={form.teacher} onChange={(e) => updateForm("teacher", e.target.value)} /></label><label>Trường/đơn vị công tác<input value={form.school} onChange={(e) => updateForm("school", e.target.value)} placeholder="Ví dụ: Trường THPT Nguyễn Chí Thanh" /></label><label>Tổ chuyên môn<input value={form.department} onChange={(e) => updateForm("department", e.target.value)} placeholder="Ví dụ: Tổ Ngoại ngữ" /></label></div>
              <button className="button button-primary full-button" onClick={async () => { const response = await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName:form.teacher,school:form.school,department:form.department,phone:account.phone})}); const data=await response.json(); if(!response.ok)return showNotice(data.error||'Không thể lưu hồ sơ.'); setProfileOpen(false); showNotice("Đã lưu và đồng bộ thông tin giáo viên."); }}>Lưu và đồng bộ thông tin</button>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Trang chủ Tạo Giáo Án Việt">
          <BrandLogo alt="Logo Tạo Giáo Án Việt" />
          <span><strong>TẠO GIÁO ÁN VIỆT</strong><small>Nền tảng giáo án số</small></span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#tinh-nang">Tính năng</a>
          <a href="#quy-trinh">Quy trình</a>
          <a href="/ppct">Tạo PPCT</a>
          <button className="nav-guide" onClick={() => setGuideOpen(true)}>Hướng dẫn</button>
        </nav>
        <button className="button button-small button-dark" onClick={begin}>Bắt đầu soạn bài</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>●</span> Thiết kế riêng cho giáo viên Việt Nam</div>
          <h1>Soạn kế hoạch bài dạy <em>nhanh hơn, sâu hơn.</em></h1>
          <p>Biến ý tưởng và nội dung bài học thành một kế hoạch giảng dạy rõ ràng, chuẩn cấu trúc và sẵn sàng sử dụng chỉ trong vài bước.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={begin}>✦ Bắt đầu soạn bài</button>
            <a className="button button-ghost" href="/ppct">▦ Tạo PPCT tích hợp</a>
            <button className="button button-ghost" onClick={() => setGuideOpen(true)}>Xem cách hoạt động <span>→</span></button>
          </div>
          <div className="trust-row">
            <div className="avatar-stack" aria-hidden="true"><i>TH</i><i>GV</i><i>AI</i></div>
            <span><strong>Dễ sử dụng</strong><br />Không cần kỹ năng công nghệ phức tạp</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Minh họa giao diện soạn bài">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="workspace-card">
            <div className="workspace-head">
              <div><BrandLogo className="mini-logo brand-image" /><b>Không gian soạn bài</b></div>
              <span className="status-pill">● Sẵn sàng</span>
            </div>
            <div className="workspace-body">
              <aside>
                <span className="side-active">⌂ <b>Tổng quan</b></span>
                <span>✦ Soạn bài mới</span>
                <span>▤ Thư viện</span>
                <span>⚙ Thiết lập</span>
              </aside>
              <div className="workspace-main">
                <div className="welcome-line"><span>Chào buổi sáng, Thầy/Cô</span><b>Hôm nay bạn muốn soạn bài gì?</b></div>
                <div className="quick-grid">
                  <div><span className="quick-icon purple">✦</span><b>Tạo kế hoạch mới</b><small>Bắt đầu từ thông tin bài dạy</small></div>
                  <div><span className="quick-icon mint">▦</span><b>Giáo án gần đây</b><small>Tiếp tục nội dung đang làm</small></div>
                </div>
                <div className="progress-card">
                  <div><span>Tiến trình bài dạy</span><b>75%</b></div>
                  <i><u /></i><small>Đang hoàn thiện: Hoạt động vận dụng</small>
                </div>
              </div>
            </div>
          </div>
          <div className="floating-note note-one"><span>✓</span><div><b>Đúng cấu trúc</b><small>Công văn 5512</small></div></div>
          <div className="floating-note note-two"><span>⚡</span><div><b>Tiết kiệm thời gian</b><small>Gợi ý trong vài phút</small></div></div>
        </div>
      </section>

      <section className="signal-bar" aria-label="Các tiêu chuẩn hỗ trợ">
        <span>Hỗ trợ:</span><b>TIỂU HỌC</b><i /><b>THCS</b><i /><b>THPT</b><i /><b>GDPT 2018</b><i /><b>NĂNG LỰC SỐ</b>
      </section>

      <section className="features section" id="tinh-nang">
        <div className="section-heading">
          <span className="section-kicker">TRỢ LÝ ĐỒNG HÀNH</span>
          <h2>Tập trung vào chuyên môn,<br /><em>để công nghệ lo phần còn lại.</em></h2>
          <p>Mọi công cụ cần thiết được sắp xếp theo đúng quy trình thực tế của giáo viên.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article key={feature.title} className={`feature-card feature-${index + 1}`}>
              <span>{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p><a href="#quy-trinh">Tìm hiểu thêm →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="process section" id="quy-trinh">
        <div className="process-intro">
          <span className="section-kicker">QUY TRÌNH TINH GỌN</span>
          <h2>Một bài dạy hoàn chỉnh<br />qua <em>3 bước rõ ràng.</em></h2>
          <p>Không biểu mẫu rườm rà. Thầy cô chủ động kiểm soát nội dung ở mọi bước.</p>
          <button className="text-button" onClick={begin}>Tạo kế hoạch đầu tiên <span>↗</span></button>
        </div>
        <div className="steps">
          {steps.map(([number, title, text]) => (
            <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div>
          <span className="cta-icon">✦</span>
          <h2>Sẵn sàng biến ý tưởng<br />thành một bài dạy hay?</h2>
          <p>Sử dụng phiên bản chính thức và trải nghiệm quy trình soạn bài hiện đại dành cho giáo viên Việt Nam.</p>
          <button className="button button-light" onClick={begin}>Bắt đầu ngay <span>→</span></button>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><BrandLogo /><div><strong>TẠO GIÁO ÁN VIỆT</strong><small>Nền tảng giáo án số • Kiến tạo tương lai</small></div></div>
        <p><strong>PHÁT TRIỂN BỞI: THẦY GIÁO: TRẦN QUỐC HOÀNG ANH</strong><span>•</span><strong>ZALO: 0965653750</strong><span>•</span></p>
        <small>© 2026 Tạo Giáo Án Việt. Công cụ hỗ trợ giáo viên Việt Nam.</small>
      </footer>

      {notice && <div className="toast" role="status">ⓘ {notice}</div>}
      {guideOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Đóng hướng dẫn" onClick={() => setGuideOpen(false)}>×</button>
            <span className="section-kicker">CẨM NANG NHANH</span>
            <h2 id="guide-title">Tạo kế hoạch bài dạy trong 3 bước</h2>
            <p>Chọn cấp học và thông tin bài dạy, bật các nội dung tích hợp cần thiết, sau đó xem trước và xuất tài liệu.</p>
            <div className="guide-list">
              {steps.map(([number, title, text]) => <div key={number}><span>{number}</span><p><b>{title}</b><small>{text}</small></p></div>)}
            </div>
            <button className="button button-primary full-button" onClick={() => { setGuideOpen(false); begin(); }}>Tôi đã hiểu — Bắt đầu</button>
          </section>
        </div>
      )}
    </main>
  );
}
