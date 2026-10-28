/**
 * AppLock — thin wrapper over expo-local-authentication.
 *
 * Uses whatever the phone offers: fingerprint, face, or the phone's own
 * PIN / pattern / password as a fallback. Messages are patient-facing.
 */

// Loaded defensively: builds made before this module was added don't include
// its native code, and the import would otherwise crash the app.
let LocalAuthentication = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch (e) {
  console.warn('[AppLock] expo-local-authentication is not in this build; app lock is unavailable.');
}

/**
 * Whether the phone has any screen lock the app can ask for.
 * @returns {Promise<{ available: boolean, message?: string }>}
 */
export async function getLockAvailability() {
  if (!LocalAuthentication) {
    return { available: false, message: "App lock needs the latest version of the app. Please update TalkingLabs." };
  }
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      return {
        available: false,
        message: "Your phone doesn't have a screen lock yet. Set up a PIN, pattern, fingerprint or face unlock in your phone's settings first.",
      };
    }
    return { available: true };
  } catch (e) {
    return { available: false, message: "App lock isn't available on this phone." };
  }
}

/**
 * Ask the patient to confirm it's them.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function authenticate(promptMessage) {
  if (!LocalAuthentication) {
    return { success: false, message: "App lock isn't available in this version. Log out and sign in with your password." };
  }
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) return { success: true, message: '' };

    switch (result.error) {
      case 'not_enrolled':
      case 'passcode_not_set':
        return {
          success: false,
          message: "Your phone no longer has a screen lock, so we can't check it's you. Log out and sign in with your password.",
        };
      case 'lockout':
        return { success: false, message: 'Too many attempts. Wait a moment, then try again.' };
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
        return { success: false, message: 'Tap Unlock when you are ready.' };
      default:
        return { success: false, message: "That didn't work. Please try again." };
    }
  } catch (e) {
    return { success: false, message: "That didn't work. Please try again." };
  }
}
