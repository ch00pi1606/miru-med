/* =========================================================================
   CASOS CLÍNICOS PROGRESIVOS
   El estudiante razona por viñetas: datos → diagnóstico → mecanismo →
   estudio → conducta. Cada viñeta se abre solo tras responder la anterior.
   ========================================================================= */
(function (global) {
  'use strict';
  const CIRUGIA = global.MIRU;
  const U = CIRUGIA.util;

  CIRUGIA.casos = {

    render(caso) {
      return '<div class="caso" data-caso="' + U.esc(caso.id) + '">' +
        '<div class="caso__cab">' +
        '<h3 class="caso__t">🩺 ' + U.esc(caso.titulo) + '</h3>' +
        (caso.origen ? '<div class="nota" style="margin-top:5px">' + U.md(caso.origen) + '</div>' : '') +
        '</div>' +
        '<div class="caso__vi">' +
        '<div class="caso__et">Presentación</div>' +
        (caso.datos ? datos(caso.datos) : '') +
        U.parrafos(caso.presentacion) +
        (caso.anonimizado ? '<div class="caso__anon">Caso adaptado del material del curso. Se han eliminado todos los datos identificables (nombres, números de registro y fechas).</div>' : '') +
        '</div>' +
        '<div class="caso__pasos"></div>' +
        '</div>';
    },

    activar(raiz, ctx) {
      raiz.querySelectorAll('.caso').forEach(el => {
        if (el.dataset.listo) return;
        el.dataset.listo = '1';
        const caso = ctx.buscarCaso(el.dataset.caso);
        if (!caso) return;
        const cont = el.querySelector('.caso__pasos');
        let i = 0;

        function siguiente() {
          const v = caso.vinetas[i];
          if (!v) { cerrar(); return; }
          const pq = v.pregunta ? (CIRUGIA.pregunta(v.pregunta.id) || CIRUGIA.formato.desdeModulo(v.pregunta,
            { temaId: ctx.temaId, claseId: ctx.claseId, moduloId: ctx.moduloId, usos: ['caso'] })) : null;
          const div = document.createElement('div');
          div.className = 'caso__vi';
          div.innerHTML =
            '<div class="caso__et">' + U.esc(v.etiqueta || 'Paso ' + (i + 1)) + '</div>' +
            (v.contexto ? U.parrafos(v.contexto) : '') +
            (v.datos ? datos(v.datos) : '') +
            (pq ? CIRUGIA.preguntas.render(pq, {}) : '');
          cont.appendChild(div);
          div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

          if (pq) {
            CIRUGIA.preguntas.activar(div, {
              buscar: id => (id === pq.id ? pq : null),
              temaId: ctx.temaId, claseId: ctx.claseId, moduloId: ctx.moduloId
            }, () => { i++; setTimeout(siguiente, 420); });
          } else {
            i++; setTimeout(siguiente, 60);
          }
        }

        function cerrar() {
          const div = document.createElement('div');
          div.className = 'caso__vi';
          div.innerHTML =
            '<div class="caso__et">Cierre del caso</div>' +
            (caso.cierre ? U.parrafos(caso.cierre) : '') +
            (caso.aprendizajes && caso.aprendizajes.length
              ? '<div class="capa capa--did"><div class="capa__t">🧠 Qué te llevas de este caso</div><ul>' +
                caso.aprendizajes.map(a => '<li>' + U.md(a) + '</li>').join('') + '</ul></div>'
              : '');
          cont.appendChild(div);
          div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          CIRUGIA.progreso.completarCaso(caso.id, ctx);
        }

        const btn = document.createElement('div');
        btn.className = 'caso__vi';
        btn.innerHTML = '<button class="btn btn--pri" data-acc="empezar" type="button">Empezar a razonar el caso →</button>';
        cont.appendChild(btn);
        btn.querySelector('button').addEventListener('click', () => { btn.remove(); siguiente(); });
      });
    }
  };

  function datos(d) {
    return '<div class="caso__datos"><dl>' +
      Object.entries(d).map(([k, v]) => '<dt>' + U.esc(k) + '</dt><dd>' + U.md(v) + '</dd>').join('') +
      '</dl></div>';
  }

})(window);
