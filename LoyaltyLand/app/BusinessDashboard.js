import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, Button } from 'react-native';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';

// --- SUB-COMPONENT 1: Profile & Wares ---
export const BusinessProfile = ({ orgId, orgData }) => {
  const [newItem, setNewItem] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const addWare = async () => {
    const orgRef = doc(db, "organizations", orgId);
    
    // Changing updateDoc to setDoc with merge: true
    try {
      await setDoc(orgRef, {
        wares: arrayUnion({ item: newItem, price: parseFloat(newPrice) }),
        // Adding basic info just in case it's creating the doc for the first time
        name: orgData.name,
        location: orgData.location,
        verified: true
      }, { merge: true });

      setNewItem(''); 
      setNewPrice('');
      alert("Product added to " + orgData.name + "!");
    } catch (e) {
      console.error("Error adding product: ", e);
      alert("Failed to add product. Check console.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.header}>{orgData.name} {orgData.verified ? "✅" : "❌"}</Text>
      <Text style={styles.subtext}>{orgData.location}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>Add to Menu:</Text>
      <TextInput value={newItem} onChangeText={setNewItem} placeholder="Item Name" style={styles.input}/>
      <TextInput value={newPrice} onChangeText={setNewPrice} placeholder="Price ($)" keyboardType="numeric" style={styles.input}/>
      <Button title="Update Menu" onPress={addWare} color="#d6001c"/>
    </View>
  );
};

// --- SUB-COMPONENT 2: Create Event ---
import { collection, addDoc, GeoPoint, Timestamp } from 'firebase/firestore';
import * as Location from 'expo-location';

export const CreateEvent = ({ orgId }) => {
  const [eventName, setEventName] = useState('');
  const [points, setPoints] = useState('50');
  const [eventDate, setEventDate] = useState('');

  const launchEvent = async () => {
    if (!eventName) return alert("Please name your event!");

    try {
      //Get current GPS Location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      
      //Save to "events" collection
      await addDoc(collection(db, "events"), {
        orgId: orgId,
        name: eventName,
        points: parseInt(points),
        dateString: eventDate, // Storing as string for easy display
        createdAt: Timestamp.now(),
        coordinates: new GeoPoint(location.coords.latitude, location.coords.longitude)
      });

      setEventName('');
      alert(`Orb Launched! Your teammate's map can now see "${eventName}" at your current location.`);
    } catch (e) {
      console.error(e);
      alert("Error launching event.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>🚀 Launch Loyalty Orb</Text>
      
      <TextInput 
        value={eventName} 
        onChangeText={setEventName} 
        placeholder="Event Name (e.g. Morning Rush)" 
        style={styles.input}
      />
      
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput 
          value={points} 
          onChangeText={setPoints} 
          placeholder="Points" 
          keyboardType="numeric" 
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput 
          value={eventDate} 
          onChangeText={setEventDate} 
          placeholder="Date/Time (e.g. Sat 2pm)" 
          style={[styles.input, { flex: 2 }]}
        />
      </View>

      <Text style={styles.subtext}>This will drop an Orb at your current GPS coordinates.</Text>
      <Button title="Launch Event" onPress={launchEvent} color="#F5A623"/>
    </View>
  );
};

// --- MAIN DASHBOARD ---
export default function BusinessDashboard({ orgId }) {
  const mockOrgData = {
    name: "Jacob Alejandro",
    location: "274 River St, Troy, NY",
    verified: true
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>Organization Dashboard</Text>
      <BusinessProfile orgId={orgId} orgData={mockOrgData} />
      <CreateEvent orgId={orgId} />
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 20 },
  mainTitle: { fontSize: 32, fontWeight: 'bold', marginTop: 40, marginBottom: 20, color: '#1c1e21' },
  section: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, elevation: 4 },
  header: { fontSize: 22, fontWeight: 'bold' },
  label: { fontSize: 16, fontWeight: '600', marginVertical: 10 },
  subtext: { color: '#65676b', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 }
});