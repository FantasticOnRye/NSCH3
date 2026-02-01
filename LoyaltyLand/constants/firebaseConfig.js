import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNKsL-0RG7Ub2zJW-X-fX96BjzR9OHiLQ",
  authDomain: "nsch3-eb96c.firebaseapp.com",
  projectId: "nsch3-eb96c",
  storageBucket: "nsch3-eb96c.firebasestorage.app",
  messagingSenderId: "472640311048",
  appId: "1:472640311048:web:495abcbc80864a002166bd",
  measurementId: "G-PRMFFTETLV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);