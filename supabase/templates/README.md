# Plantillas de email de Supabase (español)

Supabase solo permite editarlas con SMTP propio configurado
(Authentication → Emails → SMTP Settings).

| Archivo | Plantilla en Supabase | Asunto |
|---|---|---|
| confirmar-registro.html | Confirm sign up | Confirmá tu cuenta de Soluciones Contables |
| recuperar-contrasena.html | Reset password | Elegí una contraseña nueva |
| cambiar-email.html | Change email address | Confirmá tu nuevo email |

Pegar el HTML en el cuerpo y el asunto indicado. `{{ .ConfirmationURL }}` lo completa Supabase.
