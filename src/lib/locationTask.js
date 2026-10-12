import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { enqueue } from './queue.js';
import { loadActiveSession } from './secureStore.js';
import { uploadLoop } from './uploader.js';

export const BACKGROUND_LOCATION_TASK = 'ems-background-location';

/**
 * Tracking configuration.
 *
 * "Adaptive" strategy:
 *   - Ask Android for a location fix roughly every minute.
 *   - Only persist the fix if the device has moved at least MIN_DISTANCE_M meters
 *     since the last persisted point. This keeps the route clean (no duplicate
 *     points while standing still) and saves battery.
 *
 * Android may delay or batch fixes for battery; real-world intervals in
 * background are typically 1–5 minutes. That is a platform limitation, not
 * something we can override from JS.
 */
const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.High,      // High is fine here because we skip most fixes
  timeInterval: 60_000,                  // ask for a fix ~every 60 s
  distanceInterval: 50,                  // persist only if moved ≥50 m
  deferredUpdatesInterval: 30_000,
  deferredUpdatesDistance: 25,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  activityType: Location.ActivityType.AutomotiveNavigation,
  foregroundService: {
    notificationTitle: 'Visit tracking active — EMS',
    notificationBody:
      'Recording your location while you move during the active visit. Updates are approximate.',
    notificationColor: '#0f172a',
    killServiceOnDestroy: false,
  },
};

// Track last persisted coordinate per session, so we can enforce the
// 50 m rule ourselves even if the OS gives us more fixes than we asked for.
const lastPersisted = new Map(); // sessionId -> { lat, lng }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[bg-location] error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const active = await loadActiveSession();
  if (!active?.sessionId) return;

  const sessionId = active.sessionId;
  const prev = lastPersisted.get(sessionId) || null;
  let last = prev;

  for (const loc of data.locations) {
    const { latitude, longitude, accuracy } = loc.coords;

    // Reject clearly bad fixes.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

    // Enforce the 50 m rule ourselves (belt-and-braces with distanceInterval).
    if (last) {
      const d = distanceMeters(last.lat, last.lng, latitude, longitude);
      if (d < 50) continue;
    }

    const point = {
      pointKey: `${sessionId}-${loc.timestamp}-${Math.round(latitude * 1e5)}-${Math.round(
        longitude * 1e5,
      )}`,
      sessionId,
      latitude,
      longitude,
      accuracyMeters: accuracy ?? null,
      capturedAt: new Date(loc.timestamp).toISOString(),
    };

    try {
      await enqueue(point);
      last = { lat: latitude, lng: longitude };
      lastPersisted.set(sessionId, last);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[bg-location] enqueue failed:', err.message);
    }
  }

  // Opportunistic upload — safe to call repeatedly.
  try {
    await uploadLoop();
  } catch {
    /* uploader handles its own errors */
  }
});

export async function isBackgroundTaskRegistered() {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startBackgroundUpdates() {
  const already = await isBackgroundTaskRegistered();
  if (already) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
  }
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, TRACKING_OPTIONS);
}

export async function stopBackgroundUpdates() {
  try {
    const registered = await isBackgroundTaskRegistered();
    if (registered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[bg-location] stop failed:', err.message);
  } finally {
    // Clear the in-memory last-position map so a fresh session starts clean.
    lastPersisted.clear();
  }
}