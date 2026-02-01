import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The 'index' is your traffic controller */}
      <Stack.Screen name="index" /> 
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/signup" />
      <Stack.Screen name="MainDashboard" />
    </Stack>
  );
}
