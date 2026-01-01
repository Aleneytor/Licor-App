# 📧 Guía de Configuración: Brevo SMTP con Supabase

## ❌ Error Actual
```
Error sending confirmation email
```

## 🔍 Problemas Comunes y Soluciones

### **Problema 1: API Key Incorrecta** ⭐ **MÁS COMÚN**

Brevo usa **SMTP API Keys**, NO la contraseña de tu cuenta.

#### ✅ Solución:

1. **Ve a Brevo Dashboard**
2. **SMTP & API** → **SMTP Keys**
3. **Create a new SMTP key** (si no tienes una)
4. **Copia la clave** (formato: `xkeysib-xxxxx...`)
5. **Usa esa clave como Password en Supabase**

**Configuración correcta en Supabase:**
```
Username: juanamariasoteledosuarez@gmail.com
Password: xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### **Problema 2: Email Sender No Verificado**

Brevo requiere que el email sender (`info@kavas.app`) esté verificado.

#### ✅ Solución:

1. **Ve a Brevo** → **Senders**
2. **Add a new sender**
3. Ingresa: `info@kavas.app` con nombre `Kavas App`
4. **Te enviarán un email de verificación** a info@kavas.app
5. Confirma el email
6. Una vez verificado, vuelve a intentar en Supabase

---

### **Problema 3: Dominio No Autenticado**

Tu dominio `kavas.app` necesita autenticación SPF/DKIM.

#### ✅ Solución:

1. **Ve a Brevo** → **Senders** → **Domains**
2. **Add a domain**: `kavas.app`
3. Brevo te dará **registros DNS** (SPF, DKIM, DMARC)
4. **Agrega esos registros** en tu proveedor de DNS (ej: Netlify, Cloudflare, etc.)
5. **Espera 24-48 horas** para propagación
6. **Verifica** en Brevo que el dominio esté autenticado

**Registros DNS típicos de Brevo:**
```
Tipo: TXT
Nombre: @
Valor: v=spf1 include:spf.brevo.com ~all

Tipo: TXT
Nombre: mail._domainkey
Valor: (Brevo te lo proporciona)
```

---

### **Problema 4: Puerto o Seguridad Incorrectos**

Brevo requiere configuración específica de puerto.

#### ✅ Configuración correcta:

**Opción A: Puerto 587 (STARTTLS) - RECOMENDADO**
```
Host: smtp-relay.brevo.com
Port: 587
Username: juanamariasoteledosuarez@gmail.com
Password: [tu_smtp_api_key]
Encryption: STARTTLS
```

**Opción B: Puerto 465 (SSL)**
```
Host: smtp-relay.brevo.com
Port: 465
Username: juanamariasoteledosuarez@gmail.com
Password: [tu_smtp_api_key]
Encryption: SSL/TLS
```

---

### **Problema 5: Rate Limits de Brevo**

Brevo tiene límites de envío según tu plan.

#### ✅ Verifica:

1. **Brevo Dashboard** → **Settings** → **Plan details**
2. **Daily email limit**: ¿Cuántos puedes enviar?
3. **Si estás en plan gratuito**: Máximo 300 emails/día

---

## 🔧 Pasos de Troubleshooting

### **PASO 1: Obtener SMTP API Key de Brevo**

1. Ve a: https://app.brevo.com/
2. Settings → SMTP & API → SMTP
3. Click "Create a new SMTP key"
4. Dale un nombre: "Supabase Kavas App"
5. **Copia la clave completa**

### **PASO 2: Configurar en Supabase**

1. Ve a: **Supabase Dashboard** → **Authentication** → **Email**
2. **Enable custom SMTP**: ON
3. Configura:

```
Sender email address: info@kavas.app
Sender name: Kavas App

Host: smtp-relay.brevo.com
Port number: 587
Username: juanamariasoteledosuarez@gmail.com
Password: [pega aquí tu SMTP API Key de Brevo]
Minimum interval per user: 60
```

4. **Save changes**

### **PASO 3: Verificar Sender Email**

1. En Brevo → **Senders** → **Add sender**
2. Email: `info@kavas.app`
3. Name: `Kavas App`
4. Click "Add"
5. **Revisa tu email** info@kavas.app
6. Haz click en el link de verificación

### **PASO 4: Probar Conexión**

1. En Supabase → **Authentication** → **Email**
2. Click **"Send test email"** (si está disponible)
3. O intenta registrar un usuario nuevo

---

## 🧪 Test Manual de SMTP

Para verificar que Brevo SMTP funciona, puedes probar con este comando (PowerShell):

```powershell
# Instalar herramienta de testing SMTP (opcional)
# Usar online: https://www.smtper.net/

