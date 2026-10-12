import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api.js';

export default function VisitDetailScreen({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [points, setPoints] = useState([]);
  const [addresses, setAddresses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          api.getMySession(sessionId),
          api.getMySessionPoints(sessionId),
        ]);
        if (cancelled) return;
        setSession(s.session);
        setPoints(p.points || []);

        // Resolve start/end addresses only. Points stay as coordinates on
        // mobile — the owner's dashboard (Phase 6) shows the full geocoded
        // list. This keeps the mobile app light and the free geocoding
        // quota well within limits.
        setLoadingAddr(true);
        try {
          const geo = await api.getMySessionGeocode(sessionId);
          if (!cancelled) setAddresses(geo);
        } catch {
          /* leave addresses null */
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
          <Row label="Status" value={session.status} />
          <Row label="Started" value={new Date(session.startedAt).toLocaleString()} />
          <Row
            label="Started at"
            value={
              addresses?.startAddress ?? (loadingAddr ? 'Loading…' : 'Address unavailable')
            }
          />
          <Row
            label="Ended"
            value={session.endedAt ? new Date(session.endedAt).toLocaleString() : '—'}
          />
          <Row
            label="Ended at"
            value={
              addresses?.endAddress ?? (loadingAddr ? 'Loading…' : 'Address unavailable')
            }
          />
          <Row label="Points recorded" value={String(points.length)} />

          <Pressable onPress={reloadAddresses} disabled={loadingAddr} style={styles.secondarySmall}>
            <Text style={styles.secondaryText}>
              {loadingAddr ? 'Loading addresses…' : 'Reload addresses'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {points.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Points ({points.length})</Text>
          <Text style={styles.hint}>
            Your manager can view the full route and per-point addresses on the dashboard.
          </Text>
          {points
            .slice()
            .reverse()
            .map((p) => (
              <View key={p.id} style={styles.pointRow}>
                <Text style={styles.pointTime}>
                  {new Date(p.capturedAt).toLocaleTimeString()}
                </Text>
                <Text style={styles.pointCoords}>
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </Text>
                <Text style={styles.pointAcc}>
                  {p.accuracyMeters != null ? `${Math.round(p.accuracyMeters)} m` : '—'}
                </Text>
              </View>
            ))}
          <Text style={styles.attribution}>
            Addresses © BigDataCloud, data © OpenStreetMap contributors
          </Text>
        </View>
      ) : null}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 6, fontStyle: 'italic' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#64748b', fontSize: 13, minWidth: 90 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pointTime: { color: '#334155', fontSize: 12, width: 90 },
  pointCoords: { color: '#0f172a', fontSize: 12, flex: 1 },
  pointAcc: { color: '#64748b', fontSize: 12, width: 50, textAlign: 'right' },
  attribution: { marginTop: 8, fontSize: 10, color: '#94a3b8', textAlign: 'center' },
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