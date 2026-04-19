import { create } from 'zustand';
import type { User } from '@/types';
import * as authService from '@/services/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, display_name: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    localStorage.setItem('token', response.access_token);
    set({ token: response.access_token });
    const user = await authService.getMe();
    set({ user });
  },

  register: async (email: string, password: string, display_name: string) => {
    const response = await authService.register({ email, password, display_name });
    localStorage.setItem('token', response.access_token);
    set({ token: response.access_token });
    const user = await authService.getMe();
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },

  fetchUser: async () => {
    try {
      const user = await authService.getMe();
      set({ user });
    } catch {
      set({ token: null, user: null });
      localStorage.removeItem('token');
    }
  },
}));

export const useIsAuthenticated = () =>
  useAuthStore((state) => !!state.token);

export default useAuthStore;
