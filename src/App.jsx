import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// 1. CONFIGURACIÓN DE ADMINISTRADORES
// Lista de correos que tienen permisos para establecer los resultados oficiales.
const ADMIN_EMAIL = [ 
  'gernot_roberto357zc@hotmail.com', 
  'linserrebecca@gmail.com'
];

function App() {

  // 2. SISTEMA DE PUNTUACIONES
  // Define cuántos puntos vale acertar un partido en cada fase. (Dieciseisavos = 2 pts)
  const PUNTOS_POR_FASE = {
    'Grupos': 1,
    'Dieciseisavos': 2,
    'Octavos': 3,
    'Cuartos': 4,
    'Semifinal': 5,
    'Final': 6
  };

  // 3. FECHA LÍMITE GLOBAL (21:00 Hora Peninsular Española)
  // Utilizamos el formato ISO con el offset +02:00 correspondiente al horario de verano en España (CEST).
  const FECHA_LIMITE = new Date('2026-06-28T21:00:00+02:00');

  // 4. ESTADOS DE LA APLICACIÓN
  // Variables que guardan los datos y reaccionan a los cambios en la pantalla.
  const [session, setSession] = useState(null) // Sesión del usuario actual
  const [email, setEmail] = useState('') // Input de correo (Login/Registro)
  const [password, setPassword] = useState('') // Input de contraseña
  const [partidos, setPartidos] = useState([]) // Lista de partidos desde la base de datos
  const [misVotos, setMisVotos] = useState({}) // Diccionario con los votos del usuario actual
  const [loading, setLoading] = useState(true) // Pantalla de carga inicial
  const [nombre, setNombre] = useState('') // Input del alias del jugador
  const [modoAdmin, setModoAdmin] = useState(false) // Toggle para activar vista de administrador
  const [vistaActiva, setVistaActiva] = useState('partidos') // Alterna entre pestaña de partidos y ranking
  const [ranking, setRanking] = useState([]) // Lista de posiciones de los jugadores
  
  // Nuevos estados para el temporizador regresivo
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [votacionCerrada, setVotacionCerrada] = useState(false);

  // 5. EFECTO: TEMPORIZADOR REGRESIVO
  // Se ejecuta al cargar la app. Calcula cada segundo el tiempo que falta hasta las 21:00h.
  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date();
      const diferencia = FECHA_LIMITE - ahora;

      if (diferencia <= 0) {
        // Si el tiempo se agota, bloquea la votación y clava el reloj en cero.
        setTiempoRestante('00:00:00');
        setVotacionCerrada(true);
        clearInterval(intervalo);
      } else {
        // Convierte los milisegundos restantes a horas, minutos y segundos.
        const horas = Math.floor((diferencia / (1000 * 60 * 60)) % 24);
        const minutos = Math.floor((diferencia / 1000 / 60) % 60);
        const segundos = Math.floor((diferencia / 1000) % 60);
        setTiempoRestante(
          `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(intervalo); // Limpia el intervalo si cambias de pantalla
  }, []);

  // 6. EFECTO: AUTENTICACIÓN INICIAL
  // Comprueba si el usuario ya tiene la sesión iniciada al entrar a la web.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    getPartidos()
  }, [])

  // 7. EFECTO: CARGA DE VOTOS
  // Solo se ejecuta cuando detecta que hay un usuario logueado. Trae sus predicciones guardadas.
  useEffect(() => {
    if (session) {
      getMisVotos()
    }
  }, [session])

  // 8. EFECTO: ACTUALIZACIÓN DE RANKING
  // Se ejecuta cuando el usuario hace clic en la pestaña "Ranking".
  useEffect(() => {
    if (vistaActiva === 'ranking') {
      cargarRanking()
    }
  }, [vistaActiva, partidos])

  // 9. FUNCIONES DE BASE DE DATOS (SUPABASE)
  // Descarga todos los partidos ordenados por fecha.
  async function getPartidos() {
    const { data, error } = await supabase.from('partidos').select('*').order('fecha', { ascending: true })
    if (!error) setPartidos(data)
    setLoading(false)
  }

  // Descarga los votos del usuario activo y los formatea en un diccionario { id_partido: 'prediccion' }
  async function getMisVotos() {
    const { data, error } = await supabase.from('pronosticos').select('partido_id, prediccion').eq('user_id', session.user.id)
    if (!error && data) {
      const votosObj = {}
      data.forEach(voto => { votosObj[voto.partido_id] = voto.prediccion })
      setMisVotos(votosObj)
    }
  }

  // Llama al procedimiento almacenado 'get_ranking' en Supabase para calcular los puntos totales.
  async function cargarRanking() {
    const { data, error } = await supabase.rpc('get_ranking')
    if (error) console.error("Error al cargar ranking:", error)
    else setRanking(data)
  }

  // 10. FUNCIONES AUXILIARES
  // Convierte la fecha del partido a un formato legible en español.
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // 11. FUNCIÓN PRINCIPAL: VOTAR
  // Registra la predicción del usuario, siempre y cuando no haya pasado la hora límite.
  async function handleVoto(partidoId, prediccion) {
    if (votacionCerrada) {
      alert("¡Tiempo agotado! Las votaciones para esta fase se han cerrado a las 21:00h.");
      return;
    }

    // Actualiza la pantalla instantáneamente antes de guardar en la nube
    setMisVotos(prev => ({ ...prev, [partidoId]: prediccion }));

    // Guarda en Supabase usando 'upsert' (inserta si no existe, actualiza si ya existe)
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

  // 12. FUNCIÓN ADMIN: GUARDAR RESULTADO OFICIAL
  // Exclusiva para administradores. Marca el ganador real y actualiza la tabla de partidos.
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
  // Se muestra si 'session' es nulo.
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

  // Pantalla intermedia de carga mientras se bajan los datos de Supabase.
  if (loading) return <div className="p-10 text-center font-bold text-slate-400">Cargando mundial...</div>

  // 15. VARIABLES GLOBALES DE LA INTERFAZ
  const isAdmin = ADMIN_EMAIL.includes(session.user.email);
  const listaRanking = ranking || [];
  const boteAcumulado = ranking.length * 20;

  // Calcula las clases y colores para los botones de votación (Seleccionado, bloqueado o disponible)
  const getButtonClass = (partidoId, valorBoton) => {
    const votoRealizado = misVotos[partidoId];
    const isSelected = votoRealizado === valorBoton;
    const baseClass = 'flex-1 py-3 px-2 shadow-sm rounded-lg font-bold text-xs sm:text-sm transition-all border leading-tight ';

    if (isSelected) return baseClass + 'bg-blue-600 text-white border-blue-600 cursor-default ring-2 ring-blue-600/30';
    if (votoRealizado && !isSelected) return baseClass + 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60';
    if (votacionCerrada && !isAdmin) return baseClass + 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60';
    return baseClass + 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-slate-200';
  }

  // Colores para los botones del modo administrador
  const getAdminButtonClass = (resultadoOficial, valorBoton) => {
    const baseClass = 'flex-1 py-3 px-2 shadow-sm rounded-lg font-bold text-xs sm:text-sm transition-all border leading-tight ';
    return baseClass + (resultadoOficial === valorBoton ? 'bg-green-500 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700');
  }

  const nombreUsuario = session.user.user_metadata?.nombre || session.user.email;

  // 16. ESTRUCTURA VISUAL PRINCIPAL (HTML/JSX)
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Cabecera superior */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-blue-700 uppercase">Mundial 2026(dejen de llorar)</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-red-500 hover:text-red-700">Cerrar Sesión</button>
        </div>

        {/* Panel de Jugador y Botón Admin */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <p className="text-slate-600">Jugador: <b className="text-slate-900">{nombreUsuario}</b></p>
            {isAdmin && vistaActiva === 'partidos' && (
              <button onClick={() => setModoAdmin(!modoAdmin)} className={`px-4 py-2 rounded font-bold text-sm transition-colors ${modoAdmin ? 'bg-red-100 text-red-700' : 'bg-slate-800 text-white'}`}>
                {modoAdmin ? 'Salir de Admin' : 'Panel Admin ⚙️'}
              </button>
            )}
          </div>
        </div>

        {/* NUEVO: TEMPORIZADOR REGRESIVO */}
        {vistaActiva === 'partidos' && (
          <div className={`mb-6 p-4 rounded-xl text-center shadow-sm border ${votacionCerrada ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-800 border-slate-900 text-white'}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">
              {votacionCerrada ? 'Votaciones Finalizadas' : 'Tiempo límite de votación'}
            </p>
            <p className="text-3xl font-black tabular-nums tracking-wider">
              {tiempoRestante || '00:00:00'}
            </p>
            {!votacionCerrada && <p className="text-[10px] mt-1 opacity-70">Hoy a las 21:00h (Hora España)</p>}
          </div>
        )}

        {/* Pestañas de navegación */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200 mb-6">
          <button onClick={() => { setVistaActiva('partidos'); setModoAdmin(false); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${vistaActiva === 'partidos' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>⚽ Partidos</button>
          <button onClick={() => { setVistaActiva('ranking'); setModoAdmin(false); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${vistaActiva === 'ranking' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>🏆 Ranking</button>
        </div>

      {/* VISTA 1: RANKING */}
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

        {/* VISTA 2: PARTIDOS */}
        {vistaActiva === 'partidos' && (
          <div className="space-y-12">
            
            {/* Solo mapeamos y mostramos la fase de 'Dieciseisavos' temporalmente */}
            {['Dieciseisavos'].map(faseActual => {
              const partidosFase = partidos.filter(p => p.fase === faseActual);
              if (partidosFase.length === 0) return null;

              return (
                <div key={faseActual} className="animate-fade-in">
                  <div className="flex justify-between items-center mb-4 border-b-2 border-blue-100 pb-2">
                    <h2 className="text-xl font-black text-blue-900 uppercase tracking-wider">
                      🏆 {faseActual}
                    </h2>
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase">
                      +{PUNTOS_POR_FASE[faseActual]} pts / acierto
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {partidosFase.map((p) => (
                      <div key={p.id} className={`${modoAdmin ? 'bg-slate-900 text-white' : 'bg-white'} p-4 rounded-xl shadow-sm border ${modoAdmin ? 'border-slate-700' : 'border-slate-100'} flex flex-col gap-3`}>

                        {/* Cabecera de la tarjeta del partido */}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avanza a Octavos</span>
                          {p.resultado_real ? (
                            <div className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">FINALIZADO ({p.resultado_real})</div>
                          ) : votacionCerrada ? (
                            <div className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded">CERRADO</div>
                          ) : (
                            <div className="text-[10px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded uppercase">{formatearFecha(p.fecha)}</div>
                          )}
                        </div>

                        {/* DISEÑO ELIMINATORIAS: 2 Botones (Sin opción de empate) */}
                        <div className={`flex w-full gap-2 p-1.5 rounded-xl ${modoAdmin ? 'bg-slate-800' : 'bg-slate-100/80'}`}>
                          {[
                            { valor: '1', etiqueta: p.local },
                            { valor: '2', etiqueta: p.visitante } // El empate ('X') ha sido eliminado
                          ].map((opcion) => (
                            <button
                              key={opcion.valor}
                              onClick={() => modoAdmin ? handleResultadoOficial(p.id, opcion.valor) : handleVoto(p.id, opcion.valor)}
                              className={modoAdmin ? getAdminButtonClass(p.resultado_real, opcion.valor) : getButtonClass(p.id, opcion.valor)}
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
