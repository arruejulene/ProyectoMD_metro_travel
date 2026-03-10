import { loadDefaultCities, loadDefaultFlights, parseCitiesJson, parseFlightsCsv, normalizeCities } from './dataLoader.js';
import { Graph } from './graphLogic.js';
import { drawGraph } from './graphView.js';

const state = {
  cities: {},
  flights: [],
  graph: null,
  activeResult: null,
  uploadedCitiesText: null,
  uploadedFlightsText: null,
};

const elements = {
  originSelect: document.getElementById('originSelect'),
  destinationSelect: document.getElementById('destinationSelect'),
  visaCheckbox: document.getElementById('visaCheckbox'),
  calculateBtn: document.getElementById('calculateBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  resetBtn: document.getElementById('resetBtn'),
  citiesFile: document.getElementById('citiesFile'),
  flightsFile: document.getElementById('flightsFile'),
  citiesFileLabel: document.getElementById('citiesFileLabel'),
  flightsFileLabel: document.getElementById('flightsFileLabel'),
  selectedRouteBox: document.getElementById('selectedRouteBox'),
  selectedModeValue: document.getElementById('selectedModeValue'),
  selectedCostValue: document.getElementById('selectedCostValue'),
  selectedStopsValue: document.getElementById('selectedStopsValue'),
  selectedSegmentsValue: document.getElementById('selectedSegmentsValue'),
  statusMessage: document.getElementById('statusMessage'),
  reportBox: document.getElementById('reportBox'),
  graphSummary: document.getElementById('graphSummary'),
  graphCanvas: document.getElementById('graphCanvas'),
};

init();

async function init() {
  bindEvents();
  await loadData();
}

function bindEvents() {
  elements.calculateBtn.addEventListener('click', calculateRoute);
  elements.reloadBtn.addEventListener('click', loadData);
  elements.resetBtn.addEventListener('click', async () => {
    state.uploadedCitiesText = null;
    state.uploadedFlightsText = null;
    elements.citiesFile.value = '';
    elements.flightsFile.value = '';
    elements.citiesFileLabel.textContent = 'Usando data/cities.json';
    elements.flightsFileLabel.textContent = 'Usando data/flights.csv';
    await loadData();
  });

  elements.citiesFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.uploadedCitiesText = await file.text();
    elements.citiesFileLabel.textContent = file.name;
  });

  elements.flightsFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.uploadedFlightsText = await file.text();
    elements.flightsFileLabel.textContent = file.name;
  });
}

async function loadData() {
  try {
    const citiesArray = state.uploadedCitiesText ? parseCitiesJson(state.uploadedCitiesText) : await loadDefaultCities();
    const flights = state.uploadedFlightsText ? parseFlightsCsv(state.uploadedFlightsText) : await loadDefaultFlights();

    state.cities = normalizeCities(citiesArray);
    state.flights = flights;
    state.graph = new Graph(state.cities, state.flights);
    state.activeResult = null;

    fillSelects();
    resetSelectedRoute();
    setStatus('Datos cargados correctamente.', true);
    elements.reportBox.textContent = 'Selecciona origen, destino y criterio para calcular una ruta.';
    elements.graphSummary.textContent = 'Aún no se ha calculado una ruta.';
    drawGraph(elements.graphCanvas, state.cities, state.flights, []);
  } catch (error) {
    setStatus(error.message, false);
    elements.reportBox.textContent = 'Error al cargar los datos.';
  }
}

function fillSelects() {
  const options = Object.keys(state.cities)
    .sort()
    .map(code => ({ value: code, label: `${code} - ${state.cities[code].name}` }));

  for (const select of [elements.originSelect, elements.destinationSelect]) {
    select.innerHTML = '';
    for (const option of options) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    }
  }

  if (state.cities.CCS) elements.originSelect.value = 'CCS';
  if (state.cities.SBH) elements.destinationSelect.value = 'SBH';
}

