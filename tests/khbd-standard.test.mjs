import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const engine = readFileSync("app/lib/khbd-ai-engine.ts", "utf8");
const integration = readFileSync("app/lib/khbd-integration.ts", "utf8");
const lessonRoute = readFileSync("app/api/ai/generate/route.ts", "utf8");
const v2Route = readFileSync("app/api/ai/generate-v2/route.ts", "utf8");
const planner = readFileSync("app/page.tsx", "utf8");

test("the planner posts to the standards engine, not the legacy route", () => {
  assert.match(planner, /fetch\("\/api\/ai\/generate-v2"/);
  assert.doesNotMatch(planner, /fetch\("\/api\/ai\/generate"/);
});

test("the standards engine reaches the model through its own prompt field", () => {
  assert.match(v2Route, /systemInstruction: buildKhbdMegaInstruction\(body\)/);
  assert.match(lessonRoute, /\$\{form\.systemInstruction \? /);
});

test("the mega instruction carries every section of the declared standard", () => {
  for (const marker of [
    "Công văn 2345", "Công văn 5512", "1 tiết = 35 phút", "1 tiết = 45 phút",
    "KIỂU 1 CỘT", "KIỂU 2 CỘT", "KIỂU 3 CỘT",
    "BẢNG ĐỊNH HƯỚNG TÍCH HỢP", "KHUÔN MẪU KHỐI TÍCH HỢP", "TỰ KIỂM TRA TRƯỚC KHI XUẤT",
    "Không ép tích hợp", "không nhập thông tin cá nhân thật",
  ]) assert.ok(engine.includes(marker), `mega instruction is missing: ${marker}`);
});

test("the learner AI-operation ceiling is set for every grade band", () => {
  for (const marker of ["Lớp 1–2", "Lớp 3–5", "Lớp 6–7", "Lớp 8–9", "Lớp 10–12"]) {
    assert.ok(engine.includes(marker), `grade band rule is missing: ${marker}`);
  }
});

test("the integration block keeps the five sub-blocks and their markers", () => {
  for (const marker of [
    "🔴 [Tích hợp NLS & AI]", "🔴 [Giáo viên hướng dẫn]", "🔴 [Học sinh thực hiện]",
    "🔴 [Sản phẩm số hoặc sản phẩm AI]", "🔴 [Đánh giá]",
  ]) assert.ok(integration.includes(marker), `block marker is missing: ${marker}`);
  assert.match(integration, /Phần 1\. Bảng định hướng tích hợp/);
  assert.match(integration, /Phần 2\. Giáo án đã chèn tích hợp hoàn chỉnh/);
});

test("Part 1 keeps the six declared columns, in order", () => {
  const columns = ["Hoạt động", "Nội dung tích hợp", "Mã NLS", "Mã AI (nếu có)", "Sản phẩm dự kiến", "Lưu ý đạo đức số / đạo đức AI"];
  const row = integration.match(/columns: \[([^\]]+)\]/)[1];
  columns.forEach((column, index) => {
    assert.ok(row.includes(`"${column}"`), `column is missing: ${column}`);
    if (index) assert.ok(row.indexOf(`"${columns[index - 1]}"`) < row.indexOf(`"${column}"`), `column order is wrong at: ${column}`);
  });
});

test("a partial block from the model is completed to the full standard", async () => {
  const { default: ts } = await import("typescript");
  const compiled = ts.transpileModule(integration, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const block = loaded.completeIntegrationBlock({ manifestation: "HS dùng AI tìm ví dụ rồi đối chiếu SGK." }, {
    english: false,
    digitalCode: "(NLS 6.1 – Ứng dụng trí tuệ nhân tạo – Bậc 3)",
    digitalIndicator: "Sử dụng công cụ AI để phục vụ học tập",
    activityTitle: "Tìm hiểu thông tin và dữ liệu",
  });
  assert.equal(block.digitalCode, "(NLS 6.1 – Ứng dụng trí tuệ nhân tạo – Bậc 3)");
  assert.match(block.aiCode, /Không ép tích hợp AI/, "an absent AI code must say so rather than be invented");
  assert.ok(block.teacherGuidance.length >= 3 && block.studentActions.length >= 3);
  assert.ok(block.digitalProduct.length && block.criteria && block.behaviour && block.ethicsNote);

  const lines = loaded.integrationBlockLines(block, false);
  ["🔴 [Tích hợp NLS & AI]", "🔴 [Giáo viên hướng dẫn]", "🔴 [Học sinh thực hiện]", "🔴 [Sản phẩm số hoặc sản phẩm AI]", "🔴 [Đánh giá]"]
    .forEach((head) => assert.ok(lines.includes(head), `rendered block is missing: ${head}`));
  assert.ok(lines.filter((line) => line.startsWith("●")).length >= 12);
});

/** Compile a project TypeScript module to an importable data: URL. */
async function loadModule(path) {
  const { default: ts } = await import("typescript");
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const fullBlock = {
  digitalCode: "(NLS 6.1 – Ứng dụng trí tuệ nhân tạo – Bậc 3)",
  aiCode: "(NLc – Tương tác với AI tạo sinh)",
  manifestation: "HS dùng AI tìm ví dụ và đối chiếu SGK.",
  teacherGuidance: ['Giáo viên giao nhiệm vụ: "Hãy cho 2 ví dụ thực tế..."', "Giáo viên nhắc không nhập thông tin cá nhân.", "Giáo viên tổ chức kiểm chứng."],
  studentActions: ["HS truy cập công cụ AI.", "HS nhập câu lệnh.", "HS đối chiếu SGK."],
  digitalProduct: ["Câu lệnh và bảng so sánh kết quả AI với SGK."],
  criteria: "Lấy được ví dụ đúng bản chất.",
  digitalAchieved: "Sử dụng được công cụ AI cơ bản.",
  aiAchieved: "Biết kiểm chứng kết quả AI.",
  behaviour: "HS giải thích được vì sao ví dụ đúng.",
  ethicsNote: "Không nhập thông tin cá nhân thật.",
};

const activity = (code, integration) => ({
  code,
  title: `Hoạt động ${code}`,
  product: "HS nêu được khái niệm thông tin và dữ liệu.",
  procedure: [
    { step: "Chuyển giao nhiệm vụ", teacher: "GV giao nhiệm vụ.", student: "HS nhận nhiệm vụ.", product: "Câu trả lời." },
    { step: "Thực hiện nhiệm vụ", teacher: "GV theo dõi.", student: "HS thực hiện.", product: "Ghi chép.", integration },
    { step: "Báo cáo, thảo luận", teacher: "GV mời trình bày.", student: "HS trình bày.", product: "Bài trình bày." },
    { step: "Kết luận, nhận định", teacher: "GV chuẩn hóa kiến thức: thông tin là ý nghĩa của dữ liệu, dữ liệu là các yếu tố thể hiện và xác định thông tin; thông tin và dữ liệu có tính độc lập tương đối.", student: "HS ghi nhận và nhắc lại kiến thức đã chuẩn hóa.", product: "Kết luận về quan hệ giữa thông tin và dữ liệu." },
  ],
  subActivities: [],
});

const conformingPlan = {
  activities: [
    activity("A"),
    { ...activity("B", fullBlock), subActivities: [{ code: "B.1", objective: "x", content: "y", product: "HS nêu quá trình xử lí thông tin gồm 3 bước.", assessment: "Quan sát", procedure: activity("B").procedure }] },
    activity("C"),
    activity("D"),
  ],
  digitalCompetencyIndicators: [{ code: "6.1", indicator: "x" }],
  aiCompetencyIndicators: [{ code: "NLc", indicator: "y" }],
  integrationPlan: [{ activity: "B. Hoạt động B", content: "Dùng AI tìm ví dụ", digitalCode: fullBlock.digitalCode, aiCode: fullBlock.aiCode, product: "Bảng so sánh", ethicsNote: "Không nhập dữ liệu cá nhân." }],
  selfCheck: [{ label: "Đúng cấu trúc cấp học", passed: true, note: "" }],
};

const options = { options: ["digital", "aiEducation"] };

test("the quality gate accepts a plan that meets the standard", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const result = validateKhbdPlan(conformingPlan, options);
  assert.deepEqual(result.issues, [], "a conforming plan must raise no issues");
  assert.equal(result.valid, true);
});

test("the quality gate rejects a missing Part 1 table", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const result = validateKhbdPlan({ ...conformingPlan, integrationPlan: [] }, options);
  assert.ok(result.issues.some((issue) => issue.code === "INTEGRATION_PLAN_MISSING"));
  assert.equal(result.valid, false);
});

test("the quality gate rejects a block that is missing sub-blocks", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const partial = { ...fullBlock, studentActions: [], criteria: "" };
  const result = validateKhbdPlan({
    ...conformingPlan,
    activities: conformingPlan.activities.map((item) => (item.code === "B" ? { ...activity("B", partial), subActivities: item.subActivities } : item)),
  }, options);
  const issue = result.issues.find((item) => item.code === "INTEGRATION_BLOCK_INCOMPLETE");
  assert.ok(issue, "an incomplete block must be reported");
  assert.match(issue.message, /studentActions/);
  assert.match(issue.message, /criteria/);
});

test("the quality gate rejects a block with no sample prompt in quotes", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const result = validateKhbdPlan({
    ...conformingPlan,
    activities: conformingPlan.activities.map((item) => (item.code === "B"
      ? { ...activity("B", { ...fullBlock, teacherGuidance: ["Giáo viên giao nhiệm vụ tìm ví dụ."] }), subActivities: item.subActivities }
      : item)),
  }, options);
  assert.ok(result.issues.some((issue) => issue.code === "INTEGRATION_BLOCK_NO_PROMPT"));
});

