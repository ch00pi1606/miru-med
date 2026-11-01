/* =========================================================================
   miru · service worker — funciona sin internet una vez abierta
   · Código y contenido: primero la red (para recibir actualizaciones) y, si
     no hay conexión, la copia guardada.
   · Íconos e imágenes: primero la copia guardada.
   La herramienta de construcción reemplaza VERSION en cada publicación.
   ========================================================================= */
const VERSION = 'miru-2026.11.01-1';
const BASICOS = [
  './', './index.html', './manifest.webmanifest',
  'miru.css',
  'config.js',
  'nucleo.js', 'iconos.js', 'fuentes.js', 'formato.js',
  'progreso.js', 'almacen.js', 'contenido.js',
  'ui.js', 'preguntas.js', 'pasitos.js',
  'evaluacion.js', 'flashcards.js', 'esquemas.js',
  'casos.js', 'oral.js', 'laminas.js',
  'vistas.js', 'sugerencias.js', 'admin.js', 'app.js',
  'paquete.js',
  'miru-180.png', 'miru-192.png', 'miru-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;   // Supabase y enlaces externos: sin caché
  const estatico = /\.(woff2|png|svg|webp|jpg)$/.test(url.pathname);
  if (estatico) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); return res; })));
    return;
  }
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
