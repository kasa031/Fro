import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';

// Conditional import for AsyncStorage (kun for mobil)
let AsyncStorage = null;
if (Platform.OS !== 'web') {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (error) {
    console.warn('AsyncStorage ikke tilgjengelig:', error);
  }
}

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

/**
 * ThemeProvider - Håndterer dark/light mode med permanent lagring
 * 
 * Funksjoner:
 * - Automatisk deteksjon av system-tema
 * - Manuell toggle av tema
 * - Lagrer preferanse i AsyncStorage (mobil) eller localStorage (web)
 * - Deler tema-state mellom alle komponenter
 * 
 * @component
 */
export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Last inn lagret preferanse ved oppstart
  useEffect(() => {
    loadThemePreference();
  }, []);

  /**
   * Laster inn lagret tema-preferanse
   */
  const loadThemePreference = async () => {
    try {
      let savedTheme = null;
      
      if (Platform.OS === 'web') {
        // For web, bruk localStorage
        savedTheme = localStorage.getItem('themePreference');
      } else if (AsyncStorage) {
        // For mobil, bruk AsyncStorage
        savedTheme = await AsyncStorage.getItem('themePreference');
      }

      if (savedTheme) {
        // Bruk lagret preferanse
        setIsDarkMode(savedTheme === 'dark');
      } else {
        // Bruk system-tema som standard
        setIsDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Feil ved lasting av tema-preferanse:', error);
      // Fallback til system-tema
      setIsDarkMode(systemColorScheme === 'dark');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle tema og lagre preferanse
   */
  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    try {
      const themeValue = newTheme ? 'dark' : 'light';
      
      if (Platform.OS === 'web') {
        // For web, bruk localStorage
        localStorage.setItem('themePreference', themeValue);
      } else if (AsyncStorage) {
        // For mobil, bruk AsyncStorage
        await AsyncStorage.setItem('themePreference', themeValue);
      }
    } catch (error) {
      console.error('Feil ved lagring av tema-preferanse:', error);
    }
  };

  /**
   * Sett tema manuelt
   */
  const setTheme = async (theme) => {
    const isDark = theme === 'dark';
    
    // Oppdater state først for umiddelbar visuell endring
    setIsDarkMode(isDark);

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('themePreference', theme);
      } else if (AsyncStorage) {
        await AsyncStorage.setItem('themePreference', theme);
      }
    } catch (error) {
      console.error('Feil ved lagring av tema-preferanse:', error);
      // Hvis lagring feiler, reverser state-endringen
      setIsDarkMode(!isDark);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

