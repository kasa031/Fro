import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ActivityIndicator, View } from 'react-native';
import './src/i18n/config'; // Initialiser i18next

import LoginScreen from './src/screens/LoginScreen';
import ParentScreen from './src/screens/ParentScreen';
import EmployeeScreen from './src/screens/EmployeeScreen';
import AdminScreen from './src/screens/AdminScreen';
import ChildProfileScreen from './src/screens/ChildProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import PWAUpdateManager from './src/components/PWAUpdateManager';

const Stack = createStackNavigator();

const AppNavigator = ({ navigationRef }) => {
  const { user, role, loading } = useAuth();
  const { isDarkMode, isLoading: isThemeLoading } = useTheme();

  // Naviger automatisk når rolle endres eller bruker logger ut
  useEffect(() => {
    if (!loading && navigationRef?.current) {
      if (!user) {
        // Bruker har logget ut - naviger til login
        console.log('🔄 Bruker logget ut, navigerer til Login');
        try {
          navigationRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (error) {
          console.error('Navigasjonsfeil ved utlogging:', error);
        }
      } else if (user && role) {
        // Bruker er logget inn - naviger basert på rolle
        console.log('🔄 Navigerer basert på rolle:', role, 'for bruker:', user.email);
        try {
          if (role === 'admin') {
            navigationRef.current.reset({ index: 0, routes: [{ name: 'AdminHome' }] });
          } else if (role === 'employee') {
            navigationRef.current.reset({ index: 0, routes: [{ name: 'EmployeeHome' }] });
          } else if (role === 'parent') {
            navigationRef.current.reset({ index: 0, routes: [{ name: 'ParentHome' }] });
          }
        } catch (error) {
          console.error('Navigasjonsfeil:', error);
        }
      }
    }
  }, [user, role, loading, navigationRef]);

  if (loading || isThemeLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb'}}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  // Bestem initial route basert på brukerstatus
  const getInitialRoute = () => {
    if (!user) return 'Login';
    if (role === 'admin') return 'AdminHome';
    if (role === 'employee') return 'EmployeeHome';
    if (role === 'parent') return 'ParentHome';
    return 'Login'; // Fallback
  };

  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AdminHome" component={AdminScreen} />
      <Stack.Screen name="EmployeeHome" component={EmployeeScreen} />
      <Stack.Screen name="ParentHome" component={ParentScreen} />
      <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
    </Stack.Navigator>
  );
};

export default function App() {
  const navigationRef = React.useRef(null);

  // Registrer service worker for PWA (kun på web) - optimalisert for raskere loading
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Registrer umiddelbart (ikke vent på load event) for raskere oppstart
      const registerSW = () => {
        // Registrer vår PWA service worker (sw.js) - prioritert for caching
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('✅ PWA Service Worker registrert:', registration.scope);
            
            // Sjekk for oppdateringer periodisk (hver time)
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000); // Sjekk hver time
            
            // Sjekk for oppdateringer ved første registrering
            registration.update();
          })
          .catch((error) => {
            console.warn('⚠️ Kunne ikke registrere PWA Service Worker:', error);
          });

        // MERK: Vi registrerer ikke firebase-messaging-sw.js separat
        // FCM håndteres av hoved-service worker (sw.js) eller Firebase SDK
        // Dette unngår konflikter mellom flere service workers
      };

      // Registrer umiddelbart hvis DOM er klar, ellers vent på load
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator navigationRef={navigationRef} />
          <PWAUpdateManager />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}