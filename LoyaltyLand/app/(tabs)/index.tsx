import { View, StyleSheet } from 'react-native';
import BusinessDashboard from '../BusinessDashboard';

export default function Page() {
  return (
    <View style={styles.container}>
      {/* Pass the ID you created in Firebase earlier */}
      <BusinessDashboard orgId="jacob_alejandro_troy" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});