/* =========================================================================
   miru · NÚCLEO
   Registro de contenido (Curso → Bloque → Módulo → Clase → Tema), banco
   único de preguntas y utilidades. No contiene contenido médico ni toca el
   almacenamiento: por eso también se puede cargar en Node para construir
   el paquete de publicación.
   ========================================================================= */
(function (global) {
  'use strict';

  const MIRU = global.MIRU = global.MIRU || {};
  // Compatibilidad: el contenido del módulo «Cirugía I» llama a CIRUGIA.*
  global.CIRUGIA = MIRU;

  /* -----------------------------------------------------------------------
     1. REGISTRO DE CONTENIDO
     ----------------------------------------------------------------------- */
  const datos = MIRU.datos = {
    curso: { id: 'cirugia-1', nombre: 'Cirugía I', subtitulo: 'miru' },
    bloques: [],
    modulos: [],
    clases: []
  };

  /** Índices rápidos que se rehacen cuando cambia el registro. */
  let indTemas = null;

  function reindexar() { indTemas = null; MIRU._idxPreg = null; }

  MIRU.definirCurso = function (c) { Object.assign(datos.curso, c); };

  MIRU.registrarBloque = function (b) {
    if (datos.bloques.some(x => x.id === b.id)) return;
    datos.bloques.push(Object.assign({ orden: 99, icono: '📁', color: 'lila' }, b));
    datos.bloques.sort((a, z) => a.orden - z.orden);
  };

  MIRU.registrarModulo = function (m) {
    const previo = datos.modulos.find(x => x.id === m.id);
    if (previo) { Object.assign(previo, m, { docentes: m.docentes || previo.docentes }); return; }
    datos.modulos.push(Object.assign({
      orden: 99, icono: '📘', estado: 'disponible', docentes: [], descripcion: '', color: 'lila'
    }, m));
    datos.modulos.sort((a, z) => (a.orden || 0) - (z.orden || 0));
  };

  /** Registra una clase. Si ya existe, conserva la primera y completa los
      campos que falten (así la estructura general no pisa al contenido). */
  MIRU.registrarClase = function (c) {
    const previa = datos.clases.find(x => x.id === c.id);
    if (previa) {
      Object.keys(c).forEach(k => { if (previa[k] == null || (Array.isArray(previa[k]) && !previa[k].length)) previa[k] = c[k]; });
      reindexar();
      return;
    }
    datos.clases.push(Object.assign({
      objetivos: [], temas: [], integracion: null, resumen: null,
      examen: [], estado: 'disponible'
    }, c));
    datos.clases.sort((a, z) => (a.numero || 0) - (z.numero || 0));
    reindexar();
  };

  /** Añade un tema a una clase ya registrada (si no estaba). */
  MIRU.agregarTema = function (claseId, tema) {
    const c = MIRU.clase(claseId);
    if (!c) { console.warn('[miru] clase inexistente', claseId); return; }
    if (c.temas.some(t => t.id === tema.id)) { MIRU.completarTema(tema.id, tema); return; }
    c.temas.push(tema);
    reindexar();
  };

  /** Completa un tema existente con más contenido (láminas, flashcards…).
      Las listas se concatenan sin duplicar ids; el resto se asigna. */
  MIRU.completarTema = function (temaId, extra) {
    const r = MIRU.temaPorId(temaId);
    if (!r) { console.warn('[miru] tema inexistente', temaId); return; }
    const t = r.tema;
    Object.keys(extra).forEach(k => {
      if (k === 'id') return;
      const v = extra[k];
      if (Array.isArray(v) && Array.isArray(t[k])) {
        const ids = new Set(t[k].map(x => x && x.id).filter(Boolean));
        v.forEach(x => { if (!x || !x.id || !ids.has(x.id)) t[k].push(x); });
      } else {
        t[k] = v;
      }
    });
    reindexar();
  };

  /* Accesores ------------------------------------------------------------ */
  MIRU.bloque = id => datos.bloques.find(b => b.id === id);
  MIRU.modulo = id => datos.modulos.find(m => m.id === id);
  MIRU.clase = id => datos.clases.find(c => c.id === id);
  MIRU.modulosDe = b => datos.modulos.filter(m => m.bloque === b);
  MIRU.clasesDe = m => datos.clases.filter(c => c.modulo === m);
  MIRU.tema = function (claseId, temaId) {
    const c = MIRU.clase(claseId);
    return c ? (c.temas || []).find(t => t.id === temaId) : null;
  };
  MIRU.temasDe = function (moduloId) {
    return MIRU.clasesDe(moduloId).flatMap(c => (c.temas || []).map(t => ({ clase: c, tema: t })));
  };
  /** Busca un tema solo por su id → { tema, clase, modulo } */
  MIRU.temaPorId = function (temaId) {
    if (!indTemas) {
      indTemas = {};
      datos.clases.forEach(c => (c.temas || []).forEach(t => {
        indTemas[t.id] = { tema: t, clase: c, modulo: MIRU.modulo(c.modulo) };
      }));
    }
    return indTemas[temaId] || null;
  };
  MIRU.rutaTema = function (temaId) {
    const r = MIRU.temaPorId(temaId);
    return r ? '#/tema/' + r.clase.modulo + '/' + r.clase.id + '/' + temaId : '#/';
  };

  /* -----------------------------------------------------------------------
     2. BANCO ÚNICO DE PREGUNTAS (formato miru)
     Todas las preguntas, vengan del simulacro o del módulo, viven aquí con
     el mismo formato y un id estable. Los temas apuntan al banco por
     temaId: nunca se copian.
     ----------------------------------------------------------------------- */
  const banco = MIRU.banco = {};

  MIRU.agregarPregunta = function (p) {
    if (!p || !p.id) return false;
    if (banco[p.id]) {               // el id es estable: la primera gana
      if (banco[p.id] !== p && U.normal(banco[p.id].enunciado) !== U.normal(p.enunciado)) (MIRU._idsRepetidos = MIRU._idsRepetidos || []).push(p.id);
      return false;
    }
    banco[p.id] = p;
    MIRU._idxPreg = null;
    return true;
  };
  MIRU.pregunta = id => banco[id] || null;

  /** Preguntas escritas directamente en formato miru para un tema.
      Completa la ubicación y los valores por defecto. */
  MIRU.preguntasNuevas = function (temaId, lista) {
    const r = MIRU.temaPorId(temaId);
    if (!r) { console.warn('[miru] tema inexistente para preguntas', temaId); return; }
    (lista || []).forEach(p => {
      const tipo = p.tipo || 'opcion';
      MIRU.agregarPregunta(Object.assign({
        tipo,
        marcado: 'md',
        origen: 'creada',
        procedencia: 'Pregunta creada para miru',
        porQueNo: {},
        fuentes: {},
        referencias: [],
        usos: tipo === 'opcion' ? ['pasito', 'simulacro'] : ['pasito']
      }, p, { moduloId: r.clase.modulo, claseId: r.clase.id, temaId }));
    });
  };

  /** Preguntas de un tema (todas o filtradas por uso). */
  MIRU.preguntasDeTema = function (temaId, uso) {
    idxPreg();
    return (MIRU._idxPreg[temaId] || []).filter(p => !uso || (p.usos || []).includes(uso));
  };
  MIRU.preguntasDeClase = function (claseId, uso) {
    const c = MIRU.clase(claseId);
    if (!c) return [];
    // Las preguntas integradoras de la clase se guardan con temaId = id de la clase.
    return (c.temas || []).flatMap(t => MIRU.preguntasDeTema(t.id, uso)).concat(MIRU.preguntasDeTema(c.id, uso));
  };
  MIRU.preguntasDeModulo = function (moduloId, uso) {
    return MIRU.clasesDe(moduloId).flatMap(c => MIRU.preguntasDeClase(c.id, uso));
  };
  function idxPreg() {
    if (MIRU._idxPreg) return;
    const ix = {};
    Object.values(banco).forEach(p => { (ix[p.temaId] = ix[p.temaId] || []).push(p); });
    MIRU._idxPreg = ix;
  }

  /** Recuento de lo que tiene un tema. */
  MIRU.inventarioTema = function (tema) {
    const preg = MIRU.preguntasDeTema(tema.id);
    return {
      laminas: (tema.laminas || []).length,
      secciones: (tema.secciones || []).filter(s => s.tipo !== 'pregunta').length,
      preguntas: preg.length,
      simulacro: preg.filter(p => (p.usos || []).includes('simulacro')).length,
      flashcards: (tema.flashcards || []).length,
      casos: (tema.casos || []).length,
      esquemas: (tema.secciones || []).filter(s => s.tipo === 'esquema').length + (tema.esquemas || []).length
    };
  };

  /** ¿La clase tiene algo que estudiar o practicar? */
  MIRU.claseConContenido = function (c) {
    return (c.temas || []).some(t => {
      const i = MIRU.inventarioTema(t);
      return i.laminas || i.secciones || i.preguntas || i.flashcards;
    });
  };

  /* -----------------------------------------------------------------------
     3. EXPORTAR / IMPORTAR EL CONTENIDO COMPLETO (para el paquete)
     ----------------------------------------------------------------------- */
  MIRU.exportarDatos = function () {
    return {
      curso: datos.curso,
      bloques: datos.bloques,
      modulos: datos.modulos,
      clases: datos.clases,
      fuentes: MIRU.fuentes ? MIRU.fuentes.todas() : [],
      banco: Object.values(banco)
    };
  };

  MIRU.importarDatos = function (d) {
    if (d.curso) MIRU.definirCurso(d.curso);
    (d.bloques || []).forEach(MIRU.registrarBloque);
    (d.modulos || []).forEach(MIRU.registrarModulo);
    (d.clases || []).forEach(MIRU.registrarClase);
    if (MIRU.fuentes && d.fuentes) {
      const f = {}; d.fuentes.forEach(x => { f[x.id] = x; }); MIRU.fuentes.registrar(f);
    }
    (d.banco || []).forEach(MIRU.agregarPregunta);
    reindexar();
  };

  /* -----------------------------------------------------------------------
     4. UTILIDADES
     ----------------------------------------------------------------------- */
  const U = MIRU.util = {
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** Texto plano seguro con enlaces automáticos (preguntas del simulacro). */
    plano(s) {
      return U.esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:)\]»]/g, u =>
        '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
    },

    /** Marcado ligero seguro: **negrita**, *cursiva*, `código`, [[ref:id]] */
    md(s) {
      let h = U.esc(s);
      // Las citas se guardan aparte y se insertan al final, para que el
      // resto del marcado (enlaces, negritas) no toque su HTML.
      const citas = [];
      h = h.replace(/\[\[ref:([a-z0-9\-_.,\s]+)\]\]/gi, (m, ids) => {
        citas.push(MIRU.fuentes ? ids.split(',').map(i => MIRU.fuentes.chip(i.trim())).join('') : '');
        return '\u0000' + (citas.length - 1) + '\u0000';
      });
      h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/(^|[\s(«"])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      h = h.replace(/https?:\/\/[^\s<\u0000]+[^\s<.,;:)\]»\u0000]/g, u =>
        '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
      return h.replace(/\u0000(\d+)\u0000/g, (m, k) => citas[+k]);
    },

    /** Elige md o plano según cómo esté escrita la pregunta. */
    txt(s, marcado) { return marcado === 'plano' ? U.plano(s) : U.md(s); },

    /** Párrafos: separa por doble salto de línea; listas con «- ». */
    parrafos(s, marcado) {
      const f = marcado === 'plano' ? U.plano : U.md;
      // Dentro de un párrafo, las líneas seguidas que empiezan con «- » o «1. »
      // forman una lista; el resto del texto queda como párrafo.
      const tipo = l => /^\s*[-•]\s/.test(l) ? 'ul' : /^\s*\d+[.)]\s/.test(l) ? 'ol' : 'p';
      return String(s || '').split(/\n{2,}/).map(p => {
        p = p.trim(); if (!p) return '';
        const grupos = [];
        p.split('\n').filter(l => l.trim()).forEach(l => {
          const t = tipo(l);
          const g = grupos[grupos.length - 1];
          if (g && g.t === t) g.l.push(l); else grupos.push({ t, l: [l] });
        });
        return grupos.map(g => {
          if (g.t === 'ul') return '<ul>' + g.l.map(l => '<li>' + f(l.replace(/^\s*[-•]\s*/, '')) + '</li>').join('') + '</ul>';
          if (g.t === 'ol') return '<ol>' + g.l.map(l => '<li>' + f(l.replace(/^\s*\d+[.)]\s*/, '')) + '</li>').join('') + '</ol>';
          return '<p>' + g.l.map(f).join('<br>') + '</p>';
        }).join('');
      }).join('');
    },

    mezclar(a) {
      const r = a.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = r[i]; r[i] = r[j]; r[j] = t;
      }
      return r;
    },

    letra: i => 'abcdefgh'[i] || '?',

    num(n) { return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n); },

    fecha(ts) {
      if (!ts) return '—';
      try { return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }); }
      catch (e) { return new Date(ts).toLocaleDateString(); }
    },
    fechaCorta(ts) {
      try {
        const d = new Date(ts);
        return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) + ', ' +
          d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return String(ts); }
    },
    reloj(ms) {
      const s = Math.max(0, Math.round(ms / 1000));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    },

    normal(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); },

    anillo(pct, size) {
      const s = size || 52, r = (s - 6) / 2, c = 2 * Math.PI * r;
      const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
      return '<div class="anillo" style="width:' + s + 'px;height:' + s + 'px" role="img" aria-label="' + Math.round(pct) + ' %">' +
        '<svg width="' + s + '" height="' + s + '" aria-hidden="true">' +
        '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="var(--bg-sunk)" stroke-width="5"/>' +
        '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="var(--cf, var(--brand))" stroke-width="5" ' +
        'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>' +
        '<span class="anillo__tx">' + Math.round(pct) + '%</span></div>';
    },

    barra(pct, fina) {
      return '<div class="barra' + (fina ? ' barra--fina' : '') + '" role="img" aria-label="' + Math.round(pct) + ' %"><div class="barra__f" style="width:' +
        Math.max(0, Math.min(100, pct)) + '%"></div></div>';
    },

    etiquetaPrioridad(p) {
      const m = { maxima: ['max', '●', 'Dominar'], media: ['med', '●', 'Comprender'], baja: ['low', '●', 'Conocer'] };
      if (!m[p]) return '';
      const v = m[p];
      return '<span class="eti eti--' + v[0] + '" title="Prioridad: ' + v[2].toLowerCase() + '">' + v[1] + ' ' + v[2] + '</span>';
    },

    /** Delegación de eventos */
    on(raiz, evento, selector, fn) {
      raiz.addEventListener(evento, function (e) {
        const t = e.target.closest(selector);
        if (t && raiz.contains(t)) fn.call(t, e, t);
      });
    },

    id(pref) { return pref + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); },

    recorta(s, n) { s = String(s || '').replace(/\*\*/g, '').replace(/\[\[ref:[^\]]+\]\]/g, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; },

    descargar(nombre, texto, tipo) {
      const b = new Blob([texto], { type: tipo || 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
