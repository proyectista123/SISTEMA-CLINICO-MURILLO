import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "../firebase"
import jsPDF from "jspdf"

export default function Informes() {
  const [pacientes, setPacientes] = useState([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState("")
  
  // Campos del informe
  const [tipoInforme, setTipoInforme] = useState("Evolución Clínica")
  const [resumen, setResumen] = useState("")
  const [recomendaciones, setRecomendaciones] = useState("")
  
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)

  // Cargar lista de pacientes para el selector
  useEffect(() => {
    const obtenerPacientes = async () => {
      try {
        const q = query(collection(db, "pacientes"), orderBy("nombre", "asc"))
        const snap = await getDocs(q)
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setPacientes(lista)
        if (lista.length > 0) setPacienteSeleccionado(lista[0].nombre)
      } catch (error) {
        console.error("Error al cargar pacientes para reportes:", error)
      } finally {
        setLoading(false)
      }
    }
    obtenerPacientes()
  }, [])

  // GENERAR PDF ESTRUCTURADO Y PROFESIONAL
  const exportarInformePDF = () => {
    if (!pacienteSeleccionado || !resumen.trim()) {
      alert("Por favor, selecciona un paciente y escribe el resumen del informe.")
      return
    }

    setGenerando(true)
    
    try {
      const pdf = new jsPDF()
      const anchoMax = 170

      // Encabezado Institucional / Clínico
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(22)
      pdf.setTextColor(30, 41, 59) // Gris oscuro elegante
      pdf.text("INFORME PSICOLÓGICO CLÍNICO", 20, 25)

      // Línea decorativa
      pdf.setDrawColor(59, 130, 246) // Azul rey
      pdf.setLineWidth(1)
      pdf.line(20, 30, 190, 30)

      // Metadatos del Documento
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.setTextColor(100, 116, 139)
      pdf.text("PACIENTE:", 20, 42)
      pdf.text("TIPO DE INFORME:", 20, 49)
      pdf.text("FECHA DE EMISIÓN:", 20, 56)

      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(51, 65, 85)
      pdf.text(pacienteSeleccionado, 50, 42)
      pdf.text(tipoInforme, 60, 49)
      pdf.text(new Date().toLocaleDateString(), 65, 56)

      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.5)
      pdf.line(20, 62, 190, 62)

      // Sección 1: Resumen Clínico / Evaluación
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(13)
      pdf.setTextColor(30, 41, 59)
      pdf.text("1. Resumen de Evaluación y Evolución", 20, 72)
      
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(11)
      pdf.setTextColor(71, 85, 105)
      // 💡 El uso de { maxWidth } evita que el texto se salga de la hoja A4
      pdf.text(resumen, 20, 80, { maxWidth: anchoMax, align: "justify" })

      // Sección 2: Recomendaciones Terapéuticas
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(13)
      pdf.setTextColor(30, 41, 59)
      pdf.text("2. Recomendaciones e Intervención", 20, 145)
      
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(11)
      pdf.setTextColor(71, 85, 105)
      pdf.text(recomendaciones || "No se especifican recomendaciones adicionales en este periodo.", 20, 153, { maxWidth: anchoMax, align: "justify" })

      // Espacio para Firma de Validación Legal/Clínica
      pdf.setDrawColor(148, 163, 184)
      pdf.line(60, 240, 150, 240)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.setTextColor(100, 116, 139)
      pdf.text("Firma del Profesional Responsable", 77, 246)
      pdf.setFontSize(9)
      pdf.text("Departamento de Psicología Clínica", 80, 251)

      // Guardar
      const nombreArchivo = `Informe_${pacienteSeleccionado.replace(/\s+/g, "_")}.pdf`
      pdf.save(nombreArchivo)
    } catch (error) {
      console.error("Error generando PDF:", error)
      alert("No se pudo construir el archivo PDF.")
    } finally {
      setGenerando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl font-medium text-gray-500">Cargando catálogo de pacientes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Centro de Reportes</h1>
        <p className="text-gray-500 text-sm mt-1">Generación automática de documentos e informes clínicos listos para impresión</p>
      </header>

      <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* PARTE IZQUIERDA: CONFIGURACIÓN INICIAL */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-700 border-b pb-2">Configuración</h2>
          
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase">Seleccionar Paciente</label>
            <select
              className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1 bg-white"
              value={pacienteSeleccionado}
              onChange={(e) => setPacienteSeleccionado(e.target.value)}
            >
              {pacientes.map((p) => (
                <option key={p.id} value={p.nombre}>
                  👤 {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Documento</label>
            <select
              className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1 bg-white"
              value={tipoInforme}
              onChange={(e) => setTipoInforme(e.target.value)}
            >
              <option value="Evolución Clínica">Evolución Clínica</option>
              <option value="Informe Psicométrico">Informe Psicométrico</option>
              <option value="Peritaje Psicológico">Peritaje Psicológico</option>
              <option value="Alta Médica/Terapéutica">Alta Médica/Terapéutica</option>
            </select>
          </div>
        </div>

        {/* PARTE DER: CONTENIDO REDACTABLE */}
        <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-700 border-b pb-2">Cuerpo del Informe</h2>
            
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Resumen y Hallazgos Clínicos</label>
              <textarea
                placeholder="Escribe el desarrollo analítico del estado, conductas o progreso observados en el paciente..."
                rows="5"
                required
                className="w-full border border-gray-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1 resize-none"
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Recomendaciones o Plan de Acción</label>
              <textarea
                placeholder="Tareas para el hogar, derivaciones o pautas de intervención futuras..."
                rows="3"
                className="w-full border border-gray-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1 resize-none"
                value={recomendaciones}
                onChange={(e) => setRecommendations(e.target.value)} // Corrección nativa abajo
                onChange={(e) => setRecomendaciones(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={exportarInformePDF}
            disabled={generando}
            className={`w-full text-white p-4 rounded-2xl font-semibold shadow-md transition tracking-wide mt-4 ${
              generando ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {generando ? "Compilando PDF..." : "🖨️ Generar e Imprimir PDF"}
          </button>
        </div>

      </div>
    </div>
  )
}