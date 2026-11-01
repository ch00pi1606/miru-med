/* =========================================================================
   miru · MOTOR DE EVALUACIÓN — modo «evaluar» (simulacros)
   Reloj único, sin corrección hasta entregar, solo opción múltiple y sorteo
   adaptativo. Mismas reglas que el simulacro original:
     · 1 pregunta por clase y el resto en proporción al banco.
     · Desde el 5.º simulacro del mismo tipo, una clase con ≥ 40 % de error
       en los últimos 5 recibe 1 extra; con ≥ 60 %, 2.
     · Dentro de cada clase: primero las nunca vistas, luego las falladas y
       al final las acertadas. Sin enunciados repetidos.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;

  const REGLAS = {
    NOTA_MAXIMA: 20,
    NOTA_APROBATORIA: 11,
    INTENTOS_PARA_REFUERZO: 5,
    VENTANA_INTENTOS: 5,
    UMBRAL_1_EXTRA: 0.40,
    UMBRAL_2_EXTRA: 0.60
  };

  const TIPOS = {
    especialidades: {
      titulo: 'Simulacro de Especialidades',
      subtitulo: 'Oncología, Anestesiología, Traumatología y Cirugía pediátrica',
      modulos: () => MIRU.modulosDe('especialidades').map(m => m.id),
      porModulo: 10, minutos: 40
    },
    generalidades: {
      titulo: 'Simulacro de Generalidades',
      subtitulo: 'Las 35 clases de Cirugía general',
      modulos: () => MIRU.modulosDe('generalidades').map(m => m.id),
      total: 40, minutos: 40
    },
    rotacion: {
      titulo: 'Repaso de la rotación',
      subtitulo: '10 preguntas de una sola especialidad',
      modulos: m => [m],
      porModulo: 10, minutos: 10
    }
  };

  const E = MIRU.evaluacion = { REGLAS, TIPOS };

  /* ------------------------------------------------------------ ayudas */
  const tipoDe = (tipo, mod) => tipo === 'rotacion' ? 'rotacion:' + mod : tipo;
  const cfgDe = tipo => TIPOS[tipo.split(':')[0]];
  const modulosDe = clave => { const [t, m] = clave.split(':'); return TIPOS[t].modulos(m); };
  const nombreMod = id => { const m = MIRU.modulo(id); return m ? m.nombre : id; };
  const colorMod = id => { const m = MIRU.modulo(id); return m ? m.color : 'lila'; };
  const historial = clave => MIRU.progreso.simulacros(clave);

  /** Clases que pueden aportar preguntas a un módulo en un simulacro. */
  function unidades(modId) {
    return MIRU.clasesDe(modId).map(c => ({ clase: c, pool: MIRU.preguntasDeClase(c.id, 'simulacro') })).filter(u => u.pool.length);
  }
  E.disponible = function (clave) {
    return modulosDe(clave).some(m => unidades(m).length);
  };
  E.tamanoBanco = function (clave) {
    return modulosDe(clave).reduce((s, m) => s + MIRU.preguntasDeModulo(m, 'simulacro').length, 0);
  };

  /* -------------------------------------------------- dominio y refuerzo */
  E.estadisticasClase = function (clave, modId, ventana) {
    const h = historial(clave);
    const ult = ventana ? h.slice(-ventana) : h;
    const m = {};
    ult.forEach(x => (x.items || []).forEach(it => {
      if (it.mod !== modId) return;
      const c = m[it.claseId] || (m[it.claseId] = { n: 0, err: 0 });
      c.n++; if (!it.ok) c.err++;
    }));
    return m;
  };
  E.refuerzoActivo = clave => historial(clave).length >= REGLAS.INTENTOS_PARA_REFUERZO;
  E.extrasPorClase = function (clave, modId) {
    const out = {};
    if (!E.refuerzoActivo(clave)) return out;
    const est = E.estadisticasClase(clave, modId, REGLAS.VENTANA_INTENTOS);
    Object.keys(est).forEach(c => {
      const r = est[c].n ? est[c].err / est[c].n : 0;
      out[c] = r >= REGLAS.UMBRAL_2_EXTRA ? 2 : (r >= REGLAS.UMBRAL_1_EXTRA ? 1 : 0);
    });
    return out;
  };

  /** Cuántas preguntas de cada clase entran (para N preguntas del módulo). */
  function reparto(clave, modId, N) {
    const us = unidades(modId);
    const disp = {}; us.forEach(u => { disp[u.clase.id] = u.pool.length; });
    let ids = us.map(u => u.clase.id);
    const extras = E.extrasPorClase(clave, modId);
    const est = E.estadisticasClase(clave, modId, REGLAS.VENTANA_INTENTOS);
    const tasa = c => est[c] && est[c].n ? est[c].err / est[c].n : 0.25;
    // Si hay más clases que preguntas, entran primero las más débiles.
    if (ids.length > N) ids = U.mezclar(ids).sort((a, b) => (extras[b] || 0) - (extras[a] || 0) || tasa(b) - tasa(a)).slice(0, N);
    const slots = {};
    ids.forEach(c => { slots[c] = Math.min(disp[c], 1 + (extras[c] || 0)); });
    let total = ids.reduce((s, c) => s + slots[c], 0);
    if (total > N) {
      const fuertes = U.mezclar(ids).sort((a, b) => tasa(a) - tasa(b));
      for (let i = 0; i < fuertes.length && total > N; i++) { const c = fuertes[i]; if (!extras[c] && slots[c] > 0) { slots[c]--; total--; } }
      for (let i = 0; i < fuertes.length && total > N; i++) { const c = fuertes[i]; while (slots[c] > 1 && total > N) { slots[c]--; total--; } }
    }
    let guard = 0;
    while (total < N && guard++ < 1000) {
      const libres = ids.filter(c => slots[c] < disp[c]);
      if (!libres.length) break;
      const peso = libres.reduce((s, c) => s + (disp[c] - slots[c]), 0);
      let r = Math.random() * peso, el = libres[0];
      for (let i = 0; i < libres.length; i++) { r -= (disp[libres[i]] - slots[libres[i]]); if (r <= 0) { el = libres[i]; break; } }
      slots[el]++; total++;
    }
    return slots;
  }

  /** Prioridad: nunca vista < fallada la última vez < acertada (menos vista primero). */
  function prioridad(id) {
    const r = MIRU.progreso.pregunta(id);
    if (!r) return 0;
    if (r.ultimoAcierto === false) return 1;
    return 2 + (r.intentos || 0);
  }

  E.armar = function (clave) {
    const cfg = cfgDe(clave);
    const mods = modulosDe(clave).filter(m => unidades(m).length);
    const preguntas = [];
    const usados = {};
    // Cuántas por módulo
    const porMod = {};
    if (cfg.porModulo) mods.forEach(m => { porMod[m] = cfg.porModulo; });
    else {
      // Total repartido en proporción a las clases con preguntas de cada módulo
      const nClases = mods.map(m => unidades(m).length);
      const sum = nClases.reduce((a, b) => a + b, 0) || 1;
      let asign = 0;
      mods.forEach((m, k) => { porMod[m] = Math.floor(cfg.total * nClases[k] / sum); asign += porMod[m]; });
      let k = 0; while (asign < cfg.total && mods.length) { porMod[mods[k % mods.length]]++; asign++; k++; }
    }
    mods.forEach(m => {
      const slots = reparto(clave, m, porMod[m]);
      const elegidas = [];
      Object.keys(slots).forEach(cid => {
        const cand = U.mezclar(MIRU.preguntasDeClase(cid, 'simulacro')).sort((a, b) => prioridad(a.id) - prioridad(b.id));
        let k = 0;
        for (let i = 0; i < cand.length && k < slots[cid]; i++) {
          const firma = U.normal(cand[i].enunciado);
          if (usados[firma]) continue;
          usados[firma] = true; elegidas.push(cand[i]); k++;
        }
      });
      U.mezclar(elegidas).forEach(p => preguntas.push({ id: p.id, mod: m, orden: MIRU.preguntas.orden(p) }));
    });
    const ahora = Date.now();
    return {
      id: U.id('sim'), clave, inicio: ahora, limite: ahora + cfg.minutos * 60000,
      preguntas, resp: {}, marcadas: {}, actual: 0
    };
  };

  /* =================================================================
     PANTALLA DE INICIO DEL SIMULACRO
     ================================================================= */
  E.inicio = function (cont, tipo, modId) {
    detener();
    const clave = tipoDe(tipo, modId);
    const cfg = cfgDe(clave);
    const mods = modulosDe(clave);
    const hist = historial(clave);
    const ses = MIRU.progreso.sesion();
    const nTotal = cfg.porModulo ? cfg.porModulo * mods.filter(m => unidades(m).length).length : cfg.total;
    const refuerzo = E.refuerzoActivo(clave);
    const faltan = Math.max(0, REGLAS.INTENTOS_PARA_REFUERZO - hist.length);
    const titulo = tipo === 'rotacion' ? 'Repaso de ' + nombreMod(modId) : cfg.titulo;
    const disponible = E.disponible(clave);

    const columnas = mods.map(m => {
      const us = MIRU.clasesDe(m);
      const ex = E.extrasPorClase(clave, m);
      const est = E.estadisticasClase(clave, m, REGLAS.VENTANA_INTENTOS);
      const nb = MIRU.preguntasDeModulo(m, 'simulacro').length;
      return '<article class="columna" data-color="' + colorMod(m) + '">' +
        '<header class="columna-cabeza"><h3>' + U.esc(nombreMod(m)) + '</h3>' +
        '<p>' + (cfg.porModulo ? cfg.porModulo + ' preguntas en el simulacro' : nb + ' preguntas en el banco') + '</p></header>' +
        '<ul class="temas">' + us.map(c => {
          const n = MIRU.preguntasDeClase(c.id, 'simulacro').length;
          const e = est[c.id];
          let txt = 'Sin datos', p = 0, cl = 'sin-datos';
          if (!n) txt = 'Sin preguntas aún';
          else if (e && e.n) { p = Math.round(100 * (e.n - e.err) / e.n); txt = (e.n - e.err) + ' de ' + e.n; cl = p >= 70 ? 'alto' : p >= 50 ? 'medio' : 'bajo'; }
          return '<li class="tema-fila' + (n ? '' : ' tema-fila--vacia') + '"><span class="tema-nombre">' + (c.numero ? c.numero + '. ' : '') + U.esc(c.nombre) + '</span>' +
            '<span class="tema-medida"><span class="barra-d ' + cl + '"><span style="width:' + p + '%"></span></span><small>' + txt + '</small>' +
            (ex[c.id] ? '<span class="refuerzo" title="Recibirá ' + ex[c.id] + ' pregunta(s) extra">+' + ex[c.id] + '</span>' : '') + '</span></li>';
        }).join('') + '</ul>' +
        '<footer class="columna-pie">Banco: ' + nb + ' preguntas</footer></article>';
    }).join('');

    const acciones = !disponible
      ? '<p class="aviso">Todavía no hay preguntas suficientes para este simulacro. Se activará cuando haya contenido.</p>'
      : ses
        ? (ses.clave === clave
          ? '<button class="boton boton-grande" data-acc="continuar" type="button">Continuar el simulacro en curso</button>' +
            '<button class="boton boton-suave" data-acc="descartar" type="button">Descartarlo y empezar otro</button>'
          : '<p class="aviso">Tienes otro simulacro en curso (' + U.esc(tituloClave(ses.clave)) + '). <a href="#/simulacro-en-curso">Continúalo</a> o descártalo para empezar este.</p>' +
            '<button class="boton boton-suave" data-acc="descartar" type="button">Descartar el otro</button>')
        : '<button class="boton boton-grande" data-acc="empezar" type="button">Empezar simulacro</button>';

    cont.innerHTML =
      '<header class="portada">' +
        '<div class="portada-titulo"><h1>' + U.esc(titulo) + '</h1>' +
        '<p class="subtitulo">' + U.esc(tipo === 'rotacion' ? cfg.subtitulo : cfg.subtitulo) + '</p></div>' +
        '<div class="nota-adhesiva nota-lila"><strong>' + nTotal + ' preguntas</strong><br>' + cfg.minutos + ' minutos<br>' +
        'Nota sobre ' + REGLAS.NOTA_MAXIMA + '<br>Apruebas con ' + REGLAS.NOTA_APROBATORIA + '</div>' +
      '</header>' +
      '<section class="arranque">' + acciones + '</section>' +
      '<section aria-labelledby="t-dom"><h2 id="t-dom" class="cinta">Mi dominio por clase</h2>' +
        '<p class="ayuda">Aciertos en tus últimos ' + REGLAS.VENTANA_INTENTOS + ' simulacros de este tipo. ' +
        (refuerzo ? 'Las clases con <span class="refuerzo">+1</span> o <span class="refuerzo">+2</span> recibirán preguntas extra.'
          : 'El refuerzo de clases débiles empieza después de ' + REGLAS.INTENTOS_PARA_REFUERZO + ' simulacros' + (faltan ? ' (te falta' + (faltan > 1 ? 'n ' : ' ') + faltan + ')' : '') + '.') + '</p>' +
        '<div class="planificador planificador--' + Math.min(mods.length, 4) + '">' + columnas + '</div></section>' +
      '<section class="fila-inferior">' +
        '<article class="tarjeta"><h2>Mi progreso</h2>' + grafico(hist) + listaHistorial(hist) + '</article>' +
        '<aside class="tarjeta recuerda"><h2>Cómo funciona</h2><ul>' +
          '<li>Un solo reloj de ' + cfg.minutos + ' minutos para todo. Al acabarse, se entrega solo.</li>' +
          '<li>No verás si acertaste hasta entregar, como en el examen.</li>' +
          '<li>Puedes saltar, volver y marcar preguntas para revisarlas.</li>' +
          '<li>En la revisión ves por qué es correcta cada respuesta, por qué no lo es la tuya y de dónde sale el dato.</li>' +
          '<li>Si el docente y la guía no coinciden, se te dice qué marcar en el examen.</li>' +
        '</ul></aside>' +
      '</section>';

    U.on(cont, 'click', '[data-acc]', function (e, b) {
      const a = b.dataset.acc;
      if (a === 'empezar') { const s = E.armar(clave); MIRU.progreso.guardarSesionYa(s); location.hash = '#/simulacro-en-curso'; }
      else if (a === 'continuar') location.hash = '#/simulacro-en-curso';
      else if (a === 'descartar') MIRU.ui.confirmar('¿Descartar el simulacro en curso?', 'Se perderán las respuestas que llevas. No cuenta para tu progreso.', 'Descartar', () => {
        MIRU.progreso.guardarSesionYa(null); E.inicio(cont, tipo, modId);
      });
      else if (a === 'revisar') location.hash = '#/resultado/' + b.dataset.id;
    });
  };

  function tituloClave(clave) {
    const [t, m] = clave.split(':');
    return t === 'rotacion' ? 'Repaso de ' + nombreMod(m) : TIPOS[t].titulo;
  }
  E.tituloClave = tituloClave;

  function grafico(hist) {
    const d = hist.slice(-20);
    if (!d.length) return '<p class="vacio">Tu primera nota aparecerá aquí cuando termines un simulacro.</p>';
    const W = 560, H = 220, mx = 38, my = 18, mb = 30, iw = W - mx - 14, ih = H - my - mb;
    const x = i => mx + (d.length === 1 ? iw / 2 : i * iw / (d.length - 1));
    const y = v => my + ih - v / REGLAS.NOTA_MAXIMA * ih;
    let s = '';
    [0, 5, 10, 15, 20].forEach(v => {
      s += '<line x1="' + mx + '" x2="' + (W - 14) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="g-rejilla"/><text x="' + (mx - 8) + '" y="' + (y(v) + 4) + '" class="g-eje" text-anchor="end">' + v + '</text>';
    });
    s += '<line x1="' + mx + '" x2="' + (W - 14) + '" y1="' + y(REGLAS.NOTA_APROBATORIA) + '" y2="' + y(REGLAS.NOTA_APROBATORIA) + '" class="g-aprob"/>' +
      '<text x="' + (W - 16) + '" y="' + (y(REGLAS.NOTA_APROBATORIA) - 6) + '" class="g-aprob-txt" text-anchor="end">Aprobado: ' + REGLAS.NOTA_APROBATORIA + '</text>';
    s += '<polyline points="' + d.map((h, i) => x(i) + ',' + y(h.nota)).join(' ') + '" class="g-linea"/>';
    d.forEach((h, i) => {
      s += '<circle cx="' + x(i) + '" cy="' + y(h.nota) + '" r="5" class="' + (h.nota >= REGLAS.NOTA_APROBATORIA ? 'g-ok' : 'g-mal') + '"><title>' + U.esc(U.fechaCorta(h.fecha) + ': ' + U.num(h.nota)) + '</title></circle>';
      if (d.length <= 12 || i === d.length - 1) s += '<text x="' + x(i) + '" y="' + (H - 10) + '" class="g-eje" text-anchor="middle">' + (hist.length - d.length + i + 1) + '</text>';
    });
    return '<svg class="grafico" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc('Notas de los últimos ' + d.length + ' simulacros: ' + d.map(h => U.num(h.nota)).join(', ')) + '">' + s + '</svg>' +
      '<p class="grafico-pie">Eje horizontal: número de simulacro. Eje vertical: nota sobre 20.</p>';
  }
  E.grafico = grafico;

  function listaHistorial(hist) {
    if (!hist.length) return '';
    return '<ol class="historial" reversed>' + hist.slice().reverse().slice(0, 10).map(h =>
      '<li><span class="h-fecha">' + U.esc(U.fechaCorta(h.fecha)) + '</span>' +
      '<span class="h-nota ' + (h.nota >= REGLAS.NOTA_APROBATORIA ? 'ok' : 'mal') + '">' + U.num(h.nota) + '</span>' +
      '<button class="enlace" data-acc="revisar" data-id="' + U.esc(h.id) + '" type="button">Ver revisión</button></li>').join('') + '</ol>';
  }

  /* =================================================================
     EXAMEN EN CURSO
     ================================================================= */
  let ses = null, tempo = null, $c = null;

  function detener() { if (tempo) { clearInterval(tempo); tempo = null; } document.body.classList.remove('modo-examen'); }
  E.detener = detener;
  const guardar = () => MIRU.progreso.guardarSesionYa(ses);
  const respondidas = () => Object.keys(ses.resp).length;

  E.abrir = function (cont) {
    detener();
    const s = MIRU.progreso.sesion();
    if (!s) { location.hash = '#/simulacros'; return; }
    // Quita preguntas que ya no existan en el banco (contenido actualizado)
    s.preguntas = s.preguntas.filter(p => MIRU.pregunta(p.id));
    if (!s.preguntas.length) { MIRU.progreso.guardarSesionYa(null); location.hash = '#/simulacros'; return; }
    ses = s; $c = cont;
    if (Date.now() >= ses.limite) { finalizar(true); return; }
    document.body.classList.add('modo-examen');
    pintarExamen();
    tempo = setInterval(tic, 1000);
    tic();
  };

  function tic() {
    if (!ses) return;
    const resta = ses.limite - Date.now();
    const r = document.getElementById('reloj');
    if (r) { r.textContent = U.reloj(resta); r.parentElement.classList.toggle('poco-tiempo', resta <= 5 * 60000); }
    if (resta <= 0) finalizar(true);
  }

  function pintarExamen() {
    const mods = [...new Set(ses.preguntas.map(p => p.mod))];
    const mapa = mods.map(m => {
      const idx = []; ses.preguntas.forEach((p, i) => { if (p.mod === m) idx.push(i); });
      return '<div class="mapa-col" data-color="' + colorMod(m) + '"><p>' + U.esc(nombreMod(m)) + '</p><div class="mapa-casillas">' +
        idx.map(i => '<button class="casilla-nav" data-ir="' + i + '" type="button" aria-label="Pregunta ' + (i + 1) + '">' + (i + 1) + '</button>').join('') +
        '</div></div>';
    }).join('');
    $c.innerHTML =
      '<header class="barra-examen">' +
        '<p class="barra-titulo">' + U.esc(tituloClave(ses.clave)) + '</p>' +
        '<p class="reloj" aria-label="Tiempo restante"><span aria-hidden="true">⏱</span> <span id="reloj">' + U.reloj(ses.limite - Date.now()) + '</span></p>' +
        '<p class="barra-avance"><span id="avance">' + respondidas() + '</span> de ' + ses.preguntas.length + ' respondidas</p>' +
        '<button class="boton boton-suave" data-acc="terminar" type="button">Terminar</button>' +
      '</header>' +
      '<div class="examen"><section class="pregunta" id="pregunta" tabindex="-1" aria-live="polite"></section>' +
      '<nav class="mapa" aria-label="Ir a una pregunta">' + mapa +
      '<p class="mapa-leyenda"><span class="ley ley-resp"></span> respondida <span class="ley ley-marca"></span> marcada</p></nav></div>';
    U.on($c, 'click', '[data-ir]', function (e, b) { irA(+b.dataset.ir); });
    $c.querySelector('[data-acc="terminar"]').addEventListener('click', pedirTerminar);
    pintarPregunta();
  }

  function irA(i) {
    ses.actual = Math.max(0, Math.min(ses.preguntas.length - 1, i));
    guardar(); pintarPregunta();
    const p = document.getElementById('pregunta');
    if (p) { p.focus({ preventScroll: true }); if (p.getBoundingClientRect().top < 0) p.scrollIntoView({ block: 'start' }); }
  }

  function pintarPregunta() {
    const i = ses.actual, item = ses.preguntas[i], q = MIRU.pregunta(item.id);
    const total = ses.preguntas.length, marcada = !!ses.marcadas[i];
    const tema = MIRU.temaPorId(q.temaId);
    const c = document.getElementById('pregunta');
    c.setAttribute('data-color', colorMod(item.mod));
    c.innerHTML =
      '<header class="pregunta-cabeza"><p class="pregunta-esp">' + U.esc(nombreMod(item.mod)) + '</p>' +
      '<p class="pregunta-num">Pregunta ' + (i + 1) + ' de ' + total + '</p></header>' +
      '<p class="pregunta-tema">' + U.esc(tema ? tema.tema.nombre : (MIRU.clase(q.claseId) || {}).nombre || '') + '</p>' +
      '<fieldset class="alternativas"><legend class="enunciado">' + U.txt(q.enunciado, q.marcado) + '</legend>' +
      item.orden.map((id, k) => {
        const a = q.alternativas.find(x => x.id === id); if (!a) return '';
        const sel = ses.resp[i] === id;
        return '<label class="alt' + (sel ? ' elegida' : '') + '"><input type="radio" name="alt" value="' + U.esc(id) + '"' + (sel ? ' checked' : '') + '>' +
          '<span class="casilla" aria-hidden="true"></span><span class="alt-letra">' + U.letra(k) + ')</span><span class="alt-texto">' + U.txt(a.texto, q.marcado) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<div class="acciones">' +
        '<button class="boton boton-suave" data-acc="ant" type="button"' + (i === 0 ? ' disabled' : '') + '>Anterior</button>' +
        '<button class="boton boton-marca' + (marcada ? ' activa' : '') + '" data-acc="marcar" type="button" aria-pressed="' + marcada + '">' + (marcada ? 'Marcada para revisar' : 'Marcar para revisar') + '</button>' +
        '<button class="enlace" data-acc="borrar" type="button"' + (ses.resp[i] ? '' : ' hidden') + '>Borrar respuesta</button>' +
        (i < total - 1 ? '<button class="boton" data-acc="sig" type="button">Siguiente</button>' : '<button class="boton" data-acc="fin" type="button">Terminar simulacro</button>') +
      '</div><p class="atajos">Atajos: letras a–e para responder, flechas ← → para cambiar de pregunta, M para marcar.</p>';
    c.querySelectorAll('input[name=alt]').forEach(inp => inp.addEventListener('change', () => responder(inp.value)));
    const on = (a, f) => { const b = c.querySelector('[data-acc="' + a + '"]'); if (b) b.addEventListener('click', f); };
    on('ant', () => irA(i - 1)); on('sig', () => irA(i + 1)); on('fin', pedirTerminar); on('marcar', marcar);
    on('borrar', () => { delete ses.resp[i]; guardar(); pintarPregunta(); actualizarMapa(); });
    actualizarMapa();
  }

  function responder(id) {
    ses.resp[ses.actual] = id; guardar();
    document.querySelectorAll('#pregunta .alt').forEach(l => l.classList.toggle('elegida', l.querySelector('input').value === id));
    const b = document.querySelector('#pregunta [data-acc="borrar"]'); if (b) b.hidden = false;
    actualizarMapa();
  }
  function marcar() { const i = ses.actual; if (ses.marcadas[i]) delete ses.marcadas[i]; else ses.marcadas[i] = true; guardar(); pintarPregunta(); }

  function actualizarMapa() {
    $c.querySelectorAll('[data-ir]').forEach(b => {
      const i = +b.dataset.ir, r = !!ses.resp[i], m = !!ses.marcadas[i], a = i === ses.actual;
      b.classList.toggle('respondida', r); b.classList.toggle('marcada', m); b.classList.toggle('actual', a);
      if (a) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', 'Pregunta ' + (i + 1) + (r ? ', respondida' : ', sin responder') + (m ? ', marcada' : ''));
    });
    const av = document.getElementById('avance'); if (av) av.textContent = respondidas();
  }

  function pedirTerminar() {
    const total = ses.preguntas.length, f = total - respondidas(), m = Object.keys(ses.marcadas).length;
    let t = 'Respondiste ' + respondidas() + ' de ' + total + '.';
    if (f) t += ' Las ' + f + ' sin responder cuentan como incorrectas.';
    if (m) t += ' Tienes ' + m + ' marcada' + (m > 1 ? 's' : '') + ' para revisar.';
    MIRU.ui.confirmar('¿Terminar el simulacro?', t, 'Terminar y ver mi nota', () => finalizar(false), 'Seguir respondiendo');
  }

  function finalizar(porTiempo) {
    if (!ses) return;
    const s = ses; ses = null;
    detener();
    MIRU.ui.cerrarDialogo();
    const items = s.preguntas.map((p, i) => {
      const q = MIRU.pregunta(p.id);
      const r = s.resp[i] || null;
      return { id: p.id, mod: p.mod, claseId: q.claseId, temaId: q.temaId, resp: r, ok: r === q.correcta, orden: p.orden, marcada: !!s.marcadas[i] };
    });
    // Cada respuesta cuenta también para «Necesitas repasar» y para los pasitos.
    items.forEach(it => { if (it.resp) MIRU.progreso.registrarRespuesta(MIRU.pregunta(it.id), it.ok, it.resp, { modo: 'evaluar' }); });
    const ac = items.filter(x => x.ok).length;
    const porModulo = {};
    items.forEach(x => { const e = porModulo[x.mod] || (porModulo[x.mod] = { aciertos: 0, total: 0 }); e.total++; if (x.ok) e.aciertos++; });
    const nota = Math.round(ac / items.length * REGLAS.NOTA_MAXIMA * 10) / 10;
    const intento = {
      id: s.id, tipo: s.clave, fecha: Date.now(), nota, aciertos: ac, total: items.length,
      duracionSeg: Math.round((Math.min(Date.now(), s.limite) - s.inicio) / 1000), porTiempo: !!porTiempo, porModulo, items
    };
    MIRU.progreso.guardarSimulacro(intento);
    location.hash = '#/resultado/' + intento.id + '/nuevo';
  }

  // Teclado durante el examen
  document.addEventListener('keydown', function (e) {
    if (!ses || !document.getElementById('pregunta')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type === 'text')) return;
    const k = e.key.toLowerCase();
    const inputs = document.querySelectorAll('#pregunta input[name=alt]');
    const pos = 'abcde'.indexOf(k) >= 0 ? 'abcde'.indexOf(k) : ('12345'.indexOf(k) >= 0 ? '12345'.indexOf(k) : -1);
    if (pos >= 0 && k.length === 1 && inputs[pos]) {
      e.preventDefault(); inputs[pos].checked = true; responder(inputs[pos].value);
      const n = document.querySelectorAll('#pregunta input[name=alt]')[pos]; if (n) n.focus();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); irA(ses.actual + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); irA(ses.actual - 1); }
    else if (k === 'm') { e.preventDefault(); marcar(); }
  });

  /* =================================================================
     RESULTADOS Y REVISIÓN
     ================================================================= */
  let filtro = { estado: 'todas', mod: 'todos' };

  E.resultado = function (cont, id, recien) {
    detener();
    const it = MIRU.progreso.simulacros().find(x => x.id === id);
    if (!it) { cont.innerHTML = '<div class="vacio"><p>No encontré ese simulacro.</p><p><a href="#/simulacros">Volver</a></p></div>'; return; }
    filtro = { estado: recien ? 'incorrectas' : 'todas', mod: 'todos' };
    const ok = it.nota >= REGLAS.NOTA_APROBATORIA;
    const sinResp = it.items.filter(x => !x.resp).length;
    const mods = Object.keys(it.porModulo);

    const columnas = mods.map(m => {
      const e = it.porModulo[m];
      const clases = {};
      it.items.forEach(x => { if (x.mod !== m) return; const c = clases[x.claseId] || (clases[x.claseId] = { a: 0, n: 0 }); c.n++; if (x.ok) c.a++; });
      const pts = REGLAS.NOTA_MAXIMA / it.total;
      return '<article class="columna" data-color="' + colorMod(m) + '"><header class="columna-cabeza"><h3>' + U.esc(nombreMod(m)) + '</h3>' +
        '<p class="columna-puntos"><strong>' + U.num(e.aciertos * pts) + '</strong> de ' + U.num(e.total * pts) + ' puntos</p></header>' +
        '<ul class="temas">' + MIRU.clasesDe(m).filter(c => clases[c.id]).map(c => {
          const x = clases[c.id];
          return '<li class="tema-fila"><span class="tema-nombre">' + U.esc(c.nombre) + '</span><span class="tema-medida"><span class="puntos">' +
            Array.from({ length: x.n }, (_, k) => '<span class="punto ' + (k < x.a ? 'p-ok' : 'p-mal') + '"></span>').join('') +
            '</span><small>' + x.a + ' de ' + x.n + '</small></span></li>';
        }).join('') + '</ul><footer class="columna-pie">' + e.aciertos + ' de ' + e.total + ' correctas</footer></article>';
    }).join('');

    let proximo = '';
    if (E.refuerzoActivo(it.tipo)) {
      const l = [];
      modulosDe(it.tipo).forEach(m => { const ex = E.extrasPorClase(it.tipo, m); Object.keys(ex).forEach(c => { if (ex[c]) l.push(U.esc((MIRU.clase(c) || {}).nombre || c) + ' (+' + ex[c] + ')'); }); });
      proximo = l.length ? '<p class="ayuda">En el próximo simulacro reforzaré: ' + l.join('; ') + '.</p>'
        : '<p class="ayuda">Ninguna clase llega al ' + Math.round(REGLAS.UMBRAL_1_EXTRA * 100) + ' % de error: el próximo saldrá con el reparto normal.</p>';
    }
    const [tipo, modId] = it.tipo.split(':');

    cont.innerHTML =
      '<header class="resultado">' +
        '<div class="nota-adhesiva nota-grande ' + (ok ? 'nota-verde' : 'nota-rosa') + '">' +
          '<p class="nota-numero">' + U.num(it.nota) + '<span> / ' + REGLAS.NOTA_MAXIMA + '</span></p>' +
          '<p class="nota-estado">' + (ok ? 'Aprobado' : 'Desaprobado') + '</p></div>' +
        '<div class="resultado-texto"><h1>' + (ok ? '¡Lo lograste!' : 'Todavía no, pero ya sabes qué repasar') + '</h1>' +
          '<p>' + it.aciertos + ' correctas de ' + it.total + '. ' + (sinResp ? sinResp + ' sin responder. ' : '') +
          'Tiempo usado: ' + U.reloj(it.duracionSeg * 1000) + (it.porTiempo ? ' (se entregó al acabarse el tiempo)' : '') + '.</p>' +
          '<p class="h-fecha">' + U.esc(tituloClave(it.tipo)) + ' · ' + U.esc(U.fechaCorta(it.fecha)) + '</p>' + proximo +
          '<div class="resultado-botones">' +
            '<button class="boton" data-acc="nuevo" type="button">Nuevo simulacro</button>' +
            '<button class="boton boton-suave" data-acc="volver" type="button">Volver</button>' +
            '<button class="boton boton-suave" data-acc="imprimir" type="button">Imprimir revisión</button>' +
          '</div></div></header>' +
      '<section><h2 class="cinta">Por ' + (tipo === 'generalidades' ? 'semana' : mods.length > 1 ? 'especialidad' : 'clase') + '</h2>' +
        '<div class="planificador planificador--' + Math.min(mods.length, 4) + '">' + columnas + '</div></section>' +
      '<section class="revision"><h2 class="cinta">Revisión pregunta por pregunta</h2>' +
        '<div class="filtros" role="group" aria-label="Filtrar preguntas"><div class="chips">' +
          '<button class="chip" data-festado="todas" type="button">Todas</button>' +
          '<button class="chip" data-festado="incorrectas" type="button">Incorrectas y sin responder</button>' +
          '<button class="chip" data-festado="correctas" type="button">Correctas</button>' +
          '<button class="chip" data-festado="marcadas" type="button">Marcadas</button></div>' +
          (mods.length > 1 ? '<div class="chips"><button class="chip" data-fmod="todos" type="button">' + (tipo === 'generalidades' ? 'Todas las semanas' : 'Todas las especialidades') + '</button>' +
            mods.map(m => '<button class="chip" data-fmod="' + m + '" data-color="' + colorMod(m) + '" type="button">' + U.esc(nombreMod(m)) + '</button>').join('') + '</div>' : '') +
        '</div><p class="ayuda conteo"><span id="conteo"></span> <button class="enlace" data-acc="abrir" type="button">Abrir todas</button></p>' +
        '<div id="lista-revision"></div></section>';

    U.on(cont, 'click', '[data-acc]', function (e, b) {
      const a = b.dataset.acc;
      if (a === 'nuevo') location.hash = '#/simulacro/' + tipo + (modId ? '/' + modId : '');
      else if (a === 'volver') location.hash = '#/simulacro/' + tipo + (modId ? '/' + modId : '');
      else if (a === 'imprimir') window.print();
      else if (a === 'abrir') {
        const ds = cont.querySelectorAll('details.revisar');
        const abrir = Array.prototype.some.call(ds, d => !d.open);
        ds.forEach(d => { d.open = abrir; }); b.textContent = abrir ? 'Cerrar todas' : 'Abrir todas';
      }
    });
    U.on(cont, 'click', '[data-festado]', function (e, b) { filtro.estado = b.dataset.festado; pintarRevision(cont, it); });
    U.on(cont, 'click', '[data-fmod]', function (e, b) { filtro.mod = b.dataset.fmod; pintarRevision(cont, it); });
    pintarRevision(cont, it);
  };

  function pintarRevision(cont, it) {
    cont.querySelectorAll('[data-festado]').forEach(b => b.setAttribute('aria-pressed', b.dataset.festado === filtro.estado));
    cont.querySelectorAll('[data-fmod]').forEach(b => b.setAttribute('aria-pressed', b.dataset.fmod === filtro.mod));
    const vis = [];
    it.items.forEach((x, i) => {
      if (!MIRU.pregunta(x.id)) return;
      if (filtro.mod !== 'todos' && x.mod !== filtro.mod) return;
      if (filtro.estado === 'incorrectas' && x.ok) return;
      if (filtro.estado === 'correctas' && !x.ok) return;
      if (filtro.estado === 'marcadas' && !x.marcada) return;
      vis.push(tarjeta(x, i));
    });
    const falt = it.items.filter(x => !MIRU.pregunta(x.id)).length;
    cont.querySelector('#conteo').textContent = vis.length + (vis.length === 1 ? ' pregunta' : ' preguntas') + ' en esta vista.' +
      (falt ? ' ' + falt + ' ya no están en el banco y no se pueden mostrar.' : '');
    cont.querySelector('#lista-revision').innerHTML = vis.length ? vis.join('')
      : '<p class="vacio">No hay preguntas con este filtro. ' + (filtro.estado === 'incorrectas' ? '¡Las respondiste todas bien!' : 'Prueba con «Todas».') + '</p>';
  }

  function resaltar(texto, dato, marcado) {
    if (!dato) return U.txt(texto, marcado);
    const i = texto.indexOf(dato);
    if (i < 0) return U.txt(texto, marcado);
    return U.txt(texto.slice(0, i), marcado) + '<mark class="dato">' + U.txt(dato, marcado) + '</mark>' + U.txt(texto.slice(i + dato.length), marcado);
  }

  function tarjeta(x, i) {
    const q = MIRU.pregunta(x.id);
    const orden = (x.orden && x.orden.length === q.alternativas.length) ? x.orden : q.alternativas.map(a => a.id);
    const L = {}; orden.forEach((id, k) => { L[id] = U.letra(k); });
    const estado = x.ok ? 'correcta' : (x.resp ? 'incorrecta' : 'sin-responder');
    const est = x.ok ? 'Correcta' : (x.resp ? 'Incorrecta' : 'Sin responder');
    const lista = orden.map(id => {
      const a = q.alternativas.find(z => z.id === id); if (!a) return '';
      let cls = '', nota = '';
      if (id === q.correcta) { cls = 'es-correcta'; nota = x.resp === id ? 'Respuesta correcta, la tuya' : 'Respuesta correcta'; }
      else if (x.resp === id) { cls = 'es-tuya'; nota = 'Tu respuesta'; }
      return '<li class="' + cls + '"><span class="alt-letra">' + L[id] + ')</span> <span>' + U.txt(a.texto, q.marcado) + '</span>' + (nota ? ' <span class="marca-alt">' + nota + '</span>' : '') + '</li>';
    }).join('');
    const tema = MIRU.temaPorId(q.temaId);
    return '<details class="revisar ' + estado + '" data-color="' + colorMod(x.mod) + '">' +
      '<summary><span class="r-num">' + (i + 1) + '</span><span class="r-resumen"><span class="r-esp">' + U.esc(nombreMod(x.mod)) + '</span>' +
      '<span class="r-enunciado">' + U.esc(q.enunciado.replace(/\*\*/g, '')) + '</span></span><span class="r-estado">' + est + '</span></summary>' +
      '<div class="r-cuerpo"><p class="r-tema">' + U.esc(tema ? tema.tema.nombre : '') + (q.subtema ? ' › ' + U.esc(q.subtema) : '') + '</p>' +
      '<p class="r-enunciado-completo">' + resaltar(q.enunciado, q.datoClave, q.marcado) + '</p>' +
      (x.marcada ? '<p class="etiquetas"><span class="eti eti--neu">La marcaste para revisar</span></p>' : '') +
      '<ul class="r-alternativas">' + lista + '</ul>' +
      MIRU.preguntas.explicacion(q, x.resp, { sinDato: false }).replace('<details class="fb__fuentes">', '<details class="fb__fuentes" open>') +
      '</div></details>';
  }

  // Al imprimir se abren todas las tarjetas de la revisión.
  let abiertas = [];
  global.addEventListener('beforeprint', () => { abiertas = []; document.querySelectorAll('details.revisar,details.fb__fuentes').forEach(d => { if (!d.open) { abiertas.push(d); d.open = true; } }); });
  global.addEventListener('afterprint', () => { abiertas.forEach(d => { d.open = false; }); abiertas = []; });

})(window);
