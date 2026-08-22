"use client";

import { useEffect, useRef, useState } from "react";
import { strFromU8, unzipSync } from "fflate";
import AccountControls, { useAccountGate } from "@/app/components/AccountControls";
import BrandLogo from "@/app/components/BrandLogo";
import { buildPpctDocx } from "./docx-export";

const subjects = [
  "Toán", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí",
  "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ", "Giáo dục thể chất",
  "Giáo dục quốc phòng và an ninh", "Hoạt động trải nghiệm, hướng nghiệp", "Nội dung giáo dục của địa phương",
];

type Provider = "auto" | "openai" | "gemini" | "kimi" | "kira";
type ManualKeys = Record<"openai" | "gemini" | "kimi" | "kira", string[]>;
type PpctRow = {
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
type PpctPlan = {
  title: string;
  semester1Periods: string;
  semester2Periods: string;
  rows: PpctRow[];
  notes: string[];
};
type FileKind = "ppct" | "textbook";
type ParsedEducationFile = { text: string; units: number; unitLabel: string };

const emptyKeys: ManualKeys = { openai: ["", "", ""], gemini: ["", "", ""], kimi: ["", "", ""], kira: ["", "", ""] };
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 2_500_000;

function xmlElements(parent: Document | Element, localName: string) {
  return Array.from(parent.getElementsByTagName("*")).filter((node) => node.localName === localName);
}

function docxRows(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const xml = archive["word/document.xml"];
  if (!xml) return [] as string[][];
  const documentXml = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
  return xmlElements(documentXml, "tr").map((row) => xmlElements(row, "tc").map((cell) => {
    const paragraphs = xmlElements(cell, "p").map((item) => xmlElements(item, "t").map((node) => node.textContent || "").join("").replace(/[ \t]+/g, " ").trim()).filter(Boolean);
    return paragraphs.join("\n");
  })).filter((row) => row.some(Boolean));
}

function docxParagraphText(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const xml = archive["word/document.xml"];
  if (!xml) return { text: "", units: 0 };
  const documentXml = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
  const paragraphs = xmlElements(documentXml, "p")
    .map((paragraph) => xmlElements(paragraph, "t").map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { text: paragraphs.map((paragraph, index) => `ĐOẠN ${index + 1}: ${paragraph}`).join("\n"), units: paragraphs.length };
}

function xlsxRows(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const parser = new DOMParser();
  const sharedFile = archive["xl/sharedStrings.xml"];
  const shared = sharedFile ? xmlElements(parser.parseFromString(strFromU8(sharedFile), "application/xml"), "si").map((item) => xmlElements(item, "t").map((node) => node.textContent || "").join("")) : [];
  const sheetPath = Object.keys(archive).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).sort()[0];
  if (!sheetPath) return [] as string[][];
  const sheet = parser.parseFromString(strFromU8(archive[sheetPath]), "application/xml");
  return xmlElements(sheet, "row").map((row) => {
    const values: string[] = [];
    xmlElements(row, "c").forEach((cell) => {
      const reference = cell.getAttribute("r") || "A1";
      const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
      let column = 0;
      for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
      const raw = xmlElements(cell, "v")[0]?.textContent || xmlElements(cell, "t").map((node) => node.textContent || "").join("");
      values[column - 1] = cell.getAttribute("t") === "s" ? shared[Number(raw)] || raw : raw;
    });
    return values.map((value) => String(value || "").trim());
  }).filter((row) => row.some(Boolean));
}

function rowsToText(rows: string[][]) {
  const cleaned = rows.map((row) => row.map((cell) => cell.replace(/\r?\n+/g, " ⏎ ").replace(/[ \t]+/g, " ").trim())).filter((row) => row.some(Boolean));
  return cleaned.map((row, index) => `HÀNG ${index + 1}: ${row.join(" || ")}`).join("\n");
}

function competencyContent(value: string) {
  const parts = String(value || "").split(/(\[?(?:[1-6]\.\d\.(?:CB|TC|NC)\d[a-d]|\d+\.[ABCD]\d\.(?:MR)?\d)\]?\.?)/gi).filter(Boolean);
  return parts.map((part, index) => /^(?:\[?(?:[1-6]\.\d\.(?:CB|TC|NC)\d[a-d]|\d+\.[ABCD]\d\.(?:MR)?\d)\]?\.?)$/i.test(part)
    ? <strong key={`${index}-${part}`}>{part}</strong>
    : part);
}


async function parseEducationFile(file: File, kind: FileKind): Promise<ParsedEducationFile> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (kind === "ppct") {
      const rows = docxRows(bytes);
      return { text: rowsToText(rows), units: rows.length, unitLabel: "hàng" };
    }
    const document = docxParagraphText(bytes);
    return { ...document, unitLabel: "đoạn" };
  }
  if (lower.endsWith(".xlsx")) {
    const rows = xlsxRows(new Uint8Array(await file.arrayBuffer()));
    return { text: rowsToText(rows), units: rows.length, unitLabel: "hàng" };
  }
  if (lower.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    let extractedLength = 0;
    for (let index = 1; index <= pdf.numPages && extractedLength < MAX_EXTRACTED_CHARACTERS; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
      pages.push(`[TRANG ${index}] ${pageText}`);
      extractedLength += pageText.length;
    }
    return { text: pages.join("\n"), units: pages.length, unitLabel: "trang" };
  }
  const text = await file.text();
  return { text, units: text.split(/\r?\n/).filter((line) => line.trim()).length, unitLabel: "dòng" };
}

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function selectTextbookExcerpts(ppctText: string, textbookText: string) {
  const stopWords = new Set(["bai", "tiet", "tuan", "chu", "de", "hoc", "tap", "lop", "noi", "dung", "yeu", "cau", "can", "dat", "thuc", "hanh", "kiem", "tra", "on"]);
  const frequencies = new Map<string, number>();
  normalizeSearchText(ppctText).split(/\s+/).forEach((word) => {
    if (word.length >= 4 && !stopWords.has(word)) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });
  const keywords = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 160).map(([word]) => word);
  const pageChunks = textbookText.includes("[TRANG ")
    ? textbookText.split(/(?=\[TRANG \d+\])/)
    : Array.from({ length: Math.ceil(textbookText.length / 3500) }, (_, index) => textbookText.slice(Math.max(0, index * 3500 - 250), (index + 1) * 3500));
  const ranked = pageChunks.map((text, index) => {
    const normalized = normalizeSearchText(text);
    const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 + Math.min(3, frequencies.get(keyword) || 0) : 0), 0);
    return { text, index, score };
  });
  const selected = ranked.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 34);
  const firstChunks = ranked.filter((chunk) => chunk.index < 2);
  return [...new Map([...firstChunks, ...selected].map((chunk) => [chunk.index, chunk])).values()]
    .sort((a, b) => a.index - b.index)
    .map((chunk) => chunk.text)
    .join("\n")
    .slice(0, 90000);
}

