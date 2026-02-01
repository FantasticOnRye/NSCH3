import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { POINT_TIERS, PointTierValue, VALID_POINT_VALUES } from '../constants/points';

interface CreateDealScreenProps {
  orgId?: string; // Optional: passed as prop or use auth user's uid
}

export default function CreateDealScreen({ orgId }: CreateDealScreenProps) {
  const { user } = useAuthStore();
  const businessId = orgId || user?.uid;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCost, setSelectedCost] = useState<PointTierValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateDeal = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a deal title.');
      return;
    }

    if (!selectedCost) {
      Alert.alert('Missing Point Cost', 'Please select a point cost for this deal.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a deal description.');
      return;
    }

    if (!businessId) {
      Alert.alert('Error', 'Unable to identify your business. Please log in again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save to Firestore under organizations/{uid}/deals
      await addDoc(collection(db, 'organizations', businessId, 'deals'), {
        title: title.trim(),
        description: description.trim(),
        pointCost: selectedCost,
        active: true,
        createdAt: Timestamp.now(),
      });

      Alert.alert('Success', `Deal "${title}" created successfully!`);

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedCost(null);
    } catch (error) {
      console.error('Error creating deal:', error);
      Alert.alert('Error', 'Failed to create deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>Create New Deal</Text>

      <View style={styles.section}>
        {/* Deal Title */}
        <Text style={styles.label}>Deal Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Free Coffee, 10% Off Purchase"
          placeholderTextColor="#999"
          maxLength={50}
        />

        {/* Point Cost Selection */}
        <Text style={styles.label}>Point Cost</Text>
        <Text style={styles.subtext}>
          Select how many points customers need to redeem this deal
        </Text>
        <View style={styles.tierContainer}>
          {VALID_POINT_VALUES.map((value) => {
            const tier = POINT_TIERS.find((t) => t.value === value);
            const isSelected = selectedCost === value;

            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.tierButton,
                  isSelected && styles.tierButtonSelected,
                ]}
                onPress={() => setSelectedCost(value)}
              >
                <Text
                  style={[
                    styles.tierValue,
                    isSelected && styles.tierTextSelected,
                  ]}
                >
                  {value}
                </Text>
                <Text
                  style={[
                    styles.tierLabel,
                    isSelected && styles.tierTextSelected,
                  ]}
                >
                  points
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what customers get with this deal..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleCreateDeal}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Deal</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 20,
    color: '#1c1e21',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1c1e21',
  },
  subtext: {
    color: '#65676b',
    marginBottom: 12,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  tierContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  tierButton: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 80,
    backgroundColor: '#fafafa',
  },
  tierButtonSelected: {
    borderColor: '#d6001c',
    backgroundColor: '#d6001c',
  },
  tierValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1e21',
  },
  tierLabel: {
    fontSize: 12,
    color: '#65676b',
    marginTop: 2,
  },
  tierTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#d6001c',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
