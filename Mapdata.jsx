import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 42.7299,       // RPI latitude
          longitude: -73.6795,     // RPI longitude
          latitudeDelta: 0.02,     // zoom in closer (~small campus)
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{ latitude: 42.7345670, longitude: -73.6763294 }}
          title="Mumu Cafe"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});