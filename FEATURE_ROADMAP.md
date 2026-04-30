# Jotty Feature Roadmap

## Goal

Turn the current feature brainstorm into a working implementation plan for future Jotty releases. This file is meant to be updated as we complete slices, learn from the codebase, and refine priorities.

The strongest near-term theme is making notes easier to retrieve, structure, and act on. The larger bets are offline/local-first editing, stronger encryption and privacy controls, AI-assisted workflows, collaboration, external integrations, richer media, and usage insights.

## Planning Principles

- Keep Jotty's file-based Markdown and JSON storage model central.
- Prefer Markdown/frontmatter-compatible metadata for note features when practical.
- Preserve self-hosted simplicity: features should work without mandatory external services.
- Treat encrypted notes carefully. Metadata can remain searchable, but encrypted body content should not be indexed or analyzed unless the user has intentionally decrypted it in a safe client-side flow.
- Design offline/local-first work around durable local drafts, clear sync state, and explicit conflict resolution instead of silent overwrites.
- Keep AI assistance opt-in and privacy-aware. Automatic AI features should have visible review states and should never send encrypted note body content to a provider unless the user intentionally decrypts and requests it.
- Ship vertical slices that are useful on their own, then expand them.
- Keep mobile/PWA behavior in mind for every editor and filtering workflow.

## Existing Footholds

- Notes already expose `tags` metadata in the note model and note parsing flow.
- User preferences already include `notesAutoSaveInterval`.
- The shortcuts guide currently documents a save shortcut, but the desired behavior needs a dedicated review so saving does not exit edit mode.
- API docs already describe note search with `q`, category filtering, summary statistics, and export endpoints.
- Sharing already exists for notes and checklists, which gives collaboration a permission foundation.
- The app already has PWA/service-worker entry points, which can become the foundation for offline caching and sync status.
- The app already supports per-note encryption paths, which gives privacy controls a real implementation base instead of a blank slate.
- The app already includes editor/media building blocks such as TipTap, Mermaid, Draw.io, Excalidraw, file attachments, video attachment rendering, Recharts, and WebSocket dependencies.
- The inline AI editor work is tracked separately in [LLM_EDITOR_PLAN.md](LLM_EDITOR_PLAN.md).

## Priority Map

### P0: Save Reliability And Editor Flow

Auto-save and manual save behavior should be tightened before expanding note workflows. If note editing is going to gain tags, templates, reminders, AI actions, and collaboration, saving needs to feel predictable first.

### P1: Organization, Search, Filters, Templates, Reminders, And AI Suggestions

These are high-impact personal knowledge features. They strengthen the core note-taking loop without requiring external accounts or heavy infrastructure.

### P2: Export, Task Conversion, Offline Foundations, Settings, And Insights

These make Jotty more useful as a daily system and are natural follow-ups after metadata and search are stronger. Offline editing starts here as a reliability feature, but conflict handling should be designed before it becomes broad sync.

### P3: Local-First Sync, Calendar/Task Integrations, And Collaboration

These are valuable but need careful design because they touch permissions, sync queues, conflict handling, external auth, and self-hosting complexity.

### P4: Encryption Hardening, Privacy Controls, And Advanced AI Automation

Important, but needs careful defaults because it affects trust, storage, and self-hosted operations. Smaller privacy fixes can move earlier when they unblock offline, sharing, AI, or export work.

### P5: Audio/Video Recording And Advanced Animated Diagrams

Useful later, but lower priority. Jotty already supports file/media attachments and several diagram tools, so the first step is improving those paths before building recording or animation systems.

## Recommended Implementation Order

1. Save and auto-save behavior pass.
2. Tag color model plus note card/editor tag UI.
3. Tag/date/filter-aware search.
4. Note templates.
5. Note reminders and task conversion.
6. AI-assisted suggestions for summaries, tags, draft improvements, and smart reminders.
7. Markdown-first export improvements.
8. Offline edit queue and local-first sync foundations.
9. Encryption and privacy controls hardening.
10. Stats and insights.
11. Calendar/task integrations.
12. Collaboration and comments.
13. Rich media recording and animated graph/flow tooling.

