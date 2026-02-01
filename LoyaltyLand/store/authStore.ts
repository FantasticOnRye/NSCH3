import { create } from 'zustand';
import { User } from 'firebase/auth';

export type UserRole = 'personal' | 'business' | null;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  userRole: UserRole;
  storedOrbId: string | null; // e.g., "ORB_001" - the user's paired Orb device name
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setUserRole: (role: UserRole) => void;
  setStoredOrbId: (orbId: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  userRole: null,
  storedOrbId: null,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setUserRole: (userRole) => set({ userRole }),
  setStoredOrbId: (storedOrbId) => set({ storedOrbId }),
  clearAuth: () => set({ user: null, userRole: null, storedOrbId: null, isLoading: false }),
}));
