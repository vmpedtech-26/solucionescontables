/* -------------------------------------------------------------
   Monitoreo de errores (Sentry). Se activa solo si VITE_SENTRY_DSN esta
   definida en el build (Vercel -> Environment Variables); sin DSN no carga ni
   envia nada. El SDK se importa de forma diferida para no pesar en el bundle
   principal.
   ------------------------------------------------------------- */

const CUIT_RE = /\b\d{2}-?\d{8}-?\d\b/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function scrub(text) {
  return typeof text === 'string' ? text.replace(CUIT_RE, '[CUIT]').replace(EMAIL_RE, '[EMAIL]') : text;
}

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn,
    environment: window.location.hostname,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Datos fiscales de terceros: nunca salen del navegador.
      if (event.message) event.message = scrub(event.message);
      event.exception?.values?.forEach(v => { v.value = scrub(v.value); });
      event.breadcrumbs?.forEach(b => { b.message = scrub(b.message); });
      if (event.request) { delete event.request.cookies; delete event.request.headers; delete event.request.url; }
      delete event.user;
      return event;
    }
  });
}
