/**
 * Chế độ A — dựng tệp .docx thật cho KHBD soạn mới, theo chuẩn văn bản:
 * khổ A4, lề trên/dưới 2cm, trái 3cm, phải 1,5cm; Times New Roman 13pt; giãn dòng 1,15;
 * tiêu đề in đậm, bảng kẻ khung, đề mục "Năng lực số và Trí tuệ nhân tạo" nằm trong I. MỤC TIÊU.
 */
import { zipSync, strToU8 } from "fflate";

const CONTROL_CHARACTERS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g");
const RED = "C00000";
/** 1 điểm ảnh (96dpi) tính theo EMU của Word. */
const EMU_PER_PIXEL = 9525;
/** Bề rộng tối đa của hình trong ô bảng: 7,5cm. */
const MAX_IMAGE_EMU = 2_700_000;

type IndicatorLike = { code: string; indicator: string };
type IntegrationRowLike = { activity: string; content: string; digitalCode: string; aiCode: string; product: string; ethicsNote: string };
type IllustrationLike = { dataUrl: string; caption: string; sourceName: string };
type StepLike = { step: string; teacher: string; student: string; integration?: unknown };
type ActivityLike = {
  code: string; title: string; duration: string; objective: string; content: string;
  product: string; assessment: string;
  procedure?: StepLike[]; subActivities?: ActivityLike[]; illustrations?: IllustrationLike[];
};
export type StandardPlanLike = {
  title: string;
  summary?: string;
  objectives: { knowledge: string[]; generalCompetencies: string[]; specificCompetencies: string[]; qualities: string[] };
  equipment: string[];
  teachingMethods?: string[];
  activities: ActivityLike[];
  questions?: Array<{ question: string; answer: string }>;
  accommodations?: string[];
  assessmentPlan?: string[];
  homework?: string[];
  digitalCompetencyIndicators?: IndicatorLike[];
  aiCompetencyIndicators?: IndicatorLike[];
  integrationPlan?: IntegrationRowLike[];
};

export type StandardDocxInput = {
  english: boolean;
  plan: StandardPlanLike;
  form: { subject: string; grade: string; periods: string; teacher: string; school: string; department: string };
  labels: Record<string, string>;
  blockLabels: { part1: string; part2: string; columns: readonly string[] };
  /** Khối tích hợp đã dựng thành các dòng theo khuôn hai tệp mẫu (dòng 🔴 và dòng ●). */
  blockLines: (block: unknown) => string[];
};

