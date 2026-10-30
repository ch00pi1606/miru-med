/* =========================================================================
   miru · UI — diálogos, avisos y tema claro/oscuro
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;

  const UI = MIRU.ui = {

    /** Diálogo de confirmación (usa <dialog id="dialogo">). */
    confirmar(titulo, texto, aceptar, alAceptar, cancelar) {
      const d = document.getElementById('dialogo');
      document.getElementById('dialogo-titulo').textContent = titulo;
      document.getElementById('dialogo-texto').textContent = texto;
      document.getElementById('dialogo-aceptar').textContent = aceptar || 'Aceptar';
      document.getElementById('dialogo-cancelar').textContent = cancelar || 'Cancelar';
      document.getElementById('dialogo-campo').hidden = true;
      if (typeof d.showModal !== 'function') { if (global.confirm(titulo + '\n\n' + texto)) alAceptar(); return; }
      d.returnValue = '';
      d.onclose = function () { if (d.returnValue === 'aceptar') alAceptar(); };
      d.showModal();
    },

    /** Pide un texto (nombre de perfil, PIN…). Resuelve con el texto o null. */
    pedirTexto(titulo, texto, valor, tipo) {
      return new Promise(resolve => {
        const d = document.getElementById('dialogo');
        document.getElementById('dialogo-titulo').textContent = titulo;
        document.getElementById('dialogo-texto').textContent = texto || '';
        document.getElementById('dialogo-aceptar').textContent = 'Aceptar';
        document.getElementById('dialogo-cancelar').textContent = 'Cancelar';
        const campo = document.getElementById('dialogo-campo');
        const inp = campo.querySelector('input');
        campo.hidden = false; inp.type = tipo || 'text'; inp.value = valor || '';
        if (typeof d.showModal !== 'function') { resolve(global.prompt(titulo, valor || '')); return; }
        d.returnValue = '';
        d.onclose = function () { campo.hidden = true; resolve(d.returnValue === 'aceptar' ? inp.value : null); };
        d.showModal();
        setTimeout(() => inp.focus(), 30);
      });
    },

    cerrarDialogo() {
      const d = document.getElementById('dialogo');
      if (d && d.open) { d.onclose = null; d.close(); }
    },

    /** Aviso flotante breve. */
    aviso(html, tipo, ms) {
      let cont = document.getElementById('avisos');
      if (!cont) { cont = document.createElement('div'); cont.id = 'avisos'; cont.setAttribute('role', 'status'); document.body.appendChild(cont); }
      const a = document.createElement('div');
      a.className = 'aviso-flot aviso-flot--' + (tipo || 'info');
      a.innerHTML = '<div>' + html + '</div><button type="button" class="aviso-flot__x" aria-label="Cerrar">×</button>';
      cont.appendChild(a);
      const quitar = () => { a.classList.add('saliendo'); setTimeout(() => a.remove(), 260); };
      a.querySelector('button').addEventListener('click', quitar);
      if (ms !== 0) setTimeout(quitar, ms || 5000);
      return a;
    },

    /* ---------------- tema claro / oscuro ---------------- */
    tema: {
      preferencia: () => (MIRU.progreso.todo().perfil.tema || 'auto'),
      aplicar(pref) {
        const p = pref || UI.tema.preferencia();
        const oscuro = p === 'oscuro' || (p === 'auto' && global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');
        const b = document.querySelector('[data-acc="tema"]');
        if (b) { b.textContent = oscuro ? '☀️' : '🌙'; b.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'); }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', oscuro ? '#1d1822' : '#fdf8f4');
      },
      alternar() {
        const actual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'oscuro' : 'claro';
        const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
        MIRU.progreso.ponerPerfil('tema', nuevo);
        UI.tema.aplicar(nuevo);
      },
      escuchar() {
        if (!global.matchMedia) return;
        const mq = global.matchMedia('(prefers-color-scheme: dark)');
        const f = () => { if (UI.tema.preferencia() === 'auto') UI.tema.aplicar('auto'); };
        if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
      }
    },

    vacio(icono, titulo, texto) {
      return '<div class="vacio"><div class="vacio__ic" aria-hidden="true">' + icono + '</div>' +
        (titulo ? '<h3>' + U.esc(titulo) + '</h3>' : '') + (texto ? '<p>' + texto + '</p>' : '') + '</div>';
    }
  };

})(window);
