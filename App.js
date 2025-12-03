import React from 'react';
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

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, role, loading } = useAuth();
  const { isDarkMode, isLoading: isThemeLoading } = useTheme();

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
    return 'ParentHome';
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
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}