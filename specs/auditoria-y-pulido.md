# Spec: Auditoría y Pulido de Soluciones Contables

## 1. Objective
El objetivo de este desarrollo es realizar una auditoría integral y pulido de errores en la suite contable "Soluciones Contables" (solucionescontables.site). El foco está en garantizar que todas las funcionalidades existentes operen con precisión fiscal, consistencia total de datos y usabilidad excepcional en la web y dispositivos móviles. No se incorporarán características nuevas; se optimizará el código para asegurar cero margen de error en el tratamiento de datos tributarios argentinos.

## 2. Requirements & Must-Haves

### Parte 1 — Landing Page (Pública)
- [ ] **REQ-1 (Pre-renderizado HTML - SEO/SSG)**: Reubicar el HTML completo de la landing page (actualmente en `src/views/landing.js`) dentro de `index.html` bajo el contenedor `#view-root`. Modificar `src/main.js` y `src/views/landing.js` para realizar una hidratación fluida en el arranque (si la landing page ya está en el DOM, no volver a escribir `innerHTML`, solo asociar los listeners).
- [ ] **REQ-2 (Navegación e Historial)**: Comprobar que todos los links del menú superior y footer funcionen correctamente. Vincular todos los CTAs al login modal o formulario de contacto.
- [ ] **REQ-3 (Registro / Onboarding)**: Implementar la funcionalidad completa del formulario de registro.
  - Validar el formato de CUIT (`XX-XXXXXXXX-X`).
  - Validar el CUIT impositivamente bajo Algoritmo Módulo 11.
  - Mostrar una advertencia visible en caso de CUIT inválido, pero permitir el registro (según requerimiento de usuario).
  - Simular el envío de un correo de bienvenida.
  - Activar automáticamente el plan de prueba gratuito para el CUIT registrado.
- [ ] **REQ-4 (SEO & Mobile Optimization)**:
  - Declarar las meta etiquetas estáticas (title, description, OG tags) directamente en `index.html`.
  - Asegurar la usabilidad en pantallas móviles de 375px (iPhone SE).
  - Añadir `lazy` loading y textos `alt` descriptivos a todas las imágenes.

### Parte 2 — Suite Operativa (Panel Interno)
- [ ] **REQ-5 (Multi-Tenant & Periodicidad)**: Validar que el cambio de cliente activo en la barra lateral superior actualice de inmediato todos los módulos sin requerir recarga (utilizando el bus de eventos `vmp_db_updated`). Garantizar que el periodo fiscal (Mayo 2026) filtre de forma consistente la información.
- [ ] **REQ-6 (Módulo 1: Listado de Clientes)**:
  - Formatear y mostrar todos los campos requeridos (Empresa, CUIT, Régimen, Actividad, Inicio de Actividades, Estado).
  - Resolver el problema de truncamiento de la etiqueta para "TecnoDesarrollos Sur" (`MONOTRIBUTO - CAT H`), forzando su visualización completa en pantallas angostas.
  - Sincronizar el estado Activo/Inactivo.
- [ ] **REQ-7 (Módulo 2: Comprobantes - Alertas Fiscales)**:
  - **CUIT Inactivo (Cervecería Austral 30-77443322-9)**: Mostrar una alerta visible y un tooltip explicativo. Bloquear o advertir el cómputo del Crédito Fiscal (CF) en el Libro IVA y en el F.2051.
  - **Riesgo APOC (Consumidor Final 00-00000000-0)**: Categorizar como alerta de riesgo APOC con un tooltip que explique la posible objeción de ARCA.
- [ ] **REQ-8 (Módulo 3: Sincronización y Conciliación SIRCREB)**:
  - El botón "Conciliar" del banner "Diferencia SIRCREB (Bancos)" en la pantalla de inicio del Dashboard debe redirigir al módulo de Retenciones y pre-filtrar las 2 percepciones bancarias no conciliadas.
  - Validar el drag and drop para planillas de compras/ventas y formatos (.xls, .xlsx, .txt, .csv).
- [ ] **REQ-9 (Módulo 4: Portal del Cliente y Cupo Gemini)**:
  - Mostrar alerta cuando el consumo supere el 80% (cupo actual en 94.6%).
  - Habilitar el botón "Aumentar Límite" para cargar una API Key propia o actualizar el plan.
  - Bloquear graciosamente el OCR y redirigir a carga manual si el cupo se agota (300/300).
  - Agregar tooltips descriptivos al botón "Reconstruir" del listado de comprobantes digitalizados.
