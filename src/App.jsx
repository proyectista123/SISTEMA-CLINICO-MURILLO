import React, { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext.jsx" 
import NuevoPaciente from "./pages/NuevoPaciente"

// 🔑 Importamos el Guardián que acabas de crear
import ForzarCambioPasswordGuard from "./pages/ForzarCambioPasswordGuard" // Ajusta la ruta si lo creaste en otra carpeta

// ⚡ Carga perezosa (Lazy Loading)
const Login = lazy(() => import("./pages/Login"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Pacientes = lazy(() => import("./pages/Pacientes"))
const Anamnesis = lazy(() => import("./pages/Anamnesis")) 
const Sesiones = lazy(() => import("./pages/Sesiones"))
const Agenda = lazy(() => import("./pages/Agenda"))
const Informes = lazy(() => import("./pages/Informes"))
const Psicometria = lazy(() => import("./pages/Psicometria"))
const Usuarios = lazy(() => import("./pages/Usuarios"))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">
            Cargando entorno clínico...
          </div>
        }>
          <Routes>
            
            {/* 🔓 RUTAS PÚBLICAS */}
            <Route path="/" element={<Login />} />

            {/* 🔒 1. SECCIONES COMPARTIDAS (Psicólogo, Interno y Admin) */}
            {/* Las envolvemos dentro del Guardián para proteger todas las vistas de trabajo */}
            <Route element={
              <ProtectedRoute allowedRoles={["admin", "psicologo","interno"]} />
            }>
              <Route path="/dashboard" element={
                <ForzarCambioPasswordGuard>
                  <Dashboard />
                </ForzarCambioPasswordGuard>
              } />
              <Route path="/agenda" element={
                <ForzarCambioPasswordGuard>
                  <Agenda />
                </ForzarCambioPasswordGuard>
              } />
              
              {/* Anamnesis (Ver y registrar) */}
              <Route path="/anamnesis" element={
                <ForzarCambioPasswordGuard>
                  <Anamnesis />
                </ForzarCambioPasswordGuard>
              } />
              <Route path="/anamnesis/:id" element={
                <ForzarCambioPasswordGuard>
                  <Anamnesis />
                </ForzarCambioPasswordGuard>
              } />
              
              {/* Sesiones (Ver y registrar) */}
              <Route path="/sesiones" element={
                <ForzarCambioPasswordGuard>
                  <Sesiones />
                </ForzarCambioPasswordGuard>
              } />
              <Route path="/sesiones/:id" element={
                <ForzarCambioPasswordGuard>
                  <Sesiones />
                </ForzarCambioPasswordGuard>
              } />
              
              {/* Psicometría (Ver y registrar) */}
              <Route path="/psicometria" element={
                <ForzarCambioPasswordGuard>
                  <Psicometria />
                </ForzarCambioPasswordGuard>
              } />
              <Route path="/psicometria/:id" element={
                <ForzarCambioPasswordGuard>
                  <Psicometria />
                </ForzarCambioPasswordGuard>
              } />
            </Route>

            {/* 🚫 2. SECCIONES EXCLUSIVAS DEL ADMINISTRADOR */}
            {/* En el panel del Admin no es obligatorio forzar el cambio, pero si lo prefieres, también puedes envolverlos */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/pacientes" element={<Pacientes />} />
              <Route path="/nuevo-paciente" element={<NuevoPaciente />} />
              <Route path="/informes" element={<Informes />} />
            </Route>

            {/* ❓ RUTA POR DEFECTO */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}