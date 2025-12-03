import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * CalendarScreen - Kalender med viktige datoer
 * 
 * Funksjoner:
 * - Se alle kalenderhendelser
 * - Legge til nye hendelser (foreldremøte, turdag, etc.)
 * - Slette hendelser (kun admin)
 * - Filtrere hendelser etter type
 * 
 * @component
 */
export default function CalendarScreen() {
  const { user, role } = useAuth();
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState('parent_meeting');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadEvents();
  }, []);

  /**
   * Henter alle kalenderhendelser fra Firestore
   */
  const loadEvents = async () => {
    try {
      setLoading(true);
      const eventsRef = collection(db, 'calendarEvents');
      const q = query(eventsRef, orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const eventsList = [];
      querySnapshot.forEach((doc) => {
        eventsList.push({ id: doc.id, ...doc.data() });
      });
      
      setEvents(eventsList);
    } catch (error) {
      console.error('Feil ved lasting av kalenderhendelser:', error);
      if (Platform.OS === 'web') {
        window.alert(t('calendar.loadError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('calendar.loadError', { error: error.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Legger til en ny kalenderhendelse
   */
  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate.trim()) {
      Alert.alert(t('common.error'), t('calendar.titleAndDateRequired'));
      return;
    }

    try {
      await addDoc(collection(db, 'calendarEvents'), {
        title: newEventTitle.trim(),
        description: newEventDescription.trim() || null,
        date: newEventDate,
        eventType: newEventType,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('calendar.eventAdded'));
      } else {
        Alert.alert(t('common.success'), t('calendar.eventAdded'));
      }

      setShowAddModal(false);
      setNewEventTitle('');
      setNewEventDescription('');
      setNewEventDate('');
      setNewEventType('parent_meeting');
      loadEvents();
    } catch (error) {
      console.error('Feil ved opprettelse av hendelse:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), t('calendar.addError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('calendar.addError', { error: error.message }));
      }
    }
  };

  /**
   * Åpner bekreftelsesmodal for sletting
   */
  const handleDeleteClick = (eventId, eventTitle) => {
    if (role !== 'admin') {
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), t('calendar.onlyAdminCanDelete'));
      } else {
        Alert.alert(t('common.error'), t('calendar.onlyAdminCanDelete'));
      }
      return;
    }
    setEventToDelete({ id: eventId, title: eventTitle });
    setShowDeleteModal(true);
  };

  /**
   * Sletter en kalenderhendelse (kun admin)
   */
  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      await deleteDoc(doc(db, 'calendarEvents', eventToDelete.id));
      setShowDeleteModal(false);
      setEventToDelete(null);
      loadEvents();
      if (Platform.OS === 'web') {
        window.alert(t('calendar.eventDeleted'));
      } else {
        Alert.alert(t('common.success'), t('calendar.eventDeleted'));
      }
    } catch (error) {
      console.error('Feil ved sletting av hendelse:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error') + ': ' + error.message);
      } else {
        Alert.alert(t('common.error'), error.message);
      }
    }
  };

  /**
   * Formaterer dato for visning
   */
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('no-NO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  /**
   * Filtrerer hendelser basert på type
   */
  const filteredEvents = filterType === 'all' 
    ? events 
    : events.filter(event => event.eventType === filterType);

  // Sorter etter dato (nærmeste først)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  // Dark mode styles
  const themeStyles = {
    container: { ...styles.container, backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb' },
    content: { ...styles.content, backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb' },
    filterButton: { ...styles.filterButton, backgroundColor: isDarkMode ? '#374151' : 'white', borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' },
    filterButtonText: { ...styles.filterButtonText, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    eventCard: { ...styles.eventCard, backgroundColor: isDarkMode ? '#374151' : 'white', borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' },
    eventTitle: { ...styles.eventTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    eventDate: { ...styles.eventDate, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    eventDescription: { ...styles.eventDescription, color: isDarkMode ? '#d1d5db' : '#374151' },
    emptyText: { ...styles.emptyText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    modal: { ...styles.modal, backgroundColor: isDarkMode ? '#374151' : 'white' },
    modalTitle: { ...styles.modalTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    label: { ...styles.label, color: isDarkMode ? '#d1d5db' : '#374151' },
    input: { ...styles.input, backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderColor: isDarkMode ? '#6b7280' : '#d1d5db', color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    helperText: { ...styles.helperText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    typeButton: { ...styles.typeButton, borderColor: isDarkMode ? '#4b5563' : '#d1d5db', backgroundColor: isDarkMode ? '#374151' : 'transparent' },
    typeButtonText: { ...styles.typeButtonText, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    cancelButton: { ...styles.cancelButton, backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb' },
    cancelButtonText: { ...styles.cancelButtonText, color: isDarkMode ? '#f3f4f6' : '#374151' },
  };

  return (
    <SafeAreaView style={themeStyles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('calendar.title')}</Text>
        </View>
        {(role === 'admin' || role === 'employee') && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={themeStyles.content}>
        {/* Filter buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[themeStyles.filterButton, filterType === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[themeStyles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
              {t('calendar.all')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themeStyles.filterButton, filterType === 'parent_meeting' && styles.filterButtonActive]}
            onPress={() => setFilterType('parent_meeting')}
          >
            <Text style={[themeStyles.filterButtonText, filterType === 'parent_meeting' && styles.filterButtonTextActive]}>
              {t('calendar.parentMeeting')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themeStyles.filterButton, filterType === 'field_trip' && styles.filterButtonActive]}
            onPress={() => setFilterType('field_trip')}
          >
            <Text style={[themeStyles.filterButtonText, filterType === 'field_trip' && styles.filterButtonTextActive]}>
              {t('calendar.fieldTrip')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themeStyles.filterButton, filterType === 'other' && styles.filterButtonActive]}
            onPress={() => setFilterType('other')}
          >
            <Text style={[themeStyles.filterButtonText, filterType === 'other' && styles.filterButtonTextActive]}>
              {t('calendar.other')}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : sortedEvents.length === 0 ? (
          <Text style={themeStyles.emptyText}>{t('calendar.noEvents')}</Text>
        ) : (
          <View style={styles.eventsList}>
            {sortedEvents.map((event) => (
              <View key={event.id} style={themeStyles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <Text style={themeStyles.eventTitle}>{event.title}</Text>
                    <Text style={themeStyles.eventDate}>{formatDate(event.date)}</Text>
                    <View style={styles.eventTypeBadge}>
                      <Text style={styles.eventTypeText}>
                        {event.eventType === 'parent_meeting' ? t('calendar.parentMeeting') :
                         event.eventType === 'field_trip' ? t('calendar.fieldTrip') :
                         t('calendar.other')}
                      </Text>
                    </View>
                  </View>
                  {role === 'admin' && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteClick(event.id, event.title)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                {event.description && (
                  <Text style={themeStyles.eventDescription}>{event.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal for å legge til hendelse */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setNewEventTitle('');
          setNewEventDescription('');
          setNewEventDate('');
          setNewEventType('parent_meeting');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={themeStyles.modal}>
            <View style={styles.modalHeader}>
              <Text style={themeStyles.modalTitle}>{t('calendar.addEvent')}</Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false);
                setNewEventTitle('');
                setNewEventDescription('');
                setNewEventDate('');
                setNewEventType('parent_meeting');
              }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('calendar.eventTitle')} *</Text>
                <TextInput
                  style={themeStyles.input}
                  placeholder={t('calendar.titlePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#9ca3af'}
                  value={newEventTitle}
                  onChangeText={setNewEventTitle}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('calendar.eventDate')} *</Text>
                <TextInput
                  style={themeStyles.input}
                  placeholder={t('calendar.datePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#9ca3af'}
                  value={newEventDate}
                  onChangeText={setNewEventDate}
                />
                <Text style={themeStyles.helperText}>{t('calendar.dateFormat')}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('calendar.eventType')}</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[themeStyles.typeButton, newEventType === 'parent_meeting' && styles.typeButtonActive]}
                    onPress={() => setNewEventType('parent_meeting')}
                  >
                    <Text style={[themeStyles.typeButtonText, newEventType === 'parent_meeting' && styles.typeButtonTextActive]}>
                      {t('calendar.parentMeeting')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[themeStyles.typeButton, newEventType === 'field_trip' && styles.typeButtonActive]}
                    onPress={() => setNewEventType('field_trip')}
                  >
                    <Text style={[themeStyles.typeButtonText, newEventType === 'field_trip' && styles.typeButtonTextActive]}>
                      {t('calendar.fieldTrip')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[themeStyles.typeButton, newEventType === 'other' && styles.typeButtonActive]}
                    onPress={() => setNewEventType('other')}
                  >
                    <Text style={[themeStyles.typeButtonText, newEventType === 'other' && styles.typeButtonTextActive]}>
                      {t('calendar.other')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('calendar.description')} ({t('common.optional')})</Text>
                <TextInput
                  style={[themeStyles.input, styles.textArea]}
                  placeholder={t('calendar.descriptionPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#9ca3af'}
                  value={newEventDescription}
                  onChangeText={setNewEventDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleAddEvent}>
                <Text style={styles.saveButtonText}>{t('calendar.addEvent')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={themeStyles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewEventTitle('');
                  setNewEventDescription('');
                  setNewEventDate('');
                  setNewEventType('parent_meeting');
                }}
              >
                <Text style={themeStyles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal for bekreftelse av sletting */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setEventToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[themeStyles.modal, { maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={themeStyles.modalTitle}>{t('calendar.deleteConfirm')}</Text>
              <TouchableOpacity onPress={() => {
                setShowDeleteModal(false);
                setEventToDelete(null);
              }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>
            <Text style={[themeStyles.eventDescription, { marginBottom: 20 }]}>
              {t('calendar.deleteMessage', { title: eventToDelete?.title || '' })}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, { marginRight: 8 }]}
                onPress={handleDeleteEvent}
              >
                <Text style={styles.deleteConfirmButtonText}>{t('common.delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themeStyles.cancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setEventToDelete(null);
                }}
              >
                <Text style={themeStyles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#111827',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { marginRight: 12 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  addButton: { padding: 8 },
  content: { flex: 1, padding: 20 },
  filterContainer: { flexDirection: 'row', marginBottom: 20, gap: 8, flexWrap: 'wrap' },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  filterButtonText: { color: '#6b7280', fontWeight: '500' },
  filterButtonTextActive: { color: 'white' },
  eventsList: { gap: 12 },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 4px rgba(0, 0, 0, 0.05)' } : { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }),
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  eventDate: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
  },
  eventTypeText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  deleteButton: { padding: 8 },
  eventDescription: { fontSize: 14, color: '#374151', marginTop: 8, lineHeight: 20 },
  emptyText: { textAlign: 'center', color: '#6b7280', marginVertical: 40, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  modalContent: { maxHeight: 500 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  typeButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    minWidth: 100,
  },
  typeButtonActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  typeButtonText: { color: '#6b7280', fontWeight: '500' },
  typeButtonTextActive: { color: '#4f46e5', fontWeight: 'bold' },
  saveButton: { backgroundColor: '#059669', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#e5e7eb', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  deleteConfirmButton: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8, alignItems: 'center', flex: 1 },
  deleteConfirmButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

