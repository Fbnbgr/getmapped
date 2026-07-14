import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = await open({
  filename: path.join(__dirname, "data", "maps.db"),
  driver: sqlite3.Database
});

function isMeaningfulMapExtent(row) {
  const west = Number(row.west);
  const ost = Number(row.ost);
  const nord = Number(row.nord);
  const sued = Number(row.sued);

  if (![west, ost, nord, sued].every(Number.isFinite)) {
    return false;
  }

  const width = Math.abs(ost - west);
  const height = Math.abs(nord - sued);

  if (width <= 0 || height <= 0) {
    return false;
  }

  if (width >= 140 || height >= 100 || width * height >= 8000) {
    return false;
  }

  return true;
}

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/maps", async (req, res) => {
  const rows = await db.all("SELECT * FROM maps");
  const filteredRows = rows.filter(isMeaningfulMapExtent);
  res.json(filteredRows);
});

app.get("/api/points", async (req, res) => {
  const rows = await db.all("SELECT * FROM points");
  res.json(rows);
});

app.get("/api/points-with-authors", async (req, res) => {
  const points = await db.all("SELECT * FROM points");
  const result = [];
  for (const point of points) {
    const authors = await db.all(
      "SELECT autor FROM point_authors WHERE point_id = ? ORDER BY id",
      [point.id]
    );
    result.push({
      ...point,
      autoren: authors.map(a => a.autor)
    });
  }
  res.json(result);
});

app.get("/api/point/:id/authors", async (req, res) => {
  const { id } = req.params;
  const authors = await db.all(
    "SELECT autor FROM point_authors WHERE point_id = ? ORDER BY id",
    [id]
  );
  res.json(authors.map(a => a.autor));
});

app.get("/api/maps/by-year", async (req, res) => {
  const { from, to } = req.query;
  const rows = await db.all(
    "SELECT * FROM maps WHERE jahr BETWEEN ? AND ?",
    [from, to]
  );
  res.json(rows);
});

app.listen(3000, () => {
  console.log("API läuft auf http://localhost:3000");
});
