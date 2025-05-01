# AutoAttendance - Backend Microservices

Este repositorio contiene los servicios backend para la aplicación AutoAttendance, implementados utilizando una arquitectura de microservicios con autenticación centralizada.

## Descripción

AutoAttendance es un sistema diseñado para gestionar la asistencia de usuarios asociados a diferentes agencias. Permite a las agencias registrarse, invitar usuarios, definir horarios y supervisar la asistencia, mientras que los usuarios pueden registrar sus entradas y salidas (check-in/check-out) a través de diferentes métodos.

## Arquitectura

El backend sigue un patrón de **Microservicios** con un **API Gateway** como punto único de entrada. La autenticación está centralizada en el Gateway.

- **API Gateway (`api-gateway`)**:
  - Punto de entrada único para todas las solicitudes de clientes.
  - Maneja el enrutamiento hacia los servicios correspondientes.
  - **Implementa la autenticación centralizada:** Verifica los JWTs de usuario y agencia leyendo el claim `token_type` para seleccionar el secreto correcto (`USER_JWT_SECRET` o `AGENCY_JWT_SECRET`). Inyecta cabeceras `x-user-id` y `x-agency-id` en las solicitudes validadas.
  - Gestiona CORS, Rate Limiting y Logging de solicitudes.
- **Agency Service (`agency-service`)**:
  - Gestiona el registro, login y perfil de las agencias.
  - Maneja la lógica de invitación de usuarios (iniciación y envío de email).
  - **Genera tokens JWT para agencias** (con `token_type: 'agency'`).
  - **No verifica tokens entrantes** (confía en el Gateway).
- **User Service (`user-service`)**:
  - Gestiona la activación de usuarios invitados y el login de usuarios.
  - Maneja los datos del perfil de usuario.
  - **Genera tokens JWT para usuarios** (con `token_type: 'user'`).
  - **No verifica tokens entrantes** (confía en el Gateway).
- **Schedule Service (`schedule-service`)**:
  - Permite a las agencias crear, leer, actualizar y eliminar horarios de trabajo.
  - Gestiona la asignación de usuarios a horarios.
  - **No verifica tokens entrantes** (confía en el Gateway, lee `x-agency-id` de las cabeceras).
- **Attendance Service (`attendance-service`)**:
  - Registra los eventos de check-in y check-out de los usuarios (Manual, QR, etc.).
  - Calcula el estado de asistencia (a tiempo, tarde).
  - Proporciona el historial de asistencia.
  - **No verifica tokens entrantes** (confía en el Gateway, lee `x-user-id` y/o `x-agency-id` de las cabeceras).

## Tecnologías Utilizadas

- **Lenguaje:** TypeScript
- **Plataforma:** Node.js
- **Framework:** Express.js (en cada microservicio)
- **Base de Datos ORM:** Prisma ORM
- **Base de Datos:** PostgreSQL (o la base de datos configurada en Prisma)
- **Autenticación:** JWT (Generados por `user-service` y `agency-service`, verificados **únicamente** por `api-gateway`)
- **Hashing de Contraseñas:** Bcryptjs
- **Validación:** Zod
- **API Gateway Proxy:** `express-http-proxy`
- **Logging:** Pino (con `pino-pretty` para desarrollo)
- **Manejo de Fechas:** `date-fns`
- **Envío de Emails:** Nodemailer, Handlebars (en `agency-service`)
- **Llamadas HTTP Internas:** Axios (usado en algunos flujos como invitación)

## Características Principales

- Registro y Autenticación de Agencias.
- Invitación de Usuarios por Email.
- Activación y Autenticación de Usuarios.
- Gestión de Horarios de Trabajo (CRUD).
- Registro de Asistencia (Check-in/Check-out) por métodos Manual y QR.
- Cálculo de Estado de Asistencia (On Time, Late).
- Consulta de Historial de Asistencia (por usuario y por agencia).
- Arquitectura de Microservicios escalable.
- Autenticación centralizada y segura vía API Gateway basada en claims JWT.

## Prerrequisitos

- Node.js (v18 o superior recomendado)
- npm o yarn
- Una instancia de Base de Datos compatible con Prisma (ej: PostgreSQL) corriendo.
- (Opcional) Docker y Docker Compose para gestionar la base de datos u otros servicios.

## Instalación y Ejecución Local

Sigue estos pasos para levantar el entorno de desarrollo local:

1.  **Clonar el Repositorio:**

    ```bash
    git clone <url-del-repositorio>
    cd autoattendance-backend-services-main
    ```

2.  **Instalar Dependencias (para cada servicio):**
    Navega a la carpeta de cada servicio (`api-gateway`, `agency-service`, etc.) y ejecuta `npm install` (o `yarn install`):

    ```bash
    cd api-gateway && npm install && cd ..
    cd agency-service && npm install && cd ..
    cd user-service && npm install && cd ..
    cd schedule-service && npm install && cd ..
    cd attendance-service && npm install && cd ..
    ```

