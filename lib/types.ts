export type Department = "Phones" | "Clothing" | "Gifts";
export type PaymentMethod = "Cash" | "Card" | "Bank transfer" | "Credit";
export type Permission =
  | "*"
  | "dashboard.view"
  | "sales.view"
  | "sales.manage"
  | "sales.priceTier"
  | "sales.discount"
  | "sales.priceOverride"
  | "inventory.view"
  | "inventory.manage"
  | "repairs.view"
  | "repairs.manage"
  | "repairs.credentials"
  | "customers.view"
  | "customers.manage"
  | "purchasing.view"
  | "purchasing.manage"
  | "expenses.view"
  | "expenses.manage"
  | "cod.view"
  | "cod.manage"
  | "reloads.view"
  | "reloads.manage"
  | "payroll.view"
  | "payroll.manage"
  | "reports.view"
  | "settings.manage"
  | "users.manage"
  | "alerts.view"
  | "alerts.manage";
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: string;
  permissions: Permission[];
  active: boolean;
  staffId?: string;
}
export type PriceTier = "Retail" | "Wholesale" | "VIP" | "Agent";
export interface PriceSettings {
  Retail: number;
  Wholesale?: number;
  VIP?: number;
  Agent?: number;
  minimum?: number;
  maximum?: number;
}
export interface CartPricingItem {
  productId: string;
  quantity: number;
  imei?: string;
  priceTier?: PriceTier;
  discountType?: "Amount" | "Percent";
  discountValue?: number;
  unitPrice?: number;
  overrideReason?: string;
}
export interface Product {
  pricing?: PriceSettings;
  id: string;
  sku: string;
  name: string;
  category: string;
  department: Department;
  price: number;
  cost: number;
  stock: number;
  reorderLevel: number;
  serialized: boolean;
  active?: boolean;
  color: string;
}
export interface Batch {
  pricing?: PriceSettings;
  id: string;
  productId: string;
  lot: string;
  supplier: string;
  quantity: number;
  remaining: number;
  unitCost: number;
  receivedAt: string;
  imeis: string[];
}
export interface Customer {
  priceTier?: PriceTier;
  id: string;
  name: string;
  phone: string;
  address?: string;
  storeCredit?: number;
}
export interface SaleLine {
  priceTier?: PriceTier;
  originalPrice?: number;
  unitPriceBeforeDiscount?: number;
  unitDiscount?: number;
  discountType?: "Amount" | "Percent";
  discountValue?: number;
  minimumPrice?: number;
  maximumPrice?: number;
  invoiceDiscount?: number;
  total?: number;
  lot?: string;
  overrideReason?: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  imei?: string;
  batchAllocations: { batchId: string; quantity: number; unitCost: number }[];
}
export interface Sale {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  department: Department | "Mixed";
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  paid: number;
  method: PaymentMethod;
  status: "Paid" | "Partial" | "Credit" | "Returned";
  createdAt: string;
  commission: number;
  agentCommission: number;
  agentId?: string;
  agentName?: string;
  staffId?: string;
  staffName?: string;
  dueDate?: string;
  creditReminderDaysSent?: number[];
  payments?: { amount: number; method: PaymentMethod }[];
  returnInfo?: {
    reason: string;
    disposition: string;
    refund: number;
    at: string;
  };
}
export type RepairStatus =
  | "Received"
  | "Diagnosing"
  | "Awaiting approval"
  | "Approved"
  | "In progress"
  | "Ready for collection"
  | "Collected"
  | "Declined";
