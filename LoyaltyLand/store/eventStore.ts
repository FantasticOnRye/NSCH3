import { create } from 'zustand';
import { useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: 'business' | 'charity';
  points: number;
  coordinates: Coordinates;
  orgId: string;
  orgName: string;
  address?: string;
  startTime?: string;
  endTime?: string;
  date?: Date | null; // For expiration filtering
}

export interface EventFilters {
  type: 'all' | 'business' | 'charity';
  maxDistance: number; // in miles
}

interface EventState {
  events: Event[];
  userLocation: Coordinates | null;
  filters: EventFilters;
  selectedEventId: string | null;
  isListModalVisible: boolean;
  isSubscribed: boolean;

  // Actions
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  setUserLocation: (location: Coordinates) => void;
  setFilters: (filters: Partial<EventFilters>) => void;
  setSelectedEvent: (eventId: string | null) => void;
  setListModalVisible: (visible: boolean) => void;
  subscribeToEvents: () => Unsubscribe;
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * @returns Distance in miles
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Dummy events for demo purposes.
 * These are always shown on the map alongside real Firestore events.
 * Located around RPI/Troy, NY area.
 */
const DUMMY_EVENTS: Event[] = [
  {
    id: 'dummy_1',
    title: 'Morning Coffee Rush',
    description: 'Get points for your morning coffee purchase at Jacob Alejandro!',
    type: 'business',
    points: 10,
    coordinates: { latitude: 42.7314, longitude: -73.6908 },
    orgId: 'jacob_alejandro_troy',
    orgName: 'Jacob Alejandro',
    address: '274 River St, Troy, NY',
  },
  {
    id: 'dummy_2',
    title: 'Hudson River Cleanup',
    description: 'Help clean up the Hudson River waterfront. Volunteer event!',
    type: 'charity',
    points: 100,
    coordinates: { latitude: 42.7284, longitude: -73.6918 },
    orgId: 'troy_volunteers',
    orgName: 'Troy Community Volunteers',
    address: 'Riverfront Park, Troy, NY',
  },
  {
    id: 'dummy_3',
    title: 'RPI Campus Event',
    description: 'Special campus loyalty event for students and faculty.',
    type: 'business',
    points: 50,
    coordinates: { latitude: 42.7302, longitude: -73.6765 },
    orgId: 'rpi_campus',
    orgName: 'RPI Campus Store',
    address: 'RPI Student Union, Troy, NY',
  },
];

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  userLocation: null,
  filters: {
    type: 'all',
    maxDistance: 10, // Default 10 miles
  },
  selectedEventId: null,
  isListModalVisible: false,
  isSubscribed: false,

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),

  setUserLocation: (location) => set({ userLocation: location }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  setSelectedEvent: (eventId) => set({ selectedEventId: eventId }),

  setListModalVisible: (visible) => set({ isListModalVisible: visible }),

  /**
   * Subscribe to real-time event updates from Firestore.
   * Listens to events where active == true.
   * Returns unsubscribe function.
   */
  subscribeToEvents: () => {
    // Prevent duplicate subscriptions
    if (get().isSubscribed) {
      return () => {};
    }

    set({ isSubscribed: true });

    const eventsQuery = query(
      collection(db, 'events'),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const now = new Date();

        const eventsData: Event[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();

            // Handle GeoPoint coordinates
            let coordinates: Coordinates = { latitude: 0, longitude: 0 };
            if (data.coordinates) {
              // Firestore GeoPoint has latitude and longitude properties
              coordinates = {
                latitude: data.coordinates.latitude || data.coordinates._lat || 0,
                longitude: data.coordinates.longitude || data.coordinates._long || 0,
              };
            }

            // Parse event date for expiration filtering
            let eventDate: Date | null = null;
            if (data.date) {
              // Handle Firestore Timestamp
              if (data.date.toDate) {
                eventDate = data.date.toDate();
              } else if (data.date instanceof Date) {
                eventDate = data.date;
              } else if (typeof data.date === 'string') {
                eventDate = new Date(data.date);
              }
            } else if (data.endTime) {
              // Try to parse endTime as a date
              const parsed = new Date(data.endTime);
              if (!isNaN(parsed.getTime())) {
                eventDate = parsed;
              }
            }

            return {
              id: doc.id,
              title: data.title || data.name || 'Untitled Event',
              description: data.description || '',
              type: data.type || 'business',
              points: data.points || 0,
              coordinates,
              orgId: data.hostOrgId || data.orgId || '',
              orgName: data.orgName || 'Unknown',
              address: data.address || '',
              startTime: data.startTime || data.dateString || '',
              endTime: data.endTime || '',
              date: eventDate,
            };
          })
          // Filter out expired events (events with a date in the past)
          .filter((event) => {
            // If no date is set, keep the event (never expires)
            if (!event.date) return true;
            // Keep events that haven't passed yet
            return event.date >= now;
          });

        // Merge dummy events with Firestore events
        const mergedEvents = [...DUMMY_EVENTS, ...eventsData];
        console.log(`[EventStore] Synced ${eventsData.length} active Firestore events + ${DUMMY_EVENTS.length} dummy events = ${mergedEvents.length} total`);
        set({ events: mergedEvents });
      },
      (error) => {
        console.error('[EventStore] Error subscribing to events:', error);
      }
    );

    return () => {
      unsubscribe();
      set({ isSubscribed: false });
    };
  },
}));

/**
 * Memoized selector that returns filtered and sorted events by distance.
 * Events are filtered by type and maxDistance, then sorted closest first.
 */
export function useVisibleEvents(): Array<Event & { distance: number }> {
  const events = useEventStore((state) => state.events);
  const userLocation = useEventStore((state) => state.userLocation);
  const filters = useEventStore((state) => state.filters);

  return useMemo(() => {
    if (!userLocation) {
      // If no user location, return all events without distance sorting
      return events
        .filter((event) => filters.type === 'all' || event.type === filters.type)
        .map((event) => ({ ...event, distance: 0 }));
    }

    return events
      .map((event) => ({
        ...event,
        distance: calculateDistance(userLocation, event.coordinates),
      }))
      .filter((event) => {
        // Filter by type
        if (filters.type !== 'all' && event.type !== filters.type) {
          return false;
        }
        // Filter by max distance
        if (event.distance > filters.maxDistance) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.distance - b.distance);
  }, [events, userLocation, filters]);
}

/**
 * Get the currently selected event with distance
 */
export function useSelectedEvent(): (Event & { distance: number }) | null {
  const selectedEventId = useEventStore((state) => state.selectedEventId);
  const visibleEvents = useVisibleEvents();

  return useMemo(() => {
    if (!selectedEventId) return null;
    return visibleEvents.find((e) => e.id === selectedEventId) || null;
  }, [selectedEventId, visibleEvents]);
}
