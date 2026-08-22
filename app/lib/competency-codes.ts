/**
 * Danh mục mã dùng khi AI sinh KHBD/PPCT.
 *
 * - Năng lực số: Thông tư 02/2025/TT-BGDĐT và phụ lục Công văn
 *   3456/BGDĐT-GDPT. Để không phát sinh hậu tố chỉ báo không tồn tại, AI chỉ
 *   được sinh chỉ báo `a` đã được xác nhận ở mọi năng lực thành phần. Tệp PPCT
 *   giáo viên tải lên vẫn được đọc các hậu tố a-d ở đúng mức của khối lớp.
 * - Năng lực AI: danh mục đầy đủ theo từng lớp trong Quyết định
 *   2422/QĐ-BGDĐT ngày 18/08/2026. Không suy diễn mã bằng cách thay số lớp.
 */

export const DIGITAL_COMPONENTS = [
  ["1.1", "Duyệt, tìm kiếm và lọc dữ liệu, thông tin và nội dung số"],
  ["1.2", "Đánh giá dữ liệu, thông tin và nội dung số"],
  ["1.3", "Quản lí dữ liệu, thông tin và nội dung số"],
  ["2.1", "Tương tác thông qua công nghệ số"],
  ["2.2", "Chia sẻ thông qua công nghệ số"],
  ["2.3", "Sử dụng công nghệ số để thực hiện trách nhiệm công dân"],
  ["2.4", "Hợp tác thông qua công nghệ số"],
  ["2.5", "Quy tắc ứng xử trên mạng"],
  ["2.6", "Quản lí danh tính số"],
  ["3.1", "Phát triển nội dung số"],
  ["3.2", "Tích hợp và tạo lập lại nội dung số"],
  ["3.3", "Thực thi bản quyền và giấy phép"],
  ["3.4", "Lập trình"],
  ["4.1", "Bảo vệ thiết bị"],
  ["4.2", "Bảo vệ dữ liệu cá nhân và quyền riêng tư"],
  ["4.3", "Bảo vệ sức khỏe và an sinh số"],
  ["4.4", "Bảo vệ môi trường"],
  ["5.1", "Giải quyết vấn đề kĩ thuật"],
  ["5.2", "Xác định nhu cầu và giải pháp công nghệ"],
  ["5.3", "Sử dụng sáng tạo công nghệ số"],
  ["5.4", "Xác định khoảng trống năng lực số"],
  ["6.1", "Hiểu biết về trí tuệ nhân tạo"],
  ["6.2", "Sử dụng trí tuệ nhân tạo"],
  ["6.3", "Đánh giá trí tuệ nhân tạo"],
] as const;

export const AI_TOPIC_NAMES: Record<string, string> = {
  A1: "Tính chủ động của con người",
  A2: "AI vì sự tiến bộ của con người",
  A3: "Công dân trong kỉ nguyên AI",
  B1: "Các khía cạnh đạo đức của AI",
  B2: "Sử dụng AI an toàn và có trách nhiệm",
  B3: "Nguyên tắc đạo đức và trách nhiệm xã hội",
  C1: "Đặc điểm chính của AI",
  C2: "Ứng dụng AI trong học tập và cuộc sống",
  C3: "Công nghệ AI",
  C4: "Dữ liệu trong AI",
  C5: "Kĩ thuật và thuật toán AI",
  D1: "Nhận diện và hình thành giải pháp",
  D2: "Cấu trúc, tương tác và cải tiến hệ thống",
};

