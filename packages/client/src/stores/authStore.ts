import { create } from 'zustand';
import { apiClient } from '@/services/api-client';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  full_name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token, user) => {
    localStorage.setItem('talaat_token', token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('talaat_token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  initializeAuth: async () => {
    const token = localStorage.getItem('talaat_token');
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      // Set the token temporarily in the store so the api-client interceptor can attach it
      set({ token, isLoading: true });

      const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me');

      if (response.data?.success && response.data?.data) {
        set({
          user: response.data.data,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        get().logout();
      }
    } catch (error) {
      get().logout();
    }
  },
}));
