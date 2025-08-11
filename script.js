/* =========================================================
  script.js — Vuelo PTY → MVD (Agustina ✈ Rodrigo)
  Arquitectura y trade-offs:
  - Dominio y UI separadas; el DOM solo se toca en la capa UI.
  - Fechas configurables desde HTML vía data-attributes (#flightData).
  - Progreso en vivo: mueve ✈ de 10% a 90% del track y sincroniza nombres.
  - Modo oscuro bordó con botón flotante (Boxicons) + persistencia.
  - Extras: mapa Leaflet con ruta, flip-clock suave, ding de estado, corazón al llegar.
  - Dependencias: AOS (opcional), Leaflet (mapa), Boxicons (íconos).
========================================================= */

/* ================================
   🧠 Dominio (clases y reglas)
================================ */
/**
 * Maneja lógica de vuelo (fechas, estados y progreso).
 */
class Vuelo {
  /**
   * @param {string} salidaMvd - ISO en zona Uruguay.
   * @param {string} salidaPty - ISO en zona Panamá.
   * @param {string} llegadaMvd - ISO en zona Uruguay.
   * @pre strings ISO válidos con offset de zona.
   */
  constructor(salidaMvd, salidaPty, llegadaMvd) {
    this.salidaMvd = new Date(salidaMvd);
    this.salidaPty = new Date(salidaPty);
    this.llegadaMvd = new Date(llegadaMvd);
  }

  /**
   * Milisegundos restantes hasta una fecha.
   * @param {Date} objetivo
   * @returns {number}
   */
  msHasta(objetivo) {
    return objetivo.getTime() - Date.now();
  }

  /**
   * Progreso 0..100 del tramo [salidaPty, llegadaMvd].
   * @returns {number}
   */
  progreso() {
    const total = this.llegadaMvd.getTime() - this.salidaPty.getTime();
    const trans = Date.now() - this.salidaPty.getTime();
    if (total <= 0) return 100;
    const pct = (trans / total) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }

  /**
   * Estado textual.
   * @returns {"Próximo"|"En vuelo"|"Llegó"}
   */
  estado() {
    const now = Date.now();
    if (now < this.salidaPty.getTime()) return "Próximo";
    if (now >= this.salidaPty.getTime() && now < this.llegadaMvd.getTime()) return "En vuelo";
    return "Llegó";
  }
}

/* ================================
   🖥️ UI (render y utilidades)
================================ */
/**
 * Convierte ms a {d,h,m,s} positivos.
 * @param {number} ms
 * @returns {{d:number,h:number,m:number,s:number}}
 */
function msADHMS(ms) {
  const seg = Math.max(Math.floor(ms / 1000), 0);
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return { d, h, m, s };
}

/**
 * Pinta un contador en el DOM.
 * @param {HTMLElement} contenedor
 * @param {{d:number,h:number,m:number,s:number}} t
 */
function renderContador(contenedor, t) {
  const spans = contenedor.querySelectorAll(".num");
  if (spans.length < 4) return;
  spans[0].textContent = t.d;
  spans[1].textContent = String(t.h).padStart(2, "0");
  spans[2].textContent = String(t.m).padStart(2, "0");
  spans[3].textContent = String(t.s).padStart(2, "0");
}

/**
 * Actualiza estado y barra de progreso.
 * @param {Vuelo} vuelo
 */
function renderEstado(vuelo) {
  const estadoEl = document.querySelector("#estadoVuelo");
  const progresoEl = document.querySelector("#progresoVuelo");
  if (!estadoEl || !progresoEl) return;

  const estado = vuelo.estado();
  estadoEl.textContent = estado;

  if (estado === "Próximo") {
    progresoEl.style.width = "0%";
  } else if (estado === "En vuelo") {
    progresoEl.style.width = vuelo.progreso().toFixed(2) + "%";
  } else {
    progresoEl.style.width = "100%";
  }
}

/**
 * Mueve el avión en el track según el progreso del vuelo.
 * - Queremos que el ✈ recorra de 10% a 90% del ancho (de PTY hacia MVD).
 * @param {number} progresoPct 0..100
 */
function renderAvion(progresoPct) {
  const planeEl = document.querySelector(".plane");
  if (!planeEl) return;

  const min = 10;
  const max = 90;
  const leftPct = min + (max - min) * (Math.max(0, Math.min(100, progresoPct)) / 100);

  planeEl.style.left = leftPct + "%";

  // Pequeña inclinación dinámica para darle vida
  const tilt = -2 + (leftPct - min) / (max - min) * 4; // -2° a +2°
  planeEl.style.transform = `translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg)`;

  // Sombra sutil (puede usar tu paleta si querés)
  planeEl.style.filter =
    `drop-shadow(0 8px 14px rgba(0,0,0,${0.15 + 0.15 * Math.sin((leftPct - min) / (max - min) * Math.PI)}))`;
}

