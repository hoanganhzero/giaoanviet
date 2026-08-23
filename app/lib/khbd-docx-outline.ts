/**
 * Chế độ B — chỉ chèn: đọc cấu trúc của một KHBD có sẵn để biết chèn khối tích hợp
 * vào đâu, mà không đụng đến một chữ nào của bản gốc.
 *
 * Lớp này thuần tuý: nó nhận danh sách phẳng các đoạn văn (đã kèm toạ độ bảng/hàng/ô)
 * và trả về bản đồ hoạt động. Việc duyệt DOM của Word nằm ở phía gọi.
 */

export type OutlineParagraph = {
  index: number;
  text: string;
  table?: number;
  row?: number;
  cell?: number;
};

export type OutlineTable = {
  index: number;
  headerRow: number;
  layout: 2 | 3;
  productCell: number;
  combinedCell: number;
  teacherCell: number;
  studentCell: number;
};

export type ActivitySection = "khoidong" | "kienthuc" | "luyentap" | "vandung" | "khac";

export type ActivityAnchor = {
  id: string;
  title: string;
  section: ActivitySection;
  titleIndex: number;
  table: OutlineTable | null;
  /** Đoạn văn sẽ chèn khối tích hợp NGAY SAU. -1 nghĩa là chưa xác định được. */
  insertAfter: number;
  /** Cách xác định điểm chèn, để hiển thị cho giáo viên biết khối sẽ nằm ở đâu. */
  placement: "sau-buoc-2" | "cuoi-hoat-dong" | "khong-do-duoc";
  /** false khi không dò được: tuyệt đối không chèn, để giáo viên tự chọn vị trí. */
  resolved: boolean;
  /** Giáo án gốc đã có sẵn khối tích hợp 🔴 ở hoạt động này. */
  alreadyIntegrated: boolean;
  summary: string;
};

export type LessonOutline = {
  /** Đoạn cuối của mục I. MỤC TIÊU, nơi chèn dòng "Năng lực số & AI". -1 nếu không thấy. */
  objectiveInsertAfter: number;
  /** Số thứ tự kế tiếp cho đề mục mới trong I. MỤC TIÊU (sau "3. Phẩm chất" là 4). 0 nếu các đề mục không đánh số. */
  objectiveNextNumber: number;
  /** Đoạn đề mục con cuối cùng của I. MỤC TIÊU ("3. Phẩm chất"...), dùng làm mẫu định dạng. -1 nếu không có. */
  objectiveSubheadingStyleIndex: number;
  /** Đoạn đầu tài liệu, nơi chèn Phần 1 phía trước. */
  documentStart: number;
  activities: ActivityAnchor[];
};

export function plainText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SECTION_PATTERNS: Array<[ActivitySection, RegExp]> = [
  ["khoidong", /\b(khoi dong|mo dau|warm up|lead in|getting started|opening)\b/],
  ["kienthuc", /\b(hinh thanh kien thuc|kham pha|kien thuc moi|presentation|new lesson|knowledge formation|pre (reading|listening|writing|speaking)|while (reading|listening))\b/],
  ["luyentap", /\b(luyen tap|thuc hanh|cung co|controlled practice|practice|consolidation)\b/],
  ["vandung", /\b(van dung|trai nghiem|mo rong|production|application|post (reading|listening|writing|speaking)|wrap up)\b/],
];

function sectionOf(text: string, fallback: ActivitySection): ActivitySection {
  const plain = plainText(text);
  for (const [section, pattern] of SECTION_PATTERNS) if (pattern.test(plain)) return section;
  return fallback;
}

