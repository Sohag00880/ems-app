import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * Checks we can actually make from JS on Android.
 *
 * Things we CANNOT check from JS:
 *   - Whether the app is whitelisted from battery optimization (needs native module)
 *   - Whether "Auto-start" is enabled on Xiaomi/Huawei/etc.
 *
 * We show a generic "Open battery settings" button for these.
 */
export async function getDeviceHealth() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    servicesEnabled,
    foreground: fg.status,
    background: bg.status,
    platform: Platform.OS,
  };
}

export async function openBatterySettings() {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
  }
}