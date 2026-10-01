"use client";
import { ArrivalAlarm } from "./components/arrival-alarm";
import { AttendanceWorkspace } from "./components/attendance-workspace";
import { approvedLeaveDays } from "@/lib/attendance";
import {
  BusAlertWorkspace,
  JourneyFormFields,
} from "./components/bus-alert-workspace";
import {
  DeviceSecretInput,
  ReadonlyPattern,
  RepairCreated,
  RepairIntakeReceipt,
  RepairLabel,
  RepairOverview,
} from "./components/repair-experience";
import { ProductLabel } from "./components/product-label";
import { LotPicker, type LotChoice } from "./components/lot-picker";
import { ReceiveGoods } from "./components/receive-goods";
import { ReloadPanel, type BillReload } from "./components/reload-panel";
import {
  CounterHome,
  type NowTicket,
  type Verb,
} from "./components/counter-home";
import { AskFido } from "./components/ask-fido";
import { AiSettingsPanel } from "./components/ai-settings";
import {
  CustomerDirectory,
  CustomerPaymentForm,
  CustomerPicker,
  CustomerProfile,
} from "./components/customer-experience";
import {
  filterRepairs,
  normalizeSriLankanPhone,
  type RepairPeriodFilter,
  type RepairSort,
  type RepairStatusFilter,
} from "@/lib/repairs";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Wrench,
  Users,
  Truck,
  Receipt,
  PackageCheck,
  Smartphone,
  Wallet,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Check,
  Download,
  Printer,
  Minus,
  Menu,
  LogOut,
  CircleHelp,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Banknote,
  MoreHorizontal,
  Package,
  AlertCircle,
  Bot,
  Star,
  ShieldAlert,
  Wifi,
  WifiOff,
  Share2,
  Store,
  Ticket,
  BookOpen,
  Sparkles,
} from "lucide-react";
import type {
  Workspace,
  WorkspaceResponse,
  Product,
  Sale,
  Repair,
  AiFeature,
} from "@/lib/types";
import {
  getPricing,
  quoteSale,
  quoteSignature,
  PRICE_TIERS,
  priceTierLabel,
} from "@/lib/pricing";
import type { PriceSettings, PriceTier, CartPricingItem } from "@/lib/types";
import { findProductByScannedSku } from "@/lib/product-scan";
import {
  percentageChange,
  previousPeriod,
  productPerformance,
  reportTotals,
} from "@/lib/reports";
import { inventoryPlan } from "@/lib/inventory-planning";
import {
  formatReceiptEscPos,
  printEscPosDirect,
  isDirectPrintSupported,
  requestAndSaveSerialPrinter,
} from "@/lib/escpos";
import { getWhatsAppReceiptUrl } from "@/lib/receipt-share";
import { customerOpenInvoices, saleBalance } from "@/lib/customers";
import { cacheCatalogOffline, syncOfflineQueue } from "@/lib/offline-db";
import { runStoreSentinel } from "@/lib/sentinel";
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Point of sale", icon: ShoppingBag },
  { name: "Invoices & returns", icon: Receipt },
  { name: "Inventory", icon: Boxes },
  { name: "Repairs", icon: Wrench },
  { name: "Customers", icon: Users },
  { name: "Purchases", icon: PackageCheck },
  { name: "Suppliers", icon: Truck },
  { name: "Agents & commissions", icon: Users },
  { name: "Alerts", icon: Bell },
  { name: "Attendance & leave", icon: Users },
  { name: "Expenses", icon: Receipt },
  { name: "COD & delivery", icon: Truck },
  { name: "Reloads", icon: Smartphone },
  { name: "Team & payroll", icon: Wallet },
  { name: "Reports", icon: BarChart3 },
  { name: "AI Assistant", icon: Bot },
  { name: "Settings", icon: Settings },
];
// Five spaces replace the flat module list. The rail picks a space; the
// tabs at the top of the page pick a section inside it.
const spaces = [
  { name: "Counter", icon: Store, pages: ["Overview", "Point of sale"] },
  {
    name: "Tickets",
    icon: Ticket,
    pages: [
      "Repairs",
      "COD & delivery",
      "Invoices & returns",
      "Reloads",
      "Alerts",
    ],
  },
  {
    name: "Stock",
    icon: Boxes,
    pages: ["Inventory", "Purchases", "Suppliers"],
  },
  {
    name: "People",
    icon: Users,
    pages: [
      "Customers",
      "Attendance & leave",
      "Team & payroll",
      "Agents & commissions",
    ],
  },
  { name: "Books", icon: BookOpen, pages: ["Expenses", "Reports"] },
];
const spaceOf = (page: string) => spaces.find((s) => s.pages.includes(page));
const pageLabels: Record<string, string> = {
  Overview: "Today",
  "Point of sale": "Sell",
  Alerts: "Bus parcels",
  "AI Assistant": "Ask Fido",
};
const pageLabel = (page: string) => pageLabels[page] || page;
const shops = [
  { value: "Phones", key: "phones", label: "Phones" },
  { value: "Clothing", key: "clothing", label: "Clothing" },
  { value: "Gifts", key: "gifts", label: "Gifts" },
  { value: "All departments", key: "all", label: "All shops" },
] as const;
const shopOf = (department: string) =>
  shops.find((s) => s.value === department) || shops[3];
const SHOP_STORAGE_KEY = "fido-shop";
// Pop-up wording: a plain title, one line on what happens, a named button.
const modalTitles: Record<string, string> = {
  "Customer details": "Customer",
  "Product batches": "Lots",
  "New repair": "Book a repair in",
  "New product": "Add a product",
  "New shipment": "Send a COD parcel",
  "New arrival alert": "New bus parcel",
  "Collect customer payment": "Take a payment",
  "Collect payment": "Take a payment",
  "Record reload": "Record a reload or top-up",
};
const modalHelp: Record<string, string> = {
  "New repair":
    "The customer gets an SMS with the job number once SMS is set up. Print the label for the device.",
  "New product": "Stock and lots come in through Receive stock, not here.",
  "Add customer": "Customers are shared by all three shops.",
  "New shipment": "Track the parcel and the cash coming back from the courier.",
  "Add expense": "Recorded against the shop you choose.",
  "Collect customer payment": "Pays off their oldest open bills first.",
  "Add supplier": "Add a supplier you buy stock from.",
  "Create purchase order": "Order now, receive in one or more deliveries.",
  "Record reload":
    "Top-ups fill a provider wallet. Customer reloads are sold from the POS.",
  Checkout: "",
};
const modalSubmit: Record<string, string> = {
  "New repair": "Book it in",
  "New product": "Add product",
  "Add customer": "Add customer",
  "New shipment": "Create shipment",
  "Add expense": "Add expense",
  "Add supplier": "Add supplier",
  "Add agent": "Add agent",
  "Add cheque": "Add cheque",
  "Collect customer payment": "Take payment",
  "Collect payment": "Take payment",
  "Collect COD batch": "Record settlement",
  "Supplier payment": "Pay supplier",
  "Record reload": "Record",
  "New arrival alert": "Start tracking",
  "Create purchase order": "Create order",
  "Receive purchase order": "Receive into stock",
  "Return invoice": "Return invoice",
  "Return items": "Return items",
  "Warranty claim": "Open claim",
  "Supplier return": "Create return",
  "Settle supplier return": "Settle",
  "Pay commission": "Pay",
  "Run payroll": "Run payroll",
  "Staff advance": "Record advance",
  "Revise estimate": "Update estimate",
  "Shipment status": "Update status",
  "Cheque status": "Update status",
  "Provider rule": "Save rule",
  "Edit staff": "Save",
  "Edit user": "Save",
  "Configure SMS": "Save",
};
type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  permissions: string[];
};
const modulePermission: Record<string, string> = {
  Overview: "dashboard.view",
  "Point of sale": "sales.view",
  "Invoices & returns": "sales.view",
  Inventory: "inventory.view",
  Repairs: "repairs.view",
  Customers: "customers.view",
  Purchases: "purchasing.view",
  Suppliers: "purchasing.view",
  Expenses: "expenses.view",
  "COD & delivery": "cod.view",
  Reloads: "reloads.view",
  "Team & payroll": "payroll.view",
  "Agents & commissions": "payroll.view",
  Alerts: "alerts.view",
  "Attendance & leave": "dashboard.view",
  Reports: "reports.view",
  "AI Assistant": "dashboard.view",
  Settings: "settings.manage",
};
const aiFeaturePermissions: Record<AiFeature, string> = {
  dailyBrief: "dashboard.view",
  repairAssistant: "repairs.manage",
  customerMessages: "customers.view",
  invoiceExtraction: "purchasing.manage",
  inventoryInsights: "inventory.view",
  askFido: "reports.view",
  anomalyReview: "reports.view",
  marketingCopy: "inventory.view",
};
const actionPermission: Record<string, string> = {
  createPurchaseOrder: "purchasing.manage",
  receivePurchaseOrder: "purchasing.manage",
  createSale: "sales.manage",
  parkCart: "sales.manage",
  deleteParkedCart: "sales.manage",
  createSaleQuote: "sales.manage",
  cancelSaleQuote: "sales.manage",
  returnSale: "sales.manage",
  returnItems: "sales.manage",
  receiveStock: "purchasing.manage",
  receiveGoods: "purchasing.manage",
  updateProductPricing: "inventory.manage",
  updateBatchPricing: "purchasing.manage",
  newProduct: "inventory.manage",
  setProductActive: "inventory.manage",
  createInventoryCount: "inventory.count",
  approveInventoryCount: "inventory.approve",
  writeOffStock: "inventory.manage",
  createRepair: "repairs.manage",
  repairStatus: "repairs.manage",
  repairPayment: "repairs.manage",
  updateRepairEstimate: "repairs.manage",
  createWarrantyClaim: "repairs.manage",
  setRepairPortalToken: "repairs.manage",
  revokeRepairPortalToken: "repairs.manage",
  clearRepairCredential: "repairs.credentials",
  createCustomer: "customers.manage",
  collectPayment: "sales.manage",
  collectCustomerPayment: "sales.manage",
  addExpense: "expenses.manage",
  addCheque: "purchasing.manage",
  chequeStatus: "purchasing.manage",
  addShipment: "cod.manage",
  shipmentStatus: "cod.manage",
  collectCodBatch: "cod.manage",
  addReload: "reloads.manage",
  staffAdvance: "payroll.manage",
  payroll: "payroll.manage",
  editStaff: "payroll.manage",
  addSupplier: "purchasing.manage",
  supplierPayment: "purchasing.manage",
  addSupplierReturn: "purchasing.manage",
  settleSupplierReturn: "purchasing.manage",
  addAgent: "payroll.manage",
  payCommission: "payroll.manage",
  createUser: "users.manage",
  updateUser: "users.manage",
  updateSettings: "settings.manage",
  configureSms: "settings.manage",
  configureAi: "settings.manage",
  queueSms: "customers.manage",
  retrySms: "settings.manage",
  setProviderRule: "settings.manage",
  createAlert: "alerts.manage",
  acknowledgeAlert: "alerts.view",
  collectAlert: "alerts.view",
  escalateAlert: "alerts.manage",
};
const modalAction: Record<string, string> = {
  "Create purchase order": "createPurchaseOrder",
  "Receive purchase order": "receivePurchaseOrder",
  "Edit product prices": "updateProductPricing",
  "Edit batch prices": "updateBatchPricing",
  "New product": "newProduct",
  "Receive stock": "receiveStock",
  "New repair": "createRepair",
  "Add customer": "createCustomer",
  "Add expense": "addExpense",
  "Add cheque": "addCheque",
  "New shipment": "addShipment",
  "Record reload": "addReload",
  "Staff advance": "staffAdvance",
  Checkout: "createSale",
  "Cheque status": "chequeStatus",
  "Shipment status": "shipmentStatus",
  "Return invoice": "returnSale",
  "Return items": "returnItems",
  "Edit staff": "editStaff",
  "Run payroll": "payroll",
  "Collect payment": "collectPayment",
  "Collect customer payment": "collectCustomerPayment",
  "Add supplier": "addSupplier",
  "Supplier payment": "supplierPayment",
  "Supplier return": "addSupplierReturn",
  "Settle supplier return": "settleSupplierReturn",
  "Add agent": "addAgent",
  "Pay commission": "payCommission",
  "Create user": "createUser",
  "Edit user": "updateUser",
  "New arrival alert": "createAlert",
  "Collect COD batch": "collectCodBatch",
  "Provider rule": "setProviderRule",
  "Configure SMS": "configureSms",
  "Revise estimate": "updateRepairEstimate",
  "Warranty claim": "createWarrantyClaim",
};
const money = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n / 100 || 0);
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Colombo",
  });
const cents = (v: FormDataEntryValue | null) =>
  Math.round(Number(v || 0) * 100);
