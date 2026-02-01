import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { User, Coins, Store, TrendingUp } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { useWallet } from '../hooks/useWallet';

// Import modals
import UserProfileModal from './modals/UserProfileModal';
import BusinessDashboardModal from './modals/BusinessDashboardModal';
import UserPointsModal from './modals/UserPointsModal';
import ManageRewardsModal from './modals/ManageRewardsModal';

export default function MainHeader() {
  const { user, userRole } = useAuthStore();
  const { getAllBalances } = useWallet();

  // Calculate total points (for personal users)
  const totalPoints = getAllBalances().reduce((sum, b) => sum + b.balance, 0);

  // Business: Points distributed counter
  const [pointsDistributed, setPointsDistributed] = useState(0);

  // Modal visibility states
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showBusinessDashboard, setShowBusinessDashboard] = useState(false);
  const [showUserPoints, setShowUserPoints] = useState(false);
  const [showManageRewards, setShowManageRewards] = useState(false);

  // Subscribe to business totalPointsDistributed
  useEffect(() => {
    if (userRole !== 'business' || !user?.uid) return;

    // Listen to the businesses document for real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'businesses', user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setPointsDistributed(data.totalPointsDistributed || 0);
        }
      },
      (error) => {
        console.error('Error fetching business stats:', error);
      }
    );

    return () => unsubscribe();
  }, [userRole, user?.uid]);

  // Left button handler (Profile/Dashboard)
  const handleLeftPress = () => {
    if (userRole === 'personal') {
      setShowUserProfile(true);
    } else if (userRole === 'business') {
      setShowBusinessDashboard(true);
    }
  };

  // Right button handler (Points/Rewards)
  const handleRightPress = () => {
    if (userRole === 'personal') {
      setShowUserPoints(true);
    } else if (userRole === 'business') {
      setShowManageRewards(true);
    }
  };

  return (
    <>
      <View style={styles.header}>
        {/* Left Button - Profile/Dashboard */}
        <TouchableOpacity style={styles.headerButton} onPress={handleLeftPress}>
          {userRole === 'business' ? (
            <Store size={24} color="#1a1a1a" />
          ) : (
            <User size={24} color="#1a1a1a" />
          )}
        </TouchableOpacity>

        {/* Right Button - Points/Rewards */}
        <TouchableOpacity style={styles.pointsPill} onPress={handleRightPress}>
          {userRole === 'business' ? (
            <>
              <TrendingUp size={18} color="#22c55e" />
              <View>
                <Text style={styles.distributedLabel}>Distributed</Text>
                <Text style={styles.distributedValue}>{pointsDistributed} pts</Text>
              </View>
            </>
          ) : (
            <>
              <Coins size={18} color="#F5A623" />
              <Text style={styles.pointsText}>{totalPoints}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
      />

      <BusinessDashboardModal
        visible={showBusinessDashboard}
        onClose={() => setShowBusinessDashboard(false)}
      />

      <UserPointsModal
        visible={showUserPoints}
        onClose={() => setShowUserPoints(false)}
      />

      <ManageRewardsModal
        visible={showManageRewards}
        onClose={() => setShowManageRewards(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  headerButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  distributedLabel: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
  },
  distributedValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
});
