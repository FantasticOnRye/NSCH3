import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  HelpCircle,
  Smartphone,
  Bluetooth, // <--- ADDED THIS IMPORT
} from 'lucide-react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { ACCENT_COLOR } from '../constants/theme';

interface ConnectOrbScreenProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

export default function ConnectOrbScreen({ onBack, onSuccess }: ConnectOrbScreenProps) {
  const { user, storedOrbId, setStoredOrbId } = useAuthStore();

  const [deviceId, setDeviceId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Pre-fill if already paired
  useEffect(() => {
    if (storedOrbId) {
      setDeviceId(storedOrbId);
    }
  }, [storedOrbId]);

  const handleConnect = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to pair an Orb.');
      return;
    }

    const trimmedId = deviceId.trim();

    if (!trimmedId) {
      Alert.alert('Missing ID', 'Please enter your Orb device ID.');
      return;
    }

    if (trimmedId.length < 3) {
      Alert.alert('Invalid ID', 'Please enter a valid device ID.');
      return;
    }

    setIsConnecting(true);

    try {
      // Save to Firestore
      await setDoc(
        doc(db, 'users', user.uid),
        {
          personalOrbId: trimmedId,
          orbPairedAt: new Date(),
        },
        { merge: true }
      );

      // Save to Zustand for immediate use
      setStoredOrbId(trimmedId);

      console.log(`[ConnectOrbScreen] Paired Orb: ${trimmedId}`);

      setIsConnected(true);

      // Call success callback after brief delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving Orb pairing:', err);
      Alert.alert('Error', 'Failed to save pairing. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      'Unpair Orb',
      'Are you sure you want to unpair this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;

            try {
              await setDoc(
                doc(db, 'users', user.uid),
                { personalOrbId: null },
                { merge: true }
              );
              setStoredOrbId(null);
              setDeviceId('');
              Alert.alert('Success', 'Orb has been unpaired.');
            } catch (err) {
              Alert.alert('Error', 'Failed to unpair device.');
            }
          },
        },
      ]
    );
  };

  // Success view
  if (isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={64} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}><Text style={styles.orbTextLarge}>Orb</Text> Paired!</Text>
          <Text style={styles.successSubtitle}>
            Your personal <Text style={styles.orbText}>Orb</Text> is now connected and ready to use.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={24} color="#1a1a1a" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Connect Your <Text style={styles.orbText}>Orb</Text></Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Orb Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.orbIcon}>
            <View style={styles.orbOuter}>
              <View style={styles.orbMiddle}>
                <View style={styles.orbInner}>
                  <View style={styles.orbHighlight} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <HelpCircle size={20} color={ACCENT_COLOR} />
          <Text style={styles.instructionsText}>
            Enter the device ID found on the bottom or back of your <Text style={styles.orbText}>Orb</Text> device (e.g., ORB_001 or a MAC address like AA:BB:CC:DD:EE:FF).
          </Text>
        </View>

        {/* Device ID Input */}
        <Text style={styles.label}>Device ID</Text>
        <TextInput
          style={styles.input}
          value={deviceId}
          onChangeText={setDeviceId}
          placeholder="ORB_001 or AA:BB:CC:DD:EE:FF"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {/* Current Pairing Status */}
        {storedOrbId && (
          <View style={styles.currentStatus}>
            <Check size={16} color="#22c55e" />
            <Text style={styles.currentStatusText}>
              Currently paired: <Text style={styles.currentStatusId}>{storedOrbId}</Text>
            </Text>
          </View>
        )}

        {/* Demo Devices */}
        <Text style={styles.demoTitle}>Demo Devices</Text>
        <Text style={styles.demoSubtitle}>Tap to use a demo device for testing</Text>

        <View style={styles.demoDevices}>
          {['ORB_001', 'ORB_002', 'DEMO_ORB'].map((id) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.demoDevice,
                deviceId === id && styles.demoDeviceSelected,
              ]}
              onPress={() => setDeviceId(id)}
            >
              <Smartphone size={16} color={deviceId === id ? ACCENT_COLOR : '#666'} />
              <Text style={[
                styles.demoDeviceText,
                deviceId === id && styles.demoDeviceTextSelected,
              ]}>
                {id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Connect Button */}
        <TouchableOpacity
          style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {/* This icon caused the crash because it wasn't imported */}
              <Bluetooth size={20} color="#fff" />
              <Text style={styles.connectButtonText}>
                {storedOrbId ? 'Update Pairing' : 'Pair Device'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Unpair Button */}
        {storedOrbId && (
          <TouchableOpacity style={styles.unpairButton} onPress={handleUnpair}>
            <Text style={styles.unpairButtonText}>Unpair Device</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  orbText: {
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  orbTextLarge: {
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  orbIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffe5e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbMiddle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ff1a36',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff4d63',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 8,
    paddingTop: 6,
  },
  orbHighlight: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffe5e8',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
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
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  currentStatusText: {
    fontSize: 13,
    color: '#666',
  },
  currentStatusId: {
    fontWeight: '600',
    color: '#22c55e',
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  demoSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  demoDevices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  demoDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  demoDeviceSelected: {
    backgroundColor: '#ffe5e8',
    borderColor: ACCENT_COLOR,
  },
  demoDeviceText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  demoDeviceTextSelected: {
    color: ACCENT_COLOR,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT_COLOR,
    padding: 16,
    borderRadius: 12,
  },
  connectButtonDisabled: {
    backgroundColor: '#ffb3bb',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  unpairButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  unpairButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});