/** Tiêu đề hoạt động: "Hoạt động 1: ...", "2. HÌNH THÀNH KIẾN THỨC MỚI", "ACTIVITY 1: WARM-UP", "1. WARM-UP (5')". */
function isActivityTitle(text: string) {
  const plain = plainText(text);
  if (!plain || plain.length > 160) return false;
  if (/^hoat dong \d/.test(plain)) return true;
  if (/^\d+\s+hoat dong\b/.test(plain)) return true;
  if (/^\d+\s+(khoi dong|mo dau|hinh thanh kien thuc|luyen tap|van dung|kham pha|thuc hanh)/.test(plain)) return true;
  // Giáo án Tiếng Anh viết thuần tiếng Anh: "ACTIVITY 1: ...", "1. WARM-UP", "2. PRESENTATION"...
  if (/^activity \d/.test(plain)) return true;
  if (/^\d+\s+activity\b/.test(plain)) return true;
  if (/^\d+\s+(warm up|lead in|getting started|presentation|practice|production|application|consolidation|further practice|wrap up|pre (reading|listening|writing|speaking)|while (reading|listening)|post (reading|listening|writing|speaking))\b/.test(plain)) return true;
  return false;
}

/** Khối tích hợp đã có sẵn trong giáo án gốc, nhận ra qua dấu 🔴 hoặc nhãn của khuôn mẫu. */
function isIntegrationMarker(text: string) {
  if (text.includes("🔴")) return true;
  const plain = plainText(text);
  return /^\[?\s*(tich hop nls|tich hop nang luc so|giao vien huong dan|hoc sinh thuc hien|san pham so hoac san pham ai|digital ai competence integration|teacher guidance|learner actions|digital or ai product)/.test(plain);
}

/** Mục đứng sau tiến trình dạy học: kết thúc hoạt động cuối, không phải hoạt động. */
function isTrailingSection(text: string) {
  const plain = plainText(text);
  if (!plain || plain.length > 120) return false;
  return /^\d*\s*(huong dan (hoc sinh )?tu hoc|huong dan ve nha|dieu chinh sau bai day|ho so day hoc|phu luc|homework|home assignment|self study guidance)/.test(plain)
    || /^iv\s+(dieu chinh|ho so)/.test(plain);
}

function isObjectiveHeading(text: string) {
  const plain = plainText(text);
  return /^(i\s+)?(muc tieu|yeu cau can dat|objectives?|aims)\b/.test(plain);
}

function isSectionHeadingAfterObjectives(text: string) {
  const plain = plainText(text);
  return /^(ii\s+)?(thiet bi day hoc|do dung day hoc|chuan bi|teaching aids?|materials|equipment|preparation)\b/.test(plain) || /^iii\s/.test(plain);
}

/** Đề mục con trong I. MỤC TIÊU: "1. Kiến thức", "2. Về năng lực", "3. Qualities"... Trả về số thứ tự, hoặc 0. */
function objectiveSubheadingNumber(text: string) {
  const plain = plainText(text);
  const match = plain.match(/^(\d+)\s+(ve\s+)?(kien thuc|nang luc|pham chat|ky nang|thai do|knowledge|competenc|qualit|language|skill|attitude)/);
  return match ? Number(match[1]) : 0;
}

/** Dò các bảng 2 cột hoặc 3 cột theo nhãn ở hàng tiêu đề. */
export function detectTables(paragraphs: OutlineParagraph[]): OutlineTable[] {
  const cellText = new Map<string, string[]>();
  for (const paragraph of paragraphs) {
    if (paragraph.table === undefined || paragraph.row === undefined || paragraph.cell === undefined) continue;
    const key = `${paragraph.table}:${paragraph.row}:${paragraph.cell}`;
    cellText.set(key, [...(cellText.get(key) || []), paragraph.text]);
  }
  const rowsByTable = new Map<number, Map<number, Map<number, string>>>();
  for (const [key, lines] of cellText) {
    const [table, row, cell] = key.split(":").map(Number);
    if (!rowsByTable.has(table)) rowsByTable.set(table, new Map());
    const rows = rowsByTable.get(table)!;
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)!.set(cell, plainText(lines.join(" ")));
  }

  const tables: OutlineTable[] = [];
  for (const [tableIndex, rows] of [...rowsByTable].sort((left, right) => left[0] - right[0])) {
    for (const [rowIndex, cells] of [...rows].sort((left, right) => left[0] - right[0])) {
      const labels = [...cells].sort((left, right) => left[0] - right[0]).map(([, label]) => label);
      const productCell = labels.findIndex((label) => /san pham du kien|san pham hoc tap|expected learning product/.test(label));
      const combinedCell = labels.findIndex((label) => (label.includes("giao vien") && label.includes("hoc sinh")) || label.includes("teacher and learner"));
      const teacherCell = labels.findIndex((label) => /hoat dong cua giao vien|teacher activit/.test(label) && !label.includes("hoc sinh") && !label.includes("learner"));
      const studentCell = labels.findIndex((label) => /hoat dong cua hoc sinh|learner activit|student activit/.test(label));
      if (productCell < 0) continue;
      if (combinedCell >= 0) {
        tables.push({ index: tableIndex, headerRow: rowIndex, layout: 2, productCell, combinedCell, teacherCell: -1, studentCell: -1 });
        break;
      }
      if (teacherCell >= 0 && studentCell >= 0) {
        tables.push({ index: tableIndex, headerRow: rowIndex, layout: 3, productCell, combinedCell: -1, teacherCell, studentCell });
        break;
      }
    }
  }
  return tables;
}

