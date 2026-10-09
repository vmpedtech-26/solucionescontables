/* -------------------------------------------------------------
   Recuperacion de contrasena: el link del mail de Supabase vuelve al
   sitio con los datos de la sesion de recuperacion; main.js los captura
   antes del ruteo y abre esta pantalla para elegir la contrasena nueva.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured } from '../db/supabase.js';

const tarjeta = (contenido) => `
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg-secondary);">
    <div style="background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 16px; padding: 36px; max-width: 420px; width: 100%; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);">
      <div style="text-align: center; margin-bottom: 22px;">
        <img src="/SolucionesContables_Logo.png" alt="Soluciones Contables" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 1px solid rgba(15, 23, 42, 0.1);">
      </div>
      ${contenido}
    </div>
  </div>`;

const input = 'width: 100%; padding: 11px 14px; border: 1px solid rgba(15, 23, 42, 0.15); border-radius: 8px; font-size: 14px; box-sizing: border-box;';
const label = 'display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;';

export function renderRecuperar() {
  return tarjeta(`
    <h2 style="font-family: var(--font-heading); font-size: 22px; text-align: center; margin: 0 0 6px; color: var(--color-primary);">Elegí tu nueva contraseña</h2>
    <p id="rec-sub" style="text-align: center; font-size: 13px; color: var(--text-secondary); margin: 0 0 22px;">Verificando el link de recuperación…</p>
    <form id="rec-form" style="display: none; flex-direction: column; gap: 14px;">
      <div><label for="rec-pass" style="${label}">Contraseña nueva</label>
        <input type="password" id="rec-pass" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres" style="${input}"></div>
      <div><label for="rec-pass2" style="${label}">Repetí la contraseña</label>
        <input type="password" id="rec-pass2" minlength="8" required autocomplete="new-password" style="${input}"></div>
      <button type="submit" id="rec-btn" class="btn btn-primary w-full">Guardar y entrar</button>
    </form>
    <div id="rec-error" style="display: none; text-align: center;">
      <p id="rec-error-txt" style="font-size: 13.5px; color: #b91c1c; margin: 0 0 16px;"></p>
      <a href="#/" class="btn btn-outline w-full" style="text-decoration: none;">Volver e intentar de nuevo</a>
    </div>`);
}

export async function initRecuperar(app, recuperacion = null) {
  const sub = document.getElementById('rec-sub');
  const form = document.getElementById('rec-form');
  const error = (msg) => {
    sub.style.display = 'none';
    form.style.display = 'none';
    document.getElementById('rec-error').style.display = 'block';
    document.getElementById('rec-error-txt').textContent = msg;
  };

  if (!isSupabaseConfigured || !supabase) return error('La recuperación de contraseña requiere una cuenta real.');
  if (recuperacion?.error) {
    return error(/expired|venc/i.test(recuperacion.error)
      ? 'El link de recuperación venció. Pedí uno nuevo desde Ingresar → ¿Olvidaste tu contraseña?'
      : 'El link de recuperación no es válido. Pedí uno nuevo desde Ingresar → ¿Olvidaste tu contraseña?');
  }
  if (recuperacion?.access_token) {
    const { error: e } = await supabase.auth.setSession({ access_token: recuperacion.access_token, refresh_token: recuperacion.refresh_token });
    if (e) return error('El link de recuperación venció o ya se usó. Pedí uno nuevo desde Ingresar → ¿Olvidaste tu contraseña?');
  }
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return error('Abrí esta pantalla desde el link que te mandamos por email. Si venció, pedí uno nuevo desde Ingresar → ¿Olvidaste tu contraseña?');

  sub.textContent = `Cuenta: ${data.session.user.email}`;
  form.style.display = 'flex';
  document.getElementById('rec-pass').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('rec-pass').value;
    const p2 = document.getElementById('rec-pass2').value;
    if (p1.length < 8) return app.showToast('La contraseña debe tener al menos 8 caracteres.', 'error');
    if (p1 !== p2) return app.showToast('Las contraseñas no coinciden.', 'error');
    const btn = document.getElementById('rec-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const { error: e2 } = await supabase.auth.updateUser({ password: p1 });
    if (e2) {
      btn.disabled = false;
      btn.textContent = 'Guardar y entrar';
      return app.showToast(/different|same/i.test(e2.message) ? 'La contraseña nueva tiene que ser distinta de la anterior.' : `No se pudo guardar: ${e2.message}`, 'error');
    }
    localStorage.setItem('vmp_premium_unlocked', 'true');
    app.showToast('Contraseña actualizada. ¡Bienvenido!', 'success');
    setTimeout(() => { window.location.hash = '#/studio'; }, 900);
  });
}
