export interface TagColor {
  name: string;
  foreground: string;
  background: string;
  border: string;
}

export interface TagInfo {
  name: string;
  displayName: string;
  parent: string | null;
  color: TagColor;
  noteUuids: string[];
  checklistUuids: string[];
  totalCount: number;
}

export type TagsIndex = Record<string, TagInfo>;
