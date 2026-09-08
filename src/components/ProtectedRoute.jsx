import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx" // 👈 Usamos tu Contexto de Firebase

export default function ProtectedRoute({ allowedRoles }) {
  const authData = useAuth()

  // 🛡️ CONTROL DE SEGURIDAD: Si useAuth se rompe o es undefined
  if (!authData) {
    console.error("CRÍTICO: El hook useAuth() devolvió undefined en ProtectedRoute.")
    return <Navigate to="/" replace />
  }

  const { user, role, loading } = authData
  
  // Mientras Firebase averigua el usuario y su rol en Firestore, mostramos pantalla de carga
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p className="text-slate-400 font-bold text-xs">Verificando credenciales...</p>
      </div>
    )
  }

  // 1️⃣ Si no hay usuario autenticado en Firebase, directo al Login ("/")
  if (!user) {
    return <Navigate to="/" replace />
  }

  // 2️⃣ FILTRO ESTRICTO DE ROLES: 
  // Convertimos a minúsculas para que no falle si en Firestore guardaste "Psicologo" o "psicologo"
  const formatoRol = role ? role.toLowerCase() : ""
  const rolesPermitidosMinuscula = allowedRoles ? allowedRoles.map(r => r.toLowerCase()) : []

  if (allowedRoles && !rolesPermitidosMinuscula.includes(formatoRol)) {
    console.error(`🔒 ACCESO RECHAZADO: El rol '${role}' no tiene permisos aquí.`);
    
    // Si lo rechaza pero el usuario sí está logueado, lo mandamos al dashboard común en lugar de botarlo del sistema
    return <Navigate to="/dashboard" replace />
  }

  // Si pasó todas las pruebas (está logueado y su rol es permitido), adelante
  return <Outlet />
}