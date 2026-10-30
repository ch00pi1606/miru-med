/* =========================================================================
   miru · PROGRESO Y PERFILES
   · Cada perfil tiene su propio progreso: un único objeto serializable.
   · El progreso apunta a ids estables (preguntas, temas, flashcards…).
     Actualizar el contenido NUNCA escribe aquí.
   · Tiene número de esquema y migraciones que nunca borran datos.
   · Respaldo automático (IndexedDB) antes de migrar, al llegar contenido
     nuevo y una vez al día.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;

  const PRE = 'miru.v1.';
  const CLAVE_PERFILES = PRE + 'perfiles';
  const ESQUEMA = 1;              // versión del formato del progreso
  const MAX_SIMULACROS = 120, MAX_PASITOS = 400, MAX_EXAMENES = 100, MAX_ORAL = 200;

  /* --------------------------------------------------------------- base */
  let disponible = true;
  function ls(k, v) {
    try {
      if (v === undefined) return global.localStorage.getItem(k);
      if (v === null) { global.localStorage.removeItem(k); return null; }
      global.localStorage.setItem(k, v); return v;
    } catch (e) { disponible = false; return null; }
  }
  const leerJSON = (k, def) => { try { const s = ls(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } };

  const vacio = () => ({
    esquema: ESQUEMA,
    version: 1,                 // compatibilidad con el módulo «Cirugía I»
    app: 'miru',
    creado: Date.now(),
    actualizado: Date.now(),
    perfil: { nombre: '', tema: 'auto', inicioGeneralidades: '' },
    temas: {},        // temaId → { visto, seccionesVistas:[], completado, ts }
    preguntas: {},    // preguntaId → { intentos, aciertos, fallos, ultima, ultimaRespuesta, ultimoAcierto, temaId, claseId, moduloId }
    flashcards: {},   // fcId → { estado:'nose'|'dudo'|'se', repasos, ts }
    casos: {},
    esquemas: {},
    pasitos: [],      // { id, temaId, fecha, aciertos, total, items:[{id, ok}] }
    simulacros: [],   // { id, tipo, moduloId?, fecha, nota, aciertos, total, duracionSeg, porTiempo, porModulo, items }
    sesion: null,     // simulacro en curso
    examenes: [],
    oral: [],
    ultimaVisita: null
  });

  /* ----------------------------------------------------------- migraciones
     Cada función recibe el objeto en la versión N y lo deja en la N+1.
     Regla: añadir o transformar, nunca borrar. */
  const MIGRACIONES = {
    // 0 → 1: progreso exportado por el módulo «Cirugía I» (sin campo esquema)
    0: o => {
      const r = Object.assign(vacio(), o);
      Object.values(r.preguntas || {}).forEach(x => { if (x.ultimaOpcion != null && x.ultimaRespuesta == null) x.ultimaRespuesta = x.ultimaOpcion; });
      r.esquema = 1;
      return r;
    }
  };

  function migrar(o) {
    if (!o || typeof o !== 'object') return vacio();
    let v = typeof o.esquema === 'number' ? o.esquema : 0;
    let r = o;
    while (v < ESQUEMA) {
      const f = MIGRACIONES[v];
      r = f ? f(r) : Object.assign(vacio(), r, { esquema: v + 1 });
      v = r.esquema;
    }
    // Garantiza que existan todas las claves sin pisar las que hay
    const base = vacio();
    Object.keys(base).forEach(k => { if (r[k] === undefined) r[k] = base[k]; });
    r.perfil = Object.assign(base.perfil, r.perfil || {});
    return r;
  }

  /* -------------------------------------------------------------- perfiles */
  function perfiles() {
    const p = leerJSON(CLAVE_PERFILES, null);
    return p && Array.isArray(p.lista) ? p : { activo: null, lista: [] };
  }
  function guardarPerfiles(p) { ls(CLAVE_PERFILES, JSON.stringify(p)); }
  const claveProgreso = id => PRE + 'progreso.' + id;

  let perfilId = null;
  let estado = vacio();

  function cargar(id) {
    perfilId = id;
    const crudo = leerJSON(claveProgreso(id), null);
    if (crudo && (crudo.esquema || 0) < ESQUEMA) {
      respaldar('antes de migrar el progreso', JSON.stringify(crudo));
      estado = migrar(crudo);
      persistirYa();
    } else {
      estado = crudo ? migrar(crudo) : vacio();
    }
  }

  /* ------------------------------------------------------------- guardado */
  let pendiente = null;
  const oyentes = [];

  function persistirYa() {
    if (!perfilId) return;
    try { global.localStorage.setItem(claveProgreso(perfilId), JSON.stringify(estado)); }
    catch (e) { disponible = false; console.warn('[miru] no se pudo guardar el progreso', e); }
  }

  function guardar() {
    estado.actualizado = Date.now();
    clearTimeout(pendiente);
    pendiente = setTimeout(persistirYa, 150);
    if (MIRU.almacen && MIRU.almacen.alCambiar) { try { MIRU.almacen.alCambiar(); } catch (e) {} }
  }
  // Nada se pierde al cerrar la pestaña con un guardado pendiente.
  if (global.addEventListener) {
    global.addEventListener('pagehide', () => { if (pendiente) { clearTimeout(pendiente); persistirYa(); } });
    global.addEventListener('visibilitychange', () => { if (global.document && global.document.hidden && pendiente) { clearTimeout(pendiente); persistirYa(); } });
  }

  /* ------------------------------------------------------------ respaldos */
  function db() {
    return new Promise((ok, mal) => {
      if (!global.indexedDB) { mal(new Error('sin IndexedDB')); return; }
      const r = global.indexedDB.open('miru', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('respaldos')) {
          const s = d.createObjectStore('respaldos', { keyPath: 'id' });
          s.createIndex('perfil', 'perfilId');
        }
        if (!d.objectStoreNames.contains('llaves')) d.createObjectStore('llaves');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  MIRU.db = db;

  async function respaldar(motivo, texto) {
    if (!perfilId) return;
    try {
      const d = await db();
      const reg = { id: perfilId + '|' + Date.now(), perfilId, ts: Date.now(), motivo, datos: texto || JSON.stringify(estado) };
      await new Promise((ok, mal) => {
        const tx = d.transaction('respaldos', 'readwrite');
        tx.objectStore('respaldos').put(reg);
        tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
      });
      // Conserva los 8 más recientes de este perfil
      const lista = await listarRespaldos();
      if (lista.length > 8) {
        const tx = d.transaction('respaldos', 'readwrite');
        lista.slice(8).forEach(x => tx.objectStore('respaldos').delete(x.id));
      }
      ls(PRE + 'ultimoRespaldo.' + perfilId, String(Date.now()));
    } catch (e) { /* sin IndexedDB: el progreso sigue en localStorage */ }
  }

  async function listarRespaldos() {
    try {
      const d = await db();
      return await new Promise((ok, mal) => {
        const out = [];
        const tx = d.transaction('respaldos', 'readonly');
        const req = tx.objectStore('respaldos').index('perfil').openCursor(IDBKeyRange.only(perfilId));
        req.onsuccess = () => { const c = req.result; if (c) { out.push({ id: c.value.id, ts: c.value.ts, motivo: c.value.motivo, bytes: c.value.datos.length }); c.continue(); } else ok(out.sort((a, b) => b.ts - a.ts)); };
        req.onerror = () => mal(req.error);
      });
    } catch (e) { return []; }
  }

  async function leerRespaldo(id) {
    const d = await db();
    return new Promise((ok, mal) => {
      const req = d.transaction('respaldos', 'readonly').objectStore('respaldos').get(id);
      req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error);
    });
  }

  /* ------------------------------------------------------------- fusión
     Mismas reglas que backend: unión de secciones, máximo de contadores,
     el estado más reciente gana por elemento, históricos que se acumulan. */
  function fusionar(l, remoto) {
    const r = migrar(JSON.parse(JSON.stringify(remoto)));
    const mayor = (a, b) => ((a || 0) > (b || 0) ? a : b);

    r.perfil = (l.actualizado || 0) > (r.actualizado || 0)
      ? Object.assign({}, r.perfil, l.perfil) : Object.assign({}, l.perfil, r.perfil);

    Object.entries(l.temas || {}).forEach(([id, a]) => {
      const b = r.temas[id];
      if (!b) { r.temas[id] = a; return; }
      const gana = (a.ts || 0) > (b.ts || 0) ? a : b;
      r.temas[id] = Object.assign({}, b, gana, {
        visto: !!(a.visto || b.visto),
        completado: !!gana.completado,
        seccionesVistas: [...new Set((b.seccionesVistas || []).concat(a.seccionesVistas || []))],
        ts: mayor(a.ts, b.ts)
      });
    });

    Object.entries(l.preguntas || {}).forEach(([id, a]) => {
      const b = r.preguntas[id];
      if (!b) { r.preguntas[id] = a; return; }
      const gana = (a.ultima || 0) >= (b.ultima || 0) ? a : b;
      r.preguntas[id] = Object.assign({}, b, gana, {
        intentos: Math.max(a.intentos || 0, b.intentos || 0),
        aciertos: Math.max(a.aciertos || 0, b.aciertos || 0),
        fallos: Math.max(a.fallos || 0, b.fallos || 0),
        ultima: mayor(a.ultima, b.ultima)
      });
    });

    Object.entries(l.flashcards || {}).forEach(([id, a]) => {
      const b = r.flashcards[id];
      if (!b) { r.flashcards[id] = a; return; }
      const gana = (a.ts || 0) >= (b.ts || 0) ? a : b;
      r.flashcards[id] = Object.assign({}, b, gana, { repasos: Math.max(a.repasos || 0, b.repasos || 0), ts: mayor(a.ts, b.ts) });
    });

    ['casos', 'esquemas'].forEach(k => {
      Object.entries(l[k] || {}).forEach(([id, a]) => {
        const b = r[k][id];
        if (!b) { r[k][id] = a; return; }
        r[k][id] = Object.assign({}, b, a, {
          completado: !!(a.completado || b.completado),
          explorado: !!(a.explorado || b.explorado),
          ts: mayor(a.ts, b.ts)
        });
      });
    });

    ['pasitos', 'simulacros', 'examenes', 'oral'].forEach(k => {
      const clave = x => x.id || (x.temaId + '|' + x.fecha);
      const vistos = new Set((r[k] || []).map(clave));
      (l[k] || []).forEach(x => { if (!vistos.has(clave(x))) { r[k].push(x); vistos.add(clave(x)); } });
      r[k].sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
    });

    // La sesión en curso es local: gana la más reciente.
    if (l.sesion && (!r.sesion || (l.sesion.inicio || 0) >= (r.sesion.inicio || 0))) r.sesion = l.sesion;
    r.actualizado = mayor(l.actualizado, r.actualizado);
    return r;
  }

  /* ------------------------------------------------------------------ API */
  const P = MIRU.progreso = {
    ESQUEMA,
    disponible: () => disponible,
    todo: () => estado,
    guardar,
    migrar,
    fusionarObjetos: fusionar,

    /* --- perfiles --- */
    perfiles: () => perfiles().lista,
    perfilActivo() { const p = perfiles(); return p.lista.find(x => x.id === p.activo) || null; },
    iniciar() {
      const p = perfiles();
      if (p.activo && p.lista.some(x => x.id === p.activo)) { cargar(p.activo); return true; }
      return false;   // hay que crear o elegir un perfil
    },
    crearPerfil(nombre) {
      const p = perfiles();
      const id = 'per-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      p.lista.push({ id, nombre: String(nombre || 'Yo').trim().slice(0, 40), creado: Date.now() });
      p.activo = id;
      guardarPerfiles(p);
      cargar(id);
      estado.perfil.nombre = String(nombre || '').trim().slice(0, 40);
      persistirYa();
      return id;
    },
    cambiarPerfil(id) {
      const p = perfiles();
      if (!p.lista.some(x => x.id === id)) return false;
      clearTimeout(pendiente); persistirYa();
      p.activo = id; guardarPerfiles(p);
      cargar(id);
      oyentes.forEach(f => { try { f(estado); } catch (e) {} });
      return true;
    },
    renombrarPerfil(id, nombre) {
      const p = perfiles();
      const x = p.lista.find(y => y.id === id); if (!x) return;
      x.nombre = String(nombre).trim().slice(0, 40); guardarPerfiles(p);
      if (id === perfilId) { estado.perfil.nombre = x.nombre; guardar(); }
    },
    async eliminarPerfil(id) {
      const p = perfiles();
      const x = p.lista.find(y => y.id === id); if (!x) return;
      // Respaldo antes de borrar: se puede recuperar desde otro perfil importándolo.
      const previo = perfilId; perfilId = id;
      await respaldar('antes de eliminar el perfil «' + x.nombre + '»', ls(claveProgreso(id)) || '{}');
      perfilId = previo;
      ls(claveProgreso(id), null);
      p.lista = p.lista.filter(y => y.id !== id);
      if (p.activo === id) p.activo = p.lista[0] ? p.lista[0].id : null;
      guardarPerfiles(p);
      if (p.activo) cargar(p.activo); else { perfilId = null; estado = vacio(); }
    },
    perfilId: () => perfilId,

    /* --- respaldos --- */
    respaldar, listarRespaldos,
    async restaurarRespaldo(id) {
      const r = await leerRespaldo(id);
      if (!r) throw new Error('Respaldo no encontrado');
      await respaldar('antes de restaurar un respaldo');
      estado = migrar(JSON.parse(r.datos));
      persistirYa();
      oyentes.forEach(f => { try { f(estado); } catch (e) {} });
    },
    async respaldoDiario() {
      const u = +(ls(PRE + 'ultimoRespaldo.' + perfilId) || 0);
      if (Date.now() - u > 20 * 3600 * 1000) await respaldar('respaldo diario');
    },
    solicitarPersistencia() {
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    },

    /* --- exportar / importar --- */
    exportar() {
      const per = P.perfilActivo();
      return JSON.stringify(Object.assign({}, estado, {
        _exportado: { app: 'miru', fecha: Date.now(), perfil: per ? per.nombre : '', esquema: ESQUEMA }
      }), null, 1);
    },
    /** Importa un progreso. Por defecto lo FUSIONA con el actual (no se pierde nada). */
    async importar(txt, reemplazar) {
      const p = JSON.parse(txt);
      if (!p || typeof p !== 'object' || !(p.preguntas || p.temas)) throw new Error('El archivo no es un progreso de miru');
      await respaldar('antes de importar un progreso');
      estado = reemplazar ? migrar(p) : fusionar(estado, p);
      persistirYa();
      oyentes.forEach(f => { try { f(estado); } catch (e) {} });
    },
    async reiniciar() {
      await respaldar('antes de borrar el progreso');
      const perfil = estado.perfil;
      estado = vacio(); estado.perfil = perfil;
      persistirYa();
    },

    /** Sustitución tras sincronizar con el servidor (no vuelve a avisar al almacén). */
    _reemplazar(nuevo) {
      estado = migrar(nuevo);
      persistirYa();
      oyentes.forEach(f => { try { f(estado); } catch (e) {} });
    },
    _fusionar(remoto) { P._reemplazar(fusionar(estado, remoto)); },
    alReemplazar(fn) { oyentes.push(fn); },

    /* --- perfil y preferencias --- */
    perfil: k => estado.perfil[k],
    ponerPerfil(k, v) { estado.perfil[k] = v; guardar(); },
    visitar(ruta) { estado.ultimaVisita = { ruta, ts: Date.now() }; guardar(); },

    /* --- temas y láminas --- */
    tema(id) { return estado.temas[id] || (estado.temas[id] = { visto: false, seccionesVistas: [], completado: false, ts: 0 }); },
    marcarTemaVisto(id) { const t = P.tema(id); if (!t.visto) { t.visto = true; t.ts = Date.now(); guardar(); } },
    marcarSeccion(temaId, secId) {
      const t = P.tema(temaId);
      if (!t.seccionesVistas.includes(secId)) { t.seccionesVistas.push(secId); t.ts = Date.now(); guardar(); }
    },
    seccionVista(temaId, secId) { const t = estado.temas[temaId]; return !!(t && t.seccionesVistas.includes(secId)); },
    completarTema(id, v) { const t = P.tema(id); t.completado = v !== false; t.ts = Date.now(); guardar(); },

    /* --- preguntas --- */
    registrarRespuesta(pregunta, acerto, respuesta, ctx) {
      const id = pregunta.id;
      const r = estado.preguntas[id] || (estado.preguntas[id] = { intentos: 0, aciertos: 0, fallos: 0, ultima: 0 });
      r.intentos++;
      if (acerto) r.aciertos++; else r.fallos++;
      r.ultimoAcierto = !!acerto;
      r.ultima = Date.now();
      r.ultimaRespuesta = respuesta == null ? null : respuesta;
      r.temaId = pregunta.temaId; r.claseId = pregunta.claseId; r.moduloId = pregunta.moduloId;
      if (ctx && ctx.modo) r.ultimoModo = ctx.modo;
      guardar();
      return r;
    },
    pregunta: id => estado.preguntas[id] || null,
    /** Preguntas cuyo ÚLTIMO intento fue fallido → «Necesitas repasar» */
    falladas(moduloId) {
      return Object.entries(estado.preguntas)
        .filter(([id, r]) => r.ultimoAcierto === false && MIRU.pregunta(id))
        .filter(([, r]) => !moduloId || r.moduloId === moduloId)
        .map(([id, r]) => Object.assign({ id }, r))
        .sort((a, b) => (b.fallos - a.fallos) || (b.ultima - a.ultima));
    },

    /* --- flashcards --- */
    flashcard: id => estado.flashcards[id] || null,
    marcarFlashcard(id, val, ctx) {
      const f = estado.flashcards[id] || (estado.flashcards[id] = { estado: null, repasos: 0, ts: 0 });
      f.estado = val; f.repasos++; f.ts = Date.now();
      if (ctx) { f.temaId = ctx.temaId; f.moduloId = ctx.moduloId; }
      guardar();
    },

    /* --- casos y esquemas --- */
    completarCaso(id, ctx) {
      const c = estado.casos[id] || (estado.casos[id] = { completado: false, ts: 0 });
      c.completado = true; c.ts = Date.now(); if (ctx) c.moduloId = ctx.moduloId; guardar();
    },
    caso: id => estado.casos[id] || null,
    explorarEsquema(id, ctx) {
      const e = estado.esquemas[id] || (estado.esquemas[id] = { explorado: false, ts: 0 });
      e.explorado = true; e.ts = Date.now(); if (ctx) e.moduloId = ctx.moduloId; guardar();
    },
    esquema: id => estado.esquemas[id] || null,

    /* --- pasitos --- */
    guardarPasito(x) { estado.pasitos.push(x); while (estado.pasitos.length > MAX_PASITOS) estado.pasitos.shift(); guardar(); },
    pasitos: temaId => estado.pasitos.filter(x => !temaId || x.temaId === temaId),
    pasitoAprobado: temaId => estado.pasitos.some(x => x.temaId === temaId && x.aprobado),

    /* --- simulacros --- */
    sesion: () => estado.sesion,
    ponerSesion(s) { estado.sesion = s; guardar(); },
    guardarSesionYa(s) { estado.sesion = s; estado.actualizado = Date.now(); persistirYa(); },
    guardarSimulacro(x) {
      estado.simulacros.push(x);
      while (estado.simulacros.length > MAX_SIMULACROS) estado.simulacros.shift();
      estado.sesion = null;
      guardar(); clearTimeout(pendiente); persistirYa();
    },
    simulacros: tipo => estado.simulacros.filter(x => !tipo || x.tipo === tipo),

    /* --- exámenes (módulo) y oral --- */
    guardarExamen(x) { estado.examenes.push(x); while (estado.examenes.length > MAX_EXAMENES) estado.examenes.shift(); guardar(); },
    examenes: () => estado.examenes.slice().reverse(),
    guardarOral(x) { estado.oral.push(x); while (estado.oral.length > MAX_ORAL) estado.oral.shift(); guardar(); },
    orales: () => estado.oral.slice().reverse()
  };

  /* -----------------------------------------------------------------------
     CÁLCULO DE PROGRESO
     Láminas vistas 35 % · preguntas acertadas 35 % · pasito aprobado 15 %
     · flashcards dominadas 15 %. Solo cuenta lo que el tema tiene.
     ----------------------------------------------------------------------- */
  function pctTema(tema) {
    const t = estado.temas[tema.id];
    const idsLam = (tema.laminas || []).map(l => 'lam-' + l.id)
      .concat((tema.secciones || []).map((s, i) => (s.tipo === 'pregunta' || s.tipo === 'caso') ? null : 'sec-' + tema.id + '-' + i).filter(Boolean));
    const vistas = t ? idsLam.filter(id => t.seccionesVistas.includes(id)).length : 0;
    const preg = MIRU.preguntasDeTema(tema.id).filter(p => !(p.usos || []).includes('caso'));
    const acertadas = preg.filter(p => { const r = estado.preguntas[p.id]; return r && r.ultimoAcierto; }).length;
    const fcs = tema.flashcards || [];
    const dom = fcs.filter(f => { const x = estado.flashcards[f.id]; return x && x.estado === 'se'; }).length;
    const pasito = P.pasitoAprobado(tema.id);

    let p = 0, peso = 0;
    if (idsLam.length) { p += 35 * vistas / idsLam.length; peso += 35; }
    if (preg.length) { p += 35 * acertadas / preg.length; peso += 35; p += pasito ? 15 : 0; peso += 15; }
    if (fcs.length) { p += 15 * dom / fcs.length; peso += 15; }
    return {
      pct: peso ? Math.round(p / peso * 100) : 0,
      laminas: [vistas, idsLam.length],
      preguntas: [acertadas, preg.length],
      flashcards: [dom, fcs.length],
      pasito
    };
  }

  MIRU.pct = {
    tema: (clase, tema) => pctTema(tema || clase),
    clase(c) {
      const ts = (c.temas || []).filter(t => { const i = MIRU.inventarioTema(t); return i.laminas || i.secciones || i.preguntas || i.flashcards; });
      if (!ts.length) return { pct: 0, temas: [0, 0] };
      const vals = ts.map(t => pctTema(t).pct);
      return { pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), temas: [vals.filter(v => v >= 80).length, ts.length] };
    },
    modulo(moduloId) {
      const cs = MIRU.clasesDe(moduloId).filter(MIRU.claseConContenido);
      if (!cs.length) return { pct: 0, clases: [0, 0] };
      const vals = cs.map(c => MIRU.pct.clase(c).pct);
      return { pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), clases: [vals.filter(v => v >= 80).length, cs.length] };
    },
    bloque(bloqueId) {
      const ms = MIRU.modulosDe(bloqueId).filter(m => MIRU.clasesDe(m.id).some(MIRU.claseConContenido));
      if (!ms.length) return 0;
      return Math.round(ms.map(m => MIRU.pct.modulo(m.id).pct).reduce((a, b) => a + b, 0) / ms.length);
    },
    curso() {
      const bs = MIRU.datos.bloques.filter(b => MIRU.modulosDe(b.id).length);
      if (!bs.length) return 0;
      return Math.round(bs.map(b => MIRU.pct.bloque(b.id)).reduce((a, b) => a + b, 0) / bs.length);
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
