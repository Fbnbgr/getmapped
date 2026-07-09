import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";

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
    herausgeber TEXT,
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

  // Decimal degrees like "49.123" or with sign
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return Number.parseFloat(text);
  }

  // DMS-like: e.g. "E 013 15" or "N 009 30"
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    let dir = parts[0][0].toUpperCase();
    let deg = Number(parts[1].replace(/^0+/, ""));
    let min = parts.length >= 3 ? Number(parts[2].replace(/^0+/, "")) : 0;
    if (Number.isNaN(deg)) return null;
    if (Number.isNaN(min)) min = 0;
    let dec = deg + (min / 60);
    if (dir === "S" || dir === "W") dec = -dec;
    return dec;
  }

  // Fallback: try to extract a trailing number
  const m = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number.parseFloat(m[1]) : null;
}

const SRU_BASE = "https://sru.bsz-bw.de/cbss!xpn=online";
// Load secrets from backend/.env if present
dotenv.config({ path: path.join(__dirname, ".env") });
const SRU_USER = process.env.SRU_USER || "";
const SRU_PASS = process.env.SRU_PASS || "";
const SRU_DELAY_MS = Number.parseInt(process.env.SRU_DELAY_MS || "250", 10);
const EFFECTIVE_SRU_DELAY_MS = Number.isFinite(SRU_DELAY_MS) && SRU_DELAY_MS > 0 ? SRU_DELAY_MS : 0;

function buildSruUrl(ppn) {
  const params = new URLSearchParams({
    version: "1.1",
    operation: "searchRetrieve",
    maximumRecords: "1",
    recordSchema: "picaxml",
    recordPacking: "xml",
    query: `pica.ppn=${ppn}`
  });
  if (SRU_USER) params.set("x-username", SRU_USER);
  if (SRU_PASS) params.set("x-password", SRU_PASS);
  return `${SRU_BASE}?${params.toString()}`;
}

function extractSubfieldValue(df, code) {
  if (!df) return null;
  const sf = df.subfield;
  if (!sf) return null;
  // subfield can be array or object
  const items = Array.isArray(sf) ? sf : [sf];
  for (const s of items) {
    const c = s.code ?? s['@_code'] ?? s['code'];
    const val = s.text ?? s['#text'] ?? s['#text'] ?? s[''] ?? s;
    if ((c || "").toString() === code) return typeof val === 'object' ? (val['#text'] || val['text']) : val;
  }
  return null;
}

function parseCsvCells(line) {
  return line
    .replace(/^\uFEFF/, "")
    .split(";")
    .map((cell) => cell.trim());
}

function normalizeBoundingBox(west, ost, nord, sued) {
  const westValue = Number.parseFloat(west);
  const ostValue = Number.parseFloat(ost);
  const nordValue = Number.parseFloat(nord);
  const suedValue = Number.parseFloat(sued);

  const normalizedWest = Number.isFinite(westValue) ? westValue : null;
  const normalizedOst = Number.isFinite(ostValue) ? ostValue : null;
  const normalizedNord = Number.isFinite(nordValue) ? nordValue : null;
  const normalizedSued = Number.isFinite(suedValue) ? suedValue : null;

  if (normalizedWest === null || normalizedOst === null || normalizedNord === null || normalizedSued === null) {
    return { west: normalizedWest, ost: normalizedOst, nord: normalizedNord, sued: normalizedSued };
  }

  if (normalizedWest > normalizedOst) {
    return {
      west: normalizedOst,
      ost: normalizedWest,
      nord: normalizedNord,
      sued: normalizedSued
    };
  }

  return {
    west: normalizedWest,
    ost: normalizedOst,
    nord: normalizedNord,
    sued: normalizedSued
  };
}

function isMeaningfulMapExtent(west, ost, nord, sued) {
  const westValue = Number.parseFloat(west);
  const ostValue = Number.parseFloat(ost);
  const nordValue = Number.parseFloat(nord);
  const suedValue = Number.parseFloat(sued);

  if (![westValue, ostValue, nordValue, suedValue].every(Number.isFinite)) return false;

  const width = Math.abs(ostValue - westValue);
  const height = Math.abs(nordValue - suedValue);

  if (width <= 0 || height <= 0) return false;
  if (width >= 140 || height >= 100 || width * height >= 8000) return false;

  return true;
}

