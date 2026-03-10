export class Graph {
  constructor(cities, flights) {
    this.cities = cities;
    this.flights = flights;
    this.adj = {};

    for (const code of Object.keys(cities)) {
      this.adj[code] = [];
    }

    for (const flight of flights) {
      const { origin, destination, price } = flight;
      if (!this.cities[origin] || !this.cities[destination]) continue;
      // Grafo dirigido: solo se agrega la arista origin -> destination.
      this.adj[origin].push({ to: destination, price });
    }
  }

  dijkstra(start, end, hasVisa, mode = 'cost') {
    if (!this.cities[start] || !this.cities[end]) {
      return { found: false, reason: 'Origen o destino inválido.' };
    }

    if (!hasVisa && (this.cities[start].requiresVisa || this.cities[end].requiresVisa)) {
      return { found: false, reason: 'Sin visa no se puede salir desde o llegar a una ciudad que requiere visa.' };
    }

    const dist = {};
    const prev = {};
    const visited = new Set();

    for (const code of Object.keys(this.cities)) {
      dist[code] = Infinity;
      prev[code] = undefined;
    }
    dist[start] = 0;

    while (visited.size < Object.keys(this.cities).length) {
      let current = null;
      let best = Infinity;

      for (const code of Object.keys(dist)) {
        if (!visited.has(code) && dist[code] < best) {
          best = dist[code];
          current = code;
        }
      }

      if (current === null) break;
      if (current === end) break;

      visited.add(current);

      for (const edge of this.adj[current]) {
        const neighbor = edge.to;
        if (visited.has(neighbor)) continue;
        if (!hasVisa && this.cities[neighbor].requiresVisa) continue;

        const weight = mode === 'cost' ? edge.price : 1;
        const candidate = dist[current] + weight;
        if (candidate < dist[neighbor]) {
          dist[neighbor] = candidate;
          prev[neighbor] = current;
        }
      }
    }

    if (dist[end] === Infinity) {
      return { found: false, reason: 'No existe una ruta válida con las restricciones seleccionadas.' };
    }

    const path = [];
    let cursor = end;
    while (cursor !== undefined) {
      path.unshift(cursor);
      cursor = prev[cursor];
    }

    let totalCost = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalCost += this.getEdgeCost(path[i], path[i + 1]);
    }

    const segments = Math.max(0, path.length - 1);
    const stops = Math.max(0, path.length - 2);

    return {
      found: true,
      path,
      totalCost,
      segments,
      stops,
      score: dist[end],
      mode,
    };
  }

  getEdgeCost(a, b) {
    const edge = this.adj[a].find(item => item.to === b);
    return edge ? edge.price : 0;
  }
}
