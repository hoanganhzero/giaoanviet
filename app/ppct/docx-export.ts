import { strToU8, zipSync } from "fflate";

export type PpctExportRow = {
  rowType?: "lesson" | "section" | "semester";
  week: string;
  lesson: string;
  teachingPeriod: string;
  periodCount: string;
  requirements: string;
  equipment: string;
  digitalCompetency: string;
  aiIntegration: string;
};

export type PpctExportPlan = {
  title: string;
  semester1Periods: string;
  semester2Periods: string;
  rows: PpctExportRow[];
  notes: string[];
};

export type PpctExportForm = {
  school: string;
  department: string;
  teacher: string;
  subject: string;
  grade: string;
  schoolYear: string;
  semester1Weeks: string;
  semester2Weeks: string;
  place?: string;
  programOrientation?: string;
};

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const columnWidths = [817, 2013, 709, 765, 3628, 1474, 2466, 2637];

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function codePattern() {
  return /(\[?(?:[1-6]\.\d\.(?:CB|TC|NC)\d[a-d]|\d+\.[ABCD]\d\.(?:MR)?\d)\]?\.?)/gi;
}

function run(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number } = {}) {
  if (!text) return "";
  const properties = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>',
    options.bold ? "<w:b/>" : "",
    options.italic ? "<w:i/>" : "",
    options.underline ? '<w:u w:val="single"/>' : "",
    `<w:sz w:val="${options.size || 22}"/><w:szCs w:val="${options.size || 22}"/>`,
  ].join("");
  return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function richRuns(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; boldCodes?: boolean } = {}) {
  if (!options.boldCodes) return run(text, options);
  const parts = text.split(codePattern()).filter(Boolean);
  return parts.map((part) => run(part, { ...options, bold: options.bold || codePattern().test(part) })).join("");
}

function paragraph(text = "", options: { align?: "left" | "center" | "right" | "both"; bold?: boolean; italic?: boolean; underline?: boolean; size?: number; before?: number; after?: number; boldCodes?: boolean } = {}) {
  const align = options.align || "left";
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${options.before || 0}" w:after="${options.after || 0}" w:line="240" w:lineRule="auto"/></w:pPr>${richRuns(text, options)}</w:p>`;
}

function cellParagraphs(text: string, options: { align?: "left" | "center" | "right" | "both"; bold?: boolean; size?: number; boldCodes?: boolean } = {}) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  return (lines.length ? lines : [""]).map((line) => paragraph(line, { ...options, align: options.align || "both" })).join("");
}

function cell(text: string, width: number, options: { align?: "left" | "center" | "right" | "both"; bold?: boolean; size?: number; fill?: string; gridSpan?: number; boldCodes?: boolean; borderless?: boolean } = {}) {
  const span = options.gridSpan ? `<w:gridSpan w:val="${options.gridSpan}"/>` : "";
  const fill = options.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : "";
  const borders = options.borderless ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span}${fill}${borders}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${cellParagraphs(text, options)}</w:tc>`;
}

function tableProperties(width: number, borderless = false) {
  const borders = borderless
    ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
    : '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="6" w:color="000000"/><w:insideV w:val="single" w:sz="6" w:color="000000"/></w:tblBorders>';
  return `<w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblInd w:w="0" w:type="dxa"/>${borders}<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0"/></w:tblPr>`;
}

function administrativeHeader(form: PpctExportForm) {
  const english = form.subject === "Tiếng Anh";
  const year = (form.schoolYear.match(/\d{4}/) || [String(new Date().getFullYear())])[0];
  const left = [form.school.toUpperCase(), `${english ? "DEPARTMENT" : "TỔ"}: ${form.department.toUpperCase()}`];
  const right = english
    ? ["SOCIALIST REPUBLIC OF VIET NAM", "Independence - Freedom - Happiness", "", `${form.place || "Tân Ninh"}, date      month      year ${year}`]
    : ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "", `${form.place || "Tân Ninh"}, ngày      tháng      năm ${year}`];
  const leftCell = `<w:tc><w:tcPr><w:tcW w:w="5500" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>${paragraph(left[0], { align: "center", size: 24 })}${paragraph(left[1], { align: "center", bold: true, underline: true, size: 24 })}</w:tc>`;
  const rightCell = `<w:tc><w:tcPr><w:tcW w:w="9000" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>${paragraph(right[0], { align: "center", bold: true, size: 24 })}${paragraph(right[1], { align: "center", bold: true, underline: true, size: 24 })}${paragraph("")}${paragraph(right[3], { align: "center", italic: true, size: 24 })}</w:tc>`;
  return `<w:tbl>${tableProperties(14509, true)}<w:tblGrid><w:gridCol w:w="5500"/><w:gridCol w:w="9009"/></w:tblGrid><w:tr>${leftCell}${rightCell}</w:tr></w:tbl>`;
}

function headerRow(english: boolean) {
  const labels = english
    ? ["Week", "Unit/Lesson", "Teaching\nperiod", "Number of\nperiods", "Learning outcomes", "Teaching\nequipment", "Digital competence", "AI integration"]
    : ["Tuần", "Bài học", "Tiết\ndạy", "Số\ntiết", "Yêu cầu cần đạt", "Thiết bị\ndạy học", "Năng lực số", "Tích hợp AI"];
  return `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${labels.map((label, index) => cell(label, columnWidths[index], { align: "center", bold: true, size: 22, fill: "D9E2F3" })).join("")}</w:tr>`;
}

function isSectionRow(row: PpctExportRow) {
  return row.rowType === "section" || row.rowType === "semester" || /^(CHỦ ĐỀ|HỌC KÌ|UNIT|TOPIC|SEMESTER)/i.test(row.lesson.trim());
}

