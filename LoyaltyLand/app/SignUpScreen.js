import { auth, db } from '../constants/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const handleSignUp = async (email, password, username) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create the user profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email,
      points: {},
      preferredStore: ""
    });
    
    console.log("User registered and profile created!");
  } catch (error) {
    console.error(error.message);
  }
};