import { ensureAuthSchema, hashPassword } from "@/app/lib/auth";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string; fullName?: string; phone?: string; school?: string; department?: string };
    const username = (body.username || "").trim().toLowerCase(); const fullName = (body.fullName || "").trim(); const phone = (body.phone || "").trim(); const school = (body.school || "").trim(); const department = (body.department || "").trim(); const password = body.password || "";
    if (!/^[a-z0-9._-]{4,32}$/.test(username)) return Response.json({ error: "Tên tài khoản gồm 4–32 ký tự không dấu: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới." }, { status: 400 });
    if (fullName.length < 3) return Response.json({ error: "Vui lòng nhập đầy đủ họ và tên." }, { status: 400 });
    if (school.length < 3) return Response.json({ error: "Vui lòng nhập tên Trường học/Đơn vị công tác." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Mật khẩu phải có ít nhất 8 ký tự." }, { status: 400 });
    const d = await ensureAuthSchema();
    const existing = await d.prepare("SELECT id FROM users WHERE username=? LIMIT 1").bind(username).first();
    if (existing) return Response.json({ error: "Tên tài khoản đã được sử dụng. Vui lòng chọn tên khác." }, { status: 409 });
    const credential = await hashPassword(password);
    await d.prepare("INSERT INTO users (id,username,full_name,phone,school,department,password_hash,password_salt,role,status,must_change_password,plan,khbd_used,ppct_used,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), username, fullName, phone, school, department, credential.hash, credential.salt, "user", "active", 0, "free", 0, 0, new Date().toISOString()).run();
    return Response.json({ ok: true, message: "Đăng ký thành công. Thầy/Cô có 5 lượt tạo KHBD và 5 lượt tạo PPCT miễn phí." });
  } catch (error) {
    console.error("Không thể đăng ký tài khoản:", error);
    return Response.json({ error: /unique|constraint failed.*username/i.test(String(error)) ? "Tên tài khoản đã được sử dụng. Vui lòng chọn tên khác." : "Chưa thể đăng ký tài khoản. Vui lòng thử lại sau." }, { status: 400 });
  }
}
