// ============================================================
// TTM FORGE OS — Firebase configuration (ttm-forgeos)
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCjwsZOemoQyyAKpe02aMjW62JHEK-DOHE",
  authDomain: "ttm-forgeos.firebaseapp.com",
  projectId: "ttm-forgeos",
  storageBucket: "ttm-forgeos.firebasestorage.app",
  messagingSenderId: "442874948225",
  appId: "1:442874948225:web:8b971ffc0805813061bb80",
  measurementId: "G-NNMEGR8K0P"
};

// Returns true once a real config is present.
export function isConfigured() {
  return !String(firebaseConfig.apiKey).includes("PASTE");
}
