import { drawGraph } from "./graphView.js";

const state = {
  cities: {},
  flights: [],
  activeResult: null,
  uploadedCitiesText: null,
  uploadedFlightsText: null,
  meta: {
    defaultOrigin: "",
    defaultDestination: "",
    citiesCount: 0,
    flightsCount: 0,
  },
};

const elements = {
  originSelect: document.getElementById("originSelect"),
  destinationSelect: document.getElementById("destinationSelect"),
  visaCheckbox: document.getElementById("visaCheckbox"),
  calculateBtn: document.getElementById("calculateBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  citiesFile: document.getElementById("citiesFile"),
  flightsFile: document.getElementById("flightsFile"),
  citiesFileLabel: document.getElementById("citiesFileLabel"),
  flightsFileLabel: document.getElementById("flightsFileLabel"),
  selectedRouteBox: document.getElementById("selectedRouteBox"),
  selectedModeValue: document.getElementById("selectedModeValue"),
  selectedCostValue: document.getElementById("selectedCostValue"),
  selectedStopsValue: document.getElementById("selectedStopsValue"),
  selectedSegmentsValue: document.getElementById("selectedSegmentsValue"),
  statusMessage: document.getElementById("statusMessage"),
  reportBox: document.getElementById("reportBox"),
  graphSummary: document.getElementById("graphSummary"),
  graphCanvas: document.getElementById("graphCanvas"),
};

init();

async function init() {
  bindEvents();
  await loadData();
}

function bindEvents() {
  elements.calculateBtn.addEventListener("click", calculateRoute);
  elements.reloadBtn.addEventListener("click", loadData);
  elements.resetBtn.addEventListener("click", resetToDefaults);

  elements.citiesFile.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      state.uploadedCitiesText = null;
      elements.citiesFileLabel.textContent = "Ningún archivo seleccionado";
      return;
    }

    state.uploadedCitiesText = await file.text();
    elements.citiesFileLabel.textContent = file.name;
  });

  elements.flightsFile.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      state.uploadedFlightsText = null;
      elements.flightsFileLabel.textContent = "Ningún archivo seleccionado";
      return;
    }

    state.uploadedFlightsText = await file.text();
    elements.flightsFileLabel.textContent = file.name;
  });
}

async function resetToDefaults() {
  state.uploadedCitiesText = null;
  state.uploadedFlightsText = null;

  elements.citiesFile.value = "";
  elements.flightsFile.value = "";
  elements.citiesFileLabel.textContent = "Ningún archivo seleccionado";
  elements.flightsFileLabel.textContent = "Ningún archivo seleccionado";

  try {
    const response = await fetch("/api/reset", {
      method: "POST",
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "No se pudieron restaurar los datos base.");
    }

    applyLoadedData(payload);
    renderIdleState(payload.message || "Datos base restaurados.");
  } catch (error) {
    renderLoadError(error.message);
  }
}

async function loadData() {
  try {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        citiesText: state.uploadedCitiesText,
        flightsText: state.uploadedFlightsText,
      }),
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "No se pudieron cargar los datos.");
    }

    applyLoadedData(payload);
    renderIdleState(payload.message || "Datos cargados correctamente.");
  } catch (error) {
    renderLoadError(error.message);
  }
}

function applyLoadedData(payload) {
  state.cities = payload.cities || {};
  state.flights = payload.flights || [];
  state.meta = payload.meta || {
    defaultOrigin: "",
    defaultDestination: "",
    citiesCount: 0,
    flightsCount: 0,
  };
  state.activeResult = null;

  fillSelects();
  resetSelectedRoute();
}

function renderIdleState(message) {
  setStatus(message, true);

  elements.reportBox.textContent = [
    "==== METRO TRAVEL - REPORTE DE RUTA ====",
    "",
    `Ciudades cargadas: ${state.meta.citiesCount}`,
    `Vuelos cargados: ${state.meta.flightsCount}`,
    "",
    "Selecciona origen, destino, visa y criterio para calcular una ruta.",
  ].join("\n");

  elements.graphSummary.textContent = [
    `Grafo cargado correctamente.`,
    `Ciudades: ${state.meta.citiesCount}.`,
    `Vuelos: ${state.meta.flightsCount}.`,
    `Ruta activa: ninguna.`,
  ].join(" ");

  drawGraph(elements.graphCanvas, state.cities, state.flights, []);
}

function renderLoadError(message) {
  setStatus(message, false);
  resetSelectedRoute("Ruta pendiente");
  elements.reportBox.textContent = "Error al cargar los datos.";
  elements.graphSummary.textContent = "No se pudo construir el grafo con los datos actuales.";
  drawGraph(elements.graphCanvas, {}, [], []);
}

function fillSelects() {
  const options = Object.keys(state.cities)
    .sort((a, b) => a.localeCompare(b))
    .map((code) => ({
      value: code,
      label: `${code} - ${state.cities[code].name}`,
    }));

  for (const select of [elements.originSelect, elements.destinationSelect]) {
    select.innerHTML = "";

    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    }
  }

  if (!options.length) {
    return;
  }

  const suggestedOrigin = options.some((item) => item.value === state.meta.defaultOrigin)
    ? state.meta.defaultOrigin
    : options[0].value;

  let suggestedDestination = options.some((item) => item.value === state.meta.defaultDestination)
    ? state.meta.defaultDestination
    : options[Math.min(1, options.length - 1)].value;

  if (suggestedOrigin === suggestedDestination && options.length > 1) {
    suggestedDestination = options.find((item) => item.value !== suggestedOrigin)?.value || suggestedDestination;
  }

  elements.originSelect.value = suggestedOrigin;
  elements.destinationSelect.value = suggestedDestination;
}

