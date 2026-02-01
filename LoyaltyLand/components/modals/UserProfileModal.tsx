import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, User, MapPin, LogOut, ChevronRight, Check } from 'lucide-react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/firebaseAuth';
import SelectStoreView, { Organization } from '../SelectStoreView';
import ConnectOrbScreen from '../../screens/ConnectOrbScreen';
import { ACCENT_COLOR } from '../../constants/theme';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function UserProfileModal({
  visible,
  onClose,
}: UserProfileModalProps) {
  const { user, storedOrbId, setStoredOrbId } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [preferredStore, setPreferredStore] = useState<string | null>(null);
  const [preferredStoreName, setPreferredStoreName] = useState('');
  const [personalOrbId, setPersonalOrbId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingStore, setIsChangingStore] = useState(false);
  const [isConnectingOrb, setIsConnectingOrb] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && user?.uid) {
      fetchProfile();
    }
  }, [visible, user?.uid]);

  const fetchProfile = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || '');
        setEmail(data.email || '');
        setPreferredStore(data.preferredStore || null);
        setPersonalOrbId(data.personalOrbId || null);

        // Update Zustand if we have a stored Orb ID
        if (data.personalOrbId && !storedOrbId) {
          setStoredOrbId(data.personalOrbId);
        }

        if (data.preferredStore) {
          const storeDoc = await getDoc(doc(db, 'organizations', data.preferredStore));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            setPreferredStoreName(storeData.name || storeData.businessName || 'Unknown');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
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

      setPreferredStore(selectedStore.id);
      setPreferredStoreName(selectedStore.name);
      setIsChangingStore(false);
      setSelectedStore(null);
      Alert.alert('Success', 'Preferred store updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update store.');
    } finally {
      setIsSaving(false);
    }
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

  // Orb connection view
  if (isConnectingOrb) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <ConnectOrbScreen
          onBack={() => setIsConnectingOrb(false)}
          onSuccess={() => {
            setIsConnectingOrb(false);
            fetchProfile(); // Refresh to show new Orb
          }}
        />
      </Modal>
    );
  }

  // Store selection view
  if (isChangingStore) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.fullScreenContainer}>
          <View style={styles.storeSelectHeader}>
            <TouchableOpacity onPress={() => setIsChangingStore(false)}>
              <X size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.storeSelectTitle}>Change Store</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.storeSelectContent}>
            <SelectStoreView
              selectedStoreId={selectedStore?.id || preferredStore}
              onSelectStore={setSelectedStore}
            />
          </View>

          <View style={styles.storeSelectFooter}>
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
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.modalContainer}>
        <View style={styles.dragHandle} />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        <Text style={styles.title}>Profile</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* User Info */}
            <View style={styles.section}>
              <View style={styles.avatarContainer}>
                <User size={32} color={ACCENT_COLOR} />
              </View>
              <Text style={styles.username}>{username}</Text>
              <Text style={styles.email}>{email}</Text>
            </View>

            {/* Preferred Store */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setIsChangingStore(true)}
            >
              <View style={styles.settingsIconContainer}>
                <MapPin size={20} color={ACCENT_COLOR} />
              </View>
              <View style={styles.settingsInfo}>
                <Text style={styles.settingsLabel}>Preferred Store</Text>
                <Text style={styles.settingsValue}>
                  {preferredStoreName || 'Not selected'}
                </Text>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>

            {/* Connect Orb */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setIsConnectingOrb(true)}
            >
              <View style={[styles.settingsIconContainer, personalOrbId ? styles.settingsIconConnected : styles.settingsIconOrb]}>
                {personalOrbId ? (
                  <Check size={20} color="#22c55e" />
                ) : (
                  <View style={styles.miniOrb} />
                )}
              </View>
              <View style={styles.settingsInfo}>
                <Text style={styles.settingsLabel}>Personal <Text style={styles.orbText}>Orb</Text></Text>
                <Text style={[styles.settingsValue, personalOrbId && styles.settingsValueConnected]}>
                  {personalOrbId ? 'Connected' : 'Not paired'}
                </Text>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut size={20} color="#dc2626" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '70%',
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
  section: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffe5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsIconConnected: {
    backgroundColor: '#dcfce7',
  },
  settingsIconOrb: {
    backgroundColor: '#ffe5e8',
  },
  miniOrb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT_COLOR,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 12,
    color: '#999',
  },
  orbText: {
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  settingsValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  settingsValueConnected: {
    color: '#22c55e',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Full screen store selection
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  storeSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  storeSelectTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  storeSelectContent: {
    flex: 1,
    padding: 20,
  },
  storeSelectFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: ACCENT_COLOR,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ffb3bb',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