3.  **Configurar Variables de Entorno (`.env`):**
    Crea un archivo `.env` en la raíz de **cada** carpeta de servicio (ej: `api-gateway/.env`, `agency-service/.env`, etc.). Copia el contenido de los archivos `.env.example` (si existen) o añade las variables necesarias. Revisa la sección **Variables de Entorno** más abajo para ver las variables clave. **¡Es crucial que los secretos JWT sean consistentes!**

4.  **Ejecutar Migraciones de Base de Datos:**
    Para cada servicio que tenga un schema Prisma (`agency-service`, `user-service`, `schedule-service`, `attendance-service`), ejecuta las migraciones:

    ```bash
    # Asegúrate que la variable DATABASE_URL en cada .env respectivo apunte a tu base de datos.
    cd agency-service && npx prisma migrate dev --name init && cd ..
    cd user-service && npx prisma migrate dev --name init && cd ..
    cd schedule-service && npx prisma migrate dev --name init && cd ..
    cd attendance-service && npx prisma migrate dev --name init && cd ..
    ```

5.  **Iniciar los Servicios:**
    Abre terminales separadas para cada servicio y ejecútalos (usualmente con un script de desarrollo):

    ```bash
    # Terminal 1: API Gateway
    cd api-gateway && npm run dev

    # Terminal 2: Agency Service
    cd ../agency-service && npm run dev

    # Terminal 3: User Service
    cd ../user-service && npm run dev

    # Terminal 4: Schedule Service
    cd ../schedule-service && npm run dev

    # Terminal 5: Attendance Service
    cd ../attendance-service && npm run dev
    ```

    _Verifica los scripts `dev` en los `package.json` de cada servicio._

## Variables de Entorno

Asegúrate de definir las siguientes variables en los archivos `.env` correspondientes:

- **`api-gateway/.env`**:

  - `PORT`: Puerto para el Gateway (ej: 3000)
  - `AGENCY_SERVICE_URL`: URL completa de `agency-service` (ej: http://localhost:3001)
  - `USER_SERVICE_URL`: URL completa de `user-service` (ej: http://localhost:3002)
  - `SCHEDULE_SERVICE_URL`: URL completa de `schedule-service` (ej: http://localhost:3003)
  - `ATTENDANCE_SERVICE_URL`: URL completa de `attendance-service` (ej: http://localhost:3004)
  - `FRONTEND_URL`: URL del frontend (para CORS y links de email)
  - `USER_JWT_SECRET`: Secreto para **verificar** tokens de usuario (`token_type: 'user'`).
  - `AGENCY_JWT_SECRET`: Secreto para **verificar** tokens de agencia (`token_type: 'agency'`).

- **`agency-service/.env`**:

  - `PORT`: Puerto para este servicio (ej: 3001)
  - `DATABASE_URL`: URL de conexión a la base de datos (ej: `postgresql://user:password@host:port/database?schema=agency`)
  - `AGENCY_JWT_SECRET`: Secreto para **generar** tokens de agencia (debe ser **idéntico** al del Gateway).
  - `USER_SERVICE_URL`: URL completa de `user-service` (para llamadas internas como `create-invitation`).
  - `FRONTEND_URL`: URL del frontend (para links de email).
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`: Credenciales del servidor SMTP para enviar emails.

- **`user-service/.env`**:

  - `PORT`: Puerto para este servicio (ej: 3002)
  - `DATABASE_URL`: URL de conexión a la base de datos (ej: `postgresql://user:password@host:port/database?schema=user`)
  - `USER_JWT_SECRET`: Secreto para **generar** tokens de usuario (debe ser **idéntico** al del Gateway).

- **`schedule-service/.env`**:

  - `PORT`: Puerto para este servicio (ej: 3003)
  - `DATABASE_URL`: URL de conexión a la base de datos (ej: `postgresql://user:password@host:port/database?schema=schedule`)
  - _(Otras URLs de servicios si necesita hacer llamadas internas)_

- **`attendance-service/.env`**:
  - `PORT`: Puerto para este servicio (ej: 3004)
  - `DATABASE_URL`: URL de conexión a la base de datos (ej: `postgresql://user:password@host:port/database?schema=attendance`)
  - _(Otras URLs de servicios si necesita hacer llamadas internas)_

## Uso de la API

Todas las solicitudes **deben** dirigirse al **API Gateway** (ej: `http://localhost:3000`). La base de las rutas es `/v1/api/`.

- Agencias: `/v1/api/agencies/...`
- Usuarios: `/v1/api/users/...`
- Horarios: `/v1/api/schedules/...`
- Asistencia: `/v1/api/attendance/...`

Se recomienda usar herramientas como [Postman](https://www.postman.com/) o [Insomnia](https://insomnia.rest/) para interactuar con la API durante el desarrollo y pruebas. Recuerda enviar el token JWT como `Bearer` token en la cabecera `Authorization` para las rutas protegidas. El Gateway se encargará de la validación.

