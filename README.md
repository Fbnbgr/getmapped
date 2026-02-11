# Kartenprojekt - HDT SPARQL Endpoint (dnb Branch)

Semantic Web Datenbank auf Basis von RDF HDT mit Fuseki SPARQL-Interface.

\*\*Branches:\*\*
- \main\  Klassische Maps-App (SQLite, REST API)  siehe README_MAIN.md
- \dnb\  \*\*Aktueller Branch\*\*: Linked Data Datenbank (RDF/HDT, SPARQL)

## Schnellstart

Service starten:
\\\ash
docker-compose up -d
\\\

- maps-app: http://localhost:3000
- fuseki-hdt: http://localhost:3030

## SPARQL Queries

\\\ash
curl -X POST http://localhost:3030/dataset/sparql \\
  -H "Content-Type: application/sparql-query" \\
  -d "SELECT ?s ?p ?o WHERE { \?s \?p \?o } LIMIT 10"
\\\

## Daten

Die HDT-Datei (data/dnb-all.hdt) enthält DNB-Linked-Data  akademische Publikationen, nicht Kartendaten.

Für echte Kartendaten: Nutze die SQLite DB (Port 3000) oder lade eine andere HDT-Datei.

## Weitere Infos

- [Fuseki](https://jena.apache.org/documentation/fuseki2/)
- [RDF HDT](https://www.rdfhdt.org)
- [rogargon/fuseki-hdt-docker](https://github.com/rogargon/fuseki-hdt-docker)

Lizenz: MIT
