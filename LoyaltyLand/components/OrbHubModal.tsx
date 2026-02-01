import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  FlatList,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  CircleCheck as CheckCircle,
  ShoppingBag,
  Bluetooth,
  Gift,
  Coins,
  ArrowLeft,
  Check,
  QrCode,
} from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { useWallet } from '../hooks/useWallet';
import { ACCENT_COLOR } from '../constants/theme';

type HubMode = 'selection' | 'earn-scanning' | 'spend-cart' | 'spend-scanning' | 'success' | 'error';

interface Reward {
  id: string;
  title: string;
  description: string;
  pointCost: number;
}

interface OrbHubModalProps {
  visible: boolean;
  onClose: () => void;
  onEarnComplete: (points: number) => void;
  onSpendComplete: (points: number, rewardTitle: string) => void;
}

// Demo rewards fallback
const DEMO_REWARDS: Reward[] = [
  { id: 'demo_1', title: 'Free Small Coffee', description: 'Any hot or iced coffee', pointCost: 50 },
  { id: 'demo_2', title: '$5 Off Purchase', description: 'On orders $15+', pointCost: 100 },
  { id: 'demo_3', title: 'Free Pastry', description: 'Any pastry item', pointCost: 75 },
];

export default function OrbHubModal({
  visible,
  onClose,
  onEarnComplete,
  onSpendComplete,
}: OrbHubModalProps) {
  const { user } = useAuthStore();
  const { getAllBalances } = useWallet();

  const [mode, setMode] = useState<HubMode>('selection');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [resultPoints, setResultPoints] = useState(0);
  const [resultTitle, setResultTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalPoints = getAllBalances().reduce((sum, b) => sum + b.balance, 0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setMode('selection');
      setSelectedReward(null);
      setResultPoints(0);
      setResultTitle('');
      setErrorMessage('');
    }
  }, [visible]);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
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

  // Spin animation for scanning
  useEffect(() => {
    if (mode === 'earn-scanning' || mode === 'spend-scanning') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [mode]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Fetch rewards for spend mode
  const fetchRewards = async () => {
    if (!user?.uid) return;

    setIsLoadingRewards(true);
    try {
      // Get user's preferred store
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const preferredStore = userDoc.data()?.preferredStore;

      if (preferredStore) {
        // Try to get deals from the store
        const businessDoc = await getDoc(doc(db, 'businesses', preferredStore));
        const orgDoc = await getDoc(doc(db, 'organizations', preferredStore));
        const storeData = businessDoc.data() || orgDoc.data();

        if (storeData?.deals && Array.isArray(storeData.deals)) {
          setRewards(
            storeData.deals.map((d: any, i: number) => ({
              id: d.id || `deal_${i}`,
              title: d.title || d.name || 'Reward',
              description: d.description || '',
              pointCost: d.pointCost || d.cost || 0,
            }))
          );
          return;
        }
      }

      // Fallback to demo rewards
      setRewards(DEMO_REWARDS);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      setRewards(DEMO_REWARDS);
    } finally {
      setIsLoadingRewards(false);
    }
  };

  // Handle Earn mode
  const handleEarnPress = () => {
    setMode('earn-scanning');
    startScanSimulation('earn');
  };

  // Handle Spend mode
  const handleSpendPress = () => {
    setMode('spend-cart');
    fetchRewards();
  };

  // Handle reward selection
  const handleSelectReward = (reward: Reward) => {
    if (totalPoints < reward.pointCost) {
      setErrorMessage(`You need ${reward.pointCost - totalPoints} more points for this reward.`);
      setMode('error');
      return;
    }
    setSelectedReward(reward);
    setMode('spend-scanning');
    startScanSimulation('spend');
  };

  // Simulate Orb scan (in production, this would be actual BLE)
  const startScanSimulation = (scanMode: 'earn' | 'spend') => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Simulate 5-second scan that "fails" to find Orb
    // User can tap "Scan QR Code Instead" to complete immediately
    scanTimeoutRef.current = setTimeout(() => {
      // After 5 seconds, just keep scanning (user must tap QR button)
      // Or auto-succeed for faster demo - uncomment below:
      // handleQRScanSuccess();
    }, 5000);
  };

  // QR Code fallback - instant success for demo
  const handleQRScanSuccess = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    if (mode === 'earn-scanning') {
      const earnedPoints = [10, 20, 25, 50][Math.floor(Math.random() * 4)];
      setResultPoints(earnedPoints);
      setMode('success');
      onEarnComplete(earnedPoints);
    } else if (mode === 'spend-scanning' && selectedReward) {
      setResultPoints(selectedReward.pointCost);
      setResultTitle(selectedReward.title);
      setMode('success');
      onSpendComplete(selectedReward.pointCost, selectedReward.title);
    }
  };

  const handleClose = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    onClose();
  };

  const handleBack = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    if (mode === 'spend-cart' || mode === 'error') {
      setMode('selection');
    } else if (mode === 'spend-scanning') {
      setMode('spend-cart');
      setSelectedReward(null);
    } else if (mode === 'earn-scanning') {
      setMode('selection');
    }
  };

  // Render reward item
  const renderRewardItem = ({ item }: { item: Reward }) => {
    const canAfford = totalPoints >= item.pointCost;

    return (
      <TouchableOpacity
        style={[styles.rewardItem, !canAfford && styles.rewardItemDisabled]}
        onPress={() => handleSelectReward(item)}
        disabled={!canAfford}
      >
        <View style={[styles.rewardIcon, !canAfford && styles.rewardIconDisabled]}>
          <Gift size={24} color={canAfford ? '#F5A623' : '#999'} />
        </View>
        <View style={styles.rewardContent}>
          <Text style={[styles.rewardTitle, !canAfford && styles.rewardTitleDisabled]}>
            {item.title}
          </Text>
          <Text style={styles.rewardDescription}>{item.description}</Text>
          {!canAfford && (
            <Text style={styles.needMoreText}>
              Need {item.pointCost - totalPoints} more
            </Text>
          )}
        </View>
        <View style={[styles.rewardCost, canAfford && styles.rewardCostAffordable]}>
          <Coins size={14} color={canAfford ? '#fff' : '#999'} />
          <Text style={[styles.rewardCostText, canAfford && styles.rewardCostTextAffordable]}>
            {item.pointCost}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      // ============ SELECTION STATE ============
      case 'selection':
        return (
          <>
            <Text style={styles.title}>What would you like to do?</Text>
            <Text style={styles.subtitle}>
              Tap your phone to an Orb to earn or spend points
            </Text>

            {/* Balance Display */}
            <View style={styles.balanceChip}>
              <Coins size={16} color="#F5A623" />
              <Text style={styles.balanceText}>{totalPoints} Points Available</Text>
            </View>

            {/* Mode Selection Buttons */}
            <View style={styles.modeButtons}>
              <TouchableOpacity
                style={[styles.modeButton, styles.earnButton]}
                onPress={handleEarnPress}
              >
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={styles.modeIconContainer}>
                    <CheckCircle size={48} color="#fff" />
                  </View>
                </Animated.View>
                <Text style={styles.modeButtonTitle}>Earn Points</Text>
                <Text style={styles.modeButtonSubtitle}>Check in or volunteer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeButton, styles.spendButton]}
                onPress={handleSpendPress}
              >
                <View style={styles.modeIconContainer}>
                  <ShoppingBag size={48} color="#fff" />
                </View>
                <Text style={styles.modeButtonTitle}>Spend Points</Text>
                <Text style={styles.modeButtonSubtitle}>Redeem a reward</Text>
              </TouchableOpacity>
            </View>
          </>
        );

      // ============ SPEND CART STATE ============
      case 'spend-cart':
        return (
          <>
            <View style={styles.headerWithBack}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ArrowLeft size={24} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.title}>Choose a Reward</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.balanceChip}>
              <Coins size={16} color="#F5A623" />
              <Text style={styles.balanceText}>{totalPoints} Points Available</Text>
            </View>

            {isLoadingRewards ? (
              <ActivityIndicator size="large" color="#F5A623" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={rewards}
                keyExtractor={(item) => item.id}
                renderItem={renderRewardItem}
                contentContainerStyle={styles.rewardsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        );

      // ============ SCANNING STATES ============
      case 'earn-scanning':
      case 'spend-scanning':
        const isEarning = mode === 'earn-scanning';
        const themeColor = isEarning ? '#22c55e' : '#F5A623';

        return (
          <>
            <View style={styles.headerWithBack}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ArrowLeft size={24} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.title}>
                {isEarning ? 'Earning Points' : 'Redeeming Reward'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.scanningContainer}>
              <Animated.View
                style={[
                  styles.scanningOrb,
                  { backgroundColor: themeColor, transform: [{ rotate: spinInterpolate }] },
                ]}
              >
                <Bluetooth size={64} color="#fff" />
              </Animated.View>

              <Text style={[styles.scanningTitle, { color: themeColor }]}>
                {isEarning ? 'Tap to Earn...' : `Tap to Pay ${selectedReward?.pointCost} Pts...`}
              </Text>

              <Text style={styles.scanningSubtitle}>
                Hold your phone near the Loyalty <Text style={styles.orbText}>Orb</Text>
              </Text>

              {!isEarning && selectedReward && (
                <View style={styles.selectedRewardChip}>
                  <Gift size={16} color="#F5A623" />
                  <Text style={styles.selectedRewardText}>{selectedReward.title}</Text>
                </View>
              )}

              {/* Animated dots */}
              <View style={styles.dotsContainer}>
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: themeColor },
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: i === 1 ? [1, 0.3] : [0.3, 1],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>

              {/* QR Code Fallback Button */}
              <TouchableOpacity style={styles.qrFallbackButton} onPress={handleQRScanSuccess}>
                <QrCode size={20} color="#fff" />
                <Text style={styles.qrFallbackText}>Scan QR Code Instead</Text>
              </TouchableOpacity>

              <Text style={styles.qrHint}>(Tap to simulate successful scan for demo)</Text>
            </View>
          </>
        );

      // ============ SUCCESS STATE ============
      case 'success':
        const wasEarning = resultTitle === '';
        const successColor = wasEarning ? '#22c55e' : '#F5A623';

        return (
          <View style={styles.resultContainer}>
            <View style={[styles.successIcon, { backgroundColor: wasEarning ? '#dcfce7' : '#FFF8E7' }]}>
              <Check size={48} color={successColor} />
            </View>

            <Text style={[styles.resultTitle, { color: successColor }]}>
              {wasEarning ? 'Points Earned!' : 'Reward Redeemed!'}
            </Text>

            <View style={[styles.resultPointsDisplay, { backgroundColor: wasEarning ? '#dcfce7' : '#FFF8E7' }]}>
              <Coins size={32} color={successColor} />
              <Text style={[styles.resultPoints, { color: successColor }]}>
                {wasEarning ? '+' : '-'}{resultPoints}
              </Text>
            </View>

            {resultTitle && (
              <View style={styles.rewardNameChip}>
                <Gift size={16} color="#F5A623" />
                <Text style={styles.rewardNameText}>{resultTitle}</Text>
              </View>
            )}

            <Text style={styles.resultSubtitle}>
              {wasEarning
                ? 'Points added to your wallet!'
                : 'Show this screen to the cashier'}
            </Text>

            <TouchableOpacity style={[styles.doneButton, { backgroundColor: successColor }]} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );

      // ============ ERROR STATE ============
      case 'error':
        return (
          <View style={styles.resultContainer}>
            <View style={[styles.successIcon, { backgroundColor: '#fee2e2' }]}>
              <X size={48} color="#dc2626" />
            </View>

            <Text style={[styles.resultTitle, { color: '#dc2626' }]}>
              Not Enough Points
            </Text>

            <Text style={styles.errorMessage}>{errorMessage}</Text>

            <TouchableOpacity style={styles.backToSelectionButton} onPress={handleBack}>
              <Text style={styles.backToSelectionText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.modalContainer}>
        <View style={styles.dragHandle} />

        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    minHeight: 450,
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
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF8E7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5A623',
  },

  // Mode Selection
  modeButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
  },
  earnButton: {
    backgroundColor: '#22c55e',
  },
  spendButton: {
    backgroundColor: '#F5A623',
  },
  modeIconContainer: {
    marginBottom: 12,
  },
  modeButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Rewards List
  rewardsList: {
    paddingBottom: 20,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  rewardItemDisabled: {
    opacity: 0.6,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardIconDisabled: {
    backgroundColor: '#e5e5e5',
  },
  rewardContent: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  rewardTitleDisabled: {
    color: '#666',
  },
  rewardDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  needMoreText: {
    fontSize: 11,
    color: '#dc2626',
    marginTop: 2,
    fontWeight: '500',
  },
  rewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  rewardCostAffordable: {
    backgroundColor: '#F5A623',
  },
  rewardCostText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  rewardCostTextAffordable: {
    color: '#fff',
  },

  // Scanning State
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  scanningOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scanningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scanningSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  orbText: {
    fontWeight: 'bold',
    color: ACCENT_COLOR,
  },
  selectedRewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  selectedRewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F5A623',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // QR Fallback
  qrFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  qrFallbackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  qrHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Result States
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultPointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 16,
  },
  resultPoints: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  rewardNameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  rewardNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  backToSelectionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  backToSelectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
