import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'ems.accessToken',
  ACTIVE_SESSION_ID: 'ems.activeSessionId',
  ACTIVE_SESSION_STARTED_AT: 'ems.activeSessionStartedAt',
};

export async function saveAccessToken(token) {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}
export async function loadAccessToken() {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}
export async function clearAccessToken() {
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
}

export async function saveActiveSession({ sessionId, startedAt }) {
  await SecureStore.setItemAsync(KEYS.ACTIVE_SESSION_ID, sessionId);
  await SecureStore.setItemAsync(KEYS.ACTIVE_SESSION_STARTED_AT, startedAt);
}
export async function loadActiveSession() {
  const sessionId = await SecureStore.getItemAsync(KEYS.ACTIVE_SESSION_ID);
  const startedAt = await SecureStore.getItemAsync(KEYS.ACTIVE_SESSION_STARTED_AT);
  if (!sessionId) return null;
  return { sessionId, startedAt };
}
export async function clearActiveSession() {
  await SecureStore.deleteItemAsync(KEYS.ACTIVE_SESSION_ID);
  await SecureStore.deleteItemAsync(KEYS.ACTIVE_SESSION_STARTED_AT);
}

export { KEYS };