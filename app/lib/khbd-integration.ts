export type IntegrationBlock = {
  digitalCode: string;
  aiCode: string;
  manifestation: string;
  teacherGuidance: string[];
  studentActions: string[];
  digitalProduct: string[];
  criteria: string;
  digitalAchieved: string;
  aiAchieved: string;
  behaviour: string;
  ethicsNote: string;
};

export type IntegrationPlanRow = {
  activity: string;
  content: string;
  digitalCode: string;
  aiCode: string;
  product: string;
  ethicsNote: string;
};

export const integrationLabels = {
  vi: {
    part1: "Phần 1. Bảng định hướng tích hợp",
    part2: "Phần 2. Giáo án đã chèn tích hợp hoàn chỉnh",
    columns: ["Hoạt động", "Nội dung tích hợp", "Mã NLS", "Mã AI (nếu có)", "Sản phẩm dự kiến", "Lưu ý đạo đức số / đạo đức AI"],
    blockIntegration: "🔴 [Tích hợp NLS & AI]",
    blockTeacher: "🔴 [Giáo viên hướng dẫn]",
    blockStudent: "🔴 [Học sinh thực hiện]",
    blockProduct: "🔴 [Sản phẩm số hoặc sản phẩm AI]",
    blockAssessment: "🔴 [Đánh giá]",
    digital: "NLS",
    ai: "AI",
    manifestation: "Biểu hiện",
    criteria: "Tiêu chí",
    digitalAchieved: "Đạt NLS",
    aiAchieved: "Đạt NL AI",
    behaviour: "Hành vi đánh giá",
    ethics: "Lưu ý đạo đức",
    noAi: "(Không ép tích hợp AI vì hoạt động này không phát sinh hành vi sử dụng AI)",
    noDigital: "(Không ép tích hợp năng lực số vì hoạt động này không phát sinh hành vi số)",
  },
  en: {
    part1: "Part 1. Integration orientation table",
    part2: "Part 2. Complete lesson plan with integration inserted",
    columns: ["Activity", "Integrated content", "Digital competence code", "AI code (if any)", "Expected product", "Digital/AI ethics note"],
    blockIntegration: "🔴 [Digital & AI competence integration]",
    blockTeacher: "🔴 [Teacher guidance]",
    blockStudent: "🔴 [Learner actions]",
    blockProduct: "🔴 [Digital or AI product]",
    blockAssessment: "🔴 [Assessment]",
    digital: "Digital",
    ai: "AI",
    manifestation: "Observable behaviour",
    criteria: "Criteria",
    digitalAchieved: "Digital competence attained",
    aiAchieved: "AI competence attained",
    behaviour: "Assessed behaviour",
    ethics: "Ethics note",
    noAi: "(No forced AI integration: this activity does not involve AI use)",
    noDigital: "(No forced digital integration: this activity does not involve digital behaviour)",
  },
} as const;

export function integrationText(english: boolean) {
  return english ? integrationLabels.en : integrationLabels.vi;
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

export function normalizeIntegrationBlock(value: unknown): IntegrationBlock | null {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!source) return null;
  const block: IntegrationBlock = {
    digitalCode: String(source.digitalCode || "").trim(),
    aiCode: String(source.aiCode || "").trim(),
    manifestation: String(source.manifestation || "").trim(),
    teacherGuidance: textList(source.teacherGuidance),
    studentActions: textList(source.studentActions),
    digitalProduct: textList(source.digitalProduct),
    criteria: String(source.criteria || "").trim(),
    digitalAchieved: String(source.digitalAchieved || "").trim(),
    aiAchieved: String(source.aiAchieved || "").trim(),
    behaviour: String(source.behaviour || "").trim(),
    ethicsNote: String(source.ethicsNote || "").trim(),
  };
  const hasContent = block.digitalCode || block.aiCode || block.manifestation || block.teacherGuidance.length || block.studentActions.length;
  return hasContent ? block : null;
}

/**
 * Fill every empty field of a block so the rendered result always carries the five
 * sections of the reference standard, even when the model returns a partial block.
 */
