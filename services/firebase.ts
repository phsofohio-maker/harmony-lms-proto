/**
 * Firebase Client Configuration
 * 
 * Single source of truth for all Firebase service instances.
 * All other modules import from here—never directly from 'firebase/*'.
 * 
 * @module services/firebase
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration from environment variables (VITE_FIREBASE_*)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate configuration at startup
const validateConfig = (config: typeof firebaseConfig): void => {
  const required = ['apiKey', 'authDomain', 'projectId'] as const;
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Firebase configuration incomplete. Missing: ${missing.join(', ')}. ` +
      `Ensure VITE_FIREBASE_* environment variables are set.`
    );
  }
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const initializeFirebase = (): void => {
  if (app) return; // Already initialized
  
  validateConfig(firebaseConfig);
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Connect to emulators in development
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    // ... inside remains the same
    console.log('%c🔧 Connecting to Firebase Emulators', 'color: #f59e0b; font-weight: bold;');
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
}
  
  console.log('%c✓ Firebase initialized', 'color: #22c55e; font-weight: bold;');
};

// Initialize on module load
initializeFirebase();

// Export initialized services
export { app, auth, db, storage };

// Export types for convenience
export type { User as FirebaseUser } from 'firebase/auth';