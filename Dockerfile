FROM node:20-bullseye

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend ./backend
COPY backend/daten.csv ./backend/daten.csv
COPY frontend ./frontend

RUN chmod +x backend/start.sh

EXPOSE 3000

CMD ["sh", "backend/start.sh"]
