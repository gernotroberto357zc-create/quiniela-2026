import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const ADMIN_EMAIL = 'gernot_roberto357zc@hotmail.com'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [partidos, setPartidos] = useState([])
  const [misVotos, setMisVotos] = useState({}) // <-- Nuevo estado para guardar los votos
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [modoAdmin, setModoAdmin] = useState(false)
  const [vistaActiva, setVistaActiva] = useState('partidos') // 'partidos' o 'ranking'
  const [ranking, setRanking] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    getPartidos()
  }, [])

  // Cargar las predicciones del usuario cuando inicia sesión
  useEffect(() => {
    if (session) {
      getMisVotos()
    }
  }, [session])

  useEffect(() => {
    if (vistaActiva === 'ranking') {
      cargarRanking()
    }
  }, [vistaActiva, partidos])

  async function getPartidos() {
    const { data, error } = await supabase.from('partidos').select('*').order('fecha', { ascending: true })
    if (!error) setPartidos(data)
    setLoading(false)
  }

  // --- NUEVA FUNCIÓN: TRAER LOS VOTOS GUARDADOS ---
  async function getMisVotos() {
    const { data, error } = await supabase.from('pronosticos').select('partido_id, prediccion').eq('user_id', session.user.id)
    if (!error && data) {
      const votosObj = {}
      data.forEach(voto => { votosObj[voto.partido_id] = voto.prediccion })
      setMisVotos(votosObj)
    }
  }

  async function cargarRanking() {
    const { data, error } = await supabase.rpc('get_ranking')
    if (error) console.error("Error al cargar ranking:", error)
    else setRanking(data)
  }

  // --- LÓGICA DE TIEMPO Y BLOQUEO ---
  const partidoIniciado = (fecha) => {
    return new Date(fecha) < new Date();
  }

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- NUEVA FUNCIÓN: GUARDAR EL VOTO (CORREGIDA) ---
  async function handleVoto(partidoId, prediccion, fechaPartido) { // <-- ¡Aquí faltaba fechaPartido!
    // BARRERA: Si ya hay un voto para este partido, no hacemos nada
    if (misVotos[partidoId]) return;

    // BARRERA: No permitir votar si la fecha ya pasó
    if (partidoIniciado(fechaPartido)) {
      alert("¡Tiempo agotado! Este partido ya empezó o terminó.");
      return;
    }
    
    // 1. Actualizamos la pantalla
    setMisVotos(prev => ({ ...prev, [partidoId]: prediccion }))

    // 2. Guardamos en la base de datos usando 'insert' en vez de 'upsert'
    const { error } = await supabase
      .from('pronosticos')
      .insert({
        user_id: session.user.id,
        partido_id: partidoId,
        prediccion: prediccion
      })

    if (error) alert("Error al guardar tu voto: " + error.message)
  }
  // --- NUEVA FUNCIÓN: GUARDAR RESULTADO OFICIAL (SOLO ADMIN) ---
  async function handleResultadoOficial(partidoId, resultadoReal) {
    // 1. Actualizamos el estado local (pantalla)
    setPartidos(prev => prev.map(p => p.id === partidoId ? { ...p, resultado_real: resultadoReal } : p))

    // 2. Guardamos en la base de datos
    const { error } = await supabase.from('partidos').update({ resultado_real: resultadoReal }).eq('id', partidoId)
    if (error) alert("Error de Admin: " + error.message)
  }
  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert("Error al entrar: " + error.message)
  }

  // --- NUEVA LÓGICA DE REGISTRO CON NOMBRE ---
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!nombre) {
      alert("Por favor, escribe un Nombre o Alias antes de registrarte.")
      return
    }
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { nombre: nombre } // Aquí guardamos el alias en Supabase
      }
    })
    if (error) alert("Error al registrar: " + error.message)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
          <h1 className="text-2xl font-black mb-6 text-center text-blue-700">Quiniela 2026</h1>

          <input 
            type="text" 
            placeholder="Tu Nombre o Alias (Solo Registro)" 
            className="w-full mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200" 
            value={nombre} 
            onChange={(e) => setNombre(e.target.value)} 
          />

          <input
            type="email" placeholder="Tu correo"
            className="w-full mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Contraseña"
            className="w-full mb-6 p-3 rounded-lg bg-slate-50 border border-slate-200"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleLogin} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Entrar</button>
            <button onClick={handleRegister} className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-300">Registrarse</button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) return <div className="p-10 text-center font-bold text-slate-400">Cargando mundial...</div>

  const isAdmin = session.user.email === ADMIN_EMAIL;

  const boteAcumulado = ranking.length * 20;
  
  // Función auxiliar para pintar los botones de colores si están seleccionados
 const getButtonClass = (partidoId, valorBoton, fechaPartido) => {
    const votoRealizado = misVotos[partidoId];
    const isSelected = votoRealizado === valorBoton;
    const empezo = partidoIniciado(fechaPartido);

    if (isSelected) return 'w-10 h-10 shadow-sm rounded-md font-black bg-blue-600 text-white border-blue-600 border cursor-default';
    if (votoRealizado && !isSelected) return 'w-10 h-10 shadow-sm rounded-md font-black bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50';
    if (empezo && !isAdmin) return 'w-10 h-10 shadow-sm rounded-md font-black bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50';
    return 'w-10 h-10 shadow-sm rounded-md font-black bg-white text-slate-400 hover:bg-blue-100 hover:text-blue-600 border border-slate-100 transition-colors';
  }

  // Estilos especiales para los botones del Administrador
  const getAdminButtonClass = (resultadoOficial, valorBoton) => {
    return `w-10 h-10 shadow-sm rounded-md font-black transition-colors border ${resultadoOficial === valorBoton ? 'bg-green-500 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`;
  }

  const partidosPorGrupo = partidos.reduce((acc, p) => {
    const grupo = p.grupo || 'Fase de Grupos';
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(p);
    return acc;
  }, {});

  const nombreUsuario = session.user.user_metadata?.nombre || session.user.email;

