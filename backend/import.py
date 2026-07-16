import os
import csv
from pathlib import Path
from dotenv import load_dotenv
import logging
from lxml import etree
import requests
import database_config as db
import time

load_dotenv()

# logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# SRU setup
SRU_BASE = "https://sru.bsz-bw.de/cbss!xpn=online"
SRU_USER = os.getenv("SRU_USER")
SRU_PASS = os.getenv("SRU_PASS")
SRU_DELAY_MS = float(os.getenv("SRU_DELAY_MS", 0.25))

# path setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
kartenPath = os.path.join(BASE_DIR, os.getenv("kartenPath", "data/kartendaten.csv"))
punktePath = os.path.join(BASE_DIR, os.getenv("punktePath", "data/punktedaten.csv"))

def fetchSRURecord(ppn):
    params = {
        "version": "1.1",
        "operation": "searchRetrieve",
        "maximumRecords": "1",
        "recordSchema": "picaxml",
        "x-username": SRU_USER,
        "x-password": SRU_PASS,
        "query": f"pica.ppn={ppn}"

    }
    response = requests.get(SRU_BASE, params=params)
    response.raise_for_status()
    time.sleep(SRU_DELAY_MS)
    return response.content

def mapSizeCheck():
    return

def importMapsData():
    # import csv kartendaten
    logger.info("Starte mit dem Laden der Kartendaten")
    if kartenPath:
        with open(kartenPath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=",")
            counter = 0
            for zeile in reader:
                # check, ob Datensatz bereits existiert
                if not db.database_entry_exists(zeile["idn"], None, None):
                    xml_from_sru = fetchSRURecord(zeile["idn"])
                    parsed_data = parse_pica_record_maps(xml_from_sru)
                    db.write_to_table_maps(parsed_data)
                    counter += 1
            logger.info(f"{counter} Karten-IDNs wurden verarbeitet")
    else:
        logger.info("Kartenpfad nicht vorhanden.")
    if punktePath:
        logger.info("Starte mit dem Laden der Punktdaten")
        with open(punktePath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=",")
            counter = 0
            for zeile in reader:
                # check, ob Datensatz bereits existiert
                if not db.database_entry_exists(zeile["idn"], zeile["Breitengrad"], zeile["Längengrad"]):
                    xml_from_sru = fetchSRURecord(zeile["idn"])
                    parsed_data = parse_pica_record_points(xml_from_sru)
                    parsed_data["breitengrad"] = zeile["Breitengrad"]
                    parsed_data["laengengrad"] = zeile["Längengrad"]
                    db.write_to_table_points(parsed_data)
                    counter += 1
            logger.info(f"{counter} Punkt-IDNs wurden verarbeitet")
    else:
        logger.info("Punktepfad nicht vorhanden.")
    logger.info("Import abgeschlossen hurray")
    return

def parse_pica_record_points(xml):
    tree = etree.fromstring(xml)
    FIELD_MAP = {
        ("003@", "00"): "idn",
        ("021A", "00"): "titel",  
        ("011@", "00"): "jahr",
        ("039B", "00"): "reihe",
        ("031A", "00"): "fundstelle"
    }

    result = {
        "idn": None,
        "titel": None,
        "jahr": None,
        "breitengrad": None,
        "laengengrad": None,
        "reihe": None,
        "fundstelle": None
    }

    for df in tree.xpath("//*[local-name()='datafield']"):
        tag = df.get("tag")
        occ = df.get("occurrence") or "00"

        # passenden Ziel-Key ermitteln: erst exakt (tag, occ), sonst (tag, None)
        target_key = FIELD_MAP.get((tag, occ)) or FIELD_MAP.get((tag, None))
        # ignore, wenn kein match
        if target_key is None:
            continue

        subfields = {
            sf.get("code"): sf.text
            for sf in df.xpath("*[local-name()='subfield']")
        }

        if target_key == "idn":
            result["idn"] = subfields.get("0")

        elif target_key == "titel":
            result["titel"] = subfields.get("a")

        elif target_key == "jahr":
            result["jahr"] = subfields.get("a")
        
        elif target_key == "reihe":
            # alles ab Unterfeld $g abschneiden
            text = subfields.get("8")
            gekuerzt = text.split("$g")[0]
            result["reihe"] = gekuerzt
        
        elif target_key == "fundstelle":
            teile = []
            if subfields.get("d"):
                teile.append(f"Band {subfields['d']}")
            if subfields.get("j"):
                teile.append(f"Jahr {subfields['j']}")
            if subfields.get("h"):
                teile.append(f"Seiten {subfields['h']}")
            result["fundstelle"] = ", ".join(teile)
        
    return result

def parse_pica_record_maps(xml):
    # Filter nach idn (003@/00.0), Titel (021A/00.a), Herausgeber (028A.8, 029A.8), Jahr (011@/00.a), Maßstab (035E/00.a), Koordinaten (west, ost, nord, sued, 035G/00.a-d)
    tree = etree.fromstring(xml)

    FIELD_MAP = {
        ("003@", "00"): "idn",
        ("021A", "00"): "titel",
        ("033A", "00"): "herausgeber",   
        ("011@", "00"): "jahr",
        ("035E", "00"): "massstab",
        ("035G", "00"): "koordinaten",
    }
    
    # Instanziierung mit None Werten
    result = {
        "idn": None,
        "titel": None,
        "herausgeber": None,
        "jahr": None,
        "massstab": None,
        "breitengrad": None,
        "laengengrad": None,
        "koordinaten": {}
    }
    
    for df in tree.xpath("//*[local-name()='datafield']"):
        tag = df.get("tag")
        occ = df.get("occurrence") or "00"

        # passenden Ziel-Key ermitteln: erst exakt (tag, occ), sonst (tag, None)
        target_key = FIELD_MAP.get((tag, occ)) or FIELD_MAP.get((tag, None))
        # ignore, wenn kein match
        if target_key is None:
            continue

        subfields = {
            sf.get("code"): sf.text
            for sf in df.xpath("*[local-name()='subfield']")
        }

        if target_key == "idn":
            result["idn"] = subfields.get("0")

        elif target_key == "titel":
            result["titel"] = subfields.get("a")

        elif target_key == "jahr":
            result["jahr"] = subfields.get("a")

        elif target_key == "massstab":
            result["massstab"] = subfields.get("a")

        elif target_key == "herausgeber":
            result["herausgeber"] = subfields.get("n")

        elif target_key == "koordinaten":
            result["koordinaten"] = {
                "west": subfields.get("a"),
                "ost":  subfields.get("b"),
                "nord": subfields.get("c"),
                "sued": subfields.get("d"),
            }
    return result

if __name__ == "__main__":
    # setup
    logger.info("Los gehts...")
    db.database_configuration()
    importMapsData()

    #idn = 1618965956
    #xml_from_sru = fetchSRURecord(idn)
    #parsed_data = parse_pica_record_maps(xml_from_sru)
    #print(parsed_data)
    # db.write_to_table_maps(parsed_data)



    

