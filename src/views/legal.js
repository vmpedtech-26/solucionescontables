/* -------------------------------------------------------------
   Paginas legales publicas: Terminos y Condiciones y Politica de Privacidad.
   El texto es estatico (sin datos de usuario); los datos de la entidad salen de
   legal-config.js y los campos vacios se omiten.
   ------------------------------------------------------------- */
import { LEGAL } from '../legal-config.js';

const datosEntidad = () => [
  `<strong>${LEGAL.empresa}</strong>`,
  LEGAL.cuit ? `CUIT ${LEGAL.cuit}` : '',
  LEGAL.domicilio ? `Domicilio: ${LEGAL.domicilio}` : '',
  `Correo de contacto: <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>`
].filter(Boolean).join(' · ');

function pagina(titulo, cuerpo, otraRuta, otraEtiqueta) {
  return `
  <div class="legal-page" style="min-height: 100vh; background: var(--bg-secondary, #f8fafc);">
    <header style="background: #fff; border-bottom: 1px solid var(--border-color, #e2e8f0); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
      <a href="#/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--color-primary);">
        <img src="/SolucionesContables_Logo.png" alt="" style="width: 34px; height: 34px; border-radius: 6px; object-fit: cover;" />
        <strong style="font-size: 15px;">${LEGAL.producto}</strong>
      </a>
      <nav style="display: flex; gap: 18px; font-size: 13px;">
        <a href="${otraRuta}" style="color: var(--color-accent); font-weight: 600; text-decoration: none;">${otraEtiqueta}</a>
        <a href="#/" style="color: var(--text-secondary); text-decoration: none;">Volver al inicio</a>
      </nav>
    </header>
    <main style="max-width: 820px; margin: 0 auto; padding: 36px 24px 72px; color: var(--text-primary, #0f172a); line-height: 1.65; font-size: 14.5px;">
      <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 6px;">${titulo}</h1>
      <p style="color: var(--text-secondary); font-size: 13px; margin: 0 0 6px;">Versión ${LEGAL.version} · Vigente desde el ${LEGAL.vigencia}</p>
      <p style="color: var(--text-secondary); font-size: 13px; margin: 0 0 28px;">${datosEntidad()}</p>
      ${cuerpo}
    </main>
  </div>
  <style>
    .legal-page h2 { font-size: 18px; font-weight: 800; margin: 30px 0 8px; }
    .legal-page p, .legal-page li { margin: 0 0 10px; }
    .legal-page ul { padding-left: 22px; margin: 0 0 12px; }
    .legal-page a { color: var(--color-accent); }
    .legal-page table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
    .legal-page main { overflow-wrap: anywhere; }
    .legal-page th, .legal-page td { border: 1px solid var(--border-color, #e2e8f0); padding: 8px 10px; text-align: left; vertical-align: top; }
    .legal-page th { background: #fff; }
    .legal-callout { background: rgba(245, 158, 11, 0.07); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; }
  </style>
  `;
}

