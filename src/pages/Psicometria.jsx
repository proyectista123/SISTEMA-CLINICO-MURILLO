import { useState, useEffect } from "react"
import { collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

// 📊 ESTRUCTURA DE LA BATERÍA DE TEST
const ESTRUCTURA_PRUEBAS = {
  "Psicométrica": {
    "1. Trastorno del Espectro Autista (TEA)": [
      "ADOS-2", "ADI-R", "M-CHAT Revisado", "CARS", "Escala Gilliam (Asperger) GADS"
    ],
    "2. Trastorno por Déficit de Atención E Hiperactividad (TDAH)": [
      "El Test de Desórdenes de Hyperactividad/Déficit de Atención ADHDT", "Test TDAH", "Cuestionario de Conducta para Profesores CONNERS", "edah test"
    ],
    "3. Desarrollo Infantil y Maduración": [
      "Brunet-Lezine", "Denver II", "DAYC", "Vineland", "Figuras Geométricas de Gesell", "Test 5-6", "Pruebas de Diagnóstico Preescolar", "ABC Madurez Lectoescritura Filho", "Madurez Mental de California", "CUMANIN"
    ],
    "4. Inteligencia y Capacidad Cognitiva": [
      "WISC-V", "Matrices Progresivas (Raven)", "Factor G", "TONI-4", "MY-Test de Memoria"
    ],
    "5. Neuropsicología y Funciones Cognitivas": [
      "Batería DNUH", "Toulouse-Piéron", "Benton (TRVB)", "Test Gestáltico Visomotor (Bender)"
    ],
    "6. Aprendizaje y Dificultades Escolares": [
      "PROLEC", "ENFEN", "DST-J", "Inventario de Estilos de Aprendizaje KOLB", "El Test de Frases Incompletas de Rotter", "maria melgar", "Paquete de Valoración de la Creatividad CAP 6 a 18 años", "Test de Conceptos Básicos BOEHM", "EPP psicomotricidad preescolar", "El Inventario de Hábitos de Estudio pozar"
    ],
    "7. Personalidad": [
      "cpq", "16 PF", "MMPI/MMPI-2", "EPI eysenk", "EPQ Adultos", "Big Five", "Cuestionario Caracterológico de Gastón Berger", "René Le Senne"
    ],
    "8. Ansiedad y Depresión": [
      "IDARE", "STAIC", "CAS", "CDI", "Escala de Zung", "CUESTIONARIO DE APRONTAMIENTO DEL ESTRÉS (CAE)"
    ],
    "9. Conductual, Socioemocional y Familiar (Psicométricos)": [
      "Inventario de Problemas Conductuales", "Inventario de Problemas Juveniles", "AVE (Violencia Escolar)", "Escala de Apego Madre-Bebé", "Conociendo Mis Emociones", "Test de la Figura Humana", "Test del Dibujo de la Figura Humana", "Escala de Ajuste Diádico (DAS)", "test basc", "ASPA", "El Cuestionario de Auto-Control Infantil y Adolescente (CACIA)", "Escala Multidimensional de Asertividad (EMA)"
    ],
    "10. Orientación Vocacional": [
      "Inventario de Intereses Profesionales IPP", "kuder", "Inventario de Intereses Hereford", "Test de Orientación Vocacional", "Cuestionario de aptitudes orientación vocacional"
    ],
    "11. Área Laboral": [
      "Maslach Burnout Inventory(MBI)"
    ],
    "13. Salud ": [
      "Cuestionario VIH"
    ]
  },
  "Proyectiva": {
    "Pruebas Proyectivas": [
      "Test de Apercepción Temática (TAT)", "Test de la Familia", "House-Tree-Person (HTP)", "Persona bajo la Lluvia", "Dibujo de la Figura Humana (Machover)", "Frases Incompletas de Sacks", "Test de Szondi", "Test de Pata Negra (Patte Noire)", "Test Proyectivo de los Cuentos de Hadas (FTT)"
    ]
  }
}

export default function Psicometria() {
  const navigate = useNavigate()
  const authContext = useAuth()
  const user = authContext?.user
  const esAdmin = authContext?.role === "admin" || user?.role === "admin"

  // 📝 ESTADOS DE CONTROL Y BÚSQUEDA
  const [codigoPaciente, setCodigoPaciente] = useState("")
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [historialPruebas, setHistorialPruebas] = useState([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [loadingGuardar, setLoadingGuardar] = useState(false)

  // 👁️ ESTADO PARA MODO LECTURA COMPLETA DE PÁGINA
  const [pruebaLecturaSeleccionada, setPruebaLecturaSeleccionada] = useState(null)
  const [nuevoAvanceLectura, setNuevoAvanceLectura] = useState(10)

  // 👥 ESTADO PARA ALMACENAR LOS PSICÓLOGOS
  const [listaPsicologos, setListaPsicologos] = useState([])

  // 📋 ESTADOS JERÁRQUICOS DEL FORMULARIO
  const [nombreEvaluador, setNombreEvaluador] = useState("")
  const [tipoEvaluacion, setTipoEvaluacion] = useState("Psicométrica")
  
  // 🗂️ CATEGORÍA ESTADOS
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("1. Trastorno del Espectro Autista (TEA)")
  const [otraCategoriaSeleccionada, setOtraCategoriaSeleccionada] = useState("") 

  // 🧪 PRUEBA ESTADOS
  const [nombrePrueba, setNombrePrueba] = useState("")
  const [otroNombrePrueba, setOtroNombrePrueba] = useState("")
  
  const [fechaPrueba, setFechaPrueba] = useState(new Date().toISOString().split('T')[0])
  const [avance, setAvance] = useState(50)
  const [numeroEvaluacion, setNumeroEvaluacion] = useState(1)

  // 🔗 ENLACES DRIVE DEL PACIENTE
  const [urlDriveClinico, setUrlDriveClinico] = useState("")
  const [urlDrivePruebas, setUrlDrivePruebas] = useState("")
  const [urlDrivePruebaIndividual, setUrlDrivePruebaIndividual] = useState("")

  // Estados específicos para resultados de pruebas
  const [puntaje, setPuntaje] = useState("")
  const [equivalente, setEquivalente] = useState("")
  const [interpretacionPsicometrica, setInterpretacionPsicometrica] = useState("")
  const [interpretacionProyectiva, setInterpretacionProyectiva] = useState("")

  // 🔄 RE-ESTRUCTURACIÓN DINÁMICA DE MENÚS EN CASCADA
  useEffect(() => {
    const categories = Object.keys(ESTRUCTURA_PRUEBAS[tipoEvaluacion] || {})
    if (categories.length > 0) {
      setCategoriaSeleccionada(categories[0])
    }
    setOtraCategoriaSeleccionada("") 
  }, [tipoEvaluacion])

  useEffect(() => {
    if (categoriaSeleccionada === "Otro") {
      setNombrePrueba("Otro")
      return
    }

    const tests = ESTRUCTURA_PRUEBAS[tipoEvaluacion]?.[categoriaSeleccionada]
    if (tests && tests.length > 0) {
      setNombrePrueba(tests[0])
    } else {
      setNombrePrueba("Otro")
    }
    setOtroNombrePrueba("") 
  }, [categoriaSeleccionada, tipoEvaluacion])

  // 🔄 CARGAR LISTADO DE PSICÓLOGOS
  useEffect(() => {
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
            setNombreEvaluador(usuarioActual.nombre || usuarioActual.nombreCompleto || usuarioActual.displayName || "Evaluador Asignado")
          } else {
            const primerPsico = docs[0]
            setNombreEvaluador(primerPsico.nombre || primerPsico.nombreCompleto || primerPsico.displayName || "Evaluador Asignado")
          }
        } else {
          setNombreEvaluador(user?.displayName || "Psicólogo de Turno")
        }
      } catch (error) {
        console.error("Error al cargar la lista de psicólogos:", error)
        setNombreEvaluador(user?.displayName || "Psicólogo de Turno")
      }
    }
    
    if (user) {
      obtenerPsicologos()
    }
  }, [user])

  // 🔍 ENCONTRAR PACIENTE Y CARGAR HISTORIAL
  const buscarPaciente = async (e) => {
    e.preventDefault()
    if (!codigoPaciente.trim()) return

    setLoadingBusqueda(true)
    setPacienteEncontrado(null)
    setHistorialPruebas([])
    setPruebaLecturaSeleccionada(null)
    setUrlDriveClinico("") 
    setUrlDrivePruebas("") 

    try {
      const pacienteRef = doc(db, "pacientes", codigoPaciente.trim())
      const snapPaciente = await getDoc(pacienteRef)

      if (!snapPaciente.exists()) {
        alert("❌ Código inválido. No se encontró ningún expediente.")
        setLoadingBusqueda(false)
        return
      }

      const datosPaciente = snapPaciente.data()
      setPacienteEncontrado({ id: snapPaciente.id, ...datosPaciente })
      
      setUrlDriveClinico(datosPaciente.enlaceDriveInforme || "")
      setUrlDrivePruebas(datosPaciente.enlaceDrivePruebas || "")

      await actualizarHistorialLocal(snapPaciente.id)

    } catch (error) {
      console.error("Error al buscar expediente:", error)
      alert("Error al cargar el expediente clínico.")
    } finally {
      setLoadingBusqueda(false)
    }
  }

  const actualizarHistorialLocal = async (idPac) => {
    const qPruebas = query(collection(db, "psicometria"), where("idPaciente", "==", idPac))
    const snapPruebas = await getDocs(qPruebas)
    const anteriores = snapPruebas.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.fechaRegistro?.seconds || 0) - (a.fechaRegistro?.seconds || 0))

    setHistorialPruebas(anteriores)
    setNumeroEvaluacion(anteriores.length + 1)
  }

  const guardarEnlaceDriveClinico = async () => {
    if (!pacienteEncontrado) return
    try {
      const pacienteRef = doc(db, "pacientes", pacienteEncontrado.id)
      await updateDoc(pacienteRef, { enlaceDriveInforme: urlDriveClinico.trim() })
      alert("📂 Enlace de Google Drive (Informe General) actualizado.")
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar el enlace del Informe General.")
    }
  }

  const guardarEnlaceDrivePruebas = async () => {
    if (!pacienteEncontrado) return
    try {
      const pacienteRef = doc(db, "pacientes", pacienteEncontrado.id)
      await updateDoc(pacienteRef, { enlaceDrivePruebas: urlDrivePruebas.trim() })
      alert("📁 Enlace de Carpeta de Pruebas/Batería actualizado.")
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar el enlace de las Pruebas.")
    }
  }

  const modificarAvanceDePruebaGuardada = async () => {
    if (!pruebaLecturaSeleccionada) return
    
    const avanceAnterior = Number(pruebaLecturaSeleccionada.avance || 0)
    const avanceSiguiente = Number(nuevoAvanceLectura)

    if (avanceSiguiente < avanceAnterior) {
      alert(`⚠️ Regla Clínica: El porcentaje de avance solo puede incrementarse de forma progresiva. No puedes disminuir el avance actual del ${avanceAnterior}% al ${avanceSiguiente}%.`)
      setNuevoAvanceLectura(avanceAnterior)
      return
    }

    if (avanceSiguiente === avanceAnterior) {
      alert("El porcentaje seleccionado es igual al guardado previamente.")
      return
    }
    
    try {
      const pruebaRef = doc(db, "psicometria", pruebaLecturaSeleccionada.id)
      await updateDoc(pruebaRef, { avance: avanceSiguiente })
      
      setPruebaLecturaSeleccionada(prev => ({ ...prev, avance: avanceSiguiente }))
      await actualizarHistorialLocal(pacienteEncontrado.id)
      alert(`📈 Progreso actualizado con éxito al ${avanceSiguiente}% en la base de datos.`)
    } catch (error) {
      console.error("Error al actualizar avance:", error)
      alert("No se pudo actualizar el porcentaje en la base de datos.")
    }
  }

  // 💾 GUARDAR EVALUACIÓN NUEVA
  const guardarEvaluacion = async (e) => {
    e.preventDefault()
    if (esAdmin) return; 

    setLoadingGuardar(true)

    const categoriaFinal = categoriaSeleccionada === "Otro" ? otraCategoriaSeleccionada.trim() : categoriaSeleccionada
    const pruebaFinal = nombrePrueba === "Otro" ? otroNombrePrueba.trim() : nombrePrueba

    if (!categoriaFinal) {
      alert("⚠️ Por favor escribe el nombre de la categoría personalizada.")
      setLoadingGuardar(false)
      return
    }

    if (!pruebaFinal) {
      alert("⚠️ Por favor escribe el nombre de la prueba personalizada.")
      setLoadingGuardar(false)
      return
    }

    const nuevaPrueba = {
      idPaciente: pacienteEncontrado.id,
      nombrePaciente: pacienteEncontrado.nombre,
      nombreEvaluador,
      tipoEvaluacion,
      categoriaPrueba: categoriaFinal, 
      nombrePrueba: pruebaFinal,      
      fechaPrueba,
      avance: Number(avance),
      numeroEvaluacion,
      urlDrivePruebaIndividual: urlDrivePruebaIndividual.trim(),
      fechaRegistro: serverTimestamp(),
      ...(tipoEvaluacion.includes("Psicométrica") || tipoEvaluacion === "Psicométrica"
        ? { puntaje, equivalente, interpretacionPsicometrica }
        : { interpretacionProyectiva }
      )
    }

    try {
      await addDoc(collection(db, "psicometria"), nuevaPrueba)
      alert(`🎉 Registro exitoso: Evaluación N.º ${numeroEvaluacion} guardada.`)
      setUrlDrivePruebaIndividual("")
      setPuntaje("")
      setEquivalente("")
      setInterpretacionPsicometrica("")
      setInterpretacionProyectiva("")
      await actualizarHistorialLocal(pacienteEncontrado.id)
    } catch (error) {
      console.error(error)
      alert("No se pudo registrar la evaluación en la base de datos.")
    } finally {
      setLoadingGuardar(false)
    }
  }

  const manejarSeleccionMenuLectura = (e) => {
    const idSeleccionado = e.target.value
    if (!idSeleccionado) {
      setPruebaLecturaSeleccionada(null)
      return
    }
    const prueba = historialPruebas.find(p => p.id === idSeleccionado)
    setPruebaLecturaSeleccionada(prueba || null)
    if (prueba) {
      setNuevoAvanceLectura(prueba.avance || 10)
    }
  }

  const s = {
    container: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px', display: 'flex', justifyContent: 'center' },
    card: { backgroundColor: '#ffffff', maxWidth: '1000px', width: '100%', padding: '35px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    backBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', transition: 'color 0.2s', padding: 0 },
    header: { borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
    subtitle: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '5px' },
    input: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
    textarea: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit' },
    btnPrimary: { backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' },
    patientBadge: { backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '16px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '20px', boxSizing: 'border-box' },
    boxPsicometrica: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
    boxProyectiva: { backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
    adminNotice: { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '15px', borderRadius: '16px', fontSize: '13px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '5px' },
    upperDriveCard: { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'center', boxSizing: 'border-box', maxWidth: '400px' },
    fullReaderContainer: { backgroundColor: '#ffffff', minHeight: '60vh', padding: '10px 0' },
    badgeLectura: { display: 'inline-block', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '8px', marginBottom: '10px', textTransform: 'uppercase' }
  }

  const categoriasActuales = Object.keys(ESTRUCTURA_PRUEBAS[tipoEvaluacion] || {})
  const pruebasActuales = ESTRUCTURA_PRUEBAS[tipoEvaluacion]?.[categoriaSeleccionada] || []

  return (
    <div style={s.container}>
      <div style={s.card}>
        
        {/* 💻 MODO LECTURA PÁGINA COMPLETA */}
        {pruebaLecturaSeleccionada ? (
          <div style={s.fullReaderContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '25px' }}>
              <div>
                <span style={{ 
                  ...s.badgeLectura, 
                  backgroundColor: pruebaLecturaSeleccionada.tipoEvaluacion === "Proyectiva" ? "#f3e8ff" : "#e0e7ff",
                  color: pruebaLecturaSeleccionada.tipoEvaluacion === "Proyectiva" ? "#6d28d9" : "#4f46e5"
                }}>
                  Prueba - {pruebaLecturaSeleccionada.tipoEvaluacion}
                </span>
                <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  {pruebaLecturaSeleccionada.nombrePrueba}
                </h1>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {pruebaLecturaSeleccionada.urlDrivePruebaIndividual && (
                  <a
                    href={pruebaLecturaSeleccionada.urlDrivePruebaIndividual}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...s.btnPrimary, backgroundColor: '#0284c7', textDecoration: 'none', padding: '10px 16px' }}
                  >
                    📎 Ver Anexo / Protocolo
                  </a>
                )}
                <button 
                  type="button" 
                  onClick={() => setPruebaLecturaSeleccionada(null)} 
                  style={{ ...s.btnPrimary, padding: '10px 20px' }}
                >
                  Volver
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '30px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div><span style={s.subtitle}>Paciente Evaluado</span><strong>👤 {pruebaLecturaSeleccionada.nombrePaciente}</strong></div>
              <div><span style={s.subtitle}>Fecha del Test</span><strong>📅 {pruebaLecturaSeleccionada.fechaPrueba}</strong></div>
              <div><span style={s.subtitle}>Especialista a Cargo</span><strong>🩺 {pruebaLecturaSeleccionada.nombreEvaluador}</strong></div>
              <div><span style={s.subtitle}>Progreso Actual</span><strong>📈 {pruebaLecturaSeleccionada.avance}%</strong></div>
              
              {!esAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderLeft: '2px solid #cbd5e1', paddingLeft: '15px' }}>
                  <span style={{...s.subtitle, color: '#4f46e5'}}>Actualizar Progreso</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      style={{ ...s.input, padding: '6px 10px', fontSize: '13px', backgroundColor: '#ffffff', width: '90px' }}
                      value={nuevoAvanceLectura}
                      onChange={(e) => setNuevoAvanceLectura(Number(e.target.value))}
                    >
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => {
                        const esMenor = pct < Number(pruebaLecturaSeleccionada.avance || 0);
                        return (
                          <option key={pct} value={pct} disabled={esMenor}>
                            {pct}% {esMenor ? "🔒" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button 
                      type="button" 
                      onClick={modificarAvanceDePruebaGuardada}
                      style={{ ...s.btnPrimary, padding: '6px 12px', fontSize: '11px', backgroundColor: '#4f46e5' }}
                    >
                      Ok
                    </button>
                  </div>
                </div>
              )}
            </div>

            {pruebaLecturaSeleccionada.tipoEvaluacion?.includes("Psicométrica") || pruebaLecturaSeleccionada.tipoEvaluacion === "Psicométrica" ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', backgroundColor: '#ffffff' }}>
                    <span style={s.subtitle}>PUNTAJE</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f46e5', display: 'block', marginTop: '5px' }}>
                      {pruebaLecturaSeleccionada.puntaje || "No Registrado"}
                    </span>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', backgroundColor: '#ffffff' }}>
                    <span style={s.subtitle}>EQUIVALENTE / RANGO</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginTop: '5px' }}>
                      {pruebaLecturaSeleccionada.equivalente || "No Registrado"}
                    </span>
                  </div>
                </div>
                
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', backgroundColor: '#fafafa', minHeight: '150px' }}>
                  <h3 style={{ fontSize: '13px', color: '#4f46e5', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Interpretación 
                  </h3>
                  <p style={{ fontSize: '15px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0 }}>
                    {pruebaLecturaSeleccionada.interpretacionPsicometrica || "No especificada."}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #ddd6fe', borderRadius: '16px', padding: '24px', backgroundColor: '#fdfbfe', minHeight: '200px' }}>
                <h3 style={{ fontSize: '13px', color: '#6d28d9', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Interpretación 
                </h3>
                <p style={{ fontSize: '15px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0 }}>
                  {pruebaLecturaSeleccionada.interpretacionProyectiva || "No especificada."}
                </p>
              </div>
            )}
          </div>
        ) : (
          
          /* 📝 FORMULARIO TRADICIONAL DE REGISTRO */
          <>
            <button onClick={() => navigate("/dashboard")} style={s.backBtn}>
              ← Volver al inicio
            </button>

            <header style={s.header}>
              <h1 style={s.title}>PRUEBAS PSICOLÓGICAS</h1>
              
              {pacienteEncontrado && (
                <div style={{...s.upperDriveCard, backgroundColor: esAdmin ? '#eff6ff' : '#f8fafc', borderColor: esAdmin ? '#bfdbfe' : '#cbd5e1'}}>
                  <h4 style={{ fontSize: '10px', fontWeight: 'bold', color: esAdmin ? '#1e40af' : '#334155', margin: 0, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    📁 INFORME GENERAL:
                  </h4>
                  {esAdmin ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="url"
                        placeholder="Link Informe General..."
                        style={{ ...s.input, padding: '6px 10px', fontSize: '11px', backgroundColor: '#ffffff', width: '160px' }}
                        value={urlDriveClinico}
                        onChange={(e) => setUrlDriveClinico(e.target.value)}
                      />
                      <button type="button" onClick={guardarEnlaceDriveClinico} style={{ ...s.btnPrimary, fontSize: '10px', padding: '6px 12px', backgroundColor: '#2563eb' }}>
                        Guardar
                      </button>
                    </div>
                  ) : urlDriveClinico ? (
                    <a href={urlDriveClinico} target="_blank" rel="noopener noreferrer" style={{ ...s.btnPrimary, backgroundColor: '#4f46e5', fontSize: '11px', padding: '6px 12px', textDecoration: 'none' }}>
                      Abrir
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Sin enlace</span>
                  )}
                </div>
              )}
            </header>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* 👤 BARRA DE INFORMACIÓN DEL PACIENTE */}
                <div style={s.patientBadge}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={s.subtitle}>Paciente</span>
                      <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e1b4b', margin: 0 }}>👤 {pacienteEncontrado.nombre}</h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', textTransform: 'uppercase' }}>
                        📁 LINK DEL DRIVE:
                      </span>
                      {esAdmin ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder="Link Drive de Pruebas..."
                            style={{ ...s.input, padding: '4px 8px', fontSize: '11px', width: '210px', backgroundColor: '#ffffff' }}
                            value={urlDrivePruebas}
                            onChange={(e) => setUrlDrivePruebas(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={guardarEnlaceDrivePruebas}
                            style={{ ...s.btnPrimary, fontSize: '10px', padding: '4px 10px', backgroundColor: '#4338ca' }}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : urlDrivePruebas ? (
                        <a
                          href={urlDrivePruebas}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'underline' }}
                        >
                          Abrir ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin enlace registrado</span>
                      )}
                    </div>
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
                        textAlign: 'center'
                      }}
                      onChange={manejarSeleccionMenuLectura}
                      value={pruebaLecturaSeleccionada?.id || ""}
                    >
                      <option value="" style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
                        Nueva Prueba (N.º {numeroEvaluacion})
                      </option>
                      {historialPruebas.map((p) => (
                        <option key={p.id} value={p.id} style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
                          Prueba N.º {p.numeroEvaluacion || "Ant."} - {p.nombrePrueba}
                        </option>
                      ))}
                    </select>
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ffffff', pointerEvents: 'none', fontSize: '10px' }}>▼</span>
                  </div>
                </div>

                {esAdmin ? (
                  <div style={s.adminNotice}>
                    <strong>Modo Administrador Activo</strong>
                    <span>Puedes visualizar historiales y modificar los enlaces de Drive del paciente. La redacción de pruebas está reservada para psicólogos.</span>
                  </div>
                ) : (
                  <form onSubmit={guardarEvaluacion} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                      
                      {/* EVALUADOR */}
                      <div>
                        <label style={s.subtitle}>Especialista Evaluador</label>
                        <select
                          style={s.input}
                          value={nombreEvaluador}
                          onChange={(e) => setNombreEvaluador(e.target.value)}
                        >
                          {listaPsicologos.map((p) => {
                            const val = p.nombre || p.nombreCompleto || p.displayName || "Especialista Sin Nombre";
                            return (
                              <option key={p.id} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* TIPO EVALUACIÓN */}
                      <div>
                        <label style={s.subtitle}>Tipo de Evaluación</label>
                        <select
                          style={s.input}
                          value={tipoEvaluacion}
                          onChange={(e) => setTipoEvaluacion(e.target.value)}
                        >
                          <option value="Psicométrica">Psicométrica</option>
                          <option value="Proyectiva">Proyectiva</option>
                        </select>
                      </div>

                      {/* FECHA */}
                      <div>
                        <label style={s.subtitle}>Fecha de Aplicación</label>
                        <input
                          type="date"
                          style={s.input}
                          value={fechaPrueba}
                          onChange={(e) => setFechaPrueba(e.target.value)}
                        />
                      </div>

                      {/* PORCENTAJE DE AVANCE */}
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

                    {/* CATEGORÍA Y PRUEBA EN CASCADA */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                      <div>
                        <label style={s.subtitle}>Categoría de la Prueba</label>
                        <select
                          style={s.input}
                          value={categoriaSeleccionada}
                          onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                        >
                          {categoriasActuales.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="Otro">14.Otro</option>
                        </select>

                        {categoriaSeleccionada === "Otro" && (
                          <input
                            type="text"
                            placeholder="Escribe la nueva categoría..."
                            style={{ ...s.input, marginTop: '8px' }}
                            value={otraCategoriaSeleccionada}
                            onChange={(e) => setOtraCategoriaSeleccionada(e.target.value)}
                            required
                          />
                        )}
                      </div>

                      <div>
                        <label style={s.subtitle}>Nombre de la Prueba</label>
                        <select
                          style={s.input}
                          value={nombrePrueba}
                          onChange={(e) => setNombrePrueba(e.target.value)}
                          disabled={categoriaSeleccionada === "Otro"}
                        >
                          {pruebasActuales.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                          <option value="Otro">Otro </option>
                        </select>

                        {(nombrePrueba === "Otro" || categoriaSeleccionada === "Otro") && (
                          <input
                            type="text"
                            placeholder="Escribe el nombre del test..."
                            style={{ ...s.input, marginTop: '8px' }}
                            value={otroNombrePrueba}
                            onChange={(e) => setOtroNombrePrueba(e.target.value)}
                            required
                          />
                        )}
                      </div>
                    </div>

                    {/* CAMPOS DINÁMICOS SEGÚN TIPO DE EVALUACIÓN */}
                    {tipoEvaluacion === "Psicométrica" ? (
                      <div style={s.boxPsicometrica}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div>
                            <label style={s.subtitle}>Puntaje Obtenido</label>
                            <input
                              type="text"
                              placeholder="Ej. 115, Percentil 85..."
                              style={s.input}
                              value={puntaje}
                              onChange={(e) => setPuntaje(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={s.subtitle}>Equivalente / Rango</label>
                            <input
                              type="text"
                              placeholder="Ej. Promedio Alto, Rango I..."
                              style={s.input}
                              value={equivalente}
                              onChange={(e) => setEquivalente(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={s.subtitle}>Interpretación </label>
                          <textarea
                            rows={4}
                            placeholder="Redacta los hallazgos psicométricos cuantitativos y cualitativos..."
                            style={s.textarea}
                            value={interpretacionPsicometrica}
                            onChange={(e) => setInterpretacionPsicometrica(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={s.boxProyectiva}>
                        <div>
                          <label style={s.subtitle}>Interpretación</label>
                          <textarea
                            rows={6}
                            placeholder="Redacta la interpretación dinámica, indicadores proyectivos y rasgos hallados..."
                            style={s.textarea}
                            value={interpretacionProyectiva}
                            onChange={(e) => setInterpretacionProyectiva(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loadingGuardar}
                      style={{ ...s.btnPrimary, marginTop: '10px' }}
                    >
                      {loadingGuardar ? "Guardando..." : `Guardar Evaluación N.º ${numeroEvaluacion}`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}