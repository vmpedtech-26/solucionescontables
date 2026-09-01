# Spec: Mejoras SolucionesContables

## 1. Objective
Este documento detalla la especificación técnica para la implementación de las 4 mejoras solicitadas para la plataforma SolucionesContables:
1. **Integraciones Reales (APIs)**: Conexión definitiva y en producción a la API de ArgentinaDatos para la obtención de índices IPC reales y la API de Gemini para la digitalización de comprobantes con OCR. (Nota: Estas funcionalidades básicas ya están integradas en la interfaz de RT 54 y Portal de Clientes, se validará y complementará su correcto funcionamiento).
2. **Sincronización en la Nube y Persistencia de Base de Datos**: Habilitar el flujo de autenticación real con Supabase (en base a la configuración dinámica del usuario en el panel de Ajustes) y aplicar RLS para discriminar roles de Estudios Contables (Admin) y Clientes (Vista Limitada).
3. **Scraper RPA (AFIP / Mis Comprobantes)**: Script de Node.js ejecutable en `scratch/rpa_afip_sync.js` que demuestra la automatización con Puppeteer para extraer comprobantes electrónicos oficiales del portal de AFIP.
4. **Módulo de Liquidación de Sueldos y Exportación ARCA**: Incorporar un módulo de cálculo y administración de recibos de sueldo para empleados ("Libro de Sueldos Digital ARCA") que permita calcular deducciones (Jubilación, Obra Social, Ley 19032, Sindicato SEC) y exportar el archivo en formato de texto de ancho fijo (`.txt`) compatible con el importador de AFIP/ARCA.

## 2. Requirements & Must-Haves
- [ ] **REQ-1 (Supabase Auth)**: Si la conexión a Supabase está activa, el formulario de ingreso en `landing.js` debe realizar `supabase.auth.signInWithPassword`.
  - Si el usuario logueado existe en la tabla `estudios`, adquiere el rol de administrador (`vmp_premium_unlocked = 'true'`).
  - Si no existe en la tabla `estudios` y es un cliente, se le asocia la empresa que coincida en su metadato (se guarda su ID de empresa en `vmp_studio_active_co` y `vmp_premium_unlocked = 'false'`).
  - Si no hay credenciales de Supabase configuradas, la app debe continuar operando en modo sandbox offline.
- [ ] **REQ-2 (RPA Scraper)**: Crear el archivo `scratch/rpa_afip_sync.js` que simule la conexión a AFIP usando Puppeteer o simulación robusta, procesando la navegación por "Mis Comprobantes" (Ventas y Compras), y generando un archivo JSON intermedio para su importación en el sistema.
- [ ] **REQ-3 (Módulo Sueldos - UI y Cálculo)**: Crear la vista `src/views/sueldos.js` con:
  - Formulario de cálculo de sueldo bruto a neto (aportes patronales y de empleados):
    - Jubilación: 11%
    - Ley 19032: 3%
    - Obra Social: 3%
    - Sindicato SEC (Comercio): 2%
  - Registro histórico local de liquidaciones.
- [ ] **REQ-4 (Módulo Sueldos - Exportación ARCA/AFIP)**: Añadir un botón de exportación que genere un archivo `.txt` con formato de ancho fijo regulado por AFIP para el Libro de Sueldos Digital (ej. registros de 80 o 150 caracteres para conceptos y liquidaciones, conteniendo CUIL, periodo, importes, etc.).
- [ ] **REQ-5 (Integración de Navegación)**: Registrar el módulo de Sueldos en el router (`src/main.js`) y en el sidebar (`src/views/layout.js`).

## 3. Constraints & Design Guidelines
- **Tech Stack**: Javascript (ES6) en frontend, HTML, CSS personalizado para el dashboard (conservando el diseño premium en HSL, glassmorphism y tipografía Outfit/Plus Jakarta Sans). Node.js independiente para el scraper de RPA.
- **Design & UX**: El módulo de Sueldos debe coincidir perfectamente con la estética del resto del panel (degradados elegantes, bordes redondeados suaves, tablas interactivas con estados vacíos detallados, iconos de Lucide).
- **Security**: Manejo seguro de contraseñas de AFIP y credenciales API a través de inputs que no muestren texto plano e integraciones del cliente a través de almacenamiento local o variables.

## 4. Edge Cases & Error States
- [ ] **EDGE-1 (Supabase Desconectado)**: Manejar fallos de red al autenticar con Supabase, mostrando notificaciones toast claras sin colapsar el flujo de la aplicación.
- [ ] **EDGE-2 (Campos Vacíos en Liquidación)**: Evitar el cálculo con valores brutos de sueldo nulos o negativos en el simulador.
- [ ] **EDGE-3 (RPA Sin Credenciales)**: Lanzar excepciones y mensajes legibles si se ejecuta el scraper RPA sin configurar la Clave Fiscal.

## 5. Definition of Done (DoD)
- [ ] **DoD-1**: Code compiles successfully with no syntax or compiler errors.
- [ ] **DoD-2**: Passes lint checks and formatting rules.
- [ ] **DoD-3**: All requirements (**REQ-1** to **REQ-5**) are implemented and verified.
- [ ] **DoD-4**: All edge cases (**EDGE-1** to **EDGE-3**) are handled and verified.
- [ ] **DoD-5**: Verification commands (e.g., `npm run build`) pass clean.