function calculateRoute() {
  if (!state.graph) return;

  const origin = elements.originSelect.value;
  const destination = elements.destinationSelect.value;
  const hasVisa = elements.visaCheckbox.checked;
  const selectedMode = document.querySelector('input[name="criterion"]:checked').value;

  if (origin === destination) {
    setStatus('El origen y el destino no pueden ser iguales.', false);
    resetSelectedRoute();
    return;
  }

  const selectedResult = state.graph.dijkstra(origin, destination, hasVisa, selectedMode);

  if (!selectedResult.found) {
    state.activeResult = null;
    setStatus(selectedResult.reason, false);
    resetSelectedRoute('Sin ruta válida');
    elements.reportBox.textContent = buildFailureReport(origin, destination, hasVisa, selectedMode, selectedResult.reason);
    elements.graphSummary.textContent = 'No existe ruta válida para los parámetros actuales.';
    drawGraph(elements.graphCanvas, state.cities, state.flights, []);
    return;
  }

  state.activeResult = selectedResult;
  renderSelectedRoute(selectedResult, selectedMode);
  setStatus('Ruta calculada correctamente.', true);
  elements.reportBox.textContent = buildSuccessReport(origin, destination, hasVisa, selectedMode, selectedResult);
  elements.graphSummary.textContent = `Ruta activa: ${formatPath(selectedResult.path, false)} · Costo total: $${selectedResult.totalCost.toFixed(2)} · Escalas: ${selectedResult.stops}`;
  drawGraph(elements.graphCanvas, state.cities, state.flights, selectedResult.path);
}

function renderSelectedRoute(result, selectedMode) {
  elements.selectedRouteBox.textContent = formatPath(result.path, true);
  elements.selectedModeValue.textContent = selectedMode === 'cost' ? 'Menor costo' : 'Menos escalas';
  elements.selectedCostValue.textContent = `$${result.totalCost.toFixed(2)}`;
  elements.selectedStopsValue.textContent = String(result.stops);
  elements.selectedSegmentsValue.textContent = String(result.segments);
}

function resetSelectedRoute(routeText = 'Ruta pendiente') {
  elements.selectedRouteBox.textContent = routeText;
  elements.selectedModeValue.textContent = '--';
  elements.selectedCostValue.textContent = '--';
  elements.selectedStopsValue.textContent = '--';
  elements.selectedSegmentsValue.textContent = '--';
}

function buildSuccessReport(origin, destination, hasVisa, selectedMode, result) {
  const originName = `${origin} - ${state.cities[origin].name}`;
  const destinationName = `${destination} - ${state.cities[destination].name}`;

  return [
    '==== METRO TRAVEL - REPORTE DE RUTA ====',
    '',
    `Origen: ${originName}`,
    `Destino: ${destinationName}`,
    `Pasajero con visa: ${hasVisa ? 'Sí' : 'No'}`,
    `Enfoque seleccionado: ${selectedMode === 'cost' ? 'Menor costo' : 'Menos escalas'}`,
    '',
    'Ruta resultante:',
    formatPath(result.path, true),
    `Costo total: $${result.totalCost.toFixed(2)}`,
    `Tramos: ${result.segments}`,
    `Escalas: ${result.stops}`,
  ].join('\n');
}

function buildFailureReport(origin, destination, hasVisa, selectedMode, reason) {
  return [
    '==== METRO TRAVEL - REPORTE DE RUTA ====',
    '',
    `Origen: ${origin} - ${state.cities[origin]?.name ?? ''}`,
    `Destino: ${destination} - ${state.cities[destination]?.name ?? ''}`,
    `Pasajero con visa: ${hasVisa ? 'Sí' : 'No'}`,
    `Enfoque seleccionado: ${selectedMode === 'cost' ? 'Menor costo' : 'Menos escalas'}`,
    '',
    'Resultado:',
    reason,
  ].join('\n');
}

function formatPath(path, withNames) {
  if (withNames) {
    return path.map(code => `${code} - ${state.cities[code].name}`).join('  →  ');
  }
  return path.join(' → ');
}

function setStatus(message, ok) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = ok ? 'status-ok' : 'status-error';
}
