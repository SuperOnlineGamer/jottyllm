"use server";

import { getCurrentUser } from "@/app/_server/actions/users";
import { CHECKLISTS_FOLDER } from "@/app/_consts/checklists";
import { grepSearchContent, grepExtractFrontmatter } from "@/app/_utils/grep-utils";
import { getUserNotes } from "@/app/_server/actions/note";
import {
  buildNoteSearchSnippet,
  getSearchableTextTerms,
  matchesNoteSearchQuery,
  parseSearchQuery,
} from "@/app/_utils/search-query-utils";
import path from "path";

export interface SearchResult {
  id: string;
  uuid?: string;
  title: string;
  type: "note" | "checklist";
  category: string;
  content?: string;
}

export const search = async (query: string): Promise<{ success: boolean; data: SearchResult[] }> => {
  const parsedQuery = parseSearchQuery(query || "");
  const textTerms = getSearchableTextTerms(parsedQuery);

  if (!parsedQuery.hasStructuredFilters && parsedQuery.plainText.length < 2) {
    return { success: true, data: [] };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, data: [] };
  }

  const escapedQuery = parsedQuery.plainText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const checklistsDir = path.join(process.cwd(), "data", CHECKLISTS_FOLDER, user.username);
  const shouldSearchChecklists =
    !parsedQuery.hasStructuredFilters && parsedQuery.plainText.length >= 2;

  const [noteResults, checklistResults] = await Promise.all([
    getUserNotes({ username: user.username }).catch(() => ({ success: false, data: [] })),
    shouldSearchChecklists
      ? grepSearchContent(checklistsDir, escapedQuery).catch(() => [])
      : Promise.resolve([]),
  ]);

  const cleanMatchLine = (line: string): string => {
    const cleaned = line
      .replace(/^---$/, "")
      .replace(/^- \[[x ]\]\s*/i, "")
      .replace(/\s*\|.*$/, "")
      .replace(/^#+\s*/, "")
      .trim();
    return cleaned;
  };

  const processResults = async (
    results: { filePath: string; id: string; category: string; matchLine: string }[],
    type: "note" | "checklist"
  ): Promise<SearchResult[]> => {
    return Promise.all(
      results.slice(0, 20).map(async (result) => {
        const metadata = await grepExtractFrontmatter(result.filePath);
        const title = (metadata?.title as string) || result.id;
        const cleaned = cleanMatchLine(result.matchLine);
        const content = cleaned && cleaned.toLowerCase() !== title.toLowerCase()
          ? cleaned
          : undefined;
        return {
          id: result.id,
          uuid: metadata?.uuid as string | undefined,
          title,
          type,
          category: result.category || "Uncategorized",
          content,
        };
      })
    );
  };

  const notes: SearchResult[] = noteResults.success && noteResults.data
    ? noteResults.data
      .filter((note) => matchesNoteSearchQuery(note, parsedQuery, user.tagColors))
      .slice(0, 20)
      .map((note) => {
        const title = note.title || note.id || note.uuid || "Untitled Note";
        const id = note.id || note.uuid || title;

        return {
          id,
          uuid: note.uuid,
          title,
          type: "note" as const,
          category: note.category || "Uncategorized",
          content: textTerms.length > 0
            ? buildNoteSearchSnippet(note, parsedQuery)
            : undefined,
        };
      })
    : [];

  const [checklists] = await Promise.all([
    processResults(checklistResults, "checklist"),
  ]);

  return { success: true, data: [...notes, ...checklists] };
};
