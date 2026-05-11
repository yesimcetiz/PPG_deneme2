import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, UserResponse, getToken } from '../services/api';

const ONBOARDING_KEY = 'sl_onboarding_complete';

interface AuthState {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingComplete: boolean;

  // Actions
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserResponse) => void;
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  onboardingComplete: false,

  checkAuth: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const [user, onboardingFlag] = await Promise.all([
        authApi.me(),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        onboardingComplete: onboardingFlag === 'true',
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false, onboardingComplete: false });
    }
  },

  login: async (email, password) => {
    await authApi.login({ email, password });
    const [user, onboardingFlag] = await Promise.all([
      authApi.me(),
      AsyncStorage.getItem(ONBOARDING_KEY),
    ]);
    set({
      user,
      isAuthenticated: true,
      onboardingComplete: onboardingFlag === 'true',
    });
  },

  register: async (fullName, email, password) => {
    await authApi.register({ email, full_name: fullName, password });
    await authApi.login({ email, password });
    const user = await authApi.me();
    // Yeni kayıt → onboarding henüz yapılmadı
    set({ user, isAuthenticated: true, onboardingComplete: false });
  },

  logout: async () => {
    // authApi.logout() → backend'e bildir (refresh token geçersiz kılınır)
    // + local token'ları temizler
    await authApi.logout();
    set({ user: null, isAuthenticated: false, onboardingComplete: false });
  },

  setUser: (user) => set({ user }),

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ onboardingComplete: true });
  },
}));