## Master Task List

### 0. Discovery And Design

- [ ] Audit current note metadata parsing, storage, and migration behavior.
- [ ] Audit current note save flow, auto-save flow, dirty-state handling, and edit-mode transitions.
- [ ] Audit existing search implementation for notes, categories, tags, encrypted notes, and API parity.
- [ ] Audit current sharing permission model before collaboration planning.
- [x] Decide whether colored tags are global per instance, per user, or mixed with shared global defaults.
- [x] Decide whether templates are user-owned, admin-provided, or both.
- [x] Decide whether reminder metadata belongs inside note frontmatter, separate JSON indexes, or both.
- [ ] Audit current PWA/service-worker behavior, offline cache behavior, and browser storage options.
- [ ] Audit current encrypted note flows, key handling, sharing behavior, and metadata exposure.
- [ ] Decide whether local-first sync uses operation queues, note revisions, content hashes, CRDTs, or a smaller conflict prompt model.
- [ ] Define privacy boundaries for AI features, especially encrypted notes, automatic background analysis, and provider-backed requests.

### 1. Organization And Colored Tags

Outcome: Users can create colored tag pills, attach them to notes, and filter notes by tag or color.

- [x] Define initial tag metadata with normalized name, display name, parent, usage counts, and color metadata.
- [x] Add per-user tag color override storage while keeping note frontmatter as the source of note assignments.
- [ ] Add migration or normalization for existing string-only note tags.
- [x] Add colored tag pill rendering for inline note/checklist tags, sidebar tag counts, and editor tag suggestions.
- [x] Add reusable tag pill/chip components for note cards and list/grid note results.
- [x] Add sidebar color selection UI for existing tags.
- [ ] Add tag creation/edit/delete UI beyond color overrides.
- [x] Add tag assignment UI in the note editor and note detail metadata area.
- [x] Add tag filtering on notes home.
- [ ] Add color filtering if it remains useful after tag filtering ships.
- [ ] Add broader tests for tag parsing, filtering, and backwards compatibility.
- [ ] Update docs after the workflow stabilizes.

### 2. Auto-Save And Manual Save

Outcome: Notes save automatically at the configured interval, and `Ctrl+S` / `Cmd+S` saves without leaving edit mode.

- [x] Map the current note editing lifecycle from local state to server action/write.
- [x] Confirm whether the documented `Cmd/Ctrl+Shift+S` shortcut should remain, be changed, or become an alias.
- [x] Add `Ctrl+S` / `Cmd+S` interception while editing notes.
- [x] Ensure manual save keeps the note in edit mode.
- [x] Add a visible saved/saving/error state that does not interrupt writing.
- [x] Respect `notesAutoSaveInterval`, including a disabled state if interval `0` is supported.
- [x] Avoid duplicate concurrent saves by serializing or coalescing save requests.
- [ ] Ensure markdown and rich editor modes both save the correct current content.
- [ ] Add tests for shortcut behavior, save-without-exit, auto-save timing, and failed save recovery.
- [x] Update [howto/SHORTCUTS.md](howto/SHORTCUTS.md) once shortcut behavior is final.

### 3. Search And Filtering

Outcome: Users can search by keyword, exact phrase, tag pill, color, date, and useful custom criteria.

- [x] Inventory the existing note search API and UI behavior.
- [x] Define a small query grammar, such as quoted phrases, `tag:name`, `color:name`, `created:`, `updated:`, and `category:`.
- [x] Add a structured filter state so the UI does not depend only on raw text parsing.
- [x] Support exact phrase search for note titles and unencrypted note content.
- [x] Support tag and color filters using the new tag registry.
- [x] Support created/updated date ranges.
- [ ] Consider priority as a first-class metadata field only if it has a strong product use case beyond colored tags.
- [x] Preserve existing category filtering and API compatibility.
- [ ] Document encrypted-note search limitations clearly in the UI and docs.
- [x] Add tests for query parsing, API results, encrypted note behavior, and combined filters.