const AI_CODES_BY_GRADE: Record<number, string> = {
  1: "1.A1.1 1.A1.2 1.A1.3 1.A1.4 1.A2.1 1.A2.2 1.A2.3 1.A2.MR1 1.B1.1 1.B3.1 1.B3.2 1.C1.1 1.C1.2 1.C1.3 1.C1.4 1.C1.MR1 1.C1.MR2 1.D1.1 1.D1.MR1 1.D2.1 1.D2.2",
  2: "2.A1.1 2.A1.2 2.A1.3 2.A1.4 2.A2.1 2.A2.2 2.A2.MR1 2.A2.MR2 2.A2.MR3 2.A3.1 2.A3.MR1 2.B1.1 2.B1.MR1 2.B1.MR2 2.B3.1 2.B3.2 2.B3.MR1 2.B3.MR2 2.C1.1 2.C1.MR1 2.C3.1 2.C3.2 2.C3.MR1 2.D1.1 2.D1.2 2.D1.MR1 2.D2.1 2.D2.2 2.D2.MR1",
  3: "3.A1.1 3.A1.2 3.A1.3 3.A1.4 3.A1.5 3.A1.MR1 3.A1.MR2 3.A1.MR3 3.A2.1 3.A2.2 3.A2.3 3.A2.MR1 3.A2.MR2 3.A2.MR3 3.A3.1 3.A3.2 3.B2.1 3.B3.1 3.B3.MR1 3.C4.1 3.C4.MR1 3.C5.1 3.C5.2 3.C5.3 3.C5.4 3.C5.MR1 3.C5.MR2 3.D1.1 3.D2.1 3.D2.2 3.D2.3 3.D2.MR1",
  4: "4.A1.1 4.A1.2 4.A1.MR1 4.A2.1 4.A2.2 4.A3.1 4.A3.MR1 4.B2.1 4.B2.2 4.B2.MR1 4.C2.1 4.C2.MR1 4.C5.MR1 4.C5.MR2 4.D1.1 4.D1.MR1 4.D2.1",
  5: "5.A1.1 5.A1.2 5.A1.MR1 5.A2.1 5.A2.2 5.A2.3 5.A2.MR1 5.A3.1 5.A3.2 5.A3.MR1 5.B1.1 5.B1.2 5.B2.1 5.B2.MR1 5.B3.1 5.C5.1 5.C5.2 5.C5.MR1 5.C5.MR2 5.C5.MR3 5.D1.1 5.D1.MR1 5.D2.1 5.D2.MR1",
  6: "6.A1.1 6.A1.2 6.A1.3 6.A3.1 6.A3.2 6.A3.3 6.A3.4 6.B1.1 6.B2.1 6.C1.1 6.C1.2 6.C1.MR1 6.C1.MR2 6.C1.MR3 6.C2.1 6.C2.2 6.C2.MR1 6.C3.1 6.C3.MR1 6.D1.1 6.D1.MR1 6.D2.1 6.D2.MR1 6.D2.MR2",
  7: "7.A1.1 7.A1.2 7.A1.MR1 7.A2.1 7.A2.2 7.A3.1 7.A3.2 7.A3.MR1 7.A3.MR2 7.B2.1 7.B2.2 7.B3.1 7.C4.1 7.C4.MR1 7.C5.1 7.C5.2 7.C5.MR1 7.D1.1 7.D1.MR1 7.D2.1 7.D2.MR1",
  8: "8.A1.1 8.A1.2 8.A2.1 8.A2.2 8.A3.1 8.A3.2 8.A3.3 8.A3.MR1 8.A3.MR2 8.B1.1 8.B2.1 8.B3.1 8.C1.1 8.C1.MR1 8.C5.1 8.C5.MR1 8.D1.1 8.D1.MR1 8.D2.1 8.D2.MR1 8.D2.MR2",
  9: "9.A1.1 9.A2.1 9.A2.2 9.A3.1 9.A3.2 9.A3.3 9.A3.4 9.B2.1 9.B2.2 9.B2.3 9.B3.1 9.B3.2 9.C2.1 9.C2.MR1 9.C4.1 9.C4.MR1 9.C4.MR2 9.D1.1 9.D1.MR1 9.D2.1 9.D2.MR1 9.D2.MR2",
  10: "10.A1.1 10.A1.2 10.A2.1 10.A2.MR1 10.A3.1 10.B2.1 10.B2.MR1 10.B3.1 10.C2.1 10.C2.2 10.C2.3 10.C2.MR1 10.C2.MR2 10.C3.1 10.C3.2 10.C3.3 10.C3.MR1 10.C4.1 10.C4.MR1 10.D1.1 10.D2.1 10.D2.2",
  11: "11.A1.1 11.A1.2 11.A2.1 11.A2.2 11.A3.1 11.A3.MR1 11.B2.1 11.B3.MR1 11.C2.1 11.C2.2 11.C2.MR1 11.C3.1 11.C3.2 11.C3.MR1 11.C3.MR2 11.C3.MR3 11.C3.MR4 11.C5.1 11.C5.2 11.C5.MR1 11.C5.MR2 11.D1.1 11.D2.1 11.D2.MR1",
  12: "12.A1.1 12.A1.2 12.A1.3 12.A1.MR1 12.A2.1 12.A2.MR1 12.A3.1 12.B1.MR1 12.B2.1 12.B3.1 12.C2.1 12.C2.MR1 12.C3.1 12.C3.2 12.C3.MR1 12.C3.MR2 12.C3.MR3 12.C4.MR1 12.C4.MR2 12.D1.1 12.D1.MR1 12.D2.1 12.D2.MR1 12.D2.MR2 12.D2.MR3",
};

