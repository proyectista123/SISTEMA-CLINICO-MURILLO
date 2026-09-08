import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  useEffect(() => {
    console.log("🎬 Iniciando AuthContext...");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        console.log("🔍 Usuario detectado:", currentUser.uid);
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data();

            // 🛑 VALIDACIÓN DE ESTADO / BAJA:
            // Comprueba las distintas formas en que se suele registrar el estado inactivo.
            const estaDadoDeBaja = 
              userData.activo === false || 
              userData.estado === "baja" || 
              userData.estado === "inactivo" ||
              userData.baja === true;

            if (estaDadoDeBaja) {
              console.warn("⛔ Usuario suspendido/dado de baja. Cerrando sesión...");
              alert("⛔ Tu cuenta se encuentra deshabilitada. Contacta al administrador.");
              await signOut(auth);
              setUser(null);
              setRole(null);
              setLoading(false);
              return;
            }

            // 🟢 Si está activo, asignamos sus datos
            setUser(currentUser);
            const userRole = userData.role || userData.rol;
            console.log("👑 Rol encontrado en Firestore:", userRole);
            setRole(userRole);
          } else {
            console.warn("⚠️ El documento del usuario no existe en Firestore.");
            setUser(currentUser);
            setRole(null);
          }
        } catch (error) {
          console.error("💥 Error crítico al leer Firestore:", error);
          setUser(null);
          setRole(null); 
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);