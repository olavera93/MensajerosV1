# Despliegue a GoDaddy — mensajeros_lfh_deploy_20260714.zip

Paquete autocontenido: incluye `vendor/` (dependencias PHP de producción, sin las de desarrollo)
y `public/build/` (assets de React/Vite ya compilados). **No necesitas correr `composer install`
ni `npm run build` en el servidor.**

## Qué NO incluye el zip (a propósito)

- `.env` — nunca se sobrescribe tu configuración/credenciales de producción.
- `storage/app/public` (archivos subidos), `storage/logs` — solo trae carpetas vacías con
  `.gitignore`, así que al descomprimir **no borra** nada que ya exista ahí.
- La base de datos en sí — vive en tu MySQL de GoDaddy, el zip no la toca.

Como consecuencia, descomprimir el zip **sobre** la instalación actual solo reemplaza código
(`app/`, `resources/`, `routes/`, `vendor/`, `public/build`, etc.) y dejar intactos `.env`,
los archivos subidos y la base de datos.

## Pasos en el servidor (SSH)

### 0. Respaldo de seguridad (recomendado siempre antes de un deploy)

```bash
mysqldump -u TU_USUARIO -p TU_BASE_DE_DATOS > backup_$(date +%Y%m%d_%H%M).sql
cp .env .env.backup_$(date +%Y%m%d_%H%M)
```

### 1. Subir y descomprimir

Sube `mensajeros_lfh_deploy_20260714.zip` a la raíz del proyecto en el servidor (vía SFTP/File
Manager) y descomprime ahí mismo, sobrescribiendo los archivos existentes:

```bash
cd /ruta/a/tu/proyecto
unzip -o mensajeros_lfh_deploy_20260714.zip
```

### 2. Migraciones (solo agrega, nunca borra datos)

```bash
php artisan migrate --force
```

Todas las migraciones del proyecto tienen sus operaciones destructivas (`dropColumn`,
`dropIfExists`, etc.) únicamente en el método `down()`, que **no se ejecuta** con `migrate`
normal — solo con `migrate:rollback`. Un `migrate --force` de rutina únicamente crea tablas o
columnas nuevas (por ejemplo, la nueva tabla `events` de este release).

**Nunca ejecutes en producción:** `migrate:fresh`, `migrate:refresh`, `migrate:reset` ni
`db:wipe` — esos sí borran datos.

### 3. Enlace de almacenamiento y cachés (idempotente, seguro repetir)

```bash
php artisan storage:link --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

### 4. Permisos

```bash
chmod -R 775 storage bootstrap/cache
```

(Si el proceso PHP corre con un usuario/grupo distinto al tuyo, ajusta el `chown` según
corresponda en tu panel de GoDaddy.)

### 5. Colas (si usas `queue:work` en background, ej. vía cron o supervisor)

```bash
php artisan queue:restart
```

## Verificaciones en el panel de GoDaddy (una sola vez, no en cada deploy)

- **Versión de PHP ≥ 8.2** seleccionada en MultiPHP Manager.
- Extensiones habilitadas: `pdo_mysql`, `mbstring`/`iconv`, `gd`, `bcmath`, `zip`, `fileinfo`,
  `curl`, `xml` (las usa `maatwebsite/excel` para exportar/importar Excel).
- El `.env` de producción ya debe tener `APP_KEY`, credenciales `DB_*`, `APP_URL`, etc.
  correctos — no viene en el zip.

## Resumen mínimo para un deploy de rutina

```bash
unzip -o mensajeros_lfh_deploy_20260714.zip
php artisan migrate --force
php artisan optimize:clear && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan event:cache
```
