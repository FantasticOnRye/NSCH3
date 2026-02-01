import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';

// Get the default Firebase app (already initialized in firebaseConfig.js)
const app = getApps()[0];
const functions = getFunctions(app);

// For local development with emulator, uncomment:
// import { connectFunctionsEmulator } from 'firebase/functions';
// connectFunctionsEmulator(functions, 'localhost', 5001);

interface AwardPointsRequest {
  userId: string;
  eventId: string;
}

interface AwardPointsResponse {
  success: boolean;
  transactionId: string;
  pointsAwarded: number;
  destination: string;
  isVolunteer: boolean;
}

interface CheckEligibilityRequest {
  userId: string;
  eventId: string;
}

interface CheckEligibilityResponse {
  eligible: boolean;
  reason?: string;
}

/**
 * Award points to a user for attending an event or volunteering.
 *
 * @param userId - The user's Firebase UID
 * @param eventId - The event document ID
 * @returns Award result with transaction details
 * @throws Error if points cannot be awarded
 *
 * @example
 * ```tsx
 * try {
 *   const result = await awardPointsForEvent(user.uid, 'event_123');
 *   Alert.alert('Success', `Earned ${result.pointsAwarded} points!`);
 * } catch (error) {
 *   Alert.alert('Error', error.message);
 * }
 * ```
 */
export async function awardPointsForEvent(
  userId: string,
  eventId: string
): Promise<AwardPointsResponse> {
  const awardPointsFn = httpsCallable<AwardPointsRequest, AwardPointsResponse>(
    functions,
    'awardPoints'
  );

  const result = await awardPointsFn({ userId, eventId });
  return result.data;
}

/**
 * Check if a user is eligible to earn points for an event.
 * Use this before attempting to award points to provide better UX.
 *
 * @param userId - The user's Firebase UID
 * @param eventId - The event document ID
 * @returns Eligibility status and reason if not eligible
 *
 * @example
 * ```tsx
 * const { eligible, reason } = await checkPointsEligibility(user.uid, eventId);
 * if (!eligible) {
 *   Alert.alert('Already Earned', reason);
 *   return;
 * }
 * // Proceed with awarding points
 * ```
 */
export async function checkPointsEligibility(
  userId: string,
  eventId: string
): Promise<CheckEligibilityResponse> {
  const checkEligibilityFn = httpsCallable<
    CheckEligibilityRequest,
    CheckEligibilityResponse
  >(functions, 'checkEventEligibility');

  const result = await checkEligibilityFn({ userId, eventId });
  return result.data;
}

/**
 * Award points and handle common error cases.
 * Provides user-friendly error messages.
 *
 * @param userId - The user's Firebase UID
 * @param eventId - The event document ID
 * @returns Award result or error object
 */
export async function awardPointsSafe(
  userId: string,
  eventId: string
): Promise<{
  success: boolean;
  data?: AwardPointsResponse;
  error?: string;
}> {
  try {
    const result = await awardPointsForEvent(userId, eventId);
    return { success: true, data: result };
  } catch (error: any) {
    // Parse Firebase function errors
    const code = error?.code || '';
    const message = error?.message || 'An unexpected error occurred';

    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'functions/already-exists': 'You have already earned points for this event.',
      'functions/not-found': 'This event could not be found.',
      'functions/unauthenticated': 'Please sign in to earn points.',
      'functions/permission-denied': 'You do not have permission to perform this action.',
      'functions/failed-precondition': 'This event is not configured for points.',
    };

    const friendlyMessage = errorMessages[code] || message;

    return { success: false, error: friendlyMessage };
  }
}
