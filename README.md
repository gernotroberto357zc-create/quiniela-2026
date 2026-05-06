# 🏆 Quiniela Mundial 2026

Una aplicación web interactiva desarrollada en React para gestionar pronósticos deportivos entre amigos. Permite a los usuarios registrarse, predecir los resultados de los partidos (1, X, 2), competir en un ranking automatizado y visualizar un bote de premios acumulado.

## 🚀 Características Principales

*   **Autenticación de Usuarios:** Registro e inicio de sesión seguros con correo y alias.
*   **Gestión de Pronósticos:** Los usuarios pueden elegir y modificar sus predicciones hasta el pitido inicial.
*   **Sistema de Puntuación Dinámico:** Diferentes puntos otorgados según la fase del torneo (Grupos: 1 pt, Octavos: 3 pts, Final: 6 pts, etc.).
*   **Ranking Automatizado:** Tabla de clasificación en tiempo real calculada directamente en el servidor.
*   **Panel de Administración Integrado:** Vista exclusiva para que el administrador fije los resultados oficiales, actualizando el ranking al instante.
*   **Bote Acumulado:** Cálculo automático del premio total en función del número de participantes registrados (20€ por participante).

---

## 🛠️ Stack Tecnológico

### Frontend
*   **Librería:** [React.js](https://reactjs.org/) (Vite/Create React App)
*   **Estilos:** [Tailwind CSS](https://tailwindcss.com/) para un diseño responsivo, moderno y limpio (`bg-slate-50`, `shadow-sm`, animaciones condicionales).
*   **Iconografía:** Emojis nativos para optimizar la carga.

### Backend & Base de Datos
*   **Plataforma:** [Supabase](https://supabase.com/) (BaaS)
*   **Base de Datos:** PostgreSQL.
*   **Autenticación:** Supabase Auth (Email & Password).
*   **Consultas:** Uso de Remote Procedure Calls (RPC) mediante funciones de PostgreSQL (`get_ranking`) y operaciones `upsert`.

### Despliegue
*   **Hosting:** Vercel (CI/CD integrado desde GitHub).

---

## 🗄️ Estructura de la Base de Datos

El proyecto utiliza una estructura relacional optimizada:

1.  **`auth.users` (Supabase nativo):** Almacena de forma segura los correos, contraseñas encriptadas y metadatos (como el "Alias" o "Nombre" del jugador).
2.  **`partidos`:** Contiene la información de los encuentros (`id`, `local`, `visitante`, `fecha`, `grupo`, `fase`, `resultado_real`).
3.  **`pronosticos`:** Registra las apuestas de los usuarios (`user_id`, `partido_id`, `prediccion`). Protegido con una restricción `UNIQUE (user_id, partido_id)` para evitar duplicados.

---

## 🛡️ Seguridad y Análisis de Vulnerabilidades

Este proyecto cuenta con medidas de seguridad sólidas gracias a Supabase, pero al ser una versión MVP (Minimum Viable Product), presenta ciertas vulnerabilidades arquitectónicas que deben tenerse en cuenta para entornos de producción masivos.

### Fortalezas (Implementadas)
*   **Gestión de contraseñas:** Totalmente delegada a Supabase, evitando el almacenamiento en texto plano.
*   **Integridad de datos (SQL):** Uso de restricciones `UNIQUE` y operaciones `upsert` que evitan la corrupción de datos si un usuario hace spam de clics.
*   **Aislamiento del Ranking:** El cálculo de puntos se hace de forma segura en el servidor mediante SQL (`SECURITY DEFINER`), evitando que un usuario manipule su puntuación desde el navegador.

### Puntos de Mejora / Vulnerabilidades Conocidas
1.  **Validación del tiempo en el Cliente (Frontend):** 
    *   *Problema:* La lógica que bloquea las votaciones (`partidoIniciado`) se ejecuta en el navegador usando la hora del sistema del usuario (`new Date()`). Un usuario con conocimientos técnicos podría cambiar la hora de su ordenador para votar en un partido que ya ha terminado.
    *   *Solución futura:* Mover la validación del tiempo a Supabase usando *Row Level Security (RLS)* o un *Trigger* que compruebe la hora del servidor antes de aceptar un `INSERT` o `UPDATE`.
2.  **Autorización de Administrador Hardcodeada:**
    *   *Problema:* El acceso al panel de control se valida comparando el email del usuario con una constante en el frontend (`const ADMIN_EMAIL = ...`). Si bien no expone la base de datos a escritura (gracias a RLS), es una mala práctica exponer la lógica de roles en el cliente.
    *   *Solución futura:* Utilizar *Custom Claims* en el JWT de Supabase o crear una tabla de `roles` evaluada en el backend.

---

## 💻 Instalación y Uso Local

1. Clona este repositorio:
   ```bash
   git clone [https://github.com/TU_USUARIO/TU_REPOSITORIO.git](https://github.com/TU_USUARIO/TU_REPOSITORIO.git)



   Instala las dependencias:

Bash

npm install

Configura tus variables de entorno creando un archivo .env en la raíz con las credenciales de tu proyecto de Supabase:
Fragmento de código

VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima

Inicia el servidor de desarrollo:
Bash
npm run dev