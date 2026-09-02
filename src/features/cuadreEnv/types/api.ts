// ApiResponse<T>
export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  message?: string | null;
  errors?: string[] | null;
}

// PagedList<T>
export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalItemCount: number;
  pageCount?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}

// ProductType Enum & Options
export enum ProductTypeEnum {
  Standard = 1,     // Producto Estándar
  Service = 2,      // Servicio
  Digital = 3,      // Producto Digital
  Combo = 4,        // Combo / Paquete
  RawMaterial = 5   // Materia Prima / Insumo
}

export const PRODUCT_TYPE_OPTIONS = [
  { id: ProductTypeEnum.Standard, name: 'Producto Estándar (Físico)' },
  { id: ProductTypeEnum.Service, name: 'Servicio / Mano de Obra' },
  { id: ProductTypeEnum.Digital, name: 'Producto Digital / Licencia' },
  { id: ProductTypeEnum.Combo, name: 'Combo / Kit de Productos' },
  { id: ProductTypeEnum.RawMaterial, name: 'Materia Prima / Insumo' },
];

// Category Enum & Options
export enum CategoryEnum {
  General = 1,
  Alimentos = 2,
  Bebidas = 3,
  Papeleria = 4,
  Servicios = 5
}

export const CATEGORY_OPTIONS = [
  { id: CategoryEnum.General, name: 'General' },
  { id: CategoryEnum.Alimentos, name: 'Alimentos' },
  { id: CategoryEnum.Bebidas, name: 'Bebidas' },
  { id: CategoryEnum.Papeleria, name: 'Papelería' },
  { id: CategoryEnum.Servicios, name: 'Servicios' },
];

// Auth DTOs
export interface RegisterRequestDto {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  userName?: string | null;
  createCompanyName?: string | null;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  deviceId?: string | null;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponseDto {
  id: number;
  email: string;
}

export interface SessionDto {
  deviceId: string;
  createdAt: string; // ISO
  lastUsedAt?: string | null;
  isActive: boolean;
  expires: string; // ISO
}

// Company
export interface CreateCompanyRequest {
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface CompanySettingsDto {
  id?: number;
  companyId?: number;
  creditDaysLimit?: number;
  blockSalesIfOverdue?: boolean;
  currency?: string;
  timeZone?: string;
  invoiceNumberFormat?: string;
  logoUrl?: string | null;
  commercialName?: string | null;
  defaultStockAlertThreshold?: number;
  defaultTaxPercentage?: number;
}

export interface Company {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  settings?: CompanySettingsDto | null;
}

// User / Domain mapping
export interface UserDto {
  id?: number;
  firstName: string;
  lastName: string;
  identification?: string | null;
  gender?: string; // "M"|"F" or single char
  email: string;
  passwordHash?: string | null; // backend expects PasswordHash for Admin create; prefer Register flow
  phoneNumber?: string | null;
  birthDate?: string | null; // date ISO
  userName?: string | null;
  companyId?: number;
  role?: string; // "Admin" | "Manager" | "Employee"
  active?: boolean;
}

// Invitation
export interface InvitationRequest {
  email: string;
  validDays?: number;
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  role?: string | null;
}

// Product
export interface ProductDto {
  id?: number;
  description?: string | null;
  barcode?: string | null;
  companyId?: number;
  cost: number;
  stock: number;
  shortDescription?: string | null;
  reference?: string | null;
  maximumQuantity?: number;
  minimumQuantity?: number;
  productTypeId?: number;
  categoryId?: number;
  unitOfMeasurementId?: number;
  invoiceWithoutStock?: boolean;
}

// Warehouse / Inventory
export interface WarehouseDto {
  id: number;
  name: string;
  companyId: number;
}
export interface CreateWarehouseDto {
  name: string;
}
export interface InventoryDto {
  productId: number;
  warehouseId: number;
  quantity: number;
}
export interface MovementDto {
  id: number;
  productId: number;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  quantity: number;
  type: string;
}
export interface MovementRequestDto {
  productId: number;
  warehouseId: number;
  quantity: number;
}
export interface TransferRequestDto {
  productId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  quantity: number;
}

// Sale DTOs (frontend)
export interface SaleDetailDto {
  productId: number;
  quantity: number;
  unitPrice: number;
}
export interface SaleRequestDto {
  customerId?: number | null;
  total: number;
  paidAmount: number;
  cashRegisterId?: number | null;
  dueDate?: string | null;
  details: SaleDetailDto[];
}

export interface SaleResponseDto {
  id: number;
  customerId?: number | null;
  total: number;
  paidAmount: number;
  cashRegisterId?: number | null;
  dueDate?: string | null;
  isCancelled: boolean;
  creationDate: string;
  details: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
}

// Customer
export interface CustomerDto {
  id?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  identification?: string | null;
  active?: boolean;
}

// Purchase
export interface PurchaseDetailDto {
  productId: number;
  quantity: number;
  costPrice: number;
}
export interface PurchaseDto {
  id?: number;
  supplierId?: number | null;
  total: number;
  details: PurchaseDetailDto[];
  creationDate?: string;
}

// Payment
export interface PaymentDto {
  id?: number;
  saleId?: number | null;
  purchaseId?: number | null;
  amount: number;
  method: string;
  reference?: string | null;
  creationDate?: string;
}

// CashRegister
export interface CashRegisterDto {
  id?: number;
  name: string;
  isOpen: boolean;
  balance: number;
  companyId?: number;
}

// CashMovement
export interface CashMovementDto {
  id?: number;
  cashRegisterId: number;
  amount: number;
  type: string;
  description?: string | null;
  creationDate?: string;
}

// AccountReceivable & PaymentPlan DTOs
export interface PaymentPlanRequestDto {
  installmentAmount: number;
  totalInstallments: number;
  frequency?: string;
  startsAt?: string;
}

export interface CreateAccountReceivableRequestDto {
  companyId?: number;
  customerId?: number | null;
  saleId?: number | null;
  totalAmount: number;
  paidAmount?: number;
  dueDate?: string | null;
  plan?: PaymentPlanRequestDto | null;
}

export interface InstallmentDto {
  id: number;
  paymentPlanId: number;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  isPaid: boolean;
}

export interface RegisterARPaymentRequestDto {
  amount: number;
  method?: string;
  reference?: string | null;
  cashRegisterId?: number | null;
}

export interface PayInstallmentRequestDto {
  amount: number;
  method?: string;
  cashRegisterId?: number | null;
}