/**
 * Mueve "Agustina" (izq) y "Rodrigo" (der) acercándose al centro según progreso.
 * - 0% => cerca de los bordes; 100% => cerca del centro.
 * - Trabajamos con left/right para mantener el layout original.
 * @param {number} progresoPct 0..100
 */
function renderNombres(progresoPct) {
  const agustinaEl = document.querySelector(".name-left");
  const rodrigoEl  = document.querySelector(".name-right");
  if (!agustinaEl || !rodrigoEl) return;

  const p = Math.max(0, Math.min(100, progresoPct)) / 100;

  // Agustina: de 12% a 45% (desde izquierda hacia el centro)
  const leftMin = 12, leftMax = 45;
  const leftPct = leftMin + (leftMax - leftMin) * p;
  agustinaEl.style.left = leftPct + "%";
  agustinaEl.style.transform = "translateY(-50%)";

  // Rodrigo: de 12% a 45% medido desde la derecha (entra hacia el centro)
  const rightMin = 12, rightMax = 45;
  const rightPct = rightMin + (rightMax - rightMin) * p;
  rodrigoEl.style.right = rightPct + "%";
  rodrigoEl.style.transform = "translateY(-50%)";
}

/* ================================
   🔊 Ding estilo aeropuerto
================================ */
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880; // ding agudo
    g.gain.value = 0.001; // volumen bajo
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.25);
    o.stop(ctx.currentTime + 0.26);
  } catch (_) {}
}

/* ================================
   ✨ Flip text helper (pantalla aeropuerto)
================================ */
/**
 * Reemplaza el texto con un micro efecto tipo "flip".
 * @param {HTMLElement} el - contenedor (puede envolver un <span>)
 * @param {string} text
 */
function flipUpdate(el, text){
  if(!el) return;
  let inner = el.querySelector('span');
  if(!inner){ inner = document.createElement('span'); el.textContent=''; el.appendChild(inner); }
  if(inner.textContent === text) return;
  el.classList.add('flip','update');
  inner.textContent = text;
  setTimeout(()=> el.classList.remove('update'), 380);
}

/* ================================
   🗺️ Leaflet helpers (mapa)
================================ */
const COORD_PTY = [9.071356, -79.383453];   // Tocumen Intl
const COORD_MVD = [-34.838417, -56.030806]; // Carrasco Intl

/** Interpolación lineal */
function lerp(a, b, t){ return a + (b - a) * t; }
function lerpLatLng([lat1,lng1],[lat2,lng2], t){
  return [ lerp(lat1, lat2, t), lerp(lng1, lng2, t) ];
}

