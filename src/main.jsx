import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css" // Importación de Tailwind CSS (Global)
import "./App.css"   // Estilos personalizados y tipografía base

// Proveedor de autenticación para toda la app
import { AuthProvider } from "./context/AuthContext.jsx" 

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
