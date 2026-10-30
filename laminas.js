/* =========================================================================
   miru · LÁMINAS — la clase del docente, explicada con redacción propia
   Una lámina reúne diapositivas seguidas del mismo subtema. No reproduce
   el texto ni las imágenes del docente: resume su enfoque («para el
   examen»), lo explica y, si la evidencia actual dice otra cosa, lo muestra
   aparte sin confrontar al docente.

   Formato:
   { id, titulo, bloque?,
     docente: md        → 📘 Lo que enseña el curso (para el examen)
     clave: [md]        → ✱ Para el examen, en corto
     explicacion: md    → 🧠 Por qué
     complemento: md    → 🔎 Lo que completa el libro / la evidencia
     tabla: {cabecera, filas}
     figura: { svg | img, alt, leyenda, credito }
     evidencia: { curso, actual, porQue, responder }  → ⚖️ dos capas
     sinDiapositiva: true → lámina construida solo con bibliografía }
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;

  const L = MIRU.laminas = {

    render(t, ctx) {
      const lams = t.laminas || [];
      if (!lams.length) return '';
      let bloque = null;
      let n = 0;
      const total = lams.length;
      return '<div class="laminas">' + lams.map(l => {
        n++;
        let cab = '';
        if (l.bloque && l.bloque !== bloque) { bloque = l.bloque; cab = '<h2 class="cinta cinta--bloque">' + U.esc(bloque) + '</h2>'; }
        return cab + L.lamina(l, n, total, t);
      }).join('') + '</div>';
    },

    lamina(l, n, total, t) {
      const visto = MIRU.progreso.seccionVista(t.id, 'lam-' + l.id);
      const partes = [];
      if (l.docente) {
        partes.push('<div class="capa capa--curso"><div class="capa__t">📘 Lo que enseña el curso' +
          (l.sinDiapositiva ? ' <span class="capa__x">(no está en las diapositivas: sale de la bibliografía)</span>' : '') + '</div>' +
          U.parrafos(l.docente) + '</div>');
      }
      if (l.clave && l.clave.length) {
        partes.push('<div class="lam__clave"><div class="lam__clave-t">✱ Para el examen</div><ul>' +
          l.clave.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ul></div>');
      }
      if (l.figura) partes.push(figura(l.figura));
      if (l.tabla) partes.push(MIRU.vistas.tabla(l.tabla));
      if (l.explicacion) {
        partes.push('<div class="capa capa--did"><div class="capa__t">🧠 Explicación</div>' + U.parrafos(l.explicacion) + '</div>');
      }
      if (l.complemento) {
        partes.push('<div class="capa capa--evid"><div class="capa__t">🔎 Lo que completa la bibliografía</div>' + U.parrafos(l.complemento) + '</div>');
      }
      if (l.evidencia) partes.push(MIRU.vistas.bloqueDual(l.evidencia));
      return '<article class="lamina' + (visto ? ' lamina--vista' : '') + '" id="lam-' + U.esc(l.id) + '">' +
        '<header class="lamina__cab"><span class="lamina__n">Lámina ' + n + ' de ' + total + '</span>' +
        (visto ? '<span class="lamina__ok" title="Ya la leíste">✓ leída</span>' : '') + '</header>' +
        '<h3 class="lamina__t">' + U.md(l.titulo) + '</h3>' +
        partes.join('') +
        '<span data-visto="' + U.esc(t.id) + '|lam-' + U.esc(l.id) + '"></span>' +
        '</article>';
    },

    /** Pie de autoría de la clase. */
    autoria(t, c) {
      const f = t.fuenteClase || c.fuenteClase || null;
      if (!(t.laminas || []).length) return '';
      if (t.sinDiapositivas || (f && f.sinDiapositivas)) {
        return '<p class="autoria">No hay diapositivas del docente para esta clase en tu carpeta: estas láminas se construyeron con la bibliografía citada abajo. ' +
          'Cuando tengas las diapositivas, se ajustarán al enfoque del docente, que es el que vale para el examen.</p>';
      }
      if (!f) return '';
      return '<p class="autoria">Basado en la clase «' + U.esc(f.titulo || t.nombre) + '» ' +
        (f.docente ? 'de ' + U.esc(f.docente) : 'del docente') + (f.anio ? ' (' + U.esc(f.anio) + ')' : '') + '. ' +
        'Redacción y esquemas propios de miru: no reproduce las diapositivas del docente.' +
        (f.nota ? ' ' + U.esc(f.nota) : '') + '</p>';
    }
  };

  function figura(f) {
    const cuerpo = f.svg
      ? '<div class="fig__svg" role="img" aria-label="' + U.esc(f.alt || f.leyenda || '') + '">' + f.svg + '</div>'
      : '<img src="' + U.esc(f.img) + '" alt="' + U.esc(f.alt || '') + '" loading="lazy" decoding="async">';
    return '<figure class="fig">' + cuerpo +
      (f.leyenda || f.credito ? '<figcaption>' + (f.leyenda ? U.md(f.leyenda) : '') +
        (f.credito ? ' <span class="fig__cred">' + U.md(f.credito) + '</span>' : '') + '</figcaption>' : '') +
      '</figure>';
  }

})(window);
