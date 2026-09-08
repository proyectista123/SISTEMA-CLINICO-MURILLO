import { useState, useEffect } from "react"
import { collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Sesiones() {
  const navigate = useNavigate()
  const authContext = useAuth()
  const user = authContext?.user
  const esAdmin = authContext?.role === "admin" || user?.role === "admin"

  // 📝 ESTADOS DE CONTROL Y BÚSQUEDA
  const [codigoPaciente, setCodigoPaciente] = useState("")
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [historialSesiones, setHistorialSesiones] = useState([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [loadingGuardar, setLoadingGuardar] = useState(false)

  // 👁️ ESTADOS PARA MODO LECTURA COMPLETA Y EDICIÓN DE FECHA/HORA/AVANCE
  const [sesionLecturaSeleccionada, setSesionLecturaSeleccionada] = useState(null)
  const [nuevoAvanceLectura, setNuevoAvanceLectura] = useState(50)
  const [fechaLectura, setFechaLectura] = useState("")
  const [horaLectura, setHoraLectura] = useState("00:00")

  // 👥 ESTADO PARA ALMACENAR LOS PSICÓLOGOS
  const [listaPsicologos, setListaPsicologos] = useState([])

  // 📋 ESTADOS DEL FORMULARIO DE SESIÓN
  const [nombreEvaluador, setNombreEvaluador] = useState("")
  const [fechaSesion, setFechaSesion] = useState(new Date().toISOString().split('T')[0])
  const [horaSesion, setHoraSesion] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
  
  // 🔗 LINK INDEPENDIENTE DE SESIONES
  const [urlDriveSesiones, setUrlDriveSesiones] = useState("")
  
  const [observaciones, setObservaciones] = useState("")
  const [tareasRecomendaciones, setTareasRecomendaciones] = useState("")
  const [avance, setAvance] = useState(50)

  // 🔄 CARGAR LISTADO DE PSICÓLOGOS
  useEffect(() => {
    if (esAdmin || !user) return

    const obtenerPsicologos = async () => {
      try {
        let docs = []
        const q = query(collection(db, "users"), where("role", "==", "psicologo"))
        const snap = await getDocs(q)
        docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        if (docs.length === 0) {
          const qMayuscula = query(collection(db, "users"), where("role", "==", "Psicologo"))
          const snapMayuscula = await getDocs(qMayuscula)
          docs = snapMayuscula.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }

        if (docs.length === 0) {
          const snapTodos = await getDocs(collection(db, "users"))
          docs = snapTodos.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }

        setListaPsicologos(docs)

        if (docs.length > 0) {
          const usuarioActual = docs.find(u => u.id === user?.uid)
          if (usuarioActual) {
            setNombreEvaluador(usuarioActual.nombre || usuarioActual.nombreCompleto || "Evaluador Asignado")
          } else {
            const primerPsico = docs[0]
            setNombreEvaluador(primerPsico.nombre || primerPsico.nombreCompleto || "Evaluador Asignado")
          }
        } else {
          setNombreEvaluador(user?.displayName || "Psicólogo de Turno")
        }
      } catch (error) {
        console.error("Error al cargar la lista de psicólogos:", error)
        setNombreEvaluador(user?.displayName || "Psicólogo de Turno")
      }
    }

    obtenerPsicologos()
  }, [user, esAdmin])

  // 🕒 TIMESTAMP CRONOLÓGICO STRICTO
  const obtenerTimestampSesion = (fecha, hora) => {
    if (!fecha) return 0
    const horaValida = hora || "00:00"
    return new Date(`${fecha.replace(/-/g, '/')} ${horaValida}`).getTime() || 0
  }

  // Refrescar, ORDENAR y RENUMERAR estricta y dinámicamente las sesiones (Sesión 1, Sesión 2, etc.)
  const actualizarHistorialLocal = async (idPac) => {
    try {
      const qSesiones = query(collection(db, "sesiones"), where("idPaciente", "==", idPac))
      const snapSesiones = await getDocs(qSesiones)
      
      const listaOriginal = snapSesiones.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          timestampConsulta: obtenerTimestampSesion(data.fechaSesion, data.horaSesion),
          timestampRegistro: data.fechaRegistro?.toMillis?.() || 0
        }
      })

      listaOriginal.sort((a, b) => {
        if (a.timestampConsulta !== b.timestampConsulta) {
          return a.timestampConsulta - b.timestampConsulta
        }
        return a.timestampRegistro - b.timestampRegistro
      })

      const listaCorregida = listaOriginal.map((sesion, index) => {
        const numeroCorregido = index + 1
        return {
          ...sesion,
          numeroSesionDinamico: numeroCorregido,
          etiquetaSesion: `Sesión ${numeroCorregido}`
        }
      })

      setSesionLecturaSeleccionada(prev => {
        if (!prev) return null
        const sesionActualizada = listaCorregida.find(s => s.id === prev.id)
        return sesionActualizada || prev
      })

      const listaParaDesplegable = [...listaCorregida].reverse()
      setHistorialSesiones(listaParaDesplegable)
    } catch (error) {
      console.error("Error al actualizar historial:", error)
    }
  }

  // 🔍 ENCONTRAR PACIENTE
  const buscarPaciente = async (e) => {
    e.preventDefault()
    const codigoLimpio = codigoPaciente.trim()
    if (!codigoLimpio) return

    setLoadingBusqueda(true)
    setPacienteEncontrado(null)
    setHistorialSesiones([])

    try {
      const pacienteRef = doc(db, "pacientes", codigoLimpio)
      const snapPaciente = await getDoc(pacienteRef)

      if (!snapPaciente.exists()) {
        alert("❌ Código inválido. No se encontró ningún expediente.")
        return
      }

      const datosPaciente = snapPaciente.data()
      setPacienteEncontrado({ id: snapPaciente.id, ...datosPaciente })
      setUrlDriveSesiones(datosPaciente.enlaceDriveSesiones || "")
      await actualizarHistorialLocal(snapPaciente.id)
    } catch (error) {
      console.error("Error al buscar expediente:", error)
      alert("Error al cargar el expediente clínico.")
    } finally {
      setLoadingBusqueda(false)
    }
  }

  // 📂 ASIGNAR DRIVE INDEPENDIENTE PARA SESIONES (SÓLO ADMIN)
  const guardarEnlaceDriveSesiones = async () => {
    if (!pacienteEncontrado) return
    try {
      const pacienteRef = doc(db, "pacientes", pacienteEncontrado.id)
      await updateDoc(pacienteRef, { enlaceDriveSesiones: urlDriveSesiones.trim() })
      alert("📂 Enlace de Google Drive para Sesiones actualizado correctamente.")
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar el enlace de Drive.")
    }
  }

  // ⏰ EXCLUSIVO ADMIN: ACTUALIZAR FECHA/HORA Y BLOQUEAR CAMBIOS FUTUROS
  const actualizarFechaHoraYBloquear = async () => {
    if (!sesionLecturaSeleccionada || !esAdmin) return
    if (sesionLecturaSeleccionada.bloqueada) {
      alert("🔒 Esta sesión ya fue actualizada anteriormente y no puede volver a modificarse.")
      return
    }

    if (!fechaLectura) {
      alert("Por favor selecciona una fecha válida.")
      return
    }

    try {
      const sesionRef = doc(db, "sesiones", sesionLecturaSeleccionada.id)
      await updateDoc(sesionRef, { 
        fechaSesion: fechaLectura,
        horaSesion: horaLectura || "00:00",
        bloqueada: true 
      })

      if (pacienteEncontrado?.id) {
        await actualizarHistorialLocal(pacienteEncontrado.id)
      }
      alert(`🔒 Fecha y hora actualizadas correctamente. La sesión ha sido bloqueada para futuras modificaciones.`)
    } catch (error) {
      console.error("Error al actualizar fecha y hora:", error)
      alert("No se pudo actualizar la fecha y hora de la sesión.")
    }
  }

  // 🚀 PERMITIR A LOS PSICÓLOGOS ACTUALIZAR EL AVANCE
  const modificarAvanceDeSesionGuardada = async () => {
    if (!sesionLecturaSeleccionada || esAdmin) return

    const avanceAnterior = Number(sesionLecturaSeleccionada.avance || 0)
    const avanceSiguiente = Number(nuevoAvanceLectura)

    if (avanceSiguiente < avanceAnterior) {
      alert(`⚠️ Regla Clínica: El porcentaje de avance solo puede incrementarse de forma progresiva. No puedes disminuir del ${avanceAnterior}% al ${avanceSiguiente}%.`)
      setNuevoAvanceLectura(avanceAnterior)
      return
    }

    if (avanceSiguiente === avanceAnterior) {
      alert("El porcentaje seleccionado es igual al guardado previamente.")
      return
    }

    try {
      const sesionRef = doc(db, "sesiones", sesionLecturaSeleccionada.id)
      await updateDoc(sesionRef, { avance: avanceSiguiente })

      if (pacienteEncontrado?.id) {
        await actualizarHistorialLocal(pacienteEncontrado.id)
      }
      alert(`📈 Progreso de la sesión actualizado con éxito al ${avanceSiguiente}%.`)
    } catch (error) {
      console.error("Error al actualizar avance:", error)
      alert("No se pudo actualizar el porcentaje en la base de datos.")
    }
  }

  // 💾 GUARDAR SESIÓN (EXCLUSIVO PSICÓLOGOS)
  const guardarSesion = async (e) => {
    e.preventDefault()
    if (esAdmin || !pacienteEncontrado) return

    setLoadingGuardar(true)

    const nuevaSesion = {
      idPaciente: pacienteEncontrado.id,
      nombrePaciente: pacienteEncontrado.nombre || "Sin Nombre",
      nombreEvaluador,
      fechaSesion,
      horaSesion,
      observaciones: observaciones.trim(),
      tareasRecomendaciones: tareasRecomendaciones.trim(),
      avance: Number(avance),
      fechaRegistro: serverTimestamp(),
      bloqueada: false
    }

    try {
      await addDoc(collection(db, "sesiones"), nuevaSesion)
      alert(`🎉 Registro exitoso: Sesión guardada correctamente.`)
      setObservaciones("")
      setTareasRecomendaciones("")
      setAvance(50)
      navigate("/dashboard")
    } catch (error) {
      console.error(error)
      alert("No se pudo registrar la sesión en la base de datos.")
    } finally {
      setLoadingGuardar(false)
    }
  }

  // Cargar datos de la sesión seleccionada
  const cambiarSesionSeleccionada = (sesion) => {
    setSesionLecturaSeleccionada(sesion || null)
    if (sesion) {
      setNuevoAvanceLectura(sesion.avance || 50)
      setFechaLectura(sesion.fechaSesion || "")
      setHoraLectura(sesion.horaSesion || "00:00")
    }
  }

  // Manejar la selección en el menú desplegable
  const manejarSeleccionMenuLectura = (e) => {
    const idSeleccionado = e.target.value
    if (!idSeleccionado) {
      setSesionLecturaSeleccionada(null)
      return
    }
    const sesion = historialSesiones.find(s => s.id === idSeleccionado)
    cambiarSesionSeleccionada(sesion)
  }

  // ⬅️ ➡️ LÓGICA DE NAVEGACIÓN ENTRE SESIONES (ANTERIOR Y SIGUIENTE)
  const indiceActual = historialSesiones.findIndex(s => s.id === sesionLecturaSeleccionada?.id)
  
  // Como la lista está ordenada de MÁS RECIENTE a MÁS ANTIGUA:
  // "Anterior" (cronológicamente más vieja) está adelante en el arreglo (+1)
  const tieneAnterior = indiceActual !== -1 && indiceActual < historialSesiones.length - 1
  // "Siguiente" (cronológicamente más reciente) está atrás en el arreglo (-1)
  const tieneSiguiente = indiceActual > 0

  const irASesionAnterior = () => {
    if (tieneAnterior) {
      cambiarSesionSeleccionada(historialSesiones[indiceActual + 1])
    }
  }

  const irASesionSiguiente = () => {
    if (tieneSiguiente) {
      cambiarSesionSeleccionada(historialSesiones[indiceActual - 1])
    }
  }

  // 🎨 ESTILOS UNIFICADOS
  const s = {
    container: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px', display: 'flex', justifyContent: 'center' },
    card: { backgroundColor: '#ffffff', maxWidth: '750px', width: '100%', padding: '35px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    backBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', transition: 'color 0.2s', padding: 0 },
    header: { borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '25px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
    subtitle: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '5px' },
    input: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
    textarea: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit' },
    btnPrimary: { backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' },
   btnNav: {
  backgroundColor: '#e0e7ff', // Tono violeta claro (mismo tono que la etiqueta 'Historial Clínico')
  color: '#4f46e5',           // Texto e íconos con el color índigo principal
  border: '1px solid #c7d2fe', // Borde suave en tono índigo
  padding: '10px 16px',
  borderRadius: '12px',       // Bordes redondeados para igualar al botón 'VOLVER'
  fontSize: '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.2s ease'
},
    btnSec: { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '14px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
    patientBadge: { backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    driveSection: { backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', padding: '16px', marginBottom: '25px' },
    adminNotice: { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '15px', borderRadius: '16px', fontSize: '13px', marginBottom: '25px' },
    fullReaderContainer: { backgroundColor: '#ffffff', minHeight: '50vh', padding: '10px 0' },
    badgeLectura: { display: 'inline-block', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '8px', marginBottom: '10px', textTransform: 'uppercase', backgroundColor: '#e0e7ff', color: '#4f46e5' }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>

        {/* 💻 MODO LECTURA DE SESIÓN SELECCIONADA */}
        {sesionLecturaSeleccionada ? (
          <div style={s.fullReaderContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={s.badgeLectura}>Historial de Sesiones</span>
                <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  {sesionLecturaSeleccionada.etiquetaSesion}
                </h1>
              </div>

              {/* ⬅️ ➡️ BARRA DE NAVEGACIÓN FLOTANTE */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={irASesionAnterior}
                  disabled={!tieneAnterior}
                  style={{ ...s.btnNav, opacity: tieneAnterior ? 1 : 0.4, cursor: tieneAnterior ? 'pointer' : 'not-allowed' }}
                >
                  ◄ Anterior
                </button>
                <button
                  type="button"
                  onClick={irASesionSiguiente}
                  disabled={!tieneSiguiente}
                  style={{ ...s.btnNav, opacity: tieneSiguiente ? 1 : 0.4, cursor: tieneSiguiente ? 'pointer' : 'not-allowed' }}
                >
                  Siguiente ►
                </button>
                <button type="button" onClick={() => setSesionLecturaSeleccionada(null)} style={{ ...s.btnPrimary, padding: '10px 18px' }}>
                  Volver
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '30px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div><span style={s.subtitle}>Paciente</span><strong>👤 {sesionLecturaSeleccionada.nombrePaciente}</strong></div>
              <div><span style={s.subtitle}>Especialista</span><strong>🩺 {sesionLecturaSeleccionada.nombreEvaluador}</strong></div>

              {/* 👑 EXCLUSIVO ADMIN: MODIFICAR FECHA/HORA (UNA ÚNICA VEZ) */}
              {esAdmin ? (
                <div style={{ gridColumn: '1 / -1', marginTop: '10px', backgroundColor: '#eff6ff', padding: '15px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <span style={{ ...s.subtitle, color: '#1d4ed8' }}>
                    {sesionLecturaSeleccionada.bloqueada ? "🔒 Fecha y Hora modificable " : "⚙️ Ajustar Fecha y Hora de Sesión (Solo 1 Modificación)"}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="date"
                      disabled={sesionLecturaSeleccionada.bloqueada}
                      style={{ ...s.input, padding: '8px 12px', fontSize: '13px', width: 'auto', backgroundColor: sesionLecturaSeleccionada.bloqueada ? '#f1f5f9' : '#ffffff' }}
                      value={fechaLectura}
                      onChange={(e) => setFechaLectura(e.target.value)}
                    />
                    <input
                      type="time"
                      disabled={sesionLecturaSeleccionada.bloqueada}
                      style={{ ...s.input, padding: '8px 12px', fontSize: '13px', width: 'auto', backgroundColor: sesionLecturaSeleccionada.bloqueada ? '#f1f5f9' : '#ffffff' }}
                      value={horaLectura}
                      onChange={(e) => setHoraLectura(e.target.value)}
                    />
                    {!sesionLecturaSeleccionada.bloqueada && (
                      <button
                        type="button"
                        onClick={actualizarFechaHoraYBloquear}
                        style={{ ...s.btnPrimary, padding: '9px 16px', fontSize: '11px', backgroundColor: '#2563eb' }}
                      >
                        Guardar y Bloquear
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div><span style={s.subtitle}>Fecha</span><strong>📅 {sesionLecturaSeleccionada.fechaSesion}</strong></div>
                  <div><span style={s.subtitle}>Hora</span><strong>⏰ {sesionLecturaSeleccionada.horaSesion || "00:00"}</strong></div>
                </>
              )}

              {/* 🛠️ PANEL DE AVANCE PARA PSICÓLOGOS */}
              {!esAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderLeft: '2px solid #cbd5e1', paddingLeft: '15px' }}>
                  <span style={{ ...s.subtitle, color: '#4f46e5' }}>Actualizar Progreso</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      style={{ ...s.input, padding: '6px 10px', fontSize: '13px', backgroundColor: '#ffffff', width: '90px' }}
                      value={nuevoAvanceLectura}
                      onChange={(e) => setNuevoAvanceLectura(Number(e.target.value))}
                    >
                      {[50, 100].map(pct => {
                        const esMenor = pct < Number(sesionLecturaSeleccionada.avance || 0);
                        return (
                          <option key={pct} value={pct} disabled={esMenor}>
                            {pct}% {esMenor ? "🔒" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={modificarAvanceDeSesionGuardada}
                      style={{ ...s.btnPrimary, padding: '6px 12px', fontSize: '11px', backgroundColor: '#4f46e5' }}
                    >
                      Ok
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', backgroundColor: '#fafafa' }}>
                <h3 style={{ fontSize: '13px', color: '#4f46e5', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Observaciones / Evolución del Caso
                </h3>
                <p style={{ fontSize: '14px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>
                  {sesionLecturaSeleccionada.observaciones || "Sin observaciones registradas."}
                </p>
              </div>

              {sesionLecturaSeleccionada.tareasRecomendaciones && (
                <div style={{ border: '1px solid #fef3c7', borderRadius: '16px', padding: '24px', backgroundColor: '#fffbeb' }}>
                  <h3 style={{ fontSize: '13px', color: '#b45309', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Tareas & Recomendaciones Asignadas
                  </h3>
                  <p style={{ fontSize: '14px', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>
                    {sesionLecturaSeleccionada.tareasRecomendaciones}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (

          /* 📝 INTERFAZ PRINCIPAL / FORMULARIO */
          <>
            <button onClick={() => navigate("/dashboard")} style={s.backBtn}>
              ← Volver al inicio
            </button>

            <header style={s.header}>
              <h1 style={s.title}>SESIONES</h1>
            </header>

            {/* 🔍 BÚSQUEDA DE EXPEDIENTE */}
            {!pacienteEncontrado ? (
              <form onSubmit={buscarPaciente} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
                <label style={s.subtitle}>Código de Expediente del Paciente</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Ej. PX-102"
                    required
                    style={{ ...s.input, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}
                    value={codigoPaciente}
                    onChange={(e) => setCodigoPaciente(e.target.value)}
                  />
                  <button type="submit" disabled={loadingBusqueda} style={{ ...s.btnPrimary, padding: '12px 24px' }}>
                    {loadingBusqueda ? "..." : "Entrar"}
                  </button>
                </div>
              </form>
            ) : (

              /* 📊 EXPEDIENTE ACTIVO */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* FICHA DEL PACIENTE Y DESPLEGABLE DE SESIONES */}
                <div style={s.patientBadge}>
                  <div>
                    <span style={s.subtitle}>Paciente</span>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e1b4b', margin: 0 }}>👤 {pacienteEncontrado.nombre}</h2>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <select
                      style={{
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        padding: '10px 32px 10px 20px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        textAlign: 'center',
                        boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)'
                      }}
                      onChange={manejarSeleccionMenuLectura}
                      value={sesionLecturaSeleccionada?.id || ""}
                    >
                      <option value="" style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
                        Ver sesiones anteriores
                      </option>

                      {historialSesiones.length > 0 ? (
                        <optgroup label="Historial de Sesiones">
                          {historialSesiones.map((s) => (
                            <option key={s.id} value={s.id} style={{ backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 'normal' }}>
                              {s.etiquetaSesion} - {s.fechaSesion} {s.horaSesion ? `` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <optgroup label="📂 Sin sesiones previas" style={{ backgroundColor: '#ffffff', color: '#94a3b8' }} disabled />
                      )}
                    </select>
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ffffff', pointerEvents: 'none', fontSize: '10px' }}>▼</span>
                  </div>
                </div>

                {/* GOOGLE DRIVE LINK */}
                <div style={s.driveSection}>
                  <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#78350f', margin: '0 0 8px 0', textTransform: 'uppercase' }}>📂 Link del Drive</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="url"
                      placeholder={esAdmin ? "Pegar enlace de carpeta de sesiones..." : "Drive de sesiones no asignado"}
                      disabled={!esAdmin}
                      style={{ ...s.input, padding: '10px 14px', fontSize: '12px', backgroundColor: '#ffffff' }}
                      value={urlDriveSesiones}
                      onChange={(e) => setUrlDriveSesiones(e.target.value)}
                    />
                    {esAdmin ? (
                      <button type="button" onClick={guardarEnlaceDriveSesiones} style={{ ...s.btnPrimary, fontSize: '11px', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                        Asignar Link
                      </button>
                    ) : (
                      urlDriveSesiones && (
                        <a href={urlDriveSesiones} target="_blank" rel="noreferrer" style={{ ...s.btnPrimary, backgroundColor: '#059669', fontSize: '11px', padding: '10px 18px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                          Abrir
                        </a>
                      )
                    )}
                  </div>
                </div>

                {/* FORMULARIO DE REGISTRO */}
                {esAdmin ? (
                  <div style={s.adminNotice}>
                    <strong>Modo Administrador:</strong> Puedes consultar el historial clínico seleccionando cualquier sesión del menú desplegable o gestionar el link de Drive.
                  </div>
                ) : (
                  <form onSubmit={guardarSesion} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <div>
                        <label style={s.subtitle}>Especialista Evaluador *</label>
                        <select
                          required
                          style={{ ...s.input, appearance: 'none', backgroundColor: '#ffffff' }}
                          value={nombreEvaluador}
                          onChange={(e) => setNombreEvaluador(e.target.value)}
                        >
                          {listaPsicologos.length === 0 ? (
                            <option value="">Cargando especialistas...</option>
                          ) : (
                            listaPsicologos.map((psico) => (
                              <option key={psico.id} value={psico.nombre || psico.nombreCompleto}>
                                {psico.nombre || psico.nombreCompleto}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label style={s.subtitle}>Fecha de Consulta *</label>
                        <input
                          type="date"
                          required
                          style={s.input}
                          value={fechaSesion}
                          onChange={(e) => setFechaSesion(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={s.subtitle}>Hora de Consulta *</label>
                        <input
                          type="time"
                          required
                          style={s.input}
                          value={horaSesion}
                          onChange={(e) => setHoraSesion(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <label style={s.subtitle}>Observaciones / Progreso de la Sesión</label>
                        <textarea
                          rows="4"
                          required
                          placeholder="Escribe el progreso, comportamiento, intervenciones efectuadas y observaciones clínicas generales"
                          style={s.textarea}
                          value={observaciones}
                          onChange={(e) => setObservaciones(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={s.subtitle}>Tareas / Recomendaciones</label>
                        <textarea
                          rows="3"
                          placeholder="Escribe pautas o tareas asignadas al paciente..."
                          style={s.textarea}
                          value={tareasRecomendaciones}
                          onChange={(e) => setTareasRecomendaciones(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={s.subtitle}>PROGRESO</label>
                        <select
                          style={{ ...s.input, backgroundColor: '#ffffff' }}
                          value={avance}
                          onChange={(e) => setAvance(Number(e.target.value))}
                        >
                          {[50, 100].map(pct => (
                            <option key={pct} value={pct}>
                              {pct}% - {pct === 100 ? "Subido" : "Sin Subir"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" disabled={loadingGuardar} style={{ ...s.btnPrimary, flex: 2 }}>
                        {loadingGuardar ? "Guardando..." : "Guardar Sesión"}
                      </button>
                      <button type="button" onClick={() => { setPacienteEncontrado(null); setCodigoPaciente("") }} style={s.btnSec}>
                        Salir
                      </button>
                    </div>
                  </form>
                )}

                {esAdmin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" onClick={() => { setPacienteEncontrado(null); setCodigoPaciente("") }} style={s.btnSec}>
                      Buscar otro expediente
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}