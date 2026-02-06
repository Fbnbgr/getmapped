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
  )
`);

const csvPath = path.join(__dirname, "daten.csv");
if (!fs.existsSync(csvPath)) {
  console.error("CSV nicht gefunden:", csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf-8");

const lines = csv.split("\n").slice(1); // Header überspringen

for (const line of lines) {
  if (!line.trim()) continue;

  const [idn, koord, massstab, jahr, titel] = line.split(";");

  // Format: $a12.34$b13.45$c52.1$d51.2
  const parts = koord.split("$").filter(Boolean);
  const west = Number(parts.find(p => p.startsWith("a")).slice(1));
  const ost  = Number(parts.find(p => p.startsWith("b")).slice(1));
  const nord = Number(parts.find(p => p.startsWith("c")).slice(1));
  const sued = Number(parts.find(p => p.startsWith("d")).slice(1));

  await db.run(
    `INSERT OR IGNORE INTO maps (idn, titel, jahr, massstab, west, ost, nord, sued)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [idn, titel, jahr, massstab, west, ost, nord, sued]
  );
}

console.log("Import fertig");
process.exit(0);
