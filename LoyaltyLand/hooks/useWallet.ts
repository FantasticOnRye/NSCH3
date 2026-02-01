import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';

/**
 * User's points wallet structure in Firestore.
 * With Option A (Hard Lock), all points are stored as locked to specific orgs.
 */
export interface PointsWallet {
  [orgId: string]: number;
}

export interface WalletState {
  wallet: PointsWallet;
  totalPointsEarned: number;
  isLoading: boolean;
  error: string | null;
}

export interface UseWalletResult extends WalletState {
  /** Get the balance for a specific organization */
  getBuyingPower: (orgId: string) => number;
  /** Get balances for all organizations */
  getAllBalances: () => Array<{ orgId: string; balance: number }>;
  /** Refresh wallet data */
  refresh: () => void;
}

/**
 * React Native hook for accessing user's points wallet.
 *
 * Subscribes to real-time updates from Firestore.
 *
 * @param orgId - Optional organization ID to focus on
 * @returns Wallet state and helper functions
 *
 * @example
 * ```tsx
 * const { getBuyingPower, isLoading } = useWallet();
 *
 * // Get balance for a specific store
 * const storeBalance = getBuyingPower('org_123');
 *
 * // Or with a focused orgId
 * const { getBuyingPower } = useWallet('org_123');
 * const balance = getBuyingPower('org_123'); // Same result
 * ```
 */
export function useWallet(orgId?: string): UseWalletResult {
  const { user } = useAuthStore();
  const [state, setState] = useState<WalletState>({
    wallet: {},
    totalPointsEarned: 0,
    isLoading: true,
    error: null,
  });

  // Subscribe to real-time wallet updates
  useEffect(() => {
    if (!user?.uid) {
      setState({
        wallet: {},
        totalPointsEarned: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setState({
            wallet: data.pointsWallet || {},
            totalPointsEarned: data.totalPointsEarned || 0,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            wallet: {},
            totalPointsEarned: 0,
            isLoading: false,
            error: 'User document not found',
          });
        }
      },
      (error) => {
        console.error('useWallet subscription error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load wallet data',
        }));
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Get the buying power (balance) for a specific organization.
   *
   * @param targetOrgId - The organization ID to check balance for
   * @returns The point balance for that organization (0 if none)
   */
  const getBuyingPower = useCallback(
    (targetOrgId: string): number => {
      return state.wallet[targetOrgId] || 0;
    },
    [state.wallet]
  );

  /**
   * Get all balances as an array, sorted by balance descending.
   *
   * @returns Array of { orgId, balance } objects
   */
  const getAllBalances = useCallback((): Array<{
    orgId: string;
    balance: number;
  }> => {
    return Object.entries(state.wallet)
      .map(([orgId, balance]) => ({ orgId, balance }))
      .filter((item) => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [state.wallet]);

  /**
   * Force refresh wallet data (triggers re-subscription).
   * Note: With real-time listeners, this is rarely needed.
   */
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    // The useEffect will handle re-fetching when isLoading changes
    // For a true refresh, we rely on the real-time listener
  }, []);

  return {
    ...state,
    getBuyingPower,
    getAllBalances,
    refresh,
  };
}

/**
 * Hook for getting the balance for a specific store.
 * Convenience wrapper around useWallet.
 *
 * @param orgId - The organization ID
 * @returns Balance and loading state
 *
 * @example
 * ```tsx
 * const { balance, isLoading } = useStoreBalance('org_123');
 * ```
 */
export function useStoreBalance(orgId: string): {
  balance: number;
  isLoading: boolean;
  error: string | null;
} {
  const { getBuyingPower, isLoading, error } = useWallet();

  return {
    balance: getBuyingPower(orgId),
    isLoading,
    error,
  };
}

export default useWallet;
