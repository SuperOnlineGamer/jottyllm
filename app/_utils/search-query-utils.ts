import type { Note, TagColorOverrides } from "@/app/_types";
import { getTagColor, normalizeTag, tagMatchesFilter } from "@/app/_utils/tag-utils";

export interface SearchDateRange {
  from?: string;
  to?: string;
}

export interface ParsedSearchQuery {
  raw: string;
  plainText: string;
  textTerms: string[];
  phrases: string[];
  tags: string[];
  colors: string[];
  categories: string[];
  reminders: string[];
  reminderDue?: SearchDateRange;
  created?: SearchDateRange;
  updated?: SearchDateRange;
  hasStructuredFilters: boolean;
}

interface SearchToken {
  value: string;
  quoted: boolean;
}

const REMINDER_FILTERS = new Set([
  "any",
  "pending",
  "done",
  "dismissed",
  "overdue",
  "upcoming",
]);

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const parseDateBoundary = (value: string, endOfDay = false): string | null => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
    ? `${trimmedValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : trimmedValue;
  const timestamp = Date.parse(candidate);

  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString();
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const tokenizeSearchQuery = (query: string): SearchToken[] => {
  const tokens: SearchToken[] = [];
  let current = "";
  let quoted = false;
  let tokenWasQuoted = false;

  for (const char of query.trim()) {
    if (char === '"') {
      quoted = !quoted;
      tokenWasQuoted = true;
      continue;
    }

    if (/\s/.test(char) && !quoted) {
      if (current.trim()) {
        tokens.push({ value: current.trim(), quoted: tokenWasQuoted });
      }
      current = "";
      tokenWasQuoted = false;
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push({ value: current.trim(), quoted: tokenWasQuoted });
  }

  return tokens;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const parseDateRangeValue = (value: string): SearchDateRange | undefined => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  if (trimmedValue.includes("..")) {
    const [rawFrom = "", rawTo = ""] = trimmedValue.split("..", 2);
    const from = rawFrom ? parseDateBoundary(rawFrom) : null;
    const to = rawTo ? parseDateBoundary(rawTo, true) : null;
    if (!from && !to) return undefined;
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }

  if (trimmedValue.startsWith(">=")) {
    const from = parseDateBoundary(trimmedValue.slice(2));
    return from ? { from } : undefined;
  }

  if (trimmedValue.startsWith(">")) {
    const boundary = parseDateBoundary(trimmedValue.slice(1), true);
    if (!boundary) return undefined;
    return { from: new Date(Date.parse(boundary) + 1).toISOString() };
  }

  if (trimmedValue.startsWith("<=")) {
    const to = parseDateBoundary(trimmedValue.slice(2), true);
    return to ? { to } : undefined;
  }

  if (trimmedValue.startsWith("<")) {
    const boundary = parseDateBoundary(trimmedValue.slice(1));
    if (!boundary) return undefined;
    return { to: new Date(Date.parse(boundary) - 1).toISOString() };
  }

  const from = parseDateBoundary(trimmedValue);
  const to = parseDateBoundary(trimmedValue, true);
  if (!from || !to) return undefined;

  return { from, to };
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const parseSearchQuery = (query: string): ParsedSearchQuery => {
  const parsed: ParsedSearchQuery = {
    raw: query,
    plainText: "",
    textTerms: [],
    phrases: [],
    tags: [],
    colors: [],
    categories: [],
    reminders: [],
    hasStructuredFilters: false,
  };

  for (const token of tokenizeSearchQuery(query)) {
    const operatorMatch = token.value.match(/^([a-z]+):(.+)$/i);

    if (operatorMatch) {
      const operator = operatorMatch[1].toLowerCase();
      const rawValue = operatorMatch[2].trim();
      const values = rawValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (operator === "tag") {
        parsed.tags.push(...values.map(normalizeTag).filter(Boolean));
        parsed.hasStructuredFilters = true;
        continue;
      }

      if (operator === "color") {
        parsed.colors.push(...values.map((value) => value.toLowerCase()));
        parsed.hasStructuredFilters = true;
        continue;
      }

      if (operator === "category") {
        parsed.categories.push(...values);
        parsed.hasStructuredFilters = true;
        continue;
      }

      if (operator === "reminder") {
        for (const value of values) {
          const normalizedValue = value.toLowerCase();
          const dateRange = parseDateRangeValue(value);

          if (REMINDER_FILTERS.has(normalizedValue)) {
            parsed.reminders.push(normalizedValue);
          } else if (dateRange) {
            parsed.reminderDue = dateRange;
          } else {
            parsed.reminders.push(normalizedValue);
          }
        }
        parsed.hasStructuredFilters = true;
        continue;
      }

      if (operator === "due") {
        parsed.reminderDue = parseDateRangeValue(rawValue);
        parsed.hasStructuredFilters = parsed.hasStructuredFilters || Boolean(parsed.reminderDue);
        continue;
      }

      if (operator === "created") {
        parsed.created = parseDateRangeValue(rawValue);
        parsed.hasStructuredFilters = parsed.hasStructuredFilters || Boolean(parsed.created);
        continue;
      }

      if (operator === "updated") {
        parsed.updated = parseDateRangeValue(rawValue);
        parsed.hasStructuredFilters = parsed.hasStructuredFilters || Boolean(parsed.updated);
        continue;
      }
    }

    if (token.quoted) {
      parsed.phrases.push(token.value);
    } else {
      parsed.textTerms.push(token.value);
    }
  }

  parsed.tags = Array.from(new Set(parsed.tags));
  parsed.colors = Array.from(new Set(parsed.colors));
  parsed.categories = Array.from(new Set(parsed.categories));
  parsed.reminders = Array.from(new Set(parsed.reminders));
  parsed.plainText = [...parsed.phrases, ...parsed.textTerms].join(" ").trim();

  return parsed;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const matchesDateRange = (
  value: string | undefined,
  range: SearchDateRange | undefined,
): boolean => {
  if (!range) return true;
  if (!value) return false;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;

  if (range.from && timestamp < Date.parse(range.from)) return false;
  if (range.to && timestamp > Date.parse(range.to)) return false;

  return true;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const matchesNoteSearchQuery = (
  note: Partial<Note>,
  query: ParsedSearchQuery,
  tagColors?: TagColorOverrides | null,
): boolean => {
  const noteTags = Array.isArray(note.tags) ? note.tags : [];
  const noteReminders = Array.isArray(note.reminders) ? note.reminders : [];

  if (
    query.tags.length > 0 &&
    !query.tags.every((filterTag) =>
      noteTags.some((noteTag) => tagMatchesFilter(noteTag, filterTag)),
    )
  ) {
    return false;
  }

  if (
    query.colors.length > 0 &&
    !query.colors.every((filterColor) =>
      noteTags.some((tag) => {
        const tagColor = getTagColor(tag, tagColors);
        return (
          tagColor.name.toLowerCase() === filterColor ||
          tagColor.foreground.toLowerCase() === filterColor
        );
      }),
    )
  ) {
    return false;
  }

  if (query.categories.length > 0) {
    const noteCategory = (note.category || "Uncategorized").toLowerCase();
    const categoryMatches = query.categories.some((category) => {
      const normalizedCategory = category.toLowerCase();
      return (
        noteCategory === normalizedCategory ||
        noteCategory.startsWith(`${normalizedCategory}/`)
      );
    });

    if (!categoryMatches) return false;
  }

  if (!matchesDateRange(note.createdAt, query.created)) return false;
  if (!matchesDateRange(note.updatedAt, query.updated)) return false;

  if (
    query.reminders.length > 0 &&
    !query.reminders.every((filter) => {
      if (filter === "any") return noteReminders.length > 0;
      if (filter === "overdue") {
        return noteReminders.some(
          (reminder) =>
            reminder.status === "pending" &&
            !Number.isNaN(Date.parse(reminder.dueAt)) &&
            Date.parse(reminder.dueAt) < Date.now(),
        );
      }
      if (filter === "upcoming") {
        return noteReminders.some(
          (reminder) =>
            reminder.status === "pending" &&
            !Number.isNaN(Date.parse(reminder.dueAt)) &&
            Date.parse(reminder.dueAt) >= Date.now(),
        );
      }

      return noteReminders.some((reminder) => reminder.status === filter);
    })
  ) {
    return false;
  }

  if (
    query.reminderDue &&
    !noteReminders.some((reminder) =>
      matchesDateRange(reminder.dueAt, query.reminderDue),
    )
  ) {
    return false;
  }

  const searchableContent = note.encrypted ? "" : note.content || "";
  const searchableText = `${note.title || ""}\n${searchableContent}`.toLowerCase();

  if (!query.phrases.every((phrase) => searchableText.includes(phrase.toLowerCase()))) {
    return false;
  }

  return query.textTerms.every((term) => searchableText.includes(term.toLowerCase()));
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getSearchableTextTerms = (query: ParsedSearchQuery): string[] => {
  return [...query.phrases, ...query.textTerms].filter(Boolean);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const buildNoteSearchSnippet = (
  note: Partial<Note>,
  query: ParsedSearchQuery,
): string | undefined => {
  if (note.encrypted || !note.content) return undefined;

  const terms = getSearchableTextTerms(query).map((term) => term.toLowerCase());
  const lines = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return lines[0]?.slice(0, 160);
  }

  return (
    lines.find((line) =>
      terms.some((term) => line.toLowerCase().includes(term)),
    ) || lines[0]
  )?.slice(0, 160);
};