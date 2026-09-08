import { useState, useEffect } from "react"
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { db } from "../firebase" // Asegúrate de que esta ruta apunte a tu Firebase configurado

export default function ForzarCambioPasswordGuard({ children }) {
  const auth = getAuth()
  const usuarioActivo = auth.currentUser
  
  const [requiereCambio, setRequiereCambio] = useState(false)
  const [cargando, setCargando] = useState(true)
  
  const [passActual, setPassActual] = useState("")
  const [passNueva, setPassNueva] = useState("")
  const [passConfirmar, setPassConfirmar] = useState("")
  const [errorModal, setErrorModal] = useState("")
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!usuarioActivo) {
      setCargando(false)
      return
    }

    const userRef = doc(db, "users", usuarioActivo.uid)

    const desubscribir = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const datos = docSnap.data()
        if (datos.requiereCambioPassword === true) {
          setRequiereCambio(true)
        } else {
          setRequiereCambio(false)
        }
      }
      setCargando(false)
    }, (error) => {
      console.error("Error de conexión:", error)
      setCargando(false)
    })

    return () => desubscribir()
  }, [usuarioActivo])

  const omitirCambio = async () => {
    try {
      setProcesando(true)
      const userRef = doc(db, "users", usuarioActivo.uid)
      await updateDoc(userRef, { requiereCambioPassword: false })
    } catch (err) {
      console.error("Error al omitir:", err)
      setErrorModal("❌ No se pudo omitir en este momento.")
    } finally {
      setProcesando(false)
    }
  }

  const manejarCambioPassword = async (e) => {
    e.preventDefault()
    setErrorModal("")

    if (passNueva.length < 6) {
      setErrorModal("⚠️ La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (passNueva !== passConfirmar) {
      setErrorModal("⚠️ Las contraseñas nuevas no coinciden.")
      return
    }

    if (passActual === passNueva) {
      setErrorModal("⚠️ La nueva contraseña no puede ser igual a la actual.")
      return
    }

    try {
      setProcesando(true)
      const credenciales = EmailAuthProvider.credential(usuarioActivo.email, passActual)
      await reauthenticateWithCredential(usuarioActivo, credenciales)

      await updatePassword(usuarioActivo, passNueva)

      const userRef = doc(db, "users", usuarioActivo.uid)
      await updateDoc(userRef, { requiereCambioPassword: false })

      alert("🎉 ¡Tu contraseña se ha cambiado correctamente!")
    } catch (err) {
      console.error(err)
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setErrorModal("❌ La contraseña actual es incorrecta.")
      } else {
        setErrorModal("❌ Error en el servidor. Inténtalo de nuevo.")
      }
    } finally {
      setProcesando(false)
    }
  }

  if (cargando) return null 

  return (
    <>
      {requiereCambio && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(15, 23, 42, 0.85)", 
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999, 
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            maxWidth: "400px",
            width: "90%",
            borderRadius: "20px",
            padding: "32px 24px",
            boxShadow: "0 20px 25px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <span style={{ fontSize: "36px" }}>🔑</span>
              <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#1e293b", margin: "8px 0 0 0" }}>Seguridad</h2>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", lineHeight: "1.4" }}>
                El Administrador te sugiere actualizar tu contraseña de acceso.
              </p>
            </div>

            {errorModal && (
              <div style={{
                backgroundColor: "#fff1f2",
                border: "1px solid #fecdd3",
                color: "#e11d48",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "16px",
                fontWeight: "500"
              }}>
                {errorModal}
              </div>
            )}

            <form onSubmit={manejarCambioPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "10.5px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase" }}>Contraseña Actual</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Tu contraseña actual"
                  value={passActual}
                  onChange={e => setPassActual(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "10.5px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase" }}>Nueva Contraseña</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Mínimo 6 caracteres"
                  value={passNueva}
                  onChange={e => setPassNueva(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "10.5px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase" }}>Confirmar Nueva Contraseña</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Repite tu nueva contraseña"
                  value={passConfirmar}
                  onChange={e => setPassConfirmar(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button 
                  type="button"
                  disabled={procesando}
                  onClick={omitirCambio}
                  style={{
                    flex: 1,
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #e2e8f0",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Omitir aviso
                </button>

                <button 
                  type="submit" 
                  disabled={procesando}
                  style={{
                    flex: 1.5,
                    backgroundColor: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: procesando ? "not-allowed" : "pointer",
                    opacity: procesando ? 0.7 : 1
                  }}
                >
                  {procesando ? "Guardando..." : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Si no necesita cambio, muestra la app del psicólogo normal */}
      {!requiereCambio && children}
    </>
  )
}