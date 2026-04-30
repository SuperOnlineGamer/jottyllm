import { NOTE_TEMPLATES } from "@/app/_consts/notes";
import type { NoteTemplate, NoteTemplateScope } from "@/app/_types";
import { normalizeTagList } from "@/app/_utils/tag-utils";

export interface NoteTemplateValues {
  title: string;
  category?: string;
  username?: string;
  now?: Date;
}

export interface AppliedNoteTemplate {
  template: NoteTemplate;
  title: string;
  content: string;
  tags: string[];
}

export interface NoteTemplateCollectionInput {
  adminTemplates?: NoteTemplate[] | null;
  userTemplates?: NoteTemplate[] | null;
  hiddenTemplateIds?: string[] | null;
  includeHidden?: boolean;
  includeSystem?: boolean;
  includeAdmin?: boolean;
  includeUser?: boolean;
}

const TEMPLATE_ID_PREFIX: Record<NoteTemplateScope, string> = {
  system: "system-template",
  admin: "admin-template",
  user: "user-template",
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const normalizeTemplateIdPart = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const createNoteTemplateId = (
  scope: NoteTemplateScope,
  name: string,
): string => {
  const normalizedName = normalizeTemplateIdPart(name) || "template";
  return `${TEMPLATE_ID_PREFIX[scope]}-${normalizedName}-${Date.now()}`;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const normalizeNoteTemplate = (
  template: Partial<NoteTemplate>,
  scope: NoteTemplateScope,
  owner?: string,
): NoteTemplate | null => {
  const name = (template.name || "").trim();
  const nameKey = template.nameKey?.trim();
  const description = (template.description || "").trim();
  const descriptionKey = template.descriptionKey?.trim();
  const content = typeof template.content === "string" ? template.content : "";
  const titleTemplate = template.titleTemplate?.trim() || undefined;
  const id = template.id?.trim() || createNoteTemplateId(scope, name || nameKey || "template");

  if (!name && !nameKey) return null;

  return {
    id,
    ...(nameKey ? { nameKey } : { name }),
    ...(descriptionKey ? { descriptionKey } : { description }),
    ...(titleTemplate ? { titleTemplate } : {}),
    content,
    tags: normalizeTagList(template.tags),
    scope,
    ...(owner ? { owner } : {}),
    required: Boolean(template.required),
    createdAt: template.createdAt || new Date().toISOString(),
    updatedAt: template.updatedAt || new Date().toISOString(),
  };
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const normalizeNoteTemplates = (
  templates: Partial<NoteTemplate>[] | undefined | null,
  scope: NoteTemplateScope,
  owner?: string,
): NoteTemplate[] => {
  if (!Array.isArray(templates)) return [];

  const seen = new Set<string>();
  return templates
    .map((template) => normalizeNoteTemplate(template, scope, owner))
    .filter((template): template is NoteTemplate => Boolean(template))
    .filter((template) => {
      if (seen.has(template.id)) return false;
      seen.add(template.id);
      return true;
    });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getTemplateName = (template: NoteTemplate): string => {
  return template.name || template.nameKey || template.id;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getAvailableNoteTemplates = ({
  adminTemplates,
  userTemplates,
  hiddenTemplateIds,
  includeHidden = false,
  includeSystem = true,
  includeAdmin = true,
  includeUser = true,
}: NoteTemplateCollectionInput = {}): NoteTemplate[] => {
  const hiddenIds = new Set(hiddenTemplateIds || []);
  const templates = [
    ...(includeSystem ? NOTE_TEMPLATES : []),
    ...(includeAdmin ? normalizeNoteTemplates(adminTemplates, "admin") : []),
    ...(includeUser ? normalizeNoteTemplates(userTemplates, "user") : []),
  ];
  const seen = new Set<string>();

  return templates.filter((template) => {
    if (seen.has(template.id)) return false;
    seen.add(template.id);

    if (includeHidden || template.required) return true;
    return !hiddenIds.has(template.id);
  });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getNoteTemplateById = (
  templateId?: string | null,
  templates: NoteTemplate[] = NOTE_TEMPLATES,
): NoteTemplate => {
  return (
    templates.find((template) => template.id === templateId) ||
    templates.find((template) => template.id === "blank") ||
    NOTE_TEMPLATES[0]
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const expandNoteTemplateText = (
  text: string,
  values: NoteTemplateValues,
): string => {
  const now = values.now || new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const replacements: Record<string, string> = {
    title: values.title || "Untitled Note",
    category: values.category || "Uncategorized",
    username: values.username || "",
    date,
    time,
    datetime: `${date} ${time}`,
  };

  return text.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(replacements, key)
      ? replacements[key]
      : match;
  });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const applyNoteTemplate = (
  templateId: string | undefined,
  values: NoteTemplateValues,
  templates?: NoteTemplate[],
): AppliedNoteTemplate => {
  const template = getNoteTemplateById(templateId, templates);
  const title = template.titleTemplate
    ? expandNoteTemplateText(template.titleTemplate, values)
    : values.title;
  const content = expandNoteTemplateText(template.content, {
    ...values,
    title,
  });

  return {
    template,
    title,
    content,
    tags: normalizeTagList(template.tags),
  };
};