import { destroySession } from "@/app/lib/auth";
export async function POST() { await destroySession(); return Response.json({ ok: true }); }
