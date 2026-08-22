import { createSession, ensureAuthSchema, hashPassword } from "@/app/lib/auth";
export async function POST(request: Request) {
  const body = await request.json() as { username?: string; password?: string }; const username = (body.username || "").trim().toLowerCase();
  const d = await ensureAuthSchema();
  const row = await d.prepare("SELECT id,password_hash passwordHash,password_salt passwordSalt,status FROM users WHERE username=? LIMIT 1").bind(username).first<{ id:string; passwordHash:string; passwordSalt:string; status:string }>();
  if (!row || (await hashPassword(body.password || "", row.passwordSalt)).hash !== row.passwordHash) return Response.json({ error: "Tên tài khoản hoặc mật khẩu không đúng." }, { status: 401 });
  if (row.status === "pending") return Response.json({ error: "Tài khoản đang chờ quản trị viên kích hoạt." }, { status: 403 });
  if (row.status !== "active") return Response.json({ error: "Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ." }, { status: 403 });
  await createSession(row.id); return Response.json({ ok: true });
}
