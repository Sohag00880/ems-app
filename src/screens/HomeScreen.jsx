import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../state/AppContext.jsx';

export default function HomeScreen({ onOpenHistory, onOpenActive, onOpenPermissions }) {
  const { user, session, perm, queueInfo, lastLocationAt, busy, error, beginVisit, finishVisit, logout } = useApp();

  const permWarnings = [];
  if (perm.foreground !== 'granted') permWarnings.push('Location permission not granted');
  if (perm.background !== 'granted') permWarnings.push('Background location not granted (tracking will only run while the app is open)');
  if (!perm.servicesEnabled) permWarnings.push('Device location services are turned off');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>EMS Field Visit</Text>
          <Text style={styles.subtitle}>
            {user?.name} · {user?.role}
          </Text>
        </View>
        <Pressable onPress={logout} disabled={busy} style={styles.logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>

      {permWarnings.length > 0 && (
        <View style={styles.warn}>
          {permWarnings.map((w) => (
            <Text key={w} style={styles.warnText}>• {w}</Text>
          ))}
          <Pressable onPress={onOpenPermissions} style={styles.warnButton}>
            <Text style={styles.warnButtonText}>Open permission help</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current visit</Text>
        {session ? (
          <>
            <Row label="Status" value="ACTIVE" />
            <Row label="Started" value={new Date(session.startedAt).toLocaleString()} />
            <Row
              label="Last location update"
              value={lastLocationAt ? new Date(lastLocationAt).toLocaleTimeString() : 'Waiting…'}
            />
            <Row label="Pending uploads" value={String(queueInfo.count)} />
            {session.foregroundOnly ? (
              <Text style={styles.notice}>
                Tracking is in foreground-only mode because background permission is not granted.
                Keep the app open during your visit.
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              <Pressable onPress={onOpenActive} style={styles.secondary}>
                <Text style={styles.secondaryText}>Open active visit</Text>
              </Pressable>
              <Pressable
                onPress={finishVisit}
                disabled={busy}
                style={[styles.danger, busy && styles.buttonDisabled]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>End visit</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.empty}>
              No active visit. Start a visit to begin recording your route.
            </Text>
            <Pressable
              onPress={async () => {
                await onOpenPermissions(true); // ensure perms
                try {
                  const s = await beginVisit();
                  if (s) onOpenActive();
                } catch {
                  /* error shown in context */
                }
              }}
              disabled={busy}
              style={[styles.primary, busy && styles.buttonDisabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Start visit</Text>}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>History</Text>
        <Text style={styles.empty}>See your previous visits and where you went.</Text>
        <Pressable onPress={onOpenHistory} style={styles.secondary}>
          <Text style={styles.secondaryText}>Open visit history</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#475569', marginTop: 2 },
  logout: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  logoutText: { fontSize: 12, color: '#0f172a' },
  warn: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, gap: 6 },
  warnText: { color: '#92400e', fontSize: 12 },
  warnButton: { marginTop: 6, alignSelf: 'flex-start' },
  warnButtonText: { color: '#92400e', fontWeight: '600', textDecorationLine: 'underline' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  empty: { color: '#64748b', fontSize: 13 },
  notice: { color: '#92400e', fontSize: 12, backgroundColor: '#fef3c7', padding: 8, borderRadius: 6 },
  primary: { backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
  danger: { backgroundColor: '#b91c1c', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 },
});