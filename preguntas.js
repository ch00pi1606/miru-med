/* =========================================================================
   miru · MOTOR DE PREGUNTAS — modo «aprender»
   Cinco formatos: opcion · vf · completar · ordenar · relacionar.
   Corrige al instante. Una respuesta incorrecta nunca se queda en
   «incorrecto»: muestra qué elegiste, cuál era la correcta, por qué lo es,
   por qué la tuya no y qué pasa con las demás alternativas.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;

  const NIVELES = {
    reconocimiento: 'Reconocimiento', comprension: 'Comprensión',
    aplicacion: 'Aplicación', integracion: 'Integración clínica'
  };
  const CLAVE = {
    docente: ['Clave del docente', 'La respuesta sale de un examen, pretest o clase del docente.'],
    'guía': ['Clave de la guía', 'No hay clave del docente; la respuesta sale de la guía de estudio.'],
    guia: ['Clave de la guía', 'No hay clave del docente; la respuesta sale de la guía de estudio.'],
    libro: ['Clave del libro', 'No hay clave del docente ni de la guía; la respuesta sale del libro.'],
    deducida: ['Clave deducida', 'No hay clave oficial: la respuesta se dedujo de las fuentes citadas.']
  };

  const T = (p, s) => U.txt(s, p.marcado);
  const alt = (p, id) => (p.alternativas || []).find(a => a.id === id);

  const Q = MIRU.preguntas = {

    /** Orden de alternativas para mostrar (barajado si se puede). */
    orden(p) {
      const ids = (p.alternativas || []).map(a => a.id);
      return MIRU.formato.mezclable(p) ? U.mezclar(ids) : ids;
    },

    render(p, opts) {
      opts = opts || {};
      const prev = MIRU.progreso.pregunta(p.id);
      const et = [];
      if (opts.numero) et.push('<span class="pre__n">Pregunta ' + opts.numero + (opts.total ? ' de ' + opts.total : '') + '</span>');
      if (p.tipoClave === 'docente' && p.origen !== 'creada') et.push('<span class="eti eti--docente" title="Pregunta tomada del material o de exámenes del docente">★ Del docente</span>');
      if (p.nivel && NIVELES[p.nivel]) et.push('<span class="eti eti--neu">' + NIVELES[p.nivel] + '</span>');
      if (prev && prev.intentos) et.push('<span class="eti eti--neu" title="Aciertos / intentos">' + prev.aciertos + '/' + prev.intentos + '</span>');

      let cuerpo = '';
      switch (p.tipo) {
        case 'vf': cuerpo = cuerpoVF(p); break;
        case 'completar': cuerpo = cuerpoCompletar(p); break;
        case 'ordenar': cuerpo = cuerpoOrdenar(p); break;
        case 'relacionar': cuerpo = cuerpoRelacionar(p); break;
        default: cuerpo = cuerpoOpcion(p, opts.orden || Q.orden(p));
      }
      return '<div class="pre' + (opts.incrustada ? ' pre--incrust' : '') + '" data-preg="' + U.esc(p.id) + '">' +
        (et.length ? '<div class="pre__cab">' + et.join('') + '</div>' : '') +
        '<div class="pre__t">' + U.parrafos(p.enunciado, p.marcado) + '</div>' +
        '<div class="pre__cuerpo">' + cuerpo + '</div>' +
        '<div class="pre__fb" aria-live="polite"></div></div>';
    },

    /** Conecta los manejadores. ctx.buscar(id) → pregunta. cb(p, ok, resp) */
    activar(raiz, ctx, cb) {
      raiz.querySelectorAll('.pre').forEach(el => {
        if (el.dataset.listo) return;
        el.dataset.listo = '1';
        const p = (ctx && ctx.buscar && ctx.buscar(el.dataset.preg)) || MIRU.pregunta(el.dataset.preg);
        if (!p) return;
        const fin = (ok, resp, html) => {
          el.querySelector('.pre__fb').innerHTML = html;
          MIRU.progreso.registrarRespuesta(p, ok, resp, Object.assign({ modo: 'aprender' }, ctx || {}));
          if (cb) cb(p, ok, resp);
        };
        switch (p.tipo) {
          case 'completar': activarCompletar(el, p, fin); break;
          case 'ordenar': activarOrdenar(el, p, fin); break;
          case 'relacionar': activarRelacionar(el, p, fin); break;
          default: activarOpcion(el, p, fin);
        }
      });
    },

    /** Explicación completa de una pregunta de opción múltiple.
        Se usa en el modo aprender y en la revisión del simulacro. */
    explicacion(p, resp, opts) {
      opts = opts || {};
      const ok = resp === p.correcta;
      const correcta = alt(p, p.correcta);
      const tuya = resp ? alt(p, resp) : null;
      const pn = p.porQueNo || {};
      let h = '';
      if (p.datoClave && !opts.sinDato) h += '<p class="dato-clave"><strong>Dato clave:</strong> «' + U.esc(p.datoClave) + '»</p>';
      h += '<h4 class="fb__h">Por qué es correcta «' + T(p, correcta ? correcta.texto : '') + '»</h4>' +
        U.parrafos(p.explicacion || 'Revisa la explicación del tema.', p.marcado);
      if (tuya && !ok) {
        h += '<h4 class="fb__h">Por qué no es tu respuesta, «' + T(p, tuya.texto) + '»</h4>' +
          U.parrafos(pn[tuya.id] || 'No corresponde a lo que pide el enunciado.', p.marcado);
      }
      const otras = (p.alternativas || []).filter(a => a.id !== p.correcta && a.id !== resp && pn[a.id]);
      if (otras.length) {
        h += '<h4 class="fb__h">Las otras alternativas</h4><ul class="fb__otras">' +
          otras.map(a => '<li><strong>«' + T(p, a.texto) + '»</strong>: ' + T(p, pn[a.id]) + '</li>').join('') + '</ul>';
      }
      h += Q.fuentes(p);
      if (opts.irTema !== false && p.temaId && MIRU.temaPorId(p.temaId)) {
        h += '<p class="fb__ir"><a href="' + MIRU.rutaTema(p.temaId) + '">Repasar el tema «' + U.esc(MIRU.temaPorId(p.temaId).tema.nombre) + '» →</a></p>';
      }
      return h;
    },

    /** Bloque de fuentes con la jerarquía docente > guía > libro. */
    fuentes(p) {
      const f = p.fuentes || {};
      let h = '';
      if (f.docente) h += '<div class="fte"><h5>Tu docente dice</h5><p>' + T(p, f.docente) + '</p></div>';
      if (f.discrepancia && f.guia) {
        const k = f.guia.indexOf('Para el examen');
        const antes = k > 0 ? f.guia.slice(0, k).trim() : f.guia;
        const examen = k > 0 ? f.guia.slice(k).trim() : '';
        h += '<div class="fte fte--disc"><h5>Ojo: las fuentes no coinciden</h5><p>' + T(p, antes) + '</p>' +
          (examen ? '<p class="para-examen">' + T(p, examen) + '</p>' : '') + '</div>';
      } else if (f.guia) {
        h += '<div class="fte"><h5>La guía añade</h5><p>' + T(p, f.guia) + '</p></div>';
      }
      if (f.libro) h += '<div class="fte"><h5>Libro o fuente oficial</h5><p>' + T(p, f.libro) + '</p></div>';
      const refs = (p.referencias || []).map(r => '<li>' + T(p, r) + '</li>').join('');
      const et = [];
      et.push('<span class="eti eti--neu" title="' + U.esc(p.procedencia || '') + '">' +
        (p.origen === 'banco' ? 'Pregunta de examen' : p.origen === 'modulo' ? 'Pregunta del módulo' : 'Creada para practicar') + '</span>');
      if (p.tipoClave && CLAVE[p.tipoClave]) et.push('<span class="eti eti--clave-' + U.esc(p.tipoClave === 'guía' ? 'guia' : p.tipoClave) + '" title="' + U.esc(CLAVE[p.tipoClave][1]) + '">' + CLAVE[p.tipoClave][0] + '</span>');
      if (f.discrepancia) et.push('<span class="eti eti--bad">Discrepancia entre fuentes</span>');
      if (!h && !refs) return '<p class="etiquetas">' + et.join('') + '</p>';
      return '<details class="fb__fuentes"><summary>Fuentes y procedencia</summary>' + h +
        (refs ? '<h5 class="refs-t">Referencias</h5><ol class="referencias">' + refs + '</ol>' : '') +
        '<p class="etiquetas">' + et.join('') + '</p>' +
        (p.procedencia ? '<p class="procedencia">Procedencia: ' + U.esc(p.procedencia) + '</p>' : '') +
        '</details>';
    },

    veredicto(ok, html) {
      return '<div class="fb fb--' + (ok ? 'ok' : 'bad') + '">' +
        '<div class="fb__t">' + (ok ? '✓ Correcto' : '✗ Incorrecto') + '</div>' + html + '</div>';
    }
  };

  /* ---------------- opción múltiple ---------------- */
  function cuerpoOpcion(p, orden) {
    return '<div class="ops" role="group" aria-label="Alternativas" data-orden="' + orden.join(',') + '">' + orden.map((id, i) => {
      const a = alt(p, id);
      return '<button class="op" data-alt="' + U.esc(id) + '" type="button">' +
        '<span class="op__l">' + U.letra(i) + ')</span><span class="op__t">' + T(p, a ? a.texto : '') + '</span></button>';
    }).join('') + '</div>';
  }

  function activarOpcion(el, p, fin) {
    if (p.tipo === 'vf') return activarVF(el, p, fin);
    U.on(el, 'click', '.op', function (e, btn) {
      if (el.dataset.resp) return;
      el.dataset.resp = '1';
      const resp = btn.dataset.alt;
      const ok = resp === p.correcta;
      el.querySelectorAll('.op').forEach(b => {
        b.disabled = true;
        if (b.dataset.alt === p.correcta) b.classList.add('correcta');
        else if (b.dataset.alt === resp) b.classList.add('elegida-mal');
        else b.classList.add('apagada');
      });
      fin(ok, resp, Q.veredicto(ok, Q.explicacion(p, resp)));
    });
  }

  /* ---------------- verdadero / falso ---------------- */
  function cuerpoVF() {
    return '<div class="vf">' +
      '<button class="op" data-v="1" type="button"><span class="op__t">✔ Verdadero</span></button>' +
      '<button class="op" data-v="0" type="button"><span class="op__t">✘ Falso</span></button></div>';
  }
  function activarVF(el, p, fin) {
    U.on(el, 'click', '.op', function (e, btn) {
      if (el.dataset.resp) return;
      el.dataset.resp = '1';
      const v = btn.dataset.v === '1';
      const ok = v === !!p.respuesta;
      el.querySelectorAll('.op').forEach(b => {
        b.disabled = true;
        const esCorrecta = (b.dataset.v === '1') === !!p.respuesta;
        b.classList.add(esCorrecta ? 'correcta' : (b === btn ? 'elegida-mal' : 'apagada'));
      });
      fin(ok, v, Q.veredicto(ok, '<p><strong>La afirmación es ' + (p.respuesta ? 'verdadera' : 'falsa') + '.</strong></p>' +
        U.parrafos(p.explicacion, p.marcado) + Q.fuentes(p)));
    });
  }

  /* ---------------- completar ---------------- */
  const norm = s => String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  function cuerpoCompletar(p) {
    let n = -1;
    const txt = U.esc(p.texto).replace(/\{\{[^}]*\}\}/g, () => {
      n++;
      return '<input class="hueco" data-h="' + n + '" type="text" autocomplete="off" spellcheck="false" aria-label="Espacio ' + (n + 1) + '" placeholder="…">';
    });
    return '<div class="completar">' + txt + '</div>' +
      '<div class="tira"><button class="btn btn--pri btn--sm" data-acc="comprobar" type="button">Comprobar</button></div>';
  }
  function activarCompletar(el, p, fin) {
    U.on(el, 'click', '[data-acc="comprobar"]', function (e, b) {
      if (el.dataset.resp) return;
      el.dataset.resp = '1';
      let todas = true; const resp = [];
      el.querySelectorAll('.hueco').forEach((h, i) => {
        const val = norm(h.value); resp.push(h.value);
        const acepta = ((p.huecos[i] || {}).acepta || []).map(norm);
        const ok = acepta.some(a => a && (val === a || (val.length > 3 && a.indexOf(val) === 0)));
        h.classList.add(ok ? 'correcta' : 'mal'); h.disabled = true;
        if (!ok) todas = false;
      });
      b.disabled = true;
      fin(todas, resp, Q.veredicto(todas, '<p><strong>Respuestas:</strong> ' +
        p.huecos.map((h, i) => (i + 1) + '. ' + U.md(h.acepta[0])).join(' · ') + '</p>' + U.parrafos(p.explicacion, p.marcado)));
    });
  }

  /* ---------------- ordenar (arrastrar o con flechas) ---------------- */
  function cuerpoOrdenar(p) {
    let mezcl = U.mezclar(p.pasos.map((t, i) => ({ t, i })));
    if (mezcl.every((x, k) => x.i === k) && mezcl.length > 1) mezcl = mezcl.slice(1).concat(mezcl[0]);
    return '<ol class="orden">' + mezcl.map(x =>
      '<li class="ordit" draggable="true" data-i="' + x.i + '">' +
      '<span class="ordit__h" aria-hidden="true">⠿</span><span class="ordit__t">' + U.md(x.t) + '</span>' +
      '<span class="ordit__b"><button type="button" class="btn btn--icono btn--sm" data-mov="-1" aria-label="Subir">↑</button>' +
      '<button type="button" class="btn btn--icono btn--sm" data-mov="1" aria-label="Bajar">↓</button></span>' +
      '<span class="ordit__n"></span></li>').join('') + '</ol>' +
      '<div class="tira"><button class="btn btn--pri btn--sm" data-acc="comprobar" type="button">Comprobar orden</button>' +
      '<span class="nota">Arrastra o usa las flechas.</span></div>';
  }
  function activarOrdenar(el, p, fin) {
    const cont = el.querySelector('.orden');
    let arr = null;
    cont.addEventListener('dragstart', e => { const it = e.target.closest('.ordit'); if (!it || el.dataset.resp) return; arr = it; it.classList.add('arrastrando'); });
    cont.addEventListener('dragend', () => { if (arr) arr.classList.remove('arrastrando'); arr = null; });
    cont.addEventListener('dragover', e => {
      e.preventDefault(); if (!arr) return;
      const tras = [...cont.querySelectorAll('.ordit:not(.arrastrando)')].reduce((cerca, hijo) => {
        const c = hijo.getBoundingClientRect(), off = e.clientY - c.top - c.height / 2;
        return (off < 0 && off > cerca.off) ? { off, el: hijo } : cerca;
      }, { off: -Infinity, el: null }).el;
      if (tras) cont.insertBefore(arr, tras); else cont.appendChild(arr);
    });
    U.on(el, 'click', '[data-mov]', function (e, b) {
      if (el.dataset.resp) return;
      const it = b.closest('.ordit');
      if (b.dataset.mov === '-1' && it.previousElementSibling) cont.insertBefore(it, it.previousElementSibling);
      if (b.dataset.mov === '1' && it.nextElementSibling) cont.insertBefore(it.nextElementSibling, it);
      b.focus();
    });
    U.on(el, 'click', '[data-acc="comprobar"]', function (e, b) {
      if (el.dataset.resp) return;
      el.dataset.resp = '1';
      const items = [...cont.querySelectorAll('.ordit')];
      let ok = true;
      items.forEach((it, pos) => {
        const bien = +it.dataset.i === pos;
        it.classList.add(bien ? 'correcta' : 'mal');
        it.draggable = false;
        it.querySelector('.ordit__n').textContent = (+it.dataset.i + 1) + '.º';
        it.querySelectorAll('[data-mov]').forEach(x => { x.disabled = true; });
        if (!bien) ok = false;
      });
      b.disabled = true;
      fin(ok, items.map(it => +it.dataset.i), Q.veredicto(ok, '<p><strong>Secuencia correcta:</strong></p><ol>' +
        p.pasos.map(t => '<li>' + U.md(t) + '</li>').join('') + '</ol>' + U.parrafos(p.explicacion, p.marcado)));
    });
  }

  /* ---------------- relacionar ---------------- */
  function cuerpoRelacionar(p) {
    const izq = p.pares.map((x, i) => ({ t: x.a, i }));
    const der = U.mezclar(p.pares.map((x, i) => ({ t: x.b, i })));
    return '<div class="rel">' +
      '<div class="rel__col" data-lado="a">' + izq.map(x => '<button class="relit" type="button" data-i="' + x.i + '">' + U.md(x.t) + '</button>').join('') + '</div>' +
      '<div class="rel__col" data-lado="b">' + der.map(x => '<button class="relit" type="button" data-i="' + x.i + '">' + U.md(x.t) + '</button>').join('') + '</div>' +
      '</div><p class="nota">Toca un elemento de la izquierda y luego su pareja de la derecha.</p>';
  }
  function activarRelacionar(el, p, fin) {
    let selA = null, hechos = 0, fallos = 0;
    U.on(el, 'click', '.relit', function (e, b) {
      if (el.dataset.resp || b.classList.contains('emparejada')) return;
      if (b.parentElement.dataset.lado === 'a') {
        el.querySelectorAll('[data-lado="a"] .relit').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); selA = b; return;
      }
      if (!selA) return;
      if (selA.dataset.i === b.dataset.i) {
        selA.classList.remove('sel'); selA.classList.add('emparejada'); b.classList.add('emparejada');
        selA = null; hechos++;
        if (hechos === p.pares.length) {
          el.dataset.resp = '1';
          const ok = fallos === 0;
          fin(ok, fallos, Q.veredicto(ok, (ok ? '' : '<p>Completaste los pares con ' + fallos + ' intento(s) fallido(s).</p>') +
            '<p><strong>Pares correctos:</strong></p><ul>' +
            p.pares.map(x => '<li>' + U.md(x.a) + ' → ' + U.md(x.b) + (x.porQue ? ' <span class="nota">(' + U.md(x.porQue) + ')</span>' : '') + '</li>').join('') +
            '</ul>' + U.parrafos(p.explicacion, p.marcado)));
        }
      } else {
        fallos++; b.classList.add('err'); setTimeout(() => b.classList.remove('err'), 480);
      }
    });
  }

})(window);
