/**
 * Chế độ B — chèn khối tích hợp vào một tài liệu Word có sẵn mà không sửa bản gốc.
 * Mọi thao tác đều là chèn thêm; hàm kiểm tra bất biến ở cuối bảo đảm điều đó.
 */
import { buildLessonOutline, type LessonOutline, type OutlineParagraph } from "@/app/lib/khbd-docx-outline";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export type DocumentWalk = {
  outline: LessonOutline;
  paragraphs: OutlineParagraph[];
  /** Phần tử w:p tương ứng từng chỉ số trong paragraphs. */
  nodes: Element[];
  originalText: string[];
};

function localChildren(element: Element, name: string) {
  return Array.from(element.children).filter((node) => node.localName === name) as Element[];
}

function paragraphText(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagName("*"))
    .filter((node) => node.localName === "t")
    .map((node) => node.textContent || "")
    .join("")
    .trim();
}

/** Duyệt thân tài liệu theo đúng thứ tự đọc, giữ toạ độ bảng/hàng/ô của từng đoạn. */
export function walkDocument(wordXml: Document): DocumentWalk {
  const body = Array.from(wordXml.getElementsByTagName("*")).find((node) => node.localName === "body");
  if (!body) throw new Error("Tài liệu Word không có phần thân.");
  const paragraphs: OutlineParagraph[] = [];
  const nodes: Element[] = [];
  let tableIndex = -1;

  const pushParagraph = (paragraph: Element, position?: { table: number; row: number; cell: number }) => {
    paragraphs.push({ index: nodes.length, text: paragraphText(paragraph), ...(position ? { table: position.table, row: position.row, cell: position.cell } : {}) });
    nodes.push(paragraph);
  };

  for (const child of Array.from(body.children)) {
    if (child.localName === "p") {
      pushParagraph(child);
      continue;
    }
    if (child.localName !== "tbl") continue;
    tableIndex += 1;
    localChildren(child, "tr").forEach((row, rowIndex) => {
      localChildren(row, "tc").forEach((cell, cellIndex) => {
        localChildren(cell, "p").forEach((paragraph) => pushParagraph(paragraph, { table: tableIndex, row: rowIndex, cell: cellIndex }));
      });
    });
  }

  return { outline: buildLessonOutline(paragraphs), paragraphs, nodes, originalText: paragraphs.map((paragraph) => paragraph.text) };
}

function createElement(wordXml: Document, name: string) {
  return wordXml.createElementNS(WORD_NS, `w:${name}`);
}

export type ParagraphStyle = {
  bold?: boolean;
  /** Màu chữ dạng hex sáu kí tự, ví dụ "C00000" cho đỏ đậm. */
  color?: string;
  align?: "left" | "center";
};

/**
 * Đoạn văn mới thừa hưởng định dạng của đoạn neo, để chữ chèn vào khớp font, cỡ chữ
 * và thụt lề của giáo án gốc. Không có neo thì dùng chuẩn văn bản: Times New Roman 13pt.
 */
export function createParagraph(wordXml: Document, value: string, anchor?: Element, style: ParagraphStyle | boolean = false) {
  const { bold = false, color, align } = typeof style === "boolean" ? { bold: style } : style;
  const paragraph = createElement(wordXml, "p");
  const anchorProperties = anchor ? Array.from(anchor.children).find((node) => node.localName === "pPr") : undefined;
  const paragraphProperties = anchorProperties ? anchorProperties.cloneNode(true) as Element : createElement(wordXml, "pPr");
  if (align) {
    for (const existing of Array.from(paragraphProperties.children).filter((node) => node.localName === "jc")) paragraphProperties.removeChild(existing);
    const justify = createElement(wordXml, "jc");
    justify.setAttributeNS(WORD_NS, "w:val", align);
    paragraphProperties.appendChild(justify);
  }
  if (paragraphProperties.childNodes.length) paragraph.appendChild(paragraphProperties);
  const run = createElement(wordXml, "r");
  const anchorRun = anchor ? Array.from(anchor.getElementsByTagName("*")).find((node) => node.localName === "r") : undefined;
  const anchorRunProperties = anchorRun ? Array.from(anchorRun.children).find((node) => node.localName === "rPr") : undefined;
  const runProperties = anchorRunProperties ? anchorRunProperties.cloneNode(true) as Element : createElement(wordXml, "rPr");
  if (!anchor) {
    // Chuẩn văn bản hành chính: Times New Roman, cỡ 13 (26 nửa-điểm).
    const fonts = createElement(wordXml, "rFonts");
    fonts.setAttributeNS(WORD_NS, "w:ascii", "Times New Roman");
    fonts.setAttributeNS(WORD_NS, "w:hAnsi", "Times New Roman");
    fonts.setAttributeNS(WORD_NS, "w:cs", "Times New Roman");
    runProperties.appendChild(fonts);
    const size = createElement(wordXml, "sz");
    size.setAttributeNS(WORD_NS, "w:val", "26");
    runProperties.appendChild(size);
    const sizeCs = createElement(wordXml, "szCs");
    sizeCs.setAttributeNS(WORD_NS, "w:val", "26");
    runProperties.appendChild(sizeCs);
  }
  if (bold && !Array.from(runProperties.children).some((node) => node.localName === "b")) runProperties.appendChild(createElement(wordXml, "b"));
  if (color) {
    for (const existing of Array.from(runProperties.children).filter((node) => node.localName === "color")) runProperties.removeChild(existing);
    const colorNode = createElement(wordXml, "color");
    colorNode.setAttributeNS(WORD_NS, "w:val", color);
    runProperties.appendChild(colorNode);
  }
  if (runProperties.childNodes.length) run.appendChild(runProperties);
  const text = createElement(wordXml, "t");
  text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  text.textContent = value.replace(CONTROL_CHARACTERS, "");
  run.appendChild(text);
  paragraph.appendChild(run);
  return paragraph;
}

