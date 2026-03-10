import csv
import io
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DEFAULT_CITIES_PATH = os.path.join(DATA_DIR, "cities.json")
DEFAULT_FLIGHTS_PATH = os.path.join(DATA_DIR, "flights.csv")
HOST = os.environ.get("APP_HOST", "127.0.0.1")
PORT = int(os.environ.get("APP_PORT", "8000"))


class Graph:
    def __init__(self, cities, flights):
        self.cities = cities
        self.flights = flights
        self.adj = {code: [] for code in cities}

        for flight in flights:
            origin = flight["origin"]
            destination = flight["destination"]
            price = flight["price"]

            if origin not in self.cities or destination not in self.cities:
                continue

            self.adj[origin].append(
                {
                    "to": destination,
                    "price": price,
                }
            )

    def dijkstra(self, start, end, has_visa, mode="cost"):
        if start not in self.cities or end not in self.cities:
            return {
                "found": False,
                "reason": "Origen o destino inválido.",
            }

        if not has_visa and (
            self.cities[start]["requiresVisa"] or self.cities[end]["requiresVisa"]
        ):
            return {
                "found": False,
                "reason": "Sin visa no se puede salir desde o llegar a una ciudad que requiere visa.",
            }

        dist = {code: float("inf") for code in self.cities}
        prev = {code: None for code in self.cities}
        visited = set()

        dist[start] = 0

        while len(visited) < len(self.cities):
            current = None
            best_value = float("inf")

            for code in self.cities:
                if code not in visited and dist[code] < best_value:
                    best_value = dist[code]
                    current = code

            if current is None:
                break

            if current == end:
                break

            visited.add(current)

            for edge in self.adj.get(current, []):
                neighbor = edge["to"]

                if neighbor in visited:
                    continue

                if not has_visa and self.cities[neighbor]["requiresVisa"]:
                    continue

                weight = edge["price"] if mode == "cost" else 1
                candidate = dist[current] + weight

                if candidate < dist[neighbor]:
                    dist[neighbor] = candidate
                    prev[neighbor] = current

        if dist[end] == float("inf"):
            return {
                "found": False,
                "reason": "No existe una ruta válida con las restricciones seleccionadas.",
            }

        path = []
        cursor = end

        while cursor is not None:
            path.insert(0, cursor)
            cursor = prev[cursor]

        total_cost = 0
        for index in range(len(path) - 1):
            total_cost += self.get_edge_cost(path[index], path[index + 1])

        segments = max(0, len(path) - 1)
        stops = max(0, len(path) - 2)

        return {
            "found": True,
            "path": path,
            "totalCost": total_cost,
            "segments": segments,
            "stops": stops,
            "score": dist[end],
            "mode": mode,
        }

    def get_edge_cost(self, origin, destination):
        for edge in self.adj.get(origin, []):
            if edge["to"] == destination:
                return edge["price"]
        return 0


def parse_cities_json(text):
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        raise ValueError("El archivo de ciudades no contiene un JSON válido.")

    if not isinstance(parsed, list):
        raise ValueError("El archivo de ciudades debe contener un arreglo JSON.")

    return parsed


def parse_flights_csv(text):
    cleaned = text.strip()

    if not cleaned:
        raise ValueError("El archivo CSV de vuelos está vacío.")

    reader = csv.reader(io.StringIO(cleaned))
    rows = [row for row in reader if any(cell.strip() for cell in row)]

    if len(rows) < 2:
        raise ValueError("El archivo CSV de vuelos no tiene datos suficientes.")

    headers = [cell.strip().lower() for cell in rows[0]]

    try:
        origin_index = headers.index("origin")
        destination_index = headers.index("destination")
        price_index = headers.index("price")
    except ValueError:
        raise ValueError("El CSV de vuelos debe tener columnas: origin,destination,price")

    flights = []

    for row_number, row in enumerate(rows[1:], start=2):
        if max(origin_index, destination_index, price_index) >= len(row):
            raise ValueError(f"Fila inválida en el CSV de vuelos: {row_number}")

        origin = row[origin_index].strip()
        destination = row[destination_index].strip()
        raw_price = row[price_index].strip()

        if not origin or not destination:
            raise ValueError(f"Fila inválida en el CSV de vuelos: {row_number}")

        try:
            numeric_price = float(raw_price)
        except ValueError:
            raise ValueError(f"Fila inválida en el CSV de vuelos: {row_number}")

        flights.append(
            {
                "origin": origin,
                "destination": destination,
                "price": int(numeric_price) if numeric_price.is_integer() else numeric_price,
            }
        )

    return flights


