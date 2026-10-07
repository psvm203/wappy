import type { Friend } from "@wappy/api";

export type FriendView = "all" | "online" | "waves";

function searchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

export function filterFriends(
  friends: readonly Friend[],
  query: string,
  view: FriendView,
  connected: boolean,
) {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return friends
    .filter((friend) => {
      if (view === "online" && (!connected || !friend.online)) return false;
      if (view === "waves" && !friend.wave) return false;
      const text = searchText(`${friend.name} ${friend.status}`);
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) =>
      view === "waves"
        ? b.wave!.sentAt - a.wave!.sentAt
        : Number(connected && b.online) - Number(connected && a.online),
    );
}