/**
 * Điểm chèn của một hoạt động: đoạn cuối của Bước 2 trong cột hoạt động.
 * Trả về -1 khi không dò được, để phía gọi bỏ qua thay vì chèn bừa.
 */
function findInsertPoint(paragraphs: OutlineParagraph[], table: OutlineTable | null, titleIndex: number, nextTitleIndex: number) {
  const scope = paragraphs.filter((paragraph) => paragraph.index > titleIndex && paragraph.index < nextTitleIndex);
  if (!scope.length) return { insertAfter: -1, placement: "khong-do-duoc" as const };
  const inActivityColumn = (paragraph: OutlineParagraph) => {
    if (!table) return paragraph.table === undefined;
    if (paragraph.table !== table.index || paragraph.row === table.headerRow) return false;
    const column = table.layout === 2 ? table.combinedCell : table.teacherCell;
    return paragraph.cell === column;
  };
  const candidates = scope.filter(inActivityColumn);
  if (!candidates.length) return { insertAfter: -1, placement: "khong-do-duoc" as const };

  const matchesStep = (paragraph: OutlineParagraph, number: number, label: RegExp) => {
    const plain = plainText(paragraph.text);
    return new RegExp(`\\b(buoc|step) ${number}\\b`).test(plain) || label.test(plain);
  };
  const step2 = candidates.find((paragraph) => matchesStep(paragraph, 2, /^(thuc hien nhiem vu|perform the task|task performance)/));
  if (step2) {
    const step3 = candidates.find((paragraph) => paragraph.index > step2.index && matchesStep(paragraph, 3, /^(bao cao,? thao luan|report and discuss)/));
    if (step3) {
      const previous = candidates.filter((paragraph) => paragraph.index < step3.index).at(-1);
      return { insertAfter: previous ? previous.index : step2.index, placement: "sau-buoc-2" as const };
    }
    return { insertAfter: candidates.at(-1)!.index, placement: "sau-buoc-2" as const };
  }

  // Hoạt động viết mạch dọc, không chia bốn bước (Luyện tập, Vận dụng trong nhiều giáo án):
  // hai tệp tham chiếu đặt khối tích hợp ở cuối hoạt động.
  if (!table) return { insertAfter: candidates.at(-1)!.index, placement: "cuoi-hoat-dong" as const };
  return { insertAfter: -1, placement: "khong-do-duoc" as const };
}

