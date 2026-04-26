import { forwardRef, useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import type { IDockviewPanelHeaderProps } from "dockview-react"
import { useSetAtom } from "jotai"
import { trpc } from "../../lib/trpc"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import { terminalsAtom } from "../terminal/atoms"
import { cn } from "../../lib/utils"

/**
 * Default dockview tab component used by every panel kind. The body renders
 * the panel title (read live from `api.title`); double-clicking enters
 * inline-edit mode and Enter / blur saves through a per-kind dispatcher.
 *
 * - `chat:${subChatId}` → trpc updateSubChatName (which updates allSubChats
 *   in the store; the ChatPanel useEffect picks up the new name and calls
 *   api.setTitle).
 * - `terminal:${paneId}` → directly mutates the terminalsAtom entry; the
 *   TerminalPanel useEffect propagates the new name to api.setTitle.
 *
 * Other panel kinds (file / plan / diff / search / files-tree / main) just
 * use the read-only path — double-click is a no-op.
 */
export function RenamableTab(props: IDockviewPanelHeaderProps) {
  const { api, containerApi } = props
  const [title, setTitle] = useState(api.title ?? "")
  const [isActive, setIsActive] = useState(api.isActive)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [chatPanelCount, setChatPanelCount] = useState(() =>
    countChatPanels(containerApi.panels),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local title in sync with whatever the panel pushes via setTitle.
  useEffect(() => {
    setTitle(api.title ?? "")
    const sub = api.onDidTitleChange((e) => setTitle(e.title ?? ""))
    return () => sub.dispose()
  }, [api])

  useEffect(() => {
    setIsActive(api.isActive)
    const sub = api.onDidActiveChange((e) => setIsActive(e.isActive))
    return () => sub.dispose()
  }, [api])

  // Track the chat-panel count so the close X on the *last* chat tab can be
  // disabled — there must always be at least one chat open while a workspace
  // is selected.
  useEffect(() => {
    const recount = () => setChatPanelCount(countChatPanels(containerApi.panels))
    recount()
    const subAdd = containerApi.onDidAddPanel(recount)
    const subRem = containerApi.onDidRemovePanel(recount)
    return () => {
      subAdd.dispose()
      subRem.dispose()
    }
  }, [containerApi])

  useEffect(() => {
    if (editing) {
      setDraft(title)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, title])

  const kind = panelKind(api.id)
  const isLastChat = kind === "chat" && chatPanelCount <= 1
  const closeDisabled = isLastChat

  const startEdit = () => {
    if (!kind) return
    setDraft(title)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)

  return (
    <div
      className={cn(
        "h-full flex items-center gap-1 px-2 select-none cursor-pointer",
        "text-xs",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
      onDoubleClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        startEdit()
      }}
    >
      {editing ? (
        <RenameInput
          ref={inputRef}
          value={draft}
          onChange={setDraft}
          onCancel={cancelEdit}
          onSave={async (next) => {
            const trimmed = next.trim()
            setEditing(false)
            if (!trimmed || trimmed === title) return
            await dispatchRename(api.id, trimmed)
          }}
        />
      ) : (
        <span className="truncate max-w-[180px]" title={title}>
          {title || "Untitled"}
        </span>
      )}
      <button
        type="button"
        aria-label={closeDisabled ? "Cannot close last chat" : "Close tab"}
        title={closeDisabled ? "At least one chat must stay open" : undefined}
        disabled={closeDisabled}
        onClick={(e) => {
          e.stopPropagation()
          if (closeDisabled) return
          api.close()
        }}
        className={cn(
          "rounded flex items-center justify-center transition-opacity",
          closeDisabled
            ? "opacity-20 cursor-not-allowed"
            : "opacity-50 hover:opacity-100 hover:bg-foreground/10",
        )}
        style={{ width: 14, height: 14 }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function countChatPanels(panels: { id: string }[]): number {
  let n = 0
  for (const p of panels) if (p.id.startsWith("chat:")) n++
  return n
}

/**
 * Single-purpose hook target for the rename input. We split this out so the
 * trpc + atom hooks are only instantiated once at the component root, not on
 * every keystroke inside the input itself.
 */
function useRenameDispatcher() {
  const renameSubChat = trpc.chats.renameSubChat.useMutation()
  const setTerminals = useSetAtom(terminalsAtom)

  return async (panelId: string, nextName: string) => {
    const kind = panelKind(panelId)
    if (kind === "chat") {
      const subChatId = panelId.slice("chat:".length)
      // Optimistic store update so the dockview tab title flips before the
      // mutation round-trips. The store is the source of truth for ChatPanel's
      // title sync useEffect.
      const store = useAgentSubChatStore.getState()
      store.updateSubChatName(subChatId, nextName)
      try {
        await renameSubChat.mutateAsync({ id: subChatId, name: nextName })
      } catch (err) {
        console.warn("[rename] sub-chat rename failed:", err)
      }
      return
    }
    if (kind === "terminal") {
      const paneId = panelId.slice("terminal:".length)
      setTerminals((prev) => {
        const next: typeof prev = {}
        for (const chatId of Object.keys(prev)) {
          next[chatId] = prev[chatId].map((t) =>
            t.paneId === paneId ? { ...t, name: nextName } : t,
          )
        }
        return next
      })
      return
    }
    // Other kinds aren't user-renamable — no-op.
  }
}

let dispatchRenameImpl: ((panelId: string, name: string) => Promise<void>) | null =
  null

/**
 * The dispatcher needs trpc / setAtom hooks, but the tab component is rendered
 * by dockview which sits outside React's normal mount tree (it's a headless
 * tab). We wire the dispatcher up via a tiny "host" component mounted inside
 * AgentsLayout so the tab can call dispatchRename without prop drilling.
 */
export function RenameDispatchHost() {
  const dispatch = useRenameDispatcher()
  // Capture the latest dispatch function in the module-level slot so the
  // RenamableTab (which has no React context to consume) can reach it.
  useEffect(() => {
    dispatchRenameImpl = dispatch
    return () => {
      dispatchRenameImpl = null
    }
  }, [dispatch])
  return null
}

async function dispatchRename(panelId: string, nextName: string): Promise<void> {
  if (dispatchRenameImpl) await dispatchRenameImpl(panelId, nextName)
}

function panelKind(panelId: string): "chat" | "terminal" | null {
  if (panelId.startsWith("chat:")) return "chat"
  if (panelId.startsWith("terminal:")) return "terminal"
  return null
}

interface RenameInputProps {
  value: string
  onChange: (next: string) => void
  onSave: (final: string) => void
  onCancel: () => void
}

const RenameInput = forwardRef<HTMLInputElement, RenameInputProps>(
  function RenameInput({ value, onChange, onSave, onCancel }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onSave(value)
          } else if (e.key === "Escape") {
            e.preventDefault()
            onCancel()
          }
          // Don't bubble — dockview consumes Backspace etc. otherwise.
          e.stopPropagation()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="h-5 w-[140px] px-1 rounded border border-input bg-background text-xs outline-none focus:ring-1 focus:ring-primary/50"
      />
    )
  },
)