export function gradeNumber(value?: string | number) {
  return Math.min(12, Math.max(1, Number(value) || 10));
}

export function digitalLevelForGrade(value?: string | number) {
  const grade = gradeNumber(value);
  if (grade <= 3) return "CB1";
  if (grade <= 5) return "CB2";
  if (grade <= 7) return "TC1";
  if (grade <= 9) return "TC2";
  return "NC1";
}

export function generatedDigitalCodesForGrade(value?: string | number) {
  const level = digitalLevelForGrade(value);
  return DIGITAL_COMPONENTS.map(([component]) => `${component}.${level}a`);
}

export function digitalPromptCatalogForGrade(value?: string | number) {
  const level = digitalLevelForGrade(value);
  return DIGITAL_COMPONENTS.map(([component, name]) => `${component}.${level}a (${name})`).join("; ");
}

export function normalizeDigitalCode(value: string) {
  const match = value.trim().match(/^((?:1\.[123]|2\.[1-6]|3\.[1-4]|4\.[1-4]|5\.[1-4]|6\.[1-3]))\.((?:CB|TC|NC)\d)([a-d])$/i);
  return match ? `${match[1]}.${match[2].toUpperCase()}${match[3].toLowerCase()}` : "";
}

export function isGeneratedDigitalCode(value: string, grade?: string | number) {
  const normalized = normalizeDigitalCode(value);
  return generatedDigitalCodesForGrade(grade).includes(normalized);
}

export function isGradeCompatibleDigitalCode(value: string, grade?: string | number) {
  const normalized = normalizeDigitalCode(value);
  return Boolean(normalized) && normalized.includes(`.${digitalLevelForGrade(grade)}`);
}

export function aiCodesForGrade(value?: string | number) {
  return AI_CODES_BY_GRADE[gradeNumber(value)].split(/\s+/).filter(Boolean);
}

export function isOfficialAiCode(value: string, grade?: string | number) {
  return aiCodesForGrade(grade).includes(value.trim().toUpperCase());
}

export function aiPromptCatalogForGrade(value?: string | number) {
  const topics = [...new Set(aiCodesForGrade(value).map((code) => code.split(".")[1]))];
  const topicLegend = topics.map((topic) => `${topic}=${AI_TOPIC_NAMES[topic] || topic}`).join("; ");
  return `${aiCodesForGrade(value).join(", ")}. Chủ đề: ${topicLegend}`;
}

export function chooseOfficialAiCode(value: string, grade?: string | number) {
  const codes = aiCodesForGrade(grade);
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const topics = /dao duc|ban quyen|du lieu ca nhan|quyen rieng|an toan|thien lech|gia mao/.test(normalized)
    ? ["B2", "B1", "B3"]
    : /thiet ke|he thong|san pham|du an|giai phap/.test(normalized)
      ? ["D1", "D2"]
      : /du lieu|nguon|chat luong|kiem chung|phan loai|du doan/.test(normalized)
        ? ["C4", "C5", "C1", "C2"]
        : /cau lenh|prompt|cong cu|ung dung|hoc tap/.test(normalized)
          ? ["C2", "C3", "C5", "C1"]
          : ["A1", "A2", "A3", "C2", "C1", "D1"];
  for (const topic of topics) {
    const core = codes.find((code) => code.includes(`.${topic}.`) && !code.includes(".MR"));
    if (core) return core;
    const extended = codes.find((code) => code.includes(`.${topic}.`));
    if (extended) return extended;
  }
  return codes.find((code) => !code.includes(".MR")) || codes[0];
}
