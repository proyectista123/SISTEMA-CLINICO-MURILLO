import { useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { useNavigate } from "react-router-dom"

export default function Historias() {

  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState([])
  const navigate = useNavigate()

  const buscar = async () => {

    const querySnapshot = await getDocs(collection(db, "pacientes"))

    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    const filtrados = data.filter(p =>
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.id?.includes(busqueda)
    )

    setResultados(filtrados)
  }

  return (
    <div className="p-10">

      <input
        className="border p-3 w-full"
        placeholder="Buscar por nombre o ID"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <button
        onClick={buscar}
        className="bg-blue-600 text-white px-4 py-2 mt-3"
      >
        Buscar
      </button>

      <div className="mt-5">

        {resultados.map(p => (
          <div
            key={p.id}
            className="p-3 border mb-2 flex justify-between"
          >
            <span>{p.nombre}</span>

            <button
              onClick={() => navigate(`/historia/${p.id}`)}
              className="bg-green-600 text-white px-3 py-1"
            >
              Ver historia
            </button>
          </div>
        ))}

      </div>

    </div>
  )
}