export function renderTerminos() {
  return pagina('Términos y Condiciones de Uso', `
    <p>Estos Términos regulan el uso de ${LEGAL.producto} (el “Servicio”), provisto por ${LEGAL.empresa} (“nosotros”). Al crear una cuenta o usar el Servicio declarás haber leído y aceptado estos Términos y nuestra <a href="#/privacidad">Política de Privacidad</a>.</p>

    <h2>1. Qué es el Servicio y qué no es</h2>
    <p>${LEGAL.producto} es una herramienta de apoyo para estudios contables y sus clientes: permite registrar empresas, comprobantes, libros de IVA, retenciones, liquidaciones de sueldos y otros datos contables, y realizar cálculos de ayuda.</p>
    <div class="legal-callout">
      <strong>Importante.</strong> El Servicio <strong>no presenta declaraciones juradas, no emite comprobantes ni realiza trámites ante ARCA</strong> u otros organismos. Los cálculos (IVA, Monotributo, retenciones, Convenio Multilateral, RT 54, sueldos, Ganancias) son <strong>orientativos</strong>, se basan en parámetros que pueden cambiar y <strong>no reemplazan el criterio ni la firma del contador público matriculado</strong>, único responsable de las presentaciones y del asesoramiento a sus clientes. Algunas funciones se muestran como “en desarrollo” y están deshabilitadas.
    </div>

    <h2>2. Cuentas y roles</h2>
    <ul>
      <li><strong>Estudio contable:</strong> crea la cuenta, carga las empresas de sus clientes y puede invitar a cada cliente a un portal propio mediante un enlace de un solo uso.</li>
      <li><strong>Cliente final:</strong> accede por invitación de su estudio y solo ve y carga información de su propia empresa.</li>
    </ul>
    <p>Debés ser mayor de edad y tener capacidad para contratar, brindar datos veraces y mantener la confidencialidad de tus credenciales. Sos responsable de la actividad realizada con tu cuenta. El estudio declara contar con la autorización de sus clientes para cargar y tratar sus datos y se obliga a invitar únicamente a personas vinculadas con la empresa correspondiente.</p>

    <h2>3. Los datos que cargás</h2>
    <p>Los datos y documentos que cargás siguen siendo tuyos (o de tus clientes). Nos otorgás una licencia limitada, no exclusiva, para almacenarlos y procesarlos con el único fin de prestar el Servicio. Sos responsable de que su carga sea lícita y de contar con las autorizaciones necesarias, incluidos los datos de empleados y de terceros. Respecto de los datos personales que el estudio carga sobre sus clientes y empleados, el estudio es el responsable del tratamiento y nosotros actuamos como encargados, según se detalla en la Política de Privacidad.</p>

    <h2>4. Uso aceptable</h2>
    <p>No podés: acceder o intentar acceder a datos de otras cuentas; eludir controles de seguridad; realizar ingeniería inversa; cargar código malicioso; sobrecargar o abusar del Servicio; cargar contenido ilícito; ni usar el Servicio para fines contrarios a la ley.</p>

    <h2>5. Disponibilidad y copias de seguridad</h2>
    <p>El Servicio se brinda “tal cual está” y “según disponibilidad”. No garantizamos que funcione sin interrupciones ni errores. <strong>No garantizamos copias de seguridad ni la recuperación de la información</strong>: te recomendamos conservar tus propios registros contables y exportar periódicamente la información que necesites para cumplir tus obligaciones de conservación.</p>

    <h2>6. Condiciones comerciales</h2>
    <p>Los precios, períodos de prueba y condiciones de pago son los informados en el plan o propuesta que contrates. Podemos modificar los precios con aviso previo razonable.</p>

    <h2>7. Propiedad intelectual</h2>
    <p>El software, el diseño, las marcas y los contenidos del Servicio son de ${LEGAL.empresa} o de sus licenciantes. Estos Términos no te transfieren ningún derecho salvo el uso del Servicio conforme a lo aquí previsto.</p>

    <h2>8. Limitación de responsabilidad</h2>
    <p>En la máxima medida permitida por la ley, no respondemos por multas, intereses, recargos o perjuicios derivados de presentaciones, liquidaciones o decisiones basadas en los cálculos del Servicio, de datos mal cargados o desactualizados, de la indisponibilidad del Servicio, de la pérdida de información, ni de hechos de terceros (incluidos organismos públicos y proveedores de infraestructura). Cuando la ley permita limitar la responsabilidad, nuestra responsabilidad total se limita al monto efectivamente abonado por vos por el Servicio en los 12 meses anteriores al hecho. Nada de lo aquí dispuesto excluye responsabilidades que no puedan excluirse legalmente.</p>

    <h2>9. Suspensión y baja</h2>
    <p>Podés dejar de usar el Servicio y solicitar la baja de tu cuenta en cualquier momento escribiendo a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>. Podemos suspender o dar de baja cuentas que incumplan estos Términos o que comprometan la seguridad del Servicio.</p>

    <h2>10. Cambios</h2>
    <p>Podemos actualizar estos Términos. Publicaremos la nueva versión con su fecha de vigencia y, si el cambio es sustancial, te avisaremos. El uso del Servicio posterior al cambio implica su aceptación.</p>

    <h2>11. Ley aplicable y jurisdicción</h2>
    <p>Estos Términos se rigen por las leyes de la República Argentina. ${LEGAL.jurisdiccion ? `Toda controversia se someterá a los ${LEGAL.jurisdiccion}.` : 'Toda controversia se someterá a los tribunales ordinarios competentes de la República Argentina.'} Si sos consumidor, conservás los derechos que te reconoce la Ley 24.240 y el fuero que ella establece.</p>

    <h2>12. Contacto</h2>
    <p>Consultas sobre estos Términos: <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>${LEGAL.telefono ? ` · ${LEGAL.telefono}` : ''}.</p>
  `, '#/privacidad', 'Política de Privacidad');
}

