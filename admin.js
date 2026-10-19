// =====================================================================
//  LUMIQ - Panel de administracion (100% Supabase, cero Firebase)
//  Solo entra la cuenta limberhuaychoquispe81@gmail.com.
//  Sesion: Google via Supabase Auth -> OAuth.
// =====================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://zclgybzeuftutfrqtwax.supabase.co";
const SUPABASE_KEY = "sb_publishable_D-PnZxY4a5X37WoDO-_Lhw_HiH1L60z";

// Correo del unico administrador. Cualquier otra cuenta que entre con
// Google se cierra de inmediato.
const ADMIN = "limberhuaychoquispe81@gmail.com";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

/** Deja solo digitos, sin signos. */
function soloDigitos(v) {
  return (v || "").replace(/\D/g, "");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/** Convierte epoch ms a fecha legible. */
function fecha(ms) {
  if (!ms) return "-";
  const d = new Date(typeof ms === "number" ? ms : Date.parse(ms));
  if (isNaN(d)) return "-";
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

/** Centavos -> Bs 12,34 */
function bs(centavos) {
  const n = Number(centavos || 0);
  return "Bs " + (n / 100).toFixed(2).replace(".", ",");
}

function aviso(texto, malo = false) {
  const el = document.getElementById("msgLogin");
  if (!el) return;
  el.textContent = texto;
  el.style.color = malo ? "#FF8080" : "#39FF6A";
}

/** Cuenta regresiva de caducidad (10 min) para un codigo. */
function restante(expira) {
  const s = Math.max(0, Math.floor((Number(expira) - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Renderiza una tabla HTML basica desde filas de strings. */
function tabla(cont, cabeceras, filas) {
  cont.innerHTML = filas.length
    ? `<table><thead><tr>${cabeceras.map(c => `<th>${c}</th>`).join("")}</tr></thead>
       <tbody>${filas.join("")}</tbody></table>`
    : '<div class="vacio">Todavia no hay nada aqui.</div>';
}

// ---------------------------------------------------------------------
// Modo letra grande: 3 tamanos (se guarda en el navegador)
// ---------------------------------------------------------------------

const TAMANOS = [
  { px: "18px", nombre: "normal" },
  { px: "21px", nombre: "grande" },
  { px: "25px", nombre: "muy grande" }
];
let indiceTamano = parseInt(localStorage.getItem("lumiq_tamano") || "0", 10);

function aplicarTamano() {
  const t = TAMANOS[indiceTamano] || TAMANOS[0];
  document.documentElement.style.setProperty("--base", t.px);
  const b = document.getElementById("btnTamano");
  if (b) b.textContent = "Letra: " + t.nombre;
  localStorage.setItem("lumiq_tamano", indiceTamano);
}

document.getElementById("btnTamano").onclick = () => {
  indiceTamano = (indiceTamano + 1) % TAMANOS.length;
  aplicarTamano();
};

// ---------------------------------------------------------------------
// Carga perezosa: cada vista se rellena cuando se abre
// ---------------------------------------------------------------------

const CARGADORES = {};   // { inicio: async fn, codigos: async fn, ... }

async function verVista(nombre) {
  document.querySelectorAll("#menu button").forEach(b =>
    b.classList.toggle("on", b.dataset.vista === nombre));
  document.querySelectorAll(".vista").forEach(v =>
    v.classList.toggle("oculto", v.id !== "vista-" + nombre));
  const fn = CARGADORES[nombre];
  if (fn) { try { await fn(); } catch (e) { console.error(nombre, e); } }
}

document.getElementById("menu").onclick = e => {
  const b = e.target.closest("button[data-vista]");
  if (b) verVista(b.dataset.vista);
};

// ---------------------------------------------------------------------
// Sesion: Google o correo+contrasena con Supabase Auth.
// Solo cuentas administrativas (verificadas) abren el panel.
// ---------------------------------------------------------------------

/** Pregunta a Supabase si la sesion actual es admin (RPC es_admin). */
async function esAdminActual() {
  try {
    const { data, error } = await db.rpc("es_admin");
    return !error && data === true;
  } catch (_) { return false; }
}

document.getElementById("btnGoogle").onclick = async () => {
  aviso("Abriendo Google...");
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) aviso("No se pudo abrir Google: " + error.message, true);
};

// Entrar con correo y contrasena (sin codigos ni numeros de telefono).
document.getElementById("btnEntrarClave").onclick = async () => {
  const correo = document.getElementById("loginCorreo").value.trim();
  const clave = document.getElementById("loginClave").value;
  if (!correo || !clave) { aviso("Escribe el correo y la contrasena.", true); return; }
  aviso("Entrando...");
  const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
  if (error) aviso("No se pudo entrar: " + error.message, true);
};

document.getElementById("btnSalir").onclick = async () => {
  await db.auth.signOut();
  document.getElementById("panel").classList.add("oculto");
  document.getElementById("login").classList.remove("oculto");
  document.getElementById("selloAdmin").classList.add("oculto");
  aviso("");
};

function abrirPanel(usuario) {
  document.getElementById("login").classList.add("oculto");
  document.getElementById("panel").classList.remove("oculto");
  document.getElementById("correoAdmin").textContent = usuario.email || ADMIN;
  // Logo de verificado: solo se muestra si el servidor confirma que es admin.
  esAdminActual().then(ok =>
    document.getElementById("selloAdmin").classList.toggle("oculto", !ok));
  CARGADORES.inicio && verVista("inicio");
  arrancarRefresco();
}

db.auth.onAuthStateChange(async (_evento, sesion) => {
  const u = sesion && sesion.user;
  if (!u) return;   // sin sesion: se queda en el login
  const correo = (u.email || "").toLowerCase();
  const adminPorCorreo = correo === ADMIN.toLowerCase();
  const adminPorRol = await esAdminActual();
  if (adminPorCorreo || adminPorRol) {
    await db.rpc("registrar_auditoria", {
      p_accion: "login_panel", p_tabla: "auth", p_registro_id: u.id
    }).catch(() => {});
    abrirPanel(u);
  } else {
    aviso("Esa cuenta no tiene permisos de administrador. Saliendo...", true);
    await db.auth.signOut();
  }
});

// ---------------------------------------------------------------------
// Refresco automatico de la vista abierta (cada 20 s)
// ---------------------------------------------------------------------

let refresco = null;

function arrancarRefresco() {
  if (refresco) return;
  refresco = setInterval(() => {
    const activo = document.querySelector("#menu button.on");
    if (activo) {
      const fn = CARGADORES[activo.dataset.vista];
      if (fn) fn().catch(() => {});
    }
  }, 20000);
}

// ---------------------------------------------------------------------
// INICIO: contadores del panel
// ---------------------------------------------------------------------

/** Cuenta filas de una tabla (head count: no trae datos). */
async function contar(tabla) {
  const { count, error } = await db
    .from(tabla).select("*", { count: "exact", head: true });
  return error ? "-" : (count ?? 0);
}

CARGADORES.inicio = async () => {
  const hace7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [usu, cod, msg, conv, rep, prod, ped, sal] = await Promise.all([
    contar("usuarios"),
    db.from("codigos").select("codigo", { count: "exact", head: true })
      .eq("usado", false).gt("expira", Date.now()),
    db.from("mensajes").select("*", { count: "exact", head: true }).gt("creado", hace7d),
    contar("conversaciones"), contar("reportes"), contar("productos"),
    contar("pedidos"), db.from("saldos").select("saldo")
  ]);

  document.getElementById("stUsuarios").textContent = usu;
  document.getElementById("stCodigos").textContent = cod.count ?? "-";
  document.getElementById("stMensajes").textContent = msg.count ?? "-";
  document.getElementById("stConversaciones").textContent = conv;
  document.getElementById("stReportes").textContent = rep;
  document.getElementById("stProductos").textContent = prod;
  document.getElementById("stPedidos").textContent = ped;

  const total = (sal.data || []).reduce((a, f) => a + Number(f.saldo || 0), 0);
  document.getElementById("stSaldoTotal").textContent = bs(total);

  const cfg = await db.from("config").select("valor").eq("clave", "general").maybeSingle();
  const v = (cfg.data && cfg.data.valor) || {};
  document.getElementById("infoMantenimiento").textContent =
    (v.mantenimiento ? "MANTENIMIENTO ACTIVO. " : "") +
    (v.aviso ? "Aviso: " + v.aviso + " · " : "") +
    (v.version_app ? "Version de la app: " + v.version_app : "");
};

document.getElementById("btnRefrescar").onclick = () => CARGADORES.inicio();

// ---------------------------------------------------------------------
// CODIGOS DE 6 DIGITOS
//  - Generar: RPC crear_codigo(p_desde_panel = true) -> devuelve el codigo.
//  - Listado: tabla codigos (el panel SI la puede leer; la app no).
// ---------------------------------------------------------------------

document.getElementById("btnGenerar").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numCodigo").value);
  const nombre = document.getElementById("nombreCodigo").value.trim();
  const cont = document.getElementById("resultado");
  if (numero.length < 8) {
    cont.innerHTML = '<span class="chip no">Escribe un numero valido</span>';
    return;
  }
  const btn = document.getElementById("btnGenerar");
  btn.disabled = true;
  try {
    const { data, error } = await db.rpc("crear_codigo", {
      p_numero: numero, p_nombre: nombre || null, p_desde_panel: true
    });
    if (error) throw error;
    cont.innerHTML = `
      <div class="card" style="margin:0">
        <div class="codigo">${escapeHtml(data.codigo)}</div>
        <p class="info">
          Numero +${escapeHtml(data.numero)} · caduca en
          <b id="relojCodigo">${restante(data.expira)}</b> · usado una sola vez.
        </p>
        <div class="acciones" style="margin-top:10px">
          <button class="sec" id="btnCopiar">Copiar codigo</button>
        </div>
      </div>`;
    document.getElementById("btnCopiar").onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(data.codigo);
    };
    setInterval(() => {
      const el = document.getElementById("relojCodigo");
      if (el) el.textContent = restante(data.expira);
    }, 1000);
    CARGADORES.codigos();
    db.rpc("registrar_auditoria", {
      p_accion: "generar_codigo_panel", p_tabla: "codigos", p_registro_id: numero
    }).catch(() => {});
  } catch (e) {
    cont.innerHTML = `<span class="chip no">${escapeHtml(e.message || e)}</span>`;
  } finally {
    btn.disabled = false;
  }
};

CARGADORES.codigos = async () => {
  const cont = document.getElementById("tablaSolicitudes");
  const { data, error } = await db
    .from("codigos").select("*").order("actualizado", { ascending: false }).limit(50);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const ahora = Date.now();
  const filas = (data || []).map(c => {
    const vivo = Number(c.expira) > ahora && !c.usado;
    return `<tr>
      <td>+${escapeHtml(c.numero)}</td>
      <td>${escapeHtml(c.nombre || "-")}</td>
      <td><span class="codigo" style="font-size:1.05rem">${escapeHtml(c.codigo)}</span></td>
      <td>${c.usado ? '<span class="chip no">usado</span>'
            : vivo ? `<span class="chip ok">vivo ${restante(c.expira)}</span>`
                   : '<span class="chip pend">caducado</span>'}</td>
      <td>${escapeHtml(c.generado_por)}</td>
      <td>${fecha(c.actualizado)}</td>
      <td class="acciones">
        <button class="sec" onclick="reenviarCodigo('${escapeHtml(c.numero)}')">Reenviar</button>
      </td>
    </tr>`;
  });
  tabla(cont, ["Numero", "Nombre", "Codigo", "Estado", "Origen", "Actualizado", ""], filas);
  document.getElementById("estadoDirecto").textContent =
    "La tabla se actualiza sola cada 20 segundos.";
};

/** Regenera el codigo de un numero que ya habia pedido uno en la app. */
window.reenviarCodigo = async function (numero) {
  const { error } = await db.rpc("crear_codigo", {
    p_numero: soloDigitos(numero), p_nombre: null, p_desde_panel: true
  });
  if (error) alert("No se pudo reenviar: " + error.message);
  CARGADORES.codigos();
};

document.getElementById("btnActualizar").onclick = () => CARGADORES.codigos();

// ---------------------------------------------------------------------
// USUARIOS: listado + acciones (rol, verificado, activo)
// ---------------------------------------------------------------------

CARGADORES.usuarios = async () => {
  await Promise.all([cargarUsuarios(), cargarVerificados()]);
};

async function cargarUsuarios() {
  const cont = document.getElementById("tablaUsuarios");
  const { data, error } = await db
    .from("usuarios").select("*").order("creado", { ascending: false }).limit(200);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(u => `<tr>
    <td>${escapeHtml(u.nombre || "-")}</td>
    <td>+${escapeHtml(u.numero || "-")}</td>
    <td>${escapeHtml(u.correo || "-")}</td>
    <td>${escapeHtml(u.empresa || "-")}</td>
    <td><span class="chip ${u.verificado ? "ok" : "no"}">${u.verificado ? "verificado" : "sin verificar"}</span></td>
    <td>
      <select onchange="cambiarRol('${u.id}', this.value)" style="min-width:130px">
        <option value="usuario" ${u.rol === "usuario" ? "selected" : ""}>usuario</option>
        <option value="moderador" ${u.rol === "moderador" ? "selected" : ""}>moderador</option>
        <option value="admin" ${u.rol === "admin" ? "selected" : ""}>admin</option>
      </select>
    </td>
    <td><span class="chip ${u.activo ? "ok" : "no"}">${u.activo ? "activo" : "baja"}</span></td>
    <td class="acciones">
      <button class="sec" onclick="alternarVerificado('${u.id}', ${!u.verificado})">
        ${u.verificado ? "Quitar sello" : "Dar sello"}
      </button>
      <button class="${u.activo ? "peligro" : "sec"}"
              onclick="alternarActivo('${u.id}', ${!u.activo})">
        ${u.activo ? "Desactivar" : "Reactivar"}
      </button>
    </td>
  </tr>`);
  tabla(cont, ["Nombre", "Numero", "Correo", "Empresa", "Sello", "Rol", "Estado", ""], filas);
}

window.cambiarRol = async function (id, rol) {
  const { error } = await db.from("usuarios").update({ rol }).eq("id", id);
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "cambiar_rol", p_tabla: "usuarios", p_registro_id: id, p_detalle: rol
  }).catch(() => {});
};

window.alternarVerificado = async function (id, valor) {
  const { error } = await db.from("usuarios").update({ verificado: valor }).eq("id", id);
  if (error) return alert(error.message);
  cargarUsuarios();
};

window.alternarActivo = async function (id, valor) {
  if (!valor && !confirm("Dar de baja este usuario? Dejara de poder entrar.")) return;
  const { error } = await db.from("usuarios").update({ activo: valor }).eq("id", id);
  if (error) return alert(error.message);
  cargarUsuarios();
};

document.getElementById("btnActualizarUsu").onclick = () => cargarUsuarios();

// ---------------------------------------------------------------------
// VERIFICACION DE NUMEROS (distintivo en la tabla numeros)
// ---------------------------------------------------------------------

async function cargarVerificados() {
  const cont = document.getElementById("tablaVerificados");
  const { data, error } = await db
    .from("numeros").select("*").eq("verificado", true).order("actualizado", { ascending: false });
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(n => `<tr>
    <td>+${escapeHtml(n.numero)}</td>
    <td>${escapeHtml(n.nombre || "-")}</td>
    <td>${escapeHtml(n.nota || "-")}</td>
    <td>${fecha(n.actualizado)}</td>
    <td class="acciones">
      <button class="peligro" onclick="quitarVerificacion('${escapeHtml(n.numero)}')">Quitar</button>
    </td>
  </tr>`);
  tabla(cont, ["Numero", "Nombre", "Nota interna", "Actualizado", ""], filas);
}

document.getElementById("btnVerificar").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numVerif").value);
  const nota = document.getElementById("notaVerif").value.trim();
  if (numero.length < 8) return alert("Escribe un numero valido.");
  const { error } = await db.from("numeros").upsert({
    numero, verificado: true, nota, actualizado: Date.now()
  }, { onConflict: "numero" });
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "verificar_numero", p_tabla: "numeros", p_registro_id: numero
  }).catch(() => {});
  cargarVerificados();
};

