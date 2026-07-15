# Proceso de Actualización a Producción

Este documento detalla los pasos necesarios para desplegar los últimos cambios realizados en la aplicación, tomando como referencia el último despliegue (commit `d020ccb74c7cce90d921847f545045ea94724c8b`).

## 📋 Resumen de Cambios Principales

1.  **Seguridad y Roles (RBAC):**
    *   Implementación completa de control de acceso por roles (**Administrador, Desarrollador, Líder, Regente**).
    *   Protección de rutas en el backend (`web.php`).
    *   Filtrado dinámico del menú de navegación según el rol del usuario.
    *   Lógica de redirección inteligente post-login.
2.  **Módulos de Reportes:**
    *   Habilitación de acceso al Dashboard y Reportes de Almuerzo para el rol **Líder**.
    *   Acceso exclusivo a Reportes Preoperacionales para el rol **Regente**.
    *   Módulo de gestión de **Preguntas Preoperacionales** (CRUD completo) para Administradores.
3.  **UI/UX y Nomenclatura:**
    *   Cambio de "Ubicación Base" a **"Sede"** en toda la aplicación.
    *   Optimización de la barra de navegación móvil para roles administrativos.
    *   Ampliación del ancho de contenedores en tablas de datos para mejor visualización.
4.  **Gestión de Datos:**
    *   Nuevo módulo de **Depuración de Base de Datos** con respaldo automático en Excel (exclusivo para Desarrolladores).
    *   Nuevo módulo de **Formularios Externos** para gestión de links dinámicos.

---

## 📂 Archivos Modificados

A continuación se listan los archivos clave que deben ser actualizados en el servidor de producción:

### Backend (Laravel)
- `routes/web.php` (Configuración de rutas y permisos)
- `app/Http/Controllers/AuthController.php` (Lógica de login y redirección)
- `app/Http/Controllers/PreoperationalController.php` (CRUD de preguntas)
- `app/Models/User.php` (Atributo `role` en `$fillable`)
- `database/migrations/2026_03_05_182323_create_external_forms_table.php` (Nueva tabla)
- `database/seeders/DatabaseSeeder.php` (Actualizado con usuarios por defecto)

### Frontend (React/Inertia)
- `resources/js/Layouts/LeaderLayout.jsx` (Navegación y lógica de roles)
- `resources/js/Pages/Reports/PreoperationalQuestions.jsx` (Nuevo componente de gestión)
- `resources/js/Pages/Messengers/Create.jsx` & `Edit.jsx` (Cambios de etiquetas "Sede")
- `resources/js/Components/DataPurgeModal.jsx` (Nuevo componente de limpieza)
- `resources/js/Pages/Admin/ExternalForms.jsx` (Nuevo componente de gestión de links)

---

## 🚀 Pasos para la Actualización

### 1. Preparación
Acceder al servidor vía SSH y navegar a la carpeta raíz del proyecto.
```bash
cd /ruta/a/tu/proyecto
```

### 2. Obtener cambios de Git
```bash
git pull origin main
```

### 3. Instalar Dependencias (Si aplica)
Si hubo cambios en `composer.json` o `package.json`:
```bash
composer install --no-dev --optimize-autoloader
npm install
```

### 4. Ejecutar Migraciones
**IMPORTANTE:** Este paso crea la tabla de Formularios Externos.
```bash
php artisan migrate --force
```

### 5. Sembrar Usuarios (Opcional pero Recomendado)
Para asegurar que los roles `lider` y `regente` existan:
```bash
php artisan db:seed --class=DatabaseSeeder
```
*Nota: Revisa `usuarios.md` para las credenciales por defecto.*

### 6. Compilar Assets de Frontend
Este paso es **CRITICO** para que los cambios en React se reflejen.
```bash
npm run build
```

### 7. Limpiar Caché de Laravel
```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
```

---

## 🛡️ Verificación Post-Despliegue

1.  **Acceso Regente:** Entrar con `regente@example.com` y verificar que solo vea el módulo Preoperacional.
2.  **Acceso Líder:** Entrar con `lider@example.com` y verificar acceso a Dashboard y Almuerzo.
3.  **Formularios:** Verificar que se puedan crear y eliminar links de formularios externos.
4.  **Sedes:** Confirmar que en el registro de mensajeros aparezca "Sede" en lugar de "Ubicación Base".

---
*Generado el 06/03/2026*
