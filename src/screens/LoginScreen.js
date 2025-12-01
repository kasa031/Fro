import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/Authcontext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if(!email || !password) {
        Alert.alert("Feil", "Vennligst fyll ut både e-post og passord");
        return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      console.error(error);
      Alert.alert("Innlogging feilet", "Sjekk brukernavn og passord.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.card}>
        <Text style={styles.title}>Eventyrhagen</Text>
        <Text style={styles.subtitle}>Logg inn for å fortsette</Text>
        
        <TextInput 
          placeholder="E-post" 
          style={styles.input} 
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput 
          placeholder="Passord" 
          style={styles.input} 
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Logg Inn</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4f46e5', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 24, elevation: 5 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#1f2937' },
  subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 24 },
  input: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#4f46e5', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});