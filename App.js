import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCE_TASK_NAME = 'ORB_DETECTION_TASK';

// This task runs even if the app is minimized
TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data: { eventType, region }, error }) => {
  if (error) return;
  if (eventType === Location.GeofencingEventType.Enter) {
    console.log("Entered Orb:", region.identifier);
    // Logic: Trigger a local notification or auto-award 'check-in' points
  }
});

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './LoyaltyLand/constants/firebaseConfig';

//Subscreens
import AuthScreen from './screens/AuthScreen'; 
import MainDashboard from './screens/MainDashboard';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  //User state changes
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, []);

  if (initializing) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#4A90E2" /></View>
  );

  return (
    <View style={{ flex: 1 }}>
      {!user ? (
        <AuthScreen /> 
      ) : (
        <MainDashboard user={user} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});