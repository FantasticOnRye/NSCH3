import { create } from 'zustand';
import { User } from 'firebase/auth';

export type UserRole = 'personal' | 'business' | null;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  userRole: UserRole;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setUserRole: (role: UserRole) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  userRole: null,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setUserRole: (userRole) => set({ userRole }),
  clearAuth: () => set({ user: null, userRole: null, isLoading: false }),
}));
