import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/Authcontext';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import ParentScreen from './src/screens/ParentScreen';
import EmployeeScreen from './src/screens/EmployeeScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        // Ikke innlogget
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : role === 'admin' ? (
        // Admin
        <Stack.Screen name="AdminHome" component={AdminScreen} />
      ) : role === 'employee' ? (
        // Ansatt
        <Stack.Screen name="EmployeeHome" component={EmployeeScreen} />
      ) : (
        // Foresatte (Standard fallback)
        <Stack.Screen name="ParentHome" component={ParentScreen} />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}