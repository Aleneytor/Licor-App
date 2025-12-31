# ✅ SISTEMA DE PRUEBA DE 7 DÍAS - VERSIÓN FINAL

## 🎯 Funcionamiento Correcto

### **Cuando el Usuario se Registra:**
1. ❌ **NO** obtiene trial automáticamente
2. ✅ Ve mensaje: **"Acceso Restringido"**
3. ✅ Ve el banner con **DOS BOTONES**:

---

## 🔵 **Botones del Banner**

### 1️⃣ **Botón NARANJA** - "Probar 7 Días" (con badge "Gratis")
```
┌────────────────────────────────────┐
│  Probar 7 Días        [Gratis]     │  ← NARANJA
└────────────────────────────────────┘
```
**Función:**
- ✅ Activa el trial de 7 días MANUALMENTE
- ✅ Ejecuta: `UPDATE organizations SET trial_started_at = NOW()`
- ✅ Recarga la página para mostrar acceso activo
- ✅ **REPORTADO en DevTools** (tabla de licencias)

### 2️⃣ **Botón VERDE** - "Activar Ahora" (con icono WhatsApp)
```
┌────────────────────────────────────┐
│  📲 Activar Ahora                  │  ← VERDE
└────────────────────────────────────┘
```
**Función:**
- ✅ Abre WhatsApp: `+58 422 013 1019`
- ✅ Mensaje pre-escrito para solicitar licencia
- ✅ Para usuarios que quieren comprar directamente

---

## 📊 **Estados del Banner**

### **Estado 1: Sin Licencia y Sin Trial**
```
┌─────────────────────────────────────────────────┐
│ 🔴 Acceso Restringido                          │
│    Para usar las funciones del menú activa la  │
│    licencia.                                    │
│                                                 │
│  ┌─────────────────────────────────┐            │
│  │ Probar 7 Días        [Gratis]   │  ← Naranja│
│  └─────────────────────────────────┘            │
│  ┌─────────────────────────────────┐            │
│  │ 📲 Activar Ahora                │  ← Verde  │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

### **Estado 2: Trial Activo (después de presionar botón naranja)**
```
┌─────────────────────────────────────────────────┐
│ 🔵 Prueba gratuita: 6 días restantes           │
│    Activa un plan premium                      │
│                                                 │
│  ┌─────────────────────────────────┐            │
│  │ 📲 Activar Ahora                │  ← Verde  │
│  └─────────────────────────────────┘            │
│  (El botón naranja ya no aparece)               │
└─────────────────────────────────────────────────┘
```

---

## 🔧 **DevTools - Tabla de Licencias**

Cuando el usuario activa el trial, los developers ven:

```
┌──────────┬──────────┬─────────────┬──────────────────┐
│ Licencia │ Estado   │ Cliente     │ Vencimiento      │
├──────────┼──────────┼─────────────┼──────────────────┤
│ -        │ En Uso   │ Mi Tienda   │ Trial Activo     │
│          │          │             │ 6d restantes     │
└──────────┴──────────┴─────────────┴──────────────────┘
```

**Información visible:**
- ✅ Usuario está en trial
- ✅ Días restantes
- ✅ No tiene código de licencia (aparece `-`)
- ✅ Color azul para trial activo

---

## 📝 **Archivos Modificados**

### 1. **FreeTrialReminder.jsx** ✅
- ✅ Dos botones (naranja y verde)
- ✅ Botón naranja activa trial
- ✅ Botón verde abre WhatsApp
- ✅ Responsive para móviles
- ✅ Se muestra cuando NO tienen licencia

### 2. **add_trial_tracking.sql** ✅
- ✅ NO activa trial automáticamente
- ✅ Crea columna `trial_started_at` (NULL por defecto)
- ✅ Funciones helper para verificar trial
- ✅ RPC para frontend

### 3. **AuthContext.jsx** ✅
- ✅ Verifica trial de 7 días
- ✅ Incluye `trial_started_at` en queries
- ✅ Usuario tiene acceso si está en trial

### 4. **DeveloperPage.jsx** ✅
- ✅ Muestra info del trial en tabla
- ✅ Desktop y móvil
- ✅ Colores correctos (azul para trial)

---

## 🚀 **Flujo Completo del Usuario**

### **Paso 1: Registro**
1. Usuario se registra como dueño
2. Organization creada SIN trial (`trial_started_at = NULL`)
3. Ve "Acceso Restringido"

### **Paso 2: Ver Banner**
```
Acceso Restringido
Para usar las funciones del menú activa la licencia.

[🟠 Probar 7 Días  [Gratis]]
[🟢 📲 Activar Ahora        ]
```

### **Paso 3: Opción A - Activar Trial**
- Click en botón naranja
- Trial activado: `trial_started_at = NOW()`
- Página recarga
- ✅ **Acceso completo por 7 días**

### **Paso 4: Opción B - Comprar Licencia**
- Click en botón verde
- Abre WhatsApp
- Habla con ventas
- Obtiene código de licencia
- ✅ **Acceso completo permanente**

---

## 💡 **Ventajas del Sistema**

### Para el Usuario:
✅ **Decisión clara**: Trial gratis vs Comprar
✅ **Sin fricción**: Un click para probar
✅ **Transparente**: Ve cuántos días le quedan

### Para el Negocio:
✅ **Conversión**: Trial incentiva a probar
✅ **Seguimiento**: DevTools muestra quién está en trial
✅ **Reporteable**: Sabes quién activó trial y cuándo expira
✅ **WhatsApp directo**: Canal de conversión claro

### Para Developers:
✅ **Trackeable**: Toda la info en la tabla de licencias
✅ **Control**: Pueden ver trials activos/expirados
✅ **Datos**: Saben cuándo contactar para convertir

---

## 🔒 **Seguridad**

- ✅ Trial de 7 días es **único** (solo se activa una vez)
- ✅ Una vez activado, `trial_started_at` no se modifica
- ✅ Developers pueden ver todo desde DevTools
- ✅ RLS policies protegen las operaciones

---

## 📊 **Reportes Disponibles**

### Via SQL:
```sql
-- Ver todos los trials activos
SELECT name, trial_started_at, 
       trial_started_at + INTERVAL '7 days' as expires
FROM organizations
WHERE trial_started_at IS NOT NULL
  AND trial_started_at + INTERVAL '7 days' > NOW()
  AND is_active = FALSE;

-- Ver trials que expiran pronto
SELECT name, 
       EXTRACT(DAY FROM ((trial_started_at + INTERVAL '7 days') - NOW())) as days_left
FROM organizations
WHERE trial_started_at IS NOT NULL
  AND trial_started_at + INTERVAL '7 days' > NOW()
  AND (trial_started_at + INTERVAL '7 days') - NOW() < INTERVAL '3 days';
```

---

## ✅ **TODO LISTO!**

**Siguiente paso:**
1. Ejecutar `add_trial_tracking.sql` en Supabase
2. ¡Ya funciona!

**El usuario verá:**
- Banner con 2 botones
- Botón naranja → Trial de 7 días
- Botón verde → WhatsApp para comprar

**Los developers verán:**
- En DevTools quién tiene trial activo
- Cuántos días quedan
- Quién necesita seguimiento
