let cyInstance = null;
let resizeHandlerAttached = false;
let resizeTimer = null;
let lastArgs = null;

export function drawGraph(container, cities, flights, activePath = []) {
  lastArgs = { container, cities, flights, activePath };

  if (!resizeHandlerAttached) {
    resizeHandlerAttached = true;

    window.addEventListener("resize", () => {
      if (!lastArgs) return;

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawGraph(
          lastArgs.container,
          lastArgs.cities,
          lastArgs.flights,
          lastArgs.activePath
        );
      }, 120);
    });
  }

  if (window.cytoscape) {
    drawWithCytoscape(container, cities, flights, activePath);
    return;
  }

  drawWithSvg(container, cities, flights, activePath);
}

function buildCircularPositions(cities, container) {
  const codes = Object.keys(cities).sort((a, b) => a.localeCompare(b));
  const count = codes.length;
  const width = Math.max(container.clientWidth || 1100, 1100);
  const height = Math.max(container.clientHeight || 760, 760);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(210, Math.min(width, height) * 0.36);

  const positions = {};

  if (count === 0) {
    return { positions, width, height };
  }

  if (count === 1) {
    positions[codes[0]] = { x: centerX, y: centerY };
    return { positions, width, height };
  }

  codes.forEach((code, index) => {
    const angle = (-Math.PI / 2) + ((2 * Math.PI * index) / count);

    positions[code] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return { positions, width, height };
}

function buildActiveEdges(activePath) {
  const activeEdges = new Set();

  for (let index = 0; index < activePath.length - 1; index += 1) {
    activeEdges.add(`${activePath[index]}->${activePath[index + 1]}`);
  }

  return activeEdges;
}

function hasActivePath(activePath) {
  return Array.isArray(activePath) && activePath.length > 1;
}

function computeCurve(a, b, seed) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const bend = ((seed % 2 === 0 ? 1 : -1) * Math.max(40, Math.min(105, distance * 0.16)));
  const controlX = (a.x + b.x) / 2 + normalX * bend;
  const controlY = (a.y + b.y) / 2 + normalY * bend;
  const labelX = (a.x + 2 * controlX + b.x) / 4;
  const labelY = (a.y + 2 * controlY + b.y) / 4;

  return {
    path: `M ${a.x} ${a.y} Q ${controlX} ${controlY} ${b.x} ${b.y}`,
    labelX,
    labelY,
    curveDistance: bend,
  };
}

function drawWithCytoscape(container, cities, flights, activePath) {
  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }

  const { positions } = buildCircularPositions(cities, container);
  const activeEdges = buildActiveEdges(activePath);
  const routeIsActive = hasActivePath(activePath);
  const activeNodes = new Set(activePath || []);
  const elements = [];

  Object.keys(cities).forEach((code) => {
    if (!positions[code]) return;

    const isActiveNode = activeNodes.has(code);
    const isMutedNode = routeIsActive && !isActiveNode;

    elements.push({
      data: {
        id: code,
        label: code,
        cityName: cities[code].name,
        visa: cities[code].requiresVisa ? "yes" : "no",
      },
      position: positions[code],
      classes: [
        isActiveNode ? "active-node" : "",
        isMutedNode ? "muted-node" : "",
      ].filter(Boolean).join(" "),
    });
  });

  flights.forEach((flight, index) => {
    if (!positions[flight.origin] || !positions[flight.destination]) return;

    const edgeKey = `${flight.origin}->${flight.destination}`;
    const isActiveEdge = activeEdges.has(edgeKey);
    const isMutedEdge = routeIsActive && !isActiveEdge;
    const curveValue = index % 2 === 0 ? 56 : -56;

    elements.push({
      data: {
        id: `${flight.origin}_${flight.destination}_${index}`,
        source: flight.origin,
        target: flight.destination,
        label: `$${flight.price}`,
        curve: curveValue,
      },
      classes: [
        isActiveEdge ? "active-edge" : "",
        isMutedEdge ? "muted-edge" : "",
      ].filter(Boolean).join(" "),
    });
  });

  cyInstance = window.cytoscape({
    container,
    elements,
    layout: {
      name: "preset",
      fit: true,
      padding: 90,
    },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    wheelSensitivity: 0.2,
    minZoom: 0.2,
    maxZoom: 2.5,
    style: [
      {
        selector: "node",
        style: {
          width: 64,
          height: 64,
          label: "data(label)",
          color: "#ffffff",
          "font-size": 16,
          "font-weight": 800,
          "text-valign": "center",
          "text-halign": "center",
          "background-color": (ele) => (ele.data("visa") === "yes" ? "#3156c7" : "#1eb7ac"),
          "border-width": 2.5,
          "border-color": "rgba(255,255,255,0.22)",
          "overlay-opacity": 0,
          opacity: 1,
          "text-opacity": 1,
          "z-index": 20,
        },
      },
      {
        selector: "node.active-node",
        style: {
          "background-color": "#ff9500",
          "border-width": 5,
          "border-color": "#fff0cc",
          width: 76,
          height: 76,
          "font-size": 18,
          opacity: 1,
          "text-opacity": 1,
          "z-index": 999,
        },
      },
      {
        selector: "node.muted-node",
        style: {
          opacity: 0.18,
          "text-opacity": 0.35,
        },
      },
      {
        selector: "edge",
        style: {
          width: 3.2,
          "curve-style": "unbundled-bezier",
          "control-point-distances": "data(curve)",
          "control-point-weights": 0.5,
          "line-color": "rgba(120, 160, 255, 0.78)",
          "target-arrow-color": "rgba(120, 160, 255, 0.95)",
          "target-arrow-shape": "triangle",
          "arrow-scale": 1.15,
          label: "data(label)",
          color: "#ffffff",
          "font-size": 12,
          "font-weight": 700,
          "text-background-color": "rgba(7,16,35,0.96)",
          "text-background-opacity": 1,
          "text-background-padding": 5,
          "text-border-color": "rgba(97, 126, 199, 0.8)",
          "text-border-width": 1,
          "text-border-opacity": 1,
          "text-rotation": "autorotate",
          "text-margin-y": -12,
          "overlay-opacity": 0,
          opacity: 0.95,
          "z-index": 10,
        },
      },
      {
        selector: "edge.active-edge",
        style: {
          width: 7,
          "line-color": "#ff9500",
          "target-arrow-color": "#ff9500",
          opacity: 1,
          "z-index": 999,
        },
      },
      {
        selector: "edge.muted-edge",
        style: {
          opacity: 0.08,
        },
      },
    ],
  });

  cyInstance.fit(undefined, 90);
}

