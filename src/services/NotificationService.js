import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * NotificationService - Håndterer push-varsler via Firebase Cloud Messaging (FCM)
 * 
 * Funksjoner:
 * - Registrerer FCM token for bruker
 * - Lytter til innkommende meldinger
 * - Sender varsler ved viktige hendelser
 * 
 * @module NotificationService
 */

let messaging = null;
let notificationPermission = null;

/**
 * Initialiserer Firebase Cloud Messaging (kun for web)
 */
export const initializeMessaging = async () => {
  // Kun for web
  if (typeof window === 'undefined') {
    return null;
  }

  // I development, hopp over FCM hvis service worker ikke er tilgjengelig
  if (__DEV__) {
    // Sjekk om service worker-filen eksisterer først
    try {
      const response = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' });
      if (!response.ok) {
        console.log('⚠️ Service Worker ikke tilgjengelig i development. FCM deaktivert.');
        return null;
      }
    } catch (error) {
      console.log('⚠️ Service Worker ikke tilgjengelig i development. FCM deaktivert.');
      return null;
    }
  }

  try {
    // Sjekk om Service Worker er støttet
    if ('serviceWorker' in navigator && 'Notification' in window) {
      messaging = getMessaging();
      return messaging;
    } else {
      console.log('Service Worker eller Notification API ikke støttet');
      return null;
    }
  } catch (error) {
    console.error('Feil ved initialisering av FCM:', error);
    return null;
  }
};

/**
 * Spør om tillatelse for push-varsler
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Notifications ikke støttet i denne nettleseren');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    notificationPermission = await Notification.requestPermission();
    return notificationPermission === 'granted';
  }

  return false;
};

/**
 * Registrerer FCM token for bruker
 */
export const registerFCMToken = async (userId) => {
  // I development, hopp over FCM hvis service worker ikke er tilgjengelig
  if (__DEV__) {
    try {
      const response = await fetch('/firebase-messaging-sw.js', { method: 'HEAD' });
      if (!response.ok) {
        // Service worker ikke tilgjengelig - deaktiver FCM stille
        return null;
      }
    } catch (error) {
      // Service worker ikke tilgjengelig - deaktiver FCM stille
      return null;
    }
  }

  if (!messaging) {
    await initializeMessaging();
  }

  if (!messaging) {
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    // Hent VAPID key fra miljøvariabler (må settes opp i Firebase Console)
    const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    
    if (token) {
      // Lagre token i Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokenUpdatedAt: new Date(),
      });
      console.log('FCM token registrert');
      return token;
    }
    return null;
  } catch (error) {
    // Håndter 401 Unauthorized feil (VAPID key ikke riktig konfigurert)
    if (error.code === 'messaging/invalid-vapid-key' || 
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized')) {
      if (__DEV__) {
        // I development, ignorer stille - dette er forventet hvis VAPID key ikke er konfigurert
        return null;
      }
      console.warn('⚠️ FCM VAPID key ikke riktig konfigurert. Sjekk Firebase Console → Cloud Messaging → Web Push certificates.');
      return null;
    }
    
    // Håndter spesifikk feil for manglende service worker stille
    if (error.code === 'messaging/failed-service-worker-registration' || 
        error.message?.includes('service worker') ||
        error.message?.includes('404')) {
      // Service worker ikke tilgjengelig - ignorer stille i development
      if (__DEV__) {
        return null;
      }
      console.warn('⚠️ Service Worker ikke funnet. Sjekk at public/firebase-messaging-sw.js eksisterer og har riktig Firebase-konfigurasjon.');
      return null;
    }
    
    // Ignorer alle FCM-feil stille (både development og production)
    // FCM er valgfritt - appen skal fungere uten push-notifikasjoner
    if (__DEV__) {
      // I development, log kun hvis det er en uventet feil
      if (!error.message?.includes('push service') && 
          !error.message?.includes('Registration failed') &&
          !error.code) {
        console.log('FCM ikke tilgjengelig (forventet i development)');
      }
      return null;
    }
    // I production, ignorer også stille - ikke forstyrr brukeropplevelsen
    return null;
  }
};

