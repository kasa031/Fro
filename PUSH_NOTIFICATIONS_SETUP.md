# Push Notifications Setup Guide

## Status

✅ **Grunnleggende struktur implementert:**
- NotificationService opprettet
- FCM token-registrering ved innlogging
- Automatisk fjernelse av token ved utlogging
- Lokale varsler (showLocalNotification)

⚠️ **Krever backend-setup:**
- Firebase Cloud Functions for å sende varsler
- VAPID key konfigurasjon
- Service Worker for web push-varsler

---

## Hva er implementert

### 1. NotificationService (`src/services/NotificationService.js`)
- ✅ `initializeMessaging()` - Initialiserer FCM
- ✅ `requestNotificationPermission()` - Spør om tillatelse
- ✅ `registerFCMToken()` - Registrerer token i Firestore
- ✅ `unregisterFCMToken()` - Fjerner token ved utlogging
- ✅ `setupMessageListener()` - Lytter til innkommende meldinger
- ✅ `showLocalNotification()` - Viser lokale varsler

### 2. Automatisk registrering
- ✅ Token registreres automatisk ved innlogging (AuthContext)
- ✅ Token fjernes automatisk ved utlogging
- ✅ Token lagres i Firestore under `users/{userId}.fcmToken`

---

## Hva må settes opp (backend)

### 1. Firebase Cloud Functions

Opprett en Cloud Function for å sende varsler:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Send push notification to users
 * 
 * Usage from client:
 * const sendNotification = httpsCallable(functions, 'sendNotification');
 * await sendNotification({
 *   userIds: ['user1', 'user2'],
 *   title: 'Ny melding',
 *   body: 'Du har mottatt en ny melding',
 *   data: { type: 'message', id: '123' }
 * });
 */
exports.sendNotification = functions.https.onCall(async (data, context) => {
  // Verifiser at brukeren er autentisert
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Brukeren må være autentisert'
    );
  }

  const { userIds, title, body, data: notificationData } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userIds må være en array med minst ett element'
    );
  }

  if (!title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'title og body er påkrevd'
    );
  }

  try {
    // Hent FCM tokens for alle brukere
    const tokens = [];
    const userDocs = await Promise.all(
      userIds.map(userId => admin.firestore().doc(`users/${userId}`).get())
    );

    userDocs.forEach((userDoc, index) => {
      if (userDoc.exists()) {
        const fcmToken = userDoc.data()?.fcmToken;
        if (fcmToken) {
          tokens.push(fcmToken);
        }
      }
    });

    if (tokens.length === 0) {
      return { success: false, message: 'Ingen gyldige tokens funnet' };
    }

    // Send melding til alle tokens
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...notificationData,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // For web
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/icon.png',
          badge: '/badge.png',
        },
      },
    };

    const response = await admin.messaging().sendMulticast({
      tokens: tokens,
      ...message,
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('Feil ved sending av varsel:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Kunne ikke sende varsel',
      error.message
    );
  }
});
```

### 2. VAPID Key Setup

1. Gå til Firebase Console → Project Settings → Cloud Messaging
2. Under "Web configuration", klikk "Generate key pair"
3. Kopier den offentlige nøkkelen
4. Legg til i `.env`:
   ```env
   EXPO_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key-here
   ```

### 3. Service Worker (for web)

Opprett `public/firebase-messaging-sw.js`:

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Ny melding';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png',
    badge: '/badge.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## Bruk i koden

### Sende varsel fra klient (via Cloud Function)

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';

// I en komponent eller funksjon
const sendNotification = async () => {
  try {
    const sendNotificationFn = httpsCallable(functions, 'sendNotification');
    const result = await sendNotificationFn({
      userIds: ['user1', 'user2'],
      title: 'Ny aktivitet',
      body: 'Et nytt aktivitet er registrert for ditt barn',
      data: {
        type: 'activity',
        childId: 'child123',
      },
    });
    console.log('Varsel sendt:', result.data);
  } catch (error) {
    console.error('Feil ved sending av varsel:', error);
  }
};
```

### Vis lokalt varsel

```javascript
import { showLocalNotification } from '../services/NotificationService';

// Vis varsel uten FCM
showLocalNotification(
  'Ny melding',
  'Du har mottatt en ny melding',
  {
    icon: '/icon.png',
    tag: 'message',
  }
);
```

---

## Testing

### Test lokale varsler
1. Åpne appen i nettleser
2. Kall `showLocalNotification()` fra konsollen
3. Verifiser at varsel vises

### Test FCM (krever backend)
1. Sett opp Cloud Functions
2. Konfigurer VAPID key
3. Test ved å kalle `sendNotification` Cloud Function
4. Verifiser at varsel mottas

---

## Notater

- Push-varsler fungerer best på web med Service Worker
- For mobil, vurder å bruke `expo-notifications` i stedet
- FCM tokens oppdateres automatisk ved innlogging
- Tokens fjernes automatisk ved utlogging

---

## Feilsøking

### "FCM ikke tilgjengelig"
- Sjekk at du er på web-plattform
- Sjekk at Service Worker er støttet
- Sjekk at Notification API er støttet

### "Ingen tillatelse for push-varsler"
- Brukeren må gi tillatelse manuelt
- Sjekk nettleser-innstillinger
- Test i Chrome/Edge (best støtte)

### "VAPID key ikke satt"
- Legg til `EXPO_PUBLIC_FIREBASE_VAPID_KEY` i `.env`
- Restart appen etter å ha lagt til nøkkel

