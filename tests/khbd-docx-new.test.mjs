import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * Loads the standard-docx builder with fflate stubbed out, so buildStandardDocx
 * returns the raw archive record (path → XML string) instead of zipped bytes.
 */
async function loadBuilder() {
  const { default: ts } = await import("typescript");
  const source = readFileSync("app/lib/khbd-docx-new.ts", "utf8")
    .replace('import { zipSync, strToU8 } from "fflate";', "const zipSync = (archive) => archive; const strToU8 = (value) => value;");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const labels = {
  lessonPlan: "KẾ HOẠCH BÀI DẠY", subject: "Môn", grade: "Lớp", periods: "tiết",
  objectives: "I. MỤC TIÊU", knowledge: "1. Kiến thức", generalCompetencies: "2. Năng lực chung",
  specificCompetencies: "3. Năng lực đặc thù", qualities: "Phẩm chất",
  digital: "Năng lực số — mã hóa chỉ báo", digitalSource: "Theo Thông tư 02/2025/TT-BGDĐT.",
  ai: "Năng lực AI — mã hóa chỉ báo", aiSource: "Theo Quyết định 2422/QĐ-BGDĐT.",
  equipment: "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU", methods: "Phương pháp, kĩ thuật dạy học",
  procedure: "III. TIẾN TRÌNH DẠY HỌC", objective: "Mục tiêu", content: "Nội dung",
  learningProduct: "Sản phẩm học tập", expectedProduct: "Sản phẩm dự kiến",
  implementation: "Tổ chức thực hiện", combinedActivity: "Hoạt động của giáo viên và học sinh",
  assessment: "Kiểm tra, đánh giá", review: "IV. CÂU HỎI CỦNG CỐ", answer: "Đáp án",
  support: "V. ĐIỀU CHỈNH VÀ HỖ TRỢ HỌC SINH", assessmentPlan: "VI. KẾ HOẠCH KIỂM TRA, ĐÁNH GIÁ",
  homework: "VII. HƯỚNG DẪN TỰ HỌC",
};

const blockLabels = {
  part1: "Phần 1. Bảng định hướng tích hợp",
  part2: "Phần 2. Giáo án đã chèn tích hợp hoàn chỉnh",
  columns: ["Hoạt động", "Nội dung tích hợp", "Mã NLS", "Mã AI (nếu có)", "Sản phẩm dự kiến", "Lưu ý đạo đức số / đạo đức AI"],
};

const plan = {
  title: "BÀI 1: THÔNG TIN VÀ XỬ LÍ THÔNG TIN",
  summary: "Bài học mở đầu về thông tin.",
  objectives: {
    knowledge: ["Phân biệt được thông tin và dữ liệu."],
    generalCompetencies: ["Tự chủ và tự học."],
    specificCompetencies: ["NLc: giải quyết vấn đề với sự hỗ trợ của CNTT."],
    qualities: ["Chăm chỉ, trung thực."],
  },
  equipment: ["Máy chiếu, phiếu học tập."],
  teachingMethods: ["Dạy học hợp tác."],
  activities: [{
    code: "A", title: "Hoạt động 1: Khởi động", duration: "5 phút",
    objective: "Tạo hứng thú.", content: "Trò chơi nhanh.", product: "Câu trả lời của học sinh.",
    assessment: "Quan sát.",
    procedure: [{
      step: "Bước 2: Thực hiện nhiệm vụ", teacher: "GV quan sát.", student: "HS thảo luận.",
      integration: { marker: true },
    }],
  }],
  questions: [{ question: "Thông tin là gì?", answer: "Là những gì đem lại hiểu biết." }],
  digitalCompetencyIndicators: [{ code: "NLS 1.2 – Bậc 3", indicator: "Tìm kiếm được thông tin trên Internet." }],
  aiCompetencyIndicators: [{ code: "AI 6.1 – Bậc 2", indicator: "Nhận biết vai trò của AI." }],
  integrationPlan: [{
    activity: "Hoạt động 1", content: "Tra cứu bằng công cụ số", digitalCode: "NLS 1.2",
    aiCode: "AI 6.1", product: "Kết quả tra cứu", ethicsNote: "Không nhập dữ liệu cá nhân",
  }],
};

const input = {
  english: false,
  plan,
  form: { subject: "Tin học", grade: "10", periods: "1", teacher: "Trần Quốc Hoàng Anh", school: "THPT Ví Dụ", department: "Tổ Tin" },
  labels,
  blockLabels,
  blockLines: () => ["🔴 [Tích hợp NLS & AI]", "● NLS: NLS 1.2", "🔴 [Đánh giá]", "● Tiêu chí: đúng thao tác"],
};

async function buildDocument() {
  const { buildStandardDocx } = await loadBuilder();
  const archive = buildStandardDocx(input);
  return { archive, xml: archive["word/document.xml"] };
}

test("the document uses A4 with standard margins and Times New Roman 13", async () => {
  const { archive, xml } = await buildDocument();
  assert.match(xml, /<w:pgSz w:w="11906" w:h="16838"\/>/, "A4 page size");
  assert.match(xml, /w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/, "2cm top/bottom, 3cm left, 1.5cm right");
  assert.match(archive["word/styles.xml"], /Times New Roman/);
  assert.match(archive["word/styles.xml"], /<w:sz w:val="26"\/>/, "13pt default font size");
});

test("the objectives carry the numbered digital & AI subheading before qualities", async () => {
  const { xml } = await buildDocument();
  const heading = xml.indexOf("4. Năng lực số và năng lực trí tuệ nhân tạo (AI)");
  const qualities = xml.indexOf("5. Phẩm chất");
  assert.ok(heading > 0, "subheading 4 exists inside I. MỤC TIÊU");
  assert.ok(qualities > heading, "qualities shift to number 5 after the new subheading");
  assert.match(xml, /NLS 1\.2 – Bậc 3/);
  assert.match(xml, /AI 6\.1 – Bậc 2/);
});

test("without digital indicators the qualities keep number 4", async () => {
  const { buildStandardDocx } = await loadBuilder();
  const bare = { ...plan, digitalCompetencyIndicators: [], aiCompetencyIndicators: [] };
  const xml = buildStandardDocx({ ...input, plan: bare })["word/document.xml"];
  assert.ok(!xml.includes("Năng lực số và năng lực trí tuệ nhân tạo"), "no empty subheading");
  assert.ok(xml.includes("4. Phẩm chất"));
});

test("integration block heads are bold dark red and bullets are indented", async () => {
  const { xml } = await buildDocument();
  const head = xml.indexOf("🔴 [Tích hợp NLS &amp; AI]");
  assert.ok(head > 0);
  const before = xml.slice(Math.max(0, head - 400), head);
  assert.match(before, /<w:b\/>/, "block head is bold");
  assert.match(before, /<w:color w:val="C00000"\/>/, "block head is dark red");
  const bullet = xml.indexOf("● NLS: NLS 1.2");
  assert.match(xml.slice(Math.max(0, bullet - 400), bullet), /<w:ind w:left="240"\/>/, "bullets are indented");
});

test("part 1 orientation table keeps all six columns and the plan rows", async () => {
  const { xml } = await buildDocument();
  for (const column of blockLabels.columns) assert.ok(xml.includes(column), `column "${column}" present`);
  assert.ok(xml.indexOf(blockLabels.part1) < xml.indexOf(blockLabels.part2), "Phần 1 heading precedes Phần 2");
  assert.match(xml, /Không nhập dữ liệu cá nhân/);
});

test("the archive is a complete docx package with signature block", async () => {
  const { archive, xml } = await buildDocument();
  for (const path of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels"]) {
    assert.ok(archive[path], `${path} present`);
  }
  assert.match(xml, /TỔ TRƯỞNG CHUYÊN MÔN/);
  assert.match(xml, /Trần Quốc Hoàng Anh/);
  assert.ok(!xml.includes("undefined"), "no leaked undefined values");
});
