import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { supportedLanguages, getLanguageInfo } from '../i18n/languages';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { serverTimestamp } from 'firebase/firestore';
import { getAvatar } from '../utils/avatarHelper';

/**
 * ParentScreen - Hovedskjerm for foreldre
 * 
 * Funksjoner:
 * - Se egne barn og deres status
 * - Se aktiviteter for egne barn
 * - Se samtykkeskjema for egne barn
 * - Navigere til innstillinger
 * - Dark/light mode støtte
 * - Språkvalg
 * 
 * @component
 */
export default function ParentScreen() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingInOut, setCheckingInOut] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState(new Set()); // Sporer avatarene som har feilet
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedChildForAbsence, setSelectedChildForAbsence] = useState(null);
  const [absenceReason, setAbsenceReason] = useState('');

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      setLoading(true);
      // Hent barn knyttet til denne forelderen
      const childrenRef = collection(db, 'children');
      const q = query(childrenRef, where('parentIds', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);
      
      const childrenList = [];
      querySnapshot.forEach((doc) => {
        childrenList.push({ id: doc.id, ...doc.data() });
      });
      
      setChildren(childrenList);
    } catch (error) {
      console.error('Error loading children:', error);
      if (Platform.OS === 'web') {
        window.alert(t('parent.loadError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('parent.loadError', { error: error.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInOut = async (childId, currentStatus) => {
    setCheckingInOut(true);
    try {
      const newStatus = currentStatus === 'checked_in' ? 'checked_out' : 'checked_in';
      const action = currentStatus === 'checked_in' ? 'check_out' : 'check_in';
      
      await updateDoc(doc(db, 'children', childId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastCheckIn: action === 'check_in' ? serverTimestamp() : null,
        lastCheckOut: action === 'check_out' ? serverTimestamp() : null,
      });

      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: action,
        timestamp: serverTimestamp(),
      });

      const childName = children.find(c => c.id === childId)?.name || 'barnet';
      if (Platform.OS === 'web') {
        window.alert(t('common.success'), action === 'check_in' ? t('admin.childCheckedIn', { name: childName }) : t('admin.childCheckedOut', { name: childName }));
      } else {
        Alert.alert(t('common.success'), action === 'check_in' ? t('admin.childCheckedIn', { name: childName }) : t('admin.childCheckedOut', { name: childName }));
      }
      loadChildren(); // Reload children list
    } catch (error) {
      console.error('Feil ved inn/utkrysning:', error);
      if (Platform.OS === 'web') {
        window.alert(t('parent.updateError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('parent.updateError', { error: error.message }));
      }
    } finally {
      setCheckingInOut(false);
    }
  };

  /**
   * Meld fravær for et barn
   */
  const handleReportAbsence = async () => {
    if (!selectedChildForAbsence) return;
    
    try {
      await updateDoc(doc(db, 'children', selectedChildForAbsence), {
        status: 'sick',
        absenceReason: absenceReason || null,
        absenceReportedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Logg fraværsmelding
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: selectedChildForAbsence,
        userId: user.uid,
        action: 'absence_reported',
        notes: absenceReason || '',
        timestamp: serverTimestamp(),
      });

      const childName = children.find(c => c.id === selectedChildForAbsence)?.name || 'barnet';
      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('parent.absenceReported', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('parent.absenceReported', { name: childName }));
      }
      
      setShowAbsenceModal(false);
      setSelectedChildForAbsence(null);
      setAbsenceReason('');
      loadChildren();
    } catch (error) {
      console.error('Feil ved fraværsmelding:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), t('parent.absenceError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('parent.absenceError', { error: error.message }));
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/nylogocolor.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{t('parent.title')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowOptionsMenu(!showOptionsMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Språkvelger dropdown */}
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
          <View style={styles.languageMenu}>
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

      {/* Options dropdown meny */}
      {showOptionsMenu && (
        <Modal
          visible={showOptionsMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowOptionsMenu(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsMenu(false)}
          >
            <View style={[styles.optionsMenu, isDarkMode && styles.optionsMenuDark]} onStartShouldSetResponder={() => true}>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  setShowOptionsMenu(false);
                  setShowLanguageMenu(true);
                }}
              >
                <Text style={[styles.optionsMenuText, { fontSize: 20, marginRight: 8 }]}>
                  {getLanguageInfo(i18n.language).flag}
                </Text>
                <Text style={[styles.optionsMenuText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {t('settings.language')}: {getLanguageInfo(i18n.language).nativeName}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#9ca3af' : '#6b7280'} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  toggleTheme();
                  setShowOptionsMenu(false);
                }}
              >
                <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.optionsMenuText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  navigation.navigate('Calendar');
                  setShowOptionsMenu(false);
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.optionsMenuText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {t('calendar.title')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  navigation.navigate('Gallery');
                  setShowOptionsMenu(false);
                }}
              >
                <Ionicons name="images-outline" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.optionsMenuText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {t('gallery.title')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  navigation.navigate('Settings');
                  setShowOptionsMenu(false);
                }}
              >
                <Ionicons name="settings-outline" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.optionsMenuText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {t('settings.title')}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: 40, flexGrow: 1 }]}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        <Text style={styles.welcomeText}>{t('parent.welcome')}, {user?.email}</Text>
        <Text style={styles.sectionTitle}>{t('parent.myChildren')} ({children.length})</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : children.length === 0 ? (
          <Text style={styles.emptyText}>{t('parent.noChildren')}</Text>
        ) : (
          <View style={styles.childrenList}>
            {children.map((child) => (
              <View key={child.id} style={styles.childCard}>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('ChildProfile', { childId: child.id })}
                  style={styles.childCardTouchable}
                >
                  <View style={styles.childCardHeader}>
                    <View style={styles.childInfo}>
                      <View style={styles.childInfoRow}>
                        <View style={[styles.childAvatarContainer || { position: 'relative', width: 50, height: 50 }]}>
                          <View style={[styles.childAvatar, { backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0 }]}>
                            <Text style={{ fontSize: 30 }}>👶</Text>
                          </View>
                          {!failedAvatars.has(child.id) && (
                            <Image 
                              source={{ uri: getAvatar(child.imageUrl, child.name, 'child', 200) }} 
                              style={[styles.childAvatar, { position: 'absolute', top: 0, left: 0 }]}
                              onError={() => {
                                console.log('Avatar failed to load for:', child.name);
                                setFailedAvatars(prev => new Set(prev).add(child.id));
                              }}
                            />
                          )}
                        </View>
                        <View style={styles.childNameContainer}>
                          <Text style={styles.childName}>{child.name || 'Ingen navn'}</Text>
                          <Text style={styles.childDepartment}>{child.department || 'Ingen avdeling'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.childDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('admin.status')}:</Text>
                      <Text style={[styles.detailValue, styles.statusBadge, 
                        child.status === 'checked_in' ? styles.statusIn : 
                        child.status === 'checked_out' ? styles.statusOut : 
                        styles.statusNotIn
                      ]}>
                        {child.status === 'checked_in' ? t('admin.present') : 
                         child.status === 'checked_out' ? t('admin.pickedUp') : 
                         t('admin.notCheckedIn')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.checkInOutContainer}>
                  {child.status !== 'checked_in' && child.status !== 'sick' ? (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.checkInButton]} 
                      onPress={() => handleCheckInOut(child.id, child.status)}
                      disabled={checkingInOut}
                    >
                      {checkingInOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>{t('parent.checkIn')}</Text>}
                    </TouchableOpacity>
                  ) : child.status === 'checked_in' ? (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.checkOutButton]} 
                      onPress={() => handleCheckInOut(child.id, child.status)}
                      disabled={checkingInOut}
                    >
                      {checkingInOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>{t('parent.checkOut')}</Text>}
                    </TouchableOpacity>
                  ) : null}
                  {child.status !== 'sick' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.absenceButton]} 
                      onPress={() => {
                        setSelectedChildForAbsence(child.id);
                        setShowAbsenceModal(true);
                      }}
                    >
                      <Ionicons name="medical-outline" size={18} color="#fff" />
                      <Text style={styles.checkButtonText}>{t('parent.reportAbsence')}</Text>
                    </TouchableOpacity>
                  )}
                  {child.status === 'sick' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.clearAbsenceButton]} 
                      onPress={async () => {
                        try {
                          await updateDoc(doc(db, 'children', child.id), {
                            status: 'not_checked_in',
                            absenceReason: null,
                            absenceReportedAt: null,
                            updatedAt: serverTimestamp(),
                          });
                          loadChildren();
                          if (Platform.OS === 'web') {
                            window.alert(t('common.success'), t('parent.absenceCleared'));
                          } else {
                            Alert.alert(t('common.success'), t('parent.absenceCleared'));
                          }
                        } catch (error) {
                          console.error('Feil ved fjerning av fravær:', error);
                          if (Platform.OS === 'web') {
                            window.alert(t('common.error'), error.message);
                          } else {
                            Alert.alert(t('common.error'), error.message);
                          }
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.checkButtonText}>{t('parent.clearAbsence')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal for fraværsmelding */}
      <Modal
        visible={showAbsenceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAbsenceModal(false);
          setSelectedChildForAbsence(null);
          setAbsenceReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.absenceModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parent.reportAbsence')}</Text>
              <TouchableOpacity onPress={() => {
                setShowAbsenceModal(false);
                setSelectedChildForAbsence(null);
                setAbsenceReason('');
              }}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              {t('parent.absenceFor')}: {children.find(c => c.id === selectedChildForAbsence)?.name || ''}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('parent.absenceReason')} ({t('common.optional')})</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('parent.absenceReasonPlaceholder')}
                placeholderTextColor="#9ca3af"
                value={absenceReason}
                onChangeText={setAbsenceReason}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleReportAbsence}
            >
              <Text style={styles.saveBtnText}>{t('parent.reportAbsence')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setShowAbsenceModal(false);
                setSelectedChildForAbsence(null);
                setAbsenceReason('');
              }}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerLogo: { width: 100, height: 100, marginRight: 12, borderRadius: 0 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionsButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  optionsMenu: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 8, 
    minWidth: 240,
    alignSelf: 'flex-end',
    marginTop: 50,
    marginRight: 20,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' } : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 })
  },
  optionsMenuDark: { backgroundColor: '#374151' },
  optionsMenuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 4,
    gap: 12
  },
  optionsMenuText: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
  languageButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  languageButtonText: { fontSize: 18 },
  logoutBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  languageMenu: { backgroundColor: 'white', borderRadius: 12, padding: 8, minWidth: 200, ...(Platform.OS === 'web' ? { boxShadow: '0 0 8px rgba(0, 0, 0, 0.2)' } : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }) },
  languageOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 4 },
  languageOptionActive: { backgroundColor: '#e0e7ff' },
  languageOptionText: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
  content: { padding: 20 },
  welcomeText: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  childrenList: { gap: 12 },
  childCard: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', ...(Platform.OS === 'web' ? { boxShadow: '0 0 4px rgba(0, 0, 0, 0.05)' } : { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) },
  childCardTouchable: { padding: 16 },
  childCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  childInfo: { flex: 1 },
  childInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e5e7eb' },
  childNameContainer: { flex: 1 },
  childName: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  childDepartment: { fontSize: 14, color: '#6b7280' },
  childDetails: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  detailRow: { flexDirection: 'row', marginBottom: 8, flexWrap: 'wrap' },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginRight: 8, minWidth: 80 },
  detailValue: { fontSize: 14, color: '#1f2937', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', fontSize: 12, fontWeight: '600' },
  statusIn: { backgroundColor: '#d1fae5', color: '#065f46' }, // Til stede - grønn
  statusOut: { backgroundColor: '#d1fae5', color: '#065f46' }, // Hentet - grønn
  statusNotIn: { backgroundColor: '#fee2e2', color: '#991b1b' }, // Ikke krysset inn - rød
  statusSick: { backgroundColor: '#fed7aa', color: '#9a3412' }, // Syk - oransj
  emptyText: { textAlign: 'center', color: '#6b7280', marginVertical: 20, fontSize: 16 },
  checkInOutContainer: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 12 },
  checkButton: { padding: 10, borderRadius: 8, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  checkInButton: { backgroundColor: '#10b981' },
  checkOutButton: { backgroundColor: '#ef4444' },
  absenceButton: { backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearAbsenceButton: { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkButtonText: { color: 'white', fontWeight: 'bold' },
  absenceModal: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '90%', maxWidth: 500 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  modalSubtitle: { fontSize: 16, color: '#6b7280', marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  textArea: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#e5e7eb', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