/**
 * Fjerner FCM token for bruker
 * Håndterer Firestore-blokkering elegant - feiler stille hvis Firestore er blokkert
 */
export const unregisterFCMToken = async (userId) => {
  if (!userId) {
    return;
  }

  try {
    // Timeout for Firestore-operasjon (3 sekunder)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 3000)
    );

    const userRef = doc(db, 'users', userId);
    await Promise.race([
      updateDoc(userRef, {
        fcmToken: null,
        fcmTokenUpdatedAt: null,
      }),
      timeoutPromise
    ]);
    
    console.log('✅ FCM token fjernet');
  } catch (error) {
    // Sjekk om feilen skyldes ad-blocker eller Firestore-blokkering
    const isBlocked = error.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
                     error.message?.includes('blocked') ||
                     error.message?.includes('timeout') ||
                     error.message?.includes('BLOCKED_BY_CLIENT') ||
                     error.code === 'unavailable' ||
                     error.code === 'permission-denied' ||
                     error.code === 'deadline-exceeded';
    
    if (isBlocked) {
      // Firestore er blokkert - dette er OK, vi fortsetter med utlogging
      console.log('ℹ️ FCM token-fjerning hoppet over (Firestore blokkert)');
    } else {
      // Annet feil - logg men ikke kast feil
      console.warn('⚠️ FCM token-fjerning feilet (ikke kritisk):', error.message);
    }
    // Ikke kast feil - utlogging skal fortsette uansett
  }
};

/**
 * Lytter til innkommende meldinger (kun for web)
 */
export const setupMessageListener = (callback) => {
  if (!messaging) {
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('Melding mottatt:', payload);
    
    // Vis varsel i nettleseren
    if (Notification.permission === 'granted') {
      const notificationTitle = payload.notification?.title || 'Ny melding';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        tag: payload.data?.type || 'default',
        requireInteraction: false,
      };

      new Notification(notificationTitle, notificationOptions);
    }

    // Kall callback hvis gitt
    if (callback) {
      callback(payload);
    }
  });
};

/**
 * Hjelpefunksjon for å sende varsel til brukere
 * (Kalles fra backend/Cloud Functions, ikke direkte fra klient)
 * 
 * For å sende varsler, må du sette opp Firebase Cloud Functions.
 * Se `PUSH_NOTIFICATIONS_SETUP.md` for detaljert guide.
 * 
 * @param {string[]} userIds - Array med user IDs som skal motta varsel
 * @param {string} title - Tittel på varslet
 * @param {string} body - Meldingstekst
 * @param {object} data - Ekstra data for varslet
 * @returns {Promise<void>}
 */
export const sendNotificationToUsers = async (userIds, title, body, data = {}) => {
  // Dette må kalles fra backend/Cloud Functions
  // Se dokumentasjon over for implementering
  console.log('sendNotificationToUsers må kalles fra backend/Cloud Functions');
  console.log('Brukere:', userIds);
  console.log('Tittel:', title);
  console.log('Body:', body);
  console.log('Data:', data);
};

/**
 * Viser et lokalt varsel (uten FCM)
 */
export const showLocalNotification = (title, body, options = {}) => {
  if (!('Notification' in window)) {
    console.log('Notifications ikke støttet');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: options.icon || '/icon.png',
      badge: options.badge || '/badge.png',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
    });
  } else if (Notification.permission !== 'denied') {
    // Spør om tillatelse
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: options.icon || '/icon.png',
          badge: options.badge || '/badge.png',
          tag: options.tag || 'default',
        });
      }
    });
  }
};

export default {
  initializeMessaging,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  setupMessageListener,
  sendNotificationToUsers,
  showLocalNotification,
};