### 4. Note Templates

Outcome: Users can create notes from reusable structures such as meeting notes, daily logs, project briefs, and research notes.

- [x] Define template storage as app/user JSON records with Markdown template bodies.
- [x] Support template variables such as date, time, username, title, category, and tags.
- [x] Add template management UI for create/edit/delete/duplicate.
- [x] Add template selection to new-note creation and quick-create flows.
- [x] Add an admin instance default template.
- [ ] Add optional default template per category or tag.
- [ ] Ensure templates work in both rich editor and markdown mode.
- [ ] Add import/export for templates if the storage format is stable.
- [x] Add tests for variable expansion and merged admin/user template visibility.
- [ ] Add tests for template-created notes.

### 5. Reminders

Outcome: Users can attach reminders to notes and optionally create reminders from tags or detected keywords.

- [x] Audit existing notification and checklist/Kanban reminder behavior for reuse.
- [x] Define reminder storage and ownership rules.
- [x] Add note-level reminder metadata with due date, optional repeat rule, status, and notification preference.
- [x] Add reminder controls in the note editor and note metadata panel.
- [x] Add reminder status and due-date filters to API/global search.
- [ ] Add reminders to notes home filters.
- [ ] Add optional tag-based reminder rules, such as all notes tagged `invoice` reminding after a configured delay.
- [ ] Add optional keyword/date detection as a user-confirmed suggestion, not an automatic silent action.
- [ ] Add in-app notifications first; browser push or email can come later.
- [ ] Add tests for reminder creation, filtering, notification eligibility, and recurring reminders if enabled.

### 6. Export And External Integrations

Outcome: Users can get notes out of Jotty in practical formats and optionally connect calendar/task systems.

- [ ] Review current export endpoints and output formats.
- [ ] Make Markdown export the first-class path for notes, including frontmatter and attachments where possible.
- [ ] Add PDF export only after markdown/html rendering is stable enough for predictable output.
- [ ] Add CSV export for metadata lists, not rich note bodies.
- [ ] Add selective export by category, tag, date range, or search result.
- [ ] Add ICS export/feed for reminders before full calendar two-way sync.
- [ ] Evaluate CalDAV or provider-specific calendar sync only after ICS proves useful.
- [ ] Evaluate external task integrations after local task conversion exists.
- [ ] Add tests around export permissions, shared notes, encrypted notes, and attachment paths.

### 7. Customization And Settings

Outcome: Users can tune new workflows without making the settings area messy.

- [ ] Group new settings by workflow: editor/save, notifications/reminders, search/default filters, templates, integrations.
- [ ] Add user-level auto-save interval options if current options are too limited.
- [ ] Add notification preferences for reminders and collaboration events.
- [ ] Add default note filter settings for tags/date/custom filters.
- [ ] Add default template preferences.
- [ ] Add admin settings only for instance-wide controls such as external providers, retention, and integration availability.
- [ ] Add validation schemas for every new user/admin setting.
- [ ] Add docs for settings that affect data behavior or external services.

### 8. Task Management Integration

Outcome: Users can turn note content into actionable tasks with due dates and reminders.

- [x] Define the relationship between notes, checklists, Kanban tasks, and inline task list items.
- [x] Add a selected-text action to convert note content into a checklist item or Kanban task.
- [x] Preserve a backlink from created task to source note.
- [ ] Add due date and reminder extraction as a confirmation step.
- [ ] Add inline note indicators for linked tasks.
- [ ] Add task status previews in note view.
- [ ] Add API support after the local UI flow is stable.
- [ ] Evaluate Todoist, Microsoft To Do, CalDAV tasks, or other integrations later.
- [ ] Add tests for conversion, backlinks, permission checks, and deleted-source handling.