const businessDay = (value: string | Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const today = () => businessDay();
const futureDay = (days: number) =>
  businessDay(new Date(Date.now() + days * 86400000));
function Badge({ children }: { children: ReactNode }) {
  const s = String(children);
  return (
    <span
      className={`badge ${/Paid|Collected|Approved|Cleared|Received|Ready/.test(s) ? "good" : /Credit|Partial|Awaiting|Issued|Packed|Pending/.test(s) ? "warn" : /Declined|Dishonoured|Returned|Failed/.test(s) ? "bad" : ""}`}
    >
      {children}
    </span>
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  children,
  min,
  minLength,
  maxLength,
  step,
  placeholder,
  autoCapitalize,
  style,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: ReactNode;
  min?: number;
  minLength?: number;
  maxLength?: number;
  step?: string;
  placeholder?: string;
  autoCapitalize?: string;
  style?: CSSProperties;
}) {
  const lowerName = name.toLowerCase();
  const isCode =
    lowerName.includes("sku") ||
    lowerName.includes("imei") ||
    lowerName === "lot" ||
    lowerName.includes("serial");
  const isPhone = lowerName.includes("phone");
  const resolvedType = isPhone && type === "text" ? "tel" : type;
  const resolvedPlaceholder =
    placeholder ??
    (isPhone ? "07X XXX XXXX" : isCode ? "SCAN / ENTER CODE" : undefined);

  return (
    <label className="field">
      <span>{label}</span>
      {children ? (
        <select name={name} defaultValue={value} required={required}>
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={resolvedType}
          defaultValue={value}
          required={required}
          min={min}
          minLength={minLength}
          maxLength={maxLength}
          step={step}
          placeholder={resolvedPlaceholder}
          autoCapitalize={autoCapitalize ?? (isCode ? "characters" : undefined)}
          autoComplete={isPhone ? "tel" : undefined}
          style={{
            textTransform: isCode ? "uppercase" : undefined,
            fontFamily: isCode
              ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              : undefined,
            letterSpacing: isCode ? "0.04em" : undefined,
            ...style,
          }}
        />
      )}
    </label>
  );
}
function Table({
  heads,
  rows,
  empty = "No records yet. Add your first record to get started.",
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={heads.length}>
                <div className="empty">
                  <Package size={28} />
                  <p>{empty}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function Home() {
  const dialogRef = useRef<HTMLElement | null>(null),
    dialogOpenerRef = useRef<HTMLElement | null>(null);
  const workspaceSearchRef = useRef<HTMLInputElement | null>(null);
  const posSearchRef = useRef<HTMLInputElement | null>(null);
  const [searchIndex, setSearchIndex] = useState(0);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector("[aria-modal=true]")
      ) {
        event.preventDefault();
        workspaceSearchRef.current?.focus();
      }
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const [data, setData] = useState<Workspace | null>(null),
    [mode, setMode] = useState("demo"),
    [page, setPage] = useState("Overview"),
    [department, setDepartment] = useState("All departments"),
    [query, setQuery] = useState(""),
    [globalSearch, setGlobalSearch] = useState(""),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<any>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [user, setUser] = useState<SessionUser | null>(null),
    [needsBootstrap, setNeedsBootstrap] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [authError, setAuthError] = useState(""),
    [mobile, setMobile] = useState(false),
    [cartVisible, setCartVisible] = useState(false),
    [cart, setCart] = useState<CartPricingItem[]>([]),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [reportTab, setReportTab] = useState("Summary"),
    [reportFrom, setReportFrom] = useState(`${today().slice(0, 8)}01`),
    [reportTo, setReportTo] = useState(today()),
    [inventoryTab, setInventoryTab] = useState("Stock"),
    [repairStatusFilter, setRepairStatusFilter] =
      useState<RepairStatusFilter>("Active"),
    [repairTechnicianFilter, setRepairTechnicianFilter] =
      useState("All technicians"),
    [repairPeriodFilter, setRepairPeriodFilter] =
      useState<RepairPeriodFilter>("All time"),
    [repairSort, setRepairSort] = useState<RepairSort>("Newest"),
    [activeRepairId, setActiveRepairId] = useState(""),
    [repairDocumentBack, setRepairDocumentBack] = useState("Repair details"),
    [labelHeight, setLabelHeight] = useState<25 | 30 | 40>(25),
    [labelDetailed, setLabelDetailed] = useState(true),
    [productLabelHeight, setProductLabelHeight] = useState<25 | 30 | 40>(30),
    [productLabelQuantity, setProductLabelQuantity] = useState(1),
    [favoriteProductIds, setFavoriteProductIds] = useState<string[]>(() => {
      if (typeof window === "undefined") return [];
      try {
        return JSON.parse(localStorage.getItem("fido-pos-favorites") || "[]");
      } catch {
        return [];
      }
    }),
    [repairParts, setRepairParts] = useState<
      { productId: string; quantity: number }[]
    >([]);
  const [saleCustomerId, setSaleCustomerId] = useState("cust-walkin");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [posCartOpen, setPosCartOpen] = useState(false);
  const [posCategory, setPosCategory] = useState("All items");
  const [checkoutDiscount, setCheckoutDiscount] = useState("");
  const [checkoutPaid, setCheckoutPaid] = useState<string | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState("Cash");
  const [checkoutStoreCredit, setCheckoutStoreCredit] = useState("");
  const [checkoutReason, setCheckoutReason] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const cartRef = useRef<HTMLElement | null>(null);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [lotPickProduct, setLotPickProduct] = useState<Product | null>(null);
  const [billTier, setBillTier] = useState<PriceTier | null>(null);
  const [payDuesOnBill, setPayDuesOnBill] = useState(false);
  const [openPriceLine, setOpenPriceLine] = useState<number | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [askQuestion, setAskQuestion] = useState("");
  const [posMode, setPosMode] = useState<"Products" | "Reload">("Products");
  const [billReloads, setBillReloads] = useState<BillReload[]>([]);
  const billTierRef = useRef(billTier);
  billTierRef.current = billTier;
  useEffect(() => {
    // A new customer brings their own tier and dues; drop the old bill's choices.
    if (billTierRef.current)
      setCart((rows) => rows.map(({ priceTier: _tier, ...row }) => row));
    setBillTier(null);
    setPayDuesOnBill(false);
  }, [saleCustomerId]);
  const lastPageBySpace = useRef<Record<string, string>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SHOP_STORAGE_KEY);
      if (saved && shops.some((s) => s.value === saved)) setDepartment(saved);
    } catch {}
  }, []);
  function chooseShop(value: string) {
    setShopMenuOpen(false);
    if (value === department) return;
    if (cart.length || billReloads.length) {
      setToast(
        "Finish or park the current sale before switching shop. A bill belongs to one shop.",
      );
      return;
    }
    setDepartment(value);
    setPosCategory("All items");
    setPosMode("Products");
    try {
      localStorage.setItem(SHOP_STORAGE_KEY, value);
    } catch {}
  }
  useEffect(() => {
    localStorage.setItem(
      "fido-pos-favorites",
      JSON.stringify(favoriteProductIds),
    );
  }, [favoriteProductIds]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === "F2" && page === "Point of sale") {
        event.preventDefault();
        posSearchRef.current?.focus();
      }
      if (
        event.key === "F8" &&
        page === "Point of sale" &&
        cart.length &&
        !document.querySelector("[aria-modal=true]")
      ) {
        event.preventDefault();
        setModal("Checkout");
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [page, cart.length]);
  useEffect(() => {
    if (page !== "Point of sale" || modal) return;
    const frame = requestAnimationFrame(() => posSearchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [page, modal]);
  useEffect(() => {
    if (page !== "Point of sale" || !cart.length || !cartRef.current) {
      setCartVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCartVisible(entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(cartRef.current);
    return () => observer.disconnect();
  }, [page, cart.length]);
  const can = (permission: string) =>
    !!user &&
    (user.permissions.includes("*") || user.permissions.includes(permission));
  const canPage = (name: string) =>
    name === "Attendance & leave" ||
    (name === "AI Assistant" &&
      Object.values(aiFeaturePermissions).some((permission) =>
        can(permission),
      )) ||
    can(modulePermission[name]) ||
    (name === "Team & payroll" && can("users.manage"));
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace");
      if (r.status === 401) {
        setLocked(true);
        setData(null);
        setUser(null);
        return;
      }
      if (!r.ok) throw Error("Could not load the workspace. Please try again.");
      const res: WorkspaceResponse & { user: SessionUser } = await r.json();
      if (res.user) setUser(res.user);
      setData(res.data);
      setMode(res.mode);
      setLocked(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/auth")
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to connect to authentication.");
        return r.json();
      })
      .then((a) => {
        if (!live) return;
        const authenticated = a.authenticated ?? !!a.user;
        setNeedsBootstrap(!!(a.needsBootstrap ?? a.bootstrapRequired));
        setLocked(!authenticated);
        setUser(a.user || null);
        setAuthReady(true);
        if (authenticated) load();
      })
      .catch((e) => {
        setError(e.message);
        setAuthReady(true);
      });
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    if (!user || locked) return;
    const timer = setInterval(load, 10000);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, locked, load]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const handleOnline = async () => {
      setIsOnline(true);
      const res = await syncOfflineQueue(async (act) => {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(act),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Sync failed");
        }
        return response.json();
      });
      if (res.syncedCount > 0) {
        setToast(`${res.syncedCount} offline sale(s) synced to server!`);
        load();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [load]);

  useEffect(() => {
    if (data?.products && data?.customers) {
      cacheCatalogOffline(data.products, data.customers);
    }
  }, [data]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setReceipt(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    if (!modal && !receipt) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown", trap);
      dialogOpenerRef.current?.focus();
    };
  }, [modal, receipt]);
  async function action(type: string, payload: Record<string, unknown>) {
    if (actionPermission[type] && !can(actionPermission[type])) {
      setToast("Your account cannot perform this action.");
      return null;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, payload, requestId: crypto.randomUUID() }),
      });
      const res = await r.json();
      if (r.status === 401) {
        setLocked(true);
        setUser(null);
        setData(null);
        setModal(null);
        setReceipt(null);
      }
      if (!r.ok)
        throw Error(
          typeof res.error === "string"
            ? res.error
            : "Could not save this change.",
        );
      setData(res.data);
      setMode(res.mode);
      setModal(null);
      setToast("Saved successfully");
      return res.data as Workspace;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function go(p: string) {
    setPage(p);
    const space = spaceOf(p);
    if (space) lastPageBySpace.current[space.name] = p;
    setShopMenuOpen(false);
    setQuery("");
    setGlobalSearch("");
    setMobile(false);
    setPosCartOpen(false);
  }
  function open(name: string, item: any = null) {
    const permission = actionPermission[modalAction[name]];
    if (permission && !can(permission)) {
      setToast("Your account cannot perform this action.");
      return;
    }
    dialogOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (name === "Receive stock") {
      setReceiving(true);
      return;
    }
    setSelected(item);
    setModal(name);
    if (name === "Checkout") {
      setCheckoutDiscount("");
      setCheckoutPaid(null);
      setCheckoutMethod("Cash");
      setCheckoutStoreCredit("");
      setCheckoutReason("");
    }
    if (name === "New repair") setRepairParts([]);
    if (name === "Product label") setProductLabelQuantity(1);
  }
  function openRepairDocument(
    name: "Intake receipt" | "Device label",
    repair: Repair,
    back = "Repair details",
  ) {
    setRepairDocumentBack(back);
    open(name, repair);
  }
  function shareRepairOnWhatsApp(repair: Repair) {
    const phone = normalizeSriLankanPhone(repair.phone);
    if (!phone) {
      setToast("Add a valid Sri Lankan mobile number before sharing.");
      return;
    }
    const message = [
      `${data?.settings.businessName || "Fido LK"} repair intake`,
      `Job: ${repair.number}`,
      `Device: ${repair.device}`,
      `Reported fault: ${repair.issue}`,
      `Estimate: ${repair.estimate ? money(repair.estimate) : "Pending inspection"}`,
      "We will confirm the estimate before repair work begins.",
    ].join("\n");
    const popup = window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (!popup)
      setToast("WhatsApp could not open. Allow popups and try again.");
    else
      setToast(
        "WhatsApp opened with a draft. The message is not sent until you confirm it.",
      );
  }
  function printRepairDocument(kind: "receipt" | "label") {
    const className = `printing-repair-${kind}`;
    const printStyle = document.createElement("style");
    printStyle.dataset.repairPrintPage = kind;
    printStyle.textContent = `@media print { @page { size: ${
      kind === "label" ? `38mm ${labelHeight}mm` : "80mm auto"
    }; margin: ${kind === "label" ? "0" : "4mm"}; } }`;
    document.head.appendChild(printStyle);
    document.body.classList.add(className);
    const cleanUp = () => {
      document.body.classList.remove(className);
      printStyle.remove();
      window.removeEventListener("afterprint", cleanUp);
    };
    window.addEventListener("afterprint", cleanUp);
    window.print();
    window.setTimeout(cleanUp, 60000);
  }
  function printProductLabels() {
    const printStyle = document.createElement("style");
    printStyle.dataset.productLabelPrintPage = "true";
    printStyle.textContent = `@media print { @page { size: 38mm ${productLabelHeight}mm; margin: 0; } }`;
    document.head.appendChild(printStyle);
    document.body.classList.add("printing-product-labels");
    const cleanUp = () => {
      document.body.classList.remove("printing-product-labels");
      printStyle.remove();
      window.removeEventListener("afterprint", cleanUp);
    };
    window.addEventListener("afterprint", cleanUp);
    window.print();
    window.setTimeout(cleanUp, 60000);
  }
  function exportData() {
    if (!data || !authReady) return;
    const source =
      page === "Suppliers"
        ? data.suppliers || []
        : page === "Agents & commissions"
          ? data.agents || []
          : page === "Alerts"
            ? data.alerts || []
            : page === "Inventory"
              ? data.products
              : page === "Customers"
                ? data.customers
                : page === "Expenses"
                  ? data.expenses
                  : page === "Purchases"
                    ? data.purchases
                    : page === "Repairs"
                      ? data.repairs
                      : page === "COD & delivery"
                        ? data.shipments
                        : page === "Reloads"
                          ? data.reloads
                          : page === "Team & payroll"
                            ? data.staff
                            : data.sales;
    const rows = (source as unknown as Record<string, unknown>[])
      .filter((r) =>
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
      )
      .filter(
        (r) =>
          department === "All departments" ||
          !("department" in r) ||
          r.department === department ||
          r.department === "Mixed",
      );
    if (!rows.length) {
      setToast("There are no records to export.");
      return;
    }
    const keys = Object.keys(rows[0]).filter(
      (k) =>
        typeof rows[0][k] !== "object" &&
        !/credential|secret|password|hash|apiKey/i.test(k),
    );
    const cell = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@\-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv = [
      keys.map(cell).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fido-${page.toLowerCase().replaceAll(" ", "-")}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportReport() {
    const cell = (value: unknown) => {
      const raw = String(value ?? "");
      const safe = /^[=+@\-]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Product",
        "SKU",
        "Units",
        "Net revenue (cents)",
        "Cost (cents)",
        "Margin (cents)",
      ],
      ...reportProducts.map((row) => [
        row.name,
        data?.products.find((item) => item.id === row.productId)?.sku || "",
        row.units,
        row.revenue,
        row.cost,
        row.margin,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fido-report-${reportFrom}-${reportTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function printReport() {
    document.body.classList.add("printing-report");
    const cleanup = () => {
      document.body.classList.remove("printing-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 60000);
  }
  async function createRepairPortalLink(repair: Repair) {
    setBusy(true);
    try {
      const response = await fetch("/api/repair-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "issue", repairId: repair.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to create the customer link.");
      await navigator.clipboard.writeText(result.url);
      setToast("Secure repair link copied. It expires in 14 days.");
    } catch (issue) {
      setToast(
        issue instanceof Error
          ? issue.message
          : "Unable to create the customer link.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    let burstCount = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const timeSinceLast = now - lastKeyTime;
      const isEnter = e.key === "Enter";
      const isSingleChar = e.key.length === 1;

      // Scanners type with typical key intervals < 50ms.
      // If idle for more than 65ms, clear scanner buffer
      if (timeSinceLast > 65) {
        buffer = "";
        burstCount = 0;
      }

      if (isSingleChar) {
        buffer += e.key;
        lastKeyTime = now;
        burstCount++;
      } else if (isEnter && buffer.length >= 2) {
        const activeEl = document.activeElement;
        const isInput =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement;
        const isPosSearch = activeEl === posSearchRef.current;

        // Hardware scanner: rapid characters ending in Enter
        const isHardwareScan = burstCount >= 3 && timeSinceLast < 65;
        // Non-input focus on POS page without modal
        const isFreePosScan =
          !isInput &&
          page === "Point of sale" &&
          !modal &&
          !receipt &&
          !document.querySelector("[aria-modal=true]");

        if (isHardwareScan || isFreePosScan) {
          const handled = handleScannedCode(buffer);
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
            if (isPosSearch) setQuery("");
          } else if (isFreePosScan) {
            setToast(`No product or IMEI found for: "${buffer.trim()}"`);
          }
        }
        buffer = "";
        burstCount = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [page, modal, receipt, data?.products, data?.batches, cart, can]);

  if (locked && authReady)
    return (
      <main className="login">
        <div className="login-box">
          <div className="logo dark">
            fido<span>LK</span>
          </div>
          <div className="eyebrow">
            {needsBootstrap ? "SET UP YOUR WORKSPACE" : "WELCOME BACK"}
          </div>
          <h1>
            {needsBootstrap
              ? "A fresh start for Fido."
              : "Your business, connected."}
          </h1>
          <p>
            {needsBootstrap
              ? "Create the owner account. This account can manage staff, access and every department."
              : "Sign in to manage your shop, repairs and daily numbers."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setAuthError("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    operation: needsBootstrap ? "bootstrap" : "login",
                    username: f.get("username"),
                    password: f.get("password"),
                    ...(needsBootstrap
                      ? { setupKey: f.get("setupKey"), name: f.get("name") }
                      : {}),
                  }),
                });
                const a = await r.json();
                if (!r.ok) throw Error(a.error || "Sign-in failed.");
                setUser(a.user || null);
                setLocked(false);
                setNeedsBootstrap(false);
                await load();
              } catch (e) {
                setAuthError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {needsBootstrap && (
              <>
                <Field
                  label="Deployment setup key"
                  name="setupKey"
                  type="password"
                  required
                />
                <Field label="Owner's name" name="name" required />
              </>
            )}
            <Field label="Username" name="username" required />
            <Field label="Password" name="password" type="password" required />
            {needsBootstrap && (
              <p className="footnote">
                Use at least 12 characters. Keep the setup key private.
              </p>
            )}
            {authError && (
              <div className="notice auth-error" role="alert">
                {authError}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Signing in…"
                : needsBootstrap
                  ? "Create owner account"
                  : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="loading">
        <div className="logo dark">
          fido<span>LK</span>
        </div>
        {error ? (
          <>
            <p>{error}</p>
            <button className="primary" onClick={load}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p>Preparing your workspace…</p>
          </>
        )}
      </main>
    );
  const products = data.products.filter(
    (p) =>
      (department === "All departments" || p.department === department) &&
      `${p.name} ${p.sku} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const recentProductIds = [...data.sales]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .flatMap((sale) => sale.lines.map((line) => line.productId));
  const saleProducts = products
    .filter((product) => product.active !== false)
    .sort((a, b) => {
      const favorite =
        Number(favoriteProductIds.includes(b.id)) -
        Number(favoriteProductIds.includes(a.id));
      if (favorite) return favorite;
      const aRecent = recentProductIds.indexOf(a.id);
      const bRecent = recentProductIds.indexOf(b.id);
      return (
        (aRecent < 0 ? Number.MAX_SAFE_INTEGER : aRecent) -
        (bRecent < 0 ? Number.MAX_SAFE_INTEGER : bRecent)
      );
    });
  const posCategories = [
    "All items",
    ...Array.from(new Set(saleProducts.map((p) => p.category))).filter(Boolean),
  ];
  const visibleSaleProducts = saleProducts.filter(
    (p) => posCategory === "All items" || p.category === posCategory,
  );
  const sales = data.sales.filter(
    (s) =>
      department === "All departments" ||
      s.department === department ||
      s.department === "Mixed",
  );
  const invoiceMatches = [...data.sales]
    .filter((sale) => {
      const term = invoiceQuery.trim().toLowerCase();
      if (!term) return true;
      const customer = data.customers.find((c) => c.id === sale.customerId);
      return [
        sale.number,
        sale.customerName,
        customer?.phone || "",
        ...sale.lines.flatMap((line) => [line.name, line.imei || ""]),
      ].some((value) => value.toLowerCase().includes(term));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeReportFilters = {
    from: reportFrom,
    to: reportTo,
    department: department as
      "All departments" | "Phones" | "Clothing" | "Gifts",
  };
  const report = reportTotals(data, activeReportFilters);
  const priorReport = reportTotals(data, previousPeriod(activeReportFilters));
  const expensesIn = (from: string, to: string) =>
    data.expenses
      .filter(
        (e) =>
          e.date >= from &&
          e.date <= to &&
          (department === "All departments" ||
            e.department === department ||
            e.department === "General"),
      )
      .reduce((sum, e) => sum + e.amount, 0);
  const prior = previousPeriod(activeReportFilters);
  const periodExpenses = expensesIn(reportFrom, reportTo);
  const priorExpenses = expensesIn(prior.from, prior.to);
  const reportPeriods = (() => {
    const t = today();
    const shift = (d: string, days: number) =>
      new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10);
    const weekday = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monthStart = `${t.slice(0, 8)}01`;
    const lastMonthEnd = shift(monthStart, -1);
    return [
      { label: "Today", from: t, to: t },
      { label: "Yesterday", from: shift(t, -1), to: shift(t, -1) },
      { label: "This week", from: shift(t, -weekday), to: t },
      { label: "This month", from: monthStart, to: t },
      {
        label: "Last month",
        from: `${lastMonthEnd.slice(0, 8)}01`,
        to: lastMonthEnd,
      },
    ];
  })();
  const reportProducts = productPerformance(data, activeReportFilters);
  const reportSales = sales.filter(
    (sale) =>
      sale.createdAt.slice(0, 10) >= reportFrom &&
      sale.createdAt.slice(0, 10) <= reportTo,
  );
  const reportJournal = data.journal.filter(
    (entry) =>
      entry.date.slice(0, 10) >= reportFrom &&
      entry.date.slice(0, 10) <= reportTo,
  );
  const reportAudit = data.audit.filter(
    (entry) =>
      entry.at.slice(0, 10) >= reportFrom && entry.at.slice(0, 10) <= reportTo,
  );
  const plannedInventory = inventoryPlan(data, {
    lookbackDays: data.settings.inventoryLookbackDays,
    targetDays: data.settings.inventoryTargetDays,
  });
  const daySales = sales.filter(
    (s) => businessDay(s.createdAt) === today() && s.status !== "Returned",
  );
  const dayRevenue = daySales.reduce((a, s) => a + s.total, 0);
  const dayMargin = daySales.reduce((a, s) => a + s.total - s.cost, 0);
  const outstanding = data.journal
    .flatMap((j) => j.lines)
    .filter((l) => l.account === "Accounts receivable")
    .reduce((a, l) => a + l.debit - l.credit, 0);
  const codPending = data.shipments.reduce(
    (a, s) =>
      a + (s.status === "Returned" ? 0 : Math.max(0, s.amount - s.collected)),
    0,
  );
  const inventoryValue = data.batches.reduce(
    (a, b) => a + b.remaining * b.unitCost,
    0,
  );
  const finishedRepairs = data.repairs.filter((r) =>
    ["Ready for collection", "Collected"].includes(r.status),
  );
  const accountNet = (name: string) =>
    data.journal
      .flatMap((j) => j.lines)
      .filter((l) => l.account === name)
      .reduce((a, l) => a + l.credit - l.debit, 0);
  const totalMargin =
    accountNet("Sales revenue") +
    accountNet("Repair revenue") +
    accountNet("Reload commission revenue") +
    accountNet("Cost of goods sold") +
    accountNet("Repair parts expense");
  const commissions =
    -accountNet("Staff commission expense") -
    accountNet("Agent commission expense");
  const expenses =
    -accountNet("Operating expenses") -
    accountNet("Salary expense") -
    accountNet("Stock loss expense");
  const postage = -accountNet("Courier expense");
  const target = data.settings.dailyTarget;
  const progress = target
    ? Math.min(100, Math.round((dayRevenue / target) * 100))
    : 0;
  let cartQuote: ReturnType<typeof quoteSale> | null = null;
  let cartPricingError = "";
  try {
    if (cart.length)
      cartQuote = quoteSale(data, cart, {
        customerTier:
          data.customers.find((c) => c.id === saleCustomerId)?.priceTier ||
          "Retail",
        discount: modal === "Checkout" ? cents(checkoutDiscount) : 0,
        allowTier: can("sales.priceTier"),
        allowDiscount: can("sales.discount"),
        allowOverride: can("sales.priceOverride"),
        overrideReason: checkoutReason,
      });
  } catch (e) {
    cartPricingError =
      e instanceof Error ? e.message : "Check the sale prices.";
  }
  const cartTotal = cartQuote?.total || 0;
  const cartBatchContext = saleBatchContext(data, cart);
  const saleCustomer = data.customers.find((c) => c.id === saleCustomerId);
  const customerTier: PriceTier = saleCustomer?.priceTier || "Retail";
  const activeTier: PriceTier = billTier ?? customerTier;
  const saleCustomerDues =
    saleCustomerId === "cust-walkin"
      ? []
      : customerOpenInvoices(saleCustomerId, data.sales, data.shipments);
  const saleCustomerOwes = saleCustomerDues.reduce(
    (sum, sale) => sum + saleBalance(sale),
    0,
  );
  const duesOnBill = payDuesOnBill ? saleCustomerOwes : 0;
  const reloadsOnBill = billReloads.reduce((sum, r) => sum + r.amount, 0);
  const collectTotal = cartTotal + duesOnBill + reloadsOnBill;
  const isPhonesShop = department === "Phones";
  const walletBalance = (provider: string) =>
    data.reloads
      .filter((r) => r.provider.toLowerCase() === provider.toLowerCase())
      .reduce(
        (sum, r) =>
          sum +
          (r.type === "Top-up"
            ? r.amount + r.commission
            : -r.amount + r.commission),
        0,
      ) -
    billReloads
      .filter((r) => r.provider === provider)
      .reduce((sum, r) => sum + r.amount, 0);
  async function takeItemlessPayment() {
    // No items: reloads are recorded one by one, then any old balance.
    for (const reload of billReloads) {
      const saved = await action("addReload", reload);
      if (!saved) return;
      setBillReloads((rows) => rows.filter((r) => r !== reload));
    }
    if (billReloads.length)
      setToast(
        `${billReloads.length} reload${billReloads.length === 1 ? "" : "s"} recorded · ${money(reloadsOnBill)} cash.`,
      );
    if (duesOnBill) open("Collect customer payment", saleCustomer);
  }
  const unitsInCartByLot = cart.reduce<Record<string, number>>((map, item) => {
    if (item.batchId)
      map[item.batchId] = (map[item.batchId] || 0) + item.quantity;
    return map;
  }, {});
  const lotOf = (batchId?: string) =>
    batchId ? data.batches.find((b) => b.id === batchId) : undefined;
  function chooseBillTier(tier: PriceTier) {
    setBillTier(tier);
    setCart((rows) =>
      rows.map((row) => ({ ...row, priceTier: tier, unitPrice: undefined })),
    );
  }
  function addLots(product: Product, choices: LotChoice[]) {
    setCart((prev) => {
      let next = [...prev];
      for (const choice of choices) {
        const at = next.findIndex(
          (row) =>
            row.productId === product.id &&
            row.batchId === choice.batchId &&
            !row.imei,
        );
        if (at >= 0)
          next = next.map((row, i) =>
            i === at
              ? { ...row, quantity: row.quantity + choice.quantity }
              : row,
          );
        else
          next.push({
            productId: product.id,
            quantity: choice.quantity,
            batchId: choice.batchId,
            ...(billTier ? { priceTier: billTier } : {}),
          });
      }
      return next;
    });
    const units = choices.reduce((sum, c) => sum + c.quantity, 0);
    setToast(`${units} × ${product.name} added to the sale.`);
    setLotPickProduct(null);
    requestAnimationFrame(() => posSearchRef.current?.focus());
  }
  const updateCartPricing = (index: number, patch: Partial<CartPricingItem>) =>
    setCart((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const filtered = <T,>(rows: T[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  const visibleRepairs = filterRepairs(data.repairs, {
    query,
    status: repairStatusFilter,
    technicianId: repairTechnicianFilter,
    period: repairPeriodFilter,
    sort: repairSort,
  });
  const activeRepair =
    visibleRepairs.find((repair) => repair.id === activeRepairId) ||
    visibleRepairs[0];
  const rowAction = (label: string, fn: () => void) => (
    <button
      className="text-button"
      disabled={
        label === "Update" &&
        !can(page === "Purchases" ? "purchasing.manage" : "cod.manage")
      }
      onClick={fn}
    >
      {label}
      <ChevronRight size={14} />
    </button>
  );
  const customerOptions = data.customers.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));
  const salesTable = (list: Sale[]) => (
    <Table
      heads={[
        "INVOICE / CUSTOMER",
        "DEPARTMENT",
        "AMOUNT",
        "PAYMENT",
        "STATUS",
        "",
      ]}
      rows={list.map((s) => [
        <div>
          <strong>{s.number}</strong>
          <small>
            {s.customerName} · {date(s.createdAt)}
          </small>
        </div>,
        <span className="department-label">{s.department}</span>,
        <strong className="tabular">{money(s.total)}</strong>,
        s.method,
        <Badge>{s.status}</Badge>,
        rowAction("View", () => setReceipt(s)),
      ])}
    />
  );
  function addCart(p: Product) {
    if (!can("sales.manage")) {
      setToast("You have view-only access to sales.");
      return;
    }
    if (p.stock <= 0 || p.active === false) {
      setToast("This product is out of stock.");
      return;
    }
    if (p.serialized) {
      open("Select IMEI", p);
      return;
    }
    const inCart = cart
      .filter((c) => c.productId === p.id)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (inCart >= p.stock) {
      setToast("All available stock is already in the cart.");
      return;
    }
    // Always ask which lot, even when there is only one.
    setLotPickProduct(p);
  }

  function handleScannedCode(scanned: string): boolean {
    const trimmed = scanned.trim();
    if (!trimmed || !data) return false;

    // 1. Direct IMEI barcode match in active inventory batches
    const matchingBatch = data.batches.find(
      (b) =>
        b.imeis.some((i) => i.toLowerCase() === trimmed.toLowerCase()) &&
        !cart.some((c) => c.imei?.toLowerCase() === trimmed.toLowerCase()),
    );
    if (matchingBatch) {
      const prod = data.products.find((p) => p.id === matchingBatch.productId);
      if (prod && prod.active !== false) {
        if (!can("sales.manage")) {
          setToast("You have view-only access to sales.");
          return true;
        }
        const actualImei =
          matchingBatch.imeis.find(
            (i) => i.toLowerCase() === trimmed.toLowerCase(),
          ) || trimmed;
        setCart((prev) => [
          ...prev,
          { productId: prod.id, quantity: 1, imei: actualImei },
        ]);
        setToast(`Added serialized ${prod.name} (IMEI: ${actualImei})`);
        if (modal === "Select IMEI") setModal(null);
        return true;
      }
    }

    // 2. Direct SKU barcode match
    const match = findProductByScannedSku(data.products, trimmed);
    if (match) {
      addCart(match);
      return true;
    }

    return false;
  }

  const searchResults = [
    ...data.products.map((p) => ({
      title: p.name,
      sub: p.sku,
      page: "Inventory",
    })),
    ...data.customers.map((c) => ({
      title: c.name,
      sub: c.phone,
      page: "Customers",
    })),
    ...data.repairs.map((r) => ({
      title: r.number,
      sub: r.device,
      page: "Repairs",
    })),
  ]
    .filter(
      (r) =>
        canPage(r.page) &&
        `${r.title} ${r.sub}`
          .toLowerCase()
          .includes(globalSearch.trim().toLowerCase()),
    )
    .slice(0, 7);
  const urgentAlerts = canPage("Alerts")
    ? data.alerts.filter(
        (a) =>
          ["Due", "Escalated"].includes(a.status) ||
          (a.status === "Scheduled" &&
            Date.now() >= Date.parse(a.dueAt) - a.minutesBefore * 60_000),
      )
    : [];
  const upcomingArrival = canPage("Alerts")
    ? [...data.alerts]
        .filter(
          (a) =>
            a.type === "Bus arrival" &&
            a.status === "Scheduled" &&
            Date.now() < Date.parse(a.dueAt) - a.minutesBefore * 60_000,
        )
        .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0]
    : undefined;
  const readyRepairs = canPage("Repairs")
    ? data.repairs.filter((r) => r.status === "Ready for collection")
    : [];
  const unsettledCod = canPage("COD & delivery")
    ? data.shipments.filter(
        (s) => s.status === "Delivered" && s.collected < s.amount,
      )
    : [];
  const moduleActions: Record<string, [string, string]> = {
    "Point of sale": ["New product", "New product"],
    Inventory: ["Receive stock", "Receive stock"],
    Repairs: ["New repair", "New repair"],
    Customers: ["Add customer", "Add customer"],
    Purchases: ["Receive stock", "Receive stock"],
    Expenses: ["Add expense", "Add expense"],
    "COD & delivery": ["New shipment", "New shipment"],
    Reloads: ["Record transaction", "Record reload"],
    Suppliers: ["Add supplier", "Add supplier"],
    "Agents & commissions": ["Add agent", "Add agent"],
  };
  const homeVerbs: Verb[] = [
    ...(can("sales.manage")
      ? [
          {
            key: "sell",
            label: "Sell",
            hint: "Scan and charge",
            icon: <ShoppingBag size={22} />,
            primary: true,
            onClick: () => go("Point of sale"),
          },
        ]
      : []),
    ...(can("repairs.manage")
      ? [
          {
            key: "repair",
            label: "Repair",
            hint: "Book a device in",
            icon: <Wrench size={22} />,
            onClick: () => open("New repair"),
          },
        ]
      : []),
    ...(can("purchasing.manage")
      ? [
          {
            key: "receive",
            label: "Receive",
            hint: "Stock from a supplier",
            icon: <PackageCheck size={22} />,
            onClick: () => open("Receive stock"),
          },
        ]
      : []),
    ...(can("cod.manage")
      ? [
          {
            key: "dispatch",
            label: "Dispatch",
            hint: "Send a COD parcel",
            icon: <Truck size={22} />,
            onClick: () => open("New shipment"),
          },
        ]
      : []),
    ...(canPage("Alerts")
      ? [
          {
            key: "bus",
            label: "Bus parcels",
            hint: "Track what's coming",
            icon: <Bell size={22} />,
            onClick: () => go("Alerts"),
          },
        ]
      : []),
  ];
  const openRepair = (id: string) => {
    setActiveRepairId(id);
    go("Repairs");
  };
  const todayKey = today();
  const homeNow: NowTicket[] = [
    ...(canPage("Repairs")
      ? data.repairs
          .filter((r) =>
            ["Ready for collection", "Awaiting approval"].includes(r.status),
          )
          .map((r) =>
            r.status === "Ready for collection"
              ? {
                  id: `repair-${r.id}`,
                  kind: "REPAIR",
                  reference: r.number,
                  title: `${r.device} — ready`,
                  detail: `${r.customerName} · ${r.phone}`,
                  status: "Ready",
                  tone: "ready" as const,
                  group: "handover" as const,
                  amount:
                    r.estimate > r.paid
                      ? money(r.estimate - r.paid)
                      : undefined,
                  action: "Hand over",
                  primary: true,
                  onAction: () => openRepair(r.id),
                }
              : {
                  id: `repair-${r.id}`,
                  kind: "REPAIR",
                  reference: r.number,
                  title: `${r.device} — quote waiting`,
                  detail: `${r.customerName} hasn't approved ${money(r.estimate)} yet`,
                  status: "Needs you",
                  tone: "needs" as const,
                  group: "needs" as const,
                  action: "Get approval",
                  onAction: () => openRepair(r.id),
                },
          )
      : []),
    ...(canPage("Alerts")
      ? data.alerts
          .filter(
            (a) =>
              a.type === "Bus arrival" &&
              !["Collected", "Cancelled"].includes(a.status),
          )
          .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
          .map((a) => {
            const minutes = Math.ceil(
              (Date.parse(a.dueAt) - Date.now()) / 60000,
            );
            return {
              id: `bus-${a.id}`,
              kind: "BUS",
              reference: a.busRegistration || "Parcel",
              title: a.title,
              detail: `${a.arrivalLocation || a.busRoute || "Our stop"} · ${a.assigneeName || "anyone"} to collect`,
              status:
                minutes < 0
                  ? `${Math.abs(minutes)} min late`
                  : minutes <= a.minutesBefore
                    ? `${minutes} min`
                    : `at ${new Date(a.dueAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}`,
              tone:
                minutes < 0
                  ? ("overdue" as const)
                  : minutes <= a.minutesBefore
                    ? ("needs" as const)
                    : ("neutral" as const),
              group: minutes < 0 ? ("overdue" as const) : ("moving" as const),
              amount:
                a.amountDue && a.paymentState !== "Paid"
                  ? money(a.amountDue)
                  : undefined,
              action: "Open",
              onAction: () => go("Alerts"),
            };
          })
      : []),
    ...(canPage("COD & delivery")
      ? unsettledCod.map((sh) => ({
          id: `cod-${sh.id}`,
          kind: "COD",
          reference: sh.orderRef || sh.id.slice(0, 6),
          title: `${sh.customerName} — delivered, cash not settled`,
          detail: `${sh.courier || "Courier"} · ${sh.tracking || "no tracking"}`,
          status: "Overdue",
          tone: "overdue" as const,
          group: "overdue" as const,
          amount: money(sh.amount - sh.collected),
          action: "Settle",
          onAction: () => go("COD & delivery"),
        }))
      : []),
    ...(canPage("Customers")
      ? sales
          .filter(
            (sale) =>
              sale.dueDate &&
              sale.dueDate < todayKey &&
              saleBalance(sale) > 0 &&
              sale.status !== "Returned",
          )
          .map((sale) => ({
            id: `inv-${sale.id}`,
            kind: "INVOICE",
            reference: sale.number,
            title: `${sale.customerName} — balance overdue`,
            detail: `Due ${date(sale.dueDate!)} · paid ${money(sale.paid)} of ${money(sale.total)}`,
            status: "Overdue",
            tone: "overdue" as const,
            group: "overdue" as const,
            amount: money(saleBalance(sale)),
            action: "Collect",
            onAction: () => {
              const customer = data.customers.find(
                (c) => c.id === sale.customerId,
              );
              if (customer) open("Collect customer payment", customer);
              else go("Customers");
            },
          }))
      : []),
  ];
  const lowStock = canPage("Inventory")
    ? products.filter((p) => p.active !== false && p.stock <= p.reorderLevel)
    : [];
  if (lowStock.length)
    homeNow.push({
      id: "low-stock",
      kind: "STOCK",
      reference: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"}`,
      title: "Running low on stock",
      detail: lowStock
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stock})`)
        .join(", "),
      status: "Reorder",
      tone: "needs",
      group: "needs",
      action: "Plan order",
      onAction: () => {
        go("Inventory");
        setInventoryTab("Planner");
      },
    });
  const currentShop = shopOf(department);
  const currentSpace = spaceOf(page);
  const visibleSpaces = spaces
    .map((space) => ({ ...space, pages: space.pages.filter(canPage) }))
    .filter((space) => space.pages.length);
  const spaceTabs =
    visibleSpaces.find((space) => space.name === currentSpace?.name)?.pages ||
    [];
  const openSpace = (name: string) => {
    const space = visibleSpaces.find((s) => s.name === name);
    if (!space) return;
    const remembered = lastPageBySpace.current[name];
    go(
      remembered && space.pages.includes(remembered)
        ? remembered
        : space.pages[0],
    );
  };
  const initials =
    user?.name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("") || "FL";
  const signOut = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "logout" }),
    });
    setData(null);
    setUser(null);
    setLocked(true);
    setCart([]);
    setModal(null);
    setReceipt(null);
  };
  const tabCount = (name: string) =>
    name === "Repairs"
      ? data.repairs.filter(
          (r) => !["Collected", "Declined"].includes(r.status),
        ).length
      : name === "Alerts"
        ? urgentAlerts.length
        : 0;
  return (
    <div
      className="app-shell"
      data-page={page.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}
      data-shop={currentShop.key}
    >
      <aside id="workspace-navigation" className="rail">
        <a
          className="rail-logo"
          href="#"
          aria-label={`${data.settings.businessName || "Fido LK"} — Counter`}
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          fido
          <i />
        </a>
        <button
          className="shop-current"
          aria-haspopup="menu"
          aria-expanded={shopMenuOpen}
          aria-label={`Shop: ${currentShop.label}. Change shop`}
          onClick={() => setShopMenuOpen((open) => !open)}
        >
          <span className="shop-bar" />
          <span>
            {currentShop.label}
            <ChevronDown size={12} />
          </span>
        </button>
        <nav className="rail-spaces" aria-label="Main navigation">
          {visibleSpaces.map((space) => (
            <button
              key={space.name}
              className={currentSpace?.name === space.name ? "active" : ""}
              aria-current={
                currentSpace?.name === space.name ? "page" : undefined
              }
              onClick={() => openSpace(space.name)}
            >
              <space.icon size={22} strokeWidth={1.8} />
              <span>{space.name}</span>
              {space.name === "Tickets" && urgentAlerts.length > 0 && (
                <em aria-label={`${urgentAlerts.length} urgent`}>
                  {urgentAlerts.length}
                </em>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          {canPage("AI Assistant") && (
            <button
              className={`rail-icon ${page === "AI Assistant" ? "active" : ""}`}
              aria-label="Ask Fido"
              title="Ask Fido"
              onClick={() => go("AI Assistant")}
            >
              <Sparkles size={20} />
            </button>
          )}
          {canPage("Settings") && (
            <button
              className={`rail-icon ${page === "Settings" ? "active" : ""}`}
              aria-label="Settings"
              title="Settings"
              onClick={() => go("Settings")}
            >
              <Settings size={20} />
            </button>
          )}
          <button
            className="rail-avatar"
            aria-label={`${user?.name || "Team member"} — account and security`}
            title={user?.name || "Account"}
            onClick={() => open("Account security")}
          >
            {initials}
          </button>
          <button
            className="rail-icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {shopMenuOpen && (
        <>
          <button
            className="shop-menu-backdrop"
            aria-label="Close shop menu"
            onClick={() => setShopMenuOpen(false)}
          />
          <div className="shop-menu" role="menu" aria-label="Choose shop">
            <div className="shop-menu-title">WHICH SHOP?</div>
            {shops.map((shop) => (
              <button
                key={shop.key}
                role="menuitemradio"
                aria-checked={department === shop.value}
                onClick={() => chooseShop(shop.value)}
              >
                <span
                  className="shop-swatch"
                  style={{ background: `var(--shop-${shop.key})` }}
                />
                {shop.label}
                {shop.key === "all" && <small>Combined view</small>}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="mobile-shop"
              aria-haspopup="menu"
              aria-expanded={shopMenuOpen}
              onClick={() => setShopMenuOpen((open) => !open)}
            >
              <span className="brand-dot" />
              {currentShop.label}
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              ref={workspaceSearchRef}
              aria-label="Search workspace"
              placeholder="Scan or search — products, IMEI, customers, repairs…"
              value={globalSearch}
              role="combobox"
              aria-expanded={!!globalSearch.trim()}
              aria-controls="workspace-search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                searchResults.length && globalSearch.trim()
                  ? `search-result-${searchIndex}`
                  : undefined
              }
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setSearchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setGlobalSearch("");
                  e.currentTarget.blur();
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchIndex((current) =>
                    Math.max(
                      0,
                      Math.min(
                        searchResults.length - 1,
                        current + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
                  );
                }
                if (
                  e.key === "Enter" &&
                  !searchResults.length &&
                  globalSearch.trim() &&
                  canPage("AI Assistant")
                ) {
                  e.preventDefault();
                  setAskQuestion(globalSearch.trim());
                  go("AI Assistant");
                  e.currentTarget.blur();
                  return;
                }
                if (e.key === "Enter" && searchResults[searchIndex]) {
                  e.preventDefault();
                  const result = searchResults[searchIndex];
                  go(result.page);
                  setQuery(result.title);
                  e.currentTarget.blur();
                }
              }}
            />
            <kbd>⌘ K</kbd>
            {globalSearch.trim() && (
              <div
                className="search-results"
                id="workspace-search-results"
                role="listbox"
                aria-label="Workspace matches"
              >
                <div className="search-caption">
                  {searchResults.length ? "JUMP TO A RECORD" : "NO MATCHES"}
                </div>
                {searchResults.map((r, i) => (
                  <button
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === searchIndex}
                    className={i === searchIndex ? "search-active" : ""}
                    key={`${r.page}-${i}`}
                    onClick={() => {
                      go(r.page);
                      setQuery(r.title);
                    }}
                  >
                    <strong>{r.title}</strong>
                    <small>
                      {r.sub} · {r.page}
                    </small>
                  </button>
                ))}
                {!searchResults.length && (
                  <div className="search-empty">
                    <Search size={22} />
                    <strong>No records found</strong>
                    <p>
                      Try a product name, SKU, customer phone or repair number.
                    </p>
                  </div>
                )}
                {canPage("AI Assistant") && (
                  <button
                    className="search-ask"
                    onClick={() => {
                      setAskQuestion(globalSearch.trim());
                      setGlobalSearch("");
                      go("AI Assistant");
                    }}
                  >
                    <Sparkles size={16} />
                    <span>
                      Ask Fido: <strong>“{globalSearch.trim()}”</strong>
                    </span>
                  </button>
                )}
                <div className="search-hint">
                  ↑ ↓ Navigate <span>Enter Open · Esc Close</span>
                </div>
              </div>
            )}
          </div>
          <div className="header-actions">
            {!isOnline && (
              <span className="offline-pill">
                <WifiOff size={14} />
                Offline POS
              </span>
            )}
            <span className="online">
              <i />
              {error ? "Connection issue" : "Online"}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => {
                open("Notifications");
              }}
            >
              <Bell size={19} />
              {data.notifications.some((n) => !n.read) && <b />}
            </button>
          </div>
        </header>
        <nav className="mobile-bottom-nav" aria-label="Main navigation">
          {visibleSpaces.map((space) => (
            <button
              key={space.name}
              className={currentSpace?.name === space.name ? "active" : ""}
              aria-current={
                currentSpace?.name === space.name ? "page" : undefined
              }
              onClick={() => openSpace(space.name)}
            >
              <space.icon size={20} />
              <span>{space.name}</span>
              {space.name === "Tickets" && urgentAlerts.length > 0 && (
                <em aria-label={`${urgentAlerts.length} urgent`}>
                  {urgentAlerts.length}
                </em>
              )}
            </button>
          ))}
        </nav>
        <main className="main">
          {!canPage(page) ? (
            <section className="panel empty">
              <AlertCircle size={28} />
              <h2>No access to this section</h2>
              <p>
                Choose an available section from the menu or ask your owner to
                update your permissions.
              </p>
              <button
                className="primary"
                onClick={() =>
                  go(nav.find((n) => canPage(n.name))?.name || "Overview")
                }
              >
                Open my workspace
              </button>
            </section>
          ) : (
            <>
              {error && (
                <div className="notice auth-error" role="alert">
                  {error}
                  <button className="text-button" onClick={load}>
                    Retry connection
                  </button>
                </div>
              )}
              {spaceTabs.length > 1 && (
                <nav
                  className="space-tabs"
                  aria-label={`${currentSpace?.name} sections`}
                >
                  {spaceTabs.map((name) => (
                    <button
                      key={name}
                      className={page === name ? "active" : ""}
                      aria-current={page === name ? "page" : undefined}
                      onClick={() => go(name)}
                    >
                      {pageLabel(name)}
                      {tabCount(name) > 0 && <em>{tabCount(name)}</em>}
                    </button>
                  ))}
                </nav>
              )}
              {!["Alerts", "AI Assistant"].includes(page) && (
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      {[
                        currentSpace?.name || pageLabel(page),
                        currentShop.key === "all"
                          ? "All shops"
                          : `${currentShop.label} shop`,
                        new Date().toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "Asia/Colombo",
                        }),
                      ]
                        .join(" · ")
                        .toUpperCase()}
                    </div>
                    <h1>
                      {page === "Overview"
                        ? `Today at ${data.settings.businessName || "Fido LK"}`
                        : pageLabel(page)}
                    </h1>
                    <p>
                      {page === "Overview"
                        ? `Welcome back, ${user?.name?.split(" ")[0] || "there"}. Here’s what’s happening at your shop today.`
                        : (
                            {
                              Inventory:
                                "Every product, every batch, all in one place.",
                              Repairs:
                                "From intake to handover. Keep every repair moving.",
                              Customers:
                                "Build relationships. Keep track of every balance.",
                              Purchases:
                                "Manage stock receipts, supplier balances and cheques.",
                              Expenses:
                                "Stay on top of the costs of running your business.",
                              "COD & delivery":
                                "Follow your packages and the money coming back.",
                              Reloads:
                                "Record provider transactions and actual commissions.",
                              "Team & payroll":
                                "Your people, their earnings, and monthly payments.",
                              "Attendance & leave":
                                "Check in, check out, and request time off.",
                              Reports:
                                "Understand the numbers behind your business.",
                              "AI Assistant":
                                "Prepare insights, drafts and structured reviews with human approval.",
                              Suppliers:
                                "Manage supplier relationships, credit and returned stock.",
                              "Agents & commissions":
                                "Track earned commissions and settle every payee clearly.",
                              Alerts:
                                "Know when parts arrive. Keep collection responsibilities clear.",
                              Settings:
                                "Make this workspace work for your business.",
                              "Point of sale": "A smooth checkout starts here.",
                              "Invoices & returns":
                                "Find an invoice, review payments and process returns.",
                            } as Record<string, string>
                          )[page]}
                    </p>
                  </div>
                  <div className="heading-actions">
                    {page !== "Overview" &&
                      moduleActions[page] &&
                      can(
                        actionPermission[modalAction[moduleActions[page][1]]],
                      ) && (
                        <button
                          className="primary"
                          onClick={() => open(moduleActions[page][1])}
                        >
                          <Plus size={17} />
                          {moduleActions[page][0]}
                        </button>
                      )}
                  </div>
                </div>
              )}
              {mode === "demo" && (
                <div className="demo-strip">
                  <span className="demo-dot" />
                  Demo workspace{" "}
                  <span>
                    Explore with sample data. Changes are saved to this demo.
                  </span>
                </div>
              )}
              {user &&
                can("alerts.view") &&
                (page === "Overview" || urgentAlerts.length > 0) && (
                  <ArrivalAlarm
                    alerts={data.alerts || []}
                    user={user}
                    openAlerts={() => go("Alerts")}
                    compact
                    acknowledge={async (id) =>
                      !!(await action("acknowledgeAlert", { id }))
                    }
                  />
                )}
              {page === "AI Assistant" && user && (
                <AskFido
                  userId={user.id}
                  userName={user.name}
                  ready={
                    data.settings.ai.enabled &&
                    data.settings.ai.apiKeyConfigured &&
                    data.settings.ai.features.askFido
                  }
                  notReadyReason={
                    !data.settings.ai.apiKeyConfigured
                      ? "Fido needs a Gemini API key. An owner can add one in Settings, under AI."
                      : !data.settings.ai.enabled
                        ? "AI is turned off in Settings."
                        : "Ask Fido is switched off in Settings."
                  }
                  canConfigure={can("settings.manage")}
                  usage={{
                    today: data.settings.ai.requestsToday,
                    limit: data.settings.ai.dailyRequestLimit,
                  }}
                  suggestions={[
                    ...(can("sales.view") || can("reports.view")
                      ? [
                          {
                            icon: <BarChart3 size={20} />,
                            title: "How is today going?",
                            prompt:
                              "How are sales today compared with the target, and what should I focus on?",
                          },
                        ]
                      : []),
                    {
                      icon: <Bell size={20} />,
                      title: "What needs attention?",
                      prompt: "What needs my attention right now in the shop?",
                    },
                    ...(can("inventory.view")
                      ? [
                          {
                            icon: <Boxes size={20} />,
                            title: "What should I reorder?",
                            prompt:
                              "Which items are running low and how many should I reorder?",
                          },
                        ]
                      : []),
                    ...(can("repairs.view")
                      ? [
                          {
                            icon: <Wrench size={20} />,
                            title: "Repair ready message",
                            prompt:
                              "Write a short WhatsApp message telling a customer their phone repair is ready to collect.",
                          },
                        ]
                      : []),
                    ...(can("sales.view") || can("reports.view")
                      ? [
                          {
                            icon: <Star size={20} />,
                            title: "Best sellers this month",
                            prompt:
                              "What sold best in the last 30 days, and what is not moving?",
                          },
                        ]
                      : []),
                    {
                      icon: <Sparkles size={20} />,
                      title: "Facebook post",
                      prompt:
                        "Write a short Facebook post for our new phone accessories, in English and Sinhala.",
                    },
                  ]}
                  question={askQuestion}
                  onQuestionUsed={() => setAskQuestion("")}
                  onOpenSettings={() => go("Settings")}
                />
              )}
              {page === "Attendance & leave" && user && (
                <AttendanceWorkspace
                  data={data}
                  user={user}
                  canManage={can("users.manage")}
                  busy={busy}
                  action={action}
                />
              )}
              {!["Settings", "COD & delivery"].includes(page) && (
                <ExtensionModules
                  page={page}
                  user={user}
                  data={data}
                  can={can}
                  open={open}
                  action={action}
                  busy={busy}
                  query={query}
                  notify={setToast}
                />
              )}
              {page === "Overview" && (
                <CounterHome
                  verbs={homeVerbs}
                  now={homeNow}
                  today={{
                    date: new Date()
                      .toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "Asia/Colombo",
                      })
                      .toUpperCase(),
                    sales: money(dayRevenue),
                    salesCount: daySales.length,
                    targetLabel: target
                      ? `${progress}% of the ${money(target)} daily target`
                      : undefined,
                    progress: target ? progress : undefined,
                    rows: [
                      { label: "Gross margin", value: money(dayMargin) },
                      { label: "Customer balances", value: money(outstanding) },
                      {
                        label: "Repairs in the shop",
                        value: String(
                          data.repairs.filter(
                            (r) =>
                              !["Collected", "Declined"].includes(r.status),
                          ).length,
                        ),
                      },
                    ],
                  }}
                  shift={data.attendance
                    .filter((a) => a.day === today() && !a.checkOutAt)
                    .map((a) => ({
                      name: a.userName.split(" ")[0],
                      initials: a.userName
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join(""),
                      detail: `in ${new Date(a.checkInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}`,
                    }))}
                  recent={
                    canPage("Invoices & returns")
                      ? [...sales]
                          .sort((a, b) =>
                            b.createdAt.localeCompare(a.createdAt),
                          )
                          .slice(0, 5)
                          .map((sale) => ({
                            id: sale.id,
                            title: sale.number,
                            detail: `${sale.customerName} · ${sale.status}`,
                            amount: money(sale.total),
                            onOpen: () => setReceipt(sale),
                          }))
                      : []
                  }
                />
              )}
              {page === "Point of sale" && department === "All departments" && (
                <section className="panel pick-shop">
                  <h2>Which shop is this sale for?</h2>
                  <p>
                    Each shop keeps its own stock and till. Pick one to start
                    selling.
                  </p>
                  <div>
                    {shops
                      .filter((shop) => shop.key !== "all")
                      .map((shop) => (
                        <button
                          key={shop.key}
                          onClick={() => chooseShop(shop.value)}
                        >
                          <span
                            className="shop-swatch"
                            style={{ background: `var(--shop-${shop.key})` }}
                          />
                          {shop.label}
                        </button>
                      ))}
                  </div>
                </section>
              )}
              {page === "Point of sale" && department !== "All departments" && (
                <div className={`pos-layout ${posCartOpen ? "cart-open" : ""}`}>
                  <section>
                    {isPhonesShop && (
                      <div
                        className="pos-modes"
                        role="tablist"
                        aria-label="What are you selling?"
                      >
                        {(["Products", "Reload"] as const).map((mode) => (
                          <button
                            key={mode}
                            role="tab"
                            aria-selected={posMode === mode}
                            className={posMode === mode ? "selected" : ""}
                            onClick={() => setPosMode(mode)}
                          >
                            {mode}
                          </button>
                        ))}
                        <button
                          role="tab"
                          aria-selected={false}
                          onClick={() => go("Repairs")}
                        >
                          Repair pickup
                        </button>
                      </div>
                    )}
                    {isPhonesShop && posMode === "Reload" ? (
                      <ReloadPanel
                        providers={data.settings.providerRules.map(
                          (rule) => rule.provider,
                        )}
                        walletBalance={walletBalance}
                        onAdd={(reload) => {
                          setBillReloads((rows) => [...rows, reload]);
                          setToast(
                            `${reload.provider} ${money(reload.amount)} for ${reload.phone} added to the bill.`,
                          );
                        }}
                      />
                    ) : (
                      <>
                        <div
                          className="pos-category-tabs"
                          aria-label="Product categories"
                        >
                          {posCategories.map((category) => (
                            <button
                              key={category}
                              className={
                                posCategory === category ? "selected" : ""
                              }
                              onClick={() => setPosCategory(category)}
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                        {(data.parkedCarts.length > 0 ||
                          data.saleQuotes.some(
                            (quote) => quote.status === "Open",
                          )) && (
                          <div className="pos-saved-work">
                            {data.parkedCarts.map((parked) => (
                              <button
                                key={parked.id}
                                className="secondary small"
                                onClick={async () => {
                                  setCart(parked.items);
                                  setSaleCustomerId(parked.customerId);
                                  await action("deleteParkedCart", {
                                    id: parked.id,
                                  });
                                  requestAnimationFrame(() =>
                                    posSearchRef.current?.focus(),
                                  );
                                }}
                              >
                                Resume {parked.name}
                              </button>
                            ))}
                            {data.saleQuotes
                              .filter((quote) => quote.status === "Open")
                              .slice(-5)
                              .map((quote) => (
                                <button
                                  key={quote.id}
                                  className="secondary small"
                                  onClick={() => {
                                    setCart(quote.items);
                                    setSaleCustomerId(quote.customerId);
                                    setToast(
                                      `${quote.number} loaded. Prices and stock were refreshed.`,
                                    );
                                  }}
                                >
                                  {quote.number} · {quote.customerName}
                                </button>
                              ))}
                          </div>
                        )}
                        <div className="module-toolbar">
                          <div className="search-field">
                            <Search size={17} />
                            <input
                              ref={posSearchRef}
                              placeholder="Scan barcode or search products, SKU, IMEI…"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              aria-label="Search products"
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                const scanned = query.trim();
                                if (!scanned) return;
                                const handled = handleScannedCode(scanned);
                                if (handled) {
                                  setQuery("");
                                } else {
                                  setToast(
                                    "No active product or IMEI matches that code. Check the label or choose a product below.",
                                  );
                                  requestAnimationFrame(() =>
                                    posSearchRef.current?.focus(),
                                  );
                                }
                              }}
                            />
                          </div>
                          <div className="pos-toolbar-actions">
                            <span>{visibleSaleProducts.length} products</span>
                            <button
                              className="secondary small"
                              onClick={() => go("Invoices & returns")}
                            >
                              Find invoice / return
                            </button>
                          </div>
                        </div>
                        <details className="scan-helper">
                          <summary>Scanner help</summary>
                          <p>
                            MP6300Y ready: use USB keyboard mode with an Enter
                            suffix. Exact SKU scans add instantly; phones still
                            require an IMEI selection.
                          </p>
                        </details>
                        <div className="product-grid">
                          {visibleSaleProducts.map((p) => (
                            <article
                              className={`product-card ${
                                cart.some((item) => item.productId === p.id)
                                  ? "in-cart"
                                  : ""
                              }`}
                              key={p.id}
                            >
                              <button
                                type="button"
                                className={`favorite-toggle ${favoriteProductIds.includes(p.id) ? "selected" : ""}`}
                                aria-pressed={favoriteProductIds.includes(p.id)}
                                aria-label={`${favoriteProductIds.includes(p.id) ? "Remove" : "Add"} ${p.name} ${favoriteProductIds.includes(p.id) ? "from" : "to"} favourites`}
                                onClick={() => {
                                  setFavoriteProductIds((ids) =>
                                    ids.includes(p.id)
                                      ? ids.filter((id) => id !== p.id)
                                      : [...ids, p.id],
                                  );
                                }}
                              >
                                <Star
                                  size={15}
                                  fill={
                                    favoriteProductIds.includes(p.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <button
                                type="button"
                                className="product-add-target"
                                aria-label={`Add ${p.name} to sale`}
                                onClick={() => addCart(p)}
                                disabled={!p.stock || !can("sales.manage")}
                              />
                              <div
                                className={`product-visual ${p.department.toLowerCase()}`}
                              >
                                <ProductIcon product={p} />
                                <span>{p.category}</span>
                                {cart.some(
                                  (item) => item.productId === p.id,
                                ) && (
                                  <b className="product-cart-count">
                                    {cart
                                      .filter((item) => item.productId === p.id)
                                      .reduce(
                                        (sum, item) => sum + item.quantity,
                                        0,
                                      )}{" "}
                                    in sale
                                  </b>
                                )}
                              </div>
                              <small>{p.sku}</small>
                              <h3>{p.name}</h3>
                              <div>
                                <span className="product-price">
                                  <small>
                                    {priceTierLabel(
                                      data.settings.priceTierLabels,
                                      "Retail",
                                    ).toUpperCase()}
                                  </small>
                                  <strong>{stockRetailLabel(data, p)}</strong>
                                </span>
                                <span
                                  className={
                                    p.stock <= p.reorderLevel ? "low-stock" : ""
                                  }
                                >
                                  {p.stock} available
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                        {cart.length > 0 && !cartVisible && !mobile && (
                          <button
                            className="mobile-cart-shortcut"
                            onClick={() => {
                              if (
                                window.matchMedia("(max-width: 780px)").matches
                              )
                                setPosCartOpen(true);
                              else
                                cartRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                          >
                            <ShoppingBag size={18} />
                            <span>
                              {cart.reduce(
                                (sum, item) => sum + item.quantity,
                                0,
                              )}{" "}
                              {cart.reduce(
                                (sum, item) => sum + item.quantity,
                                0,
                              ) === 1
                                ? "item"
                                : "items"}{" "}
                              ·{" "}
                              {cartPricingError
                                ? "Review pricing"
                                : money(cartTotal)}
                            </span>
                            <strong>
                              Charge <ArrowRight size={16} />
                            </strong>
                          </button>
                        )}
                        {!visibleSaleProducts.length && (
                          <div className="empty">
                            No products match your search.
                          </div>
                        )}
                      </>
                    )}
                  </section>
                  <section
                    ref={cartRef}
                    className="panel cart"
                    id="current-sale"
                  >
                    <button
                      className="mobile-cart-close"
                      onClick={() => setPosCartOpen(false)}
                    >
                      <X size={18} /> Back to products
                    </button>
                    <div className="panel-heading">
                      <h2>
                        Current sale{" "}
                        <span className="count">
                          {cart.reduce((a, c) => a + c.quantity, 0)}
                        </span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setCart([]);
                          setBillReloads([]);
                          setPayDuesOnBill(false);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="pos-customer-heading">
                      <strong>Customer</strong>
                      {can("customers.manage") && (
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() =>
                            open("Add customer", { selectAfterCreate: true })
                          }
                        >
                          <Plus size={14} /> Add customer
                        </button>
                      )}
                    </div>
                    <CustomerPicker
                      customers={data.customers}
                      sales={data.sales}
                      shipments={data.shipments}
                      value={saleCustomerId}
                      onChange={setSaleCustomerId}
                      canCreate={can("customers.manage")}
                      canCollect={false}
                      priceTierLabels={data.settings.priceTierLabels}
                      onQuickAdd={(value) => {
                        const looksLikePhone = /\d/.test(value);
                        open("Add customer", {
                          selectAfterCreate: true,
                          initialPhone: looksLikePhone ? value : "",
                          initialName: looksLikePhone ? "" : value,
                        });
                      }}
                      onCollect={(customer) =>
                        open("Collect customer payment", customer)
                      }
                      onView={(customer) => open("Customer details", customer)}
                    />
                    {saleCustomerOwes > 0 && (
                      <div className="bill-dues" role="status">
                        <div>
                          <strong>
                            Owes {money(saleCustomerOwes)} from{" "}
                            {saleCustomerDues.length} old{" "}
                            {saleCustomerDues.length === 1 ? "bill" : "bills"}
                          </strong>
                          <small>
                            {saleCustomerDues
                              .slice(0, 3)
                              .map(
                                (sale) =>
                                  `${sale.number} · ${date(sale.createdAt)}`,
                              )
                              .join("  ·  ")}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={payDuesOnBill ? "added" : ""}
                          aria-pressed={payDuesOnBill}
                          disabled={!can("sales.manage")}
                          onClick={() => setPayDuesOnBill((on) => !on)}
                        >
                          {payDuesOnBill
                            ? "On this bill ✓ Undo"
                            : "Pay with this bill"}
                        </button>
                      </div>
                    )}
                    <div className="bill-tier">
                      <span>
                        Price tier ·{" "}
                        {billTier ? "chosen for this bill" : "from customer"}
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="Price tier for this bill"
                      >
                        {PRICE_TIERS.map((tier) => (
                          <button
                            type="button"
                            role="radio"
                            key={tier}
                            aria-checked={activeTier === tier}
                            className={activeTier === tier ? "selected" : ""}
                            disabled={
                              tier !== "Retail" && !can("sales.priceTier")
                            }
                            title={
                              tier !== "Retail" && !can("sales.priceTier")
                                ? "Permission required"
                                : undefined
                            }
                            onClick={() => chooseBillTier(tier)}
                          >
                            {priceTierLabel(
                              data.settings.priceTierLabels,
                              tier,
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="cart-lines">
                      {cart.length ? (
                        cart.map((c, i) => {
                          const p = data.products.find(
                            (p) => p.id === c.productId,
                          )!;
                          const batchContext = cartBatchContext[i] || [];
                          return (
                            <div
                              className="cart-line"
                              key={`${c.productId}-${c.imei || i}`}
                            >
                              <div>
                                <strong>{p.name}</strong>
                                <small className="cart-line-lot">
                                  {c.imei
                                    ? `IMEI ${c.imei}`
                                    : c.batchId
                                      ? `Lot ${lotOf(c.batchId)?.lot || "—"}`
                                      : `Oldest lot · ${p.sku}`}
                                </small>
                                <span>
                                  {cartQuote
                                    ? money(
                                        cartQuote.lines
                                          .filter((l) => l.cartIndex === i)
                                          .reduce(
                                            (sum, l) =>
                                              sum +
                                              (l.total ?? l.price * l.quantity),
                                            0,
                                          ),
                                      )
                                    : "Check pricing"}
                                </span>
                              </div>
                              <div className="quantity">
                                <button
                                  aria-label="Decrease quantity"
                                  onClick={() =>
                                    setCart((prev) =>
                                      prev.flatMap((r, j) =>
                                        j !== i
                                          ? [r]
                                          : r.quantity > 1
                                            ? [
                                                {
                                                  ...r,
                                                  quantity: r.quantity - 1,
                                                },
                                              ]
                                            : [],
                                      ),
                                    )
                                  }
                                >
                                  <Minus size={13} />
                                </button>
                                <span>{c.quantity}</span>
                                <button
                                  aria-label="Increase quantity"
                                  disabled={
                                    p.serialized || c.quantity >= p.stock
                                  }
                                  onClick={() => {
                                    const lot = lotOf(c.batchId);
                                    if (
                                      lot &&
                                      lot.remaining -
                                        (unitsInCartByLot[lot.id] || 0) <=
                                        0
                                    ) {
                                      setToast(
                                        `Lot ${lot.lot} is used up. Pick the lot for the next one.`,
                                      );
                                      setLotPickProduct(p);
                                      return;
                                    }
                                    setCart((prev) =>
                                      prev.map((r, j) =>
                                        j === i
                                          ? { ...r, quantity: r.quantity + 1 }
                                          : r,
                                      ),
                                    );
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                              <button
                                type="button"
                                className={`line-adjust ${
                                  c.unitPrice !== undefined ||
                                  (c.discountValue || 0) > 0 ||
                                  (c.priceTier && c.priceTier !== activeTier)
                                    ? "changed"
                                    : ""
                                }`}
                                aria-expanded={openPriceLine === i}
                                onClick={() =>
                                  setOpenPriceLine((open) =>
                                    open === i ? null : i,
                                  )
                                }
                              >
                                {c.unitPrice !== undefined ||
                                (c.discountValue || 0) > 0
                                  ? "Price changed"
                                  : "Adjust price"}
                              </button>
                              {openPriceLine === i && (
                                <div className="cart-price-details">
                                  <strong className="cart-price-heading">
                                    Price and discount
                                  </strong>
                                  <div className="cart-pricing">
                                    <label className="field">
                                      <span>Price tier</span>
                                      <select
                                        aria-label={`Price tier for ${p.name}`}
                                        value={c.priceTier || ""}
                                        onChange={(e) =>
                                          updateCartPricing(i, {
                                            priceTier: (e.target.value ||
                                              undefined) as
                                              PriceTier | undefined,
                                            unitPrice: undefined,
                                          })
                                        }
                                      >
                                        <option value="">
                                          Customer default
                                        </option>
                                        {PRICE_TIERS.map((tier) => (
                                          <option
                                            key={tier}
                                            value={tier}
                                            disabled={
                                              (tier !== "Retail" &&
                                                !can("sales.priceTier")) ||
                                              !batchContext.length ||
                                              batchContext.some(
                                                ({ batch }) =>
                                                  getPricing(p, batch)[tier] ===
                                                  undefined,
                                              )
                                            }
                                          >
                                            {priceTierLabel(
                                              data.settings.priceTierLabels,
                                              tier,
                                            )}
                                            {!batchContext.length ||
                                            batchContext.some(
                                              ({ batch }) =>
                                                getPricing(p, batch)[tier] ===
                                                undefined,
                                            )
                                              ? " · Not available"
                                              : tier !== "Retail" &&
                                                  !can("sales.priceTier")
                                                ? " · Permission required"
                                                : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {can("sales.priceOverride") && (
                                      <label className="field">
                                        <span>Custom unit price (Rs.)</span>
                                        <input
                                          aria-label={`Custom unit price for ${p.name}`}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="Use tier price"
                                          value={
                                            c.unitPrice === undefined
                                              ? ""
                                              : c.unitPrice / 100
                                          }
                                          onChange={(e) =>
                                            updateCartPricing(i, {
                                              unitPrice:
                                                e.target.value === ""
                                                  ? undefined
                                                  : cents(e.target.value),
                                            })
                                          }
                                        />
                                      </label>
                                    )}
                                    {can("sales.discount") && (
                                      <>
                                        <label className="field">
                                          <span>Extra discount / unit</span>
                                          <select
                                            value={c.discountType || "Amount"}
                                            onChange={(e) =>
                                              updateCartPricing(i, {
                                                discountType: e.target.value as
                                                  "Amount" | "Percent",
                                                discountValue: 0,
                                              })
                                            }
                                          >
                                            <option value="Amount">
                                              Amount (Rs.)
                                            </option>
                                            <option value="Percent">
                                              Percentage (%)
                                            </option>
                                          </select>
                                        </label>
                                        <label className="field">
                                          <span>
                                            {c.discountType === "Percent"
                                              ? "Discount (%)"
                                              : "Discount (Rs.)"}
                                          </span>
                                          <input
                                            aria-label={`Extra discount for ${p.name}`}
                                            type="number"
                                            min="0"
                                            max={
                                              c.discountType === "Percent"
                                                ? 100
                                                : undefined
                                            }
                                            step="0.01"
                                            value={
                                              c.discountType === "Percent"
                                                ? c.discountValue || 0
                                                : (c.discountValue || 0) / 100
                                            }
                                            onChange={(e) =>
                                              updateCartPricing(i, {
                                                discountValue:
                                                  c.discountType === "Percent"
                                                    ? Number(e.target.value)
                                                    : cents(e.target.value),
                                              })
                                            }
                                          />
                                        </label>
                                      </>
                                    )}
                                    {can("sales.priceOverride") && (
                                      <label className="field pricing-reason">
                                        <span>Price override reason</span>
                                        <input
                                          value={c.overrideReason || ""}
                                          placeholder="Required for custom or out-of-range prices"
                                          onChange={(e) =>
                                            updateCartPricing(i, {
                                              overrideReason: e.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                    )}
                                    {!cartQuote && (
                                      <div className="batch-quotes">
                                        {batchContext.map(
                                          ({ batch, quantity }) => {
                                            const prices = getPricing(p, batch);
                                            return (
                                              <div key={batch.id}>
                                                <strong>
                                                  {batch.lot} · {quantity} unit
                                                  {quantity === 1 ? "" : "s"}
                                                </strong>
                                                <small>
                                                  Allowed / unit:{" "}
                                                  {prices.minimum === undefined
                                                    ? "No minimum"
                                                    : money(
                                                        prices.minimum,
                                                      )}{" "}
                                                  –{" "}
                                                  {prices.maximum === undefined
                                                    ? "No maximum"
                                                    : money(prices.maximum)}
                                                </small>
                                                <small>
                                                  {PRICE_TIERS.filter(
                                                    (tier) =>
                                                      prices[tier] !==
                                                      undefined,
                                                  )
                                                    .map(
                                                      (tier) =>
                                                        `${priceTierLabel(data.settings.priceTierLabels, tier)} ${money(prices[tier]!)}`,
                                                    )
                                                    .join(" · ")}
                                                </small>
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    )}
                                    <div className="batch-quotes">
                                      {cartQuote?.lines
                                        .filter((l) => l.cartIndex === i)
                                        .map((l, j) => (
                                          <div key={j}>
                                            <strong>
                                              {l.lot} ·{" "}
                                              {priceTierLabel(
                                                data.settings.priceTierLabels,
                                                l.priceTier || "Retail",
                                              )}
                                            </strong>
                                            <span>
                                              {l.quantity} × {money(l.price)} ·{" "}
                                              {money(
                                                l.total ?? l.price * l.quantity,
                                              )}
                                            </span>
                                            <small>
                                              Allowed / unit:{" "}
                                              {l.minimumPrice === undefined
                                                ? "No minimum"
                                                : money(l.minimumPrice)}{" "}
                                              –{" "}
                                              {l.maximumPrice === undefined
                                                ? "No maximum"
                                                : money(l.maximumPrice)}
                                            </small>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : billReloads.length ? null : (
                        <div className="empty">
                          <ShoppingBag size={32} />
                          <h3>Start a new sale</h3>
                          <p>Select a product or scan a barcode.</p>
                        </div>
                      )}
                      {billReloads.map((reload, index) => (
                        <div
                          className="cart-line reload-line"
                          key={`${reload.phone}-${index}`}
                        >
                          <div>
                            <strong>
                              {reload.provider} {reload.type.toLowerCase()}
                            </strong>
                            <small className="cart-line-lot">
                              {reload.phone}
                            </small>
                            <span>{money(reload.amount)}</span>
                          </div>
                          <button
                            type="button"
                            className="text-button"
                            aria-label={`Remove ${reload.provider} reload for ${reload.phone}`}
                            onClick={() =>
                              setBillReloads((rows) =>
                                rows.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                      {duesOnBill > 0 && (
                        <div className="cart-line dues-line">
                          <div>
                            <strong>Old balance paid</strong>
                            <small>
                              {saleCustomerDues
                                .map((s) => s.number)
                                .join(" · ")}
                            </small>
                            <span>{money(duesOnBill)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="cart-bottom">
                      <div>
                        <span>
                          {duesOnBill || reloadsOnBill ? "Items" : "Subtotal"}
                        </span>
                        <strong>
                          {cartPricingError
                            ? "Review pricing"
                            : money(cartTotal)}
                        </strong>
                      </div>
                      {reloadsOnBill > 0 && (
                        <div>
                          <span>Reloads</span>
                          <strong>{money(reloadsOnBill)}</strong>
                        </div>
                      )}
                      {(duesOnBill > 0 || reloadsOnBill > 0) && (
                        <div className="bill-total">
                          <span>Total to collect</span>
                          <strong>
                            {cartPricingError
                              ? "Review pricing"
                              : money(collectTotal)}
                          </strong>
                        </div>
                      )}
                      {cartPricingError ? (
                        <p className="pricing-error" role="alert">
                          {cartPricingError}
                        </p>
                      ) : (
                        <p>
                          Batch prices include extra discounts. Payment at
                          checkout.
                        </p>
                      )}
                      <button
                        className="primary charge-button"
                        disabled={
                          (!cart.length && !duesOnBill && !reloadsOnBill) ||
                          !can("sales.manage") ||
                          !!cartPricingError
                        }
                        onClick={() =>
                          cart.length ? open("Checkout") : takeItemlessPayment()
                        }
                      >
                        {!cart.length && (duesOnBill || reloadsOnBill)
                          ? "Take payment "
                          : "Charge "}
                        {cartPricingError
                          ? "Review pricing"
                          : money(collectTotal)}
                        <ArrowRight size={17} />
                      </button>
                      <div className="row-buttons pos-save-actions">
                        <button
                          className="secondary small"
                          disabled={
                            !cart.length || busy || !can("sales.manage")
                          }
                          onClick={async () => {
                            const saved = await action("parkCart", {
                              name: `Cart ${data.parkedCarts.length + 1}`,
                              customerId: saleCustomerId,
                              items: cart,
                            });
                            if (saved) setCart([]);
                          }}
                        >
                          Park cart
                        </button>
                        <button
                          className="secondary small"
                          disabled={
                            !cart.length || busy || !can("sales.manage")
                          }
                          onClick={async () => {
                            const expires = new Date();
                            expires.setDate(expires.getDate() + 7);
                            const saved = await action("createSaleQuote", {
                              customerId: saleCustomerId,
                              items: cart,
                              expiresAt: expires.toISOString().slice(0, 10),
                            });
                            if (saved) setToast("Quotation saved for 7 days.");
                          }}
                        >
                          Save quotation
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {![
                "Overview",
                "Point of sale",
                "Settings",
                "Reports",
                "Customers",
                "Attendance & leave",
                "Invoices & returns",
              ].includes(page) && (
                <div className="module-toolbar">
                  {page !== "Customers" && (
                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label={
                          page === "Purchases"
                            ? "Search goods received and cheques"
                            : page === "Team & payroll"
                              ? "Search team members"
                              : `Search ${page}`
                        }
                        placeholder={
                          page === "Purchases"
                            ? "Search goods received and cheques…"
                            : page === "Team & payroll"
                              ? "Search team members…"
                              : `Search ${page.toLowerCase()}…`
                        }
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="toolbar-right">
                    {page === "Inventory" && (
                      <button
                        disabled={
                          !!actionPermission[modalAction["New product"]] &&
                          !can(actionPermission[modalAction["New product"]])
                        }
                        className="secondary"
                        onClick={() => open("New product")}
                      >
                        <Plus size={15} />
                        New product
                      </button>
                    )}
                    {page === "Purchases" && (
                      <button
                        disabled={
                          !!actionPermission[modalAction["Add cheque"]] &&
                          !can(actionPermission[modalAction["Add cheque"]])
                        }
                        className="secondary"
                        onClick={() => open("Add cheque")}
                      >
                        <Plus size={15} />
                        Add cheque
                      </button>
                    )}
                    <button className="secondary" onClick={exportData}>
                      <Download size={15} />
                      {page === "Purchases"
                        ? "Export purchases CSV"
                        : page === "Team & payroll"
                          ? "Export team CSV"
                          : "Export"}
                    </button>
                  </div>
                </div>
              )}
              {page === "Inventory" && (
                <>
                  <div className="department-tabs inventory-tabs">
                    {["Stock", "Planner", "Counts", "Movements"].map((tab) => (
                      <button
                        key={tab}
                        className={inventoryTab === tab ? "selected" : ""}
                        onClick={() => setInventoryTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  {inventoryTab === "Stock" ? (
                    <section className="panel">
                      <Table
                        heads={[
                          "PRODUCT",
                          ...(department === "All departments" ? ["SHOP"] : []),
                          "IN STOCK",
                          "LOTS",
                          "RETAIL",
                          "COST",
                          "",
                        ]}
                        rows={products.map((p) => {
                          const lots = data.batches.filter(
                            (b) => b.productId === p.id && b.remaining > 0,
                          );
                          const oldest = lots
                            .map((b) => b.receivedAt)
                            .sort()[0];
                          return [
                            <div className="product-name">
                              <span className="mini-product">
                                <ProductIcon product={p} />
                              </span>
                              <span>
                                <strong>
                                  {p.name}
                                  {p.active === false && (
                                    <em className="chip-muted">Inactive</em>
                                  )}
                                </strong>
                                <small>
                                  {p.sku} · {p.category}
                                  {p.serialized ? " · by IMEI" : ""}
                                </small>
                              </span>
                            </div>,
                            ...(department === "All departments"
                              ? [p.department]
                              : []),
                            <span
                              className={`stock-cell ${p.stock <= p.reorderLevel ? "low-stock" : ""}`}
                            >
                              <strong>{p.stock}</strong>
                              {p.stock <= p.reorderLevel && (
                                <em>Low · reorder at {p.reorderLevel}</em>
                              )}
                            </span>,
                            <button
                              className="lots-cell"
                              onClick={() => open("Product batches", p)}
                            >
                              <strong>
                                {lots.length} lot{lots.length === 1 ? "" : "s"}
                              </strong>
                              {oldest && (
                                <small>
                                  oldest{" "}
                                  {Math.max(
                                    0,
                                    Math.floor(
                                      (Date.now() - Date.parse(oldest)) /
                                        86400000,
                                    ),
                                  )}{" "}
                                  days
                                </small>
                              )}
                            </button>,
                            stockRetailLabel(data, p),
                            money(p.cost),
                            <div className="row-buttons">
                              {rowAction("Label", () =>
                                open("Product label", p),
                              )}
                              <button
                                className="text-button"
                                disabled={!can("inventory.manage") || busy}
                                onClick={() =>
                                  action("setProductActive", {
                                    id: p.id,
                                    active: p.active === false,
                                  })
                                }
                              >
                                {p.active === false ? "Activate" : "Deactivate"}
                              </button>
                            </div>,
                          ];
                        })}
                      />
                    </section>
                  ) : inventoryTab === "Planner" ? (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Inventory planner</h2>
                          <p>
                            {data.settings.inventoryLookbackDays ?? 30}-day
                            velocity · target{" "}
                            {data.settings.inventoryTargetDays ?? 30} days of
                            cover
                          </p>
                        </div>
                      </div>
                      <Table
                        heads={[
                          "PRODUCT",
                          "SOLD",
                          "VELOCITY / DAY",
                          "DAYS COVER",
                          "OLDEST STOCK",
                          "INCOMING",
                          "SUGGESTED",
                          "STATUS",
                          "",
                        ]}
                        rows={plannedInventory.map((row) => [
                          <div>
                            <strong>{row.name}</strong>
                            <small>
                              {row.sku} · {money(row.stockValue)} on hand
                            </small>
                          </div>,
                          row.unitsSold,
                          row.dailyVelocity,
                          row.daysCover === null ? "No history" : row.daysCover,
                          `${row.oldestStockDays} days`,
                          row.incoming,
                          <strong>{row.suggestedOrder}</strong>,
                          <Badge>{row.urgency}</Badge>,
                          row.suggestedOrder > 0 ? (
                            <button
                              className="text-button"
                              disabled={!can("purchasing.manage")}
                              onClick={() =>
                                open("Create purchase order", {
                                  plannerLines: [
                                    {
                                      productId: row.productId,
                                      quantity: row.suggestedOrder,
                                      unitCost:
                                        data.products.find(
                                          (product) =>
                                            product.id === row.productId,
                                        )?.cost || 0,
                                    },
                                  ],
                                })
                              }
                            >
                              Draft PO
                            </button>
                          ) : (
                            ""
                          ),
                        ])}
                      />
                    </section>
                  ) : inventoryTab === "Counts" ? (
                    <div className="report-layout">
                      <form
                        className="panel settings-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          const productId = String(form.get("productId"));
                          const counted = Number(form.get("counted"));
                          const saved = await action("createInventoryCount", {
                            lines: [{ productId, counted }],
                            note: form.get("note"),
                          });
                          if (saved) event.currentTarget.reset();
                        }}
                      >
                        <div className="panel-heading">
                          <div>
                            <h2>New cycle count</h2>
                            <p>
                              Count one SKU at a time; approval posts any
                              variance.
                            </p>
                          </div>
                        </div>
                        <div className="panel-body">
                          <label className="field">
                            <span>Product</span>
                            <select name="productId" required>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} · expected {product.stock}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Counted quantity</span>
                            <input
                              name="counted"
                              type="number"
                              min="0"
                              step="1"
                              required
                            />
                          </label>
                          <label className="field">
                            <span>Count note</span>
                            <input
                              name="note"
                              placeholder="Shelf, counter or reason"
                            />
                          </label>
                          <button
                            className="primary"
                            disabled={busy || !can("inventory.count")}
                          >
                            Submit count
                          </button>
                        </div>
                      </form>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Recent counts</h2>
                          <button
                            className="secondary small"
                            onClick={printReport}
                          >
                            <Printer size={14} /> Print count sheet
                          </button>
                        </div>
                        <Table
                          heads={["COUNT", "PRODUCT / VARIANCE", "STATUS", ""]}
                          rows={[...data.inventoryCounts]
                            .reverse()
                            .map((count) => [
                              <div>
                                <strong>{count.number}</strong>
                                <small>{date(count.createdAt)}</small>
                              </div>,
                              count.lines.map((line) => (
                                <div key={line.productId}>
                                  {line.productName}:{" "}
                                  {line.counted - line.expected > 0 ? "+" : ""}
                                  {line.counted - line.expected}
                                </div>
                              )),
                              <Badge>{count.status}</Badge>,
                              count.status === "Submitted" ? (
                                <button
                                  className="text-button"
                                  disabled={busy || !can("inventory.approve")}
                                  onClick={() =>
                                    action("approveInventoryCount", {
                                      id: count.id,
                                    })
                                  }
                                >
                                  Approve
                                </button>
                              ) : (
                                ""
                              ),
                            ])}
                        />
                      </section>
                    </div>
                  ) : (
                    <div className="report-layout inventory-movement-layout">
                      <form
                        className="panel settings-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          const saved = await action("writeOffStock", {
                            productId: form.get("productId"),
                            quantity: Number(form.get("quantity")),
                            kind: form.get("kind"),
                            imei: form.get("imei"),
                            reason: form.get("reason"),
                          });
                          if (saved) event.currentTarget.reset();
                        }}
                      >
                        <div className="panel-heading">
                          <div>
                            <h2>Damage or loss</h2>
                            <p>
                              Posts the stock cost to the loss account and
                              records who made the adjustment.
                            </p>
                          </div>
                        </div>
                        <div className="panel-body">
                          <label className="field">
                            <span>Product</span>
                            <select name="productId" required>
                              {products
                                .filter((product) => product.stock > 0)
                                .map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} · {product.stock} available
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="form-grid">
                            <label className="field">
                              <span>Type</span>
                              <select name="kind">
                                <option>Damage</option>
                                <option>Loss</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>Quantity</span>
                              <input
                                name="quantity"
                                type="number"
                                min="1"
                                step="1"
                                required
                              />
                            </label>
                          </div>
                          <label className="field">
                            <span>IMEI (serialized items)</span>
                            <input
                              name="imei"
                              placeholder="Required when writing off a phone"
                            />
                          </label>
                          <label className="field">
                            <span>Reason</span>
                            <input
                              name="reason"
                              required
                              placeholder="What happened and where"
                            />
                          </label>
                          <button
                            className="primary"
                            disabled={busy || !can("inventory.manage")}
                          >
                            Record write-off
                          </button>
                        </div>
                      </form>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Movement history</h2>
                        </div>
                        <Table
                          heads={[
                            "TIME",
                            "PRODUCT",
                            "TYPE",
                            "QUANTITY",
                            "LOT / IMEI",
                            "REFERENCE",
                          ]}
                          rows={[...data.inventoryMovements]
                            .reverse()
                            .map((item) => [
                              new Date(item.createdAt).toLocaleString("en-GB", {
                                timeZone: "Asia/Colombo",
                              }),
                              item.productName,
                              <Badge>{item.type}</Badge>,
                              item.quantity > 0
                                ? `+${item.quantity}`
                                : item.quantity,
                              `${item.lot || "—"}${item.imei ? ` · ${item.imei}` : ""}`,
                              item.reference,
                            ])}
                        />
                      </section>
                    </div>
                  )}
                </>
              )}
              {page === "Repairs" && (
                <div className="repair-workspace">
                  <RepairOverview
                    repairs={data.repairs}
                    staff={data.staff}
                    status={repairStatusFilter}
                    setStatus={setRepairStatusFilter}
                    technician={repairTechnicianFilter}
                    setTechnician={setRepairTechnicianFilter}
                    period={repairPeriodFilter}
                    setPeriod={setRepairPeriodFilter}
                    sort={repairSort}
                    setSort={setRepairSort}
                    resultCount={visibleRepairs.length}
                  />
                  <div className="repair-master-detail">
                    <section
                      className="panel repair-queue-panel"
                      aria-label="Repair queue"
                    >
                      <div className="repair-queue-heading">
                        <div>
                          <span>Repair queue</span>
                          <strong>{visibleRepairs.length} jobs</strong>
                        </div>
                        <span>Newest first</span>
                      </div>
                      <div className="repair-queue-list">
                        {visibleRepairs.map((repair) => (
                          <button
                            key={repair.id}
                            className={
                              activeRepair?.id === repair.id ? "selected" : ""
                            }
                            aria-pressed={activeRepair?.id === repair.id}
                            onClick={() => setActiveRepairId(repair.id)}
                          >
                            <span className="repair-queue-device">
                              <span className="device-icon">
                                <Smartphone size={17} />
                              </span>
                              <span>
                                <strong>{repair.device}</strong>
                                <small>
                                  {repair.number} · {repair.customerName}
                                </small>
                              </span>
                            </span>
                            <span className="repair-queue-meta">
                              <Badge>{repair.status}</Badge>
                              <strong>{money(repair.estimate)}</strong>
                            </span>
                            <small className="repair-queue-issue">
                              {repair.issue}
                            </small>
                          </button>
                        ))}
                        {!visibleRepairs.length && (
                          <div className="empty">
                            <Package size={28} />
                            <p>
                              No repairs match these filters. Reset the filters
                              or search for another customer, phone or job
                              number.
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                    <section className="panel repair-focus-panel">
                      {activeRepair ? (
                        <>
                          <div
                            className="repair-stage-rail"
                            aria-label={`Repair stage: ${activeRepair.status}`}
                          >
                            {[
                              "Received",
                              "Diagnosing",
                              "Awaiting approval",
                              "Approved",
                              "In progress",
                              "Ready for collection",
                              "Collected",
                            ].map((stage, index, stages) => {
                              const current = stages.indexOf(
                                activeRepair.status,
                              );
                              return (
                                <span
                                  key={stage}
                                  className={`${index < current ? "complete" : ""} ${index === current ? "current" : ""}`}
                                >
                                  <i>
                                    {index < current ? (
                                      <Check size={12} />
                                    ) : (
                                      index + 1
                                    )}
                                  </i>
                                  <small>{stage}</small>
                                </span>
                              );
                            })}
                          </div>
                          <RepairDetails
                            repair={activeRepair}
                            action={action}
                            busy={busy}
                            can={can}
                            open={open}
                            openDocument={(name, repair) =>
                              openRepairDocument(name, repair)
                            }
                          />
                        </>
                      ) : (
                        <div className="empty">
                          <Wrench size={30} />
                          <h3>No repair selected</h3>
                          <p>
                            Choose a repair from the queue to view its work.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
              {page === "Customers" && (
                <CustomerDirectory
                  customers={data.customers}
                  sales={data.sales}
                  shipments={data.shipments}
                  onOpen={(customer) => open("Customer details", customer)}
                />
              )}
              {page === "Invoices & returns" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Invoice register</h2>
                      <p>
                        Search by invoice number, customer, phone, item or IMEI.
                      </p>
                    </div>
                    <button className="secondary small" onClick={exportData}>
                      <Download size={15} /> Export sales CSV
                    </button>
                  </div>
                  <div className="panel-body panel-body-search">
                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Search invoices"
                        placeholder="Search invoices"
                        value={invoiceQuery}
                        onChange={(event) =>
                          setInvoiceQuery(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <Table
                    heads={[
                      "INVOICE / CUSTOMER",
                      "DATE",
                      "TOTAL",
                      "BALANCE",
                      "STATUS",
                      "",
                    ]}
                    rows={invoiceMatches.map((sale) => [
                      <div key={sale.id}>
                        <strong>{sale.number}</strong>
                        <small>{sale.customerName}</small>
                      </div>,
                      date(sale.createdAt),
                      money(sale.total),
                      money(saleBalance(sale)),
                      <Badge>{sale.status}</Badge>,
                      rowAction("View", () => setReceipt(sale)),
                    ])}
                  />
                </section>
              )}
              {page === "Purchases" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Goods received & supplier balances</h2>
                    </div>
                    <Table
                      heads={[
                        "GRN",
                        "SUPPLIER",
                        "RECEIVED",
                        "TOTAL",
                        "PAID",
                        "BALANCE",
                      ]}
                      rows={filtered(data.purchases).map((p) => [
                        p.number,
                        p.supplier,
                        date(p.date),
                        money(p.total),
                        money(p.paid),
                        <strong>{money(p.total - p.paid)}</strong>,
                      ])}
                    />
                  </section>
                  <section className="panel spaced">
                    <div className="panel-heading">
                      <h2>Cheque register</h2>
                      <span className="muted">
                        Track issued cheques through clearance
                      </span>
                    </div>
                    <Table
                      heads={[
                        "CHEQUE",
                        "SUPPLIER",
                        "DUE DATE",
                        "AMOUNT",
                        "STATUS",
                        "",
                      ]}
                      rows={filtered(data.cheques).map((c) => [
                        c.number,
                        c.supplier,
                        date(c.dueDate),
                        money(c.amount),
                        <Badge>{c.status}</Badge>,
                        rowAction("Update", () => open("Cheque status", c)),
                      ])}
                    />
                  </section>
                </>
              )}
              {page === "Expenses" &&
                (() => {
                  const rows = [...filtered(data.expenses)].sort((a, b) =>
                    b.date.localeCompare(a.date),
                  );
                  const t = today();
                  const month = t.slice(0, 7);
                  const lastMonth = new Date(
                    Date.parse(`${month}-01T00:00:00Z`) - 86400000,
                  )
                    .toISOString()
                    .slice(0, 7);
                  const sum = (list: typeof rows) =>
                    list.reduce((n, e) => n + e.amount, 0);
                  const thisMonth = rows.filter((e) =>
                    e.date.startsWith(month),
                  );
                  const byCategory = Object.entries(
                    thisMonth.reduce<Record<string, number>>((map, e) => {
                      map[e.category] = (map[e.category] || 0) + e.amount;
                      return map;
                    }, {}),
                  ).sort((a, b) => b[1] - a[1]);
                  const top = byCategory[0]?.[1] || 1;
                  return (
                    <>
                      <div className="report-headline expense-headline">
                        <div className="report-tile lead">
                          <span>This month</span>
                          <strong>{money(sum(thisMonth))}</strong>
                          <small>
                            {thisMonth.length} expense
                            {thisMonth.length === 1 ? "" : "s"}
                          </small>
                        </div>
                        <div className="report-tile">
                          <span>Today</span>
                          <strong>
                            {money(sum(rows.filter((e) => e.date === t)))}
                          </strong>
                        </div>
                        <div className="report-tile">
                          <span>Last month</span>
                          <strong>
                            {money(
                              sum(
                                rows.filter((e) =>
                                  e.date.startsWith(lastMonth),
                                ),
                              ),
                            )}
                          </strong>
                        </div>
                      </div>
                      {byCategory.length > 0 && (
                        <section className="panel expense-categories">
                          <div className="panel-heading">
                            <h2>Where it went this month</h2>
                          </div>
                          <ul>
                            {byCategory.map(([category, amount]) => (
                              <li key={category}>
                                <span>{category}</span>
                                <i
                                  style={{
                                    width: `${Math.max(4, Math.round((amount / top) * 100))}%`,
                                  }}
                                />
                                <strong>{money(amount)}</strong>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                      <section className="panel">
                        <Table
                          heads={[
                            "WHAT",
                            "CATEGORY",
                            ...(department === "All departments"
                              ? ["SHOP"]
                              : []),
                            "DATE",
                            "AMOUNT",
                          ]}
                          rows={rows.map((e) => [
                            <strong>{e.description}</strong>,
                            e.category,
                            ...(department === "All departments"
                              ? [e.department]
                              : []),
                            date(e.date),
                            <strong className="tabular">
                              {money(e.amount)}
                            </strong>,
                          ])}
                        />
                      </section>
                    </>
                  );
                })()}
              {page === "COD & delivery" && (
                <>
                  <div className="metrics small-metrics">
                    <Metric
                      label="Awaiting collection"
                      value={money(codPending)}
                      note="Outstanding courier receivables"
                      icon={<Wallet size={18} />}
                    />
                    <Metric
                      label="Postage & charges"
                      value={money(postage)}
                      note="Recorded separately from collections"
                      icon={<Truck size={18} />}
                    />
                    <Metric
                      label="Shipments"
                      value={String(data.shipments.length)}
                      note="All recorded SL Post orders"
                      icon={<Package size={18} />}
                    />
                  </div>
                  <section className="panel">
                    <Table
                      heads={[
                        "ORDER / CUSTOMER",
                        "TRACKING",
                        "COD AMOUNT",
                        "POSTAGE",
                        "STATUS",
                        "",
                      ]}
                      rows={filtered(data.shipments).map((s) => [
                        <div>
                          <strong>{s.orderRef}</strong>
                          <small>{s.customerName}</small>
                        </div>,
                        s.tracking || "Not assigned",
                        money(s.amount),
                        money(s.postage),
                        <Badge>{s.status}</Badge>,
                        rowAction("Update", () => open("Shipment status", s)),
                      ])}
                    />
                  </section>
                  <p className="footnote">
                    Manual SL Post tracking. Trans Express integration is
                    planned for a future release.
                  </p>
                  <ExtensionModules
                    page={page}
                    user={user}
                    data={data}
                    can={can}
                    open={open}
                    action={action}
                    busy={busy}
                    query={query}
                    notify={setToast}
                  />
                </>
              )}
              {page === "Reloads" && (
                <>
                  <div className="notice">
                    <AlertCircle size={17} />
                    Record actual provider amounts. Top-up bonuses remain
                    unearned pending allocation; reload and bill-payment
                    commissions are earned income.
                  </div>
                  <section className="panel">
                    <Table
                      heads={[
                        "PROVIDER",
                        "TRANSACTION",
                        "PHONE / ACCOUNT",
                        "AMOUNT",
                        "COMMISSION",
                        "DATE",
                      ]}
                      rows={filtered(data.reloads).map((r) => [
                        <strong>{r.provider}</strong>,
                        <Badge>{r.type}</Badge>,
                        r.phone,
                        money(r.amount),
                        money(r.commission),
                        date(r.date),
                      ])}
                    />
                  </section>
                </>
              )}
              {page === "Team & payroll" && can("payroll.view") && (
                <>
                  <div className="notice">
                    <Wallet size={17} />
                    Monthly salary plus earned commission, less outstanding
                    advances. Review attendance and the payroll calculation
                    before payment. Attendance does not change pay
                    automatically.
                  </div>
                  <section className="panel">
                    <Table
                      heads={[
                        "TEAM MEMBER",
                        "ROLE",
                        "BASIC SALARY",
                        "ADVANCES",
                        "COMMISSION PAID",
                        "THIS MONTH",
                        "ACTIONS",
                      ]}
                      rows={filtered(data.staff).map((s) => [
                        <div className="customer-cell">
                          <span className="avatar light">
                            {s.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                          <strong>{s.name}</strong>
                        </div>,
                        s.role,
                        money(s.salary),
                        money(s.advances),
                        money(s.paidCommission),
                        (() => {
                          const linked = data.users?.find(
                            (item) => item.staffId === s.id,
                          );
                          if (!linked)
                            return (
                              <span className="muted">No linked login</span>
                            );
                          const records = data.attendance.filter(
                            (item) =>
                              item.userId === linked.id &&
                              item.day.startsWith(today().slice(0, 7)),
                          );
                          const approved = approvedLeaveDays(
                            data.leaveRequests,
                            linked.id,
                            today().slice(0, 7),
                          );
                          return (
                            <span>
                              {records.length} days ·{" "}
                              {
                                records.filter((item) => !item.checkOutAt)
                                  .length
                              }{" "}
                              incomplete · {approved} leave days
                            </span>
                          );
                        })(),
                        <div className="row-buttons">
                          <button
                            disabled={
                              !!actionPermission[modalAction["Edit staff"]] &&
                              !can(actionPermission[modalAction["Edit staff"]])
                            }
                            className="text-button"
                            onClick={() => open("Edit staff", s)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={
                              !!actionPermission[
                                modalAction["Staff advance"]
                              ] &&
                              !can(
                                actionPermission[modalAction["Staff advance"]],
                              )
                            }
                            className="text-button"
                            onClick={() => open("Staff advance", s)}
                          >
                            Advance
                          </button>
                          <button
                            disabled={
                              !!actionPermission[modalAction["Run payroll"]] &&
                              !can(actionPermission[modalAction["Run payroll"]])
                            }
                            className="secondary small"
                            onClick={() => open("Run payroll", s)}
                          >
                            Pay salary
                          </button>
                        </div>,
                      ])}
                    />
                  </section>
                </>
              )}
              {page === "Reports" && (
                <div className="reports-page">
                  <div className="report-period">
                    <div
                      className="report-chips"
                      role="radiogroup"
                      aria-label="Period"
                    >
                      {reportPeriods.map((p) => (
                        <button
                          key={p.label}
                          role="radio"
                          aria-checked={
                            reportFrom === p.from && reportTo === p.to
                          }
                          className={
                            reportFrom === p.from && reportTo === p.to
                              ? "selected"
                              : ""
                          }
                          onClick={() => {
                            setReportFrom(p.from);
                            setReportTo(p.to);
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="report-dates">
                      <label>
                        From
                        <input
                          type="date"
                          value={reportFrom}
                          max={reportTo}
                          onChange={(event) =>
                            setReportFrom(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        To
                        <input
                          type="date"
                          value={reportTo}
                          min={reportFrom}
                          onChange={(event) => setReportTo(event.target.value)}
                        />
                      </label>
                      <button className="secondary" onClick={printReport}>
                        <Printer size={15} /> Print
                      </button>
                      <button className="secondary" onClick={exportReport}>
                        <Download size={15} /> CSV
                      </button>
                    </div>
                  </div>
                  <div className="report-headline">
                    {[
                      {
                        label: "Sales",
                        value: report.netSales,
                        before: priorReport.netSales,
                        note: `${report.transactions} bill${report.transactions === 1 ? "" : "s"} · ${report.units} item${report.units === 1 ? "" : "s"}`,
                        main: true,
                      },
                      {
                        label: "Profit on sales",
                        value: report.grossMargin,
                        before: priorReport.grossMargin,
                        note: "Sales minus what the stock cost",
                      },
                      {
                        label: "Cash collected",
                        value: report.collections,
                        before: priorReport.collections,
                        note: "Paid on these bills",
                      },
                      {
                        label: "Expenses",
                        value: periodExpenses,
                        before: priorExpenses,
                        note: "Recorded in Books › Expenses",
                        lowerIsBetter: true,
                      },
                      {
                        label: "Left after expenses",
                        value: report.grossMargin - periodExpenses,
                        before: priorReport.grossMargin - priorExpenses,
                        note: "Before staff commissions",
                      },
                    ].map((tile) => {
                      const change = percentageChange(tile.value, tile.before);
                      const good =
                        change !== null &&
                        (tile.lowerIsBetter ? change < 0 : change > 0);
                      return (
                        <div
                          key={tile.label}
                          className={`report-tile ${tile.main ? "lead" : ""}`}
                        >
                          <span>{tile.label}</span>
                          <strong>{money(tile.value)}</strong>
                          <small>{tile.note}</small>
                          <em
                            className={
                              change === null || change === 0
                                ? ""
                                : good
                                  ? "up"
                                  : "down"
                            }
                          >
                            {change === null
                              ? "Nothing to compare yet"
                              : change === 0
                                ? "Same as the period before"
                                : `${change > 0 ? "▲" : change < 0 ? "▼" : ""} ${Math.abs(change)}% vs the period before`}
                          </em>
                        </div>
                      );
                    })}
                  </div>
                  <div className="module-toolbar">
                    <div className="department-tabs">
                      {[
                        "Summary",
                        "Products",
                        "Sales",
                        "Journal",
                        "Audit trail",
                      ].map((t) => (
                        <button
                          className={reportTab === t ? "selected" : ""}
                          key={t}
                          onClick={() => setReportTab(t)}
                        >
                          {t === "Products"
                            ? "By product"
                            : t === "Sales"
                              ? "Bills"
                              : t === "Journal"
                                ? "Accounts"
                                : t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {reportTab === "Summary" ? (
                    <div className="report-layout">
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>How the period adds up</h2>
                            <p>
                              {date(reportFrom)} to {date(reportTo)}
                            </p>
                          </div>
                          <BarChart3 size={22} />
                        </div>
                        <div className="report-lines">
                          {[
                            ["Sales", report.invoiceRevenue],
                            ["Returns", -report.returns],
                            ["Sales after returns", report.netSales],
                            ["What the stock cost", -report.cost],
                            ["Profit on sales", report.grossMargin],
                            ["Expenses", -periodExpenses],
                          ].map(([l, v]) => (
                            <div key={l}>
                              <span>{l}</span>
                              <strong>{money(Number(v))}</strong>
                            </div>
                          ))}
                          <div className="report-total">
                            <span>Left after expenses</span>
                            <strong>
                              {money(report.grossMargin - periodExpenses)}
                            </strong>
                          </div>
                        </div>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Right now</h2>
                        </div>
                        <div className="report-lines">
                          <div>
                            <span>Customers owe you</span>
                            <strong>{money(outstanding)}</strong>
                          </div>
                          <div>
                            <span>COD cash still with couriers</span>
                            <strong>{money(codPending)}</strong>
                          </div>
                          <div>
                            <span>Stock on hand, at cost</span>
                            <strong>{money(inventoryValue)}</strong>
                          </div>
                          <div>
                            <span>You owe suppliers</span>
                            <strong>
                              {money(
                                data.purchases.reduce(
                                  (a, p) => a + p.total - p.paid,
                                  0,
                                ),
                              )}
                            </strong>
                          </div>
                        </div>
                        <p className="footnote padded">
                          Money owed to you and stock on the shelf are not
                          profit until they turn into cash.
                        </p>
                      </section>
                    </div>
                  ) : reportTab === "Products" ? (
                    <section className="panel printable-report">
                      <Table
                        heads={[
                          "PRODUCT",
                          "UNITS",
                          "NET SALES",
                          "COST",
                          "MARGIN",
                        ]}
                        rows={reportProducts.map((row) => [
                          row.name,
                          row.units,
                          money(row.revenue),
                          money(row.cost),
                          money(row.margin),
                        ])}
                      />
                    </section>
                  ) : reportTab === "Sales" ? (
                    <section className="panel printable-report">
                      {salesTable(reportSales)}
                    </section>
                  ) : reportTab === "Journal" ? (
                    <section className="panel">
                      <Table
                        heads={[
                          "REFERENCE",
                          "DESCRIPTION / ACCOUNT",
                          "DEBIT",
                          "CREDIT",
                        ]}
                        rows={reportJournal.flatMap((j) =>
                          j.lines.map((l, i) => [
                            i === 0 ? (
                              <div>
                                <strong>{j.reference}</strong>
                                <small>{date(j.date)}</small>
                              </div>
                            ) : (
                              ""
                            ),
                            <div>
                              {i === 0 && <small>{j.description}</small>}
                              <strong>{l.account}</strong>
                            </div>,
                            l.debit ? money(l.debit) : "—",
                            l.credit ? money(l.credit) : "—",
                          ]),
                        )}
                      />
                    </section>
                  ) : (
                    <section className="panel">
                      <Table
                        heads={["TIME", "ACTION", "DETAIL"]}
                        rows={reportAudit.map((a) => [
                          new Date(a.at).toLocaleString("en-GB", {
                            timeZone: "Asia/Colombo",
                          }),
                          a.action,
                          a.detail,
                        ])}
                      />
                    </section>
                  )}
                </div>
              )}
              {page === "Settings" && (
                <>
                  <div className="settings-grid">
                    <form
                      className="panel settings-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await action("updateSettings", {
                          businessName: f.get("businessName"),
                          phone: f.get("phone"),
                          address: f.get("address"),
                          dailyTarget: cents(f.get("dailyTarget")),
                          accessoryPercent: Number(f.get("accessoryPercent")),
                          agentSharePercent: Number(f.get("agentSharePercent")),
                          repairStaffPercent: Number(
                            f.get("repairStaffPercent"),
                          ),
                          inventoryLookbackDays: Number(
                            f.get("inventoryLookbackDays"),
                          ),
                          inventoryTargetDays: Number(
                            f.get("inventoryTargetDays"),
                          ),
                          commissionConfirmed:
                            f.get("commissionConfirmed") === "on",
                          priceTierLabels: Object.fromEntries(
                            PRICE_TIERS.map((tier) => [
                              tier,
                              f.get(`priceTierLabel-${tier}`),
                            ]),
                          ),
                        });
                      }}
                    >
                      <div className="panel-heading">
                        <div>
                          <h2>Business preferences</h2>
                          <p>Details used across your workspace and receipts</p>
                        </div>
                      </div>
                      <div className="form-body">
                        <Field
                          label="Business name"
                          name="businessName"
                          value={data.settings.businessName}
                          required
                        />
                        <div className="form-grid">
                          <Field
                            label="Phone"
                            name="phone"
                            value={data.settings.phone}
                          />
                          <Field
                            label="Daily sales target (Rs.)"
                            name="dailyTarget"
                            type="number"
                            min={0}
                            value={data.settings.dailyTarget / 100}
                          />
                        </div>
                        <Field
                          label="Business address"
                          name="address"
                          value={data.settings.address}
                        />
                        <h3>Pricing categories</h3>
                        <p className="muted">
                          Name the four selling price categories used for
                          products, customers, and sales. Existing prices stay
                          in their categories.
                        </p>
                        <div className="form-grid">
                          {PRICE_TIERS.map((tier) => (
                            <Field
                              key={tier}
                              label={`${tier} category name`}
                              name={`priceTierLabel-${tier}`}
                              value={priceTierLabel(
                                data.settings.priceTierLabels,
                                tier,
                              )}
                              maxLength={40}
                              required
                            />
                          ))}
                        </div>
                        <h3>Inventory planning</h3>
                        <div className="form-grid">
                          <Field
                            label="Sales lookback (days)"
                            name="inventoryLookbackDays"
                            type="number"
                            min={1}
                            value={data.settings.inventoryLookbackDays ?? 30}
                          />
                          <Field
                            label="Target stock cover (days)"
                            name="inventoryTargetDays"
                            type="number"
                            min={1}
                            value={data.settings.inventoryTargetDays ?? 30}
                          />
                        </div>
                        <h3>Commission rules</h3>
                        <p className="muted">
                          Accessory commission is calculated on profit. Agent
                          share is a portion of that single pool. Without an
                          agent, the salesperson receives the entire pool.
                          Confirm this rule with the owner before enabling it.
                        </p>
                        <div className="form-grid">
                          <Field
                            label="Accessory profit commission (%)"
                            name="accessoryPercent"
                            type="number"
                            min={0}
                            step="0.01"
                            value={data.settings.accessoryPercent}
                          />
                          <Field
                            label="Agent share of commission (%)"
                            name="agentSharePercent"
                            type="number"
                            min={0}
                            step="0.01"
                            value={data.settings.agentSharePercent}
                          />
                          <Field
                            label="Repair staff share (%)"
                            name="repairStaffPercent"
                            type="number"
                            min={0}
                            step="0.01"
                            value={data.settings.repairStaffPercent}
                          />
                        </div>
                        <label className="checkbox">
                          <input
                            name="commissionConfirmed"
                            type="checkbox"
                            defaultChecked={data.settings.commissionConfirmed}
                          />
                          Owner has confirmed the accessory commission rule
                        </label>
                        <button className="primary" disabled={busy}>
                          Save preferences
                          <Check size={16} />
                        </button>
                      </div>
                    </form>
                    <div>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Connections & operations</h2>
                        </div>
                        {[
                          [
                            "text.lk SMS",
                            data.settings.smsEnabled &&
                            data.settings.smsApiKeyConfigured
                              ? "Enabled"
                              : "Not connected",
                            "See gateway settings above. Outbox status reflects actual processing results.",
                          ],
                          [
                            "Automated backups",
                            "Not configured",
                            "Configure scheduled encrypted backups and verify restores before live use.",
                          ],
                          [
                            "Trans Express",
                            "Planned",
                            "Use manual SL Post shipment records for now.",
                          ],
                          [
                            "Access management",
                            "Enabled",
                            "Individual accounts, cookie sessions and server-enforced permissions. Manage users in Team & payroll.",
                          ],
                        ].map(([name, status, desc]) => (
                          <div className="integration" key={name}>
                            <div>
                              <strong>{name}</strong>
                              <Badge>{status}</Badge>
                            </div>
                            <p>{desc}</p>
                          </div>
                        ))}
                      </section>
                      <section className="panel spaced">
                        <div className="panel-heading">
                          <h2>SMS outbox</h2>
                          <span className="count">{data.sms.length}</span>
                        </div>
                        <div className="sms-list">
                          {data.sms.slice(0, 5).map((s) => (
                            <div key={s.id}>
                              <strong>{s.phone}</strong>
                              <p>{s.message}</p>
                              <Badge>{s.status}</Badge>
                              {["Failed", "Pending configuration"].includes(
                                s.status,
                              ) && (
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() =>
                                    action("retrySms", { id: s.id })
                                  }
                                >
                                  Retry message
                                </button>
                              )}
                            </div>
                          ))}
                          {!data.sms.length && (
                            <p className="muted">No messages yet.</p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                  <AiSettingsPanel
                    settings={data.settings.ai}
                    action={action}
                    busy={busy}
                  />
                  <div className="settings-secondary">
                    <div className="settings-section-heading">
                      <span>Advanced configuration</span>
                      <p>Imports, gateways and provider-specific rules</p>
                    </div>
                    <ExtensionModules
                      page={page}
                      user={user}
                      data={data}
                      can={can}
                      open={open}
                      action={action}
                      busy={busy}
                      query={query}
                      notify={setToast}
                    />
                  </div>
                </>
              )}
            </>
          )}
          <footer className="footer">
            <span>Fido LK · A little more clarity. Every day.</span>
            <span>LKR · Sri Lanka</span>
          </footer>
        </main>
      </div>
      {receiving && (
        <ReceiveGoods
          products={products}
          batches={data.batches}
          suppliers={data.suppliers}
          shopLabel={
            currentShop.label === "All shops" ? "shop" : currentShop.label
          }
          tierLabels={data.settings.priceTierLabels}
          canScanBill={can("purchasing.manage")}
          busy={busy}
          onToast={setToast}
          onClose={() => setReceiving(false)}
          onReceive={async (payload) => {
            const updated = await action("receiveGoods", payload);
            if (updated) {
              const grn = updated.purchases.at(-1);
              setToast(
                `${grn?.number || "GRN"} saved · ${payload.lines.length} item(s) received into stock.`,
              );
            }
            return !!updated;
          }}
        />
      )}
      {lotPickProduct && (
        <LotPicker
          product={lotPickProduct}
          batches={data.batches}
          inCart={unitsInCartByLot}
          tier={activeTier}
          tierLabels={data.settings.priceTierLabels}
          onAdd={(choices) => addLots(lotPickProduct, choices)}
          onClose={() => {
            setLotPickProduct(null);
            requestAnimationFrame(() => posSearchRef.current?.focus());
          }}
        />
      )}
      {toast && (
        <div
          className={`toast${page === "Point of sale" && cart.length > 0 ? " toast-above-cart" : ""}`}
          role="status"
        >
          <AlertCircle size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            ref={dialogRef}
            className={`modal ${["Repair details", "Repair created", "Product batches"].includes(modal) ? "wide" : ""} ${["Customer details", "Collect customer payment"].includes(modal) ? "customer-wide" : ""} ${modal === "Intake receipt" ? "receipt-modal repair-receipt-modal" : ""} ${modal === "Device label" ? "repair-label-modal" : ""} ${modal === "Product label" ? "product-label-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <div
              className={`modal-header ${["Intake receipt", "Device label", "Product label"].includes(modal) ? "no-print" : ""}`}
            >
              <div>
                <h2>{modalTitles[modal] || modal}</h2>
                {modalHelp[modal] && <p>{modalHelp[modal]}</p>}
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              {extensionModals.includes(modal) && (
                <ExtensionForm
                  key={`${modal}-${selected?.id || "new"}`}
                  modal={modal}
                  selected={selected}
                  data={data}
                  action={action}
                  busy={busy}
                  currentUser={user}
                  close={() => setModal(null)}
                  onExchange={(customerId) => {
                    setSaleCustomerId(customerId);
                    go("Point of sale");
                  }}
                />
              )}
              {modal === "Account security" && (
                <PasswordForm close={() => setModal(null)} notify={setToast} />
              )}
              {[
                "New product",
                "Edit product prices",
                "Edit batch prices",
                "Receive stock",
                "New repair",
                "Add customer",
                "Add expense",
                "Add cheque",
                "New shipment",
                "Record reload",
                "Staff advance",
                "Checkout",
                "Cheque status",
                "Shipment status",
                "Return invoice",
                "Edit staff",
              ].includes(modal) && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    let type = "",
                      p: Record<string, unknown> = {};
                    const str = (k: string) => String(f.get(k) || "");
                    const num = (k: string) => Number(f.get(k) || 0);
                    const amt = (k: string) => cents(f.get(k));
                    if (modal === "Return invoice") {
                      type = "returnSale";
                      p = {
                        saleId: selected.id,
                        disposition: str("disposition"),
                        reason: str("reason"),
                      };
                    }
                    if (modal === "Edit staff") {
                      type = "editStaff";
                      p = {
                        id: selected.id,
                        name: str("name"),
                        salary: amt("salary"),
                      };
                    }
                    if (modal === "New product") {
                      type = "newProduct";
                      p = {
                        name: str("name"),
                        sku: str("sku"),
                        department: str("department"),
                        category: str("category"),
                        price: readPricing(f).Retail,
                        pricing: readPricing(f),
                        cost: amt("cost"),
                        reorderLevel: num("reorderLevel"),
                        serialized: f.get("serialized") === "on",
                      };
                    }
                    if (
                      modal === "Edit product prices" ||
                      modal === "Edit batch prices"
                    ) {
                      type =
                        modal === "Edit product prices"
                          ? "updateProductPricing"
                          : "updateBatchPricing";
                      p = { id: selected.id, pricing: readPricing(f) };
                    }
                    if (modal === "New repair") {
                      type = "createRepair";
                      p = {
                        customerName: str("customerName"),
                        phone: str("phone"),
                        device: str("device"),
                        imei: str("imei"),
                        issue: str("issue"),
                        condition: str("condition"),
                        notes: str("notes"),
                        accessories: f.getAll("accessories"),
                        estimate: amt("estimate"),
                        parts: repairParts,
                        deviceAccessSecret:
                          str("deviceAccessSecret") || undefined,
                        technicianStaffId:
                          str("technicianStaffId") || undefined,
                        staffPercent: num("staffPercent"),
                        warrantyDays: num("warrantyDays"),
                      };
                    }
                    if (modal === "Add customer") {
                      type = "createCustomer";
                      p = {
                        name: str("name"),
                        phone: str("phone"),
                        address: str("address"),
                        priceTier: str("priceTier"),
                      };
                    }
                    if (modal === "Add expense") {
                      type = "addExpense";
                      p = {
                        description: str("description"),
                        category: str("category"),
                        department: str("department"),
                        amount: amt("amount"),
                        date: str("date"),
                      };
                    }
                    if (modal === "Add cheque") {
                      type = "addCheque";
                      p = {
                        number: str("number"),
                        supplier: str("supplier"),
                        amount: amt("amount"),
                        dueDate: str("dueDate"),
                        ...(str("purchaseId")
                          ? { purchaseId: str("purchaseId") }
                          : {}),
                      };
                    }
                    if (modal === "New shipment") {
                      type = "addShipment";
                      p = {
                        orderRef: str("orderRef"),
                        customerName: str("customerName"),
                        tracking: str("tracking"),
                        amount: amt("amount"),
                        postage: amt("postage"),
                        courier: str("courier"),
                      };
                    }
                    if (modal === "Record reload") {
                      type = "addReload";
                      p = {
                        provider: str("provider"),
                        type: str("type"),
                        phone: str("phone"),
                        amount: amt("amount"),
                        commission: amt("commission"),
                      };
                    }
                    if (modal === "Staff advance") {
                      type = "staffAdvance";
                      p = { id: selected.id, amount: amt("amount") };
                    }
                    if (modal === "Cheque status") {
                      type = "chequeStatus";
                      p = { id: selected.id, status: str("status") };
                    }
                    if (modal === "Shipment status") {
                      type = "shipmentStatus";
                      p = { id: selected.id, status: str("status") };
                    }
                    if (modal === "Checkout") {
                      type = "createSale";
                      // What the customer hands over covers the old balance first.
                      const forSale = amt("paid") - duesOnBill - reloadsOnBill;
                      if (
                        (duesOnBill || reloadsOnBill) &&
                        str("method") === "Credit"
                      ) {
                        setToast(
                          "Old balances and reloads are paid now. Choose how, or take them off this bill.",
                        );
                        return;
                      }
                      if (forSale < 0) {
                        setToast(
                          `Collect at least ${money(duesOnBill + reloadsOnBill)} for the old balance and reloads.`,
                        );
                        return;
                      }
                      p = {
                        customerId: saleCustomerId,
                        overrideReason: checkoutReason,
                        items: cart,
                        quoteSignature: cartQuote
                          ? quoteSignature(cartQuote)
                          : undefined,
                        discount: amt("discount"),
                        paid:
                          str("method") === "Cash"
                            ? Math.min(
                                forSale,
                                Math.max(0, cartTotal - amt("storeCreditUsed")),
                              )
                            : forSale,
                        storeCreditUsed: amt("storeCreditUsed"),
                        method: str("method"),
                        agentId: str("agentId") || undefined,
                        dueDate: str("dueDate") || undefined,
                        duesPayment: duesOnBill || undefined,
                        reloads: billReloads.length ? billReloads : undefined,
                      };
                      if (cartPricingError) {
                        setToast(cartPricingError);
                        return;
                      }
                      if (
                        str("method") !== "Cash" &&
                        forSale + amt("storeCreditUsed") > cartTotal
                      ) {
                        setToast(
                          "Payment exceeds the sale total after discount.",
                        );
                        return;
                      }
                    }
                    const previousRepairIds =
                      type === "createRepair"
                        ? new Set(data.repairs.map((repair) => repair.id))
                        : null;
                    const previousProductIds =
                      type === "newProduct"
                        ? new Set(data.products.map((product) => product.id))
                        : null;
                    const previousCustomerIds =
                      type === "createCustomer"
                        ? new Set(data.customers.map((customer) => customer.id))
                        : null;
                    const updated = await action(type, p);
                    if (
                      updated &&
                      type === "createCustomer" &&
                      previousCustomerIds &&
                      selected?.selectAfterCreate
                    ) {
                      const created = updated.customers.find(
                        (customer) => !previousCustomerIds.has(customer.id),
                      );
                      if (created) setSaleCustomerId(created.id);
                    }
                    if (updated && type === "createSale") {
                      const created = updated.sales.find(
                        (s) => !data.sales.some((old) => old.id === s.id),
                      );
                      if (created) setReceipt(created);
                      setCart([]);
                      setSaleCustomerId("cust-walkin");
                      setBillTier(null);
                      setPayDuesOnBill(false);
                      setBillReloads([]);
                    }
                    if (
                      updated &&
                      type === "newProduct" &&
                      previousProductIds
                    ) {
                      const created = updated.products.find(
                        (product) => !previousProductIds.has(product.id),
                      );
                      if (created) {
                        setSelected(created);
                        setProductLabelQuantity(1);
                        setModal("Product label");
                      }
                    }
                    if (
                      updated &&
                      type === "createRepair" &&
                      previousRepairIds
                    ) {
                      const created = updated.repairs.find(
                        (repair) => !previousRepairIds.has(repair.id),
                      );
                      if (created) {
                        setToast("");
                        setSelected(created);
                        setModal("Repair created");
                      }
                    }
                  }}
                >
                  {(modal === "Edit product prices" ||
                    modal === "Edit batch prices") && (
                    <>
                      <p className="footnote">
                        {modal === "Edit batch prices"
                          ? `Batch ${selected.lot}. Changes apply to future sales only.`
                          : "Default prices for new stock receipts. Existing batches keep their prices."}
                      </p>
                      <PricingFields
                        labels={data.settings.priceTierLabels}
                        pricing={
                          modal === "Edit batch prices"
                            ? getPricing(
                                data.products.find(
                                  (p) => p.id === selected.productId,
                                )!,
                                selected,
                              )
                            : getPricing(selected)
                        }
                      />
                    </>
                  )}
                  {modal === "New product" && (
                    <>
                      <Field label="Product name" name="name" required />
                      <div className="form-grid">
                        <Field label="SKU / barcode" name="sku" required />
                        <Field
                          label="Shop"
                          name="department"
                          value={
                            department === "All departments"
                              ? "Phones"
                              : department
                          }
                        >
                          {["Phones", "Clothing", "Gifts"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </Field>
                        <Field label="Category" name="category" required />
                        <Field
                          label="Reorder level"
                          name="reorderLevel"
                          type="number"
                          min={0}
                          value={5}
                        />

                        <Field
                          label="Reference cost (Rs.)"
                          name="cost"
                          type="number"
                          min={0}
                          step="0.01"
                          required
                        />
                      </div>
                      <PricingFields labels={data.settings.priceTierLabels} />
                      <label className="checkbox">
                        <input type="checkbox" name="serialized" />
                        Track individual units by IMEI / serial number
                      </label>
                      <p className="footnote">
                        Receive stock separately to create a costed batch.
                      </p>
                    </>
                  )}
                  {modal === "New repair" && (
                    <>
                      <div className="form-grid">
                        <Field
                          label="Customer name"
                          name="customerName"
                          required
                        />
                        <Field
                          label="Customer phone"
                          name="phone"
                          type="tel"
                          required
                        />
                        <Field label="Device / model" name="device" required />
                        <Field label="IMEI / serial (optional)" name="imei" />
                      </div>
                      <Field label="Reported fault" name="issue" required />
                      <Field
                        label="Device condition"
                        name="condition"
                        required
                      />
                      <label className="field">
                        <span>Items received</span>
                        <div className="checks">
                          {[
                            "SIM card",
                            "Second SIM",
                            "SD card",
                            "Back cover",
                            "Charger",
                          ].map((a) => (
                            <label className="checkbox" key={a}>
                              <input
                                type="checkbox"
                                name="accessories"
                                value={a}
                              />
                              {a}
                            </label>
                          ))}
                        </div>
                      </label>
                      <Field
                        label="Additional notes (no device credentials)"
                        name="notes"
                      />
                      <Field
                        label="Assigned service staff / technician"
                        name="technicianStaffId"
                        required
                      >
                        <option value="">Choose staff member</option>
                        {data.staff.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} · {staff.role}
                          </option>
                        ))}
                      </Field>
                      <DeviceSecretInput />
                      <p className="footnote">
                        Enter a PIN/password or draw the same unlock pattern
                        used on the device. Access details are encrypted on the
                        server, visible only to authorized repair staff, and
                        cleared on collection. Never put device credentials in
                        ordinary notes.
                      </p>
                      <div className="form-grid">
                        <Field
                          label="Estimated charge (Rs.)"
                          name="estimate"
                          type="number"
                          min={0}
                          step="0.01"
                          required
                        />
                        <PartsEditor
                          products={data.products}
                          value={repairParts}
                          onChange={setRepairParts}
                        />
                        <Field
                          label="Staff share of profit (%)"
                          name="staffPercent"
                          type="number"
                          min={0}
                          step="0.01"
                          value={data.settings.repairStaffPercent}
                        />
                        <Field
                          label="Warranty days"
                          name="warrantyDays"
                          type="number"
                          min={0}
                          value={0}
                        />
                      </div>
                      <p className="footnote">
                        Customer approval is required before work begins. SMS
                        will remain pending until text.lk is connected.
                      </p>
                    </>
                  )}
                  {modal === "Add customer" && (
                    <>
                      <Field
                        label="Preferred price tier"
                        name="priceTier"
                        value="Retail"
                      >
                        {PRICE_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {priceTierLabel(
                              data.settings.priceTierLabels,
                              tier,
                            )}
                          </option>
                        ))}
                      </Field>
                      <Field
                        label="Customer name"
                        name="name"
                        value={selected?.initialName || ""}
                        required
                      />
                      <Field
                        label="Phone number"
                        name="phone"
                        type="tel"
                        value={selected?.initialPhone || ""}
                        required
                      />
                      <Field
                        label="Address (optional)"
                        name="address"
                        value=""
                      />
                    </>
                  )}
                  {modal === "Add expense" && (
                    <>
                      <Field label="Description" name="description" required />
                      <div className="form-grid">
                        <Field label="Category" name="category">
                          {[
                            "Rent",
                            "Utilities",
                            "Supplies",
                            "Transport",
                            "Salaries",
                            "Other",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </Field>
                        <Field
                          label="Shop"
                          name="department"
                          value={
                            department === "All departments"
                              ? "General"
                              : department
                          }
                        >
                          {["General", "Phones", "Clothing", "Gifts"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </Field>
                        <Field
                          label="Amount (Rs.)"
                          name="amount"
                          type="number"
                          min={0.01}
                          step="0.01"
                          required
                        />
                        <Field
                          label="Date"
                          name="date"
                          type="date"
                          value={today()}
                          required
                        />
                      </div>
                    </>
                  )}
                  {modal === "Add cheque" && (
                    <>
                      <div className="form-grid">
                        <Field label="Cheque number" name="number" required />
                        <Field label="Supplier" name="supplier" required />
                        <Field
                          label="Amount (Rs.)"
                          name="amount"
                          type="number"
                          min={0.01}
                          step="0.01"
                          required
                        />
                        <Field
                          label="Cheque date"
                          name="dueDate"
                          type="date"
                          required
                        />
                      </div>
                      <Field
                        label="Linked goods receipt (optional)"
                        name="purchaseId"
                      >
                        <option value="">No linked purchase</option>
                        {data.purchases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.number} · {p.supplier} ·{" "}
                            {money(p.total - p.paid)}
                          </option>
                        ))}
                      </Field>
                    </>
                  )}
                  {modal === "New shipment" && (
                    <>
                      <Field
                        label="Order / invoice reference"
                        name="orderRef"
                        required
                      />
                      <Field
                        label="Customer name"
                        name="customerName"
                        required
                      />
                      <Field
                        label="Courier"
                        name="courier"
                        value="SL Post"
                        required
                      />
                      <Field label="Tracking number" name="tracking" />
                      <div className="form-grid">
                        <Field
                          label="COD amount to collect (Rs.)"
                          name="amount"
                          type="number"
                          min={0.01}
                          step="0.01"
                          required
                        />
                        <Field
                          label="Postage paid (Rs.)"
                          name="postage"
                          type="number"
                          min={0}
                          step="0.01"
                          value={0}
                        />
                      </div>
                      <p className="footnote">
                        Use an existing unpaid invoice number. COD amount must
                        equal its outstanding balance. Collection settles that
                        invoice; shipment creation does not create revenue.
                      </p>
                    </>
                  )}
                  {modal === "Record reload" && (
                    <>
                      <div className="form-grid">
                        <Field label="Provider" name="provider">
                          {[
                            "Mobitel",
                            "Dialog",
                            "Hutch",
                            "Airtel",
                            "Other",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </Field>
                        <Field label="Transaction type" name="type">
                          {["Reload", "Bill payment", "Top-up"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </Field>
                      </div>
                      <Field
                        label="Phone / account reference"
                        name="phone"
                        required
                      />
                      <div className="form-grid">
                        <Field
                          label="Amount (Rs.)"
                          name="amount"
                          type="number"
                          min={0.01}
                          step="0.01"
                          required
                        />
                        <Field
                          label="Actual earned commission (Rs.)"
                          name="commission"
                          type="number"
                          min={0}
                          step="0.01"
                          value={0}
                        />
                      </div>
                      <p className="footnote">
                        For top-ups, the commission field records a wallet bonus
                        held pending allocation, not earned profit. Provider
                        rules still require confirmation.
                      </p>
                    </>
                  )}
                  {modal === "Return invoice" && (
                    <>
                      <div className="notice">
                        This returns the entire invoice {selected.number}.
                        Reverse payments of {money(selected.paid)} and cancel
                        the remaining credit of {money(saleBalance(selected))}.
                        Any store credit used on this invoice is restored to the
                        customer. Earned commissions are reversed.
                      </div>
                      <Field
                        label="Returned stock destination"
                        name="disposition"
                      >
                        <option>Restock</option>
                        <option>Supplier return</option>
                        <option>Waste</option>
                      </Field>
                      <Field label="Return reason" name="reason" required />
                      <p className="footnote">
                        For an exchange, complete this return and create a new
                        sale. Use Return items for a partial return or store
                        credit.
                      </p>
                    </>
                  )}
                  {modal === "Edit staff" && (
                    <>
                      <Field
                        label="Staff name"
                        name="name"
                        value={selected.name}
                        required
                      />
                      <Field
                        label="Monthly basic salary (Rs.)"
                        name="salary"
                        type="number"
                        min={0}
                        step="0.01"
                        value={selected.salary / 100}
                        required
                      />
                    </>
                  )}
                  {modal === "Staff advance" && (
                    <>
                      <p>
                        Record a salary advance for{" "}
                        <strong>{selected.name}</strong>.
                      </p>
                      <Field
                        label="Advance amount (Rs.)"
                        name="amount"
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                      />
                    </>
                  )}
                  {modal === "Cheque status" && (
                    <>
                      <p>
                        {selected.number} · {money(selected.amount)}
                      </p>
                      <Field
                        label="Status"
                        name="status"
                        value={selected.status}
                      >
                        {[
                          "Issued",
                          "Presented",
                          "Cleared",
                          "Dishonoured",
                          "Cancelled",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </Field>
                    </>
                  )}
                  {modal === "Shipment status" && (
                    <>
                      <p>
                        {selected.orderRef} · {selected.tracking}
                      </p>
                      <Field
                        label="Status"
                        name="status"
                        value={selected.status}
                      >
                        {[
                          "Packed",
                          "Shipped",
                          "Delivered",
                          "Collected",
                          "Returned",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </Field>
                      <p className="footnote">
                        Choose Collected only when the full COD amount has been
                        collected from SL Post.
                      </p>
                    </>
                  )}
                  {modal === "Checkout" && (
                    <>
                      {(() => {
                        const customer = data.customers.find(
                          (c) => c.id === saleCustomerId,
                        );
                        const walkIn = saleCustomerId === "cust-walkin";
                        const storeCredit = customer?.storeCredit || 0;
                        const due = Math.max(
                          0,
                          collectTotal - cents(checkoutStoreCredit),
                        );
                        const tendered =
                          checkoutPaid === null ? due : cents(checkoutPaid);
                        const change =
                          checkoutMethod === "Cash" ? tendered - due : 0;
                        const short = due - tendered;
                        const onCredit =
                          checkoutMethod === "Credit" ||
                          (checkoutMethod !== "Cash" && short > 0) ||
                          (checkoutMethod === "Cash" && short > 0);
                        const methods = [
                          ["Cash", "Cash"],
                          ["Card", "Card"],
                          ["Bank transfer", "Transfer"],
                          ["Credit", "On credit"],
                        ] as const;
                        return (
                          <div className="pay">
                            <div className="pay-total">
                              <span>
                                {duesOnBill || reloadsOnBill
                                  ? "Total to collect"
                                  : "Total"}
                              </span>
                              <strong>
                                {cartPricingError
                                  ? "Review pricing"
                                  : money(due)}
                              </strong>
                              <small>
                                {customer && !walkIn
                                  ? `${customer.name} · ${priceTierLabel(data.settings.priceTierLabels, activeTier)}`
                                  : "Walk-in customer"}
                                {duesOnBill > 0 &&
                                  ` · includes old balance ${money(duesOnBill)}`}
                                {reloadsOnBill > 0 &&
                                  ` · includes reloads ${money(reloadsOnBill)}`}
                                {cents(checkoutStoreCredit) > 0 &&
                                  ` · store credit −${money(cents(checkoutStoreCredit))}`}
                              </small>
                            </div>

                            <input
                              type="hidden"
                              name="method"
                              value={checkoutMethod}
                            />
                            <div
                              className="pay-methods"
                              role="radiogroup"
                              aria-label="How are they paying?"
                            >
                              {methods.map(([value, label]) => {
                                const blocked = value === "Credit" && walkIn;
                                return (
                                  <button
                                    type="button"
                                    role="radio"
                                    key={value}
                                    aria-checked={checkoutMethod === value}
                                    className={
                                      checkoutMethod === value ? "selected" : ""
                                    }
                                    disabled={blocked}
                                    title={
                                      blocked
                                        ? "Pick a named customer in the cart to sell on credit"
                                        : undefined
                                    }
                                    onClick={() => {
                                      setCheckoutMethod(value);
                                      setCheckoutPaid(
                                        value === "Credit" ? "0" : null,
                                      );
                                    }}
                                  >
                                    {value === "Cash" ? (
                                      <Banknote size={22} />
                                    ) : value === "Credit" ? (
                                      <Users size={22} />
                                    ) : (
                                      <CreditCard size={22} />
                                    )}
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                            {walkIn && (
                              <small className="pay-hint">
                                On credit needs a named customer — add one in
                                the cart.
                              </small>
                            )}

                            <label className="pay-amount">
                              <span>
                                {checkoutMethod === "Cash"
                                  ? "Cash received"
                                  : checkoutMethod === "Credit"
                                    ? "Paying now (part payment)"
                                    : "Amount received"}
                              </span>
                              <span className="pay-input">
                                <em>Rs.</em>
                                <input
                                  name="paid"
                                  inputMode="decimal"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    checkoutPaid ??
                                    (cartPricingError ? "" : due / 100)
                                  }
                                  onChange={(e) =>
                                    setCheckoutPaid(e.target.value)
                                  }
                                  onFocus={(e) => e.currentTarget.select()}
                                />
                              </span>
                            </label>
                            {checkoutMethod === "Cash" && (
                              <div className="pay-quick">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCheckoutPaid(String(due / 100))
                                  }
                                >
                                  Exact
                                </button>
                                {[500, 1000, 2000, 5000, 10000, 20000]
                                  .filter((d) => d * 100 > due)
                                  .slice(0, 4)
                                  .map((note) => (
                                    <button
                                      key={note}
                                      type="button"
                                      onClick={() =>
                                        setCheckoutPaid(String(note))
                                      }
                                    >
                                      {note.toLocaleString()}
                                    </button>
                                  ))}
                              </div>
                            )}
                            {checkoutMethod === "Cash" && change > 0 && (
                              <div className="pay-change" role="status">
                                <span>Give change</span>
                                <strong>{money(change)}</strong>
                              </div>
                            )}
                            {onCredit && short > 0 && walkIn && (
                              <p className="pay-warn" role="alert">
                                A walk-in customer pays in full. Collect{" "}
                                {money(short)} more, or add the customer in the
                                cart to leave a balance.
                              </p>
                            )}
                            {onCredit && short > 0 && !walkIn && (
                              <div className="pay-credit" role="status">
                                <div>
                                  <span>
                                    Goes on {customer?.name || "account"}
                                  </span>
                                  <strong>{money(short)}</strong>
                                </div>
                                <label>
                                  <span>Pay by</span>
                                  <input
                                    name="dueDate"
                                    type="date"
                                    defaultValue={futureDay(30)}
                                    required
                                  />
                                </label>
                              </div>
                            )}

                            {cartPricingError && (
                              <p className="pricing-error" role="alert">
                                {cartPricingError}
                              </p>
                            )}

                            <details className="pay-more">
                              <summary>
                                More options
                                <small>
                                  discount
                                  {storeCredit > 0 && !walkIn
                                    ? ", store credit"
                                    : ""}
                                  , agent, items
                                </small>
                              </summary>
                              <div className="pay-more-body">
                                <label className="field">
                                  <span>Discount on the whole bill (Rs.)</span>
                                  <input
                                    name="discount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!can("sales.discount")}
                                    value={checkoutDiscount}
                                    onChange={(e) => {
                                      setCheckoutDiscount(e.target.value);
                                      setCheckoutPaid(null);
                                    }}
                                  />
                                </label>
                                {can("sales.priceOverride") && (
                                  <label className="field">
                                    <span>
                                      Reason, if the discount breaks a price
                                      limit
                                    </span>
                                    <input
                                      value={checkoutReason}
                                      onChange={(e) =>
                                        setCheckoutReason(e.target.value)
                                      }
                                    />
                                  </label>
                                )}
                                {!walkIn && storeCredit > 0 && (
                                  <label className="field">
                                    <span>
                                      Use store credit (has {money(storeCredit)}
                                      )
                                    </span>
                                    <input
                                      name="storeCreditUsed"
                                      type="number"
                                      min="0"
                                      max={
                                        Math.min(cartTotal, storeCredit) / 100
                                      }
                                      step="0.01"
                                      value={checkoutStoreCredit}
                                      onChange={(event) => {
                                        setCheckoutStoreCredit(
                                          event.target.value,
                                        );
                                        setCheckoutPaid(null);
                                      }}
                                    />
                                  </label>
                                )}
                                <Field
                                  label="Referred by an agent?"
                                  name="agentId"
                                >
                                  <option value="">No agent</option>
                                  {(data.agents || [])
                                    .filter((a) => a.active)
                                    .map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name} · {a.defaultSharePercent}% of
                                        the commission pool
                                      </option>
                                    ))}
                                </Field>
                                <ul className="pay-lines">
                                  {cartQuote?.lines.map((l, i) => (
                                    <li key={i}>
                                      <span>
                                        {l.name}
                                        <small>
                                          Lot {l.lot} ·{" "}
                                          {priceTierLabel(
                                            data.settings.priceTierLabels,
                                            l.priceTier || "Retail",
                                          )}{" "}
                                          · {l.quantity} × {money(l.price)}
                                        </small>
                                      </span>
                                      <strong>
                                        {money(l.total ?? l.price * l.quantity)}
                                      </strong>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </details>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className={`primary ${modal === "Checkout" ? "pay-complete" : ""}`}
                      disabled={
                        busy || (modal === "Checkout" && !!cartPricingError)
                      }
                    >
                      {busy
                        ? "Saving…"
                        : modal === "Checkout"
                          ? `Complete sale · ${money(Math.max(0, collectTotal - cents(checkoutStoreCredit)))}`
                          : modalSubmit[modal] || "Save"}
                      <Check size={16} />
                    </button>
                  </div>
                </form>
              )}
              {modal === "Select IMEI" && (
                <>
                  <p>
                    Select the exact unit being sold or scan its IMEI barcode
                    directly.
                  </p>
                  <div className="imei-list">
                    {data.batches
                      .filter((b) => b.productId === selected.id)
                      .flatMap((b) =>
                        b.imeis.map((i) => ({ imei: i, lot: b.lot })),
                      )
                      .filter((x) => !cart.some((c) => c.imei === x.imei))
                      .map((x) => (
                        <button
                          className="secondary"
                          key={x.imei}
                          onClick={() => {
                            setCart((prev) => [
                              ...prev,
                              {
                                productId: selected.id,
                                quantity: 1,
                                imei: x.imei,
                              },
                            ]);
                            setModal(null);
                          }}
                        >
                          <span>
                            {x.imei}
                            <small>{x.lot}</small>
                          </span>
                          <Plus size={16} />
                        </button>
                      ))}
                  </div>
                </>
              )}
              {modal === "Product batches" &&
                (() => {
                  const product =
                    data.products.find((p) => p.id === selected.id) || selected;
                  const all = data.batches
                    .filter((b) => b.productId === product.id)
                    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
                  const inStock = all.filter((b) => b.remaining > 0);
                  const soldOut = all.filter((b) => b.remaining <= 0);
                  const lotCard = (b: (typeof all)[number]) => {
                    const pricing = getPricing(product, b);
                    return (
                      <article className="lot-card" key={b.id}>
                        <div className="lot-card-head">
                          <span className="lot-no">{b.lot}</span>
                          <span>
                            Received {date(b.receivedAt)}
                            {b.supplier ? ` · ${b.supplier}` : ""}
                          </span>
                          {can("purchasing.manage") && (
                            <button
                              className="text-button"
                              onClick={() => open("Edit batch prices", b)}
                            >
                              Edit prices
                            </button>
                          )}
                        </div>
                        <div className="lot-card-left">
                          <strong>{b.remaining}</strong>
                          <span>of {b.quantity} left</span>
                          <div className="lot-bar">
                            <i
                              style={{
                                width: `${Math.round((b.remaining / Math.max(1, b.quantity)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <dl className="lot-prices">
                          <div>
                            <dt>Cost</dt>
                            <dd>{money(b.unitCost)}</dd>
                          </div>
                          {PRICE_TIERS.map((tier) => (
                            <div key={tier}>
                              <dt>
                                {priceTierLabel(
                                  data.settings.priceTierLabels,
                                  tier,
                                )}
                              </dt>
                              <dd>
                                {pricing[tier] === undefined
                                  ? "—"
                                  : money(pricing[tier]!)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    );
                  };
                  return (
                    <>
                      <div className="lots-head">
                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {product.stock} in stock across {inStock.length} lot
                            {inStock.length === 1 ? "" : "s"} · the cashier
                            picks the lot at each sale
                          </small>
                        </div>
                        {can("inventory.manage") && (
                          <button
                            className="secondary small"
                            onClick={() => open("Edit product prices", product)}
                          >
                            Default prices
                          </button>
                        )}
                      </div>
                      <div className="lot-list">
                        {inStock.map(lotCard)}
                        {!inStock.length && (
                          <p className="empty">
                            No lots in stock. Receive a delivery to add one.
                          </p>
                        )}
                      </div>
                      {soldOut.length > 0 && (
                        <details className="pay-more">
                          <summary>
                            Sold-out lots <small>{soldOut.length}</small>
                          </summary>
                          <div className="pay-more-body lot-list">
                            {soldOut.map(lotCard)}
                          </div>
                        </details>
                      )}
                      <div className="modal-footer">
                        <button
                          disabled={!can("purchasing.manage")}
                          className="primary"
                          onClick={() => open("Receive stock", product)}
                        >
                          <Plus size={16} />
                          Receive a delivery
                        </button>
                      </div>
                    </>
                  );
                })()}
              {modal === "Repair details" && (
                <>
                  <RepairDetails
                    repair={
                      data.repairs.find((r) => r.id === selected.id) || selected
                    }
                    action={action}
                    busy={busy}
                    can={can}
                    open={open}
                    openDocument={(name, repair) =>
                      openRepairDocument(name, repair)
                    }
                  />
                  {can("repairs.manage") && (
                    <div className="modal-footer portal-link-actions">
                      <button
                        className="secondary"
                        disabled={busy || mode !== "database"}
                        onClick={() =>
                          createRepairPortalLink(
                            data.repairs.find(
                              (repair) => repair.id === selected.id,
                            ) || selected,
                          )
                        }
                      >
                        Create secure customer link
                      </button>
                      {mode !== "database" && (
                        <small>
                          Portal links are available in the database workspace.
                        </small>
                      )}
                    </div>
                  )}
                </>
              )}
              {modal === "Repair created" && selected && (
                <RepairCreated
                  repair={selected}
                  onLabel={() =>
                    openRepairDocument(
                      "Device label",
                      selected,
                      "Repair created",
                    )
                  }
                  onReceipt={() =>
                    openRepairDocument(
                      "Intake receipt",
                      selected,
                      "Repair created",
                    )
                  }
                  onWhatsApp={() => shareRepairOnWhatsApp(selected)}
                  onOpen={() => open("Repair details", selected)}
                  onAnother={() => open("New repair")}
                  onDone={() => setModal(null)}
                />
              )}
              {modal === "Intake receipt" && selected && (
                <RepairIntakeReceipt
                  repair={selected}
                  settings={data.settings}
                  onPrint={() => printRepairDocument("receipt")}
                  onWhatsApp={() => shareRepairOnWhatsApp(selected)}
                  onClose={() => setModal(repairDocumentBack)}
                />
              )}
              {modal === "Device label" && selected && (
                <RepairLabel
                  repair={selected}
                  settings={data.settings}
                  height={labelHeight}
                  setHeight={setLabelHeight}
                  detailed={labelDetailed}
                  setDetailed={setLabelDetailed}
                  onPrint={() => printRepairDocument("label")}
                  onClose={() => setModal(repairDocumentBack)}
                />
              )}
              {modal === "Product label" && selected && (
                <ProductLabel
                  product={selected}
                  settings={data.settings}
                  price={money(selected.price)}
                  height={productLabelHeight}
                  setHeight={setProductLabelHeight}
                  quantity={productLabelQuantity}
                  setQuantity={setProductLabelQuantity}
                  onPrint={printProductLabels}
                  onClose={() => setModal(null)}
                />
              )}
              {modal === "Customer details" && (
                <CustomerProfile
                  customer={selected}
                  priceTierLabels={data.settings.priceTierLabels}
                  sales={data.sales}
                  shipments={data.shipments}
                  canCollect={can("sales.manage")}
                  onCollect={() => open("Collect customer payment", selected)}
                  onStartSale={() => {
                    setSaleCustomerId(selected.id);
                    go("Point of sale");
                    setModal(null);
                  }}
                />
              )}
              {modal === "Collect customer payment" && (
                <CustomerPaymentForm
                  customer={selected}
                  sales={data.sales}
                  shipments={data.shipments}
                  busy={busy}
                  onSubmit={async (amount, method) => {
                    await action("collectCustomerPayment", {
                      customerId: selected.id,
                      amount,
                      method,
                    });
                  }}
                />
              )}
              {modal === "Collect payment" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await action("collectPayment", {
                      saleId: selected.id,
                      amount: cents(f.get("amount")),
                      method: f.get("method"),
                    });
                  }}
                >
                  <p>
                    {selected.number} · Balance{" "}
                    {money(selected.total - selected.paid)}
                  </p>
                  <Field
                    label="Payment amount (Rs.)"
                    name="amount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={(selected.total - selected.paid) / 100}
                    required
                  />
                  <Field label="Payment method" name="method">
                    {["Cash", "Card", "Bank transfer"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Field>
                  <div className="modal-footer">
                    <button className="primary" disabled={busy}>
                      Record payment
                    </button>
                  </div>
                </form>
              )}
              {modal === "Run payroll" && (
                <>
                  <p>
                    Pay the current payroll for <strong>{selected.name}</strong>
                    ?
                  </p>
                  <div className="report-lines">
                    <div>
                      <span>Basic salary</span>
                      <strong>{money(selected.salary)}</strong>
                    </div>
                    <div>
                      <span>Outstanding advances</span>
                      <strong>{money(selected.advances)}</strong>
                    </div>
                  </div>
                  <div className="notice">
                    Commission adjustment:{" "}
                    {money(
                      selected.id === "staff-1"
                        ? Math.max(
                            -selected.salary,
                            data.sales.reduce((a, s) => a + s.commission, 0) +
                              data.repairs.reduce(
                                (a, r) => a + r.commission,
                                0,
                              ) -
                              selected.paidCommission,
                          )
                        : 0,
                    )}
                    . Advances are recovered up to gross pay. One payroll
                    payment is permitted per calendar month.
                  </div>
                  <div className="modal-footer">
                    <button
                      className="secondary"
                      onClick={() => setModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => action("payroll", { id: selected.id })}
                    >
                      Confirm payroll
                    </button>
                  </div>
                </>
              )}
              {modal === "Notifications" && (
                <>
                  <div className="notification-list">
                    {data.notifications.map((n) => (
                      <article key={n.id} className={!n.read ? "unread" : ""}>
                        <Bell size={18} />
                        <div>
                          <strong>{n.title}</strong>
                          <p>{n.detail}</p>
                          <small>
                            {new Date(n.createdAt).toLocaleString("en-GB", {
                              timeZone: "Asia/Colombo",
                            })}
                          </small>
                          {n.title === "Leave approval needed" &&
                            can("users.manage") && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setModal(null);
                                  go("Attendance & leave");
                                }}
                              >
                                Review request
                              </button>
                            )}
                        </div>
                      </article>
                    ))}
                    {!data.notifications.length && (
                      <div className="empty">You’re all caught up.</div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => action("readNotifications", {})}
                    >
                      Mark all read
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {receipt && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal receipt-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sales receipt"
          >
            <div className="modal-header no-print">
              <h2>Sale receipt</h2>
              <button
                className="icon-button"
                aria-label="Close receipt"
                onClick={() => setReceipt(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="receipt-paper">
              <h2>{data.settings.businessName}</h2>
              <p>
                {data.settings.address}
                <br />
                {data.settings.phone}
              </p>
              <hr />
              <p>
                {receipt.number}
                {receipt.status === "Returned" && (
                  <>
                    <br />
                    RETURNED — historical invoice
                  </>
                )}
                <br />
                {new Date(receipt.createdAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Colombo",
                })}
                <br />
                {receipt.customerName}
              </p>
              <hr />
              {receipt.lines.map((l, i) => (
                <div className="receipt-line" key={i}>
                  <span>
                    {l.name}
                    <small>
                      {l.quantity} × {money(l.price)} {l.imei && `· ${l.imei}`}
                    </small>
                    {l.priceTier && (
                      <small>
                        {priceTierLabel(
                          data.settings.priceTierLabels,
                          l.priceTier,
                        )}{" "}
                        · {l.lot || ""} · Tier{" "}
                        {money(l.originalPrice ?? l.price)}
                        {l.unitDiscount
                          ? ` · Discount ${money(l.unitDiscount)}/unit`
                          : ""}
                      </small>
                    )}
                  </span>
                  <strong>{money(l.price * l.quantity)}</strong>
                </div>
              ))}
              <hr />
              <div className="receipt-line">
                <span>Invoice discount</span>
                <span>{money(receipt.discount)}</span>
              </div>
              <div className="receipt-line total">
                <strong>Total</strong>
                <strong>{money(receipt.total)}</strong>
              </div>
              <div className="receipt-line">
                <span>Paid</span>
                <span>{money(receipt.paid)}</span>
              </div>
              {(receipt.payments || []).map((payment, index) => (
                <div className="receipt-line" key={index}>
                  <span>{payment.method}</span>
                  <span>{money(payment.amount)}</span>
                </div>
              ))}
              <div className="receipt-line">
                <span>Balance</span>
                <span>{money(saleBalance(receipt))}</span>
              </div>
              {receipt.dueDate && saleBalance(receipt) > 0 && (
                <div className="receipt-line">
                  <span>Due date</span>
                  <span>{receipt.dueDate}</span>
                </div>
              )}
              {(receipt.returnedTotal || 0) > 0 && (
                <div className="receipt-line">
                  <span>Returned value</span>
                  <span>{money(receipt.returnedTotal || 0)}</span>
                </div>
              )}
              {data.returns
                .filter((item) => item.saleId === receipt.id)
                .map((item) => (
                  <div className="receipt-line" key={item.id}>
                    <span>
                      Return · {item.resolution}
                      <small>
                        {item.items
                          .map(
                            (line) =>
                              `${line.quantity} × ${receipt.lines[line.lineIndex]?.name || "Item"} (${line.disposition})`,
                          )
                          .join(", ")}
                      </small>
                    </span>
                    <span>{money(item.total)}</span>
                  </div>
                ))}
              <hr />
              <p>Thank you for shopping with Fido LK.</p>
              {mode === "demo" && <p>DEMO RECEIPT</p>}
            </div>
            <div className="modal-footer no-print receipt-actions">
              <div className="receipt-main">
                <button
                  className="primary"
                  onClick={async () => {
                    // Use the thermal printer when one is paired; otherwise the
                    // normal print dialog.
                    if (!isDirectPrintSupported()) {
                      window.print();
                      return;
                    }
                    const escposData = formatReceiptEscPos(
                      receipt,
                      {
                        businessName: data.settings.businessName,
                        address: data.settings.address,
                        phone: data.settings.phone,
                      },
                      { isDemo: mode === "demo" },
                    );
                    const res = await printEscPosDirect(escposData);
                    if (res.success) {
                      setToast("Receipt sent to the receipt printer.");
                      return;
                    }
                    const paired = await requestAndSaveSerialPrinter();
                    if (paired) {
                      const retry = await printEscPosDirect(escposData);
                      if (retry.success) {
                        setToast("Printer paired and receipt printed.");
                        return;
                      }
                    }
                    window.print();
                  }}
                >
                  <Printer size={18} />
                  Print receipt
                </button>
                {(() => {
                  const customer = data.customers.find(
                    (c) => c.id === receipt.customerId,
                  );
                  const phone = customer?.phone;
                  if (!phone) return null;
                  return (
                    <button
                      className="secondary"
                      onClick={() => {
                        const res = getWhatsAppReceiptUrl(receipt, phone, {
                          businessName: data.settings.businessName,
                          phone: data.settings.phone,
                        });
                        if (res) {
                          window.open(res.url, "_blank", "noopener,noreferrer");
                        } else {
                          setToast("No valid phone number for WhatsApp.");
                        }
                      }}
                    >
                      <Share2 size={16} />
                      WhatsApp
                    </button>
                  );
                })()}
                <button className="secondary" onClick={() => setReceipt(null)}>
                  Done
                </button>
              </div>
              {receipt.status !== "Returned" && can("sales.manage") && (
                <div className="receipt-returns">
                  <span>Customer bringing it back?</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      open("Return items", receipt);
                      setReceipt(null);
                    }}
                  >
                    Return some items
                  </button>
                  <button
                    className="text-button"
                    disabled={(receipt.returnedTotal || 0) > 0}
                    onClick={() => {
                      open("Return invoice", receipt);
                      setReceipt(null);
                    }}
                  >
                    Return the whole bill
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`metric ${accent ? "accent" : ""}`}>
      <div>
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>
        {accent && <span className="tiny-dot" />}
        {note}
      </p>
    </section>
  );
}
function ProductIcon({ product }: { product: Product }) {
  return product.serialized || /phone|display/i.test(product.category) ? (
    <Smartphone />
  ) : product.department === "Clothing" ? (
    <ShoppingBag />
  ) : product.department === "Gifts" ? (
    <Package />
  ) : (
    <Boxes />
  );
}
function SalesChart({ sales }: { sales: Sale[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const key = businessDay(d);
    return {
      label: d.toLocaleDateString("en-GB", {
        weekday: "short",
        timeZone: "Asia/Colombo",
      }),
      value: sales
        .filter(
          (s) => businessDay(s.createdAt) === key && s.status !== "Returned",
        )
        .reduce((a, s) => a + s.total, 0),
    };
  });
  const max = Math.max(...days.map((d) => d.value), 100000);
  const points = days
    .map((d, i) => `${48 + i * 89},${164 - (d.value / max) * 128}`)
    .join(" ");
  return (
    <div className="chart">
      {days.every((day) => day.value === 0) && (
        <p className="chart-empty">No sales in the last seven days</p>
      )}
      <div className="chart-y">
        {[1, 0.5, 0].map((x) => (
          <span key={x}>
            {Math.round((max * x) / 100).toLocaleString("en-GB")}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 620 194"
        role="img"
        aria-label="Sales totals over the last seven days"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ad5b43" stopOpacity=".14" />
            <stop offset="100%" stopColor="#ad5b43" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[36, 100, 164].map((y) => (
          <line
            key={y}
            x1="35"
            x2="603"
            y1={y}
            y2={y}
            stroke="#e9ddd1"
            strokeDasharray="4 4"
          />
        ))}
        <polygon points={`48,164 ${points} 582,164`} fill="url(#chartFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#ad5b43"
          strokeWidth="2.7"
          strokeLinejoin="round"
        />
        {days.map((d, i) => (
          <circle
            key={i}
            cx={48 + i * 89}
            cy={164 - (d.value / max) * 128}
            r={i === 6 ? 4.5 : 3}
            fill={i === 6 ? "#ad5b43" : "white"}
            stroke="#ad5b43"
            strokeWidth="2"
          >
            <title>
              {d.label}: {money(d.value)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-x">
        {days.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
function RepairDetails({
  repair: r,
  action,
  busy,
  can,
  open,
  openDocument,
}: {
  can: (p: string) => boolean;
  open: (m: string, s?: any) => void;
  openDocument: (
    name: "Intake receipt" | "Device label",
    repair: Repair,
  ) => void;
  repair: Repair;
  action: (t: string, p: Record<string, unknown>) => Promise<Workspace | null>;
  busy: boolean;
}) {
  const [credential, setCredential] = useState("");
  const [credentialError, setCredentialError] = useState("");
  useEffect(() => {
    setCredential("");
    setCredentialError("");
  }, [r.id]);
  useEffect(() => {
    if (!credential) return;
    const t = setTimeout(() => setCredential(""), 30000);
    return () => clearTimeout(t);
  }, [credential]);
  const next: Record<string, string> = {
    Received: "Diagnosing",
    Diagnosing: "Awaiting approval",
    "Awaiting approval": "Approved",
    Approved: "In progress",
    "In progress": "Ready for collection",
    "Ready for collection": "Collected",
  };
  return (
    <>
      <div className="repair-detail-title">
        <span className="repair-ticket-no">{r.number}</span>
        <div>
          <h3>{r.device}</h3>
          <p>
            {r.customerName} · {r.phone}
          </p>
        </div>
        <Badge>{r.status}</Badge>
        {can("repairs.manage") &&
          next[r.status] &&
          r.status !== "Awaiting approval" && (
            <button
              className="primary next-step"
              disabled={busy}
              onClick={() =>
                action("repairStatus", { id: r.id, status: next[r.status] })
              }
            >
              {r.status === "Ready for collection"
                ? "Hand over"
                : `Mark ${next[r.status].toLowerCase()}`}
              <ArrowRight size={16} />
            </button>
          )}
      </div>
      <div className="detail-grid">
        {[
          ["Reported fault", r.issue],
          ["Condition", r.condition],
          ["IMEI / serial", r.imei || "Not recorded"],
          ["Items received", r.accessories.join(", ") || "None recorded"],
          ["Notes", r.notes || "—"],
          ["Warranty", `${r.warrantyDays} days`],
        ].map(([l, v]) => (
          <div key={l}>
            <small>{l}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="repair-extra-actions">
        <button
          className="secondary"
          onClick={() => openDocument("Device label", r)}
        >
          <Printer size={15} /> Print label
        </button>
        <button
          className="secondary"
          onClick={() => openDocument("Intake receipt", r)}
        >
          <Receipt size={15} /> Intake receipt
        </button>
        {r.status === "Awaiting approval" && can("repairs.manage") && (
          <button
            className="secondary"
            onClick={() => open("Revise estimate", r)}
          >
            Revise estimate & parts
          </button>
        )}
        {r.completedAt && can("repairs.manage") && (
          <button
            className="secondary"
            onClick={() => open("Warranty claim", r)}
          >
            Record warranty claim
          </button>
        )}
      </div>
      {r.parts?.length ? (
        <section className="panel">
          <Table
            heads={["PART", "QUANTITY", "COST"]}
            rows={r.parts.map((p) => [
              p.name,
              p.quantity,
              money(p.actualCost ?? p.estimatedUnitCost * p.quantity),
            ])}
          />
        </section>
      ) : null}
      <div className="credential-box">
        <strong>Device access</strong>
        <p>
          {r.hasCredential
            ? "An encrypted access secret is stored for this repair."
            : "No device access secret stored."}
        </p>
        {r.hasCredential && can("repairs.credentials") && (
          <div className="row-buttons">
            <button
              className="secondary small"
              onClick={async () => {
                setCredentialError("");
                try {
                  const res = await fetch("/api/repair-credential", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ repairId: r.id }),
                  });
                  const value = await res.json();
                  if (!res.ok)
                    throw Error(value.error || "Could not reveal credential.");
                  setCredential(value.credential);
                } catch (e) {
                  setCredentialError((e as Error).message);
                }
              }}
            >
              Reveal for 30 seconds
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setCredential("");
                await action("clearRepairCredential", { id: r.id });
              }}
            >
              Clear permanently
            </button>
          </div>
        )}
        {credential && (
          <div className="revealed-secret" role="status">
            {credential.startsWith("Pattern:") ? (
              <ReadonlyPattern value={credential} />
            ) : (
              <span>{credential}</span>
            )}
            <button onClick={() => setCredential("")}>Hide</button>
          </div>
        )}
        {credentialError && <p role="alert">{credentialError}</p>}
      </div>
      {!!r.warrantyClaims?.length && (
        <section className="panel">
          <Table
            heads={["WARRANTY ISSUE", "STATUS", "DATE"]}
            rows={r.warrantyClaims.map((c) => [
              c.issue,
              <Badge>{c.status}</Badge>,
              date(c.createdAt),
            ])}
          />
        </section>
      )}
      <div className="repair-financials">
        <span>
          Estimate<strong>{money(r.estimate)}</strong>
        </span>
        <span>
          Parts cost<strong>{money(r.partsCost)}</strong>
        </span>
        <span>
          Staff share<strong>{r.staffPercent}%</strong>
        </span>
        <span>
          Balance<strong>{money(r.estimate - r.paid)}</strong>
        </span>
      </div>
      {can("repairs.manage") && r.status === "Awaiting approval" && (
        <form
          className="repair-approval"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action("repairStatus", {
              id: r.id,
              status: next[r.status],
              ...(r.status === "Awaiting approval"
                ? { approvalMethod: f.get("approvalMethod") }
                : {}),
            });
          }}
        >
          {r.status === "Awaiting approval" && (
            <>
              <Field
                label="Customer approval method"
                name="approvalMethod"
                required
              >
                <option value="">Select confirmed approval method</option>
                <option>In person</option>
                <option>Phone call</option>
                <option>Written message</option>
              </Field>
              <p className="footnote">
                Record approval only after the customer accepts this estimate.
              </p>
            </>
          )}
          <div className="modal-footer">
            {r.status === "Awaiting approval" && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() =>
                  action("repairStatus", { id: r.id, status: "Declined" })
                }
              >
                Mark declined
              </button>
            )}
            <button className="primary" disabled={busy}>
              Mark {next[r.status]}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
      {can("repairs.manage") && r.completedAt && r.estimate > r.paid && (
        <form
          className="repair-payment"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action("repairPayment", {
              id: r.id,
              amount: cents(f.get("amount")),
            });
          }}
        >
          <Field
            label="Collect repair payment (Rs.)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            value={(r.estimate - r.paid) / 100}
          />
          <button className="secondary" disabled={busy}>
            Record payment
          </button>
        </form>
      )}
      <p className="footnote">
        Status messages are queued in the SMS outbox. Delivery requires a
        configured gateway.
      </p>
    </>
  );
}

const extensionModals = [
  "Create purchase order",
  "Receive purchase order",
  "Add supplier",
  "Supplier payment",
  "Supplier return",
  "Settle supplier return",
  "Add agent",
  "Pay commission",
  "Create user",
  "Edit user",
  "New arrival alert",
  "Collect COD batch",
  "Provider rule",
  "Configure SMS",
  "Revise estimate",
  "Warranty claim",
  "Return items",
];
type ExtensionProps = {
  user: SessionUser | null;
  page: string;
  data: Workspace;
  can: (p: string) => boolean;
  open: (m: string, s?: any) => void;
  action: (t: string, p: Record<string, unknown>) => Promise<Workspace | null>;
  busy: boolean;
  query: string;
  notify: (s: string) => void;
};
function supplierBalance(data: Workspace, s: any) {
  return (
    s.openingBalance +
    data.purchases
      .filter((p) => p.supplier.toLowerCase() === s.name.toLowerCase())
      .reduce((a, p) => a + p.total - p.paid, 0) -
    s.paid -
    (data.supplierReturns || [])
      .filter(
        (r) =>
          r.supplierId === s.id &&
          r.status === "Settled" &&
          r.resolution === "Credit note",
      )
      .reduce((a, r) => a + r.amount, 0)
  );
}
function earnedCommission(data: Workspace, type: string, id: string) {
  return type === "Agent"
    ? data.sales
        .filter((s) => s.agentId === id)
        .reduce((a, s) => a + s.agentCommission, 0)
    : data.sales
        .filter((s) => (s.staffId || "staff-1") === id)
        .reduce((a, s) => a + s.commission, 0) +
        data.repairs
          .filter((r) => (r.technicianStaffId || "staff-1") === id)
          .reduce((a, r) => a + r.commission, 0);
}
function ExtensionModules({
  user,
  page,
  data,
  can,
  open,
  action,
  busy,
  query,
  notify,
}: ExtensionProps) {
  const filter = <T,>(rows: T[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  const wallet = (provider: string) =>
    data.journal
      .flatMap((j) => j.lines)
      .filter((l) => l.account === `Provider wallet: ${provider}`)
      .reduce((a, l) => a + l.debit - l.credit, 0);
  const actionButton = (
    title: string,
    modal: string,
    row?: any,
    permission = "purchasing.manage",
  ) =>
    can(permission) ? (
      <button className="secondary small" onClick={() => open(modal, row)}>
        {title}
      </button>
    ) : null;
  if (page === "Purchases") {
    const purchaseOrders = data.purchaseOrders || [];
    const purchaseCounts = {
      Ordered: purchaseOrders.filter((po) => po.status === "Ordered").length,
      "Partially received": purchaseOrders.filter(
        (po) => po.status === "Partially received",
      ).length,
      Received: purchaseOrders.filter((po) => po.status === "Received").length,
    };
    return (
      <div className="purchase-order-workspace">
        <section
          className="purchase-status-strip"
          aria-label="Purchase order status summary"
        >
          {Object.entries(purchaseCounts).map(([status, count]) => (
            <div
              className={`purchase-status-count status-${status.toLowerCase().replaceAll(" ", "-")}`}
              key={status}
            >
              <span>{status}</span>
              <strong>{count}</strong>
              <small>
                {count === 1 ? "purchase order" : "purchase orders"}
              </small>
            </div>
          ))}
        </section>
        <section className="panel spaced-bottom">
          <div className="panel-heading">
            <div>
              <h2>Purchase orders</h2>
              <p>Order first, receive in full or in separate deliveries</p>
            </div>
            {actionButton("Create purchase order", "Create purchase order")}
          </div>
          <Table
            heads={[
              "PURCHASE ORDER / SUPPLIER",
              "ORDERED / RECEIVED",
              "TOTAL",
              "DUE",
              "STATUS",
              "",
            ]}
            rows={purchaseOrders
              .slice()
              .reverse()
              .map((po) => {
                const ordered = po.lines.reduce((a, l) => a + l.ordered, 0);
                const received = po.lines.reduce((a, l) => a + l.received, 0);
                const percent = ordered
                  ? Math.round((received / ordered) * 100)
                  : 0;
                return [
                  <div>
                    <strong>{po.number}</strong>
                    <small>{po.supplierName}</small>
                  </div>,
                  <div className="purchase-progress">
                    <div>
                      <strong>{received}</strong>
                      <span> of {ordered} units</span>
                      <small>{percent}% received</small>
                    </div>
                    <progress
                      max={ordered || 1}
                      value={received}
                      aria-label={`${po.number}: ${received} of ${ordered} units received`}
                    />
                  </div>,
                  money(po.total),
                  date(po.dueDate),
                  <Badge>{po.status}</Badge>,
                  ["Ordered", "Partially received"].includes(po.status)
                    ? actionButton(
                        "Receive goods",
                        "Receive purchase order",
                        po,
                      )
                    : "—",
                ];
              })}
          />
        </section>
      </div>
    );
  }
  if (page === "Suppliers")
    return (
      <div className="extension-stack">
        <section className="panel">
          <Table
            heads={[
              "SUPPLIER",
              "CONTACT",
              "CREDIT TERMS",
              "BALANCE",
              "ACTIONS",
            ]}
            rows={filter(data.suppliers || []).map((s) => [
              <div>
                <strong>{s.name}</strong>
                <small>{s.address || "Address not recorded"}</small>
              </div>,
              s.phone,
              `${s.creditDays} days`,
              money(supplierBalance(data, s)),
              <div className="row-buttons">
                {actionButton("Pay", "Supplier payment", s)}
                {actionButton("Return stock", "Supplier return", s)}
              </div>,
            ])}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Supplier returns</h2>
            <span className="muted">
              Awaiting credit, replacement or refund
            </span>
          </div>
          <Table
            heads={[
              "SUPPLIER / ITEM",
              "QUANTITY",
              "VALUE",
              "RESOLUTION",
              "STATUS",
              "",
            ]}
            rows={filter(data.supplierReturns || []).map((r) => [
              <div>
                <strong>{r.productName}</strong>
                <small>{r.supplierName}</small>
              </div>,
              r.quantity,
              money(r.amount),
              r.resolution,
              <Badge>{r.status}</Badge>,
              r.status === "Pending"
                ? actionButton("Settle", "Settle supplier return", r)
                : date(r.settledAt || r.createdAt),
            ])}
          />
        </section>
        <p className="footnote">
          Receive goods and track issued cheques in Purchases. Supplier payments
          settle balances separately from receiving stock.
        </p>
      </div>
    );
  if (page === "Agents & commissions") {
    const payees = [
      ...(data.agents || []).map((a) => ({ ...a, type: "Agent" })),
      ...data.staff.map((s) => ({ ...s, type: "Staff" })),
    ];
    return (
      <div className="extension-stack">
        <div className="notice">
          <Wallet size={18} />
          Accessory commission uses a profit-based pool. The selected agent
          receives their configured share; the salesperson receives the
          remainder. Owner confirmation is required.
        </div>
        <section className="panel">
          <Table
            heads={["PAYEE", "TYPE", "EARNED", "PAID", "OUTSTANDING", ""]}
            rows={filter(payees).map((p) => {
              const earned = earnedCommission(data, p.type, p.id);
              return [
                <strong>{p.name}</strong>,
                p.type,
                money(earned),
                money(p.paidCommission),
                money(earned - p.paidCommission),
                actionButton(
                  "Pay commission",
                  "Pay commission",
                  { ...p, earned },
                  "payroll.manage",
                ),
              ];
            })}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Commission payments</h2>
          </div>
          <Table
            heads={["PAYEE", "TYPE", "AMOUNT", "METHOD", "DATE"]}
            rows={(data.commissionSettlements || [])
              .slice()
              .reverse()
              .map((s) => [
                s.payeeName,
                s.payeeType,
                money(s.amount),
                s.method,
                date(s.createdAt),
              ])}
          />
        </section>
      </div>
    );
  }
  if (page === "Alerts")
    return (
      <BusAlertWorkspace
        alerts={filter(data.alerts || [])}
        sms={data.sms}
        user={user!}
        canManage={can("alerts.manage")}
        busy={busy}
        pushControl={<PushEnableButton notify={notify} />}
        onNew={() => open("New arrival alert")}
        onAcknowledge={(id) => action("acknowledgeAlert", { id })}
        onEscalate={(id) => action("escalateAlert", { id })}
        onCollect={(id, actualAmountPaid, collectionNote) =>
          action("collectAlert", { id, actualAmountPaid, collectionNote })
        }
      />
    );
  if (page === "Team & payroll" && can("users.manage"))
    return (
      <>
        <section className="panel spaced-bottom">
          <div className="panel-heading">
            <div>
              <h2>Users & access</h2>
              <p>
                Create separate logins. Choose Sales & service or Cashier, then
                customize permissions below.
              </p>
              <p>Individual accounts with explicit permissions</p>
            </div>
            <button className="primary" onClick={() => open("Create user")}>
              <Plus size={15} />
              Create user
            </button>
          </div>
          <Table
            heads={["NAME", "USERNAME", "ROLE", "STATUS", ""]}
            rows={((data as any).users || []).map((u: any) => [
              u.name,
              u.username,
              u.role,
              <Badge>{u.active ? "Active" : "Inactive"}</Badge>,
              <button
                className="text-button"
                onClick={() => open("Edit user", u)}
              >
                Manage access
                <ChevronRight size={14} />
              </button>,
            ])}
          />
        </section>
        <SecurityEventsPanel />
      </>
    );
  if (page === "COD & delivery")
    return (
      <section className="panel spaced-bottom">
        <div className="panel-heading">
          <div>
            <h2>COD settlement batches</h2>
            <p>Reconcile the amount collected, fees and every shipment</p>
          </div>
          {actionButton(
            "Collect batch",
            "Collect COD batch",
            null,
            "cod.manage",
          )}
        </div>
        <Table
          heads={[
            "REFERENCE",
            "EXPECTED",
            "RECEIVED",
            "FEES",
            "DIFFERENCE",
            "DATE",
          ]}
          rows={(data.codSettlements || [])
            .slice()
            .reverse()
            .map((s) => [
              s.reference,
              money(s.expected),
              money(s.received),
              money(s.fees),
              <span className={s.difference ? "low-stock" : ""}>
                {money(s.difference)}
              </span>,
              date(s.createdAt),
            ])}
        />
      </section>
    );
  if (page === "Reloads")
    return (
      <div className="wallet-grid">
        {[
          ...new Set([
            ...data.reloads.map((r) => r.provider),
            ...(data.settings.providerRules || []).map((r) => r.provider),
          ]),
        ].map((p) => (
          <section className="panel wallet-card" key={p}>
            <Smartphone size={20} />
            <span>
              {p}
              <strong>{money(wallet(p))}</strong>
              <small>Recorded provider wallet balance</small>
            </span>
          </section>
        ))}
      </div>
    );
  if (page === "Settings")
    return (
      <div className="settings-extensions">
        <CsvImportPanel notify={notify} />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>SMS gateway · text.lk</h2>
              <p>API key is encrypted and write-only</p>
            </div>
            <button className="secondary" onClick={() => open("Configure SMS")}>
              Configure
            </button>
          </div>
          <div className="integration">
            <Badge>
              {data.settings.smsEnabled && data.settings.smsApiKeyConfigured
                ? "Enabled"
                : "Not connected"}
            </Badge>
            <p>
              Sender: {data.settings.smsSenderId || "Not set"} · Key:{" "}
              {data.settings.smsApiKeyConfigured
                ? "Configured"
                : "Not configured"}
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Provider rules</h2>
              <p>Suggested calculations; actual commission must be verified</p>
            </div>
            <button className="secondary" onClick={() => open("Provider rule")}>
              Add rule
            </button>
          </div>
          <Table
            heads={[
              "PROVIDER",
              "TOP-UP BONUS",
              "TRANSACTION",
              "RECOGNITION",
              "",
            ]}
            rows={(data.settings.providerRules || []).map((r) => [
              r.provider,
              `${r.topupBonusPercent}%`,
              `${r.transactionCommissionPercent}%`,
              r.recognition,
              <button
                className="text-button"
                onClick={() => open("Provider rule", r)}
              >
                Edit
              </button>,
            ])}
          />
        </section>
      </div>
    );
  if (page === "Reports") {
    const debit = (account: string) =>
      data.journal
        .flatMap((j) => j.lines)
        .filter((l) => l.account === account)
        .reduce((a, l) => a + l.debit - l.credit, 0);
    const unpaid = data.sales.filter(
      (s) => s.status !== "Returned" && s.total > s.paid,
    );
    const buckets = [
      { label: "0–30 days", min: 0, max: 30 },
      { label: "31–60 days", min: 31, max: 60 },
      { label: "61–90 days", min: 61, max: 90 },
      { label: "Over 90 days", min: 91, max: Infinity },
    ];
    const recognized =
      data.sales
        .filter((s) => s.status !== "Returned")
        .reduce((a, s) => a + Math.max(0, s.total - s.cost), 0) +
      data.repairs
        .filter((r) => !!r.completedAt)
        .reduce((a, r) => a + Math.max(0, r.estimate - r.partsCost), 0);
    const realized =
      data.sales
        .filter((s) => s.status !== "Returned")
        .reduce(
          (a, s) =>
            a +
            (s.total
              ? Math.round(
                  (Math.max(0, s.total - s.cost) * Math.min(s.paid, s.total)) /
                    s.total,
                )
              : 0),
          0,
        ) +
      data.repairs
        .filter((r) => !!r.completedAt)
        .reduce(
          (a, r) =>
            a +
            (r.estimate
              ? Math.round(
                  (Math.max(0, r.estimate - r.partsCost) *
                    Math.min(r.paid, r.estimate)) /
                    r.estimate,
                )
              : 0),
          0,
        );
    return (
      <>
        <h2 className="report-section-title">All time</h2>
        <div className="metrics small-metrics">
          <Metric
            label="Profit earned"
            value={money(recognized)}
            note="All sales and finished repairs, before expenses"
            icon={<BarChart3 size={18} />}
          />
          <Metric
            label="Already in cash"
            value={money(realized)}
            note="The part of that profit customers have paid"
            icon={<Banknote size={18} />}
          />
          <Metric
            label="Still owed to you"
            value={money(recognized - realized)}
            note="Profit sitting in unpaid balances"
            icon={<Wallet size={18} />}
          />
        </div>
        <details className="panel reporting-details">
          <summary>
            Who owes what, and for how long <ChevronDown size={16} />
          </summary>
          <div className="report-layout">
            <section>
              <h3>Customer invoice aging</h3>
              <Table
                heads={["AGE", "OUTSTANDING"]}
                rows={buckets.map((b) => [
                  b.label,
                  money(
                    unpaid
                      .filter((s) => {
                        const age = Math.floor(
                          (Date.now() - Date.parse(s.createdAt)) / 86400000,
                        );
                        return age >= b.min && age <= b.max;
                      })
                      .reduce((a, s) => a + s.total - s.paid, 0),
                  ),
                ])}
              />
              <p className="footnote padded">
                Based on invoice age. Includes unsettled COD invoices; repair
                balances are shown in the ledger.
              </p>
            </section>
            <section>
              <h3>Liabilities & stock adjustments</h3>
              <Table
                heads={["ACCOUNT", "BALANCE"]}
                rows={[
                  "Staff commission payable",
                  "Agent commission payable",
                  "Accounts payable",
                  "Courier receivable",
                  "Stock loss expense",
                  "Stock pending supplier return",
                  "Supplier return receivable",
                ].map((a) => [
                  a,
                  money(/payable/.test(a) ? -debit(a) : debit(a)),
                ])}
              />
            </section>
          </div>
          <div className="report-layout">
            <section>
              <h3>Supplier balances</h3>
              <Table
                heads={["SUPPLIER", "PAYABLE"]}
                rows={(data.suppliers || []).map((s) => [
                  s.name,
                  money(supplierBalance(data, s)),
                ])}
              />
            </section>
            <section>
              <h3>Provider wallet balances</h3>
              <Table
                heads={["PROVIDER", "BALANCE"]}
                rows={[...new Set(data.reloads.map((r) => r.provider))].map(
                  (p) => [p, money(wallet(p))],
                )}
              />
            </section>
          </div>
          <section>
            <h3>COD reconciliation</h3>
            <Table
              heads={[
                "REFERENCE",
                "EXPECTED",
                "RECEIVED",
                "FEES",
                "DIFFERENCE",
              ]}
              rows={(data.codSettlements || []).map((s) => [
                s.reference,
                money(s.expected),
                money(s.received),
                money(s.fees),
                money(s.difference),
              ])}
            />
          </section>
        </details>
      </>
    );
  }
  return null;
}
const permissionLabels: Record<string, string> = {
  "dashboard.view": "Overview",
  "sales.view": "View sales",
  "sales.manage": "Create sales, payments & returns",
  "sales.priceTier": "Select wholesale, VIP & agent prices",
  "sales.discount": "Apply sale discounts",
  "sales.priceOverride": "Override sale prices & limits (reason required)",
  "inventory.view": "View inventory",
  "inventory.manage": "Manage products",
  "inventory.count": "Submit stock counts",
  "inventory.approve": "Approve stock variances",
  "repairs.view": "View repairs",
  "repairs.manage": "Manage repairs",
  "repairs.credentials": "Reveal device credentials",
  "customers.view": "View customers",
  "customers.manage": "Manage customers",
  "purchasing.view": "View suppliers & purchases",
  "purchasing.manage": "Manage purchases & suppliers",
  "expenses.view": "View expenses",
  "expenses.manage": "Manage expenses",
  "cod.view": "View COD",
  "cod.manage": "Manage COD & collections",
  "reloads.view": "View reloads",
  "reloads.manage": "Record reloads",
  "payroll.view": "View payroll & commissions",
  "payroll.manage": "Pay salary & commissions",
  "reports.view": "View financial reports",
  "settings.manage": "Manage settings & integrations",
  "users.manage": "Manage users & permissions",
  "alerts.view": "View & acknowledge alerts",
  "alerts.manage": "Manage & escalate alerts",
};
const presets: Record<string, string[]> = {
  Owner: ["*"],
  Manager: Object.keys(permissionLabels).filter(
    (p) =>
      p !== "users.manage" &&
      p !== "repairs.credentials" &&
      p !== "sales.priceOverride",
  ),
  "Sales & service": [
    "dashboard.view",
    "sales.view",
    "sales.manage",
    "sales.priceTier",
    "sales.discount",
    "inventory.view",
    "repairs.view",
    "repairs.manage",
    "customers.view",
    "customers.manage",
    "alerts.view",
  ],
  Cashier: [
    "dashboard.view",
    "sales.view",
    "sales.manage",
    "sales.priceTier",
    "sales.discount",
    "inventory.view",
    "customers.view",
    "customers.manage",
    "reloads.view",
    "reloads.manage",
    "cod.view",
    "alerts.view",
  ],
};
function PartsEditor({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: { productId: string; quantity: number }[];
  onChange: (v: { productId: string; quantity: number }[]) => void;
}) {
  return (
    <div className="parts-editor">
      <label className="field">
        <span>Spare parts</span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange([...value, { productId: e.target.value, quantity: 1 }]);
          }}
        >
          <option value="">Add a stocked spare part…</option>
          {products
            .filter(
              (p) =>
                !p.serialized &&
                p.stock > 0 &&
                !value.some((v) => v.productId === p.id),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.stock} available · {money(p.cost)}
              </option>
            ))}
        </select>
      </label>
      {value.map((v, i) => {
        const p = products.find((p) => p.id === v.productId);
        return (
          <div className="part-row" key={v.productId}>
            <span>
              <strong>{p?.name || v.productId}</strong>
              <small>{money((p?.cost || 0) * v.quantity)} estimated cost</small>
            </span>
            <label>
              <span className="sr-only">Quantity for {p?.name}</span>
              <input
                type="number"
                min={1}
                max={p?.stock || 9999}
                value={v.quantity}
                onChange={(e) =>
                  onChange(
                    value.map((p, j) =>
                      i === j ? { ...p, quantity: Number(e.target.value) } : p,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${p?.name}`}
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <p className="footnote">
        Leave empty for service-only work. Stock is consumed and actual batch
        cost applied when the repair is completed.
      </p>
    </div>
  );
}
function ExtensionForm({
  modal,
  selected,
  data,
  action,
  busy,
  currentUser,
  close,
  onExchange,
}: {
  modal: string;
  selected: any;
  data: Workspace;
  action: ExtensionProps["action"];
  busy: boolean;
  currentUser: SessionUser | null;
  close: () => void;
  onExchange?: (customerId: string) => void;
}) {
  const [permissions, setPermissions] = useState<string[]>(
    selected?.permissions || presets["Sales & service"],
  );
  const [role, setRole] = useState(selected?.role || "Sales & service");
  const [poLines, setPoLines] = useState<
    { productId: string; quantity: number; unitCost: number }[]
  >(
    selected?.plannerLines?.length
      ? selected.plannerLines.map(
          (line: {
            productId: string;
            quantity: number;
            unitCost: number;
          }) => ({ ...line, unitCost: line.unitCost / 100 }),
        )
      : [{ productId: "", quantity: 1, unitCost: 0 }],
  );
  const [receiptLines, setReceiptLines] = useState<
    { lineIndex: number; quantity: number; lot: string; imeis: string }[]
  >(
    (selected?.lines || []).map((l: any, i: number) => ({
      lineIndex: i,
      quantity: Math.max(0, l.ordered - l.received),
      lot: "",
      imeis: "",
    })),
  );
  const [poDiscount, setPoDiscount] = useState("0");
  const [parts, setParts] = useState<{ productId: string; quantity: number }[]>(
    selected?.parts || [],
  );
  const [productId, setProductId] = useState("");
  const [shipmentIds, setShipmentIds] = useState<string[]>([]);
  const [received, setReceived] = useState("");
  const [fees, setFees] = useState("0");
  const [returnLines, setReturnLines] = useState<
    Record<number, { quantity: number; disposition: string }>
  >({});
  const [formError, setFormError] = useState("");
  const supplierOptions = (data.suppliers || []).map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));
  const paymentOptions = ["Cash", "Bank transfer", "Card"].map((s) => (
    <option key={s}>{s}</option>
  ));
  const eligible = data.shipments.filter(
    (s) => s.status === "Delivered" && !s.settlementId,
  );
  const expected = eligible
    .filter((s) => shipmentIds.includes(s.id))
    .reduce((a, s) => a + s.amount - s.collected, 0);
  const difference =
    expected - Math.round((Number(received || 0) + Number(fees || 0)) * 100);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError("");
        const f = new FormData(e.currentTarget);
        const str = (n: string) => String(f.get(n) || "");
        const num = (n: string) => Number(f.get(n) || 0);
        const amt = (n: string) => cents(f.get(n));
        let type = modalAction[modal],
          p: Record<string, unknown> = {};
        switch (modal) {
          case "Create purchase order":
            p = {
              supplierId: str("supplierId"),
              dueDate: str("dueDate"),
              discount: Math.round(Number(poDiscount) * 100),
              lines: poLines.map((l) => ({
                ...l,
                unitCost: Math.round(l.unitCost * 100),
              })),
            };
            break;
          case "Receive purchase order":
            p = {
              id: selected.id,
              paid: amt("paid"),
              lines: receiptLines
                .filter((l) => l.quantity > 0)
                .map((l) => ({
                  ...l,
                  imeis: l.imeis.split(/[\s,]+/).filter(Boolean),
                  pricing: readPricing(f, `receipt-${l.lineIndex}-`),
                })),
            };
            break;
          case "Add supplier":
            p = {
              name: str("name"),
              phone: str("phone"),
              address: str("address"),
              creditDays: num("creditDays"),
              openingBalance: amt("openingBalance"),
            };
            break;
          case "Supplier payment":
            p = {
              supplierId: selected.id,
              amount: amt("amount"),
              method: str("method"),
            };
            break;
          case "Supplier return":
            p = {
              supplierId: selected?.id || str("supplierId"),
              productId,
              batchId: str("batchId"),
              quantity: num("quantity"),
              resolution: str("resolution"),
              reason: str("reason"),
            };
            break;
          case "Settle supplier return":
            p = {
              id: selected.id,
              resolution: str("resolution"),
              amount: amt("amount"),
            };
            break;
          case "Add agent":
            p = {
              name: str("name"),
              phone: str("phone"),
              defaultSharePercent: num("defaultSharePercent"),
            };
            break;
          case "Pay commission":
            p = {
              payeeType: selected.type,
              payeeId: selected.id,
              amount: amt("amount"),
              method: str("method"),
            };
            break;
          case "Create user":
          case "Edit user":
            p = {
              name: str("name"),
              staffId: str("staffId") || undefined,
              role,
              permissions,
              ...(modal === "Create user"
                ? { username: str("username"), password: str("password") }
                : {
                    id: selected.id,
                    active: f.get("active") === "on",
                    ...(str("password") ? { password: str("password") } : {}),
                  }),
            };
            break;
          case "New arrival alert":
            p = {
              title: str("title"),
              repairId: str("repairId") || undefined,
              parcelDescription: str("parcelDescription") || undefined,
              busRegistration: str("busRegistration"),
              busRoute: str("busRoute"),
              originLocation: str("originLocation") || undefined,
              arrivalLocation: str("arrivalLocation"),
              contactName: str("contactName") || undefined,
              contactPhone: str("contactPhone") || undefined,
              secondaryPhone: str("secondaryPhone") || undefined,
              pickupInstructions: str("pickupInstructions") || undefined,
              packageTraits: f.getAll("packageTraits").map(String),
              paymentState: str("paymentState"),
              amountDue: amt("amountDue"),
              dueAt: new Date(`${str("dueAt")}:00+05:30`).toISOString(),
              assigneeUserId: str("assigneeUserId"),
              minutesBefore: num("minutesBefore"),
            };
            break;
          case "Collect COD batch":
            if (difference !== 0) {
              setFormError(
                "Received amount plus fees must equal the selected shipment total. Resolve the difference before saving.",
              );
              return;
            }
            p = {
              shipmentIds,
              received: Math.round(Number(received) * 100),
              fees: Math.round(Number(fees) * 100),
              reference: str("reference"),
            };
            break;
          case "Provider rule":
            p = {
              provider: str("provider"),
              topupBonusPercent: num("topupBonusPercent"),
              transactionCommissionPercent: num("transactionCommissionPercent"),
              recognition: str("recognition"),
            };
            break;
          case "Configure SMS":
            p = {
              senderId: str("senderId"),
              enabled: f.get("enabled") === "on",
              ...(str("apiKey") ? { apiKey: str("apiKey") } : {}),
            };
            break;
          case "Revise estimate":
            p = {
              id: selected.id,
              estimate: amt("estimate"),
              parts,
              notes: str("notes"),
            };
            break;
          case "Warranty claim":
            p = { repairId: selected.id, issue: str("issue") };
            break;
          case "Return items":
            p = {
              saleId: selected.id,
              items: Object.entries(returnLines)
                .filter(([, v]) => v.quantity > 0)
                .map(([i, v]) => ({ lineIndex: Number(i), ...v })),
              resolution: str("resolution"),
              creditCustomerId: str("creditCustomerId") || undefined,
              reason: str("reason"),
            };
            break;
        }
        const updated = await action(type, p);
        if (
          updated &&
          modal === "Return items" &&
          str("resolution") === "Exchange"
        )
          onExchange?.(str("creditCustomerId") || selected.customerId);
      }}
    >
      {modal === "Create purchase order" && (
        <>
          <Field label="Supplier" name="supplierId" required>
            <option value="">Choose a supplier</option>
            {supplierOptions}
          </Field>
          <Field
            label="Supplier payment due date"
            name="dueDate"
            type="date"
            value={futureDay(30)}
            required
          />
          <div className="purchase-order-lines">
            {poLines.map((line, i) => (
              <div className="po-line" key={i}>
                <label className="field">
                  <span>Product</span>
                  <select
                    required
                    value={line.productId}
                    onChange={(e) =>
                      setPoLines((lines) =>
                        lines.map((l, j) =>
                          i === j
                            ? {
                                ...l,
                                productId: e.target.value,
                                unitCost:
                                  (data.products.find(
                                    (p) => p.id === e.target.value,
                                  )?.cost || 0) / 100,
                              }
                            : l,
                        ),
                      )
                    }
                  >
                    <option value="">Choose product</option>
                    {data.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Quantity ordered</span>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        setPoLines((lines) =>
                          lines.map((l, j) =>
                            i === j
                              ? { ...l, quantity: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Unit cost (Rs.)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={line.unitCost}
                      onChange={(e) =>
                        setPoLines((lines) =>
                          lines.map((l, j) =>
                            i === j
                              ? { ...l, unitCost: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="text-button"
                  disabled={poLines.length === 1}
                  onClick={() =>
                    setPoLines((lines) => lines.filter((_, j) => i !== j))
                  }
                >
                  Remove line
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setPoLines((lines) => [
                ...lines,
                { productId: "", quantity: 1, unitCost: 0 },
              ])
            }
          >
            <Plus size={15} />
            Add product line
          </button>
          <label className="field spaced">
            <span>Purchase discount (Rs.)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={poDiscount}
              onChange={(e) => setPoDiscount(e.target.value)}
            />
          </label>
          <div className="checkout-total">
            <span>Order total</span>
            <strong>
              {money(
                poLines.reduce(
                  (a, l) => a + l.quantity * Math.round(l.unitCost * 100),
                  0,
                ) - Math.round(Number(poDiscount) * 100),
              )}
            </strong>
          </div>
          <p className="footnote">
            Creating an order does not add stock. Receive the delivered goods to
            create batches and supplier balances.
          </p>
        </>
      )}
      {modal === "Receive purchase order" && (
        <>
          <p>
            {selected.number} · {selected.supplierName}
          </p>
          {receiptLines.map((line, i) => {
            const original = selected.lines[line.lineIndex];
            const p = data.products.find((p) => p.id === original.productId);
            const remaining = original.ordered - original.received;
            return (
              <div className="po-line" key={line.lineIndex}>
                <strong>{original.productName}</strong>
                <small>
                  {original.received} received / {original.ordered} ordered
                </small>
                <div className="form-grid">
                  <label className="field">
                    <span>Receiving now</span>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      step="1"
                      value={line.quantity}
                      onChange={(e) =>
                        setReceiptLines((lines) =>
                          lines.map((l, j) =>
                            i === j
                              ? { ...l, quantity: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Batch / lot number</span>
                    <input
                      required={line.quantity > 0}
                      value={line.lot}
                      onChange={(e) =>
                        setReceiptLines((lines) =>
                          lines.map((l, j) =>
                            i === j ? { ...l, lot: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                {p && (
                  <PricingFields
                    labels={data.settings.priceTierLabels}
                    prefix={`receipt-${line.lineIndex}-`}
                    pricing={getPricing(p)}
                    required={line.quantity > 0}
                  />
                )}
                {p?.serialized && (
                  <label className="field">
                    <span>IMEIs — one per received phone</span>
                    <textarea
                      required={line.quantity > 0}
                      value={line.imeis}
                      onChange={(e) =>
                        setReceiptLines((lines) =>
                          lines.map((l, j) =>
                            i === j ? { ...l, imeis: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </label>
                )}
              </div>
            );
          })}
          <Field
            label="Payment made for this receipt (Rs.)"
            name="paid"
            type="number"
            min={0}
            step="0.01"
            value={0}
          />
          <p className="footnote">
            Set receiving quantity to zero for items not delivered. Remaining
            quantities stay open on the purchase order.
          </p>
        </>
      )}
      {modal === "Add supplier" && (
        <>
          <Field label="Supplier name" name="name" required />
          <div className="form-grid">
            <Field label="Phone" name="phone" type="tel" />
            <Field
              label="Credit days"
              name="creditDays"
              type="number"
              min={0}
              value={30}
            />
          </div>
          <Field label="Address" name="address" />
          <Field
            label="Opening amount owed (Rs.)"
            name="openingBalance"
            type="number"
            min={0}
            step="0.01"
            value={0}
          />
          <p className="footnote">
            Opening balance is separate from purchases subsequently recorded in
            this system.
          </p>
        </>
      )}
      {modal === "Supplier payment" && (
        <>
          <div className="checkout-total">
            <span>{selected.name}</span>
            <strong>{money(supplierBalance(data, selected))}</strong>
          </div>
          <Field
            label="Payment amount (Rs.)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
          <Field label="Payment method" name="method">
            {paymentOptions}
          </Field>
        </>
      )}
      {modal === "Supplier return" && (
        <>
          {selected ? (
            <p className="muted">Returning stock to {selected.name}</p>
          ) : (
            <Field label="Supplier" name="supplierId">
              {supplierOptions}
            </Field>
          )}
          <label className="field">
            <span>Product</span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">Choose a product</option>
              {data.products
                .filter((p) => !p.serialized)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <Field label="Batch" name="batchId" required>
            <option value="">Choose received batch</option>
            {data.batches
              .filter(
                (b) =>
                  b.productId === productId &&
                  b.remaining > 0 &&
                  (!selected?.name ||
                    b.supplier.toLowerCase() === selected.name.toLowerCase()),
              )
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.lot} · {b.remaining} available · {b.supplier}
                </option>
              ))}
          </Field>
          <div className="form-grid">
            <Field
              label="Quantity"
              name="quantity"
              type="number"
              min={1}
              value={1}
            />
            <Field label="Resolution" name="resolution">
              <option>Pending</option>
              <option>Credit note</option>
              <option>Replacement</option>
              <option>Refund</option>
            </Field>
          </div>
          <Field label="Return reason" name="reason" required />
        </>
      )}
      {modal === "Settle supplier return" && (
        <>
          <p>
            {selected.productName} · {selected.quantity} units ·{" "}
            {selected.supplierName}
          </p>
          <Field label="Resolution received" name="resolution">
            <option>Credit note</option>
            <option>Replacement</option>
            <option>Refund</option>
          </Field>
          <Field
            label="Settlement value (Rs.)"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            value={selected.amount / 100}
          />
          <p className="footnote">
            Confirm the actual supplier response before settling this return.
          </p>
        </>
      )}
      {modal === "Add agent" && (
        <>
          <Field label="Agent name" name="name" required />
          <Field label="Phone" name="phone" type="tel" required />
          <Field
            label="Share of accessory commission pool (%)"
            name="defaultSharePercent"
            type="number"
            min={0}
            step="0.01"
            value={data.settings.agentSharePercent}
          />
          <p className="footnote">
            This is a share of the profit-based commission pool, not a
            percentage of sales revenue.
          </p>
        </>
      )}
      {modal === "Pay commission" && (
        <>
          <div className="checkout-total">
            <span>{selected.name} · outstanding</span>
            <strong>{money(selected.earned - selected.paidCommission)}</strong>
          </div>
          <Field
            label="Commission payment (Rs.)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            value={Math.max(0, selected.earned - selected.paidCommission) / 100}
            required
          />
          <Field label="Payment method" name="method">
            {paymentOptions}
          </Field>
        </>
      )}
      {["Create user", "Edit user"].includes(modal) && (
        <>
          <div className="form-grid">
            <Field
              label="Full name"
              name="name"
              value={selected?.name}
              required
            />
            {modal === "Create user" ? (
              <Field label="Username" name="username" required />
            ) : (
              <label className="field">
                <span>Username</span>
                <input value={selected.username} disabled />
              </label>
            )}
          </div>
          <Field
            label={
              modal === "Create user"
                ? "Password (at least 12 characters)"
                : "New password (leave blank to keep current)"
            }
            name="password"
            type="password"
            required={modal === "Create user"}
          />
          <p className="footnote">
            Use at least 12 characters with upper and lower case letters, a
            number and a symbol. Sales & service can sell, manage repairs and
            acknowledge assigned alerts. It cannot manage users, payroll,
            expenses or settings.
          </p>
          <label className="field">
            <span>Permission preset / role</span>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPermissions(presets[e.target.value]);
              }}
            >
              {Object.keys(presets).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Field
            label="Linked payroll / service staff record"
            name="staffId"
            value={selected?.staffId || ""}
          >
            <option value="">No linked staff record</option>
            {data.staff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} · {staff.role}
              </option>
            ))}
          </Field>
          <p className="footnote">
            Connects this account to its staff earnings and service assignments.
            Choose the matching employee so sales commissions go to the correct
            person.
          </p>
          <div className="permission-grid">
            {permissions.includes("*") ? (
              <div className="notice">
                Owner has access to every module and action. Choose another
                preset to customize individual permissions.
              </div>
            ) : (
              Object.entries(permissionLabels).map(([p, label]) => (
                <label className="checkbox" key={p}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={(e) =>
                      setPermissions(
                        e.target.checked
                          ? [...permissions, p]
                          : permissions.filter((x) => x !== p),
                      )
                    }
                  />
                  {label}
                </label>
              ))
            )}
          </div>
          {modal === "Edit user" && (
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={selected.active}
              />
              Account is active
            </label>
          )}
          <p className="footnote">
            Permissions are enforced by the server. Device credentials require a
            separate sensitive-access permission.
          </p>
        </>
      )}
      {modal === "New arrival alert" && (
        <JourneyFormFields
          users={
            data.users?.length
              ? data.users
              : currentUser
                ? [{ ...currentUser, active: true }]
                : []
          }
          repairs={data.repairs}
        />
      )}
      {modal === "Collect COD batch" && (
        <>
          <div className="shipment-checks">
            {eligible.map((s) => (
              <label className="checkbox" key={s.id}>
                <input
                  type="checkbox"
                  checked={shipmentIds.includes(s.id)}
                  onChange={(e) =>
                    setShipmentIds(
                      e.target.checked
                        ? [...shipmentIds, s.id]
                        : shipmentIds.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  <strong>
                    {s.orderRef} · {money(s.amount - s.collected)}
                  </strong>
                  <small>
                    {s.tracking} · {s.customerName}
                  </small>
                </span>
              </label>
            ))}
            {!eligible.length && (
              <p className="muted">
                No delivered shipments awaiting collection.
              </p>
            )}
          </div>
          <Field
            label="Settlement / post office receipt reference"
            name="reference"
            required
          />
          <div className="form-grid">
            <label className="field">
              <span>Cash received (Rs.)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Fees deducted (Rs.)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="report-lines">
            <div>
              <span>Expected collection</span>
              <strong>{money(expected)}</strong>
            </div>
            <div>
              <span>Unreconciled difference</span>
              <strong>{money(difference)}</strong>
            </div>
          </div>
          <p className="footnote">
            Previously paid postage is already recorded. Enter only additional
            fees deducted from this settlement.
          </p>
        </>
      )}
      {modal === "Provider rule" && (
        <>
          <Field
            label="Provider name"
            name="provider"
            value={selected?.provider}
            required
          />
          <div className="form-grid">
            <Field
              label="Top-up bonus (%)"
              name="topupBonusPercent"
              type="number"
              min={0}
              step="0.01"
              value={selected?.topupBonusPercent || 0}
            />
            <Field
              label="Transaction commission (%)"
              name="transactionCommissionPercent"
              type="number"
              min={0}
              step="0.01"
              value={selected?.transactionCommissionPercent || 0}
            />
          </div>
          <Field
            label="Commission recognition"
            name="recognition"
            value={selected?.recognition || "Manual"}
          >
            <option>Top-up</option>
            <option>Transaction</option>
            <option>Manual</option>
          </Field>
          <p className="footnote">
            Confirm these rules with the provider agreement. Recorded actual
            commissions remain explicitly entered.
          </p>
        </>
      )}
      {modal === "Configure SMS" && (
        <>
          <Field
            label="Sender ID"
            name="senderId"
            value={data.settings.smsSenderId}
            required
          />
          <Field
            label={
              data.settings.smsApiKeyConfigured
                ? "New API key (leave blank to retain existing)"
                : "text.lk API key"
            }
            name="apiKey"
            type="password"
            required={!data.settings.smsApiKeyConfigured}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={data.settings.smsEnabled}
            />
            Enable SMS sending
          </label>
          <div className="notice">
            The key is sent securely to your server and stored encrypted. It is
            never returned to the browser. Delivery is confirmed only by gateway
            results.
          </div>
        </>
      )}
      {modal === "Revise estimate" && (
        <>
          <Field
            label="Revised repair charge (Rs.)"
            name="estimate"
            type="number"
            min={0}
            step="0.01"
            value={selected.estimate / 100}
            required
          />
          <PartsEditor
            products={data.products}
            value={parts}
            onChange={setParts}
          />
          <Field label="Updated notes" name="notes" value={selected.notes} />
          <p className="footnote">
            The customer must approve the revised estimate before work begins.
          </p>
        </>
      )}
      {modal === "Warranty claim" && (
        <>
          <p>
            {selected.number} · {selected.device}
          </p>
          <Field label="Warranty issue / complaint" name="issue" required />
          <p className="footnote">
            Records a claim against the original repair. This does not
            automatically issue a refund or new commission.
          </p>
        </>
      )}
      {modal === "Return items" && (
        <>
          <div className="notice">
            Select the quantities being returned from {selected.number}.
            Previously returned units cannot be returned again.
          </div>
          {selected.lines.map((l: any, i: number) => {
            const returned = (data.returns || [])
              .filter((r) => r.saleId === selected.id)
              .flatMap((r) => r.items)
              .filter((r) => r.lineIndex === i)
              .reduce((a, r) => a + r.quantity, 0);
            const remaining = l.quantity - returned;
            return (
              <div className="return-line" key={i}>
                <strong>{l.name}</strong>
                <small>
                  {remaining} eligible · {money(l.price)} each
                </small>
                <div className="form-grid">
                  <label className="field">
                    <span>Quantity to return</span>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={returnLines[i]?.quantity || 0}
                      onChange={(e) =>
                        setReturnLines({
                          ...returnLines,
                          [i]: {
                            quantity: Number(e.target.value),
                            disposition:
                              returnLines[i]?.disposition || "Restock",
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Item destination</span>
                    <select
                      value={returnLines[i]?.disposition || "Restock"}
                      onChange={(e) =>
                        setReturnLines({
                          ...returnLines,
                          [i]: {
                            quantity: returnLines[i]?.quantity || 0,
                            disposition: e.target.value,
                          },
                        })
                      }
                    >
                      <option>Restock</option>
                      <option>Supplier return</option>
                      <option>Waste</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
          <Field label="Customer resolution" name="resolution">
            <option>Refund</option>
            <option>Exchange</option>
            <option>Store credit</option>
          </Field>
          {selected.customerId === "cust-walkin" && (
            <Field
              label="Customer receiving exchange or store credit"
              name="creditCustomerId"
            >
              <option value="">Choose a named customer for credit</option>
              {data.customers
                .filter((customer) => customer.id !== "cust-walkin")
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
            </Field>
          )}
          <Field label="Return reason" name="reason" required />
          <p className="footnote">
            Exchange and store credit add the eligible returned value to the
            named customer&apos;s store credit. Open Point of sale, select that
            customer, and apply the credit to a replacement or different item.
            Supplier return holds the returned stock outside saleable inventory;
            use Restock only when it can be sold again.
          </p>
        </>
      )}
      {formError && (
        <div className="notice auth-error" role="alert">
          {formError}
        </div>
      )}
      <div className="modal-footer">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            (modal === "Collect COD batch" &&
              (!shipmentIds.length || difference !== 0))
          }
        >
          {busy ? "Saving…" : "Save changes"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
function PushEnableButton({ notify }: { notify: (message: string) => void }) {
  const [state, setState] = useState("Enable background push");
  async function enable() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("Background push is unavailable in this browser.");
      const config = await fetch("/api/push").then((response) =>
        response.json(),
      );
      if (!config.configured)
        throw new Error("Web Push keys are not configured on the server.");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const padded = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Push setup failed.");
      setState("Background push enabled");
      notify("Background push notifications enabled");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Push setup failed.");
    }
  }
  return (
    <button
      className="secondary"
      disabled={state === "Background push enabled"}
      onClick={enable}
    >
      {state}
    </button>
  );
}

function CsvImportPanel({ notify }: { notify: (message: string) => void }) {
  const [importing, setImporting] = useState(false);
  return (
    <section className="panel csv-import-panel">
      <div className="panel-heading">
        <div>
          <h2>Import existing records</h2>
          <p>CSV imports validate and commit as one transaction</p>
        </div>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setImporting(true);
          try {
            const response = await fetch("/api/import", {
              method: "POST",
              body: new FormData(event.currentTarget),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Import failed.");
            notify(
              `${result.imported} records imported successfully${result.skipped ? ` · ${result.skipped} skipped` : ""}`,
            );
            window.location.reload();
          } catch (error) {
            notify(error instanceof Error ? error.message : "Import failed.");
          } finally {
            setImporting(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Record type" name="kind" value="products">
            <option value="legacyProducts">
              Current system products + opening stock
            </option>
            <option value="products">Products</option>
            <option value="customers">Customers</option>
            <option value="stock">Opening stock / GRNs</option>
          </Field>
          <Field label="CSV file" name="file" type="file" required />
        </div>
        <p className="footnote">
          Current-system exports use Product, Unit Purchase Price, Selling
          Price, Current stock, Category and SKU automatically. Inactive status
          is preserved and export-footer rows are skipped. Generic products:
          sku, name, category, department, price, cost, reorderLevel,
          serialized. Customers: name, phone, address. Stock: sku, supplier,
          lot, quantity, unitCost, paid, imeis.
        </p>
        <button className="secondary" disabled={importing}>
          {importing ? "Importing…" : "Validate and import"}
        </button>
      </form>
    </section>
  );
}

function PasswordForm({
  close,
  notify,
}: {
  close: () => void;
  notify: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setFormError("");
        const form = new FormData(event.currentTarget);
        const currentPassword = String(form.get("currentPassword") || "");
        const newPassword = String(form.get("newPassword") || "");
        const confirmation = String(form.get("confirmation") || "");
        if (newPassword !== confirmation) {
          setFormError("The new passwords do not match.");
          return;
        }
        setSaving(true);
        try {
          const response = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "changePassword",
              currentPassword,
              newPassword,
            }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Password change failed.");
          notify("Password changed. Other signed-in devices were logged out.");
          close();
        } catch (error) {
          setFormError(
            error instanceof Error ? error.message : "Password change failed.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="security-summary">
        <strong>Protect your account</strong>
        <p>
          Changing your password keeps this browser signed in and revokes your
          other active sessions.
        </p>
      </div>
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        required
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        required
        minLength={12}
      />
      <Field
        label="Confirm new password"
        name="confirmation"
        type="password"
        required
        minLength={12}
      />
      <p className="footnote">
        Use at least 12 characters with upper and lower case letters, a number
        and a symbol.
      </p>
      {formError && (
        <div className="notice auth-error" role="alert">
          {formError}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button className="primary" disabled={saving}>
          {saving ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

function SecurityEventsPanel() {
  const [events, setEvents] = useState<
    {
      id: string;
      occurredAt: string;
      event: string;
      success: boolean;
      username?: string;
    }[]
  >([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/security")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Security events unavailable.");
        if (active) setEvents(result.events || []);
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Security events unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel spaced-bottom">
      <div className="panel-heading">
        <div>
          <h2>Authentication activity</h2>
          <p>Sign-ins and security-sensitive account changes</p>
        </div>
      </div>
      {loadError ? (
        <div className="panel-body">
          <div className="notice auth-error" role="alert">
            {loadError}
          </div>
        </div>
      ) : (
        <Table
          heads={["TIME", "EVENT", "ACCOUNT", "RESULT"]}
          rows={events.slice(0, 25).map((event) => [
            new Date(event.occurredAt).toLocaleString("en-GB", {
              timeZone: "Asia/Colombo",
            }),
            event.event.replaceAll(".", " "),
            event.username || "System",
            <Badge>{event.success ? "Successful" : "Failed"}</Badge>,
          ])}
          empty="No authentication activity recorded yet."
        />
      )}
    </section>
  );
}

function readPricing(form: FormData, prefix = ""): PriceSettings {
  const result: PriceSettings = {
    Retail: cents(form.get(`${prefix}pricing-Retail`)),
  };
  for (const key of [
    "Wholesale",
    "VIP",
    "Agent",
    "minimum",
    "maximum",
  ] as const) {
    const value = form.get(`${prefix}pricing-${key}`);
    if (value !== null && String(value).trim() !== "")
      result[key] = cents(value);
  }
  return result;
}
function PricingFields({
  pricing,
  prefix = "",
  required = true,
  labels,
}: {
  pricing?: PriceSettings;
  prefix?: string;
  required?: boolean;
  labels?: Partial<Record<PriceTier, string>>;
}) {
  return (
    <fieldset className="pricing-fields">
      <legend>
        Selling prices <span>Rs. per unit</span>
      </legend>
      <p>
        Retail is required. Leave other tiers blank if unavailable. Limits apply
        after all discounts.
      </p>
      <div className="form-grid">
        {[...PRICE_TIERS, "minimum", "maximum"].map((key) => (
          <Field
            key={key}
            label={
              key === "minimum"
                ? "Minimum sale price"
                : key === "maximum"
                  ? "Maximum sale price"
                  : `${priceTierLabel(labels, key as PriceTier)} price`
            }
            name={`${prefix}pricing-${key}`}
            type="number"
            min={0}
            step="0.01"
            required={required && key === "Retail"}
            value={
              pricing?.[key as keyof PriceSettings] === undefined
                ? ""
                : pricing[key as keyof PriceSettings]! / 100
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
function PriceSummary({
  pricing,
  labels,
}: {
  pricing: PriceSettings;
  labels?: Partial<Record<PriceTier, string>>;
}) {
  return (
    <div className="price-summary">
      {PRICE_TIERS.map((tier) => (
        <span key={tier}>
          {priceTierLabel(labels, tier)}{" "}
          <strong>
            {pricing[tier] === undefined ? "Not set" : money(pricing[tier]!)}
          </strong>
        </span>
      ))}
      <small>
        Allowed:{" "}
        {pricing.minimum === undefined ? "No minimum" : money(pricing.minimum)}{" "}
        –{" "}
        {pricing.maximum === undefined ? "No maximum" : money(pricing.maximum)}
      </small>
    </div>
  );
}

// Availability-only preview: prices and validation remain authoritative in quoteSale.
function saleBatchContext(workspace: Workspace, items: CartPricingItem[]) {
  const available = new Map(
    workspace.batches.map((batch) => [batch.id, batch.remaining]),
  );
  return items.map((item) => {
    let remaining = item.quantity;
    const matches: { batch: Workspace["batches"][number]; quantity: number }[] =
      [];
    for (const batch of workspace.batches
      .filter(
        (b) =>
          b.productId === item.productId &&
          (!item.imei || b.imeis.includes(item.imei)),
      )
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
      const quantity = Math.min(remaining, available.get(batch.id) || 0);
      if (quantity <= 0) continue;
      matches.push({ batch, quantity });
      available.set(batch.id, (available.get(batch.id) || 0) - quantity);
      remaining -= quantity;
      if (!remaining) break;
    }
    return matches;
  });
}
function stockRetailLabel(workspace: Workspace, product: Product) {
  const batches = workspace.batches
    .filter((batch) => batch.productId === product.id && batch.remaining > 0)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  if (!batches.length) return money(getPricing(product).Retail);
  const prices = batches.map((batch) => getPricing(product, batch).Retail);
  if (product.serialized && Math.min(...prices) !== Math.max(...prices))
    return `${money(Math.min(...prices))}–${money(Math.max(...prices))}`;
  return money(prices[0]);
}
