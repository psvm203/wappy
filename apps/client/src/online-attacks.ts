import { ATTACK_TTL_MS, type AttackEvent } from "@wappy/api";

export function createAttackInbox(selfId: string | null) {
  return {
    selfId,
    seen: new Set<number>(),
    queue: [] as { event: AttackEvent; receivedAt: number }[],
  };
}
export type AttackInbox = ReturnType<typeof createAttackInbox>;

/** Shared with the overlay so hiding/remounting characters cannot replay an event. */
export function collectAttacks(
  inbox: AttackInbox,
  events: readonly AttackEvent[],
  visibleOnlineIds: ReadonlySet<string>,
  enabled: boolean,
  now: number,
) {
  inbox.queue = enabled
    ? inbox.queue.filter(
        ({ receivedAt, event }) =>
          now - receivedAt < ATTACK_TTL_MS &&
          visibleOnlineIds.has(event.attackerId) &&
          visibleOnlineIds.has(event.targetId),
      )
    : [];
  for (const event of events) {
    if (inbox.seen.has(event.id)) continue;
    inbox.seen.add(event.id);
    if (
      enabled &&
      // Outgoing attacks already animate on click, even if the acknowledgement is delayed or lost.
      event.targetId === inbox.selfId &&
      visibleOnlineIds.has(event.attackerId) &&
      visibleOnlineIds.has(event.targetId)
    )
      inbox.queue.push({ event, receivedAt: now });
  }
  inbox.queue = inbox.queue.slice(-8);
  while (inbox.seen.size > 256)
    inbox.seen.delete(inbox.seen.values().next().value!);
}

export function nextAttack(
  inbox: AttackInbox,
  now: number,
): AttackEvent | undefined {
  while (inbox.queue.length) {
    const item = inbox.queue.shift()!;
    if (now - item.receivedAt < ATTACK_TTL_MS) return item.event;
  }
}
