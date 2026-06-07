#!/bin/bash

# Deployment script for Logística LFH
# Assets ya compilados en public/build/ — no requiere Node.js en el servidor

set -e

echo "Iniciando despliegue..."

echo "Instalando dependencias PHP..."
composer install --no-dev --optimize-autoloader

echo "Ejecutando migraciones..."
php artisan migrate --force

echo "Limpiando y cacheando configuracion..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Creando enlace de almacenamiento..."
php artisan storage:link --force

echo "Despliegue completado."
