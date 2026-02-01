import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet } from 'react-native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';

export const BusinessProfile = ({ orgId, orgData }) => {
  const [newItem, setNewItem] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const addWare = async () => {
    const orgRef = doc(db, "organizations", orgId);
    await updateDoc(orgRef, {
      wares: arrayUnion({ item: newItem, price: parseFloat(newPrice) })
    });
    setNewItem(''); setNewPrice('');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{orgData.name} {orgData.verified ? "✅" : "❌"}</Text>
      <Text>{orgData.type} in {orgData.location}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Add Service/Product:</Text>
        <TextInput value={newItem} onChangeText={setNewItem} placeholder="e.g. Cold Brew" style={styles.input}/>
        <TextInput value={newPrice} onChangeText={setNewPrice} placeholder="Price ($)" keyboardType="numeric" style={styles.input}/>
        <Button title="Update Prices" onPress={addWare} color="#4A90E2"/>
      </View>
    </ScrollView>
  );
};