/**
 * Avatar Helper - Genererer avatar-URLer for brukere og barn
 * 
 * Bruker DiceBear API for å generere faktiske ansikter (dummyfaces)
 * når det ikke er noe opplastet bilde.
 */

/**
 * Genererer en avatar-URL basert på navn med faktiske ansikter
 * @param {string} name - Navnet på personen
 * @param {string} type - 'child', 'user', eller 'parent' (for å variere stil)
 * @param {number} size - Størrelse på avatar (standard: 200)
 * @returns {string} URL til avatar-bildet
 */
export const getAvatarUrl = (name, type = 'child', size = 200) => {
  if (!name || name.trim() === '') {
    name = 'default';
  }

  // Bruk navnet som seed for konsistent generering
  const seed = encodeURIComponent(name.trim().toLowerCase());
  
  // Forskjellige stiler for barn vs ansatte
  // 'avataaars' gir faktiske ansikter med variasjoner
  const style = type === 'child' ? 'avataaars' : 'avataaars';
  
  // Generer URL med DiceBear API for faktiske ansikter
  // radius: 50 gir runde ansikter
  // backgroundColor: varierer basert på type
  // Bruker PNG i stedet for SVG for bedre kompatibilitet med React Native
  const backgroundColor = type === 'child' ? '6366f1' : type === 'user' ? '10b981' : '3b82f6';
  
  return `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=${size}&radius=50&backgroundColor=${backgroundColor}`;
};

/**
 * Henter avatar-URL eller fallback til generert avatar
 * @param {string|null} imageUrl - Eksisterende bilde-URL hvis tilgjengelig
 * @param {string} name - Navnet på personen
 * @param {string} type - 'child', 'user', eller 'parent'
 * @param {number} size - Størrelse på avatar
 * @returns {string} URL til avatar-bildet
 */
export const getAvatar = (imageUrl, name, type = 'child', size = 200) => {
  // Hvis det finnes et opplastet bilde, bruk det
  if (imageUrl && imageUrl.trim() !== '') {
    return imageUrl;
  }
  
  // Ellers generer en avatar basert på navn
  return getAvatarUrl(name, type, size);
};

