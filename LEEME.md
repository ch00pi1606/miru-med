# miru · carpeta de publicación

Versión del contenido: **2026.10.29-1** (2026-10-29).

Versión plana: todos los archivos van sueltos, sin carpetas. Sube TODOS los archivos de esta carpeta a la raíz de tu repositorio de GitHub y activa GitHub Pages (Settings → Pages → rama main, carpeta /root).

El contenido viaja cifrado en `paquete.js`. Cada alumno lo abre con su número miru y un código de un minuto que genera la administradora; ella entra con su usuario y contraseña. La llave vive en Supabase (`llave-supabase.sql`, que NO se sube).

Antes de usarla, abre `config.js` y pega en `url` y `clavePublica` los datos de tu proyecto de Supabase (Project Settings → API). Nunca pongas ahí la secret key ni la service_role.
