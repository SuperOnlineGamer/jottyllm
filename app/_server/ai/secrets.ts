import fs from "fs/promises";
import path from "path";

interface AiSecretsFile {
  openaiApiKey?: string;
}

const AI_SECRETS_PATH = path.join(process.cwd(), "data", "ai-secrets.json");

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const readSecretFile = async (): Promise<AiSecretsFile> => {
  try {
    const content = await fs.readFile(AI_SECRETS_PATH, "utf-8");
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const readOpenAiKeyFromFile = async (filePath: string): Promise<string> => {
  try {
    return (await fs.readFile(filePath, "utf-8")).trim();
  } catch {
    return "";
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getOpenAiApiKey = async (): Promise<string> => {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  if (process.env.OPENAI_API_KEY_FILE?.trim()) {
    const fileKey = await readOpenAiKeyFromFile(process.env.OPENAI_API_KEY_FILE.trim());
    if (fileKey) return fileKey;
  }

  const secrets = await readSecretFile();
  return secrets.openaiApiKey?.trim() || "";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const isOpenAiKeyConfigured = async (): Promise<boolean> => {
  return (await getOpenAiApiKey()).length > 0;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const saveOpenAiApiKey = async (apiKey: string): Promise<void> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return;

  const secrets = await readSecretFile();
  const dataDir = path.dirname(AI_SECRETS_PATH);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    AI_SECRETS_PATH,
    JSON.stringify({ ...secrets, openaiApiKey: trimmedKey }, null, 2),
    { mode: 0o600 },
  );
};
