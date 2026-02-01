import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';

// User Orb BLE UUIDs (must match firmware)
const USER_ORB_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const USER_ORB_NOTIFY_CHAR_UUID = '4fafc202-1fb5-459e-8fcc-c5c9c331914b';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface OrbConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastEvent: string | null;
  deviceName: string | null;
}

interface UseOrbConnectionOptions {
  onNearEvent?: (eventId: string) => void;
  onClaimEvent?: (eventId: string, points: number) => void;
  onRedeemEvent?: (rewardId: string) => void;
  autoConnect?: boolean;
}

/**
 * Hook for connecting to the User Orb device via BLE.
 *
 * Reads the stored Orb ID from Zustand (authStore.storedOrbId) and
 * automatically connects to that specific device on mount.
 *
 * SECURITY: Only connects to the device matching the user's registered Orb ID
 */
export function useOrbConnection(options: UseOrbConnectionOptions = {}) {
  const {
    onNearEvent,
    onClaimEvent,
    onRedeemEvent,
    autoConnect = true,
  } = options;

  // Read storedOrbId from Zustand
  const { user, storedOrbId } = useAuthStore();

  const [state, setState] = useState<OrbConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastEvent: null,
    deviceName: null,
  });

  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Request BLE permissions (Android)
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        // Android 12+
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          results['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
          results['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
          results['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
        );
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return result === 'granted';
      }
    }

    return true; // iOS handles permissions via Info.plist
  }, []);

  // Request notification permissions
  const requestNotificationPermissions = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }, []);

  // Show local notification
  const showLocalNotification = useCallback(async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // Immediate
    });
  }, []);

  // Handle incoming BLE notification from Orb
  const handleOrbNotification = useCallback((data: string) => {
    console.log('[useOrbConnection] Orb notification:', data);

    setState((prev) => ({ ...prev, lastEvent: data }));

    // Parse notification format: TYPE:PAYLOAD
    if (data.startsWith('NEAR:')) {
      const eventId = data.substring(5);
      showLocalNotification('Nearby Event!', `You are near event: ${eventId}`);
      onNearEvent?.(eventId);
    } else if (data.startsWith('CLAIM:')) {
      // Format: CLAIM:eventId:points
      const parts = data.substring(6).split(':');
      const eventId = parts[0];
      const points = parseInt(parts[1], 10) || 10;
      showLocalNotification('Points Earned!', `You earned ${points} points!`);
      onClaimEvent?.(eventId, points);
    } else if (data.startsWith('REDEEM:')) {
      const rewardId = data.substring(7);
      showLocalNotification('Reward Redeemed!', 'Your reward has been processed.');
      onRedeemEvent?.(rewardId);
    }
  }, [onNearEvent, onClaimEvent, onRedeemEvent, showLocalNotification]);

  // Connect directly to the stored Orb device by ID
  const connectToStoredOrb = useCallback(async () => {
    if (!storedOrbId) {
      setState((prev) => ({
        ...prev,
        error: 'No Orb paired. Go to Settings to connect your Orb.',
        isConnecting: false,
      }));
      return;
    }

    const manager = managerRef.current;
    if (!manager) return;

    // Already connected
    if (deviceRef.current?.isConnected) {
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      console.log(`[useOrbConnection] Connecting to stored Orb: ${storedOrbId}`);

      // Try direct connection first (if we have the device ID/MAC)
      let device: Device | null = null;

      try {
        // Attempt direct connection by device ID (MAC address)
        device = await manager.connectToDevice(storedOrbId, {
          timeout: 10000,
          requestMTU: 512,
        });
      } catch (directError) {
        console.log('[useOrbConnection] Direct connection failed, scanning for device...');

        // Fallback: Scan for the device
        device = await new Promise<Device | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            manager.stopDeviceScan();
            reject(new Error('Device not found'));
          }, 15000);

          manager.startDeviceScan(
            [USER_ORB_SERVICE_UUID],
            { allowDuplicates: false },
            async (error, scannedDevice) => {
              if (error) {
                clearTimeout(timeout);
                manager.stopDeviceScan();
                reject(error);
                return;
              }

              // Match by device ID or name
              if (
                scannedDevice &&
                (scannedDevice.id === storedOrbId || scannedDevice.name === storedOrbId)
              ) {
                clearTimeout(timeout);
                manager.stopDeviceScan();

                try {
                  const connectedDevice = await scannedDevice.connect({
                    timeout: 10000,
                    requestMTU: 512,
                  });
                  resolve(connectedDevice);
                } catch (connectError) {
                  reject(connectError);
                }
              }
            }
          );
        });
      }

      if (!device) {
        throw new Error('Could not find or connect to Orb');
      }

      deviceRef.current = device;

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      // Subscribe to notifications
      subscriptionRef.current = device.monitorCharacteristicForService(
        USER_ORB_SERVICE_UUID,
        USER_ORB_NOTIFY_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('[useOrbConnection] Notification error:', error);
            return;
          }

          if (characteristic?.value) {
            // Decode base64 value
            try {
              const decoded = atob(characteristic.value);
              handleOrbNotification(decoded);
            } catch (e) {
              console.error('[useOrbConnection] Failed to decode notification:', e);
            }
          }
        }
      );

      // Monitor for disconnection
      device.onDisconnected((error, disconnectedDevice) => {
        console.log('[useOrbConnection] Orb disconnected');
        setState((prev) => ({ ...prev, isConnected: false }));
        deviceRef.current = null;

        // Auto-reconnect after delay
        if (storedOrbId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToStoredOrb();
          }, 5000);
        }
      });

      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        lastEvent: null,
        deviceName: device.name || storedOrbId,
      });

      console.log(`[useOrbConnection] Connected to Orb: ${device.name || device.id}`);
    } catch (err: any) {
      console.error('[useOrbConnection] Connection error:', err);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err.message || 'Failed to connect to Orb',
      }));

      // Retry connection after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connectToStoredOrb();
      }, 10000);
    }
  }, [storedOrbId, handleOrbNotification]);

  // Disconnect from Orb
  const disconnect = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    if (deviceRef.current) {
      try {
        await deviceRef.current.cancelConnection();
      } catch (e) {
        // Device may already be disconnected
      }
      deviceRef.current = null;
    }

    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    disconnect().then(() => {
      connectToStoredOrb();
    });
  }, [disconnect, connectToStoredOrb]);

  // Initialize BLE manager and auto-connect on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const init = async () => {
      // Request permissions
      const bleGranted = await requestPermissions();
      if (!bleGranted) {
        setState((prev) => ({ ...prev, error: 'Bluetooth permissions denied' }));
        return;
      }

      await requestNotificationPermissions();

      // Create BLE manager
      managerRef.current = new BleManager();

      // Wait for Bluetooth to be powered on
      const subscription = managerRef.current.onStateChange((bleState) => {
        if (bleState === 'PoweredOn') {
          subscription.remove();

          // Auto-connect if we have a stored Orb ID and autoConnect is enabled
          if (storedOrbId && autoConnect) {
            connectToStoredOrb();
          }
        } else if (bleState === 'PoweredOff') {
          setState((prev) => ({
            ...prev,
            error: 'Please turn on Bluetooth',
            isConnected: false,
          }));
        }
      }, true);
    };

    init();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
      managerRef.current?.destroy();
      managerRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  // Reconnect when storedOrbId changes
  useEffect(() => {
    if (storedOrbId && managerRef.current && autoConnect) {
      connectToStoredOrb();
    }
  }, [storedOrbId, autoConnect]);

  return {
    ...state,
    storedOrbId,
    connect: connectToStoredOrb,
    disconnect,
    reconnect,
    isPaired: !!storedOrbId,
  };
}

export default useOrbConnection;
