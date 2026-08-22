export type KhbdRequestLike = {
  task?: "lesson" | "ppct";
  form?: {
    level?: string;
    subject?: string;
    grade?: string;
    title?: string;
    periods?: string;
    book?: string;
    core?: string;
    columns?: string;
    template?: string;
    ppctIntegrationText?: string;
    sourceMaterials?: Array<{ name?: string; kind?: string; text?: string; structure?: string }>;
  };
  options?: string[];
  [key: string]: unknown;
};

const OPTION_RULES: Record<string, string> = {
  digital: "Năng lực số chỉ được tích hợp khi HS thực hiện hành vi số thực tế. Ưu tiên mã từ PPCT tích hợp đúng bài; nếu không có mới chọn mã phù hợp lớp. Không coi việc GV trình chiếu là minh chứng năng lực số. Mỗi mã phải thành một nhiệm vụ riêng tại Bước 1 - GV chuyển giao nhiệm vụ của một hoạt động riêng; không ghép nhiều mã trong một tiêu đề, một đoạn hoặc một hoạt động.",
  aiEducation: "Giáo dục AI phải theo chu trình: sử dụng/nhận biết AI -> kiểm chứng bằng nguồn hoặc minh chứng bài học -> đánh giá -> chỉnh sửa/kết luận. Không chấp nhận nhiệm vụ kiểu hỏi AI rồi chép. Ưu tiên mã từ PPCT tích hợp đúng bài. Mỗi mã AI phải thành một nhiệm vụ riêng tại Bước 1 của một hoạt động riêng; tuyệt đối không viết nhiều mã chung trong ngoặc hoặc gộp biểu hiện của nhiều mã.",
  defense: "Chỉ tích hợp GDQP-AN khi có liên hệ tự nhiên với nội dung bài; nếu không phù hợp thì không ép tích hợp và phải giữ trọng tâm môn học.",
  inclusive: "Đề xuất hỗ trợ sư phạm theo hướng UDL, không chẩn đoán. Chỉ điều chỉnh cách tiếp cận, phương tiện, thời gian hoặc hình thức trả lời nhưng giữ mục tiêu cốt lõi.",
  warmup: "Khởi động phải ngắn, kích hoạt kiến thức nền và dẫn trực tiếp vào nội dung bài; không tạo trò chơi chỉ để giải trí.",
  questions: "Củng cố phải có câu hỏi/đáp án hoặc sản phẩm kiểm tra nhanh bám đúng nội dung đã học, không hỏi ngoài bài.",
  active: "Chỉ nêu phương pháp/kĩ thuật thực sự được dùng trong tiến trình; hoạt động phải thể hiện đúng phương pháp đã nêu.",
  timeline: "Phân bổ thời gian phải nhất quán với tổng số tiết; không để tổng thời lượng hoạt động vượt hoặc thiếu đáng kể so với thời lượng bài.",
  mindmap: "Sơ đồ/infographic phải là đặc tả nội dung cụ thể, có chủ đề trung tâm và nhánh/khối thông tin đúng kiến thức bài; không dùng sơ đồ ASCII làm sản phẩm cuối.",
  stem: "Chỉ áp dụng STEM khi bài thực sự có vấn đề, thiết kế, thử nghiệm hoặc sản phẩm. Nếu không phù hợp thì không ép STEM.",
  game: "Trò chơi phải có tên, mục tiêu, thời gian, cách tổ chức, luật, nội dung câu hỏi/nhiệm vụ, đáp án và cách tính điểm; phải phục vụ YCCĐ.",
  slides: "Kịch bản slide phải ngắn gọn, 1 slide = 1 ý lớn, bám tiến trình KHBD; không chép nguyên giáo án lên slide.",
};

