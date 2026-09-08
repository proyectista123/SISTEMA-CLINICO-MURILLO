import { useState } from "react"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useNavigate } from "react-router-dom"

import logo from "../assets/logo.png"
import fondo from "../assets/fondo.png"

export default function Login() {
  const navigate = useNavigate()
 
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("") // 📝 Para mostrar errores en pantalla
  const [loading, setLoading] = useState(false) // ⏳ Para controlar el estado del botón

  const iniciarSesion = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setLoading(true)

    try {
      // 1️⃣ Autenticar con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // 2️⃣ Consultar estado en Firestore antes de permitir el ingreso
      const userDocRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userDocRef)

      if (userSnap.exists()) {
        const userData = userSnap.data()

        // 🛑 Comprobación de estado "Baja" o deshabilitado
        const estaDadoDeBaja = 
          userData.activo === false || 
          userData.estado === "baja" || 
          userData.estado === "inactivo" ||
          userData.baja === true

        if (estaDadoDeBaja) {
          // Desconectamos inmediatamente al usuario
          await signOut(auth)
          setErrorMsg("⛔ Tu cuenta se encuentra dada de baja. Acceso denegado.")
          setLoading(false)
          return
        }
      }

      // 3️⃣ Si todo está en regla, redirigir al dashboard
      navigate("/dashboard")
    } catch (error) {
      console.error("Error en Firebase:", error.code)
      if (
        error.code === "auth/invalid-credential" || 
        error.code === "auth/wrong-password" || 
        error.code === "auth/user-not-found"
      ) {
        setErrorMsg("Correo o contraseña incorrectos.")
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("El formato del correo no es válido.")
      } else {
        setErrorMsg("Ocurrió un error inesperado. Inténtalo de nuevo.")
      }
    } finally {
      setLoading(false)
    }
  } 

  // 🎨 SISTEMA UNIFICADO DE ESTILOS
  const s = {
    wrapper: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundImage: `url(${fondo})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px)',
      borderRadius: '24px',
      padding: '40px 32px',
      maxWidth: '420px',
      width: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    logoSection: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '32px',
      textAlign: 'center',
    },
    logoImg: {
      width: '110px',
      height: '110px',
      objectFit: 'contain',
      marginBottom: '16px',
    },
    systemTitle: {
      fontSize: '24px',
      fontWeight: '800',
      color: '#1e293b',
      margin: 0,
      letterSpacing: '-0.5px',
    },
    systemSubtitle: {
      fontSize: '13px',
      color: '#64748b',
      margin: '6px 0 0 0',
    },
    form: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    alertError: {
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
      padding: '12px 16px',
      borderRadius: '12px',
      marginBottom: '18px',
      fontSize: '13px',
      fontWeight: '600',
      textAlign: 'center',
      border: '1px solid #fca5a5',
    },
    label: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '6px',
      marginLeft: '4px',
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid #cbd5e1',
      backgroundColor: '#ffffff',
      fontSize: '14px',
      color: '#1e293b',
      boxSizing: 'border-box',
      marginBottom: '18px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    btnSubmit: (isLoading) => ({
      width: '100%',
      padding: '14px 16px',
      borderRadius: '12px',
      border: 'none',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#ffffff',
      backgroundColor: isLoading ? '#818cf8' : '#4f46e5',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
      transition: 'background-color 0.2s',
      marginTop: '8px',
    })
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        
        {/* Cabecera / Identidad Visual */}
        <div style={s.logoSection}>
          <img src={logo} alt="logo" style={s.logoImg} />
          <h1 style={s.systemTitle}>Sistema Clínico</h1>
          <p style={s.systemSubtitle}>Gestión de Salud Mental y Expedientes</p>
        </div>

        {/* Formulario de Acceso */}
        <form onSubmit={iniciarSesion} style={s.form}>
          
          {errorMsg && (
            <div style={s.alertError}>
              ⚠️ {errorMsg}
            </div>
          )}

          <label style={s.label}>Correo Electrónico</label>
          <input
            type="email"
            placeholder="......@......com"
            required
            style={s.input}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label style={s.label}>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••••••"
            required
            style={s.input}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <button
            type="submit"
            disabled={loading}
            style={s.btnSubmit(loading)}
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

      </div>
    </div>
  )
}