import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data/maps.db");

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS maps (
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

  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idn TEXT UNIQUE,
    titel TEXT,
    breitengrad REAL,
    laengengrad REAL
  )
`);

function parseCoordinate(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const direction = text[0];
  const numeric = Number.parseFloat(text.slice(1));

  if (Number.isNaN(numeric)) return null;

  if (direction === "S" || direction === "W") {
    return -numeric;
  }

  return numeric;
}

async function importMaps() {
  const csvPath = path.join(__dirname, "data/kartendaten.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV nicht gefunden:", csvPath);
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split(/\r?\n/).slice(1);

  for (const line of lines) {
    if (!line.trim()) continue;

    const [idn, koord, massstab, jahr, titel] = line.split(";");
    if (!idn || !koord) continue;

    const parts = koord.split("$").filter(Boolean);
    const westPart = parts.find((p) => p.startsWith("a"));
    const ostPart = parts.find((p) => p.startsWith("b"));
    const nordPart = parts.find((p) => p.startsWith("c"));
    const suedPart = parts.find((p) => p.startsWith("d"));

    const west = westPart ? Number(westPart.slice(1)) : null;
    const ost = ostPart ? Number(ostPart.slice(1)) : null;
    const nord = nordPart ? Number(nordPart.slice(1)) : null;
    const sued = suedPart ? Number(suedPart.slice(1)) : null;

    await db.run(
      `INSERT OR IGNORE INTO maps (idn, titel, jahr, massstab, west, ost, nord, sued)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idn, titel, Number(jahr), massstab, west, ost, nord, sued]
    );
  }
}

async function importPoints() {
  const csvPath = path.join(__dirname, "data/punktdaten.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV nicht gefunden:", csvPath);
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split(/\r?\n/).slice(1);

  for (const line of lines) {
    if (!line.trim()) continue;

    const [idn, breitengrad, laengengrad, titel] = line.split(";");
    if (!idn || !breitengrad || !laengengrad) continue;

    const latitude = parseCoordinate(breitengrad);
    const longitude = parseCoordinate(laengengrad);
    if (latitude === null || longitude === null) continue;

    await db.run(
      `INSERT OR IGNORE INTO points (idn, titel, breitengrad, laengengrad)
       VALUES (?, ?, ?, ?)`,
      [idn, titel, latitude, longitude]
    );
  }
}

await importMaps();
await importPoints();

console.log("Import fertig");
process.exit(0);