function mainTable(rows: PpctExportRow[], english: boolean) {
  const bodyRows = rows.map((row) => {
    if (isSectionRow(row)) {
      return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(row.lesson || row.week, columnWidths.reduce((sum, value) => sum + value, 0), { align: "center", bold: true, size: 22, fill: "E7E6E6", gridSpan: 8 })}</w:tr>`;
    }
    const values = [row.week, row.lesson, row.teachingPeriod, row.periodCount, row.requirements, row.equipment, row.digitalCompetency, row.aiIntegration];
    return `<w:tr>${values.map((value, index) => cell(value, columnWidths[index], {
      align: [0, 2, 3].includes(index) ? "center" : "both",
      bold: index === 1,
      boldCodes: index === 6 || index === 7,
      size: 21,
    })).join("")}</w:tr>`;
  }).join("");
  return `<w:tbl>${tableProperties(columnWidths.reduce((sum, value) => sum + value, 0))}<w:tblGrid>${columnWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${headerRow(english)}${bodyRows}</w:tbl>`;
}

function signatureTable(form: PpctExportForm) {
  const english = form.subject === "Tiếng Anh";
  const left = `${paragraph(english ? "HEAD OF DEPARTMENT'S APPROVAL" : "DUYỆT CỦA TỔ TRƯỞNG CHUYÊN MÔN", { align: "center", bold: true, size: 22 })}${paragraph(english ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)", { align: "center", italic: true, size: 22 })}${paragraph("")}${paragraph("")}${paragraph("")}`;
  const right = `${paragraph(english ? "SUBJECT TEACHER" : "GIÁO VIÊN BỘ MÔN", { align: "center", bold: true, size: 22 })}${paragraph(english ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)", { align: "center", italic: true, size: 22 })}${paragraph("")}${paragraph("")}${paragraph(form.teacher, { align: "center", bold: true, size: 22 })}`;
  const sigCell = (content: string) => `<w:tc><w:tcPr><w:tcW w:w="7254" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr>${content}</w:tc>`;
  return `<w:tbl>${tableProperties(14509, true)}<w:tblGrid><w:gridCol w:w="7254"/><w:gridCol w:w="7255"/></w:tblGrid><w:tr>${sigCell(left)}${sigCell(right)}</w:tr></w:tbl>`;
}

function examWeek(rows: PpctExportRow[], semester: "I" | "II", english: boolean) {
  return rows.find((row) => new RegExp(english ? `final.*(?:test|exam).*semester\\s*${semester}` : `kiểm tra cuối kì\\s*${semester}`, "i").test(row.lesson))?.week || "";
}

function documentXml(plan: PpctExportPlan, form: PpctExportForm, book: string) {
  const english = form.subject === "Tiếng Anh";
  const orientation = form.programOrientation?.trim();
  const subtitle = english ? `(Textbook: ${book}${orientation ? ` – ${orientation}` : ""})` : orientation ? `(Bộ ${book} – ${orientation})` : `(Bộ ${book})`;
  const semester1Exam = examWeek(plan.rows, "I", english);
  const semester2Exam = examWeek(plan.rows, "II", english);
  const semester1 = english ? `Semester I: ${form.semester1Weeks} weeks (${plan.semester1Periods || "....."} periods)${semester1Exam ? ` – Final examination: week ${semester1Exam}` : ""}` : `Học kì I: ${form.semester1Weeks} tuần (${plan.semester1Periods || "....."} tiết)${semester1Exam ? ` – Kiểm tra cuối kì I: tuần ${semester1Exam}` : ""}`;
  const semester2 = english ? `Semester II: ${form.semester2Weeks} weeks (${plan.semester2Periods || "....."} periods)${semester2Exam ? ` – Final examination: week ${semester2Exam}` : ""}` : `Học kì II: ${form.semester2Weeks} tuần (${plan.semester2Periods || "....."} tiết)${semester2Exam ? ` – Kiểm tra cuối kì II: tuần ${semester2Exam}` : ""}`;
  const notes = plan.notes.length ? `${paragraph(english ? "Notes:" : "Ghi chú:", { bold: true, size: 20, before: 100 })}${plan.notes.map((note) => paragraph(`– ${note}`, { size: 20 })).join("")}` : "";
  const content = [
    administrativeHeader(form),
    paragraph(plan.title, { align: "center", bold: true, size: 28, before: 180, after: 60 }),
    paragraph(subtitle, { align: "center", bold: true, size: 24, after: 40 }),
    paragraph(semester1, { align: "center", bold: true, size: 24, after: 30 }),
    paragraph(semester2, { align: "center", bold: true, size: 24, after: 140 }),
    mainTable(plan.rows, english),
    notes,
    paragraph("", { after: 80 }),
    signatureTable(form),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${content}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418" w:header="500" w:footer="500" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
}

function stylesXml(english: boolean) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${english ? "en-US" : "vi-VN"}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
}

export function buildPpctDocx(plan: PpctExportPlan, form: PpctExportForm, book: string) {
  const now = new Date().toISOString();
  const english = form.subject === "Tiếng Anh";
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/document.xml": strToU8(documentXml(plan, form, book)),
    "word/styles.xml": strToU8(stylesXml(english)),
    "word/settings.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(plan.title)}</dc:title><dc:creator>${escapeXml(form.teacher)}</dc:creator><cp:lastModifiedBy>${escapeXml(form.teacher)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Giáo Án Việt AI</Application><AppVersion>1.0</AppVersion></Properties>`),
  };
  return zipSync(files, { level: 6 });
}
