/* =========================================================================
   miru · FORMATO ÚNICO DE PREGUNTA y traductores
   Convierte al mismo formato las preguntas del simulacro (alternativas con
   id, correcta, por_que_no…) y las del módulo (opciones con correcta:true,
   porQueNo…). Nada se reescribe a mano y los ids se conservan.

   Formato miru:
   { id, tipo: 'opcion'|'vf'|'completar'|'ordenar'|'relacionar',
     moduloId, claseId, temaId, subtema, concepto, nivel,
     enunciado, marcado: 'md'|'plano',
     alternativas:[{id,texto}], correcta, porQueNo:{id:texto}   (opcion)
     respuesta:true|false                                        (vf)
     texto, huecos                                               (completar)
     pasos                                                       (ordenar)
     pares                                                       (relacionar)
     explicacion, datoClave, tipoClave, fuentes:{docente,guia,libro,discrepancia},
     referencias:[], origen:'banco'|'creada'|'modulo', procedencia,
     usos:['pasito','simulacro'] }
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;

  const SIN_MEZCLA = /\b(todas|todos|ninguna|ninguno|anteriores|ambas|ambos)\b|\b[a-e]\s*y\s*[a-e]\b/i;

  const Fm = MIRU.formato = {

    /** Pregunta del simulacro → formato miru */
    desdeSimulador(q, ubic) {
      return {
        id: q.id,
        tipo: 'opcion',
        marcado: 'plano',
        moduloId: ubic.moduloId, claseId: ubic.claseId, temaId: ubic.temaId,
        subtema: q.subtema || '',
        concepto: q.subtema || '',
        temaSimulador: q.tema,
        enunciado: q.enunciado,
        alternativas: (q.alternativas || []).map(a => ({ id: a.id, texto: a.texto })),
        correcta: q.correcta,
        porQueNo: q.por_que_no || {},
        explicacion: q.por_que_correcta || '',
        datoClave: q.dato_clave || '',
        tipoClave: q.tipo_clave || null,
        fuentes: q.fuentes || {},
        referencias: q.referencias || [],
        origen: q.origen || 'banco',
        procedencia: q.procedencia || '',
        mezclable: !(q.alternativas || []).some(a => SIN_MEZCLA.test(a.texto)),
        usos: ['pasito', 'simulacro']
      };
    },

    /** Pregunta del módulo «Cirugía I» → formato miru */
    desdeModulo(p, ubic) {
      const u = ubic || {};
      const base = {
        id: p.id,
        tipo: p.tipo || 'opcion',
        marcado: 'md',
        moduloId: u.moduloId || p.moduloId, claseId: u.claseId || p.claseId, temaId: u.temaId || p.temaId,
        subtema: p.concepto || '',
        concepto: p.concepto || '',
        nivel: p.nivel || null,
        enunciado: p.enunciado,
        explicacion: p.explicacion || '',
        tipoClave: p.docente ? 'docente' : null,
        fuentes: {},
        referencias: [],
        origen: 'modulo',
        procedencia: p.docente ? 'Pregunta tomada del material del docente (módulo Cirugía I)' : 'Pregunta del módulo Cirugía I',
        usos: u.usos || ['pasito']
      };
      if (base.tipo === 'opcion') {
        const ids = 'abcdefgh';
        base.alternativas = (p.opciones || []).map((o, i) => ({ id: ids[i], texto: o.texto }));
        const ic = (p.opciones || []).findIndex(o => o.correcta);
        base.correcta = ids[ic];
        base.porQueNo = {};
        (p.opciones || []).forEach((o, i) => { if (o.porQueNo) base.porQueNo[ids[i]] = o.porQueNo; });
        base.mezclable = !(p.opciones || []).some(o => SIN_MEZCLA.test(o.texto));
        if (!u.usos) base.usos = ['pasito', 'simulacro'];
      } else if (base.tipo === 'vf') {
        base.respuesta = p.respuesta;
      } else if (base.tipo === 'completar') {
        base.texto = p.texto; base.huecos = p.huecos;
      } else if (base.tipo === 'ordenar') {
        base.pasos = p.pasos;
      } else if (base.tipo === 'relacionar') {
        base.pares = p.pares;
      }
      return base;
    },

    /** ¿Se pueden barajar las alternativas? */
    mezclable(p) { return p.mezclable !== false; },

    /** Carga un banco del simulacro aplicando las reglas del mapa. */
    cargarBancoSimulador(esp, regla) {
      const b = global.BANCO && global.BANCO[esp];
      if (!b) return { cargadas: 0, sinTema: [] };
      let n = 0; const sinTema = [];
      b.preguntas.forEach(q => {
        let temaId = regla.temas[q.tema];
        if (typeof temaId === 'function') temaId = temaId(q);
        const r = temaId ? MIRU.temaPorId(temaId) : null;
        if (!r) { sinTema.push(q.id); return; }
        if (MIRU.agregarPregunta(Fm.desdeSimulador(q, { moduloId: r.clase.modulo, claseId: r.clase.id, temaId }))) n++;
      });
      return { cargadas: n, sinTema };
    },

    /** Recorre las clases registradas y lleva sus preguntas al banco único.
        Las que repiten una del simulacro (mismo enunciado) se omiten. */
    cargarPreguntasDeClases() {
      const firmas = {};
      Object.values(MIRU.banco).forEach(p => { firmas[p.moduloId] = firmas[p.moduloId] || []; firmas[p.moduloId].push(palabras(p.enunciado)); });
      let n = 0, dup = 0;
      MIRU.datos.clases.forEach(c => {
        const agregar = (p, temaId, usos) => {
          if (!p || !p.id || MIRU.banco[p.id]) return;
          const pw = palabras(p.enunciado);
          if ((firmas[c.modulo] || []).some(f => jaccard(f, pw) >= 0.85)) { dup++; return; }
          MIRU.agregarPregunta(Fm.desdeModulo(p, { moduloId: c.modulo, claseId: c.id, temaId, usos }));
          n++;
        };
        (c.temas || []).forEach(t => {
          (t.preguntas || []).forEach(p => agregar(p, t.id));
          (t.secciones || []).filter(s => s.tipo === 'pregunta').forEach(s => agregar(s.pregunta, t.id));
          (t.casos || []).concat((t.secciones || []).filter(s => s.tipo === 'caso').map(s => s.caso))
            .forEach(cs => (cs.vinetas || []).forEach(v => v.pregunta && agregar(v.pregunta, t.id, ['caso'])));
        });
        // Evaluación integradora de la clase: cuenta para la clase entera.
        (c.examen || []).forEach(p => agregar(p, c.id));
      });
      return { cargadas: n, duplicadas: dup };
    }
  };

  function palabras(s) {
    return new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  }
  function jaccard(a, b) {
    let i = 0; a.forEach(w => { if (b.has(w)) i++; });
    return i / ((a.size + b.size - i) || 1);
  }

})(typeof window !== 'undefined' ? window : globalThis);