- [ ] **REQ-10 (Módulo 5: WhatsApp Omnicanal)**:
  - Limpiar el badge `(1)` no leído al abrir el chat de "Transportes Patagónicos".
  - En la detección de comprobantes por chat, el botón "Procesar con AI-OCR" debe cargar la compra en la base de datos de la empresa remitente (Transportes Patagónicos) en lugar de la empresa del contexto activo, descontando la cuota de Gemini.
- [ ] **REQ-11 (Módulo 6: Libro IVA Digital)**:
  - Asegurar la consistencia matemática entre el saldo del Libro IVA Digital y el panel de IVA Simple F.2051.
  - Resolver o justificar los valores "—" en las alícuotas del listado (las Facturas B emitidas a Consumidor Final no discriminan IVA para el receptor; documentar mediante tooltips explicativos para el contador).
- [ ] **REQ-12 (Módulo 7: IVA Simple F.2051)**:
  - **Paso 2 (Consistencia)**: Si la diferencia es $0.00, cambiar automáticamente el estado a verde ("Validación Exitosa / Listo para presentar").
  - **Paso 4 (Presentación)**: Bloquear si no se completaron los pasos previos. Simular la pasarela fiscal de ARCA Live, capturando fallos de conexión y permitiendo reintentar. Generar comprobante y transacción de éxito.
- [ ] **REQ-13 (Módulo 8: Retenciones Cuenta Puente y Exportador SIRE)**:
  - Mantener suspendidos los $6.080,75 de la cuenta puente y excluirlos del cálculo de saldo en el F.2051.
  - Inyectar un modal de advertencia obligatoria ("NO volver a abrir con Excel...") *antes* de proceder a descargar el archivo CSV del SIRE.
- [ ] **REQ-14 (Módulo 9: RT 54 Ajuste por Inflación)**:
  - Indexar bienes de uso digitalizados automáticamente.
  - Explicar mediante tooltip la razón del Ajuste AxI = $0 en Bienes de Cambio cuando el coeficiente es 1.0000 (bienes de cambio adquiridos en el mes de cierre o sin inflación en el lapso).
  - Cuadrar el balance general y agregar tooltip pedagógico explicativo para el RECPAM.
- [ ] **REQ-15 (Módulo 10, 11 y 12: RPA, Migrador, AI Guard)**:
  - Integrar estados visuales de ejecución y próxima corrida.
  - Garantizar la importación limpia en el Migrador sin duplicados con barra de progreso.
  - El botón "AUDITORÍA ACTIVA S/VT" de AI Guard debe navegar al panel de conciliación y pre-auditoría.

## 3. Constraints & Design Guidelines
- **Tech Stack**: Frontend SPA basado en Vite, Vanilla JS (ES6), CSS nativo para el dashboard y la landing page.
- **Estética & Visual**: Preservar y robustecer los componentes visuales (glassmorphism, animaciones fluidas, paleta de colores HSL).
- **Consistencia Impositiva**: La consistencia matemática en reportes es obligatoria (Saldo IVA Digital = Saldo IVA Simple = Dashboard).

## 4. Edge Cases & Error States
- [ ] **EDGE-1 (Desconexión de API)**: Ante caídas en servicios simulados de ARCA, mostrar notificaciones toast detalladas y permitir el reintento de presentaciones de declaraciones juradas.
- [ ] **EDGE-2 (Campos inválidos en onboarding)**: Validar longitud, caracteres numéricos de CUIT y estructura de emails en todos los formularios.

## 5. Definition of Done (DoD)
- [ ] **DoD-1**: Compilación de Vite exitosa (`npm run build`).
- [ ] **DoD-2**: Cero errores de sintaxis o referencias en consola de desarrollador de navegador.
- [ ] **DoD-3**: Pruebas automatizadas de consistencia fiscal exitosas.
- [ ] **DoD-4**: Todos los problemas críticos (1 al 8) están documentados, resueltos y verificados.
- [ ] **DoD-5**: La landing page inicial carga de forma estática instantáneamente (SEO activo).
