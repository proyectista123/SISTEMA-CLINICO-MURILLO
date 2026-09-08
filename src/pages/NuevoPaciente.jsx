import { useState, useEffect, useCallback } from "react"
import { doc, getDoc, updateDoc,setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate, useSearchParams } from "react-router-dom"

const URL_WEBHOOK_APPS_SCRIPT =
  "https://script.google.com/macros/s/AKfycbyxrJoDpXSRwniYxIm4zye1LFmFU8X-oYMHHJEpPST-6bkRKupsUVBn_AQex85Y58Y2-w/exec"

export default function Anamnesis() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idPacienteBusqueda = searchParams.get("id")

  const [loading, setLoading] = useState(false)
  const [isHomeHovered, setIsHomeHovered] = useState(false)

  // Modo edición
  const [modoCompletarFaltantes, setModoCompletarFaltantes] = useState(false)
  const [camposExistentes, setCamposExistentes] = useState({})
  
  // Array de Firestore con los campos que ya sufrieron su segunda edición/guardado definitivo
  const [camposModificadosPreviamente, setCamposModificadosPreviamente] = useState([])

  // Botón único para mostrar/ocultar y habilitar la interacción
  const [edicionHabilitada, setEdicionHabilitada] = useState(false)

  const [idPacienteCreado, setIdPacienteCreado] = useState(null)
  const [nombrePacienteCreado, setNombrePacienteCreado] = useState("")
  const [enlaceDriveManual, setEnlaceDriveManual] = useState("")

  const [otroDocumentoTipo, setOtroDocumentoTipo] = useState("")
  const [otraCiudad, setOtraCiudad] = useState("")

  const [tieneInformePrevio, setTieneInformePrevio] = useState("No")
  const [llenoConsentimiento, setLlenoConsentimiento] = useState("No")

  const obtenerFechaHoy = useCallback(() => {
    const hoy = new Date()
    const offset = hoy.getTimezoneOffset()
    const fechaLocal = new Date(hoy.getTime() - offset * 60 * 1000)
    return fechaLocal.toISOString().split("T")[0]
  }, [])

  const [formData, setFormData] = useState({
    nombre: "",
    sexo: "Masculino",
    fechaNacimiento: "",
    edad: "",
    tipoDocumento: "DNI",
    dni: "",
    telefono: "",
    direccion: "",
    ciudadResidencia: "Arequipa",
    apoderado: "",
    telefonoApoderado: "",
    fechaRegistro: obtenerFechaHoy(),
  })

  const esCampoValido = useCallback(
    (valor) => valor !== undefined && valor !== null && String(valor).trim() !== "",
    []
  )

  // =========================================================================
  // PARTE MODIFICADA: Garantiza enlace directo descartando la papelera
  // =========================================================================
  const obtenerEnlaceDriveGarantizado = useCallback((idPaciente, urlEfectiva = "") => {
    if (urlEfectiva && urlEfectiva.trim() !== "" && !urlEfectiva.includes("trash")) {
      return urlEfectiva
    }
    const termino = idPaciente || "Pacientes"
    return `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(termino)}`
  }, [])
  // =========================================================================

  useEffect(() => {
    const cargarPacienteAEditar = async () => {
      if (!idPacienteBusqueda) return

      setLoading(true)
      try {
        const docRef = doc(db, "pacientes", idPacienteBusqueda)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const datos = docSnap.data()

          const tiposEstandar = ["DNI", "Carné de Extranjería", "Pasaporte", "Código del Sistema"]
          const ciudadesEstandar = ["Arequipa", "Lima", "Puno", "Cusco", "Tacna", "Moquegua"]

          const esTipoOtro = datos.tipoDocumento && !tiposEstandar.includes(datos.tipoDocumento)
          const esCiudadOtra = datos.ciudadResidencia && !ciudadesEstandar.includes(datos.ciudadResidencia)

          const datosCargados = {
            nombre: datos.nombre || "",
            sexo: datos.sexo || "Masculino",
            fechaNacimiento: datos.fechaNacimiento || "",
            edad: datos.edad || "",
            tipoDocumento: esTipoOtro ? "Otro" : datos.tipoDocumento || "DNI",
            dni: datos.dni || datos.codigoPaciente || "",
            telefono: datos.telefono || "",
            direccion: datos.direccion || "",
            ciudadResidencia: esCiudadOtra ? "Otro" : datos.ciudadResidencia || "Arequipa",
            apoderado: datos.apoderado || "",
            telefonoApoderado: datos.telefonoApoderado || "",
            fechaRegistro: datos.fechaRegistro || obtenerFechaHoy(),
          }

          if (esTipoOtro) setOtroDocumentoTipo(datos.tipoDocumento)
          if (esCiudadOtra) setOtraCiudad(datos.ciudadResidencia)

          setFormData(datosCargados)
          setCamposExistentes(datos)
          setCamposModificadosPreviamente(datos.camposEditados || [])
          setModoCompletarFaltantes(true)

          if (datos.tieneInformePrevio) setTieneInformePrevio(datos.tieneInformePrevio)
          if (datos.llenoConsentimiento) setLlenoConsentimiento(datos.llenoConsentimiento)

          setIdPacienteCreado(idPacienteBusqueda)
          setNombrePacienteCreado(datos.nombre || "")
          
          // Aseguramos enlace Drive libre de papelera
          const urlValida = obtenerEnlaceDriveGarantizado(idPacienteBusqueda, datos.enlaceDrive)
          setEnlaceDriveManual(urlValida)
        } else {
          alert("No se encontró al paciente solicitado.")
          navigate("/pacientes")
        }
      } catch (error) {
        console.error("Error al cargar paciente:", error)
        alert("Ocurrió un error al consultar la base de datos.")
      } finally {
        setLoading(false)
      }
    }

    cargarPacienteAEditar()
  }, [idPacienteBusqueda, navigate, obtenerFechaHoy, obtenerEnlaceDriveGarantizado])

  // Lógica para bloquear edición según el flujo exacto
  const estaBloqueado = useCallback(
    (nombreCampo) => {
      if (!modoCompletarFaltantes) return false

      // Si no ha apretado el botón único, TODO está bloqueado
      if (!edicionHabilitada) return true

      // Documentos clave siempre inmodificables
      if (
        nombreCampo === "dni" ||
        nombreCampo === "codigoPaciente" ||
        nombreCampo === "tipoDocumento"
      ) {
        return true
      }

      // Si el campo ya pasó de Editable a Inmodificable (guardado 2da vez) -> Bloqueado
      const fueCompletamenteCerrado = camposModificadosPreviamente.includes(nombreCampo)
      if (fueCompletamenteCerrado) return true

      // Si está en Pendiente o en Editable, permite modificar mientras 'edicionHabilitada' esté activo
      return false
    },
    [modoCompletarFaltantes, edicionHabilitada, camposModificadosPreviamente]
  )

  // Obtener la etiqueta de estado respetando el ciclo completo
  const obtenerTagEstado = (nombreCampo) => {
    if (!modoCompletarFaltantes || !edicionHabilitada) return null

    if (
      nombreCampo === "dni" ||
      nombreCampo === "codigoPaciente" ||
      nombreCampo === "tipoDocumento"
    ) {
      return <span style={s.tagStatus("inmutable")}>Inmodificable</span>
    }

    const fueCompletamenteCerrado = camposModificadosPreviamente.includes(nombreCampo)
    if (fueCompletamenteCerrado) {
      return <span style={s.tagStatus("inmutable")}>Inmodificable</span>
    }

    // Comprobamos si existía previamente información guardada en la base de datos
    const valorInicialEnBD = camposExistentes[nombreCampo]
    const existiaEnBD = esCampoValido(valorInicialEnBD)

    if (existiaEnBD) {
      return <span style={s.tagStatus("editable")}>Editable</span>
    }

    return <span style={s.tagStatus("pendiente")}>Pendiente</span>
  }

  const calcularEdadCronologica = useCallback((fechaNac, fechaRef) => {
    if (!fechaNac) return ""
    const [aNac, mNac, dNac] = fechaNac.split("-").map(Number)
    const [aRef, mRef, dRef] = (fechaRef || obtenerFechaHoy()).split("-").map(Number)

    let anos = aRef - aNac
    let meses = mRef - 1 - (mNac - 1)
    const dias = dRef - dNac

    if (dias < 0) meses--
    if (meses < 0) {
      anos--
      meses += 12
    }

    if (anos < 0) return "Nacimiento posterior"
    if (anos === 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`
    return `${anos} ${anos === 1 ? "año" : "años"}${
      meses > 0 ? ` y ${meses} ${meses === 1 ? "mes" : "meses"}` : ""
    }`
  }, [obtenerFechaHoy])

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((prev) => {
      let valorProcesado = value

      if (name === "dni") valorProcesado = value.replace(/[^0-9A-Za-z-]/g, "")
      if (name === "telefono" || name === "telefonoApoderado") valorProcesado = value.replace(/[^0-9+\s-]/g, "")

      const updated = { ...prev, [name]: valorProcesado }

      if (name === "fechaNacimiento" || name === "fechaRegistro") {
        const nac = name === "fechaNacimiento" ? valorProcesado : prev.fechaNacimiento
        const reg = name === "fechaRegistro" ? valorProcesado : prev.fechaRegistro
        updated.edad = calcularEdadCronologica(nac, reg)
      }

      if (name === "ciudadResidencia" && valorProcesado !== "Otro") setOtraCiudad("")
      if (name === "tipoDocumento" && valorProcesado !== "Otro") setOtroDocumentoTipo("")

      return updated
    })
  }

  const generarCodigoAlternativo = () => {
    const numeroAleatorio = Math.floor(100000 + Math.random() * 900000)
    return `PAC-${numeroAleatorio}`
  }

  // =========================================================================
  // PARTE MODIFICADA: Descartar URLs que apunten a la papelera (trash)
  // =========================================================================
// ✅ Solo gestiona la raíz del paciente e Informe Previo (sin consentimiento)
// ✅ Mantiene tu lógica actual, pero solo envía 'infPrevio'
const crearONubeCarpetaDrive = async (idPaciente, nombrePaciente, infPrevio) => {
  try {
    const payload = new URLSearchParams()
    payload.append("idPaciente", idPaciente)
    payload.append("nombrePaciente", nombrePaciente.trim())
    payload.append("crearInformePrevio", infPrevio)
    // 🗑️ Se eliminó 'crearConsentimiento' de la llamada inicial

    const responseDrive = await fetch(URL_WEBHOOK_APPS_SCRIPT, {
      method: "POST",
      body: payload,
    })

    if (responseDrive.ok) {
      const dataDrive = await responseDrive.json()
      const urlObtenida = dataDrive.urlDrive || dataDrive.url || dataDrive.enlaceDrive || dataDrive.folderUrl || ""
      
      if (urlObtenida && !urlObtenida.includes("trash")) {
        return urlObtenida
      }
    }
  } catch (errorDrive) {
    console.error("Error en Apps Script Drive:", errorDrive)
  }

  return obtenerEnlaceDriveGarantizado(idPaciente)
}
  // =========================================================================

  const procesarFormulario = async (e) => {
    e.preventDefault()
    if (!formData.nombre.trim()) {
      alert("El nombre completo es obligatorio.")
      return
    }

    setLoading(true)

    let dniPaciente = formData.dni.trim()
    let esCodigoGenerado = false

    if (!dniPaciente) {
      dniPaciente = generarCodigoAlternativo()
      esCodigoGenerado = true
    }

    const documentoFinal =
      formData.tipoDocumento === "Otro"
        ? otroDocumentoTipo.trim() || "Otro Documento"
        : esCodigoGenerado
        ? "Código del Sistema"
        : formData.tipoDocumento

    const cityFinal =
      formData.ciudadResidencia === "Otro"
        ? otraCiudad.trim() || "Otro"
        : formData.ciudadResidencia

    try {
      if (modoCompletarFaltantes) {
        const idDocumentoTarget = idPacienteCreado || idPacienteBusqueda

        let urlDriveGenerada = enlaceDriveManual
        const nuevaUrlDrive = await crearONubeCarpetaDrive(
          idDocumentoTarget,
          formData.nombre.trim(),
          tieneInformePrevio,
          llenoConsentimiento
        )
        if (nuevaUrlDrive) urlDriveGenerada = nuevaUrlDrive

        // Transición de Editable a Inmodificables
        const nuevosCamposEditados = [...camposModificadosPreviamente]
        if (edicionHabilitada) {
          Object.keys(formData).forEach((key) => {
            const teniaValorPrevio = esCampoValido(camposExistentes[key])
            if (teniaValorPrevio && esCampoValido(formData[key]) && !nuevosCamposEditados.includes(key)) {
              nuevosCamposEditados.push(key)
            }
          })
        }

        const pacienteRef = doc(db, "pacientes", idDocumentoTarget)

        const datosAEditar = {
          nombre: formData.nombre.trim(),
          sexo: formData.sexo,
          fechaNacimiento: formData.fechaNacimiento,
          edad: formData.edad.trim(),
          tipoDocumento: documentoFinal,
          dni: idDocumentoTarget,
          telefono: formData.telefono.trim(),
          direccion: formData.direccion.trim(),
          ciudadResidencia: cityFinal,
          apoderado: formData.apoderado.trim(),
          telefonoApoderado: formData.telefonoApoderado.trim(),
          fechaRegistro: formData.fechaRegistro,
          tieneInformePrevio: tieneInformePrevio,
          llenoConsentimiento: llenoConsentimiento,
          enlaceDrive: urlDriveGenerada,
          camposEditados: nuevosCamposEditados,
          ultimaActualizacion: serverTimestamp(),
        }

        await updateDoc(pacienteRef, datosAEditar)
        alert("🎉 ¡Datos actualizados exitosamente!")
        navigate("/pacientes")
      } else {
        if (!esCodigoGenerado) {
          const pacienteExistenteRef = doc(db, "pacientes", dniPaciente)
          const docSnap = await getDoc(pacienteExistenteRef)

          if (docSnap.exists()) {
            alert(`⚠️ Ya existe un paciente registrado con el documento: ${dniPaciente}.`)
            setLoading(false)
            return
          }
        }

        let idFinalDocumento = dniPaciente
        if (esCodigoGenerado) {
          let docSnapGenerado = await getDoc(doc(db, "pacientes", idFinalDocumento))
          while (docSnapGenerado.exists()) {
            idFinalDocumento = generarCodigoAlternativo()
            docSnapGenerado = await getDoc(doc(db, "pacientes", idFinalDocumento))
          }
        }

        const urlDriveGenerada = await crearONubeCarpetaDrive(
          idFinalDocumento,
          formData.nombre.trim(),
          "No",
          "No"
        )

        const nuevoPacienteRef = doc(db, "pacientes", idFinalDocumento)

        await setDoc(nuevoPacienteRef, {
          id: idFinalDocumento,
          nombre: formData.nombre.trim(),
          sexo: formData.sexo,
          fechaNacimiento: formData.fechaNacimiento,
          edad: formData.edad.trim(),
          tipoDocumento: documentoFinal,
          dni: idFinalDocumento,
          codigoPaciente: idFinalDocumento,
          telefono: formData.telefono.trim(),
          direccion: formData.direccion.trim(),
          ciudadResidencia: cityFinal,
          apoderado: formData.apoderado.trim(),
          telefonoApoderado: formData.telefonoApoderado.trim(),
          fechaRegistro: formData.fechaRegistro,
          tieneInformePrevio: "No",
          llenoConsentimiento: "No",
          enlaceDrive: urlDriveGenerada,
          camposEditados: [],
          fechaCreacion: serverTimestamp(),
        })

        alert("👍 Ficha de apertura registrada exitosamente.")
        navigate("/pacientes")
      }
    } catch (error) {
      console.error("Error al procesar paciente:", error)
      alert("Hubo un error al procesar la solicitud.")
    } finally {
      setLoading(false)
    }
  }

  const s = {
    container: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f8fafc",
      minHeight: "100vh",
      padding: "40px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      backgroundColor: "#ffffff",
      maxWidth: "720px",
      width: "100%",
      borderRadius: "24px",
      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
      border: "1px solid #e2e8f0",
      overflow: "hidden",
    },
    header: {
      backgroundColor: modoCompletarFaltantes ? "#0f172a" : "#1e293b",
      color: "#ffffff",
      padding: "30px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerTitle: { fontSize: "20px", fontWeight: "bold", margin: 0 },
    headerSubtitle: { color: "#cbd5e1", fontSize: "12px", marginTop: "4px", margin: 0 },
    homeBtn: {
      fontSize: "12px",
      fontWeight: "bold",
      color: "#ffffff",
      border: "none",
      padding: "10px 16px",
      borderRadius: "12px",
      cursor: "pointer",
    },
    unblockBar: {
      backgroundColor: edicionHabilitada ? "#ecfdf5" : "#f1f5f9",
      borderBottom: `1px solid ${edicionHabilitada ? "#a7f3d0" : "#e2e8f0"}`,
      padding: "12px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "13px",
      fontWeight: "600",
      color: edicionHabilitada ? "#065f46" : "#475569",
    },
    unblockBtn: {
      backgroundColor: edicionHabilitada ? "#dc2626" : "#2563eb",
      color: "#ffffff",
      border: "none",
      padding: "8px 16px",
      borderRadius: "10px",
      fontWeight: "bold",
      cursor: "pointer",
      fontSize: "12px",
      transition: "all 0.2s ease",
    },
    form: { padding: "30px", display: "flex", flexDirection: "column", gap: "24px" },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      borderBottom: "1px solid #f1f5f9",
      paddingBottom: "8px",
    },
    sectionTitle: {
      fontSize: "12px",
      fontWeight: "bold",
      color: "#1e293b",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      margin: 0,
    },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" },
    label: {
      fontSize: "11px",
      fontWeight: "bold",
      color: "#64748b",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "6px",
    },
    tagStatus: (tipo) => {
      let color = "#059669"
      if (tipo === "inmutable") color = "#b91c1c"
      if (tipo === "pendiente") color = "#d97706"
      if (tipo === "editable") color = "#2563eb"
      return {
        fontSize: "10px",
        fontWeight: "bold",
        color,
      }
    },
    input: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      fontSize: "13px",
      boxSizing: "border-box",
      outline: "none",
      backgroundColor: "#f8fafc",
      color: "#1e293b",
    },
    inputDisabled: {
      backgroundColor: "#f1f5f9",
      color: "#64748b",
      borderColor: "#cbd5e1",
      cursor: "not-allowed",
    },
    btnSubmit: {
      width: "100%",
      color: "#ffffff",
      border: "none",
      padding: "16px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: "bold",
      cursor: "pointer",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      backgroundColor: modoCompletarFaltantes ? "#059669" : "#1e293b",
      opacity: loading ? 0.7 : 1,
    },
    btnDrive: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      padding: "10px 16px",
      backgroundColor: "#0284c7",
      color: "#ffffff",
      borderRadius: "10px",
      textDecoration: "none",
      fontSize: "12px",
      fontWeight: "bold",
      marginTop: "8px",
    },
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.header}>
          <div>
            <h1 style={s.headerTitle}>
              {modoCompletarFaltantes ? "Completar Datos del Paciente" : "📋 Registrar Paciente"}
            </h1>
           
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            type="button"
            style={{
              ...s.homeBtn,
              backgroundColor: isHomeHovered ? "#334155" : "transparent",
            }}
            onMouseEnter={() => setIsHomeHovered(true)}
            onMouseLeave={() => setIsHomeHovered(false)}
          >
            🏠 Inicio
          </button>
        </div>

{/* BOTÓN ÚNICO DE DESBLOQUEO */}
{modoCompletarFaltantes && (
  <div style={s.unblockBar}>
    <span>
      {edicionHabilitada ? "🔓 Modo de Edición Habilitado" : ""}
    </span>
    <button
      type="button"
      onClick={() => setEdicionHabilitada((prev) => !prev)}
      style={s.unblockBtn}
    >
      {edicionHabilitada ? "🔒 Cerrar Edición" : "🔓 Habilitar Edición"}
    </button>
  </div>
)}

<form onSubmit={procesarFormulario} style={s.form}>
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <div style={s.grid}>
      <div style={{ gridColumn: "span 2" }}>
        <label style={s.label}>
          <span>Nombre Completo</span>
          {obtenerTagEstado("nombre")}
        </label>
        <input
          type="text"
          name="nombre"
          required
          readOnly={estaBloqueado("nombre")}
          style={{
            ...s.input,
            ...(estaBloqueado("nombre") ? s.inputDisabled : {}),
          }}
          value={formData.nombre}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Sexo</span>
          {obtenerTagEstado("sexo")}
        </label>
        <select
          name="sexo"
          disabled={estaBloqueado("sexo")}
          style={{
            ...s.input,
            ...(estaBloqueado("sexo") ? s.inputDisabled : {}),
          }}
          value={formData.sexo}
          onChange={handleChange}
        >
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
          <option value="Prefiero no decirlo">Prefiero no decirlo</option>
        </select>
      </div>

      {/* TIPO DOCUMENTO */}
      <div>
        <label style={s.label}>
          <span>Tipo Documento</span>
          {obtenerTagEstado("tipoDocumento")}
        </label>
        <select
          name="tipoDocumento"
          disabled={estaBloqueado("tipoDocumento")}
          style={{
            ...s.input,
            ...(estaBloqueado("tipoDocumento") ? s.inputDisabled : {}),
          }}
          value={formData.tipoDocumento}
          onChange={handleChange}
        >
          <option value="DNI">DNI (Perú)</option>
          <option value="Carné de Extranjería">Carné de Extranjería</option>
          <option value="Pasaporte">Pasaporte</option>
          <option value="Código del Sistema">Código del Sistema</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      {formData.tipoDocumento === "Otro" && (
        <div>
          <label style={s.label}>Especifique Tipo Doc.</label>
          <input
            type="text"
            readOnly={estaBloqueado("tipoDocumento")}
            style={{
              ...s.input,
              ...(estaBloqueado("tipoDocumento") ? s.inputDisabled : {}),
            }}
            placeholder="Ej. Cédula"
            value={otroDocumentoTipo}
            onChange={(e) => setOtroDocumentoTipo(e.target.value)}
          />
        </div>
      )}

      {/* NRO DOCUMENTO */}
      <div>
        <label style={s.label}>
          <span>Nro. Documento</span>
          {obtenerTagEstado("dni")}
        </label>
        <input
          type="text"
          name="dni"
          readOnly={estaBloqueado("dni")}
          placeholder=""
          style={{
            ...s.input,
            ...(estaBloqueado("dni") ? s.inputDisabled : {}),
          }}
          value={formData.dni}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Fecha de Registro *</span>
          {obtenerTagEstado("fechaRegistro")}
        </label>
        <input
          type="date"
          name="fechaRegistro"
          required
          readOnly={estaBloqueado("fechaRegistro")}
          style={{
            ...s.input,
            ...(estaBloqueado("fechaRegistro") ? s.inputDisabled : {}),
          }}
          value={formData.fechaRegistro}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Fecha Nacimiento</span>
          {obtenerTagEstado("fechaNacimiento")}
        </label>
        <input
          type="date"
          name="fechaNacimiento"
          readOnly={estaBloqueado("fechaNacimiento")}
          style={{
            ...s.input,
            ...(estaBloqueado("fechaNacimiento") ? s.inputDisabled : {}),
          }}
          value={formData.fechaNacimiento}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>Edad Cronológica</label>
        <input
          type="text"
          name="edad"
          readOnly
          style={{ ...s.input, ...s.inputDisabled }}
          value={formData.edad}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Teléfono Paciente</span>
          {obtenerTagEstado("telefono")}
        </label>
        <input
          type="tel"
          name="telefono"
          readOnly={estaBloqueado("telefono")}
          placeholder="Ej. 987 654 321"
          style={{
            ...s.input,
            ...(estaBloqueado("telefono") ? s.inputDisabled : {}),
          }}
          value={formData.telefono}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Ciudad Residencia</span>
          {obtenerTagEstado("ciudadResidencia")}
        </label>
        <select
          name="ciudadResidencia"
          disabled={estaBloqueado("ciudadResidencia")}
          style={{
            ...s.input,
            ...(estaBloqueado("ciudadResidencia") ? s.inputDisabled : {}),
          }}
          value={formData.ciudadResidencia}
          onChange={handleChange}
        >
          <option value="Arequipa">Arequipa</option>
          <option value="Lima">Lima</option>
          <option value="Puno">Puno</option>
          <option value="Cusco">Cusco</option>
          <option value="Tacna">Tacna</option>
          <option value="Moquegua">Moquegua</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      {formData.ciudadResidencia === "Otro" && (
        <div>
          <label style={s.label}>Especifique Ciudad</label>
          <input
            type="text"
            readOnly={estaBloqueado("ciudadResidencia")}
            style={{
              ...s.input,
              ...(estaBloqueado("ciudadResidencia") ? s.inputDisabled : {}),
            }}
            placeholder="Nombre de la ciudad"
            value={otraCiudad}
            onChange={(e) => setOtraCiudad(e.target.value)}
          />
        </div>
      )}

      <div style={{ gridColumn: "span 2" }}>
        <label style={s.label}>
          <span>Dirección Domiciliaria</span>
          {obtenerTagEstado("direccion")}
        </label>
        <input
          type="text"
          name="direccion"
          readOnly={estaBloqueado("direccion")}
          placeholder="Calle, avenida, distrito..."
          style={{
            ...s.input,
            ...(estaBloqueado("direccion") ? s.inputDisabled : {}),
          }}
          value={formData.direccion}
          onChange={handleChange}
        />
      </div>
    </div>
  </div>

  <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
    <div style={s.sectionHeader}>
      <span style={{ fontSize: "18px" }}></span>
      <h2 style={s.sectionTitle}>Datos del Apoderado / Tutor</h2>
    </div>

    <div style={s.grid}>
      <div>
        <label style={s.label}>
          <span>Nombre Apoderado</span>
          {obtenerTagEstado("apoderado")}
        </label>
        <input
          type="text"
          name="apoderado"
          readOnly={estaBloqueado("apoderado")}
          placeholder="Nombre y Apellidos"
          style={{
            ...s.input,
            ...(estaBloqueado("apoderado") ? s.inputDisabled : {}),
          }}
          value={formData.apoderado}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={s.label}>
          <span>Teléfono Apoderado</span>
          {obtenerTagEstado("telefonoApoderado")}
        </label>
        <input
          type="tel"
          name="telefonoApoderado"
          readOnly={estaBloqueado("telefonoApoderado")}
          placeholder="Ej. 987 654 321"
          style={{
            ...s.input,
            ...(estaBloqueado("telefonoApoderado") ? s.inputDisabled : {}),
          }}
          value={formData.telefonoApoderado}
          onChange={handleChange}
        />
      </div>
    </div>
  </div>

  {modoCompletarFaltantes && (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        paddingTop: "16px",
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <div style={s.sectionHeader}>
        <span style={{ fontSize: "18px" }}>📄</span>
        <h2 style={s.sectionTitle}>Documentación Adicional</h2>
      </div>

      <div style={s.grid}>
        <div>
          <label style={s.label}>
            <span>¿Tiene Informe Previo?</span>
          </label>
          <select
            disabled={!edicionHabilitada}
            style={{
              ...s.input,
              ...(!edicionHabilitada ? s.inputDisabled : {}),
            }}
            value={tieneInformePrevio}
            onChange={(e) => setTieneInformePrevio(e.target.value)}
          >
            <option value="No">No</option>
            <option value="Sí">Sí</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: "8px" }}></div>
    </div>
  )}

  <div style={{ paddingTop: "16px" }}>
    <button type="submit" disabled={loading} style={s.btnSubmit}>
      {loading
        ? "Procesando..."
        : modoCompletarFaltantes
        ? "Guardar Cambios y Actualizar Ficha"
        : "Aperturar Ficha en Base de Datos"}
    </button>
  </div>
</form>
      </div>
    </div>
  )
}