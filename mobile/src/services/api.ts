import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://192.168.111.4:8000'
  : 'https://ppgdeneme2-production.up.railway.app';

const TOKEN_KEY = 'sl_access_token';
const REFRESH_TOKEN_KEY = 'sl_refresh_token';

// ─── Token helpers ───────────────────────────────────────────
export const saveToken = (t: string) => AsyncStorage.setItem(TOKEN_KEY, t);
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);
export const saveRefreshToken = (t: string) => AsyncStorage.setItem(REFRESH_TOKEN_KEY, t);
export const getRefreshToken = () => AsyncStorage.getItem(REFRESH_TOKEN_KEY);
export const clearRefreshToken = () => AsyncStorage.removeItem(REFRESH_TOKEN_KEY);

// ─── Error class ─────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = 'ApiError';
  }
}

// ─── Core fetch (refresh token interceptor ile) ───────────────
/**
 * Her API isteğini yönetir.
 *
 * 401 aldığımızda ne olur?
 * 1. Refresh token'ı AsyncStorage'dan al
 * 2. /auth/refresh endpoint'ine gönder
 * 3. Yeni access token'ı kaydet
 * 4. Orijinal isteği YENİ token ile tekrar dene
 * 5. Refresh de başarısız olursa → authStore.logout()
 *
 * _isRefreshing bayrağı: Birden fazla istek aynı anda 401 alırsa
 * sonsuz döngüye girmemek için refresh'i sadece bir kez tetikleriz.
 */
let _isRefreshing = false;

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
  _isRetry = false,       // Sonsuz döngü koruması
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

  // ── 401: Token süresi dolmuş → refresh dene ──────────────
  if (res.status === 401 && requiresAuth && !_isRetry && !_isRefreshing) {
    _isRefreshing = true;
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        // Refresh token yok → kullanıcıyı logout et
        await _forceLogout();
        throw new ApiError(401, 'Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      // Refresh endpoint'i çağır
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!refreshRes.ok) {
        // Refresh de başarısız → logout
        await _forceLogout();
        throw new ApiError(401, 'Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      const { access_token, refresh_token: new_refresh } = await refreshRes.json();
      await saveToken(access_token);
      await saveRefreshToken(new_refresh);

      // Orijinal isteği yeni token ile tekrar dene
      return request<T>(path, options, requiresAuth, true);
    } finally {
      _isRefreshing = false;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? 'Bir hata oluştu.');
  }

  return res.json() as Promise<T>;
}

// Zustand'a circular import olmadan erişmek için lazy import
async function _forceLogout() {
  await clearToken();
  await clearRefreshToken();
  // authStore'u dinamik import ile çağır (circular dependency'den kaçın)
  const { useAuthStore } = await import('../store/authStore');
  useAuthStore.getState().logout();
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
    const res = await request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
      false,
    );
    // İki token'ı da kaydet
    await saveToken(res.access_token);
    await saveRefreshToken(res.refresh_token);
    return res;
  },

  me: () => request<UserResponse>('/auth/me'),

  logout: async () => {
    try {
      // Backend'e logout bildir (refresh token geçersiz kılsın)
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Backend'e ulaşamasak da local temizlik yap
    } finally {
      await clearToken();
      await clearRefreshToken();
    }
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

// ─── PPG Types & API — Scenario B (Edge AI) ──────────────────
// ESP32 TinyML modelini çalıştırır ve sonucu gönderir.
// Mobil, sonucu backend'e KAYIT için gönderir (analiz için değil).

export interface PpgLogRequest {
  // ESP32'den gelen işlenmiş sonuç
  heart_rate: number;
  hrv_rmssd: number;
  stress_score: number;
  stress_level: 'relaxed' | 'moderate' | 'high';
  device_id?: string;
}

export interface PpgSessionSummary {
  session_id: string;
  heart_rate: number;
  hrv_rmssd: number;
  stress_level: 'relaxed' | 'moderate' | 'high';
  stress_score: number;
  analyzed_at: string;
}

export const ppgApi = {
  /**
   * ESP32'den gelen işlenmiş sonucu backend'e kaydeder.
   * Backend ML çalıştırmaz — sadece saklar.
   */
  logResult: (data: PpgLogRequest) =>
    request<{ session_id: string; analyzed_at: string }>('/ppg/log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  history: (limit = 20) =>
    request<PpgSessionSummary[]>(`/ppg/history?limit=${limit}`),
};

// ─── AI Chat Types & API ──────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_history: ChatMessage[];
  // Context silently injected server-side from health profile + latest PPG
  health_context?: {
    medications?: string;
    diagnoses?: string;
    stress_source?: string;
    avg_stress_level?: number;
    latest_stress_level?: string;
    latest_heart_rate?: number;
    latest_hrv_rmssd?: number;
  };
}

export interface ChatResponse {
  reply: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export const chatApi = {
  send: (data: ChatRequest) =>
    request<ChatResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Admin Types & API ────────────────────────────────────────
export interface AdminUserRow {
  id: number;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
  last_login?: string;
  ppg_session_count?: number;
}

export interface AdminAuditLog {
  id: number;
  user_id: number | null;
  user_email?: string;
  action: string;
  resource: string;
  resource_id?: string;
  ip_address?: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_ppg_sessions: number;
  total_chat_messages: number;
  high_stress_sessions: number;
}

export const adminApi = {
  stats: () =>
    request<AdminStats>('/admin/stats'),

  users: (limit = 50) =>
    request<AdminUserRow[]>(`/admin/users?limit=${limit}`),

  ppgOutputs: (limit = 100) =>
    request<PpgSessionSummary[]>(`/admin/ppg-outputs?limit=${limit}`),

  auditLogs: (limit = 100) =>
    request<AdminAuditLog[]>(`/admin/audit-logs?limit=${limit}`),

  toggleUserActive: (userId: number, isActive: boolean) =>
    request(`/admin/users/${userId}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),
};