export function completeIntegrationBlock(block: Partial<IntegrationBlock>, context: {
  english: boolean;
  digitalCode?: string;
  digitalIndicator?: string;
  aiCode?: string;
  aiIndicator?: string;
  activityTitle: string;
  product?: string;
}): IntegrationBlock {
  const text = integrationText(context.english);
  const digitalCode = String(block.digitalCode || context.digitalCode || "").trim();
  const aiCode = String(block.aiCode || context.aiCode || "").trim();
  const digitalIndicator = String(context.digitalIndicator || "").trim();
  const aiIndicator = String(context.aiIndicator || "").trim();
  const focus = digitalIndicator || aiIndicator || context.activityTitle;
  const teacherGuidance = textList(block.teacherGuidance);
  const studentActions = textList(block.studentActions);
  const digitalProduct = textList(block.digitalProduct);
  return {
    digitalCode: digitalCode || text.noDigital,
    aiCode: aiCode || text.noAi,
    manifestation: String(block.manifestation || "").trim() || (context.english
      ? `Learners carry out a real digital or AI action while working on “${context.activityTitle}”: ${focus}. They check the result against the lesson source before using it.`
      : `Học sinh thực hiện một hành vi số hoặc hành vi AI có thật khi làm nhiệm vụ “${context.activityTitle}”: ${focus}. Học sinh đối chiếu kết quả với nguồn học liệu của bài trước khi sử dụng.`),
    teacherGuidance: teacherGuidance.length ? teacherGuidance : (context.english ? [
      `The teacher assigns the digital task attached to “${context.activityTitle}” and states the tool, the input and the product to submit.`,
      "The teacher reminds learners not to enter real personal data into any online tool or AI chat window.",
      "The teacher requires learners to verify the result against the textbook or the lesson materials before reporting it.",
      "The teacher comments on the reported results and corrects any inaccurate output.",
    ] : [
      `Giáo viên giao nhiệm vụ số gắn với “${context.activityTitle}”, nêu rõ công cụ, dữ liệu đầu vào và sản phẩm phải nộp.`,
      "Giáo viên nhắc học sinh tuyệt đối không nhập thông tin cá nhân thật vào công cụ trực tuyến hoặc cửa sổ chat AI.",
      "Giáo viên yêu cầu học sinh kiểm chứng kết quả với sách giáo khoa hoặc học liệu của bài trước khi báo cáo.",
      "Giáo viên nhận xét kết quả báo cáo và điều chỉnh nếu công cụ đưa ra nội dung sai lệch.",
    ]),
    studentActions: studentActions.length ? studentActions : (context.english ? [
      "Learners access the assigned digital tool on a phone or computer.",
      "Learners enter the prompt or the data and wait for the result.",
      "Learners record the result and compare it with the lesson content to judge whether it is sound.",
      "Learners report to the class, stating what they used and why the result is correct or incorrect.",
    ] : [
      "Học sinh truy cập công cụ số đã được giao trên điện thoại hoặc máy tính.",
      "Học sinh nhập câu lệnh hoặc dữ liệu và chờ kết quả trả về.",
      "Học sinh ghi lại kết quả, so sánh với nội dung bài học để đánh giá tính hợp lí.",
      "Học sinh trình bày trước lớp: đã dùng công cụ gì và vì sao kết quả đó đúng hoặc sai.",
    ]),
    digitalProduct: digitalProduct.length ? digitalProduct : [context.product?.trim() || (context.english
      ? "The prompt or the digital operation performed by learners together with the verified result recorded in their notebook."
      : "Câu lệnh (prompt) hoặc thao tác số của học sinh kèm kết quả đã được kiểm chứng, ghi lại trong vở.")],
    criteria: String(block.criteria || "").trim() || (context.english
      ? "The digital action is performed correctly and the result matches the lesson content."
      : "Thực hiện đúng thao tác số và kết quả bám đúng nội dung bài học."),
    digitalAchieved: String(block.digitalAchieved || "").trim() || (digitalCode
      ? (digitalIndicator || (context.english ? "Uses the digital tool appropriately to serve learning." : "Sử dụng được công cụ số phù hợp để phục vụ học tập."))
      : ""),
    aiAchieved: String(block.aiAchieved || "").trim() || (aiCode
      ? (aiIndicator || (context.english ? "Questions and verifies AI output instead of accepting it as given." : "Biết nghi ngờ và kiểm chứng kết quả do AI tạo ra thay vì chấp nhận ngay."))
      : ""),
    behaviour: String(block.behaviour || "").trim() || (context.english
      ? "Learners explain the result in their own words and justify it from the lesson source instead of reading the tool output verbatim."
      : "Học sinh giải thích kết quả bằng lời của mình và dẫn được căn cứ từ học liệu của bài, không đọc vẹt nguyên văn kết quả của công cụ."),
    ethicsNote: String(block.ethicsNote || "").trim() || (context.english
      ? "Do not enter real personal data. Treat the lesson source as the yardstick for verification and keep the final decision with the learner."
      : "Không nhập thông tin cá nhân thật. Luôn coi học liệu của bài là thước đo kiểm chứng và giữ quyền quyết định cuối cùng cho con người."),
  };
}

/** The block rendered as plain lines, in the layout of the reference documents. */
export function integrationBlockLines(block: IntegrationBlock, english: boolean) {
  const text = integrationText(english);
  const lines = [
    text.blockIntegration,
    `● ${text.digital}: ${block.digitalCode}`,
    `● ${text.ai}: ${block.aiCode}`,
    `● ${text.manifestation}: ${block.manifestation}`,
    text.blockTeacher,
    ...block.teacherGuidance.map((item) => `● ${item}`),
    text.blockStudent,
    ...block.studentActions.map((item) => `● ${item}`),
    text.blockProduct,
    ...block.digitalProduct.map((item) => `● ${item}`),
    text.blockAssessment,
    `● ${text.criteria}: ${block.criteria}`,
  ];
  if (block.digitalAchieved) lines.push(`● ${text.digitalAchieved}: ${block.digitalAchieved}`);
  if (block.aiAchieved) lines.push(`● ${text.aiAchieved}: ${block.aiAchieved}`);
  lines.push(`● ${text.behaviour}: ${block.behaviour}`);
  return lines;
}
