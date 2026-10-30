/* =========================================================================
   miru · SIMULACRO ORAL (Oncología) — tomado del módulo «Cirugía I»
   ========================================================================= */
(function (global) {
  'use strict';
  const CIRUGIA = global.MIRU;
  const U = CIRUGIA.util;

  /* ------------------------------------------------------------------ ORAL */
  const PASOS_ORAL = [
    { t: '¿De qué célula viene y dónde está?', d: 'Histología de origen y localización. De ahí sale el nombre del tumor y buena parte de su comportamiento.' },
    { t: '¿Por dónde se escapa?', d: 'Las tres rutas: local por contigüidad, linfática siguiendo la arteria, hematógena siguiendo el drenaje venoso. Añade la transcelómica si corresponde.' },
    { t: '¿Cómo se presenta y por qué así?', d: 'Manifestaciones clínicas deducidas del mecanismo, no memorizadas.' },
    { t: '¿Cómo lo diagnostico, en qué orden?', d: 'Sospecha → confirmación histológica → estadificación por imagen → comité multidisciplinario.' },
    { t: '¿Cómo lo estadifico y qué cambia con el estadio?', d: 'Lógica de T, N y M. Qué decisión terapéutica cambia en cada escenario.' },
    { t: '¿Es resecable? ¿Es operable?', d: 'Resecabilidad = pregunta sobre el tumor. Operabilidad = pregunta sobre el paciente. Sepáralas explícitamente.' },
    { t: '¿Qué operación, qué ganglios, qué margen, qué estructuras arriesgo?', d: 'Cuánto órgano, qué linfadenectomía y por qué esa, cómo reconstruyo, qué puedo lesionar.' },
    { t: '¿Qué puede salir mal y cuándo?', d: 'Intraoperatorias, precoces y tardías o funcionales.' }
  ];

  CIRUGIA.oral = {
    pasos: PASOS_ORAL,

    montar(cont, cfg) {
      const candidatos = cfg.temas || [];
      if (!candidatos.length) {
        cont.innerHTML = '<div class="vacio"><div class="vacio__ic">🎤</div><p>No hay temas disponibles para el simulacro.</p></div>';
        return;
      }
      let elegido = null, paso = 0, t0 = 0, cron = null, marcas = [];

      function inicio() {
        cont.innerHTML =
          '<div class="tj">' +
          '<h3>🎤 Simulacro de examen oral</h3>' +
          '<p>Se elige un tema al azar. Recorre en voz alta los ocho pasos del razonamiento oncoquirúrgico, sin material delante. ' +
          'Marca cada paso como <em>fluido</em> o <em>dudé</em>. El objetivo es tardar menos de tres minutos.</p>' +
          '<div class="tira" style="margin-top:16px">' +
          '<button class="btn btn--pri" data-acc="azar" type="button">🎲 Tema al azar</button>' +
          '<select class="btn" data-sel="tema" style="max-width:290px">' +
          '<option value="">— o elige un tema —</option>' +
          candidatos.map((c, k) => '<option value="' + k + '">' + U.esc(c.tema.nombre) + '</option>').join('') +
          '</select></div></div>' +
          historial();
        cont.querySelector('[data-acc="azar"]').addEventListener('click', () => empezar(candidatos[Math.floor(Math.random() * candidatos.length)]));
        cont.querySelector('[data-sel="tema"]').addEventListener('change', e => {
          if (e.target.value !== '') empezar(candidatos[+e.target.value]);
        });
      }

      function empezar(c) {
        elegido = c; paso = 0; marcas = []; t0 = Date.now();
        clearInterval(cron);
        pintar();
        cron = setInterval(() => {
          const el = cont.querySelector('[data-crono]');
          if (!el) { clearInterval(cron); return; }
          const s = Math.floor((Date.now() - t0) / 1000);
          el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
          el.style.color = s > 180 ? 'var(--bad)' : '';
        }, 1000);
      }

      function pintar() {
        const p = PASOS_ORAL[paso];
        if (!p) { fin(); return; }
        cont.innerHTML =
          '<div class="tj">' +
          '<div class="fc__prog">' +
          '<span><strong>' + elegido.tema.nombre + '</strong></span>' +
          U.barra(Math.round(paso / PASOS_ORAL.length * 100)) +
          '<span style="font-variant-numeric:tabular-nums;font-weight:700" data-crono>00:00</span></div>' +
          '</div>' +
          '<div class="tj">' +
          '<div class="nota">Paso ' + (paso + 1) + ' de ' + PASOS_ORAL.length + '</div>' +
          '<h3 style="margin:6px 0 10px">' + U.esc(p.t) + '</h3>' +
          '<p class="nota">' + U.esc(p.d) + '</p>' +
          '<p style="margin-top:16px;font-weight:600">Respóndelo en voz alta y después marca cómo te salió.</p>' +
          '<div class="tira">' +
          '<button class="btn btn--pri" data-m="fluido" type="button">✓ Salió fluido</button>' +
          '<button class="btn" data-m="dude" type="button">🤔 Dudé</button>' +
          '<button class="btn" data-m="no" type="button">✗ No supe</button>' +
          '</div></div>';
        cont.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
          marcas.push({ paso: p.t, r: b.dataset.m }); paso++; pintar();
        }));
      }

      function fin() {
        clearInterval(cron);
        const s = Math.floor((Date.now() - t0) / 1000);
        const flu = marcas.filter(m => m.r === 'fluido').length;
        const flojos = marcas.filter(m => m.r !== 'fluido');
        CIRUGIA.progreso.guardarOral({
          temaId: elegido.tema.id, temaNombre: elegido.tema.nombre, fecha: Date.now(),
          segundos: s, fluidos: flu, total: PASOS_ORAL.length
        });
        cont.innerHTML =
          '<div class="tj" style="text-align:center">' +
          '<div style="font-size:2.2rem">🎤</div>' +
          '<h3>' + U.esc(elegido.tema.nombre) + '</h3>' +
          '<p><strong>' + flu + '</strong> de ' + PASOS_ORAL.length + ' pasos fluidos · ' +
          '<strong>' + Math.floor(s / 60) + ' min ' + (s % 60) + ' s</strong>' +
          (s <= 180 ? ' <span class="eti eti--ok">Dentro de los 3 minutos</span>' : ' <span class="eti eti--bad">Por encima de 3 minutos</span>') +
          '</p></div>' +
          (flojos.length
            ? '<div class="tj"><h4>Pasos que debes repasar</h4><ul>' +
              flojos.map(m => '<li>' + U.esc(m.paso) + ' <span class="eti eti--' + (m.r === 'no' ? 'bad' : 'neu') + '">' +
                (m.r === 'no' ? 'No supe' : 'Dudé') + '</span></li>').join('') + '</ul>' +
              '<p class="nota">Vuelve al tema y reconstruye estos puntos antes de repetir el simulacro.</p></div>'
            : '<div class="tj"><p>Ningún paso flojo. Puedes defender este tema.</p></div>') +
          '<div class="tira">' +
          '<button class="btn btn--pri" data-acc="otro" type="button">🎲 Otro tema</button>' +
          '<button class="btn" data-acc="ir" type="button">Ir al tema</button>' +
          '</div>';
        cont.querySelector('[data-acc="otro"]').addEventListener('click', inicio);
        cont.querySelector('[data-acc="ir"]').addEventListener('click', () => {
          location.hash = '#/tema/' + elegido.clase.modulo + '/' + elegido.clase.id + '/' + elegido.tema.id;
        });
      }

      function historial() {
        const h = CIRUGIA.progreso.orales().slice(0, 6);
        if (!h.length) return '';
        return '<div class="tj"><h4>Últimos simulacros</h4><div class="tablaWrap"><table class="t"><thead><tr>' +
          '<th>Tema</th><th>Fluidos</th><th>Tiempo</th><th>Fecha</th></tr></thead><tbody>' +
          h.map(x => '<tr><td>' + U.esc(x.temaNombre || '—') + '</td><td>' + x.fluidos + '/' + x.total + '</td><td>' +
            Math.floor(x.segundos / 60) + ':' + String(x.segundos % 60).padStart(2, '0') + '</td><td>' +
            U.fecha(x.fecha) + '</td></tr>').join('') + '</tbody></table></div></div>';
      }

      inicio();
    }
  };

})(window);
