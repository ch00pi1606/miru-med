/* =========================================================================
   miru · ÍCONOS — trazos de línea (24 × 24) que reemplazan a los emojis.
   · MIRU.icono('reloj') devuelve el <svg> listo para insertar.
   · Los emojis de la interfaz (🔁, ⏱, 📊…) se cambian solos por su ícono
     cuando aparecen en pantalla, también en el contenido y en los avisos.
     Los que no están en la tabla se quedan como están.
   ========================================================================= */
(function (global) {
  'use strict';
  const MIRU = global.MIRU = global.MIRU || {};

  const T = {
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    libro: '<path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    reloj: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.6M9.5 3h5"/>',
    repetir: '<path d="M4 11.5V10a4 4 0 0 1 4-4h11.5"/><path d="M16.5 3l3 3-3 3"/><path d="M20 12.5V14a4 4 0 0 1-4 4H4.5"/><path d="M7.5 21l-3-3 3-3"/>',
    tarjetas: '<rect x="3" y="7.5" width="13" height="13" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V15"/>',
    grafico: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    persona: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    herramienta: '<path d="M14.6 5.2a4.2 4.2 0 0 0-5.3 5.4L3.8 16.1a1.9 1.9 0 0 0 2.7 2.7l5.5-5.5a4.2 4.2 0 0 0 5.4-5.3l-2.6 2.6-2.4-.4-.4-2.4z"/>',
    pasos: '<path d="M3.5 19.5h5v-5h5v-5h5v-5h2"/>',
    lapiz: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    microfono: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    caja: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    estetoscopio: '<path d="M5.5 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M9.5 12.5v2a4.5 4.5 0 0 0 9 0v-2"/><circle cx="18.5" cy="10.5" r="2"/>',
    diana: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    chispa: '<path d="M11 4l1.8 5.2L18 11l-5.2 1.8L11 18l-1.8-5.2L4 11l5.2-1.8z"/><path d="M18.5 3.5v3.5M16.8 5.2h3.5"/>',
    bombilla: '<path d="M9.5 17.5h5M10.3 21h3.4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v1.7h5.2v-1.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    libros: '<rect x="3.5" y="4.5" width="4" height="15" rx="1"/><rect x="9.5" y="4.5" width="4" height="15" rx="1"/><path d="M15.6 5.8l3.4-.9 3 13.5-3.4.9z"/>',
    ancla: '<circle cx="12" cy="5.5" r="2"/><path d="M12 7.5V21M8 11h8M4.5 13.5a7.5 7.5 0 0 0 15 0"/>',
    lista: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M4 6.5l1.2 1.2L7.5 5.4M4 12l1.2 1.2 2.3-2.3M4 17.5l1.2 1.2 2.3-2.3"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    matraz: '<path d="M9.5 3.5h5M10.5 3.5v5.2L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5.5-9.3V3.5"/><path d="M7.4 14.5h9.2"/>',
    alerta: '<path d="M10.3 4.3L3 17a2 2 0 0 0 1.7 3h14.6A2 2 0 0 0 21 17L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17h.01"/>',
    balanza: '<path d="M12 4v16M7.5 20h9M5 7h14"/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
    birrete: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4c1.5 1.4 3.5 2.1 5.5 2.1s4-.7 5.5-2.1v-4M21.5 9.5v5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16 9.7"/>',
    visto: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    xcirculo: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    refrescar: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v5h-5"/>',
    descargar: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    subir: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    guardar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8.5 4v4.5h6V4M8.5 20v-6h7v6"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    brujula: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    llave: '<circle cx="7.5" cy="15.5" r="4"/><path d="M10.4 12.6L20 3M16 7l3 3M13.5 9.5l2 2"/>',
    movilOff: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M3 3l18 18"/>',
    portapapeles: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 3.5h6v3H9zM9 11.5h6M9 15.5h4"/>',
    nube: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6 3.8 3.8 0 0 1-.3 7.4z"/>',
    arena: '<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M8 3.5c0 4.5 8 4 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4-8 8.5s8 4 8 8.5"/>',
    sinRed: '<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.8 15.4a5 5 0 0 1 6.4 0"/><path d="M12 19h.01M3 3l18 18"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    carpeta: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    dado: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.6"/>',
    duda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"/>',
    cara: '<circle cx="12" cy="12" r="9"/><path d="M9 15.5h6M9.5 10h.01M14.5 10h.01" />',
    mas: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    atras: '<path d="M15 5l-7 7 7 7"/>',
    abajo: '<path d="M6 9l6 6 6-6"/>',
    burbuja: '<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5z"/><path d="M8 10h8M8 13h5"/>',
    enviar: '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    bandera: '<path d="M6 21V4M6 4h11l-2.2 4.2L17 12.5H6"/>',
    cuadricula: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
    cruz: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
    cinta: '<path d="M12 3.5a3.3 3.3 0 0 0-3.3 3.3c0 2.5 3.3 6.2 3.3 6.2s3.3-3.7 3.3-6.2A3.3 3.3 0 0 0 12 3.5z"/><path d="M10.2 12.4L6.5 20.5M13.8 12.4l3.7 8.1"/>',
    aire: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 15h14a3 3 0 1 1-3 3"/>',
    hueso: '<path d="M8.2 15.8l7.6-7.6"/><circle cx="6.4" cy="15.2" r="1.9"/><circle cx="8.8" cy="17.6" r="1.9"/><circle cx="15.2" cy="6.4" r="1.9"/><circle cx="17.6" cy="8.8" r="1.9"/>',
    nino: '<circle cx="12" cy="12" r="8"/><path d="M9 14.2c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4M9.5 10h.01M14.5 10h.01"/>',
    bandeja: '<path d="M3.5 13.5l2.6-7.3A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.2l2.6 7.3V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5"/>',
    archivo: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2"/><path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>'
  };

  /** <svg> de un ícono. extra: clases adicionales. */
  function icono(nombre, extra) {
    const d = T[nombre];
    if (!d) return '';
    return '<svg class="ico' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  MIRU.icono = icono;
  MIRU.iconos = T;

  /* ------------------------------------------- emojis de la interfaz → ícono */
  const EMOJI = {
    '👩‍⚕️': 'estetoscopio', '🗓': 'calendario', '📅': 'calendario', '⏱': 'reloj', '🔁': 'repetir', '🎴': 'tarjetas',
    '📊': 'grafico', '👤': 'persona', '🛠': 'herramienta', '👣': 'pasos', '📝': 'lapiz', '🎤': 'microfono', '📦': 'caja',
    '🩺': 'estetoscopio', '🎯': 'diana', '🔗': 'enlace', '🧠': 'chispa', '💡': 'bombilla', '📚': 'libros', '⚓': 'ancla',
    '📐': 'lista', '📘': 'libro', '🔎': 'lupa', '🔬': 'matraz', '⚠️': 'alerta', '⚠': 'alerta', '🚨': 'alerta', '⚖️': 'balanza',
    '⚖': 'balanza', '🎓': 'birrete', '🎉': 'check', '✅': 'check', '❌': 'xcirculo', '↻': 'refrescar', '⬇': 'descargar',
    '⬆': 'subir', '💾': 'guardar', '☀️': 'sol', '☀': 'sol', '🌙': 'luna', '🖥': 'monitor', '🧭': 'brujula', '🔑': 'llave',
    '📵': 'movilOff', '📋': 'portapapeles', '☁️': 'nube', '☁': 'nube', '⏳': 'arena', '📴': 'sinRed', '🔒': 'candado',
    '🗂️': 'carpeta', '🗂': 'carpeta', '📁': 'carpeta', '🎲': 'dado', '🤔': 'duda', '😕': 'cara', '💉': 'aire', '🦴': 'hueso',
    '🧸': 'nino', '♡': '', '❤️': '', '💬': 'burbuja'
  };
  const TONO = { alerta: 'ico--aviso', check: 'ico--ok', xcirculo: 'ico--mal' };
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = new RegExp('(?:' + Object.keys(EMOJI).sort((a, b) => b.length - a.length).map(escRe).join('|') + ')\\uFE0F?[ \\u00A0]?', 'g');
  const SALTAR = { TEXTAREA: 1, INPUT: 1, SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, OPTION: 1, SELECT: 1, TITLE: 1 };

  function htmlDe(texto) {
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let h = '', ult = 0;
    texto.replace(RE, (m, pos) => {
      h += esc(texto.slice(ult, pos));
      const base = m.replace(/️/g, '').replace(/[  ]$/, '');
      const nombre = EMOJI[base] != null ? EMOJI[base] : EMOJI[base + '️'];
      if (nombre) h += icono(nombre, TONO[nombre]) + (/[  ]$/.test(m) ? ' ' : '');
      ult = pos + m.length;
      return m;
    });
    return h + esc(texto.slice(ult));
  }

  function dentroDeSaltar(n) {
    for (let p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (SALTAR[p.nodeName] || p.namespaceURI === 'http://www.w3.org/2000/svg') return true;
    }
    return false;
  }

  function cambiarTexto(n) {
    if (!n.nodeValue || !RE.test(n.nodeValue)) { RE.lastIndex = 0; return; }
    RE.lastIndex = 0;
    if (dentroDeSaltar(n)) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = htmlDe(n.nodeValue);
    if (n.parentNode) n.parentNode.replaceChild(tpl.content, n);
  }

  /** Reemplaza los emojis conocidos dentro de un nodo (y sus hijos). */
  function limpiar(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { cambiarTexto(raiz); return; }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
    if (SALTAR[raiz.nodeName]) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null);
    const lista = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (RE.test(n.nodeValue)) lista.push(n); RE.lastIndex = 0; }
    lista.forEach(cambiarTexto);
  }
  MIRU.limpiarEmojis = limpiar;

  function vigilar() {
    if (!global.MutationObserver || !document.body) return;
    limpiar(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'characterData') { cambiarTexto(m.target); return; }
      m.addedNodes.forEach(limpiar);
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar);
    else vigilar();
  }

})(typeof window !== 'undefined' ? window : globalThis);
