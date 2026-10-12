import type { Friend } from "@wappy/api";

export type FriendView = "all" | "online";

export function filterFriends(
  friends: readonly Friend[],
  view: FriendView,
  connected: boolean,
) {
  return friends
    .filter((friend) => view === "all" || (connected && friend.online))
    .sort(
      (a, b) => Number(connected && b.online) - Number(connected && a.online),
    );
}
