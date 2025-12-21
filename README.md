# Licor App 0.5

Aplicación moderna para la gestión de puntos de venta (POS) e inventario, diseñada específicamente para licorerías. Permite un control total sobre ventas, inventario, precios y reportes financieros, con soporte para múltiples monedas (USD/EUR) y tasas de cambio.

## 🚀 Características Principales

### 🛒 Punto de Venta (Vender)
*   **Interfaz Rápida:** Diseño intuitivo para agregar productos al carrito rápidamente.
*   **Múltiples Precios:** Soporte automático para precios "Al Mayor" (Caja/Pack) y "Al Detal" (Unidad), así como precios diferenciados para consumo en el local ("Carta Abierta").
*   **Productos Variados:** Función inteligente para crear cajas mixtas ("Variados") con diferentes tipos de cervezas, calculando el precio exacto base.
*   **Pagos Flexibles:** Registro de pagos en Efectivo, Zelle, Pago Móvil y Punto de Venta.

### 📦 Gestión de Inventario
*   **Control de Stock:** Seguimiento preciso de botellas, cajas y packs.
*   **Unidades Fraccionadas:** El sistema entiende que 1 Caja = X Unidades, permitiendo vender unidades sueltas y descontar correctamente del inventario.
*   **Reporte de Mermas:** Registro de botellas rotas o dañadas ("Botellas Malas") para descontarlas del inventario sin afectar la caja.
*   **Acceso Rápido:** Botón flotante para revisiones rápidas de stock y reportes de cierre de turno.

### 📝 Carta Abierta (Pendientes)
*   **Consumo Local:** Gestión de mesas o clientes que consumen en el local.
*   **Optimización de Cierre:** Al cerrar una cuenta abierta, el sistema agrupa automáticamente las unidades consumidas en la presentación más grande posible (ej: 18 cervezas se guardan como 1 Media Caja) para mantener un historial limpio.
*   **Tickets y Comandas:** Generación de tickets visuales para cocina/barra.

### 💰 Caja y Reportes
*   **Cierre Diario:** Resumen financiero con ventas totales, ticket promedio y desglose por método de pago.
*   **Multimoneda:** Visualización de totales en USD ($) o Euros (€) según la configuración del negocio.
*   **Exportación:** Descarga de reportes diarios en formato Excel.
*   **Dashboard:** Gráficos de métodos de pago y lista de productos más vendidos.

### ⚙️ Ajustes y Configuración
*   **Gestión de Productos:** Crear y editar cervezas, asignar colores y configurar presentaciones (Caja, Media Caja, Six Pack, etc.).
*   **Precios:** Editor masivo de precios para configurar rápidamente costos de "Llevar" vs "Local".
*   **Moneda:** Configuración de la moneda principal del negocio (Dólar BCV o Euro BCV) y actualización de tasas de cambio.
*   **Usuarios:** Gestión de roles (Administrador, Mánager, Empleado).

## 🛠️ Tecnologías Usadas
*   **Frontend:** React (Vite)
*   **Estilos:** CSS Modules / Vanilla CSS con variables para temas (Dark/Light).
*   **Estado:** React Context API (ProductContext, OrderContext, AuthContext).
*   **Iconos:** Lucide React.
*   **Utilidades:** SheetJS (xlsx) para reportes.

## 📦 Instalación

1.  Clonar el repositorio.
2.  Instalar dependencias:
    ```bash
    npm install
    ```
3.  Correr en modo desarrollo:
    ```bash
    npm run dev
    ```
