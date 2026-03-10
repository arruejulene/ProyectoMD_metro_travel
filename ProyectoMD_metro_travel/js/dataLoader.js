export async function loadDefaultCities() {
  const response = await fetch('./data/cities.json');
  if (!response.ok) throw new Error('No se pudo cargar cities.json');
  return response.json();
}

export async function loadDefaultFlights() {
  const response = await fetch('./data/flights.csv');
  if (!response.ok) throw new Error('No se pudo cargar flights.csv');
  const text = await response.text();
  return parseFlightsCsv(text);
}

export function parseCitiesJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('El archivo de ciudades debe contener un arreglo JSON.');
  return parsed;
}

export function parseFlightsCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('El archivo CSV de vuelos no tiene datos suficientes.');

  const headers = lines[0].split(',').map(v => v.trim().toLowerCase());
  const originIndex = headers.indexOf('origin');
  const destinationIndex = headers.indexOf('destination');
  const priceIndex = headers.indexOf('price');

  if ([originIndex, destinationIndex, priceIndex].includes(-1)) {
    throw new Error('El CSV de vuelos debe tener columnas: origin,destination,price');
  }

  return lines.slice(1).map((line, index) => {
    const cols = line.split(',').map(v => v.trim());
    const origin = cols[originIndex];
    const destination = cols[destinationIndex];
    const price = Number(cols[priceIndex]);

    if (!origin || !destination || Number.isNaN(price)) {
      throw new Error(`Fila inválida en vuelos.csv: ${index + 2}`);
    }

    return { origin, destination, price };
  });
}

export function normalizeCities(citiesArray) {
  const cities = {};
  for (const item of citiesArray) {
    if (!item.code || !item.name) throw new Error('Cada ciudad debe tener code y name.');
    cities[item.code] = {
      code: item.code,
      name: item.name,
      requiresVisa: Boolean(item.requiresVisa),
    };
  }
  return cities;
}
