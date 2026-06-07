#!/bin/bash

# Script simplificado para desarrollo local (localhost)

# Limpiar procesos previos
pkill -f "php artisan" 2>/dev/null
pkill -f "vite" 2>/dev/null
fuser -k 8000/tcp 8080/tcp 5173/tcp 2>/dev/null
sleep 1

# Fijar .env para localhost
sed -i "s|^APP_URL=.*|APP_URL=http://localhost:8000|" .env
sed -i "s|^APP_ENV=.*|APP_ENV=local|" .env
sed -i "s|^APP_DEBUG=.*|APP_DEBUG=true|" .env

echo ""
echo "🚀 Iniciando Mensajeros LFH (localhost)..."
echo "   ➜  http://localhost:8000"
echo ""

# Usar concurrently para ejecutar todos los servicios
npx concurrently \
    --names "BACK,FRONT,QUEUE" \
    --prefix-colors "blue,green,yellow" \
    "php artisan serve --port=8000" \
    "npm run dev" \
    "php artisan queue:work"
