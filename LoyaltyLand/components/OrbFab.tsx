import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { claimPoints, redeemReward } from '../services/transactionService';
import OrbHubModal from './OrbHubModal';
import { ACCENT_COLOR } from '../constants/theme';

interface OrbFabProps {
  onPointsClaimed?: (points: number) => void;
  onPointsSpent?: (points: number, rewardTitle: string) => void;
}

export default function OrbFab({ onPointsClaimed, onPointsSpent }: OrbFabProps) {
  const { user, userRole } = useAuthStore();
  const [showHubModal, setShowHubModal] = useState(false);

  // Pulse animation for the FAB
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  const handleFabPress = () => {
    setShowHubModal(true);
  };

  // Handle earn completion from the Hub
  const handleEarnComplete = async (points: number) => {
    if (!user?.uid) return;

    try {
      if (userRole === 'business') {
        // Business account: distributing points
        const businessRef = doc(db, 'businesses', user.uid);
        await setDoc(
          businessRef,
          {
            totalPointsDistributed: increment(points),
          },
          { merge: true }
        );
        console.log(`[OrbFab] Business ${user.uid} distributed ${points} points`);
      } else {
        // Personal account: Call the transaction service
        await claimPoints(user.uid, 'DEMO_ORB', points);
        console.log(`[OrbFab] User ${user.uid} earned ${points} points`);
      }

      onPointsClaimed?.(points);
    } catch (error) {
      console.error('[OrbFab] Error recording earn transaction:', error);
      // Points were already shown in UI, just log the error
    }
  };

  // Handle spend completion from the Hub
  const handleSpendComplete = async (points: number, rewardTitle: string) => {
    if (!user?.uid) return;

    try {
      // Call the transaction service to deduct points
      await redeemReward(user.uid, 'DEMO_ORB', points, `reward_${Date.now()}`, rewardTitle);
      console.log(`[OrbFab] User ${user.uid} spent ${points} points on "${rewardTitle}"`);

      onPointsSpent?.(points, rewardTitle);
    } catch (error: any) {
      console.error('[OrbFab] Error recording spend transaction:', error);
      Alert.alert('Error', error.message || 'Failed to redeem reward.');
    }
  };

  return (
    <>
      {/* The Orb FAB Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity style={styles.fab} onPress={handleFabPress}>
          {/* Orb visual - layered circles with highlight */}
          <View style={styles.orbOuter}>
            <View style={styles.orbMiddle}>
              <View style={styles.orbInner}>
                <View style={styles.orbHighlight} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* The Transaction Hub Modal */}
      <OrbHubModal
        visible={showHubModal}
        onClose={() => setShowHubModal(false)}
        onEarnComplete={handleEarnComplete}
        onSpendComplete={handleSpendComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
  fab: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  orbOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff1a36',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbMiddle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff4d63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff8090',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 6,
    paddingTop: 4,
  },
  orbHighlight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
