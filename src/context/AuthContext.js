import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { initializeMessaging, registerFCMToken, unregisterFCMToken, setupMessageListener } from '../services/NotificationService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin', 'employee', eller 'parent'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Sjekk hvilken rolle brukeren har i databasen
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            // Hvis brukeren eksisterer i Firebase Auth men ikke i Firestore,
            // opprett et dokument med standard rolle 'parent'
            console.log('Bruker mangler i Firestore, oppretter dokument...');
            try {
              await setDoc(doc(db, "users", currentUser.uid), {
                email: currentUser.email || '',
                name: currentUser.displayName || currentUser.email || 'Bruker',
                role: 'parent',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              setRole('parent');
              console.log('Brukerdokument opprettet i Firestore');
            } catch (createError) {
              console.error('Kunne ikke opprette brukerdokument:', createError);
              setRole('parent'); // Fallback
            }
          }
        } catch (error) {
          console.error("Kunne ikke hente rolle:", error);
          
          // Håndter ERR_BLOCKED_BY_CLIENT (ad-blocker blokkerer Firestore)
          if (error.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
              error.message?.includes('blocked') ||
              error.code === 'unavailable') {
            console.warn('⚠️ Firestore er blokkert (sannsynligvis ad-blocker). Bruker fallback-rolle.');
            
            // Fallback: Sjekk e-post for å bestemme rolle
            const email = currentUser.email?.toLowerCase() || '';
            if (email.includes('admin') || email === 'admin@barnehagen.no') {
              setRole('admin');
              console.log('Fallback: Bruker admin-rolle basert på e-post');
            } else {
              setRole('parent'); // Standard fallback
              console.log('Fallback: Bruker parent-rolle');
            }
          } else {
            setRole('parent'); // Standard fallback for andre feil
          }
        }
        
        // Initialiser push-varsler (kun for web)
        // MERK: Dette feiler stille hvis service worker ikke er tilgjengelig
        if (typeof window !== 'undefined' && Platform.OS === 'web') {
          // Kjør asynkront uten å vente - ikke blokker innlogging
          (async () => {
            try {
              await initializeMessaging();
              await registerFCMToken(currentUser.uid);
              setupMessageListener((payload) => {
                console.log('Push-varsel mottatt:', payload);
              });
            } catch (error) {
              // Ignorer FCM-feil stille - appen skal fungere uten push-varsler
              // Feilene vises kun i development console
            }
          })();
        }
      } else {
        setUser(null);
        setRole(null);
        
        // Fjern FCM token ved utlogging (hvis bruker var logget inn)
        // Dette håndteres i logout-funksjonen i stedet
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    // Fjern FCM token før utlogging
    if (user && typeof window !== 'undefined' && Platform.OS === 'web') {
      try {
        await unregisterFCMToken(user.uid);
      } catch (error) {
        console.error('Feil ved fjerning av FCM token:', error);
      }
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};