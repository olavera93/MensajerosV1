# Acceso de Usuarios por Rol

A continuación se detallan los usuarios creados para cada rol y sus respectivas restricciones de acceso en el sistema.

| Rol               | Usuario (Email)       | Contraseña | Permisos / Accesos                                                                                                                                                            |
| :---------------- | :-------------------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desarrollador** | `dev@example.com`     | `password` | Acceso total a todos los módulos, incluyendo la **Limpieza de Base de Datos**.                                                                                                |
| **Administrador** | `admin@example.com`   | `password` | Acceso a todos los módulos (Dashboard, Horarios, Preoperacional, Almuerzo, Salida, Formularios, Mensajeros, Usuarios). **No tiene acceso a la limpieza de la base de datos.** |
| **Líder**         | `lider@example.com`   | `password` | Acceso limitado a: **Dashboard** y **Almuerzo**.                                                                                                                              |
| **Regente**       | `regente@example.com` | `password` | Acceso limitado a: **Preoperacional**.                                                                                                                                        |

---

### Detalles de Restricciones en el Menú de Navegación

El sistema filtra automáticamente las opciones del menú de navegación basándose en el rol del usuario autenticado:

1. **Dashboard**: Visible para Administrador, Desarrollador y Líder.
2. **Horarios**: Visible para Administrador y Desarrollador.
3. **Preoperacional**: Visible para Administrador, Desarrollador y Regente.
4. **Almuerzo**: Visible para Administrador, Desarrollador y Líder.
5. **Salida**: Visible para Administrador y Desarrollador.
6. **Formularios**: Visible para Administrador y Desarrollador.
7. **Mensajeros**: Visible para Administrador y Desarrollador.
8. **Usuarios**: Visible para Administrador y Desarrollador.
9. **Depurar BD (Botón)**: Visible únicamente para el rol de **Desarrollador**.
