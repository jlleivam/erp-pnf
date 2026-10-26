# ERP PNF

Construye una aplicación web ERP para empresas constructoras llamada "ERP PNF". Diseño moderno, minimalista y profesional en español, paleta de colores neutros (blancos, grises y azul oscuro), tipografía limpia y UI tipo SaaS empresarial.

ONBOARDING La landing page debe tener la opción de registrar una empresa nueva. Stepper de 2 pasos:

Pantalla 1 — Datos de la empresa:

Tipo de persona: Persona moral / Persona física (menú desplegable)

Razón social (si es persona moral) / Nombre completo (si es persona física)

RFC

Pantalla 2 — Registro de la cuenta del Director:

Nombre completo

Correo electrónico

Contraseña

Al completar → se crea la empresa y el usuario con perfil de Director. Se redirige al dashboard corporativo.

CONFIGURACIÓN DE EMPRESA Botón de configuración accesible desde el dashboard. Contiene 3 secciones:

Datos de facturación — información completa de la empresa

Equipo — alta de usuarios con 5 perfiles disponibles: Residente, Auxiliar, Administrativo, Supervisor, Director

Otras configuraciones — por definir

CREACIÓN DE OBRA Solo el Director puede crear obras nuevas. Stepper de 3 pasos:

Paso 1 — Datos generales:

Nombre de la obra

Tipo de obra (menú desplegable): Industrial, Comercial, Residencial, Infraestructura, Vivienda en serie, Urbanización

Cliente

Número de contrato

Ubicación

Fecha de inicio

Fecha de terminación

Paso 2 — Presupuesto:

Carga de archivo Excel (.xlsx) con el presupuesto autorizado

Es opcional — se puede cargar después desde dentro de la obra

Paso 3 — Equipo:

El Director asigna el equipo de la obra

Debe haber mínimo un Residente, un Administrativo y un Supervisor para poder operar

PERFILES Y MÓDULOS

RESIDENTE — encargado de la obra. Módulos:

Estimaciones

Órdenes de cambio

Requisiciones

Nómina

Destajos

Subcontratos

Rentas

Gasolinas

Caja chica

Almacén de obra

Tareas

Catálogos

AUXILIAR — apoya al Residente en captura y registro. Tiene acceso a los mismos módulos que el Residente pero todo lo que registra requiere visto bueno del Residente antes de subir al Supervisor.

ADMINISTRATIVO — cotiza materiales, hace comparativas y tramita pagos. Módulos:

Requisiciones

Cuentas por pagar

Tesorería

Catálogos

Almacén central

Gastos de oficina

Nómina

Destajos

Subcontratos

Rentas

Gasolinas

Caja chica

Tareas

SUPERVISOR — filtro de autorización entre el Residente y el Administrativo. Nada se paga ni ejecuta sin su visto bueno. Tiene visibilidad completa de todas sus obras. Módulos:

Estimaciones

Órdenes de cambio

Requisiciones

Nómina

Destajos

Subcontratos

Rentas

Gasolinas

Caja chica

Almacén de obra

Tareas

Catálogos

DIRECTOR — acceso total a todos los módulos de todos los perfiles. Puede asumir temporalmente el rol de Residente, Administrativo o Supervisor para modificar información de cualquier proceso dentro de cualquier obra.

INSTRUCCIONES DE CONSTRUCCIÓN Crear únicamente la estructura de navegación y los módulos de cada perfil como placeholders — pantallas con el nombre del módulo y un mensaje "Próximamente". No desarrollar la lógica interna de ningún módulo todavía. Los módulos se diseñarán y desarrollarán a detalle en iteraciones posteriores.

STACK TÉCNICO

Frontend: React + Tailwind CSS

Backend: Supabase (autenticación, base de datos PostgreSQL y storage)

Estado global: Zustand

Rutas protegidas por perfil — un usuario no puede acceder a rutas de otro perfil aunque conozca la URL

Mobile-first en módulos de obra — los residentes y auxiliares usan la app desde celular en campo

Desktop-first en vistas corporativas y administrativas

Cada módulo con su propia ruta desde el inicio para facilitar el desarrollo posterior

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/69494bc1-bc6d-4753-8585-90187d6e3302).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
