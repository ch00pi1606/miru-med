/* =========================================================================
   miru · SUGERENCIAS — «¿Cómo mejorarías miru?»
   · El alumno escribe su idea, error o pedido en #/sugerir y ve ahí mismo
     el estado de las que ya mandó y la respuesta de la administradora.
   · La administradora las lee, responde y archiva desde Administración.
   Los datos van por MIRU.almacen.sugerencias (Supabase o este navegador).
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const V = MIRU.vistas;
  const AL = () => MIRU.almacen;
  const BORRADOR = 'miru.v1.borradorSugerencia';
  const MAX = 1000;

  const CATEGORIAS = [
    ['idea', 'Idea'], ['error', 'Algo no funciona'], ['contenido', 'Contenido'], ['diseno', 'Diseño'], ['otro', 'Otro']
  ];
  const nombreCat = c => (CATEGORIAS.find(x => x[0] === c) || [c, 'Otro'])[1];
  const ESTADOS = { nueva: 'Nueva', leida: 'Leída', en_curso: 'En curso', hecha: 'Hecha', archivada: 'Archivada' };
  const ESTADO_ALUMNO = { nueva: 'Enviada', leida: 'Leída', en_curso: 'En curso', hecha: 'Hecha', archivada: 'Cerrada' };
  const etiEstado = (e, txt) => '<span class="eti eti--' + U.esc(e) + '">' + U.esc((txt || ESTADOS)[e] || e) + '</span>';

  /** Nombre legible de una ruta de miru (para saber dónde estaba el alumno). */
  function nombrePantalla(ruta) {
    if (!ruta) return '';
    const p = String(ruta).replace(/^#\//, '').split('/');
    try {
      if (p[0] === 'tema' && p[3]) { const r = MIRU.temaPorId(p[3]); if (r) return r.tema.nombre; }
      if (p[0] === 'clase' && p[2]) { const c = MIRU.clase(p[2]); if (c) return 'Clase ' + (c.numero || ''); }
      if (p[0] === 'modulo' && p[1]) { const m = MIRU.modulo(p[1]); if (m) return m.nombre; }
      if (p[0] === 'bloque' && p[1]) { const b = MIRU.bloque(p[1]); if (b) return b.nombre; }
      if (p[0] === 'pasito' && p[1]) { const r = MIRU.temaPorId(p[1]); if (r) return 'Pasito · ' + r.tema.nombre; }
      if ((p[0] === 'practica-tema' || p[0] === 'practica') && p[1]) { const r = MIRU.temaPorId(p[1]); const c = MIRU.clase(p[1]); return 'Práctica · ' + (r ? r.tema.nombre : c ? c.nombre : ''); }
      if (p[0] === 'oral' && p[1]) { const m = MIRU.modulo(p[1]); if (m) return 'Oral · ' + m.nombre; }
      if (p[0] === 'resultado') return 'Resultado';
      if (/^simulacro/.test(p[0])) return 'Simulacro';
    } catch (e) { /* contenido aún no cargado */ }
    const fijas = { '': 'Mi semestre', cursos: 'Cursos', simulacros: 'Simulacros', repaso: 'Necesitas repasar', flashcards: 'Flashcards',
      estadisticas: 'Estadísticas', perfil: 'Mi perfil', admin: 'Administración', sugerir: 'Sugerir una mejora', reintentar: 'Reintento' };
    return fijas[p[0] || ''] || ruta;
  }

  const S = MIRU.sugerencias = { rutaAnterior: '', nombrePantalla, nuevas: 0 };

  /* =================================================== vista del alumno */
  V.sugerir = function () {
    const desde = S.rutaAnterior && !/^#\/sugerir/.test(S.rutaAnterior) ? S.rutaAnterior : '';
    let borrador = { categoria: 'idea', texto: '' };
    try { borrador = Object.assign(borrador, JSON.parse(global.localStorage.getItem(BORRADOR) || '{}')); } catch (e) {}
    const sb = AL().modo === 'supabase';
    const cuenta = sb ? AL().cuenta() : null;
    const admin = MIRU.admin && MIRU.admin.activo();

    if (!AL().sugerencias.puedeEnviar()) {
      return '<header class="titulo-grande"><h1>Sugerir una mejora</h1></header>' +
        (admin
          ? MIRU.ui.vacio('burbuja', 'Estás como administradora', 'Las sugerencias de tus alumnos llegan a <a href="#/admin">Administración</a>.')
          : MIRU.ui.vacio('candado', 'Activa miru primero', 'Para enviar sugerencias, entra con tu número miru y el código de 1 minuto.'));
    }

    return '<header class="titulo-grande"><h1>Sugerir una mejora</h1>' +
      '<p>¿Qué cambiarías de miru? La administradora lee cada mensaje y te responde aquí.</p></header>' +
      '<form class="tj sug-form" data-form="sugerencia" novalidate>' +
      '<div class="campo"><span class="campo__l" id="sug-cat">Tipo</span>' +
      '<div class="chips" role="radiogroup" aria-labelledby="sug-cat">' +
      CATEGORIAS.map(([v, t]) => '<button type="button" class="chip" role="radio" data-cat="' + v + '" aria-checked="' + (borrador.categoria === v) + '">' + t + '</button>').join('') +
      '</div></div>' +
      '<label class="campo"><span class="campo__l">Tu sugerencia</span>' +
      '<textarea name="texto" maxlength="' + MAX + '" required placeholder="Por ejemplo: me gustaría poder marcar láminas como favoritas…">' + U.esc(borrador.texto || '') + '</textarea>' +
      '<span class="campo__pie"><span>' + (cuenta ? 'Se envía con tu número miru (' + U.esc(cuenta.codigo) + ') y tu nombre.' : sb ? '' : 'En esta versión de prueba se guarda en este dispositivo.') + '</span>' +
      '<span data-cuenta>' + (borrador.texto || '').length + ' / ' + MAX + '</span></span></label>' +
      (desde ? '<label class="interruptor"><span class="interruptor__tx">Incluir la pantalla donde estaba<span>' + U.esc(nombrePantalla(desde)) + '</span></span>' +
        '<input type="checkbox" name="conPantalla" checked data-ruta="' + U.esc(desde) + '"></label>' : '') +
      '<div class="tira"><button class="boton" type="submit">' + MIRU.icono('enviar') + ' Enviar</button></div>' +
      '</form>' +
      '<section class="grupo" aria-labelledby="t-mias"><div class="grupo__cab"><h2 class="grupo__t" id="t-mias">Tus sugerencias</h2></div>' +
      '<div data-mias><p class="grupo__pie">Cargando…</p></div></section>';
  };

  function htmlMias(lista) {
    if (!lista.length) return '<p class="grupo__pie">Aún no has enviado ninguna. Las que envíes aparecerán aquí con su estado.</p>';
    return '<div class="sug-lista">' + lista.map(s =>
      '<article class="sug"><div class="sug__cab"><span class="eti eti--neu">' + U.esc(nombreCat(s.categoria)) + '</span>' +
      etiEstado(s.estado, ESTADO_ALUMNO) + '<time datetime="' + U.esc(s.creado_en) + '">' + U.fechaCorta(s.creado_en) + '</time></div>' +
      '<p class="sug__tx">' + U.esc(s.texto) + '</p>' +
      (s.respuesta ? '<div class="sug__resp"><b>Respuesta de la administradora</b>' + U.esc(s.respuesta) + '</div>' : '') +
      '</article>').join('') + '</div>';
  }

  async function pintarMias(raiz) {
    const el = raiz.querySelector('[data-mias]'); if (!el) return;
    try { el.innerHTML = htmlMias(await AL().sugerencias.mias()); }
    catch (e) { el.innerHTML = '<p class="grupo__pie">No se pudieron cargar tus sugerencias: ' + U.esc(e.message) + '</p>'; }
  }

  S.activar = function (raiz) {
    const f = raiz.querySelector('[data-form="sugerencia"]');
    pintarMias(raiz);
    if (!f) return;
    const ta = f.texto, cuenta = f.querySelector('[data-cuenta]');
    let cat = (f.querySelector('.chip[aria-checked="true"]') || f.querySelector('.chip')).dataset.cat;
    const guardar = () => { try { global.localStorage.setItem(BORRADOR, JSON.stringify({ categoria: cat, texto: ta.value })); } catch (e) {} };
    f.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      f.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      guardar();
    }));
    ta.addEventListener('input', () => { cuenta.textContent = ta.value.length + ' / ' + MAX; guardar(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('[type="submit"]');
      const chk = f.querySelector('[name="conPantalla"]');
      btn.disabled = true;
      try {
        await AL().sugerencias.enviar({
          categoria: cat, texto: ta.value,
          pantalla: chk && chk.checked ? chk.dataset.ruta : null,
          version: MIRU.contenido && MIRU.contenido.version, dispositivo: AL().etiquetaDispositivo()
        });
        try { global.localStorage.removeItem(BORRADOR); } catch (err) {}
        ta.value = ''; cuenta.textContent = '0 / ' + MAX;
        MIRU.ui.aviso('<strong>¡Gracias!</strong> Tu sugerencia llegó a la administradora.');
        pintarMias(raiz);
      } catch (err) {
        MIRU.ui.aviso(U.esc(err.message) + (err.codigo === 'sin_red' ? ' Tu texto quedó guardado aquí.' : ''), 'mal');
      }
      btn.disabled = false;
    });
  };

  /* ============================================== panel de administración */
  const FILTROS = [[null, 'Activas'], ['nueva', 'Nuevas'], ['en_curso', 'En curso'], ['hecha', 'Hechas'], ['archivada', 'Archivadas'], ['todas', 'Todas']];

  S.htmlAdmin = function () {
    return '<div class="tj" id="sugerencias"><h3>' + MIRU.icono('burbuja') + ' Sugerencias de los alumnos</h3>' +
      '<p class="nota">Lo que proponen para mejorar miru. ' + (AL().modo === 'supabase'
        ? 'Cada una llega con el número miru y el nombre de quien la envió.'
        : 'En modo local solo ves las enviadas desde este navegador; con Supabase llegan las de todos tus alumnos.') + '</p>' +
      '<div class="chips" role="group" aria-label="Filtrar sugerencias" data-sug-filtros>' +
      FILTROS.map(([v, t], i) => '<button type="button" class="chip" data-estado="' + (v || '') + '" aria-pressed="' + (i === 0) + '">' + t + '<span class="chip__n" data-n="' + (v || 'activas') + '"></span></button>').join('') +
      '</div><div data-sug class="sug-caja"><p class="nota">Cargando…</p></div></div>';
  };

  function htmlItem(s) {
    const quien = s.alumno ? U.esc(s.alumno.codigo) + (s.alumno.nombre ? ' · ' + U.esc(s.alumno.nombre) : '') : 'Alumno eliminado';
    const pant = s.pantalla ? '<a href="' + U.esc(s.pantalla) + '">' + U.esc(nombrePantalla(s.pantalla)) + '</a>' : '';
    const meta = [pant ? 'Pantalla: ' + pant : '', s.version ? 'Versión ' + U.esc(s.version) : '', s.dispositivo ? U.esc(s.dispositivo) : ''].filter(Boolean).join(' · ');
    const b = (est, txt, pri) => s.estado === est ? '' : '<button class="btn btn--sm' + (pri ? ' btn--pri' : '') + '" type="button" data-sug-acc="' + est + '" data-id="' + s.id + '">' + txt + '</button>';
    return '<article class="sug' + (s.estado === 'nueva' ? ' sug--nueva' : '') + '" data-sug-id="' + s.id + '">' +
      '<div class="sug__cab"><span class="sug__quien">' + quien + '</span><span class="eti eti--neu">' + U.esc(nombreCat(s.categoria)) + '</span>' +
      etiEstado(s.estado) + '<time datetime="' + U.esc(s.creado_en) + '">' + U.fechaCorta(s.creado_en) + '</time></div>' +
      '<p class="sug__tx">' + U.esc(s.texto) + '</p>' +
      (meta ? '<p class="sug__meta">' + meta + '</p>' : '') +
      (s.respuesta ? '<div class="sug__resp"><b>Tu respuesta</b>' + U.esc(s.respuesta) + '</div>' : '') +
      '<div class="tira">' +
      (s.estado === 'nueva' ? b('leida', 'Marcar leída', true) : '') +
      b('en_curso', 'En curso') + b('hecha', 'Hecha') +
      '<button class="btn btn--sm" type="button" data-sug-acc="responder" data-id="' + s.id + '">' + (s.respuesta ? 'Editar respuesta' : 'Responder') + '</button>' +
      (s.estado === 'archivada' ? b('leida', 'Desarchivar') : b('archivada', 'Archivar')) +
      '</div></article>';
  }

  S.activarAdmin = function (raiz) {
    const caja = raiz.querySelector('#sugerencias'); if (!caja) return;
    const el = caja.querySelector('[data-sug]');
    let filtro = null, lista = [];
    async function cargar() {
      try {
        const r = await AL().sugerencias.admin(filtro);
        lista = r.lista || [];
        const rs = r.resumen || {};
        const activas = (rs.nueva || 0) + (rs.leida || 0) + (rs.en_curso || 0) + (rs.hecha || 0);
        const tot = activas + (rs.archivada || 0);
        const n = { activas, nueva: rs.nueva || 0, en_curso: rs.en_curso || 0, hecha: rs.hecha || 0, archivada: rs.archivada || 0, todas: tot };
        caja.querySelectorAll('[data-n]').forEach(x => { const v = n[x.dataset.n]; x.textContent = v ? ' ' + v : ''; });
        if ((rs.nueva || 0) !== S.nuevas) { S.nuevas = rs.nueva || 0; if (MIRU.app && MIRU.app.pintarNav) MIRU.app.pintarNav(); }
        el.innerHTML = lista.length ? '<div class="sug-lista">' + lista.map(htmlItem).join('') + '</div>'
          : '<p class="nota">' + (filtro ? 'No hay sugerencias con este filtro.' : 'Todavía no hay sugerencias. Cuando un alumno envíe una, aparecerá aquí.') + '</p>';
      } catch (e) {
        el.innerHTML = '<p class="nota">' + MIRU.icono('alerta', 'ico--aviso') + ' ' + U.esc(e.message) +
          (/function|schema cache|admin_sugerencias/i.test(e.message) ? ' — Falta ejecutar la versión nueva de <code>miru.sql</code> en Supabase.' : '') + '</p>';
      }
    }
    caja.querySelectorAll('[data-sug-filtros] .chip').forEach(b => b.addEventListener('click', () => {
      filtro = b.dataset.estado || null;
      caja.querySelectorAll('[data-sug-filtros] .chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      cargar();
    }));
    U.on(caja, 'click', '[data-sug-acc]', async function (e, b) {
      const id = +b.dataset.id;
      const s = lista.find(x => x.id === id); if (!s) return;
      const acc = b.dataset.sugAcc;
      try {
        if (acc === 'responder') {
          const txt = await MIRU.ui.pedirTexto('Responder a ' + (s.alumno ? s.alumno.codigo : 'la sugerencia'),
            'El alumno verá tu respuesta en «Sugerir una mejora». Déjalo vacío para borrarla.', s.respuesta || '');
          if (txt == null) return;
          await AL().sugerencias.cambiar(id, s.estado === 'nueva' ? 'leida' : s.estado, txt);
          MIRU.ui.aviso(txt.trim() ? 'Respuesta guardada.' : 'Respuesta borrada.');
        } else {
          b.disabled = true;
          await AL().sugerencias.cambiar(id, acc, null);
        }
        await cargar();
      } catch (err) { MIRU.ui.aviso(U.esc(err.message), 'mal'); b.disabled = false; }
    });
    cargar();
  };

  /** Actualiza el globito de nuevas en el menú (solo administradora). */
  S.refrescarNuevas = async function () {
    if (!(MIRU.admin && MIRU.admin.activo())) { S.nuevas = 0; return 0; }
    try { S.nuevas = await AL().sugerencias.nuevas(); } catch (e) { /* sin red o SQL sin actualizar */ }
    return S.nuevas;
  };

})(window);