export default function PpctPage() {
  const account = useAccountGate("/ppct");
  const [form, setForm] = useState({
    school: "TRUNG TÂM GDNN-GDTX KHU VỰC 1",
    department: "GDTX",
    teacher: "Trần Quốc Hoàng Anh",
    subject: "Tin học",
    grade: "10",
    schoolYear: "2026–2027",
    semester1Weeks: "18",
    semester2Weeks: "17",
    place: "Tân Ninh",
    programOrientation: "Định hướng Tin học ứng dụng",
  });
  const [sourceText, setSourceText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceRows, setSourceRows] = useState(0);
  const [sourceUnitLabel, setSourceUnitLabel] = useState("hàng");
  const [textbookText, setTextbookText] = useState("");
  const [textbookName, setTextbookName] = useState("");
  const [textbookUnits, setTextbookUnits] = useState(0);
  const [textbookUnitLabel, setTextbookUnitLabel] = useState("trang");
  const [rewriteRequirements, setRewriteRequirements] = useState(false);
  const [readingKind, setReadingKind] = useState<FileKind | null>(null);
  const [provider, setProvider] = useState<Provider>("auto");
  const [manualKeys, setManualKeys] = useState<ManualKeys>(emptyKeys);
  const [plan, setPlan] = useState<PpctPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [meta, setMeta] = useState({ provider: "", model: "", keySlot: 0 });
  const documentRef = useRef<HTMLElement | null>(null);

  const book = form.subject === "Tiếng Anh" ? "Global Success" : "Kết nối tri thức với cuộc sống";
  const englishOutput = form.subject === "Tiếng Anh";
  const update = (key: keyof typeof form, value: string) => setForm((current) => key === "subject"
    ? { ...current, subject: value, programOrientation: value === "Tin học" ? "Định hướng Tin học ứng dụng" : "" }
    : { ...current, [key]: value });
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3000); };

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("giao-an-ai-session-keys");
      if (saved) setManualKeys({ ...emptyKeys, ...JSON.parse(saved) });
    } catch { /* Trình duyệt chặn lưu phiên. */ }
  }, []);

  useEffect(() => {
    if (!account) return;
    setForm((current) => ({ ...current, teacher: account.fullName || current.teacher, school: account.school || current.school, department: account.department || current.department }));
  }, [account]);

  const readFile = async (file: File | undefined, kind: FileKind) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return showNotice("Tệp vượt quá 100 MB. Vui lòng chọn tệp nhỏ hơn.");
    setReadingKind(kind);
    try {
      const parsed = await parseEducationFile(file, kind);
      const text = parsed.text.trim().slice(0, MAX_EXTRACTED_CHARACTERS);
      if (!text) return showNotice("Không đọc được nội dung tệp. Vui lòng dùng DOCX, XLSX, PDF, TXT hoặc CSV.");
      if (kind === "ppct") {
        setSourceText(text);
        setSourceName(file.name);
        setSourceRows(parsed.units);
        setSourceUnitLabel(parsed.unitLabel);
      } else {
        setTextbookText(text);
        setTextbookName(file.name);
        setTextbookUnits(parsed.units);
        setTextbookUnitLabel(parsed.unitLabel);
      }
      setPlan(null);
      showNotice(`Đã đọc ${file.name}.`);
    } catch {
      showNotice(`Không thể đọc tệp ${kind === "ppct" ? "PPCT" : "SGK"} này. Tệp PDF dạng ảnh quét cần được nhận dạng chữ trước.`);
    } finally { setReadingKind(null); }
  };

  const generate = async () => {
    if (!sourceText.trim()) return showNotice("Vui lòng tải PPCT nguồn hoặc dán nội dung PPCT.");
    if (!textbookText.trim()) return showNotice("Vui lòng tải SGK để đối chiếu yêu cầu cần đạt của từng bài.");
    setGenerating(true);
    try {
      const textbookSourceText = selectTextbookExcerpts(sourceText, textbookText);
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "ppct",
          provider,
          ppct: { ...form, book, rewriteRequirements, sourceFileName: sourceName || "Nội dung dán trực tiếp", sourceText: sourceText.slice(0, 100000), textbookFileName: textbookName, textbookSourceText },
          clientKeys: manualKeys,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tạo PPCT tích hợp.");
      setPlan(data.plan as PpctPlan);
      setMeta({ provider: data.provider, model: data.model, keySlot: data.keySlot });
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không thể kết nối dịch vụ AI.");
    } finally { setGenerating(false); }
  };

  const downloadWord = () => {
    if (!plan) return;
    const editedTitle = documentRef.current?.querySelector<HTMLElement>("[data-ppct-title]")?.innerText.trim() || plan.title;
    const editedRows = Array.from(documentRef.current?.querySelectorAll<HTMLTableRowElement>(".ppct-main-table tbody tr[data-row-index]") || []).map((row, index) => {
      const source = plan.rows[index];
      const cells = Array.from(row.cells).map((item) => item.innerText.trim());
      if (cells.length === 1) return { ...source, lesson: cells[0] };
      return { ...source, week: cells[0], lesson: cells[1], teachingPeriod: cells[2], periodCount: cells[3], requirements: cells[4], equipment: cells[5], digitalCompetency: cells[6], aiIntegration: cells[7] };
    });
    const bytes = buildPpctDocx({ ...plan, title: editedTitle, rows: editedRows.length === plan.rows.length ? editedRows : plan.rows }, form, book);
    const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([payload], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `PPCT-${form.subject}-lop-${form.grade}-tich-hop-NLS-AI.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice("Đã tạo tệp Word DOCX khổ A4 ngang theo mẫu chuẩn.");
  };

  const isSectionRow = (row: PpctRow) => row.rowType === "section" || row.rowType === "semester" || /^(CHỦ ĐỀ|HỌC KÌ|UNIT|TOPIC|SEMESTER)/i.test(row.lesson.trim());
  const examWeek = (semester: "I" | "II") => plan?.rows.find((row) => new RegExp(englishOutput ? `final.*(?:test|exam).*semester\\s*${semester}` : `kiểm tra cuối kì\\s*${semester}`, "i").test(row.lesson))?.week;

  const copyResult = async () => {
    if (!documentRef.current) return;
    await navigator.clipboard.writeText(documentRef.current.innerText);
    showNotice("Đã sao chép toàn bộ PPCT.");
  };

  if (!account) return <main className="auth-loading">Đang kiểm tra tài khoản...</main>;
  return (
    <main className="ppct-shell">
      <header className="ppct-topbar">
        <a href="/" className="ppct-brand"><BrandLogo className="ppct-brand-mark" alt="Logo Tạo Giáo Án Việt" /><div><b>TẠO GIÁO ÁN VIỆT</b><small>PHÂN PHỐI CHƯƠNG TRÌNH TÍCH HỢP</small></div></a>
        <nav><a href="/">← Trang chủ</a><a href="/?soan-khbd=1">Soạn KHBD</a><a href="/" onClick={() => sessionStorage.setItem("open-ai-settings", "1")}>Cấu hình AI</a><AccountControls user={account}/></nav>
        <div className="header-support"><b>BẢN QUYỀN: TRẦN QUỐC HOÀNG ANH</b><a href="tel:0965653750">ĐT: 0965653750</a><a href="https://zalo.me/0965653750">ZALO HỖ TRỢ</a></div>
      </header>

      <div className="teacher-info-bar ppct-teacher-info"><div><span>▦</span> Trường: <b>{form.school || "Chưa cập nhật"}</b><i /><span>⌘</span> Tổ chuyên môn: <b>{form.department || "Chưa cập nhật"}</b><i /><span>♙</span> Giáo viên: <b>{form.teacher || "Chưa cập nhật"}</b></div><a href="/profile">✎ Sửa thông tin</a></div>
      {account.plan === "free" && <div className="free-plan-bar"><span>Miễn phí: còn <b>{Math.max(0,5-account.khbdUsed)}/5 lượt KHBD</b> và <b>{Math.max(0,5-account.ppctUsed)}/5 lượt PPCT</b></span><a href="https://zalo.me/0965653750">Yêu cầu kích hoạt không giới hạn qua Zalo</a></div>}

      <section className="ppct-intro">
        <div><span className="section-kicker">CÔNG CỤ CHUYÊN MÔN</span><h1>Tạo PPCT tích hợp<br /><em>Năng lực số & Trí tuệ nhân tạo</em></h1><p>Tải đồng thời PPCT và SGK. Hệ thống giữ nguyên chủ đề, học kì, tuần và tiết; đối chiếu yêu cầu cần đạt rồi ánh xạ các mã Năng lực số và AI thực sự phù hợp từng bài.</p></div>
      </section>

      <section className="ppct-workspace">
        <aside className="ppct-config">
          <div className="ppct-panel-title"><span>1</span><div><b>Thông tin PPCT</b><small>Cấu hình phần tiêu đề văn bản</small></div></div>
          <div className="ppct-fields">
            <label className="full">Tên trường/đơn vị<input value={form.school} onChange={(event) => update("school", event.target.value)} /></label>
            <label>Tổ chuyên môn<input value={form.department} onChange={(event) => update("department", event.target.value)} /></label>
            <label>Giáo viên bộ môn<input value={form.teacher} onChange={(event) => update("teacher", event.target.value)} /></label>
            <label>Môn học<select value={form.subject} onChange={(event) => update("subject", event.target.value)}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label>Lớp<select value={form.grade} onChange={(event) => update("grade", event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>Lớp {index + 1}</option>)}</select></label>
            <label className="full">Bộ sách<input value={book} disabled /></label>
            <label>Địa danh<input value={form.place} onChange={(event) => update("place", event.target.value)} /></label>
            <label>Định hướng chương trình<input value={form.programOrientation} onChange={(event) => update("programOrientation", event.target.value)} placeholder="Ví dụ: Định hướng Tin học ứng dụng" /></label>
            <label>Năm học<input value={form.schoolYear} onChange={(event) => update("schoolYear", event.target.value)} /></label>
            <label>Nhà cung cấp AI<select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="auto">Tự động</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="kimi">Kimi</option><option value="kira">Kira AI</option></select></label>
            <label>Số tuần học kì I<input type="number" min="1" max="30" value={form.semester1Weeks} onChange={(event) => update("semester1Weeks", event.target.value)} /></label>
            <label>Số tuần học kì II<input type="number" min="1" max="30" value={form.semester2Weeks} onChange={(event) => update("semester2Weeks", event.target.value)} /></label>
          </div>

          <div className="ppct-panel-title"><span>2</span><div><b>Tải PPCT đang sử dụng</b><small>Lấy tuần, bài học, tiết dạy và số tiết</small></div></div>
          <label className={`ppct-upload ${readingKind === "ppct" ? "reading" : ""}`}><input type="file" accept=".docx,.xlsx,.pdf,.txt,.csv" onChange={(event) => readFile(event.target.files?.[0], "ppct")} disabled={readingKind !== null} /><span>{readingKind === "ppct" ? "…" : "⇧"}</span><b>{readingKind === "ppct" ? "Đang đọc PPCT..." : sourceName || "Chọn tệp PPCT từ máy"}</b><small>DOCX, XLSX, PDF, TXT, CSV • Tối đa 100 MB.</small></label>
          {sourceName && <div className="ppct-file-status"><span>✓</span><div><b>Đã đọc PPCT nguồn</b><small>{sourceRows ? `${sourceRows} ${sourceUnitLabel} nhận diện` : `${sourceText.length.toLocaleString("vi-VN")} ký tự`}</small></div><button type="button" aria-label="Xóa PPCT nguồn" onClick={() => { setSourceName(""); setSourceText(""); setSourceRows(0); }}>×</button></div>}
          <label className="ppct-source-label">Nội dung PPCT nguồn<textarea rows={7} value={sourceText} onChange={(event) => { setSourceText(event.target.value.slice(0, 100000)); setSourceName(""); setSourceRows(0); }} placeholder="Hoặc dán PPCT tại đây. Nên giữ mỗi bài/tiết trên một dòng..." /><small>{sourceText.length.toLocaleString("vi-VN")}/100.000 ký tự gửi AI</small></label>

          <div className="ppct-panel-title"><span>3</span><div><b>Tải sách giáo khoa</b><small>Lấy nội dung và yêu cầu cần đạt đúng từng bài</small></div></div>
          <label className={`ppct-upload textbook ${readingKind === "textbook" ? "reading" : ""}`}><input type="file" accept=".docx,.xlsx,.pdf,.txt,.csv" onChange={(event) => readFile(event.target.files?.[0], "textbook")} disabled={readingKind !== null} /><span>{readingKind === "textbook" ? "…" : "▤"}</span><b>{readingKind === "textbook" ? "Đang đọc SGK..." : textbookName || `Chọn SGK ${book}`}</b><small>DOCX, XLSX, PDF, TXT, CSV • Tối đa 100 MB.</small></label>
          {textbookName && <div className="ppct-file-status textbook"><span>✓</span><div><b>Đã đọc SGK</b><small>{textbookUnits} {textbookUnitLabel} • {textbookText.length.toLocaleString("vi-VN")} ký tự</small></div><button type="button" aria-label="Xóa sách giáo khoa" onClick={() => { setTextbookName(""); setTextbookText(""); setTextbookUnits(0); }}>×</button></div>}
          {textbookText && <details className="ppct-source-details"><summary>Xem nội dung SGK đã nhận diện</summary><div>{textbookText.slice(0, 12000)}</div>{textbookText.length > 12000 && <small>Đang hiển thị 12.000 ký tự đầu; hệ thống vẫn tự lọc toàn bộ phần nội dung đã nhận diện.</small>}</details>}

          <label className={`ppct-requirement-option ${rewriteRequirements ? "selected" : ""}`}>
            <input type="checkbox" checked={rewriteRequirements} onChange={(event) => setRewriteRequirements(event.target.checked)} />
            <span aria-hidden="true">{rewriteRequirements ? "✓" : ""}</span>
            <div><b>Chỉnh sửa lại Yêu cầu cần đạt</b><small>{rewriteRequirements ? "AI đối chiếu SGK, chuẩn hóa nội dung và tự xuống dòng từng yêu cầu." : "Đang tắt: giữ nguyên văn PPCT nguồn và tự xuống dòng từng yêu cầu."}</small></div>
          </label>

          <div className="ppct-mapping-flow"><div><span>1</span><b>Đọc cấu trúc PPCT</b></div><i>→</i><div><span>2</span><b>Đối chiếu SGK</b></div><i>→</i><div><span>3</span><b>Ánh xạ mã phù hợp</b></div></div>
          <div className="ppct-integrations"><div><span>▣</span><b>Mã Năng lực số phù hợp</b><small>Một hoặc nhiều mã theo yêu cầu cần đạt của từng bài</small></div><div><span>✦</span><b>Mã Trí tuệ nhân tạo phù hợp</b><small>Gắn hoạt động, sản phẩm hoặc tình huống quan sát được</small></div></div>
          <button className="ppct-generate" onClick={generate} disabled={generating || readingKind !== null}>{generating ? <><i /> Đang đối chiếu PPCT với SGK...</> : <>✦ Tạo PPCT tích hợp</>}</button>
          <p className="ppct-key-note">Tệp được đọc trực tiếp trên thiết bị; AI chỉ nhận phần văn bản phù hợp đã được lọc theo từng bài.</p>
        </aside>

        <section className="ppct-result">
          <div className="ppct-result-head"><div><span>▤</span><h2>Kết quả PPCT</h2></div>{plan && <div><button onClick={() => setEditing((value) => !value)}>{editing ? "✓ Hoàn tất" : "✎ Chỉnh sửa"}</button><button onClick={copyResult}>▣ Sao chép</button><button className="primary" onClick={downloadWord}>↓ Tải Word</button></div>}</div>
          {!plan ? <div className={`ppct-empty ${generating ? "loading" : ""}`}><span>{generating ? "✦" : "▤"}</span><b>{generating ? "Đang tạo PPCT tích hợp" : "Chưa có dữ liệu"}</b><p>{generating ? `AI đang đối chiếu SGK, ${rewriteRequirements ? "chỉnh sửa cột Yêu cầu cần đạt" : "giữ nguyên cột Yêu cầu cần đạt"} và ánh xạ mã năng lực phù hợp.` : "Tải PPCT và SGK, hoàn thành thông tin bên trái rồi nhấn “Tạo PPCT tích hợp”."}</p><div><i /> Giữ nguyên phân phối <i /> Đối chiếu SGK <i /> Mã NLS và AI theo từng bài</div></div> : <div className="ppct-preview-wrap">
            <div className="ppct-generation-chip">✦ {meta.provider.toUpperCase()} • {meta.model} • Khóa {meta.keySlot}</div>
            {editing && <p className="ppct-editing-hint">Nhấp vào nội dung trong văn bản để chỉnh sửa trực tiếp trước khi tải Word.</p>}
            <article ref={documentRef} contentEditable={editing} suppressContentEditableWarning className={`ppct-document ${editing ? "editing" : ""}`}>
              <table className="ppct-letterhead"><tbody><tr><td><span>{form.school}</span><br /><b><u>{englishOutput ? "DEPARTMENT" : "TỔ"}: {form.department.toUpperCase()}</u></b></td><td><b>{englishOutput ? "SOCIALIST REPUBLIC OF VIET NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"}</b><br /><b><u>{englishOutput ? "Independence - Freedom - Happiness" : "Độc lập - Tự do - Hạnh phúc"}</u></b><br /><i>{form.place || "Tân Ninh"}, {englishOutput ? `date ..... month ..... year ${form.schoolYear.match(/\d{4}/)?.[0] || "2026"}` : `ngày ..... tháng ..... năm ${form.schoolYear.match(/\d{4}/)?.[0] || "2026"}`}</i></td></tr></tbody></table>
              <h1 data-ppct-title>{plan.title}</h1><h2>({englishOutput ? `Textbook: ${book}${form.programOrientation ? ` – ${form.programOrientation}` : ""}` : `Bộ ${book}${form.programOrientation ? ` – ${form.programOrientation}` : ""}`})</h2>
              <p className="semester">{englishOutput ? `Semester I: ${form.semester1Weeks} weeks (${plan.semester1Periods || "....."} periods)${examWeek("I") ? ` – Final examination: week ${examWeek("I")}` : ""}` : `Học kì I: ${form.semester1Weeks} tuần (${plan.semester1Periods || "....."} tiết)${examWeek("I") ? ` – Kiểm tra cuối kì I: tuần ${examWeek("I")}` : ""}`}</p>
              <p className="semester">{englishOutput ? `Semester II: ${form.semester2Weeks} weeks (${plan.semester2Periods || "....."} periods)${examWeek("II") ? ` – Final examination: week ${examWeek("II")}` : ""}` : `Học kì II: ${form.semester2Weeks} tuần (${plan.semester2Periods || "....."} tiết)${examWeek("II") ? ` – Kiểm tra cuối kì II: tuần ${examWeek("II")}` : ""}`}</p>
              <div className="ppct-table-scroll"><table className="ppct-table ppct-main-table"><thead><tr>{(englishOutput ? ["Week", "Unit/Lesson", "Teaching period", "Number of periods", "Learning outcomes", "Teaching equipment", "Digital competence", "AI integration"] : ["Tuần", "Bài học", "Tiết dạy", "Số tiết", "Yêu cầu cần đạt", "Thiết bị dạy học", "Năng lực số", "Tích hợp AI"]).map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{plan.rows.map((row, index) => isSectionRow(row)
                ? <tr className="ppct-section-row" data-row-index={index} key={`${index}-${row.lesson}`}><td colSpan={8}>{row.lesson || row.week}</td></tr>
                : <tr data-row-index={index} key={`${index}-${row.week}-${row.teachingPeriod}`}><td>{row.week}</td><td>{row.lesson}</td><td>{row.teachingPeriod}</td><td>{row.periodCount}</td><td>{row.requirements}</td><td>{row.equipment}</td><td>{competencyContent(row.digitalCompetency)}</td><td>{competencyContent(row.aiIntegration)}</td></tr>)}</tbody></table></div>
              {plan.notes.length > 0 && <div className="ppct-notes"><b>{englishOutput ? "Notes:" : "Ghi chú:"}</b><ul>{plan.notes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
              <div className="ppct-signatures"><div><b>{englishOutput ? "HEAD OF DEPARTMENT'S APPROVAL" : "DUYỆT CỦA TỔ TRƯỞNG CHUYÊN MÔN"}</b><i>{englishOutput ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)"}</i></div><div><b>{englishOutput ? "SUBJECT TEACHER" : "GIÁO VIÊN BỘ MÔN"}</b><i>{englishOutput ? "(Signature and full name)" : "(Ký và ghi rõ họ tên)"}</i><strong>{form.teacher}</strong></div></div>
            </article>
          </div>}
        </section>
      </section>
      <footer className="planner-footer"><strong>PHÁT TRIỂN BỞI: THẦY GIÁO: TRẦN QUỐC HOÀNG ANH • ZALO: 0965653750 •</strong></footer>
      {notice && <div className="toast" role="status">ⓘ {notice}</div>}
    </main>
  );
}
