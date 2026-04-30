import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import { getUserNotes, updateNote, deleteNote } from "@/app/_server/actions/note";

export const dynamic = "force-dynamic";

const appendTagsToFormData = (formData: FormData, tags: unknown) => {
    if (tags === undefined) return;
    formData.append("tags", Array.isArray(tags) ? JSON.stringify(tags) : String(tags));
};

const transformNoteForApi = (note: any) => ({
    id: note?.uuid || note?.id,
    title: note?.title,
    category: note?.category || "Uncategorized",
    content: note?.content || "",
    tags: note?.tags || [],
    reminders: note?.reminders || [],
    linkedTasks: note?.linkedTasks || [],
    comments: note?.comments || [],
    encrypted: Boolean(note?.encrypted),
    createdAt: note?.createdAt,
    updatedAt: note?.updatedAt,
    owner: note?.owner,
});

const getExpectedUpdatedAt = (request: NextRequest, body: any): string => {
    const headerValue = request.headers.get("if-unmodified-since") || "";
    return String(body?.expectedUpdatedAt || headerValue || "").trim();
};

const getApiNote = async (noteId: string, username: string) => {
    const notes = await getUserNotes({ username });

    if (!notes.success || !notes.data) {
        return { error: "Failed to fetch notes" };
    }

    return {
        note: notes.data.find((note: any) => note.uuid === noteId || note.id === noteId),
    };
};

export async function GET(request: NextRequest, props: { params: Promise<{ noteId: string }> }) {
    const params = await props.params;
    return withApiAuth(request, async (user) => {
        try {
            const noteResult = await getApiNote(params.noteId, user.username);

            if (noteResult.error) {
                return NextResponse.json({ error: noteResult.error }, { status: 500 });
            }

            const note = noteResult.note;

            if (!note) {
                return NextResponse.json({ error: "Note not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: transformNoteForApi(note),
            });
        } catch (error) {
            console.error("API Error:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 }
            );
        }
    });
}

export async function PUT(request: NextRequest, props: { params: Promise<{ noteId: string }> }) {
    const params = await props.params;
    return withApiAuth(request, async (user) => {
        try {
            const body = await request.json();
            const { title, content, category, tags } = body;

            const noteResult = await getApiNote(params.noteId, user.username);

            if (noteResult.error) {
                return NextResponse.json({ error: noteResult.error }, { status: 500 });
            }

            const note = noteResult.note;
            if (!note) {
                return NextResponse.json({ error: "Note not found" }, { status: 404 });
            }

            const expectedUpdatedAt = getExpectedUpdatedAt(request, body);
            if (expectedUpdatedAt && note.updatedAt && expectedUpdatedAt !== note.updatedAt) {
                return NextResponse.json(
                    {
                        error: "Note has changed since it was read",
                        currentUpdatedAt: note.updatedAt,
                    },
                    { status: 409 }
                );
            }

            const formData = new FormData();
            formData.append("id", note.id || "");
            formData.append("uuid", params.noteId);
            formData.append("title", title ?? note.title);
            formData.append("content", content ?? note.content ?? "");
            formData.append("category", category ?? note.category ?? "Uncategorized");
            formData.append("originalCategory", note.category || "Uncategorized");
            formData.append("user", user.username);
            appendTagsToFormData(formData, tags);

            const result = await updateNote(formData);
            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }

            const transformedNote = transformNoteForApi(result.data);

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

export async function DELETE(request: NextRequest, props: { params: Promise<{ noteId: string }> }) {
    const params = await props.params;
    return withApiAuth(request, async (user) => {
        try {
            const noteResult = await getApiNote(params.noteId, user.username);

            if (noteResult.error) {
                return NextResponse.json({ error: noteResult.error }, { status: 500 });
            }

            const note = noteResult.note;
            if (!note) {
                return NextResponse.json({ error: "Note not found" }, { status: 404 });
            }

            const formData = new FormData();
            formData.append("id", note.id || "");
            formData.append("category", note.category || "Uncategorized");

            const result = await deleteNote(formData, user.username);
            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error("API Error:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 }
            );
        }
    });
}
