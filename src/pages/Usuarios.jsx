import { useState, useEffect } from "react"
import { collection, doc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore"
import { createUserWithEmailAndPassword, signOut, getAuth } from "firebase/auth" 
import { initializeApp, deleteApp } from "firebase/app" 
import { db, firebaseConfig } from "../firebase"
import { useAuth } from "../context/AuthContext.jsx"
import { useNavigate } from "react-router-dom"

export default function Usuarios() {
  const navigate = useNavigate()
  const { role, loading } = useAuth() || {}

  // 📝 Estados de datos
  const [usuarios, setUsuarios] = useState([])
  const [loadingDatos, setLoadingDatos] = useState(true)

  // 🔍 Estados de Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState("todos")

  // 🔽 Estado para colapsar/desplegar el listado completo
  const [listaAbierta, setListaAbierta] = useState(false)

  // 📋 Estado del Formulario
  const [formUsuario, setFormUsuario] = useState({
    nombre: "",
    correo: "",
    password: "", 
    role: "psicologo",
    genero: "el", 
    especialidad: "Psicólogo",
    activo: true
  })

  const esAdmin = Boolean(role && (role.toLowerCase() === "admin" || role.toLowerCase() === "administrador"))

  // 📧 FUNCIÓN HELPER: Generar correo automático
  const generarCorreoAutomatico = (nombreCompleto, genero, rol, especialidad) => {
    if (!nombreCompleto) return ""
    const partes = nombreCompleto.trim().toLowerCase().split(/\s+/)
    if (partes.length === 0 || partes[0] === "") return ""

    const primerNombre = partes[0]
    
    // Adaptamos el prefijo según el rol, especialidad y género
    let prefijo = ""
    if (rol === "interno") {
      prefijo = genero === "ella" ? "interna" : "interno"
    } else if (especialidad === "Psiquiatra") {
      prefijo = "psiquiatra"
    } else {
      prefijo = genero === "ella" ? "psicologa" : "psicologo"
    }

    let inicialesApellidos = ""
    if (partes.length > 2) {
      const primerApellido = partes[partes.length - 2]
      const segundoApellido = partes[partes.length - 1]
      inicialesApellidos = (primerApellido[0] || "") + (segundoApellido[0] || "")
    } else if (partes.length === 2) {
      const primerApellido = partes[1]
      inicialesApellidos = (primerApellido[0] || "")
    }

    const limpiarTexto = (texto) => {
      return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
    }

    return `${prefijo}${limpiarTexto(primerNombre)}${limpiarTexto(inicialesApellidos)}@murillo.com`
  }

  // ✅ Autogenerar correo para psicólogos, psiquiatras e internos
  useEffect(() => {
    const { nombre, role, genero, especialidad } = formUsuario
    if (role === "psicologo" || role === "interno") {
      const correoGenerado = generarCorreoAutomatico(nombre, genero, role, especialidad)
      setFormUsuario(prev => (prev.correo === correoGenerado ? prev : { ...prev, correo: correoGenerado }))
    }
  }, [formUsuario.nombre, formUsuario.role, formUsuario.genero, formUsuario.especialidad])

  // 🔄 Cargar usuarios desde Firestore EN TIEMPO REAL
  useEffect(() => {
    if (loading) return
    if (!esAdmin) {
      setLoadingDatos(false)
      return
    }

    setLoadingDatos(true)
    const coleccionUsuarios = collection(db, "users")

    const desubscribir = onSnapshot(coleccionUsuarios, (querySnapshot) => {
      const listaUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUsuarios(listaUsers)
      setLoadingDatos(false)
    }, (error) => {
      console.error("Error cargando usuarios en tiempo real:", error)
      setLoadingDatos(false)
    })

    return () => desubscribir()
  }, [loading, esAdmin])

  // ➕ Registrar Usuario
  const manejarRegistroUsuario = async (e) => {
    e.preventDefault()
    if (!formUsuario.nombre || !formUsuario.correo || !formUsuario.password) {
      alert("⚠️ Por favor, completa todos los campos obligatorios.")
      return
    }

    if (formUsuario.password.length < 6) {
      alert("⚠️ La contraseña debe tener al menos 6 caracteres.")
      return
    }

    let appTemporal;

    try {
      const emailLimpio = formUsuario.correo.toLowerCase().trim()
      const appName = `AppTemporal-${Date.now()}`
      appTemporal = initializeApp(firebaseConfig, appName)
      const authTemporal = getAuth(appTemporal)

      const credencialesUsuario = await createUserWithEmailAndPassword(
        authTemporal, 
        emailLimpio, 
        formUsuario.password
      )

      const uidCreado = credencialesUsuario.user.uid

      const payload = {
        uid: uidCreado,
        nombre: formUsuario.nombre,
        correo: emailLimpio,
        role: formUsuario.role,
        especialidad: formUsuario.especialidad,
        genero: formUsuario.genero,
        activo: formUsuario.activo,
        requiereCambioPassword: false,
        fechaCreacion: serverTimestamp()
      }

      await setDoc(doc(db, "users", uidCreado), payload)
      
      alert(`✅ ¡Cuenta creada con éxito para ${formUsuario.nombre}!`)
      setFormUsuario({ nombre: "", correo: "", password: "", role: "psicologo", genero: "el", especialidad: "Psicólogo", activo: true })

      await signOut(authTemporal)
    } catch (error) {
      console.error("Error en el registro:", error)
      alert(error.code === "auth/email-already-in-use" ? "❌ Este correo ya está registrado." : "No se pudo crear la cuenta.")
    } finally {
      if (appTemporal) {
        await deleteApp(appTemporal)
      }
    }
  }

  // 🔄 Cambiar estado Activo/Inactivo
  const alternarEstadoUsuario = async (idUsuario, estadoActual) => {
    try {
      const userRef = doc(db, "users", idUsuario)
      await updateDoc(userRef, { activo: !estadoActual })
    } catch (error) {
      console.error("Error al cambiar estado:", error)
    }
  }

  // 🔑 SUGERIR/FORZAR CAMBIO DE CONTRASEÑA
  const forzarCambioPassword = async (idUsuario, nombreUsuario) => {
    const confirmar = window.confirm(`¿Quieres sugerirle un cambio de contraseña a ${nombreUsuario}? Le aparecerá un aviso en su próximo inicio de sesión.`)
    if (!confirmar) return

    try {
      const userRef = doc(db, "users", idUsuario)
      await updateDoc(userRef, { requiereCambioPassword: true })
      alert(`🔑 Se ha marcado a ${nombreUsuario}. Se le notificará al ingresar.`)
    } catch (error) {
      console.error("Error al configurar cambio de contraseña:", error)
      alert("❌ No se pudo programar la sugerencia.")
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const coincideNombre = u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
                          u.correo?.toLowerCase().includes(busqueda.toLowerCase())
    const coincideRol = filtroRol === "todos" || u.role?.toLowerCase() === filtroRol.toLowerCase()
    return coincideNombre && coincideRol
  })

  const s = {
    container: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    restrictedCard: {
      backgroundColor: '#ffffff',
      maxWidth: '400px',
      width: '100%',
      padding: '30px',
      borderRadius: '20px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    },
    layout: {
      maxWidth: '1200px',
      width: '100%',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '20px',
      alignItems: 'start',
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
    },
    header: {
      backgroundColor: '#1e293b',
      color: '#ffffff',
      padding: '16px 20px',
      borderBottom: '1px solid #334155',
    },
    headerTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      margin: 0,
    },
    headerSubtitle: {
      color: '#94a3b8',
      fontSize: '11px',
      marginTop: '2px',
      margin: 0,
    },
    form: {
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    label: {
      fontSize: '10.5px',
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      display: 'block',
      marginBottom: '4px',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontSize: '12.5px',
      boxSizing: 'border-box',
      outline: 'none',
      backgroundColor: '#f8fafc',
    },
    radioGroup: {
      display: 'flex',
      gap: '10px',
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#334155',
      cursor: 'pointer',
      padding: '6px 12px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#f8fafc',
      flex: 1,
      justifyContent: 'center',
    },
    btnPrimary: {
      width: '100%',
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: 'none',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
    },
    btnBack: {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#94a3b8',
      fontSize: '11px',
      cursor: 'pointer',
      alignSelf: 'center',
    },
    accordionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      backgroundColor: '#ffffff',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background-color 0.2s',
    },
    arrowIcon: (isOpen) => ({
      fontSize: '12px',
      color: '#64748b',
      transition: 'transform 0.3s ease',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    }),
    accordionContent: (isOpen) => ({
      maxHeight: isOpen ? '550px' : '0px',
      overflow: 'hidden',
      transition: 'all 0.3s ease-in-out',
      borderTop: isOpen ? '1px solid #e2e8f0' : '0px solid transparent',
    }),
    filterBar: {
      padding: '12px 16px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
    },
    listContainer: {
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '380px', 
      overflowY: 'auto',
    },
    listItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      borderBottom: '1px solid #f1f5f9',
      gap: '12px',
    },
    dotState: (active) => ({
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: active ? '#10b981' : '#ef4444',
      flexShrink: 0,
    }),
    userName: {
      fontWeight: '500',
      color: '#1e293b',
      fontSize: '13px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    userEmail: {
      fontSize: '11px',
      color: '#64748b',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    // 🎨 FUNCIÓN CORREGIDA CON PARÁMETROS ADECUADOS Y COLOR ROSA/PÚRPURA PARA PSIQUIATRA
    badgeRole: (role, esp) => {
      const is_admin = role === 'admin' || role === 'administrador';
      const is_sec = role === 'secretaria';
      const is_interno = role === 'interno';
      const is_psiquiatra = esp === 'Psiquiatra';
      
      let bgColor = '#e0f2fe'; // Azul claro para Psicólogo
      let textColor = '#0369a1';

      if (is_psiquiatra) {
        bgColor = '#fce7f3'; // Rosa suave para Psiquiatra
        textColor = '#be185d'; // Texto magenta/rosa oscuro
      } else if (is_admin) {
        bgColor = '#f3e8ff';
        textColor = '#7e22ce';
      } else if (is_sec) {
        bgColor = '#fef3c7';
        textColor = '#b45309';
      } else if (is_interno) {
        bgColor = '#dcfce7';
        textColor = '#536e11';
      }

      return {
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '8px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        backgroundColor: bgColor,
        color: textColor,
        marginLeft: '6px',
        display: 'inline-block',
      };
    },
    actionBtn: (type) => ({
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '500',
      border: '1px solid #e2e8f0',
      cursor: 'pointer',
      backgroundColor: type === 'reset' ? '#ffffff' : type === 'disable' ? '#fef2f2' : '#f0fdf4',
      color: type === 'reset' ? '#475569' : type === 'disable' ? '#dc2626' : '#16a34a',
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
    })
  }

  if (loading || loadingDatos) {
    return (
      <div style={s.container}>
        <div style={{ padding: '80px 0', fontSize: '13px', fontWeight: 'bold', color: '#64748b', textAlign: 'center' }}>
          Verificando credenciales...
        </div>
      </div>
    )
  }

  if (!esAdmin) {
    return (
      <div style={{ ...s.container, justifyContent: 'center' }}>
        <div style={s.restrictedCard}>
          <span style={{ fontSize: '32px' }}>🔒</span>
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>Acceso Restringido</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
            La gestión e indexación de usuarios y credenciales es exclusiva del Administrador.
          </p>
          <button onClick={() => navigate("/dashboard")} style={{ ...s.btnPrimary, marginTop: '4px' }}>
            Ir al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.layout}>
        
        {/* COLUMNA 1: FORMULARIO DE REGISTRO */}
        <div style={s.card}>
          <div style={s.header}>
            <h2 style={s.headerTitle}>👑 Registro de Personal</h2>
            <p style={s.headerSubtitle}>Genera accesos oficiales y perfiles clínicos</p>
          </div>

          <form onSubmit={manejarRegistroUsuario} style={s.form}>
            <div>
              <label style={s.label}>Rol del Usuario *</label>
              <select 
                style={{ ...s.input, fontWeight: 'bold', color: '#334155' }}
                value={formUsuario.role} 
                onChange={e => setFormUsuario({...formUsuario, role: e.target.value})}
              >
                <option value="psicologo">👨‍⚕️ Psicólogo / Especialista</option>
                <option value="interno">🎓 Interno / Practicante</option>
                <option value="admin">👑 Secretaría / Recepción</option>
              </select>
            </div>

            {/* SELECTOR DE ESPECIALIDAD SOLO PARA PSICÓLOGOS / ESPECIALISTAS */}
            {formUsuario.role === "psicologo" && (
              <div>
                <label style={s.label}>Especialidad </label>
                <select
                  style={{ ...s.input, fontWeight: 'bold', color: '#4f46e5' }}
                  value={formUsuario.especialidad}
                  onChange={e => setFormUsuario({...formUsuario, especialidad: e.target.value})}
                >
                  <option value="Psicólogo"> 👨‍⚕️ Psicólogo </option>
                  <option value="Psiquiatra">👨‍⚕️ Psiquiatra</option>
                </select>
              </div>
            )}

            {(formUsuario.role === "psicologo" || formUsuario.role === "interno") && (
              <div>
                <label style={s.label}>Género (Para prefijo del correo) *</label>
                <div style={s.radioGroup}>
                  <label style={{ 
                    ...s.radioLabel, 
                    borderColor: formUsuario.genero === "el" ? "#4f46e5" : "#e2e8f0",
                    backgroundColor: formUsuario.genero === "el" ? "#eef2ff" : "#f8fafc",
                    color: formUsuario.genero === "el" ? "#4f46e5" : "#334155"
                  }}>
                    <input 
                      type="radio" 
                      name="genero" 
                      value="el" 
                      checked={formUsuario.genero === "el"}
                      onChange={e => setFormUsuario({...formUsuario, genero: e.target.value})}
                    />
                    👦 Él ({formUsuario.role === "interno" ? "interno" : formUsuario.especialidad === "Psiquiatra" ? "psiquiatra" : "psicologo"})
                  </label>
                  
                  <label style={{ 
                    ...s.radioLabel, 
                    borderColor: formUsuario.genero === "ella" ? "#4f46e5" : "#e2e8f0",
                    backgroundColor: formUsuario.genero === "ella" ? "#eef2ff" : "#f8fafc",
                    color: formUsuario.genero === "ella" ? "#4f46e5" : "#334155"
                  }}>
                    <input 
                      type="radio" 
                      name="genero" 
                      value="ella" 
                      checked={formUsuario.genero === "ella"}
                      onChange={e => setFormUsuario({...formUsuario, genero: e.target.value})}
                    />
                    👧 Ella ({formUsuario.role === "interno" ? "interna" : formUsuario.especialidad === "Psiquiatra" ? "psiquiatra" : "psicologa"})
                  </label>
                </div>
              </div>
            )}

            <div>
              <label style={s.label}>Nombre Completo *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Pedro Collado Prado" 
                value={formUsuario.nombre} 
                onChange={e => setFormUsuario({...formUsuario, nombre: e.target.value})}
                style={s.input}
              />
            </div>

            <div>
              <label style={s.label}>Correo Electrónico *</label>
              <input 
                type="email" 
                required 
                placeholder="correo@murillo.com" 
                value={formUsuario.correo} 
                onChange={e => setFormUsuario({...formUsuario, correo: e.target.value})}
                style={s.input}
                disabled={formUsuario.role === "psicologo" || formUsuario.role === "interno"}
              />
            </div>

            <div>
              <label style={s.label}>Contraseña *</label>
              <input 
                type="password" 
                required 
                placeholder="Mínimo 6 caracteres" 
                value={formUsuario.password} 
                onChange={e => setFormUsuario({...formUsuario, password: e.target.value})}
                style={{ ...s.input, fontFamily: 'monospace' }}
              />
            </div>

            <button type="submit" style={s.btnPrimary}>Registrar Cuenta</button>

            <button type="button" onClick={() => navigate("/dashboard")} style={s.btnBack}>
              ← Volver al inicio
            </button>
          </form>
        </div>

        {/* COLUMNA 2: ACORDEÓN DE USUARIOS REGISTRADOS */}
        <div style={{ ...s.card, gridColumn: 'span 2' }}>
          
          <div 
            style={s.accordionHeader} 
            onClick={() => setListaAbierta(!listaAbierta)}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>👥</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b' }}>
                  Ver Personal Registrado
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  {usuarios.length} cuentas creadas en el sistema
                </p>
              </div>
            </div>
            <span style={s.arrowIcon(listaAbierta)}>▼</span>
          </div>

          <div style={s.accordionContent(listaAbierta)}>
            
            <div style={s.filterBar}>
              <input 
                type="text" 
                placeholder="🔍 Buscar por nombre o correo..." 
                value={busqueda} 
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...s.input, backgroundColor: '#ffffff', flex: 2, padding: '8px 12px' }}
              />
              <select 
                value={filtroRol} 
                onChange={e => setFiltroRol(e.target.value)}
                style={{ ...s.input, backgroundColor: '#ffffff', flex: 1, fontWeight: 'bold', color: '#4f46e5', padding: '8px' }}
              >
                <option value="todos">Todos</option>
                <option value="psicologo">Psicólogos</option>
                <option value="interno">Internos</option>
                <option value="admin">Admins</option>
                <option value="secretaria">Secretaría</option>
              </select>
            </div>

            <div style={s.listContainer}>
              {usuariosFiltrados.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No se encontraron coincidencias.
                </div>
              ) : (
                usuariosFiltrados.map(u => (
                  <div key={u.id} style={s.listItem}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span style={s.dotState(u.activo)} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={s.userName}>{u.nombre}</span>
                          
                          {/* LLAMADA A LA FUNCIÓN DE ESTILO CORREGIDA */}
                          <span style={s.badgeRole(u.role, u.especialidad)}>
                            {u.especialidad === "Psiquiatra" ? "Psiquiatra" : u.role}
                          </span>

                          {u.requiereCambioPassword && (
                            <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#e11d48', backgroundColor: '#ffe4e6', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                              🔑 Pendiente Cambio
                            </span>
                          )}
                        </div>
                        <span style={s.userEmail}>{u.correo}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        onClick={() => forzarCambioPassword(u.id, u.nombre)}
                        style={s.actionBtn('reset')}
                      >
                        🔑 Reiniciar
                      </button>

                      <button 
                        onClick={() => alternarEstadoUsuario(u.id, u.activo)}
                        style={s.actionBtn(u.activo ? 'disable' : 'enable')}
                      >
                        {u.activo ? "🛑 Baja" : "⚡ Alta"}
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}