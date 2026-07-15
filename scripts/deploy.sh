#!/bin/bash

# Deployment script for Logística LFH

set -e

echo "🚀 Iniciando despliegue..."

# Detectar usuario del servidor web
WEB_USER="www-data"
if id "apache" &>/dev/null; then
    WEB_USER="apache"
elif id "nginx" &>/dev/null; then
    WEB_USER="nginx"
fi

# Instalar dependencias PHP (sin devDependencies)
echo "📦 Instalando dependencias de PHP..."
composer install --no-dev --optimize-autoloader

# Instalar dependencias JS y compilar assets
echo "🎨 Compilando assets de frontend..."
npm ci --omit=dev
npm run build

# Limpiar cachés antes de regenerar
echo "🧹 Limpiando cachés..."
php artisan optimize:clear

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones..."
php artisan migrate --force

# Crear symlink de almacenamiento
echo "🔗 Creando enlace de almacenamiento..."
php artisan storage:link --force

# Regenerar cachés de producción
echo "⚡ Optimizando para producción..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Permisos correctos para que el servidor web pueda leer/escribir
echo "🔐 Ajustando permisos..."
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
chmod -R 775 storage bootstrap/cache
chown -R "$WEB_USER":"$WEB_USER" storage bootstrap/cache

# Reiniciar colas
echo "🔄 Reiniciando colas..."
php artisan queue:restart

echo "✅ Despliegue completado con éxito!"
