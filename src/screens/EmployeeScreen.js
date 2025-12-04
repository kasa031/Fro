import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
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
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { serverTimestamp } from 'firebase/firestore';
import { getAvatar } from '../utils/avatarHelper';

/**
 * EmployeeScreen - Hovedskjerm for ansatte
 * 
 * Funksjoner:
 * - Se alle barn i sin avdeling
 * - Se aktiviteter for barn i sin avdeling
 * - Navigere til innstillinger
 * - Dark/light mode støtte
 * - Språkvalg
 * 
 * @component
 */
export default function EmployeeScreen() {
  const { logout, user, role } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [checkingInOut, setCheckingInOut] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState(new Set()); // Sporer avatarene som har feilet
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  useEffect(() => {
    if (user?.uid && role === 'employee') {
      loadChildren();
    }
  }, [user, role]);

  const loadChildren = async () => {
    setLoadingChildren(true);
    try {
      // Get employee's department from their user document
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const employeeDepartment = userDocSnap.data()?.department;

      if (!employeeDepartment) {
        console.warn('Employee has no department assigned.');
        setChildren([]);
        return;
      }

      const childrenRef = collection(db, 'children');
      const q = query(childrenRef, where('department', '==', employeeDepartment));
      const querySnapshot = await getDocs(q);
      
      const childrenList = [];
      querySnapshot.forEach((doc) => {
        childrenList.push({ id: doc.id, ...doc.data() });
      });
      
      setChildren(childrenList);
    } catch (error) {
      console.error('Error loading children for employee:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved lasting av barn: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke laste barn: ${error.message}`);
      }
    } finally {
      setLoadingChildren(false);
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
        window.alert(t('employee.updateError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('employee.updateError', { error: error.message }));
      }
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleMarkSick = async (childId, childName) => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        status: 'sick',
        updatedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'marked_sick',
        timestamp: serverTimestamp(),
      });
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childMarkedSick', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('admin.childMarkedSick', { name: childName }));
      }
      
      loadChildren();
    } catch (error) {
      console.error('Feil ved markering som syk:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved markering som syk: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke markere som syk: ${error.message}`);
      }
    }
  };

  const handleClearSick = async (childId, childName) => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        status: 'not_checked_in',
        absenceReason: null,
        absenceReportedAt: null,
        updatedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'sick_cleared',
        timestamp: serverTimestamp(),
      });
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.sickCleared', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('admin.sickCleared', { name: childName }));
      }
      
      loadChildren();
    } catch (error) {
      console.error('Feil ved fjerning av syk-status:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved fjerning av syk-status: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke fjerne syk-status: ${error.message}`);
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
          <Text style={styles.headerTitle}>{t('employee.title')}</Text>
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
        <Text style={styles.welcomeText}>{t('employee.welcome')}, {user?.email}</Text>
        <Text style={styles.sectionTitle}>{t('employee.myChildren')} ({children.length})</Text>
        
        {loadingChildren ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : children.length === 0 ? (
          <Text style={styles.emptyText}>{t('employee.noChildren')}</Text>
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
                    {child.allergies && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('admin.allergies')}:</Text>
                        <Text style={styles.detailValue}>{child.allergies}</Text>
                      </View>
                    )}
                    {child.notes && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('admin.notes')}:</Text>
                        <Text style={styles.detailValue}>{child.notes}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.checkInOutContainer}>
                  {child.status !== 'checked_in' && child.status !== 'sick' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.checkInButton]} 
                      onPress={() => handleCheckInOut(child.id, child.status)}
                      disabled={checkingInOut}
                    >
                      {checkingInOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>{t('employee.checkIn')}</Text>}
                    </TouchableOpacity>
                  )}
                  {child.status === 'checked_in' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.checkOutButton]} 
                      onPress={() => handleCheckInOut(child.id, child.status)}
                      disabled={checkingInOut}
                    >
                      {checkingInOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>{t('employee.checkOut')}</Text>}
                    </TouchableOpacity>
                  )}
                  {child.status !== 'sick' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.sickButton]} 
                      onPress={() => handleMarkSick(child.id, child.name || 'barnet')}
                    >
                      <Ionicons name="medical" size={18} color="white" style={{ marginRight: 6 }} />
                      <Text style={styles.checkButtonText}>{t('admin.markSick')}</Text>
                    </TouchableOpacity>
                  )}
                  {child.status === 'sick' && (
                    <TouchableOpacity 
                      style={[styles.checkButton, styles.clearSickButton]} 
                      onPress={() => handleClearSick(child.id, child.name || 'barnet')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="white" style={{ marginRight: 6 }} />
                      <Text style={styles.checkButtonText}>{t('admin.clearSick')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  sickButton: { backgroundColor: '#f59e0b' },
  clearSickButton: { backgroundColor: '#10b981' },
  checkButtonText: { color: 'white', fontWeight: 'bold' },
});
