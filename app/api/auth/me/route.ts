import { getCurrentUser } from "@/app/lib/auth";
export async function GET() { return Response.json({ user: await getCurrentUser() }); }
