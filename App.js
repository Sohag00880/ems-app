// Polyfill for uuid on RN — required by uuid's v4 in older Hermes builds.
import 'react-native-get-random-values';

import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Register the background location task at module load. Must be imported
// BEFORE the app renders so TaskManager sees the definition.
import './src/lib/locationTask.js';

import { AppProvider, useApp } from './src/state/AppContext.jsx';
import LoginScreen from './src/screens/LoginScreen.jsx';
import HomeScreen from './src/screens/HomeScreen.jsx';
import ActiveVisitScreen from './src/screens/ActiveVisitScreen.jsx';
import VisitHistoryScreen from './src/screens/VisitHistoryScreen.jsx';
import VisitDetailScreen from './src/screens/VisitDetailScreen.jsx';
import PermissionsScreen from './src/screens/PermissionsScreen.jsx';

function Root() {
  const { booting, user } = useApp();
  const [route, setRoute] = useState({ name: 'home' });
  const [showPerms, setShowPerms] = useState(false);

  // When the session becomes null, pop out of ActiveVisitScreen automatically.
  useEffect(() => {
    const handler = () => {
      setRoute((r) => (r.name === 'active' ? { name: 'home' } : r));
    };
    return handler;
  }, []);

  if (booting) return null;
  if (!user) return <LoginScreen />;

  if (showPerms) {
    return <PermissionsScreen onDone={() => setShowPerms(false)} />;
  }

  switch (route.name) {
    case 'active':
      return <ActiveVisitScreen onBack={() => setRoute({ name: 'home' })} />;
    case 'history':
      return (
        <VisitHistoryScreen
          onBack={() => setRoute({ name: 'home' })}
          onOpenSession={(sessionId) => setRoute({ name: 'detail', sessionId })}
        />
      );
    case 'detail':
      return (
        <VisitDetailScreen
          sessionId={route.sessionId}
          onBack={() => setRoute({ name: 'history' })}
        />
      );
    case 'home':
    default:
      return (
        <HomeScreen
          onOpenHistory={() => setRoute({ name: 'history' })}
          onOpenActive={() => setRoute({ name: 'active' })}
          onOpenPermissions={async (auto) => {
            setShowPerms(true);
            void auto;
          }}
        />
      );
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppProvider>
          <Root />
        </AppProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
});