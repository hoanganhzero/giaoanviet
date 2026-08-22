import { cookies } from "next/headers";

type Prepared = { bind(...values: unknown[]): Prepared; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<{ meta?: { changes?: number } }> };
type D1 = { prepare(sql: string): Prepared; batch(items: Prepared[]): Promise<unknown> };
export type AuthUser = { id: string; username: string; fullName: string; phone: string; school: string; department: string; role: "admin" | "user"; status: "pending" | "active" | "disabled"; mustChangePassword: boolean; plan: "free" | "unlimited"; khbdUsed: number; ppctUsed: number };
const COOKIE = "giao_an_session";
const PBKDF2_ITERATIONS = 100_000;

async function runtimeEnv() { return (await import("cloudflare:workers")).env as unknown as { DB?: D1; ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string; ADMIN_FULL_NAME?: string; ADMIN_PHONE?: string }; }
async function db(): Promise<D1> {
  const binding = (await runtimeEnv()).DB;
  if (!binding) throw new Error("Cơ sở dữ liệu tài khoản chưa được cấu hình.");
  return binding;
}

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (length = 32) => { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return bytesToHex(bytes); };
async function sha256(value: string) { return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { salt, hash: bytesToHex(new Uint8Array(bits)) };
}

export async function ensureAuthSchema() {
  const d = await db();
  await d.batch([
    d.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, full_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','disabled')), must_change_password INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, approved_at TEXT)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    d.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS only_one_admin ON users(role) WHERE role = 'admin'`),
    d.prepare(`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)`),
  ]);
  const columns = await d.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const additions = [
    ["school", "ALTER TABLE users ADD COLUMN school TEXT NOT NULL DEFAULT ''"],
    ["department", "ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT ''"],
    ["plan", "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"],
    ["khbd_used", "ALTER TABLE users ADD COLUMN khbd_used INTEGER NOT NULL DEFAULT 0"],
    ["ppct_used", "ALTER TABLE users ADD COLUMN ppct_used INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [name, sql] of additions) {
    if (existing.has(name)) continue;
    try {
      await d.prepare(sql).run();
    } catch (error) {
      if (!/duplicate column/i.test(String(error))) throw error;
    }
  }
  const settings = await runtimeEnv();
  if (settings.ADMIN_USERNAME && settings.ADMIN_PASSWORD) {
    const exists = await d.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
    if (!exists) {
      const credential = await hashPassword(settings.ADMIN_PASSWORD);
      await d.prepare("INSERT INTO users (id,username,full_name,phone,password_hash,password_salt,role,status,must_change_password,plan,created_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), settings.ADMIN_USERNAME.trim().toLowerCase(), settings.ADMIN_FULL_NAME || "Trần Quốc Hoàng Anh", settings.ADMIN_PHONE || "0965653750", credential.hash, credential.salt, "admin", "active", 1, "unlimited", new Date().toISOString(), new Date().toISOString()).run();
    }
    await d.prepare("UPDATE users SET plan='unlimited' WHERE role='admin'").run();
  }
  return d;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const d = await ensureAuthSchema();
  const row = await d.prepare(`SELECT u.id,u.username,u.full_name fullName,u.phone,u.school,u.department,u.role,u.status,u.must_change_password mustChangePassword,u.plan,u.khbd_used khbdUsed,u.ppct_used ppctUsed FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(await sha256(token), new Date().toISOString()).first<Omit<AuthUser, "mustChangePassword"> & { mustChangePassword: number }>();
  if (!row || row.status !== "active") return null;
  return { ...row, mustChangePassword: Boolean(row.mustChangePassword) };
}

export async function requireApiUser(admin = false) {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: Response.json({ error: "Vui lòng đăng nhập bằng tài khoản đã được kích hoạt." }, { status: 401 }) };
  if (admin && user.role !== "admin") return { user: null, response: Response.json({ error: "Chỉ quản trị viên được phép thực hiện thao tác này." }, { status: 403 }) };
  return { user, response: null };
}

export async function reserveGeneration(user: AuthUser, task: "khbd" | "ppct") {
  if (user.role === "admin" || user.plan === "unlimited") return { ok: true, unlimited: true, remaining: null as number | null };
  const d = await ensureAuthSchema();
  const column = task === "ppct" ? "ppct_used" : "khbd_used";
  const result = await d.prepare(`UPDATE users SET ${column}=${column}+1 WHERE id=? AND status='active' AND plan='free' AND ${column}<5`).bind(user.id).run();
  if (!result.meta?.changes) return { ok: false, unlimited: false, remaining: 0 };
  const row = await d.prepare(`SELECT ${column} used FROM users WHERE id=?`).bind(user.id).first<{ used: number }>();
  return { ok: true, unlimited: false, remaining: Math.max(0, 5 - Number(row?.used || 0)) };
}

export async function refundGeneration(user: AuthUser, task: "khbd" | "ppct") {
  if (user.role === "admin" || user.plan === "unlimited") return;
  const d = await ensureAuthSchema(); const column = task === "ppct" ? "ppct_used" : "khbd_used";
  await d.prepare(`UPDATE users SET ${column}=MAX(0,${column}-1) WHERE id=?`).bind(user.id).run();
}

export async function createSession(userId: string) {
  const token = randomHex(32); const now = new Date(); const expires = new Date(now.getTime() + 7 * 86400000);
  const d = await ensureAuthSchema();
  await d.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now.toISOString()).run();
  await d.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), userId, await sha256(token), expires.toISOString(), now.toISOString()).run();
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) { const d = await ensureAuthSchema(); await d.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run(); }
  jar.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}
