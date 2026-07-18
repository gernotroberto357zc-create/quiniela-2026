import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const ADMIN_EMAIL = [ 
  'gernot_roberto357zc@hotmail.com', 
  'linserrebecca@gmail.com'
];

function App() {

  const PUNTOS_POR_FASE = {
    'Grupos': 1,
    'Dieciseisavos': 2,
    'Octavos': 3,
    'Cuartos': 4,
    'Semifinal': 5,
    'TercerLugar': 6,
    'Final': 7
  };

  const FECHA_LIMITE = new Date('2026-07-18T21:00:00+02:00');

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
  
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [votacionCerrada, setVotacionCerrada] = useState(false);
  const [todosLosVotos, setTodosLosVotos] = useState([]); 

  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date();
      const diferencia = FECHA_LIMITE - ahora;

      if (diferencia <= 0) {
        setTiempoRestante('00:00:00');
        setVotacionCerrada(true);
        clearInterval(intervalo);
      } else {
        const horas = Math.floor((diferencia / (1000 * 60 * 60)) % 24);
        const minutos = Math.floor((diferencia / 1000 / 60) % 60);
        const segundos = Math.floor((diferencia / 1000) % 60);
        setTiempoRestante(
          `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    getPartidos()
    getTodosLosVotos() 
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

  async function getTodosLosVotos() {
    const { data, error } = await supabase.rpc('get_votos_detallados')
    if (!error && data) {
      setTodosLosVotos(data)
    }
  }

  async function cargarRanking() {
    const { data, error } = await supabase.rpc('get_ranking')
    if (error) console.error("Error al cargar ranking:", error)
    else setRanking(data)
  }

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function handleVoto(partidoId, prediccion) {
    if (votacionCerrada) {
      alert("¡Tiempo agotado! Las votaciones se han cerrado.");
      return;
    }
    setMisVotos(prev => ({ ...prev, [partidoId]: prediccion }));
    const { error } = await supabase
      .from('pronosticos')
      .upsert({ user_id: session.user.id, partido_id: partidoId, prediccion: prediccion }, { onConflict: 'user_id, partido_id' });
    if (error) alert("Error al guardar: " + error.message);
    else getTodosLosVotos();
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
    if (!nombre) { alert("Escribe un Nombre antes."); return; }
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { nombre: nombre } } })
    if (error) alert("Error al registrar: " + error.message)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-700 text-white">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black mt-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Mundial 2026</h1>
          </div>
          <input type="text" placeholder="Alias" className="w-full mb-4 p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input type="email" placeholder="Correo" className="w-full mb-4 p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full mb-6 p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-3">
            <button onClick={handleLogin} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black py-3.5 rounded-xl">Entrar</button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-black text-slate-500">Cargando...</div>

  const isAdmin = ADMIN_EMAIL.includes(session.user.email);
  const listaRanking = ranking || [];
  const boteAcumulado = listaRanking.length * 20;

  const getButtonClass = (partidoId, valorBoton) => {
    const votoRealizado = misVotos[partidoId];
    const isSelected = votoRealizado === valorBoton;
    const baseClass = 'relative flex-1 py-4 px-3 rounded-xl font-black text-sm transition-all border flex flex-col items-center justify-center ';
    if (isSelected) return baseClass + 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400 shadow-xl';
    if (votoRealizado && !isSelected) return baseClass + 'bg-slate-800/60 text-slate-500 border-slate-800 opacity-50';
    if (votacionCerrada && !isAdmin) return baseClass + 'bg-slate-900/60 text-slate-600 border-slate-800 opacity-40';
    return baseClass + 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700';
  }

  const getAdminButtonClass = (resultadoOficial, valorBoton) => {
    return `flex-1 py-4 px-3 rounded-xl font-black ${resultadoOficial === valorBoton ? 'bg-green-600 text-white' : 'bg-slate-900 text-slate-400'}`;
  }

  const nombreUsuario = session.user.user_metadata?.nombre || session.user.email;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 selection:bg-amber-500 selection:text-white">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-4 rounded-2xl shadow-xl">
          <h1 className="text-xl font-black uppercase text-amber-500">Mundial 2026</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-xs font-bold text-slate-400">Salir</button>
        </div>

        {vistaActiva === 'partidos' && (
          <div className="mb-8 p-6 rounded-3xl text-center bg-slate-900 border border-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cierre de pronósticos</p>
            <p className="text-4xl font-black mt-2 font-mono">{tiempoRestante}</p>
          </div>
        )}

        <div className="flex bg-slate-900 p-1.5 rounded-2xl mb-8">
          <button onClick={() => setVistaActiva('partidos')} className={`flex-1 py-3 rounded-xl font-bold ${vistaActiva === 'partidos' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>⚽ 3º y 4º Puesto</button>
          <button onClick={() => setVistaActiva('ranking')} className={`flex-1 py-3 rounded-xl font-bold ${vistaActiva === 'ranking' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>🏆 Ranking</button>
        </div>

        {vistaActiva === 'ranking' && (
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
            {listaRanking.map((j, i) => (
              <div key={i} className="flex justify-between p-5 border-b border-slate-800">
                <span className="font-bold">{i + 1}. {j.nombre || j.email}</span>
                <span className="font-black text-amber-500">{j.puntos} pts</span>
              </div>
            ))}
          </div>
        )}

        {vistaActiva === 'partidos' && (
          <div className="space-y-6">
            {['TercerLugar'].map(fase => {
              const partidosFase = partidos.filter(p => p.fase === fase);
              return partidosFase.map((p) => {
                const votosPartido = todosLosVotos.filter(v => v.partido_id === p.id);
                const local = votosPartido.filter(v => v.prediccion === '1').map(v => v.nombre);
                const visitante = votosPartido.filter(v => v.prediccion === '2').map(v => v.nombre);
                
                return (
                  <div key={p.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                    <div className="flex justify-between mb-4 text-xs font-bold text-slate-500 uppercase">{p.local} vs {p.visitante}</div>
                    <div className="flex gap-3 mb-4">
                      <button onClick={() => modoAdmin ? handleResultadoOficial(p.id, '1') : handleVoto(p.id, '1')} className={modoAdmin ? getAdminButtonClass(p.resultado_real, '1') : getButtonClass(p.id, '1')}>{p.local}</button>
                      <button onClick={() => modoAdmin ? handleResultadoOficial(p.id, '2') : handleVoto(p.id, '2')} className={modoAdmin ? getAdminButtonClass(p.resultado_real, '2') : getButtonClass(p.id, '2')}>{p.visitante}</button>
                    </div>
                    <div className="text-[10px] text-slate-400 space-y-1">
                      <p>🔹 {p.local}: {local.join(', ')}</p>
                      <p>🔹 {p.visitante}: {visitante.join(', ')}</p>
                    </div>
                  </div>
                )
              })
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
