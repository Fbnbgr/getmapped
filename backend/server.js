import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";

const app = express();
app.use(cors());

const db = await open({
  filename: "./maps.db",
  driver: sqlite3.Database
});

app.get("/api/maps", async (req, res) => {
  const rows = await db.all("SELECT * FROM maps");
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
