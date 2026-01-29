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

// Firebase configuration from environment or Firebase hosting
// When deployed to Firebase Hosting, this is auto-injected
const firebaseConfig = {
    apiKey: "AIzaSyA5I_JujHcjuJMyhhihMeSkQjN2nO58Cao",
    authDomain: "harmony-lms.firebaseapp.com",
    projectId: "harmony-lms",
    storageBucket: "harmony-lms.firebasestorage.app",
    messagingSenderId: "246508625840",
    appId: "1:246508625840:web:aa5146e7e406d1d5278075",
    measurementId: "G-TE25C4DREY"
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