export function buildKhbdMegaInstruction(body: KhbdRequestLike) {
  if (body.task === "ppct") return "";
  const options = Array.isArray(body.options) ? body.options : [];
  const selectedRules = options.map((id) => OPTION_RULES[id]).filter(Boolean);
  return [
    "CHỈ DẪN CHẤT LƯỢNG KHBD CẤP HỆ THỐNG:",
    "1. Ưu tiên nguồn theo thứ tự: PPCT/YCCĐ giáo viên cung cấp -> SGK đúng bài -> KHBD cũ đúng bài -> học liệu tham khảo -> kiến thức chương trình. Không trộn nội dung của bài khác.",
    "2. Trước khi viết, phải ngầm lập ma trận truy vết YCCĐ -> mục tiêu -> hoạt động -> nhiệm vụ -> sản phẩm -> đánh giá. Mọi mục tiêu phải xuất hiện trong hoạt động và mọi hoạt động phải phục vụ mục tiêu.",
    "3. Nếu không có KHBD cũ, dùng SGK/YCCĐ/PPCT đúng bài để hình thành nội dung. Sản phẩm dự kiến phải là kiến thức hoặc sản phẩm kiểm tra được, ví dụ bảng so sánh, sơ đồ, công thức, kết luận, đoạn văn, đoạn hội thoại, mã nguồn, phiếu học tập có nội dung cụ thể; không dùng các câu chung chung như 'HS trả lời', 'HS thảo luận', 'HS hoàn thành nhiệm vụ'.",
    "4. Mỗi hoạt động có đủ: a) Mục tiêu; b) Nội dung; c) Sản phẩm; d) Tổ chức thực hiện với 4 bước: Chuyển giao - Thực hiện - Báo cáo/thảo luận - Kết luận/nhận định.",
    "5. Bước 1 phải ghi rõ GV giao nhiệm vụ gì, câu hỏi/câu lệnh nào, tài liệu/công cụ nào, hình thức tổ chức, thời gian và sản phẩm cần nộp. Bước 4 phải ghi rõ nội dung kiến thức được chốt, không chỉ viết 'GV chốt kiến thức'.",
    "6. Không bịa trang SGK, tác giả, YCCĐ, số tiết PPCT, mã năng lực số, mã AI, số liệu, thí nghiệm hoặc văn bản pháp lý. Nếu nguồn không đủ chắc chắn, giữ nội dung ở mức có thể xác minh từ dữ liệu đầu vào.",
    "7. Chỉ đưa vào KHBD các tùy chọn nâng cao đã được người dùng bật; không tự thêm module chưa chọn.",
    "8. Với bố cục 2 cột, cột 'Sản phẩm dự kiến' phải chứa nội dung/kết quả cụ thể chứ không chỉ tên sản phẩm. Với 3 cột, tách rõ hoạt động GV - HS - sản phẩm. Với 1 cột, trình bày tuần tự nhưng vẫn đủ 4 bước.",
    "9. Ưu tiên tính khả thi trong lớp học thực tế, không làm bài dạy quá tải và không biến nội dung tích hợp thành phần trang trí.",
    ...selectedRules.map((rule, index) => `${10 + index}. ${rule}`),
  ].join("\n");
}

export type QualityIssue = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
};

function textArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

export function validateKhbdPlan(plan: unknown, body: KhbdRequestLike) {
  const issues: QualityIssue[] = [];
  const data = plan && typeof plan === "object" ? plan as Record<string, unknown> : {};
  const activities = Array.isArray(data.activities) ? data.activities as Array<Record<string, unknown>> : [];
  if (activities.length < 4) issues.push({ code: "MISSING_ACTIVITIES", severity: "high", message: "KHBD chưa đủ tối thiểu 4 hoạt động cốt lõi." });

  const genericProduct = /^(?:hs\s+)?(?:trả lời|thảo luận|hoàn thành(?: nhiệm vụ)?|phiếu học tập|sản phẩm(?: của học sinh)?)[.!]?$/i;
  for (const [index, activity] of activities.entries()) {
    const product = String(activity.product || "").trim();
    if (!product || genericProduct.test(product)) issues.push({ code: "GENERIC_PRODUCT", severity: "high", message: `Hoạt động ${index + 1} có Sản phẩm dự kiến quá chung chung.` });
    const procedure = Array.isArray(activity.procedure) ? activity.procedure as Array<Record<string, unknown>> : [];
    if (procedure.length < 4) issues.push({ code: "INCOMPLETE_PROCEDURE", severity: "high", message: `Hoạt động ${index + 1} chưa đủ 4 bước tổ chức thực hiện.` });
    const conclusion = procedure[3];
    const conclusionText = `${String(conclusion?.teacher || "")} ${String(conclusion?.product || "")}`.trim();
    if (conclusion && /(?:chốt kiến thức|kết luận|nhận xét)\.?$/i.test(conclusionText) && conclusionText.length < 90) {
      issues.push({ code: "VAGUE_CONCLUSION", severity: "medium", message: `Hoạt động ${index + 1} chưa nêu rõ nội dung kiến thức cần chốt.` });
    }
  }

  const options = new Set(Array.isArray(body.options) ? body.options : []);
  const digital = textArray(data.digitalCompetencyIndicators);
  const ai = textArray(data.aiCompetencyIndicators);
  if (options.has("digital") && !Array.isArray(data.digitalCompetencyIndicators)) issues.push({ code: "DIGITAL_MISSING", severity: "high", message: "Đã chọn Năng lực số nhưng đầu ra chưa có dữ liệu chỉ báo NLS." });
  if (options.has("aiEducation") && !Array.isArray(data.aiCompetencyIndicators)) issues.push({ code: "AI_MISSING", severity: "high", message: "Đã chọn Năng lực AI nhưng đầu ra chưa có dữ liệu chỉ báo AI." });
  if (!options.has("digital") && digital.length) issues.push({ code: "DIGITAL_UNSELECTED", severity: "medium", message: "Có nội dung NLS dù người dùng không chọn tùy chọn này." });
  if (!options.has("aiEducation") && ai.length) issues.push({ code: "AI_UNSELECTED", severity: "medium", message: "Có nội dung AI dù người dùng không chọn tùy chọn này." });

  const high = issues.filter((issue) => issue.severity === "high").length;
  const medium = issues.filter((issue) => issue.severity === "medium").length;
  const low = issues.filter((issue) => issue.severity === "low").length;
  const score = Math.max(0, 100 - high * 15 - medium * 7 - low * 2);
  return {
    score,
    valid: high === 0 && score >= 90,
    needsReview: high > 0 || score < 90,
    issues,
  };
}
