import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configured = (names: string[]) => names.filter((name) => Boolean(process.env[name]?.trim())).length;

type KiraModel = { id: string; name: string; description: string; isFree: boolean };

function kiraApiBase() {
  const configuredUrl = (process.env.KIRA_BASE_URL || "https://kiraai.vn/api/v1").replace(/\/+$/, "");
  return configuredUrl.endsWith("/api/v1") ? configuredUrl : `${configuredUrl}/api/v1`;
}

async function getKiraModels(): Promise<KiraModel[]> {
  try {
    const websiteKey = [process.env.KIRA_API_KEY, process.env.KIRA_API_KEY_2, process.env.KIRA_API_KEY_3].find((key) => key?.trim())?.trim();
    const response = await fetch(`${kiraApiBase()}/models`, {
      headers: websiteKey ? { Authorization: `Bearer ${websiteKey}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ id?: string; name?: string; description?: string; type?: string; status?: string; is_free?: boolean }> };
    return (Array.isArray(payload.data) ? payload.data : [])
      .filter((item) => item.id && (!item.type || item.type === "chat") && (!item.status || item.status === "active") && !/(?:image|video|tts)/i.test(String(item.id)))
      .map((item) => ({ id: String(item.id), name: String(item.name || item.id), description: String(item.description || "Mô hình trò chuyện Kira AI"), isFree: Boolean(item.is_free) }));
  } catch { return []; }
}

export async function GET() {
  const kiraModels = await getKiraModels();
  const configuredKiraModel = process.env.KIRA_MODEL?.trim();
  const preferredKiraModel = configuredKiraModel && kiraModels.some((model) => model.id === configuredKiraModel)
    ? configuredKiraModel
    : kiraModels.find((model) => model.id === "kira-3.5-flash")?.id || kiraModels[0]?.id || configuredKiraModel || "kira-3.5-flash";
  const websiteKiraKeys = configured(["KIRA_API_KEY", "KIRA_API_KEY_2", "KIRA_API_KEY_3"]);
  return NextResponse.json({
    providers: {
      openai: {
        name: "OpenAI",
        configuredKeys: configured(["OPENAI_API_KEY", "OPENAI_API_KEY_2", "OPENAI_API_KEY_3"]),
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
      },
      gemini: {
        name: "Google Gemini",
        configuredKeys: configured(["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]),
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      },
      kimi: {
        name: "Kimi",
        configuredKeys: configured(["KIMI_API_KEY", "KIMI_API_KEY_2", "KIMI_API_KEY_3"]),
        model: process.env.KIMI_MODEL || "kimi-k2-0905-preview",
      },
      kira: {
        name: "Kira AI",
        configuredKeys: websiteKiraKeys,
        model: preferredKiraModel,
        models: kiraModels,
        automaticModels: true,
        websiteKeyAvailable: websiteKiraKeys > 0,
        baseUrl: kiraApiBase(),
      },
    },
  });
}
