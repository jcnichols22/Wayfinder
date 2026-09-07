import { get, set } from "idb-keyval";
import { api } from "./api";

export interface QueuedAction {
  clientId: string;
  type: "start_visit" | "end_visit" | "add_ticket";
  payload: any;
  createdAt: string;
}

const QUEUE_KEY = "field-tracker-offline-queue";

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getQueue(): Promise<QueuedAction[]> {
  return (await get(QUEUE_KEY)) ?? [];
}

export async function enqueueAction(type: QueuedAction["type"], payload: any): Promise<QueuedAction> {
  const action: QueuedAction = { clientId: newId(), type, payload, createdAt: new Date().toISOString() };
  const queue = await getQueue();
  queue.push(action);
  await set(QUEUE_KEY, queue);
  return action;
}

export async function clearQueue(): Promise<void> {
  await set(QUEUE_KEY, []);
}

/**
 * Flushes all queued offline actions to the server in order.
 * Returns the sync results so the UI can reconcile local temp records with server IDs.
 * Safe to call repeatedly (e.g. on every 'online' event) - clientId makes retries idempotent.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  try {
    const { results } = await api.syncActions(queue);
    const failedClientIds = new Set(
      results.filter((r) => r.status === "error").map((r) => r.clientId)
    );
    // Keep only the actions that failed; drop everything that synced (or was already synced)
    const remaining = queue.filter((a) => failedClientIds.has(a.clientId));
    await set(QUEUE_KEY, remaining);
    return { synced: queue.length - remaining.length, failed: remaining.length };
  } catch {
    // Network still unavailable or server unreachable - leave queue intact for next attempt
    return { synced: 0, failed: queue.length };
  }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Appends a ticket to an already-queued (not-yet-synced) start_visit action's payload. */
export async function addTicketToQueuedStart(startClientId: string, ticketNumber: string): Promise<void> {
  const queue = await getQueue();
  const startAction = queue.find((a) => a.clientId === startClientId && a.type === "start_visit");
  if (startAction) {
    startAction.payload.tickets = [...(startAction.payload.tickets ?? []), ticketNumber];
    await set(QUEUE_KEY, queue);
  }
}

/** Removes the start_visit action (and any related add_ticket/end_visit actions) for a
 * visit that was started offline but hasn't synced yet - used to cancel a mistaken visit
 * before it ever reaches the server. */
export async function removeQueuedVisit(startClientId: string): Promise<void> {
  const queue = await getQueue();
  const remaining = queue.filter(
    (a) => a.clientId !== startClientId && a.payload?.startClientId !== startClientId
  );
  await set(QUEUE_KEY, remaining);
}

const PENDING_VISIT_KEY = "field-tracker-pending-visit";

export interface PendingVisit {
  clientId: string;
  locationId: number;
  locationName: string;
  locationAddress: string;
  startTime: string;
  endTime: string | null;
  tickets: string[];
  notes: string;
}

export async function getPendingVisit(): Promise<PendingVisit | null> {
  return (await get(PENDING_VISIT_KEY)) ?? null;
}

export async function setPendingVisit(visit: PendingVisit | null): Promise<void> {
  await set(PENDING_VISIT_KEY, visit);
}