test("the quality gate reports Part 1 rows that have no matching block", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const result = validateKhbdPlan({
    ...conformingPlan,
    integrationPlan: [...conformingPlan.integrationPlan, { ...conformingPlan.integrationPlan[0], activity: "D. Vận dụng" }],
  }, options);
  assert.ok(result.issues.some((issue) => issue.code === "INTEGRATION_PLAN_MISMATCH"));
});

test("a failed self-check item surfaces as a quality issue", async () => {
  const { validateKhbdPlan } = await loadModule("app/lib/khbd-ai-engine.ts");
  const result = validateKhbdPlan({
    ...conformingPlan,
    selfCheck: [{ label: "Tổng thời lượng khớp số tiết", passed: false, note: "thiếu 5 phút" }],
  }, options);
  const issue = result.issues.find((item) => item.code === "SELF_CHECK_FAILED");
  assert.ok(issue);
  assert.match(issue.message, /thiếu 5 phút/);
});

test("period length follows the school level", async () => {
  const { periodMinutes } = await loadModule("app/lib/khbd-ai-engine.ts");
  assert.equal(periodMinutes({ form: { level: "Tiểu học", grade: "3" } }), 35);
  assert.equal(periodMinutes({ form: { level: "THCS", grade: "8" } }), 45);
  assert.equal(periodMinutes({ form: { level: "THPT", grade: "10" } }), 45);
  assert.equal(periodMinutes({ form: { grade: "4" } }), 35, "the level must be inferred from the grade when unstated");
});
