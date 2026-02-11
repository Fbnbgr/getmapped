# Kartenprojekt - Maps Application (main)

Eine interaktive Kartenverwaltungs-Web-Anwendung mit Node.js Backend und SQLite-Datenbank.

## Features

- **Interaktive Karte** (Frontend HTML/CSS/JS)
- **REST API** für Kartendaten (Node.js/Express)
- **SQLite Datenbank** für strukturierte Kartendaten
- **Docker Setup** für einfaches Deployment
- **CSV Import** von Kartendaten

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose
- oder: Node.js 16+, SQLite3

### Mit Docker

```bash
docker-compose up -d
```

Die App ist verfügbar unter: **http://localhost:3000**

### Lokal (ohne Docker)

```bash
# Backend-Dependencies installieren
cd backend
npm install

# Kartendaten importieren (CSV → SQLite)
npm run import

# Server starten
npm start
```

Dann öffne: **http://localhost:3000**

## API-Endpoints

### Maps abrufen

```bash
GET /api/maps
```

### Nach Jahrbereich filtern

```bash
GET /api/maps/by-year?from=1800&to=1850
```

Parameter:
- `from`: Startjahr (optional)
- `to`: Endjahr (optional)

## Datenstruktur

### Kartendataset (maps.db)

```sql
CREATE TABLE maps (
  id INTEGER PRIMARY KEY,
  idn TEXT UNIQUE,              -- DNB Identifier
  titel TEXT,                   -- Kartentitel
  jahr INTEGER,                 -- Erscheinungsjahr
  massstab TEXT,                -- Maßstab
  west REAL,                    -- Längengradwest
  ost REAL,                     -- Längengradost
  nord REAL,                    -- Breitengradnord
  sued REAL                     -- Breitegradsüd
)
```

### CSV-Format (Eingabe)

```
idn;koord;massstab;jahr;titel
112946167X;$a12.34$b13.45$c52.1$d51.2;1:100000;1850;Karte Leipzig
```

Koordinaten-Format: `$a<west>$b<ost>$c<nord>$d<sued>`, wobei die Reihenfolge nicht eingehalten werden muss solange die Unterfelder richtig zugeordnet sind

## Projektstruktur

```
kartenprojekt/
├── backend/
│   ├── server.js              # Express API
│   ├── import.js              # CSV → SQLite Importer
│   ├── daten.csv              # Eingabedaten
│   ├── data/
│   │   └── maps.db            # SQLite Datenbank
│   ├── package.json           # Dependencies
│   └── start.sh               # Linux Startup Script
├── frontend/
│   ├── index.html             # Hauptseite
│   ├── main.js                # JavaScript Logic
│   └── style.css              # Styling
├── docker-compose.yml         # Docker Setup
├── Dockerfile                 # Image Definition
└── README.md                  # Diese Datei
```

## Umgebungsvariablen

```bash
PORT=3000                   # Server Port
NODE_ENV=production         # Umgebung
```

## Troubleshooting

### Port 3000 ist bereits belegt

```bash
docker-compose down         # Container stoppen
# oder lokal
lsof -i :3000              # Process finden
kill -9 <PID>              # Prozess beenden
```

### CSV-Import fehlgeschlagen

```bash
# Dateiformat prüfen
cat backend/daten.csv

# Manueller Re-Import
cd backend && npm run import
```

### Datenbankfehler

```bash
# SQLite Datei löschen (wird neu erstellt)
rm backend/data/maps.db
npm run import
```

## Deployment

### Mit Docker (empfohlen)

```bash
docker-compose build
docker-compose up -d
```

### Systemd Service (Linux)

```bash
# /etc/systemd/system/kartenprojekt.service
[Unit]
Description=Kartenprojekt Maps App
After=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/docker-compose -f /path/to/docker-compose.yml up
Restart=always

[Install]
WantedBy=multi-user.target
```

## Entwicklung

```bash
# Backend testen
cd backend
npm test

# Live reload (mit nodemon)
npm run dev
```

## Lizenz

MIT