export interface Repair {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  device: string;
  imei: string;
  issue: string;
  condition: string;
  accessories: string[];
  notes: string;
  estimate: number;
  partsCost: number;
  parts?: {
    productId: string;
    name: string;
    quantity: number;
    estimatedUnitCost: number;
    actualCost?: number;
  }[];
  hasCredential?: boolean;
  credentialCiphertext?: string;
  staffPercent: number;
  status: RepairStatus;
  approval?: { method: string; at: string };
  warrantyDays: number;
  createdAt: string;
  completedAt?: string;
  commission: number;
  paid: number;
  technicianStaffId?: string;
  technicianName?: string;
  warrantyClaims?: {
    id: string;
    issue: string;
    createdAt: string;
    status: string;
  }[];
}
export interface Expense {
  id: string;
  description: string;
  category: string;
  department: Department | "General";
  amount: number;
  date: string;
}
export interface Purchase {
  id: string;
  number: string;
  supplier: string;
  total: number;
  paid: number;
  date: string;
  status: "Received" | "Partial";
}
export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  lines: {
    productId: string;
    productName: string;
    ordered: number;
    received: number;
    unitCost: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  dueDate: string;
  status: "Ordered" | "Partially received" | "Received" | "Cancelled";
  createdAt: string;
}
export interface Cheque {
  id: string;
  number: string;
  supplier: string;
  amount: number;
  dueDate: string;
  status: "Issued" | "Presented" | "Cleared" | "Dishonoured" | "Cancelled";
  purchaseId?: string;
}
export interface Shipment {
  id: string;
  orderRef: string;
  customerName: string;
  tracking: string;
  amount: number;
  postage: number;
  status: "Packed" | "Shipped" | "Delivered" | "Collected" | "Returned";
  date: string;
  collected: number;
  courier?: string;
  settlementId?: string;
}
export interface Reload {
  id: string;
  provider: string;
  type: "Top-up" | "Reload" | "Bill payment";
  phone: string;
  amount: number;
  commission: number;
  date: string;
}
export interface Staff {
  id: string;
  name: string;
  role: string;
  salary: number;
  advances: number;
  paidCommission: number;
  payrollMonths?: string[];
}
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  creditDays: number;
  openingBalance: number;
  paid: number;
}
export interface SupplierReturn {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
  amount: number;
  reason: string;
  resolution: "Pending" | "Credit note" | "Replacement" | "Refund";
  status: "Pending" | "Settled";
  createdAt: string;
  settledAt?: string;
}
export interface Agent {
  id: string;
  name: string;
  phone: string;
  defaultSharePercent: number;
  paidCommission: number;
  active: boolean;
}
export interface CommissionSettlement {
  id: string;
  payeeType: "Agent" | "Staff";
  payeeId: string;
  payeeName: string;
  amount: number;
  method: Exclude<PaymentMethod, "Credit">;
  createdAt: string;
}
export interface SaleReturn {
  id: string;
  saleId: string;
  saleNumber: string;
  items: {
    lineIndex: number;
    quantity: number;
    disposition: "Restock" | "Supplier return" | "Waste";
    amount: number;
    cost: number;
  }[];
  resolution: "Refund" | "Exchange" | "Store credit";
  reason: string;
  total: number;
  cost: number;
  createdAt: string;
}
export interface CodSettlement {
  id: string;
  shipmentIds: string[];
  reference: string;
  expected: number;
  received: number;
  fees: number;
  difference: number;
  createdAt: string;
}
export interface Alert {
  id: string;
  type: "Bus arrival" | "Credit reminder" | "Stock" | "General";
  title: string;
  repairId?: string;
  busRoute?: string;
  arrivalLocation?: string;
  dueAt: string;
  assigneeUserId?: string;
  assigneeName?: string;
  minutesBefore: number;
  status: "Scheduled" | "Due" | "Acknowledged" | "Escalated" | "Cancelled";
  acknowledgedAt?: string;
  escalatedAt?: string;
  createdAt: string;
}
export interface ProviderRule {
  provider: string;
  topupBonusPercent: number;
  transactionCommissionPercent: number;
  recognition: "Top-up" | "Transaction" | "Manual";
}
export interface Notification {
  id: string;
  title: string;
  detail: string;
  read: boolean;
  createdAt: string;
}
export interface Sms {
  id: string;
  phone: string;
  message: string;
  status: "Pending configuration" | "Queued" | "Sent" | "Failed";
  createdAt: string;
}
export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}
export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}
export interface Journal {
  id: string;
  reference: string;
  description: string;
  date: string;
  lines: JournalLine[];
}
export interface Audit {
  id: string;
  action: string;
  detail: string;
  at: string;
  userId?: string;
  userName?: string;
}
export interface Settings {
  businessName: string;
  phone: string;
  address: string;
  dailyTarget: number;
  accessoryPercent: number;
  agentSharePercent: number;
  repairStaffPercent: number;
  commissionConfirmed: boolean;
  smsEnabled: boolean;
  smsSenderId: string;
  smsApiKeyConfigured: boolean;
  smsApiKeyCiphertext?: string;
  providerRules: ProviderRule[];
  creditReminderDays: number[];
}
export interface Workspace {
  users?: AuthUser[];
  products: Product[];
  batches: Batch[];
  customers: Customer[];
  sales: Sale[];
  repairs: Repair[];
  expenses: Expense[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  cheques: Cheque[];
  shipments: Shipment[];
  reloads: Reload[];
  staff: Staff[];
  suppliers: Supplier[];
  supplierReturns: SupplierReturn[];
  agents: Agent[];
  commissionSettlements: CommissionSettlement[];
  returns: SaleReturn[];
  codSettlements: CodSettlement[];
  alerts: Alert[];
  notifications: Notification[];
  sms: Sms[];
  pushSubscriptions: PushSubscriptionRecord[];
  journal: Journal[];
  audit: Audit[];
  settings: Settings;
}
export interface WorkspaceResponse {
  data: Workspace;
  mode: "demo" | "database";
  user: AuthUser;
}
// Monetary amounts are integer LKR cents throughout the API (Rs. 1,200 = 120000).
export type Action = {
  type: string;
  payload: Record<string, unknown>;
  requestId: string;
};
