import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, serverTimestamp, query, where, getDocs, collection, deleteDoc, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
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
import { db, storage } from '../config/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Image } from 'react-native';
import { getAvatar } from '../utils/avatarHelper';
import { handleFirebaseError } from '../utils/errorHandler';

/**
 * ChildProfileScreen - Profilskjerm for et spesifikt barn
 * 
 * Funksjoner:
 * - Vis barnets informasjon (navn, avdeling, allergier, notater)
 * - Vis og rediger samtykkeskjema (foto, deling, kontaktpersoner, hentepersoner)
 * - Kontakt foreldre (telefon, e-post)
 * - Last opp profilbilde
 * - Se aktiviteter for barnet
 * 
 * @component
 */
export default function ChildProfileScreen() {
  const { user, role } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { childId } = route.params || {};
  const { t } = useTranslation();
  
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [childName, setChildName] = useState('');
  const [childDepartment, setChildDepartment] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [editingParents, setEditingParents] = useState(false);
  const [parentEmailInput, setParentEmailInput] = useState('');
  const [parentEmails, setParentEmails] = useState([]);
  const [parentData, setParentData] = useState([]); // Lagrer full parent info (email, phone, name)
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [childImage, setChildImage] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Samtykkeskjema
  const [consentForm, setConsentForm] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [editingConsent, setEditingConsent] = useState(false);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [consentSharePhotos, setConsentSharePhotos] = useState(false);
  const [contactPerson, setContactPerson] = useState({ name: '', phone: '', relation: '' });
  const [pickupPersons, setPickupPersons] = useState([{ name: '', phone: '', relation: '' }]);

  useEffect(() => {
    if (childId) {
      loadChild();
      loadConsentForm();
    } else {
      console.error('ChildProfileScreen: childId mangler');
      if (Platform.OS === 'web') {
        window.alert('Feil: Barn-ID mangler');
      } else {
        Alert.alert('Feil', 'Barn-ID mangler');
      }
      navigation.goBack();
    }
  }, [childId]);

  // Sanntidsoppdatering for aktiviteter
  useEffect(() => {
    if (!childId) return;

    setLoadingActivities(true);
    let checkInOutUnsubscribe = null;
    let activitiesUnsubscribe = null;
    let checkInOutActivities = [];
    let childActivities = [];

    const updateCombinedActivities = () => {
      const combined = [...checkInOutActivities, ...childActivities];
      combined.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      setActivities(combined);
      setLoadingActivities(false);
    };

    try {
      // Sanntidsoppdatering for check-in/out logger (uten orderBy for å unngå index-feil)
      const checkInOutQuery = query(
        collection(db, 'checkInOutLogs'),
        where('childId', '==', childId)
      );
      
      checkInOutUnsubscribe = onSnapshot(checkInOutQuery, (snapshot) => {
        checkInOutActivities = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          checkInOutActivities.push({
            id: doc.id,
            type: data.action === 'check_in' ? 'check_in' : 'check_out',
            timestamp: data.timestamp,
            userId: data.userId,
            activityType: data.action
          });
        });
        updateCombinedActivities();
      }, (error) => {
        console.warn('Sanntidsoppdatering for check-in/out feilet, bruker manuell oppdatering:', error);
        // Fallback til manuell oppdatering hvis sanntid feiler
        setLoadingActivities(false);
      });
        
      // Sanntidsoppdatering for childActivities (uten orderBy)
      const activitiesQuery = query(
        collection(db, 'childActivities'),
        where('childId', '==', childId)
      );
      
      activitiesUnsubscribe = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
        childActivities = [];
        activitiesSnapshot.forEach((doc) => {
          const data = doc.data();
          childActivities.push({
            id: doc.id,
            type: data.activityType,
            timestamp: data.timestamp,
            userId: data.userId,
            notes: data.notes || '',
            activityType: data.activityType
          });
        });
        updateCombinedActivities();
      }, (error) => {
        console.warn('Sanntidsoppdatering for aktiviteter feilet, bruker manuell oppdatering:', error);
        setLoadingActivities(false);
      });
    } catch (error) {
      console.error('Feil ved oppsett av sanntidsoppdatering:', error);
      setLoadingActivities(false);
    }

    // Cleanup ved unmount eller når childId endres
    return () => {
      if (checkInOutUnsubscribe) checkInOutUnsubscribe();
      if (activitiesUnsubscribe) activitiesUnsubscribe();
    };
  }, [childId]);

  const loadParentEmails = async (parentIds) => {
    try {
      const emails = [];
      const parentInfo = [];
      for (const parentId of parentIds) {
        const userDoc = await getDoc(doc(db, 'users', parentId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          emails.push(userData.email || parentId);
          parentInfo.push({
            id: parentId,
            email: userData.email || '',
            phone: userData.phone || '',
            name: userData.name || userData.email || 'Forelder'
          });
        }
      }
      setParentEmails(emails);
      setParentData(parentInfo);
    } catch (error) {
      handleFirebaseError(error, 'lasting av foreldre-e-post', { showAlert: false, logError: true });
    }
  };

  // loadActivities er nå erstattet av sanntidsoppdatering i useEffect over

  const handleDiaperChange = async () => {
    try {
      await addDoc(collection(db, 'childActivities'), {
        childId: childId,
        userId: user.uid,
        activityType: 'diaper_change',
        timestamp: serverTimestamp(),
        notes: ''
      });
      
      // Sanntidsoppdatering vil automatisk oppdatere dashboard
      
      if (Platform.OS === 'web') {
        window.alert(t('activity.diaperChangeRegistered', { defaultValue: 'Bleieskift registrert!' }));
      } else {
        Alert.alert(t('common.success'), t('activity.diaperChangeRegistered', { defaultValue: 'Bleieskift registrert!' }));
      }
    } catch (error) {
      console.error('Feil ved registrering av bleieskift:', error);
      if (Platform.OS === 'web') {
        window.alert(`${t('common.error')}: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `${t('activity.diaperChangeError', { defaultValue: 'Kunne ikke registrere bleieskift' })}: ${error.message}`);
      }
    }
  };

  const handleImagePicker = () => {
    // For web - bruk input type="file"
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          // Komprimer bilde først for raskere opplasting
          try {
            const compressedFile = await compressImage(file);
            setChildImage(compressedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
              setImageUri(event.target.result);
              // Last opp komprimert bilde umiddelbart
              handleImageUpload(compressedFile, event.target.result);
            };
            reader.readAsDataURL(compressedFile);
          } catch (error) {
            console.error('Feil ved komprimering, bruker original:', error);
            // Fallback til original fil hvis komprimering feiler
            setChildImage(file);
            const reader = new FileReader();
            reader.onload = (event) => {
              setImageUri(event.target.result);
              handleImageUpload(file, event.target.result);
            };
            reader.readAsDataURL(file);
          }
        }
      };
      input.click();
    } else {
      // For mobile - bruk expo-image-picker (må installeres)
      Alert.alert(t('common.info', { defaultValue: 'Info' }), t('childProfile.mobileImageUpload', { defaultValue: 'Bildeopplasting på mobil krever expo-image-picker. For nå, bruk web-versjonen.' }));
    }
  };

  // Hjelpefunksjon for å komprimere bilde
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
        // For web, bruk window.Image (DOM Image constructor)
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

  const handleImageUpload = async (file, uri) => {
    setUploadingImage(true);
    try {
      let imageUrl = null;
      
      // Prøv Firebase Storage først (hvis tilgjengelig)
      try {
        const imageRef = ref(storage, `children/${childId}_${Date.now()}.jpg`);
        // Bruk filen direkte hvis den finnes, ellers fetch fra URI
        let blob;
        if (file && file instanceof File) {
          blob = file;
        } else {
          const response = await fetch(uri);
          blob = await response.blob();
        }
        
        // Last opp med timeout (kortere timeout for raskere fallback)
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
        let base64String = uri;
        if (!base64String.startsWith('data:image')) {
          // Hvis vi har en File, konverter til Base64
          if (file instanceof File) {
            base64String = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
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
      
      // Oppdater barnet med ny bilde-URL (enten Storage URL eller Base64)
      await updateDoc(doc(db, 'children', childId), {
        imageUrl: imageUrl,
        updatedAt: serverTimestamp(),
      });
      
      // Oppdater lokal state
      setChild({ ...child, imageUrl });
      setChildImage(null);
      setImageUri(null);
      
      if (Platform.OS === 'web') {
        window.alert('Bilde lastet opp!');
      } else {
        Alert.alert('Suksess', 'Bilde lastet opp!');
      }
    } catch (error) {
      console.error('Feil ved bilde-opplasting:', error);
      let errorMessage = `Kunne ikke laste opp bilde: ${error.message}`;
      if (error.message && error.message.includes('for stort')) {
        errorMessage = 'Bildet er for stort. Prøv med et mindre bilde.';
      } else if (error.code === 'storage/retry-limit-exceeded' || error.code === 'storage/unauthorized') {
        errorMessage = 'Firebase Storage ikke tilgjengelig. Bildet vil bli lagret lokalt i databasen (gratis løsning).';
      }
      
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${errorMessage}`);
      } else {
        Alert.alert('Feil', errorMessage);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const loadChild = async () => {
    if (!childId) {
      console.error('loadChild: childId er undefined');
      setLoading(false);
      if (Platform.OS === 'web') {
        window.alert('Feil: Barn-ID mangler');
      } else {
        Alert.alert('Feil', 'Barn-ID mangler');
      }
      navigation.goBack();
      return;
    }
    
    try {
      setLoading(true);
      const childDoc = await getDoc(doc(db, 'children', childId));
      if (childDoc.exists()) {
        const childData = { id: childDoc.id, ...childDoc.data() };
        setChild(childData);
        setChildName(childData.name || '');
        setChildDepartment(childData.department || '');
        setAllergies(childData.allergies || '');
        setNotes(childData.notes || '');
        // Hent e-postadresser for foreldre
        try {
          if (childData.parentIds && childData.parentIds.length > 0) {
            await loadParentEmails(childData.parentIds);
          } else {
            setParentEmails([]);
            setParentData([]);
          }
        } catch (parentError) {
          handleFirebaseError(parentError, 'lasting av foreldre', { showAlert: false, logError: true });
          setParentEmails([]);
          setParentData([]);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(t('childProfile.childNotFound', { defaultValue: 'Barn ikke funnet' }));
        } else {
          Alert.alert(t('common.error'), t('childProfile.childNotFound', { defaultValue: 'Barn ikke funnet' }));
        }
        navigation.goBack();
      }
    } catch (error) {
      const errorMessage = handleFirebaseError(error, 'lasting av barn', { showAlert: false, logError: true });
      if (errorMessage && error.code === 'permission-denied' && !error.message?.includes('blocked')) {
        const alertMessage = 'Du har ikke tilgang til å se dette barnet.';
        if (Platform.OS === 'web') {
          window.alert(`Feil: ${alertMessage}`);
        } else {
          Alert.alert('Feil', alertMessage);
        }
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updateData = {
        updatedAt: serverTimestamp(),
      };

      // Hvis vi redigerer basic info (navn/avdeling)
      if (editingBasicInfo) {
        if (!childName.trim()) {
          Alert.alert(t('common.error'), 'Navn kan ikke være tomt.');
          return;
        }
        if (!childDepartment.trim()) {
          Alert.alert(t('common.error'), 'Avdeling kan ikke være tom.');
          return;
        }
        updateData.name = childName.trim();
        updateData.department = childDepartment.trim();
      }

      // Hvis vi redigerer allergies/notes
      if (editing) {
        updateData.allergies = allergies;
        updateData.notes = notes;
      }

      await updateDoc(doc(db, 'children', childId), updateData);
      
      // Oppdater lokal state
      setChild({ 
        ...child, 
        ...(editingBasicInfo ? { name: childName.trim(), department: childDepartment.trim() } : {}),
        ...(editing ? { allergies, notes } : {})
      });
      
      setEditing(false);
      setEditingBasicInfo(false);
      
      if (Platform.OS === 'web') {
        window.alert(t('childProfile.changesSaved'));
      } else {
        Alert.alert(t('common.success'), t('childProfile.changesSaved'));
      }
    } catch (error) {
      console.error('Feil ved lagring:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke lagre: ${error.message}`);
      }
    }
  };

  const handleCheckIn = async () => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        status: 'checked_in',
        lastCheckIn: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'check_in',
        timestamp: serverTimestamp(),
      });
      
      loadChild();
      // Sanntidsoppdatering vil automatisk oppdatere dashboard
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childCheckedIn', { name: child.name }));
      } else {
        Alert.alert(t('common.success'), t('admin.childCheckedIn', { name: child.name }));
      }
    } catch (error) {
      console.error('Feil ved check-in:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke krysse inn: ${error.message}`);
      }
    }
  };

  const handleCheckOut = async () => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        status: 'checked_out',
        lastCheckOut: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, 'checkInOutLogs'), {
        childId: childId,
        userId: user.uid,
        action: 'check_out',
        timestamp: serverTimestamp(),
      });
      
      loadChild();
      // Sanntidsoppdatering vil automatisk oppdatere dashboard
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childCheckedOut', { name: child.name }));
      } else {
        Alert.alert(t('common.success'), t('admin.childCheckedOut', { name: child.name }));
      }
    } catch (error) {
      console.error('Feil ved check-out:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke krysse ut: ${error.message}`);
      }
    }
  };

  const handleMarkSick = async () => {
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
      
      loadChild();
      // Sanntidsoppdatering vil automatisk oppdatere
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.childMarkedSick', { name: child.name }));
      } else {
        Alert.alert(t('common.success'), t('admin.childMarkedSick', { name: child.name }));
      }
    } catch (error) {
      console.error('Feil ved markering som syk:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke markere som syk: ${error.message}`);
      }
    }
  };

  const handleClearSick = async () => {
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
      
      loadChild();
      // Sanntidsoppdatering vil automatisk oppdatere
      
      if (Platform.OS === 'web') {
        window.alert(t('admin.sickCleared', { name: child.name }));
      } else {
        Alert.alert(t('common.success'), t('admin.sickCleared', { name: child.name }));
      }
    } catch (error) {
      console.error('Feil ved fjerning av syk-status:', error);
      if (Platform.OS === 'web') {
        window.alert(`Feil: ${error.message}`);
      } else {
        Alert.alert('Feil', `Kunne ikke fjerne syk-status: ${error.message}`);
      }
    }
  };

  const handleAddParent = async () => {
    if (!parentEmailInput.trim()) {
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), 'E-postadresse må fylles ut.');
      } else {
        Alert.alert(t('common.error'), 'E-postadresse må fylles ut.');
      }
      return;
    }

    const email = parentEmailInput.trim().toLowerCase();
    setLoading(true);
    try {
      // Finn bruker med denne e-postadressen
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        if (Platform.OS === 'web') {
          window.alert(t('common.error'), t('childProfile.parentNotFound'));
        } else {
          Alert.alert(t('common.error'), t('childProfile.parentNotFound'));
        }
        setLoading(false);
        return;
      }

      const userId = userSnapshot.docs[0].id;
      const currentParentIds = child.parentIds || [];
      
      if (currentParentIds.includes(userId)) {
        if (Platform.OS === 'web') {
          window.alert(t('common.error'), 'Denne forelderen er allerede knyttet til barnet.');
        } else {
          Alert.alert(t('common.error'), 'Denne forelderen er allerede knyttet til barnet.');
        }
        setLoading(false);
        return;
      }

      // Legg til forelder
      await updateDoc(doc(db, 'children', childId), {
        parentIds: [...currentParentIds, userId],
        updatedAt: serverTimestamp(),
      });

      setParentEmailInput('');
      await loadChild(); // Reload for å oppdatere visningen
      
      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('childProfile.parentAdded'));
      } else {
        Alert.alert(t('common.success'), t('childProfile.parentAdded'));
      }
    } catch (error) {
      console.error('Feil ved tilknytning av forelder:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), `Kunne ikke legge til forelder: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `Kunne ikke legge til forelder: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCallParent = (parent) => {
    if (!parent.phone) {
      if (Platform.OS === 'web') {
        window.alert(t('childProfile.noPhone'), t('childProfile.noPhoneMessage', { name: parent.name }));
      } else {
        Alert.alert(t('childProfile.noPhone'), t('childProfile.noPhoneMessage', { name: parent.name }));
      }
      return;
    }

    // Bekreftelsesdialog
    const confirmMessage = Platform.OS === 'web'
      ? `Ring ${parent.name} (${parent.phone})?`
      : t('childProfile.callParentConfirm', { name: parent.name, phone: parent.phone });
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        const phoneNumber = parent.phone.replace(/\s/g, ''); // Fjern mellomrom
        const telUrl = `tel:${phoneNumber}`;
        window.location.href = telUrl;
      }
    } else {
      Alert.alert(
        t('childProfile.callParent'),
        confirmMessage,
        [
          {
            text: t('common.cancel'),
            style: 'cancel'
          },
          {
            text: t('childProfile.call'),
            style: 'default',
            onPress: () => {
              // Åpne telefon-appen
              const phoneNumber = parent.phone.replace(/\s/g, ''); // Fjern mellomrom
              const telUrl = `tel:${phoneNumber}`;
              
              Linking.canOpenURL(telUrl)
                .then((supported) => {
                  if (supported) {
                    return Linking.openURL(telUrl);
                  } else {
                    Alert.alert(t('common.error'), t('childProfile.cannotOpenPhone', { phone: parent.phone }));
                  }
                })
                .catch((error) => {
                  console.error('Feil ved åpning av telefon:', error);
                  Alert.alert(t('common.error'), t('childProfile.callError', { phone: parent.phone }));
                });
            }
          }
        ],
        { cancelable: true }
      );
    }
  };

  const handleEmailParent = (parent) => {
    if (!parent.email) {
      if (Platform.OS === 'web') {
        window.alert(t('childProfile.noEmail'), t('childProfile.noEmailMessage', { name: parent.name }));
      } else {
        Alert.alert(t('childProfile.noEmail'), t('childProfile.noEmailMessage', { name: parent.name }));
      }
      return;
    }

    // Bekreftelsesdialog
    const confirmMessage = Platform.OS === 'web' 
      ? `Send e-post til ${parent.name} (${parent.email})?`
      : t('childProfile.emailParentConfirm', { name: parent.name, email: parent.email });
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        const subject = encodeURIComponent(t('childProfile.emailSubject', { childName: child?.name || t('childProfile.noName') }));
        const body = encodeURIComponent(t('childProfile.emailBody', { childName: child?.name || t('childProfile.noName') }));
        const mailtoUrl = `mailto:${parent.email}?subject=${subject}&body=${body}`;
        window.location.href = mailtoUrl;
      }
    } else {
      Alert.alert(
        t('childProfile.emailParent'),
        confirmMessage,
        [
          {
            text: t('common.cancel'),
            style: 'cancel'
          },
          {
            text: t('childProfile.sendEmail'),
            style: 'default',
            onPress: () => {
              // Åpne e-post-klienten
              const subject = encodeURIComponent(t('childProfile.emailSubject', { childName: child?.name || t('childProfile.noName') }));
              const body = encodeURIComponent(t('childProfile.emailBody', { childName: child?.name || t('childProfile.noName') }));
              const mailtoUrl = `mailto:${parent.email}?subject=${subject}&body=${body}`;
              
              Linking.canOpenURL(mailtoUrl)
                .then((supported) => {
                  if (supported) {
                    return Linking.openURL(mailtoUrl);
                  } else {
                    Alert.alert(t('common.error'), t('childProfile.cannotOpenEmail', { email: parent.email }));
                  }
                })
                .catch((error) => {
                  console.error('Feil ved åpning av e-post:', error);
                  Alert.alert(t('common.error'), t('childProfile.emailError', { email: parent.email }));
                });
            }
          }
        ],
        { cancelable: true }
      );
    }
  };

  const handleMessageParent = (parent) => {
    if (!parent.phone) {
      if (Platform.OS === 'web') {
        window.alert(t('childProfile.noPhone'), t('childProfile.noPhoneMessage', { name: parent.name }));
      } else {
        Alert.alert(t('childProfile.noPhone'), t('childProfile.noPhoneMessage', { name: parent.name }));
      }
      return;
    }

    // Bekreftelsesdialog
    const confirmMessage = Platform.OS === 'web'
      ? `Send SMS til ${parent.name} (${parent.phone})?`
      : t('childProfile.messageParentConfirm', { name: parent.name, phone: parent.phone });
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        const message = encodeURIComponent(t('childProfile.messageBody', { childName: child?.name || t('childProfile.noName') }));
        const smsUrl = `sms:${parent.phone}?body=${message}`;
        window.location.href = smsUrl;
      }
    } else {
      Alert.alert(
        t('childProfile.messageParent'),
        confirmMessage,
        [
          {
            text: t('common.cancel'),
            style: 'cancel'
          },
          {
            text: t('childProfile.sendMessage'),
            style: 'default',
            onPress: () => {
              // Åpne SMS-appen
              const message = encodeURIComponent(t('childProfile.messageBody', { childName: child?.name || t('childProfile.noName') }));
              const phoneNumber = parent.phone.replace(/\s/g, ''); // Fjern mellomrom
              const smsUrl = `sms:${phoneNumber}?body=${message}`;
              
              Linking.canOpenURL(smsUrl)
                .then((supported) => {
                  if (supported) {
                    return Linking.openURL(smsUrl);
                  } else {
                    Alert.alert(t('common.error'), t('childProfile.cannotOpenSMS', { phone: parent.phone }));
                  }
                })
                .catch((error) => {
                  console.error('Feil ved åpning av SMS:', error);
                  Alert.alert(t('common.error'), t('childProfile.messageError', { phone: parent.phone }));
                });
            }
          }
        ],
        { cancelable: true }
      );
    }
  };

  // Håndter hentepersoner i samtykkeskjema
  const handleAddPickupPerson = () => {
    setPickupPersons([...pickupPersons, { name: '', phone: '', relation: '' }]);
  };

  const handleUpdatePickupPerson = (index, field, value) => {
    const updated = [...pickupPersons];
    updated[index] = { ...updated[index], [field]: value };
    setPickupPersons(updated);
  };

  const handleRemovePickupPerson = (index) => {
    if (pickupPersons.length > 1) {
      setPickupPersons(pickupPersons.filter((_, i) => i !== index));
    }
  };

  // Last inn samtykkeskjema
  const loadConsentForm = async () => {
    if (!childId) return;
    
    try {
      const consentQuery = query(
        collection(db, 'consentForms'),
        where('childId', '==', childId)
      );
      const snapshot = await getDocs(consentQuery);
      
      if (!snapshot.empty) {
        const consentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setConsentForm(consentData);
        setConsentPhoto(consentData.photoConsent || false);
        setConsentSharePhotos(consentData.sharePhotosConsent || false);
        setContactPerson(consentData.contactPerson || { name: '', phone: '', relation: '' });
        setPickupPersons(consentData.pickupPersons?.length > 0 ? consentData.pickupPersons : [{ name: '', phone: '', relation: '' }]);
      }
    } catch (error) {
      handleFirebaseError(error, 'lasting av samtykkeskjema', { showAlert: false, logError: true });
    }
  };

  // Lagre samtykkeskjema
  const handleSaveConsentForm = async () => {
    if (!contactPerson.name.trim()) {
      Alert.alert(t('common.error'), 'Kontaktpersonens navn må fylles ut.');
      return;
    }

    setLoading(true);
    try {
      const consentData = {
        childId: childId,
        photoConsent: consentPhoto,
        sharePhotosConsent: consentSharePhotos,
        contactPerson: contactPerson,
        pickupPersons: pickupPersons.filter(p => p.name.trim() || p.phone.trim() || p.relation.trim()),
        allergies: child?.allergies || '',
        updatedAt: serverTimestamp(),
      };

      if (consentForm?.id) {
        // Oppdater eksisterende
        await updateDoc(doc(db, 'consentForms', consentForm.id), consentData);
      } else {
        // Opprett nytt
        consentData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'consentForms'), consentData);
      }

      await loadConsentForm();
      setEditingConsent(false);
      
      if (Platform.OS === 'web') {
        window.alert(t('common.success'), 'Samtykkeskjema lagret!');
      } else {
        Alert.alert(t('common.success'), 'Samtykkeskjema lagret!');
      }
    } catch (error) {
      console.error('Feil ved lagring av samtykkeskjema:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), `Kunne ikke lagre: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `Kunne ikke lagre: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Slett samtykkeskjema
  const handleDeleteConsentForm = async () => {
    if (!consentForm?.id) {
      return;
    }

    const confirmMessage = 'Er du sikker på at du vil slette samtykkeskjemaet?';
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        try {
          await deleteDoc(doc(db, 'consentForms', consentForm.id));
          setConsentForm(null);
          setConsentPhoto(false);
          setConsentSharePhotos(false);
          setContactPerson({ name: '', phone: '', relation: '' });
          setPickupPersons([{ name: '', phone: '', relation: '' }]);
          setShowConsentModal(false);
          setEditingConsent(false);
          window.alert('Samtykkeskjema slettet!');
        } catch (error) {
          console.error('Feil ved sletting av samtykkeskjema:', error);
          window.alert(`Kunne ikke slette: ${error.message}`);
        }
      }
    } else {
      Alert.alert('Slett samtykkeskjema?', confirmMessage, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'consentForms', consentForm.id));
              setConsentForm(null);
              setConsentPhoto(false);
              setConsentSharePhotos(false);
              setContactPerson({ name: '', phone: '', relation: '' });
              setPickupPersons([{ name: '', phone: '', relation: '' }]);
              setShowConsentModal(false);
              setEditingConsent(false);
              Alert.alert(t('common.success'), 'Samtykkeskjema slettet!');
            } catch (error) {
              console.error('Feil ved sletting av samtykkeskjema:', error);
              Alert.alert(t('common.error'), `Kunne ikke slette: ${error.message}`);
            }
          },
        },
      ]);
    }
  };

  const handleRemoveParent = async (parentId) => {
    setLoading(true);
    try {
      const currentParentIds = child.parentIds || [];
      const updatedParentIds = currentParentIds.filter(id => id !== parentId);

      await updateDoc(doc(db, 'children', childId), {
        parentIds: updatedParentIds,
        updatedAt: serverTimestamp(),
      });

      await loadChild(); // Reload for å oppdatere visningen
      
      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('childProfile.parentRemoved'));
      } else {
        Alert.alert(t('common.success'), t('childProfile.parentRemoved'));
      }
    } catch (error) {
      console.error('Feil ved fjerning av forelder:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), `Kunne ikke fjerne forelder: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `Kunne ikke fjerne forelder: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Barn ikke funnet</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Tilbake</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.name || t('childProfile.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={Platform.OS === 'web' ? { flex: 1, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' } : { flex: 1 }}
        contentContainerStyle={[
          styles.content, 
          { paddingBottom: 40 },
          Platform.OS === 'web' ? { paddingBottom: 60 } : { flexGrow: 1 }
        ]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        scrollEnabled={true}
        alwaysBounceVertical={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.avatar}
              onPress={handleImagePicker}
              disabled={uploadingImage}
            >
              <Image 
                source={{ uri: getAvatar(child.imageUrl, child.name, 'child', 200) }} 
                style={styles.avatarImage}
              />
              {uploadingImage && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color="white" />
                </View>
              )}
              {(role === 'admin' || role === 'employee' || (role === 'parent' && child.parentIds?.includes(user.uid))) && !uploadingImage && (
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <View style={styles.profileInfoRow}>
                {editingBasicInfo && role === 'admin' ? (
                  <TextInput
                    style={[styles.input, styles.nameInput]}
                    value={childName}
                    onChangeText={setChildName}
                    placeholder={t('admin.childName')}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.profileName}>{child.name || t('childProfile.noName')}</Text>
                )}
                {role === 'admin' && (
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingBasicInfo(!editingBasicInfo);
                      if (!editingBasicInfo) {
                        setChildName(child.name || '');
                        setChildDepartment(child.department || '');
                      }
                    }}
                    style={styles.editIconButton}
                  >
                    <Ionicons name={editingBasicInfo ? "close" : "create-outline"} size={20} color="#4f46e5" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.profileInfoRow}>
                {editingBasicInfo && role === 'admin' ? (
                  <TextInput
                    style={[styles.input, styles.departmentInput]}
                    value={childDepartment}
                    onChangeText={setChildDepartment}
                    placeholder={t('admin.department')}
                  />
                ) : (
                  <Text style={styles.profileDepartment}>{child.department || t('childProfile.noDepartment', { defaultValue: 'Ingen avdeling' })}</Text>
                )}
              </View>
              {editingBasicInfo && role === 'admin' && (
                <TouchableOpacity 
                  style={styles.saveBasicInfoButton}
                  onPress={handleSave}
                  disabled={loading}
                >
                  <Text style={styles.saveBasicInfoButtonText}>{t('childProfile.saveChanges')}</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.statusBadge, 
                child.status === 'checked_in' ? styles.statusIn : 
                child.status === 'checked_out' ? styles.statusOut : 
                styles.statusNotIn
              ]}>
                <Text style={styles.statusText}>
                  {child.status === 'checked_in' ? t('admin.present') : 
                   child.status === 'checked_out' ? t('admin.pickedUp') : 
                   t('admin.notCheckedIn')}
                </Text>
              </View>
            </View>
          </View>

          {/* Check-in/out knapper for admin og employee */}
          {(role === 'admin' || role === 'employee') && (
            <View style={styles.actionButtons}>
              {child.status !== 'checked_in' && child.status !== 'sick' && (
                <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn}>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.checkInBtnText}>{t('admin.checkIn')}</Text>
                </TouchableOpacity>
              )}
              {child.status === 'checked_in' && (
                <TouchableOpacity style={styles.checkOutBtn} onPress={handleCheckOut}>
                  <Ionicons name="log-out" size={20} color="white" />
                  <Text style={styles.checkOutBtnText}>{t('admin.checkOut')}</Text>
                </TouchableOpacity>
              )}
              {child.status === 'sick' && (
                <TouchableOpacity style={styles.clearSickBtn} onPress={handleClearSick}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                  <Text style={styles.clearSickBtnText}>{t('admin.clearSick')}</Text>
                </TouchableOpacity>
              )}
              {child.status !== 'sick' && (
                <TouchableOpacity style={styles.sickBtn} onPress={handleMarkSick}>
                  <Ionicons name="medical" size={20} color="white" />
                  <Text style={styles.sickBtnText}>{t('admin.markSick')}</Text>
                </TouchableOpacity>
              )}
              {/* Bleieskift-knapp */}
              <TouchableOpacity style={styles.diaperChangeBtn} onPress={handleDiaperChange}>
                <Ionicons name="water" size={20} color="white" />
                <Text style={styles.diaperChangeBtnText}>{t('activity.diaperChange')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* Dashboard - Aktivitetsoversikt */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Aktivitetsoversikt</Text>
              <TouchableOpacity onPress={() => setShowDashboard(!showDashboard)}>
                <Ionicons name={showDashboard ? "chevron-up" : "chevron-down"} size={20} color="#4f46e5" />
              </TouchableOpacity>
            </View>
            
            {showDashboard && (
              <View style={styles.dashboardContainer}>
                {loadingActivities ? (
                  <ActivityIndicator size="small" color="#4f46e5" />
                ) : activities.length === 0 ? (
                  <Text style={styles.emptyDashboardText}>Ingen aktiviteter registrert ennå</Text>
                ) : (
                  <View style={styles.activitiesList}>
                    {activities.slice(0, 10).map((activity, index) => {
                      const time = activity.timestamp?.toDate?.() || new Date();
                      const timeStr = time.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = time.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
                      
                      let activityLabel = '';
                      let activityIcon = '';
                      let activityColor = '#6b7280';
                      
                      switch(activity.activityType || activity.type) {
                        case 'check_in':
                          activityLabel = 'Krysset inn';
                          activityIcon = 'checkmark-circle';
                          activityColor = '#059669';
                          break;
                        case 'check_out':
                          activityLabel = 'Hentet';
                          activityIcon = 'log-out';
                          activityColor = '#059669';
                          break;
                        case 'diaper_change':
                          activityLabel = t('activity.diaperChange');
                          activityIcon = 'water';
                          activityColor = '#3b82f6';
                          break;
                        case 'special_event':
                          activityLabel = activity.notes || 'Spesiell hendelse';
                          activityIcon = 'star';
                          activityColor = '#f59e0b';
                          break;
                        default:
                          activityLabel = 'Ukjent aktivitet';
                          activityIcon = 'help-circle';
                          activityColor = '#6b7280';
                      }
                      
                      // Sjekk om aktiviteten kan slettes (alle unntatt check_in og check_out)
                      const canDelete = activity.id && 
                                       (activity.activityType || activity.type) !== 'check_in' && 
                                       (activity.activityType || activity.type) !== 'check_out';
                      
                      return (
                        <View key={activity.id || index} style={styles.activityItem}>
                          <View style={[styles.activityIconContainer, { backgroundColor: activityColor + '20' }]}>
                            <Ionicons name={activityIcon} size={20} color={activityColor} />
                          </View>
                          <View style={styles.activityInfo}>
                            <Text style={styles.activityLabel}>{activityLabel}</Text>
                            <Text style={styles.activityTime}>{dateStr} {timeStr}</Text>
                            {/* Vis aktivitetstype for debugging hvis ukjent */}
                            {activityLabel === 'Ukjent aktivitet' && (activity.activityType || activity.type) && (
                              <Text style={[styles.activityTime, { fontSize: 10, color: '#9ca3af', marginTop: 4 }]}>
                                Type: {activity.activityType || activity.type}
                              </Text>
                            )}
                          </View>
                          {role === 'admin' && canDelete && (
                            <TouchableOpacity
                              style={styles.deleteActivityButton}
                              onPress={async () => {
                                if (!activity.id) {
                                  Alert.alert('Feil', 'Aktivitet mangler ID - kan ikke slettes');
                                  return;
                                }
                                
                                const confirmMessage = `Er du sikker på at du vil slette denne aktiviteten?`;
                                if (Platform.OS === 'web') {
                                  if (window.confirm(confirmMessage)) {
                                    try {
                                      await deleteDoc(doc(db, 'childActivities', activity.id));
                                      // Sanntidsoppdatering vil automatisk oppdatere listen
                                      window.alert('Aktivitet slettet!');
                                    } catch (error) {
                                      console.error('Feil ved sletting:', error);
                                      handleFirebaseError(error, 'sletting av aktivitet', { showAlert: true, logError: true });
                                    }
                                  }
                                } else {
                                  Alert.alert('Slett aktivitet?', confirmMessage, [
                                    { text: 'Avbryt', style: 'cancel' },
                                    {
                                      text: 'Slett',
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          await deleteDoc(doc(db, 'childActivities', activity.id));
                                          // Sanntidsoppdatering vil automatisk oppdatere listen
                                          Alert.alert('Suksess', 'Aktivitet slettet!');
                                        } catch (error) {
                                          console.error('Feil ved sletting:', error);
                                          handleFirebaseError(error, 'sletting av aktivitet', { showAlert: true, logError: true });
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
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Samtykkeskjema */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.consentButton}
              onPress={() => setShowConsentModal(true)}
            >
              <Ionicons name="document-text" size={24} color="#4f46e5" />
              <Text style={styles.consentButtonText}>{t('consent.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Allergier */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('childProfile.allergies')}</Text>
              {(role === 'admin' || role === 'employee') && (
                <TouchableOpacity onPress={() => {
                  if (editing) {
                    // Hvis vi avslutter redigering uten å lagre, nullstill endringer
                    setAllergies(child.allergies || '');
                    setNotes(child.notes || '');
                  }
                  setEditing(!editing);
                }}>
                  <Ionicons name={editing ? "close" : "create-outline"} size={20} color="#4f46e5" />
                </TouchableOpacity>
              )}
            </View>
            {editing ? (
              <>
                <TextInput
                  style={styles.input}
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder={t('childProfile.allergiesPlaceholder')}
                  multiline
                  autoFocus
                />
                <TouchableOpacity 
                  style={[styles.saveButton, styles.saveButtonSmall]} 
                  onPress={handleSave}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>{t('childProfile.saveChanges')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.sectionContent}>
                {child.allergies || t('childProfile.noAllergies')}
              </Text>
            )}
          </View>

          {/* Notater */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('childProfile.notes')}</Text>
              {(role === 'admin' || role === 'employee') && (
                <TouchableOpacity onPress={() => {
                  if (editing) {
                    // Hvis vi avslutter redigering uten å lagre, nullstill endringer
                    setAllergies(child.allergies || '');
                    setNotes(child.notes || '');
                  }
                  setEditing(!editing);
                }}>
                  <Ionicons name={editing ? "close" : "create-outline"} size={20} color="#4f46e5" />
                </TouchableOpacity>
              )}
            </View>
            {editing ? (
              <>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('childProfile.notesPlaceholder')}
                  multiline
                  numberOfLines={4}
                />
                {!allergies && (
                  <TouchableOpacity 
                    style={[styles.saveButton, styles.saveButtonSmall]} 
                    onPress={handleSave}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.saveButtonText}>{t('childProfile.saveChanges')}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.sectionContent}>
                {child.notes || t('childProfile.noNotes')}
              </Text>
            )}
          </View>

          {/* Foreldre */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('childProfile.parents')}</Text>
              {role === 'admin' && (
                <TouchableOpacity onPress={() => setEditingParents(!editingParents)}>
                  <Ionicons name={editingParents ? "close" : "create-outline"} size={20} color="#4f46e5" />
                </TouchableOpacity>
              )}
            </View>
            
            {editingParents && role === 'admin' ? (
              <View>
                <Text style={styles.sectionContent}>
                  {t('childProfile.parentCount', { count: child.parentIds?.length || 0 })}
                </Text>
                
                {/* Liste over foreldre */}
                {parentData.length > 0 && (
                  <View style={styles.parentList}>
                    {parentData.map((parent, index) => (
                      <View key={parent.id || index} style={styles.parentItem}>
                        <View style={styles.parentInfo}>
                          <Text style={styles.parentName}>{parent.name}</Text>
                          <Text style={styles.parentEmail}>{parent.email}</Text>
                          {parent.phone && (
                            <Text style={styles.parentPhone}>{parent.phone}</Text>
                          )}
                        </View>
                        <View style={styles.parentActions}>
                          {parent.phone && (
                            <TouchableOpacity 
                              style={styles.callButton}
                              onPress={() => handleCallParent(parent)}
                            >
                              <Ionicons name="call" size={20} color="#059669" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            style={styles.removeParentButton}
                            onPress={() => handleRemoveParent(parent.id)}
                          >
                            <Ionicons name="close-circle" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Legg til ny forelder */}
                <View style={styles.addParentContainer}>
                  <Text style={styles.label}>{t('childProfile.addParentEmail')}</Text>
                  <View style={styles.addParentRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={parentEmailInput}
                      onChangeText={setParentEmailInput}
                      placeholder={t('childProfile.addParentEmail')}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <TouchableOpacity 
                      style={styles.addParentButton}
                      onPress={handleAddParent}
                      disabled={loading}
                    >
                      <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionContent}>
                  {t('childProfile.parentCount', { count: child.parentIds?.length || 0 })}
                </Text>
                
                {/* Kontaktbokser for ansatte og admin */}
                {(role === 'admin' || role === 'employee') && parentData.length > 0 && (
                  <View style={styles.parentContactList}>
                    {parentData.map((parent, index) => (
                      <View key={parent.id || index} style={styles.parentContactBox}>
                        <View style={styles.parentContactHeader}>
                          <Text style={styles.parentContactName}>{parent.name}</Text>
                          {parent.email && (
                            <Text style={styles.parentContactEmail}>{parent.email}</Text>
                          )}
                          {parent.phone && (
                            <Text style={styles.parentContactPhone}>{parent.phone}</Text>
                          )}
                        </View>
                        <View style={styles.parentContactButtons}>
                          {parent.phone && (
                            <TouchableOpacity
                              style={[styles.contactButton, styles.callButton]}
                              onPress={() => handleCallParent(parent)}
                            >
                              <Ionicons name="call" size={18} color="white" />
                              <Text style={styles.contactButtonText}>{t('childProfile.call')}</Text>
                            </TouchableOpacity>
                          )}
                          {parent.email && (
                            <TouchableOpacity
                              style={[styles.contactButton, styles.emailButton]}
                              onPress={() => handleEmailParent(parent)}
                            >
                              <Ionicons name="mail" size={18} color="white" />
                              <Text style={styles.contactButtonText}>{t('childProfile.email')}</Text>
                            </TouchableOpacity>
                          )}
                          {parent.phone && (
                            <TouchableOpacity
                              style={[styles.contactButton, styles.messageButton]}
                              onPress={() => handleMessageParent(parent)}
                            >
                              <Ionicons name="chatbubble" size={18} color="white" />
                              <Text style={styles.contactButtonText}>{t('childProfile.message')}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                    {parentData.length === 0 && (
                      <Text style={styles.noPhoneText}>Ingen foreldre knyttet til dette barnet</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Samtykkeskjema Modal */}
      <Modal
        visible={showConsentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowConsentModal(false);
          setEditingConsent(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('consent.title')}</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {role === 'admin' && consentForm?.id && (
                  <TouchableOpacity
                    onPress={handleDeleteConsentForm}
                    style={styles.deleteConsentButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setShowConsentModal(false);
                    setEditingConsent(false);
                  }}
                >
                  <Ionicons name="close" size={24} color="#1f2937" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {editingConsent || role === 'admin' ? (
                <>
                  {/* Bildefotografering */}
                  <View style={styles.consentField}>
                    <Text style={styles.consentLabel}>{t('consent.photoConsent')}</Text>
                    <View style={styles.toggleContainer}>
                      <TouchableOpacity
                        style={[styles.toggleButton, consentPhoto && styles.toggleButtonActive]}
                        onPress={() => setConsentPhoto(true)}
                      >
                        <Text style={[styles.toggleText, consentPhoto && styles.toggleTextActive]}>{t('consent.yes')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleButton, !consentPhoto && styles.toggleButtonActive]}
                        onPress={() => setConsentPhoto(false)}
                      >
                        <Text style={[styles.toggleText, !consentPhoto && styles.toggleTextActive]}>{t('consent.no')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Deling av bilder */}
                  <View style={styles.consentField}>
                    <Text style={styles.consentLabel}>{t('consent.sharePhotosConsent')}</Text>
                    <View style={styles.toggleContainer}>
                      <TouchableOpacity
                        style={[styles.toggleButton, consentSharePhotos && styles.toggleButtonActive]}
                        onPress={() => setConsentSharePhotos(true)}
                      >
                        <Text style={[styles.toggleText, consentSharePhotos && styles.toggleTextActive]}>{t('consent.yes')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleButton, !consentSharePhotos && styles.toggleButtonActive]}
                        onPress={() => setConsentSharePhotos(false)}
                      >
                        <Text style={[styles.toggleText, !consentSharePhotos && styles.toggleTextActive]}>{t('consent.no')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Kontaktperson */}
                  <View style={styles.consentField}>
                    <Text style={styles.consentLabel}>{t('consent.contactPerson')} *</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 12 }]}
                      placeholder={t('consent.contactPersonName')}
                      value={contactPerson.name}
                      onChangeText={(text) => setContactPerson({ ...contactPerson, name: text })}
                    />
                    <TextInput
                      style={[styles.input, { marginBottom: 12 }]}
                      placeholder={t('consent.contactPersonPhone')}
                      value={contactPerson.phone}
                      onChangeText={(text) => setContactPerson({ ...contactPerson, phone: text })}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('consent.contactPersonRelation')}
                      value={contactPerson.relation}
                      onChangeText={(text) => setContactPerson({ ...contactPerson, relation: text })}
                    />
                  </View>

                  {/* Hentepersoner */}
                  <View style={styles.consentField}>
                    <View style={styles.fieldHeader}>
                      <Text style={styles.consentLabel}>{t('consent.pickupPersons')}</Text>
                      <TouchableOpacity onPress={handleAddPickupPerson} style={styles.addButton}>
                        <Ionicons name="add-circle" size={24} color="#4f46e5" />
                      </TouchableOpacity>
                    </View>
                    {pickupPersons.map((person, index) => (
                      <View key={index} style={styles.pickupPersonCard}>
                        <View style={styles.pickupPersonHeader}>
                          <Text style={styles.pickupPersonNumber}>Henteperson {index + 1}</Text>
                          {pickupPersons.length > 1 && (
                            <TouchableOpacity
                              onPress={() => handleRemovePickupPerson(index)}
                              style={styles.removeButton}
                            >
                              <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <TextInput
                          style={styles.input}
                          placeholder={t('consent.pickupPersonName')}
                          value={person.name}
                          onChangeText={(text) => handleUpdatePickupPerson(index, 'name', text)}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder={t('consent.pickupPersonPhone')}
                          value={person.phone}
                          onChangeText={(text) => handleUpdatePickupPerson(index, 'phone', text)}
                          keyboardType="phone-pad"
                        />
                        <TextInput
                          style={styles.input}
                          placeholder={t('consent.pickupPersonRelation')}
                          value={person.relation}
                          onChangeText={(text) => handleUpdatePickupPerson(index, 'relation', text)}
                        />
                      </View>
                    ))}
                  </View>

                  {/* Allergier (lenket fra barnet) */}
                  <View style={styles.consentField}>
                    <Text style={styles.consentLabel}>{t('consent.allergies')}</Text>
                    <Text style={styles.allergiesText}>{child?.allergies || t('consent.noAllergies')}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveConsentForm}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                // Visning for foreldre
                <>
                  <View style={styles.consentViewItem}>
                    <Text style={styles.consentViewLabel}>{t('consent.photoConsent')}</Text>
                    <Text style={styles.consentViewValue}>{consentForm.photoConsent ? t('consent.yes') : t('consent.no')}</Text>
                  </View>
                  <View style={styles.consentViewItem}>
                    <Text style={styles.consentViewLabel}>{t('consent.sharePhotosConsent')}</Text>
                    <Text style={styles.consentViewValue}>{consentForm.sharePhotosConsent ? t('consent.yes') : t('consent.no')}</Text>
                  </View>
                  {consentForm.contactPerson?.name && (
                    <>
                      <View style={styles.consentViewItem}>
                        <Text style={styles.consentViewLabel}>{t('consent.contactPerson')}</Text>
                        <Text style={styles.consentViewValue}>{consentForm.contactPerson.name}</Text>
                      </View>
                      {consentForm.contactPerson.phone && (
                        <View style={styles.consentViewItem}>
                          <Text style={styles.consentViewLabel}>{t('consent.contactPersonPhone')}</Text>
                          <Text style={styles.consentViewValue}>{consentForm.contactPerson.phone}</Text>
                        </View>
                      )}
                      {consentForm.contactPerson.relation && (
                        <View style={styles.consentViewItem}>
                          <Text style={styles.consentViewLabel}>{t('consent.contactPersonRelation')}</Text>
                          <Text style={styles.consentViewValue}>{consentForm.contactPerson.relation}</Text>
                        </View>
                      )}
                    </>
                  )}
                  {consentForm.pickupPersons?.length > 0 && (
                    <View style={styles.consentViewItem}>
                      <Text style={styles.consentViewLabel}>{t('consent.pickupPersons')}</Text>
                      {consentForm.pickupPersons.map((person, index) => (
                        <View key={index} style={styles.pickupPersonView}>
                          <Text style={styles.consentViewValue}>{person.name}</Text>
                          {person.phone && <Text style={styles.consentViewSubValue}>{person.phone}</Text>}
                          {person.relation && <Text style={styles.consentViewSubValue}>{person.relation}</Text>}
                        </View>
                      ))}
                    </View>
                  )}
                  {consentForm.allergies && (
                    <View style={styles.consentViewItem}>
                      <Text style={styles.consentViewLabel}>{t('consent.allergies')}</Text>
                      <Text style={styles.consentViewValue}>{consentForm.allergies}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9fafb',
    ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {})
  },
  header: {
    backgroundColor: '#111827',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonHeader: { padding: 8 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  content: { padding: 20, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 16 },
  errorText: { color: '#ef4444', fontSize: 16, marginBottom: 20 },
  backButton: { backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: 'white', fontWeight: '600' },
  profileCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, ...(Platform.OS === 'web' ? { boxShadow: '0 0 4px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }) },
  profileHeader: { flexDirection: 'row', marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginRight: 16, position: 'relative', overflow: 'hidden' }, avatarImage: { width: 80, height: 80, borderRadius: 40 }, avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 40, justifyContent: 'center', alignItems: 'center' }, avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#059669', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  avatarText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  profileInfo: { flex: 1, justifyContent: 'center' },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  profileName: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', flex: 1 },
  nameInput: { fontSize: 24, fontWeight: 'bold', flex: 1, marginBottom: 0 },
  profileDepartment: { fontSize: 16, color: '#6b7280', flex: 1 },
  departmentInput: { fontSize: 16, flex: 1, marginBottom: 0 },
  editIconButton: { padding: 4, marginLeft: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusIn: { backgroundColor: '#d1fae5', color: '#065f46' }, // Til stede - grønn
  statusOut: { backgroundColor: '#d1fae5', color: '#065f46' }, // Hentet - grønn
  statusNotIn: { backgroundColor: '#fee2e2', color: '#991b1b' }, // Ikke krysset inn - rød
  statusSick: { backgroundColor: '#fed7aa', color: '#9a3412' }, // Syk - oransj
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  checkInBtn: { flex: 1, backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  checkInBtnText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  checkOutBtn: { flex: 1, backgroundColor: '#dc2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  checkOutBtnText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  sickBtn: { flex: 1, backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  sickBtnText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  clearSickBtn: { flex: 1, backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  clearSickBtnText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  diaperChangeBtn: { flex: 1, backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  diaperChangeBtnText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  sectionContent: { fontSize: 16, color: '#374151', lineHeight: 24 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1f2937' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#4f46e5', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center' },
  saveButtonSmall: { padding: 12, marginTop: 8 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  saveBasicInfoButton: { backgroundColor: '#4f46e5', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, alignSelf: 'flex-start' },
  saveBasicInfoButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  parentList: { marginTop: 12, marginBottom: 16 },
  parentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 8 },
  parentInfo: { flex: 1 },
  parentName: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  parentEmail: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  parentPhone: { fontSize: 14, color: '#059669', fontWeight: '500' },
  parentActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callButton: { padding: 8, backgroundColor: '#d1fae5', borderRadius: 8 },
  removeParentButton: { padding: 4 },
  parentCallList: { marginTop: 16, gap: 12 },
  callParentButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', padding: 16, borderRadius: 12, gap: 12 },
  callParentInfo: { flex: 1 },
  callParentName: { fontSize: 16, fontWeight: '600', color: 'white', marginBottom: 4 },
  callParentPhone: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  parentContactList: { marginTop: 16, gap: 12 },
  parentContactBox: { 
    backgroundColor: '#f9fafb', 
    borderRadius: 12, 
    padding: 16, 
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 })
  },
  parentContactHeader: { marginBottom: 12 },
  parentContactName: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  parentContactEmail: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  parentContactPhone: { fontSize: 14, color: '#059669', fontWeight: '500' },
  parentContactButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  contactButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  emailButton: {
    backgroundColor: '#3b82f6',
  },
  messageButton: {
    backgroundColor: '#8b5cf6',
  },
  callButton: {
    backgroundColor: '#059669',
  },
  consentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 })
  },
  consentButtonText: { fontSize: 16, fontWeight: '600', color: '#1f2937', flex: 1 },
  noPhoneText: { fontSize: 14, color: '#6b7280', fontStyle: 'italic', marginTop: 8 },
  addParentContainer: { marginTop: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  addParentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addParentButton: { backgroundColor: '#4f46e5', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dashboardContainer: { marginTop: 12 },
  emptyDashboardText: { fontSize: 14, color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  activitiesList: { gap: 8 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, gap: 12 },
  activityIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  activityInfo: { flex: 1, justifyContent: 'center' },
  activityLabel: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4, textAlign: 'left', includeFontPadding: false },
  activityTime: { fontSize: 12, color: '#6b7280', textAlign: 'left', includeFontPadding: false },
  deleteActivityButton: { padding: 8, marginLeft: 8 },
  addActivityButton: { padding: 4 },
  // Modal stiler
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {})
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: Platform.OS === 'web' ? '90vh' : '90%',
    height: Platform.OS === 'web' ? 'auto' : '90%',
    width: Platform.OS === 'web' ? '90%' : '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    ...(Platform.OS === 'web' ? { borderRadius: 20 } : {})
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Consent form stiler
  consentField: {
    marginBottom: 24,
  },
  consentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: 'white',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    padding: 8,
  },
  pickupPersonCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickupPersonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupPersonNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  pickupPersonRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  removeButton: {
    padding: 8,
  },
  allergiesText: {
    fontSize: 16,
    color: '#374151',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  consentViewItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  consentViewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  consentViewValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  consentViewSubValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  pickupPersonView: {
    marginTop: 8,
    paddingLeft: 12,
  },
  deleteConsentButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
});

