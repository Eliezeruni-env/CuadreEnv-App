import type {
  ProductMovementDetail,
  WarehouseMovementHeader,
} from '../../../app/models/movement';

/**
 * Normalizes an individual line item from backend or local storage into a typed ProductMovementDetail.
 * Correctly accounts for PascalCase, camelCase, alternate naming (unitCost, qty, etc.).
 */
export function normalizeProductDetail(raw: any, defaultWarehouseId: number = 1): ProductMovementDetail {
  if (!raw) {
    return {
      productId: 0,
      productName: 'Producto',
      quantity: 0,
      cost: 0,
      price: 0,
      warehouseId: defaultWarehouseId,
      stockAvailable: 0,
    };
  }

  const productId = Number(raw.productId ?? raw.ProductId ?? raw.id ?? raw.Id ?? 0) || 0;
  const quantity = Number(
    raw.quantity ?? raw.Quantity ?? raw.qty ?? raw.Qty ?? raw.quantityReceived ?? raw.units ?? 0
  ) || 0;
  
  const cost = Number(
    raw.cost ?? raw.Cost ?? raw.unitCost ?? raw.UnitCost ?? raw.price ?? raw.Price ?? 0
  ) || 0;

  const price = Number(
    raw.price ?? raw.Price ?? raw.salePrice ?? raw.SalePrice ?? cost
  ) || 0;

  const productName =
    raw.productName ??
    raw.ProductName ??
    raw.name ??
    raw.Name ??
    (raw.product ? (raw.product.name ?? raw.product.productName) : undefined) ??
    (productId > 0 ? `Producto #${productId}` : 'Artículo sin nombre');

  const barCode =
    raw.barCode ??
    raw.BarCode ??
    raw.barcode ??
    raw.Barcode ??
    (raw.product ? (raw.product.barCode ?? raw.product.barcode) : undefined) ??
    (productId > 0 ? `PROD-${productId}` : '');

  const warehouseId = Number(
    raw.warehouseId ?? raw.WarehouseId ?? defaultWarehouseId
  ) || defaultWarehouseId;

  const stockAvailable = Number(
    raw.stockAvailable ?? raw.StockAvailable ?? raw.stock ?? 0
  ) || 0;

  return {
    productId,
    productName,
    barCode,
    quantity,
    cost,
    price,
    warehouseId,
    stockAvailable,
  };
}

/**
 * Normalizes any warehouse movement header (Entry, Outlet, Transfer) ensuring:
 * 1. Line items are safely unpacked and typed regardless of property naming.
 * 2. totalQuantity and totalCost are dynamically calculated from line items if backend sends 0, null, or empty.
 * 3. Dates, identifiers and warehouse names are consistently populated.
 */
export function normalizeWarehouseMovement<T extends WarehouseMovementHeader>(raw: any): T {
  if (!raw) return raw;

  const defaultWh = Number(raw.warehouseId ?? raw.WarehouseId ?? raw.warehouseOfOriginId ?? 1) || 1;

  // Extract raw details array from any known property name
  const rawList =
    raw.productDetails ??
    raw.details ??
    raw.warehouseEntryDetails ??
    raw.warehouseOutletDetails ??
    raw.warehouseTransferDetails ??
    raw.items ??
    [];

  const productDetails: ProductMovementDetail[] = (Array.isArray(rawList) ? rawList : []).map(
    (d: any) => normalizeProductDetail(d, defaultWh)
  );

  // Dynamically compute real totals
  const computedQuantity = productDetails.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const computedCost = productDetails.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.cost || item.price || 0),
    0
  );

  const rawQty = Number(raw.totalQuantity ?? raw.TotalQuantity ?? 0);
  const rawCost = Number(
    raw.totalCost ?? raw.TotalCost ?? raw.totalAmount ?? raw.TotalAmount ?? raw.amountTotal ?? 0
  );

  // If backend returned 0 or null, use computed sum of product details
  const totalQuantity = rawQty > 0 ? rawQty : computedQuantity;
  const totalCost = rawCost > 0 ? rawCost : computedCost;

  const id = Number(raw.id ?? raw.Id ?? Date.now());
  const prefix = raw.prefix ?? raw.Prefix ?? 'MOV';
  const movementNumber =
    raw.movementNumber ??
    raw.MovementNumber ??
    raw.number ??
    raw.code ??
    `${prefix}-${String(id).slice(-6)}`;

  const warehouseName =
    raw.warehouseName ??
    raw.WarehouseName ??
    (raw.warehouse ? (raw.warehouse.name ?? raw.warehouse.WarehouseName) : undefined) ??
    (raw.warehouseId ? `Almacén #${raw.warehouseId}` : undefined);

  const warehouseOfOriginName =
    raw.warehouseOfOriginName ??
    raw.WarehouseOfOriginName ??
    (raw.warehouseOfOrigin ? raw.warehouseOfOrigin.name : undefined) ??
    (raw.warehouseOfOriginId ? `Almacén #${raw.warehouseOfOriginId}` : undefined);

  const destinationWarehouseName =
    raw.destinationWarehouseName ??
    raw.DestinationWarehouseName ??
    (raw.destinationWarehouse ? raw.destinationWarehouse.name : undefined) ??
    (raw.destinationWarehouseId ? `Almacén #${raw.destinationWarehouseId}` : undefined);

  const conceptName =
    raw.conceptName ??
    raw.ConceptName ??
    (raw.concept ? raw.concept.name : undefined) ??
    'Movimiento de Almacén';

  const createDate =
    raw.createDate ??
    raw.CreateDate ??
    raw.date ??
    raw.Date ??
    raw.createdAt ??
    new Date().toISOString();

  const statusId = Number(raw.statusId ?? raw.StatusId ?? 1);
  const statusName =
    raw.statusName ??
    raw.StatusName ??
    (statusId === 1 ? 'Aplicado' : statusId === 2 ? 'Pendiente' : 'Anulado');

  return {
    ...raw,
    id,
    prefix,
    movementNumber,
    warehouseId: raw.warehouseId ?? raw.WarehouseId ?? defaultWh,
    warehouseName,
    warehouseOfOriginId: raw.warehouseOfOriginId ?? raw.WarehouseOfOriginId,
    warehouseOfOriginName,
    destinationWarehouseId: raw.destinationWarehouseId ?? raw.DestinationWarehouseId,
    destinationWarehouseName,
    conceptId: Number(raw.conceptId ?? raw.ConceptId ?? 1),
    conceptName,
    commentary: raw.commentary ?? raw.Commentary ?? raw.comments ?? raw.description ?? raw.observation ?? '',
    createDate,
    statusId,
    statusName,
    totalQuantity,
    totalCost,
    productDetails,
  } as T;
}