async function calculateRoute() {
  const origin = elements.originSelect.value;
  const destination = elements.destinationSelect.value;
  const hasVisa = elements.visaCheckbox.checked;
  const criterion = document.querySelector('input[name="criterion"]:checked')?.value || "cost";

  if (!origin || !destination) {
    setStatus("Debes seleccionar origen y destino.", false);
    resetSelectedRoute("Ruta pendiente");
    return;
  }

  if (origin === destination) {
    setStatus("El origen y el destino no pueden ser iguales.", false);
    resetSelectedRoute("Ruta pendiente");
    return;
  }

  try {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin,
        destination,
        hasVisa,
        criterion,
      }),
    });

    const payload = await response.json();

    if (!payload.ok) {
      const reason =
        payload.message ||
        payload.result?.reason ||
        "No existe una ruta válida con las restricciones seleccionadas.";

      state.activeResult = null;
      setStatus(reason, false);
      resetSelectedRoute("Sin ruta válida");
      elements.reportBox.textContent = buildFailureReport(origin, destination, hasVisa, criterion, reason);
      elements.graphSummary.textContent = "No existe ruta válida para los parámetros actuales.";
      drawGraph(elements.graphCanvas, state.cities, state.flights, []);
      return;
    }

    state.activeResult = payload.result;
    renderSelectedRoute(payload.result, criterion);
    setStatus(payload.message || "Ruta calculada correctamente.", true);
    elements.reportBox.textContent = buildSuccessReport(origin, destination, hasVisa, criterion, payload.result);
    elements.graphSummary.textContent = [
      `Ruta activa: ${formatPath(payload.result.path, false)}.`,
      `Costo total: $${Number(payload.result.totalCost).toFixed(2)}.`,
      `Escalas: ${payload.result.stops}.`,
      `Tramos: ${payload.result.segments}.`,
    ].join(" ");

    drawGraph(elements.graphCanvas, state.cities, state.flights, payload.result.path);
  } catch (error) {
    setStatus(error.message || "No se pudo calcular la ruta.", false);
    resetSelectedRoute("Sin ruta válida");
  }
}

function renderSelectedRoute(result, selectedMode) {
  elements.selectedRouteBox.textContent = formatPath(result.path, true);
  elements.selectedModeValue.textContent = selectedMode === "cost" ? "Menor costo" : "Menos escalas";
  elements.selectedCostValue.textContent = `$${Number(result.totalCost).toFixed(2)}`;
  elements.selectedStopsValue.textContent = String(result.stops);
  elements.selectedSegmentsValue.textContent = String(result.segments);
}

function resetSelectedRoute(routeText = "Ruta pendiente") {
  elements.selectedRouteBox.textContent = routeText;
  elements.selectedModeValue.textContent = "--";
  elements.selectedCostValue.textContent = "--";
  elements.selectedStopsValue.textContent = "--";
  elements.selectedSegmentsValue.textContent = "--";
}

function buildSuccessReport(origin, destination, hasVisa, criterion, result) {
  const originName = `${origin} - ${state.cities[origin]?.name || ""}`;
  const destinationName = `${destination} - ${state.cities[destination]?.name || ""}`;

  return [
    "==== METRO TRAVEL - REPORTE DE RUTA ====",
    "",
    `Origen: ${originName}`,
    `Destino: ${destinationName}`,
    `Pasajero con visa: ${hasVisa ? "Sí" : "No"}`,
    `Enfoque seleccionado: ${criterion === "cost" ? "Menor costo" : "Menos escalas"}`,
    "",
    "Ruta resultante:",
    formatPath(result.path, true),
    `Costo total: $${Number(result.totalCost).toFixed(2)}`,
    `Tramos: ${result.segments}`,
    `Escalas: ${result.stops}`,
  ].join("\n");
}

function buildFailureReport(origin, destination, hasVisa, criterion, reason) {
  return [
    "==== METRO TRAVEL - REPORTE DE RUTA ====",
    "",
    `Origen: ${origin} - ${state.cities[origin]?.name || ""}`,
    `Destino: ${destination} - ${state.cities[destination]?.name || ""}`,
    `Pasajero con visa: ${hasVisa ? "Sí" : "No"}`,
    `Enfoque seleccionado: ${criterion === "cost" ? "Menor costo" : "Menos escalas"}`,
    "",
    "Resultado:",
    reason,
  ].join("\n");
}

function formatPath(path, withNames) {
  if (!Array.isArray(path)) {
    return "";
  }

  if (withNames) {
    return path.map((code) => `${code} - ${state.cities[code]?.name || ""}`).join("  →  ");
  }

  return path.join(" → ");
}

function setStatus(message, ok) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = ok ? "status-ok" : "status-error";
}