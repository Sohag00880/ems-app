import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, setAccessToken } from '../lib/api.js';
import {
  loadAccessToken,
  saveAccessToken,
  clearAccessToken,
  loadActiveSession,
  clearActiveSession,
} from '../lib/secureStore.js';
import { initQueue, subscribe, clearAll as clearQueue } from '../lib/queue.js';
import {
  getPermissionStatus,
  startVisit,
  endVisit,
  reconcileSession,
  subscribeToForeground,
} from '../lib/tracker.js';
import { uploadLoop } from '../lib/uploader.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null); // { id, startedAt, foregroundOnly? }
  const [perm, setPerm] = useState({ foreground: 'undetermined', background: 'undetermined', servicesEnabled: true });
  const [queueInfo, setQueueInfo] = useState({ count: 0, sessionIds: [] });
  const [lastLocationAt, setLastLocationAt] = useState(null);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const intervalRef = useRef(null);

  // Queue subscription
  useEffect(() => {
    initQueue().then(() => {
      const unsub = subscribe((snap) => setQueueInfo(snap));
      return unsub;
    });
  }, []);

  // On boot: restore token, reconcile session, start polling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadAccessToken();
        if (token) {
          setAccessToken(token);
          try {
            const me = await api.me();
            if (cancelled) return;
            setUser(me.user);
            const active = await reconcileSession();
            if (!cancelled && active) {
              setSession({
                id: active._id ?? active.id,
                startedAt: active.startedAt,
                lastLocationAt: active.lastLocationAt,
              });
              setLastLocationAt(active.lastLocationAt ?? null);
            }
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              await clearAccessToken();
              setAccessToken(null);
              setUser(null);
            } else if (!cancelled) {
              setError(err.message);
            }
          }
        }
      } finally {
        if (!cancelled) {
          const p = await getPermissionStatus();
          if (!cancelled) setPerm(p);
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Foreground reconciliation + periodic polling while signed in.
  useEffect(() => {
    if (!user) return undefined;
    const unsub = subscribeToForeground(async () => {
      const p = await getPermissionStatus();
      setPerm(p);
      const active = await reconcileSession();
      setSession(active ? { id: active._id ?? active.id, startedAt: active.startedAt } : null);
    });
    return () => unsub();
  }, [user]);

  // Poll /sessions/my for a live view of the current session while signed in.
  useEffect(() => {
    if (!user) return undefined;
    const tick = async () => {
      try {
        const res = await api.getMySessions({ status: 'ACTIVE', limit: 1 });
        const active = res.sessions[0] ?? null;
        if (active) {
          setSession({ id: active._id ?? active.id, startedAt: active.startedAt });
          setLastLocationAt(active.lastLocationAt ?? null);
        } else {
          setSession(null);
        }
      } catch {
        /* ignore polling errors */
      }
      uploadLoop();
    };
    tick();
    intervalRef.current = setInterval(tick, 15_000);
    return () => clearInterval(intervalRef.current);
  }, [user]);

  const login = useCallback(async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      setAccessToken(res.accessToken);
      await saveAccessToken(res.accessToken);
      setUser(res.user);
      const p = await getPermissionStatus();
      setPerm(p);
      const active = await reconcileSession();
      if (active) {
        setSession({ id: active._id ?? active.id, startedAt: active.startedAt });
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await api.logout().catch(() => {});
      await clearAccessToken();
      await clearActiveSession();
      await clearQueue();
      setAccessToken(null);
      setUser(null);
      setSession(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const beginVisit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await startVisit();
      setSession({ id: s._id ?? s.id, startedAt: s.startedAt, foregroundOnly: s.foregroundOnly });
      return s;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already active — reconcile.
        const active = await reconcileSession();
        if (active) {
          setSession({ id: active._id ?? active.id, startedAt: active.startedAt });
        }
      }
      setError(err.message || 'Could not start visit');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const finishVisit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await endVisit();
      setSession(null);
      return s;
    } catch (err) {
      setError(err.message || 'Could not end visit');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshPerm = useCallback(async () => {
    const p = await getPermissionStatus();
    setPerm(p);
    return p;
  }, []);

  const value = {
    booting,
    user,
    session,
    perm,
    queueInfo,
    lastLocationAt,
    lastAccuracy,
    setLastAccuracy,
    error,
    setError,
    busy,
    login,
    logout,
    beginVisit,
    finishVisit,
    refreshPerm,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}