/* =========================================================
  script.js — Vuelo PTY → MVD (Agustina ✈ Rodrigo)
  Arquitectura y trade-offs:
  - Dominio y UI separadas; el DOM solo se toca en la capa UI.
  - Fechas configurables desde HTML vía data-attributes (#flightData).
  - Progreso en vivo: mueve ✈ de 10% a 90% del track y sincroniza nombres.
  - Dependencias: AOS.js opcional (decorativo).
========================================================= */

// ================================
// 🧠 Dominio (clases y reglas)
// ================================
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

// ================================
// 🖥️ UI (render y utilidades)
// ================================
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

  // mapeo lineal: 0% => 10%, 100% => 90%
  const min = 10;
  const max = 90;
  const leftPct = min + (max - min) * (Math.max(0, Math.min(100, progresoPct)) / 100);

  planeEl.style.left = leftPct + "%";

  // Pequeña inclinación dinámica para darle vida
  const tilt = -2 + (leftPct - min) / (max - min) * 4; // -2° a +2°
  planeEl.style.transform = `translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg)`;

  // Sombra un poco más intensa a mitad de trayecto
  planeEl.style.filter =
    `drop-shadow(0 8px 14px rgba(96,165,250,${0.25 + 0.25 * Math.sin((leftPct - min) / (max - min) * Math.PI)}))`;
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

// ================================
// 🚦 Gestión de eventos (UI)
// ================================
document.addEventListener("DOMContentLoaded", () => {
  // AOS opcional
  if (window.AOS) AOS.init({ once: false, duration: 800, easing: "ease-out-cubic" });

  // Datos desde HTML
  const flightDataEl = document.querySelector("#flightData");
  const salidaMvd = flightDataEl?.dataset?.departureMvd;
  const salidaPty = flightDataEl?.dataset?.departurePty;
  const llegadaMvd = flightDataEl?.dataset?.arrivalMvd;

  if (!salidaMvd || !salidaPty || !llegadaMvd) {
    console.warn("Faltan atributos data-* en #flightData");
    return;
  }

  // Instancia del dominio
  const vuelo = new Vuelo(salidaMvd, salidaPty, llegadaMvd);

  // Hooks de contadores
  const contadorSalidaEl = document.querySelector("#contadorSalida");
  const contadorLlegadaEl = document.querySelector("#contadorLlegada");

  // Ticker 1s
  const tick = () => {
    // Contadores
    if (contadorSalidaEl) renderContador(contadorSalidaEl, msADHMS(vuelo.msHasta(vuelo.salidaPty)));
    if (contadorLlegadaEl) renderContador(contadorLlegadaEl, msADHMS(vuelo.msHasta(vuelo.llegadaMvd)));

    // Estado + progreso barra
    renderEstado(vuelo);

    // ✈ posición + nombres según progreso real
    const prog = vuelo.progreso();
    renderAvion(prog);
    renderNombres(prog);
  };

  tick();
  setInterval(tick, 1000);

  // Año en footer
  const yearEl = document.querySelector("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});


document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('#toggle-modo');
  const icono = btn ? btn.querySelector('i') : null;

  if (btn && icono) {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('modo-oscuro');

      // Cambiar icono
      if (document.body.classList.contains('modo-oscuro')) {
        icono.classList.remove('bx-moon');
        icono.classList.add('bx-sun');
      } else {
        icono.classList.remove('bx-sun');
        icono.classList.add('bx-moon');
      }
    });

    // Estado inicial
    if (document.body.classList.contains('modo-oscuro')) {
      icono.classList.remove('bx-moon');
      icono.classList.add('bx-sun');
    } else {
      icono.classList.remove('bx-sun');
      icono.classList.add('bx-moon');
    }
  }
});