# Configuración a probar:
# SMTP Host: smtp-relay.brevo.com
# Port: 587
# Username: juanamariasoteledosuarez@gmail.com
# Password: [tu SMTP API key]
# From: info@kavas.app
# To: tu_email_personal@gmail.com
```

---

## ⚠️ Errores Comunes y Soluciones

### Error: "Authentication failed"
- ❌ Problema: API Key incorrecta o username incorrecto
- ✅ Solución: Verifica que estés usando la SMTP API Key, no la contraseña de tu cuenta

### Error: "Sender not verified"
- ❌ Problema: El email info@kavas.app no está verificado
- ✅ Solución: Ve a Brevo → Senders y verifica el email

### Error: "Domain not authenticated"
- ❌ Problema: El dominio kavas.app no tiene SPF/DKIM configurados
- ✅ Solución: Agrega los registros DNS que Brevo te proporciona

### Error: "Rate limit exceeded"
- ❌ Problema: Excediste el límite diario de emails
- ✅ Solución: Espera 24 horas o actualiza tu plan de Brevo

### Error: "Connection timeout"
- ❌ Problema: Puerto bloqueado o firewall
- ✅ Solución: Intenta puerto 465 en lugar de 587

---

## 📋 Checklist de Verificación

Marca cada uno antes de continuar:

- [ ] ✅ Obtuve la SMTP API Key de Brevo (no la contraseña de cuenta)
- [ ] ✅ La API Key está en el campo "Password" de Supabase
- [ ] ✅ El sender email (info@kavas.app) está verificado en Brevo
- [ ] ✅ El dominio kavas.app está autenticado en Brevo (SPF/DKIM)
- [ ] ✅ Los registros DNS están configurados correctamente
- [ ] ✅ He esperado al menos 1 hora desde la configuración DNS
- [ ] ✅ El puerto es 587 con STARTTLS
- [ ] ✅ No he excedido el límite de emails del día
- [ ] ✅ He guardado los cambios en Supabase
- [ ] ✅ He recargado la página de Supabase

---

## 🎯 Solución Rápida (Para Testing)

Si solo quieres **probar que funcione rápido** sin configurar dominio:

### Opción A: Usar email personal verificado

Temporalmente, usa tu email personal como sender:

```
Sender email: juanamariasoteledosuarez@gmail.com
Sender name: Kavas App
```

Esto funcionará inmediatamente porque ese email ya está verificado en Brevo.

### Opción B: Deshabilitar confirmación de email (solo desarrollo)

1. Supabase → Authentication → Settings
2. Email Auth → **Enable email confirmations: OFF**
3. Los usuarios se registrarán sin necesidad de confirmar

⚠️ **Recuerda activarlo de nuevo para producción**

---

## 📞 Contacto de Soporte

Si el problema persiste:

**Brevo Support:**
- Chat: https://app.brevo.com/ (abajo a la derecha)
- Email: support@brevo.com

**Supabase Support:**
- Discord: https://discord.supabase.com
- Docs: https://supabase.com/docs/guides/auth/auth-smtp

---

## 🔄 Próximos Pasos

1. **Obtén la SMTP API Key** de Brevo
2. **Pégala en Supabase** (campo Password)
3. **Verifica el sender email** info@kavas.app en Brevo
4. **Configura DNS** (SPF/DKIM) para kavas.app
5. **Espera 1-2 horas** para que DNS propague
6. **Prueba registrar** un usuario nuevo
7. **Revisa tu inbox** para el email de confirmación

---

**Si sigues teniendo problemas después de estos pasos, compárteme:**
- Screenshot del error específico
- Screenshot de tu configuración en Brevo (Senders)
- Screenshot de tu configuración DNS

¡Te ayudaré a resolverlo! 🚀
