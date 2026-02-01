import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { filterByName } from '../utils/searchFilter';
import { Search, Store, MapPin, Check } from 'lucide-react-native';

export interface Organization {
  id: string;
  name: string;
  location?: string;
  verified: boolean;
}

/**
 * Dummy stores for demo purposes.
 * Shown when database is empty so the list is never blank.
 */
const DUMMY_STORES: Organization[] = [
  {
    id: 'jacob_alejandro_troy',
    name: 'Jacob Alejandro',
    location: '274 River St, Troy, NY',
    verified: true,
  },
  {
    id: 'muddys_coffeehouse',
    name: "Muddy's Coffeehouse",
    location: '1403 5th Ave, Troy, NY',
    verified: true,
  },
  {
    id: 'rpi_campus_store',
    name: 'RPI Campus Store',
    location: 'RPI Student Union, Troy, NY',
    verified: true,
  },
];

interface SelectStoreViewProps {
  selectedStoreId: string | null;
  onSelectStore: (store: Organization) => void;
  title?: string;
  subtitle?: string;
}

export default function SelectStoreView({
  selectedStoreId,
  onSelectStore,
  title = 'Select Your Preferred Store',
  subtitle = 'Choose a local business to support',
}: SelectStoreViewProps) {
  const [stores, setStores] = useState<Organization[]>([]);
  const [filteredStores, setFilteredStores] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch verified organizations on mount
  useEffect(() => {
    fetchVerifiedOrganizations();
  }, []);

  // Filter stores when search query changes
  useEffect(() => {
    setFilteredStores(filterByName(stores, searchQuery));
  }, [searchQuery, stores]);

  const fetchVerifiedOrganizations = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Query both organizations and businesses collections
      const orgsQuery = query(
        collection(db, 'organizations'),
        where('verified', '==', true)
      );
      const businessesQuery = collection(db, 'businesses');

      const [orgsSnapshot, businessesSnapshot] = await Promise.all([
        getDocs(orgsQuery),
        getDocs(businessesQuery),
      ]);

      const orgsData: Organization[] = orgsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.data().businessName || 'Unknown Store',
        location: doc.data().location || doc.data().address,
        verified: doc.data().verified ?? true,
      }));

      const businessesData: Organization[] = businessesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().businessName || doc.data().name || 'Unknown Store',
        location: doc.data().address || doc.data().location,
        verified: true,
      }));

      // Merge all sources: dummy stores + organizations + businesses
      // Use a Map to dedupe by ID
      const storeMap = new Map<string, Organization>();

      // Add dummy stores first
      DUMMY_STORES.forEach((store) => storeMap.set(store.id, store));

      // Add Firestore organizations
      orgsData.forEach((store) => storeMap.set(store.id, store));

      // Add Firestore businesses
      businessesData.forEach((store) => storeMap.set(store.id, store));

      const finalStores = Array.from(storeMap.values());
      console.log(`[SelectStoreView] Loaded ${finalStores.length} stores (${DUMMY_STORES.length} dummy + ${orgsData.length} orgs + ${businessesData.length} businesses)`);

      setStores(finalStores);
      setFilteredStores(finalStores);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      // On error, still show dummy stores
      setStores(DUMMY_STORES);
      setFilteredStores(DUMMY_STORES);
      setError('Failed to load some stores. Showing available options.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStoreItem = ({ item }: { item: Organization }) => {
    const isSelected = selectedStoreId === item.id;

    return (
      <TouchableOpacity
        style={[styles.storeItem, isSelected && styles.storeItemSelected]}
        onPress={() => onSelectStore(item)}
        activeOpacity={0.7}
      >
        <View style={styles.storeIcon}>
          <Store size={24} color={isSelected ? '#2563eb' : '#666'} />
        </View>
        <View style={styles.storeInfo}>
          <Text style={[styles.storeName, isSelected && styles.storeNameSelected]}>
            {item.name}
          </Text>
          {item.location && (
            <View style={styles.locationRow}>
              <MapPin size={14} color="#999" />
              <Text style={styles.storeLocation}>{item.location}</Text>
            </View>
          )}
        </View>
        {isSelected && (
          <View style={styles.checkIcon}>
            <Check size={20} color="#2563eb" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Store size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No stores found' : 'No verified stores yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try a different search term'
          : 'Check back later for participating businesses'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading stores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchVerifiedOrganizations}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stores..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Store List */}
          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.id}
            renderItem={renderStoreItem}
            ListEmptyComponent={renderEmptyList}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    marginBottom: 8,
  },
  retryText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1a1a1a',
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  storeItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#f0f7ff',
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  storeNameSelected: {
    color: '#2563eb',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeLocation: {
    fontSize: 13,
    color: '#999',
  },
  checkIcon: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
