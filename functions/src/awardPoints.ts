import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Point values (mirrored from frontend constants/points.ts)
const VOLUNTEER_SHORT = 20;
const VOLUNTEER_LONG = 100;
const VOLUNTEER_POINT_VALUES = [VOLUNTEER_SHORT, VOLUNTEER_LONG];

interface AwardPointsData {
  userId: string;
  eventId: string;
}

interface EventDoc {
  points: number;
  hostOrgId: string;
  type?: 'event' | 'volunteer';
  name?: string;
}

interface UserDoc {
  preferredStore: string | null;
  pointsWallet?: Record<string, number>;
  totalPointsEarned?: number;
}

interface AwardPointsResult {
  success: boolean;
  transactionId: string;
  pointsAwarded: number;
  destination: string;
  isVolunteer: boolean;
}

/**
 * Cloud Function: awardPoints
 *
 * HTTPS Callable function triggered when a User Orb "taps" or User scans a QR code.
 *
 * Logic (Option A - Hard Lock):
 * - Business Event points -> locked to hostOrgId
 * - Volunteer Event points -> locked to user's preferredStore (fallback: hostOrgId)
 *
 * Includes idempotency check to prevent duplicate awards.
 */
export const awardPoints = functions.https.onCall(
  async (data: AwardPointsData, context): Promise<AwardPointsResult> => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to earn points.'
      );
    }

    const { userId, eventId } = data;

    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId is required and must be a string.'
      );
    }

    if (!eventId || typeof eventId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'eventId is required and must be a string.'
      );
    }

    // Security: Ensure the authenticated user matches the userId
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot award points to a different user.'
      );
    }

    try {
      // Run in a transaction for atomicity
      const result = await db.runTransaction(async (transaction) => {
        // 1. Idempotency Check - Look for existing transaction
        const existingTxQuery = db
          .collection('transactions')
          .where('userId', '==', userId)
          .where('eventId', '==', eventId)
          .where('type', '==', 'earn')
          .limit(1);

        const existingTxSnapshot = await transaction.get(existingTxQuery);

        if (!existingTxSnapshot.empty) {
          throw new functions.https.HttpsError(
            'already-exists',
            'Points have already been awarded for this event.'
          );
        }

        // 2. Fetch Event document
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await transaction.get(eventRef);

        if (!eventDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            'Event not found.'
          );
        }

        const eventData = eventDoc.data() as EventDoc;
        const pointsValue = eventData.points;
        const hostOrgId = eventData.hostOrgId;

        if (!pointsValue || pointsValue <= 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Event has no valid point value.'
          );
        }

        if (!hostOrgId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Event has no associated organization.'
          );
        }

        // 3. Fetch User document
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            'User not found.'
          );
        }

        const userData = userDoc.data() as UserDoc;
        const preferredStore = userData.preferredStore;

        // 4. Determine if this is a volunteer event
        // Option 1: Check explicit type field
        // Option 2: Infer from point value (volunteer points are 20 or 100)
        const isVolunteer =
          eventData.type === 'volunteer' ||
          VOLUNTEER_POINT_VALUES.includes(pointsValue);

        // 5. Determine Destination (Option A - Hard Lock)
        let destination: string;

        if (isVolunteer) {
          // Volunteer points go to preferredStore, fallback to hostOrgId
          destination = preferredStore || hostOrgId;
        } else {
          // Business event points are locked to the hosting organization
          destination = hostOrgId;
        }

        // 6. Prepare wallet update
        const currentWallet = userData.pointsWallet || {};
        const currentBalance = currentWallet[destination] || 0;
        const currentTotalEarned = userData.totalPointsEarned || 0;

        const updatedWallet = {
          ...currentWallet,
          [destination]: currentBalance + pointsValue,
        };

        // 7. Create transaction record
        const transactionRef = db.collection('transactions').doc();
        const transactionData = {
          type: 'earn',
          userId,
          eventId,
          eventName: eventData.name || null,
          hostOrgId,
          destination,
          pointsEarned: pointsValue,
          isVolunteer,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.create(transactionRef, transactionData);

        // 8. Update user document
        transaction.update(userRef, {
          pointsWallet: updatedWallet,
          totalPointsEarned: currentTotalEarned + pointsValue,
        });

        return {
          transactionId: transactionRef.id,
          pointsAwarded: pointsValue,
          destination,
          isVolunteer,
        };
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      // Re-throw HttpsErrors as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Log unexpected errors
      functions.logger.error('awardPoints error:', error);

      throw new functions.https.HttpsError(
        'internal',
        'An unexpected error occurred while awarding points.'
      );
    }
  }
);

/**
 * Helper function to check if user has already earned points for an event.
 * Can be called from frontend before attempting to award.
 */
export const checkEventEligibility = functions.https.onCall(
  async (
    data: { userId: string; eventId: string },
    context
  ): Promise<{ eligible: boolean; reason?: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated.'
      );
    }

    const { userId, eventId } = data;

    if (!userId || !eventId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId and eventId are required.'
      );
    }

    // Check for existing transaction
    const existingTx = await db
      .collection('transactions')
      .where('userId', '==', userId)
      .where('eventId', '==', eventId)
      .where('type', '==', 'earn')
      .limit(1)
      .get();

    if (!existingTx.empty) {
      return {
        eligible: false,
        reason: 'Points already earned for this event.',
      };
    }

    // Check if event exists and is valid
    const eventDoc = await db.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return {
        eligible: false,
        reason: 'Event not found.',
      };
    }

    const eventData = eventDoc.data() as EventDoc;

    if (!eventData.points || eventData.points <= 0) {
      return {
        eligible: false,
        reason: 'Event has no valid point value.',
      };
    }

    return { eligible: true };
  }
);
