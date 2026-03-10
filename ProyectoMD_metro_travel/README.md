# ProyectoMD_metro_travel

Proyecto web para calcular rutas de costo mínimo y rutas con menos escalas usando Dijkstra.

## Cambios incluidos

- Arriba solo aparece una única sección de **Ruta:** con el resultado final.
- El criterio sigue siendo elegible: **Menor costo** o **Menos escalas**.
- El título principal grande ahora es **Optimizador de rutas aéreas con Dijkstra y visualización clara del grafo**.
- Se mejoró el espaciado entre módulos.
- La visualización del grafo usa **Cytoscape** cuando el navegador puede cargar la librería desde CDN.
- Si Cytoscape no carga, el proyecto sigue funcionando con una **vista SVG de respaldo** integrada.

## Cómo ejecutarlo

```bash
cd ProyectoMD_metro_travel
python -m http.server 8000
```

Abre:

```text
http://localhost:8000
```

## Archivos principales

- `index.html`: interfaz
- `styles.css`: estilos
- `js/app.js`: lógica principal de la UI
- `js/dataLoader.js`: carga y validación de datos
- `js/graphLogic.js`: grafo y Dijkstra
- `js/graphView.js`: visualización del grafo
- `data/cities.json`: ciudades
- `data/flights.csv`: vuelos

## Nota

La lógica de rutas está totalmente local. Solo la carga de Cytoscape depende de internet; si no está disponible, entra automáticamente la visualización SVG integrada.
