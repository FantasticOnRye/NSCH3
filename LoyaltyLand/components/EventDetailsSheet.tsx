import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import {
  X,
  Store,
  Heart,
  MapPin,
  Coins,
  Navigation,
  Clock,
  Building2,
} from 'lucide-react-native';
import { type Event, formatDistance } from '../store/eventStore';
import { getEventColor, openDirections } from '../utils/mapHelpers';

interface EventDetailsSheetProps {
  event: (Event & { distance: number }) | null;
  visible: boolean;
  onClose: () => void;
}

export default function EventDetailsSheet({
  event,
  visible,
  onClose,
}: EventDetailsSheetProps) {
  if (!event) return null;

  const eventColor = getEventColor(event.type);
  const EventIcon = event.type === 'business' ? Store : Heart;

  const handleGetDirections = () => {
    openDirections(event.coordinates, event.title);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet Content */}
      <View style={styles.sheetContainer}>
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        {/* Event Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: eventColor + '15' }]}>
          <EventIcon size={16} color={eventColor} />
          <Text style={[styles.typeBadgeText, { color: eventColor }]}>
            {event.type === 'business' ? 'Business Event' : 'Charity Event'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Organization */}
        <View style={styles.infoRow}>
          <Building2 size={16} color="#666" />
          <Text style={styles.infoText}>{event.orgName}</Text>
        </View>

        {/* Distance */}
        <View style={styles.infoRow}>
          <MapPin size={16} color="#666" />
          <Text style={styles.infoText}>
            {formatDistance(event.distance)} away
            {event.address && ` - ${event.address}`}
          </Text>
        </View>

        {/* Time (if available) */}
        {event.startTime && (
          <View style={styles.infoRow}>
            <Clock size={16} color="#666" />
            <Text style={styles.infoText}>
              {event.startTime}
              {event.endTime && ` - ${event.endTime}`}
            </Text>
          </View>
        )}

        {/* Points Value */}
        <View style={styles.pointsContainer}>
          <Coins size={24} color="#F5A623" />
          <Text style={styles.pointsValue}>{event.points}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>

        {/* Description */}
        {event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}

        {/* Get Directions Button */}
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={handleGetDirections}
        >
          <Navigation size={20} color="#fff" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sheetContainer: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
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
    padding: 4,
    zIndex: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    paddingRight: 40,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E7',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F5A623',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#F5A623',
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
