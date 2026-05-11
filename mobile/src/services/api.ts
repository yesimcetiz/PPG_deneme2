import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://api.stressless.app';

const TOKEN_KEY = 'sl_access_token';

// ─── Token helpers ───────────────────────────────────────────
export const saveToken = (t: string) => AsyncStorage.setItem(TOKEN_KEY, t);
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);

// ─── Error class ─────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = 'ApiError';
  }
}

// ─── Core fetch ──────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? 'Bir hata oluştu.');
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────
export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface HealthProfilePayload {
  birth_year?: number;
  height_cm?: number;
  weight_kg?: number;
  gender?: string;
  diagnoses?: string;
  medications?: string;
  allergies?: string;
  stress_source?: string;
  avg_stress_level?: number;
}

// ─── Auth API ────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; full_name: string; password: string }) =>
    request<UserResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }, false),

  login: async (data: { email: string; password: string }) => {
    const res = await request<{ access_token: string; token_type: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
      false,
    );
    await saveToken(res.access_token);
    return res;
  },

  me: () => request<UserResponse>('/auth/me'),

  logout: async () => {
    await clearToken();
  },
};

// ─── Profile API ─────────────────────────────────────────────
export const profileApi = {
  get: () => request<HealthProfilePayload & { id: number; user_id: number }>('/profile/health'),

  update: (data: HealthProfilePayload) =>
    request('/profile/health', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