### 9. Statistics And Insights

Outcome: Users can understand their note-taking patterns without exposing private content.

- [ ] Review existing summary API and decide what note-level stats are already available.
- [ ] Add aggregate metrics such as notes created over time, most-used tags, active categories, and reminder completion rate.
- [ ] Avoid content analysis by default; keep insights metadata-based unless explicitly enabled.
- [ ] Add a personal insights view using existing charting tools.
- [ ] Add date range controls and exportable metadata summaries.
- [ ] Add admin aggregate stats only if they do not reveal private note content.
- [ ] Add tests for aggregation correctness and privacy boundaries.

### 10. Collaboration And Comments

Outcome: Shared notes can support comments and eventually live collaborative editing.

- [ ] Treat this as a separate architecture project after save, tags, and search are stable.
- [x] Audit current sharing permissions and public-link behavior.
- [x] Add comments as the first collaboration slice before live multi-cursor editing.
- [x] Decide whether comments are stored in note frontmatter, sidecar JSON, or a shared activity log.
- [x] Add note editor comments panel with create and resolve actions.
- [ ] Add comment permissions, resolve/unresolve state, and notification hooks.
- [ ] Add optimistic UI and conflict handling for comments.
- [ ] Prototype live note updates with WebSockets only after comments and save conflict behavior are understood.
- [ ] Decide whether real-time editing uses operational transforms, CRDTs, document locks, or last-write conflict prompts.
- [ ] Add tests for permissions, comment lifecycle, concurrent updates, and shared encrypted notes.

### 11. Offline Mode And Local-First Sync

Outcome: Users can keep writing when their connection drops, then safely sync local edits when they are online again.

- [ ] Audit current PWA/service worker caching, server action dependencies, API calls, and browser storage options.
- [ ] Define a local draft store, likely IndexedDB, for note content, metadata, attachment references, and pending sync operations.
- [ ] Add network status, local-change, and sync-failure indicators in the note editor and notes home.
- [ ] Allow creating local notes and editing cached notes while offline.
- [ ] Queue writes with operation IDs, note ID/UUID, category path, original `updatedAt`, content hash or revision, and user ownership context.
- [ ] Replay queued edits in the background when online, with retry backoff and clear failure messaging.
- [ ] Add conflict detection when the server note changed after the local edit started.
- [ ] Add conflict resolution UI with keep mine, keep server, duplicate local copy, and Markdown compare/merge options.
- [ ] Keep encrypted note payloads encrypted in local queues; do not persist decrypted plaintext drafts unless the user explicitly opts in.
- [ ] Add tests for queue serialization, replay ordering, retries, conflict detection, and encrypted-note local storage behavior.

### 12. Encryption And Privacy Controls

Outcome: Users can understand and control how private notes, metadata, local drafts, AI actions, sharing, and exports handle sensitive content.

- [ ] Audit existing PGP/XChaCha note encryption, key storage, decrypted editor lifecycle, sharing behavior, attachment handling, and export behavior.
- [ ] Clarify the privacy model for at-rest server encryption versus end-to-end client-side encryption.
- [ ] Add a per-note privacy panel showing encryption method, searchable metadata, AI eligibility, sharing state, export eligibility, and local offline behavior.
- [ ] Add user defaults for encrypting new notes, locking decrypted notes after inactivity, and allowing or blocking decrypted local drafts.
- [ ] Decide whether tags, reminders, linked tasks, and comments on encrypted notes are encrypted, metadata-only, or disabled by policy.
- [ ] Support rotating or upgrading encrypted notes between supported encryption methods.
- [ ] Ensure offline queues, local drafts, exports, global search, and stats all honor encrypted-note privacy boundaries.
- [ ] Add recovery/export guidance for encrypted notes and keys.
- [ ] Add tests for encrypted metadata boundaries, local storage behavior, sharing permissions, exports, and AI opt-in behavior.

### 13. AI-Assisted Features

