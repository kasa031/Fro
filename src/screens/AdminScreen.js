import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { db } from '../config/firebaseconfig';
import { useAuth } from '../context/Authcontext';

export default function AdminScreen() {
  const { logout } = useAuth();
  
  const [name, setName] = useState('');
  const [avdeling, setAvdeling] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [guardianEmails, setGuardianEmails] = useState([]); 
  const [loading, setLoading] = useState(false);

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email.includes('@') && !guardianEmails.includes(email)) {
      setGuardianEmails([...guardianEmails, email]);
      setEmailInput('');
    } else {
      Alert.alert('Ugyldig', 'Sjekk at e-posten er gyldig og ikke lagt til fra før.');
    }
  };

  const removeEmail = (email) => {
    setGuardianEmails(guardianEmails.filter(e => e !== email));
  };

  const handleCreateChild = async () => {
    if (!name || !avdeling || guardianEmails.length === 0) {
      Alert.alert('Mangler info', 'Navn, avdeling og minst én forelder må fylles ut.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "children"), {
        name: name,
        avdeling: avdeling,
        guardianEmails: guardianEmails,
        status: 'home',
        isSick: false,
        checkInTime: null,
        createdAt: new Date(),
        image: `https://api.dicebear.com/7.x/avataaars/png?seed=${name}` 
      });

      Alert.alert('Suksess', `${name} er registrert!`);
      setName('');
      setAvdeling('');
      setGuardianEmails([]);
    } catch (error) {
      console.error(error);
      Alert.alert('Feil', 'Kunne ikke lagre. Sjekk tilkobling.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Registrer nytt barn</Text>
          <Text style={styles.subtitle}>Knytt barnet til foreldrenes e-postadresser.</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Barnets Navn</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="F.eks. Lise" />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Avdeling</Text>
            <TextInput style={styles.input} value={avdeling} onChangeText={setAvdeling} placeholder="F.eks. Solstrålen" />
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Legg til Foresatte (E-post)</Text>
          <View style={styles.row}>
            <TextInput 
              style={[styles.input, {flex: 1, marginBottom: 0}]} 
              value={emailInput} 
              onChangeText={setEmailInput} 
              placeholder="forelder@eksempel.no" 
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>OPPRETT BARN</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20 },
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
  saveBtn: { backgroundColor: '#059669', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});