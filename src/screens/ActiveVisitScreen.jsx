import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext.jsx';
import { uploadLoop } from '../lib/uploader.js';

export default function ActiveVisitScreen({ onBack }) {
  const { session, queueInfo, lastLocationAt, lastAccuracy, perm, busy, finishVisit } = useApp();
  const [elapsed, setElapsed] = useState('00:00:00');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!session) return undefined;
    const start = new Date(session.startedAt).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setElapsed(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  async function onSyncNow() {
    setSyncing(true);
    try {
      await uploadLoop({ force: true });
    } finally {
      setSyncing(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>No active visit.</Text>
        <Pressable onPress={onBack} style={styles.secondary}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active visit</Text>
        <Pressable onPress={onBack} style={styles.secondarySmall}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Elapsed</Text>
        <Text style={styles.timer}>{elapsed}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Started" value={new Date(session.startedAt).toLocaleString()} />
        <Row
          label="Last location update"
          value={lastLocationAt ? new Date(lastLocationAt).toLocaleTimeString() : 'Waiting for first fix…'}
        />
        <Row
          label="Last accuracy"
          value={lastAccuracy != null ? `${Math.round(lastAccuracy)} m` : '—'}
        />
        <Row label="Pending uploads" value={String(queueInfo.count)} />
        <Row
          label="Background permission"
          value={perm.background === 'granted' ? 'Granted' : 'Not granted'}
        />
        <Row
          label="Location services"
          value={perm.servicesEnabled ? 'On' : 'Off'}
        />
        {session.foregroundOnly ? (
          <Text style={styles.notice}>
            Foreground-only mode. Keep the app open during this visit.
          </Text>
        ) : null}
      </View>

      <View style={styles.buttonColumn}>
        <Pressable onPress={onSyncNow} disabled={syncing} style={styles.secondary}>
          {syncing ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Sync now</Text>}
        </Pressable>
        <Pressable
          onPress={finishVisit}
          disabled={busy}
          style={[styles.danger, busy && styles.buttonDisabled]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>End visit</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  fallbackText: { color: '#475569' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  timerCard: { backgroundColor: '#0f172a', borderRadius: 12, padding: 24, alignItems: 'center' },
  timerLabel: { color: '#cbd5e1', fontSize: 12, letterSpacing: 1 },
  timer: { color: '#fff', fontSize: 42, fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  notice: { color: '#92400e', fontSize: 12, backgroundColor: '#fef3c7', padding: 8, borderRadius: 6 },
  buttonColumn: { gap: 10 },
  primary: { backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  secondarySmall: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
  danger: { backgroundColor: '#b91c1c', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
});