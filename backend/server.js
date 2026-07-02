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

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/maps", async (req, res) => {
  const rows = await db.all("SELECT * FROM maps");
  res.json(rows);
});

app.get("/api/points", async (req, res) => {
  const rows = await db.all("SELECT * FROM points");
  res.json(rows);
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
