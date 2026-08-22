import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERSION = "AI Engine v2.1";
const RELEASE = "2026-08-22";
const FEATURE = "mega-prompt-quality-gate";

export async function GET() {
  return NextResponse.json({
    app: "Tạo Giáo Án Việt",
    version: VERSION,
    release: RELEASE,
    feature: FEATURE,
  });
}
