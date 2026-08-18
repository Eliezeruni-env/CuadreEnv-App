# Auditoría responsive (resumen inicial)

Generado automáticamente: listado de patrones que pueden causar problemas responsive.

Prioridad - arreglos rápidos recomendados:

- Reemplazar anchos inline en tablas/acciones (`style="width: 120px"`) por clases utilitarias o `.action-cell` y ocultar/colapsar en móvil.
- Evitar `style="width: 18rem;"` en `c-card` (usa clases utilitarias o max-width en %).
- Revisar `white-space: nowrap` en `section-nav` para permitir wrapping o overflow-x con scroll controlado.

Archivos con hallazgos (ejemplos):

- `src/app/views/products/products.component.scss`: overflow y anchos fijos en items.
- `src/app/views/base/cards/cards.component.html`: uso de `style="width: 18rem;"` en múltiples tarjetas.
- `src/app/layout/default-layout/default-header/default-header.component.html`: uso de `style="min-width: 220px;"` en dropdowns.
- `src/app/views/*/*.html` (varios): columnas de acción con `style="width: 120px|150px|180px"` en tablas (products, customers, payments, users, purchases, sales, cash-register).
- `src/app/shared/components/section-nav/section-nav.component.scss`: tiene `white-space: nowrap` en mobile y `overflow-x: auto` — revisar UX.

Siguiente paso sugerido:

1. Migrar tablas a `app-table` gradualmente (empezar con `customers` y `products`).
2. Añadir clases `.action-cell` y ocultar/colapsar botones en mobile (dropdown).
3. Reemplazar estilos inline por variables y clases utilitarias en `src/scss`.

Si quieres, empiezo migrando `customers` a `app-table` y corrigiendo sus columnas de acción.
