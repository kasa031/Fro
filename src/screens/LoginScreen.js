import { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard, Pressable } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

/**
 * LoginScreen - Innloggingsskjerm
 * 
 * Funksjoner:
 * - Innlogging med e-post og passord
 * - PWA-installasjon (for web)
 * - Automatisk språkdeteksjon
 * 
 * @component
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpName, setSignUpName] = useState('');
  const { login } = useAuth();
  const { t } = useTranslation();
  const passwordInputRef = useRef(null);

  useEffect(() => {
    // Sjekk om appen allerede er installert (standalone mode)
    const isStandalone = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
      }
      return false;
    };

    // Hvis appen allerede er installert, ikke vis knappen
    if (isStandalone()) {
      setShowInstallButton(false);
      return;
    }

    // For web - håndter beforeinstallprompt event (forbedret PWA install prompt)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = (e) => {
        // Forhindre at standard prompt vises automatisk
        e.preventDefault();
        // Lagre event for senere bruk
        setDeferredPrompt(e);
        setShowInstallButton(true);
        console.log('📱 PWA install prompt tilgjengelig');
      };

      window.addEventListener('beforeinstallprompt', handler);
      
      // Håndter appinstalled event
      const installedHandler = () => {
        console.log('✅ PWA installert');
        setDeferredPrompt(null);
        setShowInstallButton(false);
        // Vis suksessmelding
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Appen er installert! Du kan nå åpne den fra hjemmeskjermen.');
        }
      };
      window.addEventListener('appinstalled', installedHandler);

      // Sjekk periodisk om install prompt er tilgjengelig (hvis den ikke kom automatisk)
      const checkInterval = setInterval(() => {
        if (!showInstallButton && !isStandalone()) {
          // Prøv å trigge install prompt hvis den ikke har kommet
          // Dette hjelper på nettlesere som ikke trigger beforeinstallprompt umiddelbart
        }
      }, 5000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('appinstalled', installedHandler);
        clearInterval(checkInterval);
      };
    }
  }, []);

  const handleLogin = async () => {
    try {
      console.log('=== handleLogin START ===');
      console.log('Email:', email);
      console.log('Password length:', password?.length || 0);
      
      // Lukk keyboard
      Keyboard.dismiss();
      
      if(!email || !password) {
        console.log('Mangler email eller password');
        Alert.alert(t('common.error'), t('auth.fillAllFields'));
        return;
      }
      
      setLoading(true);
      console.log('Prøver å logge inn med:', email);
      console.log('Firebase config check:', {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ? '✓' : '✗',
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ? '✓' : '✗'
      });
      
      await login(email, password);
      console.log('Innlogging vellykket');
    } catch (error) {
      console.error('=== INNLOGGINGSFEIL ===');
      console.error('Error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = t('auth.checkCredentials');
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ugyldig e-postadresse';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Bruker ikke funnet. Opprett en bruker først.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Feil passord';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Nettverksfeil. Sjekk internettforbindelsen.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Ugyldig e-post eller passord';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(t('auth.loginFailed'), errorMessage);
    } finally {
      setLoading(false);
      console.log('=== handleLogin FERDIG ===');
    }
  };

  // Validerer passord mot Firebase-krav
  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Passord må være minst 6 tegn';
    }
    // Sjekk om passordet inneholder minst ett ikke-alfanumerisk tegn (spesialtegn)
    if (!/[^a-zA-Z0-9]/.test(password)) {
      return 'Passord må inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?)';
    }
    return null; // Passordet er gyldig
  };

  const handleSignUp = async () => {
    if(!email || !password || !signUpName) {
      Alert.alert(t('common.error'), 'Alle felt må fylles ut');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert(t('common.error'), passwordError);
      return;
    }
    setLoading(true);
    try {
      console.log('Prøver å opprette bruker:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      // Opprett brukerdokument i Firestore med userId som dokument-ID
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email.trim().toLowerCase(),
        name: signUpName.trim(),
        role: 'parent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Bruker opprettet i Firestore med ID:', userCredential.user.uid);
      Alert.alert('Suksess', 'Bruker opprettet! Du er nå logget inn.');
      setShowSignUp(false);
      setSignUpName('');
    } catch (error) {
      console.error('Registreringsfeil:', error);
      let errorMessage = 'Kunne ikke opprette bruker';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'E-postadressen er allerede i bruk. Logg inn i stedet.';
      } else if (error.code === 'permission-denied' || error.message?.includes('insufficient') || error.message?.includes('authority')) {
        errorMessage = 'Manglende tilgang. Kontakt administrator for å opprette bruker.';
        console.error('Firebase Security Rules feil:', error);
      } else if (error.code === 'auth/weak-password' || error.message?.includes('password') || error.message?.includes('requirements')) {
        errorMessage = 'Passordet oppfyller ikke kravene. Passord må være minst 6 tegn og inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?).';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ugyldig e-postadresse';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Feil', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    // Hvis beforeinstallprompt er tilgjengelig (Chrome/Edge på Android/Desktop)
    if (deferredPrompt) {
      try {
        // Vis installasjonsprompt
        deferredPrompt.prompt();

        // Vent på brukerens svar
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
          console.log('Brukeren aksepterte installasjonsprompt');
        } else {
          console.log('Brukeren avviste installasjonsprompt');
        }

        // Nullstill deferredPrompt
        setDeferredPrompt(null);
        setShowInstallButton(false);
      } catch (error) {
        console.error('Feil ved installasjon:', error);
      }
    } else {
      // For iOS og andre nettlesere - vis instruksjoner
      const isIOS = Platform.OS === 'ios' || 
        (Platform.OS === 'web' && typeof navigator !== 'undefined' && 
         /iPad|iPhone|iPod/.test(navigator.userAgent));

      if (isIOS) {
        Alert.alert(
          t('pwa.addToHomeScreen'),
          t('pwa.iosInstructions'),
          [{ text: t('common.ok') }]
        );
      } else {
        // Android eller andre nettlesere
        Alert.alert(
          t('pwa.addToHomeScreen'),
          t('pwa.androidInstructions'),
          [{ text: t('common.ok') }]
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.card}>
          <Image 
            source={require('../../assets/nylogocolor.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>{t('auth.loginToContinue')}</Text>
          
          {Platform.OS === 'web' ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (showSignUp) {
                  handleSignUp();
                } else {
                  handleLogin();
                }
              }}
              style={{ width: '100%' }}
            >
              <TextInput 
                placeholder={t('auth.email')} 
                style={styles.input} 
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                }}
              />
              <TextInput 
                ref={passwordInputRef}
                placeholder={t('auth.password')} 
                style={styles.input} 
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={showSignUp ? handleSignUp : handleLogin}
              />
              {showSignUp && (
                <>
                  <TextInput 
                    placeholder="Navn" 
                    style={styles.input} 
                    value={signUpName}
                    onChangeText={setSignUpName}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                  <Text style={styles.helpText}>
                    {'Passord må være minst 6 tegn og inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?)'}
                  </Text>
                </>
              )}
            </form>
          ) : (
            <>
              <TextInput 
                placeholder={t('auth.email')} 
                style={styles.input} 
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                }}
              />
              <TextInput 
                ref={passwordInputRef}
                placeholder={t('auth.password')} 
                style={styles.input} 
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={showSignUp ? handleSignUp : handleLogin}
              />
              {showSignUp && (
                <>
                  <TextInput 
                    placeholder="Navn" 
                    style={styles.input} 
                    value={signUpName}
                    onChangeText={setSignUpName}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                  <Text style={styles.helpText}>
                    {'Passord må være minst 6 tegn og inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?)'}
                  </Text>
                </>
              )}
            </>
          )}

          <Pressable 
            style={({ pressed }) => [
              styles.button, 
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed
            ]} 
            onPress={() => {
              try {
                console.log('=== KNAPP TRYKKET ===');
                console.log('showSignUp:', showSignUp);
                console.log('loading:', loading);
                console.log('email:', email);
                console.log('password length:', password?.length || 0);
                
                // Lukk keyboard først
                Keyboard.dismiss();
                
                if (loading) {
                  console.log('Knappen er disabled (loading)');
                  return;
                }
                
                if (showSignUp) {
                  console.log('Kaller handleSignUp');
                  handleSignUp();
                } else {
                  console.log('Kaller handleLogin');
                  handleLogin();
                }
              } catch (error) {
                console.error('=== FEIL I ONPRESS ===');
                console.error('Error:', error);
                Alert.alert('Feil', 'Noe gikk galt. Prøv igjen.');
              }
            }} 
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>{showSignUp ? 'Opprett bruker' : t('auth.login')}</Text>
            )}
          </Pressable>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => {
              setShowSignUp(!showSignUp);
              setSignUpName('');
            }}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.linkText}>
              {showSignUp ? 'Har du allerede en bruker? Logg inn' : 'Ingen bruker? Opprett en her'}
            </Text>
          </TouchableOpacity>

          {/* "Legg til på hjemmeskjermen" knapp - for alle plattformer */}
          {showInstallButton && (
            <TouchableOpacity style={styles.installButton} onPress={handleInstallClick}>
              <Text style={styles.installButtonText}>📱 {t('pwa.addToHomeScreen')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#4f46e5'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%'
  },
  card: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: Platform.OS === 'web' ? 24 : 20, 
    elevation: 5, 
    alignItems: 'center',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    alignSelf: 'center',
    // Responsiv padding for mobile
    ...(Platform.OS !== 'web' && { paddingHorizontal: 16 })
  },
  logo: { 
    width: Platform.OS === 'web' ? 300 : 250, 
    height: Platform.OS === 'web' ? 300 : 250, 
    marginBottom: 16, 
    borderRadius: 0,
    // Responsiv størrelse for små skjermer
    maxWidth: '100%',
    maxHeight: '40%'
  },
  subtitle: { 
    textAlign: 'center', 
    color: '#6b7280', 
    marginBottom: 24, 
    fontSize: 16 
  },
  input: { 
    backgroundColor: '#f3f4f6', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    fontSize: 16, 
    width: '100%',
    minHeight: 50
  },
  button: { 
    backgroundColor: '#4f46e5', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 8, 
    width: '100%',
    minHeight: 50,
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }]
  },
  btnText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  installButton: { 
    backgroundColor: '#10b981', 
    padding: 12, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 12, 
    width: '100%',
    borderWidth: 1,
    borderColor: '#059669'
  },
  installButtonText: { 
    color: 'white', 
    fontWeight: '600', 
    fontSize: 14 
  },
  linkButton: {
    marginTop: 12,
    padding: 8,
  },
  linkText: {
    color: '#4f46e5',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline'
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -8,
    marginBottom: 12,
    textAlign: 'left',
    width: '100%',
    paddingHorizontal: 4
  }
});