import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
  FlatList,
} from 'react-native';
import {
  X,
  Plus,
  MapPin,
  Navigation,
  Coins,
  Store,
  LogOut,
  Trash2,
  Calendar,
  Radio,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  GeoPoint,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/firebaseAuth';
import LinkDeviceModal from './LinkDeviceModal';

interface BusinessDashboardModalProps {
  visible: boolean;
  onClose: () => void;
}

interface BusinessProfile {
  businessName: string;
  location: string;
  coordinates?: { latitude: number; longitude: number };
}

interface MyEvent {
  id: string;
  title: string;
  type: 'business' | 'charity';
  points: number;
  dateString?: string;
}

interface PointOption {
  label: string;
  value: number;
}

// Dynamic point options based on event type
const BUSINESS_POINT_OPTIONS: PointOption[] = [
  { label: 'Quick Visit (10)', value: 10 },
  { label: 'Long Event (50)', value: 50 },
];

const VOLUNTEER_POINT_OPTIONS: PointOption[] = [
  { label: 'Short Help (20)', value: 20 },
  { label: 'Long Shift (100)', value: 100 },
];

export default function BusinessDashboardModal({
  visible,
  onClose,
}: BusinessDashboardModalProps) {
  const { user } = useAuthStore();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [isDeletingEvent, setIsDeletingEvent] = useState<string | null>(null);
  const [linkedDeviceId, setLinkedDeviceId] = useState<string | null>(null);
  const [showLinkDeviceModal, setShowLinkDeviceModal] = useState(false);

  // Event creation state
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [eventType, setEventType] = useState<'business' | 'charity'>('business');
  const [useBusinessAddress, setUseBusinessAddress] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Dynamic point options based on event type
  const pointOptions = eventType === 'business' ? BUSINESS_POINT_OPTIONS : VOLUNTEER_POINT_OPTIONS;

  // Check if business has valid coordinates
  const hasValidBusinessCoordinates = !!(
    profile?.coordinates?.latitude && profile?.coordinates?.longitude
  );

  useEffect(() => {
    if (visible && user?.uid) {
      fetchBusinessProfile();
    }
  }, [visible, user?.uid]);

  // Subscribe to my events
  useEffect(() => {
    if (!visible || !user?.uid) return;

    const eventsQuery = query(
      collection(db, 'events'),
      where('hostOrgId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const events: MyEvent[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || data.name || 'Untitled',
            type: data.type || 'business',
            points: data.points || 0,
            dateString: data.dateString || '',
          };
        });
        setMyEvents(events);
      },
      (error) => {
        console.error('Error fetching my events:', error);
      }
    );

    return () => unsubscribe();
  }, [visible, user?.uid]);

  // Reset selected points when event type changes
  useEffect(() => {
    setSelectedPoints(null);
  }, [eventType]);

  // Auto-switch to GPS if business has no coordinates
  useEffect(() => {
    if (profile && !hasValidBusinessCoordinates) {
      setUseBusinessAddress(false);
    }
  }, [profile, hasValidBusinessCoordinates]);

  // Get current location when toggle is switched off OR when business has no coordinates
  useEffect(() => {
    if (!useBusinessAddress && !currentLocation) {
      getCurrentLocation();
    }
  }, [useBusinessAddress]);

  const fetchBusinessProfile = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const bizDoc = await getDoc(doc(db, 'businesses', user.uid));

      if (bizDoc.exists()) {
        const data = bizDoc.data();

        // Handle GeoPoint or plain object coordinates
        let coords = undefined;
        if (data.coordinates) {
          coords = {
            latitude: data.coordinates.latitude || data.coordinates._lat || 0,
            longitude: data.coordinates.longitude || data.coordinates._long || 0,
          };
          // Validate coordinates are not zero
          if (coords.latitude === 0 && coords.longitude === 0) {
            coords = undefined;
          }
        }

        setProfile({
          businessName: data.businessName || '',
          location: data.location || '',
          coordinates: coords,
        });

        // Get linked device ID
        setLinkedDeviceId(data.linkedDeviceId || null);
      }
    } catch (error) {
      console.error('Error fetching business profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setUseBusinessAddress(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location.');
      setUseBusinessAddress(true);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim()) {
      Alert.alert('Missing Info', 'Please enter an event name.');
      return;
    }
    if (!selectedPoints) {
      Alert.alert('Missing Info', 'Please select a point value.');
      return;
    }
    if (!user?.uid) return;

    // Determine coordinates
    let coordinates: { latitude: number; longitude: number } | null = null;

    if (useBusinessAddress && profile?.coordinates) {
      coordinates = profile.coordinates;
    } else if (!useBusinessAddress && currentLocation) {
      coordinates = currentLocation;
    }

    if (!coordinates) {
      Alert.alert(
        'Location Required',
        useBusinessAddress
          ? 'Your business does not have coordinates set. Please use current location.'
          : 'Could not get current location. Please try again.'
      );
      return;
    }

    setIsCreating(true);
    try {
      await addDoc(collection(db, 'events'), {
        title: eventName.trim(),
        description: eventDescription.trim(),
        type: eventType,
        points: selectedPoints,
        hostOrgId: user.uid,
        orgName: profile?.businessName || 'Unknown Business',
        address: useBusinessAddress ? profile?.location : 'Current Location',
        coordinates: new GeoPoint(coordinates.latitude, coordinates.longitude),
        dateString: eventDate || null,
        createdAt: Timestamp.now(),
        active: true,
      });

      Alert.alert('Success', `Event "${eventName}" created!`);

      // Reset form
      setEventName('');
      setEventDescription('');
      setEventDate('');
      setSelectedPoints(null);
      setEventType('business');
      setUseBusinessAddress(true);
      setShowCreateEvent(false);
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEvent = (event: MyEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingEvent(event.id);
            try {
              await deleteDoc(doc(db, 'events', event.id));
              console.log(`[BusinessDashboard] Deleted event: ${event.id}`);
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event.');
            } finally {
              setIsDeletingEvent(null);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          onClose();
        },
      },
    ]);
  };

  const renderEventItem = ({ item }: { item: MyEvent }) => {
    const isDeleting = isDeletingEvent === item.id;

    return (
      <View style={styles.eventItem}>
        <View
          style={[
            styles.eventTypeBadge,
            item.type === 'charity' ? styles.eventTypeBadgeCharity : styles.eventTypeBadgeBusiness,
          ]}
        >
          <Text style={styles.eventTypeBadgeText}>
            {item.type === 'charity' ? 'Volunteer' : 'Business'}
          </Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.eventMeta}>
            <Coins size={12} color="#F5A623" />
            <Text style={styles.eventPoints}>{item.points} pts</Text>
            {item.dateString && (
              <>
                <Calendar size={12} color="#999" style={{ marginLeft: 8 }} />
                <Text style={styles.eventDate}>{item.dateString}</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteEvent(item)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Trash2 size={20} color="#dc2626" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Create Event Form
  if (showCreateEvent) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.fullScreenContainer}>
          <View style={styles.createHeader}>
            <TouchableOpacity onPress={() => setShowCreateEvent(false)}>
              <X size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.createTitle}>Create Event</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.createContent}>
            {/* Event Name */}
            <Text style={styles.label}>Event Name</Text>
            <TextInput
              style={styles.input}
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g., Morning Coffee Rush"
              placeholderTextColor="#999"
            />

            {/* Event Type */}
            <Text style={styles.label}>Event Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  eventType === 'business' && styles.typeButtonActive,
                ]}
                onPress={() => setEventType('business')}
              >
                <Store
                  size={18}
                  color={eventType === 'business' ? '#fff' : '#666'}
                />
                <Text
                  style={[
                    styles.typeText,
                    eventType === 'business' && styles.typeTextActive,
                  ]}
                >
                  Business
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  eventType === 'charity' && styles.typeButtonActiveCharity,
                ]}
                onPress={() => setEventType('charity')}
              >
                <Coins
                  size={18}
                  color={eventType === 'charity' ? '#fff' : '#666'}
                />
                <Text
                  style={[
                    styles.typeText,
                    eventType === 'charity' && styles.typeTextActive,
                  ]}
                >
                  Volunteer
                </Text>
              </TouchableOpacity>
            </View>

            {/* Point Value - Dynamic based on event type */}
            <Text style={styles.label}>Point Value</Text>
            <View style={styles.pointsGrid}>
              {pointOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pointOption,
                    selectedPoints === option.value && styles.pointOptionActive,
                  ]}
                  onPress={() => setSelectedPoints(option.value)}
                >
                  <Text
                    style={[
                      styles.pointValue,
                      selectedPoints === option.value && styles.pointValueActive,
                    ]}
                  >
                    {option.value}
                  </Text>
                  <Text
                    style={[
                      styles.pointLabel,
                      selectedPoints === option.value && styles.pointLabelActive,
                    ]}
                  >
                    {option.label.split(' (')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={eventDescription}
              onChangeText={setEventDescription}
              placeholder="Describe the event..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            {/* Date/Time */}
            <Text style={styles.label}>Date/Time (optional)</Text>
            <TextInput
              style={styles.input}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="e.g., Sat 2pm - 5pm"
              placeholderTextColor="#999"
            />

            {/* Location Toggle */}
            <Text style={styles.label}>Event Location</Text>

            {/* Warning if business has no coordinates */}
            {!hasValidBusinessCoordinates && (
              <View style={styles.locationWarning}>
                <MapPin size={16} color="#F5A623" />
                <Text style={styles.locationWarningText}>
                  Profile location missing. Using GPS instead.
                </Text>
              </View>
            )}

            <View style={[
              styles.locationToggle,
              !hasValidBusinessCoordinates && styles.locationToggleDisabled,
            ]}>
              <View style={styles.locationInfo}>
                <MapPin size={20} color={hasValidBusinessCoordinates ? '#2563eb' : '#22c55e'} />
                <View style={styles.locationText}>
                  <Text style={styles.locationTitle}>
                    {useBusinessAddress && hasValidBusinessCoordinates
                      ? 'Business Address'
                      : 'Current GPS Location'}
                  </Text>
                  <Text style={styles.locationSubtitle}>
                    {useBusinessAddress && hasValidBusinessCoordinates
                      ? profile?.location || 'No address set'
                      : isGettingLocation
                      ? 'Getting location...'
                      : currentLocation
                      ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                      : 'Acquiring GPS...'}
                  </Text>
                </View>
              </View>
              <Switch
                value={useBusinessAddress && hasValidBusinessCoordinates}
                onValueChange={setUseBusinessAddress}
                trackColor={{ false: '#22c55e', true: '#2563eb' }}
                thumbColor="#fff"
                disabled={!hasValidBusinessCoordinates}
              />
            </View>

            {isGettingLocation && (
              <View style={styles.locationLoading}>
                <ActivityIndicator size="small" color="#22c55e" />
                <Text style={styles.locationLoadingText}>Getting GPS location...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.createFooter}>
            <TouchableOpacity
              style={[styles.createButton, isCreating && styles.createButtonDisabled]}
              onPress={handleCreateEvent}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Navigation size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Launch Event</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Main Dashboard View
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.modalContainer}>
        <View style={styles.dragHandle} />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Business Dashboard</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Business Info */}
              <View style={styles.businessCard}>
                <View style={styles.businessIcon}>
                  <Store size={28} color="#2563eb" />
                </View>
                <Text style={styles.businessName}>{profile?.businessName}</Text>
                <View style={styles.addressRow}>
                  <MapPin size={14} color="#999" />
                  <Text style={styles.addressText}>{profile?.location}</Text>
                </View>
              </View>

              {/* Create Event Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowCreateEvent(true)}
              >
                <Plus size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Create New Event</Text>
              </TouchableOpacity>

              {/* Link Device Row */}
              <TouchableOpacity
                style={styles.deviceRow}
                onPress={() => setShowLinkDeviceModal(true)}
              >
                <View style={[styles.deviceIconContainer, linkedDeviceId && styles.deviceIconConnected]}>
                  {linkedDeviceId ? (
                    <Check size={20} color="#22c55e" />
                  ) : (
                    <Radio size={20} color="#2563eb" />
                  )}
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceLabel}>Stationary Orb</Text>
                  <Text style={[styles.deviceValue, linkedDeviceId && styles.deviceValueConnected]}>
                    {linkedDeviceId || 'Not linked'}
                  </Text>
                </View>
                <ChevronRight size={20} color="#999" />
              </TouchableOpacity>

              {/* My Events List */}
              <View style={styles.myEventsSection}>
                <Text style={styles.sectionTitle}>My Active Events</Text>
                {myEvents.length === 0 ? (
                  <View style={styles.emptyEvents}>
                    <Calendar size={32} color="#ccc" />
                    <Text style={styles.emptyEventsText}>No active events</Text>
                  </View>
                ) : (
                  <FlatList
                    data={myEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEventItem}
                    scrollEnabled={false}
                  />
                )}
              </View>

              {/* Sign Out */}
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#dc2626" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Link Device Modal */}
      <LinkDeviceModal
        visible={showLinkDeviceModal}
        onClose={() => setShowLinkDeviceModal(false)}
        onSuccess={() => {
          setShowLinkDeviceModal(false);
          fetchBusinessProfile(); // Refresh to show linked device
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  businessCard: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  businessIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceIconConnected: {
    backgroundColor: '#dcfce7',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceLabel: {
    fontSize: 12,
    color: '#999',
  },
  deviceValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  deviceValueConnected: {
    color: '#22c55e',
  },
  myEventsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  emptyEvents: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  emptyEventsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  eventTypeBadgeBusiness: {
    backgroundColor: '#fee2e2',
  },
  eventTypeBadgeCharity: {
    backgroundColor: '#dcfce7',
  },
  eventTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventPoints: {
    fontSize: 12,
    color: '#F5A623',
    marginLeft: 4,
    fontWeight: '500',
  },
  eventDate: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Create Event Form Styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  createContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  typeButtonActive: {
    backgroundColor: '#d6001c',
  },
  typeButtonActiveCharity: {
    backgroundColor: '#22c55e',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeTextActive: {
    color: '#fff',
  },
  pointsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  pointOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  pointOptionActive: {
    backgroundColor: '#F5A623',
  },
  pointValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  pointValueActive: {
    color: '#fff',
  },
  pointLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  pointLabelActive: {
    color: '#fff',
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationWarningText: {
    fontSize: 13,
    color: '#F5A623',
    flex: 1,
  },
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
  },
  locationToggleDisabled: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  locationSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  locationLoadingText: {
    fontSize: 13,
    color: '#666',
  },
  createFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    height: 56,
    borderRadius: 12,
  },
  createButtonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
