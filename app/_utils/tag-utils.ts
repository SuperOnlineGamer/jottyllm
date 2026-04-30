import type {
  Note,
  Checklist,
  TagsIndex,
  TagInfo,
  TagColor,
  TagColorOverrides,
} from "@/app/_types";

export type { TagsIndex, TagInfo, TagColor };

export const TAG_COLOR_PALETTE: TagColor[] = [
  {
    name: "rose",
    foreground: "#be123c",
    background: "color-mix(in srgb, #e11d48 14%, transparent)",
    border: "color-mix(in srgb, #e11d48 34%, transparent)",
  },
  {
    name: "amber",
    foreground: "#b45309",
    background: "color-mix(in srgb, #f59e0b 18%, transparent)",
    border: "color-mix(in srgb, #f59e0b 38%, transparent)",
  },
  {
    name: "emerald",
    foreground: "#047857",
    background: "color-mix(in srgb, #10b981 16%, transparent)",
    border: "color-mix(in srgb, #10b981 34%, transparent)",
  },
  {
    name: "teal",
    foreground: "#0f766e",
    background: "color-mix(in srgb, #14b8a6 16%, transparent)",
    border: "color-mix(in srgb, #14b8a6 34%, transparent)",
  },
  {
    name: "sky",
    foreground: "#0369a1",
    background: "color-mix(in srgb, #0ea5e9 15%, transparent)",
    border: "color-mix(in srgb, #0ea5e9 34%, transparent)",
  },
  {
    name: "blue",
    foreground: "#1d4ed8",
    background: "color-mix(in srgb, #3b82f6 14%, transparent)",
    border: "color-mix(in srgb, #3b82f6 34%, transparent)",
  },
  {
    name: "violet",
    foreground: "#6d28d9",
    background: "color-mix(in srgb, #8b5cf6 14%, transparent)",
    border: "color-mix(in srgb, #8b5cf6 34%, transparent)",
  },
  {
    name: "fuchsia",
    foreground: "#a21caf",
    background: "color-mix(in srgb, #d946ef 14%, transparent)",
    border: "color-mix(in srgb, #d946ef 34%, transparent)",
  },
  {
    name: "pink",
    foreground: "#be185d",
    background: "color-mix(in srgb, #ec4899 14%, transparent)",
    border: "color-mix(in srgb, #ec4899 34%, transparent)",
  },
  {
    name: "slate",
    foreground: "#475569",
    background: "color-mix(in srgb, #64748b 14%, transparent)",
    border: "color-mix(in srgb, #64748b 34%, transparent)",
  },
];

export const normalizeTag = (tag: string): string => {
  return tag.toLowerCase().trim().replace(/^#/, "");
};

export const isValidTagName = (tag: string): boolean => {
  const normalizedTag = normalizeTag(tag);
  return Boolean(
    normalizedTag &&
      !normalizedTag.includes("//") &&
      !normalizedTag.endsWith("/"),
  );
};

export const normalizeTagList = (tags?: unknown): string[] => {
  const normalizedTags = new Set<string>();
  if (!Array.isArray(tags)) return [];

  for (const tag of tags) {
    if (typeof tag !== "string") continue;

    const normalizedTag = normalizeTag(tag);
    if (isValidTagName(normalizedTag)) {
      normalizedTags.add(normalizedTag);
    }
  }

  return Array.from(normalizedTags).sort();
};

export const getAncestorTags = (tag: string): string[] => {
  const parts = tag.split("/");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("/"));
  }
  return ancestors;
};

export const getParentTag = (tag: string): string | null => {
  const lastSlash = tag.lastIndexOf("/");
  if (lastSlash === -1) return null;
  return tag.substring(0, lastSlash);
};

export const getDisplayName = (tag: string): string => {
  const lastSlash = tag.lastIndexOf("/");
  if (lastSlash === -1) return tag;
  return tag.substring(lastSlash + 1);
};

export const isValidTagColor = (color: string): boolean => {
  return /^#[0-9a-fA-F]{6}$/.test(color.trim());
};

export const normalizeTagColorOverrides = (
  tagColors?: TagColorOverrides | null,
): TagColorOverrides => {
  const normalizedColors: TagColorOverrides = {};
  if (!tagColors || typeof tagColors !== "object" || Array.isArray(tagColors)) {
    return normalizedColors;
  }

  for (const [tag, color] of Object.entries(tagColors)) {
    if (typeof color !== "string") continue;

    const normalizedTag = normalizeTag(tag);
    const normalizedColor = color.trim().toLowerCase();
    if (normalizedTag && isValidTagColor(normalizedColor)) {
      normalizedColors[normalizedTag] = normalizedColor;
    }
  }

  return normalizedColors;
};

export const createTagColor = (color: string, name = "custom"): TagColor => {
  const normalizedColor = color.trim().toLowerCase();
  return {
    name,
    foreground: normalizedColor,
    background: `color-mix(in srgb, ${normalizedColor} 14%, transparent)`,
    border: `color-mix(in srgb, ${normalizedColor} 34%, transparent)`,
  };
};

export const getTagColor = (
  tag: string,
  tagColors?: TagColorOverrides | null,
): TagColor => {
  const normalizedTag = normalizeTag(tag);
  const normalizedColors = normalizeTagColorOverrides(tagColors);
  const exactColor = normalizedColors[normalizedTag];
  const rootTag = normalizedTag.split("/")[0] || normalizedTag;
  const rootColor = rootTag !== normalizedTag ? normalizedColors[rootTag] : null;

  if (exactColor) return createTagColor(exactColor);
  if (rootColor) return createTagColor(rootColor);

  const colorKey = normalizedTag.split("/")[0] || normalizedTag || "tag";
  let hash = 0;

  for (let i = 0; i < colorKey.length; i++) {
    hash = (hash * 31 + colorKey.charCodeAt(i)) >>> 0;
  }

  return TAG_COLOR_PALETTE[hash % TAG_COLOR_PALETTE.length];
};

