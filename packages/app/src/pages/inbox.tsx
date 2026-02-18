import { useNavigate } from "@solidjs/router"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useNotification } from "@/context/notification"
import { base64Encode } from "@opencode-ai/util/encode"
import { childMapByParent, displayName, isRootVisibleSession } from "@/pages/layout/helpers"
import type { Message, PermissionRequest, QuestionRequest, Session, TextPart } from "@opencode-ai/sdk/v2/client"
import { Persist, persisted } from "@/utils/persist"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"

function snippet(input: string | undefined, max = 140) {
  if (!input) return
  const value = input.replace(/\s+/g, " ").trim()
  if (!value) return
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}...`
}

function messageText(parts: unknown[]) {
  const part = parts.find((x): x is TextPart => {
    if (!x || typeof x !== "object") return false
    if (!("type" in x) || (x as { type?: unknown }).type !== "text") return false
    if ("synthetic" in x && (x as { synthetic?: unknown }).synthetic) return false
    if ("ignored" in x && (x as { ignored?: unknown }).ignored) return false
    return true
  })
  return part?.text
}

function ago(ms: number, now: number) {
  const delta = Math.max(0, now - ms)
  if (delta < 60_000) return "now"
  if (delta < 60 * 60_000) return `${Math.floor(delta / 60_000)}m`
  if (delta < 24 * 60 * 60_000) return `${Math.floor(delta / (60 * 60_000))}h`
  return `${Math.floor(delta / (24 * 60 * 60_000))}d`
}

function diff(session: Session) {
  if (!session.summary) return
  const additions = session.summary.additions
  const deletions = session.summary.deletions
  const files = session.summary.files
  if (additions === 0 && deletions === 0 && files === 0) return
  return `+${additions} -${deletions} (${files})`
}

function pickPermission(store: { permission?: Record<string, PermissionRequest[]> }, id: string, children: string[]) {
  const direct = store.permission?.[id]
  if (direct?.length) return direct[0]
  for (const child of children) {
    const next = store.permission?.[child]
    if (next?.length) return next[0]
  }
}

function pickQuestion(store: { question?: Record<string, QuestionRequest[]> }, id: string, children: string[]) {
  const direct = store.question?.[id]
  if (direct?.length) return direct[0]
  for (const child of children) {
    const next = store.question?.[child]
    if (next?.length) return next[0]
  }
}

function lastMessage(messages: Message[] | undefined, role: Message["role"]) {
  if (!messages?.length) return
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === role) return msg
  }
}

function attentionText(input: {
  kind: "permission" | "question" | "error" | "unread"
  permission?: PermissionRequest
  question?: QuestionRequest
  error?: unknown
  response?: string
}) {
  if (input.kind === "permission") {
    const perm = input.permission
    if (!perm) return "Permission required"
    const patterns = perm.patterns?.length ? ` ${perm.patterns.join(", ")}` : ""
    return `Permission: ${perm.permission}${patterns}`
  }
  if (input.kind === "question") {
    const first = input.question?.questions?.[0]?.question
    return first ? `Question: ${first}` : "Question"
  }
  if (input.kind === "error") {
    const msg = (() => {
      if (!input.error) return
      if (typeof input.error === "string") return input.error
      if (typeof input.error !== "object") return
      if (!("data" in input.error)) return
      const data = (input.error as { data?: unknown }).data
      if (!data || typeof data !== "object") return
      if (!("message" in data)) return
      const message = (data as { message?: unknown }).message
      return typeof message === "string" ? message : undefined
    })()
    return msg ? `Error: ${msg}` : "Error"
  }
  return input.response ? `Response: ${input.response}` : "Response"
}

const dotClass = (kind: "permission" | "question" | "error" | "unread") => {
  if (kind === "permission" || kind === "question") return "bg-surface-warning-strong"
  if (kind === "error") return "bg-text-diff-delete-base"
  return "bg-text-interactive-base"
}

export default function Inbox() {
  const navigate = useNavigate()
  const globalSync = useGlobalSync()
  const layout = useLayout()
  const notification = useNotification()
  const language = useLanguage()
  const [dismissed, setDismissed] = persisted(
    Persist.global("inbox.dismissed", ["inbox.dismissed.v1"]),
    createStore({
      sessions: {} as Record<string, string>,
    }),
  )

  const [now, setNow] = createSignal(Date.now())
  const interval = window.setInterval(() => setNow(Date.now()), 30_000)
  onCleanup(() => clearInterval(interval))

  const items = createMemo(() => {
    const projects = layout.projects.list()
    const list = projects.flatMap((project) => {
      const [store] = globalSync.child(project.worktree)
      const children = childMapByParent(store.session)

      return store.session
        .filter((session) => isRootVisibleSession(session, project.worktree))
        .map((session) => {
          const childIds = children.get(session.id) ?? []
          const permission = pickPermission(store, session.id, childIds)
          const question = pickQuestion(store, session.id, childIds)
          const unseen = notification.session.unseenCount(session.id)
          const unseenHasError = notification.session.unseenHasError(session.id)

          const kind = (() => {
            if (permission) return "permission" as const
            if (question) return "question" as const
            if (unseenHasError) return "error" as const
            if (unseen > 0) return "unread" as const
          })()
          if (!kind) return

          const messages = store.message[session.id]
          const user = (() => {
            const msg = lastMessage(messages, "user")
            if (!msg) return
            return snippet(messageText(store.part[msg.id] ?? []))
          })()

          const response = (() => {
            if (kind !== "unread") return
            const msg = lastMessage(messages, "assistant")
            if (!msg) return
            return snippet(messageText(store.part[msg.id] ?? []))
          })()

          const error = (() => {
            if (kind !== "error") return
            const unseen = notification.session.unseen(session.id)
            for (let i = unseen.length - 1; i >= 0; i--) {
              const n = unseen[i]
              if (n.type === "error") return n.error
            }
          })()

          return {
            project,
            session,
            kind,
            user,
            attention: snippet(attentionText({ kind, permission, question, error, response }), 220),
            time: session.time.updated ?? session.time.created,
            diff: diff(session),
            dismiss: `${kind}:${session.time.updated ?? session.time.created}:${permission?.permission ?? ""}:${question?.id ?? ""}:${unseen}:${unseenHasError ? "1" : "0"}`,
          }
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
    })

    const visible = list.filter((item) => dismissed.sessions[item.session.id] !== item.dismiss)

    return visible.toSorted((a, b) => {
      if (a.time !== b.time) return b.time - a.time
      return a.session.id < b.session.id ? 1 : -1
    })
  })

  const clearable = createMemo(() => items().filter((x) => x.kind === "unread" || x.kind === "error"))

  const clearAll = () => {
    const ids = clearable().map((x) => x.session.id)
    for (const id of ids) notification.session.markViewed(id)
  }

  const open = (session: Session) => {
    navigate(`/${base64Encode(session.directory)}/session/${session.id}`)
  }

  const dismiss = (item: ReturnType<typeof items>[number]) => {
    if (item.kind === "unread" || item.kind === "error") notification.session.markViewed(item.session.id)
    setDismissed("sessions", item.session.id, item.dismiss)
  }

  return (
    <div class="size-full flex flex-col">
      <div class="shrink-0 bg-background-stronger border-b border-border-weak-base">
        <div class="h-12 w-full flex items-center px-4 md:px-6 md:max-w-200 md:mx-auto 3xl:max-w-[1200px]">
          <div class="text-14-medium text-text-strong">{language.t("inbox.title")}</div>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <Show
          when={items().length > 0}
          fallback={
            <div class="mt-30 mx-auto flex flex-col items-center gap-3">
              <div class="flex flex-col gap-1 items-center justify-center">
                <div class="text-14-medium text-text-strong">{language.t("inbox.empty.title")}</div>
                <div class="text-12-regular text-text-weak">{language.t("inbox.empty.description")}</div>
              </div>
            </div>
          }
        >
          <div class="w-full px-4 md:px-6 md:max-w-200 md:mx-auto 3xl:max-w-[1200px] py-4">
            <div class="flex items-center justify-end">
              <Show when={clearable().length > 0}>
                <Button size="normal" onClick={clearAll}>
                  {language.t("inbox.clearUnreads")}
                </Button>
              </Show>
            </div>
            <div class="mt-3 flex flex-col gap-2">
              <For each={items()}>
                {(item) => (
                  <div
                    class="group relative w-full rounded-md cursor-pointer transition-colors px-3 py-2 bg-surface-raised-base hover:bg-surface-raised-base-hover border border-border-weak-base"
                    onClick={() => open(item.session)}
                  >
                    <div class="flex items-start gap-3">
                      <div class="shrink-0 pt-1">
                        <div class={`size-2 rounded-full ${dotClass(item.kind)}`} />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-3">
                          <div class="min-w-0 flex items-center gap-2">
                            <span class="text-14-medium text-text-strong truncate">{item.session.title}</span>
                            <span class="text-12-medium text-text-weak shrink-0">{displayName(item.project)}</span>
                          </div>
                          <div class="shrink-0 flex items-center gap-2">
                            <Show when={item.diff}>
                              <span class="text-12-medium text-text-weak">{item.diff}</span>
                            </Show>
                            <span class="text-12-medium text-text-weak">{ago(item.time, now())}</span>
                            <Tooltip value={language.t("common.dismiss")}>
                              <IconButton
                                icon="circle-x"
                                variant="ghost"
                                size="small"
                                aria-label={language.t("common.dismiss")}
                                class="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  dismiss(item)
                                }}
                              />
                            </Tooltip>
                          </div>
                        </div>

                        <div class="mt-2 pt-2 border-t border-border-weak-base flex flex-col gap-1">
                          <Show when={item.user}>
                            {(text) => <div class="text-12-regular text-text-weak truncate">{text()}</div>}
                          </Show>
                          <Show when={item.attention}>
                            {(text) => <div class="text-12-regular text-text-base truncate">{text()}</div>}
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