/** Bảng kẻ khung đơn giản cho Phần 1 – Bảng định hướng tích hợp. */
export function createTable(wordXml: Document, rows: string[][], anchor?: Element) {
  void anchor; // Ô bảng dùng chuẩn Times New Roman 13 thay vì thừa hưởng định dạng đoạn neo (thường là tiêu đề căn giữa).
  const table = createElement(wordXml, "tbl");
  const properties = createElement(wordXml, "tblPr");
  const width = createElement(wordXml, "tblW");
  width.setAttributeNS(WORD_NS, "w:w", "5000");
  width.setAttributeNS(WORD_NS, "w:type", "pct");
  properties.appendChild(width);
  const borders = createElement(wordXml, "tblBorders");
  for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
    const border = createElement(wordXml, side);
    border.setAttributeNS(WORD_NS, "w:val", "single");
    border.setAttributeNS(WORD_NS, "w:sz", "4");
    border.setAttributeNS(WORD_NS, "w:color", "000000");
    borders.appendChild(border);
  }
  properties.appendChild(borders);
  table.appendChild(properties);

  const columnCount = rows[0]?.length || 1;
  const grid = createElement(wordXml, "tblGrid");
  for (let index = 0; index < columnCount; index += 1) {
    const column = createElement(wordXml, "gridCol");
    column.setAttributeNS(WORD_NS, "w:w", String(Math.floor(9360 / columnCount)));
    grid.appendChild(column);
  }
  table.appendChild(grid);

  rows.forEach((cells, rowIndex) => {
    const row = createElement(wordXml, "tr");
    cells.forEach((value) => {
      const cell = createElement(wordXml, "tc");
      const cellProperties = createElement(wordXml, "tcPr");
      const cellWidth = createElement(wordXml, "tcW");
      cellWidth.setAttributeNS(WORD_NS, "w:w", String(Math.floor(5000 / columnCount)));
      cellWidth.setAttributeNS(WORD_NS, "w:type", "pct");
      cellProperties.appendChild(cellWidth);
      if (rowIndex === 0) {
        const shading = createElement(wordXml, "shd");
        shading.setAttributeNS(WORD_NS, "w:val", "clear");
        shading.setAttributeNS(WORD_NS, "w:fill", "F2F2F2");
        cellProperties.appendChild(shading);
      }
      cell.appendChild(cellProperties);
      cell.appendChild(createParagraph(wordXml, value, undefined, rowIndex === 0 ? { bold: true, align: "center" } : {}));
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  return table;
}

/** Màu đỏ đậm chuẩn của Word cho các dòng tiêu đề khối 🔴. */
const BLOCK_HEAD_COLOR = "C00000";

/**
 * Chèn một dãy đoạn văn ngay sau đoạn neo, giữ nguyên thứ tự đã cho.
 * Dòng bắt đầu bằng 🔴 (tiêu đề phân khối tích hợp) được in đậm màu đỏ như hai tệp mẫu.
 */
export function insertAfterParagraph(wordXml: Document, anchor: Element, lines: string[], boldFirst = true) {
  const parent = anchor.parentNode;
  if (!parent) return 0;
  let tail: Node = anchor;
  let added = 0;
  for (const [index, line] of lines.entries()) {
    const isBlockHead = line.startsWith("🔴");
    const style: ParagraphStyle = isBlockHead ? { bold: true, color: BLOCK_HEAD_COLOR } : { bold: boldFirst && index === 0 };
    const paragraph = createParagraph(wordXml, line, anchor, style);
    parent.insertBefore(paragraph, tail.nextSibling);
    tail = paragraph;
    added += 1;
  }
  return added;
}

/**
 * Chèn đề mục "Năng lực số và Trí tuệ nhân tạo" cùng các dòng mã năng lực vào cuối mục I. MỤC TIÊU.
 * Đề mục thừa hưởng định dạng của đề mục con cuối cùng ("3. Phẩm chất"...) để đồng bộ với giáo án gốc.
 */
export function insertObjectiveSection(wordXml: Document, walk: DocumentWalk, heading: string, lines: string[]) {
  const anchor = walk.nodes[walk.outline.objectiveInsertAfter];
  const parent = anchor?.parentNode;
  if (!anchor || !parent) return 0;
  const styleAnchor = walk.nodes[walk.outline.objectiveSubheadingStyleIndex] || anchor;
  let tail: Node = anchor;
  const headingParagraph = createParagraph(wordXml, heading, styleAnchor, { bold: true });
  parent.insertBefore(headingParagraph, tail.nextSibling);
  tail = headingParagraph;
  let added = 1;
  for (const line of lines) {
    const paragraph = createParagraph(wordXml, line, anchor);
    parent.insertBefore(paragraph, tail.nextSibling);
    tail = paragraph;
    added += 1;
  }
  return added;
}

/**
 * Bản gốc phải còn nguyên: mọi đoạn cũ vẫn có mặt, đúng nguyên văn và đúng thứ tự.
 * Trả về đoạn đầu tiên bị mất hoặc bị đổi, hoặc null nếu bản gốc còn nguyên vẹn.
 */
export function findBrokenOriginal(originalText: string[], currentText: string[]) {
  let cursor = 0;
  for (const original of originalText) {
    let found = -1;
    for (let index = cursor; index < currentText.length; index += 1) {
      if (currentText[index] === original) { found = index; break; }
    }
    if (found < 0) return original;
    cursor = found + 1;
  }
  return null;
}
