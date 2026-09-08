import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function VistaInterno({ currentUser }) {
  const [misPacientes, setMisPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarMisPacientes = async () => {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, "pacientes"),
          where("internosAsignados", "array-contains", currentUser.uid)
        );
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({
          id: d.id,
          nombre: d.data().nombre
        }));
        setMisPacientes(lista);
      } catch (err) {
        console.error("Error al cargar asignaciones:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarMisPacientes();
  }, [currentUser]);

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo);
    alert(`📋 ¡Código ${codigo} copiado!`);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>🎓 Mis Pacientes Asignados (Rol Interno)</h2>
      <p style={{ color: "#666", fontSize: "14px" }}>
        Copia el código de acceso del paciente para trabajar en los módulos autorizados.
      </p>

      {loading ? (
        <p>Cargando lista...</p>
      ) : misPacientes.length === 0 ? (
        <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "10px", textAlign: "center" }}>
          Aún no se te han asignado pacientes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {misPacientes.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff" }}>
              <div>
                <h4 style={{ margin: 0, color: "#1e293b" }}>👤 {p.nombre}</h4>
                <small style={{ color: "#64748b" }}>Código: <strong>{p.id}</strong></small>
              </div>
              <button
                onClick={() => copiarCodigo(p.id)}
                style={{ backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
              >
                📋 Copiar Código
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}