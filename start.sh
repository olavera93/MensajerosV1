#!/bin/bash

# Script simplificado para desarrollo local (localhost)

# Habilitar pdo_mysql via ini personalizado (php.ini del sistema no lo tiene activado)
export PHP_INI_SCAN_DIR=/tmp/php-conf
mkdir -p /tmp/php-conf
cat > /tmp/php-conf/pdo_mysql.ini << 'INIEOF'
extension=pdo_mysql
pdo_mysql.default_socket=/tmp/mariadb-socket/mysql.sock
INIEOF

# Iniciar MariaDB local si no está corriendo
if ! pgrep -f "mariadbd.*mariadb-data" > /dev/null 2>&1; then
    echo "Iniciando MariaDB local..."
    mkdir -p /tmp/mariadb-data /tmp/mariadb-socket
    if [ ! -d "/tmp/mariadb-data/mysql" ]; then
        mariadb-install-db --datadir=/tmp/mariadb-data --basedir=/usr > /dev/null 2>&1
    fi
    mariadbd --datadir=/tmp/mariadb-data \
             --socket=/tmp/mariadb-socket/mysql.sock \
             --pid-file=/tmp/mariadb-socket/mariadb.pid \
             --port=3307 &
    sleep 3
    mariadb -u antares -S /tmp/mariadb-socket/mysql.sock \
        -e "CREATE DATABASE IF NOT EXISTS mensajeros_lfh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
fi

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
echo "Iniciando Mensajeros LFH (localhost)..."
echo "   ->  http://localhost:8000"
echo ""

# Usar concurrently para ejecutar todos los servicios
npx concurrently \
    --names "BACK,FRONT,QUEUE" \
    --prefix-colors "blue,green,yellow" \
    "php artisan serve --port=8000" \
    "npm run dev" \
    "php artisan queue:work"
