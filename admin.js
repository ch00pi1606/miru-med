/* =========================================================================
   miru · PANEL DE ADMINISTRACIÓN
   · Modo 'local': el modo administrador es un PIN, una comodidad y no un
     candado (cualquiera que sepa mirar puede activarlo).
   · Modo 'supabase': se entra con usuario (correo) y contraseña, y CADA
     acción la comprueba el servidor (privado.administradores).
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const CFG = global.MIRU_CONFIG || {};
  const CLAVE = 'miru.v1.admin';

  const SB = () => CFG.modo === 'supabase';
  const AL = () => MIRU.almacen;
  const diaLocal = d => U.fecha(String(d).slice(0, 10) + 'T12:00:00');
  const enDias = n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  const A = MIRU.admin = {
    activo() {
      if (SB()) return AL().esAdmin();
      try { return global.localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
    },
    async alternar() {
      if (SB()) {
        if (AL().esAdmin()) { await AL().salirAdmin(); MIRU.ui.aviso('Cerraste la sesión de administradora.'); return false; }
        await AL().pantallaAcceso({ soloAdmin: true, cancelable: true });
        if (AL().esAdmin()) MIRU.ui.aviso('Sesión de administradora iniciada.');
        return AL().esAdmin();
      }
      if (A.activo()) { try { global.localStorage.removeItem(CLAVE); } catch (e) {} return false; }
      const pin = await MIRU.ui.pedirTexto('Modo administrador', 'Escribe el PIN de administración (está en config.js).', '', 'password');
      if (pin == null) return false;
      if (String(pin) !== String(CFG.pinAdmin || '')) { MIRU.ui.aviso('PIN incorrecto.', 'mal'); return false; }
      try { global.localStorage.setItem(CLAVE, '1'); } catch (e) {}
      return true;
    },

    /* ------------------------------------------------------- inventario */
    inventario() {
      return MIRU.datos.modulos.map(m => {
        const clases = MIRU.clasesDe(m.id).map(c => {
          const temas = (c.temas || []).map(t => {
            const i = MIRU.inventarioTema(t);
            const preg = MIRU.preguntasDeTema(t.id);
            return { id: t.id, nombre: t.nombre, laminas: i.laminas, secciones: i.secciones, preguntas: preg.length,
              opcion: preg.filter(p => p.tipo === 'opcion').length, otras: preg.filter(p => p.tipo !== 'opcion').length,
              flashcards: i.flashcards, casos: i.casos };
          });
          return { id: c.id, numero: c.numero, nombre: c.nombre, temas, integradoras: MIRU.preguntasDeTema(c.id).length };
        });
        return { id: m.id, nombre: m.nombre, clases };
      });
    },

    /* ----------------------------------------------------- incoherencias */
    incoherencias() {
      const out = [];
      const add = (tipo, detalle, donde) => out.push({ tipo, detalle, donde: donde || '' });
      (MIRU._idsRepetidos || []).forEach(id => add('Id repetido', 'Dos preguntas distintas usan el id ' + id + ' (solo se cargó la primera)', id));
      const vistos = {};
      MIRU.datos.clases.forEach(c => (c.temas || []).forEach(t => {
        if (vistos[t.id]) add('Id repetido', 'Tema duplicado ' + t.id, c.id); vistos[t.id] = 1;
        const lids = {};
        (t.laminas || []).forEach(l => { if (lids[l.id]) add('Id repetido', 'Lámina repetida ' + l.id, t.id); lids[l.id] = 1; });
        (t.flashcards || []).forEach(f => { if (vistos['fc:' + f.id]) add('Id repetido', 'Flashcard repetida ' + f.id, t.id); vistos['fc:' + f.id] = 1; });
        const i = MIRU.inventarioTema(t);
        if (i.laminas && !i.preguntas) add('Tema sin preguntas', 'Tiene láminas pero no preguntas para su pasito', t.id);
      }));
      Object.values(MIRU.banco).forEach(p => {
        if (!MIRU.temaPorId(p.temaId) && !MIRU.clase(p.temaId)) add('Ubicación', 'La pregunta apunta a un tema que no existe: ' + p.temaId, p.id);
        if (p.tipo === 'opcion') {
          if (!(p.alternativas || []).some(a => a.id === p.correcta)) add('Sin respuesta correcta', 'La clave no coincide con ninguna alternativa', p.id);
          const faltan = (p.alternativas || []).filter(a => a.id !== p.correcta && !(p.porQueNo || {})[a.id]);
          if (faltan.length) add('Explicación incompleta', faltan.length + ' alternativa(s) sin «por qué no»', p.id);
          if (p.datoClave && p.enunciado.indexOf(p.datoClave) < 0) add('Dato clave', 'El dato clave no aparece literal en el enunciado', p.id);
        }
        if (p.tipo === 'vf' && typeof p.respuesta !== 'boolean') add('Sin respuesta correcta', 'V/F sin respuesta', p.id);
        if (!p.explicacion) add('Explicación incompleta', 'Sin explicación de la respuesta correcta', p.id);
      });
      // Citas rotas: [[ref:x]] sin ficha en la biblioteca
      const rotas = {};
      (function anda(v, donde) {
        if (v == null) return;
        if (typeof v === 'string') {
          (v.match(/\[\[ref:([^\]]+)\]\]/g) || []).forEach(x => x.slice(6, -2).split(',').forEach(id => {
            id = id.trim(); if (!MIRU.fuentes.existe(id)) rotas[id] = donde;
          }));
          return;
        }
        if (typeof v !== 'object') return;
        if (Array.isArray(v)) { v.forEach(x => anda(x, donde)); return; }
        Object.keys(v).forEach(k => anda(v[k], v.id || donde));
      })(MIRU.datos.clases, '');
      Object.keys(rotas).forEach(id => add('Cita rota', 'No existe la fuente «' + id + '»', rotas[id]));
      return out;
    },

    /* --------------------------------------------- resultados de prueba */
    agregarResultados(objetos) {
      const preg = {}, fcs = {};
      objetos.forEach(o => {
        Object.entries(o.preguntas || {}).forEach(([id, r]) => {
          const x = preg[id] || (preg[id] = { id, personas: 0, intentos: 0, fallos: 0, ultimaMal: 0 });
          x.personas++; x.intentos += r.intentos || 0; x.fallos += r.fallos || 0; if (r.ultimoAcierto === false) x.ultimaMal++;
        });
        Object.entries(o.flashcards || {}).forEach(([id, f]) => {
          const x = fcs[id] || (fcs[id] = { id, nose: 0, dudo: 0, se: 0 }); if (f.estado) x[f.estado]++;
        });
      });
      return A.resumir(Object.values(preg), fcs, objetos.length);
    },

    /** filas: [{id, personas, intentos, fallos, ultimaMal}] (del navegador o de admin_errores) */
    resumir(filas, fcs, personas) {
      const preg = {}, temas = {};
      filas.forEach(x => { preg[x.id] = x; });
      Object.values(preg).forEach(x => {
        const p = MIRU.pregunta(x.id); if (!p) return;
        x.tasa = x.intentos ? x.fallos / x.intentos : 0;
        x.temaId = p.temaId; x.enunciado = U.recorta(p.enunciado, 120);
        const t = temas[p.temaId] || (temas[p.temaId] = { temaId: p.temaId, intentos: 0, fallos: 0 });
        t.intentos += x.intentos; t.fallos += x.fallos;
      });
      Object.values(temas).forEach(t => { t.tasa = t.intentos ? t.fallos / t.intentos : 0; const r = MIRU.temaPorId(t.temaId); t.nombre = r ? r.tema.nombre : t.temaId; });
      return {
        personas: personas != null ? personas : Math.max(0, ...filas.map(x => x.personas || 0)),
        preguntas: Object.values(preg).filter(x => x.intentos >= 2 && MIRU.pregunta(x.id)).sort((a, b) => b.tasa - a.tasa || b.fallos - a.fallos),
        temas: Object.values(temas).sort((a, b) => b.tasa - a.tasa),
        flashcards: Object.values(fcs || {}).sort((a, b) => (b.nose * 2 + b.dudo) - (a.nose * 2 + a.dudo))
      };
    },

    htmlResultados(r, quien) {
      return '<p><strong>' + r.personas + '</strong> ' + (quien || 'progresos analizados') + '.</p>' +
        '<h4>Temas con más error</h4><ol>' + r.temas.slice(0, 10).map(t => '<li>' + U.esc(t.nombre) + ' — ' + Math.round(t.tasa * 100) + ' % (' + t.fallos + '/' + t.intentos + ')</li>').join('') + '</ol>' +
        '<h4>Preguntas con más error (2+ intentos)</h4><div class="tablaWrap"><table class="t"><thead><tr><th>Pregunta</th><th>Error</th><th>Personas</th></tr></thead><tbody>' +
        r.preguntas.slice(0, 30).map(x => '<tr><td><code>' + U.esc(x.id) + '</code> ' + U.esc(x.enunciado) + '</td><td>' + Math.round(x.tasa * 100) + ' %</td><td>' + x.personas + '</td></tr>').join('') + '</tbody></table></div>' +
        '<button class="btn" data-acc="exp-prueba" type="button">⬇ Descargar ranking de errores (para crear flashcards)</button>';
    },

    /* ------------------------------------------------------------ vista */
    render() {
      if (!A.activo()) return MIRU.ui.vacio('🔒', 'Panel de administración', SB()
        ? 'Entra con tu usuario y contraseña desde <a href="#/perfil">Mi perfil → Entrar como administradora</a>.'
        : 'Activa el modo administrador desde <a href="#/perfil">Mi perfil</a>.');
      const inv = A.inventario();
      const inc = A.incoherencias();
      const ib = MIRU.contenido.informeBanco;
      const tot = { lam: 0, preg: Object.keys(MIRU.banco).length, fc: 0 };
      inv.forEach(m => m.clases.forEach(c => c.temas.forEach(t => { tot.lam += t.laminas; tot.fc += t.flashcards; })));
      const porTipo = {};
      inc.forEach(x => { porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1; });

      return '<header class="titulo-grande"><h1>Administración</h1><p>' + U.esc(MIRU.contenido.etiqueta()) + '</p></header>' +
        (MIRU.sugerencias ? MIRU.sugerencias.htmlAdmin() : '') +
        (SB() ? A.htmlAlumnos()
          : '<div class="capa capa--aviso"><div class="capa__t">Seguridad, dicho claro</div><p>Mientras miru viva solo en el navegador, este modo es una comodidad, no un candado: quien sepa usar las herramientas del navegador puede activarlo. Con Supabase, el rol de administrador se comprobará en el servidor.</p></div>') +
        '<div class="estat">' +
        '<div class="estat__c"><div class="estat__v">' + tot.lam + '</div><div class="estat__e">Láminas</div></div>' +
        '<div class="estat__c"><div class="estat__v">' + tot.preg + '</div><div class="estat__e">Preguntas en el banco</div></div>' +
        '<div class="estat__c"><div class="estat__v">' + tot.fc + '</div><div class="estat__e">Flashcards</div></div>' +
        '<div class="estat__c"><div class="estat__v">' + inc.length + '</div><div class="estat__e">Incoherencias</div></div></div>' +

        '<div class="tj"><h3>Cómo publicar una actualización</h3><ol>' +
        '<li>Claude prepara el contenido nuevo y ejecuta <code>herramientas/construir.js</code>: valida todo, sube el número de versión y genera la carpeta <code>publicar/</code> con el contenido cifrado.</li>' +
        '<li>Subes el contenido de <code>publicar/</code> a tu repositorio de GitHub (arrastrar y soltar en «Add file → Upload files»), o Claude lo sube si conectas el repositorio.</li>' +
        '<li>Cuando cada alumno abre miru con internet, recibe la versión nueva y ve «Se añadió…». Su progreso no se toca: vive aparte y apunta a ids estables.</li></ol>' +
        (MIRU.contenido.novedades.length ? '<p><strong>Novedades de esta versión:</strong></p><ul>' + MIRU.contenido.novedades.map(x => '<li>' + U.md(x) + '</li>').join('') + '</ul>' : '') +
        '</div>' +

        '<div class="tj"><h3>Inventario</h3><div class="tablaWrap"><table class="t"><thead><tr><th>Módulo / clase / tema</th><th>Láminas</th><th>Preguntas</th><th>Opción múlt.</th><th>Otros formatos</th><th>Flashcards</th><th>Casos</th></tr></thead><tbody>' +
        inv.map(m => '<tr class="t-grupo"><td colspan="7">' + U.esc(m.nombre) + '</td></tr>' + m.clases.map(c => c.temas.map(t =>
          '<tr><td>' + (c.numero ? c.numero + '. ' : '') + U.esc(t.nombre) + '<br><code>' + U.esc(t.id) + '</code></td><td>' + t.laminas + '</td><td>' + t.preguntas + '</td><td>' + t.opcion + '</td><td>' + t.otras + '</td><td>' + t.flashcards + '</td><td>' + t.casos + '</td></tr>').join('') +
          (c.integradoras ? '<tr><td>' + U.esc(c.nombre) + ' · integradoras</td><td></td><td>' + c.integradoras + '</td><td colspan="4"></td></tr>' : '')).join('')).join('') +
        '</tbody></table></div>' +
        (ib ? '<p class="nota">Banco del simulador: ' + Object.entries(ib.simulador).map(([k, v]) => k + ' ' + v.cargadas + (v.sinTema.length ? ' (' + v.sinTema.length + ' sin tema)' : '')).join(' · ') +
          (ib.modulo ? ' · módulo: ' + ib.modulo.cargadas + ' cargadas, ' + ib.modulo.duplicadas + ' duplicadas omitidas' : '') + '</p>' : '') +
        '<button class="btn btn--sm" data-acc="exp-inventario" type="button">⬇ Exportar inventario (JSON)</button></div>' +

        '<div class="tj"><h3>Incoherencias</h3>' +
        (inc.length ? '<p>' + Object.entries(porTipo).map(([k, v]) => '<span class="eti eti--bad">' + U.esc(k) + ': ' + v + '</span>').join(' ') + '</p>' +
          '<details class="acor"><summary class="acor__b">Ver detalle (' + inc.length + ')</summary><div class="acor__c"><div class="tablaWrap"><table class="t"><thead><tr><th>Tipo</th><th>Detalle</th><th>Dónde</th></tr></thead><tbody>' +
          inc.slice(0, 400).map(x => '<tr><td>' + U.esc(x.tipo) + '</td><td>' + U.esc(x.detalle) + '</td><td><code>' + U.esc(x.donde) + '</code></td></tr>').join('') +
          '</tbody></table></div></div></details>'
          : '<p>✓ Sin incoherencias: ids únicos, todas las preguntas con clave y explicación, sin citas rotas.</p>') + '</div>' +

        (SB() ? '<div class="tj"><h3>Errores de tus alumnos</h3><p class="nota">Totales por pregunta, sumados desde el progreso sincronizado. No muestra nombres: el progreso de cada alumno es privado.</p>' +
          '<button class="btn" data-acc="errores-servidor" type="button">📊 Calcular ahora</button><div data-res-servidor></div></div>' : '') +
        '<div class="tj"><h3>Resultados de la prueba con usuarios</h3>' +
        '<p class="nota">Pide a cada tester que exporte su progreso (Mi perfil → Exportar) y súbelos aquí, todos a la vez. miru calcula qué preguntas, temas y flashcards fallan más. Con ese archivo se escriben las flashcards de refuerzo.</p>' +
        '<input type="file" accept="application/json,.json" multiple data-file-prueba>' +
        '<div data-res-prueba></div></div>' +

        (SB() ? '<div class="tj"><h3>Bitácora</h3><details class="acor" data-bitacora><summary class="acor__b">Ver tus últimas acciones</summary><div class="acor__c" data-bit><p class="nota">Cargando…</p></div></details></div>'
          : '<div class="tj"><h3>Códigos de acceso</h3><p class="nota">Ahora miru usa un <strong>código de prueba</strong> fijo, definido al construir la publicación. Con Supabase (config.js → modo: \'supabase\'), cada alumno entra con su número miru y un código de un minuto.</p></div>');
    },

    activar(raiz) {
      U.on(raiz, 'click', '[data-acc="exp-inventario"]', () => U.descargar('miru-inventario-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ version: MIRU.contenido.version, inventario: A.inventario(), incoherencias: A.incoherencias() }, null, 1)));
      const fp = raiz.querySelector('[data-file-prueba]');
      if (fp) fp.addEventListener('change', async e => {
        const objs = [];
        for (const f of e.target.files) { try { objs.push(JSON.parse(await f.text())); } catch (err) { MIRU.ui.aviso('No pude leer ' + U.esc(f.name), 'mal'); } }
        const r = A.agregarResultados(objs);
        A._ultimo = r;
        raiz.querySelector('[data-res-prueba]').innerHTML = A.htmlResultados(r);
      });
      U.on(raiz, 'click', '[data-acc="exp-prueba"]', () => { if (A._ultimo) U.descargar('miru-errores-prueba.json', JSON.stringify(A._ultimo, null, 1)); });
      if (SB()) A.activarAlumnos(raiz);
      if (MIRU.sugerencias) MIRU.sugerencias.activarAdmin(raiz);
    },

    /* ================================================ ALUMNOS (Supabase) */
    htmlAlumnos() {
      const yo = AL().adminInfo() || {};
      return '<div class="tj"><h3>Alumnos</h3>' +
        '<p class="nota">Sesión de administradora: <strong>' + U.esc(yo.nombre || yo.email || '—') + '</strong>' + (yo.email && yo.nombre ? ' (' + U.esc(yo.email) + ')' : '') +
        ' · <button class="btn btn--sm" data-acc="admin-salir" type="button">Cerrar sesión</button></p>' +
        '<details class="acor"><summary class="acor__b">＋ Crear alumno</summary><div class="acor__c">' +
        '<form data-form="alumno" class="formAlumno" novalidate>' +
        '<label class="campo"><span class="campo__l">Nombre y apellido</span><input name="nombre" maxlength="60" required autocomplete="off"></label>' +
        '<label class="campo"><span class="campo__l">Código universitario (opcional)</span><input name="cu" maxlength="20" autocomplete="off"></label>' +
        '<label class="campo"><span class="campo__l">Acceso a Cirugía I hasta</span><input name="hasta" type="date" value="' + enDias(120) + '"></label>' +
        '<label class="campo"><span class="campo__l">Tipo de acceso</span><select name="origen"><option value="prueba">Prueba</option><option value="pago">Pago</option><option value="cortesia">Cortesía</option></select></label>' +
        '<button class="btn btn--pri" type="submit">Crear alumno</button></form></div></details>' +
        '<div data-codigo></div>' +
        '<div data-lista><p class="nota">Cargando alumnos…</p></div></div>';
    },

    async cargarAlumnos(raiz) {
      const el = raiz.querySelector('[data-lista]'); if (!el) return;
      let lista;
      try { lista = await AL().rpcAdmin('admin_alumnos', {}); }
      catch (e) { el.innerHTML = '<p class="nota">⚠️ ' + U.esc(e.message) + '</p>'; return; }
      A._alumnos = lista;
      if (!lista.length) { el.innerHTML = '<p class="nota">Aún no hay alumnos. Crea el primero arriba.</p>'; return; }
      const hoy = enDias(0);
      el.innerHTML = '<div class="tablaWrap"><table class="t tAlumnos"><thead><tr><th>N.º miru</th><th>Alumno</th><th>Cirugía I</th><th>Dispositivo</th><th>Acciones</th></tr></thead><tbody>' +
        lista.map(a => {
          const c = (a.cursos || []).find(x => x.curso === (CFG.curso || 'cir1'));
          const acceso = c ? (c.vigente ? '<span class="eti eti--ok">hasta ' + diaLocal(c.hasta) + '</span>' : '<span class="eti eti--bad">' + (c.hasta < hoy ? 'venció ' + diaLocal(c.hasta) : 'desde ' + diaLocal(c.desde)) + '</span>') + '<br><span class="nota">' + U.esc(c.origen) + '</span>'
            : '<span class="eti eti--neu">sin acceso</span>';
          const d = a.dispositivo;
          const disp = d ? U.esc(d.etiqueta || 'Dispositivo') + '<br><span class="nota">usado ' + U.fechaCorta(d.ultimo_uso) + '</span>' : '<span class="nota">ninguno activo</span>';
          const susp = a.estado !== 'activo';
          return '<tr' + (susp ? ' class="t-susp"' : '') + '><td><strong>' + U.esc(a.codigo) + '</strong></td>' +
            '<td>' + U.esc(a.nombre) + (a.codigo_universitario ? '<br><span class="nota">' + U.esc(a.codigo_universitario) + '</span>' : '') + (susp ? '<br><span class="eti eti--bad">suspendido</span>' : '') + '</td>' +
            '<td>' + acceso + '</td><td>' + disp + '</td>' +
            '<td><div class="tira">' +
            (susp ? '' : '<button class="btn btn--sm btn--pri" data-acc="al-codigo" data-num="' + a.numero + '" type="button">🔑 Código 1 min</button>') +
            '<button class="btn btn--sm" data-acc="al-acceso" data-num="' + a.numero + '" type="button">📅 Acceso</button>' +
            (d ? '<button class="btn btn--sm" data-acc="al-liberar" data-num="' + a.numero + '" type="button">📵 Liberar</button>' : '') +
            '<button class="btn btn--sm' + (susp ? '' : ' btn--peligro') + '" data-acc="al-estado" data-num="' + a.numero + '" type="button">' + (susp ? 'Reactivar' : 'Suspender') + '</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="nota">«Código 1 min» sirve para activar un dispositivo: el alumno escribe su N.º miru y el código antes de que venza. Si lo activa en otro, el anterior se cierra solo. «Liberar» cierra su dispositivo actual sin darle uno nuevo.</p>';
    },

    mostrarCodigo(raiz, c) {
      const el = raiz.querySelector('[data-codigo]'); if (!el) return;
      clearInterval(A._reloj);
      const fin = new Date(c.expira).getTime();
      const msj = 'miru · Tu número: ' + c.alumno.codigo + ' · Tu código: ' + c.codigo + ' (vence en 1 minuto). Abre miru, escribe ambos y pulsa Activar.';
      el.innerHTML = '<div class="codigoCaja" role="status"><p>Para <strong>' + U.esc(c.alumno.nombre) + '</strong> · ' + U.esc(c.alumno.codigo) + '</p>' +
        '<p class="codigo-grande">' + U.esc(c.codigo) + '</p><p class="nota" data-quedan></p>' +
        '<div class="tira"><button class="btn btn--sm" data-acc="copiar-codigo" type="button">📋 Copiar mensaje</button></div></div>';
      el.querySelector('[data-acc="copiar-codigo"]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(msj); MIRU.ui.aviso('Mensaje copiado.'); } catch (e) { MIRU.ui.aviso(U.esc(msj), 'info', 15000); }
      });
      const q = el.querySelector('[data-quedan]');
      const tic = () => {
        if (!document.body.contains(q)) { clearInterval(A._reloj); return; }
        const s = Math.round((fin - Date.now()) / 1000);
        if (s <= 0) { clearInterval(A._reloj); q.textContent = 'Venció. Si no alcanzó, genera otro.'; el.querySelector('.codigo-grande').classList.add('codigo-vencido'); return; }
        q.textContent = 'Vence en ' + U.reloj(s * 1000) + ' · un solo uso';
      };
      tic(); A._reloj = setInterval(tic, 500);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    activarAlumnos(raiz) {
      A.cargarAlumnos(raiz);
      const lla = async (fn, args, ok) => {
        try { const r = await AL().rpcAdmin(fn, args); if (ok) ok(r); await A.cargarAlumnos(raiz); return r; }
        catch (e) { MIRU.ui.aviso(U.esc(e.message), 'mal'); return null; }
      };
      const f = raiz.querySelector('[data-form="alumno"]');
      if (f) f.addEventListener('submit', async e => {
        e.preventDefault();
        const nombre = f.nombre.value.trim();
        if (!nombre) { MIRU.ui.aviso('Escribe el nombre del alumno.', 'mal'); return; }
        const r = await lla('admin_crear_alumno', { p_nombre: nombre, p_codigo_universitario: f.cu.value.trim() || null, p_curso: CFG.curso || 'cir1', p_hasta: f.hasta.value || null, p_origen: f.origen.value });
        if (r) { MIRU.ui.aviso('Creado: <strong>' + U.esc(r.codigo) + '</strong> · ' + U.esc(r.nombre)); f.reset(); f.hasta.value = enDias(120); }
      });
      U.on(raiz, 'click', '[data-acc="admin-salir"]', async () => { await AL().salirAdmin(); MIRU.app.enrutar(); });
      U.on(raiz, 'click', '[data-acc^="al-"]', async function (e, b) {
        const num = +b.dataset.num;
        const a = (A._alumnos || []).find(x => x.numero === num) || { codigo: 'MIRU-' + num, nombre: '' };
        switch (b.dataset.acc) {
          case 'al-codigo': {
            b.disabled = true;
            try { A.mostrarCodigo(raiz, await AL().generarCodigo(num)); }
            catch (err) { MIRU.ui.aviso(U.esc(err.message), 'mal'); }
            b.disabled = false; break;
          }
          case 'al-acceso': {
            const c = (a.cursos || []).find(x => x.curso === (CFG.curso || 'cir1'));
            const v = await MIRU.ui.pedirTexto('Acceso de ' + a.codigo, 'Fecha final del acceso a Cirugía I para ' + a.nombre + '.', c && c.hasta >= enDias(0) ? c.hasta : enDias(120), 'date');
            if (!v) return;
            await lla('admin_habilitar_curso', { p_numero: num, p_curso: CFG.curso || 'cir1', p_hasta: v, p_origen: c ? c.origen : 'pago' }, () => MIRU.ui.aviso('Acceso hasta el ' + diaLocal(v) + '.'));
            break;
          }
          case 'al-liberar':
            MIRU.ui.confirmar('¿Liberar el dispositivo de ' + a.nombre + '?', 'Ese dispositivo se cierra la próxima vez que abra miru con internet. Para entrar de nuevo necesitará un código.', 'Liberar',
              () => lla('admin_liberar_dispositivo', { p_numero: num }, () => MIRU.ui.aviso('Dispositivo liberado.')));
            break;
          case 'al-estado': {
            const susp = a.estado === 'activo';
            MIRU.ui.confirmar(susp ? '¿Suspender a ' + a.nombre + '?' : '¿Reactivar a ' + a.nombre + '?',
              susp ? 'Se cierra su dispositivo y no podrá activar otro hasta que lo reactives. Su progreso se conserva.' : 'Podrá activar un dispositivo con un código nuevo.',
              susp ? 'Suspender' : 'Reactivar',
              () => lla('admin_estado_alumno', { p_numero: num, p_estado: susp ? 'suspendido' : 'activo' }));
            break;
          }
        }
      });
      U.on(raiz, 'click', '[data-acc="errores-servidor"]', async function (e, b) {
        const el = raiz.querySelector('[data-res-servidor]');
        b.disabled = true; el.innerHTML = '<p class="nota">Calculando…</p>';
        try {
          const d = await AL().rpcAdmin('admin_errores', { p_curso: CFG.curso || 'cir1' });
          const r = A.resumir(d.preguntas || [], {}, d.alumnos);
          A._ultimo = r;
          el.innerHTML = (d.preguntas || []).length ? A.htmlResultados(r, 'alumnos con progreso sincronizado') : '<p class="nota">Todavía no hay progreso sincronizado.</p>';
        } catch (err) { el.innerHTML = '<p class="nota">⚠️ ' + U.esc(err.message) + '</p>'; }
        b.disabled = false;
      });
      const bit = raiz.querySelector('[data-bitacora]');
      if (bit) bit.addEventListener('toggle', async () => {
        if (!bit.open) return;
        const el = bit.querySelector('[data-bit]');
        try {
          const l = await AL().rpcAdmin('admin_bitacora', { p_limite: 60 });
          const nombres = { crear_alumno: 'Creó alumno', editar_alumno: 'Editó alumno', habilitar_curso: 'Habilitó acceso', quitar_curso: 'Quitó acceso',
            generar_codigo: 'Generó código', liberar_dispositivo: 'Liberó dispositivo', estado_alumno: 'Cambió estado', sugerencia: 'Actualizó sugerencia' };
          el.innerHTML = l.length ? '<ul class="respaldos">' + l.map(x => '<li><span>' + U.fechaCorta(x.creado_en) + ' · ' + U.esc(nombres[x.accion] || x.accion) +
            (x.detalle && x.detalle.numero ? ' · MIRU-' + String(x.detalle.numero).padStart(4, '0') : '') +
            (x.accion === 'sugerencia' && x.detalle && x.detalle.id ? ' · n.º ' + x.detalle.id : '') +
            (x.detalle && x.detalle.hasta ? ' · hasta ' + diaLocal(x.detalle.hasta) : '') + (x.detalle && x.detalle.estado ? ' · ' + U.esc(x.detalle.estado) : '') + '</span></li>').join('') + '</ul>'
            : '<p class="nota">Sin acciones todavía.</p>';
        } catch (err) { el.innerHTML = '<p class="nota">⚠️ ' + U.esc(err.message) + '</p>'; }
      });
    }
  };

})(window);
