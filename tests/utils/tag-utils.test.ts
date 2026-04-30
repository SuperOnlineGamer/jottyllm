import { afterEach, describe, it, expect, vi } from "vitest";
import {
  normalizeTag,
  getAncestorTags,
  getParentTag,
  getDisplayName,
  getTagColor,
  normalizeTagList,
  buildTagsIndex,
  extractHashtagsFromContent,
  tagMatchesFilter,
  getAllUniqueTags,
  buildTagTree,
  getChildTags,
  normalizeTagColorOverrides,
} from "@/app/_utils/tag-utils";
import {
  matchesNoteSearchQuery,
  parseSearchQuery,
} from "@/app/_utils/search-query-utils";
import {
  applyNoteTemplate,
  getAvailableNoteTemplates,
} from "@/app/_utils/note-template-utils";
import { normalizeEditorAiSettings } from "@/app/_utils/ai-settings-utils";
import { createOpenAiProvider } from "@/app/_server/ai/providers/openai";

const originalFetch = globalThis.fetch;

const createOpenAiStreamResponse = () => {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200 },
  );
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Tag Utils", () => {
  describe("normalizeTag", () => {
    it("should lowercase tags", () => {
      expect(normalizeTag("MyTag")).toBe("mytag");
    });

    it("should trim whitespace", () => {
      expect(normalizeTag("  tag  ")).toBe("tag");
    });

    it("should remove leading hash", () => {
      expect(normalizeTag("#hashtag")).toBe("hashtag");
    });

    it("should handle combined cases", () => {
      expect(normalizeTag("  #MyTag  ")).toBe("mytag");
    });

    it("should handle nested tags", () => {
      expect(normalizeTag("#work/project")).toBe("work/project");
    });
  });

  describe("normalizeTagList", () => {
    it("should normalize and sort tag lists", () => {
      expect(normalizeTagList(["#Work", "personal", "work"])).toEqual([
        "personal",
        "work",
      ]);
    });

    it("should remove invalid tag names", () => {
      expect(normalizeTagList(["work", "bad//tag", "bad/"])).toEqual([
        "work",
      ]);
    });
  });

  describe("getAncestorTags", () => {
    it("should return empty array for root tags", () => {
      expect(getAncestorTags("work")).toEqual([]);
    });

    it("should return parent for nested tags", () => {
      expect(getAncestorTags("work/project")).toEqual(["work"]);
    });

    it("should return all ancestors for deeply nested tags", () => {
      expect(getAncestorTags("work/project/2024")).toEqual([
        "work",
        "work/project",
      ]);
    });

    it("should return correct ancestors for very deep nesting", () => {
      expect(getAncestorTags("a/b/c/d")).toEqual(["a", "a/b", "a/b/c"]);
    });
  });

  describe("getParentTag", () => {
    it("should return null for root tags", () => {
      expect(getParentTag("work")).toBeNull();
    });

    it("should return parent for nested tags", () => {
      expect(getParentTag("work/project")).toBe("work");
    });

    it("should return immediate parent for deeply nested tags", () => {
      expect(getParentTag("work/project/2024")).toBe("work/project");
    });
  });

  describe("getDisplayName", () => {
    it("should return tag name for root tags", () => {
      expect(getDisplayName("work")).toBe("work");
    });

    it("should return last segment for nested tags", () => {
      expect(getDisplayName("work/project")).toBe("project");
    });

    it("should return last segment for deeply nested tags", () => {
      expect(getDisplayName("work/project/2024")).toBe("2024");
    });
  });

  describe("getTagColor", () => {
    it("should return stable colors for the same tag", () => {
      expect(getTagColor("work")).toEqual(getTagColor("work"));
    });

    it("should normalize tags before choosing colors", () => {
      expect(getTagColor("#Work")).toEqual(getTagColor("work"));
    });

    it("should keep nested tags in the same color family as their root tag", () => {
      expect(getTagColor("work/project")).toEqual(getTagColor("work"));
    });

    it("should use exact custom colors before root custom colors", () => {
      expect(
        getTagColor("work/project", {
          work: "#22c55e",
          "work/project": "#ef4444",
        }).foreground,
      ).toBe("#ef4444");
    });

    it("should use root custom colors for nested tags", () => {
      expect(getTagColor("work/project", { work: "#22c55e" }).foreground).toBe(
        "#22c55e",
      );
    });
  });

  describe("normalizeTagColorOverrides", () => {
    it("should normalize tag keys and color values", () => {
      expect(normalizeTagColorOverrides({ "#Work": "#EF4444" })).toEqual({
        work: "#ef4444",
      });
    });

    it("should remove invalid tag colors", () => {
      expect(
        normalizeTagColorOverrides({ work: "red", project: "#22c55e" }),
      ).toEqual({ project: "#22c55e" });
    });
  });

  describe("extractHashtagsFromContent", () => {
    it("should extract simple hashtags", () => {
      const content = "This is a #test note";
      expect(extractHashtagsFromContent(content)).toContain("test");
    });

    it("should extract multiple hashtags", () => {
      const content = "Note with #tag1 and #tag2";
      const tags = extractHashtagsFromContent(content);
      expect(tags).toContain("tag1");
      expect(tags).toContain("tag2");
    });

    it("should extract nested hashtags", () => {
      const content = "Project #work/development";
      expect(extractHashtagsFromContent(content)).toContain("work/development");
    });

    it("should extract data-tag attributes", () => {
      const content = '<span data-tag="important">Tag</span>';
      expect(extractHashtagsFromContent(content)).toContain("important");
    });

    it("should normalize extracted tags", () => {
      const content = "Testing #MyUpperTag";
      expect(extractHashtagsFromContent(content)).toContain("myuppertag");
    });

    it("should ignore hashtags in code blocks", () => {
      const content = "Text ```code #notag``` more text #realtag";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("notag");
      expect(tags).toContain("realtag");
    });

    it("should ignore hashtags in inline code", () => {
      const content = "Text `#notag` more text #realtag";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("notag");
      expect(tags).toContain("realtag");
    });

    it("should deduplicate tags", () => {
      const content = "#tag #tag #tag";
      const tags = extractHashtagsFromContent(content);
      expect(tags.filter((t) => t === "tag")).toHaveLength(1);
    });

    it("should reject invalid tag formats with double slashes", () => {
      const content = "#invalid//tag #valid";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("invalid//tag");
      expect(tags).toContain("valid");
    });

    it("should reject tags ending with slash", () => {
      const content = "#invalid/ #valid";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("invalid/");
      expect(tags).toContain("valid");
    });

    it("should handle tags at start of line", () => {
      const content = "#starttag\nsome text";
      expect(extractHashtagsFromContent(content)).toContain("starttag");
    });

    it("should handle tags after whitespace", () => {
      const content = "text    #spacedtag";
      expect(extractHashtagsFromContent(content)).toContain("spacedtag");
    });

    it("should handle tags after parenthesis", () => {
      const content = "text (#parentag)";
      expect(extractHashtagsFromContent(content)).toContain("parentag");
    });

    it("should extract tags with underscores", () => {
      const content = "#my_tag";
      expect(extractHashtagsFromContent(content)).toContain("my_tag");
    });

    it("should extract tags with numbers", () => {
      const content = "#tag123";
      expect(extractHashtagsFromContent(content)).toContain("tag123");
    });

    it("should ignore tags in pre tags", () => {
      const content = "Text <pre>#notag</pre> more #realtag";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("notag");
      expect(tags).toContain("realtag");
    });

    it("should ignore tags in code tags", () => {
      const content = "Text <code>#notag</code> more #realtag";
      const tags = extractHashtagsFromContent(content);
      expect(tags).not.toContain("notag");
      expect(tags).toContain("realtag");
    });

    it("should return empty array for content without tags", () => {
      const content = "This is a note without any tags";
      expect(extractHashtagsFromContent(content)).toEqual([]);
    });
  });

  describe("buildTagsIndex", () => {
    it("should build index from notes with tags", () => {
      const notes = [
        { uuid: "note1", tags: ["work", "project"] },
        { uuid: "note2", tags: ["work"] },
      ];
      const index = buildTagsIndex(notes);

      expect(index["work"]).toBeDefined();
      expect(index["project"]).toBeDefined();
    });

    it("should track note UUIDs per tag", () => {
      const notes = [
        { uuid: "note1", tags: ["work"] },
        { uuid: "note2", tags: ["work"] },
      ];
      const index = buildTagsIndex(notes);

      expect(index["work"].noteUuids).toContain("note1");
      expect(index["work"].noteUuids).toContain("note2");
    });

    it("should not duplicate UUIDs", () => {
      const notes = [{ uuid: "note1", tags: ["work", "work"] }];
      const index = buildTagsIndex(notes);

      expect(index["work"].noteUuids).toHaveLength(1);
    });

    it("should create parent tags for nested tags", () => {
      const notes = [{ uuid: "note1", tags: ["work/project"] }];
      const index = buildTagsIndex(notes);

      expect(index["work"]).toBeDefined();
      expect(index["work/project"]).toBeDefined();
    });

    it("should set correct parent references", () => {
      const notes = [{ uuid: "note1", tags: ["work/project/2024"] }];
      const index = buildTagsIndex(notes);

      expect(index["work/project/2024"].parent).toBe("work/project");
      expect(index["work/project"].parent).toBe("work");
      expect(index["work"].parent).toBeNull();
    });

    it("should calculate total count including descendants", () => {
      const notes = [
        { uuid: "note1", tags: ["work"] },
        { uuid: "note2", tags: ["work/project"] },
      ];
      const index = buildTagsIndex(notes);

      expect(index["work"].totalCount).toBe(2);
      expect(index["work/project"].totalCount).toBe(1);
    });

    it("should skip notes without tags", () => {
      const notes = [
        { uuid: "note1" },
        { uuid: "note2", tags: ["work"] },
      ];
      const index = buildTagsIndex(notes);

      expect(Object.keys(index)).toHaveLength(1);
      expect(index["work"]).toBeDefined();
    });

    it("should skip notes without uuid", () => {
      const notes = [
        { tags: ["orphan"] },
        { uuid: "note2", tags: ["work"] },
      ];
      const index = buildTagsIndex(notes);

      expect(index["orphan"]).toBeUndefined();
      expect(index["work"]).toBeDefined();
    });

    it("should skip empty tags after normalization", () => {
      const notes = [{ uuid: "note1", tags: ["", "valid"] }];
      const index = buildTagsIndex(notes);

      expect(index[""]).toBeUndefined();
      expect(index["valid"]).toBeDefined();
    });

    it("should set correct display names", () => {
      const notes = [{ uuid: "note1", tags: ["work/project"] }];
      const index = buildTagsIndex(notes);

      expect(index["work"].displayName).toBe("work");
      expect(index["work/project"].displayName).toBe("project");
    });

    it("should attach deterministic color metadata to each tag", () => {
      const notes = [{ uuid: "note1", tags: ["work/project"] }];
      const index = buildTagsIndex(notes);

      expect(index["work"].color).toEqual(getTagColor("work"));
      expect(index["work/project"].color).toEqual(getTagColor("work/project"));
    });

    it("should use custom tag colors when building the index", () => {
      const notes = [{ uuid: "note1", tags: ["work/project"] }];
      const index = buildTagsIndex(notes, [], { work: "#22c55e" });

      expect(index["work"].color.foreground).toBe("#22c55e");
      expect(index["work/project"].color.foreground).toBe("#22c55e");
    });
  });

  describe("tagMatchesFilter", () => {
    it("should match exact tags", () => {
      expect(tagMatchesFilter("work", "work")).toBe(true);
    });

    it("should match child tags", () => {
      expect(tagMatchesFilter("work/project", "work")).toBe(true);
    });

    it("should not match parent tags", () => {
      expect(tagMatchesFilter("work", "work/project")).toBe(false);
    });

    it("should not match unrelated tags", () => {
      expect(tagMatchesFilter("personal", "work")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(tagMatchesFilter("Work", "work")).toBe(true);
    });

    it("should handle tags with leading hash", () => {
      expect(tagMatchesFilter("#work", "work")).toBe(true);
    });

    it("should handle filters with leading hash", () => {
      expect(tagMatchesFilter("Work/Project", "#work")).toBe(true);
    });

    it("should match deeply nested children", () => {
      expect(tagMatchesFilter("work/project/2024/q1", "work")).toBe(true);
    });

    it("should not match similar but different tags", () => {
      expect(tagMatchesFilter("working", "work")).toBe(false);
    });
  });

  describe("getAllUniqueTags", () => {
    it("should return all unique tags from notes", () => {
      const notes = [
        { tags: ["work", "project"] },
        { tags: ["work", "personal"] },
      ];
      const tags = getAllUniqueTags(notes);

      expect(tags).toContain("work");
      expect(tags).toContain("project");
      expect(tags).toContain("personal");
    });

    it("should deduplicate tags", () => {
      const notes = [{ tags: ["work"] }, { tags: ["work"] }];
      const tags = getAllUniqueTags(notes);

      expect(tags.filter((t) => t === "work")).toHaveLength(1);
    });

    it("should normalize tags", () => {
      const notes = [{ tags: ["Work"] }, { tags: ["WORK"] }];
      const tags = getAllUniqueTags(notes);

      expect(tags).toHaveLength(1);
      expect(tags[0]).toBe("work");
    });

    it("should return sorted tags", () => {
      const notes = [{ tags: ["zebra", "alpha", "middle"] }];
      const tags = getAllUniqueTags(notes);

      expect(tags).toEqual(["alpha", "middle", "zebra"]);
    });

    it("should handle notes without tags", () => {
      const notes = [{ tags: ["work"] }, {}];
      const tags = getAllUniqueTags(notes);

      expect(tags).toEqual(["work"]);
    });

    it("should return empty array for no tags", () => {
      const notes = [{}, {}];
      const tags = getAllUniqueTags(notes);

      expect(tags).toEqual([]);
    });
  });

  describe("buildTagTree", () => {
    it("should return only root tags", () => {
      const notes = [
        { uuid: "note1", tags: ["work", "personal"] },
        { uuid: "note2", tags: ["work/project"] },
      ];
      const index = buildTagsIndex(notes);
      const tree = buildTagTree(index);

      expect(tree.map((t) => t.name)).toContain("work");
      expect(tree.map((t) => t.name)).toContain("personal");
      expect(tree.map((t) => t.name)).not.toContain("work/project");
    });

    it("should sort root tags alphabetically", () => {
      const notes = [{ uuid: "note1", tags: ["zebra", "alpha", "middle"] }];
      const index = buildTagsIndex(notes);
      const tree = buildTagTree(index);

      expect(tree[0].name).toBe("alpha");
      expect(tree[1].name).toBe("middle");
      expect(tree[2].name).toBe("zebra");
    });

    it("should return empty array for empty index", () => {
      const tree = buildTagTree({});
      expect(tree).toEqual([]);
    });
  });

  describe("getChildTags", () => {
    it("should return direct children only", () => {
      const notes = [
        { uuid: "note1", tags: ["work/project", "work/meetings"] },
        { uuid: "note2", tags: ["work/project/2024"] },
      ];
      const index = buildTagsIndex(notes);
      const children = getChildTags(index, "work");

      expect(children.map((t) => t.name)).toContain("work/project");
      expect(children.map((t) => t.name)).toContain("work/meetings");
      expect(children.map((t) => t.name)).not.toContain("work/project/2024");
    });

    it("should sort children alphabetically", () => {
      const notes = [
        { uuid: "note1", tags: ["work/zebra", "work/alpha", "work/middle"] },
      ];
      const index = buildTagsIndex(notes);
      const children = getChildTags(index, "work");

      expect(children[0].name).toBe("work/alpha");
      expect(children[1].name).toBe("work/middle");
      expect(children[2].name).toBe("work/zebra");
    });

    it("should return empty array for tags without children", () => {
      const notes = [{ uuid: "note1", tags: ["work"] }];
      const index = buildTagsIndex(notes);
      const children = getChildTags(index, "work");

      expect(children).toEqual([]);
    });

    it("should return empty array for non-existent parent", () => {
      const notes = [{ uuid: "note1", tags: ["work"] }];
      const index = buildTagsIndex(notes);
      const children = getChildTags(index, "nonexistent");

      expect(children).toEqual([]);
    });
  });

  describe("Search Query Utils", () => {
    it("should parse text, phrases, and structured filters", () => {
      const query = parseSearchQuery(
        'meeting "budget review" tag:work category:"Team Notes" updated:2026-04-01..2026-04-30 color:emerald',
      );

      expect(query.textTerms).toEqual(["meeting"]);
      expect(query.phrases).toEqual(["budget review"]);
      expect(query.tags).toEqual(["work"]);
      expect(query.categories).toEqual(["Team Notes"]);
      expect(query.colors).toEqual(["emerald"]);
      expect(query.updated).toEqual({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
      });
      expect(query.hasStructuredFilters).toBe(true);
    });

    it("should match note metadata and unencrypted content", () => {
      const query = parseSearchQuery('"launch plan" tag:work created:2026-04-30');
      const note = {
        title: "Project",
        content: "The launch plan is ready.",
        category: "Work",
        tags: ["work/project"],
        createdAt: "2026-04-30T12:00:00.000Z",
        updatedAt: "2026-04-30T12:00:00.000Z",
      };

      expect(matchesNoteSearchQuery(note, query)).toBe(true);
    });

    it("should not search encrypted note body content", () => {
      const query = parseSearchQuery('"secret body"');
      const note = {
        title: "Visible title",
        content: "secret body",
        encrypted: true,
      };

      expect(matchesNoteSearchQuery(note, query)).toBe(false);
    });

    it("should match note reminders by status and due date", () => {
      const query = parseSearchQuery("reminder:pending due:2026-04-30");
      const note = {
        title: "Invoice follow-up",
        content: "Call the vendor",
        reminders: [
          {
            id: "reminder-1",
            dueAt: "2026-04-30T18:04:00.000Z",
            status: "pending" as const,
            createdAt: "2026-04-30T12:00:00.000Z",
          },
        ],
      };

      expect(matchesNoteSearchQuery(note, query)).toBe(true);
      expect(matchesNoteSearchQuery(note, parseSearchQuery("reminder:done"))).toBe(false);
    });
  });

  describe("Note Template Utils", () => {
    it("should expand variables in selected templates", () => {
      const result = applyNoteTemplate("daily-log", {
        title: "Daily Log",
        category: "Journal",
        username: "testuser",
        now: new Date("2026-04-30T14:30:00.000Z"),
      });

      expect(result.title).toBe("Daily Log - 2026-04-30");
      expect(result.content).toContain("# Daily Log - 2026-04-30");
      expect(result.tags).toEqual(["daily"]);
    });

    it("should merge admin and user templates while honoring hidden optional templates", () => {
      const templates = getAvailableNoteTemplates({
        adminTemplates: [
          {
            id: "admin-required",
            name: "Required Admin",
            content: "# Required",
            scope: "admin",
            required: true,
          },
          {
            id: "admin-optional",
            name: "Optional Admin",
            content: "# Optional",
            scope: "admin",
          },
        ],
        userTemplates: [
          {
            id: "user-weekly",
            name: "Weekly Review",
            titleTemplate: "Weekly - {{date}}",
            content: "# {{title}}",
            scope: "user",
            tags: ["review"],
          },
        ],
        hiddenTemplateIds: ["admin-optional", "admin-required"],
      });

      expect(templates.some((template) => template.id === "admin-required")).toBe(true);
      expect(templates.some((template) => template.id === "admin-optional")).toBe(false);
      expect(templates.some((template) => template.id === "user-weekly")).toBe(true);
    });

    it("should apply custom templates from a merged template collection", () => {
      const templates = getAvailableNoteTemplates({
        userTemplates: [
          {
            id: "user-weekly",
            name: "Weekly Review",
            titleTemplate: "Weekly - {{date}}",
            content: "# {{title}}\n\nOwner: {{username}}",
            scope: "user",
            tags: ["review"],
          },
        ],
      });

      const result = applyNoteTemplate(
        "user-weekly",
        {
          title: "Review",
          username: "testuser",
          now: new Date("2026-04-30T14:30:00.000Z"),
        },
        templates,
      );

      expect(result.title).toBe("Weekly - 2026-04-30");
      expect(result.content).toContain("Owner: testuser");
      expect(result.tags).toEqual(["review"]);
    });
  });

  describe("AI Settings Utils", () => {
    it("should preserve runtime OpenAI key configured status", () => {
      const settings = normalizeEditorAiSettings({
        providers: {
          openai: {
            enabled: true,
            defaultModel: "gpt-4o-mini",
            keyConfigured: true,
          },
          ollama: {
            enabled: false,
            baseUrl: "http://localhost:11434",
            defaultModel: "llama3.1",
          },
        },
      });

      expect(settings.providers.openai.keyConfigured).toBe(true);
    });
  });

  describe("OpenAI Provider", () => {
    it("should omit temperature for GPT-5 nano chat completions", async () => {
      const fetchMock = vi.fn().mockResolvedValue(createOpenAiStreamResponse());
      globalThis.fetch = fetchMock;

      const completion = createOpenAiProvider("test-key").streamCompletion({
        model: "gpt-5-nano",
        temperature: 0.4,
        systemPrompt: "System",
        userPrompt: "User",
      });

      await completion.next();

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.model).toBe("gpt-5-nano");
      expect(body.temperature).toBeUndefined();
    });

    it("should keep configured temperature for regular OpenAI chat models", async () => {
      const fetchMock = vi.fn().mockResolvedValue(createOpenAiStreamResponse());
      globalThis.fetch = fetchMock;

      const completion = createOpenAiProvider("test-key").streamCompletion({
        model: "gpt-4o-mini",
        temperature: 0.4,
        systemPrompt: "System",
        userPrompt: "User",
      });

      await completion.next();

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.temperature).toBe(0.4);
    });
  });
});
