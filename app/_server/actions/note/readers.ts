"use server";

import path from "path";
import fs from "fs/promises";
import { ARCHIVED_DIR_NAME, EXCLUDED_DIRS } from "@/app/_consts/files";
import {
  serverReadDir,
  serverReadFile,
  readOrderFile,
  getAllFileStats,
} from "@/app/_server/actions/file";
import {
  extractYamlMetadata,
  generateUuid,
  toIso,
  updateYamlMetadata,
} from "@/app/_utils/yaml-metadata-utils";
import {
  grepExtractAllFrontmatters,
  grepExtractFrontmatter,
  grepExtractExcerpt,
} from "@/app/_utils/grep-utils";
import type { FileStatsEntry } from "@/app/_server/actions/file";
import { parseMarkdownNote } from "./parsers";
import { Note } from "@/app/_types";

export const readNotesRecursively = async (
  dir: string,
  basePath: string = "",
  owner: string,
  allowArchived: boolean = false,
  isRaw: boolean = false,
  metadataOnly: boolean = false,
  excerptLength?: number,
  metadataCache?: Map<string, Record<string, unknown>>,
  statsCache?: Map<string, FileStatsEntry>,
): Promise<Note[]> => {
  if (basePath === "") {
    statsCache = statsCache || new Map();
    metadataCache = metadataCache || new Map();

    try {
      [statsCache, metadataCache] = await Promise.all([
        getAllFileStats(dir),
        grepExtractAllFrontmatters(dir),
      ]);
    } catch (e) {
      console.warn("Optimization failed, falling back to standard mode", e);
    }
  }

  const notes: Note[] = [];
  const entries = await serverReadDir(dir);
  let excludedDirs = EXCLUDED_DIRS;

  if (!allowArchived) {
    excludedDirs = [...EXCLUDED_DIRS, ARCHIVED_DIR_NAME];
  }

  const order = await readOrderFile(dir);
  const dirNames = entries
    .filter((e) => e.isDirectory() && !excludedDirs.includes(e.name))
    .map((e) => e.name);

  const orderedDirNames: string[] = order?.categories
    ? [
        ...order.categories.filter((n) => dirNames.includes(n)),
        ...dirNames
          .filter((n) => !order.categories!.includes(n))
          .sort((a, b) => a.localeCompare(b)),
      ]
    : dirNames.sort((a, b) => a.localeCompare(b));

  const subDirPromises = orderedDirNames.map(async (dirName) => {
    return readNotesRecursively(
      path.join(dir, dirName),
      basePath ? `${basePath}/${dirName}` : dirName,
      owner,
      allowArchived,
      isRaw,
      metadataOnly,
      excerptLength,
      metadataCache,
      statsCache,
    );
  });

  const categoryDir = dir;
  const categoryPath = basePath;
  const files = entries;
  const mdFiles = files.filter((f) => f.isFile() && f.name.endsWith(".md"));
  const ids = mdFiles.map((f) => path.basename(f.name, ".md"));
  const categoryOrder = order;

  const orderedIds: string[] = categoryOrder?.items
    ? [
        ...categoryOrder.items.filter((id) => ids.includes(id)),
        ...ids
          .filter((id) => !categoryOrder.items!.includes(id))
          .sort((a, b) => a.localeCompare(b)),
      ]
    : ids.sort((a, b) => a.localeCompare(b));

  const filePromises = orderedIds.map(async (id) => {
    const fileName = `${id}.md`;
    const filePath = path.join(categoryDir, fileName);
    try {
      const cachedStats = statsCache?.get(filePath);
      const stats = cachedStats
        ? { birthtime: cachedStats.birthtime, mtime: cachedStats.mtime }
        : await fs.stat(filePath);

      if (metadataOnly) {
        const metadata =
          metadataCache?.get(filePath) ??
          (await grepExtractFrontmatter(filePath));

        const tags = Array.isArray(metadata?.tags)
          ? (metadata.tags as string[])
          : [];

        return {
          id,
          uuid: typeof metadata?.uuid === "string" ? metadata.uuid : undefined,
          title: typeof metadata?.title === "string" ? metadata.title : id,
          category: categoryPath,
          createdAt: toIso(stats.birthtime),
          updatedAt: toIso(stats.mtime),
          owner,
          isShared: false,
          encrypted: metadata?.encrypted === true,
          tags,
        };
      } else if (excerptLength) {
        const metadata =
          metadataCache?.get(filePath) ??
          (await grepExtractFrontmatter(filePath));
        const tags = Array.isArray(metadata?.tags)
          ? (metadata.tags as string[])
          : [];
        const excerpt = await grepExtractExcerpt(filePath, excerptLength);

        return {
          id,
          uuid: typeof metadata?.uuid === "string" ? metadata.uuid : undefined,
          title: typeof metadata?.title === "string" ? metadata.title : id,
          content: excerpt,
          category: categoryPath,
          createdAt: toIso(stats.birthtime),
          updatedAt: toIso(stats.mtime),
          owner,
          isShared: false,
          encrypted: metadata?.encrypted === true,
          tags,
        };
      } else {
        const content = await serverReadFile(filePath);
        if (isRaw) {
          const { metadata } = extractYamlMetadata(content);
          let uuid = metadata.uuid;
          if (!uuid) {
            uuid = generateUuid();
            updateYamlMetadata(content, { uuid });
          }
          return {
            id,
            uuid,
            title: id,
            content: "",
            category: categoryPath,
            createdAt: toIso(stats.birthtime),
            updatedAt: toIso(stats.mtime),
            owner,
            isShared: false,
            rawContent: content,
          };
        } else {
          return parseMarkdownNote(
            content,
            id,
            categoryPath,
            owner,
            false,
            {
              birthtime: new Date(toIso(stats.birthtime)),
              mtime: new Date(toIso(stats.mtime)),
            },
            fileName,
          );
        }
      }
    } catch (e) {
      return null;
    }
  });

  const [subDirNotes, currentDirNotes] = await Promise.all([
    Promise.all(subDirPromises),
    Promise.all(filePromises),
  ]);

  notes.push(...currentDirNotes.filter((n): n is Note => n != null));
  subDirNotes.forEach((sub) => notes.push(...sub));

  return notes;
};
