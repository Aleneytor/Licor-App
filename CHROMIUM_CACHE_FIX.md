# Solución a Problemas de Caché en Navegadores Chromium

Si estás experimentando problemas al cargar la aplicación Kavas en navegadores basados en Chromium (Chrome, Edge, Brave, Opera, etc.), sigue estos pasos:

## Problema Identificado
El Service Worker puede estar cachéando versiones antiguas de la aplicación, impidiendo que se cargue correctamente en desarrollo.

## Solución Rápida

### Opción 1: Limpieza Manual en el Navegador

1. Abre las **DevTools** (F12 o Ctrl+Shift+I)
2. Ve a la pestaña **Application** (Aplicación)
3. En el panel izquierdo, busca **Service Workers**
4. Haz clic en **Unregister** (Anular registro) junto a cualquier Service Worker registrado
5. Luego ve a **Storage** > **Clear site data** y marca todas las opciones
6. Haz clic en **Clear site data**
7. Recarga la página con **Ctrl+Shift+R** (hard reload)

### Opción 2: Usando la Consola del Navegador

1. Abre la **Consola** en DevTools (F12)
2. Pega y ejecuta el siguiente código:

```javascript
// Desregistrar Service Workers
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

// Limpiar cachés
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) {
            caches.delete(name);
        }
    });
}

// Recargar
location.reload(true);
```

### Opción 3: Modo Incógnito
Abre la aplicación en una ventana de incógnito (Ctrl+Shift+N) para verificar si funciona sin caché.

## Cambios Realizados

✅ **Service Worker deshabilitado en desarrollo**: El Service Worker ahora solo se registra en producción.
✅ **Meta tags de compatibilidad agregados**: Se agregaron meta tags para mejorar la compatibilidad con Chromium.
✅ **Manejo de errores mejorado**: El registro del Service Worker ahora tiene manejo de errores.

## Prevención Futura

Durante el desarrollo, es recomendable:
- Usar las DevTools con la opción **"Disable cache"** marcada (en la pestaña Network)
- O trabajar en modo incógnito para evitar problemas de caché

## Si el Problema Persiste

Si después de estos pasos la aplicación aún no carga:
1. Verifica que el servidor de desarrollo esté corriendo (`npm run dev`)
2. Revisa la consola del navegador para errores específicos
3. Asegúrate de que no haya firewall o antivirus bloqueando localhost
