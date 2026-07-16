import sqlite3
import os
import logging

# logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db = os.path.join(BASE_DIR, os.getenv("DB", "data/maps.db"))

def database_configuration():
    with sqlite3.connect(db) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS maps (
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
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idn INTEGER,
                titel TEXT,
                jahr INTEGER,
                breitengrad REAL,
                laengengrad REAL,
                fundstelle TEXT,
                reihe TEXT
                )
            ''')
        conn.commit()
    logger.info("Datenbanken angelegt/bereits vorhanden")
    return

# prüft Existenz einer gegebenen idn gegen die bestehenden Tabellen maps und points
def database_entry_exists(idn, breitengrad, laengengrad):
    with sqlite3.connect(db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM maps WHERE idn = ? UNION SELECT 1 FROM points WHERE idn = ? AND breitengrad = ? AND laengengrad = ?", (idn, idn, breitengrad, laengengrad))
        row = cursor.fetchone()
    return row is not None

# schreibt einen neuen Datensatz in die Tabelle maps
def write_to_table_maps(data):
    if not database_entry_exists(data["idn"], data["breitengrad"], data["laengengrad"]):
        with sqlite3.connect(db) as conn:
            cursor = conn.cursor()
            koordinaten = data.get("koordinaten", {})
            cursor.execute(
                "INSERT INTO maps (idn, titel, herausgeber, jahr, massstab, west, ost, nord, sued) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (data["idn"], data["titel"], data["herausgeber"], data["jahr"], data["massstab"], koordinaten.get("west"), koordinaten.get("ost"), koordinaten.get("nord"), koordinaten.get("sued"))
            )
            conn.commit()
            logger.info(f"IDN {data['idn']} hinzugefügt")
    else:
        logger.info(f"IDN {data['idn']} bereits vorhanden")
    return

# schreibt einen neuen Datensatz in die Tabelle points
def write_to_table_points(data):
    with sqlite3.connect(db) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO points (idn, titel, jahr, breitengrad, laengengrad, fundstelle, reihe) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (data["idn"], data["titel"], data["jahr"], data["breitengrad"], data["laengengrad"], data["fundstelle"], data["reihe"])
        )
        conn.commit()
        logger.info(f"IDN {data['idn']} hinzugefügt")
    return

def read_from_database(idn):
    with sqlite3.connect(db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM points WHERE idn = ?", (idn, ))
        result = cursor.fetchall()
    return result



