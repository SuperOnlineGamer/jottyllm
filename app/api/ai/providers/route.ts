import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/_server/actions/users";
import { getSafeAiProviderMetadata } from "@/app/_server/ai/config";
import { createOpenAiProvider } from "@/app/_server/ai/providers/openai";
import { createOllamaProvider } from "@/app/_server/ai/providers/ollama";
import { getOpenAiApiKey } from "@/app/_server/ai/secrets";

export const dynamic = "force-dynamic";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const unauthorized = () => {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  return NextResponse.json(await getSafeAiProviderMetadata());
}

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const provider = body?.provider;

  if (provider === "openai") {
    const apiKey =
      typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()
        ? body.openaiApiKey.trim()
        : await getOpenAiApiKey();
    const status = await createOpenAiProvider(apiKey).testConnection();
    return NextResponse.json(status, { status: status.ok ? 200 : 400 });
  }

  if (provider === "ollama") {
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";
    const status = await createOllamaProvider(baseUrl).testConnection();
    return NextResponse.json(status, { status: status.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "Invalid AI provider" }, { status: 400 });
}
