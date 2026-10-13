import * as Location from 'expo-location';
import { Platform, Linking, AppState } from 'react-native';
import { api } from './api.js';
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from './secureStore.js';
import {
  startBackgroundUpdates,
  stopBackgroundUpdates,
  isBackgroundTaskRegistered,
} from './locationTask.js';
import { resetBackoff, uploadLoop } from './uploader.js';
import { enqueue, clearAll as clearQueue } from './queue.js';

let foregroundSubscription = null;

/**
 * Silent permission check. Does NOT trigger any system prompt.
 * Use this on Start Visit — only succeeds if the user has already granted
 * the permissions during onboarding.
 */
export async function checkPermissions() {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { ok: false, reason: 'foreground', canAskAgain: fg.canAskAgain };
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { ok: false, reason: 'background', canAskAgain: bg.canAskAgain };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { ok: false, reason: 'services_disabled', canAskAgain: false };
  }

  return { ok: true };
}

/**
 * Explicit permission request. Only called from onboarding screen.
 * This is the ONLY place that triggers the system prompt.
 */
export async function requestPermissionsOnce() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { granted: false, stage: 'foreground', canAskAgain: fg.canAskAgain };
  }

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { granted: false, stage: 'background', canAskAgain: bg.canAskAgain };
  }

  return { granted: true };
}

/**
 * Detailed status for UI.
 */
export async function getPermissionStatus() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  return {
    foreground: fg.status,
    background: bg.status,
    servicesEnabled,
  };
}

export async function openAppSettings() {
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  } else {
    await Linking.openURL('app-settings:');
  }
}

/**
 * Try to obtain a location quickly: cached position first, then a fresh
 * fix with a reasonable timeout. Returns null on failure.
 */
async function getQuickLocation() {
  try {
    const cached = await Location.getLastKnownPositionAsync({
      maxAge: 60_000,
      requiredAccuracy: 200,
    });
    if (cached?.coords) return cached;
  } catch {
    /* ignore */
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 10_000,
    });
  } catch {
    return null;
  }
}

/**
 * Start visit.
 *
 * - Clears any stale queued points from a prior session.
 * - Checks permissions silently; throws a friendly error if missing.
 * - Captures start location (best effort).
 * - Creates the server session.
 * - Waits 2s so the server registers the session before first GPS fix.
 * - Starts the background location task.
 */
export async function startVisit() {
  // Clear stale queued points — they would fail validation against the
  // new session's time window.
  try {
    await clearQueue();
    // eslint-disable-next-line no-console
    console.log('[tracker] cleared stale queue before new session');
  } catch {
    /* ignore */
  }

  // eslint-disable-next-line no-console
  console.log('[tracker] startVisit — checking permissions silently…');

  const perm = await checkPermissions();
  if (!perm.ok) {
    // eslint-disable-next-line no-console
    console.warn('[tracker] permissions missing:', perm.reason);
    const err = new Error(
      perm.reason === 'foreground'
        ? 'Location permission is required.'
        : perm.reason === 'background'
          ? 'Background location permission is required. Please enable "Allow all the time" in Settings.'
          : 'Please enable location services on your device.',
    );
    err.code = 'PERMISSION_REQUIRED';
    err.stage = perm.reason;
    throw err;
  }

  // eslint-disable-next-line no-console
  console.log('[tracker] startVisit — capturing start location…');

  const loc = await getQuickLocation();

  let startLocation;
  if (loc?.coords) {
    startLocation = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyMeters: loc.coords.accuracy ?? undefined,
      capturedAt: new Date(loc.timestamp).toISOString(),
    };
    // eslint-disable-next-line no-console
    console.log(
      '[tracker] start location captured:',
      startLocation.latitude.toFixed(5),
      startLocation.longitude.toFixed(5),
      '±' + Math.round(startLocation.accuracyMeters || 0) + 'm',
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn('[tracker] start location unavailable — starting session anyway');
  }

  const session = await api.startSession(startLocation ? { startLocation } : {});

  await saveActiveSession({
    sessionId: session.session._id ?? session.session.id,
    startedAt: session.session.startedAt,
  });
  resetBackoff();

  // Give the server a moment to commit the session before the first
  // background GPS fix arrives. This avoids "capturedAt outside window"
  // errors on very low-latency devices.
  await new Promise((r) => setTimeout(r, 2000));

  try {
    await startBackgroundUpdates();
    // eslint-disable-next-line no-console
    console.log('[tracker] background updates started');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[tracker] background updates failed:', err.message);
    // Fall back to foreground-only watch.
    await startForegroundWatcher();
    return { ...session.session, foregroundOnly: true };
  }

  uploadLoop();
  return session.session;
}