function drawWithSvg(container, cities, flights, activePath) {
  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }

  const { positions, width, height } = buildCircularPositions(cities, container);
  const activeEdges = buildActiveEdges(activePath);
  const routeIsActive = hasActivePath(activePath);
  const activeNodes = new Set(activePath || []);

  const svg = [];
  svg.push(`
    <svg
      viewBox="0 0 ${width} ${height}"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="graphBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#09182f" />
          <stop offset="100%" stop-color="#06111f" />
        </linearGradient>
        <filter id="glowActive" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="arrowBase" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L12,6 L0,12 z" fill="rgba(120,160,255,0.95)" />
        </marker>
        <marker id="arrowActive" markerWidth="14" markerHeight="14" refX="10" refY="7" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L14,7 L0,14 z" fill="#ff9500" />
        </marker>
      </defs>
      <rect width="${width}" height="${height}" rx="24" ry="24" fill="url(#graphBg)" />
  `);

  flights.forEach((flight, index) => {
    const originPoint = positions[flight.origin];
    const destinationPoint = positions[flight.destination];

    if (!originPoint || !destinationPoint) return;

    const isActive = activeEdges.has(`${flight.origin}->${flight.destination}`);
    const isMuted = routeIsActive && !isActive;
    const geometry = computeCurve(originPoint, destinationPoint, index + 1);

    svg.push(`
      <path
        d="${geometry.path}"
        fill="none"
        stroke="${isActive ? "#ff9500" : "rgba(120,160,255,0.78)"}"
        stroke-width="${isActive ? 7 : 3.2}"
        stroke-opacity="${isMuted ? 0.08 : 1}"
        marker-end="${isActive ? "url(#arrowActive)" : "url(#arrowBase)"}"
        stroke-linecap="round"
        ${isActive ? 'filter="url(#glowActive)"' : ""}
      />
      <rect
        x="${geometry.labelX - 24}"
        y="${geometry.labelY - 13}"
        width="48"
        height="26"
        rx="9"
        fill="rgba(7,16,35,0.96)"
        stroke="rgba(97,126,199,0.8)"
        opacity="${isMuted ? 0.15 : 1}"
      />
      <text
        x="${geometry.labelX}"
        y="${geometry.labelY + 4}"
        fill="#ffffff"
        font-size="12"
        font-weight="700"
        text-anchor="middle"
        font-family="Georgia"
        opacity="${isMuted ? 0.22 : 1}"
      >$${escapeXml(String(flight.price))}</text>
    `);
  });

  Object.keys(cities).forEach((code) => {
    const point = positions[code];
    if (!point) return;

    const isActive = activeNodes.has(code);
    const isMuted = routeIsActive && !isActive;
    const radius = isActive ? 36 : 31;
    const fill = isActive ? "#ff9500" : cities[code].requiresVisa ? "#3156c7" : "#1eb7ac";
    const stroke = isActive ? "#fff0cc" : "rgba(255,255,255,0.24)";

    svg.push(`
      <circle
        cx="${point.x}"
        cy="${point.y}"
        r="${radius}"
        fill="${fill}"
        stroke="${stroke}"
        stroke-width="${isActive ? 5 : 2.5}"
        opacity="${isMuted ? 0.18 : 1}"
        ${isActive ? 'filter="url(#glowActive)"' : ""}
      />
      <text
        x="${point.x}"
        y="${point.y + 5}"
        fill="#ffffff"
        font-size="16"
        font-weight="800"
        text-anchor="middle"
        font-family="Georgia"
        opacity="${isMuted ? 0.3 : 1}"
      >${escapeXml(code)}</text>
      <text
        x="${point.x}"
        y="${point.y + radius + 24}"
        fill="#eaf1ff"
        font-size="14"
        font-weight="700"
        text-anchor="middle"
        font-family="Georgia"
        opacity="${isMuted ? 0.26 : 0.98}"
      >${escapeXml(cities[code].name)}</text>
    `);
  });

  svg.push("</svg>");
  container.innerHTML = svg.join("");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}