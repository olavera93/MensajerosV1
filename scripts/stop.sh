#!/bin/bash

echo "🛑 Deteniendo servicios de Mensajeros LFH..."

# Puertos estándar del proyecto
fuser -k 8000/tcp 8080/tcp 5173/tcp 8001/tcp 5174/tcp 2>/dev/null

# Matar procesos por nombre en caso de que no estén en los puertos estándar
pkill -f "artisan serve"
pkill -f "artisan queue:work"
pkill -f "vite"

echo "✅ Servicios detenidos."
