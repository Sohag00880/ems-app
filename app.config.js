// Dynamic Expo config. Reads environment variables at build time.
const IS_DEV = process.env.APP_VARIANT !== 'production';

export default {
  expo: {
    name: IS_DEV ? 'Boishakhi EMS (dev)' : 'Boishakhi EMS',
    slug: 'ems-mobile',
    version: '0.7.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    scheme: 'boishakhi-ems',
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Boishakhi EMS needs your location during an active visit so your supervisor can see the visit route you took. Location is only collected while you have explicitly started a visit.',
          locationAlwaysPermission:
            'Allow Boishakhi EMS to access your location in the background while a visit is active. Tracking stops as soon as you end the visit.',
          locationWhenInUsePermission:
            'Boishakhi EMS uses your location while a visit is active to record the route you took.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      'expo-dev-client',
    ],
    android: {
      package: 'com.boishakhi.ems',
      versionCode: 7,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'WAKE_LOCK',
        'RECEIVE_BOOT_COMPLETED',
      ],
    },
    ios: {
      bundleIdentifier: 'com.boishakhi.ems',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Boishakhi EMS uses your location while a visit is active to record the route you took.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Boishakhi EMS tracks your location in the background only while you have an active visit.',
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