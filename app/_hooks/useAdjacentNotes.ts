"use client";

import { useMemo } from "react";
import { Note } from "@/app/_types";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { tagMatchesFilter } from "@/app/_utils/tag-utils";

interface AdjacentNotesResult {
  prev: Partial<Note> | null;
  next: Partial<Note> | null;
  currentIndex: number;
  total: number;
}

const matchesReminderFilter = (note: Partial<Note>, filterValue: string) => {
  const reminders = Array.isArray(note.reminders) ? note.reminders : [];
  const now = Date.now();

  if (filterValue === "any") return reminders.length > 0;
  if (filterValue === "overdue") {
    return reminders.some((reminder) => {
      const dueTime = Date.parse(reminder.dueAt);
      return reminder.status === "pending" && Number.isFinite(dueTime) && dueTime < now;
    });
  }
  if (filterValue === "upcoming") {
    return reminders.some((reminder) => {
      const dueTime = Date.parse(reminder.dueAt);
      return reminder.status === "pending" && Number.isFinite(dueTime) && dueTime >= now;
    });
  }
  if (["pending", "done", "dismissed"].includes(filterValue)) {
    return reminders.some((reminder) => reminder.status === filterValue);
  }
  return false;
};

export const useAdjacentNotes = (currentId: string): AdjacentNotesResult => {
  const { notes, selectedFilter } = useAppMode();

  return useMemo(() => {
    let filteredNotes = notes;

    if (selectedFilter?.type === "category" && selectedFilter.value) {
      filteredNotes = notes.filter(
        (n) => n.category === selectedFilter.value,
      );
    } else if (selectedFilter?.type === "tag" && selectedFilter.value) {
      filteredNotes = notes.filter((n) =>
        n.tags?.some((tag) => tagMatchesFilter(tag, selectedFilter.value)),
      );
    } else if (selectedFilter?.type === "reminder" && selectedFilter.value) {
      filteredNotes = notes.filter((note) =>
        matchesReminderFilter(note, selectedFilter.value),
      );
    }

    const currentIndex = filteredNotes.findIndex((n) => n.id === currentId);

    if (currentIndex === -1) {
      return { prev: null, next: null, currentIndex: -1, total: filteredNotes.length };
    }

    return {
      prev: currentIndex > 0 ? filteredNotes[currentIndex - 1] : null,
      next: currentIndex < filteredNotes.length - 1 ? filteredNotes[currentIndex + 1] : null,
      currentIndex,
      total: filteredNotes.length,
    };
  }, [notes, selectedFilter, currentId]);
};
