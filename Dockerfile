FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
      build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/package*.json backend/
RUN cd backend && npm install --omit=dev --build-from-source=sqlite3

COPY backend ./backend
COPY frontend ./frontend

RUN chmod +x backend/start.sh

EXPOSE 3000

CMD ["sh", "backend/start.sh"]