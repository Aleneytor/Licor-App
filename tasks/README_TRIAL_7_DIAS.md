# 🎉 Sistema de Prueba Gratuita de 7 Días - RESTAURADO

## ✅ Cambios Realizados

### 1. **Base de Datos (SQL)** 
Archivo: `tasks/add_trial_tracking.sql`

**Ejecutar este script en el SQL Editor de Supabase:**

✨ **Características:**
- ✅ Agrega columna `trial_started_at` a la tabla `organizations`
- ✅ Crea función `is_trial_active()` para verificar si el trial está activo
- ✅ Actualiza el trigger `handle_new_user()` para iniciar el trial automáticamente
- ✅ Crea función `get_trial_info()` para obtener información del trial
- ✅ Crea RPC `check_trial_status()` para usar desde el frontend
- ✅ Otorga 7 días de trial a organizaciones recientes sin licencia

### 2. **AuthContext** 
Archivo: `src/context/AuthContext.jsx`

**Cambios:**
- ✅ Actualizada query para incluir `trial_started_at`
- ✅ Lógica mejorada para verificar si está en trial
- ✅ Usuario tiene acceso si:
  1. Es developer, O
  2. Tiene licencia activa y no expirada, O
  3. **Está en período de prueba de 7 días** ⭐

### 3. **FreeTrialReminder** 
Archivo: `src/components/FreeTrialReminder.jsx`

**Cambios:**
- ✅ Ahora consulta `trial_started_at` de la base de datos
- ✅ Muestra días restantes del trial de 7 días
- ✅ Diferencia entre trial de 7 días y plan free
- ✅ Mensaje personalizado según el tipo de prueba

---

## 🚀 Instrucciones de Implementación

### Paso 1: Ejecutar el Script SQL

1. Ve a tu **Dashboard de Supabase**
2. Abre el **SQL Editor**
3. Copia y pega el contenido completo de `tasks/add_trial_tracking.sql`
4. Haz clic en **Run** / **Ejecutar**

**Verificación:**
Al final del script verás una tabla con:
- Organizaciones existentes
- Estado del trial (Activo/Expirado/Sin Trial)
- Días restantes

### Paso 2: Código Frontend (Ya está listo)

Los archivos ya han sido actualizados:
- ✅ `src/context/AuthContext.jsx`
- ✅ `src/components/FreeTrialReminder.jsx`

### Paso 3: Probar el Sistema

1. **Crear una nueva cuenta:**
   - Registrarse como "Soy Dueño de Negocio"
   - Ingresar nombre de licorería
   - Completar registro

2. **Verificar acceso:**
   - Deberías poder acceder a todas las funciones
   - Ver banner: "Prueba gratuita: 7 días restantes"

3. **Verificar en base de datos:**
   ```sql
   SELECT 
       o.name,
       o.trial_started_at,
       o.trial_started_at + INTERVAL '7 days' as trial_ends,
       o.is_active
   FROM organizations o
   ORDER BY created_at DESC
   LIMIT 5;
   ```

---

## 🎯 Cómo Funciona

### Flujo de Registro:

1. **Usuario se registra** como dueño
2. **Trigger automático** crea organización con `trial_started_at = NOW()`
3. **AuthContext** detecta el trial activo
4. **Usuario tiene acceso completo** durante 7 días
5. **Banner muestra** días restantes
6. **Después de 7 días**: Se bloquea acceso hasta activar licencia

### Lógica de Acceso:

```javascript
// Usuario tiene acceso si cumple CUALQUIERA de estas condiciones:
const hasAccess = 
    isDeveloper ||                    // 1. Es developer
    (isActive && !isExpired) ||       // 2. Tiene licencia activa
    isInTrial;                         // 3. Está en trial de 7 días ⭐
```

### Cálculo del Trial:

```javascript
const trialStart = new Date(trial_started_at);
const trialEnd = trialStart + 7 días;
const daysLeft = Math.ceil((trialEnd - NOW) / 1 día);
```

---

## 🔧 Funciones SQL Disponibles

### 1. Verificar si trial está activo:
```sql
SELECT is_trial_active('org_id_aqui');
```

### 2. Obtener información del trial:
```sql
SELECT * FROM get_trial_info('org_id_aqui');
```

### 3. Verificar estado desde el frontend:
```javascript
const { data } = await supabase.rpc('check_trial_status');
console.log(data); 
// {
//   hasTrial: true,
//   isTrialActive: true,
//   daysRemaining: 6
// }
```

---

## 📊 Estados Posibles

| Estado | is_active | trial_started_at | Acceso | Banner |
|--------|-----------|-----------------|--------|--------|
| **Trial Activo** | FALSE | Hace < 7 días | ✅ SÍ | "X días restantes" |
| **Trial Expirado** | FALSE | Hace > 7 días | ❌ NO | - |
| **Licencia Activa** | TRUE | Cualquiera | ✅ SÍ | - |
| **Sin Trial** | FALSE | NULL | ❌ NO | - |

---

## 🐛 Troubleshooting

### Problema: El trial no se activa automáticamente

**Solución:**
```sql
-- Activar trial manualmente para una organización
UPDATE organizations
SET trial_started_at = NOW()
WHERE id = 'org_id_aqui';
```

### Problema: Banner no aparece

**Verificar:**
1. `organizationId` no es null en AuthContext
2. `trial_started_at` existe en la base de datos
3. No está en localStorage como dismissed

### Problema: Sigue bloqueando después de ejecutar SQL

**Verificar:**
1. El trigger se creó correctamente:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

2. La columna existe:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'organizations' 
   AND column_name = 'trial_started_at';
   ```

---

## ✨ Beneficios

✅ **Automático**: Trial se activa al registrarse
✅ **Sin fricción**: No necesita ingresar código
✅ **Claro**: Usuario ve días restantes
✅ **Flexible**: Funciona junto con sistema de licencias
✅ **Rastreable**: Se puede ver en DevTools quién está en trial

---

## 📝 Notas Importantes

- ⚠️ El trial es **solo para nuevas organizaciones**
- ⚠️ Una vez expirado el trial, **requiere licencia**
- ⚠️ El trial **no se reinicia** (columna `trial_started_at` permanece)
- ✅ El sistema **distingue** entre trial y plan free
- ✅ Developers **siempre tienen acceso** sin restricciones

---

## 🎉 ¡Listo!

Después de ejecutar el script SQL, el sistema de prueba gratuita de 7 días estará completamente funcional.

**Nuevos usuarios podrán:**
- ✅ Registrarse sin código de licencia
- ✅ Usar todas las funciones durante 7 días
- ✅ Ver banner con countdown
- ✅ Activar licencia en cualquier momento
