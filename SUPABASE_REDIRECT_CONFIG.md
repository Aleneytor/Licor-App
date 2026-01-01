# 🔐 Configuración de URLs de Redirección en Supabase

## Problema
Cuando los usuarios confirman su email, Supabase los redirige con un token en el URL como:
```
https://kavas.app/#access_token=...&type=signup
```

Pero la aplicación no los redirige automáticamente a la página principal.

## ✅ Solución Implementada

### 1. AuthListener Mejorado
El componente `AuthListener.jsx` ahora:
- ✅ Detecta cuando un usuario confirma su email (`type=signup`)
- ✅ Muestra una notificación de éxito
- ✅ **Redirige automáticamente** a `/vender` después de 500ms
- ✅ También maneja recuperación de contraseña (`type=recovery`)
- ✅ Redirige al login cuando se cierra sesión

### 2. Flujo Completo de Registro

```
1. Usuario se registra → /register
2. Supabase envía email de confirmación
3. Usuario hace clic en el link del email
4. Supabase redirige a: https://kavas.app/#access_token=...
5. AuthListener detecta el token
6. AuthContext autentica al usuario
7. AuthListener redirige a /vender
8. Usuario ve la app completa ✅
```

## 📋 Configuración en Supabase Dashboard

Para que todo funcione correctamente, necesitas configurar las URLs de redirección en Supabase:

### Paso 1: Ve a Supabase Dashboard

1. Abre tu proyecto en [app.supabase.com](https://app.supabase.com)
2. Ve a **Authentication** → **URL Configuration**

### Paso 2: Configura las URLs

**Site URL**:
```
https://kavas.app
```

**Redirect URLs** (agregar todas estas):
```
http://localhost:5173
http://localhost:5173/**
https://kavas.app
https://kavas.app/**
```

### Paso 3: Configuración de Email Templates

Ve a **Authentication** → **Email Templates** y verifica que los links de confirmación apunten a:

**Confirm signup**:
```
{{ .SiteURL }}/#access_token={{ .Token }}&type=signup
```

**Reset password**:
```
{{ .SiteURL }}/#access_token={{ .Token }}&type=recovery
```

**Invite user**:
```
{{ .SiteURL }}/#access_token={{ .Token }}&type=invite
```

## 🧪 Testing Local

### Para probar en localhost:

1. En Supabase Dashboard, agrega a Redirect URLs:
   ```
   http://localhost:5173
   http://localhost:5173/**
   ```

2. En tu `.env` local, configura:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

3. Registra un usuario de prueba
4. Revisa tu email y haz clic en el link
5. Deberías ser redirigido a `http://localhost:5173/#access_token=...`
6. La app automáticamente te llevará a `/vender`

## 🚀 Testing en Producción

### Después del Deploy:

1. Asegúrate de que `https://kavas.app` esté en las Redirect URLs
2. Los emails enviados por Supabase usarán `{{ .SiteURL }}`
3. Los usuarios serán redirigidos a `https://kavas.app/#access_token=...`
4. El AuthListener los redirigirá a `/vender`

## ⚠️ Troubleshooting

### Si el token no funciona:

1. **Verifica la consola del navegador**:
   - Abre DevTools (F12)
   - Ve a Console
   - Busca errores de Supabase

2. **Verifica que el email esté configurado**:
   - En Supabase Dashboard → Authentication → Email Templates
   - Asegúrate de que "Confirm your signup" esté habilitado

3. **Verifica las Redirect URLs**:
   - Debe incluir el dominio exacto (con https://)
   - Debe incluir wildcards (**) para permitir subrutas

### Si ves "Email link is invalid or has expired":

- El token expira después de 1 hora
- El usuario necesita solicitar un nuevo email de confirmación
- Puedes reenviar el email desde Supabase Dashboard → Authentication → Users

### Si el usuario se queda en la landing page:

- Verifica que el AuthListener esté montado en App.jsx
- Verifica que React Router esté funcionando
- Revisa la consola para errores de navegación

## 🔄 Confirmación Manual (Desarrollo)

Si quieres saltarte la confirmación de email durante desarrollo:

1. Ve a Supabase Dashboard → Authentication → Settings
2. En "Email Auth" desactiva "Enable email confirmations"
3. Los usuarios se registrarán instantáneamente sin necesidad de confirmar

**⚠️ IMPORTANTE**: Vuelve a activar esto en producción.

## 📱 Modo Incógnito para Testing

Para probar el flujo completo:
1. Abre una ventana de incógnito
2. Ve a tu app y regístrate
3. Abre el email en la misma ventana de incógnito
4. Haz clic en el link de confirmación
5. Deberías ser autenticado y redirigido automáticamente

---

**Resultado Esperado**: Después de confirmar el email, el usuario debe ser redirigido automáticamente a `/vender` y ver la interfaz completa de la aplicación.
