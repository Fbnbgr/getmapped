# Kartenprojekt - Maps Application

Eine interaktive Karten-Anwendung mit OpenStreetMap, Kartenflächen aus historischen Kartendaten und zusätzlichen Punktmarkern für Orts- oder Objektinformationen.

## Features

- Interaktive OpenStreetMap-Karte im Frontend
- Darstellung historischer Kartenflächen als Overlays
- Zusätzliche Punktmarker in Form klassischer Nadeln
- Filterung nach Jahr und Titeln
- Popups mit Metadaten und Link zum Online-Katalog
- REST-API für Karten- und Punktdaten
- CSV-Import in eine SQLite-Datenbank

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose
- oder: Node.js 18+, npm

### Mit Docker

```bash
docker compose up -d
```

Die App ist dann verfügbar unter: http://localhost:3000

### Lokal (ohne Docker)

```bash
cd backend
npm install
node import.js
node server.js
```

Danach öffne: http://localhost:3000

## API-Endpoints

### Karten abrufen

```bash
GET /api/maps
```

### Punkte abrufen

```bash
GET /api/points
```

### Nach Jahrbereich filtern

```bash
GET /api/maps/by-year?from=1800&to=1850
```

Parameter:
- `from`: Startjahr
- `to`: Endjahr

## Datenquellen

Die Anwendung importiert zwei CSV-Dateien aus dem Backend-Ordner:

- [backend/kartendaten.csv](backend/kartendaten.csv) für Kartenflächen
- [backend/punktdaten.csv](backend/punktdaten.csv) für Punktmarker

### Karten-CSV-Format

```text
idn;koord;massstab;jahr;titel
1931734666;$a13.68$b13.89$c51.12$d51.01;1:25000;1890;Topographische Karte Dresden
```

Koordinatenformat:
- `$a<west>$b<ost>$c<nord>$d<sued>`
- Die Reihenfolge der Felder kann variieren, solange die Unterfelder korrekt zugeordnet sind.

### Punkt-CSV-Format

```text
idn;Breitengrad;Längengrad;Titel
1882034147;S4.10;O144.52;Die Nubia-Awar an der Hansa-Bucht in Nordost-Neuguinea
```

Die Werte werden in die Datenbank als Breitengrad und Längengrad übernommen und als Marker auf der Karte dargestellt.

## Datenbankstruktur

### Tabelle `maps`

```sql
CREATE TABLE maps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idn TEXT UNIQUE,
  titel TEXT,
  jahr INTEGER,
  massstab TEXT,
  west REAL,
  ost REAL,
  nord REAL,
  sued REAL
);
```

### Tabelle `points`

```sql
CREATE TABLE points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idn TEXT UNIQUE,
  titel TEXT,
  breitengrad REAL,
  laengengrad REAL
);
```

## Projektstruktur

```text
getmapped/
├── backend/
│   ├── import.js              # CSV → SQLite Importer
│   ├── server.js              # Express-Backend und API
│   ├── kartendaten.csv        # Karten-Daten
│   ├── punktdaten.csv        # Punkt-Daten
│   ├── package.json           # Abhängigkeiten
│   └── data/
│       └── maps.db            # SQLite-Datenbank
├── frontend/
│   ├── index.html             # Hauptseite
│   ├── main.js                # Kartenlogik, Filter und Popups
│   └── style.css              # Styling
├── docker-compose.yml         # Docker-Setup
├── Dockerfile                 # Image-Definition
└── README.md                  # Diese Datei
```

## Troubleshooting

### Port 3000 ist bereits belegt

```bash
docker compose down
# oder lokal
lsof -i :3000
kill -9 <PID>
```

### Import fehlgeschlagen

```bash
cd backend
node import.js
```

### Datenbank neu aufbauen

```bash
cd backend
rm -f data/maps.db
node import.js
```

## Deployment

```bash
docker compose build
docker compose up -d
```

## Lizenz

MIT
