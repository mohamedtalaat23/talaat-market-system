import { create } from 'zustand';
import { apiClient } from '@/services/api-client';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  full_name?: string;
  must_change_password?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  loginWithPin: (pin: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

  loginWithPin: async (pin: string) => {
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: { token: string; employee: User };
      }>('/auth/fast-pin', { pin });
      if (response.data?.success && response.data.data) {
        const { token, employee } = response.data.data;
        localStorage.setItem('talaat_token', token);
        set({ token, user: employee, isAuthenticated: true, isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('talaat_token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  /**
   * Rotate the signed-in employee's password.
   *
   * The server clears `must_change_password`; we mirror that locally so the
   * forced-change guard releases immediately without a re-login.
   */
  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });

    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, must_change_password: false } });
    }
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