export function renderPrivacidad() {
  return pagina('Política de Privacidad', `
    <p>Esta Política explica qué datos personales trata ${LEGAL.producto}, para qué, con quién los compartimos y cuáles son tus derechos, conforme a la Ley N° 25.326 de Protección de los Datos Personales y su normativa complementaria.</p>

    <h2>1. Responsable y encargado del tratamiento</h2>
    <p><strong>${LEGAL.empresa}</strong> es responsable del tratamiento de los datos de las cuentas, de los prospectos que se contactan con nosotros y de los registros de seguridad. Respecto de los datos contables y personales que un estudio carga sobre sus clientes, empleados y proveedores, <strong>el estudio contable es el responsable</strong> y ${LEGAL.empresa} actúa como <strong>encargado del tratamiento</strong>: los trata solo para prestar el Servicio y según sus instrucciones.</p>
    ${LEGAL.aaipRegistro ? `<p>Base de datos inscripta ante el Registro Nacional de Bases de Datos Personales: ${LEGAL.aaipRegistro}.</p>` : ''}

    <h2>2. Qué datos tratamos</h2>
    <table>
      <thead><tr><th>Categoría</th><th>Datos</th><th>Origen</th></tr></thead>
      <tbody>
        <tr><td>Cuenta</td><td>Correo electrónico, contraseña (almacenada cifrada por el proveedor de autenticación), nombre del estudio, rol, fecha de alta y versión de los Términos aceptada.</td><td>Vos</td></tr>
        <tr><td>Contacto comercial</td><td>Nombre o razón social, nombre del estudio, CUIT y correo cargados en el formulario de registro.</td><td>Vos</td></tr>
        <tr><td>Datos contables del estudio y sus clientes</td><td>Razón social y CUIT de empresas, comprobantes de ventas y compras (con datos de clientes y proveedores), retenciones y percepciones, bienes de uso, liquidaciones de sueldos (que pueden incluir datos y remuneraciones de empleados), tickets y archivos cargados.</td><td>El estudio y sus clientes</td></tr>
        <tr><td>Seguridad y técnicos</td><td>Registros de eventos de seguridad, dirección IP y datos técnicos del navegador que recibe la infraestructura de alojamiento.</td><td>Generados por el uso</td></tr>
      </tbody>
    </table>
    <p>No solicitamos datos sensibles en los términos del art. 2 de la Ley 25.326. Te pedimos no cargarlos.</p>

    <h2>3. Para qué los usamos</h2>
    <ul>
      <li>Crear y administrar tu cuenta, autenticarte y prestar el Servicio (ejecución del contrato).</li>
      <li>Aplicar la separación entre estudios y entre clientes, y proteger la seguridad del Servicio.</li>
      <li>Responder consultas y contactarte por tu solicitud de demo o registro.</li>
      <li>Cumplir obligaciones legales.</li>
    </ul>
    <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>

    <h2>4. Con quién los compartimos (proveedores)</h2>
    <table>
      <thead><tr><th>Proveedor</th><th>Función</th><th>Ubicación</th></tr></thead>
      <tbody>
        <tr><td>Supabase</td><td>Base de datos y autenticación</td><td>Servidores fuera de la República Argentina</td></tr>
        <tr><td>Vercel</td><td>Alojamiento y entrega del sitio</td><td>Fuera de la República Argentina</td></tr>
        <tr><td>Google (Fonts)</td><td>Tipografías del sitio; recibe la dirección IP de tu navegador</td><td>Fuera de la República Argentina</td></tr>
        <tr><td>Google (Gemini) — opcional</td><td>Lectura automática de comprobantes, <strong>solo si el estudio configura su propia clave</strong>; la imagen del comprobante se envía a Google</td><td>Fuera de la República Argentina</td></tr>
        <tr><td>Sentry — opcional</td><td>Monitoreo de errores, si está activado; se enmascaran CUIT y correos y no se envían datos personales</td><td>Fuera de la República Argentina</td></tr>
      </tbody>
    </table>
    <p><strong>Transferencia internacional.</strong> Estos proveedores almacenan o procesan datos fuera del país. Los utilizamos como encargados bajo sus condiciones contractuales de protección de datos; si el país de destino no ofrece un nivel de protección adecuado, la transferencia se funda en las cláusulas contractuales y garantías previstas en la normativa argentina aplicable (art. 12 de la Ley 25.326 y sus normas reglamentarias) o en tu consentimiento.</p>

    <h2>5. Cuánto tiempo los conservamos</h2>
    <p>Conservamos los datos mientras tu cuenta esté activa y luego por el plazo necesario para cumplir obligaciones legales o resolver reclamos. Cuando solicitás la baja, suprimimos o anonimizamos los datos, salvo los que debamos conservar por ley. Recordá que como contador tenés tus propios deberes de conservación de documentación.</p>

    <h2>6. Seguridad</h2>
    <p>Aplicamos medidas técnicas y organizativas razonables: conexión cifrada (HTTPS), control de acceso por cuenta con aislamiento a nivel de base de datos entre estudios y entre clientes, contraseñas cifradas, validación de datos y registro de eventos de seguridad. Ningún sistema es infalible: en caso de un incidente que afecte tus datos te lo notificaremos conforme a la normativa.</p>

    <h2>7. Tus derechos</h2>
    <p>Podés ejercer los derechos de <strong>acceso, rectificación, actualización y supresión</strong> de tus datos escribiendo a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>. Responderemos el pedido de acceso dentro de los diez (10) días corridos y los de rectificación, actualización o supresión dentro de los cinco (5) días hábiles de recibidos. Si sos cliente de un estudio, te conviene dirigirte primero a tu estudio, que es el responsable de tus datos contables; te asistiremos en lo que corresponda.</p>
    <p><em>El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.</em></p>
    <p><em>La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.</em></p>

    <h2>8. Cookies y almacenamiento local</h2>
    <p>Usamos únicamente almacenamiento local del navegador para mantener tu sesión y preferencias (por ejemplo, el período fiscal seleccionado). No usamos cookies de publicidad ni herramientas de analítica de terceros.</p>

    <h2>9. Menores</h2>
    <p>El Servicio no está dirigido a menores de edad.</p>

    <h2>10. Cambios en esta Política</h2>
    <p>Podemos actualizar esta Política; publicaremos la versión vigente con su fecha y, si el cambio es sustancial, te lo informaremos.</p>

    <h2>11. Contacto</h2>
    <p><a href="mailto:${LEGAL.email}">${LEGAL.email}</a>${LEGAL.telefono ? ` · ${LEGAL.telefono}` : ''}.</p>
  `, '#/terminos', 'Términos y Condiciones');
}
