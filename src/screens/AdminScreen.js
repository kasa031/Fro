import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { supportedLanguages, getLanguageInfo } from '../i18n/languages';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
  Modal
} from 'react-native';
import { db, storage, auth } from '../config/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getAvatar } from '../utils/avatarHelper';
import { handleFirebaseError } from '../utils/errorHandler';

/**
 * AdminScreen - Hovedskjerm for administratorer
 * 
 * Funksjoner:
 * - Registrere nye barn
 * - Knytte foreldre til barn
 * - Check-in/check-out for barn
 * - Aktivitetsregistrering (bleieskift, spesielle hendelser)
 * - Brukeradministrasjon (opprett, endre rolle, slett)
 * - Søk etter barn
 * - Dark/light mode toggle
 * - Språkvalg
 * - Sidebar navigasjon
 * 
 * @component
 */
export default function AdminScreen() {
  const { logout, user, role } = useAuth();
  const navigation = useNavigation();
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [avdeling, setAvdeling] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [guardianEmails, setGuardianEmails] = useState([]);
  const [childImage, setChildImage] = useState(null);
  const [imageUri, setImageUri] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { isDarkMode } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Brukeradministrasjon
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('employee');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  
  // Avdelingsadministrasjon
  const [showDepartmentManagement, setShowDepartmentManagement] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [showChildDepartmentDropdown, setShowChildDepartmentDropdown] = useState(false);
  
  // Ansatte-visning
  const [showEmployees, setShowEmployees] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeePhone, setEmployeePhone] = useState('');
  
  // Visning for kombinert Barn & Avdelinger
  const [showChildrenAndDepartments, setShowChildrenAndDepartments] = useState(true);
  
  // Dashboard modal for å vise barna i ulike kategorier
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState(null); // 'all', 'present', 'notCheckedIn', 'sick'
  
  // Aktivitetsregistrering
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityNotes, setActivityNotes] = useState('');
  const [activityType, setActivityType] = useState('special_event');
  const [activityTarget, setActivityTarget] = useState('child'); // 'child' eller 'department'
  const [selectedChildForActivity, setSelectedChildForActivity] = useState(null);
  const [selectedDepartmentForActivity, setSelectedDepartmentForActivity] = useState('');
  const [allActivities, setAllActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [failedAvatars, setFailedAvatars] = useState(new Set()); // Sporer avatarene som har feilet

  /**
   * Legger til en e-postadresse til listen over foresatte
   * Validerer at e-posten er gyldig og ikke allerede i listen
   */
  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email.includes('@') && !guardianEmails.includes(email)) {
      setGuardianEmails([...guardianEmails, email]);
      setEmailInput('');
    } else {
      Alert.alert(t('common.error'), t('userManagement.invalidEmail'));
    }
  };

  /**
   * Fjerner en e-postadresse fra listen over foresatte
   * @param {string} email - E-postadressen som skal fjernes
   */
  const removeEmail = (email) => {
    setGuardianEmails(guardianEmails.filter(e => e !== email));
  };

  /**
   * Komprimerer et bilde før opplasting til Firebase Storage
   * For web: bruker Canvas API for å redusere filstørrelse
   * For mobile: returnerer filen som den er (kan forbedres med expo-image-manipulator)
   * @param {File} file - Bildet som skal komprimeres
   * @returns {Promise<File>} Komprimert bilde
   */
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'web') {
        // For mobile, returner filen som den er (komprimering kan legges til senere med expo-image-manipulator)
        resolve(file);
        return;
      }
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        // For web, bruk document.createElement('img') i stedet for new Image()
        const img = document.createElement('img');
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          // Beregn ny størrelse
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Kunne ikke komprimere bilde'));
              }
            },
            'image/jpeg',
            0.7 // Kvalitet 70%
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  // Hent alle barn
  useEffect(() => {
    loadChildren();
    loadAllActivities();
  }, []);

  // Hent alle brukere når brukeradministrasjon vises
  useEffect(() => {
    if (showUserManagement) {
      loadUsers();
    }
  }, [showUserManagement]);

  // Hent alle ansatte når ansatte-visning åpnes
  useEffect(() => {
    if (showEmployees) {
      loadEmployees();
      loadDepartments(); // Last avdelinger for dropdown
    }
  }, [showEmployees]);

  // Hent alle avdelinger når komponenten lastes og bruker er autentisert
  useEffect(() => {
    if (user) {
      loadDepartments();
    }
  }, [user]);

  // Hent alle avdelinger når bruker- eller barn-skjema åpnes
  useEffect(() => {
    if ((showUserManagement || showForm) && user) {
      loadDepartments();
    }
  }, [showUserManagement, showForm, user]);

  // Last inn avdelinger
  const loadDepartments = async () => {
    // Sjekk at brukeren er autentisert først
    if (!user) {
      console.warn('Kan ikke laste avdelinger: bruker ikke autentisert');
      return;
    }

    try {
      setLoadingDepartments(true);
      const departmentsRef = collection(db, 'departments');
      const departmentsSnapshot = await getDocs(departmentsRef);
      const departmentsList = [];
      departmentsSnapshot.forEach((doc) => {
        departmentsList.push({ id: doc.id, ...doc.data() });
      });
      setDepartments(departmentsList);
    } catch (error) {
      const errorMessage = handleFirebaseError(error, 'lasting av avdelinger', { showAlert: true, logError: true });
      if (errorMessage && Platform.OS !== 'web') {
        Alert.alert('Feil', 'Kunne ikke laste avdelinger: ' + errorMessage);
      }
    } finally {
      setLoadingDepartments(false);
    }
  };

  // Opprett ny avdeling
  const handleCreateDepartment = async () => {
    if (!newDepartmentName.trim()) {
      Alert.alert('Mangler info', 'Avdelingsnavn må fylles ut.');
      return;
    }

    try {
      setLoading(true);
      
      // Sjekk for duplikater
      const departmentsRef = collection(db, 'departments');
      const duplicateQuery = query(departmentsRef, where('name', '==', newDepartmentName.trim()));
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (!duplicateSnapshot.empty) {
        Alert.alert('Duplikat funnet', `Avdelingen "${newDepartmentName}" finnes allerede.`);
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'departments'), {
        name: newDepartmentName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Suksess', `Avdeling "${newDepartmentName}" ble opprettet.`);
      setNewDepartmentName('');
      loadDepartments();
    } catch (error) {
      console.error('Feil ved opprettelse av avdeling:', error);
      Alert.alert('Feil', `Kunne ikke opprette avdeling: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Slett avdeling
  const handleDeleteDepartment = async (departmentId, departmentName) => {
    // Sjekk om det er barn i avdelingen
    const childrenRef = collection(db, 'children');
    const departmentQuery = query(childrenRef, where('department', '==', departmentName));
    const snapshot = await getDocs(departmentQuery);
    
    if (!snapshot.empty) {
      Alert.alert(
        'Kan ikke slette',
        `Avdelingen "${departmentName}" kan ikke slettes fordi det er ${snapshot.size} barn knyttet til den. Flytt eller slett barna først.`
      );
      return;
    }

    // Sjekk om det er ansatte i avdelingen
    const usersRef = collection(db, 'users');
    const employeesQuery = query(usersRef, where('department', '==', departmentName), where('role', '==', 'employee'));
    const employeesSnapshot = await getDocs(employeesQuery);
    
    if (!employeesSnapshot.empty) {
      Alert.alert(
        'Kan ikke slette',
        `Avdelingen "${departmentName}" kan ikke slettes fordi det er ${employeesSnapshot.size} ansatt(e) knyttet til den. Endre eller slett ansatte først.`
      );
      return;
    }

    if (Platform.OS === 'web') {
      if (!window.confirm(`Er du sikker på at du vil slette avdelingen "${departmentName}"?`)) {
        return;
      }
    } else {
      Alert.alert(
        'Slett avdeling',
        `Er du sikker på at du vil slette avdelingen "${departmentName}"?`,
        [
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Slett', style: 'destructive', onPress: async () => {
            try {
              await deleteDoc(doc(db, 'departments', departmentId));
              Alert.alert('Suksess', 'Avdeling ble slettet.');
              loadDepartments();
            } catch (error) {
              console.error('Feil ved sletting av avdeling:', error);
              Alert.alert('Feil', `Kunne ikke slette avdeling: ${error.message}`);
            }
          }}
        ]
      );
      return;
    }

    try {
      await deleteDoc(doc(db, 'departments', departmentId));
      Alert.alert('Suksess', 'Avdeling ble slettet.');
      loadDepartments();
    } catch (error) {
      console.error('Feil ved sletting av avdeling:', error);
      Alert.alert('Feil', `Kunne ikke slette avdeling: ${error.message}`);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersList);
    } catch (error) {
      const errorMessage = handleFirebaseError(error, 'lasting av brukere', { showAlert: true, logError: true });
      if (errorMessage && Platform.OS !== 'web') {
        Alert.alert(t('common.error'), t('userManagement.errorLoadingUsers'));
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  // Last alle ansatte
  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const usersRef = collection(db, 'users');
      const employeesQuery = query(usersRef, where('role', '==', 'employee'));
      const employeesSnapshot = await getDocs(employeesQuery);
      const employeesList = [];
      employeesSnapshot.forEach((doc) => {
        employeesList.push({ id: doc.id, ...doc.data() });
      });
      setEmployees(employeesList);
    } catch (error) {
      const errorMessage = handleFirebaseError(error, 'lasting av ansatte', { showAlert: true, logError: true });
      if (errorMessage && Platform.OS !== 'web') {
        Alert.alert('Feil', `Kunne ikke laste ansatte: ${errorMessage}`);
      }
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Oppdater ansatt-status (til stede/borte)
  const handleUpdateEmployeeStatus = async (employeeId, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', employeeId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await loadEmployees();
      if (Platform.OS === 'web') {
        window.alert('Status oppdatert');
      } else {
        Alert.alert('Suksess', 'Status oppdatert');
      }
    } catch (error) {
      console.error('Feil ved oppdatering av status:', error);
      Alert.alert('Feil', 'Kunne ikke oppdatere status');
    }
  };

  // Oppdater ansatt-avdeling
  const handleUpdateEmployeeDepartment = async (employeeId, newDepartment) => {
    try {
      await updateDoc(doc(db, 'users', employeeId), {
        department: newDepartment,
        updatedAt: serverTimestamp(),
      });
      await loadEmployees();
      if (Platform.OS === 'web') {
        window.alert('Avdeling oppdatert');
      } else {
        Alert.alert('Suksess', 'Avdeling oppdatert');
      }
    } catch (error) {
      console.error('Feil ved oppdatering av avdeling:', error);
      Alert.alert('Feil', 'Kunne ikke oppdatere avdeling');
    }
  };

  // Oppdater ansatt telefon
  const handleUpdateEmployeePhone = async (employeeId, phone) => {
    try {
      await updateDoc(doc(db, 'users', employeeId), {
        phone: phone,
        updatedAt: serverTimestamp(),
      });
      await loadEmployees();
      if (Platform.OS === 'web') {
        window.alert('Telefonnummer oppdatert');
      } else {
        Alert.alert('Suksess', 'Telefonnummer oppdatert');
      }
    } catch (error) {
      console.error('Feil ved oppdatering av telefon:', error);
      Alert.alert('Feil', 'Kunne ikke oppdatere telefonnummer');
    }
  };

  // Slett ansatt
  const handleDeleteEmployee = async (employeeId, employeeName) => {
    const confirmMessage = `Er du sikker på at du vil slette ${employeeName}? Dette kan ikke angres.`;
    
    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      Alert.alert('Slett ansatt', confirmMessage, [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', employeeId));
              await loadEmployees();
              Alert.alert('Suksess', 'Ansatt slettet');
            } catch (error) {
              console.error('Feil ved sletting av ansatt:', error);
              Alert.alert('Feil', 'Kunne ikke slette ansatt');
            }
          },
        },
      ]);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', employeeId));
      await loadEmployees();
      window.alert('Ansatt slettet');
    } catch (error) {
      console.error('Feil ved sletting av ansatt:', error);
      window.alert('Kunne ikke slette ansatt');
    }
  };

  // Validerer passord mot Firebase-krav
  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Passord må være minst 6 tegn';
    }
    // Sjekk om passordet inneholder minst ett ikke-alfanumerisk tegn (spesialtegn)
    if (!/[^a-zA-Z0-9]/.test(password)) {
      return 'Passord må inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?)';
    }
    return null; // Passordet er gyldig
  };

  /**
   * Oppretter en ny bruker i Firebase Authentication og Firestore
   * Validerer at alle felt er utfylt og at rolle er gyldig
   * @param {string} newUserEmail - E-postadresse for ny bruker
   * @param {string} newUserPassword - Passord for ny bruker
   * @param {string} newUserRole - Rolle: 'employee' eller 'parent'
   * @param {string} newUserDepartment - Avdeling (kun for ansatte)
   */
  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserName.trim()) {
      Alert.alert(t('common.error'), t('userManagement.allFieldsRequired'));
      return;
    }

    if (newUserRole === 'employee' && !newUserDepartment.trim()) {
      Alert.alert(t('common.error'), t('userManagement.employeeNeedsDepartment'));
      return;
    }

    if (newUserRole === 'admin') {
      Alert.alert(t('common.error'), t('userManagement.cannotCreateAdmin'));
      return;
    }

    const passwordError = validatePassword(newUserPassword);
    if (passwordError) {
      Alert.alert(t('common.error'), passwordError);
      return;
    }

    setLoading(true);
    try {
      // Opprett bruker i Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUserEmail.trim().toLowerCase(),
        newUserPassword
      );

      // Opprett brukerdokument i Firestore
      await addDoc(collection(db, 'users'), {
        email: newUserEmail.trim().toLowerCase(),
        name: newUserName.trim(),
        role: newUserRole,
        department: newUserRole === 'employee' ? newUserDepartment.trim() : null,
        phone: newUserRole === 'employee' && employeePhone ? employeePhone.trim() : null,
        status: newUserRole === 'employee' ? 'not_present' : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Nullstill skjema
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserDepartment('');
      setNewUserRole('employee');
      setEmployeePhone('');

      // Oppdater brukerliste
      await loadUsers();
      if (newUserRole === 'employee') {
        await loadEmployees();
      }

      if (Platform.OS === 'web') {
        window.alert(t('userManagement.userCreated', { role: newUserRole === 'employee' ? t('userManagement.employee') : t('userManagement.parent') }));
      } else {
        Alert.alert(t('common.success'), t('userManagement.userCreated', { role: newUserRole === 'employee' ? t('userManagement.employee') : t('userManagement.parent') }));
      }
    } catch (error) {
      console.error('Feil ved opprettelse av bruker:', error);
      let errorMessage = 'Kunne ikke opprette bruker.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = t('userManagement.emailAlreadyInUse');
      } else if (error.code === 'auth/weak-password' || error.message?.includes('password') || error.message?.includes('requirements')) {
        errorMessage = 'Passordet oppfyller ikke kravene. Passord må være minst 6 tegn og inneholde minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?).';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = t('userManagement.invalidEmail');
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

  const handleUpdateUserRole = async (userId, newRole) => {
    if (newRole === 'admin') {
      Alert.alert(t('common.error'), t('userManagement.cannotAssignAdmin'));
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      await loadUsers();
      if (Platform.OS === 'web') {
        window.alert(t('userManagement.roleUpdated'));
      } else {
        Alert.alert(t('common.success'), t('userManagement.roleUpdated'));
      }
    } catch (error) {
      console.error('Feil ved oppdatering av rolle:', error);
      if (Platform.OS === 'web') {
        window.alert(t('userManagement.errorUpdatingRole'));
      } else {
        Alert.alert(t('common.error'), t('userManagement.errorUpdatingRole'));
      }
    }
  };

  const loadAllActivities = async () => {
    setLoadingActivities(true);
    try {
      const activitiesRef = collection(db, 'childActivities');
      const activitiesSnapshot = await getDocs(activitiesRef);
      const activitiesList = [];
      
      activitiesSnapshot.forEach((doc) => {
        activitiesList.push({
          id: doc.id,
          ...doc.data(),
          childId: doc.data().childId,
        });
      });
      
      // Sorter etter timestamp (nyeste først)
      activitiesList.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      
      setAllActivities(activitiesList);
    } catch (error) {
      handleFirebaseError(error, 'lasting av aktiviteter', { showAlert: false, logError: true });
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!activityNotes.trim()) {
      if (Platform.OS === 'web') {
        window.alert(t('activity.descriptionRequired'));
      } else {
        Alert.alert(t('common.error'), t('activity.descriptionRequired'));
      }
      return;
    }

    if (activityTarget === 'child' && !selectedChildForActivity) {
      if (Platform.OS === 'web') {
        window.alert(t('activity.selectChildRequired'));
      } else {
        Alert.alert(t('common.error'), t('activity.selectChildRequired'));
      }
      return;
    }

    if (activityTarget === 'department' && !selectedDepartmentForActivity.trim()) {
      if (Platform.OS === 'web') {
        window.alert(t('activity.selectDepartmentRequired'));
      } else {
        Alert.alert(t('common.error'), t('activity.selectDepartmentRequired'));
      }
      return;
    }

    setLoading(true);
    try {
      // Sjekk for duplikater: Hent de 3 siste aktivitetene fra samme bruker
      try {
        const activitiesRef = collection(db, 'childActivities');
        const recentActivitiesQuery = query(
          activitiesRef,
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
        const recentSnapshot = await getDocs(recentActivitiesQuery);
        
        // Sjekk om de 3 siste aktivitetene er identiske
        const recentActivities = [];
        recentSnapshot.forEach((doc) => {
          const data = doc.data();
          recentActivities.push({
            notes: data.notes?.trim() || '',
            activityType: data.activityType
          });
        });

        // Sjekk om de 3 siste aktivitetene er identiske
        if (recentActivities.length >= 3) {
          const lastThree = recentActivities.slice(0, 3);
          const notesMatch = lastThree.every(act => act.notes === activityNotes.trim());
          const typeMatch = lastThree.every(act => act.activityType === activityType);
          
          if (notesMatch && typeMatch) {
            const confirmMessage = 'Du har postet identisk aktivitet 3 ganger på rad. Er du sikker på at du vil poste den igjen?';
            
            if (Platform.OS === 'web') {
              if (!window.confirm(confirmMessage)) {
                setLoading(false);
                return;
              }
            } else {
              // For mobile - bruk Promise for å vente på svar
              const shouldContinue = await new Promise((resolve) => {
                Alert.alert(
                  'Duplikat aktivitet',
                  confirmMessage,
                  [
                    { text: 'Avbryt', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Post likevel', onPress: () => resolve(true) }
                  ]
                );
              });
              
              if (!shouldContinue) {
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch (duplicateCheckError) {
        // Hvis duplikat-sjekk feiler (f.eks. manglende index), fortsett likevel
        console.warn('Kunne ikke sjekke for duplikater:', duplicateCheckError);
      }

      let targetChildren = [];

      if (activityTarget === 'child') {
        // Enkeltbarn
        targetChildren = [selectedChildForActivity];
      } else {
        // Hele avdeling
        const childrenRef = collection(db, 'children');
        const departmentQuery = query(childrenRef, where('department', '==', selectedDepartmentForActivity));
        const snapshot = await getDocs(departmentQuery);
        snapshot.forEach((doc) => {
          targetChildren.push(doc.id);
        });
      }

      if (targetChildren.length === 0) {
        if (Platform.OS === 'web') {
          window.alert(t('activity.noChildrenInDepartment'));
        } else {
          Alert.alert(t('common.error'), t('activity.noChildrenInDepartment'));
        }
        setLoading(false);
        return;
      }

      // Opprett aktivitet for hvert barn
      const promises = targetChildren.map(childId =>
        addDoc(collection(db, 'childActivities'), {
          childId: childId,
          userId: user.uid,
          activityType: activityType,
          notes: activityNotes.trim(),
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
      );

      await Promise.all(promises);

      // Last inn aktiviteter på nytt
      await loadAllActivities();

      // Nullstill skjema
      setActivityNotes('');
      setActivityType('special_event');
      setActivityTarget('child');
      setSelectedChildForActivity(null);
      setSelectedDepartmentForActivity('');
      setShowActivityModal(false);

      // Vis suksessmelding
      const count = targetChildren.length;
      const message = count === 1 
        ? `Aktivitet registrert for ${count} barn!`
        : `Aktivitet registrert for ${count} barn!`;
      
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(t('common.success'), message);
      }
    } catch (error) {
      console.error('Feil ved opprettelse av aktivitet:', error);
      if (Platform.OS === 'web') {
        window.alert(`${t('common.error')}: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `${t('activity.register')}: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const confirmMessage = `Er du sikker på at du vil slette ${userName}? Dette kan ikke angres.`;
    
    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      Alert.alert(t('userManagement.deleteUser'), confirmMessage, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', userId));
              await loadUsers();
              Alert.alert(t('common.success'), t('userManagement.userDeleted'));
            } catch (error) {
              console.error('Feil ved sletting av bruker:', error);
              Alert.alert(t('common.error'), t('userManagement.errorDeletingUser'));
            }
          },
        },
      ]);
      return;
    }

    // For web - utfør sletting direkte
    try {
      await deleteDoc(doc(db, 'users', userId));
      await loadUsers();
      window.alert(t('userManagement.userDeleted'));
    } catch (error) {
      console.error('Feil ved sletting av bruker:', error);
      window.alert(t('userManagement.errorDeletingUser'));
    }
  };


  const loadChildren = async () => {
    try {
      setLoadingChildren(true);
      const childrenRef = collection(db, 'children');
      const querySnapshot = await getDocs(childrenRef);
      
      const childrenList = [];
      querySnapshot.forEach((doc) => {
        childrenList.push({ id: doc.id, ...doc.data() });
      });
      
      setChildren(childrenList);
      
      // Last aktiviteter på nytt for å oppdatere navn i aktivitetslisten
      await loadAllActivities();
    } catch (error) {
      const errorMessage = handleFirebaseError(error, 'lasting av barn', { showAlert: true, logError: true });
      if (errorMessage && Platform.OS !== 'web') {
        Alert.alert('Feil', `Kunne ikke laste barn: ${errorMessage}`);
      }
    } finally {
      setLoadingChildren(false);
    }
  };

  // Check-in barn
  const handleCheckIn = async (childId, childName) => {
    try {
      const childRef = doc(db, 'children', childId);
      await updateDoc(childRef, {
        status: 'checked_in',
        lastCheckIn: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Oppdater lokal state umiddelbart for å oppdatere dashboardet
      setChildren(prevChildren => 
        prevChildren.map(child => 
          child.id === childId ? { ...child, status: 'checked_in' } : child
        )
      );
      
      // Opprett logg
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'check_in',
        timestamp: serverTimestamp(),
      });
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childCheckedIn', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('admin.childCheckedIn', { name: childName }));
      }
      
      loadChildren(); // Oppdater listen i bakgrunnen
    } catch (error) {
      console.error('Feil ved check-in:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved check-in: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke krysse inn: ${error.message}`);
      }
    }
  };

  // Check-out barn
  const handleCheckOut = async (childId, childName) => {
    try {
      const childRef = doc(db, 'children', childId);
      await updateDoc(childRef, {
        status: 'checked_out',
        lastCheckOut: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Oppdater lokal state umiddelbart for å oppdatere dashboardet
      setChildren(prevChildren => 
        prevChildren.map(child => 
          child.id === childId ? { ...child, status: 'checked_out' } : child
        )
      );
      
      // Opprett logg
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'check_out',
        timestamp: serverTimestamp(),
      });
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childCheckedOut', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('admin.childCheckedOut', { name: childName }));
      }
      
      loadChildren(); // Oppdater listen i bakgrunnen
    } catch (error) {
      console.error('Feil ved check-out:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved check-out: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke krysse ut: ${error.message}`);
      }
    }
  };

  // Marker barn som sykt/borte
  const handleMarkSick = async (childId, childName) => {
    try {
      const childRef = doc(db, 'children', childId);
      await updateDoc(childRef, {
        status: 'sick',
        updatedAt: serverTimestamp(),
      });
      
      // Oppdater lokal state umiddelbart for å oppdatere dashboardet
      setChildren(prevChildren => 
        prevChildren.map(child => 
          child.id === childId ? { ...child, status: 'sick' } : child
        )
      );
      
      // Opprett logg
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
      
      loadChildren(); // Oppdater listen i bakgrunnen
    } catch (error) {
      console.error('Feil ved markering som syk:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved markering som syk: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke markere som syk: ${error.message}`);
      }
    }
  };

  // Fjern syk-status
  const handleClearSick = async (childId, childName) => {
    try {
      const childRef = doc(db, 'children', childId);
      await updateDoc(childRef, {
        status: 'not_checked_in',
        absenceReason: null,
        absenceReportedAt: null,
        updatedAt: serverTimestamp(),
      });
      
      // Oppdater lokal state umiddelbart for å oppdatere dashboardet
      setChildren(prevChildren => 
        prevChildren.map(child => 
          child.id === childId ? { ...child, status: 'not_checked_in', absenceReason: null, absenceReportedAt: null } : child
        )
      );
      
      // Opprett logg
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
      
      loadChildren(); // Oppdater listen i bakgrunnen
    } catch (error) {
      console.error('Feil ved fjerning av syk-status:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil ved fjerning av syk-status: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke fjerne syk-status: ${error.message}`);
      }
    }
  };

  // Naviger til barneprofil
  const handleViewChildProfile = (childId) => {
    navigation.navigate('ChildProfile', { childId });
  };

  // Slette barn
  const handleDeleteChild = async (childId, childName) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(t('admin.confirmDelete', { name: childName }))) {
        return;
      }
    } else {
      Alert.alert(t('admin.deleteChild'), t('admin.confirmDelete', { name: childName }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'children', childId));
            if (Platform.OS === 'web') {
              window.alert(t('admin.childDeleted', { name: childName }));
            } else {
              Alert.alert(t('common.success'), t('admin.childDeleted', { name: childName }));
            }
            loadChildren(); // Oppdater listen
          } catch (error) {
            console.error('Feil ved sletting:', error);
            if (Platform.OS === 'web') {
              window.alert(t('admin.deleteError', { message: error.message }));
            } else {
              Alert.alert(t('common.error'), t('admin.deleteError', { message: error.message }));
            }
          }
        }}
      ]);
      return;
    }

    try {
      await deleteDoc(doc(db, 'children', childId));
      if (Platform.OS === 'web') {
        window.alert(t('admin.childDeleted', { name: childName }));
      } else {
        Alert.alert(t('common.success'), t('admin.childDeleted', { name: childName }));
      }
      loadChildren(); // Oppdater listen
    } catch (error) {
      console.error('Feil ved sletting:', error);
      if (Platform.OS === 'web') {
        window.alert(t('admin.deleteError', { message: error.message }));
      } else {
        Alert.alert(t('common.error'), t('admin.deleteError', { message: error.message }));
      }
    }
  };

  const handleCreateChild = async () => {
    if (!name || !avdeling || guardianEmails.length === 0) {
      Alert.alert('Mangler info', 'Navn, avdeling og minst én forelder må fylles ut.');
      return;
    }

    setLoading(true);
    try {
      // Sjekk at brukeren er admin
      if (role !== 'admin') {
        Alert.alert('Feil', 'Kun admin kan opprette barn.');
        setLoading(false);
        return;
      }

      // Sjekk for duplikater (samme navn + samme avdeling)
      const childrenRef = collection(db, 'children');
      const duplicateQuery = query(
        childrenRef, 
        where('name', '==', name.trim()),
        where('department', '==', avdeling.trim())
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (!duplicateSnapshot.empty) {
        Alert.alert(
          'Duplikat funnet', 
          `Det finnes allerede et barn med navnet "${name}" i avdelingen "${avdeling}".\n\nVennligst sjekk at navnet er korrekt eller velg en annen avdeling.`
        );
        setLoading(false);
        return;
      }

      // Finn user IDs basert på e-postadresser
      const usersRef = collection(db, 'users');
      const parentIds = [];
      
      console.log('Søker etter brukere med e-postadresser:', guardianEmails);
      console.log('Brukerens rolle:', role);
      console.log('Brukerens UID:', user?.uid);
      
      // Hent user IDs for hver e-postadresse
      // Merk: Dette forutsetter at users-collection har et 'email'-felt
      // Hvis ikke, må brukere opprettes først eller vi må bruke en annen metode
      for (const email of guardianEmails) {
        try {
          console.log(`Søker etter bruker med e-post: ${email}`);
          const userQuery = query(usersRef, where('email', '==', email));
          const userSnapshot = await getDocs(userQuery);
          
          console.log(`Resultat for ${email}:`, userSnapshot.empty ? 'Ingen treff' : `${userSnapshot.docs.length} treff`);
          
          if (!userSnapshot.empty) {
            const userId = userSnapshot.docs[0].id;
            console.log(`Fant bruker ID: ${userId} for e-post: ${email}`);
            parentIds.push(userId);
          } else {
            // Brukeren finnes ikke - gi mer hjelpsom feilmelding
            Alert.alert(
              'Bruker ikke funnet', 
              `Fant ingen bruker med e-post: ${email}\n\nBrukeren må opprettes i Firebase først:\n1. Gå til Firebase Console → Authentication\n2. Opprett bruker med e-post: ${email}\n3. Gå til Firestore → users-collection\n4. Opprett dokument med user ID og legg til:\n   - email: "${email}"\n   - role: "parent"`,
              [{ text: 'OK' }]
            );
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error(`Feil ved søk etter bruker ${email}:`, error);
          console.error('Feil-detaljer:', {
            code: error.code,
            message: error.message,
            stack: error.stack
          });
          Alert.alert('Feil', `Kunne ikke søke etter bruker ${email}. Feil: ${error.message || error.code || 'Ukjent feil'}`);
          setLoading(false);
          return;
        }
      }
      
      console.log('Alle parentIds funnet:', parentIds);

      // Last opp bilde hvis det finnes
      let imageUrl = null;
      if (childImage && imageUri) {
        try {
          // Prøv Firebase Storage først (hvis tilgjengelig)
          try {
            const imageRef = ref(storage, `children/${Date.now()}_${name.replace(/\s+/g, '_')}.jpg`);
            // Bruk filen direkte hvis den finnes (raskere), ellers fetch fra URI
            let blob;
            if (childImage instanceof File) {
              blob = childImage;
            } else {
              const response = await fetch(imageUri);
              blob = await response.blob();
            }
            
            // Last opp med timeout
            const uploadPromise = uploadBytes(imageRef, blob);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout')), 10000)
            );
            
            await Promise.race([uploadPromise, timeoutPromise]);
            imageUrl = await getDownloadURL(imageRef);
            console.log('Bilde lastet opp til Firebase Storage:', imageUrl);
          } catch (storageError) {
            // Fallback: Lagre som Base64 i Firestore (gratis løsning)
            console.log('Firebase Storage ikke tilgjengelig, bruker Base64 fallback');
            
            // Konverter bilde til Base64
            let base64String = imageUri;
            if (!base64String.startsWith('data:image')) {
              // Hvis vi har en File, konverter til Base64
              if (childImage instanceof File) {
                base64String = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(childImage);
                });
              }
            }
            
            // Sjekk størrelse (Firestore har 1MB grense per dokument)
            const base64Size = (base64String.length * 3) / 4; // Estimert størrelse i bytes
            if (base64Size > 900000) { // 900KB for å være trygg
              throw new Error('Bildet er for stort. Prøv med et mindre bilde.');
            }
            
            // Lagre Base64 direkte i Firestore
            imageUrl = base64String;
            console.log('Bilde lagret som Base64 i Firestore');
          }
        } catch (error) {
          console.error('Feil ved bilde-opplasting:', error);
          let errorMessage = 'Kunne ikke laste opp bilde, men barnet vil bli opprettet uten bilde.';
          if (error.message && error.message.includes('for stort')) {
            errorMessage = 'Bildet er for stort. Prøv med et mindre bilde.';
          } else if (error.code === 'storage/retry-limit-exceeded' || error.code === 'storage/unauthorized') {
            errorMessage = 'Firebase Storage ikke tilgjengelig. Bildet vil bli lagret lokalt i databasen (gratis løsning).';
          }
          
          if (Platform.OS === 'web') {
            window.alert('Advarsel: ' + errorMessage);
          } else {
            Alert.alert('Advarsel', errorMessage);
          }
          // Fortsett uten bilde
          imageUrl = null;
        }
      }

      // Opprett barn med riktige feltnavn
      console.log('Prøver å opprette barn med data:', {
        name: name.trim(),
        department: avdeling.trim(),
        parentIds,
        status: 'not_checked_in',
        imageUrl
      });
      
      const childData = {
        name: name.trim(),
        department: avdeling.trim(), // Trim for å fjerne whitespace
        parentIds: parentIds,
        status: 'not_checked_in',
        allergies: allergies.trim() || '',
        notes: notes.trim() || '',
        imageUrl: imageUrl, // Legg til bilde-URL
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, "children"), childData);
      console.log('Barn opprettet med ID:', docRef.id);

      // Bruk window.alert for web-kompatibilitet
      if (Platform.OS === 'web') {
        window.alert(`✅ ${t('common.success')}!\n\n${t('admin.childCreated', { name })}`);
      } else {
        Alert.alert(t('common.success'), t('admin.childCreated', { name }));
      }
      
      // Nullstill skjema
      setName('');
      setAvdeling('');
      setAllergies('');
      setNotes('');
      setGuardianEmails([]);
      setEmailInput('');
      setChildImage(null);
      setImageUri(null);
      setShowForm(false);
      
      // Oppdater listen over barn
      loadChildren();
    } catch (error) {
      console.error('Feil ved opprettelse av barn:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message || 'Sjekk tilkobling og Security Rules.'}`);
      } else {
        Alert.alert('Feil', `Kunne ikke lagre: ${error.message || 'Sjekk tilkobling og Security Rules.'}`);
      }
    } finally {
      setLoading(false);
    }
  };


  const themeStyles = {
    container: { ...styles.container, backgroundColor: isDarkMode ? '#1e1b4b' : '#f9fafb' },
    header: { ...styles.header, backgroundColor: isDarkMode ? '#1e1b4b' : '#1e1b4b' },
    sectionTitle: { ...styles.sectionTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    childCard: { ...styles.childCard, backgroundColor: isDarkMode ? '#312e81' : 'white', borderColor: isDarkMode ? '#4c1d95' : '#e5e7eb' },
    childName: { ...styles.childName, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    childDepartment: { ...styles.childDepartment, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    detailLabel: { ...styles.detailLabel, color: isDarkMode ? '#d1d5db' : '#374151' },
    detailValue: { ...styles.detailValue, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    emptyText: { ...styles.emptyText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    formSection: { ...styles.formSection, backgroundColor: isDarkMode ? '#312e81' : 'white', borderColor: isDarkMode ? '#4c1d95' : '#e5e7eb' },
    title: { ...styles.title, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    subtitle: { ...styles.subtitle, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    label: { ...styles.label, color: isDarkMode ? '#d1d5db' : '#374151' },
    input: { ...styles.input, backgroundColor: isDarkMode ? '#4c1d95' : 'white', borderColor: isDarkMode ? '#6b21a8' : '#d1d5db', color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    searchContainer: { ...styles.searchContainer, backgroundColor: isDarkMode ? '#312e81' : 'white', borderColor: isDarkMode ? '#4c1d95' : '#e5e7eb' },
  };

  return (
    <SafeAreaView style={themeStyles.container}>
      <View style={themeStyles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => setShowSidebar(!showSidebar)}
            style={styles.menuButton}
          >
            <Ionicons name="menu" size={24} color="white" />
          </TouchableOpacity>
          <Image 
            source={require('../../assets/nylogogrey.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{t('admin.title')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={async () => {
              console.log('🔘 Logout-knapp trykket');
              try {
                await logout();
                console.log('✅ Logout-funksjon fullført');
              } catch (error) {
                console.error('❌ Feil ved utlogging:', error);
              }
            }} 
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>



      {/* Modal for aktivitetsregistrering */}
      <Modal
        visible={showActivityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.activityModal, isDarkMode && styles.activityModalDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>{t('activity.registerActivity')}</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true}>
              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('activity.activityType')}</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[styles.roleButton, activityType === 'special_event' && styles.roleButtonActive]}
                    onPress={() => setActivityType('special_event')}
                  >
                    <Text style={[styles.roleButtonText, activityType === 'special_event' && styles.roleButtonTextActive]}>
                      {t('activity.specialEvent')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleButton, activityType === 'diaper_change' && styles.roleButtonActive]}
                    onPress={() => setActivityType('diaper_change')}
                  >
                    <Text style={[styles.roleButtonText, activityType === 'diaper_change' && styles.roleButtonTextActive]}>
                      {t('activity.diaperChange')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('activity.description')}</Text>
                <TextInput
                  style={[themeStyles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={activityNotes}
                  onChangeText={setActivityNotes}
                  placeholder={t('activity.descriptionPlaceholder')}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('activity.targeting')}</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[styles.roleButton, activityTarget === 'child' && styles.roleButtonActive]}
                    onPress={() => {
                      setActivityTarget('child');
                      setSelectedDepartmentForActivity('');
                    }}
                  >
                    <Text style={[styles.roleButtonText, activityTarget === 'child' && styles.roleButtonTextActive]}>
                      {t('activity.singleChild')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleButton, activityTarget === 'department' && styles.roleButtonActive]}
                    onPress={() => {
                      setActivityTarget('department');
                      setSelectedChildForActivity(null);
                    }}
                  >
                    <Text style={[styles.roleButtonText, activityTarget === 'department' && styles.roleButtonTextActive]}>
                      {t('activity.entireDepartment')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {activityTarget === 'child' && (
                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('activity.selectChild')}</Text>
                  <ScrollView style={{ maxHeight: 200, backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderRadius: 8, padding: 8 }}>
                    {children.map((child) => (
                      <TouchableOpacity
                        key={child.id}
                        style={[
                          styles.childSelectButton,
                          selectedChildForActivity === child.id && styles.childSelectButtonActive
                        ]}
                        onPress={() => setSelectedChildForActivity(child.id)}
                      >
                        <Text style={[
                          styles.childSelectText,
                          { color: isDarkMode ? '#f3f4f6' : '#1f2937' },
                          selectedChildForActivity === child.id && styles.childSelectTextActive
                        ]}>
                          {child.name} - {child.department}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {activityTarget === 'department' && (
                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('activity.selectDepartment')}</Text>
                  <TextInput
                    style={themeStyles.input}
                    value={selectedDepartmentForActivity}
                    onChangeText={setSelectedDepartmentForActivity}
                    placeholder={t('activity.departmentPlaceholder')}
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateActivity}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{t('activity.register')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dashboard Modal - Viser barna basert på kategori */}
      <Modal
        visible={showDashboardModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDashboardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                {dashboardFilter === 'all' && t('admin.totalChildren')}
                {dashboardFilter === 'present' && t('admin.present')}
                {dashboardFilter === 'notCheckedIn' && t('admin.notCheckedIn')}
                {dashboardFilter === 'sick' && t('admin.sick')}
              </Text>
              <TouchableOpacity onPress={() => setShowDashboardModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {(() => {
                let filteredChildren = [];
                if (dashboardFilter === 'all') {
                  filteredChildren = children;
                } else if (dashboardFilter === 'present') {
                  filteredChildren = children.filter(c => c.status === 'checked_in');
                } else if (dashboardFilter === 'notCheckedIn') {
                  filteredChildren = children.filter(c => c.status !== 'checked_in' && c.status !== 'checked_out' && c.status !== 'sick');
                } else if (dashboardFilter === 'sick') {
                  filteredChildren = children.filter(c => c.status === 'sick');
                }

                if (filteredChildren.length === 0) {
                  return (
                    <Text style={[themeStyles.emptyText, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                      {t('admin.noChildren')}
                    </Text>
                  );
                }

                return (
                  <View style={styles.childrenList}>
                    {filteredChildren.map((child) => (
                      <TouchableOpacity
                        key={child.id}
                        style={[themeStyles.childCard, { marginBottom: 12 }]}
                        onPress={() => {
                          setShowDashboardModal(false);
                          handleViewChildProfile(child.id);
                        }}
                      >
                        <View style={styles.childCardHeader}>
                          <View style={styles.childInfo}>
                          <View style={styles.childInfoRow}>
                            <View style={styles.childAvatarContainer}>
                              <View style={styles.childAvatarPlaceholder}>
                                <Text style={styles.childAvatarText}>👶</Text>
                              </View>
                              {!failedAvatars.has(child.id) && (
                                <Image 
                                  source={{ uri: getAvatar(child.imageUrl, child.name, 'child', 200) }} 
                                  style={styles.childAvatar}
                                  onError={() => {
                                    console.log('Avatar failed to load for:', child.name);
                                    setFailedAvatars(prev => new Set(prev).add(child.id));
                                  }}
                                />
                              )}
                            </View>
                              <View style={styles.childNameContainer}>
                                <Text style={themeStyles.childName}>{child.name || t('childProfile.noName')}</Text>
                                <Text style={themeStyles.childDepartment}>{child.department || t('childProfile.noDepartment')}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                        <View style={styles.childDetails}>
                          <View style={styles.detailRow}>
                            <Text style={themeStyles.detailLabel}>{t('admin.status')}:</Text>
                            <Text style={[
                              styles.detailValue,
                              styles.statusBadge,
                              child.status === 'checked_in' ? styles.statusIn :
                              child.status === 'checked_out' ? styles.statusOut :
                              child.status === 'sick' ? styles.statusSick :
                              styles.statusNotIn
                            ]}>
                              {child.status === 'checked_in' ? t('admin.present') :
                               child.status === 'checked_out' ? t('admin.pickedUp') :
                               child.status === 'sick' ? t('admin.sick') :
                               t('admin.notCheckedIn')}
                            </Text>
                          </View>
                          {child.allergies && (
                            <View style={styles.detailRow}>
                              <Text style={themeStyles.detailLabel}>{t('admin.allergies')}:</Text>
                              <Text style={themeStyles.detailValue}>{child.allergies}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <Modal
        visible={showSidebar}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSidebar(false)}
      >
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPress={() => setShowSidebar(false)}
        >
          <View style={[styles.sidebar, isDarkMode && styles.sidebarDark]}>
            <View style={[styles.sidebarHeader, isDarkMode && { borderBottomColor: '#4c1d95' }]}>
              <Text style={[styles.sidebarTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>{t('admin.title')}</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>
            <View style={styles.sidebarContent}>
              {/* Barn & Avdelinger */}
              <TouchableOpacity
                style={styles.sidebarItem}
                onPress={() => {
                  setShowSidebar(false);
                  setShowForm(false);
                  setShowUserManagement(false);
                  setShowDepartmentManagement(false);
                  setShowEmployees(false);
                  setShowChildrenAndDepartments(true);
                }}
              >
                <Ionicons name="people" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  Barn & Avdelinger
                </Text>
              </TouchableOpacity>
              
              {/* Ansatte */}
              <TouchableOpacity
                style={styles.sidebarItem}
                onPress={() => {
                  setShowSidebar(false);
                  setShowForm(false);
                  setShowUserManagement(false);
                  setShowDepartmentManagement(false);
                  setShowChildrenAndDepartments(false);
                  setShowEmployees(true);
                }}
              >
                <Ionicons name="people-circle" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  Ansatte
                </Text>
              </TouchableOpacity>
              
              {/* Innhold - Kalender, Bildegalleri */}
              <View style={styles.sidebarSection}>
                <Text style={[styles.sidebarSectionTitle, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                  Innhold
                </Text>
                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setShowSidebar(false);
                    navigation.navigate('Calendar');
                  }}
                >
                  <Ionicons name="calendar" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                  <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                    {t('calendar.title')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setShowSidebar(false);
                    navigation.navigate('Gallery');
                  }}
                >
                  <Ionicons name="images" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                  <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                    {t('gallery.title')}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Administrasjon - Innstillinger, Brukeradministrasjon */}
              <View style={styles.sidebarSection}>
                <Text style={[styles.sidebarSectionTitle, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                  Administrasjon
                </Text>
                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setShowSidebar(false);
                    navigation.navigate('Settings');
                  }}
                >
                  <Ionicons name="settings" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                  <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                    {t('settings.title')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sidebarItem}
                  onPress={() => {
                    setShowSidebar(false);
                    setShowUserManagement(true);
                    setShowEmployees(false);
                    setShowChildrenAndDepartments(false);
                  }}
                >
                  <Ionicons name="person-add" size={20} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
                  <Text style={[styles.sidebarItemText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                    {t('userManagement.title')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        style={Platform.OS === 'web' ? {flex: 1, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'} : {flex: 1}}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        scrollEnabled={true}
        alwaysBounceVertical={false}
      >
          {/* Ansatte-visning */}
          {showEmployees && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={themeStyles.sectionTitle}>Ansatte ({employees.length})</Text>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => {
                    setShowAddEmployeeForm(!showAddEmployeeForm);
                    setEditingEmployee(null);
                    setNewUserEmail('');
                    setNewUserPassword('');
                    setNewUserName('');
                    setNewUserDepartment('');
                    setNewUserRole('employee');
                    setEmployeePhone('');
                  }}
                >
                  <Ionicons name={showAddEmployeeForm ? "close" : "add"} size={24} color="white" />
                  <Text style={styles.addButtonText}>{showAddEmployeeForm ? 'Lukk' : 'Legg til ansatt'}</Text>
                </TouchableOpacity>
              </View>

              {/* Legg til ansatt form */}
              {showAddEmployeeForm && (
                <View style={[themeStyles.formSection, { marginBottom: 20, padding: 16, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', borderRadius: 12 }]}>
                  <Text style={themeStyles.title}>{editingEmployee ? 'Rediger ansatt' : 'Legg til ny ansatt'}</Text>
                  
                  <TextInput 
                    style={themeStyles.input} 
                    value={newUserName} 
                    onChangeText={setNewUserName} 
                    placeholder="Navn" 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                  
                  <TextInput 
                    style={themeStyles.input} 
                    value={newUserEmail} 
                    onChangeText={setNewUserEmail} 
                    placeholder="E-post" 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                  
                  {!editingEmployee && (
                    <TextInput 
                      style={themeStyles.input} 
                      value={newUserPassword} 
                      onChangeText={setNewUserPassword} 
                      placeholder="Passord (minst 6 tegn)" 
                      secureTextEntry
                      placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                    />
                  )}
                  
                  <TextInput 
                    style={themeStyles.input} 
                    value={employeePhone} 
                    onChangeText={setEmployeePhone} 
                    placeholder="Telefonnummer" 
                    keyboardType="phone-pad"
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />

                  <View style={styles.departmentSelector}>
                    <Text style={themeStyles.label}>Avdeling:</Text>
                    <TouchableOpacity 
                      style={[themeStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    >
                      <Text style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>
                        {newUserDepartment || 'Velg avdeling'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                    {showDepartmentDropdown && (
                      <View style={[styles.dropdown, { backgroundColor: isDarkMode ? '#374151' : 'white' }]}>
                        <ScrollView style={{ maxHeight: 200 }}>
                          <TouchableOpacity 
                            style={styles.dropdownItem}
                            onPress={() => {
                              setNewUserDepartment('');
                              setShowDepartmentDropdown(false);
                            }}
                          >
                            <Text style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>Ingen avdeling</Text>
                          </TouchableOpacity>
                          {departments.map((dept) => (
                            <TouchableOpacity 
                              key={dept.id}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setNewUserDepartment(dept.name);
                                setShowDepartmentDropdown(false);
                              }}
                            >
                              <Text style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{dept.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.saveBtn} 
                    onPress={async () => {
                      if (editingEmployee) {
                        // Oppdater eksisterende ansatt
                        try {
                          const updateData = {
                            name: newUserName.trim(),
                            email: newUserEmail.trim().toLowerCase(),
                            phone: employeePhone.trim(),
                            department: newUserDepartment.trim(),
                            updatedAt: serverTimestamp(),
                          };
                          await updateDoc(doc(db, 'users', editingEmployee.id), updateData);
                          await loadEmployees();
                          setShowAddEmployeeForm(false);
                          setEditingEmployee(null);
                          Alert.alert('Suksess', 'Ansatt oppdatert');
                        } catch (error) {
                          console.error('Feil ved oppdatering:', error);
                          Alert.alert('Feil', 'Kunne ikke oppdatere ansatt');
                        }
                      } else {
                        // Opprett ny ansatt
                        await handleCreateUser();
                        setShowAddEmployeeForm(false);
                        setEmployeePhone('');
                      }
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.saveBtnText}>{editingEmployee ? 'Oppdater' : 'Opprett ansatt'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {loadingEmployees ? (
                <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} />
              ) : employees.length === 0 ? (
                <Text style={themeStyles.emptyText}>Ingen ansatte registrert</Text>
              ) : (
                <View style={styles.childrenList}>
                  {employees.map((employee) => {
                    const status = employee.status || 'not_present';
                    const statusEmoji = status === 'present' ? '✅' : status === 'absent' ? '❌' : '⚪';
                    const statusText = status === 'present' ? 'Til stede' : status === 'absent' ? 'Borte' : 'Ikke satt';
                    
                    return (
                      <View key={employee.id} style={themeStyles.childCard}>
                        <View style={styles.userCardHeader}>
                          <View style={styles.userInfo}>
                            <Image 
                              source={{ uri: getAvatar(employee.imageUrl || employee.profilePicture, employee.name || employee.email, 'user', 200) }} 
                              style={styles.userAvatar}
                            />
                            <View style={styles.userNameContainer}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={themeStyles.childName}>{employee.name || employee.email}</Text>
                                <Text style={{ fontSize: 20 }}>{statusEmoji}</Text>
                              </View>
                              <Text style={themeStyles.childDepartment}>
                                {employee.email}
                              </Text>
                              {employee.phone && (
                                <Text style={[themeStyles.childDepartment, { marginTop: 4 }]}>
                                  📞 {employee.phone}
                                </Text>
                              )}
                              <Text style={themeStyles.childDepartment}>
                                🏢 {employee.department || 'Ingen avdeling'}
                              </Text>
                              <Text style={[themeStyles.childDepartment, { marginTop: 4, fontSize: 12 }]}>
                                Status: {statusText}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.employeeActions}>
                          <TouchableOpacity 
                            style={[styles.statusButton, { backgroundColor: status === 'present' ? '#10b981' : '#6b7280' }]}
                            onPress={() => handleUpdateEmployeeStatus(employee.id, status === 'present' ? 'not_present' : 'present')}
                          >
                            <Text style={{ color: 'white', fontSize: 12 }}>{status === 'present' ? 'Sett borte' : 'Sett til stede'}</Text>
                          </TouchableOpacity>
                          
                          <View style={styles.departmentSelector}>
                            <TouchableOpacity 
                              style={[styles.editButton, { backgroundColor: '#6366f1' }]}
                              onPress={() => {
                                const deptNames = departments.map(d => d.name);
                                const currentDept = employee.department || '';
                                const currentIndex = deptNames.indexOf(currentDept);
                                const nextIndex = (currentIndex + 1) % (deptNames.length + 1);
                                const nextDept = nextIndex === 0 ? '' : deptNames[nextIndex - 1];
                                handleUpdateEmployeeDepartment(employee.id, nextDept);
                              }}
                            >
                              <Text style={{ color: 'white', fontSize: 12 }}>Endre avdeling</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity 
                            style={[styles.editButton, { backgroundColor: '#f59e0b' }]}
                            onPress={() => {
                              setEditingEmployee(employee);
                              setNewUserName(employee.name || '');
                              setNewUserEmail(employee.email || '');
                              setNewUserDepartment(employee.department || '');
                              setEmployeePhone(employee.phone || '');
                              setShowAddEmployeeForm(true);
                            }}
                          >
                            <Ionicons name="create-outline" size={16} color="white" />
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.editButton, { backgroundColor: '#ef4444' }]}
                            onPress={() => handleDeleteEmployee(employee.id, employee.name || employee.email)}
                          >
                            <Ionicons name="trash-outline" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Barn & Avdelinger - Kombinert visning */}
          {showChildrenAndDepartments && !showEmployees && (
            <>
          {/* Dashboard Oversikt */}
          <View style={styles.dashboardSection}>
            <Text style={[themeStyles.sectionTitle, { marginBottom: 16, color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
              {t('admin.dashboard')}
            </Text>
            
            {/* Statistikkkort */}
            <View style={styles.statsGrid}>
              <TouchableOpacity 
                style={[styles.statCard, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff', borderLeftColor: '#6366f1' }]}
                onPress={() => {
                  setDashboardFilter('all');
                  setShowDashboardModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.statHeader}>
                  <Ionicons name="people" size={24} color="#6366f1" />
                  <Text style={[styles.statLabel, { color: isDarkMode ? '#c7d2fe' : '#6366f1' }]}>
                    {t('admin.totalChildren')}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {children.length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5', borderLeftColor: '#10b981' }]}
                onPress={() => {
                  setDashboardFilter('present');
                  setShowDashboardModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.statHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  <Text style={[styles.statLabel, { color: isDarkMode ? '#a7f3d0' : '#10b981' }]}>
                    {t('admin.present')}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {children.filter(c => c.status === 'checked_in').length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2', borderLeftColor: '#ef4444' }]}
                onPress={() => {
                  setDashboardFilter('notCheckedIn');
                  setShowDashboardModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.statHeader}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                  <Text style={[styles.statLabel, { color: isDarkMode ? '#fecaca' : '#ef4444' }]}>
                    {t('admin.notCheckedIn')}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {children.filter(c => c.status !== 'checked_in' && c.status !== 'checked_out' && c.status !== 'sick').length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { backgroundColor: isDarkMode ? '#78350f' : '#fed7aa', borderLeftColor: '#f59e0b' }]}
                onPress={() => {
                  setDashboardFilter('sick');
                  setShowDashboardModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.statHeader}>
                  <Ionicons name="medical" size={24} color="#f59e0b" />
                  <Text style={[styles.statLabel, { color: isDarkMode ? '#fde68a' : '#f59e0b' }]}>
                    {t('admin.sick')}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                  {children.filter(c => c.status === 'sick').length}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Visuell oversikt med avatare */}
            <View style={[styles.avatarOverview, { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff', borderColor: isDarkMode ? '#312e81' : '#c7d2fe' }]}>
              <Text style={[styles.avatarOverviewTitle, { color: isDarkMode ? '#c7d2fe' : '#6366f1' }]}>
                {t('admin.childrenOverview')}
              </Text>
              <View style={styles.avatarGrid}>
                {children.slice(0, 12).map((child) => {
                  const statusColor = 
                    child.status === 'checked_in' ? '#10b981' :
                    child.status === 'sick' ? '#f59e0b' :
                    child.status === 'checked_out' ? '#3b82f6' :
                    '#ef4444';
                  
                  return (
                    <TouchableOpacity
                      key={child.id}
                      onPress={() => handleViewChildProfile(child.id)}
                      style={styles.avatarItem}
                    >
                      <View style={[styles.avatarContainer, { borderColor: statusColor, borderWidth: 3 }]}>
                        <Image 
                          source={{ uri: getAvatar(child.imageUrl, child.name, 'child', 200) }} 
                          style={styles.avatarSmall}
                        />
                      </View>
                      <Text style={[styles.avatarName, { color: isDarkMode ? '#e0e7ff' : '#4f46e5' }]} numberOfLines={1}>
                        {child.name || t('childProfile.noName')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {children.length > 12 && (
                <Text style={[styles.moreChildrenText, { color: isDarkMode ? '#a5b4fc' : '#6366f1' }]}>
                  {t('admin.andMore', { count: children.length - 12 })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Avdelingsoversikt */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={themeStyles.sectionTitle}>{t('admin.departments')} ({departments.length})</Text>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => {
                  setShowDepartmentManagement(!showDepartmentManagement);
                  if (!showDepartmentManagement && user) {
                    loadDepartments();
                  }
                }}
              >
                <Ionicons name={showDepartmentManagement ? "close" : "business"} size={24} color="white" />
                <Text style={styles.addButtonText}>
                  {showDepartmentManagement ? t('admin.close') : t('admin.manageDepartments')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Vis avdelinger med statistikk */}
            {!showDepartmentManagement && (
              <View>
                {loadingDepartments ? (
                  <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} />
                ) : departments.length === 0 ? (
                  <Text style={themeStyles.emptyText}>{t('admin.noDepartments')}</Text>
                ) : (
                  <View style={styles.departmentsGrid}>
                    {departments.map((dept) => {
                      const deptChildren = children.filter(c => c.department === dept.name);
                      const present = deptChildren.filter(c => c.status === 'checked_in').length;
                      const missing = deptChildren.filter(c => c.status !== 'checked_in' && c.status !== 'checked_out' && c.status !== 'sick').length;
                      const sick = deptChildren.filter(c => c.status === 'sick').length;
                      const pickedUp = deptChildren.filter(c => c.status === 'checked_out').length;
                      
                      return (
                        <View key={dept.id} style={[themeStyles.childCard, styles.departmentCard]}>
                          <View style={styles.departmentCardHeader}>
                            <View style={styles.departmentInfo}>
                              <Text style={[themeStyles.sectionTitle, { marginBottom: 4, fontSize: 18 }]}>{dept.name}</Text>
                              <Text style={[themeStyles.childDepartment, { marginBottom: 0 }]}>
                                {deptChildren.length} {deptChildren.length === 1 ? 'barn' : 'barn'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => handleDeleteDepartment(dept.id, dept.name)}
                            >
                              <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                          
                          <View style={styles.departmentStatsRow}>
                            <View style={styles.departmentStatItem}>
                              <Text style={[styles.departmentStatValue, { color: '#10b981' }]}>{present}</Text>
                              <Text style={styles.departmentStatLabel}>{t('admin.present')}</Text>
                            </View>
                            <View style={styles.departmentStatItem}>
                              <Text style={[styles.departmentStatValue, { color: '#ef4444' }]}>{missing}</Text>
                              <Text style={styles.departmentStatLabel}>{t('admin.notCheckedIn')}</Text>
                            </View>
                            {sick > 0 && (
                              <View style={styles.departmentStatItem}>
                                <Text style={[styles.departmentStatValue, { color: '#f59e0b' }]}>{sick}</Text>
                                <Text style={styles.departmentStatLabel}>{t('admin.sick')}</Text>
                              </View>
                            )}
                            {pickedUp > 0 && (
                              <View style={styles.departmentStatItem}>
                                <Text style={[styles.departmentStatValue, { color: '#3b82f6' }]}>{pickedUp}</Text>
                                <Text style={styles.departmentStatLabel}>{t('admin.pickedUp')}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Avdelingsadministrasjon (legg til/slett) */}
            {showDepartmentManagement && (
              <View style={themeStyles.formSection}>
                <Text style={themeStyles.title}>{t('admin.manageDepartments')}</Text>
                
                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('admin.departmentName')}</Text>
                  <TextInput 
                    style={themeStyles.input} 
                    value={newDepartmentName} 
                    onChangeText={setNewDepartmentName} 
                    placeholder={t('admin.departmentPlaceholder')}
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateDepartment} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('admin.createDepartment')}</Text>}
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={themeStyles.title}>{t('admin.departments')} ({departments.length})</Text>
                
                {loadingDepartments ? (
                  <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} />
                ) : departments.length === 0 ? (
                  <Text style={themeStyles.emptyText}>{t('admin.noDepartments')}</Text>
                ) : (
                  <View style={styles.usersList}>
                    {departments.map((dept) => {
                      const deptChildren = children.filter(c => c.department === dept.name);
                      const deptEmployees = users.filter(u => u.department === dept.name && u.role === 'employee');
                      
                      return (
                        <View key={dept.id} style={themeStyles.childCard}>
                          <View style={styles.userCardHeader}>
                            <View style={styles.userInfo}>
                              <Text style={themeStyles.childName}>{dept.name}</Text>
                              <Text style={themeStyles.childDepartment}>
                                {deptChildren.length} {deptChildren.length === 1 ? 'barn' : 'barn'} • {deptEmployees.length} {deptEmployees.length === 1 ? 'ansatt' : 'ansatte'}
                              </Text>
                            </View>
                            <View style={styles.actionButtons}>
                              <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDeleteDepartment(dept.id, dept.name)}
                              >
                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Aktivitetsregistrering */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={themeStyles.sectionTitle}>{t('activityRegistration.title')}</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowActivityModal(true)}
              >
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.addButtonText}>{t('activityRegistration.newActivity')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[themeStyles.emptyText, { fontSize: 14, marginBottom: 12 }]}>
              {t('activityRegistration.description')}
            </Text>

            {/* Liste over alle aktiviteter */}
            {loadingActivities ? (
              <ActivityIndicator size="small" color="#4f46e5" style={{ marginVertical: 12 }} />
            ) : allActivities.length === 0 ? (
              <Text style={[themeStyles.emptyText, { fontSize: 14 }]}>
                {t('activityRegistration.noActivities')}
              </Text>
            ) : (
              <View style={styles.activitiesListContainer}>
                <Text style={[themeStyles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>
                  {t('activityRegistration.recentActivities')} ({allActivities.length})
                </Text>
                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
                  {allActivities.slice(0, 20).map((activity, index) => {
                    const time = activity.timestamp?.toDate?.() || activity.createdAt?.toDate?.() || new Date();
                    const timeStr = time.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = time.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
                    
                    // Finn barnets navn
                    const child = children.find(c => c.id === activity.childId);
                    const childName = child?.name || t('childProfile.noName');
                    
                    let activityLabel = '';
                    let activityIcon = '';
                    let activityColor = '#6b7280';
                    
                    switch(activity.activityType) {
                      case 'check_in':
                        activityLabel = t('admin.checkIn');
                        activityIcon = 'checkmark-circle';
                        activityColor = '#10b981';
                        break;
                      case 'check_out':
                        activityLabel = t('admin.checkOut');
                        activityIcon = 'log-out';
                        activityColor = '#10b981';
                        break;
                      case 'diaper_change':
                        activityLabel = t('activity.diaperChange');
                        activityIcon = 'water';
                        activityColor = '#3b82f6';
                        break;
                      case 'special_event':
                        activityLabel = activity.notes || t('activity.specialEvent');
                        activityIcon = 'star';
                        activityColor = '#f59e0b';
                        break;
                      default:
                        activityLabel = t('activity.unknown');
                        activityIcon = 'help-circle';
                    }
                    
                    return (
                      <TouchableOpacity
                        key={activity.id || index}
                        style={[styles.activityListItem, { borderLeftColor: activityColor }]}
                        onPress={() => {
                          if (activity.childId) {
                            handleViewChildProfile(activity.childId);
                          }
                        }}
                        disabled={!activity.childId}
                        activeOpacity={activity.childId ? 0.7 : 1}
                      >
                        <View style={[styles.activityListIconContainer, { backgroundColor: activityColor + '20' }]}>
                          <Ionicons name={activityIcon} size={16} color={activityColor} />
                        </View>
                        <View style={styles.activityListInfo}>
                          <Text style={styles.activityListLabel}>{activityLabel}</Text>
                          <Text style={styles.activityListDetails}>
                            {childName} • {dateStr} {timeStr}
                          </Text>
                          {activity.notes && activity.activityType === 'special_event' && (
                            <Text style={styles.activityListNotes}>{activity.notes}</Text>
                          )}
                        </View>
                        {role === 'admin' && activity.activityType && activity.activityType !== 'check_in' && activity.activityType !== 'check_out' && (
                          <TouchableOpacity
                            style={styles.deleteActivityButton}
                            onPress={async (e) => {
                              // Stopp event propagation for å unngå navigasjon
                              if (e && e.stopPropagation) {
                                e.stopPropagation();
                              }
                              
                              const confirmMessage = t('activity.confirmDelete');
                              if (Platform.OS === 'web') {
                                if (window.confirm(confirmMessage)) {
                                  try {
                                    await deleteDoc(doc(db, 'childActivities', activity.id));
                                    await loadAllActivities();
                                    window.alert(t('activity.deleted'));
                                  } catch (error) {
                                    console.error('Feil ved sletting:', error);
                                    window.alert(t('common.error') + ': ' + error.message);
                                  }
                                }
                              } else {
                                Alert.alert(t('activity.deleteActivity'), confirmMessage, [
                                  { text: t('common.cancel'), style: 'cancel' },
                                  {
                                    text: t('common.delete'),
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await deleteDoc(doc(db, 'childActivities', activity.id));
                                        await loadAllActivities();
                                        Alert.alert(t('common.success'), t('activity.deleted'));
                                      } catch (error) {
                                        console.error('Feil ved sletting:', error);
                                        Alert.alert(t('common.error'), error.message);
                                      }
                                    },
                                  },
                                ]);
                              }
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
            </>
          )}

          <View style={styles.divider} />

          {/* Brukeradministrasjon - kun vis når aktiv */}
          {showUserManagement && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={themeStyles.sectionTitle}>{t('userManagement.title')}</Text>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => setShowUserManagement(!showUserManagement)}
              >
                <Ionicons name={showUserManagement ? "close" : "people"} size={24} color="white" />
                <Text style={styles.addButtonText}>{showUserManagement ? t('admin.close') : t('userManagement.manage')}</Text>
              </TouchableOpacity>
            </View>

            {showUserManagement && (
              <View style={themeStyles.formSection}>
                <Text style={themeStyles.title}>{t('userManagement.createUser')}</Text>
                
                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('userManagement.name')}</Text>
                  <TextInput 
                    style={themeStyles.input} 
                    value={newUserName} 
                    onChangeText={setNewUserName} 
                    placeholder={t('userManagement.namePlaceholder')} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('userManagement.email')}</Text>
                  <TextInput 
                    style={themeStyles.input} 
                    value={newUserEmail} 
                    onChangeText={setNewUserEmail} 
                    placeholder={t('userManagement.emailPlaceholder')} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('userManagement.password')}</Text>
                  <TextInput 
                    style={themeStyles.input} 
                    value={newUserPassword} 
                    onChangeText={setNewUserPassword} 
                    placeholder={t('userManagement.passwordPlaceholder')} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>{t('userManagement.role')}</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[styles.roleButton, newUserRole === 'employee' && styles.roleButtonActive]}
                      onPress={() => {
                        setNewUserRole('employee');
                        setNewUserDepartment('');
                      }}
                    >
                      <Text style={[styles.roleButtonText, newUserRole === 'employee' && styles.roleButtonTextActive]}>
                        {t('userManagement.employee')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleButton, newUserRole === 'parent' && styles.roleButtonActive]}
                      onPress={() => {
                        setNewUserRole('parent');
                        setNewUserDepartment('');
                      }}
                    >
                      <Text style={[styles.roleButtonText, newUserRole === 'parent' && styles.roleButtonTextActive]}>
                        {t('userManagement.parent')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {newUserRole === 'employee' && (
                  <View style={styles.formGroup}>
                    <Text style={themeStyles.label}>{t('userManagement.department')}</Text>
                    <TouchableOpacity
                      style={[themeStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    >
                      <Text style={{ color: newUserDepartment ? (isDarkMode ? '#f3f4f6' : '#1f2937') : (isDarkMode ? '#9ca3af' : '#6b7280') }}>
                        {newUserDepartment || t('userManagement.departmentPlaceholder')}
                      </Text>
                      <Ionicons name={showDepartmentDropdown ? "chevron-up" : "chevron-down"} size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                    {showDepartmentDropdown && (
                      <View style={[styles.dropdown, { backgroundColor: isDarkMode ? '#374151' : 'white', borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }]}>
                        <ScrollView style={{ maxHeight: 200 }}>
                          {loadingDepartments ? (
                            <ActivityIndicator size="small" color="#4f46e5" style={{ padding: 10 }} />
                          ) : departments.length === 0 ? (
                            <Text style={[styles.dropdownItem, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                              Ingen avdelinger opprettet. Opprett en i Avdelinger-menyen.
                            </Text>
                          ) : (
                            departments.map((dept) => (
                              <TouchableOpacity
                                key={dept.id}
                                style={[
                                  styles.dropdownItem,
                                  newUserDepartment === dept.name && styles.dropdownItemSelected,
                                  { backgroundColor: newUserDepartment === dept.name ? (isDarkMode ? '#4b5563' : '#e5e7eb') : 'transparent' }
                                ]}
                                onPress={() => {
                                  setNewUserDepartment(dept.name);
                                  setShowDepartmentDropdown(false);
                                }}
                              >
                                <Text style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{dept.name}</Text>
                                {newUserDepartment === dept.name && (
                                  <Ionicons name="checkmark" size={18} color="#4f46e5" />
                                )}
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateUser} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('userManagement.create')}</Text>}
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={themeStyles.title}>{t('userManagement.users')} ({users.length})</Text>
                
                {loadingUsers ? (
                  <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
                ) : users.length === 0 ? (
                  <Text style={themeStyles.emptyText}>{t('userManagement.noUsers')}</Text>
                ) : (
                  <View style={styles.usersList}>
                    {users.map((userItem) => (
                      <View key={userItem.id} style={themeStyles.childCard}>
                        <View style={styles.userCardHeader}>
                          <View style={styles.userInfo}>
                            <View style={styles.userInfoRow}>
                              <Image 
                                source={{ uri: getAvatar(userItem.imageUrl || userItem.profilePicture, userItem.name || userItem.email, 'user', 200) }} 
                                style={styles.userAvatar}
                              />
                              <View style={styles.userNameContainer}>
                                <Text style={themeStyles.childName}>{userItem.name || userItem.email}</Text>
                                <Text style={themeStyles.childDepartment}>{userItem.email}</Text>
                              </View>
                            </View>
                            <View style={styles.userDetails}>
                              <Text style={themeStyles.detailLabel}>{t('userManagement.role')}: </Text>
                              <Text style={themeStyles.detailValue}>
                                {userItem.role === 'admin' ? t('userManagement.admin') : 
                                 userItem.role === 'employee' ? t('userManagement.employee') : t('userManagement.parent')}
                              </Text>
                              {userItem.department && (
                                <>
                                  <Text style={themeStyles.detailLabel}> | {t('userManagement.department')}: </Text>
                                  <Text style={themeStyles.detailValue}>{userItem.department}</Text>
                                </>
                              )}
                            </View>
                          </View>
                          <View style={styles.userActions}>
                            {userItem.role !== 'admin' && (
                              <>
                                <TouchableOpacity
                                  style={styles.roleChangeButton}
                                  onPress={() => {
                                    const newRole = userItem.role === 'employee' ? 'parent' : 'employee';
                                    handleUpdateUserRole(userItem.id, newRole);
                                  }}
                                >
                                  <Ionicons name="swap-horizontal" size={18} color="#4f46e5" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.deleteButton}
                                  onPress={() => handleDeleteUser(userItem.id, userItem.name || userItem.email)}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                </TouchableOpacity>
                              </>
                            )}
                            {userItem.role === 'admin' && (
                              <Text style={styles.adminBadge}>{t('userManagement.admin')}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {showDepartmentManagement && (
              <View style={themeStyles.formSection}>
                <Text style={themeStyles.title}>Avdelingsadministrasjon</Text>
                <View style={styles.formGroup}>
                  <Text style={themeStyles.label}>Avdelingsnavn</Text>
                  <TextInput 
                    style={themeStyles.input} 
                    value={newDepartmentName} 
                    onChangeText={setNewDepartmentName} 
                    placeholder="F.eks. Solstrålen, Regnbuen" 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateDepartment} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Opprett avdeling</Text>}
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={themeStyles.title}>Avdelinger ({departments.length})</Text>
                
                {loadingDepartments ? (
                  <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
                ) : departments.length === 0 ? (
                  <Text style={themeStyles.emptyText}>Ingen avdelinger opprettet ennå</Text>
                ) : (
                  <View style={styles.usersList}>
                    {departments.map((dept) => (
                      <View key={dept.id} style={themeStyles.childCard}>
                        <View style={styles.userCardHeader}>
                          <View style={styles.userInfo}>
                            <Text style={themeStyles.childName}>{dept.name}</Text>
                            <Text style={themeStyles.childDepartment}>
                              Opprettet: {dept.createdAt?.toDate ? dept.createdAt.toDate().toLocaleDateString('no-NO') : 'Ukjent'}
                            </Text>
                          </View>
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => handleDeleteDepartment(dept.id, dept.name)}
                            >
                              <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
          )}

          <View style={styles.divider} />

          {/* Oversikt per avdeling */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={themeStyles.sectionTitle}>{t('admin.departmentOverview')}</Text>
            </View>
            {(() => {
              // Grupper barn per avdeling
              const childrenByDepartment = {};
              children.forEach(child => {
                const dept = child.department || t('admin.noDepartment');
                if (!childrenByDepartment[dept]) {
                  childrenByDepartment[dept] = {
                    present: [],
                    missing: [],
                    sick: [],
                    pickedUp: []
                  };
                }
                if (child.status === 'checked_in') {
                  childrenByDepartment[dept].present.push(child);
                } else if (child.status === 'sick') {
                  childrenByDepartment[dept].sick.push(child);
                } else if (child.status === 'checked_out') {
                  childrenByDepartment[dept].pickedUp.push(child);
                } else {
                  childrenByDepartment[dept].missing.push(child);
                }
              });

              const departments = Object.keys(childrenByDepartment).sort();
              
              if (departments.length === 0) {
                return <Text style={themeStyles.emptyText}>{t('admin.noDepartments')}</Text>;
              }

              return (
                <View style={styles.departmentOverviewList}>
                  {departments.map((dept) => {
                    const deptData = childrenByDepartment[dept];
                    const total = deptData.present.length + deptData.missing.length + deptData.sick.length + deptData.pickedUp.length;
                    const presentCount = deptData.present.length;
                    const missingCount = deptData.missing.length;
                    const sickCount = deptData.sick.length;
                    const pickedUpCount = deptData.pickedUp.length;

                    return (
                      <View key={dept} style={[themeStyles.childCard, styles.departmentCard]}>
                        <View style={styles.departmentCardHeader}>
                          <Text style={[themeStyles.sectionTitle, { marginBottom: 0 }]}>{dept}</Text>
                          <View style={styles.departmentStats}>
                            <View style={styles.statBadge}>
                              <Text style={styles.statLabel}>{t('admin.total')}:</Text>
                              <Text style={styles.statValue}>{total}</Text>
                            </View>
                          </View>
                        </View>
                        
                        <View style={styles.departmentStatusGrid}>
                          <View style={[styles.statusColumn, styles.statusColumnPresent]}>
                            <Text style={styles.statusColumnTitle}>{t('admin.present')}</Text>
                            <Text style={[styles.statusColumnCount, styles.statusCountPresent]}>{presentCount}</Text>
                            {deptData.present.length > 0 && (
                              <View style={styles.statusChildrenList}>
                                {deptData.present.map(child => (
                                  <TouchableOpacity
                                    key={child.id}
                                    onPress={() => handleViewChildProfile(child.id)}
                                    style={styles.statusChildItem}
                                  >
                                    <Text style={styles.statusChildName}>{child.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>

                          <View style={[styles.statusColumn, styles.statusColumnMissing]}>
                            <Text style={styles.statusColumnTitle}>{t('admin.notCheckedIn')}</Text>
                            <Text style={[styles.statusColumnCount, styles.statusCountMissing]}>{missingCount}</Text>
                            {deptData.missing.length > 0 && (
                              <View style={styles.statusChildrenList}>
                                {deptData.missing.map(child => (
                                  <TouchableOpacity
                                    key={child.id}
                                    onPress={() => handleViewChildProfile(child.id)}
                                    style={styles.statusChildItem}
                                  >
                                    <Text style={styles.statusChildName}>{child.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>

                          {sickCount > 0 && (
                            <View style={[styles.statusColumn, styles.statusColumnSick]}>
                              <Text style={styles.statusColumnTitle}>{t('admin.sick')}</Text>
                              <Text style={[styles.statusColumnCount, styles.statusCountSick]}>{sickCount}</Text>
                              <View style={styles.statusChildrenList}>
                                {deptData.sick.map(child => (
                                  <TouchableOpacity
                                    key={child.id}
                                    onPress={() => handleViewChildProfile(child.id)}
                                    style={styles.statusChildItem}
                                  >
                                    <Text style={styles.statusChildName}>{child.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}

                          {pickedUpCount > 0 && (
                            <View style={[styles.statusColumn, styles.statusColumnPickedUp]}>
                              <Text style={styles.statusColumnTitle}>{t('admin.pickedUp')}</Text>
                              <Text style={[styles.statusColumnCount, styles.statusCountPickedUp]}>{pickedUpCount}</Text>
                              <View style={styles.statusChildrenList}>
                                {deptData.pickedUp.map(child => (
                                  <TouchableOpacity
                                    key={child.id}
                                    onPress={() => handleViewChildProfile(child.id)}
                                    style={styles.statusChildItem}
                                  >
                                    <Text style={styles.statusChildName}>{child.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* Oversikt over barn - kun vis når Barn & Avdelinger er valgt */}
          {showChildrenAndDepartments && !showEmployees && (
            <>
          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={themeStyles.sectionTitle}>{t('admin.allChildren')} ({children.length})</Text>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => setShowForm(!showForm)}
              >
                <Ionicons name={showForm ? "close" : "add"} size={24} color="white" />
                <Text style={styles.addButtonText}>{showForm ? t('admin.close') : t('admin.newChild')}</Text>
              </TouchableOpacity>
            </View>

            {/* Søkefelt */}
            <View style={themeStyles.searchContainer}>
              <Ionicons name="search" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} style={styles.searchIcon} />
              <TextInput
                style={[themeStyles.input, styles.searchInput]}
                placeholder={t('admin.searchPlaceholder')}
                placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                  <Ionicons name="close-circle" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
              )}
            </View>

            {loadingChildren ? (
              <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
            ) : (() => {
              // Filtrer barn basert på søk
              const filteredChildren = searchQuery.trim() === '' 
                ? children 
                : children.filter(child => 
                    (child.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (child.department || '').toLowerCase().includes(searchQuery.toLowerCase())
                  );
              
              if (children.length === 0) {
                return <Text style={themeStyles.emptyText}>{t('admin.noChildren')}</Text>;
              }
              
              if (filteredChildren.length === 0 && searchQuery.trim() !== '') {
                return <Text style={themeStyles.emptyText}>{t('admin.noSearchResults')}</Text>;
              }

              return (
                <View style={styles.childrenList}>
                  {filteredChildren.map((child) => (
                  <View key={child.id} style={themeStyles.childCard}>
                    <TouchableOpacity 
                      onPress={() => handleViewChildProfile(child.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.childCardHeader}>
                        <View style={styles.childInfo}>
                          <View style={styles.childInfoRow}>
                            <View style={styles.childAvatarContainer}>
                              <View style={styles.childAvatarPlaceholder}>
                                <Text style={styles.childAvatarText}>👶</Text>
                              </View>
                              {!failedAvatars.has(child.id) && (
                                <Image 
                                  source={{ uri: getAvatar(child.imageUrl, child.name, 'child', 200) }} 
                                  style={styles.childAvatar}
                                  onError={() => {
                                    console.log('Avatar failed to load for:', child.name);
                                    setFailedAvatars(prev => new Set(prev).add(child.id));
                                  }}
                                />
                              )}
                            </View>
                            <View style={styles.childNameContainer}>
                              <Text style={themeStyles.childName}>{child.name || t('childProfile.noName')}</Text>
                              <Text style={themeStyles.childDepartment}>{child.department || t('childProfile.noDepartment')}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.actionButtons}>
                          {child.status !== 'checked_in' && child.status !== 'sick' && (
                            <TouchableOpacity 
                              style={styles.checkInButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleCheckIn(child.id, child.name || 'barnet');
                              }}
                            >
                              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                            </TouchableOpacity>
                          )}
                          {child.status === 'checked_in' && (
                            <TouchableOpacity 
                              style={styles.checkOutButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleCheckOut(child.id, child.name || 'barnet');
                              }}
                            >
                              <Ionicons name="log-out" size={20} color="#dc2626" />
                            </TouchableOpacity>
                          )}
                          {child.status !== 'sick' && (
                            <TouchableOpacity 
                              style={styles.sickButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleMarkSick(child.id, child.name || 'barnet');
                              }}
                            >
                              <Ionicons name="medical" size={20} color="#f59e0b" />
                            </TouchableOpacity>
                          )}
                          {child.status === 'sick' && (
                            <TouchableOpacity 
                              style={styles.clearSickButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleClearSick(child.id, child.name || 'barnet');
                              }}
                            >
                              <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            style={styles.deleteButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteChild(child.id, child.name || 'barnet');
                            }}
                          >
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.childDetails}>
                        <View style={styles.detailRow}>
                          <Text style={themeStyles.detailLabel}>{t('admin.status')}:</Text>
                          <Text style={[
                            styles.detailValue,
                            styles.statusBadge,
                            child.status === 'checked_in' ? styles.statusIn :
                            child.status === 'checked_out' ? styles.statusOut :
                            child.status === 'sick' ? styles.statusSick :
                            styles.statusNotIn
                          ]}>
                            {child.status === 'checked_in' ? t('admin.present') :
                             child.status === 'checked_out' ? t('admin.pickedUp') :
                             child.status === 'sick' ? t('admin.sick') :
                             t('admin.notCheckedIn')}
                          </Text>
                        </View>
                        {child.allergies && (
                          <View style={styles.detailRow}>
                            <Text style={themeStyles.detailLabel}>{t('admin.allergies')}:</Text>
                            <Text style={themeStyles.detailValue}>{child.allergies}</Text>
                          </View>
                        )}
                        {child.notes && (
                          <View style={styles.detailRow}>
                            <Text style={themeStyles.detailLabel}>{t('admin.notes')}:</Text>
                            <Text style={themeStyles.detailValue}>{child.notes}</Text>
                          </View>
                        )}
                        <View style={styles.detailRow}>
                          <Text style={themeStyles.detailLabel}>{t('admin.parents')}:</Text>
                          <Text style={themeStyles.detailValue}>{child.parentIds?.length || 0} {t('admin.linked')}</Text>
                        </View>
                    </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
            })()}
          </View>
            </>
          )}

          {/* Skjema for å opprette nytt barn - kun vis når Barn & Avdelinger er valgt */}
          {showForm && showChildrenAndDepartments && !showEmployees && (
            <View style={themeStyles.formSection}>
              <Text style={themeStyles.title}>{t('admin.registerChild')}</Text>
              <Text style={themeStyles.subtitle}>{t('admin.linkToParents')}</Text>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('admin.childName')}</Text>
                <TextInput style={themeStyles.input} value={name} onChangeText={setName} placeholder={t('admin.namePlaceholder')} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('admin.department')}</Text>
                <TouchableOpacity
                  style={[themeStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => setShowChildDepartmentDropdown(!showChildDepartmentDropdown)}
                >
                  <Text style={{ color: avdeling ? (isDarkMode ? '#f3f4f6' : '#1f2937') : (isDarkMode ? '#9ca3af' : '#6b7280') }}>
                    {avdeling || t('admin.departmentPlaceholder')}
                  </Text>
                  <Ionicons name={showChildDepartmentDropdown ? "chevron-up" : "chevron-down"} size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
                {showChildDepartmentDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: isDarkMode ? '#374151' : 'white', borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }]}>
                    <ScrollView style={{ maxHeight: 200 }}>
                      {loadingDepartments ? (
                        <ActivityIndicator size="small" color="#4f46e5" style={{ padding: 10 }} />
                      ) : departments.length === 0 ? (
                        <Text style={[styles.dropdownItem, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                          Ingen avdelinger opprettet. Opprett en i Avdelinger-menyen.
                        </Text>
                      ) : (
                        departments.map((dept) => (
                          <TouchableOpacity
                            key={dept.id}
                            style={[
                              styles.dropdownItem,
                              avdeling === dept.name && styles.dropdownItemSelected,
                              { backgroundColor: avdeling === dept.name ? (isDarkMode ? '#4b5563' : '#e5e7eb') : 'transparent' }
                            ]}
                            onPress={() => {
                              setAvdeling(dept.name);
                              setShowChildDepartmentDropdown(false);
                            }}
                          >
                            <Text style={{ color: isDarkMode ? '#f3f4f6' : '#1f2937' }}>{dept.name}</Text>
                            {avdeling === dept.name && (
                              <Ionicons name="checkmark" size={18} color="#4f46e5" />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('admin.allergies')}</Text>
                <TextInput style={themeStyles.input} value={allergies} onChangeText={setAllergies} placeholder={t('admin.allergiesPlaceholder')} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('admin.notes')}</Text>
                <TextInput style={[themeStyles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder={t('admin.notesPlaceholder')} multiline numberOfLines={4} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('admin.childImage')}</Text>
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        setChildImage(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.imagePickerButton}
                    onPress={async () => {
                      // For web - bruk input type="file"
                      if (Platform.OS === 'web') {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              // Komprimer bilde først for raskere opplasting
                              const compressedFile = await compressImage(file);
                              setChildImage(compressedFile);
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setImageUri(event.target.result);
                              };
                              reader.readAsDataURL(compressedFile);
                            } catch (error) {
                              console.error('Feil ved komprimering, bruker original:', error);
                              // Fallback til original fil
                              setChildImage(file);
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setImageUri(event.target.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }
                        };
                        input.click();
                      } else {
                        // For mobile - bruk expo-image-picker (må installeres)
                        Alert.alert('Info', 'Bildeopplasting på mobil krever expo-image-picker. For nå, bruk web-versjonen.');
                      }
                    }}
                  >
                    <Ionicons name="camera-outline" size={24} color="#4f46e5" />
                    <Text style={styles.imagePickerText}>Velg bilde</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              <Text style={themeStyles.label}>{t('admin.addGuardians')}</Text>
              <View style={styles.row}>
                <TextInput 
                  style={[themeStyles.input, {flex: 1, marginBottom: 0}]} 
                  value={emailInput} 
                  onChangeText={setEmailInput} 
                  placeholder="forelder@eksempel.no" 
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addEmail}>
                  <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.chipContainer}>
                {guardianEmails.map((email, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{email}</Text>
                    <TouchableOpacity onPress={() => removeEmail(email)}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateChild} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('admin.createChild')}</Text>}
              </TouchableOpacity>
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
  headerLogo: { width: 50, height: 50, marginRight: 12, borderRadius: 0 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  languageButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  languageButtonText: { fontSize: 18 },
  themeButton: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, ...(Platform.OS === 'web' ? { boxShadow: '0 10px 40px rgba(0,0,0,0.2)' } : { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }) },
  modalScrollView: { maxHeight: Platform.OS === 'web' ? '60vh' : 400 },
  content: { padding: 20, minHeight: Platform.OS === 'web' ? '100vh' : undefined },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', textTransform: 'none', letterSpacing: 0, includeFontPadding: false },
  addButton: { backgroundColor: '#1e40af', borderWidth: 2, borderColor: 'white', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, minWidth: 140, justifyContent: 'center' },
  addButtonText: { color: 'white', marginLeft: 6, fontWeight: '600', fontSize: 16, textAlign: 'left', includeFontPadding: false, flexShrink: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 16,
    borderWidth: 0,
  },
  clearSearchButton: {
    marginLeft: 8,
    padding: 4,
  },
  childrenList: { gap: 12 },
  childCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', ...(Platform.OS === 'web' ? { boxShadow: '0 0 4px rgba(0, 0, 0, 0.05)' } : { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) },
  childCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  childInfo: { flex: 1 },
  childInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  childAvatarContainer: { position: 'relative', width: 60, height: 60 },
  childAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#e5e7eb', position: 'absolute', top: 0, left: 0 },
  childAvatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', position: 'absolute', top: 0, left: 0 },
  childAvatarText: { color: 'white', fontSize: 30 },
  childNameContainer: { flex: 1 },
  childName: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  childDepartment: { fontSize: 14, color: '#6b7280' },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkInButton: { padding: 8 },
  checkOutButton: { padding: 8 },
  sickButton: { padding: 8 },
  clearSickButton: { padding: 8 },
  deleteButton: { padding: 8 },
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
  formSection: { marginTop: 24, padding: 16, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
  addBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: 24 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, marginBottom: 8 },
  chipText: { color: '#1e40af', marginRight: 6, fontWeight: '500' },
  saveBtn: { backgroundColor: '#10b981', padding: 18, borderRadius: 12, alignItems: 'center', ...(Platform.OS === 'web' ? { boxShadow: '0 0 4px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }) },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  imagePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, gap: 8 },
  imagePickerText: { color: '#4f46e5', fontSize: 16, fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', marginTop: 8 },
  imagePreview: { width: 150, height: 150, borderRadius: 8, borderWidth: 2, borderColor: '#e5e7eb' },
  removeImageButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 15 },
  roleSelector: { flexDirection: 'row', gap: 12, marginTop: 8 },
  roleButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center' },
  roleButtonActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  roleButtonText: { color: '#6b7280', fontWeight: '500' },
  roleButtonTextActive: { color: '#4f46e5', fontWeight: 'bold' },
  dropdown: { 
    marginTop: 4, 
    borderWidth: 1, 
    borderRadius: 8, 
    maxHeight: 200,
    zIndex: 1000,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' } : {})
  },
  dropdownItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownItemSelected: { 
    backgroundColor: '#eef2ff' 
  },
  usersList: { marginTop: 16 },
  userCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userInfo: { flex: 1 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e5e7eb' },
  userNameContainer: { flex: 1 },
  userDetails: { flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleChangeButton: { padding: 8, backgroundColor: '#eef2ff', borderRadius: 8 },
  employeeActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statusButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  adminBadge: { padding: 6, backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 12, fontWeight: '600' },
  activityModal: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' },
  activityModalDark: { backgroundColor: '#374151' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  childSelectButton: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', marginBottom: 8 },
  childSelectButtonActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  childSelectText: { color: '#1f2937' },
  childSelectTextActive: { color: '#4f46e5', fontWeight: '600' },
  activitiesListContainer: { marginTop: 12 },
  activityListItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f9fafb', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8,
    borderLeftWidth: 3,
    gap: 12
  },
  activityListIconContainer: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  activityListInfo: { flex: 1 },
  activityListLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  activityListDetails: { fontSize: 12, color: '#6b7280' },
  activityListNotes: { fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' },
  menuButton: { padding: 8, marginRight: 8 },
  logoutBtn: { padding: 8 },
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  sidebar: {
    width: 280,
    backgroundColor: 'white',
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 8px rgba(0, 0, 0, 0.2)' } : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }),
  },
  sidebarDark: { backgroundColor: '#312e81' },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  sidebarContent: { padding: 12, flex: 1 },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  sidebarItemText: { fontSize: 16, fontWeight: '500', color: '#1f2937' },
  sidebarSection: { marginTop: 16, marginBottom: 8 },
  sidebarSectionTitle: { 
    fontSize: 12, 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 16,
    marginTop: 8
  },
  departmentOverviewList: { gap: 16 },
  departmentCard: { marginBottom: 0 },
  departmentCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  departmentStats: { flexDirection: 'row', gap: 8 },
  statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280', textAlign: 'left', includeFontPadding: false },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', textAlign: 'left', includeFontPadding: false },
  departmentStatusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statusColumn: { 
    flex: 1, 
    minWidth: 150, 
    backgroundColor: '#f9fafb', 
    borderRadius: 8, 
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statusColumnPresent: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  statusColumnMissing: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  statusColumnSick: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  statusColumnPickedUp: { borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  statusColumnTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'left', includeFontPadding: false, width: '100%' },
  statusColumnCount: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'left', includeFontPadding: false },
  statusCountPresent: { color: '#10b981' },
  statusCountMissing: { color: '#ef4444' },
  statusCountSick: { color: '#f59e0b' },
  statusCountPickedUp: { color: '#3b82f6' },
  statusChildrenList: { gap: 4 },
  statusChildItem: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'white', borderRadius: 6, marginBottom: 4 },
  statusChildName: { fontSize: 12, color: '#1f2937' },
  departmentsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  departmentInfo: { flex: 1 },
  departmentStatsRow: { 
    flexDirection: 'row', 
    gap: 16, 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb' 
  },
  departmentStatItem: { 
    alignItems: 'center', 
    flex: 1,
    minWidth: 0, // Forhindrer overflow
    paddingHorizontal: 4
  },
  departmentStatValue: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  departmentStatLabel: { 
    fontSize: 11, 
    color: '#6b7280', 
    fontWeight: '500',
    textTransform: 'none',
    letterSpacing: 0,
    textAlign: 'center',
    width: '100%',
    flexWrap: 'wrap',
    includeFontPadding: false
  },
  dashboardSection: { marginBottom: 24 },
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    marginBottom: 20 
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 })
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0,
    textAlign: 'left',
    includeFontPadding: false,
    width: '100%'
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'left',
    includeFontPadding: false
  },
  avatarOverview: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)' } : { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 })
  },
  avatarOverviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start'
  },
  avatarItem: {
    alignItems: 'center',
    width: 80
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden'
  },
  avatarPlaceholderSmall: {
    borderWidth: 3
  },
  avatarSmall: {
    width: 60,
    height: 60,
    borderRadius: 30
  },
  avatarTextSmall: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  avatarName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 80
  },
  moreChildrenText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic'
  },
});