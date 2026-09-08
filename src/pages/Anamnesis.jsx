import { useState } from "react"
import { collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Anamnesis() {
  const navigate = useNavigate()
  const { user, role, userData } = useAuth()
  
  // 🔒 IDENTIFICACIÓN DE ROLES
  const roleNorm = String(role || user?.role || "").toLowerCase().trim()
  const esAdmin = roleNorm === "admin"
  const esInterno = roleNorm === "interno" || roleNorm === "practicante"

  // 📝 EXTRAER NOMBRE DEL EVALUADOR DEL CORREO SIN DOMINIO
  const obtenerNombreEvaluador = () => {
    const correo = user?.email || userData?.email || ""
    if (!correo) return "Especialista Asignado"

    const usuarioBase = correo.split("@")[0]

    return usuarioBase
      .replace(/[._]/g, " ")
      .split(" ")
      .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
      .join(" ")
  }

  const nombreEvaluador = obtenerNombreEvaluador()

  // 📝 ESTADOS DE BÚSQUEDA Y PACIENTE
  const [codigoPaciente, setCodigoPaciente] = useState("")
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [historialAnamnesis, setHistorialAnamnesis] = useState([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [loadingGuardar, setLoadingGuardar] = useState(false)
  const [loadingGuardarUrl, setLoadingGuardarUrl] = useState(false)

  // 👁️ ESTADOS DE VISUALIZACIÓN, EDICIÓN Y CREACIÓN
  const [anamnesisLecturaSeleccionada, setAnamnesisLecturaSeleccionada] = useState(null)
  const [nuevoAvanceLectura, setNuevoAvanceLectura] = useState(10)
  const [modoCreandoNueva, setModoCreandoNueva] = useState(false)
  const [fechaLectura, setFechaLectura] = useState("")
  const [horaLectura, setHoraLectura] = useState("00:00")

  // 📋 CAMPOS DEL FORMULARIO DE ANAMNESIS
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split('T')[0])
  const [horaConsulta, setHoraConsulta] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
  const [avance, setAvance] = useState(50)
  const [numeroAnamnesis, setNumeroAnamnesis] = useState(1)

  const [motivoConsulta, setMotivoConsulta] = useState("")
  const [diagnosticoPrevio, setDiagnosticoPrevio] = useState("")

  // 🔗 1. ENLACES GUARDADOS EN FIREBASE
  const [savedUrlAnamnesis, setSavedUrlAnamnesis] = useState("")
  const [savedUrlInforme, setSavedUrlInforme] = useState("")
  const [savedUrlConsentimiento, setSavedUrlConsentimiento] = useState("")

  // ✏️ 2. BORRADORES DE TEXTO MIENTRAS EL USUARIO ESCRIBE
  const [inputUrlAnamnesis, setInputUrlAnamnesis] = useState("")
  const [inputUrlInforme, setInputUrlInforme] = useState("")
  const [inputUrlConsentimiento, setInputUrlConsentimiento] = useState("")

  // 🔄 3. BANDERAS DE MODO EDICIÓN
  const [editandoAnamnesis, setEditandoAnamnesis] = useState(false)
  const [editandoInforme, setEditandoInforme] = useState(false)
  const [editandoConsentimiento, setEditandoConsentimiento] = useState(false)

  // 🕒 TIMESTAMP CRONOLÓGICO ESTRICTO POR FECHA Y HORA
  const obtenerTimestampConsulta = (fecha, hora) => {
    if (!fecha) return 0
    const horaValida = hora || "00:00"
    return new Date(`${fecha.replace(/-/g, '/')} ${horaValida}`).getTime() || 0
  }

  // ✂️ FUNCIÓN: SOLO PRIMER NOMBRE + INICIAL DEL PRIMER APELLIDO ("Juan P.")
  const formatearNombrePaciente = (nombreCompleto) => {
    if (!nombreCompleto || typeof nombreCompleto !== "string") return ""
    const partes = nombreCompleto.trim().split(/\s+/)
    if (partes.length === 1) return partes[0]

    const primerNombre = partes[0]
    const primerApellido = partes.length >= 3 ? partes[partes.length - 2] : partes[1]

    return `${primerNombre} ${primerApellido.charAt(0).toUpperCase()}.`
  }

  // 🔍 BUSCAR PACIENTE (MANEJO MEJORADO DE PERMISOS FIRESTORE)
  const buscarPaciente = async (e) => {
    if (e) e.preventDefault()
    const codigoLimpio = codigoPaciente.trim()
    if (!codigoLimpio) return

    setLoadingBusqueda(true)
    setPacienteEncontrado(null)
    setHistorialAnamnesis([])
    setAnamnesisLecturaSeleccionada(null)
    setModoCreandoNueva(false)
    setEditandoAnamnesis(false)
    setEditandoInforme(false)
    setEditandoConsentimiento(false)

    try {
      let datos = null
      let idPac = codigoLimpio

      // Intento 1: Obtener directamente por ID de documento
      const pacienteRef = doc(db, "pacientes", codigoLimpio)
      const snapPaciente = await getDoc(pacienteRef)

      if (snapPaciente.exists()) {
        datos = snapPaciente.data()
      } else {
        // Intento 2: Buscar por query del campo "codigo" o "codigoExpediente"
        const q = query(collection(db, "pacientes"), where("codigo", "==", codigoLimpio))
        const qSnap = await getDocs(q)
        if (!qSnap.empty) {
          const docEncontrado = qSnap.docs[0]
          idPac = docEncontrado.id
          datos = docEncontrado.data()
        }
      }

      if (!datos) {
        alert("❌ Código inválido. No se encontró ningún expediente.")
        setLoadingBusqueda(false)
        return
      }

      const nombreFormateado = formatearNombrePaciente(datos.nombre || "")

      setPacienteEncontrado({
        id: idPac,
        ...datos,
        nombreFormateado
      })
    
      // 📌 Cargar links exactos guardados en Firestore
      const linkAnamnesis = datos.enlaceDriveAnamnesis || datos.urlAnamnesis || datos.driveAnamnesis || ""
      const linkInforme = datos.enlaceDriveInforme || datos.urlInformePrevio || datos.driveInforme || ""
      const linkConsentimiento = datos.enlaceDriveConsentimiento || datos.urlConsentimiento || datos.driveConsentimiento || ""

      // Asignar tanto a confirmados como a borradores
      setSavedUrlAnamnesis(linkAnamnesis)
      setInputUrlAnamnesis(linkAnamnesis)

      setSavedUrlInforme(linkInforme)
      setInputUrlInforme(linkInforme)

      setSavedUrlConsentimiento(linkConsentimiento)
      setInputUrlConsentimiento(linkConsentimiento)

      await actualizarHistorialLocal(idPac)
    } catch (error) {
      console.error("Error al buscar paciente:", error)
      alert("Error al cargar el expediente. Verifica los permisos del usuario.")
    } finally {
      setLoadingBusqueda(false)
    }
  }

  // 🔄 ACTUALIZAR Y REORDENAR CRONOLÓGICAMENTE EL HISTORIAL DE ANAMNESIS
  const actualizarHistorialLocal = async (idPac) => {
    try {
      const qAnamnesis = query(collection(db, "anamnesis"), where("idPaciente", "==", idPac))
      const snapAnamnesis = await getDocs(qAnamnesis)

      const listaOriginal = snapAnamnesis.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          timestampConsulta: obtenerTimestampConsulta(data.fechaConsulta, data.horaConsulta),
          timestampRegistro: data.fechaRegistro?.toMillis?.() || 0
        }
      })

      // Ordenar ascendentemente por timestamp de fecha/hora de consulta
      listaOriginal.sort((a, b) => {
        if (a.timestampConsulta !== b.timestampConsulta) {
          return a.timestampConsulta - b.timestampConsulta
        }
        return a.timestampRegistro - b.timestampRegistro
      })

      // Asignar numeración dinámica correlativa (Anamnesis 1, 2, 3...)
      const listaCorregida = listaOriginal.map((registro, idx) => {
        const numDinamico = idx + 1
        return {
          ...registro,
          numeroCorrelativo: numDinamico,
          etiquetaAnamnesis: `Anamnesis ${numDinamico}`
        }
      })

      // Mantener actualizada la anamnesis en modo lectura si está seleccionada
      setAnamnesisLecturaSeleccionada(prev => {
        if (!prev) return null
        const regActualizado = listaCorregida.find(a => a.id === prev.id)
        return regActualizado || prev
      })

      // Para el menú desplegable mostramos la lista invertida (más reciente arriba)
      const listaParaDesplegable = [...listaCorregida].reverse()
      setHistorialAnamnesis(listaParaDesplegable)
      setNumeroAnamnesis(listaCorregida.length + 1)
    } catch (error) {
      console.error("Error al actualizar historial:", error)
    }
  }
  
  // 💾 GUARDAR NUEVA ANAMNESIS
  const guardarAnamnesis = async (e) => {
    e.preventDefault()
    if (esAdmin) return

    if (!motivoConsulta.trim() && !diagnosticoPrevio.trim()) {
      alert("Por favor completa los detalles de la consulta.")
      return
    }

    setLoadingGuardar(true)

    const nuevaAnamnesis = {
      idPaciente: pacienteEncontrado.id,
      nombrePaciente: pacienteEncontrado.nombreFormateado,
      nombreEvaluador,
      fechaConsulta,
      horaConsulta: horaConsulta || "00:00",
      numeroAnamnesis,
      avance: Number(avance),
      motivoConsulta: motivoConsulta.trim(),
      diagnosticoPrevio: diagnosticoPrevio.trim(),
      fechaRegistro: serverTimestamp(),
      bloqueada: false
    }

    try {
      await addDoc(collection(db, "anamnesis"), nuevaAnamnesis)
      alert(`🎉 Registro exitoso: Anamnesis guardada.`)
      setMotivoConsulta("")
      setDiagnosticoPrevio("")
      setModoCreandoNueva(false)
      await actualizarHistorialLocal(pacienteEncontrado.id)
    } catch (error) {
      console.error("Error al guardar anamnesis:", error)
      alert("No se pudo registrar la anamnesis.")
    } finally {
      setLoadingGuardar(false)
    }
  }

  // ⏰ EXCLUSIVO ADMIN: ACTUALIZAR FECHA/HORA DE ANAMNESIS Y BLOQUEAR
  const actualizarFechaHoraYBloquear = async () => {
    if (!anamnesisLecturaSeleccionada || !esAdmin) return
    if (anamnesisLecturaSeleccionada.bloqueada) {
      alert("🔒 Esta anamnesis ya fue actualizada anteriormente y no puede volver a modificarse.")
      return
    }

    if (!fechaLectura) {
      alert("Por favor selecciona una fecha válida.")
      return
    }

    try {
      const refDoc = doc(db, "anamnesis", anamnesisLecturaSeleccionada.id)
      await updateDoc(refDoc, { 
        fechaConsulta: fechaLectura,
        horaConsulta: horaLectura || "00:00",
        bloqueada: true 
      })

      if (pacienteEncontrado?.id) {
        await actualizarHistorialLocal(pacienteEncontrado.id)
      }
      alert(`🔒 Fecha y hora actualizadas correctamente. El registro ha sido bloqueado para futuras modificaciones.`)
    } catch (error) {
      console.error("Error al actualizar fecha y hora:", error)
      alert("No se pudo actualizar la fecha y hora de la anamnesis.")
    }
  }

  // 💾 GUARDAR URL EN FIREBASE
  const guardarUrlManual = async (campoFirestore, valorUrlBorrador) => {
    if (!pacienteEncontrado?.id) return
    if (!valorUrlBorrador || !valorUrlBorrador.trim()) {
      alert("Por favor ingresa una URL válida de Drive.")
      return
    }

    setLoadingGuardarUrl(true)

    try {
      const pacienteRef = doc(db, "pacientes", pacienteEncontrado.id)
      const urlLimpia = valorUrlBorrador.trim()

      await updateDoc(pacienteRef, {
        [campoFirestore]: urlLimpia
      })

      setPacienteEncontrado(prev => ({ ...prev, [campoFirestore]: urlLimpia }))
      
      if (campoFirestore === 'enlaceDriveAnamnesis') {
        setSavedUrlAnamnesis(urlLimpia)
        setInputUrlAnamnesis(urlLimpia)
        setEditandoAnamnesis(false)
      }
      if (campoFirestore === 'enlaceDriveInforme') {
        setSavedUrlInforme(urlLimpia)
        setInputUrlInforme(urlLimpia)
        setEditandoInforme(false)
      }
      if (campoFirestore === 'enlaceDriveConsentimiento') {
        setSavedUrlConsentimiento(urlLimpia)
        setInputUrlConsentimiento(urlLimpia)
        setEditandoConsentimiento(false)
      }

      alert("🔗 Enlace guardado correctamente en Firebase.")
    } catch (error) {
      console.error("Error al guardar la URL:", error)
      alert("No se pudo guardar la URL de Drive.")
    } finally {
      setLoadingGuardarUrl(false)
    }
  }

  const modificarAvance = async () => {
    if (!anamnesisLecturaSeleccionada) return
    const avanceAnterior = Number(anamnesisLecturaSeleccionada.avance || 0)
    const avanceSiguiente = Number(nuevoAvanceLectura)

    if (avanceSiguiente < avanceAnterior) {
      alert(`⚠️ El porcentaje solo puede avanzar. No puedes reducir del ${avanceAnterior}% al ${avanceSiguiente}%.`)
      setNuevoAvanceLectura(avanceAnterior)
      return
    }

    try {
      const refDoc = doc(db, "anamnesis", anamnesisLecturaSeleccionada.id)
      await updateDoc(refDoc, { avance: avanceSiguiente })
      setAnamnesisLecturaSeleccionada(prev => ({ ...prev, avance: avanceSiguiente }))
      await actualizarHistorialLocal(pacienteEncontrado.id)
      alert(`📈 Progreso actualizado al ${avanceSiguiente}%.`)
    } catch (error) {
      console.error("Error al actualizar avance:", error)
      alert("No se pudo actualizar el progreso.")
    }
  }

  // Cargar datos de la anamnesis seleccionada
  const cambiarAnamnesisSeleccionada = (registro) => {
    setAnamnesisLecturaSeleccionada(registro || null)
    setModoCreandoNueva(false)
    if (registro) {
      setNuevoAvanceLectura(registro.avance || 10)
      setFechaLectura(registro.fechaConsulta || "")
      setHoraLectura(registro.horaConsulta || "00:00")
    }
  }

  // 🔽 MANEJO DEL MENÚ DESPLEGABLE
  const manejarSeleccionMenu = (e) => {
    const valor = e.target.value

    if (valor === "NUEVA") {
      setAnamnesisLecturaSeleccionada(null)
      setModoCreandoNueva(true)
    } else if (valor !== "") {
      const registro = historialAnamnesis.find(a => a.id === valor)
      cambiarAnamnesisSeleccionada(registro)
    } else {
      setAnamnesisLecturaSeleccionada(null)
      setModoCreandoNueva(false)
    }
  }

  // ⬅️ ➡️ LÓGICA DE NAVEGACIÓN ANTERIOR / SIGUIENTE
  const indiceActual = historialAnamnesis.findIndex(a => a.id === anamnesisLecturaSeleccionada?.id)
  const tieneAnterior = indiceActual !== -1 && indiceActual < historialAnamnesis.length - 1
  const tieneSiguiente = indiceActual > 0

  const irAAnamnesisAnterior = () => {
    if (tieneAnterior) {
      cambiarAnamnesisSeleccionada(historialAnamnesis[indiceActual + 1])
    }
  }

  const irAAnamnesisSiguiente = () => {
    if (tieneSiguiente) {
      cambiarAnamnesisSeleccionada(historialAnamnesis[indiceActual - 1])
    }
  }

  const resetearBusqueda = () => {
    setPacienteEncontrado(null)
    setCodigoPaciente("")
    setHistorialAnamnesis([])
    setAnamnesisLecturaSeleccionada(null)
    setModoCreandoNueva(false)

    setSavedUrlAnamnesis("")
    setSavedUrlInforme("")
    setSavedUrlConsentimiento("")

    setInputUrlAnamnesis("")
    setInputUrlInforme("")
    setInputUrlConsentimiento("")

    setEditandoAnamnesis(false)
    setEditandoInforme(false)
    setEditandoConsentimiento(false)
  }

  // 🎨 ESTILOS DE LA INTERFAZ
  const s = {
    container: {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh',
      padding: '0 0 60px 0',
      boxSizing: 'border-box'
    },
    topBar: {
      backgroundColor: '#ffffff',
      height: '64px',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #e2e8f0',
      marginBottom: '32px'
    },
    topBarLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    topIconBox: {
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px'
    },
    topTitle: {
      fontSize: '15px',
      fontWeight: '800',
      color: '#1e293b',
      letterSpacing: '0.5px'
    },
    topNavRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    },
    btnLinkHeader: {
      background: 'none',
      border: 'none',
      color: '#475569',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    btnNuevaBusqueda: {
      backgroundColor: '#5850ec',
      color: '#ffffff',
      border: 'none',
      padding: '8px 18px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    btnNav: {
      backgroundColor: '#e0e7ff',
      color: '#4f46e5',
      border: '1px solid #c7d2fe',
      padding: '8px 14px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease'
    },
    btnPrimary: {
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer'
    },
    layoutGrid: {
      maxWidth: '1150px',
      margin: '0 auto',
      padding: '0 20px',
      display: 'grid',
      gridTemplateColumns: (esAdmin || esInterno) ? '1fr' : 'minmax(0, 1fr) 340px',
      gap: '24px',
      alignItems: 'start'
    },
    cardForm: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    },
    cardSide: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    },
    patientHeader: {
      backgroundColor: '#0b1329',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      justify: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    patientLabel: {
      fontSize: '10px',
      fontWeight: '800',
      color: '#94a3b8',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      display: 'block',
      marginBottom: '4px'
    },
    patientName: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#ffffff',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    selectAnamnesis: {
      backgroundColor: '#1e293b',
      color: '#ffffff',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '12px',
      fontWeight: 'bold',
      outline: 'none',
      cursor: 'pointer'
    },
    boxDriveAdminContainer: {
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    boxDriveLabel: {
      fontSize: '11px',
      fontWeight: '800',
      color: '#3830a3',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    btnAbrirDrive: {
      backgroundColor: '#e0e7ff',
      color: '#4f46e5',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 18px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      whiteSpace: 'nowrap'
    },
    btnEditarDrive: {
      backgroundColor: '#ffffff',
      color: '#475569',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center'
    },
    btnGuardarLink: {
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 20px',
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
    },
    btnCancelarDrive: {
      backgroundColor: '#f1f5f9',
      color: '#64748b',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      padding: '10px 12px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    labelField: {
      fontSize: '11px',
      fontWeight: '800',
      color: '#3830a3',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      display: 'block',
      marginBottom: '6px'
    },
    inputStyle: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      fontSize: '13px',
      color: '#1e293b',
      outline: 'none',
      boxSizing: 'border-box'
    },
    inputReadOnly: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#f8fafc',
      fontSize: '13px',
      fontWeight: '600',
      color: '#475569',
      outline: 'none',
      boxSizing: 'border-box',
      cursor: 'not-allowed'
    },
    textareaStyle: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      fontSize: '12px',
      color: '#475569',
      outline: 'none',
      boxSizing: 'border-box',
      resize: 'vertical',
      fontFamily: 'inherit',
      lineHeight: '1.5'
    },
    sideHeaderLabel: {
      fontSize: '10px',
      fontWeight: '800',
      color: '#3830a3',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px'
    },
    driveCardPsicologo: {
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '10px'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalCard: {
      backgroundColor: '#ffffff',
      borderRadius: '20px',
      width: '100%',
      maxWidth: '650px',
      padding: '28px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      maxHeight: '90vh',
      overflowY: 'auto'
    }
  }

  return (
    <div style={s.container}>
      {/* 🔝 ENCABEZADO SUPERIOR */}
      <header style={s.topBar}>
        <div style={s.topBarLeft}>
          <div style={s.topIconBox}>📝</div>
          <div>
            <span style={s.topTitle}>ANAMNESIS</span>
          </div>
        </div>

        <div style={s.topNavRight}>
          <button type="button" style={s.btnLinkHeader} onClick={() => navigate("/dashboard")}>
            Volver al Inicio
          </button>
          <button type="button" style={s.btnNuevaBusqueda} onClick={resetearBusqueda}>
            + Nueva Búsqueda
          </button>
        </div>
      </header>

      {/* 🔲 MODAL FLOTANTE DE HISTORIAL (MODO LECTURA DE ANAMNESIS) */}
      {anamnesisLecturaSeleccionada && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', fontSize: '10px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px' }}>
                  HISTORIAL DE ANAMNESIS
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '6px 0 0 0' }}>
                  Anamnesis N.º {anamnesisLecturaSeleccionada.numeroCorrelativo || anamnesisLecturaSeleccionada.numeroAnamnesis || 1}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setAnamnesisLecturaSeleccionada(null)} 
                  style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                >
                  VOLVER
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <span style={s.labelField}>PACIENTE</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                  👤 {formatearNombrePaciente(anamnesisLecturaSeleccionada.nombrePaciente)}
                </p>
              </div>

              <div>
                <span style={s.labelField}>FECHA</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>📅 {anamnesisLecturaSeleccionada.fechaConsulta}</p>
              </div>

              <div>
                <span style={s.labelField}>ESPECIALISTA</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>🩺 {anamnesisLecturaSeleccionada.nombreEvaluador}</p>
              </div>

              <div>
                <span style={s.labelField}>PROGRESO</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>📈 {anamnesisLecturaSeleccionada.avance}%</p>
              </div>

              {!esAdmin && (
                <div>
                  <span style={s.labelField}>ACTUALIZAR PROGRESO</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <select
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      value={nuevoAvanceLectura}
                      onChange={(e) => setNuevoAvanceLectura(Number(e.target.value))}
                    >
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => {
                        const esMenor = pct < Number(anamnesisLecturaSeleccionada.avance || 0);
                        return (
                          <option key={pct} value={pct} disabled={esMenor}>
                            {pct}% {esMenor ? "🔒" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button 
                      type="button" 
                      onClick={modificarAvance}
                      style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>

            {anamnesisLecturaSeleccionada.motivoConsulta && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <span style={s.labelField}>MOTIVO DE CONSULTA ACTUAL</span>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {anamnesisLecturaSeleccionada.motivoConsulta}
                </p>
              </div>
            )}

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <span style={s.labelField}>DIAGNÓSTICO PREVIO</span>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {anamnesisLecturaSeleccionada.diagnosticoPrevio || "Sin información registrada."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 VISTA 1: BÚSQUEDA SI NO HAY PACIENTE SELECCIONADO */}
      {!pacienteEncontrado ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 180px)',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '40px 36px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
            width: '100%',
            maxWidth: '520px',
            textAlign: 'center'
          }}>
            <form onSubmit={buscarPaciente} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📂</span>
                <label style={{ ...s.labelField, fontSize: '13px', letterSpacing: '0.8px' }}>
                  CÓDIGO DE EXPEDIENTE DEL PACIENTE
                </label>
              </div>

              <input
                type="text"
                placeholder="Ej. PX-102"
                required
                style={{
                  ...s.inputStyle,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  padding: '14px',
                  letterSpacing: '1px'
                }}
                value={codigoPaciente}
                onChange={(e) => setCodigoPaciente(e.target.value)}
              />

              <button
                type="submit"
                disabled={loadingBusqueda}
                style={{
                  ...s.btnNuevaBusqueda,
                  width: '100%',
                  justifyContent: 'center',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loadingBusqueda ? "Buscando..." : "Buscar Expediente"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 📄 VISTA 2: PANEL SEGÚN EL ROL */
        <main style={s.layoutGrid}>
          <section style={s.cardForm}>
            {/* BADGE OSCURO PACIENTE Y SELECTOR */}
            <div style={s.patientHeader}>
              <div>
                <span style={s.patientLabel}>PACIENTE</span>
                <h2 style={s.patientName}>
                  👤 {pacienteEncontrado.nombreFormateado}
                </h2>
              </div>

              {/* SELECTOR DE HISTORIAL DE ANAMNESIS */}
              <select
                style={s.selectAnamnesis}
                onChange={manejarSeleccionMenu}
                value={anamnesisLecturaSeleccionada?.id || (modoCreandoNueva ? "NUEVA" : "")}
              >
                <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                  Nueva Anamnesis ( N.º {numeroAnamnesis})
                </option>
                {historialAnamnesis.map((a) => (
                  <option key={a.id} value={a.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    Anamnesis N.º {a.numeroCorrelativo || a.numeroAnamnesis} ({a.fechaConsulta})
                  </option>
                ))}
              </select>
            </div>

            {/* 👑 VISTA 1: ADMINISTRADOR (GESTIÓN DRIVE) */}
            {esAdmin ? (
              <div>
                <div style={s.boxDriveAdminContainer}>
                  {/* 1. CARPETA ANAMNESIS */}
                  <div>
                    <span style={s.boxDriveLabel}>📁 CARPETA ANAMNESIS</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlAnamnesis && !editandoAnamnesis ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlAnamnesis}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlAnamnesis} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlAnamnesis(savedUrlAnamnesis);
                              setEditandoAnamnesis(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlAnamnesis}
                            onChange={(e) => setInputUrlAnamnesis(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveAnamnesis', inputUrlAnamnesis)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoAnamnesis && (
                            <button
                              type="button"
                              onClick={() => setEditandoAnamnesis(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. CARPETA INFORME PREVIO */}
                  <div>
                    <span style={s.boxDriveLabel}>📄 CARPETA INFORME PREVIO</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlInforme && !editandoInforme ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlInforme}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlInforme} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlInforme(savedUrlInforme);
                              setEditandoInforme(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlInforme}
                            onChange={(e) => setInputUrlInforme(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveInforme', inputUrlInforme)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoInforme && (
                            <button
                              type="button"
                              onClick={() => setEditandoInforme(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. CARPETA CONSENTIMIENTO INFORMADO */}
                  <div>
                    <span style={s.boxDriveLabel}>📋 CARPETA CONSENTIMIENTO INFORMADO</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlConsentimiento && !editandoConsentimiento ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlConsentimiento}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlConsentimiento} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlConsentimiento(savedUrlConsentimiento);
                              setEditandoConsentimiento(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlConsentimiento}
                            onChange={(e) => setInputUrlConsentimiento(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveConsentimiento', inputUrlConsentimiento)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoConsentimiento && (
                            <button
                              type="button"
                              onClick={() => setEditandoConsentimiento(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : esInterno ? (
              /* 🎓 VISTA 2: INTERNO (GESTIÓN DRIVE INDEPENDIENTE) */
              <div>
                <div style={s.boxDriveAdminContainer}>
                  {/* 1. CARPETA ANAMNESIS */}
                  <div>
                    <span style={s.boxDriveLabel}>📁 CARPETA ANAMNESIS</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlAnamnesis && !editandoAnamnesis ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlAnamnesis}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlAnamnesis} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlAnamnesis(savedUrlAnamnesis);
                              setEditandoAnamnesis(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlAnamnesis}
                            onChange={(e) => setInputUrlAnamnesis(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveAnamnesis', inputUrlAnamnesis)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoAnamnesis && (
                            <button
                              type="button"
                              onClick={() => setEditandoAnamnesis(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. CARPETA INFORME PREVIO */}
                  <div>
                    <span style={s.boxDriveLabel}>📄 CARPETA INFORME PREVIO</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlInforme && !editandoInforme ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlInforme}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlInforme} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlInforme(savedUrlInforme);
                              setEditandoInforme(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlInforme}
                            onChange={(e) => setInputUrlInforme(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveInforme', inputUrlInforme)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoInforme && (
                            <button
                              type="button"
                              onClick={() => setEditandoInforme(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. CARPETA CONSENTIMIENTO INFORMADO */}
                  <div>
                    <span style={s.boxDriveLabel}>📋 CARPETA CONSENTIMIENTO INFORMADO</span>
                    <div style={{ marginTop: '8px' }}>
                      {savedUrlConsentimiento && !editandoConsentimiento ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={savedUrlConsentimiento}
                            style={{ ...s.inputStyle, ...s.inputReadOnly, fontSize: '12px' }}
                          />
                          <a href={savedUrlConsentimiento} target="_blank" rel="noopener noreferrer" style={s.btnAbrirDrive}>
                            Abrir ↗
                          </a>
                          <button 
                            type="button"
                            onClick={() => {
                              setInputUrlConsentimiento(savedUrlConsentimiento);
                              setEditandoConsentimiento(true);
                            }}
                            style={s.btnEditarDrive}
                          >
                            Editar ✏️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={inputUrlConsentimiento}
                            onChange={(e) => setInputUrlConsentimiento(e.target.value)}
                            style={{ ...s.inputStyle, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            disabled={loadingGuardarUrl}
                            onClick={() => guardarUrlManual('enlaceDriveConsentimiento', inputUrlConsentimiento)}
                            style={s.btnGuardarLink}
                          >
                            {loadingGuardarUrl ? "Guardando..." : "Guardar Link"}
                          </button>
                          {editandoConsentimiento && (
                            <button
                              type="button"
                              onClick={() => setEditandoConsentimiento(false)}
                              style={s.btnCancelarDrive}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 🩺 VISTA 3: PSICÓLOGO (FORMULARIO DE REGISTRO) */
              <form onSubmit={guardarAnamnesis} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={s.labelField}>ESPECIALISTA EVALUADOR</label>
                    <input
                      type="text"
                      readOnly
                      value={nombreEvaluador}
                      style={s.inputReadOnly}
                    />
                  </div>

                  <div>
                    <label style={s.labelField}>FECHA</label>
                    <input
                      type="date"
                      style={s.inputStyle}
                      value={fechaConsulta}
                      onChange={(e) => setFechaConsulta(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={s.labelField}>PROGRESO</label>
                    <select
                      style={{ ...s.inputStyle, backgroundColor: '#ffffff' }}
                      value={avance}
                      onChange={(e) => setAvance(Number(e.target.value))}
                    >
                      {[50, 100].map(pct => (
                        <option key={pct} value={pct}>
                          {pct}% {pct === 100 ? "Subido" : "Sin Subir"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={s.labelField}>MOTIVO DE CONSULTA ACTUAL</label>
                  <textarea
                    rows={3}
                    placeholder="Escribe la sintomatología actual..."
                    style={s.textareaStyle}
                    value={motivoConsulta}
                    onChange={(e) => setMotivoConsulta(e.target.value)}
                  />
                </div>

                <div>
                  <label style={s.labelField}>DIAGNÓSTICO PREVIO</label>
                  <textarea
                    rows={3}
                    placeholder="Estructuras familiares, dinámicas o antecedentes..."
                    style={s.textareaStyle}
                    value={diagnosticoPrevio}
                    onChange={(e) => setDiagnosticoPrevio(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingGuardar}
                  style={{
                    backgroundColor: '#5850ec',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {loadingGuardar ? "Guardando..." : `Guardar Anamnesis N.º ${numeroAnamnesis}`}
                </button>
              </form>
            )}
          </section>

          {/* COLUMNA DERECHA: ACCESOS RÁPIDOS DE DRIVE PARA EL PSICÓLOGO */}
          {!esAdmin && (
            <aside style={s.cardSide}>
              {/* 1. CARPETA ANAMNESIS */}
              <div style={s.driveCardPsicologo}>
                <span style={s.sideHeaderLabel}>📁 DRIVE ANAMNESIS</span>
                {savedUrlAnamnesis ? (
                  <a 
                    href={savedUrlAnamnesis} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ ...s.btnAbrirDrive, width: '100%', justifyContent: 'center', marginTop: '6px', boxSizing: 'border-box' }}
                  >
                    Abrir ↗
                  </a>
                ) : (
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>No asignado</p>
                )}
              </div>

              {/* 2. INFORME PREVIO */}
              <div style={s.driveCardPsicologo}>
                <span style={s.sideHeaderLabel}>📄 DRIVE INFORME PREVIO</span>
                {savedUrlInforme ? (
                  <a 
                    href={savedUrlInforme} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ ...s.btnAbrirDrive, width: '100%', justifyContent: 'center', marginTop: '6px', boxSizing: 'border-box' }}
                  >
                    Abrir ↗
                  </a>
                ) : (
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>No asignado</p>
                )}
              </div>
            </aside>
          )}
        </main>
      )}
    </div>
  )
}