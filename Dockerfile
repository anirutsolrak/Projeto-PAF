# Estágio 1: build do front
FROM node:20-slim AS front
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Estágio 2: Flask servindo a API e o front
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=front /front/dist ./frontend_build
EXPOSE 5001
CMD ["python", "app.py"]
