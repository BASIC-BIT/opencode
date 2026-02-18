import { createMemo, For, Show, type Accessor, type JSX } from "solid-js"
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter,
  type DragEvent,
} from "@thisbeyond/solid-dnd"
import { ConstrainDragXAxis } from "@/utils/solid-dnd"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { type LocalProject } from "@/context/layout"
import { sidebarExpanded } from "./sidebar-shell-helpers"

export const SidebarContent = (props: {
  mobile?: boolean
  opened: Accessor<boolean>
  aimMove: (event: MouseEvent) => void
  inboxLabel: Accessor<string>
  inboxActive: Accessor<boolean>
  inboxNotify: Accessor<boolean>
  onOpenInbox: () => void
  projects: Accessor<LocalProject[]>
  renderProject: (project: LocalProject) => JSX.Element
  handleDragStart: (event: unknown) => void
  handleDragEnd: () => void
  handleDragOver: (event: DragEvent) => void
  openProjectLabel: JSX.Element
  openProjectKeybind: Accessor<string | undefined>
  onOpenProject: () => void
  renderProjectOverlay: () => JSX.Element
  settingsLabel: Accessor<string>
  settingsKeybind: Accessor<string | undefined>
  onOpenSettings: () => void
  helpLabel: Accessor<string>
  onOpenHelp: () => void
  renderPanel: () => JSX.Element
}): JSX.Element => {
  const expanded = createMemo(() => sidebarExpanded(props.mobile, props.opened()))

  return (
    <div class="flex h-full w-full overflow-hidden">
      <div
        class="w-16 shrink-0 bg-background-base flex flex-col items-center overflow-hidden"
        onMouseMove={props.aimMove}
      >
        <div class="shrink-0 w-full pt-2 pb-2 flex flex-col items-center gap-2">
          <Tooltip placement={props.mobile ? "bottom" : "right"} value={props.inboxLabel()}>
            <div class="relative">
              <IconButton
                icon="inbox"
                variant="ghost"
                size="large"
                onClick={props.onOpenInbox}
                aria-label={props.inboxLabel()}
                classList={{
                  "bg-surface-base-active border-2 border-icon-strong-base": props.inboxActive(),
                }}
              />
              <Show when={props.inboxNotify()}>
                <div class="absolute top-px right-px size-1.5 rounded-full bg-text-interactive-base" />
              </Show>
            </div>
          </Tooltip>
          <div class="w-8 h-px bg-border-weak-base" />
        </div>
        <div class="flex-1 min-h-0 w-full">
          <DragDropProvider
            onDragStart={props.handleDragStart}
            onDragEnd={props.handleDragEnd}
            onDragOver={props.handleDragOver}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <ConstrainDragXAxis />
            <div class="h-full w-full flex flex-col items-center gap-3 px-3 py-2 overflow-y-auto no-scrollbar">
              <SortableProvider ids={props.projects().map((p) => p.worktree)}>
                <For each={props.projects()}>{(project) => props.renderProject(project)}</For>
              </SortableProvider>
              <Tooltip
                placement={props.mobile ? "bottom" : "right"}
                value={
                  <div class="flex items-center gap-2">
                    <span>{props.openProjectLabel}</span>
                    <Show when={!props.mobile && !!props.openProjectKeybind()}>
                      <span class="text-icon-base text-12-medium">{props.openProjectKeybind()}</span>
                    </Show>
                  </div>
                }
              >
                <IconButton
                  icon="plus"
                  variant="ghost"
                  size="large"
                  onClick={props.onOpenProject}
                  aria-label={typeof props.openProjectLabel === "string" ? props.openProjectLabel : undefined}
                />
              </Tooltip>
            </div>
            <DragOverlay>{props.renderProjectOverlay()}</DragOverlay>
          </DragDropProvider>
        </div>
        <div class="shrink-0 w-full pt-3 pb-3 flex flex-col items-center gap-2">
          <TooltipKeybind
            placement={props.mobile ? "bottom" : "right"}
            title={props.settingsLabel()}
            keybind={props.settingsKeybind() ?? ""}
          >
            <IconButton
              icon="settings-gear"
              variant="ghost"
              size="large"
              onClick={props.onOpenSettings}
              aria-label={props.settingsLabel()}
            />
          </TooltipKeybind>
          <Tooltip placement={props.mobile ? "bottom" : "right"} value={props.helpLabel()}>
            <IconButton
              icon="help"
              variant="ghost"
              size="large"
              onClick={props.onOpenHelp}
              aria-label={props.helpLabel()}
            />
          </Tooltip>
        </div>
      </div>

      <Show when={expanded()}>{props.renderPanel()}</Show>
    </div>
  )
}
