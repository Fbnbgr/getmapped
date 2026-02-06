#!/bin/sh
echo "Starte Datenimport..."
node backend/import.js || exit 1

echo "Starte Server..."
node backend/server.js