return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-blue-700 uppercase">Quiniela 2026</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-red-500 hover:text-red-700">Cerrar Sesión</button>
        </div>
        
        {/* BLOQUE DE USUARIO Y BOTE DE PREMIOS */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <p className="text-slate-600">Jugador: <b className="text-slate-900">{nombreUsuario}</b></p>
            {isAdmin && vistaActiva === 'partidos' && (
              <button onClick={() => setModoAdmin(!modoAdmin)} className={`px-4 py-2 rounded font-bold text-sm transition-colors ${modoAdmin ? 'bg-red-100 text-red-700' : 'bg-slate-800 text-white'}`}>
                {modoAdmin ? 'Salir de Admin' : 'Panel Admin ⚙️'}
              </button>
            )}
          </div>

          
        </div>


        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200 mb-6">
          <button onClick={() => { setVistaActiva('partidos'); setModoAdmin(false); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${vistaActiva === 'partidos' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>⚽ Partidos</button>
          <button onClick={() => { setVistaActiva('ranking'); setModoAdmin(false); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${vistaActiva === 'ranking' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>🏆 Ranking</button>
        </div>

        {vistaActiva === 'ranking' && (
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-[2px] rounded-2xl shadow-lg">
            <div className="bg-white rounded-[14px] p-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-orange-600 uppercase tracking-widest">Bote Acumulado</p>
                <p className="text-3xl text-center font-black text-slate-800">{boteAcumulado}€</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase">Participantes</p>
                <p className="text-xl font-bold text-slate-600">{ranking.length}</p>
              </div>
            </div>
          </div>
            <div className="bg-blue-700 text-white p-4 font-black text-lg text-center uppercase tracking-widest">Tabla de Posiciones</div>
            <div className="p-0">
              {ranking.map((jugador, index) => (
                <div key={jugador.email} className={`flex justify-between items-center p-5 border-b border-slate-100 ${index === 0 ? 'bg-yellow-50/50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-xl w-6 text-center ${index === 0 ? 'text-yellow-500' : 'text-slate-400'}`}>{index + 1}</span>
                    <span className={`font-bold ${index === 0 ? 'text-yellow-700' : 'text-slate-700'}`}>{jugador.nombre}</span>
                  </div>
                  <span className="font-black text-blue-600 bg-blue-100 px-4 py-1.5 rounded-full text-sm">{jugador.puntos} pts</span>
                </div>
              ))}
              {ranking.length === 0 && <p className="text-center p-6 text-slate-400 font-medium">Nadie ha sumado puntos aún.</p>}
            </div>
          </div>
        )}

        {vistaActiva === 'partidos' && (
          <>
            {modoAdmin ? (
              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white">
                <h2 className="text-xl font-bold mb-4 text-green-400">⚠️ Fijar Resultados Oficiales</h2>
                {Object.entries(partidosPorGrupo).map(([grupo, lista]) => (
                  <div key={grupo} className="mb-8">
                    <h3 className="text-lg font-black text-slate-400 mb-3 uppercase tracking-wider">{grupo}</h3>
                    <div className="grid gap-4">
                      {lista.map((p) => (
                        <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-2">
                           <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest">{formatearFecha(p.fecha)}</div>
                           <div className="flex justify-between items-center">
                            <span className="font-bold w-24 text-right text-slate-200">{p.local}</span>
                            <div className="flex gap-2">
                              <button onClick={() => handleResultadoOficial(p.id, '1')} className={getAdminButtonClass(p.resultado_real, '1')}>1</button>
                              <button onClick={() => handleResultadoOficial(p.id, 'X')} className={getAdminButtonClass(p.resultado_real, 'X')}>X</button>
                              <button onClick={() => handleResultadoOficial(p.id, '2')} className={getAdminButtonClass(p.resultado_real, '2')}>2</button>
                            </div>
                            <span className="font-bold w-24 text-left text-slate-200">{p.visitante}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {Object.entries(partidosPorGrupo).map(([grupo, lista]) => (
                  <div key={grupo} className="mb-8">
                    <h3 className="text-sm font-black text-slate-700 mb-4 bg-slate-200 py-1.5 px-4 rounded-lg inline-block uppercase tracking-wider">{grupo}</h3>
                    <div className="grid gap-4">
                      {lista.map((p) => (
                        <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
                          
                          {/* ESTADO DEL PARTIDO: Finalizado, Cerrado o Fecha Abierta */}
                          {p.resultado_real ? (
                             <div className="text-center text-xs font-bold bg-green-100 text-green-700 py-1 rounded">FINALIZADO - Resultado: {p.resultado_real}</div>
                          ) : partidoIniciado(p.fecha) ? (
                             <div className="text-center text-xs font-bold bg-red-50 text-red-500 py-1 rounded">CERRADO - Esperando resultado</div>
                          ) : (
                             <div className="text-center text-xs font-bold bg-blue-50 text-blue-500 py-1 rounded uppercase tracking-widest">{formatearFecha(p.fecha)}</div>
                          )}

                          <div className="flex justify-between items-center">
                            <span className="font-bold w-24 text-right text-slate-700">{p.local}</span>
                            <div className="flex gap-2 bg-slate-50 p-1 rounded-lg">
                              <button onClick={() => handleVoto(p.id, '1', p.fecha)} className={getButtonClass(p.id, '1', p.fecha)}>1</button>
                              <button onClick={() => handleVoto(p.id, 'X', p.fecha)} className={getButtonClass(p.id, 'X', p.fecha)}>X</button>
                              <button onClick={() => handleVoto(p.id, '2', p.fecha)} className={getButtonClass(p.id, '2', p.fecha)}>2</button>
                            </div>
                            <span className="font-bold w-24 text-left text-slate-700">{p.visitante}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App