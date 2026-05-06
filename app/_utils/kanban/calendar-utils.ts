import { Item, Note, NoteReminder } from "@/app/_types";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  status?: string;
  priority?: string;
  completed: boolean;
  itemId: string;
}

export interface NoteReminderCalendarEvent {
  id: string;
  title: string;
  date: string;
  status: NoteReminder["status"];
  completed: boolean;
  noteId: string;
  noteTitle: string;
  category: string;
}

export const parseItemsForCalendar = (items: Item[]): CalendarEvent[] =>
  items
    .filter((item) => item.targetDate && !item.isArchived)
    .map((item) => ({
      id: item.id,
      title: item.text,
      date: item.targetDate!,
      status: item.status,
      priority: item.priority,
      completed: item.completed,
      itemId: item.id,
    }));

export const parseNotesForReminderCalendar = (
  notes: Partial<Note>[],
): NoteReminderCalendarEvent[] =>
  notes.flatMap((note) => {
    const reminders = Array.isArray(note.reminders) ? note.reminders : [];
    const noteTitle = note.title || note.id || "Untitled Note";
    const noteId = note.uuid || note.id || noteTitle;

    return reminders
      .filter((reminder) => reminder.dueAt)
      .map((reminder) => ({
        id: reminder.id,
        title: reminder.title || noteTitle,
        date: reminder.dueAt,
        status: reminder.status,
        completed: reminder.status === "done",
        noteId,
        noteTitle,
        category: note.category || "Uncategorized",
      }));
  });

const _escapeICS = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const _formatICSDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

export const generateVEVENT = (item: Item, boardTitle: string): string => {
  if (!item.targetDate) return "";

  const dtstart = _formatICSDate(item.targetDate);
  const dtend = _formatICSDate(
    new Date(new Date(item.targetDate).getTime() + 3600000).toISOString()
  );
  const now = _formatICSDate(new Date().toISOString());

  const lines = [
    "BEGIN:VEVENT",
    `UID:${item.id}@jotty`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${_escapeICS(item.text)}`,
    `DESCRIPTION:${_escapeICS(`Board: ${boardTitle}${item.description ? `\\n${item.description}` : ""}`)}`,
    item.status ? `STATUS:${item.completed ? "COMPLETED" : "NEEDS-ACTION"}` : "",
    "END:VEVENT",
  ];

  return lines.filter(Boolean).join("\r\n");
};

export const generateICS = (items: Item[], boardTitle: string): string => {
  const events = items
    .filter((item) => item.targetDate && !item.isArchived)
    .map((item) => generateVEVENT(item, boardTitle))
    .filter(Boolean);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jotty//Kanban//EN",
    `X-WR-CALNAME:${_escapeICS(boardTitle)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
};

export const generateNoteReminderVEVENT = (
  note: Partial<Note>,
  reminder: NoteReminder,
): string => {
  if (!reminder.dueAt) return "";

  const noteTitle = note.title || note.id || "Untitled Note";
  const noteId = note.uuid || note.id || noteTitle;
  const category = note.category || "Uncategorized";
  const dtstart = _formatICSDate(reminder.dueAt);
  const dtend = _formatICSDate(
    new Date(new Date(reminder.dueAt).getTime() + 1800000).toISOString(),
  );
  const now = _formatICSDate(new Date().toISOString());
  let status = "NEEDS-ACTION";
  if (reminder.status === "dismissed") status = "CANCELLED";
  if (reminder.status === "done") status = "COMPLETED";

  const lines = [
    "BEGIN:VEVENT",
    `UID:${noteId}-${reminder.id}@jotty-note-reminders`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${_escapeICS(reminder.title || noteTitle)}`,
    `DESCRIPTION:${_escapeICS(`Note: ${noteTitle}\nCategory: ${category}`)}`,
    `STATUS:${status}`,
    "END:VEVENT",
  ];

  return lines.join("\r\n");
};

export const generateNoteRemindersICS = (
  notes: Partial<Note>[],
  calendarTitle = "Jotty Note Reminders",
): string => {
  const events = notes
    .flatMap((note) =>
      (Array.isArray(note.reminders) ? note.reminders : []).map((reminder) =>
        generateNoteReminderVEVENT(note, reminder),
      ),
    )
    .filter(Boolean);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jotty//Note Reminders//EN",
    `X-WR-CALNAME:${_escapeICS(calendarTitle)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
};

export const getItemsGroupedByDate = (items: Item[]): Record<string, Item[]> => {
  const grouped: Record<string, Item[]> = {};

  items
    .filter((item) => item.targetDate && !item.isArchived)
    .forEach((item) => {
      const date = item.targetDate!.split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });

  return grouped;
};

export const getDaysInMonth = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const getCalendarGrid = (year: number, month: number): (Date | null)[][] => {
  const days = getDaysInMonth(year, month);
  const firstDay = days[0].getDay();
  const grid: (Date | null)[][] = [];
  let week: (Date | null)[] = new Array(firstDay).fill(null);

  days.forEach((day) => {
    week.push(day);
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  });

  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    grid.push(week);
  }

  return grid;
};