function esc(value: string) {
  return String(value ?? "").replace(CONTROL_CHARACTERS, "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

type RunStyle = { bold?: boolean; italic?: boolean; color?: string; size?: number };
type ParaStyle = RunStyle & { align?: "left" | "center" | "right" | "both"; indent?: number; spacingAfter?: number };

function runProps({ bold, italic, color, size = 26 }: RunStyle) {
  return `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
}

function run(text: string, style: RunStyle = {}) {
  return `<w:r>${runProps(style)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(content: string, style: ParaStyle = {}) {
  const { align, indent, spacingAfter = 40 } = style;
  const pieces = [
    `<w:spacing w:after="${spacingAfter}" w:line="276" w:lineRule="auto"/>`,
    indent ? `<w:ind w:left="${indent}"/>` : "",
    align ? `<w:jc w:val="${align}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${pieces}${runProps(style)}</w:pPr>${content}</w:p>`;
}

function textPara(text: string, style: ParaStyle = {}) {
  return para(run(text, style), style);
}

function bullets(items: string[], style: ParaStyle = {}) {
  return items.map((item) => textPara(`- ${item}`, style)).join("");
}

/** Dòng của khối tích hợp: 🔴 đậm đỏ, ● thụt lề như hai tệp mẫu. */
function integrationParagraphs(lines: string[]) {
  return lines.map((line) => line.startsWith("🔴")
    ? textPara(line, { bold: true, color: RED })
    : textPara(line, { indent: 240 })).join("");
}

type TableOptions = { widths?: number[]; borders?: boolean; headerRow?: boolean };

/** cells: mảng hàng, mỗi ô là chuỗi XML gồm các w:p đã dựng sẵn. widths tính theo phần trăm (tổng 100). */
function table(rows: string[][], { widths, borders = true, headerRow = true }: TableOptions = {}) {
  const columnCount = rows[0]?.length || 1;
  const percents = widths && widths.length === columnCount ? widths : Array.from({ length: columnCount }, () => 100 / columnCount);
  const borderXml = borders
    ? `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((side) => `<w:${side} w:val="single" w:sz="4" w:color="000000"/>`).join("")}</w:tblBorders>`
    : "";
  const grid = `<w:tblGrid>${percents.map((percent) => `<w:gridCol w:w="${Math.round(93.6 * percent)}"/>`).join("")}</w:tblGrid>`;
  const body = rows.map((cells, rowIndex) => `<w:tr>${cells.map((cell, cellIndex) => {
    const shading = headerRow && rowIndex === 0 ? `<w:shd w:val="clear" w:fill="F2F2F2"/>` : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${Math.round(50 * percents[cellIndex])}" w:type="pct"/>${shading}<w:vAlign w:val="top"/></w:tcPr>${cell || textPara("")}</w:tc>`;
  }).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borderXml}<w:tblLayout w:type="fixed"/></w:tblPr>${grid}${body}</w:tbl>`;
}

function headerCells(labels: string[]) {
  return labels.map((label) => textPara(label, { bold: true, align: "center" }));
}

type MediaFile = { name: string; bytes: Uint8Array; extension: string };

/** Đọc kích thước điểm ảnh từ phần đầu tệp PNG/JPEG/GIF; sai định dạng thì dùng 4:3 mặc định. */
function imageSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (width > 0 && height > 0) return { width, height };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let index = 2;
    while (index + 9 < bytes.length) {
      if (bytes[index] !== 0xff) { index += 1; continue; }
      const marker = bytes[index + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (bytes[index + 5] << 8) | bytes[index + 6];
        const width = (bytes[index + 7] << 8) | bytes[index + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      index += 2 + ((bytes[index + 2] << 8) | bytes[index + 3]);
    }
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: 800, height: 600 };
}

function decodeDataUrl(dataUrl: string): MediaFile | null {
  const match = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  const extension = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { name: "", bytes, extension };
  } catch {
    return null;
  }
}

export function buildStandardDocx({ english, plan, form, labels, blockLabels, blockLines }: StandardDocxInput): Uint8Array {
  const media: MediaFile[] = [];
  const relationships: string[] = [
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  ];
  let drawingCounter = 0;

  const imageParagraph = (illustration: IllustrationLike) => {
    const decoded = decodeDataUrl(illustration.dataUrl);
    if (!decoded) return "";
    drawingCounter += 1;
    const relId = `rIdImg${drawingCounter}`;
    decoded.name = `media/image${drawingCounter}.${decoded.extension === "jpeg" ? "jpg" : decoded.extension}`;
    media.push(decoded);
    relationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${decoded.name}"/>`);
    const { width, height } = imageSize(decoded.bytes);
    let cx = width * EMU_PER_PIXEL;
    let cy = height * EMU_PER_PIXEL;
    if (cx > MAX_IMAGE_EMU) { cy = Math.round(cy * (MAX_IMAGE_EMU / cx)); cx = MAX_IMAGE_EMU; }
    const drawing = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${drawingCounter}" name="Hinh ${drawingCounter}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${drawingCounter}" name="Hinh ${drawingCounter}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    const caption = [illustration.caption, illustration.sourceName ? `(${illustration.sourceName})` : ""].filter(Boolean).join(" ");
    return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${drawing}</w:r></w:p>${caption ? textPara(caption, { italic: true, align: "center", size: 22 }) : ""}`;
  };

  const digitalSectionTitle = english
    ? "4. Digital and artificial intelligence (AI) competences"
    : "4. Năng lực số và năng lực trí tuệ nhân tạo (AI)";
  const hasDigitalSection = (plan.digitalCompetencyIndicators?.length || 0) > 0 || (plan.aiCompetencyIndicators?.length || 0) > 0;

  const indicatorTable = (indicators: IndicatorLike[], codeLabel: string, outcomeLabel: string) => table([
    headerCells([codeLabel, outcomeLabel]),
    ...indicators.map((item) => [textPara(item.code, { bold: true }), textPara(item.indicator)]),
  ], { widths: [28, 72] });

  const activityXml = (activity: ActivityLike): string => {
    const heading = textPara(`${activity.code}. ${activity.title}${activity.duration ? ` (${activity.duration})` : ""}`, { bold: true, spacingAfter: 80 });
    const details = [
      textPara(`a) ${labels.objective}: ${activity.objective}`),
      textPara(`b) ${labels.content}: ${activity.content}`),
      textPara(`c) ${labels.learningProduct}: ${activity.product}`),
      textPara(`d) ${labels.implementation}:`),
    ].join("");
    const productCell = [
      textPara(activity.product),
      ...(activity.illustrations || []).map(imageParagraph),
    ].join("");
    const stepsCell = (activity.procedure || []).map((step) => {
      const integration = step.integration ? integrationParagraphs(blockLines(step.integration)) : "";
      return textPara(`${step.step}:`, { bold: true }) + textPara(`${step.teacher} ${step.student}`.trim()) + integration;
    }).join("") || textPara("");
    const implementationTable = table([
      headerCells([labels.expectedProduct, labels.combinedActivity]),
      [productCell, stepsCell],
    ], { widths: [38, 62] });
    const assessment = activity.assessment ? textPara(`${labels.assessment}: ${activity.assessment}`) : "";
    return heading + details + implementationTable + assessment;
  };

  const activitiesXml = plan.activities.map((activity) => activity.code.toUpperCase() === "B" && activity.subActivities?.length
    ? textPara(`${activity.code}. ${activity.title} (${activity.duration})`, { bold: true, spacingAfter: 80 }) + activity.subActivities.map(activityXml).join("")
    : activityXml(activity)).join("");

  const orientation = (plan.integrationPlan?.length || 0) > 0
    ? textPara(blockLabels.part1, { bold: true, spacingAfter: 80 })
      + table([
        headerCells([...blockLabels.columns]),
        ...plan.integrationPlan!.map((row) => [row.activity, row.content, row.digitalCode, row.aiCode, row.product, row.ethicsNote].map((value) => textPara(value))),
      ], { widths: [14, 24, 13, 13, 20, 16] })
      + textPara(blockLabels.part2, { bold: true, spacingAfter: 120 })
    : "";

  const listSection = (title: string, items?: string[]) => (items?.length ? textPara(title, { bold: true, spacingAfter: 80 }) + bullets(items) : "");

  const signature = table([[
    [textPara(english ? "HEAD OF DEPARTMENT" : "TỔ TRƯỞNG CHUYÊN MÔN", { bold: true, align: "center" }), textPara(english ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)", { italic: true, align: "center", size: 22 })].join(""),
    [textPara(english ? "TEACHER" : "GIÁO VIÊN", { bold: true, align: "center" }), textPara(english ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)", { italic: true, align: "center", size: 22 }), textPara(""), textPara(form.teacher, { bold: true, align: "center" })].join(""),
  ]], { borders: false, headerRow: false });

  const headerBlock = table([[
    [textPara(`${english ? "School" : "Trường"}: ${form.school || "................................................"}`), textPara(`${english ? "Group" : "Tổ"}: ${form.department || "......................................"}`)].join(""),
    [textPara(`${english ? "Teacher's full name" : "Họ và tên giáo viên"}:`, { align: "center" }), textPara(form.teacher, { bold: true, align: "center" })].join(""),
  ]], { borders: false, headerRow: false });

  const body = [
    headerBlock,
    textPara(labels.lessonPlan, { bold: true, align: "center", size: 28, spacingAfter: 80 }),
    textPara(plan.title, { bold: true, align: "center", size: 28, spacingAfter: 80 }),
    textPara(`${labels.subject}: ${english ? "English" : form.subject} — ${labels.grade}: ${form.grade}`, { align: "center" }),
    textPara(`${english ? "Time of implementation" : "Thời gian thực hiện"}: ${form.periods} ${labels.periods}`, { align: "center", spacingAfter: 160 }),
    orientation,
    plan.summary ? textPara(plan.summary, { italic: true, spacingAfter: 120 }) : "",
    textPara(labels.objectives, { bold: true, spacingAfter: 80 }),
    textPara(labels.knowledge, { bold: true }),
    bullets(plan.objectives.knowledge),
    textPara(labels.generalCompetencies, { bold: true }),
    bullets(plan.objectives.generalCompetencies),
    textPara(labels.specificCompetencies, { bold: true }),
    bullets(plan.objectives.specificCompetencies),
    hasDigitalSection ? textPara(digitalSectionTitle, { bold: true }) : "",
    (plan.digitalCompetencyIndicators?.length || 0) > 0
      ? textPara(labels.digital, { bold: true, size: 24 }) + textPara(labels.digitalSource, { italic: true, size: 22 })
        + indicatorTable(plan.digitalCompetencyIndicators!, english ? "Indicator code" : "Mã chỉ báo", english ? "Expected outcome" : "Yêu cầu cần đạt")
      : "",
    (plan.aiCompetencyIndicators?.length || 0) > 0
      ? textPara(labels.ai, { bold: true, size: 24 }) + textPara(labels.aiSource, { italic: true, size: 22 })
        + indicatorTable(plan.aiCompetencyIndicators!, english ? "Outcome code" : "Mã YCCĐ", english ? "Expected outcome" : "Yêu cầu cần đạt")
      : "",
    textPara(`${hasDigitalSection ? 5 : 4}. ${labels.qualities}`, { bold: true }),
    bullets(plan.objectives.qualities),
    textPara(labels.equipment, { bold: true, spacingAfter: 80 }),
    bullets(plan.equipment),
    (plan.teachingMethods?.length || 0) > 0 ? textPara(labels.methods, { bold: true }) + bullets(plan.teachingMethods!) : "",
    textPara(labels.procedure, { bold: true, spacingAfter: 80 }),
    activitiesXml,
    (plan.questions?.length || 0) > 0
      ? textPara(labels.review, { bold: true, spacingAfter: 80 })
        + plan.questions!.map((item, index) => textPara(`${index + 1}. ${item.question}`, { bold: true }) + textPara(`${labels.answer}: ${item.answer}`)).join("")
      : "",
    listSection(labels.support, plan.accommodations),
    listSection(labels.assessmentPlan, plan.assessmentPlan),
    listSection(labels.homework, plan.homework),
    textPara(english ? "…………, date … / … / ………" : "………………, ngày … tháng … năm ………", { italic: true, align: "right", spacingAfter: 160 }),
    signature,
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="${english ? "en-US" : "vi-VN"}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`;

  const archive: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/_rels/document.xml.rels": strToU8(documentRels),
  };
  for (const file of media) archive[`word/${file.name}`] = file.bytes;
  return zipSync(archive, { level: 6 });
}
