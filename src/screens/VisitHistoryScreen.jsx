import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api.js';

export default function VisitHistoryScreen({ onBack, onOpenSession }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMySessions({ page, limit: 10, status: 'all' });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Visit history</Text>
        <Pressable onPress={onBack} style={styles.secondarySmall}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator /> : null}

      {data?.sessions?.length === 0 && !loading ? (
        <Text style={styles.empty}>No visits recorded yet.</Text>
      ) : null}

      {data?.sessions?.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onOpenSession(s.id)}
          style={styles.card}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {new Date(s.startedAt).toLocaleDateString()} · {s.status}
            </Text>
            <Text style={styles.cardSub}>
              {new Date(s.startedAt).toLocaleTimeString()}
              {s.endedAt ? ` – ${new Date(s.endedAt).toLocaleTimeString()}` : ''}
            </Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </Pressable>
      ))}

      {data?.pagination && data.pagination.pages > 1 ? (
        <View style={styles.pager}>
          <Pressable
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={[styles.secondarySmall, page <= 1 && { opacity: 0.5 }]}
          >
            <Text style={styles.secondaryText}>Previous</Text>
          </Pressable>
          <Text style={styles.pageInfo}>
            Page {data.pagination.page} / {data.pagination.pages}
          </Text>
          <Pressable
            onPress={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
            disabled={page >= data.pagination.pages}
            style={[styles.secondarySmall, page >= data.pagination.pages && { opacity: 0.5 }]}
          >
            <Text style={styles.secondaryText}>Next</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardArrow: { fontSize: 22, color: '#94a3b8' },
  empty: { color: '#64748b', fontSize: 13, padding: 12 },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  pageInfo: { color: '#475569', fontSize: 12 },
  secondarySmall: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
});