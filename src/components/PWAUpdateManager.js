import React, { useState, useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/**
 * PWA Update Manager - Håndterer oppdateringer av PWA
 * 
 * Funksjoner:
 * - Detekterer når ny versjon er tilgjengelig
 * - Viser oppdateringsmelding til brukeren
 * - Lar brukeren oppdatere appen
 */
export default function PWAUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Sjekk om service worker er registrert
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      // Lytte til oppdateringer
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Ny versjon er installert og klar
              setUpdateAvailable(true);
              setShowUpdateModal(true);
            }
          });
        }
      });

      // Sjekk om det allerede er en ny versjon klar
      if (reg.waiting) {
        setUpdateAvailable(true);
        setShowUpdateModal(true);
      }
    });

    // Lytte til meldinger fra service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        // Service worker har oppdatert - reload siden
        window.location.reload();
      }
    });

    // Lytte til controllerchange event (når service worker endres)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Reload siden når ny service worker tar over
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      // Send melding til service worker om å hoppe over venting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdateModal(false);
      setUpdateAvailable(false);
      // Siden vil automatisk reload når controllerchange event skjer
    } else {
      // Hvis ingen waiting worker, bare reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdateModal(false);
    // Vis igjen etter 1 time
    setTimeout(() => {
      if (updateAvailable) {
        setShowUpdateModal(true);
      }
    }, 60 * 60 * 1000);
  };

  if (!updateAvailable || !showUpdateModal) {
    return null;
  }

  return (
    <Modal
      visible={showUpdateModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Ionicons name="refresh-circle" size={48} color="#4f46e5" style={styles.icon} />
          <Text style={styles.title}>Ny versjon tilgjengelig</Text>
          <Text style={styles.message}>
            En ny versjon av appen er klar. Oppdater for å få de nyeste funksjonene og forbedringene.
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>Oppdater nå</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Senere</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: '#4f46e5',
  },
  updateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  dismissButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dismissButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 16,
  },
});
