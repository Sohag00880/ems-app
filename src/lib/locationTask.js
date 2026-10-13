import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { enqueue } from './queue.js';
import { loadActiveSession } from './secureStore.js';
import { uploadLoop } from './uploader.js';

export const BACKGROUND_LOCATION_TASK = 'ems-background-location';

/**
 * Adaptive tracking: check every minute, persist only if moved ≥50m.
 * Android may delay fixes in Doze mode — that's a platform limitation.
 */
const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: 60_000,
  distanceInterval: 50,
  deferredUpdatesInterval: 30_000,
  deferredUpdatesDistance: 25,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  activityType: Location.ActivityType.AutomotiveNavigation,
  foregroundService: {
    notificationTitle: 'Boishakhi EMS — Visit tracking active',
    notificationBody:
      'Recording your location while you move during the active visit. Updates are approximate.',
    notificationColor: '#0f172a',
    killServiceOnDestroy: false,
  },
};

const lastPersisted = new Map();

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
  // eslint-disable-next-line no-console
  console.log('[bg-location] task fired', {
    hasError: !!error,
    hasData: !!data,
    count: data?.locations?.length ?? 0,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[bg-location] error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const active = await loadActiveSession();
  if (!active?.sessionId) {
    // eslint-disable-next-line no-console
    console.log('[bg-location] no active session — ignoring');
    return;
  }

  const sessionId = active.sessionId;
  let last = lastPersisted.get(sessionId) || null;

  for (const loc of data.locations) {
    const { latitude, longitude, accuracy } = loc.coords;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

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
      // eslint-disable-next-line no-console
      console.log('[bg-location] enqueued point:', {
        lat: latitude.toFixed(5),
        lng: longitude.toFixed(5),
        capturedAt: point.capturedAt,
        now: new Date().toISOString(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[bg-location] enqueue failed:', err.message);
    }
  }

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
  // eslint-disable-next-line no-console
  console.log('[bg-location] startBackgroundUpdates called');

  const already = await isBackgroundTaskRegistered();
  // eslint-disable-next-line no-console
  console.log('[bg-location] already registered?', already);

  if (already) {
    try {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      /* ignore */
    }
  }

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, TRACKING_OPTIONS);
    // eslint-disable-next-line no-console
    console.log('[bg-location] startLocationUpdatesAsync success — task is live');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bg-location] startLocationUpdatesAsync FAILED:', err.message);
    throw err;
  }
}

export async function stopBackgroundUpdates() {
  try {
    const registered = await isBackgroundTaskRegistered();
    if (registered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      // eslint-disable-next-line no-console
      console.log('[bg-location] stopLocationUpdatesAsync success');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[bg-location] stop failed:', err.message);
  } finally {
    lastPersisted.clear();
  }
}