window.quitarVerificacion = async function (numero) {
  const { error } = await db.from("numeros")
    .update({ verificado: false, actualizado: Date.now() }).eq("numero", numero);
  if (error) return alert(error.message);
  cargarVerificados();
};

document.getElementById("btnQuitarVerif").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numVerif").value);
  if (numero.length < 8) return alert("Escribe un numero valido.");
  await window.quitarVerificacion(numero);
};

// ---------------------------------------------------------------------
// DISPOSITIVOS Y PERFILES
// ---------------------------------------------------------------------

CARGADORES.dispositivos = async () => {
  await Promise.all([cargarDispositivos(), cargarPerfiles()]);
};

async function cargarDispositivos() {
  const cont = document.getElementById("tablaDispositivos");
  const { data, error } = await db
    .from("dispositivos").select("*").order("ultima_conexion", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(s => `<tr>
    <td>+${escapeHtml(s.numero || "-")}</td>
    <td>${escapeHtml(s.nombre || "-")}</td>
    <td>${escapeHtml([s.marca, s.modelo].filter(Boolean).join(" ") || "-")}</td>
    <td>Android ${escapeHtml(s.android || "-")}</td>
    <td>${escapeHtml(s.pantalla || "-")}</td>
    <td>${escapeHtml(s.red || "-")}</td>
    <td>${escapeHtml(s.pais || "-")}</td>
    <td>${fecha(s.ultima_conexion)}</td>
    <td>${s.activo ? '<span class="chip ok">vinculado</span>'
                   : '<span class="chip no">desvinculado</span>'}</td>
    <td class="acciones">${s.activo
      ? `<button class="peligro" onclick="desvincularDispositivo('${escapeHtml(s.id)}')">Desvincular</button>`
      : ""}</td>
  </tr>`);
  tabla(cont, ["Numero", "Persona", "Equipo", "Sistema", "Pantalla", "Red",
               "Pais", "Ultima conexion", "Estado", ""], filas);
}

window.desvincularDispositivo = async function (id) {
  if (!confirm("Desvincular este equipo? Dejara de tener acceso a la cuenta.")) return;
  const { error } = await db.from("dispositivos")
    .update({ activo: false }).eq("id", id);
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "desvincular_dispositivo", p_tabla: "dispositivos", p_registro_id: id
  }).catch(() => {});
  cargarDispositivos();
};