async function fetchSruRecord(ppn) {
  let timeoutId = null;
  try {
    const url = buildSruUrl(ppn);
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error("SRU request failed for", ppn, res.status);
      return null;
    }
    const txt = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 'text' });
    const obj = parser.parse(txt);

    // try to locate the datafield array in the parsed object
    let datafields = null;
    try {
      const resp = obj['zs:searchRetrieveResponse'] || obj['searchRetrieveResponse'] || obj;
      const records = resp['zs:records'] || resp['records'] || resp;
      const record = (records && (records['zs:record'] || records['record'])) || resp['zs:record'] || resp['record'];
      const recordData = record && (record['zs:recordData'] || record['recordData']);
      const rec = recordData && (recordData.record || recordData);
      datafields = rec && rec.datafield;
    } catch (e) {
      datafields = null;
    }

    if (!datafields) return null;

    const dfs = Array.isArray(datafields) ? datafields : [datafields];

    const getDf = (tag) => dfs.find(d => (d.tag ?? d['@_tag'] ?? d[''] ?? '').toString() === tag);

    const jahr = extractSubfieldValue(getDf('011@'), 'a') || extractSubfieldValue(getDf('011'), 'a');
    const titel = extractSubfieldValue(getDf('021A'), 'a') || extractSubfieldValue(getDf('021A'), 'A') || extractSubfieldValue(getDf('021A'), '');
    const herausgeber = extractSubfieldValue(getDf('029F'), '8') || extractSubfieldValue(getDf('029F'), '');
    const massstab = extractSubfieldValue(getDf('035E'), 'a') || extractSubfieldValue(getDf('035E'), 'g') || extractSubfieldValue(getDf('035E'), '');

    const coordDf = getDf('035G');
    let west = null, ost = null, nord = null, sued = null;
    if (coordDf) {
      const sub = coordDf.subfield;
      const items = Array.isArray(sub) ? sub : [sub];
      for (const s of items) {
        const c = s.code ?? s['@_code'] ?? s['code'];
        const val = s.text ?? s['#text'] ?? s;
        if (!c || !val) continue;
        const v = (typeof val === 'object') ? (val['#text'] || val['text']) : val;
        if (c === 'a') west = parseCoordinate(v);
        if (c === 'b') ost = parseCoordinate(v);
        if (c === 'c') nord = parseCoordinate(v);
        if (c === 'd') sued = parseCoordinate(v);
      }
    }

    return { jahr, titel, herausgeber, massstab, west, ost, nord, sued };
  } catch (err) {
    if (err && err.name === "AbortError") {
      console.warn("SRU request timed out for", ppn);
    } else {
      console.error('Error fetching/parsing SRU for', ppn, err && err.message);
    }
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function mapExists(idn) {
  const row = await db.get("SELECT 1 FROM maps WHERE idn = ? LIMIT 1", [idn]);
  return Boolean(row);
}

async function pointExists(idn) {
  const row = await db.get("SELECT 1 FROM points WHERE idn = ? LIMIT 1", [idn]);
  return Boolean(row);
}

async function importMaps() {
  const csvPath = path.join(__dirname, "data/kartendaten.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV nicht gefunden:", csvPath);
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split(/\r?\n/).slice(1);

  let processedCount = 0;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;

    const [idn] = parseCsvCells(line);
    if (!idn || /^idn$/i.test(idn)) continue;

    processedCount += 1;

    if (await mapExists(idn)) {
      console.log(`[import] ID ${idn} bereits in maps vorhanden – überspringe`);
      continue;
    }

    const rec = await fetchSruRecord(idn);

    if (processedCount % 100 === 0) {
      console.log(`[import] ${processedCount} Karten verarbeitet`);
    }

    if (EFFECTIVE_SRU_DELAY_MS > 0 && index < lines.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, EFFECTIVE_SRU_DELAY_MS));
    }
    if (!rec) {
      console.warn('Keine SRU-Daten für', idn, '- überspringe');
      continue;
    }

    if (!isMeaningfulMapExtent(rec.west, rec.ost, rec.nord, rec.sued)) {
      console.log(`[import] Überspringe ${idn} wegen unvollständiger oder zu großer Ausdehnung`);
      continue;
    }

    const normalizedBox = normalizeBoundingBox(rec.west, rec.ost, rec.nord, rec.sued);

    await db.run(
      `INSERT OR IGNORE INTO maps (idn, titel, herausgeber, jahr, massstab, west, ost, nord, sued)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idn, rec.titel || null, rec.herausgeber || null, rec.jahr ? Number(rec.jahr) : null, rec.massstab || null, normalizedBox.west, normalizedBox.ost, normalizedBox.nord, normalizedBox.sued]
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

    const [idn, breitengrad, laengengrad, titel] = parseCsvCells(line);
    if (!idn || !breitengrad || !laengengrad || /^idn$/i.test(idn)) continue;

    if (await pointExists(idn)) {
      console.log(`[import] ID ${idn} bereits in points vorhanden – überspringe`);
      continue;
    }

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
