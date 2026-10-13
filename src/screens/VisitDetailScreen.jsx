import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../lib/api.js';

export default function VisitDetailScreen({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getMySession(sessionId);
        if (cancelled) return;
        setSession(s.session);

        // Start/End addresses only. Individual points are not shown to
        // employees — those are visible on the owner dashboard.
        setLoadingAddr(true);
        try {
          const geo = await api.getMySessionGeocode(sessionId);
          if (!cancelled) setAddresses(geo);
        } catch {
          /* keep null */
        } finally {
          if (!cancelled) setLoadingAddr(false);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function reloadAddresses() {
    setLoadingAddr(true);
    try {
      const geo = await api.getMySessionGeocode(sessionId);
      setAddresses(geo);
    } catch {
      /* ignore */
    } finally {
      setLoadingAddr(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Visit detail</Text>
        <Pressable onPress={onBack} style={styles.secondarySmall}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {session ? (
        <View style={styles.card}>
          <Row
            label="Status"
            value={session.status === 'ACTIVE' ? 'Active' : 'Ended'}
          />
          <Row
            label="Started"
            value={new Date(session.startedAt).toLocaleString()}
          />
          <Row
            label="Started at"
            value={
              addresses?.startAddress ??
              (loadingAddr ? 'Loading address…' : 'Address unavailable')
            }
          />
          <Row
            label="Ended"
            value={
              session.endedAt ? new Date(session.endedAt).toLocaleString() : '—'
            }
          />
          <Row
            label="Ended at"
            value={
              addresses?.endAddress ??
              (loadingAddr ? 'Loading address…' : 'Address unavailable')
            }
          />

          <Pressable
            onPress={reloadAddresses}
            disabled={loadingAddr}
            style={styles.secondarySmall}
          >
            <Text style={styles.secondaryText}>
              {loadingAddr ? 'Loading addresses…' : 'Reload addresses'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.note}>
        Your manager can view the full route and location details on the dashboard.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#64748b', fontSize: 13, minWidth: 90 },
  rowValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  note: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
  },
  secondarySmall: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
});