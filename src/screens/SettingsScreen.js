import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { supportedLanguages, getLanguageInfo } from '../i18n/languages';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebaseConfig';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  updateEmail,
  updateProfile
} from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { requestNotificationPermission, registerFCMToken, unregisterFCMToken } from '../services/NotificationService';

/**
 * SettingsScreen - Innstillingsskjerm for brukere
 * 
 * Funksjoner:
 * - Endre visningsnavn
 * - Endre passord (krever re-autentisering)
 * - Se e-postadresse og rolle
 * - Logge ut
 * 
 * @component
 */
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  
  // Profile update
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [showProfileFields, setShowProfileFields] = useState(false);

  // Fange opp beforeinstallprompt event for PWA-installasjon
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Sjekk om appen allerede er installert
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator && 'standalone' in window.navigator && window.navigator.standalone === true);
      
      if (isInstalled) {
        setDeferredPrompt(null);
        return;
      }

      const handleBeforeInstallPrompt = (e) => {
        // Forhindre at nettleseren viser installasjonsprompt automatisk
        e.preventDefault();
        // Lagre eventet slik at vi kan vise det senere
        setDeferredPrompt(e);
        window.deferredPrompt = e;
        console.log('beforeinstallprompt event fanget opp');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Sjekk om eventet allerede er tilgjengelig (hvis vi kom hit etter at eventet allerede har skjedd)
      if (window.deferredPrompt) {
        setDeferredPrompt(window.deferredPrompt);
      }

      // Cleanup
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('settings.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('settings.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      if (Platform.OS === 'web') {
        window.alert(t('settings.passwordChanged'));
      } else {
        Alert.alert(t('common.success'), t('settings.passwordChanged'));
      }
      
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordFields(false);
    } catch (error) {
      console.error('Feil ved endring av passord:', error);
      let errorMessage = t('settings.passwordChangeError');
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = t('settings.wrongCurrentPassword');
      } else if (error.code === 'auth/weak-password') {
        errorMessage = t('settings.passwordTooWeak');
      }
      
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert(t('common.error'), t('settings.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      // Update display name in Firebase Auth
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim()
      });
      
      // Update name in Firestore users collection
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          name: displayName.trim()
        });
      }
      
      if (Platform.OS === 'web') {
        window.alert(t('settings.profileUpdated'));
      } else {
        Alert.alert(t('common.success'), t('settings.profileUpdated'));
      }
      
      setShowProfileFields(false);
    } catch (error) {
      console.error('Feil ved oppdatering av profil:', error);
      if (Platform.OS === 'web') {
        window.alert(t('settings.profileUpdateError'));
      } else {
        Alert.alert(t('common.error'), t('settings.profileUpdateError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert(t('common.error'), t('settings.invalidEmail'));
      return;
    }

    if (email === user.email) {
      Alert.alert(t('common.error'), t('settings.sameEmail'));
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user (required for email change)
      Alert.alert(
        t('settings.emailChangeRequiresAuth'),
        t('settings.enterCurrentPassword'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.continue'),
            onPress: async () => {
              // This would need a password prompt - simplified for now
              // In production, you'd want a modal with password input
              Alert.alert(t('common.info'), t('settings.emailChangeNotImplemented'));
            }
          }
        ]
      );
    } catch (error) {
      console.error('Feil ved endring av e-post:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dark mode styles
  const themeStyles = {
    container: { ...styles.container, backgroundColor: isDarkMode ? '#1e1b4b' : '#f9fafb' },
    scrollView: { ...styles.scrollView, backgroundColor: isDarkMode ? '#1e1b4b' : '#f9fafb' },
    content: { ...styles.content, backgroundColor: isDarkMode ? '#1e1b4b' : '#f9fafb' },
    header: { ...styles.header },
    title: { ...styles.title, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    section: { ...styles.section, backgroundColor: isDarkMode ? '#312e81' : 'white' },
    sectionTitle: { ...styles.sectionTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    label: { ...styles.label, color: isDarkMode ? '#d1d5db' : '#374151' },
    helpText: { ...styles.helpText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    input: { ...styles.input, backgroundColor: isDarkMode ? '#4c1d95' : 'white', borderColor: isDarkMode ? '#6366f1' : '#d1d5db', color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    infoLabel: { ...styles.infoLabel, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    infoValue: { ...styles.infoValue, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    languageText: { ...styles.languageText, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
  };

  return (
    <SafeAreaView style={themeStyles.container}>
      <ScrollView 
        style={themeStyles.scrollView} 
        contentContainerStyle={themeStyles.content}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        scrollEnabled={true}
        {...(Platform.OS === 'web' ? { 
          style: { flex: 1, height: '100%', backgroundColor: isDarkMode ? '#1e1b4b' : '#f9fafb' },
          contentContainerStyle: { ...themeStyles.content, minHeight: '100%' }
        } : {})}
      >
        <View style={themeStyles.header}>
          <Text style={themeStyles.title}>{t('settings.title')}</Text>
        </View>

        {/* Profile Section */}
        <View style={themeStyles.section}>
          <View style={styles.sectionHeader}>
            <Text style={themeStyles.sectionTitle}>{t('settings.profile')}</Text>
            <TouchableOpacity
              onPress={() => setShowProfileFields(!showProfileFields)}
              style={styles.editButton}
            >
              <Ionicons 
                name={showProfileFields ? "close" : "create-outline"} 
                size={20} 
                color="#4f46e5" 
              />
              <Text style={styles.editButtonText}>
                {showProfileFields ? t('common.cancel') : t('common.edit')}
              </Text>
            </TouchableOpacity>
          </View>

          {showProfileFields ? (
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('settings.displayName')}</Text>
                <TextInput
                  style={themeStyles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('settings.displayNamePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('settings.email')}</Text>
                <TextInput
                  style={[themeStyles.input, styles.disabledInput, { backgroundColor: isDarkMode ? '#4c1d95' : '#f3f4f6' }]}
                  value={email}
                  editable={false}
                  placeholder={t('settings.email')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <Text style={themeStyles.helpText}>{t('settings.emailChangeInfo')}</Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('settings.saveChanges')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={themeStyles.infoLabel}>{t('settings.displayName')}:</Text>
                <Text style={themeStyles.infoValue}>{user?.displayName || user?.name || t('settings.noName')}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={themeStyles.infoLabel}>{t('settings.email')}:</Text>
                <Text style={themeStyles.infoValue}>{user?.email}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Password Section */}
        <View style={themeStyles.section}>
          <View style={styles.sectionHeader}>
            <Text style={themeStyles.sectionTitle}>{t('settings.password')}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowPasswordFields(!showPasswordFields);
                if (showPasswordFields) {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
              style={styles.editButton}
            >
              <Ionicons 
                name={showPasswordFields ? "close" : "lock-closed-outline"} 
                size={20} 
                color="#4f46e5" 
              />
              <Text style={styles.editButtonText}>
                {showPasswordFields ? t('common.cancel') : t('settings.changePassword')}
              </Text>
            </TouchableOpacity>
          </View>

          {showPasswordFields && (
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('settings.currentPassword')}</Text>
                <TextInput
                  style={themeStyles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('settings.newPassword')}</Text>
                <TextInput
                  style={themeStyles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('settings.newPasswordPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  secureTextEntry
                />
                <Text style={themeStyles.helpText}>{t('settings.passwordRequirements')}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('settings.confirmPassword')}</Text>
                <TextInput
                  style={themeStyles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('settings.changePassword')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Appearance Section */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceInfo}>
              <Text style={themeStyles.label}>{t('settings.theme')}</Text>
              <Text style={themeStyles.helpText}>{t('settings.themeDescription')}</Text>
            </View>
            <View style={styles.themeSelector}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  !isDarkMode && styles.themeOptionActive
                ]}
                onPress={() => {
                  console.log('Lys tema valgt');
                  setTheme('light');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="sunny" size={24} color={!isDarkMode ? "#4f46e5" : "#6b7280"} />
                <Text style={[
                  styles.themeOptionText,
                  !isDarkMode && styles.themeOptionTextActive
                ]}>
                  {t('settings.light')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  isDarkMode && styles.themeOptionActive
                ]}
                onPress={() => {
                  console.log('Mørk tema valgt');
                  setTheme('dark');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="moon" size={24} color={isDarkMode ? "#4f46e5" : "#6b7280"} />
                <Text style={[
                  styles.themeOptionText,
                  isDarkMode && styles.themeOptionTextActive
                ]}>
                  {t('settings.dark')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>{t('settings.language')}</Text>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setShowLanguageMenu(true)}
          >
            <View style={styles.languageButtonContent}>
              <Text style={styles.languageFlag}>{getLanguageInfo(i18n.language).flag}</Text>
              <Text style={themeStyles.languageText}>
                {getLanguageInfo(i18n.language).nativeName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* PWA Install Section (Web only) */}
        {Platform.OS === 'web' && (
          <View style={themeStyles.section}>
            <Text style={themeStyles.sectionTitle}>{t('settings.installApp')}</Text>
            <Text style={themeStyles.helpText}>{t('pwa.installDescription')}</Text>
            {(() => {
              const isInstalled = typeof window !== 'undefined' && 
                (window.matchMedia('(display-mode: standalone)').matches || 
                 (window.navigator && 'standalone' in window.navigator && window.navigator.standalone === true));
              const hasPrompt = deferredPrompt || (typeof window !== 'undefined' && window.deferredPrompt);
              
              if (isInstalled) {
                return (
                  <View style={styles.installStatusContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.installStatusText}>Appen er allerede installert</Text>
                  </View>
                );
              }
              
              return (
                <View>
                  <TouchableOpacity
                    style={[styles.installButton, !hasPrompt && styles.installButtonDisabled]}
                    onPress={() => {
                      const prompt = deferredPrompt || (typeof window !== 'undefined' && window.deferredPrompt);
                      if (prompt) {
                        prompt.prompt();
                        prompt.userChoice.then((choiceResult) => {
                          if (choiceResult.outcome === 'accepted') {
                            if (Platform.OS === 'web') {
                              window.alert(t('pwa.installSuccess'));
                            } else {
                              Alert.alert(t('common.success'), t('pwa.installSuccess'));
                            }
                          }
                          setDeferredPrompt(null);
                          if (typeof window !== 'undefined') {
                            window.deferredPrompt = null;
                          }
                        });
                      } else {
                        if (Platform.OS === 'web') {
                          window.alert(t('pwa.installNotAvailable') + '\n\nPrøv å oppdatere siden eller vent litt før du prøver igjen.');
                        } else {
                          Alert.alert(t('common.info'), t('pwa.installNotAvailable'));
                        }
                      }
                    }}
                    disabled={!hasPrompt}
                  >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.installButtonText}>{t('pwa.addToHomeScreen')}</Text>
                  </TouchableOpacity>
                  {!hasPrompt && (
                    <Text style={styles.helpText}>
                      Knappen blir aktiv når nettleseren tilbyr installasjon. Prøv å oppdatere siden eller vent litt.
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Account Actions */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>{t('settings.accountActions')}</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={() => {
              Alert.alert(
                t('auth.logout'),
                t('settings.logoutConfirm'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('auth.logout'),
                    style: 'destructive',
                    onPress: logout
                  }
                ]
              );
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageMenu(false)}
        >
          <View style={[styles.languageMenu, isDarkMode && styles.languageMenuDark]}>
            {supportedLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.languageOption, i18n.language === lang.code && styles.languageOptionActive]}
                onPress={() => {
                  i18n.changeLanguage(lang.code);
                  setShowLanguageMenu(false);
                }}
              >
                <Text style={styles.languageOptionText}>
                  {lang.flag} {lang.nativeName}
                </Text>
                {i18n.language === lang.code && <Ionicons name="checkmark" size={20} color="#4f46e5" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}),
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%', overflowY: 'auto' } : {}),
  },
  content: {
    padding: 20,
    paddingBottom: 80,
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  editButtonText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  formSection: {
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  appearanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  appearanceInfo: {
    flex: 1,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  themeOptionActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  themeOptionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  themeOptionTextActive: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  languageButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  installButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  installButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  installStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    marginTop: 12,
  },
  installStatusText: {
    color: '#065f46',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 8px rgba(0, 0, 0, 0.2)' } : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }),
  },
  languageMenuDark: {
    backgroundColor: '#374151',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageOptionActive: {
    backgroundColor: '#eef2ff',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
});

