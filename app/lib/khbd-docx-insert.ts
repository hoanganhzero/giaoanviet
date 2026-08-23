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

/**
 * Đoạn văn mới thừa hưởng định dạng của đoạn neo, để chữ chèn vào khớp font, cỡ chữ
 * và thụt lề của giáo án gốc.
 */
export function createParagraph(wordXml: Document, value: string, anchor?: Element, bold = false) {
  const paragraph = createElement(wordXml, "p");
  const anchorProperties = anchor ? Array.from(anchor.children).find((node) => node.localName === "pPr") : undefined;
  if (anchorProperties) paragraph.appendChild(anchorProperties.cloneNode(true));
  const run = createElement(wordXml, "r");
  const anchorRun = anchor ? Array.from(anchor.getElementsByTagName("*")).find((node) => node.localName === "r") : undefined;
  const anchorRunProperties = anchorRun ? Array.from(anchorRun.children).find((node) => node.localName === "rPr") : undefined;
  const runProperties = anchorRunProperties ? anchorRunProperties.cloneNode(true) as Element : createElement(wordXml, "rPr");
  if (bold && !Array.from(runProperties.children).some((node) => node.localName === "b")) runProperties.appendChild(createElement(wordXml, "b"));
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
      cell.appendChild(cellProperties);
      cell.appendChild(createParagraph(wordXml, value, anchor, rowIndex === 0));
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  return table;
}

/** Chèn một dãy đoạn văn ngay sau đoạn neo, giữ nguyên thứ tự đã cho. */
export function insertAfterParagraph(wordXml: Document, anchor: Element, lines: string[], boldFirst = true) {
  const parent = anchor.parentNode;
  if (!parent) return 0;
  let tail: Node = anchor;
  let added = 0;
  for (const [index, line] of lines.entries()) {
    const paragraph = createParagraph(wordXml, line, anchor, boldFirst && index === 0);
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
