/* =========================================================================
   miru · CONTENIDO — carga, versión, novedades y cifrado
   Dos formas de cargar el contenido (config.js → contenido):
     'abierto'  Desarrollo. contenido/indice.js enumera los archivos .js de
                contenido y se cargan uno a uno.
     'cifrado'  Publicación. paquete.js trae TODO el contenido
                comprimido y cifrado (AES-GCM). Sin la llave no se puede leer.
   El contenido nunca escribe en el progreso.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU;
  const U = MIRU.util;
  const CFG = global.MIRU_CONFIG || {};
  const CLAVE_VISTO = 'miru.v1.contenidoVisto';

  const C = MIRU.contenido = {
    version: null,
    fecha: null,
    novedades: [],
    nuevas: [],          // novedades que este navegador aún no había visto

    /* ------------------------------------------------------------ carga */
    async cargar() {
      if (CFG.contenido === 'cifrado') await cargarCifrado();
      else await cargarAbierto();
      registrarNovedades();
    }
  };

  /* ---------- modo abierto ---------- */
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => ok();
      s.onerror = () => mal(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function cargarAbierto() {
    const ind = global.MIRU_INDICE;
    if (!ind) throw new Error('Falta contenido/indice.js');
    C.version = ind.version; C.fecha = ind.fecha; C.novedades = ind.novedades || [];
    for (const a of ind.archivos) await cargarScript(a);
    C.prepararBanco();
  }

  /** Lleva todas las preguntas al banco único. Se usa en modo abierto y al
      construir el paquete (en el paquete ya viajan preparadas). */
  C.prepararBanco = function () {
    const informe = { simulador: {}, modulo: null };
    const mapa = MIRU.mapaSimulador || {};
    Object.keys(mapa).forEach(esp => { informe.simulador[esp] = MIRU.formato.cargarBancoSimulador(esp, mapa[esp]); });
    informe.modulo = MIRU.formato.cargarPreguntasDeClases();
    C.informeBanco = informe;
    return informe;
  };

  /* ---------- modo cifrado ---------- */
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder();

  function normalizarCodigo(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  async function derivarKEK(codigo, sal, iteraciones) {
    const base = await crypto.subtle.importKey('raw', enc.encode(normalizarCodigo(codigo)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(sal), iterations: iteraciones, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }

  /** Intenta abrir la llave del contenido con un código. */
  async function llaveConCodigo(paq, codigo) {
    for (const w of paq.llaves || []) {
      try {
        const kek = await derivarKEK(codigo, w.sal, w.it);
        const crudo = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(w.iv) }, kek, b64(w.envuelta));
        return crudo;   // ArrayBuffer de 32 bytes
      } catch (e) { /* este código no abre esta envoltura */ }
    }
    return null;
  }

  async function importarLlave(crudo) {
    return crypto.subtle.importKey('raw', crudo, { name: 'AES-GCM' }, false, ['decrypt']);
  }

  async function guardarLlave(llave, idLlave) {
    try {
      const d = await MIRU.db();
      await new Promise((ok, mal) => {
        const tx = d.transaction('llaves', 'readwrite');
        tx.objectStore('llaves').put({ llave, idLlave, ts: Date.now() }, 'contenido');
        tx.oncomplete = ok; tx.onerror = () => mal(tx.error);
      });
    } catch (e) { /* sin IndexedDB: se pedirá el código en cada apertura */ }
  }
  async function leerLlave() {
    try {
      const d = await MIRU.db();
      return await new Promise((ok) => {
        const req = d.transaction('llaves', 'readonly').objectStore('llaves').get('contenido');
        req.onsuccess = () => ok(req.result || null); req.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  C.olvidarLlave = async function () {
    try {
      const d = await MIRU.db();
      await new Promise(ok => {      // se espera al final: a veces se recarga la página justo después
        const tx = d.transaction('llaves', 'readwrite');
        tx.objectStore('llaves').delete('contenido');
        tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
      });
    } catch (e) {}
  };

  async function descifrar(paq, llave) {
    const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(paq.iv) }, llave, b64(paq.datos));
    let texto;
    if (paq.comprimido) {
      if (!global.DecompressionStream) throw new Error('Tu navegador es demasiado antiguo para abrir miru. Actualízalo.');
      const st = new Blob([datos]).stream().pipeThrough(new DecompressionStream('gzip'));
      texto = await new Response(st).text();
    } else {
      texto = new TextDecoder().decode(datos);
    }
    return JSON.parse(texto);
  }

  async function cargarCifrado() {
    const paq = global.MIRU_PAQUETE;
    if (!paq) throw new Error('Falta paquete.js');
    C.version = paq.version; C.fecha = paq.fecha; C.novedades = paq.novedades || [];
    C.idLlave = paq.idLlave;
    if (!global.crypto || !crypto.subtle) throw new Error('Este navegador no permite abrir contenido cifrado. Ábrelo desde el enlace (https).');

    let guardada = await leerLlave();
    let llave = guardada && guardada.idLlave === paq.idLlave ? guardada.llave : null;

    if (llave) {
      try { MIRU.importarDatos(await descifrar(paq, llave)); return; }
      catch (e) { llave = null; }
    }
    // Con Supabase, un dispositivo ya ligado (o la administradora) recibe la
    // llave del servidor sin volver a pedir código (p. ej., si cambió la llave).
    let crudo = null;
    if (CFG.modo === 'supabase' && MIRU.almacen && MIRU.almacen.recuperarLlave) {
      try { crudo = await MIRU.almacen.recuperarLlave(paq.idLlave); } catch (e) { crudo = null; }
    }
    // Hay que activar: código de prueba (o, con Supabase, número miru + código de 1 minuto)
    if (!crudo) crudo = await pedirCodigo(paq);
    llave = await importarLlave(crudo);
    await guardarLlave(llave, paq.idLlave);
    MIRU.importarDatos(await descifrar(paq, llave));
  }

  /** Pantalla de activación. Resuelve con la llave cruda. */
  function pedirCodigo(paq) {
    if (CFG.modo === 'supabase' && MIRU.almacen && MIRU.almacen.pantallaAcceso) {
      return MIRU.almacen.pantallaAcceso({ idLlave: paq.idLlave });
    }
    return new Promise(resolve => {
      const v = document.createElement('div');
      v.className = 'acceso';
      v.innerHTML =
        '<form class="acceso__caja" novalidate>' +
        '<div class="acceso__marca"><span class="acceso__logo" aria-hidden="true">miru</span>' +
        '<h1>Activa miru en este dispositivo</h1>' +
        '<p>Escribe el código de acceso que te dieron. Solo se pide una vez: después funciona sin internet.</p></div>' +
        '<label class="acceso__lbl" for="accCodigo">Código de acceso</label>' +
        '<input class="acceso__in" id="accCodigo" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="Ej.: MIRU-PRUEBA-…">' +
        '<div class="acceso__msg" role="alert"></div>' +
        '<button class="btn btn--pri acceso__enviar" type="submit">Activar</button>' +
        '<p class="acceso__pie">Si cambias de celular o borras los datos del navegador, tendrás que pedir otro código.</p>' +
        '</form>';
      document.body.appendChild(v);
      document.body.classList.add('conAcceso');
      const f = v.querySelector('form'), inp = v.querySelector('input'), msg = v.querySelector('.acceso__msg'), btn = v.querySelector('button');
      setTimeout(() => inp.focus(), 50);
      f.addEventListener('submit', async e => {
        e.preventDefault();
        msg.className = 'acceso__msg'; msg.textContent = '';
        if (!normalizarCodigo(inp.value)) { msg.className = 'acceso__msg acceso__msg--bad'; msg.textContent = 'Escribe tu código.'; return; }
        btn.disabled = true; btn.textContent = 'Comprobando…';
        const crudo = await llaveConCodigo(paq, inp.value);
        if (!crudo) { msg.className = 'acceso__msg acceso__msg--bad'; msg.textContent = 'Ese código no es válido para esta versión de miru.'; }
        btn.disabled = false; btn.textContent = 'Activar';
        if (crudo) {
          v.remove(); document.body.classList.remove('conAcceso');
          resolve(crudo);
        }
      });
    });
  }

  /* ---------- novedades ---------- */
  function registrarNovedades() {
    let visto = null;
    try { visto = global.localStorage.getItem(CLAVE_VISTO); } catch (e) {}
    if (visto && visto !== C.version) {
      C.nuevas = C.novedades.slice();
      // Llegó contenido nuevo: respaldo del progreso por si acaso.
      if (MIRU.progreso && MIRU.progreso.perfilId()) MIRU.progreso.respaldar('llegó la versión ' + C.version + ' del contenido');
    }
    C.marcarVisto = function () { try { global.localStorage.setItem(CLAVE_VISTO, C.version); } catch (e) {} C.nuevas = []; };
    if (!visto) C.marcarVisto();
  }

  C.etiqueta = () => 'Contenido v' + (C.version || '—') + (C.fecha ? ' · ' + U.fecha(C.fecha) : '');

})(typeof window !== 'undefined' ? window : globalThis);
