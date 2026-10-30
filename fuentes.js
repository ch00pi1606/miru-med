/* =========================================================================
   miru · FUENTES — biblioteca bibliográfica y citas numeradas (Vancouver)
   En el texto se cita con [[ref:id]] y aquí se resuelve a la ficha.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;

  const banco = {};      // id → ficha
  const orden = [];      // ids citados en la pantalla actual, por orden de aparición
  let indice = {};       // id → número

  const F = MIRU.fuentes = {

    registrar(fichas) {
      Object.keys(fichas).forEach(k => { banco[k] = Object.assign({ id: k }, fichas[k]); });
    },
    ficha: id => banco[id] || null,
    todas: () => Object.values(banco),
    existe: id => !!banco[id],

    reiniciarIndice() { orden.length = 0; indice = {}; },

    /** Numera por adelantado todas las citas que contiene un objeto. */
    preregistrar(obj) {
      const vistos = new Set();
      (function anda(v) {
        if (v == null) return;
        if (typeof v === 'string') {
          const m = v.match(/\[\[ref:([^\]]+)\]\]/g);
          if (m) m.forEach(x => x.slice(6, -2).split(',').forEach(id => F.numero(id.trim())));
          return;
        }
        if (typeof v !== 'object' || vistos.has(v)) return;
        vistos.add(v);
        if (Array.isArray(v)) { v.forEach(anda); return; }
        Object.keys(v).forEach(k => anda(v[k]));
      })(obj);
    },

    /** Recorre el tema en el orden en que se pinta. */
    preregistrarTema(t) {
      const P = F.preregistrar;
      P(t.subtitulo); P(t.conceptoAncla); P(t.prerequisitos);
      (t.laminas || []).forEach(l => P(l));
      (t.secciones || []).forEach(s => {
        P(s.titulo); P(s.intro); P(s.texto); P(s.nota);
        if (s.tipo === 'tabla') P(s.tabla);
        if (s.tipo === 'lista' || s.tipo === 'acordeon') P(s.items);
        if (s.tipo === 'dual') { P(s.curso); P(s.evidencia); P(s.porQue); P(s.responder); }
        if (s.tipo === 'esquema') { P(s.esquema.intro); P(s.esquema.cierre); }
        if (s.tipo === 'pregunta') P(s.pregunta.enunciado);
        if (s.tipo === 'caso') { P(s.caso.presentacion); P(s.caso.origen); }
      });
      (t.casos || []).forEach(c => { P(c.presentacion); P(c.origen); P(c.cierre); P(c.aprendizajes); });
      P(t.resumen);
      (t.fuentesTema || []).forEach(id => F.numero(id));
      P(t);
    },

    numero(id) {
      if (!banco[id]) return null;
      if (!(id in indice)) { orden.push(id); indice[id] = orden.length; }
      return indice[id];
    },

    chip(id) {
      const n = F.numero(id);
      if (!n) return '';
      return '<a href="#fuente-' + U.esc(id) + '" class="cita" data-fuente="' + U.esc(id) + '" ' +
        'title="' + U.esc(F.vancouver(banco[id])) + '">' + n + '</a>';
    },

    /** Referencia en estilo Vancouver. */
    vancouver(f) {
      if (!f) return '';
      const a = f.autores ? f.autores.replace(/\.$/, '') + '. ' : '';
      const ed = f.edicion ? f.edicion.replace(/\.$/, '') + '. ' : '';
      const lugar = (f.ciudad ? f.ciudad + ': ' : '') + (f.editorial || '');
      switch (f.tipo) {
        case 'capitulo':
          return a + f.titulo.replace(/\.$/, '') + '. En: ' + (f.editores ? f.editores + ', editores. ' : '') +
            (f.libro || f.contenedor || '') + '. ' + ed + (lugar ? lugar + '; ' : '') + (f.anio || '') +
            (f.paginas ? '. p. ' + f.paginas : '') + '.';
        case 'libro':
          return a + f.titulo.replace(/\.$/, '') + '. ' + ed + (lugar ? lugar + '; ' : '') + (f.anio || '') + '.';
        case 'web':
        case 'guia':
          if (f.tipo === 'guia' && f.contenedor) return F.vancouver(Object.assign({}, f, { tipo: 'articulo' }));
          return a + f.titulo.replace(/\.$/, '') + (f.url || f.tipo === 'web' ? ' [Internet]' : '') + '. ' + (lugar ? lugar + '; ' : '') + (f.anio || '') +
            (f.consultado ? ' [citado ' + f.consultado + ']' : '') + '.' + (f.url ? ' Disponible en: ' + f.url : '');
        case 'curso':
          return a + f.titulo.replace(/\.$/, '') + ' [clase]. ' + (f.contenedor ? f.contenedor + '; ' : '') + (f.anio || '') + '.';
        default: {
          let loc = (f.anio || '');
          if (f.volumen) loc += ';' + f.volumen + (f.numero ? '(' + f.numero + ')' : '');
          if (f.paginas) loc += ':' + f.paginas;
          return a + (f.titulo || '').replace(/\.$/, '') + '. ' + (f.contenedor ? f.contenedor + '. ' : '') + ed +
            (f.editorial ? f.editorial + '; ' : '') + loc + '.' + (f.capitulo ? ' ' + f.capitulo + '.' : '');
        }
      }
    },

    listaCitadas() { return orden.length ? F.lista(orden, true) : ''; },

    lista(ids, numerada) {
      const items = ids.map((id, i) => {
        const f = banco[id];
        if (!f) return '';
        const enl = [];
        if (f.url) enl.push('<a href="' + U.esc(f.url) + '" target="_blank" rel="noopener">Ver fuente ↗</a>');
        if (f.pdf) enl.push('<a href="' + U.esc(f.pdf) + '" target="_blank" rel="noopener">PDF ↗</a>');
        if (f.doi) enl.push('<a href="https://doi.org/' + U.esc(f.doi) + '" target="_blank" rel="noopener">DOI ' + U.esc(f.doi) + '</a>');
        if (f.pmid) enl.push('<a href="https://pubmed.ncbi.nlm.nih.gov/' + U.esc(f.pmid) + '/" target="_blank" rel="noopener">PMID ' + U.esc(f.pmid) + '</a>');
        const nivel = f.nivel ? '<span class="eti eti--neu">Nivel ' + U.esc(f.nivel) + '</span>' : '';
        return '<div class="fuente" id="fuente-' + U.esc(id) + '">' +
          '<div class="fuente__n">' + (numerada ? (i + 1) : '•') + '</div>' +
          '<div class="fuente__c">' +
          '<div class="fuente__t">' + U.esc(F.vancouver(f)) + ' ' + nivel + '</div>' +
          (f.nota ? '<div class="fuente__m">' + U.esc(f.nota) + '</div>' : '') +
          (enl.length ? '<div class="fuente__l">' + enl.join('') + '</div>' : '') +
          '</div></div>';
      }).join('');
      return '<div class="fuentes-lista">' + items + '</div>';
    },

    avisoPDF: 'Solo se enlazan textos disponibles de forma legal y abierta. Si el texto completo es de acceso ' +
      'restringido (por ejemplo, ClinicalKey), se cita el libro sin enlace.'
  };

})(typeof window !== 'undefined' ? window : globalThis);
