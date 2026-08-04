# Kartenprojekt - Kartenvisualisierung mit historischen Kartendaten

Eine interaktive Karten-Anwendung mit OpenStreetMap, historischen Kartenflächen und zusätzlichen Punktmarkern für Orte oder Objekte. Die Daten werden aus CSV-Dateien importiert, über eine Python-Import-Schicht angereichert und in einer SQLite-Datenbank gespeichert. Die Weboberfläche wird mit OpenLayers und einer Express-API bereitgestellt.

## Features

- Interaktive OpenStreetMap-Karte im Frontend
- Darstellung historischer Kartenflächen als Overlays
- Punktmarker in Form klassischer Nadeln mit Clustering
- Filterung nach Jahr, Titel und Layer-Anzeige
- Popups mit Metadaten und Link zum Online-Katalog
- REST-API für Karten- und Punktdaten
- CSV-Import in SQLite inklusive Anreicherung über den SRU-Import des BSZ

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose
- oder: Node.js 18+, npm, Python 3.10+, pip

### Mit Docker

```bash
docker compose up --build -d
```

Die App ist dann verfügbar unter: http://localhost:3000

### Lokal (ohne Docker)

```bash
cd backend
pip install -r requirements.txt
npm install
python3 import.py
node server.js
```

Danach öffne: http://localhost:3000

### Konfiguration

Für den Import über den SRU-Service wird eine Datei mit Umgebungsvariablen benötigt. Eine Vorlage liegt als [backend/.env.example](backend/.env.example) vor.

Beispiel:

```bash
SRU_USER=your-user
SRU_PASS=your-password
SRU_DELAY_MS=250ms
```

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

- [backend/data/kartendaten.csv](backend/data/kartendaten.csv) für Kartenflächen
- [backend/data/punktedaten.csv](backend/data/punktedaten.csv) für Punktmarker

### Karten-CSV-Format

```text
idn
1931734666
```

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
  idn INTEGER UNIQUE,
  titel TEXT,
  herausgeber TEXT,
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
  idn INTEGER,
  titel TEXT,
  jahr INTEGER,
  breitengrad REAL,
  laengengrad REAL,
  fundstelle TEXT,
  reihe TEXT
);
```

## Projektstruktur

```text
getmapped/
├── backend/
│   ├── import.py              # Python-Import und SRU-Anreicherung
│   ├── import.js              # Legacy-Node-Import (nicht aktiv)
│   ├── server.js              # Express-Backend und API
│   ├── database_config.py     # SQLite-Tabellen und Datenbanklogik
│   ├── package.json           # Node-Abhängigkeiten
│   ├── requirements.txt       # Python-Abhängigkeiten
│   ├── start.sh               # Startskript für Docker
│   └── data/
│       ├── kartendaten.csv    # Karten-Daten
│       ├── punktedaten.csv    # Punkt-Daten
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
python3 import.py
```

### Datenbank neu aufbauen

```bash
cd backend
rm -f data/maps.db
python3 import.py
```

### Import auslösen

```bash
SKIP_IMPORT=false docker compose up -d
SKIP_IMPORT=maps docker compose up -d
SKIP_IMPORT=points docker compose up -d
```

## Deployment

```bash
docker compose build
docker compose up -d
```

## Lizenz

MIT