const ensureTagEntry = (
  index: TagsIndex,
  normalizedTag: string,
  tagColors?: TagColorOverrides | null,
) => {
  if (!index[normalizedTag]) {
    index[normalizedTag] = {
      name: normalizedTag,
      displayName: getDisplayName(normalizedTag),
      parent: getParentTag(normalizedTag),
      color: getTagColor(normalizedTag, tagColors),
      noteUuids: [],
      checklistUuids: [],
      totalCount: 0,
    };
  }
};

export const buildTagsIndex = (
  notes: Partial<Note>[],
  checklists?: Partial<Checklist>[],
  tagColors?: TagColorOverrides | null,
): TagsIndex => {
  const index: TagsIndex = {};
  const normalizedTagColors = normalizeTagColorOverrides(tagColors);
  const notesList = Array.isArray(notes) ? notes : [];
  const checklistsList =
    checklists !== undefined && Array.isArray(checklists) ? checklists : [];

  for (const note of notesList) {
    if (!note.tags || !note.uuid) continue;

    for (const tag of note.tags) {
      const normalizedTag = normalizeTag(tag);
      if (!normalizedTag) continue;

      ensureTagEntry(index, normalizedTag, normalizedTagColors);

      if (!index[normalizedTag].noteUuids.includes(note.uuid)) {
        index[normalizedTag].noteUuids.push(note.uuid);
      }

      const ancestors = getAncestorTags(normalizedTag);
      for (const ancestor of ancestors) {
        ensureTagEntry(index, ancestor, normalizedTagColors);
      }
    }
  }

  for (const checklist of checklistsList) {
    if (!checklist.tags || !checklist.uuid) continue;

    for (const tag of checklist.tags) {
      const normalizedTag = normalizeTag(tag);
      if (!normalizedTag) continue;

      ensureTagEntry(index, normalizedTag, normalizedTagColors);

      if (!index[normalizedTag].checklistUuids.includes(checklist.uuid)) {
        index[normalizedTag].checklistUuids.push(checklist.uuid);
      }

      const ancestors = getAncestorTags(normalizedTag);
      for (const ancestor of ancestors) {
        ensureTagEntry(index, ancestor, normalizedTagColors);
      }
    }
  }

  for (const tagName of Object.keys(index)) {
    const tag = index[tagName];
    const descendantUuids = new Set<string>([
      ...tag.noteUuids,
      ...tag.checklistUuids,
    ]);

    for (const otherTagName of Object.keys(index)) {
      if (otherTagName.startsWith(tagName + "/")) {
        for (const uuid of index[otherTagName].noteUuids) {
          descendantUuids.add(uuid);
        }
        for (const uuid of index[otherTagName].checklistUuids) {
          descendantUuids.add(uuid);
        }
      }
    }

    tag.totalCount = descendantUuids.size;
  }

  return index;
};

export const extractHashtagsFromContent = (content: string): string[] => {
  const tags = new Set<string>();

  const dataTagRegex = /data-tag="([^"]+)"/g;
  let match;
  while ((match = dataTagRegex.exec(content)) !== null) {
    const tag = normalizeTag(match[1]);
    if (isValidTagName(tag)) {
      tags.add(tag);
    }
  }

  const codeBlockRegex =
    /```[\s\S]*?```|`[^`]+`|<code[^>]*>[\s\S]*?<\/code>|<pre[^>]*>[\s\S]*?<\/pre>/gi;
  const contentWithoutCode = content.replace(codeBlockRegex, "");

  const hashtagRegex = /(?:^|[\s(])#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  while ((match = hashtagRegex.exec(contentWithoutCode)) !== null) {
    const tag = normalizeTag(match[1]);
    if (isValidTagName(tag)) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
};

export const tagMatchesFilter = (
  noteTag: string,
  filterTag: string,
): boolean => {
  const normalizedNoteTag = normalizeTag(noteTag);
  const normalizedFilterTag = normalizeTag(filterTag);

  if (normalizedNoteTag === normalizedFilterTag) return true;
  if (normalizedNoteTag.startsWith(normalizedFilterTag + "/")) return true;

  return false;
};

export const getAllUniqueTags = (notes: Partial<Note>[]): string[] => {
  const tags = new Set<string>();
  for (const note of notes) {
    if (note.tags) {
      for (const tag of note.tags) {
        tags.add(normalizeTag(tag));
      }
    }
  }
  return Array.from(tags).sort();
};

export const buildTagTree = (tagsIndex: TagsIndex): TagInfo[] => {
  const rootTags: TagInfo[] = [];

  for (const tag of Object.values(tagsIndex)) {
    if (!tag.parent) {
      rootTags.push(tag);
    }
  }

  return rootTags.sort((a, b) => a.name.localeCompare(b.name));
};

export const getChildTags = (
  tagsIndex: TagsIndex,
  parentTag: string,
): TagInfo[] => {
  const children: TagInfo[] = [];

  for (const tag of Object.values(tagsIndex)) {
    if (tag.parent === parentTag) {
      children.push(tag);
    }
  }

  return children.sort((a, b) => a.name.localeCompare(b.name));
};
