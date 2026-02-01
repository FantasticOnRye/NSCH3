import { Linking, Platform, Alert } from 'react-native';
import type { Coordinates } from '../store/eventStore';

/**
 * Opens the native maps app with directions to the specified location.
 *
 * iOS: Uses Apple Maps (maps:// scheme)
 * Android: Uses Google Maps or default maps app (geo:// scheme)
 *
 * @param lat - Destination latitude
 * @param lng - Destination longitude
 * @param label - Label/name for the destination
 *
 * @example
 * ```tsx
 * openMapsApp(42.7314, -73.6908, "Jacob Alejandro Coffee");
 * ```
 */
export async function openMapsApp(
  lat: number,
  lng: number,
  label: string
): Promise<void> {
  const encodedLabel = encodeURIComponent(label);

  // Platform-specific URL schemes
  const iosUrl = `maps:0,0?q=${encodedLabel}@${lat},${lng}`;
  const androidUrl = `geo:0,0?q=${lat},${lng}(${encodedLabel})`;

  // Fallback to Google Maps web URL
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const url = Platform.select({
    ios: iosUrl,
    android: androidUrl,
    default: webUrl,
  });

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback to web URL if native scheme fails
      const webCanOpen = await Linking.canOpenURL(webUrl);
      if (webCanOpen) {
        await Linking.openURL(webUrl);
      } else {
        Alert.alert(
          'Cannot Open Maps',
          'Unable to open maps application. Please ensure you have a maps app installed.'
        );
      }
    }
  } catch (error) {
    console.error('Error opening maps:', error);
    Alert.alert('Error', 'Failed to open maps application.');
  }
}

/**
 * Opens maps with directions from current location to destination.
 *
 * @param destination - Destination coordinates
 * @param label - Label for the destination
 */
export async function openDirections(
  destination: Coordinates,
  label: string
): Promise<void> {
  const { latitude, longitude } = destination;
  const encodedLabel = encodeURIComponent(label);

  // URLs that include driving directions from current location
  const iosUrl = `maps:0,0?daddr=${latitude},${longitude}&dirflg=d`;
  const androidUrl = `google.navigation:q=${latitude},${longitude}`;
  const androidFallback = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  const url = Platform.select({
    ios: iosUrl,
    android: androidUrl,
    default: webUrl,
  });

  try {
    const canOpen = await Linking.canOpenURL(url!);

    if (canOpen) {
      await Linking.openURL(url!);
    } else if (Platform.OS === 'android') {
      // Try fallback geo URL on Android
      const fallbackCanOpen = await Linking.canOpenURL(androidFallback);
      if (fallbackCanOpen) {
        await Linking.openURL(androidFallback);
      } else {
        await Linking.openURL(webUrl);
      }
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening directions:', error);
    Alert.alert('Error', 'Failed to open maps for directions.');
  }
}

/**
 * Calculate the region for the map to show all events plus user location.
 */
export function calculateMapRegion(
  userLocation: Coordinates | null,
  events: Array<{ coordinates: Coordinates }>,
  padding: number = 0.01
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const allPoints: Coordinates[] = events.map((e) => e.coordinates);
  if (userLocation) {
    allPoints.push(userLocation);
  }

  if (allPoints.length === 0) {
    // Default to a central US location if no points
    return {
      latitude: 39.8283,
      longitude: -98.5795,
      latitudeDelta: 50,
      longitudeDelta: 50,
    };
  }

  if (allPoints.length === 1) {
    return {
      latitude: allPoints[0].latitude,
      longitude: allPoints[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  const lats = allPoints.map((p) => p.latitude);
  const lngs = allPoints.map((p) => p.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latDelta = (maxLat - minLat) + padding;
  const lngDelta = (maxLng - minLng) + padding;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDelta, 0.01),
    longitudeDelta: Math.max(lngDelta, 0.01),
  };
}

/**
 * Get a color for event type
 */
export function getEventColor(type: 'business' | 'charity'): string {
  return type === 'business' ? '#d6001c' : '#22c55e';
}

/**
 * Get an icon name for event type (for Lucide icons)
 */
export function getEventIcon(type: 'business' | 'charity'): string {
  return type === 'business' ? 'store' : 'heart-handshake';
}
