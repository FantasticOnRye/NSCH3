import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  increment,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';

export interface TransactionRecord {
  id?: string;
  userId: string;
  orgId: string;
  type: 'earn' | 'spend';
  amount: number;
  rewardId?: string;
  rewardTitle?: string;
  orbId?: string;
  createdAt: Timestamp;
}

export interface ClaimResult {
  success: boolean;
  pointsEarned: number;
  newBalance: number;
  orgName?: string;
}

export interface RedeemResult {
  success: boolean;
  pointsSpent: number;
  newBalance: number;
  rewardTitle: string;
}

/**
 * Map an Orb ID to its associated organization.
 * In production, this would query a Firestore collection.
 * For demo, we use a hardcoded mapping.
 */
const ORB_TO_ORG_MAP: Record<string, { orgId: string; orgName: string; defaultPoints: number }> = {
  'ORB_001': { orgId: 'jacob_alejandro_troy', orgName: 'Jacob Alejandro', defaultPoints: 10 },
  'ORB_002': { orgId: 'muddys_coffeehouse', orgName: "Muddy's Coffeehouse", defaultPoints: 10 },
  'ORB_003': { orgId: 'rpi_campus_store', orgName: 'RPI Campus Store', defaultPoints: 10 },
  'DEMO_ORB': { orgId: 'universal', orgName: 'Demo Store', defaultPoints: 25 },
};

/**
 * Get organization info from Orb ID.
 * Falls back to universal/demo if not found.
 */
export function getOrgFromOrbId(orbId: string): { orgId: string; orgName: string; defaultPoints: number } {
  return ORB_TO_ORG_MAP[orbId] || { orgId: 'universal', orgName: 'Local Business', defaultPoints: 20 };
}

/**
 * Claim points from an Orb tap (Earn Mode).
 * Awards points to the user's wallet.
 */
export async function claimPoints(
  userId: string,
  orbId: string,
  eventPoints?: number
): Promise<ClaimResult> {
  const { orgId, orgName, defaultPoints } = getOrgFromOrbId(orbId);
  const pointsToAward = eventPoints || defaultPoints;

  try {
    const userRef = doc(db, 'users', userId);

    // Use transaction for atomic update
    const newBalance = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const currentData = userDoc.data() || {};
      const currentWallet = currentData.pointsWallet || {};
      const currentOrgBalance = currentWallet[orgId] || 0;
      const currentUniversal = currentWallet['universal'] || 0;

      // Update user document
      transaction.set(
        userRef,
        {
          totalPointsEarned: increment(pointsToAward),
          pointsWallet: {
            ...currentWallet,
            [orgId]: increment(pointsToAward),
            universal: increment(pointsToAward),
          },
        },
        { merge: true }
      );

      return currentUniversal + pointsToAward;
    });

    // Record the transaction
    await addDoc(collection(db, 'transactions'), {
      userId,
      orgId,
      type: 'earn',
      amount: pointsToAward,
      orbId,
      createdAt: Timestamp.now(),
    } as TransactionRecord);

    console.log(`[TransactionService] User ${userId} earned ${pointsToAward} points from ${orgName}`);

    return {
      success: true,
      pointsEarned: pointsToAward,
      newBalance,
      orgName,
    };
  } catch (error) {
    console.error('[TransactionService] Error claiming points:', error);
    throw new Error('Failed to claim points. Please try again.');
  }
}

/**
 * Redeem a reward using points (Spend Mode).
 * Deducts points from the user's wallet.
 */
export async function redeemReward(
  userId: string,
  orbId: string,
  rewardCost: number,
  rewardId: string,
  rewardTitle: string
): Promise<RedeemResult> {
  const { orgId, orgName } = getOrgFromOrbId(orbId);

  try {
    const userRef = doc(db, 'users', userId);

    // Use transaction for atomic update with balance check
    const newBalance = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User account not found');
      }

      const userData = userDoc.data();
      const currentWallet = userData.pointsWallet || {};

      // Check universal balance (all points can be spent anywhere)
      const currentBalance = currentWallet['universal'] || 0;

      if (currentBalance < rewardCost) {
        throw new Error(`Insufficient points. You have ${currentBalance} but need ${rewardCost}.`);
      }

      // Deduct points
      transaction.update(userRef, {
        'pointsWallet.universal': increment(-rewardCost),
        totalPointsSpent: increment(rewardCost),
      });

      return currentBalance - rewardCost;
    });

    // Record the transaction
    await addDoc(collection(db, 'transactions'), {
      userId,
      orgId,
      type: 'spend',
      amount: rewardCost,
      rewardId,
      rewardTitle,
      orbId,
      createdAt: Timestamp.now(),
    } as TransactionRecord);

    // Update business's redeemed count (optional tracking)
    try {
      const businessRef = doc(db, 'businesses', orgId);
      await setDoc(
        businessRef,
        {
          totalPointsRedeemed: increment(rewardCost),
          redemptionCount: increment(1),
        },
        { merge: true }
      );
    } catch (e) {
      // Non-critical, don't fail the transaction
      console.warn('[TransactionService] Could not update business stats:', e);
    }

    console.log(`[TransactionService] User ${userId} spent ${rewardCost} points on "${rewardTitle}"`);

    return {
      success: true,
      pointsSpent: rewardCost,
      newBalance,
      rewardTitle,
    };
  } catch (error: any) {
    console.error('[TransactionService] Error redeeming reward:', error);
    throw new Error(error.message || 'Failed to redeem reward. Please try again.');
  }
}

/**
 * Get user's current balance.
 */
export async function getUserBalance(userId: string): Promise<number> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return 0;

    const data = userDoc.data();
    return data.pointsWallet?.universal || 0;
  } catch (error) {
    console.error('[TransactionService] Error getting balance:', error);
    return 0;
  }
}
