// Dynamic Expo config. Reads environment variables at build time.
// Only variables prefixed EXPO_PUBLIC_ are exposed to the app runtime.
const IS_DEV = process.env.APP_VARIANT !== 'production';

export default {
  expo: {
    name: IS_DEV ? 'EMS Field Visit (dev)' : 'EMS Field Visit',
    slug: 'ems-mobile',
    version: '0.5.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    scheme: 'emsfieldvisit',
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'EMS needs your location during an active visit so your supervisor can see the visit route you took. Location is only collected while you have explicitly started a visit.',
          locationAlwaysPermission:
            'Allow EMS to access your location in the background while a visit is active. Tracking stops as soon as you end the visit.',
          locationWhenInUsePermission:
            'EMS uses your location while a visit is active to record the route you took.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      'expo-dev-client',
    ],
    android: {
      package: 'com.example.emsfieldvisit',
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
    },
    ios: {
      bundleIdentifier: 'com.example.emsfieldvisit',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'EMS uses your location while a visit is active to record the route you took.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'EMS tracks your location in the background only while you have an active visit.',
        UIBackgroundModes: ['location'],
      },
    },
    extra: {
      eas: {
        projectId: '29f18327-2bd8-4aa0-9f3e-8f75c4a34bbb',
      },
    },
  },
};