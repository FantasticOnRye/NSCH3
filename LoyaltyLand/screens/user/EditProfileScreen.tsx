import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import SelectStoreView, { Organization } from '../../components/SelectStoreView';
import { ArrowLeft, Store, ChevronRight } from 'lucide-react-native';

interface UserProfile {
  username: string;
  email: string;
  preferredStore: string | null;
}

interface EditProfileScreenProps {
  onBack?: () => void;
}

export default function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingStore, setIsChangingStore] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchUserProfile();
    }
  }, [user?.uid]);

  const fetchUserProfile = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          username: data.username || '',
          email: data.email || '',
          preferredStore: data.preferredStore || null,
        });

        // Fetch store name if preferredStore exists
        if (data.preferredStore) {
          const storeDoc = await getDoc(doc(db, 'organizations', data.preferredStore));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            setCurrentStoreName(storeData.name || storeData.businessName || 'Unknown Store');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStore = async () => {
    if (!user?.uid || !selectedStore) return;

    setIsSaving(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferredStore: selectedStore.id,
      });

      setProfile((prev) =>
        prev ? { ...prev, preferredStore: selectedStore.id } : null
      );
      setCurrentStoreName(selectedStore.name);
      setIsChangingStore(false);
      setSelectedStore(null);

      Alert.alert('Success', 'Your preferred store has been updated!');
    } catch (error) {
      console.error('Error updating store:', error);
      Alert.alert('Error', 'Failed to update preferred store. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelStoreChange = () => {
    setIsChangingStore(false);
    setSelectedStore(null);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Store selection view
  if (isChangingStore) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancelStoreChange} style={styles.backButton}>
            <ArrowLeft size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Store</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Store Selection */}
        <View style={styles.storeSelectContainer}>
          <SelectStoreView
            selectedStoreId={selectedStore?.id || profile?.preferredStore || null}
            onSelectStore={setSelectedStore}
            title="Select New Store"
            subtitle="Choose a different local business to support"
          />
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, !selectedStore && styles.saveButtonDisabled]}
            onPress={handleSaveStore}
            disabled={isSaving || !selectedStore}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Profile view
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#1a1a1a" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Edit Profile</Text>
        {onBack && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile?.username || 'Not set'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || 'Not set'}</Text>
          </View>
        </View>

        {/* Preferred Store Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Store</Text>

          <TouchableOpacity
            style={styles.storeRow}
            onPress={() => setIsChangingStore(true)}
          >
            <View style={styles.storeIconContainer}>
              <Store size={24} color="#2563eb" />
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeLabel}>
                {profile?.preferredStore ? 'Current Store' : 'No store selected'}
              </Text>
              <Text style={styles.storeName}>
                {currentStoreName || 'Tap to select a store'}
              </Text>
            </View>
            <ChevronRight size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Info Note */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Your preferred store helps personalize your experience and shows you relevant deals first.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  noteContainer: {
    paddingHorizontal: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    textAlign: 'center',
  },
  storeSelectContainer: {
    flex: 1,
    padding: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
