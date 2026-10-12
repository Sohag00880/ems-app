import { api, ApiError } from './api.js';
import { peekForSession, removeByKeys, dropForSession, pendingCount, subscribe } from './queue.js';
import { loadActiveSession } from './secureStore.js';

const BATCH_SIZE = 50;
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

let uploading = false;
let consecutiveFailures = 0;

function firstSessionWithPending() {
  let id = null;
  const unsub = subscribe((snap) => {
    id = snap.sessionIds?.[0] ?? null;
  });
  unsub();
  return id;
}

export async function uploadLoop({ force = false } = {}) {
  if (uploading) return;
  uploading = true;
  try {
    if (pendingCount() === 0) return;

    const active = await loadActiveSession();
    const targetSessionId = active?.sessionId ?? firstSessionWithPending();
    if (!targetSessionId) return;

    if (!force && consecutiveFailures > 0) {
      const delay = BACKOFF_MS[Math.min(consecutiveFailures - 1, BACKOFF_MS.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
    }

    const batch = peekForSession(targetSessionId, BATCH_SIZE);
    if (batch.length === 0) return;

    const points = batch.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      accuracyMeters: p.accuracyMeters ?? undefined,
      capturedAt: p.capturedAt,
      pointKey: p.pointKey,
    }));

    try {
      const res = await api.uploadPoints(targetSessionId, points);
      consecutiveFailures = 0;
      await removeByKeys(targetSessionId, batch.map((p) => p.pointKey));
      if (pendingCount() > 0) setTimeout(() => uploadLoop(), 500);
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 410 || err.code === 'GONE') {
          await dropForSession(targetSessionId);
          consecutiveFailures = 0;
          return { dropped: true, reason: err.code };
        }
        if (err.status === 409) {
          await dropForSession(targetSessionId);
          consecutiveFailures = 0;
          return { dropped: true, reason: err.code };
        }
        if (err.status === 401) {
          return { authError: true };
        }
      }
      consecutiveFailures += 1;
      if (consecutiveFailures <= 10) setTimeout(() => uploadLoop(), 1000);
      throw err;
    }
  } finally {
    uploading = false;
  }
}

export function resetBackoff() {
  consecutiveFailures = 0;
}