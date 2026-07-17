#!/bin/sh

if [ "$SKIP_IMPORT" != "true" ]; then
  echo "Starte Datenimport..."
  python3 backend/import.py || exit 1
else
  echo "Import übersprungen (SKIP_IMPORT=true)"
fi

echo "Starte Server..."
exec node backend/server.js
