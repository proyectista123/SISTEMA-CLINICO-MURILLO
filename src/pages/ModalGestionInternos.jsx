import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, arrayRemove, query, where } from "firebase/firestore";
import { db } from "../firebase";

export function ModalGestionInternos({ isOpen, onClose }) {
  const [internos, setInternos] = useState([]);
  const [codigoInput, setCodigoInput] = useState("");
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null);
  const [loadingBusqueda, setLoadingBusqueda] = useState(false);
  const [cargandoInternos, setCargandoInternos] = useState(false);
  const [internosSeleccionados, setInternosSeleccionados] = useState([]);

  // 1. Cargar internos desde la colección "users"
  const cargarInternos = async () => {
    setCargandoInternos(true);
    try {
      const snap = await getDocs(collection(db, "users"));
const lista = snap.docs
  .map((d) => {
    const data = d.data();
    // ⚠️ CRÍTICO: El uid debe ser prioritariamente data.uid (si se guardó dentro) o d.id (ID del doc de Auth)
    return { 
      uid: data.uid || d.id, 
      id: d.id,
      ...data 
    };
  })
  .filter((u) => {
    const valorRol = String(u.role || u.rol || "").trim().toLowerCase();
    const esInterno = valorRol === "interno" || valorRol === "practicante";
    return esInterno && u.activo !== false;
  });

      setInternos(lista);
    } catch (err) {
      console.error("Error al cargar la lista de internos:", err);
    } finally {
      setCargandoInternos(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarInternos();
    }
  }, [isOpen]);

  const obtenerNombreUsuario = (u) => {
    if (!u) return "Usuario Desconocido";
    return u.nombre || u.correo || u.email || `ID: ${u.uid}`;
  };

  // 2. Buscar paciente por su código o por el ID de su documento
  const buscarPaciente = async (codigo) => {
    const busqueda = codigo.trim();
    setCodigoInput(codigo);
    setInternosSeleccionados([]);

    if (!busqueda) {
      setPacienteEncontrado(null);
      return;
    }

    setLoadingBusqueda(true);
    try {
      // Intento A: Buscar por campo 'codigo' en la colección
      const q = query(collection(db, "pacientes"), where("codigo", "==", busqueda));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        setPacienteEncontrado({ id: docSnap.id, ...docSnap.data() });
      } else {
        // Intento B: Buscar asumiendo que el ID del documento es el código
        const snapAll = await getDocs(collection(db, "pacientes"));
        const coincidencia = snapAll.docs.find(
          (d) => d.id === busqueda || d.data().codigo === busqueda
        );

        if (coincidencia) {
          setPacienteEncontrado({ id: coincidencia.id, ...coincidencia.data() });
        } else {
          setPacienteEncontrado(null);
        }
      }
    } catch (err) {
      console.error("Error al buscar paciente:", err);
    } finally {
      setLoadingBusqueda(false);
    }
  };

  // 3. Controlar la selección múltiple
  const handleSelectInternos = (e) => {
    const opciones = Array.from(e.target.selectedOptions, (option) => option.value);
    setInternosSeleccionados(opciones);
  };

  // 4. Asignar los internos al paciente (Guardando sus UIDs exactos)
  const handleAsignar = async () => {
    if (!pacienteEncontrado || internosSeleccionados.length === 0) return;

    try {
      const ref = doc(db, "pacientes", pacienteEncontrado.id);
      const asignadosActuales = pacienteEncontrado.internosAsignados || [];
      
      // Unir lista asegurando unicidad de UIDs
      const nuevaLista = Array.from(new Set([...asignadosActuales, ...internosSeleccionados]));

      await updateDoc(ref, { internosAsignados: nuevaLista });

      alert(`✅ Interno(s) asignado(s) correctamente a "${pacienteEncontrado.nombre}".`);
      setPacienteEncontrado({ ...pacienteEncontrado, internosAsignados: nuevaLista });
      setInternosSeleccionados([]);
    } catch (error) {
      console.error("Error al asignar internos:", error);
    }
  };

  // 5. Desasignar un interno de la lista del paciente
  const handleDesasignar = async (internoUid) => {
    try {
      const ref = doc(db, "pacientes", pacienteEncontrado.id);
      await updateDoc(ref, {
        internosAsignados: arrayRemove(internoUid)
      });

      const nuevaLista = (pacienteEncontrado.internosAsignados || []).filter((id) => id !== internoUid);
      setPacienteEncontrado({ ...pacienteEncontrado, internosAsignados: nuevaLista });
    } catch (error) {
      console.error("Error al desasignar:", error);
    }
  };

  if (!isOpen) return null;

  const s = {
    overlay: {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    modal: {
      backgroundColor: "#ffffff",
      padding: "32px",
      borderRadius: "24px",
      maxWidth: "500px",
      width: "90%",
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
      border: "1px solid rgba(226, 232, 240, 0.8)",
    },
    title: { margin: "0 0 20px 0", fontSize: "20px", fontWeight: "800", color: "#1e293b" },
    label: { fontWeight: "700", fontSize: "13px", color: "#475569", display: "block", marginBottom: "6px" },
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
      border: "1px solid #cbd5e1",
      outline: "none",
      fontSize: "14px",
      color: "#1e293b",
      backgroundColor: "#f8fafc",
      boxSizing: "border-box",
      marginBottom: "12px",
    },
    cardFound: {
      backgroundColor: "#e0e7ff",
      border: "1px solid #c7d2fe",
      padding: "14px",
      borderRadius: "14px",
      marginBottom: "16px",
      fontSize: "13px",
      color: "#3730a3",
    },
    selectMultiple: {
      width: "100%",
      padding: "10px",
      borderRadius: "12px",
      border: "1px solid #cbd5e1",
      outline: "none",
      fontSize: "13px",
      color: "#1e293b",
      backgroundColor: "#f8fafc",
      boxSizing: "border-box",
      height: "120px",
    },
    btnAction: (enabled) => ({
      width: "100%",
      backgroundColor: enabled ? "#4f46e5" : "#94a3b8",
      color: "#ffffff",
      border: "none",
      padding: "12px",
      borderRadius: "12px",
      fontWeight: "700",
      fontSize: "13px",
      cursor: enabled ? "pointer" : "not-allowed",
      marginTop: "12px",
    }),
    btnClose: {
      width: "100%",
      backgroundColor: "#f1f5f9",
      color: "#475569",
      border: "none",
      padding: "12px",
      borderRadius: "12px",
      fontSize: "13px",
      fontWeight: "bold",
      cursor: "pointer",
    },
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.title}>🎓 Asignación de Internos</h2>

        {/* 1. INGRESAR CÓDIGO DEL PACIENTE */}
        <label style={s.label}>1. Código o ID del Paciente:</label>
        <input
          type="text"
          placeholder="Ej: PAC-001"
          value={codigoInput}
          onChange={(e) => buscarPaciente(e.target.value)}
          style={s.input}
        />

        {loadingBusqueda && (
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "-8px" }}>Buscando paciente...</p>
        )}

        {pacienteEncontrado && (
          <div style={s.cardFound}>
            <div><strong>Nombre del Paciente:</strong></div>
            <div style={{ fontSize: "16px", fontWeight: "800", marginTop: "4px" }}>
              {pacienteEncontrado.nombre}
            </div>
          </div>
        )}

        {/* 2. SELECCIÓN DE INTERNOS */}
        {pacienteEncontrado && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={s.label}>2. Selecciona Interno(s):</label>
              <button
                type="button"
                onClick={cargarInternos}
                style={{ fontSize: "11px", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                🔄 Actualizar
              </button>
            </div>

            <select
              multiple
              value={internosSeleccionados}
              onChange={handleSelectInternos}
              style={s.selectMultiple}
            >
              {internos.map((i) => (
                <option key={i.uid} value={i.uid} style={{ padding: "6px" }}>
                  👤 {obtenerNombreUsuario(i)}
                </option>
              ))}
            </select>

            {cargandoInternos && (
              <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Cargando lista de usuarios...</p>
            )}

            {!cargandoInternos && internos.length === 0 && (
              <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "6px" }}>
                ❌ No hay internos activos registrados en el sistema.
              </p>
            )}

            <button
              onClick={handleAsignar}
              disabled={internosSeleccionados.length === 0}
              style={s.btnAction(internosSeleccionados.length > 0)}
            >
              + Asignar Seleccionado(s)
            </button>

            {/* LISTA ACTUAL */}
            <h4 style={{ marginTop: "24px", marginBottom: "10px", color: "#1e293b", fontSize: "14px", fontWeight: "700" }}>
              📋 Internos asignados actualmente:
            </h4>

            {(!pacienteEncontrado.internosAsignados || pacienteEncontrado.internosAsignados.length === 0) ? (
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Este paciente no tiene internos asignados aún.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pacienteEncontrado.internosAsignados.map((internoUid) => {
                  const datosInterno = internos.find((i) => i.uid === internoUid);
                  return (
                    <li key={internoUid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                      <span>🎓 <strong>{obtenerNombreUsuario(datosInterno)}</strong></span>
                      <button onClick={() => handleDesasignar(internoUid)} style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                        Quitar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div style={{ marginTop: "24px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
          <button onClick={onClose} style={s.btnClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default ModalGestionInternos;