/**
 * End visit.
 */
export async function endVisit() {
  const active = await loadActiveSession();
  if (!active?.sessionId) throw new Error('No active visit');

  // eslint-disable-next-line no-console
  console.log('[tracker] endVisit — capturing end location…');

  const loc = await getQuickLocation();
  let endLocation;
  if (loc?.coords) {
    endLocation = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyMeters: loc.coords.accuracy ?? undefined,
      capturedAt: new Date(loc.timestamp).toISOString(),
    };
    // eslint-disable-next-line no-console
    console.log(
      '[tracker] end location captured:',
      endLocation.latitude.toFixed(5),
      endLocation.longitude.toFixed(5),
    );
  }

  const res = await api.endSession(active.sessionId, endLocation ? { endLocation } : {});

  await clearActiveSession();
  await stopBackgroundUpdates();
  stopForegroundWatcher();
  resetBackoff();
  uploadLoop({ force: true });
  return res.session;
}

/**
 * Reconcile local state with the server. Called on app start and whenever
 * the app returns to the foreground.
 */
export async function reconcileSession() {
  const res = await api.getMySessions({ status: 'ACTIVE', limit: 1 });
  const serverActive = res.sessions[0] ?? null;
  const local = await loadActiveSession();

  if (serverActive && !local) {
    await saveActiveSession({
      sessionId: serverActive._id ?? serverActive.id,
      startedAt: serverActive.startedAt,
    });
    const perm = await checkPermissions();
    if (perm.ok) {
      await startBackgroundUpdates().catch(() => startForegroundWatcher());
    } else {
      await startForegroundWatcher().catch(() => {});
    }
    return serverActive;
  }

  if (!serverActive && local) {
    await clearActiveSession();
    await stopBackgroundUpdates();
    stopForegroundWatcher();
    return null;
  }

  if (serverActive && local) {
    const perm = await checkPermissions();
    if (perm.ok) {
      const running = await isBackgroundTaskRegistered();
      if (!running) await startBackgroundUpdates().catch(() => {});
    } else {
      await startForegroundWatcher().catch(() => {});
    }
    return serverActive;
  }

  await stopBackgroundUpdates();
  stopForegroundWatcher();
  return null;
}

/**
 * Foreground-only watcher fallback (used when background permission is
 * unavailable, or background updates fail to start).
 */
async function startForegroundWatcher() {
  if (foregroundSubscription) return;
  const active = await loadActiveSession();
  if (!active?.sessionId) return;

  // eslint-disable-next-line no-console
  console.log('[tracker] starting foreground-only watcher');

  let last = null;

  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 60_000,
      distanceInterval: 50,
    },
    async (loc) => {
      const sess = await loadActiveSession();
      if (!sess?.sessionId) return;

      const { latitude, longitude, accuracy } = loc.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      if (last) {
        const R = 6371000;
        const toRad = (x) => (x * Math.PI) / 180;
        const dLat = toRad(latitude - last.lat);
        const dLng = toRad(longitude - last.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(last.lat)) * Math.cos(toRad(latitude)) * Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        if (d < 50) return;
      }

      const point = {
        pointKey: `${sess.sessionId}-${loc.timestamp}-${Math.round(latitude * 1e5)}-${Math.round(
          longitude * 1e5,
        )}`,
        sessionId: sess.sessionId,
        latitude,
        longitude,
        accuracyMeters: accuracy ?? null,
        capturedAt: new Date(loc.timestamp).toISOString(),
      };

      await enqueue(point);
      last = { lat: latitude, lng: longitude };
      // eslint-disable-next-line no-console
      console.log(
        '[tracker] foreground point captured:',
        latitude.toFixed(5),
        longitude.toFixed(5),
      );
      uploadLoop();
    },
  );
}

function stopForegroundWatcher() {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
}

export function subscribeToForeground(onForeground) {
  let lastState = AppState.currentState;
  const sub = AppState.addEventListener('change', async (next) => {
    const cameToForeground = lastState.match(/inactive|background/) && next === 'active';
    lastState = next;
    if (cameToForeground) {
      try {
        await onForeground();
      } catch {
        /* ignore */
      }
    }
  });
  return () => sub.remove();
}