import { useState, useEffect } from "react"
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

// 🗓️ Componentes de FullCalendar
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"

const HORAS_MAÑANA = ["08:00","09:00","10:00" ,"11:00", "12:00","13:00", "14:00"]
const HORAS_TARDE = ["15:00", "16:00", "17:00", "18:00", "19:00"]
const HORAS_FULL_DAY = [...HORAS_MAÑANA, ...HORAS_TARDE]

const FERIADOS_NACIONALES = [
  "01-01", "04-02", "04-03", "05-01", "06-07", "06-29", 
  "07-23", "07-28", "07-29", "08-06", "08-30", "10-08", 
  "11-01", "12-08", "12-09", "12-25"
]

// 🎨 Paleta de colores para asignar a psicólogos
const PALETA_COLORES = [
  "#3b82f6", // Azul
  "#10b981", // Verde esmeralda
  "#8b5cf6", // Púrpura / Violeta
  "#f59e0b", // Ámbar / Naranja
  "#ec4899", // Rosa
  "#06b6d4", // Cian
  "#f97316", // Naranja intenso
  "#6366f1", // Índigo
  "#14b8a6", // Teal
  "#a855f7", // Morado
]

const COLOR_ACTIVIDAD_INTERNA = "#b88b59" // 💼 Color ámbar/naranja distintivo para Gerencia/Actividades Internas

