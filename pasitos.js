/* =========================================================================
   miru · PASITOS — exámenes cortos dentro de cada tema (modo aprender)
   5 preguntas al azar del banco del tema, con corrección inmediata.
   Se supera con 4 de 5. El mismo runner sirve para reintentar errores.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const N = 5;
  const APRUEBA = 0.8;

  const Pa = MIRU.pasitos = {
    N,

    /** Banco del pasito: preguntas del tema que no dependen de un caso. */
    banco(temaId) {
      return MIRU.preguntasDeTema(temaId).filter(p => !(p.usos || []).includes('caso'));
    },

    /** 5 preguntas al azar. Si el banco es grande, evita repetir las del
        pasito anterior de este tema. */
    elegir(temaId, n) {
      n = n || N;
      const pool = Pa.banco(temaId);
      if (pool.length <= n) return U.mezclar(pool);
      const prev = MIRU.progreso.pasitos(temaId).slice(-1)[0];
      const evitar = new Set(prev && pool.length >= 2 * n ? prev.items.map(x => x.id) : []);
      const libres = pool.filter(p => !evitar.has(p.id));
      return U.mezclar(libres).slice(0, n);
    },

    montar(cont, cfg) {
      const preguntas = cfg.preguntas || [];
      if (!preguntas.length) {
        cont.innerHTML = '<div class="vacio"><div class="vacio__ic">👣</div><p>Este tema todavía no tiene preguntas.</p></div>';
        return;
      }
      const res = [];
      let i = 0;

      function huellas() {
        return '<ol class="huellas" aria-label="Avance del pasito">' + preguntas.map((p, k) => {
          const r = res[k];
          const c = r ? (r.ok ? 'ok' : 'mal') : (k === i ? 'actual' : '');
          return '<li class="huella ' + c + '" aria-label="Pregunta ' + (k + 1) + (r ? (r.ok ? ', correcta' : ', incorrecta') : '') + '"><span>' + (k + 1) + '</span></li>';
        }).join('') + '</ol>';
      }

      function pintar() {
        const p = preguntas[i];
        if (!p) { resumen(); return; }
        cont.innerHTML = huellas() +
          MIRU.preguntas.render(p, { numero: i + 1, total: preguntas.length }) +
          '<div class="tira tira--fin"><button class="btn btn--pri" data-acc="sig" type="button" disabled>' +
          (i === preguntas.length - 1 ? 'Ver resultado' : 'Siguiente') + '</button></div>';
        const btn = cont.querySelector('[data-acc="sig"]');
        MIRU.preguntas.activar(cont, { buscar: id => preguntas.find(x => x.id === id) }, (pp, ok, resp) => {
          res[i] = { id: pp.id, ok, resp };
          btn.disabled = false;
          cont.querySelector('.huellas').outerHTML = huellas();
          btn.focus({ preventScroll: true });
        });
        btn.addEventListener('click', () => { i++; pintar(); cont.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
        const t = cont.querySelector('.pre'); if (t) t.setAttribute('tabindex', '-1');
      }

      function resumen() {
        const ac = res.filter(r => r.ok).length;
        const total = preguntas.length;
        const aprobado = ac >= Math.ceil(APRUEBA * total);
        const reg = {
          id: U.id('pas'), tipo: cfg.tipo || 'pasito', temaId: cfg.temaId || null, fecha: Date.now(),
          aciertos: ac, total, aprobado: cfg.tipo === 'pasito' || !cfg.tipo ? aprobado : false,
          items: res.map(r => ({ id: r.id, ok: r.ok }))
        };
        if (!cfg.noGuardar) MIRU.progreso.guardarPasito(reg);
        const fall = res.map((r, k) => ({ r, p: preguntas[k] })).filter(x => !x.r.ok);

        cont.innerHTML =
          '<div class="pas-res ' + (aprobado ? 'pas-res--ok' : 'pas-res--mal') + '">' +
          '<div class="nota-adhesiva ' + (aprobado ? 'nota-verde' : 'nota-rosa') + ' pas-res__nota">' +
          '<p class="pas-res__num">' + ac + '<span> / ' + total + '</span></p>' +
          '<p>' + (aprobado ? '¡Pasito superado!' : 'Casi: vuelve a intentarlo') + '</p></div>' +
          '<div>' + huellas() +
          '<p>' + (aprobado
            ? 'Bien. Este tema queda marcado con su pasito en tu planificador.'
            : 'Necesitas ' + Math.ceil(APRUEBA * total) + ' de ' + total + '. Repasa lo que fallaste y pide otro pasito: saldrán otras preguntas.') + '</p>' +
          '<div class="tira">' +
          (cfg.temaId ? '<button class="btn btn--pri" data-acc="otro" type="button">👣 Otro pasito</button>' : '') +
          (fall.length ? '<button class="btn" data-acc="errores" type="button">Reintentar mis ' + fall.length + ' errores</button>' : '') +
          (cfg.alSalir ? '<button class="btn" data-acc="salir" type="button">Volver al tema</button>' : '') +
          '</div></div></div>' +
          (fall.length ? '<h2 class="cinta">Lo que fallaste</h2>' + fall.map(x => tarjetaFallo(x.p, x.r.resp)).join('') : '');

        cont.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => {
          const a = b.dataset.acc;
          if (a === 'otro') Pa.montar(cont, Object.assign({}, cfg, { preguntas: Pa.elegir(cfg.temaId) }));
          else if (a === 'errores') Pa.montar(cont, Object.assign({}, cfg, { preguntas: fall.map(x => x.p), tipo: 'reintento' }));
          else if (cfg.alSalir) cfg.alSalir();
          cont.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }));
        if (cfg.alTerminar) cfg.alTerminar(reg);
      }

      pintar();
    }
  };

  /** Tarjeta de una pregunta fallada, con su explicación completa. */
  function tarjetaFallo(p, resp) {
    let detalle = '';
    if (p.tipo === 'opcion') {
      detalle = MIRU.preguntas.explicacion(p, resp);
    } else {
      detalle = U.parrafos(p.explicacion, p.marcado);
    }
    return '<details class="fallo" open><summary>' + U.esc(U.recorta(p.enunciado, 140)) + '</summary>' +
      '<div class="fallo__c">' + U.parrafos(p.enunciado, p.marcado) + detalle + '</div></details>';
  }
  MIRU.pasitos.tarjetaFallo = tarjetaFallo;

})(window);
