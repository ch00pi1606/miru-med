/* =========================================================================
   miru · ALMACÉN — persistencia intercambiable
   'local'     El progreso vive solo en este navegador (por perfil).
   'supabase'  Además se sincroniza con Supabase. Hay dos formas de entrar:
     · ALUMNO: número miru + código de 1 minuto (inicio de sesión único).
       El dispositivo crea una sesión anónima de Supabase y, al canjear el
       código, queda ligado al alumno. Un dispositivo a la vez.
     · ADMINISTRADORA: usuario (correo) y contraseña de Supabase Auth.
   Sin librerías: llamadas fetch a /auth/v1 y /rest/v1/rpc.
   En este archivo nunca hay contraseñas ni la clave service_role.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const CFG = global.MIRU_CONFIG || {};
  const SB = CFG.supabase || {};
  const PRE = 'miru.v1.';
  const K = {
    sesion: PRE + 'sesion',          // sesión anónima del dispositivo del alumno
    admin: PRE + 'sesionAdmin',      // sesión de la administradora
    cuenta: PRE + 'cuenta',          // alumno ligado a este dispositivo
    vinculos: PRE + 'vinculos',      // alumnoId → perfil local
    ultimoNumero: PRE + 'ultimoNumero'
  };
  const CURSO = CFG.curso || 'cir1';
  const DIAS_SIN_RED = 30;
  const LATIDO_MS = 5 * 60 * 1000;
  const SIN_RED = 'sin_red', SIN_SESION = 'sin_sesion';

  const P = () => MIRU.progreso;
  function leer(k) { try { const s = global.localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function escribir(k, v) {
    try { if (v == null) global.localStorage.removeItem(k); else global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalizar = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b64aBuffer = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;

  class ErrorMiru extends Error {
    constructor(mensaje, codigo, estado) { super(mensaje); this.codigo = codigo || ''; this.estado = estado || 0; }
  }

  /* =================================================== cliente de Supabase */
  const base = () => String(SB.url || '').replace(/\/+$/, '');
  const clavePublica = () => SB.clavePublica || SB.anonKey || '';
  const configurado = () => /^https?:\/\/[^/]+/.test(base()) && !!clavePublica();

  function traducir(msg, codigo) {
    const m = String(msg || '');
    if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
    if (codigo === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(m)) return 'El servidor todavía no permite activar dispositivos: falta encender «Anonymous sign-ins» en Supabase.';
    if (codigo === 'email_not_confirmed' || /email not confirmed/i.test(m)) return 'Ese usuario aún no está confirmado en Supabase.';
    if (/rate limit|too many/i.test(m) || /rate_limit/.test(codigo)) return 'Demasiados intentos seguidos. Espera unos minutos.';
    if (/signups? not allowed|signup.*disabled/i.test(m)) return 'El servidor no permite crear sesiones nuevas: deja encendido «Allow new users to sign up» en Supabase.';
    return m || 'Error del servidor.';
  }

  /** POST a Supabase. La clave pública va en «apikey»; el token del usuario, en Authorization. */
  async function pedir(ruta, cuerpo, token, ms) {
    const ctl = global.AbortController ? new AbortController() : null;
    const reloj = ctl ? setTimeout(() => ctl.abort(), ms || 15000) : null;
    let res;
    try {
      const h = { apikey: clavePublica(), 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      res = await fetch(base() + ruta, { method: 'POST', headers: h, body: JSON.stringify(cuerpo || {}), cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      throw new ErrorMiru('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.', SIN_RED);
    } finally { if (reloj) clearTimeout(reloj); }
    const txt = await res.text();
    let datos = null;
    try { datos = txt ? JSON.parse(txt) : null; } catch (e) { datos = txt; }
    if (!res.ok) {
      const d = datos && typeof datos === 'object' ? datos : {};
      const cod = d.error_code || d.code || '';
      throw new ErrorMiru(traducir(d.message || d.msg || d.error_description || d.error || ('Error ' + res.status), cod), cod, res.status);
    }
    return datos;
  }

  function guardarSesion(cual, s, extra) {
    if (!s) { escribir(K[cual], null); return; }
    const previa = leer(K[cual]) || {};
    escribir(K[cual], Object.assign({}, previa.extra ? { extra: previa.extra } : {}, extra ? { extra } : {}, {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: s.user ? { id: s.user.id, email: s.user.email || null, is_anonymous: !!s.user.is_anonymous } : (previa.user || null)
    }));
  }

  function conCandado(nombre, fn) {
    if (global.navigator && navigator.locks && navigator.locks.request) return navigator.locks.request(nombre, fn);
    return fn();
  }

  /** Token de acceso vigente; lo renueva si vence en menos de 90 s. */
  async function token(cual, forzar) {
    const s = leer(K[cual]);
    if (!s) throw new ErrorMiru('No hay sesión.', SIN_SESION);
    if (!forzar && s.expires_at - Date.now() / 1000 > 90) return s.access_token;
    return conCandado('miru-auth-' + cual, async () => {
      const s2 = leer(K[cual]);
      if (!s2) throw new ErrorMiru('No hay sesión.', SIN_SESION);
      // Otra pestaña ya la renovó
      if (s2.refresh_token !== s.refresh_token && s2.expires_at - Date.now() / 1000 > 90) return s2.access_token;
      try {
        const r = await pedir('/auth/v1/token?grant_type=refresh_token', { refresh_token: s2.refresh_token });
        guardarSesion(cual, r);
        return r.access_token;
      } catch (e) {
        if (e.codigo !== SIN_RED && e.estado >= 400 && e.estado < 500) {
          escribir(K[cual], null);
          throw new ErrorMiru('La sesión se cerró en el servidor.', SIN_SESION, e.estado);
        }
        throw e;
      }
    });
  }

  async function rpc(cual, fn, args) {
    let tk = await token(cual);
    try { return await pedir('/rest/v1/rpc/' + fn, args || {}, tk); }
    catch (e) {
      if (e.estado !== 401) throw e;
      tk = await token(cual, true);
      return pedir('/rest/v1/rpc/' + fn, args || {}, tk);
    }
  }

  function etiquetaDispositivo() {
    const ua = (global.navigator && navigator.userAgent) || '';
    const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    return so + ' · ' + nav;
  }

  /* ============================================================== API */
  const A = MIRU.almacen = {
    modo: CFG.modo || 'local',
    estado: 'local',
    error: '',
    ErrorMiru,
    configurado,
    cuenta: () => leer(K.cuenta),
    esAdmin: () => A.modo === 'supabase' && !!leer(K.admin),
    adminInfo() { const s = leer(K.admin); return s ? { email: (s.user && s.user.email) || '', nombre: (s.extra && s.extra.nombre) || '' } : null; },
    rpcAdmin: (fn, args) => rpc('admin', fn, args),
    etiquetaDispositivo
  };

  /* ------------------------------------------------- alumno: activación */
  async function asegurarSesionAnonima() {
    if (leer(K.sesion)) return;
    const r = await pedir('/auth/v1/signup', { data: {} });
    if (!r || !r.access_token) throw new ErrorMiru('No se pudo crear la sesión de este dispositivo.');
    guardarSesion('sesion', r);
  }

  /** Canjea número miru + código de 1 minuto. Devuelve la llave cruda del
      contenido (o null si el contenido no está cifrado). */
  A.activarCodigo = async function (numero, codigo, idLlave) {
    if (!configurado()) throw new ErrorMiru('Falta configurar Supabase en config.js (url y clave pública).');
    if (!/\d/.test(String(numero || ''))) throw new ErrorMiru('Escribe tu número miru (por ejemplo, MIRU-0001).');
    if (normalizar(codigo).length !== 6) throw new ErrorMiru('El código tiene 6 caracteres (por ejemplo, ABC-123).');
    await asegurarSesionAnonima();
    const args = { p_numero: String(numero), p_codigo: String(codigo), p_etiqueta: etiquetaDispositivo() };
    let r;
    try { r = await rpc('sesion', 'canjear_codigo', args); }
    catch (e) {
      if (e.codigo !== SIN_SESION) throw e;
      await asegurarSesionAnonima();
      r = await rpc('sesion', 'canjear_codigo', args);
    }
    if (!r || !r.ok) throw new ErrorMiru((r && r.error) || 'No se pudo activar.');
    escribir(K.ultimoNumero, r.alumno.codigo);
    const cursos = r.cursos || [];
    escribir(K.cuenta, {
      alumnoId: r.alumno.id, numero: r.alumno.numero, codigo: r.alumno.codigo, nombre: r.alumno.nombre,
      dispositivo: r.dispositivo, activado: Date.now(), ultimoOk: Date.now(), version: null,
      cursos: cursos.map(x => ({ curso: x.curso, hasta: x.hasta, id_llave: x.id_llave }))
    });
    return llaveDe(cursos, idLlave, true);
  };

  function llaveDe(cursos, idLlave, lanzar) {
    const c = (cursos || []).find(x => x.curso === CURSO);
    if (!c) {
      if (!lanzar) return null;
      throw new ErrorMiru('Tu dispositivo ya quedó activado, pero Cirugía I no está habilitado en tu cuenta (o venció). Pide a la administradora que lo habilite y vuelve a abrir miru: no necesitarás otro código.');
    }
    if (!idLlave) return null;     // contenido abierto: no hace falta llave
    if (!c.llave || c.id_llave !== idLlave) {
      if (!lanzar) return null;
      throw new ErrorMiru('Tu dispositivo ya quedó activado, pero esta publicación usa otra llave. Avísale a la administradora (debe cargar llave-supabase.sql) y vuelve a abrir miru: no necesitarás otro código.');
    }
    return b64aBuffer(c.llave);
  }

  /** Al abrir: si el dispositivo ya está ligado (o hay sesión de
      administradora), pide la llave al servidor sin pedir código. */
  A.recuperarLlave = async function (idLlave) {
    if (A.modo !== 'supabase' || !configurado()) return null;
    if (leer(K.cuenta)) {
      try {
        const cuenta = leer(K.cuenta);
        const r = await rpc('sesion', 'latido', { p_dispositivo: cuenta.dispositivo });
        if (!r.activo) { olvidarCuenta(); return null; }
        return llaveDe(r.cursos, idLlave, false);
      } catch (e) { if (e.codigo === SIN_SESION) olvidarCuenta(); return null; }
    }
    if (leer(K.admin)) {
      try {
        const r = await rpc('admin', 'admin_llave', { p_curso: CURSO });
        return r.ok && r.id_llave === idLlave ? b64aBuffer(r.llave) : null;
      } catch (e) { if (e.codigo === SIN_SESION || e.estado === 403) escribir(K.admin, null); return null; }
    }
    return null;
  };

  function olvidarCuenta() { escribir(K.cuenta, null); escribir(K.sesion, null); }

  /* ------------------------------------------------- administradora */
  A.entrarAdmin = async function (usuario, clave, idLlave) {
    if (!configurado()) throw new ErrorMiru('Falta configurar Supabase en config.js (url y clave pública).');
    const email = String(usuario || '').trim();
    if (!email || !clave) throw new ErrorMiru('Escribe tu usuario y tu contraseña.');
    if (email.indexOf('@') < 0) throw new ErrorMiru('Tu usuario es el correo con el que creaste tu cuenta en Supabase.');
    const r = await pedir('/auth/v1/token?grant_type=password', { email, password: String(clave) });
    guardarSesion('admin', r);
    let ll;
    try { ll = await rpc('admin', 'admin_llave', { p_curso: CURSO }); }
    catch (e) {
      const sinPermiso = e.estado === 403 || /administradora/.test(e.message);
      try { await pedir('/auth/v1/logout?scope=local', {}, r.access_token); } catch (e2) {}
      escribir(K.admin, null);
      throw sinPermiso ? new ErrorMiru('Ese usuario existe, pero no tiene permisos de administradora (falta ejecutar backend/primer-admin.sql).') : e;
    }
    guardarSesion('admin', r, { nombre: ll.nombre || '' });
    if (!idLlave) return null;
    if (!ll.ok) throw new ErrorMiru(ll.error);
    if (ll.id_llave !== idLlave) throw new ErrorMiru('La llave cargada en Supabase no corresponde a esta publicación. Vuelve a ejecutar herramientas/privado/llave-supabase.sql en Supabase.');
    return b64aBuffer(ll.llave);
  };

  A.salirAdmin = async function () {
    const s = leer(K.admin);
    if (s) { try { await pedir('/auth/v1/logout?scope=local', {}, s.access_token, 5000); } catch (e) {} }
    escribir(K.admin, null);
    // Sin cuenta de alumno ni de administradora, el contenido vuelve a cerrarse
    if (!leer(K.cuenta) && CFG.contenido === 'cifrado') {
      await MIRU.contenido.olvidarLlave();
      global.location.reload();
    }
  };

  A.generarCodigo = numero => rpc('admin', 'admin_generar_codigo', { p_numero: +numero });

  /* ------------------------------------------------- alumno: cerrar sesión */
  A.cerrarSesionAlumno = async function () {
    if (leer(K.cuenta)) await A.sincronizar(false);
    const s = leer(K.sesion);
    if (s) { try { await pedir('/auth/v1/logout?scope=local', {}, s.access_token, 5000); } catch (e) {} }
    olvidarCuenta();
    await MIRU.contenido.olvidarLlave();
    global.location.reload();
  };

  /* ================================================= arranque y latido */
  let tLatido = null, tSync = null, sincronizando = false, repetir = false;

  function vincularPerfil() {
    const cuenta = leer(K.cuenta); if (!cuenta) return;
    const vinc = leer(K.vinculos) || {};
    const lista = P().perfiles();
    let id = vinc[cuenta.alumnoId];
    if (!id || !lista.some(x => x.id === id)) {
      const act = P().perfilActivo();
      const ocupados = new Set(Object.keys(vinc).filter(k => k !== cuenta.alumnoId).map(k => vinc[k]));
      id = act && !ocupados.has(act.id) ? act.id : P().crearPerfil(cuenta.nombre);
      vinc[cuenta.alumnoId] = id;
      escribir(K.vinculos, vinc);
    }
    if (P().perfilId() !== id) P().cambiarPerfil(id);
    cuenta.perfilId = id;
    escribir(K.cuenta, cuenta);
  }

  /** ¿Sigue activo este dispositivo? true / false (se cerró) / null (sin red). */
  async function comprobar() {
    const cuenta = leer(K.cuenta); if (!cuenta) return false;
    let r;
    try { r = await rpc('sesion', 'latido', { p_dispositivo: cuenta.dispositivo }); }
    catch (e) {
      if (e.codigo === SIN_SESION) { await expulsar('La sesión de este dispositivo ya no es válida. Pide un código nuevo a la administradora.'); return false; }
      A.estado = e.codigo === SIN_RED ? 'sin-conexion' : 'error'; A.error = e.message; avisar();
      return null;
    }
    if (!r.activo) { await expulsar(r.motivo); return false; }
    if (!(r.cursos || []).some(x => x.curso === CURSO)) {
      await expulsar('Tu acceso a Cirugía I no está vigente. Escríbele a la administradora para renovarlo.');
      return false;
    }
    const c = leer(K.cuenta) || cuenta;
    Object.assign(c, { nombre: r.alumno.nombre, ultimoOk: Date.now(), cursos: r.cursos.map(x => ({ curso: x.curso, hasta: x.hasta, id_llave: x.id_llave })) });
    escribir(K.cuenta, c);
    if (A.estado === 'sin-conexion' || A.estado === 'error') { A.estado = 'pendiente'; avisar(); }
    return true;
  }

  async function expulsar(motivo) {
    clearTimeout(tSync); clearInterval(tLatido);
    olvidarCuenta();
    try { await MIRU.contenido.olvidarLlave(); } catch (e) {}
    A.estado = 'cerrada'; avisar();
    pantallaMensaje('Esta sesión se cerró', motivo || 'Pide un código nuevo a la administradora.',
      'Lo que ya se había sincronizado sigue en tu cuenta y vuelve contigo al activar de nuevo.', 'Activar de nuevo', () => global.location.reload());
  }

  A.iniciar = async function () {
    if (A.modo !== 'supabase') { A.estado = 'local'; return { remoto: false }; }
    if (!configurado()) {
      A.estado = 'error'; A.error = 'Falta configurar Supabase en config.js';
      console.warn('[miru] modo supabase sin url o clave pública en config.js');
      return { remoto: false };
    }
    if (!leer(K.cuenta) && !leer(K.admin)) {
      if (CFG.contenido === 'cifrado') {
        // Llave guardada pero sin cuenta (datos borrados a medias): se activa de nuevo
        await MIRU.contenido.olvidarLlave();
        global.location.reload();
        return new Promise(() => {});
      }
      await A.pantallaAcceso({});
    }
    if (leer(K.cuenta)) {
      vincularPerfil();
      A.estado = 'pendiente';
      const cuenta = leer(K.cuenta);
      if (Date.now() - (cuenta.ultimoOk || 0) > DIAS_SIN_RED * 864e5) {
        // Mucho tiempo sin comprobar el acceso: hace falta internet una vez
        let ok = await comprobar();
        while (ok === null) { await pantallaSinRed(); ok = await comprobar(); }
        if (ok) A.sincronizar(true);
      } else {
        comprobar().then(ok => { if (ok) A.sincronizar(true); });
      }
      tLatido = setInterval(() => { if (!document.hidden) comprobar(); }, LATIDO_MS);
      global.addEventListener('online', () => comprobar().then(ok => { if (ok) A.sincronizar(true); }));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (A.estado === 'pendiente') { clearTimeout(tSync); A.sincronizar(false); } }
        else comprobar().then(ok => { if (ok) A.sincronizar(true); });
      });
    } else {
      A.estado = 'admin';
      rpc('admin', 'es_admin', {}).then(es => { if (es === false) A.salirAdmin(); })
        .catch(e => { if (e.codigo === SIN_SESION) A.salirAdmin(); });
    }
    return { remoto: true };
  };

  /* ===================================================== sincronización */
  A.alCambiar = function () {
    if (A.modo !== 'supabase' || !leer(K.cuenta)) return;
    A.estado = 'pendiente'; avisar();
    clearTimeout(tSync);
    tSync = setTimeout(() => A.sincronizar(false), Math.max(1, +CFG.esperaSincronizacion || 3) * 1000);
  };

  /** Sube el progreso del perfil ligado. Con traer=true primero baja el del
      servidor y lo fusiona (nada se pierde: mismas reglas que importar). */
  A.sincronizar = async function (traer) {
    const cuenta = leer(K.cuenta);
    if (A.modo !== 'supabase' || !cuenta || P().perfilId() !== cuenta.perfilId) return false;
    if (sincronizando) { repetir = true; return false; }
    sincronizando = true;
    try {
      let version = cuenta.version || 0;
      if (traer || cuenta.version == null) {
        const r = await rpc('sesion', 'leer_progreso', { p_curso: CURSO });
        if (r.datos && r.version !== cuenta.version) P()._fusionar(r.datos);
        else if (r.version === cuenta.version && P().todo().actualizado === cuenta.subido) {
          A.estado = 'sincronizado'; avisar(); return true;      // nada nuevo en ningún lado
        }
        version = r.version;
      }
      for (let i = 0; i < 4; i++) {
        const datos = P().todo();
        const g = await rpc('sesion', 'guardar_progreso', { p_dispositivo: cuenta.dispositivo, p_curso: CURSO, p_datos: datos, p_version: version });
        if (g.ok) {
          const c = leer(K.cuenta);
          if (c) { c.version = g.version; c.subido = datos.actualizado; c.sincronizado = Date.now(); escribir(K.cuenta, c); }
          A.estado = 'sincronizado'; A.error = ''; avisar();
          return true;
        }
        if (g.motivo === 'dispositivo') { await comprobar(); return false; }
        if (!g.conflicto) break;
        if (g.datos) P()._fusionar(g.datos);   // otro guardado llegó antes: se fusiona y se reintenta
        version = g.version;
      }
      A.estado = 'error'; A.error = 'No se pudo guardar en el servidor.'; avisar();
      return false;
    } catch (e) {
      if (e.estado === 403) { await comprobar(); return false; }
      A.estado = e.codigo === SIN_RED ? 'sin-conexion' : 'error'; A.error = e.message; avisar();
      return false;
    } finally {
      sincronizando = false;
      if (repetir) { repetir = false; A.alCambiar(); }
    }
  };

  /* ============================================================ estado */
  A.etiqueta = function () {
    switch (A.estado) {
      case 'sincronizado': return { t: 'Sincronizado con tu cuenta', i: '☁️' };
      case 'pendiente': return { t: 'Guardado aquí; sincronizando…', i: '⏳' };
      case 'sin-conexion': return { t: 'Sin conexión: se sincroniza al volver', i: '📴' };
      case 'error': return { t: 'No se pudo sincronizar' + (A.error ? ' (' + A.error + ')' : ''), i: '⚠️' };
      case 'admin': return { t: 'Sesión de administradora', i: '🛠' };
      case 'cerrada': return { t: 'Sesión cerrada', i: '🔒' };
      default: return { t: 'Guardado en este dispositivo', i: '💾' };
    }
  };
  function avisar() {
    const e = A.etiqueta();
    document.querySelectorAll('[data-sinc]').forEach(el => { el.textContent = e.i + ' ' + e.t; });
  }
  A.pintarEstado = avisar;

  /* =========================================================== pantallas */
  function montar(html) {
    const v = document.createElement('div');
    v.className = 'acceso';
    v.innerHTML = '<div class="acceso__caja">' + html + '</div>';
    document.body.appendChild(v);
    document.body.classList.add('conAcceso');
    return v;
  }
  function desmontar(v) { v.remove(); if (!document.querySelector('.acceso')) document.body.classList.remove('conAcceso'); }

  function pantallaMensaje(titulo, texto, pie, boton, alPulsar) {
    const v = montar('<div class="acceso__marca"><span class="acceso__logo" aria-hidden="true">miru</span>' +
      '<h1>' + esc(titulo) + '</h1><p>' + esc(texto) + '</p></div>' +
      '<button class="btn btn--pri acceso__enviar" type="button">' + esc(boton) + '</button>' +
      (pie ? '<p class="acceso__pie">' + esc(pie) + '</p>' : ''));
    v.querySelector('button').addEventListener('click', () => alPulsar(v));
    return v;
  }

  function pantallaSinRed() {
    return new Promise(resolve => {
      pantallaMensaje('Conéctate a internet una vez', 'Hace más de ' + DIAS_SIN_RED + ' días que miru no comprueba tu acceso. Conéctate y pulsa «Reintentar»; luego vuelve a funcionar sin internet.',
        'Tu progreso está a salvo en este dispositivo.', 'Reintentar', v => { desmontar(v); resolve(); });
    });
  }

  /** Pantalla de entrada. op: { idLlave, soloAdmin, cancelable }.
      Resuelve con la llave cruda del contenido (o null). */
  A.pantallaAcceso = function (op) {
    op = op || {};
    return new Promise(resolve => {
      const numero = leer(K.ultimoNumero) || '';
      const v = montar(
        '<div class="acceso__marca"><span class="acceso__logo" aria-hidden="true">miru</span><h1 data-tit></h1><p data-sub></p></div>' +
        '<form data-f="alumno" novalidate' + (op.soloAdmin ? ' hidden' : '') + '>' +
        '<label class="acceso__lbl" for="accNumero">Tu número miru</label>' +
        '<input class="acceso__in" id="accNumero" name="numero" autocomplete="username" autocapitalize="characters" spellcheck="false" placeholder="MIRU-0001" value="' + esc(numero) + '">' +
        '<label class="acceso__lbl" for="accCodigo">Código de 1 minuto</label>' +
        '<input class="acceso__in" id="accCodigo" name="codigo" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="ABC-123" maxlength="9">' +
        '<div class="acceso__msg" role="alert"></div>' +
        '<button class="btn btn--pri acceso__enviar" type="submit">Activar</button>' +
        '<p class="acceso__pie">Un dispositivo a la vez: si activas miru en otro, este se cierra. Tu progreso se guarda en tu cuenta y te sigue.</p>' +
        '<button class="acceso__cambio" type="button" data-ir-a="admin">Soy la administradora</button>' +
        '</form>' +
        '<form data-f="admin" novalidate' + (op.soloAdmin ? '' : ' hidden') + '>' +
        '<label class="acceso__lbl" for="accUsuario">Usuario (tu correo)</label>' +
        '<input class="acceso__in acceso__in--libre" id="accUsuario" name="usuario" type="email" autocomplete="username" spellcheck="false" autocapitalize="none">' +
        '<label class="acceso__lbl" for="accClave">Contraseña</label>' +
        '<input class="acceso__in acceso__in--libre" id="accClave" name="clave" type="password" autocomplete="current-password">' +
        '<div class="acceso__msg" role="alert"></div>' +
        '<button class="btn btn--pri acceso__enviar" type="submit">Entrar</button>' +
        (op.soloAdmin ? '' : '<button class="acceso__cambio" type="button" data-ir-a="alumno">Soy alumno</button>') +
        (op.cancelable ? '<button class="acceso__cambio" type="button" data-cancelar>Cancelar</button>' : '') +
        '</form>');
      const fA = v.querySelector('[data-f="alumno"]'), fD = v.querySelector('[data-f="admin"]');
      const tit = v.querySelector('[data-tit]'), sub = v.querySelector('[data-sub]');
      function mostrar(cual) {
        fA.hidden = cual !== 'alumno'; fD.hidden = cual !== 'admin';
        tit.textContent = cual === 'admin' ? 'Entrar como administradora' : 'Activa miru en este dispositivo';
        sub.textContent = cual === 'admin' ? 'Con tu usuario (correo) y contraseña.' : 'Escribe tu número miru y el código de 1 minuto que te da la administradora.';
        const f = cual === 'admin' ? fD : fA;
        setTimeout(() => { const i = [...f.querySelectorAll('input')].find(x => !x.value) || f.querySelector('input'); i.focus(); }, 50);
      }
      mostrar(op.soloAdmin ? 'admin' : 'alumno');
      v.querySelectorAll('[data-ir-a]').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.irA)));
      const cancelar = v.querySelector('[data-cancelar]');
      if (cancelar) cancelar.addEventListener('click', () => { desmontar(v); resolve(null); });

      function enviar(f, accion, texto) {
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const msg = f.querySelector('.acceso__msg'), btn = f.querySelector('[type="submit"]');
          msg.className = 'acceso__msg'; msg.textContent = '';
          btn.disabled = true; btn.textContent = 'Comprobando…';
          try {
            const crudo = await accion();
            desmontar(v); resolve(crudo);
          } catch (err) {
            msg.className = 'acceso__msg acceso__msg--bad'; msg.textContent = err.message;
          } finally { btn.disabled = false; btn.textContent = texto; }
        });
      }
      enviar(fA, () => A.activarCodigo(fA.numero.value, fA.codigo.value, op.idLlave), 'Activar');
      enviar(fD, () => A.entrarAdmin(fD.usuario.value, fD.clave.value, op.idLlave), 'Entrar');
    });
  };

})(window);
