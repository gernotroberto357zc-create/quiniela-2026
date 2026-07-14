import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// 1. CONFIGURACIÓN DE ADMINISTRADORES
const ADMIN_EMAIL = [ 
  'gernot_roberto357zc@hotmail.com', 
  'linserrebecca@gmail.com'
];

function App() {

  // 2. SISTEMA DE PUNTUACIONES
  const PUNTOS_POR_FASE = {
    'Grupos': 1,
    'Dieciseisavos': 2,
    'Octavos': 3,
    'Cuartos': 4,
    'Semifinal': 5,
    'Final': 6
  };

  // 3. FECHA LÍMITE GLOBAL (21:00 Hora Peninsular Española - 14 de Julio)
  const FECHA_LIMITE = new Date('2026-07-14T21:00:00+02:00');

  // 4. ESTADOS DE LA APLICACIÓN
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

  // 5. EFECTO: TEMPORIZADOR REGRESIVO
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

  // 6. EFECTO: AUTENTICACIÓN INICIAL
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

  // 7. EFECTO: CARGA DE VOTOS
  useEffect(() => {
    if (session) {
      getMisVotos()
    }
  }, [session])

  // 8. EFECTO: ACTUALIZACIÓN DE RANKING
  useEffect(() => {
    if (vistaActiva === 'ranking') {
      cargarRanking()
    }
  }, [vistaActiva, partidos])

  // 9. FUNCIONES DE BASE DE DATOS (SUPABASE)
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

  // 10. FUNCIONES AUXILIARES
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // 11. FUNCIÓN PRINCIPAL: VOTAR
  async function handleVoto(partidoId, prediccion) {
    if (votacionCerrada) {
      alert("¡Tiempo agotado! Las votaciones para esta fase se han cerrado a las 21:00h.");
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
    } else {
      getTodosLosVotos(); 
    }
  }

  // 12. FUNCIÓN ADMIN: GUARDAR RESULTADO OFICIAL
  async function handleResultadoOficial(partidoId, resultadoReal) {
    setPartidos(prev => prev.map(p => p.id === partidoId ? { ...p, resultado_real: resultadoReal } : p))

    const { error } = await supabase.from('partidos').update({ resultado_real: resultadoReal }).eq('id', partidoId)
    if (error) alert("Error de Admin: " + error.message)
  }

  // 13. FUNCIONES DE AUTENTICACIÓN
  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert("Error al entrar: " + error.message)
  }

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
        data: { nombre: nombre } 
      }
    })
    if (error) alert("Error al registrar: " + error.message)
  }

  // 14. PANTALLA DE LOGIN / REGISTRO
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-700 text-white">
          <div className="text-center mb-6">
            <span className="bg-red-500/20 text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-500/30">Semis VIP</span>
            <h1 className="text-3xl font-black mt-2 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 bg-clip-text text-transparent">Mundial 2026</h1>
          </div>

          <input
            type="text"
            placeholder="Tu Nombre o Alias (Solo Registro)"
            className="w-full mb-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <input
            type="email" placeholder="Tu correo"
            className="w-full mb-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Contraseña"
            className="w-full mb-6 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-3">
            <button onClick={handleLogin} className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black py-3.5 rounded-xl shadow-lg shadow-red-600/30 hover:brightness-110 transition-all">Entrar</button>
            <button onClick={handleRegister} className="flex-1 bg-slate-700/80 text-slate-300 font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-all">Registrarse</button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-black text-slate-500 text-lg">Cargando Arena de Semifinales...</div>

  // 15. VARIABLES GLOBALES DE LA INTERFAZ
  const isAdmin = ADMIN_EMAIL.includes(session.user.email);
  const listaRanking = ranking || [];
  const boteAcumulado = ranking.length * 20;

  // NUEVOS ESTILOS DE BOTONES MÁS ESPECTACULARES
  const getButtonClass = (partidoId, valorBoton) => {
    const votoRealizado = misVotos[partidoId];
    const isSelected = votoRealizado === valorBoton;
    const baseClass = 'relative flex-1 py-4 px-3 rounded-xl font-black text-sm sm:text-base transition-all duration-200 border flex flex-col items-center justify-center gap-1 overflow-hidden ';

    if (isSelected) return baseClass + 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-[1.02] z-10';
    if (votoRealizado && !isSelected) return baseClass + 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed opacity-50 scale-95';
    if (votacionCerrada && !isAdmin) return baseClass + 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-40';
    return baseClass + 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-500 hover:scale-[1.01] shadow-md';
  }

  const getAdminButtonClass = (resultadoOficial, valorBoton) => {
    const baseClass = 'flex-1 py-4 px-3 rounded-xl font-black text-sm sm:text-base transition-all border flex flex-col items-center justify-center ';
    return baseClass + (resultadoOficial === valorBoton ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800');
  }

  const nombreUsuario = session.user.user_metadata?.nombre || session.user.email;

  // 16. ESTRUCTURA VISUAL PRINCIPAL (TEMA OSCURO PREMIUM / ESTADIO)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 selection:bg-red-500 selection:text-white">
      <div className="max-w-2xl mx-auto">

        {/* Cabecera VIP */}
        <div className="flex justify-between items-center mb-6 bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🔥</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent uppercase tracking-wider">
                Mundial 2026
              </h1>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Fase: Semifinales (+5 Pts)</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-xs font-bold text-slate-400 hover:text-red-400 bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700/50 transition-colors">
            Salir
          </button>
        </div>

        {/* Panel de Jugador y Botón Admin */}
        <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 rounded-2xl shadow-md border border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 to-yellow-500 flex items-center justify-center font-black text-white shadow-inner">
              {nombreUsuario.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apostante registrado</p>
              <p className="font-extrabold text-white sm:text-lg leading-tight">{nombreUsuario}</p>
            </div>
          </div>
          {isAdmin && vistaActiva === 'partidos' && (
            <button onClick={() => setModoAdmin(!modoAdmin)} className={`px-4 py-2 rounded-xl font-extrabold text-xs transition-all shadow-lg ${modoAdmin ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>
              {modoAdmin ? '⚡ Modo Admin Activo' : '⚙️ Panel Admin'}
            </button>
          )}
        </div>

        {/* TEMPORIZADOR REGRESIVO ESTILO MARCADOR DE ESTADIO */}
        {vistaActiva === 'partidos' && (
          <div className={`mb-8 p-6 rounded-3xl text-center shadow-2xl border relative overflow-hidden transition-all duration-500 ${votacionCerrada ? 'bg-gradient-to-b from-red-950/80 to-slate-900 border-red-500/30 text-red-400' : 'bg-gradient-to-b from-slate-900 via-indigo-950/30 to-slate-900 border-indigo-500/30 text-white shadow-[0_0_30px_rgba(99,102,241,0.1)]'}`}>
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 mb-3 text-slate-300 shadow-sm">
              {votacionCerrada ? '🔒 Apuestas Bloqueadas' : '⏳ Cierre de pronósticos en'}
            </span>
            <p className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight font-mono drop-shadow-md">
              {tiempoRestante || '00:00:00'}
            </p>
            {!votacionCerrada && <p className="text-xs font-medium text-indigo-300/80 mt-2 flex items-center justify-center gap-1"><span>⚡</span> Hoy a las 21:00h (Hora España)</p>}
          </div>
        )}

        {/* Pestañas de navegación neón */}
        <div className="flex bg-slate-900/90 p-1.5 rounded-2xl shadow-inner border border-slate-800/80 mb-8">
          <button onClick={() => { setVistaActiva('partidos'); setModoAdmin(false); }} className={`flex-1 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${vistaActiva === 'partidos' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.01]' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>⚽ Semifinales</button>
          <button onClick={() => { setVistaActiva('ranking'); setModoAdmin(false); }} className={`flex-1 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${vistaActiva === 'ranking' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 scale-[1.01]' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>🏆 Ranking VIP</button>
        </div>

      {/* VISTA 1: RANKING ESTILO PODIUM */}
      {vistaActiva === 'ranking' && (
        <div className="bg-slate-900/80 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden backdrop-blur">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 p-[2px] rounded-t-3xl shadow-lg">
            <div className="bg-slate-950 p-6 flex justify-between items-center rounded-t-[22px]">
              <div>
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1"><span>💰</span> Bote Acumulado</p>
                <p className="text-4xl font-black text-white tracking-tight mt-0.5">{boteAcumulado}€</p>
              </div>
              <div className="text-right bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apostantes</p>
                <p className="text-2xl font-black text-indigo-400">{listaRanking.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900/90 p-4 border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-widest text-center">
            Clasificación General
          </div>

          <div className="divide-y divide-slate-800/60">
            {listaRanking.map((jugador, index) => {
              const isTop1 = index === 0;
              const isTop2 = index === 1;
              const isTop3 = index === 2;

              return (
                <div key={jugador.email || index} className={`flex justify-between items-center p-5 transition-colors ${isTop1 ? 'bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border-l-4 border-l-amber-500' : isTop2 ? 'bg-gradient-to-r from-slate-300/10 via-transparent to-transparent border-l-4 border-l-slate-300' : isTop3 ? 'bg-gradient-to-r from-amber-700/10 via-transparent to-transparent border-l-4 border-l-amber-700' : 'hover:bg-slate-850/50'}`}>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-lg w-7 h-7 rounded-full flex items-center justify-center ${isTop1 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : isTop2 ? 'bg-slate-300 text-slate-950 shadow-md' : isTop3 ? 'bg-amber-700 text-white shadow-md' : 'text-slate-500 bg-slate-800/80'}`}>
                      {index + 1}
                    </span>
                    <div>
                      <span className={`font-extrabold block text-sm sm:text-base ${isTop1 ? 'text-amber-400' : isTop2 ? 'text-slate-200' : isTop3 ? 'text-amber-500' : 'text-slate-300'}`}>
                        {jugador.nombre || jugador.email}
                      </span>
                      {isTop1 && <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">👑 Líder del torneo</span>}
                    </div>
                  </div>
                  <span className={`font-black px-4 py-2 rounded-xl text-sm border shadow-sm ${isTop1 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-indigo-400 border-slate-700'}`}>
                    {jugador.puntos || 0} pts
                  </span>
                </div>
              );
            })}
            {listaRanking.length === 0 && <p className="text-center p-8 text-slate-500 font-medium">Nadie ha sumado puntos aún.</p>}
          </div>
        </div>
      )}

        {/* VISTA 2: PARTIDOS ESTILO "ARENA SHOWDOWN" */}
        {vistaActiva === 'partidos' && (
          <div className="space-y-8">
            
            {['Semifinal'].map(faseActual => {
              const partidosFase = partidos.filter(p => p.fase === faseActual);
              if (partidosFase.length === 0) return null;

              return (
                <div key={faseActual} className="space-y-6">
                  
                  {partidosFase.map((p) => {
                    
                    const votosDeEstePartido = todosLosVotos.filter(v => v.partido_id === p.id);
                    const apostaronLocal = votosDeEstePartido.filter(v => v.prediccion === '1').map(v => v.nombre);
                    const apostaronVisitante = votosDeEstePartido.filter(v => v.prediccion === '2').map(v => v.nombre);

                    // CÁLCULO DE PORCENTAJES DE LA COMUNIDAD
                    const totalVotos = apostaronLocal.length + apostaronVisitante.length;
                    const porcLocal = totalVotos > 0 ? Math.round((apostaronLocal.length / totalVotos) * 100) : 50;
                    const porcVisitante = totalVotos > 0 ? 100 - porcLocal : 50;

                    return (
                      <div key={p.id} className={`${modoAdmin ? 'bg-slate-900 border-red-500/50' : 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-slate-800'} p-5 sm:p-6 rounded-3xl shadow-2xl border relative overflow-hidden transition-all`}>
                        
                        {/* Brillo de fondo sutil */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm"></div>

                        {/* Cabecera del partido */}
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
                          <span className="text-[11px] font-black tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">
                            🎟️ Billete a la Final
                          </span>
                          {p.resultado_real ? (
                            <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full shadow-sm animate-pulse">
                              FINALIZADO ({p.resultado_real === '1' ? p.local : p.visitante})
                            </span>
                          ) : votacionCerrada ? (
                            <span className="text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full">
                              🔒 CERRADO
                            </span>
                          ) : (
                            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                              🕒 {formatearFecha(p.fecha)}
                            </span>
                          )}
                        </div>

                        {/* BOTONES DE APUESTA CON INSIGNIA "VS" CENTRAL */}
                        <div className="relative flex gap-3 sm:gap-4 items-stretch mb-6">
                          
                          {/* Botón Equipo Local */}
                          <button
                            onClick={() => modoAdmin ? handleResultadoOficial(p.id, '1') : handleVoto(p.id, '1')}
                            className={modoAdmin ? getAdminButtonClass(p.resultado_real, '1') : getButtonClass(p.id, '1')}
                          >
                            <span className="text-xs font-bold uppercase tracking-wider opacity-60">Local</span>
                            <span className="text-lg sm:text-xl font-black text-center leading-tight">{p.local}</span>
                            {misVotos[p.id] === '1' && !modoAdmin && <span className="absolute top-2 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                          </button>

                          {/* Medallón "VS" en el medio */}
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-700 font-black text-xs text-slate-400 shadow-xl">
                            VS
                          </div>

                          {/* Botón Equipo Visitante */}
                          <button
                            onClick={() => modoAdmin ? handleResultadoOficial(p.id, '2') : handleVoto(p.id, '2')}
                            className={modoAdmin ? getAdminButtonClass(p.resultado_real, '2') : getButtonClass(p.id, '2')}
                          >
                            <span className="text-xs font-bold uppercase tracking-wider opacity-60">Visitante</span>
                            <span className="text-lg sm:text-xl font-black text-center leading-tight">{p.visitante}</span>
                            {misVotos[p.id] === '2' && !modoAdmin && <span className="absolute top-2 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                          </button>

                        </div>

                        {/* NUEVO: BARRA DE TENDENCIA DE APUESTAS EN TIEMPO REAL */}
                        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
                          <div className="flex justify-between text-xs font-extrabold">
                            <span className="text-blue-400 flex items-center gap-1">📊 {porcLocal}% <span className="text-slate-400 font-normal">({apostaronLocal.length})</span></span>
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] font-black">Tendencia del público</span>
                            <span className="text-indigo-400 flex items-center gap-1"><span className="text-slate-400 font-normal">({apostaronVisitante.length})</span> {porcVisitante}% 📈</span>
                          </div>

                          {/* Barra visual conectada */}
                          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-slate-700/50">
                            <div style={{ width: `${porcLocal}%` }} className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-l-full transition-all duration-500"></div>
                            <div style={{ width: `${porcVisitante}%` }} className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-r-full transition-all duration-500"></div>
                          </div>

                          {/* Nombres detallados bajo la barra */}
                          <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-1 text-xs">
                            {apostaronLocal.length > 0 && (
                              <p className="text-slate-400 leading-relaxed">
                                <span className="font-bold text-blue-400">{p.local}:</span> <span className="text-slate-300">{apostaronLocal.join(', ')}</span>
                              </p>
                            )}
                            {apostaronVisitante.length > 0 && (
                              <p className="text-slate-400 leading-relaxed">
                                <span className="font-bold text-indigo-400">{p.visitante}:</span> <span className="text-slate-300">{apostaronVisitante.join(', ')}</span>
                              </p>
                            )}
                            {totalVotos === 0 && (
                              <p className="text-slate-600 italic text-center py-1 font-medium">Se el primero en mojarte en esta semifinal...</p>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
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
