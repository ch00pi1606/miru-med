/* =========================================================================
   miru · APP — arranque, navegación lateral y enrutador
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const V = MIRU.vistas;
  const P = () => MIRU.progreso;

  let $lienzo, $nav, $miga, $lateral;

  /* ------------------------------------------------------------- navegación */
  function pintarNav(ruta) {
    const d = MIRU.datos;
    const item = (href, ic, tx, extra, activo, badge) =>
      '<button class="navit' + (activo ? ' on' : '') + '" data-ir="' + href + '" type="button"' + (activo ? ' aria-current="page"' : '') + '>' +
      '<span class="navit__ic" aria-hidden="true">' + MIRU.icono(ic) + '</span><span class="navit__tx">' + U.esc(tx) + '</span>' +
      (badge ? '<span class="navit__badge" aria-label="' + badge + ' nuevas">' + badge + '</span>' : extra != null ? '<span class="navit__pc">' + extra + '</span>' : '') + '</button>';

    let h = '<div class="navgrupo">' + item('#/', 'calendario', 'Mi semestre', MIRU.pct.curso() + '%', ruta === '#/' || ruta === '') +
      item('#/cursos', 'libro', 'Cursos', null, ruta.indexOf('#/cursos') === 0) + '</div>';
    d.bloques.forEach(b => {
      const mods = MIRU.modulosDe(b.id);
      if (!mods.length) return;
      h += '<div class="navgrupo"><button class="navgrupo__t" data-ir="#/bloque/' + b.id + '" type="button">' + U.esc(b.nombre) + '</button>';
      mods.forEach(m => {
        const act = ruta.indexOf('/' + m.id + '/') > -1 || ruta === '#/modulo/' + m.id || ruta.indexOf('/' + m.id) === ruta.length - m.id.length - 1;
        const tieneAlgo = MIRU.clasesDe(m.id).some(MIRU.claseConContenido);
        h += '<button class="navit navit--mod' + (act ? ' on' : '') + (tieneAlgo ? '' : ' navit--vacio') + '" data-ir="#/modulo/' + m.id + '" data-color="' + U.esc(m.color) + '" type="button">' +
          '<span class="navit__punto" aria-hidden="true"></span><span class="navit__tx">' + U.esc(m.nombre) + '</span>' +
          '<span class="navit__pc">' + (tieneAlgo ? MIRU.pct.modulo(m.id).pct + '%' : '—') + '</span></button>';
        if (act) {
          MIRU.clasesDe(m.id).forEach(c => {
            const con = MIRU.claseConContenido(c);
            const dest = (c.temas || []).length === 1 ? '#/tema/' + m.id + '/' + c.id + '/' + c.temas[0].id : '#/clase/' + m.id + '/' + c.id;
            h += '<button class="navit navit--sub' + (ruta.indexOf('/' + c.id) > -1 ? ' on' : '') + (con ? '' : ' navit--vacio') + '" data-ir="' + dest + '" type="button">' +
              '<span class="navit__tx">' + (c.numero ? c.numero + '. ' : '') + U.esc(c.nombre) + '</span>' +
              (con ? '<span class="navit__pc">' + MIRU.pct.clase(c).pct + '%</span>' : '') + '</button>';
          });
        }
      });
      h += '</div>';
    });
    const nFall = P().falladas().length;
    h += '<div class="navgrupo"><div class="navgrupo__t">Evaluación y repaso</div>' +
      item('#/simulacros', 'reloj', 'Simulacros', P().sesion() ? '●' : null, ruta.indexOf('#/simulacro') === 0 || ruta.indexOf('#/resultado') === 0) +
      item('#/repaso', 'repetir', 'Necesitas repasar', nFall || null, ruta.indexOf('#/repaso') === 0) +
      item('#/flashcards/dificiles/todas', 'tarjetas', 'Flashcards difíciles', null, ruta.indexOf('#/flashcards/dificiles') === 0) +
      '</div><div class="navgrupo"><div class="navgrupo__t">Tú</div>' +
      item('#/estadisticas', 'grafico', 'Estadísticas', null, ruta.indexOf('#/estadisticas') === 0) +
      item('#/perfil', 'persona', 'Mi perfil', null, ruta.indexOf('#/perfil') === 0) +
      item('#/sugerir', 'burbuja', 'Sugerir una mejora', null, ruta.indexOf('#/sugerir') === 0) +
      (MIRU.admin.activo() ? item('#/admin', 'herramienta', 'Administración', null, ruta.indexOf('#/admin') === 0, (MIRU.sugerencias || {}).nuevas || 0) : '') +
      '</div>';
    $nav.innerHTML = h;
    pintarTabbar(ruta);
  }

  /* ------------------------------------------- barra inferior (celular) */
  const TABS = [
    { id: 'semestre', href: '#/', ic: 'calendario', tx: 'Semestre' },
    { id: 'cursos', href: '#/cursos', ic: 'libro', tx: 'Cursos' },
    { id: 'evaluar', href: '#/simulacros', ic: 'reloj', tx: 'Evaluar' },
    { id: 'perfil', href: '#/perfil', ic: 'persona', tx: 'Perfil' }
  ];
  const RAICES = { '': 1, cursos: 1, simulacros: 1, perfil: 1 };
  function tabDe(ruta) {
    const v = (ruta || '').replace(/^#\/?/, '').split('/')[0];
    if (!v) return 'semestre';
    if (['simulacros', 'simulacro', 'simulacro-en-curso', 'resultado', 'repaso', 'reintentar'].indexOf(v) > -1) return 'evaluar';
    if (['perfil', 'sugerir', 'admin', 'estadisticas'].indexOf(v) > -1) return 'perfil';
    return 'cursos';
  }
  function pintarTabbar(ruta) {
    const tb = document.getElementById('tabbar'); if (!tb) return;
    const act = tabDe(ruta);
    const nuevas = MIRU.admin.activo() ? ((MIRU.sugerencias || {}).nuevas || 0) : 0;
    tb.innerHTML = TABS.map(t => '<a class="tab" href="' + t.href + '" data-tab="' + t.id + '"' + (t.id === act ? ' aria-current="page"' : '') + '>' +
      '<span class="tab__n">' + MIRU.icono(t.ic) + (t.id === 'perfil' && nuevas ? '<span class="navit__badge">' + nuevas + '</span>' : '') + '</span>' +
      '<span>' + t.tx + '</span></a>').join('');
  }

  function pintarMiga(partes) {
    $miga.innerHTML = partes.map((p, i) => (i ? '<span class="miga__sep" aria-hidden="true">›</span>' : '') +
      (p.h ? '<a href="' + p.h + '">' + U.esc(p.t) + '</a>' : '<b>' + U.esc(p.t) + '</b>')).join('');
    // Atrás (celular): a la pantalla anterior si vino de miru; si no, a la de arriba
    const at = document.getElementById('atras'); if (!at) return;
    const previa = pila.length > 1 ? pila[pila.length - 2] : null;
    const padre = partes.slice(0, -1).reverse().find(p => p.h);
    const nombre = previa ? (MIRU.sugerencias ? MIRU.sugerencias.nombrePantalla(previa) : 'Atrás') : padre ? padre.t : 'Mi semestre';
    at.setAttribute('href', previa || (padre ? padre.h : '#/'));
    at.dataset.atras = previa ? '1' : '';
    at.innerHTML = MIRU.icono('atras') + '<span>' + U.esc(U.recorta(nombre, 28)) + '</span>';
    at.setAttribute('aria-label', 'Volver a ' + nombre);
  }

  function pintarCabecera() {
    const per = P().perfilActivo();
    const ch = document.getElementById('chipPerfil');
    if (ch) ch.innerHTML = '<span class="chip-perfil__i" aria-hidden="true">' + U.esc((per && per.nombre ? per.nombre : '?').slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="chip-perfil__n">' + U.esc(per ? per.nombre : 'Perfil') + '</span>';
  }

  /* ---------------------------------------------------------------- rutas */
  function enrutar() {
    if ($lienzo._limpiar) { try { $lienzo._limpiar(); } catch (e) {} $lienzo._limpiar = null; }
    MIRU.evaluacion.detener();
    const ruta = location.hash || '#/';
    const p = ruta.replace(/^#\//, '').split('/').filter(Boolean);
    const migas = [{ t: 'Mi semestre', h: '#/' }];
    const mod = id => MIRU.modulo(id);
    const blo = m => m ? MIRU.bloque(m.bloque) : null;
    const pushMod = m => { if (!m) return; const b = blo(m); if (b) migas.push({ t: b.nombre, h: '#/bloque/' + b.id }); migas.push({ t: m.nombre, h: '#/modulo/' + m.id }); };

    if (!P().perfilActivo()) { pintar(V.bienvenida(), [{ t: 'Bienvenida' }], ruta); return; }

    switch (p[0]) {
      case undefined: return pintar(V.inicio(), [{ t: 'Mi semestre' }], ruta);
      case 'bloque': { const b = MIRU.bloque(p[1]); if (b) migas.push({ t: b.nombre }); return pintar(V.bloque(p[1]), migas, ruta); }
      case 'modulo': { const m = mod(p[1]); if (m) { const b = blo(m); if (b) migas.push({ t: b.nombre, h: '#/bloque/' + b.id }); migas.push({ t: m.nombre }); } return pintar(V.modulo(p[1]), migas, ruta); }
      case 'clase': { const m = mod(p[1]), c = MIRU.clase(p[2]); pushMod(m); if (c) migas.push({ t: 'Clase ' + (c.numero || '') }); return pintar(V.clase(p[1], p[2]), migas, ruta); }
      case 'tema': {
        const m = mod(p[1]), c = MIRU.clase(p[2]), t = MIRU.tema(p[2], p[3]);
        pushMod(m); if (c && (c.temas || []).length > 1) migas.push({ t: 'Clase ' + (c.numero || ''), h: '#/clase/' + p[1] + '/' + p[2] });
        if (t) migas.push({ t: t.nombre });
        pintar(V.tema(p[1], p[2], p[3]), migas, ruta);
        if (t) P().visitar(ruta);
        const slot = $lienzo.querySelector('[data-fuentes-tema]');
        if (slot) slot.innerHTML = MIRU.fuentes.listaCitadas() || '<p class="nota">Este tema aún no tiene citas registradas.</p>';
        return;
      }
      case 'pasito': return vistaPasito(p[1], migas);
      case 'practica': return vistaPractica('clase', p[1], migas);
      case 'practica-tema': return vistaPractica('tema', p[1], migas);
      case 'reintentar': return vistaReintentar(p[1], migas);
      case 'flashcards': return vistaFlashcards(p[1], p[2], migas);
      case 'simulacros': migas.push({ t: 'Simulacros' }); return pintar(V.simulacros(), migas, ruta);
      case 'simulacro': {
        migas.push({ t: 'Simulacros', h: '#/simulacros' }, { t: MIRU.evaluacion.tituloClave(p[1] === 'rotacion' ? 'rotacion:' + p[2] : p[1]) });
        pintar('<div id="zonaSim"></div>', migas, ruta);
        return MIRU.evaluacion.inicio(document.getElementById('zonaSim'), p[1], p[2]);
      }
      case 'simulacro-en-curso': {
        pintar('<div id="zonaSim"></div>', [{ t: 'Simulacro en curso' }], ruta);
        return MIRU.evaluacion.abrir(document.getElementById('zonaSim'));
      }
      case 'resultado': {
        migas.push({ t: 'Simulacros', h: '#/simulacros' }, { t: 'Resultado' });
        pintar('<div id="zonaSim"></div>', migas, ruta);
        return MIRU.evaluacion.resultado(document.getElementById('zonaSim'), p[1], p[2] === 'nuevo');
      }
      case 'repaso': migas.push({ t: 'Necesitas repasar' }); return pintar(V.repaso(p[1]), migas, ruta);
      case 'oral': return vistaOral(p[1], migas);
      case 'estadisticas': migas.push({ t: 'Estadísticas' }); return pintar(V.estadisticas(), migas, ruta);
      case 'perfil': migas.push({ t: 'Mi perfil' }); pintar(V.perfil(), migas, ruta); V.pintarRespaldos($lienzo); return;
      case 'cursos': migas.push({ t: 'Cursos' }); return pintar(V.cursos(), migas, ruta);
      case 'sugerir': migas.push({ t: 'Mi perfil', h: '#/perfil' }, { t: 'Sugerir una mejora' }); pintar(V.sugerir(), migas, ruta); MIRU.sugerencias.activar($lienzo); return;
      case 'admin': migas.push({ t: 'Administración' }); pintar(MIRU.admin.render(), migas, ruta); MIRU.admin.activar($lienzo); return;
      default: return pintar(V.noEncontrado(), migas, ruta);
    }
  }

  /* Historial propio para el botón «atrás» y la dirección de la animación */
  const pila = [];
  let rutaPintada = null, direccion = 'entra', cambioDeTab = false;
  const posiciones = {};
  function anotarRuta(ruta) {
    if (ruta === pila[pila.length - 1]) return 'misma';
    if (cambioDeTab) { cambioDeTab = false; pila.length = 0; pila.push(ruta); return 'entra'; }
    if (pila.length > 1 && pila[pila.length - 2] === ruta) { pila.pop(); return 'entra-atras'; }
    pila.push(ruta); if (pila.length > 40) pila.shift();
    return pila.length > 1 ? 'entra-adelante' : 'entra';
  }

  function pintar(html, migas, ruta) {
    ruta = ruta || location.hash || '#/';
    const nueva = ruta !== rutaPintada;
    if (nueva) direccion = anotarRuta(ruta);
    $lienzo.innerHTML = html;
    pintarMiga(migas);
    pintarNav(ruta);
    pintarCabecera();
    activarTodo($lienzo);
    $lateral.classList.remove('abierta');
    document.body.classList.remove('menu-abierto');
    const v = ruta.replace(/^#\/?/, '').split('/')[0];
    document.body.classList.toggle('raiz', !!RAICES[v] || !P().perfilActivo());
    document.body.classList.toggle('sin-perfil', !P().perfilActivo());
    if (nueva) {
      $lienzo.classList.remove('entra', 'entra-adelante', 'entra-atras');
      void $lienzo.offsetWidth;   // reinicia la animación
      if (direccion !== 'misma') $lienzo.classList.add(direccion);
      rutaPintada = ruta;
    }
  }

  /* ----------------------------------------------------- vistas con estado */
  function cabeceraPractica(titulo, sub, color) {
    return '<header class="cab-pag cab-pag--min" data-color="' + U.esc(color || 'lila') + '"><div class="cab-pag__t"><h1>' + titulo + '</h1>' +
      (sub ? '<p class="nota">' + sub + '</p>' : '') + '</div></header><div id="zonaPreg"></div>';
  }

  function vistaPasito(temaId, migas) {
    const r = MIRU.temaPorId(temaId);
    if (!r) return pintar(V.noEncontrado(), migas);
    const rt = MIRU.rutaTema(temaId);
    migas.push({ t: r.modulo.nombre, h: '#/modulo/' + r.modulo.id }, { t: r.tema.nombre, h: rt }, { t: 'Pasito' });
    pintar(cabeceraPractica('Pasito · ' + U.esc(r.tema.nombre), '5 preguntas al azar del tema, con corrección al instante. Se supera con 4 de 5.', r.modulo.color), migas);
    MIRU.pasitos.montar(document.getElementById('zonaPreg'), {
      tipo: 'pasito', temaId, preguntas: MIRU.pasitos.elegir(temaId),
      alSalir: () => { location.hash = rt; }, alTerminar: () => pintarNav(location.hash)
    });
  }

  function vistaPractica(ambito, id, migas) {
    let preguntas = [], titulo = '', color = 'lila', volver = '#/';
    if (ambito === 'clase') {
      const c = MIRU.clase(id); if (!c) return pintar(V.noEncontrado(), migas);
      const m = MIRU.modulo(c.modulo); color = m.color; volver = '#/clase/' + m.id + '/' + c.id;
      preguntas = U.mezclar(MIRU.preguntasDeClase(id).filter(p => !(p.usos || []).includes('caso'))).slice(0, 10);
      titulo = 'Práctica · ' + U.esc(c.nombre);
      migas.push({ t: m.nombre, h: '#/modulo/' + m.id }, { t: 'Clase ' + (c.numero || ''), h: volver }, { t: 'Práctica' });
    } else {
      const r = MIRU.temaPorId(id); if (!r) return pintar(V.noEncontrado(), migas);
      color = r.modulo.color; volver = MIRU.rutaTema(id);
      preguntas = U.mezclar(MIRU.pasitos.banco(id));
      titulo = 'Todas las preguntas · ' + U.esc(r.tema.nombre);
      migas.push({ t: r.modulo.nombre, h: '#/modulo/' + r.modulo.id }, { t: r.tema.nombre, h: volver }, { t: 'Práctica' });
    }
    pintar(cabeceraPractica(titulo, preguntas.length + ' preguntas con corrección al instante. No cuenta como pasito.', color), migas);
    MIRU.pasitos.montar(document.getElementById('zonaPreg'), { tipo: 'practica', preguntas, alSalir: () => { location.hash = volver; } });
  }

  function vistaReintentar(moduloId, migas) {
    const fall = P().falladas(moduloId).map(f => MIRU.pregunta(f.id)).filter(Boolean).slice(0, 20);
    migas.push({ t: 'Necesitas repasar', h: '#/repaso' + (moduloId ? '/' + moduloId : '') }, { t: 'Reintentar' });
    if (!fall.length) { location.hash = '#/repaso' + (moduloId ? '/' + moduloId : ''); return; }
    pintar(cabeceraPractica('Reintento de errores', fall.length + ' preguntas que fallaste la última vez.'), migas);
    MIRU.pasitos.montar(document.getElementById('zonaPreg'), { tipo: 'reintento', preguntas: U.mezclar(fall), alSalir: () => { location.hash = '#/repaso' + (moduloId ? '/' + moduloId : ''); } });
  }

  function vistaFlashcards(ambito, id, migas) {
    let cartas = [], titulo = '', ctx = {};
    const conCtx = (t, c) => (t.flashcards || []).map(f => Object.assign({}, f, { tema: f.tema || t.nombre, _ctx: { temaId: t.id, moduloId: c.modulo } }));
    if (ambito === 'tema') {
      const r = MIRU.temaPorId(id); if (!r) return pintar(V.noEncontrado(), migas);
      cartas = conCtx(r.tema, r.clase); titulo = r.tema.nombre; ctx = { temaId: id, moduloId: r.clase.modulo };
      migas.push({ t: r.modulo.nombre, h: '#/modulo/' + r.modulo.id }, { t: r.tema.nombre, h: MIRU.rutaTema(id) });
    } else if (ambito === 'clase') {
      const c = MIRU.clase(id); if (!c) return pintar(V.noEncontrado(), migas);
      cartas = (c.temas || []).flatMap(t => conCtx(t, c)); titulo = c.nombre; ctx = { moduloId: c.modulo };
      migas.push({ t: MIRU.modulo(c.modulo).nombre, h: '#/modulo/' + c.modulo });
    } else {
      const est = P().todo().flashcards;
      MIRU.datos.clases.forEach(c => (c.temas || []).forEach(t => conCtx(t, c).forEach(f => { const e = est[f.id]; if (e && (e.estado === 'nose' || e.estado === 'dudo')) cartas.push(f); })));
      titulo = 'Las que marcaste como «No lo sé» o «Lo dudo»';
    }
    migas.push({ t: 'Flashcards' });
    pintar('<header class="titulo-grande"><h1>Flashcards</h1><p>' + U.esc(titulo) + '</p></header><div id="zonaFC"></div>', migas);
    const z = document.getElementById('zonaFC');
    if (!cartas.length) { z.innerHTML = MIRU.ui.vacio('tarjetas', ambito === 'dificiles' ? 'No tienes flashcards difíciles' : 'Aún no hay flashcards aquí', ''); return; }
    MIRU.flashcards.montar(z, cartas, ctx);
    $lienzo._limpiar = () => { if (z._limpiar) z._limpiar(); };
  }

  function vistaOral(moduloId, migas) {
    const temas = MIRU.temasDe(moduloId).filter(x => MIRU.inventarioTema(x.tema).secciones || MIRU.inventarioTema(x.tema).laminas || MIRU.preguntasDeTema(x.tema.id).length);
    const m = MIRU.modulo(moduloId);
    if (m) migas.push({ t: m.nombre, h: '#/modulo/' + m.id });
    migas.push({ t: 'Simulacro oral' });
    pintar('<header class="titulo-grande"><h1>Simulacro oral</h1></header><div id="zonaOral"></div>', migas);
    MIRU.oral.montar(document.getElementById('zonaOral'), { temas });
  }

  /* ---------------------------------------------- activadores comunes */
  function activarTodo(raiz) {
    const partes = (location.hash || '').replace(/^#\//, '').split('/');
    const ctx = {
      buscarEsquema: id => {
        let r = null;
        MIRU.datos.clases.some(c => (c.temas || []).some(t => ((t.esquemas || []).concat((t.secciones || []).filter(s => s.tipo === 'esquema').map(s => s.esquema)))
          .some(e => { if (e && e.id === id) { r = e; return true; } return false; })));
        return r;
      },
      buscarCaso: id => {
        let r = null;
        MIRU.datos.clases.some(c => (c.temas || []).some(t => ((t.casos || []).concat((t.secciones || []).filter(s => s.tipo === 'caso').map(s => s.caso)))
          .some(x => { if (x && x.id === id) { r = x; return true; } return false; })));
        return r;
      }
    };
    if (partes[0] === 'tema') { ctx.moduloId = partes[1]; ctx.claseId = partes[2]; ctx.temaId = partes[3]; }
    ctx.buscar = id => MIRU.pregunta(id) || (() => {
      // preguntas incrustadas que aún no estaban en el banco
      const t = ctx.temaId && MIRU.temaPorId(ctx.temaId);
      const s = t && (t.tema.secciones || []).find(x => x.tipo === 'pregunta' && x.pregunta.id === id);
      return s ? MIRU.formato.desdeModulo(s.pregunta, { temaId: ctx.temaId, claseId: ctx.claseId, moduloId: ctx.moduloId }) : null;
    })();

    MIRU.preguntas.activar(raiz, ctx, () => pintarNav(location.hash));
    MIRU.esquemas.activar(raiz, ctx);
    MIRU.casos.activar(raiz, ctx);

    // citas → resaltan la fuente
    U.on(raiz, 'click', '.cita', function (e, a) {
      e.preventDefault();
      const f = document.getElementById('fuente-' + a.dataset.fuente);
      if (f) { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); f.classList.add('resaltada'); setTimeout(() => f.classList.remove('resaltada'), 1800); }
    });
    // anclas del índice sin romper el enrutador
    U.on(raiz, 'click', '[data-ancla]', function (e, a) {
      e.preventDefault();
      const el = document.getElementById(a.dataset.ancla);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    // secciones y láminas vistas
    if (ctx.temaId && 'IntersectionObserver' in global) {
      const io = new IntersectionObserver(ents => ents.forEach(en => {
        if (!en.isIntersecting) return;
        const [temaId, anc] = en.target.dataset.visto.split('|');
        MIRU.progreso.marcarSeccion(temaId, anc);
        io.unobserve(en.target);
        const art = en.target.closest('.lamina');
        if (art && !art.classList.contains('lamina--vista')) art.classList.add('lamina--vista');
        const a = raiz.querySelector('.indice [data-ancla="' + anc + '"]'); if (a) a.classList.add('leida');
      }), { rootMargin: '0px 0px -30% 0px' });
      raiz.querySelectorAll('[data-visto]').forEach(el => io.observe(el));
      $lienzo._limpiar = () => io.disconnect();
    }

    // bienvenida: crear el primer perfil
    const fp = raiz.querySelector('[data-form="perfil"]');
    if (fp) fp.addEventListener('submit', e => {
      e.preventDefault();
      const n = fp.nombre.value.trim(); if (!n) return;
      P().crearPerfil(n);
      MIRU.ui.tema.aplicar();
      P().solicitarPersistencia();
      location.hash = '#/'; enrutar();
    });

    // acciones de perfil y datos
    U.on(raiz, 'click', '[data-acc]', async function (e, b) {
      const a = b.dataset.acc, id = b.dataset.id;
      switch (a) {
        case 'visto-novedades': MIRU.contenido.marcarVisto(); enrutar(); break;
        case 'usar-perfil': P().cambiarPerfil(id); MIRU.ui.tema.aplicar(); enrutar(); MIRU.ui.aviso('Perfil cambiado.'); break;
        case 'nuevo-perfil': { const n = await MIRU.ui.pedirTexto('Nuevo perfil', 'Nombre de la persona que va a estudiar en este dispositivo.'); if (n && n.trim()) { P().crearPerfil(n); MIRU.ui.tema.aplicar(); enrutar(); } break; }
        case 'renombrar-perfil': { const per = P().perfiles().find(x => x.id === id); const n = await MIRU.ui.pedirTexto('Renombrar perfil', '', per ? per.nombre : ''); if (n && n.trim()) { P().renombrarPerfil(id, n); enrutar(); } break; }
        case 'borrar-perfil': { const per = P().perfiles().find(x => x.id === id);
          MIRU.ui.confirmar('¿Eliminar el perfil «' + (per ? per.nombre : '') + '»?', 'Se borra su progreso de este dispositivo. Antes se guarda un respaldo automático.', 'Eliminar', async () => { await P().eliminarPerfil(id); MIRU.ui.tema.aplicar(); enrutar(); }); break; }
        case 'tema-pref': P().ponerPerfil('tema', b.dataset.v); MIRU.ui.tema.aplicar(); enrutar(); break;
        case 'exportar': { const per = P().perfilActivo(); U.descargar('miru-progreso-' + (per ? U.normal(per.nombre).replace(/[^a-z0-9]+/g, '-') : 'perfil') + '-' + new Date().toISOString().slice(0, 10) + '.json', P().exportar()); break; }
        case 'importar': { const f = raiz.querySelector('[data-file]'); if (f) f.click(); break; }
        case 'respaldar': await P().respaldar('respaldo manual'); MIRU.ui.aviso('Respaldo guardado.'); V.pintarRespaldos(raiz); break;
        case 'restaurar': MIRU.ui.confirmar('¿Restaurar este respaldo?', 'Tu progreso actual se reemplaza por el del respaldo (antes se guarda otro respaldo del actual).', 'Restaurar', async () => { await P().restaurarRespaldo(id); enrutar(); MIRU.ui.aviso('Respaldo restaurado.'); }); break;
        case 'borrar-progreso': MIRU.ui.confirmar('¿Borrar todo tu progreso?', 'Se borra el avance de este perfil. Antes se guarda un respaldo que podrás restaurar.', 'Borrar progreso', async () => { await P().reiniciar(); enrutar(); }); break;
        case 'admin': { await MIRU.admin.alternar(); enrutar(); break; }
        case 'sincronizar': {
          b.disabled = true;
          const ok = await MIRU.almacen.sincronizar(true);
          b.disabled = false;
          MIRU.ui.aviso(ok ? 'Progreso sincronizado con tu cuenta.' : MIRU.almacen.etiqueta().t, ok ? 'info' : 'mal');
          break;
        }
        case 'cerrar-sesion': MIRU.ui.confirmar('¿Cerrar sesión en este dispositivo?', 'Antes se sincroniza tu progreso. Para volver a entrar necesitarás un código nuevo de la administradora. El perfil local no se borra.', 'Cerrar sesión', () => MIRU.almacen.cerrarSesionAlumno()); break;
      }
    });
    const file = raiz.querySelector('[data-file]');
    if (file) file.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { await P().importar(await f.text(), false); enrutar(); MIRU.ui.aviso('Progreso importado y fusionado con el tuyo: no se perdió nada.'); }
      catch (err) { MIRU.ui.aviso('No se pudo importar: ' + U.esc(err.message), 'mal'); }
    });
    const fecha = raiz.querySelector('[data-campo="inicioGeneralidades"]');
    if (fecha) fecha.addEventListener('change', () => { P().ponerPerfil('inicioGeneralidades', fecha.value); MIRU.ui.aviso('Fecha guardada.'); });
  }

  /* ------------------------------------------------------------ arranque */
  async function arrancar() {
    $lienzo = document.getElementById('lienzo');
    $nav = document.getElementById('nav');
    $miga = document.getElementById('miga');
    $lateral = document.getElementById('lateral');
    MIRU.ui.tema.aplicar('auto');
    MIRU.ui.tema.escuchar();

    let hayPerfil = P().iniciar();
    if (hayPerfil) MIRU.ui.tema.aplicar();

    try {
      await MIRU.contenido.cargar();
    } catch (e) {
      console.error(e);
      $lienzo.innerHTML = MIRU.ui.vacio('caja', 'No se pudo cargar el contenido', U.esc(e.message));
      return;
    }
    await MIRU.almacen.iniciar();
    // Con Supabase, activar el dispositivo crea (o liga) el perfil del alumno
    if (!hayPerfil && P().perfilActivo()) { hayPerfil = true; MIRU.ui.tema.aplicar(); }

    document.querySelector('[data-acc="tema"]').addEventListener('click', () => MIRU.ui.tema.alternar());
    // Barra inferior: cada pestaña empieza su propio historial
    U.on(document.getElementById('tabbar'), 'click', '[data-tab]', function (e, a) {
      cambioDeTab = true;
      if (location.hash === a.getAttribute('href') || (!location.hash && a.getAttribute('href') === '#/')) { e.preventDefault(); global.scrollTo({ top: 0, behavior: 'smooth' }); cambioDeTab = false; }
    });
    // «Atrás» vuelve de verdad a la pantalla anterior (y a su posición)
    document.getElementById('atras').addEventListener('click', e => {
      if (e.currentTarget.dataset.atras === '1' && global.history.length > 1) { e.preventDefault(); global.history.back(); }
    });
    // Línea bajo la cabecera solo al desplazarse (como en iOS)
    const cab = document.getElementById('cabecera');
    global.addEventListener('scroll', () => cab.classList.toggle('con-sombra', global.scrollY > 4), { passive: true });
    if ('scrollRestoration' in global.history) global.history.scrollRestoration = 'manual';
    U.on(document.body, 'click', '[data-ir]', function (e, b) {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const destino = b.dataset.ir;
      if (location.hash === destino) enrutar(); else location.hash = destino;
    });
    document.addEventListener('click', e => {
      if (global.innerWidth <= 900 && $lateral.classList.contains('abierta') && !e.target.closest('#lateral') && !e.target.closest('[data-acc="menu"]')) {
        $lateral.classList.remove('abierta'); document.body.classList.remove('menu-abierto');
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $lateral.classList.contains('abierta')) { $lateral.classList.remove('abierta'); document.body.classList.remove('menu-abierto'); } });

    P().alReemplazar(() => {
      const v = (location.hash || '').replace(/^#\//, '').split('/')[0];
      if (['pasito', 'practica', 'practica-tema', 'reintentar', 'flashcards', 'oral', 'simulacro-en-curso'].indexOf(v) > -1) return;
      try { enrutar(); } catch (e) {}
    });
    global.addEventListener('hashchange', () => {
      if (rutaPintada) posiciones[rutaPintada] = global.scrollY;
      MIRU.sugerencias.rutaAnterior = rutaPintada || '';
      enrutar();
      const y = direccion === 'entra-atras' ? posiciones[location.hash || '#/'] : 0;
      global.scrollTo({ top: y || 0 });
    });

    enrutar();
    document.getElementById('pie-version').textContent = MIRU.contenido.etiqueta();
    if (MIRU.almacen.modo === 'supabase') {
      const pie = document.querySelector('.lateral__pie');
      if (pie && !pie.querySelector('[data-sinc]')) { const s = document.createElement('span'); s.setAttribute('data-sinc', ''); s.className = 'pie-sinc'; pie.appendChild(s); }
      MIRU.almacen.pintarEstado();
    }

    // Administradora: cuántas sugerencias nuevas hay (globito del menú)
    if (MIRU.admin.activo()) MIRU.sugerencias.refrescarNuevas().then(n => { if (n) pintarNav(location.hash || '#/'); });

    if (hayPerfil) {
      P().respaldoDiario();
      if (MIRU.contenido.nuevas.length) MIRU.ui.aviso('<strong>Contenido nuevo.</strong> ' + U.esc(MIRU.contenido.nuevas[0]) + (MIRU.contenido.nuevas.length > 1 ? ' y más.' : ''), 'info', 8000);
    }

    // PWA: funciona sin internet una vez abierta desde el enlace (https).
    if ('serviceWorker' in navigator && /^https:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  MIRU.app = { enrutar, pintarNav: () => pintarNav(location.hash || '#/') };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

})(window);
