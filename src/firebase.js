import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔒 Colocamos tus credenciales directas para asegurar la conexión al 100%
export const firebaseConfig = {
  apiKey: "AIzaSyAMAenaaJkWRjK22UewG_nJZCFecVk3AtU",
  authDomain: "consultoria-murillo.firebaseapp.com",
  projectId: "consultoria-murillo",
  storageBucket: "consultoria-murillo.appspot.com",
  messagingSenderId: "456985261",
  appId: "1:123456:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 📤 EXPORTS PRINCIPALES
export { app, auth, db };