Outcome: Users can ask Jotty for useful help without losing control over content, tags, reminders, or privacy.

- [x] Add manual editor AI actions for rewrite, brainstorm, and summarize with provider calls from the server/container path.
- [ ] Add opt-in automatic note summaries stored as metadata or a sidecar cache with a stale indicator when the note changes.
- [ ] Add tag/pill suggestions from note title/content and the existing tag registry, with user confirmation before applying.
- [ ] Add smart reminder suggestions from natural-language dates, task-like phrases, and follow-up language, with user confirmation of date, time, timezone, and notification behavior.
- [ ] Add draft improvement actions beyond rewrite, such as tone, clarity, outline, follow-up extraction, and action-item extraction.
- [ ] Add a review queue for AI suggestions so automatic results are visible, dismissible, and reversible.
- [ ] Add per-user/provider settings for automatic AI features, model selection, background job limits, and external-provider availability.
- [ ] Make encrypted-note AI behavior explicit: no encrypted body analysis unless the user decrypts the note and intentionally runs or approves an AI action.
- [x] Add an AnythingLLM custom agent skill package for note search, create, append, update, organize, and delete flows.
- [ ] Add API helper endpoints if the plugin needs safer partial operations, such as append/prepend/replace-section, tag mutation, reminder mutation, or dry-run diffs.
- [ ] Add tests for prompt building, privacy gating, empty/error responses, suggestion review behavior, and provider quirks such as default-temperature-only models.
- [ ] Document which AI features can run locally/self-hosted and which require external providers.

### 14. Audio, Video, And Animated Graph/Flow Support

Outcome: Users can attach richer media and eventually build more expressive visual notes.

- [ ] Review current image, file, video, Mermaid, Draw.io, and Excalidraw support before adding new media systems.
- [ ] Improve attached media playback/viewing where the existing flow is rough.
- [ ] Consider browser-based audio recording as a small first media-recording slice.
- [ ] Consider video recording only after storage limits, upload limits, and mobile capture behavior are clear.
- [ ] Explore animated flow/graph needs separately from audio/video recording.
- [ ] Prefer improving Mermaid/Draw.io/Excalidraw workflows before inventing a custom animation editor.
- [ ] Add file size, retention, and privacy controls for recordings.
- [ ] Add tests around upload limits, playback rendering, and unsupported file types.

## Open Questions

- Should tags be purely personal, or should shared notes expose shared tag metadata too?
- Should colored tags replace priority labels, or should priority become a separate field?
- Should note reminders live in note frontmatter for portability, or in a sidecar index for faster reminder scans?
- Should templates be syncable/exportable as plain Markdown files?
- Should `Ctrl+S` become the primary documented save shortcut while the current shift-save shortcut remains as a legacy alias?
- How much should encrypted note metadata reveal for tags, reminders, and stats?
- Should collaboration start with comments only, or is live editing important enough to design first?
- How much offline functionality should work before login/session refresh is available?
- Should local-first sync use a simple operation queue and conflict prompts first, or adopt a CRDT/revision-log model earlier?
- Should decrypted offline drafts ever be allowed, and if so should they require an explicit user setting plus local device lock guidance?
- Which AI-assisted features are safe to run automatically, and which should always require an explicit user action?
- Should AI-generated summaries, suggested tags, and smart reminder suggestions live in note frontmatter, sidecar JSON, or an ephemeral cache?

## First Suggested Slice

Start with save behavior because it is small, user-visible, and foundational.

- [x] Confirm current save shortcut behavior in the app.
- [x] Add `Ctrl+S` / `Cmd+S` note saving.
- [x] Keep the note in edit mode after manual save.
- [x] Verify auto-save respects the user interval.
- [ ] Add tests around manual save, auto-save, markdown mode, and rich editor mode.
- [x] Update shortcut docs.

After that, move into colored tags and tag filtering. That gives search, templates, reminders, task conversion, and stats a stronger metadata foundation.
