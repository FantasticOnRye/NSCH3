import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Cloud Functions
export { awardPoints, checkEventEligibility } from './awardPoints';
