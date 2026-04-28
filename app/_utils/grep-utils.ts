/**
 * @fccview here!
 * Hi all, welcome to the grep-utils.ts file.
 *
 * I was hitting a wall on how to fetch files without a database and performance was going down, massively.
 * And then it struck me, why am I not using grep?!?
 *
 * This is so much more performant, so let me leave you with a beautiful video on
 * the genesis of grep: https://www.youtube.com/watch?v=NTfOnGZUZDk
 *
 * Enjoy it <3
 */

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

export interface GrepFileResult {
  filePath: string;
  id: string;
  category: string;
}

export interface GrepMetadataResult {
  filePath: string;
  id: string;
  category: string;
  metadata: Record<string, any>;
}

const collectMarkdownFiles = async (
  dir: string,
  filePaths: string[] = [],
): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectMarkdownFiles(entryPath, filePaths);
        return;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        filePaths.push(entryPath);
      }
    }),
  );

  return filePaths.sort((leftPath, rightPath) =>
    leftPath.localeCompare(rightPath),
  );
};

const toGrepFileResult = (dir: string, filePath: string): GrepFileResult => {
  const relativePath = path.relative(dir, filePath);
  const parts = relativePath.split(path.sep);
  const filename = parts.pop() || "";
  const id = path.basename(filename, ".md");
  const category = parts.join("/");

  return { filePath, id, category };
};

const getFrontmatterText = (content: string): string | null => {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (endIndex === -1) return null;

  return lines.slice(1, endIndex).join("\n");
};

const parseFrontmatter = (content: string): Record<string, unknown> | null => {
  const frontmatterText = getFrontmatterText(content);
  if (!frontmatterText) return null;

  const parsed = yaml.load(frontmatterText);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return null;
};

const metadataFieldMatches = (
  metadata: Record<string, unknown>,
  field: string,
  value: string,
): boolean => {
  const metadataValue = metadata[field];
  if (Array.isArray(metadataValue)) {
    return metadataValue.map(String).includes(value);
  }

  return String(metadataValue ?? "") === value;
};

export const grepFindFileByField = async (
  dir: string,
  field: string,
  value: string,
): Promise<GrepFileResult | null> => {
  try {
    const files = await collectMarkdownFiles(dir);
    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf-8");
      const metadata = parseFrontmatter(content);
      if (metadata && metadataFieldMatches(metadata, field, value)) {
        return toGrepFileResult(dir, filePath);
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const grepFindFileByUuid = async (
  dir: string,
  uuid: string,
): Promise<GrepFileResult | null> => {
  return grepFindFileByField(dir, "uuid", uuid);
};

export const grepCheckUuidExists = async (
  dir: string,
  uuid: string,
): Promise<boolean> => {
  try {
    return (await grepFindFileByUuid(dir, uuid)) !== null;
  } catch {
    return false;
  }
};

export const grepFindFilesByField = async (
  dir: string,
  field: string,
  value: string,
): Promise<GrepFileResult[]> => {
  try {
    const files = await collectMarkdownFiles(dir);
    const results: GrepFileResult[] = [];

    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf-8");
      const metadata = parseFrontmatter(content);
      if (metadata && metadataFieldMatches(metadata, field, value)) {
        results.push(toGrepFileResult(dir, filePath));
      }
    }

    return results;
  } catch {
    return [];
  }
};

export const grepExtractAllFrontmatters = async (
  dir: string,
): Promise<Map<string, Record<string, unknown>>> => {
  try {
    const result = new Map<string, Record<string, unknown>>();
    const files = await collectMarkdownFiles(dir);

    await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const metadata = parseFrontmatter(content);
          if (metadata) {
            result.set(filePath, metadata);
          }
        } catch {}
      }),
    );

    return result;
  } catch {
    return new Map();
  }
};

export const grepExtractFrontmatter = async (
  filePath: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parseFrontmatter(content);
  } catch {
    return null;
  }
};

export const grepListAllFiles = async (
  dir: string,
): Promise<GrepFileResult[]> => {
  try {
    const files = await collectMarkdownFiles(dir);
    return files.map((filePath) => toGrepFileResult(dir, filePath));
  } catch {
    return [];
  }
};

export const grepListFilesWithMetadata = async (
  dir: string,
): Promise<GrepMetadataResult[]> => {
  try {
    const files = await grepListAllFiles(dir);
    const results: GrepMetadataResult[] = [];

    for (const file of files) {
      const metadata = await grepExtractFrontmatter(file.filePath);
      results.push({
        ...file,
        metadata: metadata || {},
      });
    }

    return results;
  } catch {
    return [];
  }
};

export const grepExtractField = async (
  filePath: string,
  field: string,
): Promise<string | null> => {
  try {
    const metadata = await grepExtractFrontmatter(filePath);
    const value = metadata?.[field];
    if (value === undefined || value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map(String).join(", ");
    }

    return String(value);
  } catch {
    return null;
  }
};

export interface GrepSearchResult extends GrepFileResult {
  matchLine: string;
}

export const grepSearchContent = async (
  dir: string,
  pattern: string,
): Promise<GrepSearchResult[]> => {
  try {
    const files = await collectMarkdownFiles(dir);
    const normalizedPattern = pattern.toLowerCase();
    const results: GrepSearchResult[] = [];

    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf-8");
      const normalizedContent = content.toLowerCase();
      if (!normalizedContent.includes(normalizedPattern)) {
        continue;
      }

      const matchLine =
        content
          .split(/\r?\n/)
          .find((line) => line.toLowerCase().includes(normalizedPattern)) || "";

      results.push({
        ...toGrepFileResult(dir, filePath),
        matchLine: matchLine.trim(),
      });
    }

    return results;
  } catch {
    return [];
  }
};

const FENCE = "```";
const EXCERPT_BUFFER = 2048;

const fullCodeBlock = (text: string, length: number): string => {
  if (text.length <= length) return text.trim();

  const cut = text.slice(0, length);
  const fenceCount = (cut.match(/```/g) || []).length;

  if (fenceCount % 2 === 0) return cut.trim();

  const nextFence = text.indexOf(FENCE, length);

  if (nextFence === -1) return cut.trim();

  return text.slice(0, nextFence + FENCE.length).trim();
};

export const grepExtractExcerpt = async (
  filePath: string,
  length: number = 200,
): Promise<string> => {
  try {
    const cap = length + EXCERPT_BUFFER;
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const endIndex =
      lines[0]?.trim() === "---"
        ? lines.findIndex((line, index) => index > 0 && line.trim() === "---")
        : -1;
    const contentWithoutFrontmatter =
      endIndex === -1 ? content : lines.slice(endIndex + 1).join("\n");

    return fullCodeBlock(contentWithoutFrontmatter.slice(0, cap), length);
  } catch {
    return "";
  }
};
