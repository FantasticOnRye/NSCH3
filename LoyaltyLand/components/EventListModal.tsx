import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { X, Store, Heart, MapPin, Coins, Navigation } from 'lucide-react-native';
import {
  useEventStore,
  useVisibleEvents,
  formatDistance,
  type Event,
} from '../store/eventStore';
import { getEventColor, openDirections } from '../utils/mapHelpers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EventListModalProps {
  visible: boolean;
  onClose: () => void;
  onEventSelect: (event: Event & { distance: number }) => void;
}

export default function EventListModal({
  visible,
  onClose,
  onEventSelect,
}: EventListModalProps) {
  const visibleEvents = useVisibleEvents();
  const { filters, setFilters } = useEventStore();

  const handleEventPress = (event: Event & { distance: number }) => {
    onEventSelect(event);
    onClose();
  };

  const handleGetDirections = (event: Event & { distance: number }) => {
    openDirections(event.coordinates, event.title);
  };

  const renderEventCard = ({ item }: { item: Event & { distance: number } }) => {
    const eventColor = getEventColor(item.type);
    const EventIcon = item.type === 'business' ? Store : Heart;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.7}
      >
        {/* Left Icon */}
        <View style={[styles.eventIconContainer, { backgroundColor: eventColor + '15' }]}>
          <EventIcon size={24} color={eventColor} />
        </View>

        {/* Content */}
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.eventOrg} numberOfLines={1}>
            {item.orgName}
          </Text>
          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <MapPin size={12} color="#999" />
              <Text style={styles.metaText}>{formatDistance(item.distance)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Coins size={12} color="#F5A623" />
              <Text style={[styles.metaText, { color: '#F5A623' }]}>
                {item.points} pts
              </Text>
            </View>
          </View>
        </View>

        {/* Directions Button */}
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => handleGetDirections(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Navigation size={20} color="#2563eb" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MapPin size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>No Events Nearby</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your filters or check back later
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Drag Handle */}
      <View style={styles.dragHandle} />

      {/* Title Row */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Nearby Events</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'business', 'charity'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              filters.type === type && styles.filterChipActive,
            ]}
            onPress={() => setFilters({ type })}
          >
            <Text
              style={[
                styles.filterChipText,
                filters.type === type && styles.filterChipTextActive,
              ]}
            >
              {type === 'all' ? 'All' : type === 'business' ? 'Business' : 'Charity'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''} found
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Modal Content */}
      <View style={styles.modalContainer}>
        {renderHeader()}

        <FlatList
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  resultsCount: {
    fontSize: 13,
    color: '#999',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  eventOrg: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  directionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});
