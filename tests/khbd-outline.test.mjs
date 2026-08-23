import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

async function loadOutline() {
  const { default: ts } = await import("typescript");
  const compiled = ts.transpileModule(readFileSync("app/lib/khbd-docx-outline.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

/** Builds a flat paragraph list the way a Word document walk produces one. */
function makeDocument(spec) {
  const paragraphs = [];
  let index = 0;
  let tableIndex = -1;
  for (const item of spec) {
    if (typeof item === "string") {
      paragraphs.push({ index: index++, text: item });
      continue;
    }
    tableIndex += 1;
    item.rows.forEach((row, rowIndex) => {
      row.forEach((cellLines, cellIndex) => {
        for (const line of cellLines) paragraphs.push({ index: index++, text: line, table: tableIndex, row: rowIndex, cell: cellIndex });
      });
    });
  }
  return paragraphs;
}

const twoColumnSteps = (extra = []) => [
  "* Bước 1: Chuyển giao nhiệm vụ:",
  "GV: Nêu đặt câu hỏi",
  "* Bước 2: Thực hiện nhiệm vụ:",
  "+ GV: quan sát và trợ giúp các cặp.",
  ...extra,
  "* Bước 3: Báo cáo, thảo luận:",
  "+ HS: Lắng nghe, ghi chú.",
  "* Bước 4: Kết luận, nhận định: GV chính xác hóa",
];

const lessonSpec = [
  "BÀI 1: THÔNG TIN VÀ XỬ LÍ THÔNG TIN",
  "I. MỤC TIÊU",
  "1. Kiến thức:",
  "Phân biệt được thông tin và dữ liệu",
  "3. Phẩm chất: Nghiêm túc, tập trung.",
  "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU",
  "Sgk, Sbt, giáo án.",
  "III. TIẾN TRÌNH DẠY HỌC",
  "1. HOẠT ĐỘNG KHỞI ĐỘNG (MỞ ĐẦU)",
  "- Mục tiêu: Tạo hứng thú học tập",
  "HS: trả lời câu hỏi",
  "2. HÌNH THÀNH KIẾN THỨC MỚI",
  "Hoạt động 1: Tìm hiểu thông tin và dữ liệu",
  "- Mục Tiêu: Biết khái niệm thông tin",
  { rows: [[["Sản phẩm dự kiến"], ["Hoạt động của giáo viên và học sinh"]], [["1. Thông tin và dữ liệu"], twoColumnSteps()]] },
  "Hoạt động 2: Tìm hiểu đơn vị lưu trữ dữ liệu",
  "a) Mục tiêu: Nắm được các đơn vị",
  { rows: [[["Sản phẩm dự kiến"], ["Hoạt động của giáo viên và học sinh"]], [["2. Đơn vị lưu trữ"], twoColumnSteps()]] },
  "3. HOẠT ĐỘNG LUYỆN TẬP",
  "a. Mục tiêu: Củng cố kiến thức vừa học.",
  "Bài 1. Từ dữ liệu điểm các môn học...",
  "4. HOẠT ĐỘNG VẬN DỤNG",
  "Bài 1. Trong thẻ căn cước công dân...",
  "5. Hướng dẫn học sinh tự học:",
  "- Hướng dẫn học bài cũ:",
];

test("the objective section ends before the equipment heading", async () => {
  const { buildLessonOutline } = await loadOutline();
  const paragraphs = makeDocument(lessonSpec);
  const outline = buildLessonOutline(paragraphs);
  assert.equal(paragraphs[outline.objectiveInsertAfter].text, "3. Phẩm chất: Nghiêm túc, tập trung.");
});

test("the new objective subheading continues the existing numbering", async () => {
  const { buildLessonOutline } = await loadOutline();
  const paragraphs = makeDocument(lessonSpec);
  const outline = buildLessonOutline(paragraphs);
  assert.equal(outline.objectiveNextNumber, 4, "after \"3. Phẩm chất\" the integration heading is number 4");
  assert.equal(paragraphs[outline.objectiveSubheadingStyleIndex].text, "3. Phẩm chất: Nghiêm túc, tập trung.",
    "the last numbered subheading provides the formatting template");
});

test("unnumbered objective subheadings yield no forced number", async () => {
  const { buildLessonOutline } = await loadOutline();
  const outline = buildLessonOutline(makeDocument([
    "I. MỤC TIÊU",
    "Về kiến thức: nắm được khái niệm.",
    "Về phẩm chất: chăm chỉ.",
    "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU",
  ]));
  assert.equal(outline.objectiveNextNumber, 0);
  assert.equal(outline.objectiveSubheadingStyleIndex, -1);
});

test("group headings are dropped and every real activity is found", async () => {
  const { buildLessonOutline } = await loadOutline();
  const outline = buildLessonOutline(makeDocument(lessonSpec));
  assert.deepEqual(outline.activities.map((item) => item.title), [
    "1. HOẠT ĐỘNG KHỞI ĐỘNG (MỞ ĐẦU)",
    "Hoạt động 1: Tìm hiểu thông tin và dữ liệu",
    "Hoạt động 2: Tìm hiểu đơn vị lưu trữ dữ liệu",
    "3. HOẠT ĐỘNG LUYỆN TẬP",
    "4. HOẠT ĐỘNG VẬN DỤNG",
  ], "\"2. HÌNH THÀNH KIẾN THỨC MỚI\" is a group heading, not an activity");
  assert.deepEqual(outline.activities.map((item) => item.section),
    ["khoidong", "kienthuc", "kienthuc", "luyentap", "vandung"]);
});

test("a table activity anchors on the last line of step 2", async () => {
  const { buildLessonOutline } = await loadOutline();
  const paragraphs = makeDocument(lessonSpec);
  const outline = buildLessonOutline(paragraphs);
  for (const activity of outline.activities.filter((item) => item.table)) {
    assert.equal(activity.placement, "sau-buoc-2");
    assert.equal(activity.table.layout, 2);
    assert.equal(paragraphs[activity.insertAfter].text, "+ GV: quan sát và trợ giúp các cặp.");
    assert.equal(paragraphs[activity.insertAfter].cell, activity.table.combinedCell, "the block belongs in the activity column");
  }
});

test("a table-less activity anchors at its end, before the next heading", async () => {
  const { buildLessonOutline } = await loadOutline();
  const paragraphs = makeDocument(lessonSpec);
  const outline = buildLessonOutline(paragraphs);
  const application = outline.activities.find((item) => item.section === "vandung");
  assert.equal(application.placement, "cuoi-hoat-dong");
  assert.equal(paragraphs[application.insertAfter].text, "Bài 1. Trong thẻ căn cước công dân...",
    "the self-study section must not swallow the application block");
});

test("an activity that already carries a red block is flagged, not duplicated", async () => {
  const { buildLessonOutline } = await loadOutline();
  const integrated = lessonSpec.map((item) => (typeof item === "string" || !item.rows[1][1].includes("* Bước 3: Báo cáo, thảo luận:")
    ? item
    : { rows: [item.rows[0], [item.rows[1][0], twoColumnSteps(["🔴 [Tích hợp NLS & AI]", "● NLS: (NLS 6.1 – Bậc 3)"])]] }));
  const outline = buildLessonOutline(makeDocument(integrated));
  const withTable = outline.activities.filter((item) => item.table);
  assert.ok(withTable.length > 0);
  assert.ok(withTable.every((item) => item.alreadyIntegrated), "an existing 🔴 block must be detected");
  assert.ok(outline.activities.filter((item) => !item.table).every((item) => !item.alreadyIntegrated));
});

test("a three-column table anchors in the teacher column", async () => {
  const { buildLessonOutline } = await loadOutline();
  const paragraphs = makeDocument([
    "III. TIẾN TRÌNH DẠY HỌC",
    "Hoạt động 1: Khám phá",
    { rows: [
      [["Hoạt động của giáo viên"], ["Hoạt động của học sinh"], ["Sản phẩm dự kiến"]],
      [["Bước 2: Thực hiện nhiệm vụ", "GV theo dõi các nhóm."], ["HS thảo luận."], ["Phiếu học tập"]],
    ] },
  ]);
  const outline = buildLessonOutline(paragraphs);
  const [activity] = outline.activities;
  assert.equal(activity.table.layout, 3);
  assert.equal(paragraphs[activity.insertAfter].text, "GV theo dõi các nhóm.");
  assert.equal(paragraphs[activity.insertAfter].cell, activity.table.teacherCell);
});

test("a table whose step 2 cannot be found is refused rather than guessed", async () => {
  const { buildLessonOutline } = await loadOutline();
  const outline = buildLessonOutline(makeDocument([
    "Hoạt động 1: Khám phá",
    { rows: [
      [["Sản phẩm dự kiến"], ["Hoạt động của giáo viên và học sinh"]],
      [["Kết luận"], ["GV tổ chức lớp học theo nhóm bốn."]],
    ] },
  ]));
  assert.equal(outline.activities[0].resolved, false);
  assert.equal(outline.activities[0].placement, "khong-do-duoc");
  assert.equal(outline.activities[0].insertAfter, -1);
});