/** Haversine (km) */
function haversineKm([lat1,lon1],[lat2,lon2]){
  const toRad = d=> d*Math.PI/180;
  const R=6371;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

/* ================================
   🚦 Gestión de eventos (UI)
================================ */
document.addEventListener("DOMContentLoaded", () => {
  // AOS (decorativo)
  if (window.AOS) AOS.init({ once: false, duration: 800, easing: "ease-out-cubic" });

  // ===== Botón modo oscuro (Boxicons) con persistencia =====
  const btnModo = document.querySelector('#toggle-modo');
  if (btnModo && btnModo.dataset.bound !== '1') {
    btnModo.dataset.bound = '1';
    const iconEl = btnModo.querySelector('i');

    const applyMode = (dark) => {
      document.body.classList.toggle('modo-oscuro', dark);
      if (iconEl) {
        iconEl.classList.toggle('bx-sun', dark);
        iconEl.classList.toggle('bx-moon', !dark);
      }
      try { localStorage.setItem('modoOscuro', dark ? '1' : '0'); } catch (_) {}
    };

    // Estado inicial
    let darkStart = false;
    try {
      const saved = localStorage.getItem('modoOscuro');
      if (saved === '1' || saved === '0') {
        darkStart = saved === '1';
      } else if (window.matchMedia) {
        darkStart = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (_) {}
    applyMode(darkStart);

    // Toggle
    btnModo.addEventListener('click', () => {
      applyMode(!document.body.classList.contains('modo-oscuro'));
    });
  }

  // ===== Datos desde HTML =====
  const flightDataEl = document.querySelector("#flightData");
  const salidaMvd = flightDataEl?.dataset?.departureMvd;
  const salidaPty = flightDataEl?.dataset?.departurePty;
  const llegadaMvd = flightDataEl?.dataset?.arrivalMvd;
  if (!salidaMvd || !salidaPty || !llegadaMvd) {
    console.warn("Faltan atributos data-* en #flightData");
    return;
  }

  // ===== Instancia del dominio =====
  const vuelo = new Vuelo(salidaMvd, salidaPty, llegadaMvd);

  // ===== Mapa Leaflet =====
  let map, planeMarker, line;
  if (window.L && document.getElementById('map')) {
    map = L.map('map', { zoomControl: false, attributionControl:false }).setView([ -10, -65 ], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 7 }).addTo(map);

    line = L.polyline([COORD_PTY, COORD_MVD], {
      color: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#d94f4f',
      weight: 3,
      opacity: 0.7,
      dashArray: '8,8'
    }).addTo(map);

    L.marker(COORD_PTY).addTo(map).bindTooltip('PTY · Tocumen');
    L.marker(COORD_MVD).addTo(map).bindTooltip('MVD · Carrasco');

    planeMarker = L.circleMarker(COORD_PTY, {
      radius: 6, color: '#fff', weight: 2, fillColor: '#d94f4f', fillOpacity: 1
    }).addTo(map).bindTooltip('✈ En ruta');

    map.fitBounds(line.getBounds(), { padding: [20,20] });
  }

  // ===== “Datos curiosos” =====
  const distKm = haversineKm(COORD_PTY, COORD_MVD);
  const factDist = document.querySelector('#factDist');
  const factDur = document.querySelector('#factDur');
  const factProg = document.querySelector('#factProg');
  if (factDist) factDist.textContent = distKm.toLocaleString();

  const msDur = new Date(llegadaMvd) - new Date(salidaPty);
  const horas = Math.floor(msDur/3600000);
  const mins  = Math.round((msDur%3600000)/60000);
  if (factDur) factDur.textContent = `${horas}h ${String(mins).padStart(2,'0')}m`;

  // ===== Flip horas (decorativo) =====
  const salidaLocalEl  = document.querySelector('#salidaLocal');
  const llegadaLocalEl = document.querySelector('#llegadaLocal');

  // ===== Hooks de contadores =====
  const contadorSalidaEl = document.querySelector("#contadorSalida");
  const contadorLlegadaEl = document.querySelector("#contadorLlegada");

  // ===== Corazón al llegar + estado previo =====
  const heartEl = document.querySelector('#arrivalHeart');
  let estadoPrevio = null;

  // ===== Ticker 1s =====
  const tick = () => {
    // Contadores
    if (contadorSalidaEl) renderContador(contadorSalidaEl, msADHMS(vuelo.msHasta(vuelo.salidaPty)));
    if (contadorLlegadaEl) renderContador(contadorLlegadaEl, msADHMS(vuelo.msHasta(vuelo.llegadaMvd)));

    // Estado textual + estilo de pill
    const estado = vuelo.estado();
    const estadoEl = document.querySelector("#estadoVuelo");
    if (estadoEl) {
      estadoEl.textContent = estado;
      estadoEl.classList.remove('pill--boarding','pill--en-vuelo','pill--arribado');
      if (Date.now() < vuelo.salidaPty) {
        estadoEl.classList.add('pill--boarding');
        estadoEl.textContent = 'En embarque';
      } else if (estado === 'En vuelo') {
        estadoEl.classList.add('pill--en-vuelo');
      } else {
        estadoEl.classList.add('pill--arribado');
      }
    }

    // Ding y corazón al cambiar estado
    if (estado !== estadoPrevio) {
      if (estadoPrevio !== null) playDing();
      if (estado === 'Llegó' && heartEl) {
        heartEl.classList.remove('show'); void heartEl.offsetWidth; heartEl.classList.add('show');
      }
      estadoPrevio = estado;
    }

    // Progreso y UI
    const prog = vuelo.progreso();
    renderEstado(vuelo);       // barra
    renderAvion(prog);         // ✈ en la pista
    if (typeof renderNombres === 'function') renderNombres(prog);

    if (factProg) factProg.textContent = `${Math.round(prog)}%`;

    // Avión en el mapa
    if (planeMarker) {
      const t = Math.min(Math.max(prog/100, 0), 1);
      planeMarker.setLatLng( lerpLatLng(COORD_PTY, COORD_MVD, t) );
    }

    // Flip clock suave (decorativo)
    if (salidaLocalEl)  flipUpdate(salidaLocalEl,  salidaLocalEl.textContent.trim());
    if (llegadaLocalEl) flipUpdate(llegadaLocalEl, llegadaLocalEl.textContent.trim());
  };

  tick();
  setInterval(tick, 1000);

  // Año en footer
  const yearEl = document.querySelector("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
