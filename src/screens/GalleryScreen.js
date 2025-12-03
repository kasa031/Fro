import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * GalleryScreen - Bildegalleri for deling av bilder
 * 
 * Funksjoner:
 * - Se bilder organisert i album (per dag eller avdeling)
 * - Last opp bilder (kun ansatte og admin)
 * - Slette bilder (kun admin)
 * - GDPR-godkjenning (sjekk samtykkeskjema før visning)
 * 
 * @component
 */
export default function GalleryScreen() {
  const { user, role } = useAuth();
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { department, date } = route.params || {};
  const { t } = useTranslation();
  
  const [albums, setAlbums] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDate, setNewAlbumDate] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);

  useEffect(() => {
    loadAlbums();
  }, []);

  useEffect(() => {
    if (selectedAlbum) {
      loadImages(selectedAlbum.id);
    }
  }, [selectedAlbum]);

  /**
   * Henter alle album fra Firestore
   */
  const loadAlbums = async () => {
    try {
      setLoading(true);
      const albumsRef = collection(db, 'photoAlbums');
      let q;
      
      // Filtrer på avdeling hvis ansatt (ikke bruk orderBy sammen med where for å unngå indeks)
      if (role === 'employee' && department) {
        q = query(albumsRef, where('department', '==', department));
      } else {
        // For admin, hent alle album uten orderBy
        q = query(albumsRef);
      }
      
      const querySnapshot = await getDocs(q);
      const albumsList = [];
      querySnapshot.forEach((doc) => {
        albumsList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sorter i JavaScript i stedet (nyeste først)
      albumsList.sort((a, b) => {
        const aDate = a.date ? new Date(a.date) : new Date(0);
        const bDate = b.date ? new Date(b.date) : new Date(0);
        return bDate - aDate; // Nyeste først
      });
      
      setAlbums(albumsList);
      
      // Auto-select første album hvis ingen er valgt
      if (albumsList.length > 0 && !selectedAlbum) {
        setSelectedAlbum(albumsList[0]);
      }
    } catch (error) {
      console.error('Feil ved lasting av album:', error);
      if (Platform.OS === 'web') {
        window.alert(t('gallery.loadAlbumsError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('gallery.loadAlbumsError', { error: error.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Henter bilder fra et album
   */
  const loadImages = async (albumId) => {
    try {
      setLoading(true);
      const imagesRef = collection(db, 'photos');
      // Bruk kun where (ikke orderBy) for å unngå behov for sammensatt indeks
      const q = query(imagesRef, where('albumId', '==', albumId));
      const querySnapshot = await getDocs(q);
      
      const imagesList = [];
      querySnapshot.forEach((doc) => {
        imagesList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sorter i JavaScript i stedet (nyeste først)
      imagesList.sort((a, b) => {
        const aTime = a.uploadedAt?.toDate?.() || a.uploadedAt || new Date(0);
        const bTime = b.uploadedAt?.toDate?.() || b.uploadedAt || new Date(0);
        return bTime - aTime; // Nyeste først
      });
      
      setImages(imagesList);
    } catch (error) {
      console.error('Feil ved lasting av bilder:', error);
      if (Platform.OS === 'web') {
        window.alert(t('gallery.loadImagesError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('gallery.loadImagesError', { error: error.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Oppretter et nytt album
   */
  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !newAlbumDate.trim()) {
      Alert.alert(t('common.error'), t('gallery.albumNameAndDateRequired'));
      return;
    }

    try {
      // Hent ansattes avdeling hvis ansatt
      let albumDepartment = department;
      if (role === 'employee' && !albumDepartment) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        albumDepartment = userDoc.data()?.department;
      }

      await addDoc(collection(db, 'photoAlbums'), {
        name: newAlbumName.trim(),
        date: newAlbumDate,
        department: albumDepartment || null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('gallery.albumCreated'));
      } else {
        Alert.alert(t('common.success'), t('gallery.albumCreated'));
      }

      setShowUploadModal(false);
      setNewAlbumName('');
      setNewAlbumDate('');
      loadAlbums();
    } catch (error) {
      console.error('Feil ved opprettelse av album:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), t('gallery.createAlbumError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('gallery.createAlbumError', { error: error.message }));
      }
    }
  };

  /**
   * Håndterer bildeopplasting (bruker Base64 fallback siden Storage ikke er tilgjengelig)
   */
  const handleImageUpload = async (file) => {
    if (!selectedAlbum) {
      Alert.alert(t('common.error'), t('gallery.selectAlbumFirst'));
      return;
    }

    setUploading(true);
    try {
      // Komprimer bilde først
      const compressedFile = await compressImage(file);
      
      // Konverter til Base64 (gratis løsning uten Storage)
      let base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
      
      // Sjekk størrelse (Firestore har 1MB grense per dokument)
      const base64Size = (base64String.length * 3) / 4; // Estimert størrelse i bytes
      if (base64Size > 900000) { // 900KB for å være trygg
        throw new Error('Bildet er for stort etter komprimering. Prøv med et mindre bilde.');
      }
      
      // Opprett unik filnavn
      const fileName = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      // Lagre Base64 direkte i Firestore (gratis løsning)
      await addDoc(collection(db, 'photos'), {
        albumId: selectedAlbum.id,
        url: base64String, // Lagre Base64 i stedet for Storage URL
        fileName: fileName,
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
      });

      if (Platform.OS === 'web') {
        window.alert(t('common.success'), t('gallery.imageUploaded'));
      } else {
        Alert.alert(t('common.success'), t('gallery.imageUploaded'));
      }

      loadImages(selectedAlbum.id);
    } catch (error) {
      console.error('Feil ved bildeopplasting:', error);
      if (Platform.OS === 'web') {
        window.alert(t('common.error'), t('gallery.uploadError', { error: error.message }));
      } else {
        Alert.alert(t('common.error'), t('gallery.uploadError', { error: error.message }));
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Komprimerer bilde før opplasting
   */
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'web') {
        resolve(file);
        return;
      }
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

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
            0.8
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  /**
   * Sletter et bilde (admin og ansatte kan slette)
   */
  const handleDeleteImage = async (imageId, imageUrl, fileName) => {
    // Kun admin og ansatte kan slette bilder (ikke foreldre)
    if (role !== 'admin' && role !== 'employee') {
      if (Platform.OS === 'web') {
        window.alert('Kun ansatte og administratorer kan slette bilder.');
      } else {
        Alert.alert(t('common.error'), 'Kun ansatte og administratorer kan slette bilder.');
      }
      return;
    }

    // For web, bruk custom modal (Alert.alert støtter ikke knapper på web)
    if (Platform.OS === 'web') {
      setImageToDelete({ id: imageId, url: imageUrl, fileName });
      setShowDeleteModal(true);
      return;
    }

    // For mobile, bruk Alert.alert
    Alert.alert(
      t('gallery.deleteImageConfirm'),
      t('gallery.deleteImageMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await performDeleteImage(imageId);
          },
        },
      ]
    );
  };

  const performDeleteImage = async (imageId) => {
    try {
      // Slett fra Firestore (bildet er lagret som Base64, så vi trenger ikke slette fra Storage)
      await deleteDoc(doc(db, 'photos', imageId));
      
      loadImages(selectedAlbum.id);
      setShowDeleteModal(false);
      setImageToDelete(null);
      
      if (Platform.OS === 'web') {
        window.alert(t('gallery.imageDeleted'));
      } else {
        Alert.alert(t('common.success'), t('gallery.imageDeleted'));
      }
    } catch (error) {
      console.error('Feil ved sletting av bilde:', error);
      setShowDeleteModal(false);
      setImageToDelete(null);
      if (Platform.OS === 'web') {
        window.alert(t('common.error') + ': ' + error.message);
      } else {
        Alert.alert(t('common.error'), error.message);
      }
    }
  };

  /**
   * Håndterer filvalg (web)
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    } else {
      Alert.alert(t('common.error'), t('gallery.invalidImageFile'));
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

  // Dark mode styles
  const themeStyles = {
    container: { ...styles.container, backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb' },
    content: { ...styles.content, backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb' },
    sectionTitle: { ...styles.sectionTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    albumCard: { ...styles.albumCard, backgroundColor: isDarkMode ? '#374151' : 'white', borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' },
    albumName: { ...styles.albumName, color: isDarkMode ? '#d1d5db' : '#6b7280' },
    albumDate: { ...styles.albumDate, color: isDarkMode ? '#9ca3af' : '#9ca3af' },
    emptyText: { ...styles.emptyText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
    modal: { ...styles.modal, backgroundColor: isDarkMode ? '#374151' : 'white' },
    modalTitle: { ...styles.modalTitle, color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    label: { ...styles.label, color: isDarkMode ? '#d1d5db' : '#374151' },
    input: { ...styles.input, backgroundColor: isDarkMode ? '#4b5563' : 'white', borderColor: isDarkMode ? '#6b7280' : '#d1d5db', color: isDarkMode ? '#f3f4f6' : '#1f2937' },
    helperText: { ...styles.helperText, color: isDarkMode ? '#9ca3af' : '#6b7280' },
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
          <Text style={styles.headerTitle}>{t('gallery.title')}</Text>
        </View>
        {(role === 'admin' || role === 'employee') && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowUploadModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      <View style={themeStyles.content}>
        {/* Album-liste */}
        <View style={styles.albumsSection}>
          <Text style={themeStyles.sectionTitle}>{t('gallery.albums')}</Text>
          {loading && albums.length === 0 ? (
            <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />
          ) : albums.length === 0 ? (
            <Text style={themeStyles.emptyText}>{t('gallery.noAlbums')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumsScroll}>
              {albums.map((album) => (
                <TouchableOpacity
                  key={album.id}
                  style={[
                    themeStyles.albumCard,
                    selectedAlbum?.id === album.id && styles.albumCardActive
                  ]}
                  onPress={() => setSelectedAlbum(album)}
                >
                  <Ionicons 
                    name="images" 
                    size={32} 
                    color={selectedAlbum?.id === album.id ? '#4f46e5' : (isDarkMode ? '#9ca3af' : '#6b7280')} 
                  />
                  <Text style={[
                    themeStyles.albumName,
                    selectedAlbum?.id === album.id && styles.albumNameActive
                  ]}>
                    {album.name}
                  </Text>
                  <Text style={themeStyles.albumDate}>{formatDate(album.date)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Bildegalleri */}
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <Text style={themeStyles.sectionTitle}>
              {selectedAlbum ? selectedAlbum.name : t('gallery.selectAlbum')}
            </Text>
            {selectedAlbum && (role === 'admin' || role === 'employee') && (
              <View style={styles.uploadButtonContainer}>
                {Platform.OS === 'web' ? (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      id="image-upload-input"
                      disabled={uploading}
                    />
                    <TouchableOpacity
                      style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                      onPress={() => document.getElementById('image-upload-input').click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={20} color="white" />
                          <Text style={styles.uploadButtonText}>{t('gallery.uploadImage')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                    disabled={uploading}
                  >
                    <Text style={styles.uploadButtonText}>
                      {t('gallery.mobileUploadNote')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {loading && images.length === 0 ? (
            <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 40 }} />
          ) : !selectedAlbum ? (
            <Text style={themeStyles.emptyText}>{t('gallery.selectAlbumToView')}</Text>
          ) : images.length === 0 ? (
            <Text style={themeStyles.emptyText}>{t('gallery.noImages')}</Text>
          ) : (
            <ScrollView style={styles.galleryGrid}>
              <View style={styles.imageGrid}>
                {images.map((image) => (
                  <TouchableOpacity
                    key={image.id}
                    style={styles.imageCard}
                    onPress={() => {
                      setSelectedImage(image);
                      setShowImageModal(true);
                    }}
                  >
                    <Image
                      source={{ uri: image.url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                    {(role === 'admin' || role === 'employee') && (
                      <TouchableOpacity
                        style={styles.deleteImageButton}
                        onPress={() => handleDeleteImage(image.id, image.url, image.fileName)}
                      >
                        <Ionicons name="trash-outline" size={18} color="white" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Modal for å opprette album */}
      <Modal
        visible={showUploadModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowUploadModal(false);
          setNewAlbumName('');
          setNewAlbumDate('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={themeStyles.modal}>
            <View style={styles.modalHeader}>
              <Text style={themeStyles.modalTitle}>{t('gallery.createAlbum')}</Text>
              <TouchableOpacity onPress={() => {
                setShowUploadModal(false);
                setNewAlbumName('');
                setNewAlbumDate('');
              }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#f3f4f6' : '#1f2937'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('gallery.albumName')} *</Text>
                <TextInput
                  style={themeStyles.input}
                  placeholder={t('gallery.albumNamePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#9ca3af'}
                  value={newAlbumName}
                  onChangeText={setNewAlbumName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={themeStyles.label}>{t('gallery.albumDate')} *</Text>
                <TextInput
                  style={themeStyles.input}
                  placeholder={t('gallery.datePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#9ca3af'}
                  value={newAlbumDate}
                  onChangeText={setNewAlbumDate}
                />
                <Text style={themeStyles.helperText}>{t('gallery.dateFormat')}</Text>
              </View>

              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleCreateAlbum}
              >
                <Text style={styles.saveButtonText}>{t('gallery.createAlbum')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={themeStyles.cancelButton} 
                onPress={() => {
                  setShowUploadModal(false);
                  setNewAlbumName('');
                  setNewAlbumDate('');
                }}
              >
                <Text style={themeStyles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal for å vise bilde i full størrelse */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setSelectedImage(null);
        }}
      >
        <TouchableOpacity
          style={styles.imageModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <View style={styles.imageModalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.closeImageButton}
              onPress={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
            >
              <Ionicons name="close-circle" size={32} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal for å bekrefte sletting av bilde (web) */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setImageToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModal, isDarkMode && styles.deleteModalDark]}>
            <Text style={[styles.deleteModalTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
              {t('gallery.deleteImageConfirm')}
            </Text>
            <Text style={[styles.deleteModalMessage, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              {t('gallery.deleteImageMessage')}
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setImageToDelete(null);
                }}
              >
                <Text style={styles.deleteModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDeleteButton]}
                onPress={() => {
                  if (imageToDelete) {
                    performDeleteImage(imageToDelete.id);
                  }
                }}
              >
                <Text style={styles.deleteModalDeleteText}>{t('common.delete')}</Text>
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
  albumsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  albumsScroll: { marginHorizontal: -20 },
  albumCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 120,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  albumCardActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  albumName: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginTop: 8, textAlign: 'center' },
  albumNameActive: { color: '#4f46e5' },
  albumDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  gallerySection: { flex: 1 },
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  uploadButtonContainer: { flexDirection: 'row', gap: 8 },
  uploadButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  galleryGrid: { flex: 1 },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  deleteImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 16,
    padding: 6,
  },
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
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  saveButton: { backgroundColor: '#059669', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#e5e7eb', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeImageButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  deleteModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' } : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }),
  },
  deleteModalDark: {
    backgroundColor: '#374151',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  deleteModalMessage: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  deleteModalCancelButton: {
    backgroundColor: '#e5e7eb',
  },
  deleteModalCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalDeleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteModalDeleteText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

