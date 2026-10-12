import { File, Paths } from 'expo-file-system';

const QUEUE_FILENAME = 'ems-point-queue.json';

let cache = null;
let writing = null;
const listeners = new Set();

function queueFile() {
  // Paths.document is the app's private document directory.
  return new File(Paths.document, QUEUE_FILENAME);
}

function readFileSync() {
  const f = queueFile();
  try {
    if (!f.exists) return [];
    const raw = f.textSync();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt file — move it aside for inspection, start fresh.
    try {
      const corrupt = new File(Paths.document, `${QUEUE_FILENAME}.corrupt-${Date.now()}`);
      f.move(corrupt);
    } catch {
      /* ignore */
    }
    return [];
  }
}

async function writeFileAsync(items) {
  if (writing) await writing;
  const f = queueFile();
  if (!f.exists) {
    f.create();
  }
  writing = Promise.resolve(f.write(JSON.stringify(items)));
  await writing;
  writing = null;
}

function notify() {
  const snapshot = getSnapshot();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      /* ignore listener errors */
    }
  }
}

function getSnapshot() {
  const items = cache ?? [];
  return {
    count: items.length,
    sessionIds: [...new Set(items.map((p) => p.sessionId))],
  };
}

export async function initQueue() {
  cache = readFileSync();
  notify();
  return cache;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getSnapshot());
  return () => listeners.delete(listener);
}

export function pendingCount() {
  return (cache ?? []).length;
}

export function pendingForSession(sessionId) {
  return (cache ?? []).filter((p) => p.sessionId === sessionId).length;
}

export async function enqueue(point) {
  if (!cache) cache = readFileSync();
  cache.push(point);
  await writeFileAsync(cache);
  notify();
}

export async function removeByKeys(sessionId, pointKeys) {
  if (!cache) cache = readFileSync();
  const keySet = new Set(pointKeys);
  cache = cache.filter((p) => !(p.sessionId === sessionId && keySet.has(p.pointKey)));
  await writeFileAsync(cache);
  notify();
}

export function peekForSession(sessionId, limit) {
  const items = (cache ?? []).filter((p) => p.sessionId === sessionId);
  items.sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
  return items.slice(0, limit);
}

export async function dropForSession(sessionId) {
  if (!cache) cache = readFileSync();
  cache = cache.filter((p) => p.sessionId !== sessionId);
  await writeFileAsync(cache);
  notify();
}

export async function clearAll() {
  cache = [];
  await writeFileAsync(cache);
  notify();
}