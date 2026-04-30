"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Add01Icon, Cancel01Icon } from "hugeicons-react";
import { useTranslations } from "next-intl";
import { cn } from "@/app/_utils/global-utils";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import {
  getDisplayName,
  getTagColor,
  isValidTagName,
  normalizeTag,
  normalizeTagList,
} from "@/app/_utils/tag-utils";
import type { TagColor } from "@/app/_types";

interface TagChipProps {
  tag: string;
  displayName?: string;
  color?: TagColor;
  selected?: boolean;
  onClick?: (tag: string) => void;
  className?: string;
  compact?: boolean;
}

interface NoteTagChipsProps {
  tags?: string[];
  maxVisible?: number;
  className?: string;
  compact?: boolean;
  interactive?: boolean;
}

interface NoteTagEditorProps {
  tags: string[];
  isEditing: boolean;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const TagChip = ({
  tag,
  displayName,
  color,
  selected = false,
  onClick,
  className,
  compact = false,
}: TagChipProps) => {
  const normalizedTag = normalizeTag(tag);
  const tagColor = color ?? getTagColor(normalizedTag);
  const label = displayName ?? getDisplayName(normalizedTag);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(normalizedTag);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border font-medium leading-none transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        selected && "ring-2 ring-ring ring-offset-1",
        !onClick && "cursor-default",
        className,
      )}
      style={{
        color: tagColor.foreground,
        backgroundColor: tagColor.background,
        borderColor: tagColor.border,
      }}
      aria-label={`Filter by #${normalizedTag}`}
      disabled={!onClick}
    >
      <span className="truncate">#{label}</span>
    </button>
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const NoteTagChips = ({
  tags,
  maxVisible = 4,
  className,
  compact = false,
  interactive = true,
}: NoteTagChipsProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedFilter, setSelectedFilter, tagsIndex, user } = useAppMode();

  const normalizedTags = useMemo(() => {
    const uniqueTags = new Set<string>();
    for (const tag of tags || []) {
      const normalizedTag = normalizeTag(tag);
      if (normalizedTag) uniqueTags.add(normalizedTag);
    }
    return Array.from(uniqueTags);
  }, [tags]);

  if (normalizedTags.length === 0) return null;

  const visibleTags = normalizedTags.slice(0, maxVisible);
  const hiddenCount = normalizedTags.length - visibleTags.length;

  const handleTagSelect = (tag: string) => {
    if (!interactive) return;

    const isSelected =
      selectedFilter?.type === "tag" &&
      normalizeTag(selectedFilter.value) === tag;
    setSelectedFilter(isSelected ? null : { type: "tag", value: tag });

    if (pathname !== "/" && pathname !== "") {
      router.push(`/?mode=tags&tag=${encodeURIComponent(tag)}`);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {visibleTags.map((tag) => {
        const tagInfo = tagsIndex[tag];
        const selected =
          selectedFilter?.type === "tag" &&
          normalizeTag(selectedFilter.value) === tag;

        return (
          <TagChip
            key={tag}
            tag={tag}
            displayName={tagInfo?.displayName}
            color={tagInfo?.color ?? getTagColor(tag, user?.tagColors)}
            selected={selected}
            compact={compact}
            onClick={interactive ? handleTagSelect : undefined}
          />
        );
      })}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const NoteTagEditor = ({
  tags,
  isEditing,
  onAddTag,
  onRemoveTag,
  className,
  disabled = false,
}: NoteTagEditorProps) => {
  const t = useTranslations();
  const { tagsIndex, user } = useAppMode();
  const [draftTag, setDraftTag] = useState("");
  const normalizedTags = useMemo(() => normalizeTagList(tags), [tags]);

  if (!isEditing) {
    return (
      <NoteTagChips
        tags={normalizedTags}
        maxVisible={8}
        compact
        className={className}
      />
    );
  }

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextTag = normalizeTag(draftTag);
    if (!isValidTagName(nextTag)) return;

    onAddTag(nextTag);
    setDraftTag("");
  };

  const suggestionId = "note-tag-suggestions";

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {normalizedTags.map((tag) => {
        const tagInfo = tagsIndex[tag];
        const tagColor = tagInfo?.color ?? getTagColor(tag, user?.tagColors);

        return (
          <span
            key={tag}
            className="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium leading-none"
            style={{
              color: tagColor.foreground,
              backgroundColor: tagColor.background,
              borderColor: tagColor.border,
            }}
          >
            <span className="truncate">#{tagInfo?.displayName ?? getDisplayName(tag)}</span>
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              disabled={disabled}
              className="rounded-full p-0.5 transition-colors hover:bg-background/60 disabled:pointer-events-none disabled:opacity-50"
              aria-label={`${t("common.remove")} #${tag}`}
            >
              <Cancel01Icon className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <form onSubmit={handleSubmit} className="flex min-w-32 items-center gap-1">
        <input
          type="text"
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === ",") {
              event.preventDefault();
              handleSubmit();
            }
          }}
          list={suggestionId}
          disabled={disabled}
          placeholder={t("notes.addTag")}
          className="h-8 min-w-24 flex-1 rounded-jotty border border-input bg-background px-2 text-md lg:text-sm outline-none transition-colors focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !isValidTagName(draftTag)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-jotty border border-input bg-background text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          aria-label={t("common.add")}
        >
          <Add01Icon className="h-4 w-4" />
        </button>
        <datalist id={suggestionId}>
          {Object.values(tagsIndex).map((tagInfo) => (
            <option key={tagInfo.name} value={tagInfo.name} />
          ))}
        </datalist>
      </form>
    </div>
  );
};