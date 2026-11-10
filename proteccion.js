/* =========================================================================
   miru · PROTECCIÓN DEL CONTENIDO (alumnos)
   · Marca de agua con el número miru y el nombre del alumno sobre todo.
   · Sin copiar, cortar, seleccionar texto, arrastrar ni menú contextual
     (salvo en los campos donde se escribe).
   · Sin imprimir ni guardar la página: al imprimir sale un aviso en blanco.
   Dicho claro: una página web no puede impedir una foto o una captura de
   pantalla. Esto lo hace más difícil y, sobre todo, deja marcado de quién
   salió cualquier captura. La administradora no tiene estas trabas.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const CFG = global.MIRU_CONFIG || {};

  const enCampo = t => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]'));
  let marca = null, vigia = null, activa = false;

  function textoMarca() {
    const AL = MIRU.almacen;
    const c = AL && AL.cuenta && AL.cuenta();
    if (c) return c.codigo + ' · ' + c.nombre;
    const per = MIRU.progreso && MIRU.progreso.perfilActivo && MIRU.progreso.perfilActivo();
    return 'miru' + (per && per.nombre ? ' · ' + per.nombre : '');
  }

  /** Mosaico SVG en diagonal con el texto, como fondo repetido. */
  function fondo(texto) {
    const t = String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fecha = new Date().toISOString().slice(0, 10);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">' +
      '<g transform="rotate(-24 170 100)" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="15" font-weight="600" fill="#808080">' +
      '<text x="170" y="92" text-anchor="middle">' + t + '</text>' +
      '<text x="170" y="114" text-anchor="middle" font-size="11" font-weight="500">' + fecha + ' · uso personal</text></g></svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  function ponerMarca() {
    if (!marca) {
      marca = document.createElement('div');
      marca.className = 'marca-agua';
      marca.setAttribute('aria-hidden', 'true');
    }
    marca.style.backgroundImage = fondo(textoMarca());
    if (!document.body.contains(marca)) document.body.appendChild(marca);
  }

  /* Si alguien quita la marca o le cambia el estilo, vuelve a ponerse */
  function vigilar() {
    if (vigia || !global.MutationObserver) return;
    vigia = new MutationObserver(() => {
      if (!activa) return;
      if (!document.body.contains(marca) || marca.className !== 'marca-agua' || marca.hidden || marca.getAttribute('style') !== marca._estilo) {
        marca.className = 'marca-agua'; marca.hidden = false; marca.removeAttribute('style');
        ponerMarca(); marca._estilo = marca.getAttribute('style');
      }
      if (!document.body.classList.contains('protegido')) document.body.classList.add('protegido');
    });
    vigia.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
    vigia.observe(marca, { attributes: true });
  }

  function bloquear(e) { if (activa && !enCampo(e.target)) e.preventDefault(); }

  function teclas(e) {
    if (!activa) return;
    const k = String(e.key || '').toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    // Imprimir, guardar, ver código fuente y herramientas de desarrollo
    if ((mod && (k === 'p' || k === 's' || k === 'u')) || k === 'f12' ||
        (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
        (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'u'))) {
      e.preventDefault(); e.stopPropagation(); return;
    }
    // Copiar / seleccionar todo fuera de los campos
    if (mod && (k === 'c' || k === 'x' || k === 'a') && !enCampo(e.target)) e.preventDefault();
  }

  const P = MIRU.proteccion = {
    /** ¿A quién se protege? A todos menos a la administradora. */
    corresponde() { return !(MIRU.admin && MIRU.admin.activo()); },
    activa: () => activa,
    aplicar() {
      if (CFG.proteccion === false || !P.corresponde()) { P.quitar(); return; }
      activa = true;
      document.body.classList.add('protegido');
      ponerMarca(); marca._estilo = marca.getAttribute('style');
      vigilar();
    },
    quitar() {
      activa = false;
      document.body.classList.remove('protegido');
      if (vigia) { vigia.disconnect(); vigia = null; }
      if (marca) marca.remove();
    },
    /** Al cambiar de perfil o de cuenta, el texto de la marca cambia. */
    refrescar() { if (activa) { ponerMarca(); marca._estilo = marca.getAttribute('style'); } }
  };

  ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'].forEach(ev => document.addEventListener(ev, bloquear, true));
  document.addEventListener('keydown', teclas, true);
  global.addEventListener('beforeprint', () => { if (activa) document.body.classList.add('protegido'); });

})(window);
