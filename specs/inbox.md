# Inbox (Web/Desktop) Prototype Plan

Issue: https://github.com/anomalyco/opencode/issues/13030

## Goal

Add an Inbox page that aggregates sessions across projects that are waiting on the user.

"Waiting on the user" means one or more of:

- Unseen response (turn complete)
- Unseen error
- Pending permission request
- Pending question

This is an in-app triage surface similar to Slack's Unreads.

## Non-goals (for prototype)

- Undo for "clear all"
- User-configurable sorting and persisted sort preference
- Loading sessions for every project ever (initial prototype focuses on open projects)

## UX

### Entry point

- Add an Inbox icon at the top of the left rail (above the project list).
- Clicking it navigates to `/inbox`.
- When Inbox has items, show a badge indicator on the icon.

If the Inbox is empty, it still navigates to the empty state.

### Inbox page

- Cross-project list of sessions needing attention.
- Live updates while the user stays on the page (reactive aggregation).
- "Clear all" clears notification-based items only (unseen responses/errors).

### Row content

Each row is a single session and is clickable.

Shown on the row:

- Project name (and optionally icon)
- Session title
- Relative last activity time (based on `session.time.updated`)
- Snippet: last user message sent in that session
- Snippet: the thing that needs attention
  - Permission: permission + patterns
  - Question: question text
  - Error: error message
  - Unseen response: latest assistant text
- Optional diff summary if available (`session.summary`)

Clicking the row navigates to that session and clears unseen notifications.

### Clearing semantics

- Per-row dismiss button for all rows.
- For notification rows, dismiss also calls `notification.session.markViewed(sessionID)`.
- For permission/question rows, dismiss is local Inbox state only (session still requires action).
- "Clear all" calls `markViewed` for all sessions in the list.

## Data + Logic

### Projects included

Prototype aggregates across open projects (projects in the left rail). This avoids bootstrapping every project on the server.

Future: extend to all projects if maintainers want.

### Sessions included

- Root sessions only (`!session.parentID`).
- Skip archived sessions (`!session.time.archived`).

### Child sessions

Child sessions are created by the `task` tool (subagents). They are not shown directly.

Roll up child permissions/questions to the parent session:

- If any child session has pending permissions or questions, the parent is treated as blocked.

### Attention priority

When multiple reasons exist:

1. Permission/Question
2. Error
3. Unseen response

The row's status dot and attention snippet reflect the highest priority reason.

### Sorting

Default: most recent sessions first (by `session.time.updated`).

## Implementation Steps

1. Add `inbox` icon to `packages/ui/src/components/icon.tsx`.
2. Add a new route `/inbox` in `packages/app/src/app.tsx`.
3. Create `packages/app/src/pages/inbox.tsx`.
4. Add Inbox rail icon + badge in `packages/app/src/pages/layout/sidebar-shell.tsx`.
5. Verify live updates (notifications, permissions, questions) update the Inbox list.
6. Capture screenshots for issue #13030 design review.

## Open UX questions

- Should "Clear all" be renamed to "Mark all as read" to make semantics explicit?
