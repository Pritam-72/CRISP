import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('disasteriq_token');
}

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('disasteriq_token');
            window.location.href = '/auth/login';
        }
        return Promise.reject(err);
    }
);

// ─── Weather ─────────────────────────────────────────────────────────────────
export const weatherApi = {
    getAll: () => api.get('/weather/all').then(r => r.data),
    getCurrent: (id: number) => api.get(`/weather/current/${id}`).then(r => r.data),
    getForecast: (id: number) => api.get(`/weather/forecast/${id}`).then(r => r.data),
};

// ─── Risk ─────────────────────────────────────────────────────────────────────
export const riskApi = {
    getHeatmap: () => api.get('/risk/heatmap').then(r => r.data),
    getDistrict: (id: number) => api.get(`/risk/district/${id}`).then(r => r.data),
    predict: () => api.post('/risk/predict').then(r => r.data),
    getForecast: (id: number) => api.get(`/risk/forecast/${id}`).then(r => r.data),
};

// ─── Relief ──────────────────────────────────────────────────────────────────
export const reliefApi = {
    getResources: () => api.get('/relief/resources').then(r => r.data),
    getAllocations: () => api.get('/relief/allocations').then(r => r.data),
    optimize: (scenario?: string) => api.post('/relief/optimize', { scenario }).then(r => r.data),
};

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const alertsApi = {
    getHistory: (districtId?: number) =>
        api.get('/alerts/history', districtId ? { params: { district_id: districtId } } : {}).then(r => r.data),
    send: (district_id: number, severity: string, message: string, channel = 'dashboard') =>
        api.post('/alerts/send', { district_id, severity, message, channel }).then(r => r.data),
    acknowledge: (id: number) => api.patch(`/alerts/${id}/acknowledge`).then(r => r.data),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
    generate: (districtId: number) => api.post(`/reports/generate/${districtId}`).then(r => r.data),
    getHistory: () => api.get('/reports/history').then(r => r.data),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
    me: () => api.get('/auth/me').then(r => r.data),
};

export default api;
