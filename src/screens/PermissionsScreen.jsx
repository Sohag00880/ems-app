import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  requestPermissionsOnce,
  getPermissionStatus,
  openAppSettings,
} from '../lib/tracker.js';

export default function PermissionsScreen({ onDone }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    const s = await getPermissionStatus();
    setStatus(s);
    return s;
  }

  useEffect(() => {
    refresh();
  }, []);

  const allGranted =
    status?.foreground === 'granted' &&
    status?.background === 'granted' &&
    status?.servicesEnabled;

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestPermissionsOnce();
      await refresh();
      if (!res.granted) {
        setError(
          res.stage === 'background'
            ? 'Background location was not granted. Tap "Open app settings" and choose "Allow all the time".'
            : 'Location permission was not granted.',
        );
      }
    } catch (err) {
      setError(err.message || 'Could not request permissions');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconRow}>
        <Ionicons name="shield-checkmark-outline" size={40} color="#0f172a" />
      </View>

      <Text style={styles.title}>Set up location permissions</Text>
      <Text style={styles.body}>
        EMS records your location only while a visit is explicitly active. You can
        end a visit at any time to stop all location collection. We ask for
        permissions once — you will not be asked again on every visit.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current status</Text>
        <Row
          label="Foreground location"
          value={status?.foreground ?? '…'}
          ok={status?.foreground === 'granted'}
        />
        <Row
          label="Background location"
          value={status?.background ?? '…'}
          ok={status?.background === 'granted'}
        />
        <Row
          label="Device location services"
          value={status?.servicesEnabled ? 'On' : 'Off'}
          ok={status?.servicesEnabled === true}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {allGranted ? (
        <View style={styles.okBox}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
          <Text style={styles.okText}>All permissions granted</Text>
        </View>
      ) : null}

      {!allGranted ? (
        <Pressable onPress={ask} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Grant location permissions</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable onPress={openAppSettings} style={styles.secondary}>
        <Text style={styles.secondaryText}>Open app settings</Text>
      </Pressable>

      <Pressable onPress={refresh} style={styles.secondary}>
        <Text style={styles.secondaryText}>Refresh status</Text>
      </Pressable>

      <Pressable
        onPress={onDone}
        disabled={!allGranted}
        style={[styles.primary, !allGranted && styles.disabled]}
      >
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, ok }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {ok ? <Ionicons name="checkmark-circle" size={16} color="#16a34a" /> : null}
        <Text style={[styles.rowValue, ok ? styles.rowValueOk : styles.rowValueBad]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14 },
  iconRow: { alignItems: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  body: { color: '#475569', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: '#64748b', fontSize: 13 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, fontWeight: '500' },
  rowValueOk: { color: '#166534' },
  rowValueBad: { color: '#b91c1c' },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 },
  okBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 8,
  },
  okText: { color: '#166534', fontWeight: '600' },
  primary: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#0f172a', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});