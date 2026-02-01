/**
 * Standardized point values for events and volunteering.
 * These are the ONLY values businesses can assign when creating events.
 */

// Event attendance points
export const EVENT_SHORT = 10;   // Short event (< 1 hour)
export const EVENT_LONG = 50;    // Long event (1+ hours)

// Volunteer work points (universal - can be used anywhere)
export const VOLUNTEER_SHORT = 20;   // Short volunteer shift
export const VOLUNTEER_LONG = 100;   // Long volunteer shift

// All valid point tiers for UI dropdowns/pickers
export const POINT_TIERS = [
  { label: 'Short Event (10 pts)', value: EVENT_SHORT, type: 'event' },
  { label: 'Long Event (50 pts)', value: EVENT_LONG, type: 'event' },
  { label: 'Short Volunteer (20 pts)', value: VOLUNTEER_SHORT, type: 'volunteer' },
  { label: 'Long Volunteer (100 pts)', value: VOLUNTEER_LONG, type: 'volunteer' },
] as const;

// Valid point values for validation
export const VALID_POINT_VALUES = [EVENT_SHORT, EVENT_LONG, VOLUNTEER_SHORT, VOLUNTEER_LONG] as const;

export type PointTierValue = typeof VALID_POINT_VALUES[number];
