/* =========================================================================
   ESQUEMAS FISIOPATOLÓGICOS INTERACTIVOS
   Un esquema es una cadena causa → efecto. Cada nodo se puede pulsar para
   ver el mecanismo. El modo «paso a paso» revela la cadena progresivamente
   para que el estudiante anticipe lo que viene.
   ========================================================================= */
(function (global) {
  'use strict';
  const CIRUGIA = global.MIRU;
  const U = CIRUGIA.util;

  const CLASES = {
    gatillo: ['nodo--gatillo', 'Desencadenante'],
    alteracion: ['', 'Alteración'],
    celular: ['', 'Cambio celular / tisular'],
    consecuencia: ['', 'Consecuencia'],
    clinica: ['nodo--clinica', 'Manifestación clínica'],
    complicacion: ['nodo--compl', 'Complicación'],
    tratamiento: ['nodo--tto', 'Consecuencia terapéutica'],
    diagnostico: ['nodo--clinica', 'Traducción diagnóstica']
  };

  CIRUGIA.esquemas = {

    render(esq) {
      const eid = 'esq-' + esq.id.replace(/[^a-z0-9\-_]/gi, '');
      let n = -1;
      const filas = esq.pasos.map((paso, i) => {
        const flecha = i > 0 ? '<div class="flecha paso" data-p="' + i + '">↓</div>' : '';
        if (Array.isArray(paso)) {
          return flecha + '<div class="rama paso" data-p="' + i + '">' +
            paso.map(nd => { n++; return nodo(nd, n); }).join('') + '</div>';
        }
        n++;
        return flecha + '<div class="paso" data-p="' + i + '">' + nodo(paso, n) + '</div>';
      }).join('');

      return '<div class="esq" data-esq="' + U.esc(esq.id) + '" id="' + eid + '">' +
        '<div class="esq__cab">' +
        '<span class="esq__t">' + U.esc(esq.titulo) + '</span>' +
        (esq.prioridad ? U.etiquetaPrioridad(esq.prioridad) : '') +
        '<span class="esq__ct">' +
        '<button class="btn btn--sm" data-acc="paso" type="button">▶ Paso a paso</button>' +
        '<button class="btn btn--sm" data-acc="todo" type="button">Mostrar todo</button>' +
        '</span></div>' +
        (esq.intro ? '<div class="esq__pista" style="padding:12px 18px 0">' + U.md(esq.intro) + '</div>' : '') +
        '<div class="esq__lienzo">' + filas + '</div>' +
        '<div class="esq__pista">Pulsa cualquier recuadro para ver el mecanismo que hay detrás.</div>' +
        '<div class="esq__det" hidden></div>' +
        (esq.cierre ? '<div class="capa capa--did" style="margin:0 18px 18px"><div class="capa__t">🧠 La idea en una frase</div>' + U.parrafos(esq.cierre) + '</div>' : '') +
        '</div>';
    },

    activar(raiz, ctx) {
      raiz.querySelectorAll('.esq').forEach(el => {
        if (el.dataset.listo) return;
        el.dataset.listo = '1';
        const esq = ctx.buscarEsquema(el.dataset.esq);
        if (!esq) return;

        const pasos = [...el.querySelectorAll('.paso')];
        const det = el.querySelector('.esq__det');
        let cursor = 0;

        function mostrarHasta(k) {
          pasos.forEach(p => p.classList.toggle('vis', +p.dataset.p <= k));
        }
        function todo() { pasos.forEach(p => p.classList.add('vis')); cursor = 999; }

        todo(); // por defecto visible; el modo paso a paso es opcional

        U.on(el, 'click', '[data-acc="paso"]', function (e, b) {
          if (cursor > 900) { cursor = 0; mostrarHasta(0); b.textContent = '▶ Siguiente paso'; return; }
          cursor++;
          const max = Math.max(...pasos.map(p => +p.dataset.p));
          if (cursor > max) { todo(); b.textContent = '▶ Paso a paso'; return; }
          mostrarHasta(cursor);
          const sig = el.querySelector('.paso[data-p="' + cursor + '"] .nodo');
          if (sig) sig.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });

        U.on(el, 'click', '[data-acc="todo"]', function () {
          todo(); el.querySelector('[data-acc="paso"]').textContent = '▶ Paso a paso';
        });

        U.on(el, 'click', '.nodo', function (e, b) {
          const idx = +b.dataset.n;
          const planos = aplanar(esq);
          const nd = planos[idx];
          if (!nd) return;
          const yaSel = b.classList.contains('sel');
          el.querySelectorAll('.nodo').forEach(x => x.classList.remove('sel'));
          if (yaSel) { det.hidden = true; return; }
          b.classList.add('sel');
          det.hidden = false;
          det.innerHTML = '<h5>' + U.esc(nd.titulo) + '</h5>' +
            (nd.detalle ? U.parrafos(nd.detalle) : '<p class="nota">Sin detalle adicional.</p>') +
            (nd.porque ? '<div class="capa capa--did" style="margin:12px 0 0"><div class="capa__t">🧠 ¿Por qué?</div>' + U.parrafos(nd.porque) + '</div>' : '') +
            (nd.clinica ? '<p style="margin-top:10px"><strong>Traducción clínica:</strong> ' + U.md(nd.clinica) + '</p>' : '');
          det.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          CIRUGIA.progreso.explorarEsquema(esq.id, ctx);
        });
      });
    }
  };

  function nodo(nd, n) {
    const c = CLASES[nd.tipo] || CLASES.alteracion;
    return '<button class="nodo ' + c[0] + '" data-n="' + n + '" type="button">' +
      '<span class="nodo__mas">＋</span>' +
      '<span class="nodo__k">' + U.esc(nd.etiqueta || c[1]) + '</span>' +
      '<span class="nodo__t">' + U.md(nd.titulo) + '</span></button>';
  }

  function aplanar(esq) {
    const out = [];
    esq.pasos.forEach(p => { if (Array.isArray(p)) p.forEach(x => out.push(x)); else out.push(p); });
    return out;
  }

})(window);
