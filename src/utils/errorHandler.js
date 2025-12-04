import { Platform } from 'react-native';

/**
 * Hjelpefunksjoner for håndtering av Firebase-feil
 */

/**
 * Sjekker om en feil skyldes ad-blocker eller permission-problemer
 * @param {Error} error - Feilen som skal sjekkes
 * @returns {boolean} - true hvis feilen skyldes ad-blocker/permission
 */
export function isBlockedOrPermissionError(error) {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Sjekk for ad-blocker feil
  if (errorMessage.includes('blocked') || 
      errorMessage.includes('err_blocked_by_client') ||
      errorCode.includes('blocked')) {
    return true;
  }
  
  // Sjekk for permission-feil (som kan oppstå når Firestore er blokkert)
  if (errorMessage.includes('missing or insufficient permissions') ||
      errorMessage.includes('permission-denied') ||
      errorCode === 'permission-denied' ||
      errorCode === 'permissions') {
    return true;
  }
  
  // Sjekk for timeout-feil (kan også skyldes blokkering)
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('deadline-exceeded') ||
      errorCode === 'deadline-exceeded') {
    return true;
  }
  
  return false;
}

/**
 * Håndterer Firebase-feil på en elegant måte
 * @param {Error} error - Feilen som skal håndteres
 * @param {string} context - Kontekst for feilen (f.eks. "lasting av barn")
 * @param {Object} options - Alternativer for håndtering
 * @param {boolean} options.showAlert - Om alert skal vises (default: true, men ikke for blocked errors)
 * @param {boolean} options.logError - Om feilen skal logges (default: true)
 */
export function handleFirebaseError(error, context = 'operasjon', options = {}) {
  const { showAlert = true, logError = true } = options;
  
  if (logError) {
    console.error(`Feil ved ${context}:`, error);
  }
  
  // Hvis feilen skyldes ad-blocker/permission, ikke vis alert
  if (isBlockedOrPermissionError(error)) {
    if (logError) {
      console.warn(`⚠️ ${context} feilet pga. ad-blocker eller Firestore-blokkering. Dette er forventet på web med ad-blocker aktivert.`);
    }
    return; // Ikke vis alert for disse feilene
  }
  
  // For andre feil, vis alert hvis ønsket
  if (showAlert && typeof window !== 'undefined' && Platform?.OS === 'web') {
    window.alert(`Feil ved ${context}: ${error.message || 'Ukjent feil'}`);
  } else if (showAlert && Platform?.OS !== 'web') {
    // For native, returner melding som kan brukes med Alert.alert
    return error.message || 'Ukjent feil';
  }
  
  return error.message || 'Ukjent feil';
}