def normalize_cities(cities_array):
    cities = {}

    for item in cities_array:
        if not isinstance(item, dict):
            raise ValueError("Cada ciudad debe ser un objeto JSON válido.")

        code = str(item.get("code", "")).strip()
        name = str(item.get("name", "")).strip()

        if not code or not name:
            raise ValueError("Cada ciudad debe tener code y name.")

        cities[code] = {
            "code": code,
            "name": name,
            "requiresVisa": bool(item.get("requiresVisa", False)),
        }

    if not cities:
        raise ValueError("No hay ciudades válidas en el archivo JSON.")

    return cities


def parse_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "si", "sí", "on"}


def load_default_cities():
    with open(DEFAULT_CITIES_PATH, "r", encoding="utf-8") as file:
        return parse_cities_json(file.read())


def load_default_flights():
    with open(DEFAULT_FLIGHTS_PATH, "r", encoding="utf-8") as file:
        return parse_flights_csv(file.read())


class AppState:
    def __init__(self):
        self.use_defaults()

    def use_defaults(self):
        self.set_data(load_default_cities(), load_default_flights())

    def set_data(self, cities_array, flights):
        self.cities = normalize_cities(cities_array)
        self.flights = flights
        self.graph = Graph(self.cities, self.flights)

    def first_city_code(self):
        codes = sorted(self.cities.keys())
        return codes[0] if codes else ""

    def second_city_code(self):
        codes = sorted(self.cities.keys())
        if len(codes) < 2:
            return codes[0] if codes else ""
        return codes[1]

    def payload(self):
        return {
            "cities": self.cities,
            "flights": self.flights,
            "meta": {
                "defaultOrigin": self.first_city_code(),
                "defaultDestination": self.second_city_code(),
                "citiesCount": len(self.cities),
                "flightsCount": len(self.flights),
            },
        }


STATE = AppState()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(content_length) if content_length > 0 else b""

        if not raw:
            return {}

        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            raise ValueError("El cuerpo de la petición no contiene un JSON válido.")

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/data":
            self.send_json(
                {
                    "ok": True,
                    "message": "Datos disponibles.",
                    **STATE.payload(),
                }
            )
            return

        return super().do_GET()

    def do_POST(self):
        try:
            if self.path == "/api/data":
                payload = self.read_json_body()

                cities_text = payload.get("citiesText")
                flights_text = payload.get("flightsText")

                cities_array = parse_cities_json(cities_text) if cities_text else load_default_cities()
                flights = parse_flights_csv(flights_text) if flights_text else load_default_flights()

                STATE.set_data(cities_array, flights)

                self.send_json(
                    {
                        "ok": True,
                        "message": "Datos cargados correctamente.",
                        **STATE.payload(),
                    }
                )
                return

            if self.path == "/api/reset":
                STATE.use_defaults()
                self.send_json(
                    {
                        "ok": True,
                        "message": "Datos base restaurados.",
                        **STATE.payload(),
                    }
                )
                return

            if self.path == "/api/route":
                payload = self.read_json_body()

                origin = str(payload.get("origin", "")).strip()
                destination = str(payload.get("destination", "")).strip()
                has_visa = parse_bool(payload.get("hasVisa", False))
                criterion = str(payload.get("criterion", "cost")).strip().lower()

                if criterion not in {"cost", "stops"}:
                    criterion = "cost"

                if not origin or not destination:
                    self.send_json(
                        {
                            "ok": False,
                            "message": "Debes seleccionar origen y destino.",
                        },
                        status=400,
                    )
                    return

                if origin == destination:
                    self.send_json(
                        {
                            "ok": False,
                            "message": "El origen y el destino no pueden ser iguales.",
                        },
                        status=400,
                    )
                    return

                result = STATE.graph.dijkstra(origin, destination, has_visa, criterion)

                if not result["found"]:
                    self.send_json(
                        {
                            "ok": False,
                            "message": result["reason"],
                            "result": result,
                        }
                    )
                    return

                self.send_json(
                    {
                        "ok": True,
                        "message": "Ruta calculada correctamente.",
                        "result": result,
                    }
                )
                return

            self.send_json(
                {
                    "ok": False,
                    "message": "Ruta no encontrada.",
                },
                status=404,
            )

        except ValueError as error:
            self.send_json(
                {
                    "ok": False,
                    "message": str(error),
                },
                status=400,
            )
        except Exception:
            self.send_json(
                {
                    "ok": False,
                    "message": "Ocurrió un error interno en el servidor.",
                },
                status=500,
            )


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Servidor disponible en http://{HOST}:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()