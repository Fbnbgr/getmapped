# Stage 1: Build
FROM node:20 as builder

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY frontend ./frontend

RUN chmod +x backend/start.sh

EXPOSE 3000

CMD ["sh", "backend/start.sh"]