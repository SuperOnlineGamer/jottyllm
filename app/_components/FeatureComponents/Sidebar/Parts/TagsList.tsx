"use client";

import { useState } from "react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  GridIcon,
  GridOffIcon,
  PaintBrush04Icon,
} from "hugeicons-react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { DropdownMenu } from "@/app/_components/GlobalComponents/Dropdowns/DropdownMenu";
import { cn } from "@/app/_utils/global-utils";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import {
  TAG_COLOR_PALETTE,
  TagInfo,
  getChildTags,
  buildTagTree,
  getTagColor,
  normalizeTag,
  normalizeTagColorOverrides,
} from "@/app/_utils/tag-utils";
import { updateUserSettings } from "@/app/_server/actions/users";
import { useToast } from "@/app/_providers/ToastProvider";
import { useTranslations } from "next-intl";

interface TagsListProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsedTags: Set<string>;
  toggleTag: (tagPath: string) => void;
  onTagSelect: (tagName: string) => void;
  onClose?: () => void;
}

const TagColorSwatch = ({ color }: { color: string }) => (
  <span
    className="h-4 w-4 rounded-full border border-border"
    style={{ backgroundColor: color }}
  />
);

const TagRenderer = ({
  tag,
  tagsIndex,
  collapsedTags,
  toggleTag,
  onTagSelect,
  onTagColorSelect,
  savingTagColor,
  onClose,
  level = 0,
}: {
  tag: TagInfo;
  tagsIndex: Record<string, TagInfo>;
  collapsedTags: Set<string>;
  toggleTag: (tagPath: string) => void;
  onTagSelect: (tagName: string) => void;
  onTagColorSelect: (tagName: string, color: string | null) => void;
  savingTagColor: string | null;
  onClose?: () => void;
  level?: number;
}) => {
  const t = useTranslations();
  const children = getChildTags(tagsIndex, tag.name);
  const hasContent =
    tag.noteUuids.length > 0 ||
    tag.checklistUuids.length > 0 ||
    children.length > 0;
  const isCollapsed = collapsedTags.has(tag.name);
  const automaticColor = getTagColor(tag.name);
  const isSavingColor = savingTagColor === tag.name;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-md lg:text-sm rounded-jotty transition-colors w-full text-left",
            hasContent ? "hover:bg-muted/50" : "text-muted-foreground",
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasContent) toggleTag(tag.name);
            }}
            className={cn(
              "flex items-center shrink-0",
              hasContent ? "cursor-pointer" : "cursor-default",
            )}
          >
            {hasContent ? (
              isCollapsed ? (
                <ArrowRight01Icon className="h-5 w-5 lg:h-4 lg:w-4" />
              ) : (
                <ArrowDown01Icon className="h-5 w-5 lg:h-4 lg:w-4" />
              )
            ) : (
              <ArrowRight01Icon className="h-5 w-5 lg:h-4 lg:w-4 opacity-20" />
            )}
          </button>
          <button
            onClick={() => onTagSelect(tag.name)}
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          >
            {hasContent ? (
              isCollapsed ? (
                <GridIcon
                  className="h-5 w-5 lg:h-4 lg:w-4 shrink-0"
                  style={{ color: tag.color.foreground }}
                />
              ) : (
                <GridIcon
                  className="h-5 w-5 lg:h-4 lg:w-4 shrink-0 transform -rotate-[20deg]"
                  style={{ color: tag.color.foreground }}
                />
              )
            ) : (
              <GridOffIcon className="h-5 w-5 lg:h-4 lg:w-4 shrink-0" />
            )}
            <span className="truncate font-[500]">{tag.displayName}</span>
            <span
              className="text-md lg:text-xs ml-auto rounded-full border px-1.5 py-0.5 font-medium leading-none"
              style={{
                color: tag.color.foreground,
                backgroundColor: tag.color.background,
                borderColor: tag.color.border,
              }}
            >
              {tag.totalCount}
            </span>
          </button>
          <DropdownMenu
            align="right"
            trigger={
              <Button
                variant="ghost"
                size="xs"
                disabled={isSavingColor}
                aria-label={`${t("editor.customColor")}: ${tag.displayName}`}
                className="h-7 w-7 shrink-0 p-0"
              >
                <PaintBrush04Icon
                  className="h-4 w-4"
                  style={{ color: tag.color.foreground }}
                />
              </Button>
            }
            items={[
              ...TAG_COLOR_PALETTE.map((color) => ({
                type: "item" as const,
                label: color.name,
                icon: <TagColorSwatch color={color.foreground} />,
                onClick: () => onTagColorSelect(tag.name, color.foreground),
              })),
              { type: "divider" as const },
              {
                type: "item" as const,
                label: t("common.reset"),
                icon: <TagColorSwatch color={automaticColor.foreground} />,
                onClick: () => onTagColorSelect(tag.name, null),
              },
            ]}
          />
        </div>
      </div>

      {!isCollapsed && children.length > 0 && (
        <div className="ml-2 border-l border-border/30 pl-2">
          {children.map((childTag) => (
            <TagRenderer
              key={childTag.name}
              tag={childTag}
              tagsIndex={tagsIndex}
              collapsedTags={collapsedTags}
              toggleTag={toggleTag}
              onTagSelect={onTagSelect}
              onTagColorSelect={onTagColorSelect}
              savingTagColor={savingTagColor}
              onClose={onClose}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TagsList = ({
  collapsed,
  onToggleCollapsed,
  collapsedTags,
  toggleTag,
  onTagSelect,
  onClose,
}: TagsListProps) => {
  const t = useTranslations();
  const { tagsIndex, tagsEnabled, user, setUser } = useAppMode();
  const { showToast } = useToast();
  const [savingTagColor, setSavingTagColor] = useState<string | null>(null);

  if (!tagsEnabled) {
    return null;
  }

  const rootTags = buildTagTree(tagsIndex);
  const totalTagCount = Object.keys(tagsIndex).length;

  if (totalTagCount === 0) {
    return null;
  }

  const areAnyTagsCollapsed = rootTags.some((tag) =>
    collapsedTags.has(tag.name),
  );
  const handleToggleAllTags = () => {
    if (areAnyTagsCollapsed) {
      rootTags.forEach((tag) => {
        if (collapsedTags.has(tag.name)) {
          toggleTag(tag.name);
        }
      });
    } else {
      rootTags.forEach((tag) => {
        if (!collapsedTags.has(tag.name)) {
          toggleTag(tag.name);
        }
      });
    }
  };

  const handleTagColorSelect = async (tagName: string, color: string | null) => {
    if (!user) return;

    const normalizedTag = normalizeTag(tagName);
    const nextTagColors = normalizeTagColorOverrides(user.tagColors);

    if (color) {
      nextTagColors[normalizedTag] = color;
    } else {
      delete nextTagColors[normalizedTag];
    }

    setSavingTagColor(normalizedTag);
    const result = await updateUserSettings({ tagColors: nextTagColors });
    setSavingTagColor(null);

    if (result.success && result.data?.user) {
      setUser(result.data.user);
      showToast({
        type: "success",
        title: t("notes.tags"),
        message: `${tagName} ${t("history.actionUpdate").toLowerCase()}`,
      });
    } else {
      showToast({
        type: "error",
        title: t("notes.tags"),
        message: result.error || "Failed to update tag color",
      });
    }
  };

  return (
    <>
      {rootTags.length > 0 && (
        <div className="space-y-1 overflow-hidden">
          <div className="flex items-center justify-between group">
            <button
              onClick={onToggleCollapsed}
              className="jotty-sidebar-tags-title flex items-center gap-1 text-sm lg:text-xs font-bold uppercase text-muted-foreground tracking-wider hover:text-foreground transition-colors"
            >
              {collapsed ? (
                <ArrowRight01Icon className="h-3 w-3" />
              ) : (
                <ArrowDown01Icon className="h-3 w-3" />
              )}
              {t("notes.tags")}
            </button>
            <button
              onClick={handleToggleAllTags}
              className="jotty-sidebar-tags-toggle-all text-sm lg:text-xs font-medium text-primary hover:underline focus:outline-none"
            >
              {areAnyTagsCollapsed
                ? t("common.expandAll")
                : t("common.collapseAll")}
            </button>
          </div>

          {!collapsed && (
            <div>
              {rootTags.map((tag) => (
                <TagRenderer
                  key={tag.name}
                  tag={tag}
                  tagsIndex={tagsIndex}
                  collapsedTags={collapsedTags}
                  toggleTag={toggleTag}
                  onTagSelect={onTagSelect}
                  onTagColorSelect={handleTagColorSelect}
                  savingTagColor={savingTagColor}
                  onClose={onClose}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
