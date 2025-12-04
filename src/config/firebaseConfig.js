import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Debug: Sjekk om miljøvariabler er lastet (kun i development)
if (__DEV__ && (!firebaseConfig.apiKey || !firebaseConfig.projectId)) {
  console.error('⚠️ Firebase miljøvariabler mangler!');
  console.log('API Key:', firebaseConfig.apiKey ? '✓' : '✗');
  console.log('Project ID:', firebaseConfig.projectId ? '✓' : '✗');
  console.log('Sjekk at .env-filen eksisterer og har EXPO_PUBLIC_ prefix');
}

const app = initializeApp(firebaseConfig);

// Initialiser Auth med AsyncStorage for persistence (kun for native, ikke web)
let auth;
if (Platform.OS === 'web') {
  // For web, bruk standard getAuth
  auth = getAuth(app);
} else {
  // For native (iOS/Android), bruk initializeAuth med AsyncStorage
  try {
    // Prøv å initialisere med AsyncStorage først
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    // Hvis auth allerede er initialisert (f.eks. i development med hot reload),
    // bruk den eksisterende instansen
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      // For andre feil, prøv getAuth som fallback
      console.warn('Kunne ikke initialisere Auth med AsyncStorage:', error);
      auth = getAuth(app);
    }
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;