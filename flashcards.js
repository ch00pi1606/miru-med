/* =========================================================================
   FLASHCARDS — la cara frontal es siempre una PREGUNTA, no una definición.
   Repetición: las marcadas «No lo sé» y «Lo dudo» vuelven a la baraja.
   ========================================================================= */
(function (global) {
  'use strict';
  const CIRUGIA = global.MIRU;
  const U = CIRUGIA.util;

  CIRUGIA.flashcards = {

    montar(contenedor, cartas, ctx) {
      if (!cartas || !cartas.length) {
        contenedor.innerHTML = '<div class="vacio"><div class="vacio__ic">🗂️</div><p>Aún no hay flashcards en este tema.</p></div>';
        return;
      }

      let baraja = ordenar(cartas);
      let i = 0, volteada = false, ronda = 1;

      function ordenar(cs) {
        // primero las no vistas y las difíciles
        const peso = c => {
          const p = CIRUGIA.progreso.flashcard(c.id);
          if (!p || !p.estado) return 0;
          if (p.estado === 'nose') return 1;
          if (p.estado === 'dudo') return 2;
          return 3;
        };
        return cs.slice().sort((a, b) => peso(a) - peso(b));
      }

      function dominadas() {
        return cartas.filter(c => { const p = CIRUGIA.progreso.flashcard(c.id); return p && p.estado === 'se'; }).length;
      }

      function pintar() {
        const c = baraja[i];
        if (!c) { fin(); return; }
        const dom = dominadas();
        const pct = Math.round(dom / cartas.length * 100);
        const prev = CIRUGIA.progreso.flashcard(c.id);
        const et = prev && prev.estado
          ? { nose: '<span class="eti eti--bad">No lo sé</span>', dudo: '<span class="eti eti--neu">Lo dudo</span>', se: '<span class="eti eti--ok">Lo sé</span>' }[prev.estado]
          : '';

        contenedor.innerHTML =
          '<div class="fc__prog">' +
          '<span><strong>' + dom + '</strong> / ' + cartas.length + ' dominadas</span>' +
          U.barra(pct) +
          '<span>Tarjeta ' + (i + 1) + ' de ' + baraja.length + (ronda > 1 ? ' · repaso ' + ronda : '') + '</span>' +
          '</div>' +
          '<div class="fc__esc"><div class="fc" data-fc="' + U.esc(c.id) + '">' +
          '<div class="fc__c">' +
          '<div class="fc__et">' + (c.tema ? U.esc(c.tema) + ' · ' : '') + 'Pregunta ' + et + '</div>' +
          '<div class="fc__q">' + U.md(c.frente) + '</div>' +
          '<div class="fc__pie">Pulsa la tarjeta para ver la respuesta</div>' +
          '</div>' +
          '<div class="fc__c fc__c--rev">' +
          '<div class="fc__et">Respuesta</div>' +
          '<div class="fc__a">' + U.parrafos(c.reverso) + '</div>' +
          (c.pista ? '<div class="fc__pie">💡 ' + U.md(c.pista) + '</div>' : '') +
          '</div></div></div>' +
          '<div class="fc__cont">' +
          '<button class="btn btn--sm" data-nav="prev" type="button">← Anterior</button>' +
          '<button class="btn btn--sm" data-marca="nose" type="button">😕 No lo sé</button>' +
          '<button class="btn btn--sm" data-marca="dudo" type="button">🤔 Lo dudo</button>' +
          '<button class="btn btn--sm btn--pri" data-marca="se" type="button">✓ Lo sé</button>' +
          '<button class="btn btn--sm" data-nav="next" type="button">Siguiente →</button>' +
          '</div>' +
          '<div class="nota" style="text-align:center;margin-top:10px">Atajos: <kbd>Espacio</kbd> voltear · <kbd>1</kbd> no lo sé · <kbd>2</kbd> lo dudo · <kbd>3</kbd> lo sé</div>';

        volteada = false;
        const fc = contenedor.querySelector('.fc');
        fc.addEventListener('click', () => { volteada = !volteada; fc.classList.toggle('volteada', volteada); });
      }

      function fin() {
        const dom = dominadas();
        const dificiles = cartas.filter(c => {
          const p = CIRUGIA.progreso.flashcard(c.id);
          return p && (p.estado === 'nose' || p.estado === 'dudo');
        });
        contenedor.innerHTML =
          '<div class="tj" style="text-align:center">' +
          '<div style="font-size:2.2rem">🎴</div>' +
          '<h3>Baraja terminada</h3>' +
          '<p><strong>' + dom + '</strong> de ' + cartas.length + ' tarjetas dominadas.</p>' +
          U.barra(Math.round(dom / cartas.length * 100)) +
          '<div class="tira" style="justify-content:center;margin-top:18px">' +
          (dificiles.length ? '<button class="btn btn--pri" data-acc="dificiles" type="button">Repasar las ' + dificiles.length + ' difíciles</button>' : '') +
          '<button class="btn" data-acc="reiniciar" type="button">Empezar de nuevo</button>' +
          '</div></div>';
        contenedor.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.acc === 'dificiles') { baraja = dificiles; ronda++; }
          else { baraja = ordenar(cartas); ronda = 1; }
          i = 0; pintar();
        }));
      }

      function marcar(v) {
        const c = baraja[i]; if (!c) return;
        CIRUGIA.progreso.marcarFlashcard(c.id, v, c._ctx || ctx);
        avanzar();
      }
      function avanzar() { i++; if (i >= baraja.length) fin(); else pintar(); }

      contenedor.addEventListener('click', e => {
        const m = e.target.closest('[data-marca]');
        if (m) { marcar(m.dataset.marca); return; }
        const n = e.target.closest('[data-nav]');
        if (n) {
          if (n.dataset.nav === 'next') avanzar();
          else if (i > 0) { i--; pintar(); }
        }
      });

      const teclado = e => {
        if (!contenedor.isConnected || !contenedor.offsetParent) return;
        if (/input|textarea/i.test((e.target.tagName || ''))) return;
        if (e.code === 'Space') { e.preventDefault(); const fc = contenedor.querySelector('.fc'); if (fc) { volteada = !volteada; fc.classList.toggle('volteada', volteada); } }
        else if (e.key === '1') marcar('nose');
        else if (e.key === '2') marcar('dudo');
        else if (e.key === '3') marcar('se');
        else if (e.key === 'ArrowRight') avanzar();
        else if (e.key === 'ArrowLeft' && i > 0) { i--; pintar(); }
      };
      document.addEventListener('keydown', teclado);
      contenedor._limpiar = () => document.removeEventListener('keydown', teclado);

      pintar();
    }
  };

})(window);
