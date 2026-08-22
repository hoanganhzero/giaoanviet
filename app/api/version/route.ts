import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERSION = "AI Engine v3.0";
const RELEASE = "2026-08-22";
const FEATURE = "khbd-integration-standard";

export async function GET() {
  return NextResponse.json({
    app: "Tạo Giáo Án Việt",
    version: VERSION,
    release: RELEASE,
    feature: FEATURE,
  });
}
