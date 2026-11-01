/* =========================================================================
   miru · VISTAS — render de cada pantalla. No contiene contenido médico.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const V = MIRU.vistas = {};
  const P = () => MIRU.progreso;

  const ruta = {
    tema: (m, c, t) => '#/tema/' + m + '/' + c + '/' + t,
    clase: (m, c) => '#/clase/' + m + '/' + c,
    modulo: m => '#/modulo/' + m
  };
  V.ruta = ruta;

  /* ================================================== piezas comunes */
  function huellaTema(t) {
    const ok = P().pasitoAprobado(t.id);
    return '<span class="huellita' + (ok ? ' ok' : '') + '" title="' + (ok ? 'Pasito superado' : 'Pasito pendiente') + '" aria-label="' + (ok ? 'Pasito superado' : 'Pasito pendiente') + '">👣</span>';
  }

  /** Fila de una clase en las columnas del planificador. */
  function filaClase(m, c) {
    const con = MIRU.claseConContenido(c);
    const pc = con ? MIRU.pct.clase(c) : { pct: 0 };
    const temas = (c.temas || []);
    const pasos = temas.filter(t => MIRU.pasitos.banco(t.id).length);
    const okPasos = pasos.filter(t => P().pasitoAprobado(t.id)).length;
    const lam = temas.reduce((s, t) => s + (t.laminas || []).length, 0);
    const destino = temas.length === 1 ? ruta.tema(m.id, c.id, temas[0].id) : ruta.clase(m.id, c.id);
    return '<li class="pl-fila' + (con ? '' : ' pl-fila--vacia') + '">' +
      '<button class="pl-btn" data-ir="' + destino + '" type="button"' + (con ? '' : ' aria-disabled="true"') + '>' +
      '<span class="pl-check' + (pc.pct >= 80 ? ' hecho' : '') + '" aria-hidden="true"></span>' +
      '<span class="pl-txt"><span class="pl-nom">' + (c.numero ? c.numero + '. ' : '') + U.esc(c.nombre) + '</span>' +
      '<span class="pl-meta">' +
      (con ? U.barra(pc.pct, true) + '<small>' + pc.pct + '%' + (lam ? ' · ' + lam + ' láminas' : '') +
        (pasos.length ? ' · 👣 ' + okPasos + '/' + pasos.length : '') + '</small>'
        : '<small>Contenido en preparación</small>') +
      '</span></span></button></li>';
  }

  function columnaModulo(m, opts) {
    opts = opts || {};
    const clases = MIRU.clasesDe(m.id);
    const p = MIRU.pct.modulo(m.id);
    return '<article class="columna" data-color="' + U.esc(m.color) + '">' +
      '<header class="columna-cabeza"><h3><button class="pl-tit" data-ir="' + ruta.modulo(m.id) + '" type="button">' + U.esc(m.nombre) + '</button></h3>' +
      '<p>' + (opts.sub || (clases.length + ' clases')) + ' · ' + p.pct + '%</p>' +
      (opts.actual ? '<span class="sello">Esta semana</span>' : '') + '</header>' +
      '<ul class="pl-lista">' + clases.map(c => filaClase(m, c)).join('') + '</ul></article>';
  }

  function semanaActual() {
    const ini = P().perfil('inicioGeneralidades');
    if (!ini) return 0;
    const d = Math.floor((Date.now() - new Date(ini + 'T00:00:00').getTime()) / 86400000);
    if (d < 0) return 0;
    const s = Math.floor(d / 7) + 1;
    return s >= 1 && s <= 8 ? s : 0;
  }

  /* ======================================== listas agrupadas (estilo iOS) */
  const ICONO_MODULO = { oncologia: 'cinta', anestesiologia: 'aire', traumatologia: 'hueso', pediatria: 'nino' };
  function icoModulo(m, k) {
    if (m.bloque === 'generalidades') return '<span class="fila__ico" data-color="' + U.esc(m.color) + '" aria-hidden="true">' + (k + 1) + '</span>';
    return '<span class="fila__ico" data-color="' + U.esc(m.color) + '" aria-hidden="true">' + MIRU.icono(ICONO_MODULO[m.id] || 'libro') + '</span>';
  }
  /** Una fila: { href, ico (html), t (html), s, v (html), dest } */
  function fila(o) {
    return '<li><a class="fila' + (o.dest ? ' fila--dest' : '') + '" href="' + U.esc(o.href) + '">' + (o.ico || '') +
      '<span class="fila__tx"><span class="fila__t">' + o.t + '</span>' + (o.s ? '<span class="fila__s">' + o.s + '</span>' : '') + '</span>' +
      (o.v != null && o.v !== '' ? '<span class="fila__v">' + o.v + '</span>' : '') + MIRU.icono('chevron', 'fila__chev') + '</a></li>';
  }
  const icoFijo = (nombre, color) => '<span class="fila__ico"' + (color ? ' data-color="' + color + '"' : '') + ' aria-hidden="true">' + MIRU.icono(nombre) + '</span>';
  function grupo(titulo, filas, extra) {
    extra = extra || {};
    return '<section class="grupo"' + (titulo ? ' aria-label="' + U.esc(titulo) + '"' : '') + '>' +
      (titulo ? '<div class="grupo__cab"><h2 class="grupo__t">' + U.esc(titulo) + '</h2>' + (extra.enlace || '') + '</div>' : '') +
      '<ul class="lista' + (extra.sinIco ? ' lista--sin-ico' : '') + '">' + filas.join('') + '</ul>' +
      (extra.pie ? '<p class="grupo__pie">' + extra.pie + '</p>' : '') + '</section>';
  }
  V.fila = fila; V.grupo = grupo; V.icoFijo = icoFijo;

  function filaModulo(m, k, sem) {
    const clases = MIRU.clasesDe(m.id);
    const con = clases.filter(MIRU.claseConContenido);
    const hechas = clases.filter(c => MIRU.claseConContenido(c) && MIRU.pct.clase(c).pct >= 80).length;
    const actual = m.bloque === 'generalidades' && sem === k + 1;
    const sub = !con.length ? 'En preparación'
      : hechas + ' de ' + clases.length + ' clases' + (con.length < clases.length ? ' · ' + (clases.length - con.length) + ' en preparación' : '');
    return fila({ href: ruta.modulo(m.id), ico: icoModulo(m, k), t: U.esc(m.nombre) + (actual ? ' <span class="pildora">Esta semana</span>' : ''),
      s: sub, v: con.length ? MIRU.pct.modulo(m.id).pct + ' %' : '' });
  }

  function textoGuardado() {
    const AL = MIRU.almacen;
    if (AL.modo === 'supabase' && AL.cuenta()) return 'Tu avance se guarda aquí y se sincroniza con tu cuenta miru.';
    return 'Tu avance se guarda en este dispositivo. Respaldos y perfiles en <a href="#/perfil">Mi perfil</a>.';
  }

  /* ================================================================ INICIO */
  V.inicio = function () {
    const per = P().perfilActivo();
    const pct = MIRU.pct.curso();
    const pasitos = new Set(P().pasitos().filter(x => x.aprobado).map(x => x.temaId)).size;
    const sims = P().simulacros().length;
    const sem = semanaActual();
    const uv = P().todo().ultimaVisita;
    let seguir = '';
    if (uv && uv.ruta && /^#\/tema\//.test(uv.ruta)) {
      const r = MIRU.temaPorId(uv.ruta.split('/')[4]);
      if (r) {
        const pt = MIRU.pct.tema(r.clase, r.tema);
        const lam = pt.laminas && pt.laminas[1] ? ' · ' + pt.laminas[0] + ' de ' + pt.laminas[1] + ' láminas' : '';
        seguir = '<a class="seguir" href="' + U.esc(uv.ruta) + '" data-color="' + U.esc(r.modulo.color) + '">' +
          '<span class="seguir__tx"><span class="seguir__k">Continuar</span><span class="seguir__t">' + U.esc(r.tema.nombre) + '</span>' +
          '<span class="seguir__s">' + U.esc(r.modulo.nombre) + (r.clase.numero ? ' · clase ' + r.clase.numero : '') + lam + '</span>' + U.barra(pt.pct, true) + '</span>' +
          '<span class="seguir__play" aria-hidden="true">' + MIRU.icono('play') + '</span></a>';
      }
    }
    const nov = MIRU.contenido.nuevas.length
      ? '<div class="nota-cinta" role="status"><strong>Novedades en miru:</strong><ul>' + MIRU.contenido.nuevas.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ul>' +
        '<button class="enlace" data-acc="visto-novedades" type="button">Entendido</button></div>'
      : '';

    const gen = MIRU.modulosDe('generalidades');
    const esp = MIRU.modulosDe('especialidades');
    const fall = P().falladas().length;
    const dificiles = Object.values(P().todo().flashcards).filter(f => f.estado === 'nose' || f.estado === 'dudo').length;
    const E = MIRU.evaluacion;
    const ultima = clave => { const h = P().simulacros(clave); return h.length ? U.num(h[h.length - 1].nota) : ''; };
    const histEsp = P().simulacros('especialidades');

    const evaluar = [fila({ href: '#/simulacro/especialidades', ico: icoFijo('reloj'), t: 'Simulacro de Especialidades', s: '40 preguntas · 40 min', v: ultima('especialidades') })];
    if (E.disponible('generalidades')) evaluar.push(fila({ href: '#/simulacro/generalidades', ico: icoFijo('reloj', 'lila'), t: 'Simulacro de Generalidades', s: '40 preguntas · 40 min', v: ultima('generalidades') }));
    evaluar.push(fila({ href: '#/simulacros', ico: icoFijo('cuadricula', 'pizarra'), t: 'Todos los simulacros', s: 'Repasos de 10 preguntas por rotación o semana' }));

    return '<header class="titulo-grande"><h1>Mi semestre</h1>' +
      '<p>' + U.esc(MIRU.datos.curso.nombre) + (sem ? ' · semana ' + sem : '') + (per && per.nombre ? ' · ' + U.esc(per.nombre) : '') + '</p></header>' +
      nov + seguir +
      '<div class="cifras" role="list">' +
      '<div role="listitem"><b>' + pct + ' %</b><span>del curso</span></div>' +
      '<div role="listitem"><b>' + pasitos + '</b><span>pasito' + (pasitos === 1 ? '' : 's') + '</span></div>' +
      '<div role="listitem"><b>' + sims + '</b><span>simulacro' + (sims === 1 ? '' : 's') + '</span></div></div>' +

      (gen.length ? grupo('Generalidades', gen.map((m, k) => filaModulo(m, k, sem)), {
        enlace: '<a class="grupo__enlace" href="#/bloque/generalidades">Ver por clase</a>',
        pie: sem ? '' : 'Pon la fecha de inicio de Generalidades en <a href="#/perfil">Mi perfil</a> para que miru marque tu semana.' }) : '') +
      (esp.length ? grupo('Especialidades', esp.map((m, k) => filaModulo(m, k, sem))) : '') +
      grupo('Evaluarse', evaluar) +
      (histEsp.length ? '<div class="tarjeta tarjeta--grafico"><h2>Tus simulacros de Especialidades</h2>' + E.grafico(histEsp) + '</div>' : '') +
      grupo('Para hoy', [
        fila({ href: '#/repaso', ico: icoFijo('repetir', 'rosa'), t: 'Necesitas repasar', s: fall ? 'Preguntas cuyo último intento fue incorrecto' : 'No tienes preguntas falladas pendientes', v: fall ? '<span class="insignia">' + fall + '</span>' : '' }),
        fila({ href: '#/flashcards/dificiles/todas', ico: icoFijo('tarjetas', 'amarillo'), t: 'Flashcards difíciles', s: dificiles ? 'Las que marcaste «No lo sé» o «Lo dudo»' : 'Sin flashcards difíciles por ahora', v: dificiles || '' })
      ]) +
      grupo('', [fila({ href: '#/sugerir', ico: icoFijo('burbuja', 'verde'), t: 'Sugerir una mejora', s: '¿Qué cambiarías de miru? Cuéntaselo a la administradora' })], { pie: textoGuardado() });
  };

  /* ================================================================ CURSOS */
  V.cursos = function () {
    const sem = semanaActual();
    const fall = P().falladas().length;
    const admin = MIRU.admin && MIRU.admin.activo();
    const nuevas = (MIRU.sugerencias && MIRU.sugerencias.nuevas) || 0;
    return '<header class="titulo-grande"><h1>Cursos</h1><p>' + U.esc(MIRU.datos.curso.nombre) +
      (MIRU.datos.curso.subtitulo ? ' · ' + U.esc(MIRU.datos.curso.subtitulo) : '') + '</p></header>' +
      MIRU.datos.bloques.map(b => {
        const mods = MIRU.modulosDe(b.id);
        if (!mods.length) return '';
        return grupo(b.nombre, mods.map((m, k) => filaModulo(m, k, sem)),
          { enlace: b.id === 'generalidades' ? '<a class="grupo__enlace" href="#/bloque/' + b.id + '">Ver por clase</a>' : '' });
      }).join('') +
      grupo('Evaluación y repaso', [
        fila({ href: '#/simulacros', ico: icoFijo('reloj'), t: 'Simulacros', s: 'Especialidades, Generalidades y repasos cortos' }),
        fila({ href: '#/repaso', ico: icoFijo('repetir', 'rosa'), t: 'Necesitas repasar', v: fall ? '<span class="insignia">' + fall + '</span>' : '' }),
        fila({ href: '#/flashcards/dificiles/todas', ico: icoFijo('tarjetas', 'amarillo'), t: 'Flashcards difíciles' })
      ]) +
      grupo('Tú', [
        fila({ href: '#/estadisticas', ico: icoFijo('grafico', 'azul'), t: 'Estadísticas' }),
        fila({ href: '#/sugerir', ico: icoFijo('burbuja', 'verde'), t: 'Sugerir una mejora' })
      ].concat(admin ? [fila({ href: '#/admin', ico: icoFijo('herramienta', 'durazno'), t: 'Administración', v: nuevas ? '<span class="insignia">' + nuevas + '</span>' : '' })] : []));
  };

  /* ================================================================ BLOQUE */
  V.bloque = function (id) {
    const b = MIRU.bloque(id);
    if (!b) return V.noEncontrado();
    const mods = MIRU.modulosDe(id);
    const sem = id === 'generalidades' ? semanaActual() : 0;
    return '<header class="cab-pag" data-color="' + U.esc(b.color) + '">' + U.anillo(MIRU.pct.bloque(id), 70) +
      '<div><h1>' + U.esc(b.nombre) + '</h1><p class="nota">' + U.esc(b.descripcion || '') + '</p></div></header>' +
      '<div class="planificador ' + (id === 'generalidades' ? 'planificador--semanas' : 'planificador--4') + '">' +
      mods.map((m, k) => columnaModulo(m, id === 'generalidades' ? { actual: sem === k + 1 } : {})).join('') + '</div>';
  };

  /* ================================================================ MÓDULO */
  V.modulo = function (moduloId) {
    const m = MIRU.modulo(moduloId);
    if (!m) return V.noEncontrado();
    const p = MIRU.pct.modulo(m.id);
    const clases = MIRU.clasesDe(m.id);
    const esEsp = m.bloque === 'especialidades';
    const nSim = MIRU.preguntasDeModulo(m.id, 'simulacro').length;
    return '<header class="cab-pag" data-color="' + U.esc(m.color) + '">' + U.anillo(p.pct, 70) +
      '<div class="cab-pag__t"><p class="cab-pag__sup">' + U.esc((MIRU.bloque(m.bloque) || {}).nombre || '') + '</p>' +
      '<h1>' + U.esc(m.nombre) + '</h1>' +
      '<p class="nota">' + clases.length + ' clases · ' + MIRU.temasDe(m.id).length + ' temas · ' + MIRU.preguntasDeModulo(m.id).length + ' preguntas</p></div>' +
      '<div class="tira">' +
      (nSim >= 5 ? '<button class="btn" data-ir="#/simulacro/rotacion/' + m.id + '" type="button">⏱ ' + (esEsp ? 'Repaso de la rotación' : 'Repaso de la semana') + ' (10 · 10 min)</button>' : '') +
      '<button class="btn" data-ir="#/repaso/' + m.id + '" type="button">🔁 Errores</button>' +
      (m.oral ? '<button class="btn" data-ir="#/oral/' + m.id + '" type="button">🎤 Simulacro oral</button>' : '') +
      '</div></header>' +
      (m.docentes && m.docentes.length
        ? '<div class="capa capa--curso"><div class="capa__t">Docentes cuyas clases se usan</div>' +
          m.docentes.map(d => '<p><strong>' + U.esc(d.nombre) + '</strong>' + (d.cargo ? ' — <span class="nota">' + U.esc(d.cargo) + '</span>' : '') +
            (d.clases ? '<br><span class="nota">Clases: ' + U.esc(d.clases) + '</span>' : '') + '</p>').join('') + '</div>'
        : '') +
      (m.nota ? '<div class="nota-cinta">' + U.md(m.nota) + '</div>' : '') +
      '<h2 class="cinta">Clases</h2>' + clases.map(c => tarjetaClase(m, c)).join('');
  };

  function tarjetaClase(m, c) {
    const con = MIRU.claseConContenido(c);
    const p = MIRU.pct.clase(c);
    const temas = c.temas || [];
    return '<div class="tj tj--pl clase-tj' + (con ? '' : ' clase-tj--vacia') + '" data-color="' + U.esc(m.color) + '">' +
      '<button class="tj__cab" data-ir="' + (temas.length === 1 ? ruta.tema(m.id, c.id, temas[0].id) : ruta.clase(m.id, c.id)) + '" type="button">' +
      '<span class="eti eti--brand">Clase ' + (c.numero || '') + '</span>' +
      '<span class="tj__tit">' + U.esc(c.nombre) + '</span>' +
      (con ? '<strong class="tj__pc">' + p.pct + '%</strong>' : '<span class="eti eti--neu">En preparación</span>') + '</button>' +
      (con ? '<div class="tj__barra">' + U.barra(p.pct, true) + '</div>' : '') +
      '<div class="tj__cue">' +
      (c.docente ? '<p class="nota">👩‍⚕️ ' + U.esc(c.docente) + '</p>' : '') +
      '<div class="temas-lista">' + temas.map(t => {
        const i = MIRU.inventarioTema(t);
        const pt = MIRU.pct.tema(c, t);
        const algo = i.laminas || i.secciones || i.preguntas || i.flashcards;
        return '<button class="op tema-op" data-ir="' + ruta.tema(m.id, c.id, t.id) + '" type="button"' + (algo ? '' : ' disabled') + '>' +
          '<span class="op__t"><strong>' + U.esc(t.nombre) + '</strong> ' + U.etiquetaPrioridad(t.prioridad) +
          '<span class="tema-op__meta">' + [i.laminas ? i.laminas + ' láminas' : '', i.secciones ? 'lección' : '', i.preguntas ? i.preguntas + ' preguntas' : '', i.flashcards ? i.flashcards + ' flashcards' : ''].filter(Boolean).join(' · ') + '</span></span>' +
          (algo ? huellaTema(t) + '<span class="tema-op__pc">' + pt.pct + '%</span>' : '') + '</button>';
      }).join('') + '</div></div></div>';
  }

  /* ================================================================= CLASE */
  V.clase = function (moduloId, claseId) {
    const m = MIRU.modulo(moduloId), c = MIRU.clase(claseId);
    if (!m || !c) return V.noEncontrado();
    const p = MIRU.pct.clase(c);
    const nClase = MIRU.preguntasDeClase(c.id).length;
    return '<header class="cab-pag" data-color="' + U.esc(m.color) + '">' + U.anillo(p.pct, 64) +
      '<div class="cab-pag__t"><p class="cab-pag__sup">' + U.esc(m.nombre) + ' · Clase ' + (c.numero || '') + '</p>' +
      '<h1>' + U.esc(c.nombre) + '</h1>' + (c.subtitulo ? '<p class="nota">' + U.esc(c.subtitulo) + '</p>' : '') +
      (c.docente ? '<p class="nota">👩‍⚕️ ' + U.esc(c.docente) + '</p>' : '') + '</div></header>' +
      (c.objetivos && c.objetivos.length
        ? '<div class="tj"><h3>🎯 Al terminar esta clase deberías poder</h3><ul>' + c.objetivos.map(o => '<li>' + U.md(o) + '</li>').join('') + '</ul></div>' : '') +
      '<h2 class="cinta">Contenido del día</h2>' +
      '<div class="rejilla">' + (c.temas || []).map(t => {
        const pt = MIRU.pct.tema(c, t);
        const inv = MIRU.inventarioTema(t);
        const algo = inv.laminas || inv.secciones || inv.preguntas || inv.flashcards;
        return '<button class="tj tj--btn" data-ir="' + ruta.tema(m.id, c.id, t.id) + '" type="button"' + (algo ? '' : ' disabled') + '>' +
          '<div class="tira">' + U.etiquetaPrioridad(t.prioridad) + huellaTema(t) + '<strong class="tj__pc">' + pt.pct + '%</strong></div>' +
          '<h3 class="tj__h3">' + U.esc(t.nombre) + '</h3>' +
          (t.conceptoAncla ? '<p class="nota">' + U.esc(U.recorta(t.conceptoAncla, 130)) + '</p>' : '') + U.barra(pt.pct, true) +
          '<p class="nota">' + [inv.laminas ? inv.laminas + ' láminas' : '', inv.preguntas + ' preguntas', inv.flashcards + ' flashcards'].filter(Boolean).join(' · ') + '</p></button>';
      }).join('') + '</div>' +
      (c.integracion ? '<div class="tj"><h3>🔗 Integración de la clase</h3>' + U.parrafos(c.integracion.texto || '') +
        (c.integracion.tabla ? tabla(c.integracion.tabla) : '') +
        (c.integracion.puntos ? '<ul>' + c.integracion.puntos.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ul>' : '') + '</div>' : '') +
      (c.resumen ? bloqueResumen(c.resumen, '🧠 Resumen de la clase') : '') +
      '<div class="tj"><h3>Practica la clase</h3><div class="tira">' +
      (nClase ? '<button class="btn btn--pri" data-ir="#/practica/' + c.id + '" type="button">📝 10 preguntas al azar de la clase</button>' : '') +
      '<button class="btn" data-ir="#/flashcards/clase/' + c.id + '" type="button">🎴 Flashcards de la clase</button>' +
      '</div></div>' +
      (c.fuentes && c.fuentes.length ? '<div class="tj"><h3>📚 Fuentes de la clase</h3>' + MIRU.fuentes.lista(c.fuentes, true) + '</div>' : '');
  };

  /* ================================================================== TEMA */
  V.tema = function (moduloId, claseId, temaId) {
    const m = MIRU.modulo(moduloId), c = MIRU.clase(claseId), t = MIRU.tema(claseId, temaId);
    if (!m || !c || !t) return V.noEncontrado();
    MIRU.fuentes.reiniciarIndice();
    MIRU.fuentes.preregistrarTema(t);
    P().marcarTemaVisto(t.id);
    const inv = MIRU.inventarioTema(t);
    const pt = MIRU.pct.tema(c, t);
    const secciones = (t.secciones || []).map((s, i) => seccion(s, i, t)).join('');
    const nPas = MIRU.pasitos.banco(t.id).length;
    const ctaPasito = nPas
      ? '<div class="cta-pasito" data-color="' + U.esc(m.color) + '"><div><strong>👣 Pasito de este tema</strong><p>' + Math.min(5, nPas) + ' preguntas al azar de ' + nPas +
        '. Corrección al instante. Se supera con 4 de 5.</p></div><button class="boton" data-ir="#/pasito/' + t.id + '" type="button">Dar el pasito</button></div>'
      : '';

    const indiceLam = (t.laminas || []).map((l, k) => '<a href="#lam-' + U.esc(l.id) + '" data-ancla="lam-' + U.esc(l.id) + '"' +
      (P().seccionVista(t.id, 'lam-' + l.id) ? ' class="leida"' : '') + '>' + (k + 1) + '. ' + U.esc(U.recorta(l.titulo, 36)) + '</a>').join('');
    const indiceSec = (t.secciones || []).map((s, i) => s.titulo && s.tipo !== 'pregunta' ? '<a href="#sec-' + t.id + '-' + i + '" data-ancla="sec-' + t.id + '-' + i + '">' + U.esc(U.recorta(s.titulo, 36)) + '</a>' : '').join('');

    const cuerpo =
      '<header class="cab-pag cab-pag--tema" data-color="' + U.esc(m.color) + '">' +
      '<div class="cab-pag__t"><p class="cab-pag__sup"><a href="' + ruta.modulo(m.id) + '">' + U.esc(m.nombre) + '</a> · ' +
      ((c.temas || []).length > 1 ? '<a href="' + ruta.clase(m.id, c.id) + '">Clase ' + (c.numero || '') + '</a>' : 'Clase ' + (c.numero || '')) + '</p>' +
      '<h1>' + U.esc(t.nombre) + '</h1>' +
      (t.subtitulo ? '<p class="nota">' + U.md(t.subtitulo) + '</p>' : '') +
      '<div class="tira">' + U.etiquetaPrioridad(t.prioridad) + (t.tiempo ? '<span class="eti eti--neu">⏱ ' + U.esc(t.tiempo) + '</span>' : '') +
      (c.docente ? '<span class="eti eti--neu">👩‍⚕️ ' + U.esc(c.docente) + '</span>' : '') + huellaTema(t) + '</div></div>' +
      U.anillo(pt.pct, 60) + '</header>' +
      (t.conceptoAncla ? '<div class="capa capa--ancla"><div class="capa__t">⚓ Concepto ancla</div>' + U.parrafos(t.conceptoAncla) + '</div>' : '') +
      (t.prerequisitos && t.prerequisitos.length ? acordeon('📐 Antes de empezar: prerrequisitos',
        '<ul>' + t.prerequisitos.map(p => '<li><strong>' + U.md(p.que) + '</strong>' + (p.porQue ? ' — <span class="nota">' + U.md(p.porQue) + '</span>' : '') + '</li>').join('') + '</ul>') : '') +
      (inv.laminas ? '<h2 class="cinta">La clase, lámina por lámina</h2>' + MIRU.laminas.render(t) : '') +
      (inv.laminas ? MIRU.laminas.autoria(t, c) : '') +
      (inv.laminas && ctaPasito ? ctaPasito : '') +
      (secciones ? '<h2 class="cinta">' + (inv.laminas ? 'Profundiza' : 'Lección') + '</h2>' + secciones : '') +
      (t.esquemas && t.esquemas.length && !(t.secciones || []).some(s => s.tipo === 'esquema') ? '<h2 class="cinta">Fisiopatología</h2>' + t.esquemas.map(e => MIRU.esquemas.render(e)).join('') : '') +
      (t.casos && t.casos.length && !(t.secciones || []).some(s => s.tipo === 'caso') ? '<h2 class="cinta">🩺 Casos clínicos</h2>' + t.casos.map(x => MIRU.casos.render(x)).join('') : '') +
      (t.resumen ? bloqueResumen(t.resumen, '🧠 Resumen del tema') : '') +
      (!inv.laminas && !secciones ? '<div class="nota-cinta">Las láminas de este tema están en preparación. Mientras tanto ya puedes practicar con las preguntas del banco.</div>' : '') +
      (!inv.laminas || !ctaPasito ? ctaPasito : '') +
      '<div class="tj practica"><h3>Practica este tema</h3><div class="tira">' +
      (nPas ? '<button class="btn btn--pri" data-ir="#/pasito/' + t.id + '" type="button">👣 Pasito (5 al azar)</button>' : '') +
      (inv.flashcards ? '<button class="btn" data-ir="#/flashcards/tema/' + t.id + '" type="button">🎴 ' + inv.flashcards + ' flashcards</button>' : '') +
      (inv.preguntas > 5 ? '<button class="btn" data-ir="#/practica-tema/' + t.id + '" type="button">📝 Todas las preguntas (' + inv.preguntas + ')</button>' : '') +
      '<button class="btn" data-ir="#/repaso/' + m.id + '" type="button">🔁 Errores</button></div>' +
      '<p class="nota">Pasitos superados en este tema: ' + P().pasitos(t.id).filter(x => x.aprobado).length + ' · Láminas leídas: ' + pt.laminas[0] + '/' + pt.laminas[1] + '</p></div>' +
      '<div class="tj"><h3>📚 Fuentes consultadas</h3><div data-fuentes-tema></div>' +
      '<p class="nota">' + MIRU.fuentes.avisoPDF + (t.revision ? ' · <strong>Última revisión: ' + U.esc(t.revision) + '</strong>' : '') + '</p></div>';

    const indice = indiceLam || indiceSec;
    return '<div class="temaLayout"><div>' + cuerpo + '</div>' +
      (indice ? '<nav class="indice" aria-label="En este tema"><div class="indice__t">En este tema</div>' + indiceLam + indiceSec +
        (nPas ? '<button class="btn btn--pri btn--sm indice__pas" data-ir="#/pasito/' + t.id + '" type="button">👣 Pasito</button>' : '') + '</nav>' : '<div></div>') + '</div>';
  };

  /* -- secciones de la lección del módulo -- */
  function seccion(s, i, t) {
    const anc = 'sec-' + t.id + '-' + i;
    const cab = s.titulo ? '<h3 class="sec-t" id="' + anc + '">' + U.esc(s.titulo) + '</h3>' : '';
    switch (s.tipo) {
      case 'texto': return cab + capaWrap(s) + marcar(t.id, anc);
      case 'pregunta': {
        const p = MIRU.pregunta(s.pregunta.id) || MIRU.formato.desdeModulo(s.pregunta, { temaId: t.id });
        return MIRU.preguntas.render(p, { incrustada: true });
      }
      case 'esquema': return cab + MIRU.esquemas.render(s.esquema) + marcar(t.id, anc);
      case 'tabla': return cab + (s.intro ? U.parrafos(s.intro) : '') + tabla(s.tabla) + (s.nota ? '<p class="nota">' + U.md(s.nota) + '</p>' : '') + marcar(t.id, anc);
      case 'dual': return cab + bloqueDual(s) + marcar(t.id, anc);
      case 'lista': return cab + (s.intro ? U.parrafos(s.intro) : '') + '<ul>' + s.items.map(x => '<li>' + (typeof x === 'string' ? U.md(x)
        : '<strong>' + U.md(x.t) + '</strong>' + (x.d ? ' — ' + U.md(x.d) : '')) + '</li>').join('') + '</ul>' + marcar(t.id, anc);
      case 'acordeon': return cab + s.items.map(x => acordeon(x.titulo, U.parrafos(x.texto), x.abierto)).join('') + marcar(t.id, anc);
      case 'caso': return cab + MIRU.casos.render(s.caso);
      default: return cab + capaWrap(s);
    }
  }
  const marcar = (temaId, anc) => '<span data-visto="' + U.esc(temaId) + '|' + U.esc(anc) + '"></span>';

  const CAPAS = {
    curso: ['curso', '📘 Material del curso'], complementaria: ['evid', '🔎 Investigación complementaria'],
    evidencia: ['evid', '🔬 Evidencia científica actual'], didactica: ['did', '🧠 Explicación didáctica'], aviso: ['aviso', '⚠️ Atención']
  };
  function capaWrap(s) {
    const cuerpo = U.parrafos(s.texto || '');
    if (!s.capa) return cuerpo;
    const c = CAPAS[s.capa] || CAPAS.curso;
    return '<div class="capa capa--' + c[0] + '"><div class="capa__t">' + c[1] + (s.origen ? ' · <span class="capa__x">' + U.esc(s.origen) + '</span>' : '') + '</div>' + cuerpo + '</div>';
  }

  /** Docente y evidencia: dos capas que conviven, nunca una confrontación. */
  function bloqueDual(s) {
    return '<div class="dual"><div class="dual__cab">⚖️ ' + U.esc(s.titulo2 || 'Enfoque del curso y evidencia actual') + '</div>' +
      '<div class="dual__p dual__p--curso"><span class="dual__et">📘 Enfoque enseñado en el curso' + (s.origen ? ' · ' + U.esc(s.origen) : '') + '</span>' + U.parrafos(s.curso) + '</div>' +
      '<div class="dual__p dual__p--evid"><span class="dual__et">🔬 Evidencia actual</span>' + U.parrafos(s.evidencia || s.actual) + '</div>' +
      (s.porQue ? '<div class="dual__p"><span class="dual__et">💡 ¿Por qué existe esta diferencia?</span>' + U.parrafos(s.porQue) + '</div>' : '') +
      (s.responder ? '<div class="dual__p dual__p--resp"><span class="dual__et">🎓 ¿Qué respondo?</span>' + U.parrafos(s.responder) + '</div>' : '') +
      '</div>';
  }
  V.bloqueDual = bloqueDual;

  function tabla(t) {
    return '<div class="tablaWrap"><table class="t">' +
      (t.cabecera ? '<thead><tr>' + t.cabecera.map(h => '<th>' + U.md(h) + '</th>').join('') + '</tr></thead>' : '') +
      '<tbody>' + t.filas.map(f => '<tr>' + f.map(cd => '<td>' + U.md(cd) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  V.tabla = tabla;

  function acordeon(titulo, html, abierto) {
    return '<details class="acor"' + (abierto ? ' open' : '') + '><summary class="acor__b">' + U.md(titulo) + '</summary><div class="acor__c">' + html + '</div></details>';
  }
  V.acordeon = acordeon;

  function bloqueResumen(r, titulo) {
    const caja = (t, arr) => !arr || !arr.length ? '' : '<div class="resbox"><h4 class="resbox__t">' + t + '</h4><ul>' + arr.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ul></div>';
    return '<h2 class="cinta">' + U.esc(titulo) + '</h2><div class="res">' +
      caja('🧠 Imprescindible', r.imprescindible) + caja('⚠️ Errores frecuentes', r.errores) + caja('🔗 Relaciones clave', r.relaciones) +
      caja('🩺 Importancia quirúrgica', r.quirurgica) +
      (r.cinco && r.cinco.length ? '<div class="resbox resbox--cinco"><h4 class="resbox__t">🎯 Si solo recuerdas 5 cosas…</h4><ol class="cinco">' + r.cinco.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ol></div>' : '') +
      '</div>';
  }

  /* =========================================================== SIMULACROS */
  V.simulacros = function () {
    const E = MIRU.evaluacion;
    const tarjeta = (clave, titulo, desc, href) => {
      const h = P().simulacros(clave);
      const ult = h.slice(-1)[0];
      const disp = E.disponible(clave);
      return '<div class="tj sim-tj"><h3>' + U.esc(titulo) + '</h3><p class="nota">' + U.esc(desc) + '</p>' +
        '<p>' + (h.length ? h.length + ' intento' + (h.length === 1 ? '' : 's') + ' · última nota <strong>' + U.num(ult.nota) + '</strong>' : 'Aún sin intentos') +
        ' · banco: ' + E.tamanoBanco(clave) + ' preguntas</p>' +
        '<button class="btn btn--pri" data-ir="' + href + '" type="button"' + (disp ? '' : ' disabled') + '>' + (disp ? 'Abrir' : 'Sin preguntas aún') + '</button></div>';
    };
    const esp = MIRU.modulosDe('especialidades'), gen = MIRU.modulosDe('generalidades');
    const ses = P().sesion();
    return '<header class="titulo-grande"><h1>Simulacros</h1><p>Como el examen: reloj único, corrección al final y refuerzo de lo que más fallas.</p></header>' +
      (ses ? '<div class="nota-cinta">Tienes un simulacro en curso: <strong>' + U.esc(E.tituloClave(ses.clave)) + '</strong>. <a href="#/simulacro-en-curso">Continuar</a></div>' : '') +
      '<div class="rejilla">' +
      tarjeta('especialidades', 'Simulacro de Especialidades', '40 preguntas · 40 minutos · 10 por especialidad.', '#/simulacro/especialidades') +
      tarjeta('generalidades', 'Simulacro de Generalidades', '40 preguntas · 40 minutos · repartidas entre las clases que ya tienen preguntas.', '#/simulacro/generalidades') +
      '</div><h2 class="cinta">Repaso de una rotación o semana</h2><p class="ayuda">10 preguntas · 10 minutos, de un solo módulo.</p><div class="rejilla">' +
      esp.concat(gen).map(m => tarjeta('rotacion:' + m.id, m.nombre, (m.bloque === 'generalidades' ? 'Semana de Generalidades' : 'Especialidad'), '#/simulacro/rotacion/' + m.id)).join('') +
      '</div>';
  };

  /* ================================================================ REPASO */
  V.repaso = function (moduloId) {
    const fall = P().falladas(moduloId);
    const m = moduloId ? MIRU.modulo(moduloId) : null;
    const cab = '<header class="titulo-grande"><h1>Necesitas repasar</h1>' + (m ? '<p>' + U.esc(m.nombre) + ' · <a href="#/repaso">ver todo</a></p>' : '') + '</header>';
    if (!fall.length) return cab + MIRU.ui.vacio('check', 'Nada pendiente', 'Cuando falles una pregunta aparecerá aquí con su explicación, hasta que la aciertes.');
    return cab + '<div class="nota-cinta"><strong>' + fall.length + '</strong> preguntas cuyo último intento fue incorrecto. Salen de esta lista en cuanto las aciertes.</div>' +
      '<div class="tira"><button class="btn btn--pri" data-ir="#/reintentar' + (moduloId ? '/' + moduloId : '') + '" type="button">🔁 Reintentar ' + Math.min(fall.length, 20) + ' de ellas</button></div>' +
      fall.slice(0, 60).map(f => {
        const p = MIRU.pregunta(f.id);
        const r = MIRU.temaPorId(p.temaId);
        const det = p.tipo === 'opcion' ? MIRU.preguntas.explicacion(p, f.ultimaRespuesta) : U.parrafos(p.explicacion, p.marcado);
        return '<details class="fallo"><summary><span class="eti eti--bad">' + f.fallos + ' fallo' + (f.fallos === 1 ? '' : 's') + '</span> ' +
          U.esc(U.recorta(p.enunciado, 130)) + '</summary><div class="fallo__c">' +
          '<p class="nota">' + (r ? U.esc(r.modulo.nombre + ' · ' + r.tema.nombre) : '') + ' · último intento: ' + U.fecha(f.ultima) + '</p>' +
          U.parrafos(p.enunciado, p.marcado) + det + '</div></details>';
      }).join('');
  };

  /* ========================================================= ESTADÍSTICAS */
  V.estadisticas = function () {
    const est = P().todo();
    const preg = Object.values(est.preguntas);
    const intentos = preg.reduce((a, r) => a + r.intentos, 0);
    const aciertos = preg.reduce((a, r) => a + r.aciertos, 0);
    const dom = Object.values(est.flashcards).filter(f => f.estado === 'se').length;
    const sims = P().simulacros();
    const filas = MIRU.datos.modulos.map(m => {
      const p = MIRU.pct.modulo(m.id);
      const ids = new Set(MIRU.preguntasDeModulo(m.id).map(x => x.id));
      const r = Object.entries(est.preguntas).filter(([id]) => ids.has(id)).map(([, v]) => v);
      const it = r.reduce((a, x) => a + x.intentos, 0), ac = r.reduce((a, x) => a + x.aciertos, 0);
      return '<tr><td>' + U.esc(m.nombre) + '</td><td>' + p.pct + ' %</td><td>' + (it ? Math.round(ac / it * 100) + ' %' : '—') + '</td><td>' + P().falladas(m.id).length + '</td></tr>';
    }).join('');
    return '<header class="titulo-grande"><h1>Estadísticas</h1></header>' +
      '<div class="estat">' +
      tarjetaEst(MIRU.pct.curso() + ' %', 'Progreso del curso') +
      tarjetaEst(intentos ? Math.round(aciertos / intentos * 100) + ' %' : '—', 'Acierto global (' + aciertos + '/' + intentos + ')') +
      tarjetaEst(new Set(P().pasitos().filter(x => x.aprobado).map(x => x.temaId)).size + '', 'Temas con pasito superado') +
      tarjetaEst(sims.length + '', 'Simulacros terminados') +
      tarjetaEst(dom + '', 'Flashcards dominadas') +
      tarjetaEst(P().falladas().length + '', 'Por repasar') + '</div>' +
      '<div class="tj"><h3>Por módulo</h3><div class="tablaWrap"><table class="t"><thead><tr><th>Módulo</th><th>Progreso</th><th>Acierto</th><th>Por repasar</th></tr></thead><tbody>' + filas + '</tbody></table></div></div>' +
      (sims.length ? '<div class="tj"><h3>Historial de simulacros</h3><div class="tablaWrap"><table class="t"><thead><tr><th>Simulacro</th><th>Nota</th><th>Aciertos</th><th>Fecha</th><th></th></tr></thead><tbody>' +
        sims.slice().reverse().slice(0, 20).map(x => '<tr><td>' + U.esc(MIRU.evaluacion.tituloClave(x.tipo)) + '</td><td>' + U.num(x.nota) + '</td><td>' + x.aciertos + '/' + x.total + '</td><td>' + U.fechaCorta(x.fecha) +
          '</td><td><a href="#/resultado/' + U.esc(x.id) + '">Revisión</a></td></tr>').join('') + '</tbody></table></div></div>' : '');
  };
  const tarjetaEst = (v, e) => '<div class="estat__c"><div class="estat__v">' + v + '</div><div class="estat__e">' + e + '</div></div>';

  /* ================================================================ PERFIL */
  const MIRU_CFG = () => global.MIRU_CONFIG || {};
  V.perfil = function () {
    const lista = P().perfiles();
    const act = P().perfilActivo();
    const pref = P().perfil('tema') || 'auto';
    const admin = MIRU.admin && MIRU.admin.activo();
    const AL = MIRU.almacen;
    const sb = AL.modo === 'supabase';
    const cuenta = sb ? AL.cuenta() : null;
    const ligado = cuenta ? lista.find(x => x.id === cuenta.perfilId) : null;
    const est = AL.etiqueta();
    const curso = cuenta ? (cuenta.cursos || []).find(x => x.curso === (MIRU_CFG().curso || 'cir1')) : null;
    const nuevas = (MIRU.sugerencias && MIRU.sugerencias.nuevas) || 0;
    return '<header class="titulo-grande"><h1>Mi perfil</h1><p>' + U.esc(act ? act.nombre : '') + (cuenta ? ' · ' + U.esc(cuenta.codigo) : '') + '</p></header>' +
      grupo('', [
        fila({ href: '#/estadisticas', ico: icoFijo('grafico', 'azul'), t: 'Estadísticas' }),
        fila({ href: '#/sugerir', ico: icoFijo('burbuja', 'verde'), t: 'Sugerir una mejora', s: 'Cuéntale a la administradora qué mejorarías' })
      ].concat(admin ? [fila({ href: '#/admin', ico: icoFijo('herramienta', 'durazno'), t: 'Administración', v: nuevas ? '<span class="insignia">' + nuevas + '</span>' : '' })] : [])) +
      (cuenta ? '<div class="tj"><h3>Tu cuenta miru</h3>' +
        '<p><strong>' + U.esc(cuenta.codigo) + '</strong> · ' + U.esc(cuenta.nombre) + '</p>' +
        '<p class="nota" data-sinc>' + est.i + ' ' + U.esc(est.t) + '</p>' +
        '<p class="nota">' + (curso ? 'Acceso a Cirugía I hasta el ' + U.fecha(curso.hasta + 'T12:00:00') + '. ' : '') +
        'Este dispositivo (' + U.esc(AL.etiquetaDispositivo()) + ') es el único activo en tu cuenta: si activas miru en otro, este se cierra y tu progreso sincronizado te sigue.</p>' +
        '<div class="tira"><button class="btn btn--sm" data-acc="sincronizar" type="button">↻ Sincronizar ahora</button>' +
        '<button class="btn btn--sm btn--peligro" data-acc="cerrar-sesion" type="button">Cerrar sesión en este dispositivo</button></div></div>' : '') +
      '<div class="tj"><h3>Perfiles en este dispositivo</h3>' +
      '<p class="nota">Cada perfil guarda su propio avance. Si dos personas usan el mismo equipo, cada una elige su perfil y no se mezclan.' +
      (ligado ? ' Solo el perfil «' + U.esc(ligado.nombre) + '» se sincroniza con tu cuenta.' : '') + '</p>' +
      '<ul class="perfiles">' + lista.map(x => '<li' + (act && x.id === act.id ? ' class="activo"' : '') + '>' +
        '<span class="perfiles__n">' + U.esc(x.nombre) + (act && x.id === act.id ? ' <span class="eti eti--ok">en uso</span>' : '') + '</span>' +
        '<span class="tira">' + (act && x.id === act.id ? '' : '<button class="btn btn--sm" data-acc="usar-perfil" data-id="' + x.id + '" type="button">Usar</button>') +
        '<button class="btn btn--sm" data-acc="renombrar-perfil" data-id="' + x.id + '" type="button">Renombrar</button>' +
        (lista.length > 1 ? '<button class="btn btn--sm btn--peligro" data-acc="borrar-perfil" data-id="' + x.id + '" type="button">Eliminar</button>' : '') +
        '</span></li>').join('') + '</ul>' +
      '<button class="btn" data-acc="nuevo-perfil" type="button">＋ Nuevo perfil</button></div>' +

      '<div class="tj"><h3>Apariencia y semestre</h3>' +
      '<div class="campo"><span class="campo__l">Tema</span><div class="segmentado" role="radiogroup" aria-label="Tema">' +
      [['claro', MIRU.icono('sol') + ' Claro'], ['oscuro', MIRU.icono('luna') + ' Oscuro'], ['auto', MIRU.icono('monitor') + ' Automático']].map(([v, t]) =>
        '<button type="button" role="radio" aria-checked="' + (pref === v) + '" data-acc="tema-pref" data-v="' + v + '">' + t + '</button>').join('') + '</div></div>' +
      '<label class="campo"><span class="campo__l">Inicio de Generalidades</span><input type="date" data-campo="inicioGeneralidades" value="' + U.esc(P().perfil('inicioGeneralidades') || '') + '">' +
      '<span class="nota">Con esta fecha, «Mi semestre» marca la semana en la que vas.</span></label></div>' +

      '<div class="tj"><h3>Tus datos</h3>' +
      '<p class="nota">El progreso se guarda en este navegador' + (cuenta ? ' y, el del perfil ligado, también en tu cuenta miru' : '') + '. Antes de cada actualización de contenido y una vez al día se guarda un respaldo automático. ' +
      (P().disponible() ? '' : '<strong>Atención: el almacenamiento no está disponible (¿ventana privada?). El progreso no se conservará.</strong>') + '</p>' +
      '<div class="tira"><button class="btn" data-acc="exportar" type="button">⬇ Exportar mi progreso</button>' +
      '<button class="btn" data-acc="importar" type="button">⬆ Importar progreso</button>' +
      '<button class="btn" data-acc="respaldar" type="button">💾 Respaldar ahora</button></div>' +
      '<input type="file" accept="application/json,.json" data-file hidden>' +
      '<h4>Respaldos automáticos</h4><div data-respaldos><p class="nota">Cargando…</p></div>' +
      '<details class="acor"><summary class="acor__b">Zona delicada</summary><div class="acor__c"><p class="nota">Borrar el progreso de este perfil. Antes se guarda un respaldo.</p>' +
      '<button class="btn btn--peligro" data-acc="borrar-progreso" type="button">Borrar mi progreso</button></div></details></div>' +

      '<div class="tj"><h3>Sobre miru</h3><p class="nota">' + U.esc(MIRU.contenido.etiqueta()) + ' · progreso esquema ' + MIRU.progreso.ESQUEMA + '</p>' +
      '<p class="nota">Contenido de estudio. No sustituye las clases, los libros ni las guías clínicas vigentes. Para el examen, vale lo que enseña tu docente.</p>' +
      '<div class="tira"><button class="btn btn--sm" data-acc="admin" type="button">' + (sb ? (admin ? '🛠 Cerrar sesión de administradora' : '🛠 Entrar como administradora') : (admin ? '🛠 Salir del modo administrador' : '🛠 Modo administrador')) + '</button>' +
      (admin ? '<button class="btn btn--sm" data-ir="#/admin" type="button">Abrir panel</button>' : '') + '</div></div>';
  };

  V.pintarRespaldos = async function (raiz) {
    const el = raiz.querySelector('[data-respaldos]'); if (!el) return;
    const l = await P().listarRespaldos();
    el.innerHTML = l.length ? '<ul class="respaldos">' + l.map(r => '<li><span>' + U.fechaCorta(r.ts) + ' · ' + U.esc(r.motivo) + '</span>' +
      '<button class="btn btn--sm" data-acc="restaurar" data-id="' + U.esc(r.id) + '" type="button">Restaurar</button></li>').join('') + '</ul>'
      : '<p class="nota">Todavía no hay respaldos (o este navegador no permite guardarlos).</p>';
  };

  /* ================================================================ OTRAS */
  V.bienvenida = function () {
    return '<div class="bienvenida"><div class="bienvenida__nota"><span class="bienvenida__icono acceso__logo" aria-hidden="true"></span>' +
      '<h1>Hola, soy miru</h1><p>Tu planificador de Cirugía I: láminas, pasitos, flashcards y simulacros.</p>' +
      '<form data-form="perfil"><label class="campo"><span class="campo__l">¿Cómo te llamas?</span>' +
      '<input name="nombre" autocomplete="given-name" maxlength="40" required placeholder="Tu nombre"></label>' +
      '<button class="boton" type="submit">Empezar</button></form>' +
      '<p class="nota">Tu avance se guarda en este dispositivo, en tu perfil. Si alguien más usa este equipo, podrá crear el suyo.</p></div></div>';
  };

  V.noEncontrado = function () {
    return MIRU.ui.vacio('brujula', 'No encontré esa página', '<a href="#/">Volver a Mi semestre</a>');
  };

})(window);
