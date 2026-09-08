import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { signOut } from "firebase/auth"
import { collection,query,where, getDocs } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useAuth } from "../context/AuthContext"

import { ModalGestionInternos } from "./ModalGestionInternos"

import logo from "../assets/logo.png"
import fondo from "../assets/fondo.png"

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, role, loading } = useAuth()
  const currentUser = user
  const [modalInternosAbierto, setModalInternosAbierto] = useState(false)
  const [misPacientes, setMisPacientes] = useState([])
  const [cargandoPacientes, setCargandoPacientes] = useState(true)

  const [mensajeCopiado, setMensajeCopiado] = useState("")

  // 🛡️ Normalización de roles
  const roleNormalizado = String(role || "").toLowerCase().trim()
  const esAdmin = roleNormalizado === "admin" || roleNormalizado === "administrador"
  const esPsicologo = roleNormalizado === "psicologo" || roleNormalizado === "psicóloga"
  const esInterno = roleNormalizado === "interno" || roleNormalizado === "practicante"

  useEffect(() => {
    if (!loading && !role) {
      navigate("/")
    }
  }, [role, loading, navigate])

  // 🔄 CARGA DE PACIENTES (ARRAY DE DEPENDENCIAS ESTÁTICO)
 useEffect(() => {
  let isMounted = true;

  const cargarPacientesInterno = async () => {
    if (!currentUser?.uid || !esInterno) {
      if (isMounted) setCargandoPacientes(false)
      return
    }

    if (isMounted) setCargandoPacientes(true)

    try {
      // 🔍 Consulta restringida a los pacientes asignados al UID del usuario
      const q = query(
        collection(db, "pacientes"),
        where("internosAsignados", "array-contains", currentUser.uid)
      )

      const snap = await getDocs(q)

      const asignados = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))

      if (isMounted) setMisPacientes(asignados)
    } catch (error) {
      console.error("❌ Error al consultar Firestore:", error)
    } finally {
      if (isMounted) setCargandoPacientes(false)
    }
  }

  cargarPacientesInterno()

  return () => {
    isMounted = false
  }
}, [currentUser?.uid, role, esInterno]) // 👈 'role' y 'esInterno' obligan a reejecutar al autenticar

  const cerrarSesion = async () => {
    await signOut(auth)
    navigate("/")
  }
   const [copiadoId, setCopiadoId] = useState(null)

