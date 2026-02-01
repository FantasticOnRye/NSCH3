import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';

/**
 * User's points wallet structure in Firestore:
 * users/{userId}/pointsWallet: {
 *   locked: { [orgId]: number },      // Points earned at specific businesses (locked to that business)
 *   universal: number,                 // Points from volunteering (can be used anywhere)
 *   designated: { [orgId]: number }   // Universal points the user has designated for specific stores
 * }
 */

export interface PointsWallet {
  locked: Record<string, number>;
  universal: number;
  designated: Record<string, number>;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  orgId: string;
  createdAt: Timestamp;
  active: boolean;
}

/**
 * Calculates the total buying power a user has at a specific organization.
 *
 * @param userId - The user's Firebase UID
 * @param orgId - The organization/business ID
 * @returns Total points available to spend at this organization
 */
export async function calculateBuyingPower(
  userId: string,
  orgId: string
): Promise<number> {
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  const wallet: PointsWallet = userData.pointsWallet || {
    locked: {},
    universal: 0,
    designated: {},
  };

  // Sum locked points for this specific organization
  const lockedPoints = wallet.locked[orgId] || 0;

  // Add any universal points the user has designated for this store
  const designatedUniversal = wallet.designated[orgId] || 0;

  return lockedPoints + designatedUniversal;
}

/**
 * Get the user's full wallet for display purposes
 */
export async function getWallet(userId: string): Promise<PointsWallet> {
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  return userData.pointsWallet || {
    locked: {},
    universal: 0,
    designated: {},
  };
}

/**
 * Designate universal points for a specific organization.
 * This moves points from the universal pool to be usable at a specific store.
 */
export async function designateUniversalPoints(
  userId: string,
  orgId: string,
  amount: number
): Promise<void> {
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const wallet: PointsWallet = userData.pointsWallet || {
      locked: {},
      universal: 0,
      designated: {},
    };

    if (wallet.universal < amount) {
      throw new Error('Insufficient universal points');
    }

    // Move points from universal to designated
    wallet.universal -= amount;
    wallet.designated[orgId] = (wallet.designated[orgId] || 0) + amount;

    transaction.update(userRef, { pointsWallet: wallet });
  });
}

export interface RedemptionResult {
  success: boolean;
  transactionId: string;
  pointsSpent: {
    locked: number;
    designated: number;
  };
}

/**
 * Redeems a deal by deducting points from the user's wallet.
 * Prioritizes spending locked points first, then designated universal points.
 *
 * @param userId - The user's Firebase UID
 * @param orgId - The organization/business ID
 * @param dealId - The deal being redeemed
 * @param cost - The point cost of the deal
 * @returns Result of the redemption including transaction ID
 */
export async function redeemDeal(
  userId: string,
  orgId: string,
  dealId: string,
  cost: number
): Promise<RedemptionResult> {
  const userRef = doc(db, 'users', userId);

  // Use a transaction to ensure atomic updates
  const result = await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const wallet: PointsWallet = userData.pointsWallet || {
      locked: {},
      universal: 0,
      designated: {},
    };

    // Calculate total buying power
    const lockedPoints = wallet.locked[orgId] || 0;
    const designatedPoints = wallet.designated[orgId] || 0;
    const totalBuyingPower = lockedPoints + designatedPoints;

    // Validation: Check if user has enough points
    if (totalBuyingPower < cost) {
      throw new Error(
        `Insufficient points. You have ${totalBuyingPower} points, but need ${cost}.`
      );
    }

    // Deduct points - prioritize locked points first
    let remainingCost = cost;
    let lockedSpent = 0;
    let designatedSpent = 0;

    // Step 1: Spend locked points first
    if (lockedPoints > 0) {
      lockedSpent = Math.min(lockedPoints, remainingCost);
      wallet.locked[orgId] = lockedPoints - lockedSpent;
      remainingCost -= lockedSpent;

      // Clean up zero balances
      if (wallet.locked[orgId] === 0) {
        delete wallet.locked[orgId];
      }
    }

    // Step 2: Spend designated universal points if needed
    if (remainingCost > 0 && designatedPoints > 0) {
      designatedSpent = Math.min(designatedPoints, remainingCost);
      wallet.designated[orgId] = designatedPoints - designatedSpent;
      remainingCost -= designatedSpent;

      // Clean up zero balances
      if (wallet.designated[orgId] === 0) {
        delete wallet.designated[orgId];
      }
    }

    // Update the user's wallet
    transaction.update(userRef, { pointsWallet: wallet });

    return { lockedSpent, designatedSpent };
  });

  // Create audit record in transactions collection
  const transactionRef = await addDoc(collection(db, 'transactions'), {
    type: 'spend',
    userId,
    orgId,
    dealId,
    pointsSpent: cost,
    breakdown: {
      locked: result.lockedSpent,
      designated: result.designatedSpent,
    },
    timestamp: Timestamp.now(),
  });

  return {
    success: true,
    transactionId: transactionRef.id,
    pointsSpent: {
      locked: result.lockedSpent,
      designated: result.designatedSpent,
    },
  };
}

/**
 * Awards points to a user (called when they attend an event or volunteer)
 *
 * @param userId - The user's Firebase UID
 * @param orgId - The organization ID (null for universal volunteer points)
 * @param amount - Number of points to award
 * @param isVolunteer - Whether these are universal volunteer points
 */
export async function awardPoints(
  userId: string,
  orgId: string | null,
  amount: number,
  isVolunteer: boolean = false
): Promise<void> {
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const wallet: PointsWallet = userData.pointsWallet || {
      locked: {},
      universal: 0,
      designated: {},
    };

    if (isVolunteer) {
      // Volunteer points go to universal pool
      wallet.universal += amount;
    } else if (orgId) {
      // Event points are locked to the organization
      wallet.locked[orgId] = (wallet.locked[orgId] || 0) + amount;
    }

    transaction.update(userRef, { pointsWallet: wallet });
  });

  // Create audit record
  await addDoc(collection(db, 'transactions'), {
    type: 'earn',
    userId,
    orgId,
    pointsEarned: amount,
    isVolunteer,
    timestamp: Timestamp.now(),
  });
}
