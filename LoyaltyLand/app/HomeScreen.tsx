import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';

// react-native-maps only works on native platforms (iOS/Android)
// Import conditionally to avoid web errors
let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

// Define Region type locally since we can't import from react-native-maps on web
interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}
import {
  List,
  Crosshair,
  Store,
  Heart,
} from 'lucide-react-native';

import {
  useEventStore,
  useVisibleEvents,
  useSelectedEvent,
  type Event,
  type Coordinates,
} from '../store/eventStore';
import { getEventColor } from '../utils/mapHelpers';
import EventListModal from '../components/EventListModal';
import EventDetailsSheet from '../components/EventDetailsSheet';
import MainHeader from '../components/MainHeader';
import OrbFab from '../components/OrbFab';
import { ACCENT_COLOR } from '../constants/theme';

// Default region (Troy, NY area based on your existing data)
const DEFAULT_REGION: Region = {
  latitude: 42.7284,
  longitude: -73.6918,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

interface HomeScreenProps {
  onProfilePress?: () => void;
}

export default function HomeScreen({ onProfilePress }: HomeScreenProps) {
  const mapRef = useRef<MapView>(null);

  // Store state
  const {
    userLocation,
    setUserLocation,
    setSelectedEvent,
    isListModalVisible,
    setListModalVisible,
    subscribeToEvents,
  } = useEventStore();

  const visibleEvents = useVisibleEvents();
  const selectedEvent = useSelectedEvent();

  // Local state
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Request location permission and get current location
  useEffect(() => {
    // Skip location on web
    if (Platform.OS === 'web') {
      setIsLoadingLocation(false);
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setLocationError('Location permission denied');
          setIsLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const coords: Coordinates = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setUserLocation(coords);
        setIsLoadingLocation(false);

        // Center map on user location
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (error) {
        console.error('Location error:', error);
        setLocationError('Failed to get location');
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Subscribe to real-time events from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToEvents();
    console.log('[HomeScreen] Subscribed to Firestore events');

    return () => {
      unsubscribe();
      console.log('[HomeScreen] Unsubscribed from Firestore events');
    };
  }, [subscribeToEvents]);

  // Handle marker press
  const handleMarkerPress = (event: Event & { distance: number }) => {
    setSelectedEvent(event.id);
  };

  // Handle event selection from list
  const handleEventSelect = (event: Event & { distance: number }) => {
    setSelectedEvent(event.id);

    // Animate camera to the selected event
    mapRef.current?.animateToRegion({
      latitude: event.coordinates.latitude,
      longitude: event.coordinates.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Re-center map on user location
  const handleRecenter = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else {
      Alert.alert('Location Unavailable', 'Unable to get your current location.');
    }
  };

  // Close event details
  const handleCloseDetails = () => {
    setSelectedEvent(null);
  };

  // Web fallback - show placeholder instead of map
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.webPlaceholder}>
          <Store size={64} color="#ccc" />
          <Text style={styles.webPlaceholderTitle}>Map View</Text>
          <Text style={styles.webPlaceholderText}>
            Maps are only available on iOS and Android.
          </Text>
          <Text style={styles.webPlaceholderText}>
            Use the List View button to see nearby events.
          </Text>
          <TouchableOpacity
            style={styles.webListButton}
            onPress={() => setListModalVisible(true)}
          >
            <List size={20} color="#fff" />
            <Text style={styles.webListButtonText}>View Event List</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Event Markers */}
        {visibleEvents.map((event) => {
          const color = getEventColor(event.type);
          const isSelected = selectedEvent?.id === event.id;

          return (
            <Marker
              key={event.id}
              coordinate={event.coordinates}
              title={event.title}
              description={`${event.points} points`}
              pinColor={color}
              onPress={() => handleMarkerPress(event)}
            >
              {/* Custom Marker View */}
              <View style={[styles.markerContainer, isSelected && styles.markerSelected]}>
                <View style={[styles.marker, { backgroundColor: color }]}>
                  {event.type === 'business' ? (
                    <Store size={16} color="#fff" />
                  ) : (
                    <Heart size={16} color="#fff" />
                  )}
                </View>
                <View style={[styles.markerArrow, { borderTopColor: color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Map or Web Placeholder */}
      {renderMap()}

      {/* Main Header - Profile & Points (role-aware) */}
      <MainHeader />

      {/* HUD - Bottom Right: FAB Stack */}
      <View style={styles.fabStack}>
        {/* List View FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => setListModalVisible(true)}
        >
          <List size={24} color="#fff" />
        </TouchableOpacity>

        {/* Re-center Button */}
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={handleRecenter}
        >
          <Crosshair size={22} color={ACCENT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Orb FAB - Bottom Center */}
      <OrbFab
        onQRScanPress={() => {
          // TODO: Navigate to QR scanner
          Alert.alert('QR Scanner', 'QR scanning coming soon!');
        }}
        onPointsClaimed={(points) => {
          console.log(`Claimed ${points} points!`);
        }}
      />

      {/* Loading Overlay */}
      {isLoadingLocation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Location Error Banner */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      {/* Event List Modal */}
      <EventListModal
        visible={isListModalVisible}
        onClose={() => setListModalVisible(false)}
        onEventSelect={handleEventSelect}
      />

      {/* Event Details Sheet */}
      <EventDetailsSheet
        event={selectedEvent}
        visible={selectedEvent !== null}
        onClose={handleCloseDetails}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // FAB Stack
  fabStack: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPrimary: {
    backgroundColor: ACCENT_COLOR,
  },
  fabSecondary: {
    backgroundColor: '#fff',
  },

  // Custom Markers
  markerContainer: {
    alignItems: 'center',
  },
  markerSelected: {
    transform: [{ scale: 1.2 }],
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },

  // Loading & Error States
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Web Placeholder
  webPlaceholder: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  webPlaceholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  webPlaceholderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
  webListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  webListButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
