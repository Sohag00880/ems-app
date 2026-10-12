const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

let accessToken = null;
export function setAccessToken(token) {
    accessToken = token;
}
export function getAccessToken() {
    return accessToken;
}

/**
 * Custom error class so callers can distinguish HTTP statuses.
 */
export class ApiError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function request(path, { method = 'GET', body, withAuth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (networkErr) {
        // Treat as offline so callers can queue.
        throw new ApiError(0, 'NETWORK_ERROR', networkErr.message || 'Network error');
    }

    let data = null;
    try {
        data = await res.json();
    } catch {
        /* empty body */
    }

    if (!res.ok) {
        const code = data?.error?.code || `HTTP_${res.status}`;
        const message = data?.error?.message || `Request failed (${res.status})`;
        throw new ApiError(res.status, code, message, data?.error?.details);
    }
    return data;
}

export const api = {
    // Auth
    login: (email, password) =>
        request('/api/auth/login', { method: 'POST', body: { email, password }, withAuth: false }),
    me: () => request('/api/auth/me'),
    logout: () => request('/api/auth/logout', { method: 'POST', withAuth: false }),

    // Tracking (employee)
    startSession: (payload = {}) =>
        request('/api/tracking/sessions/start', { method: 'POST', body: payload }),
    endSession: (sessionId, payload = {}) =>
        request(`/api/tracking/sessions/${sessionId}/end`, { method: 'POST', body: payload }),
    uploadPoints: (sessionId, points) =>
        request(`/api/tracking/sessions/${sessionId}/locations`, {
            method: 'POST',
            body: { points },
        }),
    getMySessions: ({ page = 1, limit = 20, status = 'all' } = {}) => {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('limit', String(limit));
        if (status !== 'all') qs.set('status', status);
        return request(`/api/tracking/sessions/my?${qs.toString()}`);
    },
    getMySession: (sessionId) => request(`/api/tracking/sessions/${sessionId}`),
    getMySessionPoints: (sessionId) => request(`/api/tracking/sessions/${sessionId}/locations`),

    getMySessionGeocode: (sessionId) =>
        request(`/api/tracking/sessions/${sessionId}/geocode`),
};

export { API_BASE };