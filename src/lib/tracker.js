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
import { enqueue } from './queue.js';

let foregroundSubscription = null;

export async function requestPermissions() {
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

async function startForegroundWatcher() {
    if (foregroundSubscription) return;
    const active = await loadActiveSession();
    if (!active?.sessionId) return;

    // Match the background strategy: check often, persist only on 50 m move.
    let last = null;
    const lastPersistedRef = { current: null };
    void lastPersistedRef;

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
                pointKey: `${sess.sessionId}-${loc.timestamp}-${Math.round(latitude * 1e5)}-${Math.round(longitude * 1e5)}`,
                sessionId: sess.sessionId,
                latitude,
                longitude,
                accuracyMeters: accuracy ?? null,
                capturedAt: new Date(loc.timestamp).toISOString(),
            };

            await enqueue(point);
            last = { lat: latitude, lng: longitude };
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

/**
 * Start a session. Chooses background or foreground mode based on which
 * permissions are granted.
 */
export async function startVisit() {
    // Capture current location for the start-of-visit marker.
    let startLocation;
    try {
        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 5000,
        });
        if (pos?.coords) {
            startLocation = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracyMeters: pos.coords.accuracy ?? undefined,
                capturedAt: new Date(pos.timestamp).toISOString(),
            };
        }
    } catch {
        /* proceed without start location */
    }

    const session = await api.startSession(startLocation ? { startLocation } : {});
    await saveActiveSession({
        sessionId: session.session._id ?? session.session.id,
        startedAt: session.session.startedAt,
    });
    resetBackoff();

    const perms = await getPermissionStatus();
    if (perms.background === 'granted') {
        await startBackgroundUpdates();
    } else if (perms.foreground === 'granted') {
        await startForegroundWatcher();
        uploadLoop();
        return { ...session.session, foregroundOnly: true };
    } else {
        await clearActiveSession();
        throw new Error('Location permission was revoked before the visit started');
    }

    uploadLoop();
    return session.session;
}

export async function endVisit() {
    const active = await loadActiveSession();
    if (!active?.sessionId) throw new Error('No active visit');

    // Capture current location for the end-of-visit marker.
    let endLocation;
    try {
        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 5000,
        });
        if (pos?.coords) {
            endLocation = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracyMeters: pos.coords.accuracy ?? undefined,
                capturedAt: new Date(pos.timestamp).toISOString(),
            };
        }
    } catch {
        /* proceed without end location */
    }

    const res = await api.endSession(active.sessionId, endLocation ? { endLocation } : {});
    await clearActiveSession();
    await stopBackgroundUpdates();
    stopForegroundWatcher();
    resetBackoff();
    uploadLoop({ force: true });
    return res.session;
}

export async function reconcileSession() {
    const res = await api.getMySessions({ status: 'ACTIVE', limit: 1 });
    const serverActive = res.sessions[0] ?? null;
    const local = await loadActiveSession();

    if (serverActive && !local) {
        await saveActiveSession({
            sessionId: serverActive._id ?? serverActive.id,
            startedAt: serverActive.startedAt,
        });
        const perms = await getPermissionStatus();
        if (perms.background === 'granted') await startBackgroundUpdates();
        else if (perms.foreground === 'granted') await startForegroundWatcher();
        return serverActive;
    }

    if (!serverActive && local) {
        await clearActiveSession();
        await stopBackgroundUpdates();
        stopForegroundWatcher();
        return null;
    }

    if (serverActive && local) {
        const perms = await getPermissionStatus();
        if (perms.background === 'granted') {
            const running = await isBackgroundTaskRegistered();
            if (!running) await startBackgroundUpdates();
        } else if (perms.foreground === 'granted') {
            await startForegroundWatcher();
        }
        return serverActive;
    }

    await stopBackgroundUpdates();
    stopForegroundWatcher();
    return null;
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