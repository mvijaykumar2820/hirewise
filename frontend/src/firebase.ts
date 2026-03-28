import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2QWUmN_KM9iw_llwCHQEh6GZpcY__44M",
  authDomain: "hirewise-agents-ai.firebaseapp.com",
  projectId: "hirewise-agents-ai",
  storageBucket: "hirewise-agents-ai.firebasestorage.app",
  messagingSenderId: "364039414694",
  appId: "1:364039414694:web:cbea1459e4e193c9ede567"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, storage, db, auth, googleProvider };