const copiarAlPortapapeles = (id, texto) => {
  if (!texto) return
  navigator.clipboard.writeText(texto)
  setCopiadoId(id)
  
  setTimeout(() => {
    setCopiadoId(null)
  }, 2000)
}

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
      padding: '24px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      maxWidth: '1100px',
      width: '100%',
      display: 'flex',
      gap: '24px',
      height: 'calc(100vh - 48px)',
      boxSizing: 'border-box',
    },
    sidebar: {
      width: '280px',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px)',
      borderRadius: '24px',
      padding: '28px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.03)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
    },
    logoSection: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '20px',
      borderBottom: '1px solid #e2e8f0',
      marginBottom: '20px',
    },
    logoImg: {
      width: '100px',
      height: '100px',
      objectFit: 'contain',
    },
    systemTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#1e293b',
      margin: '10px 0 2px 0',
      letterSpacing: '0.3px',
    },
    roleBadge: {
      fontSize: '10px',
      fontWeight: 'bold',
      backgroundColor: esAdmin ? '#f3e8ff' : esPsicologo ? '#e0f2fe' : '#fef3c7',
      color: esAdmin ? '#7e22ce' : esPsicologo ? '#0369a1' : '#b45309',
      padding: '4px 12px',
      borderRadius: '9999px',
      textTransform: 'uppercase',
      marginTop: '4px',
    },
    navGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    mainContent: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.90)',
      backdropFilter: 'blur(16px)',
      borderRadius: '24px',
      padding: '40px',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.03)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      overflowY: 'auto',
    },
    headerWelcome: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#1e293b',
      margin: '0 0 8px 0',
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#64748b',
      margin: '0 0 32px 0',
    },
    actionsContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      maxWidth: '320px',
    },
    btnPrimary: {
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: 'none',
      padding: '14px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
      width: '100%',
    },
    btnSecondary: {
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: '1px solid #cbd5e1',
      padding: '14px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      width: '100%',
    },
    loaderContainer: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      gap: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    patientsContainer: {
      width: '100%',
      textAlign: 'left',
    },
    cardsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '16px',
      marginTop: '16px',
      width: '100%',
    },
    patientCard: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      padding: '18px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
   codeRow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: '#e0e7ff',
      padding: '4px 8px 4px 10px',
      borderRadius: '8px',
      alignSelf: 'flex-start',
    },
    tagCode: {
      fontSize: '11px',
      fontWeight: '800',
      color: '#4f46e5',
      letterSpacing: '0.3px',
    },
    btnCopy: {
      backgroundColor: 'transparent',
      color: '#4f46e5',
      border: 'none',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      padding: '2px 4px',
      borderRadius: '4px',
      transition: 'background-color 0.2s',
    },
    cardName: {
      fontSize: '15px',
      fontWeight: '700',
      color: '#1e293b',
      margin: '4px 0 0 0',
    },
    cardInfo: {
      fontSize: '12px',
      color: '#64748b',
      margin: 0,
    },
    emptyState: {
      backgroundColor: '#fff1f2',
      border: '1px solid #fecdd3',
      padding: '20px',
      borderRadius: '16px',
      color: '#9f1239',
      fontSize: '13px',
      marginTop: '12px',
    }
  }

  if (loading) {
    return (
      <div style={s.loaderContainer}>
        <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#4f46e5' }}>
          Cargando sistema...
        </p>
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      <div style={s.container}>
        <aside style={s.sidebar}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={s.logoSection}>
              <img src={logo} alt="logo" style={s.logoImg} />
              <h1 style={s.systemTitle}>Sistema Clínico</h1>
              <span style={s.roleBadge}>{role}</span>
            </div>

            <nav style={s.navGroup}>
              <button onClick={() => navigate("/agenda")} style={s.btnPrimary}>📊 Agenda</button>
              <button onClick={() => navigate("/anamnesis")} style={s.btnPrimary}>📂 Anamnesis</button>
              <button onClick={() => navigate("/sesiones")} style={s.btnPrimary}>🧠 Sesiones</button>
              <button onClick={() => navigate("/psicometria")} style={s.btnPrimary}>📊 Psicometría</button>
              <button onClick={cerrarSesion} style={{ ...s.btnSecondary, marginTop: '12px' }}>🚪 Cerrar Sesión</button>
            </nav>
          </div>
        </aside>

        <main style={s.mainContent}>
          <h2 style={s.headerWelcome}>Bienvenido 👋</h2>
          <p style={s.headerSubtitle}>{currentUser?.email} — Panel de control clínico</p>

          {esInterno ? (
            <div style={s.patientsContainer}>
              <h3 style={{ fontSize: "18px", color: "#1e293b", margin: 0 }}>
                📋 Mis Pacientes Asignados ({misPacientes.length})
              </h3>

              {cargandoPacientes ? (
                <p style={{ fontSize: "13px", color: "#64748b", marginTop: "16px" }}>
                  Cargando pacientes asignados...
                </p>
              ) : misPacientes.length === 0 ? (
                <div style={s.emptyState}>
                  ⚠️ <strong>Sin asignaciones:</strong> Currently no tienes pacientes asignados.
                </div>
              ) : (
                <div style={s.cardsGrid}>
                  {misPacientes.map((paciente) => {
                    const codigoPaciente = paciente.codigo || paciente.id
                    return (
                      <div key={paciente.id} style={s.patientCard}>
                        
                        {/* 📋 SECCIÓN CÓDIGO CON BOTÓN DE COPIAR */}
                       <div style={s.codeRow}>
  <span style={s.tagCode}>ID: {codigoPaciente}</span>
  <span style={{ color: '#c7d2fe', fontSize: '12px' }}>|</span>
  <button
    onClick={() => copiarAlPortapapeles(paciente.id, codigoPaciente)}
    style={{
      ...s.btnCopy,
      backgroundColor: copiadoId === paciente.id ? '#dcfce7' : 'transparent',
      color: copiadoId === paciente.id ? '#15803d' : '#4f46e5',
      borderRadius: '4px',
      padding: '2px 6px',
    }}
    title="Copiar código"
  >
    {copiadoId === paciente.id ? "✓ ¡Copiado!" : "📋 Copiar"}
  </button>
</div>

                        <h4 style={s.cardName}>{paciente.nombre}</h4>
                        {paciente.dni && <p style={s.cardInfo}>📄 DNI: {paciente.dni}</p>}
                        {paciente.edad && <p style={s.cardInfo}>🎂 Edad: {paciente.edad} años</p>}
                        {paciente.telefono && <p style={s.cardInfo}>📞 Tel: {paciente.telefono}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={s.actionsContainer}>
              {esAdmin ? (
                <>
                  <button onClick={() => navigate("/pacientes")} style={s.btnPrimary}>Pacientes Registrados</button>
                  <button onClick={() => navigate("/nuevo-paciente")} style={s.btnPrimary}>➕ Nuevo Paciente</button>
                  <button onClick={() => navigate("/usuarios")} style={s.btnSecondary}>👨‍⚕️ Control de Usuarios</button>
                  <button onClick={() => setModalInternosAbierto(true)} style={s.btnPrimary}>🎓 Gestión de Internos</button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate("/agenda")} style={s.btnPrimary}>📅 Ver Agenda de Hoy</button>
                  {esPsicologo && (
                    <button onClick={() => setModalInternosAbierto(true)} style={s.btnPrimary}>🎓 Gestión de Internos</button>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 🔔 NOTIFICACIÓN FLOTANTE DE CÓDIGO COPIADO */}
      {mensajeCopiado && (
        <div style={s.toastNotification}>
          {mensajeCopiado}
        </div>
      )}

      {/* 🎓 MODAL DE GESTIÓN */}
      <ModalGestionInternos
        isOpen={modalInternosAbierto}
        onClose={() => setModalInternosAbierto(false)}
      />
    </div>
  )
}