async function cargarPerfiles() {
  const cont = document.getElementById("tablaPerfiles");
  const { data, error } = await db
    .from("usuarios").select("*").order("actualizado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(u => `<tr>
    <td>+${escapeHtml(u.numero || "-")}</td>
    <td>${escapeHtml(u.nombre || "-")}</td>
    <td>${escapeHtml(u.empresa || "-")}</td>
    <td>${escapeHtml(u.actividad || "-")}</td>
    <td>${escapeHtml(u.direccion || "-")}</td>
    <td>${escapeHtml(u.correo || "-")}</td>
    <td>${u.usuario ? `@${escapeHtml(u.usuario)}` : "-"}</td>
    <td>${fecha(u.actualizado)}</td>
  </tr>`);
  tabla(cont, ["Numero", "Nombre", "Empresa", "Actividad", "Direccion",
               "Correo", "Instagram", "Actualizado"], filas);
}

document.getElementById("btnActualizarDisp").onclick = () =>
  Promise.all([cargarDispositivos(), cargarPerfiles()]);

// ---------------------------------------------------------------------
// CHATS: conversaciones y sus mensajes
// ---------------------------------------------------------------------

CARGADORES.chats = async () => {
  const cont = document.getElementById("tablaConversaciones");
  const { data, error } = await db
    .from("conversaciones").select("*").order("ultimo_mensaje", { ascending: false }).limit(50);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(c => `<tr>
    <td>${c.es_grupo ? "Grupo" : "1 a 1"}</td>
    <td>${escapeHtml(c.titulo || c.id)}</td>
    <td>${escapeHtml(c.ultimoTexto || "-")}</td>
    <td>${fecha(c.ultimo_mensaje || c.creado)}</td>
    <td class="acciones">
      <button class="sec" onclick="verMensajes('${escapeHtml(c.id)}')">Ver mensajes</button>
    </td>
  </tr>`);
  tabla(cont, ["Tipo", "Titulo", "Ultimo mensaje", "Cuando", ""], filas);
};

window.verMensajes = async function (conv) {
  const cont = document.getElementById("tablaMensajesChat");
  document.getElementById("tituloChat").textContent = "2. Mensajes · " + conv;
  cont.innerHTML = '<div class="vacio">Cargando...</div>';
  const { data, error } = await db
    .from("mensajes").select("*").eq("conversacion_id", conv)
    .order("creado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(m => `<tr>
    <td>${fecha(m.creado)}</td>
    <td>${escapeHtml(m.autor_nombre || m.autor_id)}</td>
    <td>${m.tipo !== "texto" ? `<span class="chip pend">${escapeHtml(m.tipo)}</span> ` : ""}
        ${m.responde_a ? `<i style="color:var(--gris)">respondio a: ${escapeHtml(m.texto_respondido || "")}</i><br>` : ""}
        ${m.reenviado_de ? '<i style="color:var(--gris)">reenviado</i><br>' : ""}
        ${escapeHtml(m.texto || m.url_imagen || m.url_archivo || "-")}</td>
    <td><span class="chip ${m.estado === "leido" ? "ok" : m.estado === "fallido" ? "no" : "pend"}">
        ${escapeHtml(m.estado)}</span></td>
  </tr>`);
  tabla(cont, ["Cuando", "Autor", "Mensaje", "Estado"], filas);
};

document.getElementById("btnActualizarChats").onclick = () => CARGADORES.chats();

// ---------------------------------------------------------------------
// REPORTES
// ---------------------------------------------------------------------

CARGADORES.reportes = async () => {
  const cont = document.getElementById("tablaReportes");
  const { data, error } = await db
    .from("reportes").select("*").order("creado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(r => `<tr>
    <td>${fecha(r.creado)}</td>
    <td>${escapeHtml(r.motivo)}</td>
    <td>${escapeHtml(r.detalle || "-")}</td>
    <td><span class="chip ${r.estado === "revisado" ? "ok" : r.estado === "descartado" ? "no" : "pend"}">
        ${escapeHtml(r.estado)}</span></td>
    <td class="acciones">
      <button class="sec" onclick="cambiarReporte('${r.id}', 'revisado')">Revisado</button>
      <button class="sec" onclick="cambiarReporte('${r.id}', 'descartado')">Descartar</button>
    </td>
  </tr>`);
  tabla(cont, ["Cuando", "Motivo", "Detalle", "Estado", ""], filas);
};

window.cambiarReporte = async function (id, estado) {
  const { error } = await db.from("reportes").update({ estado }).eq("id", id);
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "revisar_reporte", p_tabla: "reportes", p_registro_id: id, p_detalle: estado
  }).catch(() => {});
  CARGADORES.reportes();
};

document.getElementById("btnActualizarReportes").onclick = () => CARGADORES.reportes();

// ---------------------------------------------------------------------
// TIENDA: negocios, productos y pedidos
// ---------------------------------------------------------------------

CARGADORES.tienda = async () => {
  await Promise.all([cargarNegocios(), cargarProductos(), cargarPedidos()]);
};

async function cargarNegocios() {
  const cont = document.getElementById("tablaNegocios");
  const { data, error } = await db
    .from("negocios").select("*").order("creado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(n => `<tr>
    <td>${escapeHtml(n.nombre_comercial || "-")}</td>
    <td>${escapeHtml(n.categoria || "-")}</td>
    <td>${escapeHtml(n.direccion || "-")}</td>
    <td>${n.abierto ? '<span class="chip ok">abierto</span>'
                    : '<span class="chip no">cerrado</span>'}</td>
    <td>${n.activo ? '<span class="chip ok">publicado</span>'
                   : '<span class="chip pend">oculto</span>'}</td>
    <td class="acciones">
      <button class="sec" onclick="alternarNegocio('${n.usuario_id}', ${!n.abierto})">
        ${n.abierto ? "Cerrar" : "Abrir"}
      </button>
      <button class="sec" onclick="alternarNegocioActivo('${n.usuario_id}', ${!n.activo})">
        ${n.activo ? "Ocultar" : "Publicar"}
      </button>
    </td>
  </tr>`);
  tabla(cont, ["Negocio", "Categoria", "Direccion", "Horario", "Publicacion", ""], filas);
}

window.alternarNegocio = async function (id, abierto) {
  const { error } = await db.from("negocios")
    .update({ abierto, actualizado: Date.now() }).eq("usuario_id", id);
  if (error) return alert(error.message);
  cargarNegocios();
};

window.alternarNegocioActivo = async function (id, activo) {
  const { error } = await db.from("negocios")
    .update({ activo, actualizado: Date.now() }).eq("usuario_id", id);
  if (error) return alert(error.message);
  cargarNegocios();
};

async function cargarProductos() {
  const cont = document.getElementById("tablaProductos");
  const { data, error } = await db
    .from("productos").select("*").order("creado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(p => `<tr>
    <td>${escapeHtml(p.nombre)}</td>
    <td>${escapeHtml(p.categoria || "-")}</td>
    <td>${bs(p.precio)}</td>
    <td>${Number(p.stock || 0)}</td>
    <td>${Number(p.vendidos || 0)}</td>
    <td><span class="chip ${p.estado === "activo" ? "ok" : p.estado === "agotado" ? "no" : "pend"}">
        ${escapeHtml(p.estado)}</span></td>
    <td class="acciones">
      <button class="sec" onclick="editarProducto('${p.id}')">Editar</button>
      <select onchange="cambiarEstadoProducto('${p.id}', this.value)" style="min-width:130px">
        <option value="activo" ${p.estado === "activo" ? "selected" : ""}>activo</option>
        <option value="pausado" ${p.estado === "pausado" ? "selected" : ""}>pausado</option>
        <option value="agotado" ${p.estado === "agotado" ? "selected" : ""}>agotado</option>
      </select>
      <button class="peligro" onclick="borrarProducto('${p.id}')">Borrar</button>
    </td>
  </tr>`);
  tabla(cont, ["Producto", "Categoria", "Precio", "Stock", "Vendidos", "Estado", ""], filas);
}

window.cambiarEstadoProducto = async function (id, estado) {
  const { error } = await db.from("productos")
    .update({ estado, actualizado: Date.now() }).eq("id", id);
  if (error) return alert(error.message);
};

window.borrarProducto = async function (id) {
  if (!confirm("Borrar este producto de la tienda?")) return;
  const { error } = await db.from("productos").delete().eq("id", id);
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "borrar_producto", p_tabla: "productos", p_registro_id: id
  }).catch(() => {});
  cargarProductos();
};

// ---------------------------------------------------------------------
// SUBIR PRODUCTO (solo admin verificado; RLS lo exige en el servidor)
//  - Nombre, precio (Bs -> centavos), moneda, descripcion, categoria,
//    inventario (stock), estado de publicacion e imagenes.
//  - Imagenes: URL pegada (GitHub o cualquier web) o archivo subido al
//    bucket "productos" de Supabase Storage.
// ---------------------------------------------------------------------

let imagenesProducto = [];      // URLs de imagenes del formulario
let editandoProductoId = null;  // null = producto nuevo; id = editando

const el = id => document.getElementById(id);

function estadoForm(t, malo = false) {
  const e = el("estadoProducto");
  if (!e) return;
  e.textContent = t;
  e.style.color = malo ? "#FF8080" : "#39FF6A";
}

function pintarImagenes() {
  const cont = el("contImagenes");
  cont.innerHTML = "";
  imagenesProducto.forEach((url, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin:0 6px 6px 0";
    const img = document.createElement("img");
    img.src = url; img.alt = "";
    img.style.cssText = "width:30px;height:30px;object-fit:cover;border-radius:6px";
    img.onerror = () => { img.style.display = "none"; };
    const txt = document.createElement("span");
    txt.textContent = "img " + (i + 1) + " · " + url.slice(0, 36) + (url.length > 36 ? "…" : "");
    const btnX = document.createElement("button");
    btnX.type = "button"; btnX.className = "peligro"; btnX.textContent = "x";
    btnX.style.cssText = "padding:2px 8px;font-size:.75rem";
    btnX.onclick = () => { imagenesProducto.splice(i, 1); pintarImagenes(); };
    chip.append(img, txt, btnX);
    cont.appendChild(chip);
  });
}

function abrirFormProducto(producto) {
  editandoProductoId = producto ? producto.id : null;
  imagenesProducto = (producto && Array.isArray(producto.imagenes)) ? producto.imagenes.slice() : [];
  el("tituloFormProducto").textContent = producto ? "Editar producto" : "Nuevo producto";
  el("pNombre").value = producto ? (producto.nombre || "") : "";
  el("pPrecio").value = producto ? (Number(producto.precio || 0) / 100).toFixed(2) : "";
  el("pMoneda").value = producto ? (producto.moneda || "BOB") : "BOB";
  el("pCategoria").value = producto ? (producto.categoria || "") : "";
  el("pStock").value = producto ? Number(producto.stock || 0) : "";
  el("pEstado").value = producto ? (producto.estado || "activo") : "activo";
  el("pDescripcion").value = producto ? (producto.descripcion || "") : "";
  el("pimgUrl").value = "";
  el("pimgArchivo").value = "";
  el("btnGuardarProducto").textContent = producto ? "Guardar cambios" : "Guardar en Supabase";
  pintarImagenes();
  estadoForm("");
  el("formularioProducto").classList.remove("oculto");
  el("formularioProducto").scrollIntoView({ behavior: "smooth", block: "start" });
  el("pNombre").focus();
}

window.editarProducto = async function (id) {
  const { data, error } = await db.from("productos").select("*").eq("id", id).maybeSingle();
  if (error || !data) return alert("No se pudo cargar el producto: " + (error ? error.message : "no existe"));
  abrirFormProducto(data);
};

el("btnSubirProducto").onclick = () => abrirFormProducto(null);

el("btnCancelarProducto").onclick = () => {
  el("formularioProducto").classList.add("oculto");
  editandoProductoId = null;
  imagenesProducto = [];
};

el("btnAgregarUrl").onclick = () => {
  const url = el("pimgUrl").value.trim();
  if (!/^https?:\/\/\S+/i.test(url)) return estadoForm("La imagen debe ser una URL http/https valida.", true);
  imagenesProducto.push(url);
  el("pimgUrl").value = "";
  pintarImagenes();
};

el("btnSubirStorage").onclick = async () => {
  const input = el("pimgArchivo");
  const archivo = input.files && input.files[0];
  if (!archivo) return estadoForm("Elige primero un archivo de imagen.", true);
  if (archivo.size > 5 * 1024 * 1024) return estadoForm("La imagen pesa mas de 5 MB.", true);
  const btn = el("btnSubirStorage");
  btn.disabled = true;
  estadoForm("Subiendo a Supabase Storage...");
  try {
    const ruta = "prod/" + Date.now() + "_" + archivo.name.replace(/\s+/g, "_");
    const { error } = await db.storage.from("productos").upload(ruta, archivo, {
      upsert: true, contentType: archivo.type || "image/jpeg"
    });
    if (error) throw error;
    const { data: pub } = db.storage.from("productos").getPublicUrl(ruta);
    if (!pub || !pub.publicUrl) throw new Error("Supabase no devolvio la URL publica.");
    imagenesProducto.push(pub.publicUrl);
    input.value = "";
    pintarImagenes();
    estadoForm("Imagen subida y anadida al producto.");
  } catch (e) {
    estadoForm("No se pudo subir: " + (e.message || e), true);
  } finally { btn.disabled = false; }
};

el("btnGuardarProducto").onclick = async () => {
  const nombre = el("pNombre").value.trim();
  const precioBs = parseFloat(el("pPrecio").value);
  const moneda = el("pMoneda").value;
  const categoria = el("pCategoria").value.trim();
  const stock = parseInt(el("pStock").value, 10);
  const estado = el("pEstado").value;
  const descripcion = el("pDescripcion").value.trim();

  if (!nombre) return estadoForm("Escribe el nombre del producto.", true);
  if (isNaN(precioBs) || precioBs < 0) return estadoForm("Escribe un precio valido en Bs.", true);
  if (!categoria) return estadoForm("Escribe la categoria.", true);
  if (isNaN(stock) || stock < 0) return estadoForm("Escribe el inventario (numero entero).", true);

  const centavos = Math.round(precioBs * 100);  // el esquema guarda centavos
  const btn = el("btnGuardarProducto");
  btn.disabled = true;
  estadoForm("Guardando en Supabase...");
  try {
    if (editandoProductoId) {
      const { error } = await db.from("productos").update({
        nombre, descripcion, precio: centavos, moneda, categoria, stock, estado,
        imagenes: imagenesProducto, actualizado: Date.now()
      }).eq("id", editandoProductoId);
      if (error) throw error;
      db.rpc("registrar_auditoria", {
        p_accion: "editar_producto_panel", p_tabla: "productos",
        p_registro_id: editandoProductoId, p_detalle: nombre
      }).catch(() => {});
      estadoForm("Producto actualizado: " + nombre + ".");
    } else {
      const { data, error } = await db.from("productos").insert({
        nombre, descripcion, precio: centavos, moneda, categoria, stock, estado,
        imagenes: imagenesProducto, vendedor_nombre: "LUMIQ",
        creado: Date.now(), actualizado: Date.now()
      }).select("id").maybeSingle();
      if (error) throw error;
      db.rpc("registrar_auditoria", {
        p_accion: "subir_producto_panel", p_tabla: "productos",
        p_registro_id: data && data.id, p_detalle: nombre
      }).catch(() => {});
      estadoForm("Producto publicado: " + nombre + " (" + bs(centavos) + ").");
    }
    el("formularioProducto").classList.add("oculto");
    editandoProductoId = null;
    imagenesProducto = [];
    cargarProductos();
  } catch (e) {
    estadoForm("Supabase rechazo la operacion: " + (e.message || e), true);
  } finally { btn.disabled = false; }
};

async function cargarPedidos() {
  const cont = document.getElementById("tablaPedidos");
  const { data, error } = await db
    .from("pedidos").select("*").order("creado", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(p => `<tr>
    <td>${escapeHtml(p.numero_pedido)}</td>
    <td>${fecha(p.creado)}</td>
    <td>${bs(p.total)}</td>
    <td>${escapeHtml(p.direccion || "-")}</td>
    <td><span class="chip ${p.estado === "entregado" ? "ok" : p.estado === "cancelado" ? "no" : "pend"}">
        ${escapeHtml(p.estado)}</span></td>
    <td class="acciones">
      <select onchange="cambiarEstadoPedido('${p.id}', this.value)" style="min-width:150px">
        ${["confirmado", "preparando", "en_camino", "entregado", "cancelado"]
          .map(e => `<option value="${e}" ${p.estado === e ? "selected" : ""}>${e}</option>`).join("")}
      </select>
    </td>
  </tr>`);
  tabla(cont, ["Pedido", "Cuando", "Total", "Direccion", "Estado", ""], filas);
}

window.cambiarEstadoPedido = async function (id, estado) {
  const { error } = await db.from("pedidos")
    .update({ estado, actualizado: Date.now() }).eq("id", id);
  if (error) return alert(error.message);
  db.rpc("registrar_auditoria", {
    p_accion: "cambiar_pedido", p_tabla: "pedidos", p_registro_id: id, p_detalle: estado
  }).catch(() => {});
  cargarPedidos();
};

document.getElementById("btnActualizarNeg").onclick = () => cargarNegocios();
document.getElementById("btnActualizarProd").onclick = () => cargarProductos();
document.getElementById("btnActualizarPed").onclick = () => cargarPedidos();

// ---------------------------------------------------------------------
// MONEDA: saldos, ajuste manual y transferencias
// ---------------------------------------------------------------------

CARGADORES.moneda = async () => {
  await Promise.all([cargarSaldos(), cargarTransferencias()]);
};

async function cargarSaldos() {
  const cont = document.getElementById("tablaSaldos");
  // Ojo: saldos.usuario_id apunta a auth.users, no a public.usuarios, asi que
  // NO se puede embeber con PostgREST: se busca el nombre en una pasada aparte.
  const [{ data, error }, dir] = await Promise.all([
    db.from("saldos").select("usuario_id, saldo, moneda, actualizado")
      .order("saldo", { ascending: false }).limit(200),
    db.from("usuarios").select("id, numero, nombre").limit(1000)
  ]);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }
  const mapa = new Map((dir.data || []).map(u => [u.id, u]));

  const filas = (data || []).map(s => {
    const u = mapa.get(s.usuario_id) || {};
    return `<tr>
      <td>${escapeHtml(u.nombre || "-")}</td>
      <td>${u.numero ? "+" + escapeHtml(u.numero) : "-"}</td>
      <td style="color:var(--neon);font-weight:700">${bs(s.saldo)}</td>
      <td>${escapeHtml(s.moneda || "BOB")}</td>
      <td>${fecha(s.actualizado)}</td>
    </tr>`;
  });
  tabla(cont, ["Persona", "Numero", "Saldo", "Moneda", "Actualizado"], filas);
}

document.getElementById("btnAjuste").onclick = async () => {
  const numero = soloDigitos(document.getElementById("ajusteNumero").value);
  const monto = parseInt(document.getElementById("ajusteMonto").value, 10);
  const estado = document.getElementById("estadoAjuste");
  if (numero.length < 8 || isNaN(monto) || monto === 0) {
    estado.textContent = "Revisa el numero y el monto.";
    return;
  }
  // 1) buscar al usuario
  const { data: usu, error: e1 } = await db
    .from("usuarios").select("id, numero, nombre").eq("numero", numero).maybeSingle();
  if (e1 || !usu) { estado.textContent = "No existe ningun usuario con ese numero."; return; }

  // 2) mover el saldo en la tabla saldos (el panel puede escribirla: RLS admin)
  const { data: fila, error: e2 } = await db
    .from("saldos").select("saldo").eq("usuario_id", usu.id).maybeSingle();
  if (e2) { estado.textContent = e2.message; return; }
  const actual = fila ? Number(fila.saldo) : 0;
  const nuevo = actual + monto;
  if (nuevo < 0) { estado.textContent = "El ajuste dejaria el saldo en negativo."; return; }

  const guardar = fila
    ? db.from("saldos").update({ saldo: nuevo, actualizado: Date.now() }).eq("usuario_id", usu.id)
    : db.from("saldos").insert({ usuario_id: usu.id, saldo: nuevo });
  const { error: e3 } = await guardar;
  if (e3) { estado.textContent = e3.message; return; }

  // 3) dejar constancia en movimientos y auditoria
  const tx = "ajuste-" + Date.now();
  await db.from("movimientos").insert({
    usuario_id: usu.id, transaction_id: tx, monto, moneda: "BOB",
    tipo: "ajuste", descripcion: "Ajuste del panel",
    contraparte_numero: usu.numero, contraparte_nombre: usu.nombre,
    creado: Date.now()
  }).catch(() => {});
  db.rpc("registrar_auditoria", {
    p_accion: "ajuste_saldo", p_tabla: "saldos", p_registro_id: usu.id,
    p_detalle: String(monto)
  }).catch(() => {});

  estado.textContent = `Listo. ${usu.nombre || usu.numero}: ${bs(actual)} -> ${bs(nuevo)}.`;
  cargarSaldos();
};

async function cargarTransferencias() {
  const cont = document.getElementById("tablaTransferencias");
  const { data, error } = await db
    .from("transferencias").select("*").order("creado", { ascending: false }).limit(50);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }

  const filas = (data || []).map(t => `<tr>
    <td>${fecha(t.creado)}</td>
    <td>+${escapeHtml(t.de_numero || "-")}</td>
    <td>+${escapeHtml(t.para_numero || "-")}</td>
    <td style="color:var(--neon);font-weight:700">${bs(t.monto)}</td>
    <td>${escapeHtml(t.descripcion || "-")}</td>
    <td><span class="chip ${t.estado === "completada" ? "ok" : t.estado === "rechazada" ? "no" : "pend"}">
        ${escapeHtml(t.estado)}</span></td>
    <td style="font-size:.75rem;color:var(--gris)">${escapeHtml(t.transaction_id)}</td>
  </tr>`);
  tabla(cont, ["Cuando", "De", "Para", "Monto", "Nota", "Estado", "Tx"], filas);
}

document.getElementById("btnActualizarSaldos").onclick = () => cargarSaldos();
document.getElementById("btnActualizarTx").onclick = () => cargarTransferencias();

// ---------------------------------------------------------------------
// AUDITORIA
// ---------------------------------------------------------------------

CARGADORES.auditoria = async () => {
  const cont = document.getElementById("tablaAuditoria");
  // auditoria.usuario_id no tiene FK con public.usuarios: se resuelve aparte.
  const [{ data, error }, dir] = await Promise.all([
    db.from("auditoria").select("*").order("creado", { ascending: false }).limit(100),
    db.from("usuarios").select("id, numero, nombre").limit(1000)
  ]);
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }
  const mapa = new Map((dir.data || []).map(u => [u.id, u]));

  const filas = (data || []).map(a => {
    const u = mapa.get(a.usuario_id) || {};
    return `<tr>
      <td>${fecha(a.creado)}</td>
      <td>${escapeHtml(u.nombre || (u.numero ? "+" + u.numero : a.usuario_id || "sistema"))}</td>
      <td><b>${escapeHtml(a.accion)}</b></td>
      <td>${escapeHtml(a.tabla)}</td>
      <td>${escapeHtml(a.registro_id || "-")}</td>
      <td>${escapeHtml(a.detalle || "-")}</td>
    </tr>`;
  });
  tabla(cont, ["Cuando", "Quien", "Accion", "Tabla", "Registro", "Detalle"], filas);
};

document.getElementById("btnActualizarAud").onclick = () => CARGADORES.auditoria();

// ---------------------------------------------------------------------
// CONFIG: mantenimiento, aviso, version y roles
// ---------------------------------------------------------------------

CARGADORES.config = async () => {
  const cfg = await db.from("config").select("valor").eq("clave", "general").maybeSingle();
  const v = (cfg.data && cfg.data.valor) || {};
  document.getElementById("chkMantenimiento").checked = !!v.mantenimiento;
  document.getElementById("avisoTexto").value = v.aviso || "";
  document.getElementById("versionApp").value = v.version_app || "";

  const cont = document.getElementById("tablaRoles");
  const { data: roles, error } = await db.from("roles").select("*").order("nombre");
  if (error) { cont.innerHTML = `<div class="vacio">${escapeHtml(error.message)}</div>`; return; }
  const { data: perms } = await db.from("permisos").select("*");
  const filas = (roles || []).map(r => {
    const lista = (perms || []).filter(p => p.rol === r.nombre).map(p => p.permiso);
    return `<tr>
      <td><b>${escapeHtml(r.nombre)}</b></td>
      <td>${escapeHtml(r.descripcion || "-")}</td>
      <td>${lista.length ? escapeHtml(lista.join(", ")) : "-"}</td>
    </tr>`;
  });
  tabla(cont, ["Rol", "Descripcion", "Permisos"], filas);
};

document.getElementById("btnGuardarConfig").onclick = async () => {
  const valor = {
    mantenimiento: document.getElementById("chkMantenimiento").checked,
    aviso: document.getElementById("avisoTexto").value.trim(),
    version_app: document.getElementById("versionApp").value.trim() || "1.0.1"
  };
  const estado = document.getElementById("estadoConfig");
  const { error } = await db.from("config")
    .upsert({ clave: "general", valor, actualizado: Date.now() }, { onConflict: "clave" });
  if (error) { estado.textContent = error.message; return; }
  db.rpc("registrar_auditoria", {
    p_accion: "guardar_config", p_tabla: "config", p_registro_id: "general",
    p_detalle: JSON.stringify(valor)
  }).catch(() => {});
  estado.textContent = "Configuracion guardada (" + fecha(Date.now()) + ").";
};

// ---------------------------------------------------------------------
// CREAR CUENTA ADMINISTRATIVA (correo + contrasena, sin codigos)
//  - Se guarda la sesion actual del admin, se crea la cuenta nueva con
//    signUp y se restaura la sesion del admin (signUp la reemplaza).
//  - La fila de usuarios con rol 'admin' la inserta el admin actual:
//    RLS (usuarios_insert_admin) solo lo permite si es_admin().
//  - El trigger usuarios_no_autoascenso impide que un usuario normal
//    se asigne solo el rol admin desde la app.
// ---------------------------------------------------------------------

document.getElementById("btnCrearAdmin").onclick = async () => {
  const nombre = document.getElementById("adminNombre").value.trim();
  const correo = document.getElementById("adminCorreo").value.trim().toLowerCase();
  const clave = document.getElementById("adminClave").value;
  const estado = document.getElementById("estadoCrearAdmin");

  if (!nombre) { estado.textContent = "Escribe el nombre personal."; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { estado.textContent = "Escribe un correo valido."; return; }
  if (clave.length < 6) { estado.textContent = "La contrasena debe tener al menos 6 caracteres."; return; }

  // 1) Guardar la sesion del admin actual para poder restaurarla.
  const { data: datos } = await db.auth.getSession();
  const sesionAdmin = datos && datos.session;
  if (!sesionAdmin) { estado.textContent = "Tu sesion admin expiro. Entra de nuevo."; return; }

  // 2) Crear la cuenta de autenticacion (correo + contrasena).
  estado.textContent = "Creando la cuenta de autenticacion...";
  const { data: nuevo, error } = await db.auth.signUp({ email: correo, password: clave });
  if (error) { estado.textContent = "Supabase: " + error.message; return; }

  // 3) Restaurar la sesion del admin (signUp cambio la sesion activa).
  const { error: eRestore } = await db.auth.setSession({
    access_token: sesionAdmin.access_token,
    refresh_token: sesionAdmin.refresh_token
  });
  if (eRestore) {
    estado.textContent = "La cuenta se creo, pero no pude restaurar tu sesion: "
      + eRestore.message + ". Entra de nuevo.";
    return;
  }

  const uid = nuevo.user && nuevo.user.id;
  if (!uid) {
    estado.textContent = "Cuenta creada. Si el correo pide confirmacion, que la persona "
      + "confirme y luego registraremos su perfil admin.";
    return;
  }

  // 4) Registrar el perfil admin en usuarios (RLS lo permite solo al admin).
  const ahora = Date.now();
  const { error: eIns } = await db.from("usuarios").insert({
    id: uid,
    numero: "9" + uid.slice(0, 12).replace(/-/g, ""),  // unico, sin telefono real
    nombre,
    correo,
    verificado: true,
    rol: "admin",
    activo: true,
    creado: ahora,
    actualizado: ahora
  });
  if (eIns) {
    estado.textContent = "La cuenta existe, pero el perfil admin no se pudo registrar: "
      + eIns.message;
    return;
  }

  db.rpc("registrar_auditoria", {
    p_accion: "crear_admin", p_tabla: "usuarios", p_registro_id: uid, p_detalle: correo
  }).catch(() => {});

  estado.textContent = "Listo. " + nombre + " ya puede entrar con correo y contrasena como administrador.";
  document.getElementById("adminNombre").value = "";
  document.getElementById("adminCorreo").value = "";
  document.getElementById("adminClave").value = "";
};

// Restaura el tamano de letra elegido antes de entrar.
aplicarTamano();

