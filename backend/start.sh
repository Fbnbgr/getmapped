#!/bin/sh

if [ "$SKIP_IMPORT" != "true" ]; then
  echo "Starte Datenimport..."
  node backend/import.js || exit 1
else
  echo "Import übersprungen (SKIP_IMPORT=true)"
fi

echo "Starte Server..."
node backend/server.js