export function buildLessonOutline(paragraphs: OutlineParagraph[]): LessonOutline {
  const tables = detectTables(paragraphs);
  const titles = paragraphs.filter((paragraph) => paragraph.table === undefined && isActivityTitle(paragraph.text));
  const trailingIndex = paragraphs.find((paragraph) => paragraph.table === undefined
    && isTrailingSection(paragraph.text)
    && paragraph.index > (titles.at(-1)?.index ?? -1))?.index ?? Number.MAX_SAFE_INTEGER;

  let objectiveInsertAfter = -1;
  let objectiveNextNumber = 0;
  let objectiveSubheadingStyleIndex = -1;
  const objectiveHeading = paragraphs.find((paragraph) => paragraph.table === undefined && isObjectiveHeading(paragraph.text));
  if (objectiveHeading) {
    const next = paragraphs.find((paragraph) => paragraph.index > objectiveHeading.index && paragraph.table === undefined && isSectionHeadingAfterObjectives(paragraph.text));
    const inside = paragraphs.filter((paragraph) => paragraph.index > objectiveHeading.index && (!next || paragraph.index < next.index));
    objectiveInsertAfter = inside.at(-1)?.index ?? objectiveHeading.index;
    for (const paragraph of inside) {
      const number = objectiveSubheadingNumber(paragraph.text);
      if (number > 0 && number + 1 > objectiveNextNumber) {
        objectiveNextNumber = number + 1;
        objectiveSubheadingStyleIndex = paragraph.index;
      }
    }
  }

  let currentSection: ActivitySection = "khac";
  const anchors = titles.map((title, order) => {
    const nextTitleIndex = Math.min(titles[order + 1]?.index ?? Number.MAX_SAFE_INTEGER, trailingIndex > title.index ? trailingIndex : Number.MAX_SAFE_INTEGER);
    currentSection = sectionOf(title.text, currentSection);
    const table = tables.find((item) => paragraphs.some((paragraph) =>
      paragraph.table === item.index && paragraph.index > title.index && paragraph.index < nextTitleIndex)) || null;
    const body = paragraphs.filter((paragraph) => paragraph.index > title.index && paragraph.index < nextTitleIndex);
    const { insertAfter, placement } = findInsertPoint(paragraphs, table, title.index, nextTitleIndex);
    return {
      id: `hd-${order + 1}`,
      title: title.text.trim(),
      section: currentSection,
      titleIndex: title.index,
      table,
      insertAfter,
      placement,
      resolved: insertAfter >= 0,
      alreadyIntegrated: body.some((paragraph) => isIntegrationMarker(paragraph.text)),
      summary: body.map((paragraph) => paragraph.text.trim()).filter(Boolean).join(" ").slice(0, 700),
    } satisfies ActivityAnchor;
  });

  // Tiêu đề nhóm ("2. HÌNH THÀNH KIẾN THỨC MỚI") nhận ra ở chỗ: không có bảng, gần như
  // không có nội dung riêng, và ngay dưới nó là một hoạt động con "Hoạt động N: ...".
  const activities = anchors.filter((anchor, order) => {
    const next = anchors[order + 1];
    if (!next || anchor.table) return true;
    if (!/^hoat dong \d/.test(plainText(next.title))) return true;
    const ownBody = paragraphs.filter((paragraph) =>
      paragraph.index > anchor.titleIndex && paragraph.index < next.titleIndex && paragraph.text.trim());
    return ownBody.length > 1;
  }).map((anchor, order) => ({ ...anchor, id: `hd-${order + 1}` }));

  return {
    objectiveInsertAfter,
    objectiveNextNumber,
    objectiveSubheadingStyleIndex,
    documentStart: paragraphs[0]?.index ?? 0,
    activities,
  };
}

/** Bản mô tả gọn của giáo án gốc, gửi cho mô hình thay cho một mẩu văn bản cắt ngang. */
export function outlineForPrompt(outline: LessonOutline) {
  return outline.activities.map((activity) => [
    `- ${activity.id} | ${activity.title}`,
    `  Phần: ${activity.section}`,
    `  Bố cục bảng: ${activity.table ? `${activity.table.layout} cột` : "không có bảng (trình bày mạch dọc)"}`,
    `  Chèn được khối tích hợp: ${activity.resolved ? `có, ${activity.placement === "sau-buoc-2" ? "ngay sau Bước 2" : "ở cuối hoạt động"}` : "KHÔNG (không dò được vị trí)"}`,
    `  Đã có khối tích hợp sẵn: ${activity.alreadyIntegrated ? "CÓ, không chèn thêm" : "chưa"}`,
    `  Nhiệm vụ trong giáo án gốc: ${activity.summary || "(không có mô tả)"}`,
  ].join("\n")).join("\n\n");
}
