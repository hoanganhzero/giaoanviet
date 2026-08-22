import { NextRequest, NextResponse } from "next/server";
import { POST as generateLegacy } from "@/app/api/ai/generate/route";
import { buildKhbdMegaInstruction, validateKhbdPlan, type KhbdRequestLike } from "@/app/lib/khbd-ai-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function cloneHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return headers;
}

export async function POST(request: NextRequest) {
  let body: KhbdRequestLike;
  try {
    body = await request.json() as KhbdRequestLike;
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  if (body.task !== "ppct") {
    body = {
      ...body,
      form: {
        ...(body.form || {}),
        systemInstruction: buildKhbdMegaInstruction(body),
      },
    };
  }

  const forwarded = new NextRequest(request.url, {
    method: "POST",
    headers: cloneHeaders(request),
    body: JSON.stringify(body),
  });

  const response = await generateLegacy(forwarded);
  if (!response.ok || body.task === "ppct") return response;

  try {
    const payload = await response.json() as Record<string, unknown>;
    const quality = validateKhbdPlan(payload.plan, body);
    return NextResponse.json({ ...payload, quality });
  } catch {
    return NextResponse.json({ error: "Không thể kiểm định chất lượng KHBD sau khi tạo." }, { status: 502 });
  }
}
