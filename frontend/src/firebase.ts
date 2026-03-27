import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2QWUmN_KM9iw_llwCHQEh6GZpcY__44M",
  authDomain: "hirewise-agents-ai.firebaseapp.com",
  projectId: "hirewise-agents-ai",
  storageBucket: "hirewise-agents-ai.firebasestorage.app",
  messagingSenderId: "364039414694",
  appId: "1:364039414694:web:cbea1459e4e193c9ede567"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
