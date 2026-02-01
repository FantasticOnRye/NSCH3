import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { X, Coins, Store, Gift, AlertCircle } from 'lucide-react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { useWallet } from '../../hooks/useWallet';

interface Deal {
  id: string;
  title: string;
  description: string;
  pointCost: number;
}

interface UserPointsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function UserPointsModal({
  visible,
  onClose,
}: UserPointsModalProps) {
  const { user } = useAuthStore();
  const { getAllBalances, getBuyingPower } = useWallet();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [preferredStore, setPreferredStore] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);

  const balances = getAllBalances();
  const totalPoints = balances.reduce((sum, b) => sum + b.balance, 0);

  // Use total points for redemption (universal points work everywhere)
  const storePoints = totalPoints;

  useEffect(() => {
    if (visible && user?.uid) {
      fetchUserAndDeals();
    }
  }, [visible, user?.uid]);

  const fetchUserAndDeals = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);

      // First, get the user's preferredStore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const userPreferredStore = userData?.preferredStore || null;

      setPreferredStore(userPreferredStore);

      if (!userPreferredStore) {
        setDeals([]);
        setIsLoading(false);
        return;
      }

      // Fetch the organization/business document for deals
      // Try businesses collection first, then organizations
      let orgData: any = null;
      let orgName = '';

      const businessDoc = await getDoc(doc(db, 'businesses', userPreferredStore));
      if (businessDoc.exists()) {
        orgData = businessDoc.data();
        orgName = orgData.businessName || orgData.name || 'Your Store';
      } else {
        const orgDoc = await getDoc(doc(db, 'organizations', userPreferredStore));
        if (orgDoc.exists()) {
          orgData = orgDoc.data();
          orgName = orgData.name || orgData.businessName || 'Your Store';
        }
      }

      setStoreName(orgName);

      // Get deals array from the organization document
      if (orgData?.deals && Array.isArray(orgData.deals)) {
        const formattedDeals: Deal[] = orgData.deals.map((deal: any, index: number) => ({
          id: deal.id || `deal_${index}`,
          title: deal.title || deal.name || 'Reward',
          description: deal.description || '',
          pointCost: deal.pointCost || deal.cost || 0,
        }));
        setDeals(formattedDeals);
      } else {
        // Fallback: Create demo deals for the hackathon
        setDeals([
          {
            id: 'demo_1',
            title: 'Free Small Coffee',
            description: 'Redeem for a free small hot or iced coffee',
            pointCost: 50,
          },
          {
            id: 'demo_2',
            title: '$5 Off Purchase',
            description: 'Get $5 off your next purchase of $15+',
            pointCost: 100,
          },
          {
            id: 'demo_3',
            title: 'Free Pastry',
            description: 'Choose any pastry from our display case',
            pointCost: 75,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching user/deals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (deal: Deal) => {
    if (!user?.uid || !preferredStore) return;

    const canAfford = storePoints >= deal.pointCost;

    if (!canAfford) {
      Alert.alert(
        'Insufficient Points',
        `You need ${deal.pointCost - storePoints} more points to redeem this reward.`
      );
      return;
    }

    Alert.alert(
      'Redeem Reward',
      `Spend ${deal.pointCost} points for "${deal.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setIsRedeeming(deal.id);
            try {
              // For demo: Just show success
              // In production: Call redeemDeal service
              await new Promise((resolve) => setTimeout(resolve, 1000));
              Alert.alert('Success', `You redeemed "${deal.title}"! Show this to the cashier.`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to redeem deal.');
            } finally {
              setIsRedeeming(null);
            }
          },
        },
      ]
    );
  };

  const renderBalanceItem = ({ item }: { item: { orgId: string; balance: number } }) => (
    <View style={styles.balanceItem}>
      <View style={styles.balanceIcon}>
        <Store size={20} color="#2563eb" />
      </View>
      <Text style={styles.balanceOrgId} numberOfLines={1}>
        {item.orgId === 'universal' ? 'Universal' : item.orgId}
      </Text>
      <View style={styles.balanceAmount}>
        <Coins size={14} color="#F5A623" />
        <Text style={styles.balanceValue}>{item.balance}</Text>
      </View>
    </View>
  );

  const renderDealItem = ({ item }: { item: Deal }) => {
    const canAfford = storePoints >= item.pointCost;
    const isThisRedeeming = isRedeeming === item.id;
    const pointsNeeded = item.pointCost - storePoints;

    return (
      <View style={[styles.dealCard, !canAfford && styles.dealCardDisabled]}>
        <View style={[styles.dealIcon, !canAfford && styles.dealIconDisabled]}>
          <Gift size={24} color={canAfford ? '#22c55e' : '#999'} />
        </View>
        <View style={styles.dealContent}>
          <Text style={[styles.dealTitle, !canAfford && styles.dealTitleDisabled]}>
            {item.title}
          </Text>
          <Text style={styles.dealDescription} numberOfLines={1}>
            {item.description}
          </Text>
          {!canAfford && (
            <Text style={styles.needMoreText}>Need {pointsNeeded} more points</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.redeemButton, !canAfford && styles.redeemButtonDisabled]}
          onPress={() => handleRedeem(item)}
          disabled={!canAfford || isThisRedeeming}
        >
          {isThisRedeeming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Coins size={14} color={canAfford ? '#fff' : '#999'} />
              <Text style={[styles.redeemButtonText, !canAfford && styles.redeemButtonTextDisabled]}>
                {item.pointCost}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderNoPreferredStore = () => (
    <View style={styles.noStoreContainer}>
      <View style={styles.noStoreIcon}>
        <AlertCircle size={48} color="#F5A623" />
      </View>
      <Text style={styles.noStoreTitle}>No Preferred Store</Text>
      <Text style={styles.noStoreText}>
        Select a Preferred Store in your Profile to see available rewards.
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.modalContainer}>
        <View style={styles.dragHandle} />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>My Points</Text>

          {/* Total Points */}
          <View style={styles.totalContainer}>
            <Coins size={32} color="#F5A623" />
            <Text style={styles.totalValue}>{totalPoints}</Text>
            <Text style={styles.totalLabel}>Total Points</Text>
          </View>

          {/* Balances by Store */}
          {balances.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Points by Store</Text>
              <FlatList
                data={balances}
                keyExtractor={(item) => item.orgId}
                renderItem={renderBalanceItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.balancesList}
              />
            </View>
          )}

          {/* Available Rewards */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {preferredStore ? `Rewards at ${storeName}` : 'Available Rewards'}
            </Text>

            {isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
            ) : !preferredStore ? (
              renderNoPreferredStore()
            ) : deals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Gift size={48} color="#ccc" />
                <Text style={styles.emptyText}>No rewards available yet</Text>
              </View>
            ) : (
              <FlatList
                data={deals}
                keyExtractor={(item) => item.id}
                renderItem={renderDealItem}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
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
    marginBottom: 20,
  },
  totalContainer: {
    alignItems: 'center',
    backgroundColor: '#FFF8E7',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  totalValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  balancesList: {
    gap: 12,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    minWidth: 150,
  },
  balanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceOrgId: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  dealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  dealCardDisabled: {
    opacity: 0.6,
  },
  dealIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dealIconDisabled: {
    backgroundColor: '#e5e5e5',
  },
  dealContent: {
    flex: 1,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  dealTitleDisabled: {
    color: '#666',
  },
  dealDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  needMoreText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
    fontWeight: '500',
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  redeemButtonDisabled: {
    backgroundColor: '#e5e5e5',
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  redeemButtonTextDisabled: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  noStoreContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  noStoreIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noStoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  noStoreText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
