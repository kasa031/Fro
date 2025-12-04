// Service Worker for PWA - Håndterer både FCM og caching
// Denne filen kombinerer PWA caching med Firebase Messaging

// Last inn Firebase SDK for push-varsler (hvis tilgjengelig)
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
  
  // Firebase konfigurasjon (samme som i firebase-messaging-sw.js)
  const firebaseConfig = {
    apiKey: "AIzaSyCvgps8D8Ms4gI3KTgB4zPJkEfCdk6AW-8",
    authDomain: "eventyrhagen-15b7a.firebaseapp.com",
    projectId: "eventyrhagen-15b7a",
    storageBucket: "eventyrhagen-15b7a.firebasestorage.app",
    messagingSenderId: "162112552936",
    appId: "1:162112552936:web:7c32c74498afd4dd0d6e5d"
  };
  
  // Initialiser Firebase hvis tilgjengelig
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    
    // Håndter bakgrunnsmeldinger
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Bakgrunnsmelding mottatt:', payload);
      const notificationTitle = payload.notification?.title || 'Ny melding';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: payload.notification?.icon || '/icon.png',
        badge: '/icon.png',
        tag: payload.data?.type || 'default',
        requireInteraction: false,
        data: payload.data || {}
      };
      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.log('[SW] Firebase SDK ikke tilgjengelig (dette er OK for caching)');
}

const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `fro-pwa-${CACHE_VERSION}`;
const FCM_CACHE_NAME = 'fcm-cache-v1';
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `dynamic-cache-${CACHE_VERSION}`;

// Assets som skal caches ved installasjon (cache-first) - raskere loading
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/favicon.png',
  // Legg til kritiske assets her hvis nødvendig
];

// Install event - cache statiske assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installert');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching statiske assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch((error) => {
      console.error('[SW] Feil ved caching av statiske assets:', error);
    })
  );
  // Aktiver service worker umiddelbart
  self.skipWaiting();
});

// Activate event - rydd opp i gamle caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker aktivert');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Slett gamle caches (unntatt de vi bruker)
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME && 
              cacheName !== FCM_CACHE_NAME &&
              cacheName !== CACHE_NAME) {
            console.log('[SW] Sletter gammel cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ta kontroll over alle klienter umiddelbart
  return self.clients.claim();
});

// Fetch event - håndter nettverksforespørsler med caching-strategi
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer Firebase og andre eksterne API-kall (de håndteres av FCM service worker)
  if (url.origin.includes('firebase') || 
      url.origin.includes('googleapis') ||
      url.origin.includes('gstatic')) {
    // La disse gå gjennom uten caching (FCM håndterer dem)
    return;
  }

  // Cache-first strategi for statiske assets (HTML, CSS, JS, bilder) - raskere loading
  if (request.method === 'GET' && 
      (request.destination === 'document' ||
       request.destination === 'script' ||
       request.destination === 'style' ||
       request.destination === 'image' ||
       request.destination === 'font')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Returner fra cache umiddelbart hvis tilgjengelig (raskere)
        if (cachedResponse) {
          // I bakgrunnen, sjekk for oppdateringer (stale-while-revalidate)
          fetch(request).then((response) => {
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }).catch(() => {
            // Ignorer nettverksfeil i bakgrunnen
          });
          return cachedResponse;
        }
        // Hvis ikke i cache, hent fra nettverk og cache
        return fetch(request).then((response) => {
          // Bare cache suksessfulle responser
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Hvis nettverk feiler, returner offline fallback
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
  // Network-first strategi for API-kall (Firestore, etc.)
  else if (request.method === 'GET' && request.destination === '') {
    event.respondWith(
      fetch(request).then((response) => {
        // Hvis nettverk fungerer, cache responsen
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Hvis nettverk feiler, prøv cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Hvis ikke i cache, returner offline melding
          return new Response(
            JSON.stringify({ error: 'Offline - ingen tilkobling' }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
              statusText: 'Service Unavailable'
            }
          );
        });
      })
    );
  }
});

// Håndter klikk på push-varsler (hvis Firebase er tilgjengelig)
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Varsel klikket:', event);
  event.notification.close();
  
  // Åpne appen når brukeren klikker på varslet
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Hvis appen allerede er åpen, fokuser på den
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Hvis appen ikke er åpen, åpne den
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Message event - håndter meldinger fra hovedapp
self.addEventListener('message', (event) => {
  console.log('[SW] Melding mottatt:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Hoppe over venting - aktiverer ny service worker umiddelbart');
    self.skipWaiting().then(() => {
      // Send melding til alle klienter om å reload
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    });
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
