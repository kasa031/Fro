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
          // Sjekk hvilken rolle brukeren har i databasen med timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore timeout - sannsynligvis blokkert')), 3000)
          );
          
          const userDoc = await Promise.race([
            getDoc(doc(db, "users", currentUser.uid)),
            timeoutPromise
          ]);
          
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
            console.log('Rolle hentet fra Firestore:', userDoc.data().role);
          } else {
            // Hvis brukeren eksisterer i Firebase Auth men ikke i Firestore,
            // opprett et dokument med standard rolle 'parent'
            console.log('Bruker mangler i Firestore, oppretter dokument...');
            try {
              await Promise.race([
                setDoc(doc(db, "users", currentUser.uid), {
                  email: currentUser.email || '',
                  name: currentUser.displayName || currentUser.email || 'Bruker',
                  role: 'parent',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }),
                timeoutPromise
              ]);
              setRole('parent');
              console.log('Brukerdokument opprettet i Firestore');
            } catch (createError) {
              console.error('Kunne ikke opprette brukerdokument:', createError);
              // Bruk fallback basert på e-post
              const emailLower = currentUser.email?.toLowerCase() || '';
              if (emailLower.includes('admin') || emailLower === 'admin@barnehagen.no') {
                setRole('admin');
                console.log('✅ Fallback: Bruker admin-rolle basert på e-post');
              } else {
                setRole('parent');
                console.log('✅ Fallback: Bruker parent-rolle');
              }
            }
          }
        } catch (error) {
          console.error("Kunne ikke hente rolle:", error);
          console.error("Error message:", error.message);
          console.error("Error code:", error.code);
          
          // Håndter alle typer Firestore-blokkering
          const isBlocked = error.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
                           error.message?.includes('blocked') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('BLOCKED_BY_CLIENT') ||
                           error.code === 'unavailable' ||
                           error.code === 'deadline-exceeded' ||
                           error.name === 'FirebaseError';
          
          if (isBlocked) {
            console.warn('⚠️ Firestore er blokkert eller utilgjengelig. Bruker fallback-rolle.');
          } else {
            console.warn('⚠️ Firestore-feil. Bruker fallback-rolle.');
          }
          
          // Fallback: Sjekk e-post for å bestemme rolle
          const emailLower = currentUser.email?.toLowerCase() || '';
          if (emailLower.includes('admin') || emailLower === 'admin@barnehagen.no') {
            setRole('admin');
            console.log('✅ Fallback: Bruker admin-rolle basert på e-post');
          } else if (emailLower.includes('ansatt') || emailLower.includes('employee')) {
            setRole('employee');
            console.log('✅ Fallback: Bruker employee-rolle basert på e-post');
          } else {
            setRole('parent');
            console.log('✅ Fallback: Bruker parent-rolle');
          }
        }
        
        // Initialiser push-varsler (kun for web)
        // MERK: Dette feiler stille hvis service worker ikke er tilgjengelig eller Firestore er blokkert
        if (typeof window !== 'undefined' && Platform.OS === 'web') {
          // Kjør asynkront uten å vente - ikke blokker innlogging
          (async () => {
            try {
              await initializeMessaging();
              // Bruk timeout for FCM token-registrering
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('FCM registration timeout')), 5000)
              );
              await Promise.race([
                registerFCMToken(currentUser.uid),
                timeoutPromise
              ]);
              setupMessageListener((payload) => {
                console.log('Push-varsel mottatt:', payload);
              });
            } catch (error) {
              // Ignorer FCM-feil stille - appen skal fungere uten push-varsler
              // Dette inkluderer både service worker-feil og Firestore-blokkering
              const isBlocked = error.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
                               error.message?.includes('blocked') ||
                               error.message?.includes('timeout');
              if (isBlocked) {
                console.log('ℹ️ FCM registrering hoppet over (Firestore blokkert eller timeout)');
              } else {
                console.log('ℹ️ FCM registrering hoppet over (service worker ikke tilgjengelig)');
              }
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
    console.log('🚪 Logger ut bruker:', user?.email);
    
    // Fjern FCM token før utlogging (ikke kast feil hvis dette feiler)
    if (user && typeof window !== 'undefined' && Platform.OS === 'web') {
      // Kjør asynkront uten å vente - ikke blokker utlogging
      unregisterFCMToken(user.uid).catch(() => {
        // Ignorer feil - utlogging skal fortsette uansett
      });
    }
    
    try {
      // Logger ut fra Firebase Auth (dette må alltid fungere)
      await signOut(auth);
      console.log('✅ Utlogging fullført');
    } catch (error) {
      console.error('❌ Feil ved utlogging:', error);
      // Selv om signOut feiler, nullstill bruker og rolle lokalt
      setUser(null);
      setRole(null);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};