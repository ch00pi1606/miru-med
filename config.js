/* =========================================================================
   miru · CONFIGURACIÓN
   Es el único archivo que hay que tocar para cambiar de modo.
   No pongas aquí contraseñas ni la clave «service_role» de Supabase: este
   archivo lo descarga el navegador y cualquiera puede leerlo.
   ========================================================================= */
window.MIRU_CONFIG = {

  /* Cómo se carga el contenido:
       'abierto'  carpeta de trabajo (contenido/indice.js, sin cifrar)
       'cifrado'  publicación (paquete.js, se abre con código)
     La herramienta de construcción lo cambia sola en la carpeta publicar/. */
  contenido: 'cifrado',

  /* Dónde se guarda el progreso y cómo se entra:
       'local'     solo en este navegador, por perfil. Admin con PIN.
       'supabase'  alumnos con número miru + código de 1 minuto (un
                   dispositivo a la vez); administradora con usuario y
                   contraseña; el progreso se sincroniza con su cuenta.     */
  modo: 'supabase',

  /* Solo para modo 'supabase' (Supabase → Project Settings → API Keys).
       url           https://xxxxxxxx.supabase.co
       clavePublica  la «Publishable key» (sb_publishable_…) o, en
                     proyectos antiguos, la «anon public». Es pública por
                     diseño: lo que protege los datos son las reglas del SQL. */
  supabase: {
    url: '',            // ← pega aquí la Project URL (https://xxxxxxxx.supabase.co)
    clavePublica: ''    // ← pega aquí la Publishable key (sb_publishable_…)
  },

  /* Curso que abre esta publicación (tabla public.cursos). */
  curso: 'cir1',

  /* PIN del modo administrador en modo 'local'. Es una comodidad, no un
     candado. En modo 'supabase' no se usa. */
  pinAdmin: '2026',

  /* Segundos de espera antes de enviar cambios al servidor. */
  esperaSincronizacion: 3
};
