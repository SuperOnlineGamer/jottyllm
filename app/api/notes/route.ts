import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import { getUserNotes, createNote } from "@/app/_server/actions/note";
import {
  matchesNoteSearchQuery,
  parseSearchQuery,
} from "@/app/_utils/search-query-utils";
import { generateNoteRemindersICS } from "@/app/_utils/kanban/calendar-utils";

export const dynamic = "force-dynamic";

const appendTagsToFormData = (formData: FormData, tags: unknown) => {
  if (tags === undefined) return;
  formData.append("tags", Array.isArray(tags) ? JSON.stringify(tags) : String(tags));
};

const transformNoteForApi = (note: any, fallbackContent?: string) => ({
  id: note?.uuid || note?.id,
  title: note?.title,
  category: note?.category || "Uncategorized",
  content: note?.content || fallbackContent || "",
  tags: note?.tags || [],
  reminders: note?.reminders || [],
  linkedTasks: note?.linkedTasks || [],
  comments: note?.comments || [],
  encrypted: Boolean(note?.encrypted),
  createdAt: note?.createdAt,
  updatedAt: note?.updatedAt,
  owner: note?.owner,
});

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get("category");
      const search = searchParams.get("q") || "";
      const tag = searchParams.get("tag");
      const color = searchParams.get("color");
      const created = searchParams.get("created");
      const updated = searchParams.get("updated");
      const reminder = searchParams.get("reminder");
      const due = searchParams.get("due");
      const format = searchParams.get("format");
      const structuredQuery = [
        search,
        tag ? `tag:"${tag.replace(/"/g, "")}"` : "",
        color ? `color:"${color.replace(/"/g, "")}"` : "",
        created ? `created:"${created.replace(/"/g, "")}"` : "",
        updated ? `updated:"${updated.replace(/"/g, "")}"` : "",
        reminder ? `reminder:"${reminder.replace(/"/g, "")}"` : "",
        due ? `due:"${due.replace(/"/g, "")}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const parsedQuery = parseSearchQuery(structuredQuery);

      const notes = await getUserNotes({ username: user.username });
      if (!notes.success || !notes.data) {
        return NextResponse.json(
          { error: notes.error || "Failed to fetch notes" },
          { status: 500 }
        );
      }

      let filteredNotes = notes.data;

      if (category) {
        filteredNotes = filteredNotes.filter(
          (note) => note.category === category
        );
      }
      if (structuredQuery.trim()) {
        filteredNotes = filteredNotes.filter((note) =>
          matchesNoteSearchQuery(note, parsedQuery, user.tagColors),
        );
      }

      const accept = request.headers.get("accept") || "";
      if (format === "ics" || accept.includes("text/calendar")) {
        const ics = generateNoteRemindersICS(filteredNotes, "Jotty Note Reminders");
        return new NextResponse(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="jotty-note-reminders.ics"',
          },
        });
      }

      const transformedNotes = filteredNotes.map((note) =>
        transformNoteForApi(note),
      );

      return NextResponse.json({ notes: transformedNotes });
    } catch (error) {
      console.error("API Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    try {
      const body = await request.json();
      const {
        title,
        content = "",
        category = "Uncategorized",
        tags,
      } = body;

      if (!title) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("rawContent", content);
      formData.append("category", category);
      formData.append("user", JSON.stringify(user));
      appendTagsToFormData(formData, tags);

      const result = await createNote(formData);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const transformedNote = transformNoteForApi(result.data, content);

      return NextResponse.json({ success: true, data: transformedNote });
    } catch (error) {
      console.error("API Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
