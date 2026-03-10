const POSITIONS = {
  CCS: { x: 110, y: 360 },
  AUA: { x: 310, y: 150 },
  CUR: { x: 345, y: 280 },
  BON: { x: 470, y: 225 },
  SXM: { x: 760, y: 115 },
  SBH: { x: 920, y: 70 },
  PTP: { x: 930, y: 240 },
  FDF: { x: 1080, y: 315 },
  SDQ: { x: 1180, y: 380 },
  PAP: { x: 1030, y: 515 },
  POS: { x: 240, y: 600 },
  BGI: { x: 710, y: 425 },
};

let cyInstance = null;

export function drawGraph(container, cities, flights, activePath = []) {
  if (window.cytoscape) {
    drawWithCytoscape(container, cities, flights, activePath);
  } else {
    drawWithSvg(container, cities, flights, activePath);
  }
}

function drawWithCytoscape(container, cities, flights, activePath) {
  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }

  const activeEdges = new Set();
  for (let i = 0; i < activePath.length - 1; i++) {
    activeEdges.add(`${activePath[i]}->${activePath[i + 1]}`);
  }

  const elements = [];
  for (const code of Object.keys(cities)) {
    const point = POSITIONS[code];
    if (!point) continue;
    elements.push({
      data: {
        id: code,
        label: code,
        subtitle: cities[code].name,
        visa: cities[code].requiresVisa ? 'yes' : 'no',
      },
      position: { x: point.x, y: point.y },
      classes: activePath.includes(code) ? 'active-node' : '',
    });
  }

  flights.forEach((flight, index) => {
    const pairSeed = ((flight.origin.charCodeAt(0) + flight.destination.charCodeAt(0) + index) % 5) - 2;
    elements.push({
      data: {
        id: `${flight.origin}_${flight.destination}_${index}`,
        source: flight.origin,
        target: flight.destination,
        label: `$${flight.price}`,
        edgeKey: `${flight.origin}->${flight.destination}`,
        curve: pairSeed === 0 ? 25 : pairSeed * 18,
      },
      classes: activeEdges.has(`${flight.origin}->${flight.destination}`) ? 'active-edge' : '',
    });
  });

  cyInstance = window.cytoscape({
    container,
    elements,
    layout: { name: 'preset', padding: 30 },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    wheelSensitivity: 0.2,
    minZoom: 0.6,
    style: [
      {
        selector: 'node',
        style: {
          'width': 54,
          'height': 54,
          'background-color': ele => ele.data('visa') === 'yes' ? '#2749a0' : '#1ca39b',
          'border-width': 2,
          'border-color': 'rgba(242,245,255,0.28)',
          'label': 'data(label)',
          'color': '#ffffff',
          'font-size': 15,
          'font-weight': 700,
          'text-valign': 'center',
          'text-halign': 'center',
          'overlay-opacity': 0,
        }
      },
      {
        selector: 'node.active-node',
        style: {
          'background-color': '#ff8a00',
          'border-width': 4,
          'border-color': '#ffe0b6',
          'width': 60,
          'height': 60,
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2.5,
          'curve-style': 'unbundled-bezier',
          'control-point-distances': 'data(curve)',
          'control-point-weights': 0.5,
          'line-color': 'rgba(139, 170, 238, 0.62)',
          'target-arrow-color': 'rgba(139, 170, 238, 0.82)',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 1.1,
          'label': 'data(label)',
          'font-size': 11,
          'color': '#ffffff',
          'text-background-color': 'rgba(9,18,40,0.95)',
          'text-background-opacity': 1,
          'text-background-padding': 4,
          'text-border-color': 'rgba(44, 65, 112, 0.75)',
          'text-border-width': 1,
          'text-border-opacity': 1,
          'text-rotation': 'autorotate',
          'text-margin-y': -10,
          'overlay-opacity': 0,
        }
      },
      {
        selector: 'edge.active-edge',
        style: {
          'width': 5,
          'line-color': '#ff8a00',
          'target-arrow-color': '#ff8a00',
          'z-index': 999,
        }
      }
    ]
  });

  for (const code of Object.keys(cities)) {
    const point = POSITIONS[code];
    if (!point) continue;
    const label = document.createElement('div');
    label.className = 'cy-node-label';
    label.textContent = cities[code].name;
  }
}

function drawWithSvg(container, cities, flights, activePath) {
  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }

  const activeEdges = new Set();
  for (let i = 0; i < activePath.length - 1; i++) {
    activeEdges.add(`${activePath[i]}->${activePath[i + 1]}`);
  }

  const svgParts = [];
  svgParts.push(`
  <svg viewBox="0 0 1280 720" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#071225"/>
        <stop offset="100%" stop-color="#04101f"/>
      </linearGradient>
      <marker id="arrowBase" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L12,6 L0,12 z" fill="rgba(139,170,238,0.92)" />
      </marker>
      <marker id="arrowActive" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L12,6 L0,12 z" fill="#ff8a00" />
      </marker>
    </defs>
    <rect width="1280" height="720" fill="url(#bgGrad)" rx="22" ry="22"/>
  `);

  flights.forEach((flight, index) => {
    const a = POSITIONS[flight.origin];
    const b = POSITIONS[flight.destination];
    if (!a || !b) return;
    const active = activeEdges.has(`${flight.origin}->${flight.destination}`);
    const geometry = buildCurve(a, b, index);
    const stroke = active ? '#ff8a00' : 'rgba(139,170,238,0.62)';
    const width = active ? 5 : 2.5;
    const marker = active ? 'url(#arrowActive)' : 'url(#arrowBase)';

    svgParts.push(`
      <path d="${geometry.path}" fill="none" stroke="${stroke}" stroke-width="${width}" marker-end="${marker}" stroke-linecap="round" />
      <rect x="${geometry.labelX - 22}" y="${geometry.labelY - 12}" width="44" height="24" rx="9" fill="rgba(9,18,40,0.96)" stroke="rgba(44, 65, 112, 0.75)" />
      <text x="${geometry.labelX}" y="${geometry.labelY + 4}" fill="#ffffff" font-size="12" text-anchor="middle" font-family="Georgia">$${flight.price}</text>
    `);
  });

  Object.keys(cities).forEach(code => {
    const point = POSITIONS[code];
    if (!point) return;
    const active = activePath.includes(code);
    const fill = active ? '#ff8a00' : cities[code].requiresVisa ? '#2749a0' : '#1ca39b';
    const stroke = active ? '#ffe0b6' : 'rgba(242,245,255,0.28)';
    const radius = active ? 30 : 27;

    svgParts.push(`
      <circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 4 : 2}" />
      <text x="${point.x}" y="${point.y + 5}" fill="#ffffff" font-size="16" font-weight="700" text-anchor="middle" font-family="Georgia">${code}</text>
      <text x="${point.x}" y="${point.y + radius + 24}" fill="#e6dbff" font-size="14" text-anchor="middle" font-family="Georgia">${escapeXml(cities[code].name)}</text>
    `);
  });

  svgParts.push('</svg>');
  container.innerHTML = svgParts.join('');
}

function buildCurve(a, b, index) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const curvature = ((((a.x + b.x + index * 17) % 5) - 2) || 1) * 18;
  const cx = (a.x + b.x) / 2 + nx * curvature;
  const cy = (a.y + b.y) / 2 + ny * curvature;
  const labelX = (a.x + 2 * cx + b.x) / 4;
  const labelY = (a.y + 2 * cy + b.y) / 4;
  return {
    path: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
    labelX,
    labelY,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
