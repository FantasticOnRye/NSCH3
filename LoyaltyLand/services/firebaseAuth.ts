import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../constants/firebaseConfig';
import { useAuthStore, UserRole } from '../store/authStore';

interface PersonalProfileData {
  username: string;
  email: string;
  preferredStore?: string;
}

interface BusinessProfileData {
  businessName: string;
  location: string;
  email: string;
}

type ProfileData = PersonalProfileData | BusinessProfileData;

export async function signUp(
  email: string,
  password: string,
  role: 'personal' | 'business',
  profileData: ProfileData
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  try {
    if (role === 'personal') {
      const data = profileData as PersonalProfileData;
      await setDoc(doc(db, 'users', user.uid), {
        username: data.username,
        email: data.email,
        preferredStore: data.preferredStore || null,
        points: 0,
        pointsWallet: {
          locked: {},
          universal: 0,
          designated: {},
        },
        createdAt: new Date().toISOString(),
      });
    } else {
      const data = profileData as BusinessProfileData;
      await setDoc(doc(db, 'businesses', user.uid), {
        businessName: data.businessName,
        location: data.location,
        email: data.email,
        verified: false,
        createdAt: new Date().toISOString(),
      });
    }

    useAuthStore.getState().setUserRole(role);
    return user;
  } catch (firestoreError) {
    // If Firestore fails, delete the auth user to prevent ghost users
    await user.delete();
    throw firestoreError;
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Determine user role by checking which collection has their document
  const role = await getUserRole(user.uid);
  useAuthStore.getState().setUserRole(role);

  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  useAuthStore.getState().clearAuth();
}

export async function getUserRole(uid: string): Promise<UserRole> {
  // Check personal users collection first
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return 'personal';
  }

  // Check business collection
  const businessDoc = await getDoc(doc(db, 'businesses', uid));
  if (businessDoc.exists()) {
    return 'business';
  }

  return null;
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    const store = useAuthStore.getState();

    if (user) {
      const role = await getUserRole(user.uid);
      store.setUser(user);
      store.setUserRole(role);
    } else {
      store.clearAuth();
    }

    store.setLoading(false);
    callback(user);
  });
}
