import { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"

export default function Pacientes() {
  const navigate = useNavigate()

  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState("") 
  const [mostrarLista, setMostrarLista] = useState(false) 
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)

  // OBTENER PACIENTES DESDE FIRESTORE
  const obtenerPacientes = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "pacientes"), orderBy("nombre", "asc"))
      const querySnapshot = await getDocs(q)
      
      const lista = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
      
      setPacientes(lista)
    } catch (error) {
      console.error("Error al obtener pacientes:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    obtenerPacientes()
  }, [])

  // MOSTRAR NOMBRE COMPLETO DIRECTAMENTE
  const obtenerNombreCompleto = (pacienteActual) => {
    if (!pacienteActual || !pacienteActual.nombre) return "Sin Nombre"
    return pacienteActual.nombre.trim()
  }

  const seleccionarPaciente = (paciente) => {
    setPacienteSeleccionado(paciente)
    setBusqueda(obtenerNombreCompleto(paciente))
    setMostrarLista(false)
  }

  // 🔍 FILTRADO POR NOMBRE COMPLETO O CÓDIGO
  const sugerenciasFiltradas = () => {
    if (!busqueda.trim()) return []

    const textoLimpio = busqueda.toLowerCase().trim()

    return pacientes.filter((p) => {
      if (!p.nombre) return false
      
      const nombreCompleto = p.nombre.toLowerCase().trim()
      const codigo = (p.id || "").toLowerCase().trim()

      return nombreCompleto.includes(textoLimpio) || codigo.includes(textoLimpio)
    })
  }

  const listaSugerencias = sugerenciasFiltradas()

  // EVALUAR DATOS INCOMPLETOS
  const evaluarDatosIncompletos = (paciente) => {
    const camposObligatorios = [
      paciente.nombre,
      paciente.sexo,
      paciente.fechaNacimiento,
      paciente.dni,
      paciente.telefono,
      paciente.direccion,
      paciente.ciudadResidencia,
      paciente.apoderado,
      paciente.telefonoApoderado,
    ]

    return camposObligatorios.some(
      (val) => val === undefined || val === null || String(val).trim() === ""
    )
  }

  // CONSTRUIR LINK DE DRIVE
  const obtenerEnlaceDrive = (paciente) => {
    const enlaceExistente = paciente.enlaceDriveAnamnesis || paciente.enlaceDrive || paciente.urlAnamnesis
    if (enlaceExistente && enlaceExistente.trim() !== "") {
      return enlaceExistente
    }
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(paciente.nombre || paciente.id)}`
  }

  // ESTILOS EN OBJETO
  const s = {
    container: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px', display: 'flex', justifyContent: 'center' },
    card: { backgroundColor: '#ffffff', maxWidth: '750px', width: '100%', padding: '35px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    backBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', transition: 'color 0.2s', padding: 0 },
    header: { borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
    subtitle: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' },
    input: { width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
    btnSec: { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '12px 20px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
    dropdown: { position: 'absolute', zIndex: 50, width: '100%', marginTop: '6px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', maxHeight: '280px', overflowY: 'auto' },
    dropdownItem: { padding: '12px 16px', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.15s' },
    btnInlineEdit: { backgroundColor: '#b45309', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' },
    activeCard: { backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
    badgeInfo: { backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' },
    codeBanner: { backgroundColor: '#4f46e5', borderRadius: '16px', padding: '16px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)' },
    codeText: { fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', margin: '4px 0 0 0' },
    driveCard: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '18px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
    driveBtn: { backgroundColor: '#16a34a', color: '#ffffff', textDecoration: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)', transition: 'background-color 0.2s' }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        
        {/* NAVEGACIÓN SUPERIOR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigate("/dashboard")} style={s.backBtn}>
            ← Volver al inicio
          </button>
          
          <button onClick={() => navigate("/nuevo-paciente")} style={s.btnSec}>
            ➕ Registrar Paciente
          </button>
        </div>

        <header style={s.header}>
          <h1 style={s.title}>Módulo de Pacientes</h1>
        </header>

        {/* 🔍 BARRA DE BÚSQUEDA Y MENÚ DESPLEGABLE */}
        <div style={{ position: 'relative', marginBottom: '35px' }}>
          <label style={{ ...s.subtitle, textAlign: 'center' }}>
            🔎 Búsqueda por nombre completo o código
          </label>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', fontSize: '16px', color: '#94a3b8' }}>🔎</span>
            <input
              type="text"
              placeholder={loading ? "Cargando catálogo..." : "Escribe el nombre o código..."}
              disabled={loading}
              style={{ ...s.input, paddingLeft: '45px' }}
              value={busqueda}
              onFocus={() => setMostrarLista(true)}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setMostrarLista(true)
              }}
            />
            {busqueda && (
              <button 
                type="button"
                onClick={() => {
                  setBusqueda("")
                  setPacienteSeleccionado(null)
                  setMostrarLista(false)
                }}
                style={{ position: 'absolute', right: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Borrar
              </button>
            )}
          </div>

          {/* LISTA DESPLEGABLE */}
          {mostrarLista && busqueda.trim() !== "" && (
            <div style={s.dropdown}>
              {listaSugerencias.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                  ❌ No se encontraron pacientes con esa búsqueda
                </div>
              ) : (
                listaSugerencias.map((paciente) => {
                  return (
                    <div
                      key={paciente.id}
                      onClick={() => seleccionarPaciente(paciente)}
                      style={s.dropdownItem}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>
                        👤 {obtenerNombreCompleto(paciente)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* 📊 EXPEDIENTE DEL PACIENTE SELECCIONADO */}
        <div>
          {!pacienteSeleccionado ? (
            <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed #cbd5e1', borderRadius: '20px', backgroundColor: '#f8fafc', color: '#94a3b8', fontSize: '12px' }}>
              Selecciona un paciente de la lista para abrir su expediente.
            </div>
          ) : (
            <div style={s.activeCard}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => navigate(`/nuevo-paciente?id=${pacienteSeleccionado.id}`)}
                      style={{ border: 'none', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '6px' }}
                    >
                      ✏️ Editar datos
                    </button>
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0 0' }}>
                    {pacienteSeleccionado.nombre}
                  </h2>
                </div>
                <span style={s.badgeInfo}>
                  Modalidad: {pacienteSeleccionado.tipoAtencion || "No especificada"}
                </span>
              </div>

              {/* 📂 GOOGLE DRIVE */}
              <div style={s.driveCard}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.5px', display: 'block' }}>
                    📁 Carpeta Drive
                  </span>
                </div>

                <a
                  href={obtenerEnlaceDrive(pacienteSeleccionado)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.driveBtn}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#15803d'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#16a34a'}
                >
                  Abrir ↗
                </a>
              </div>

              {/* CÓDIGO ÚNICO */}
              <div style={s.codeBanner}>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#c7d2fe' }}>
                    🔑 Código de Acceso
                  </span>
                  <p style={s.codeText}>
                    {pacienteSeleccionado.id}
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pacienteSeleccionado.id)
                    alert(`📋 ¡Código ${pacienteSeleccionado.id} copiado!`)
                  }}
                  style={{ border: 'none', backgroundColor: '#ffffff', color: '#4f46e5', fontWeight: 'bold', fontSize: '11px', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  Copiar Código
                </button>
              </div>

              {/* HISTORIAL ANAMNESIS */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', textAlign: 'center' }}>
                <button
                  onClick={() => navigate(`/anamnesis/${pacienteSeleccionado.id}`)}
                  style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Ver Historial de Anamnesis de este paciente →
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  )
}