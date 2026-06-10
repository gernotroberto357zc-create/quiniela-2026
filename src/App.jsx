import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const ADMIN_EMAIL = 'gernot_roberto357zc@hotmail.com'

function App() {

  const PUNTOS_POR_FASE = {
    'Grupos': 1,
    'Dieciseisavos': 2,
    'Octavos': 3,
    'Cuartos': 4,
    'Semifinal': 5,
    'Final': 6
  };

  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [partidos, setPartidos] = useState([])
  const [misVotos, setMisVotos] = useState({}) 
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [modoAdmin, setModoAdmin] = useState(false)
  const [vistaActiva, setVistaActiva] = useState('partidos') 
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

  const partidoIniciado = (fecha) => {
    return new Date(fecha) < new Date();
  }

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function handleVoto(partidoId, prediccion, fechaPartido) {
    if (partidoIniciado(fechaPartido)) {
      alert("¡Tiempo agotado! Este partido ya empezó o terminó.");
      return;
    }

    setMisVotos(prev => ({ ...prev, [partidoId]: prediccion }));

    const { error } = await supabase
      .from('pronosticos')
      .upsert({
        user_id: session.user.id,
        partido_id: partidoId,
        prediccion: prediccion
      }, {
        onConflict: 'user_id, partido_id'
      });

    if (error) {
      console.error("Error al guardar:", error.message);
      alert("Error al guardar tu voto: " + error.message);
    }
  }

  async function handleResultadoOficial(partidoId, resultadoReal) {
    setPartidos(prev => prev.map(p => p.id === partidoId ? { ...p, resultado_real: resultadoReal } : p))

    const { error } = await supabase.from('partidos').update({ resultado_real: resultadoReal }).eq('id', partidoId)
    if (error) alert("Error de Admin: " + error.message)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert("Error al entrar: " + error.message)
  }

  const handleRegister = async (e) => {
    e.preventDefault()

    const FECHA_INICIO = new Date('2026-06-11T19:00:00');
    if (new Date() >= FECHA_INICIO) {
      alert("¡Inscripciones cerradas! El Mundial ya ha comenzado y no se admiten nuevos jugadores.");
      return; 
    }
    
    if (!nombre) {
      alert("Por favor, escribe un Nombre o Alias antes de registrarte.")
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: nombre } 
      }
    })
    if (error) alert("Error al registrar: " + error.message)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
          <h1 className="text-2xl font-black mb-6 text-center text-blue-700">Mundial 2026</h1>

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

  const listaRanking = ranking || [];
  const boteAcumulado = ranking.length * 20;

  // NUEVO DISEÑO DE BOTONES MÁS ANCHOS PARA ACOMODAR NOMBRES DE EQUIPOS
  const getButtonClass = (partidoId, valorBoton, fechaPartido) => {
    const votoRealizado = misVotos[partidoId];
    const isSelected = votoRealizado === valorBoton;
    const empezo = partidoIniciado(fechaPartido);
    const baseClass = 'flex-1 py-3 px-2 shadow-sm rounded-lg font-bold text-xs sm:text-sm transition-all border leading-tight ';

    if (isSelected) return baseClass + 'bg-blue-600 text-white border-blue-600 cursor-default ring-2 ring-blue-600/30';
    if (votoRealizado && !isSelected) return baseClass + 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60';
    if (empezo && !isAdmin) return baseClass + 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60';
    return baseClass + 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-slate-200';
  }

  const getAdminButtonClass = (resultadoOficial, valorBoton) => {
    const baseClass = 'flex-1 py-3 px-2 shadow-sm rounded-lg font-bold text-xs sm:text-sm transition-all border leading-tight ';
    return baseClass + (resultadoOficial === valorBoton ? 'bg-green-500 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700');
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
          <h1 className="text-3xl font-black text-blue-700 uppercase">Mundial 2026</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-red-500 hover:text-red-700">Cerrar Sesión</button>
        </div>

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
                <p className="text-3xl font-black text-slate-800">{boteAcumulado}€</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase">Participantes</p>
                <p className="text-xl font-bold text-slate-600">{listaRanking.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-700 text-white p-4 font-black text-lg text-center uppercase tracking-widest">Tabla de Posiciones</div>
          <div className="p-0">
            {listaRanking.map((jugador, index) => (
              <div key={jugador.email || index} className={`flex justify-between items-center p-5 border-b border-slate-100 ${index === 0 ? 'bg-yellow-50/50' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-xl w-6 text-center ${index === 0 ? 'text-yellow-500' : 'text-slate-400'}`}>{index + 1}</span>
                  <span className={`font-bold ${index === 0 ? 'text-yellow-700' : 'text-slate-700'}`}>{jugador.nombre || jugador.email}</span>
                </div>
                <span className="font-black text-blue-600 bg-blue-100 px-4 py-1.5 rounded-full text-sm">{jugador.puntos || 0} pts</span>
              </div>
            ))}
            {listaRanking.length === 0 && <p className="text-center p-6 text-slate-400 font-medium">Nadie ha sumado puntos aún.</p>}
          </div>
        </div>
      )}

        {vistaActiva === 'partidos' && (
          <div className="space-y-12">
            {['Grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'].map(faseActual => {
              const partidosFase = partidos.filter(p => p.fase === faseActual);
              if (partidosFase.length === 0) return null;

              return (
                <div key={faseActual} className="animate-fade-in">
                  <div className="flex justify-between items-center mb-4 border-b-2 border-blue-100 pb-2">
                    <h2 className="text-xl font-black text-blue-900 uppercase tracking-wider">
                      {faseActual === 'Grupos' ? '⚽ Fase de Grupos' : `🏆 ${faseActual}`}
                    </h2>
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase">
                      +{PUNTOS_POR_FASE[faseActual]} pts / acierto
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {partidosFase.map((p) => (
                      <div key={p.id} className={`${modoAdmin ? 'bg-slate-900 text-white' : 'bg-white'} p-4 rounded-xl shadow-sm border ${modoAdmin ? 'border-slate-700' : 'border-slate-100'} flex flex-col gap-3`}>

                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.grupo}</span>
                          {p.resultado_real ? (
                            <div className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">FINALIZADO ({p.resultado_real})</div>
                          ) : partidoIniciado(p.fecha) ? (
                            <div className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded">CERRADO</div>
                          ) : (
                            <div className="text-[10px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded uppercase">{formatearFecha(p.fecha)}</div>
                          )}
                        </div>

                        {/* NUEVO DISEÑO: Botones anchos con los nombres directamente */}
                        <div className={`flex w-full gap-2 p-1.5 rounded-xl ${modoAdmin ? 'bg-slate-800' : 'bg-slate-100/80'}`}>
                          {[
                            { valor: '1', etiqueta: p.local },
                            { valor: 'X', etiqueta: 'Empate' },
                            { valor: '2', etiqueta: p.visitante }
                          ].map((opcion) => (
                            <button
                              key={opcion.valor}
                              onClick={() => modoAdmin ? handleResultadoOficial(p.id, opcion.valor) : handleVoto(p.id, opcion.valor, p.fecha)}
                              className={modoAdmin ? getAdminButtonClass(p.resultado_real, opcion.valor) : getButtonClass(p.id, opcion.valor, p.fecha)}
                            >
                              {opcion.etiqueta}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
