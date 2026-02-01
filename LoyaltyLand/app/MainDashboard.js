import { doc, onSnapshot } from 'firebase/firestore';
<<<<<<< HEAD
import { db } from '../constants/firebaseConfig';
=======
import { db, auth } from '../constants/firebaseConfig';
>>>>>>> 063a86edace1af7a4383d98b26dd01357dbb5d1f
import * as Location from 'expo-location';

export const UserWallet = ({ userId }) => {
  const [points, setPoints] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", userId), (doc) => {
      if (doc.exists()) {
        setPoints(doc.data().points || {});
      }
    });
    return unsub;
  }, [userId]);

  return (
    <View>
      <Text style={styles.title}>Your Local Impact</Text>
      {Object.entries(points).map(([bizId, val]) => (
        <View key={bizId} style={styles.card}>
          <Text>{bizId}</Text>
          <Text style={styles.bold}>{val} Points</Text>
        </View>
      ))}
    </View>
  );
};

const startOrbMonitoring = async () => {
  //Request Permissions
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to access location was denied');
    return;
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
    {
      identifier: 'Jacob_Alejandro_Troy', //example loc
      latitude: 42.7314, 
      longitude: -73.6908,
      radius: 50, // 50 meters (roughly half a block on River St)
      notifyOnEnter: true,
      notifyOnExit: true,
    }
  ]);

  console.log("Orb Monitoring Active for River Street!");
};