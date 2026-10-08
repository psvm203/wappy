import type { SidebarState } from "@wappy/api";

/** An older poll must not undo a setting confirmed by a newer write or poll. */
export function reconcilePresence(
  current: SidebarState | null,
  incoming: SidebarState,
): SidebarState {
  if (
    current?.self.id === incoming.self.id &&
    current.presence &&
    incoming.presence &&
    current.presence.revision > incoming.presence.revision
  )
    return { ...incoming, presence: current.presence };
  return incoming;
}