const obtenerColorPsicologo = (idPsicologo) => {
  if (!idPsicologo) return "#4f46e5"
  let hash = 0
  for (let i = 0; i < idPsicologo.length; i++) {
    hash = idPsicologo.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PALETA_COLORES.length
  return PALETA_COLORES[index]
}

export default function Agenda() {
  const navigate = useNavigate()
  const [busquedaEspecialista, setBusquedaEspecialista] = useState('');
  const authContext = useAuth() || {}
  const user = authContext.user || null
  const role = authContext.role || ""
  const authLoading = authContext.loading !== undefined ? authContext.loading : true

  // 📝 Estados de la Aplicación
  const [citas, setCitas] = useState([])
  const [psicologos, setPsicologos] = useState([]) 
  const [pacientes, setPacientes] = useState([])   
  const [loadingDatos, setLoadingDatos] = useState(true)
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [citaSeleccionada, setCitaSeleccionada] = useState(null)
  const [modalCreacionAbierto, setModalCreacionAbierto] = useState(false)

 const [formCita, setFormCita] = useState({
  tipoEvento: "paciente",
  tituloActividad: "",
  paciente: "",      
  idPsicologo: "",
  especialistasAsignados: [], // 👈 Asegúrate de incluirlo aquí
  fecha: new Date().toISOString().split('T')[0], 
  modalidad: "Virtual", 
  hora: "",          
  motivo: "",
  estado: "confirmado" 
})

  // ✏️ ESTADOS DE REPROGRAMACIÓN
  const [idCitaPostergando, setIdCitaPostergando] = useState(null)
  const [nuevaFechaPostergada, setNuevaFechaPostergada] = useState("")
  const [nuevaHoraPostergada, setNuevaHoraPostergada] = useState("")

  const esAdmin = role && (role.toLowerCase() === "admin" || role.toLowerCase() === "administrador")

  // 🔒 Función para formatear el nombre confidencial del paciente
  const obtenerNombrePacienteConfidencial = (nombreCompleto) => {
    if (!nombreCompleto) return ""

    // 1. Si es Administrador, muestra el nombre completo con apellidos
    if (esAdmin) return nombreCompleto

    const partes = nombreCompleto.trim().split(/\s+/)
    const primerNombre = partes[0] || ""

    // 2. Comprobar si hay otro paciente en la base de datos con el mismo primer nombre
    const esNombreRepetido = pacientes.some((p) => {
      const nombreOtro = p.nombre || p.nombrePaciente || ""
      if (nombreOtro.toLowerCase() === nombreCompleto.toLowerCase()) return false
      
      const primerNombreOtro = nombreOtro.trim().split(/\s+/)[0]
      return primerNombreOtro && primerNombreOtro.toLowerCase() === primerNombre.toLowerCase()
    })

    // 3. Si se repite el primer nombre y tiene un segundo nombre, mostrar los dos
    if (esNombreRepetido && partes.length > 1) {
      return `${partes[0]} ${partes[1]}`
    }

    // 4. Si es único, mostrar solo el primer nombre
    return primerNombre
  }

  const comprobarSiEsFeriado = (fechaStr) => {
    if (!fechaStr) return false
    const partes = fechaStr.split("-")
    if (partes.length < 3) return false
    const [_, mes, dia] = partes
    return FERIADOS_NACIONALES.includes(`${mes}-${dia}`)
  }

 useEffect(() => {
  if (authLoading || !user?.uid) return;

  setLoadingDatos(true);
  let unsubscribeCitas = () => {};

  const iniciarSincronizacion = async () => {
    try {
      // 1. Cargar lista de pacientes
      try {
        const snapPacientes = await getDocs(collection(db, "pacientes"));
        setPacientes(snapPacientes.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { 
        console.error("Error cargando pacientes:", e); 
      }

      // 2. Si el usuario actual es Administrador
      if (esAdmin) {
        try {
          const qPsico = query(collection(db, "users"), where("role", "==", "psicologo"));
          const snapPsico = await getDocs(qPsico);
          setPsicologos(snapPsico.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) { 
          console.error("Error cargando psicólogos:", e); 
        }

        // El Admin escucha todas las citas de la clínica
        unsubscribeCitas = onSnapshot(collection(db, "citas"), (snapshot) => {
          setCitas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoadingDatos(false);
        }, (err) => {
          console.error("Error listener admin:", err);
          setLoadingDatos(false);
        });

     } else {
        // 3. Si el usuario actual es Psicólogo
        setPsicologos([]);

        // Consulta 1: Citas individuales asignadas directamente a su idPsicologo
        const qPsicologoDirecto = query(
          collection(db, "citas"), 
          where("idPsicologo", "==", user.uid)
        );

        // Consulta 2: Actividades internas asignadas en el array especialistasAsignados
        const qArrayAsignados = query(
          collection(db, "citas"), 
          where("tipoEvento", "==", "interno"),
          where("especialistasAsignados", "array-contains", user.uid)
        );

      let citas1 = [];
        let citas2 = [];

        const fusionarResultados = () => {
          const mapaCitas = new Map();
          [...citas1, ...citas2].forEach(item => mapaCitas.set(item.id, item));
          setCitas(Array.from(mapaCitas.values()));
          setLoadingDatos(false);
        };

        const unsubs1 = onSnapshot(qPsicologoDirecto, (snap1) => {
          citas1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
          fusionarResultados();
        }, (err) => {
          console.error("Error consulta idPsicologo:", err);
          setLoadingDatos(false);
        });

        const unsubs2 = onSnapshot(qArrayAsignados, (snap2) => {
          citas2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
          fusionarResultados();
        }, (err) => {
          console.error("Error al leer actividades internas:", err);
          setLoadingDatos(false);
        });

        unsubscribeCitas = () => {
          unsubs1();
          unsubs2();
        };
      }

    } catch (error) {
      console.error(error);
      setLoadingDatos(false);
    }
  };

  iniciarSincronizacion();

  return () => {
    if (typeof unsubscribeCitas === "function") {
      unsubscribeCitas();
    }
  };
}, [authLoading, esAdmin, user]);
  useEffect(() => {
    if (citaSeleccionada) {
      const actualizada = citas.find(c => c.id === citaSeleccionada.id)
      if (actualizada) {
        setCitaSeleccionada(actualizada)
      }
    }
  }, [citas])

  const obtenerHorasBaseDelDia = (fechaStr) => {
    return comprobarSiEsFeriado(fechaStr) ? HORAS_MAÑANA : HORAS_FULL_DAY
  }

 const obtenerHorasDisponiblesFiltradas = (fechaDestino, modalidadDestino) => {
  return obtenerHorasBaseDelDia(fechaDestino)
}
  const registrarNuevaCita = async (e) => {
  e.preventDefault()

  const esInterno = formCita.tipoEvento === "interno"

  if (esInterno) {
    if (!formCita.tituloActividad.trim() || !formCita.fecha || !formCita.hora) {
      alert("⚠️ Rellena el título de la actividad, fecha y hora.")
      return
    }
    if (!formCita.especialistasAsignados || formCita.especialistasAsignados.length === 0) {
      alert("⚠️ Debes seleccionar al menos un especialista para la actividad interna.")
      return
    }
  } else {
    if (!formCita.paciente || !formCita.idPsicologo || !formCita.fecha || !formCita.hora) {
      alert("⚠️ Rellena todos los campos obligatorios del paciente.")
      return
    }
  }

  const pac = pacientes.find(p => p.id === formCita.paciente)
  const psi = psicologos.find(p => p.id === formCita.idPsicologo)

  // 🚀 CONSTRUCCIÓN DEL PAYLOAD CON EL CAMPO "especialistasAsignados" INCLUIDO
  const payload = {
    tipoEvento: formCita.tipoEvento,
    tituloActividad: esInterno ? formCita.tituloActividad.trim() : "",
    paciente: esInterno ? "N/A" : formCita.paciente, 
    dniPaciente: esInterno ? "" : formCita.paciente,
    nombrePaciente: esInterno ? formCita.tituloActividad.trim() : (pac?.nombre || formCita.paciente),
    idPsicologo: esInterno ? null : formCita.idPsicologo, // Dejar null si es interno para no confundir la query directa
    nombrePsicologo: esInterno ? "Gerencia / Administración" : (psi?.nombre || psi?.nombreCompleto || "Terapeuta"),
    
    // 🔑 ESTE ERA EL CAMPO FALTANTE:
    especialistasAsignados: esInterno ? (formCita.especialistasAsignados || []) : [],

    fecha: formCita.fecha,
    hora: formCita.hora,
    modalidad: esInterno ? "Presencial" : formCita.modalidad,
    motivo: esInterno ? (formCita.motivo || "Actividad Interna de Gerencia") : (formCita.motivo || "Consulta Regular"),
    estado: formCita.estado, 
    start: `${formCita.fecha}T${formCita.hora}:00`,
    end: `${formCita.fecha}T${String(Number(formCita.hora.split(":")[0]) + 1).padStart(2, "0")}:00:00`,
    fechaRegistro: serverTimestamp()
  }

  try {
    await addDoc(collection(db, "citas"), payload)
    alert(esInterno ? "💼 Actividad interna agendada con éxito." : "✅ Cita registrada con éxito.")
    
    // Limpieza de estado
    setFormCita(f => ({ 
      ...f, 
      tipoEvento: "paciente", 
      tituloActividad: "", 
      paciente: "", 
      idPsicologo: "",
      especialistasAsignados: [], 
      hora: "", 
      motivo: "", 
      estado: "confirmado" 
    }))
    setModalCreacionAbierto(false)
  } catch (err) { 
    console.error("Error al registrar:", err) 
  }
}

  const cambiarEstadoCita = async (idCita, nuevoEstado) => {
    if (nuevoEstado === "postergada") {
      const citaOriginal = citas.find(c => c.id === idCita)
      setIdCitaPostergando(idCita)
      setNuevaFechaPostergada(citaOriginal?.fecha || "")
      setNuevaHoraPostergada(citaOriginal?.hora || "")
    } else {
      try {
        const citaRef = doc(db, "citas", idCita)
        await updateDoc(citaRef, { estado: nuevoEstado, fechaOriginal: "" })
        if (idCitaPostergando === idCita) setIdCitaPostergando(null)
      } catch (e) { console.error(e) }
    }
  }

  const actualizarCitaPostergada = async (idCita) => {
    if (!nuevaFechaPostergada || !nuevaHoraPostergada) {
      alert("⚠️ Elige fecha y hora válidos.")
      return
    }

    try {
      const citaOriginal = citas.find(c => c.id === idCita)
      const citaRef = doc(db, "citas", idCita)

      await updateDoc(citaRef, {
        estado: "postergada",
        fechaOriginal: citaOriginal?.fecha || citaOriginal?.fechaOriginal || "", 
        fecha: nuevaFechaPostergada,
        hora: nuevaHoraPostergada,
        start: `${nuevaFechaPostergada}T${nuevaHoraPostergada}:00`,
        end: `${nuevaFechaPostergada}T${String(Number(nuevaHoraPostergada.split(":")[0]) + 1).padStart(2, "0")}:00:00`
      })
      
      setIdCitaPostergando(null)
      alert(`🔄 Reprogramación guardada.`)
    } catch (e) { console.error(e) }
  }

  const alPresionarCuadroBlanco = (info) => {
    if (esAdmin) {
      const fechaClick = info.dateStr.split("T")[0]
      setFormCita(f => ({ ...f, fecha: fechaClick, hora: "", estado: "confirmado" }))
      setBusquedaPaciente("")
      setModalCreacionAbierto(true)
    }
  }

  const horasFiltradasOpciones = obtenerHorasDisponiblesFiltradas(formCita.fecha, formCita.modalidad)

  const pacientesFiltrados = pacientes.filter(p => {
    const termino = busquedaPaciente.toLowerCase()
    return (
      (p.nombre && p.nombre.toLowerCase().includes(termino)) ||
      (p.id && p.id.toLowerCase().includes(termino))
    )
  })

  if (authLoading || loadingDatos) {
    return (
      <div style={{ padding: "32px", textAlign: "center", fontSize: "14px", fontWeight: "bold", color: "#64748b", fontFamily: "sans-serif" }}>
        Abriendo Calendario...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f8fafc",
      color: "#334155",
      display: "flex",
      flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
      overflowX: "hidden",
      boxSizing: "border-box"
    }}>

      <style>{`
        .fc { font-family: system-ui, -apple-system, sans-serif !important; }
        .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #e2e8f0 !important; }
        .fc .fc-toolbar-title { font-size: 1.15rem !important; font-weight: 800 !important; color: #0f172a !important; text-transform: capitalize; }
        .fc .fc-button-primary { background-color: #ffffff !important; border-color: #e2e8f0 !important; color: #475569 !important; font-size: 0.75rem !important; font-weight: 700 !important; text-transform: uppercase !important; padding: 8px 12px !important; border-radius: 8px !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; transition: all 0.2s ease; }
        .fc .fc-button-primary:hover { background-color: #f1f5f9 !important; color: #0f172a !important; }
        .fc .fc-button-primary:disabled { background-color: #f8fafc !important; opacity: 0.6; }
        .fc .fc-button-active { background-color: #4f46e5 !important; border-color: #4f46e5 !important; color: #ffffff !important; }
        .fc .fc-col-header-cell-cushion { font-size: 0.75rem !important; font-weight: 800 !important; color: #475569 !important; text-transform: uppercase; text-decoration: none !important; padding: 8px 0 !important; display: inline-block; }
        .fc .fc-daygrid-day-number { font-size: 0.8rem !important; font-weight: 700 !important; color: #64748b !important; text-decoration: none !important; padding: 6px 8px !important; }
        .fc-daygrid-day:hover { background-color: #f1f5f9 !important; cursor: pointer; }
        .fc-v-event, .fc-h-event { border-radius: 6px !important; padding: 4px 6px !important; font-size: 0.75rem !important; font-weight: 700 !important; box-shadow: 0 2px 4px rgba(0,0,0,0.08) !important; cursor: pointer; border: none !important; }
        .fc-event-title { font-weight: 700 !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fc-event-time { display: none !important; }
      `}</style>
      
      {/* 💻 BARRA DE CONTROL SUPERIOR */}
      <header style={{
        borderBottom: "1px solid #e2e8f0",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            padding: "8px 10px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold"
          }}>
            📅
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "15px", fontWeight: "900", color: "#0f172a" }}>AGENDA GENERAL-</h1>
            <p style={{ margin: 0, fontSize: "10px", color: "#64748b", fontWeight: "600" }}></p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            onClick={() => navigate("/dashboard")} 
            style={{
              background: "none",
              border: "none",
              fontSize: "12px",
              fontWeight: "700",
              color: "#475569",
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: "8px",
              transition: "background 0.2s"
            }}
          >
            Volver al Inicio
          </button>
          
          {esAdmin && (
            <button 
              onClick={() => {
                setFormCita(f => ({ ...f, tipoEvento: "paciente", tituloActividad: "", hora: "", estado: "confirmado" }))
                setBusquedaPaciente("")
                const actual = new Date().toISOString().split('T')[0]
                if (!formCita.fecha) setFormCita(f => ({ ...f, fecha: actual }))
                setModalCreacionAbierto(true)
              }}
              style={{
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                border: "none",
                fontWeight: "700",
                fontSize: "12px",
                padding: "10px 18px",
                borderRadius: "30px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)"
              }}
            >
              ＋ Agendar Evento
            </button>
          )}
        </div>
      </header>

      {/* 🧩 ÁREA DE TRABAJO PRINCIPAL */}
      <div style={{
        flex: 1,
        padding: "20px",
        boxSizing: "border-box",
        backgroundColor: "#f8fafc"
      }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "24px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
        }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ 
              left: "prev,next today", 
              center: "title", 
              right: "dayGridMonth,timeGridWeek,timeGridDay" 
            }}
            locale="es"
            buttonText={{
              today: 'Hoy',
              month: 'Mes',
              week: 'Semana',
              day: 'Día'
            }}
            selectable={true}
            displayEventTime={false}
            height="76vh"
            eventDisplay="block"
            events={citas.map(c => {
              const esInterno = c.tipoEvento === "interno"
              const namePsico = c.nombrePsicologo ? c.nombrePsicologo.split(" ")[0] : "Psicólogo"
              
              // 🔒 Aplica la lógica confidencial según si es Admin o Psicólogo
              const namePaciente = obtenerNombrePacienteConfidencial(c.nombrePaciente || "Paciente")
              
              const colorEvento = esInterno 
                ? COLOR_ACTIVIDAD_INTERNA 
                : (c.estado === "cancelada" ? "#94a3b8" : obtenerColorPsicologo(c.idPsicologo))

              let tituloMostrar = ""
              if (esInterno) {
                tituloMostrar = `💼 ${c.hora} | ${c.tituloActividad || c.nombrePaciente || "Actividad Gerencia"}`
              } else {
                tituloMostrar = esAdmin 
                  ? `${c.hora} | ${namePsico} - ${namePaciente}` 
                  : `${c.hora} | ${namePaciente}`
              }

              return {
                id: c.id,
                title: tituloMostrar,
                start: `${c.fecha}T${c.hora}:00`,
                end: `${c.fecha}T${String(Number(c.hora.split(":")[0]) + 1).padStart(2, "0")}:00:00`,
                backgroundColor: colorEvento,
                borderColor: c.estado === "cancelada" ? "#64748b" : colorEvento,
                textColor: "#ffffff"
              }
            })}
            dateClick={alPresionarCuadroBlanco}
            eventClick={(info) => {
              const citaEncontrada = citas.find(c => c.id === info.event.id)
              if (citaEncontrada) {
                setCitaSeleccionada(citaEncontrada)
              }
            }}
          />
        </div>
      </div>

     {/* 🪟 MODAL DE CREACIÓN DE CITA O ACTIVIDAD INTERNA */}
      {modalCreacionAbierto && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                REGISTRAR NUEVA CITA
              </h3>
              <button 
                onClick={() => setModalCreacionAbierto(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={registrarNuevaCita} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* 🔘 SELECTOR DE TIPO DE EVENTO (PACIENTE VS GERENCIA) */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Tipo de Registro </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setFormCita({ ...formCita, tipoEvento: "paciente" })}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: formCita.tipoEvento === "paciente" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                      backgroundColor: formCita.tipoEvento === "paciente" ? "#eef2ff" : "#ffffff",
                      color: formCita.tipoEvento === "paciente" ? "#4f46e5" : "#64748b",
                      fontWeight: "800",
                      fontSize: "12px",
                      cursor: "pointer"
                    }}
                  >
                     Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCita({ ...formCita, tipoEvento: "interno" })}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: formCita.tipoEvento === "interno" ? "2px solid #d97706" : "1px solid #cbd5e1",
                      backgroundColor: formCita.tipoEvento === "interno" ? "#fffbeb" : "#ffffff",
                      color: formCita.tipoEvento === "interno" ? "#b45309" : "#64748b",
                      fontWeight: "800",
                      fontSize: "12px",
                      cursor: "pointer"
                    }}
                  >
                    Actividad Interna
                  </button>
                </div>
              </div>

           {/* 👥 CAMPOS SEGÚN EL TIPO DE EVENTO */}
              {formCita.tipoEvento === "paciente" ? (
                <>
                  {/* PACIENTE */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Paciente *</label>
                    <input 
                      type="text" 
                      placeholder="Buscar por DNI o Nombre..." 
                      value={busquedaPaciente} 
                      onChange={e => setBusquedaPaciente(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                    />
                    <select 
                      value={formCita.paciente} 
                      onChange={e => setFormCita({ ...formCita, paciente: e.target.value })}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "6px", fontSize: "12px", boxSizing: "border-box" }}
                    >
                      <option value="">-- Seleccionar Paciente --</option>
                      {pacientesFiltrados.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre ? `${p.nombre} (${p.id})` : p.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Psicólogo / Terapeuta *</label>
                    <select 
                      value={formCita.idPsicologo} 
                      onChange={e => setFormCita({ ...formCita, idPsicologo: e.target.value })}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                    >
                      <option value="">-- Seleccionar Terapeuta --</option>
                      {psicologos.map(ps => (
                        <option key={ps.id} value={ps.id}>
                          {ps.nombre || ps.nombreCompleto || ps.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                /* 💼 CAMPOS EXCLUSIVOS PARA ACTIVIDAD INTERNA */
                <>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#b45309", textTransform: "uppercase" }}>Nombre de la Actividad *</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Reunión de Gerencia, Capacitación, Supervisión..." 
                      value={formCita.tituloActividad} 
                      onChange={e => setFormCita({ ...formCita, tituloActividad: e.target.value })}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fde68a", marginTop: "4px", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#fffbeb" }}
                    />
                  </div>

                  {/* 👥 ASIGNACIÓN DE ESPECIALISTAS CON BUSCADOR (MÚLTIPLE O ÚNICO) */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "#b45309", textTransform: "uppercase" }}>
                        Asignar a Especialista(s) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const todosIds = psicologos.map(p => p.id);
                          const estanTodos = (formCita.especialistasAsignados || []).length === psicologos.length;
                          setFormCita({
                            ...formCita,
                            especialistasAsignados: estanTodos ? [] : todosIds
                          });
                        }}
                        style={{ background: "none", border: "none", color: "#d97706", fontSize: "11px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}
                      >
                        {(formCita.especialistasAsignados || []).length === psicologos.length ? "Desmarcar todos" : "Seleccionar todos"}
                      </button>
                    </div>

                    {/* 🔍 CAMPO DE BÚSQUEDA DE ESPECIALISTAS */}
                    <input 
                      type="text" 
                      placeholder="Buscar especialista por nombre..." 
                      value={busquedaEspecialista || ""} 
                      onChange={e => setBusquedaEspecialista(e.target.value)}
                      style={{ 
                        width: "100%", 
                        padding: "6px 10px", 
                        borderRadius: "6px", 
                        border: "1px solid #fde68a", 
                        marginBottom: "6px", 
                        fontSize: "12px", 
                        boxSizing: "border-box", 
                        backgroundColor: "#fff" 
                      }}
                    />

                    <div style={{
                      maxHeight: "120px",
                      overflowY: "auto",
                      border: "1px solid #fde68a",
                      borderRadius: "8px",
                      padding: "8px",
                      backgroundColor: "#fffbeb",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}>
                      {psicologos
                        .filter(ps => {
                          const query = (busquedaEspecialista || "").toLowerCase();
                          const nombre = (ps.nombre || ps.nombreCompleto || ps.email || "").toLowerCase();
                          return nombre.includes(query);
                        })
                        .map(ps => {
                          const seleccionados = formCita.especialistasAsignados || [];
                          const estaSeleccionado = seleccionados.includes(ps.id);

                          return (
                            <label 
                              key={ps.id} 
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "12px",
                                color: "#334155",
                                fontWeight: estaSeleccionado ? "700" : "400",
                                cursor: "pointer"
                              }}
                            >
                              <input 
                                type="checkbox"
                                checked={estaSeleccionado}
                                onChange={e => {
                                  const nuevosEspecialistas = e.target.checked
                                    ? [...seleccionados, ps.id]
                                    : seleccionados.filter(id => id !== ps.id);

                                  setFormCita({ ...formCita, especialistasAsignados: nuevosEspecialistas });
                                }}
                                style={{ accentColor: "#d97706", cursor: "pointer" }}
                              />
                              {ps.nombre || ps.nombreCompleto || ps.email}
                            </label>
                          );
                        })}
                      {psicologos.filter(ps => {
                        const query = (busquedaEspecialista || "").toLowerCase();
                        const nombre = (ps.nombre || ps.nombreCompleto || ps.email || "").toLowerCase();
                        return nombre.includes(query);
                      }).length === 0 && (
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                          No se encontraron especialistas
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 📅 FECHA Y MODALIDAD */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Fecha *</label>
                  <input 
                    type="date" 
                    value={formCita.fecha} 
                    onChange={e => setFormCita({ ...formCita, fecha: e.target.value, hora: "" })}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Modalidad *</label>
                  <select 
                    value={formCita.modalidad} 
                    onChange={e => setFormCita({ ...formCita, modalidad: e.target.value, hora: "" })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                  >
                    <option value="Virtual">Virtual</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
              </div>

              {/* ⏰ HORA Y ESTADO INICIAL */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Hora *</label>
                  <select 
                    value={formCita.hora} 
                    onChange={e => setFormCita({ ...formCita, hora: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                  >
                    <option value="">-- Hora --</option>
                    {horasFiltradasOpciones.map(h => (
                      <option key={h} value={h}>{h} hrs</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Estado Inicial *</label>
                  <select 
                    value={formCita.estado} 
                    onChange={e => setFormCita({ ...formCita, estado: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box" }}
                  >
                    <option value="confirmado">Confirmado</option>
                    <option value="realizada">Realizada</option>
                    <option value="postergada">Postergada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              {/* 📝 MOTIVO DE CONSULTA (SOLO SE MUESTRA SI ES PACIENTE) */}
              {formCita.tipoEvento === "paciente" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>
                    Motivo de Consulta
                  </label>
                  <textarea 
                    rows="2" 
                    value={formCita.motivo} 
                    onChange={e => setFormCita({ ...formCita, motivo: e.target.value })}
                    placeholder="Detalles sobre el motivo..." 
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", fontSize: "12px", boxSizing: "border-box", resize: "none" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button 
                  type="button" 
                  onClick={() => setModalCreacionAbierto(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: formCita.tipoEvento === "interno" ? "#d97706" : "#4f46e5", color: "#ffffff", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}
                >
                  {formCita.tipoEvento === "interno" ? "Guardar Actividad" : "Guardar Cita"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔍 MODAL FLOTANTE DE DETALLE Y ACCIONES DE CITA / ACTIVIDAD */}
      {citaSeleccionada && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "420px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: citaSeleccionada.tipoEvento === "interno" ? "#fffbeb" : "#f8fafc"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                  {citaSeleccionada.tipoEvento === "interno" ? "💼 ACTIVIDAD INTERNA" : "DETALLES DE LA CITA"} 
                </h3>
                <span style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginTop: "4px",
                  display: "inline-block",
                  backgroundColor: citaSeleccionada.estado === "realizada" ? "#d1fae5" : citaSeleccionada.estado === "postergada" ? "#fef3c7" : citaSeleccionada.estado === "cancelada" ? "#fee2e2" : "#e0e7ff",
                  color: citaSeleccionada.estado === "realizada" ? "#065f46" : citaSeleccionada.estado === "postergada" ? "#92400e" : citaSeleccionada.estado === "cancelada" ? "#991b1b" : "#3730a3"
                }}>
                  Estado: {citaSeleccionada.estado}
                </span>
              </div>
              <button 
                onClick={() => {
                  setCitaSeleccionada(null)
                  setIdCitaPostergando(null)
                }}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              
              {/* Información adaptada según el tipo de evento */}
              {citaSeleccionada.tipoEvento === "interno" ? (
                <>
                  <div>
                    <span style={{ color: "#b45309", fontSize: "11px", fontWeight: "800" }}>ACTIVIDAD</span>
                    <p style={{ margin: 0, fontWeight: "800", color: "#0f172a", fontSize: "15px" }}>
                      {citaSeleccionada.tituloActividad || citaSeleccionada.nombrePaciente}
                    </p>
                  </div>

                  {/* ESPECIALISTAS ASIGNADOS A LA ACTIVIDAD */}
                  <div>
                    
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>PACIENTE</span>
                    <p style={{ margin: 0, fontWeight: "700", color: "#0f172a" }}>
                      {obtenerNombrePacienteConfidencial(citaSeleccionada.nombrePaciente || "Paciente")}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                      Código/DNI: <span style={{ color: "#334155", fontWeight: "700" }}>{citaSeleccionada.dniPaciente || citaSeleccionada.paciente}</span>
                    </p>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>PSICÓLOGO</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <span style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: obtenerColorPsicologo(citaSeleccionada.idPsicologo),
                        display: "inline-block"
                      }} />
                      <p style={{ margin: 0, fontWeight: "700", color: "#0f172a" }}>{citaSeleccionada.nombrePsicologo}</p>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>FECHA Y HORA</span>
                  <p style={{ margin: 0, fontWeight: "700", color: "#0f172a" }}>{citaSeleccionada.fecha} - {citaSeleccionada.hora}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>MODALIDAD</span>
                  <p style={{ margin: 0, fontWeight: "700", color: "#0f172a" }}>{citaSeleccionada.modalidad}</p>
                </div>
              </div>

              {/* MOTIVO DE CONSULTA SOLO VISIBLE SI ES EVENTO CON PACIENTE */}
              {citaSeleccionada.tipoEvento === "paciente" && citaSeleccionada.motivo && (
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>MOTIVO</span>
                  <p style={{ margin: 0, color: "#334155", fontStyle: "italic" }}>"{citaSeleccionada.motivo}"</p>
                </div>
              )}

              {/* 🔒 ACCIONES SOLO VISIBLES PARA EL ADMINISTRADOR */}
              {esAdmin && (
                <>
                  {idCitaPostergando === citaSeleccionada.id ? (
                    <div style={{ marginTop: "10px", padding: "12px", backgroundColor: "#fffbeb", borderRadius: "10px", border: "1px solid #fef3c7" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#b45309" }}>Reprogramar Fecha / Hora</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input 
                          type="date" 
                          value={nuevaFechaPostergada} 
                          onChange={e => setNuevaFechaPostergada(e.target.value)} 
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                        />
                        <select 
                          value={nuevaHoraPostergada} 
                          onChange={e => setNuevaHoraPostergada(e.target.value)} 
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                        >
                          <option value="">-- Hora --</option>
                          {obtenerHorasDisponiblesFiltradas(nuevaFechaPostergada, citaSeleccionada.modalidad).map(h => (
                            <option key={h} value={h}>{h} hrs</option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                          <button 
                            onClick={() => actualizarCitaPostergada(citaSeleccionada.id)}
                            style={{ flex: 1, padding: "6px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
                          >
                            Confirmar
                          </button>
                          <button 
                            onClick={() => setIdCitaPostergando(null)}
                            style={{ padding: "6px 10px", background: "#e2e8f0", color: "#475569", border: "none", borderRadius: "6px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700" }}>ACCIONES DE ESTADO</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button 
                          onClick={() => cambiarEstadoCita(citaSeleccionada.id, "realizada")}
                          style={{ padding: "8px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
                        >
                          ✓ Realizada
                        </button>
                        <button 
                          onClick={() => cambiarEstadoCita(citaSeleccionada.id, "postergada")}
                          style={{ padding: "8px", backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
                        >
                          ⏱ Reprogramar
                        </button>
                      </div>
                      <button 
                        onClick={() => cambiarEstadoCita(citaSeleccionada.id, "cancelada")}
                        style={{ padding: "8px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
                      >
                        ✕ Cancelar Evento
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}