import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Plus, Gift, Trash2, Coins } from 'lucide-react-native';
import {
  collection,
  query,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../constants/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { VALID_POINT_VALUES, PointTierValue } from '../../constants/points';

interface Deal {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  active: boolean;
}

interface ManageRewardsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ManageRewardsModal({
  visible,
  onClose,
}: ManageRewardsModalProps) {
  const { user } = useAuthStore();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCost, setNewCost] = useState<PointTierValue | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (visible && user?.uid) {
      fetchDeals();
    }
  }, [visible, user?.uid]);

  const fetchDeals = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const dealsSnapshot = await getDocs(
        collection(db, 'organizations', user.uid, 'deals')
      );

      const dealsData: Deal[] = dealsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Deal[];

      setDeals(dealsData);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDeal = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing Info', 'Please enter a deal title.');
      return;
    }
    if (!newCost) {
      Alert.alert('Missing Info', 'Please select a point cost.');
      return;
    }
    if (!user?.uid) return;

    setIsAdding(true);
    try {
      const docRef = await addDoc(collection(db, 'organizations', user.uid, 'deals'), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        pointCost: newCost,
        active: true,
        createdAt: Timestamp.now(),
      });

      setDeals([
        ...deals,
        {
          id: docRef.id,
          title: newTitle.trim(),
          description: newDescription.trim(),
          pointCost: newCost,
          active: true,
        },
      ]);

      setNewTitle('');
      setNewDescription('');
      setNewCost(null);
      setShowAddForm(false);
      Alert.alert('Success', 'Deal added!');
    } catch (error) {
      console.error('Error adding deal:', error);
      Alert.alert('Error', 'Failed to add deal.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteDeal = (deal: Deal) => {
    Alert.alert('Delete Deal', `Are you sure you want to delete "${deal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user?.uid) return;

          try {
            await deleteDoc(doc(db, 'organizations', user.uid, 'deals', deal.id));
            setDeals(deals.filter((d) => d.id !== deal.id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete deal.');
          }
        },
      },
    ]);
  };

  const renderDealItem = ({ item }: { item: Deal }) => (
    <View style={styles.dealCard}>
      <View style={styles.dealIcon}>
        <Gift size={24} color="#22c55e" />
      </View>
      <View style={styles.dealContent}>
        <Text style={styles.dealTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.dealDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.dealActions}>
        <View style={styles.dealCost}>
          <Coins size={14} color="#F5A623" />
          <Text style={styles.dealCostText}>{item.pointCost}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteDeal(item)}
        >
          <Trash2 size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Add Deal Form
  if (showAddForm) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={() => setShowAddForm(false)} />

        <View style={styles.modalContainer}>
          <View style={styles.dragHandle} />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowAddForm(false)}
          >
            <X size={24} color="#666" />
          </TouchableOpacity>

          <Text style={styles.title}>Add New Deal</Text>

          <Text style={styles.label}>Deal Title</Text>
          <TextInput
            style={styles.input}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="e.g., Free Coffee, 10% Off"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={newDescription}
            onChangeText={setNewDescription}
            placeholder="Describe the reward..."
            placeholderTextColor="#999"
            multiline
          />

          <Text style={styles.label}>Point Cost</Text>
          <View style={styles.costGrid}>
            {VALID_POINT_VALUES.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.costOption,
                  newCost === value && styles.costOptionActive,
                ]}
                onPress={() => setNewCost(value)}
              >
                <Text
                  style={[
                    styles.costValue,
                    newCost === value && styles.costValueActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.addButton, isAdding && styles.addButtonDisabled]}
            onPress={handleAddDeal}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Add Deal</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Main View
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.modalContainer}>
        <View style={styles.dragHandle} />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>

        <Text style={styles.title}>Manage Rewards</Text>

        {/* Add New Deal Button */}
        <TouchableOpacity
          style={styles.newDealButton}
          onPress={() => setShowAddForm(true)}
        >
          <Plus size={20} color="#2563eb" />
          <Text style={styles.newDealText}>Add New Deal</Text>
        </TouchableOpacity>

        {/* Deals List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
        ) : deals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Gift size={48} color="#ccc" />
            <Text style={styles.emptyText}>No deals yet</Text>
            <Text style={styles.emptySubtext}>
              Add deals that customers can redeem with their points
            </Text>
          </View>
        ) : (
          <FlatList
            data={deals}
            keyExtractor={(item) => item.id}
            renderItem={renderDealItem}
            style={styles.dealsList}
          />
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
    maxHeight: '75%',
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
  newDealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  newDealText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  dealsList: {
    flex: 1,
  },
  dealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  dealIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dealContent: {
    flex: 1,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  dealDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  dealActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  dealCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dealCostText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5A623',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  // Add Form Styles
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  costOption: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  costOptionActive: {
    backgroundColor: '#F5A623',
  },
  costValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  costValueActive: {
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#2563eb',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  addButtonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
