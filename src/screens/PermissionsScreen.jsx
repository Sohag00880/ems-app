import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext.jsx';
import { requestPermissions, openAppSettings, getPermissionStatus } from '../lib/tracker.js';

export default function PermissionsScreen({ onDone }) {
  const { perm, refreshPerm } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestPermissions();
      await refreshPerm();
      if (!res.granted) {
        setError(
          res.stage === 'background'
            ? 'Background location was not granted. Choose “Allow all the time” in the system settings to record visits while the app is closed.'
            : 'Location permission was not granted.',
        );
      } else {
        onDone?.();
      }
    } catch (err) {
      setError(err.message || 'Could not request permissions');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await getPermissionStatus();
    await refreshPerm();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Permissions</Text>
      <Text style={styles.body}>
        EMS records your location only while a visit is explicitly active. You can end a visit at any
        time to stop all location collection.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current status</Text>
        <Row label="Foreground location" value={perm.foreground} />
        <Row label="Background location" value={perm.background} />
        <Row label="Device location services" value={perm.servicesEnabled ? 'On' : 'Off'} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={ask} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Grant location permissions</Text>}
      </Pressable>

      <Pressable onPress={openAppSettings} style={styles.secondary}>
        <Text style={styles.secondaryText}>Open app settings</Text>
      </Pressable>

      <Pressable onPress={refresh} style={styles.secondary}>
        <Text style={styles.secondaryText}>Refresh status</Text>
      </Pressable>

      {onDone ? (
        <Pressable onPress={onDone} style={styles.secondary}>
          <Text style={styles.secondaryText}>Close</Text>
        </Pressable>
      ) : null}
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
  container: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  body: { color: '#475569', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 },
  primary: { backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});