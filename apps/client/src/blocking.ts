import type { BlockingSettings, SidebarState } from "@wappy/api";

export function applyBlockingSettings(
  state: SidebarState,
  blocking: BlockingSettings,
): SidebarState {
  if ((state.blocking?.revision ?? 0) > blocking.revision) return state;
  const blocked = new Set(blocking.profiles.map((profile) => profile.id));
  const friends = state.friends.filter((friend) => !blocked.has(friend.id));
  const visible = new Set([
    state.self.id,
    ...friends.map((friend) => friend.id),
  ]);
  const messages = state.messages?.filter(
    (message) =>
      visible.has(message.senderId) &&
      (message.recipientId === undefined || visible.has(message.recipientId)),
  );
  const messageIds = new Set(messages?.map((message) => message.id));
  return {
    ...state,
    blocking,
    friends,
    ...(messages === undefined ? {} : { messages }),
    ...(state.unreadChatIds === undefined
      ? {}
      : {
          unreadChatIds: state.unreadChatIds.filter((id) => messageIds.has(id)),
        }),
  };
}

/** Older responses cannot restore blocked connections, even after an unblock. */
export function reconcileBlocking(
  current: SidebarState | null,
  incoming: SidebarState,
): SidebarState {
  if (
    current?.self.id !== incoming.self.id ||
    !current.blocking ||
    !incoming.blocking ||
    current.blocking.revision <= incoming.blocking.revision
  )
    return incoming;
  const connected = new Set(current.friends.map((friend) => friend.id));
  return applyBlockingSettings(
    {
      ...incoming,
      friends: incoming.friends.filter((friend) => connected.has(friend.id)),
    },
    current.blocking,
  );
}
