import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from '../services/PatientStorage';
import { hashPassword, verifyPassword } from '../utils/helpers';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = '@talkinglabs_user';
const USERS_STORAGE_KEY = '@talkinglabs_users';

/**
 * Demo patient ID mapping — when a patient registers,
 * they are assigned mock patient ID 1 (John Doe) for the demo.
 * In production, this would come from a real database.
 */
const DEMO_PATIENT_ID = 1;

/** Strip credential fields before a user record is kept as the session. */
function toSessionUser(storedUser) {
  const { password, passwordHash, passwordSalt, passwordIterations, ...sessionUser } = storedUser;
  return sessionUser;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storedProfile, setStoredProfile] = useState(null);

  // Check for stored session on app launch
  useEffect(() => {
    loadStoredUser();
  }, []);

  // Load stored demographics whenever user changes
  useEffect(() => {
    if (user?.id) {
      getProfile(user.id).then((profile) => {
        setStoredProfile(profile || null);
      }).catch(() => setStoredProfile(null));
    } else {
      setStoredProfile(null);
    }
  }, [user?.id]);

  const loadStoredUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load stored user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  /** Persist the current session user to AsyncStorage */
  const _persistSession = async (sessionUser) => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  /** Update a stored user in the users list */
  const _updateUserInList = async (userId, patch) => {
    const raw = await AsyncStorage.getItem(USERS_STORAGE_KEY);
    const users = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...patch };
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  };

  /**
   * Register a new user.
   * For patient accounts, onboardingComplete defaults to false
   * so the app shows Demographics → MedicalHistory → DrugHistory.
   */
  const register = useCallback(async (userData) => {
    try {
      const existingRaw = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      const existingUsers = existingRaw ? JSON.parse(existingRaw) : [];

      if (existingUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return { success: false, message: 'An account with this email already exists.' };
      }

      const credentials = await hashPassword(userData.password);

      const newUser = {
        id: Date.now().toString(),
        role: 'patient',
        fullName: userData.fullName,
        email: userData.email.toLowerCase(),
        ...credentials,
        phone: userData.phone || null,
        patientId: DEMO_PATIENT_ID,
        onboardingComplete: false,
        createdAt: new Date().toISOString(),
      };

      existingUsers.push(newUser);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(existingUsers));

      await _persistSession(toSessionUser(newUser));

      return { success: true };
    } catch (e) {
      console.warn('Registration failed:', e);
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  }, []);

  /**
   * Log in an existing user.
   */
  const login = useCallback(async (email, password) => {
    try {
      const existingRaw = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      const existingUsers = existingRaw ? JSON.parse(existingRaw) : [];

      const found = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!found || !(await verifyPassword(password, found))) {
        return { success: false, message: 'Invalid email or password.' };
      }

      // Upgrade accounts created before passwords were hashed.
      if (typeof found.password === 'string') {
        const credentials = await hashPassword(password);
        await _updateUserInList(found.id, { ...credentials, password: undefined });
      }

      await _persistSession(toSessionUser(found));

      return { success: true };
    } catch (e) {
      console.warn('Login failed:', e);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }, []);

  /**
   * Mark patient onboarding as complete.
   * Called from the last onboarding screen (DrugHistory).
   */
  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    const updated = { ...user, onboardingComplete: true };
    await _persistSession(updated);
    await _updateUserInList(user.id, { onboardingComplete: true });
  }, [user]);

  /**
   * Update arbitrary fields on the current user's session.
   */
  const updateUser = useCallback(async (patch) => {
    if (!user) return;
    const updated = { ...user, ...patch };
    await _persistSession(updated);
    await _updateUserInList(user.id, patch);
  }, [user]);

  /**
   * Log out the current user.
   */
  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
    } catch (e) {
      console.warn('Logout failed:', e);
    }
  }, []);

  const isAuthenticated = !!user;
  const isPatientUser = true;
  const currentPatientId = user?.patientId || null;
  const needsOnboarding = isAuthenticated && !user?.onboardingComplete;

  /**
   * For patient users, overlay their real identity + stored demographics onto the mock patient.
   * Uses stored profile (from DemographicsScreen) for DOB, gender, and description.
   */
  const getPatientProfile = useCallback((mockPatient) => {
    if (!mockPatient) return mockPatient;
    if (!isPatientUser || !user) return mockPatient;
    if (mockPatient.id !== currentPatientId) return mockPatient;

    const nameParts = user.fullName?.trim().split(/\s+/) || [];
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : (nameParts[0]?.[0] || '').toUpperCase();

    // Use stored demographics, falling back to mock data
    const dob = storedProfile?.dob || mockPatient.dob;
    const gender = storedProfile?.sex || mockPatient.gender;

    // Build profile description from stored data
    let profileDesc = mockPatient.profile_description;
    if (storedProfile) {
      const parts = [];
      if (storedProfile.race) parts.push(storedProfile.race);
      if (storedProfile.nationality) parts.push(`from ${storedProfile.nationality}`);
      if (storedProfile.residence) parts.push(`living in ${storedProfile.residence}`);
      if (parts.length > 0) profileDesc = parts.join(', ') + '.';
    }

    return {
      ...mockPatient,
      name: user.fullName,
      initials,
      dob,
      gender,
      profile_description: profileDesc,
    };
  }, [user, isPatientUser, currentPatientId, storedProfile]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      isPatientUser,
      currentPatientId,
      needsOnboarding,
      getPatientProfile,
      register,
      login,
      logout,
      completeOnboarding,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
