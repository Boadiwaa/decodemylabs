import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ModelProvider } from './src/context/ModelContext';
import LandingScreen from './src/screens/LandingScreen';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import DemographicsScreen from './src/screens/DemographicsScreen';
import MedicalHistoryScreen from './src/screens/MedicalHistoryScreen';
import DrugHistoryScreen from './src/screens/DrugHistoryScreen';
import TabNavigator from './src/navigation/TabNavigator';
import Toast from './src/components/Toast';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color="#2BB5A8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F4FAFA' },
          animation: 'slide_from_right',
        }}
      >
        {isAuthenticated && !needsOnboarding ? (
          /* Fully authenticated — go to tabs */
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ animation: 'fade' }}
          />
        ) : isAuthenticated && needsOnboarding ? (
          /* Authenticated patient who hasn't completed onboarding */
          <>
            <Stack.Screen
              name="Demographics"
              component={DemographicsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="MedicalHistory"
              component={MedicalHistoryScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="DrugHistory"
              component={DrugHistoryScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          /* Not authenticated — show onboarding + auth flow */
          <>
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen
              name="RoleSelect"
              component={RoleSelectScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <ModelProvider>
            <AppNavigator />
            <Toast />
          </ModelProvider>
          <StatusBar style="dark" />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FAFA',
  },
});
