import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Radio, Check, HelpCircle } from 'lucide-react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';

interface LinkDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LinkDeviceModal({
  visible,
  onClose,
  onSuccess,
}: LinkDeviceModalProps) {
  const { user } = useAuthStore();

  const [deviceId, setDeviceId] = useState('');
  const [currentLinkedId, setCurrentLinkedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch current linked device on open
  useEffect(() => {
    if (visible && user?.uid) {
      fetchCurrentDevice();
    }
  }, [visible, user?.uid]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsSuccess(false);
      setDeviceId('');
    }
  }, [visible]);

  const fetchCurrentDevice = async () => {
    if (!user?.uid) return;

    setIsFetching(true);
    try {
      // Check both businesses and organizations collections
      const businessDoc = await getDoc(doc(db, 'businesses', user.uid));
      const orgDoc = await getDoc(doc(db, 'organizations', user.uid));

      const businessData = businessDoc.data();
      const orgData = orgDoc.data();

      const linkedId = businessData?.linkedDeviceId || orgData?.linkedDeviceId || null;
      setCurrentLinkedId(linkedId);
      if (linkedId) {
        setDeviceId(linkedId);
      }
    } catch (error) {
      console.error('Error fetching current device:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to link a device.');
      return;
    }

    const trimmedId = deviceId.trim().toUpperCase();

    if (!trimmedId) {
      Alert.alert('Missing ID', 'Please enter the Device ID from your Orb.');
      return;
    }

    // Basic validation - IDs typically look like "ORB_01" or "ORB_001"
    if (trimmedId.length < 3) {
      Alert.alert('Invalid ID', 'Please enter a valid Device ID (e.g., ORB_01).');
      return;
    }

    setIsLoading(true);
    try {
      // Save to both businesses and organizations collections
      await Promise.all([
        setDoc(
          doc(db, 'businesses', user.uid),
          {
            linkedDeviceId: trimmedId,
            deviceLinkedAt: new Date(),
          },
          { merge: true }
        ),
        setDoc(
          doc(db, 'organizations', user.uid),
          {
            linkedDeviceId: trimmedId,
            deviceLinkedAt: new Date(),
          },
          { merge: true }
        ),
      ]);

      console.log(`[LinkDeviceModal] Linked device: ${trimmedId} to business ${user.uid}`);

      setCurrentLinkedId(trimmedId);
      setIsSuccess(true);

      // Call success callback after brief delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      console.error('Error linking device:', error);
      Alert.alert('Error', 'Failed to link device. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Device',
      'Are you sure you want to unlink this Orb from your business?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;

            setIsLoading(true);
            try {
              await Promise.all([
                setDoc(
                  doc(db, 'businesses', user.uid),
                  { linkedDeviceId: null },
                  { merge: true }
                ),
                setDoc(
                  doc(db, 'organizations', user.uid),
                  { linkedDeviceId: null },
                  { merge: true }
                ),
              ]);

              setCurrentLinkedId(null);
              setDeviceId('');
              Alert.alert('Success', 'Device has been unlinked.');
            } catch (error) {
              Alert.alert('Error', 'Failed to unlink device.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Success view
  if (isSuccess) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Check size={48} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>Device Linked!</Text>
            <Text style={styles.successSubtitle}>
              Your stationary Orb is now connected to your business.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.modalContainer}>
          <View style={styles.dragHandle} />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.headerIcon}>
            <Radio size={32} color="#2563eb" />
          </View>

          <Text style={styles.title}>Link Stationary Orb</Text>
          <Text style={styles.subtitle}>
            Connect your business Orb to enable customer check-ins
          </Text>

          {isFetching ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Helper Text */}
              <View style={styles.helperCard}>
                <HelpCircle size={18} color="#F5A623" />
                <Text style={styles.helperText}>
                  Enter the ID found on the bottom of your Orb device (e.g., ORB_01).
                </Text>
              </View>

              {/* Device ID Input */}
              <Text style={styles.label}>Device ID</Text>
              <TextInput
                style={styles.input}
                value={deviceId}
                onChangeText={setDeviceId}
                placeholder="ORB_01"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Current Status */}
              {currentLinkedId && (
                <View style={styles.currentStatus}>
                  <Check size={16} color="#22c55e" />
                  <Text style={styles.currentStatusText}>
                    Currently linked: <Text style={styles.currentStatusId}>{currentLinkedId}</Text>
                  </Text>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {currentLinkedId ? 'Update Device' : 'Link Device'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Unlink Button */}
              {currentLinkedId && (
                <TouchableOpacity
                  style={styles.unlinkButton}
                  onPress={handleUnlink}
                  disabled={isLoading}
                >
                  <Text style={styles.unlinkButtonText}>Unlink Device</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  keyboardView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
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
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E7',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 20,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  currentStatusText: {
    fontSize: 13,
    color: '#666',
  },
  currentStatusId: {
    fontWeight: '600',
    color: '#22c55e',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  unlinkButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  unlinkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
