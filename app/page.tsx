"use client";
import { ArrivalAlarm } from "./components/arrival-alarm";
import { canAcknowledgeAlert } from "@/lib/alerts";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
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
} from "lucide-react";
import type {
  Workspace,
  WorkspaceResponse,
  Product,
  Sale,
  Repair,
} from "@/lib/types";
import {
  getPricing,
  quoteSale,
  quoteSignature,
  PRICE_TIERS,
} from "@/lib/pricing";
import type { PriceSettings, PriceTier, CartPricingItem } from "@/lib/types";
const navGroups = [
  {
    label: "DAILY OPERATIONS",
    names: [
      "Overview",
      "Point of sale",
      "Repairs",
      "COD & delivery",
      "Reloads",
      "Alerts",
    ],
  },
  {
    label: "STOCK & RELATIONSHIPS",
    names: ["Inventory", "Purchases", "Suppliers", "Customers"],
  },
  {
    label: "BUSINESS MANAGEMENT",
    names: [
      "Expenses",
      "Agents & commissions",
      "Team & payroll",
      "Reports",
      "Settings",
    ],
  },
];
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Point of sale", icon: ShoppingBag },
  { name: "Inventory", icon: Boxes },
  { name: "Repairs", icon: Wrench },
  { name: "Customers", icon: Users },
  { name: "Purchases", icon: PackageCheck },
  { name: "Suppliers", icon: Truck },
  { name: "Agents & commissions", icon: Users },
  { name: "Alerts", icon: Bell },
  { name: "Expenses", icon: Receipt },
  { name: "COD & delivery", icon: Truck },
  { name: "Reloads", icon: Smartphone },
  { name: "Team & payroll", icon: Wallet },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];
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
  Reports: "reports.view",
  Settings: "settings.manage",
};
const actionPermission: Record<string, string> = {
  createPurchaseOrder: "purchasing.manage",
  receivePurchaseOrder: "purchasing.manage",
  createSale: "sales.manage",
  returnSale: "sales.manage",
  returnItems: "sales.manage",
  receiveStock: "purchasing.manage",
  updateProductPricing: "inventory.manage",
  updateBatchPricing: "purchasing.manage",
  newProduct: "inventory.manage",
  setProductActive: "inventory.manage",
  createRepair: "repairs.manage",
  repairStatus: "repairs.manage",
  repairPayment: "repairs.manage",
  updateRepairEstimate: "repairs.manage",
  createWarrantyClaim: "repairs.manage",
  clearRepairCredential: "repairs.credentials",
  createCustomer: "customers.manage",
  collectPayment: "sales.manage",
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
  retrySms: "settings.manage",
  setProviderRule: "settings.manage",
  createAlert: "alerts.manage",
  acknowledgeAlert: "alerts.view",
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
  }).format(n / 100);
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
  step,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: ReactNode;
  min?: number;
  minLength?: number;
  step?: string;
}) {
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
          type={type}
          defaultValue={value}
          required={required}
          min={min}
          minLength={minLength}
          step={step}
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
    [cart, setCart] = useState<CartPricingItem[]>([]),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [reportTab, setReportTab] = useState("Summary"),
    [repairParts, setRepairParts] = useState<
      { productId: string; quantity: number }[]
    >([]);
  const [saleCustomerId, setSaleCustomerId] = useState("cust-walkin");
  const [checkoutDiscount, setCheckoutDiscount] = useState("");
  const [checkoutPaid, setCheckoutPaid] = useState<string | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState("Cash");
  const [checkoutReason, setCheckoutReason] = useState("");
  const [receiveProductId, setReceiveProductId] = useState("");
  const can = (permission: string) =>
    !!user &&
    (user.permissions.includes("*") || user.permissions.includes(permission));
  const canPage = (name: string) =>
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
    setDepartment("All departments");
    setQuery("");
    setGlobalSearch("");
    setMobile(false);
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
    setSelected(item);
    setModal(name);
    if (name === "Receive stock")
      setReceiveProductId(item?.id || data?.products[0]?.id || "");
    if (name === "Checkout") {
      setCheckoutDiscount("");
      setCheckoutPaid(null);
      setCheckoutMethod("Cash");
      setCheckoutReason("");
    }
    if (name === "New repair") setRepairParts([]);
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
  const saleProducts = products.filter((product) => product.active !== false);
  const sales = data.sales.filter(
    (s) =>
      department === "All departments" ||
      s.department === department ||
      s.department === "Mixed",
  );
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
  const updateCartPricing = (index: number, patch: Partial<CartPricingItem>) =>
    setCart((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const filtered = <T,>(rows: T[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
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
    const inCart = cart.find((c) => c.productId === p.id)?.quantity || 0;
    if (inCart < p.stock) setToast(`${p.name} added to the sale.`);
    setCart((prev) => {
      const found = prev.find((c) => c.productId === p.id);
      if (found && found.quantity >= p.stock) {
        setToast("All available stock is already in the cart.");
        return prev;
      }
      return found
        ? prev.map((c) =>
            c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c,
          )
        : [...prev, { productId: p.id, quantity: 1 }];
    });
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
    Alerts: ["New arrival alert", "New arrival alert"],
  };
  return (
    <div className="app-shell">
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <a
          className="logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">▰</span>fido
          <span className="lk">LK</span>
        </a>
        <div className="workspace-label">BUSINESS WORKSPACE</div>
        <button className="shop-switch" onClick={() => go("Settings")}>
          <span className="shop-icon">
            <ShoppingBag size={18} />
          </span>
          <span>
            <strong>Fido LK</strong>
            <small>Main branch · Sri Lanka</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => {
            const entries = group.names
              .map((name) => nav.find((item) => item.name === name)!)
              .filter((item) => canPage(item.name));
            return entries.length ? (
              <div className="nav-group" key={group.label}>
                <div className="nav-label">{group.label}</div>
                {entries.map((n) => (
                  <button
                    key={n.name}
                    className={page === n.name ? "active" : ""}
                    aria-current={page === n.name ? "page" : undefined}
                    onClick={() => go(n.name)}
                  >
                    <n.icon size={18} />
                    <span>{n.name}</span>
                    {n.name === "Repairs" && (
                      <em>
                        {
                          data.repairs.filter(
                            (r) =>
                              !["Collected", "Declined"].includes(r.status),
                          ).length
                        }
                      </em>
                    )}
                    {n.name === "Alerts" && urgentAlerts.length > 0 && (
                      <em className="nav-alert-count">{urgentAlerts.length}</em>
                    )}
                  </button>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <i />
            Cloud workspace<span>{mode === "demo" ? "DEMO" : "LIVE"}</span>
          </div>
          <button className="profile" onClick={() => open("Account security")}>
            <span className="avatar">
              {user?.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("") || "FL"}
            </span>
            <span>
              <strong>{user?.name || "Team member"}</strong>
              <small>{user?.role || "Staff"}</small>
            </span>
            <Settings size={15} />
          </button>
          <button
            className="logout-button"
            onClick={async () => {
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
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile((open) => !open)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              ref={workspaceSearchRef}
              aria-label="Search workspace"
              placeholder="Search products, people, repairs…"
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
                <div className="search-hint">
                  ↑ ↓ Navigate <span>Enter Open · Esc Close</span>
                </div>
              </div>
            )}
          </div>
          <div className="header-actions">
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
            <span className="avatar light">
              {user?.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("") || "FL"}
            </span>
          </div>
        </header>
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
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === "Overview"
                      ? "YOUR BUSINESS AT A GLANCE"
                      : "FIDO LK WORKSPACE"}
                  </div>
                  <h1>{page === "Overview" ? "Business overview" : page}</h1>
                  <p>
                    {page === "Overview"
                      ? "Welcome back. Here’s what’s happening at your shop today."
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
                            Reports:
                              "Understand the numbers behind your business.",
                            Suppliers:
                              "Manage supplier relationships, credit and returned stock.",
                            "Agents & commissions":
                              "Track earned commissions and settle every payee clearly.",
                            Alerts:
                              "Know when parts arrive. Keep collection responsibilities clear.",
                            Settings:
                              "Make this workspace work for your business.",
                            "Point of sale": "A smooth checkout starts here.",
                          } as Record<string, string>
                        )[page]}
                  </p>
                </div>
                <div className="heading-actions">
                  {page === "Overview" ? (
                    <>
                      <button
                        className="secondary"
                        disabled={!can("reports.view")}
                        onClick={() => go("Reports")}
                      >
                        <BarChart3 size={16} />
                        View reports
                      </button>
                      <button
                        className="primary"
                        disabled={!can("sales.manage")}
                        onClick={() => go("Point of sale")}
                      >
                        <Plus size={17} />
                        New sale
                      </button>
                    </>
                  ) : moduleActions[page] &&
                    can(
                      actionPermission[modalAction[moduleActions[page][1]]],
                    ) ? (
                    <button
                      className="primary"
                      onClick={() => open(moduleActions[page][1])}
                    >
                      <Plus size={17} />
                      {moduleActions[page][0]}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="filterbar">
                {["Point of sale", "Inventory"].includes(page) ? (
                  <div
                    className="department-tabs"
                    aria-label="Department filter"
                  >
                    {["All departments", "Phones", "Clothing", "Gifts"].map(
                      (d) => (
                        <button
                          className={department === d ? "selected" : ""}
                          key={d}
                          onClick={() => setDepartment(d)}
                        >
                          {d}
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <span className="muted">All departments · One business</span>
                )}
                <span className="date-label">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Colombo",
                  })}
                  <ChevronDown size={14} />
                </span>
              </div>
              {mode === "demo" && (
                <div className="demo-strip">
                  <span className="demo-dot" />
                  Demo workspace{" "}
                  <span>
                    Explore with sample data. Changes are saved to this demo.
                  </span>
                </div>
              )}
              {user && can("alerts.view") && (
                <ArrivalAlarm
                  alerts={data.alerts || []}
                  user={user}
                  openAlerts={() => go("Alerts")}
                  acknowledge={async (id) =>
                    !!(await action("acknowledgeAlert", { id }))
                  }
                />
              )}
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
              {page === "Overview" && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Today's sales"
                      value={money(dayRevenue)}
                      note={`${daySales.length} completed transactions`}
                      icon={<ShoppingBag size={19} />}
                      accent
                    />
                    <Metric
                      label="Today's gross margin"
                      value={money(dayMargin)}
                      note="Before commissions & expenses"
                      icon={<BarChart3 size={19} />}
                    />
                    <Metric
                      label="Customer balances"
                      value={money(outstanding)}
                      note="Sales & repairs, excluding delivered COD"
                      icon={<Wallet size={19} />}
                    />
                    <Metric
                      label="Active repairs"
                      value={String(
                        data.repairs.filter(
                          (r) => !["Collected", "Declined"].includes(r.status),
                        ).length,
                      ).padStart(2, "0")}
                      note={`${data.repairs.filter((r) => r.status === "Ready for collection").length} ready for collection`}
                      icon={<Wrench size={19} />}
                    />
                  </div>
                  <section
                    className="attention-board"
                    aria-labelledby="attention-title"
                  >
                    <div className="attention-heading">
                      <div>
                        <span className="eyebrow">
                          THE COUNTER, AT A GLANCE
                        </span>
                        <h2 id="attention-title">What needs your attention</h2>
                      </div>
                      <span className="attention-total">
                        {urgentAlerts.length +
                          readyRepairs.length +
                          unsettledCod.length}{" "}
                        to review
                      </span>
                    </div>
                    <div className="attention-rows">
                      {canPage("Alerts") && (
                        <button
                          className={`attention-row ${urgentAlerts.length ? "needs-action" : ""}`}
                          onClick={() => go("Alerts")}
                        >
                          <span className="attention-icon">
                            <Bell size={21} />
                          </span>
                          <span className="attention-copy">
                            <strong>
                              {urgentAlerts.length
                                ? `${urgentAlerts.length} arrival / reminder alerts need a response`
                                : upcomingArrival
                                  ? upcomingArrival.title
                                  : "No alerts need a response"}
                            </strong>
                            <small>
                              {urgentAlerts.length
                                ? urgentAlerts[0].title
                                : upcomingArrival
                                  ? `Next arrival · ${new Date(upcomingArrival.dueAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                                  : "Scheduled arrivals and reminders appear here"}
                            </small>
                          </span>
                          <span className="attention-link">
                            View alerts <ArrowRight size={16} />
                          </span>
                        </button>
                      )}
                      {canPage("Repairs") && (
                        <button
                          className="attention-row"
                          onClick={() => go("Repairs")}
                        >
                          <span className="attention-icon">
                            <Wrench size={21} />
                          </span>
                          <span className="attention-copy">
                            <strong>
                              {readyRepairs.length} repairs ready for collection
                            </strong>
                            <small>
                              {readyRepairs.length
                                ? readyRepairs
                                    .slice(0, 2)
                                    .map(
                                      (r) => `${r.number} · ${r.customerName}`,
                                    )
                                    .join(" / ")
                                : "Completed repairs will appear here for handover"}
                            </small>
                          </span>
                          <span className="attention-link">
                            Open repairs <ArrowRight size={16} />
                          </span>
                        </button>
                      )}
                      {canPage("COD & delivery") && (
                        <button
                          className="attention-row"
                          onClick={() => go("COD & delivery")}
                        >
                          <span className="attention-icon">
                            <Truck size={21} />
                          </span>
                          <span className="attention-copy">
                            <strong>
                              {money(
                                unsettledCod.reduce(
                                  (sum, s) => sum + s.amount - s.collected,
                                  0,
                                ),
                              )}{" "}
                              ready to reconcile
                            </strong>
                            <small>
                              {unsettledCod.length} delivered COD shipments
                              awaiting collection
                            </small>
                          </span>
                          <span className="attention-link">
                            Review COD <ArrowRight size={16} />
                          </span>
                        </button>
                      )}
                      {!["Alerts", "Repairs", "COD & delivery"].some(
                        canPage,
                      ) && (
                        <p className="attention-empty">
                          Your available sales and business activity is shown
                          below.
                        </p>
                      )}
                    </div>
                    <div className="counter-shortcuts">
                      <span>QUICK ACTIONS</span>
                      {can("repairs.manage") && (
                        <button onClick={() => open("New repair")}>
                          <Wrench size={15} /> Book a repair
                        </button>
                      )}
                      {can("purchasing.manage") && (
                        <button onClick={() => open("Receive stock")}>
                          <PackageCheck size={15} /> Receive stock
                        </button>
                      )}
                      {can("cod.manage") && (
                        <button onClick={() => open("New shipment")}>
                          <Truck size={15} /> New shipment
                        </button>
                      )}
                    </div>
                  </section>
                  <div className="overview-charts">
                    <section className="panel revenue-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Sales performance</h2>
                          <p>Your sales over the last 7 days</p>
                        </div>
                        <span className="chart-legend">
                          <i />
                          Sales
                        </span>
                      </div>
                      <SalesChart sales={sales} />
                    </section>
                    <section className="panel target-panel">
                      <div className="panel-heading">
                        <h2>Daily target</h2>
                        {can("settings.manage") && (
                          <button
                            className="icon-button"
                            aria-label="Edit daily target"
                            onClick={() => go("Settings")}
                          >
                            <MoreHorizontal size={20} />
                          </button>
                        )}
                      </div>
                      <div
                        className="target-ring"
                        style={{
                          background: `conic-gradient(var(--blue) ${progress}%, #edf0f7 0)`,
                        }}
                      >
                        <div>
                          <strong>
                            {progress}
                            <span>%</span>
                          </strong>
                          <small>of daily target</small>
                        </div>
                      </div>
                      <div className="target-numbers">
                        <span>
                          <small>Achieved</small>
                          <strong>{money(dayRevenue)}</strong>
                        </span>
                        <span>
                          <small>Daily target</small>
                          <strong>{money(target)}</strong>
                        </span>
                      </div>
                      <div className="target-note">
                        {progress >= 100
                          ? "Great work! Daily target achieved."
                          : `${money(Math.max(0, target - dayRevenue))} to reach today’s goal`}
                        <ArrowUpRight size={16} />
                      </div>
                    </section>
                  </div>
                  <div className="overview-bottom">
                    <section className="panel transactions-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Recent transactions</h2>
                          <p>The latest activity at your counter</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("Reports")}
                        >
                          View all
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      {salesTable(
                        [...sales]
                          .sort(
                            (a, b) =>
                              Date.parse(b.createdAt) - Date.parse(a.createdAt),
                          )
                          .slice(0, 5),
                      )}
                    </section>
                    <section className="panel repair-preview">
                      <div className="panel-heading">
                        <h2>Repair queue</h2>
                        <button
                          className="text-button"
                          onClick={() => go("Repairs")}
                        >
                          View all
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      {data.repairs
                        .filter(
                          (r) => !["Collected", "Declined"].includes(r.status),
                        )
                        .slice(0, 4)
                        .map((r) => (
                          <button
                            className="repair-preview-row"
                            key={r.id}
                            onClick={() => open("Repair details", r)}
                          >
                            <span className="device-icon">
                              <Smartphone size={20} />
                            </span>
                            <span>
                              <strong>{r.device}</strong>
                              <small>
                                {r.number} · {r.customerName}
                              </small>
                              <Badge>{r.status}</Badge>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      {!data.repairs.some(
                        (r) => !["Collected", "Declined"].includes(r.status),
                      ) && (
                        <div className="empty">No repairs in the queue.</div>
                      )}
                    </section>
                  </div>
                  <div className="bottom-insights">
                    <span>
                      <span className="insight-icon">
                        <Boxes size={17} />
                      </span>
                      <strong>
                        {
                          data.products.filter((p) => p.stock <= p.reorderLevel)
                            .length
                        }{" "}
                        products
                      </strong>{" "}
                      need restocking
                      <button onClick={() => go("Inventory")}>
                        Review inventory <ArrowRight size={13} />
                      </button>
                    </span>
                    <span>
                      <span className="insight-icon">
                        <Truck size={17} />
                      </span>
                      <strong>{money(codPending)}</strong> awaiting COD
                      collection
                      <button onClick={() => go("COD & delivery")}>
                        View shipments <ArrowRight size={13} />
                      </button>
                    </span>
                  </div>
                </>
              )}
              {page === "Point of sale" && (
                <div className="pos-layout">
                  <section>
                    <div className="module-toolbar">
                      <div className="search-field">
                        <Search size={17} />
                        <input
                          placeholder="Scan barcode or search products…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          aria-label="Search products"
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const scanned = query.trim().toLowerCase();
                            if (!scanned) return;
                            const matches = data.products.filter(
                              (p) =>
                                p.active !== false &&
                                (department === "All departments" ||
                                  p.department === department) &&
                                p.sku.toLowerCase() === scanned,
                            );
                            if (matches.length === 1) {
                              addCart(matches[0]);
                              setQuery("");
                            } else
                              setToast(
                                matches.length > 1
                                  ? "Multiple products share this SKU. Choose the correct product."
                                  : "No exact SKU match in this department. Check the department or choose a product below.",
                              );
                          }}
                        />
                      </div>
                      <span>{saleProducts.length} products</span>
                    </div>
                    <p className="scan-helper">
                      Scan a SKU barcode or enter an exact SKU, then press{" "}
                      <kbd>Enter</kbd> to add. Phones require an IMEI selection.
                    </p>
                    <div className="product-grid">
                      {saleProducts.map((p) => (
                        <button
                          className="product-card"
                          key={p.id}
                          onClick={() => addCart(p)}
                          disabled={!p.stock || !can("sales.manage")}
                        >
                          <div
                            className={`product-visual ${p.department.toLowerCase()}`}
                          >
                            <ProductIcon product={p} />
                            <span>{p.category}</span>
                          </div>
                          <small>{p.sku}</small>
                          <h3>{p.name}</h3>
                          <div>
                            <strong>{stockRetailLabel(data, p)}</strong>
                            <span
                              className={
                                p.stock <= p.reorderLevel ? "low-stock" : ""
                              }
                            >
                              {p.stock} available
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {cart.length > 0 && (
                      <a className="mobile-cart-shortcut" href="#current-sale">
                        <ShoppingBag size={18} />
                        <span>
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}{" "}
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
                        <strong>View sale ↓</strong>
                      </a>
                    )}
                    {!saleProducts.length && (
                      <div className="empty">
                        No products match your search.
                      </div>
                    )}
                  </section>
                  <section className="panel cart" id="current-sale">
                    <div className="panel-heading">
                      <h2>
                        Current sale{" "}
                        <span className="count">
                          {cart.reduce((a, c) => a + c.quantity, 0)}
                        </span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setCart([])}
                      >
                        Clear
                      </button>
                    </div>
                    <label className="field cart-customer">
                      <span>Customer · preferred price tier</span>
                      <select
                        value={saleCustomerId}
                        onChange={(e) => setSaleCustomerId(e.target.value)}
                      >
                        {data.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {c.priceTier || "Retail"}
                          </option>
                        ))}
                      </select>
                    </label>
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
                                <small>{c.imei || p.sku}</small>
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
                                  onClick={() =>
                                    setCart((prev) =>
                                      prev.map((r, j) =>
                                        j === i
                                          ? { ...r, quantity: r.quantity + 1 }
                                          : r,
                                      ),
                                    )
                                  }
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                              <div className="cart-pricing">
                                <label className="field">
                                  <span>Price tier</span>
                                  <select
                                    aria-label={`Price tier for ${p.name}`}
                                    value={c.priceTier || ""}
                                    onChange={(e) =>
                                      updateCartPricing(i, {
                                        priceTier: (e.target.value ||
                                          undefined) as PriceTier | undefined,
                                        unitPrice: undefined,
                                      })
                                    }
                                  >
                                    <option value="">Customer default</option>
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
                                        {tier}
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
                                    {batchContext.map(({ batch, quantity }) => {
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
                                              : money(prices.minimum)}{" "}
                                            –{" "}
                                            {prices.maximum === undefined
                                              ? "No maximum"
                                              : money(prices.maximum)}
                                          </small>
                                          <small>
                                            {PRICE_TIERS.filter(
                                              (tier) =>
                                                prices[tier] !== undefined,
                                            )
                                              .map(
                                                (tier) =>
                                                  `${tier} ${money(prices[tier]!)}`,
                                              )
                                              .join(" · ")}
                                          </small>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="batch-quotes">
                                  {cartQuote?.lines
                                    .filter((l) => l.cartIndex === i)
                                    .map((l, j) => (
                                      <div key={j}>
                                        <strong>
                                          {l.lot} · {l.priceTier}
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
                          );
                        })
                      ) : (
                        <div className="empty">
                          <ShoppingBag size={32} />
                          <h3>Start a new sale</h3>
                          <p>Select a product or scan a barcode.</p>
                        </div>
                      )}
                    </div>
                    <div className="cart-bottom">
                      <div>
                        <span>Subtotal</span>
                        <strong>
                          {cartPricingError
                            ? "Review pricing"
                            : money(cartTotal)}
                        </strong>
                      </div>
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
                        className="primary"
                        disabled={
                          !cart.length ||
                          !can("sales.manage") ||
                          !!cartPricingError
                        }
                        onClick={() => open("Checkout")}
                      >
                        Charge{" "}
                        {cartPricingError ? "Review pricing" : money(cartTotal)}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {!["Overview", "Point of sale", "Settings", "Reports"].includes(
                page,
              ) && (
                <div className="module-toolbar">
                  <div className="search-field">
                    <Search size={17} />
                    <input
                      aria-label={`Search ${page}`}
                      placeholder={`Search ${page.toLowerCase()}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
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
                      Export
                    </button>
                  </div>
                </div>
              )}
              {page === "Inventory" && (
                <section className="panel">
                  <Table
                    heads={[
                      "PRODUCT",
                      "DEPARTMENT",
                      "STOCK",
                      "SELLING PRICE",
                      "UNIT COST",
                      "TRACKING",
                      "STATUS",
                      "",
                    ]}
                    rows={products.map((p) => [
                      <div className="product-name">
                        <span className="mini-product">
                          <ProductIcon product={p} />
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.sku} · {p.category}
                          </small>
                        </span>
                      </div>,
                      p.department,
                      <span
                        className={p.stock <= p.reorderLevel ? "low-stock" : ""}
                      >
                        <strong>{p.stock}</strong> units{" "}
                        {p.stock <= p.reorderLevel && <small>Low stock</small>}
                      </span>,
                      money(p.price),
                      money(p.cost),
                      <Badge>{p.serialized ? "IMEI" : "Batch"}</Badge>,
                      <Badge>
                        {p.active === false ? "Inactive" : "Active"}
                      </Badge>,
                      <div className="row-buttons">
                        {rowAction("Batches", () => open("Product batches", p))}
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
                    ])}
                  />
                </section>
              )}
              {page === "Repairs" && (
                <section className="panel">
                  <Table
                    heads={[
                      "JOB / DEVICE",
                      "CUSTOMER",
                      "ISSUE",
                      "ESTIMATE",
                      "STATUS",
                      "",
                    ]}
                    rows={filtered(data.repairs).map((r) => [
                      <div>
                        <strong>{r.device}</strong>
                        <small>
                          {r.number} · {date(r.createdAt)}
                        </small>
                      </div>,
                      <div>
                        {r.customerName}
                        <small>{r.phone}</small>
                      </div>,
                      r.issue,
                      money(r.estimate),
                      <Badge>{r.status}</Badge>,
                      rowAction("Manage", () => open("Repair details", r)),
                    ])}
                  />
                </section>
              )}
              {page === "Customers" && (
                <section className="panel">
                  <Table
                    heads={["CUSTOMER", "PHONE", "SALES", "OUTSTANDING", ""]}
                    rows={filtered(data.customers).map((c) => {
                      const ss = data.sales.filter(
                        (s) => s.customerId === c.id && s.status !== "Returned",
                      );
                      return [
                        <div className="customer-cell">
                          <span className="avatar light">
                            {c.name
                              .split(" ")
                              .slice(0, 2)
                              .map((x) => x[0])
                              .join("")}
                          </span>
                          <strong>{c.name}</strong>
                        </div>,
                        c.phone || "—",
                        ss.length,
                        money(ss.reduce((a, s) => a + s.total - s.paid, 0)),
                        rowAction("Details", () => open("Customer details", c)),
                      ];
                    })}
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
              {page === "Expenses" && (
                <>
                  <div className="inline-summary">
                    <span>Total recorded expenses</span>
                    <strong>{money(expenses)}</strong>
                  </div>
                  <section className="panel">
                    <Table
                      heads={[
                        "DESCRIPTION",
                        "CATEGORY",
                        "DEPARTMENT",
                        "DATE",
                        "AMOUNT",
                      ]}
                      rows={filtered(data.expenses).map((e) => [
                        <strong>{e.description}</strong>,
                        e.category,
                        e.department,
                        date(e.date),
                        money(e.amount),
                      ])}
                    />
                  </section>
                </>
              )}
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
                    advances. Review the payroll calculation before payment.
                  </div>
                  <section className="panel">
                    <Table
                      heads={[
                        "TEAM MEMBER",
                        "ROLE",
                        "BASIC SALARY",
                        "ADVANCES",
                        "COMMISSION PAID",
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
                <>
                  <div className="module-toolbar">
                    <div className="department-tabs">
                      {["Summary", "Sales", "Journal", "Audit trail"].map(
                        (t) => (
                          <button
                            className={reportTab === t ? "selected" : ""}
                            key={t}
                            onClick={() => setReportTab(t)}
                          >
                            {t}
                          </button>
                        ),
                      )}
                    </div>
                    <button className="secondary" onClick={exportData}>
                      <Download size={15} />
                      Export sales
                    </button>
                  </div>
                  {reportTab === "Summary" ? (
                    <div className="report-layout">
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Operating performance</h2>
                            <p>All recorded transactions · accrual view</p>
                          </div>
                          <BarChart3 size={22} />
                        </div>
                        <div className="report-lines">
                          {[
                            [
                              "Gross margin & provider commissions",
                              totalMargin,
                            ],
                            ["Staff & agent commission expense", -commissions],
                            ["Operating expenses", -expenses],
                            ["Postage & delivery charges", -postage],
                          ].map(([l, v]) => (
                            <div key={l}>
                              <span>{l}</span>
                              <strong>{money(Number(v))}</strong>
                            </div>
                          ))}
                          <div className="report-total">
                            <span>Estimated operating result</span>
                            <strong>
                              {money(
                                totalMargin - commissions - expenses - postage,
                              )}
                            </strong>
                          </div>
                        </div>
                        <p className="footnote padded">
                          All departments. Before any unrecorded costs or tax.
                          Gross margin includes completed repairs; operating
                          expenses include recorded payroll and stock
                          write-offs. Sales and expenses are recorded separately
                          from cash collections.
                        </p>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Balances at a glance</h2>
                        </div>
                        <div className="report-lines">
                          <div>
                            <span>Customer credit outstanding</span>
                            <strong>{money(outstanding)}</strong>
                          </div>
                          <div>
                            <span>COD pending collection</span>
                            <strong>{money(codPending)}</strong>
                          </div>
                          <div>
                            <span>Inventory at acquisition cost</span>
                            <strong>{money(inventoryValue)}</strong>
                          </div>
                          <div>
                            <span>Supplier balances</span>
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
                          Outstanding payments and unsold stock are not
                          additional earned profit.
                        </p>
                      </section>
                    </div>
                  ) : reportTab === "Sales" ? (
                    <section className="panel">{salesTable(sales)}</section>
                  ) : reportTab === "Journal" ? (
                    <section className="panel">
                      <Table
                        heads={[
                          "REFERENCE",
                          "DESCRIPTION / ACCOUNT",
                          "DEBIT",
                          "CREDIT",
                        ]}
                        rows={data.journal.flatMap((j) =>
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
                        rows={data.audit.map((a) => [
                          new Date(a.at).toLocaleString("en-GB", {
                            timeZone: "Asia/Colombo",
                          }),
                          a.action,
                          a.detail,
                        ])}
                      />
                    </section>
                  )}
                </>
              )}
              {page === "Settings" && (
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
                        repairStaffPercent: Number(f.get("repairStaffPercent")),
                        commissionConfirmed:
                          f.get("commissionConfirmed") === "on",
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
                      <h3>Commission rules</h3>
                      <p className="muted">
                        Accessory commission is calculated on profit. Agent
                        share is a portion of that single pool. Without an
                        agent, the salesperson receives the entire pool. Confirm
                        this rule with the owner before enabling it.
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
                                onClick={() => action("retrySms", { id: s.id })}
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
              )}
            </>
          )}
          <footer className="footer">
            <span>Fido LK · A little more clarity. Every day.</span>
            <span>LKR · Sri Lanka</span>
          </footer>
        </main>
      </div>
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
            className={`modal ${modal === "Repair details" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">FIDO LK</span>
                <h2>{modal}</h2>
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
                  close={() => setModal(null)}
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
                    if (modal === "Receive stock") {
                      type = "receiveStock";
                      p = {
                        productId: str("productId"),
                        pricing: readPricing(f),
                        supplier: str("supplier"),
                        quantity: num("quantity"),
                        unitCost: amt("unitCost"),
                        lot: str("lot"),
                        imeis: str("imeis")
                          .split(/[\s,]+/)
                          .filter(Boolean),
                        paid: amt("paid"),
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
                      p = {
                        customerId: saleCustomerId,
                        overrideReason: checkoutReason,
                        items: cart,
                        quoteSignature: cartQuote
                          ? quoteSignature(cartQuote)
                          : undefined,
                        discount: amt("discount"),
                        paid: amt("paid"),
                        method: str("method"),
                        agentId: str("agentId") || undefined,
                        dueDate: str("dueDate") || undefined,
                      };
                      if (cartPricingError) {
                        setToast(cartPricingError);
                        return;
                      }
                      if (amt("paid") > cartTotal) {
                        setToast(
                          "Payment exceeds the sale total after discount.",
                        );
                        return;
                      }
                    }
                    const updated = await action(type, p);
                    if (updated && type === "createSale") {
                      const created = updated.sales.find(
                        (s) => !data.sales.some((old) => old.id === s.id),
                      );
                      if (created) setReceipt(created);
                      setCart([]);
                      setSaleCustomerId("cust-walkin");
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
                          label="Department"
                          name="department"
                          value="Phones"
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
                      <PricingFields />
                      <label className="checkbox">
                        <input type="checkbox" name="serialized" />
                        Track individual units by IMEI / serial number
                      </label>
                      <p className="footnote">
                        Receive stock separately to create a costed batch.
                      </p>
                    </>
                  )}
                  {modal === "Receive stock" && (
                    <>
                      <label className="field">
                        <span>Product</span>
                        <select
                          name="productId"
                          required
                          value={receiveProductId}
                          onChange={(e) => setReceiveProductId(e.target.value)}
                        >
                          {data.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.sku}
                            </option>
                          ))}
                        </select>
                      </label>
                      <PricingFields
                        key={receiveProductId}
                        pricing={
                          data.products.find((p) => p.id === receiveProductId)
                            ? getPricing(
                                data.products.find(
                                  (p) => p.id === receiveProductId,
                                )!,
                              )
                            : undefined
                        }
                      />
                      <Field label="Supplier" name="supplier" required />
                      <div className="form-grid">
                        <Field label="Batch / lot number" name="lot" required />
                        <Field
                          label="Quantity received"
                          name="quantity"
                          type="number"
                          min={1}
                          value={1}
                          required
                        />
                        <Field
                          label="Unit cost (Rs.)"
                          name="unitCost"
                          type="number"
                          min={0}
                          step="0.01"
                          required
                        />
                        <Field
                          label="Amount paid (Rs.)"
                          name="paid"
                          type="number"
                          min={0}
                          step="0.01"
                          value={0}
                        />
                      </div>
                      <label className="field">
                        <span>IMEIs / serial numbers</span>
                        <textarea
                          name="imeis"
                          placeholder="One per line, required for serialized products"
                        />
                      </label>
                      <p className="footnote">
                        The unpaid amount is recorded as a supplier balance.
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
                        PIN/password or pattern dot sequence (1–9, left to
                        right). Encrypted on the server, visible only to
                        authorized repair staff, and cleared on collection.
                        Never put device credentials in ordinary notes.
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
                          <option key={tier}>{tier}</option>
                        ))}
                      </Field>
                      <Field label="Customer name" name="name" required />
                      <Field
                        label="Phone number"
                        name="phone"
                        type="tel"
                        required
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
                        <Field label="Department" name="department">
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
                        Refund {money(selected.paid)} and cancel credit of{" "}
                        {money(selected.total - selected.paid)}. Earned
                        commissions are reversed.
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
                      <div className="checkout-total">
                        <span>Cart total</span>
                        <strong>
                          {cartPricingError
                            ? "Review pricing"
                            : money(cartTotal)}
                        </strong>
                      </div>
                      <label className="field">
                        <span>Customer · preferred tier</span>
                        <select
                          name="customerId"
                          value={saleCustomerId}
                          onChange={(e) => setSaleCustomerId(e.target.value)}
                        >
                          {data.customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.priceTier || "Retail"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-grid">
                        <label className="field">
                          <span>Invoice discount (Rs.)</span>
                          <input
                            name="discount"
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!can("sales.discount")}
                            value={checkoutDiscount}
                            onChange={(e) =>
                              setCheckoutDiscount(e.target.value)
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Payment received (Rs.)</span>
                          <input
                            name="paid"
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              checkoutPaid ??
                              (cartPricingError ? "" : cartTotal / 100)
                            }
                            onChange={(e) => setCheckoutPaid(e.target.value)}
                          />
                        </label>
                      </div>
                      <label className="field">
                        <span>Payment method</span>
                        <select
                          name="method"
                          value={checkoutMethod}
                          onChange={(e) => {
                            setCheckoutMethod(e.target.value);
                            if (e.target.value === "Credit")
                              setCheckoutPaid("0");
                          }}
                        >
                          {["Cash", "Card", "Bank transfer", "Credit"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                      {can("sales.priceOverride") && (
                        <label className="field">
                          <span>Invoice price override reason</span>
                          <input
                            value={checkoutReason}
                            onChange={(e) => setCheckoutReason(e.target.value)}
                            placeholder="Required if invoice discount exceeds a price limit"
                          />
                        </label>
                      )}
                      {cartPricingError && (
                        <p className="pricing-error" role="alert">
                          {cartPricingError}
                        </p>
                      )}
                      <div className="batch-quotes">
                        {cartQuote?.lines.map((l, i) => (
                          <div key={i}>
                            <strong>
                              {l.name} · {l.lot} · {l.priceTier}
                            </strong>
                            <span>
                              {l.quantity} × {money(l.price)} · Net{" "}
                              {money(l.total ?? l.price * l.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {(checkoutMethod === "Credit" ||
                        (checkoutPaid !== null &&
                          cents(checkoutPaid) < cartTotal)) && (
                        <Field
                          label="Credit payment due date"
                          name="dueDate"
                          type="date"
                          value={futureDay(30)}
                          required
                        />
                      )}
                      <Field label="Referring agent (optional)" name="agentId">
                        <option value="">
                          No agent — staff receives full pool
                        </option>
                        {(data.agents || [])
                          .filter((a) => a.active)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} · {a.defaultSharePercent}% of pool
                            </option>
                          ))}
                      </Field>
                      <p className="footnote">
                        Enter the amount applied to this invoice, excluding any
                        cash change. Any unpaid amount becomes customer credit.
                        Select a named customer for credit sales.
                      </p>
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
                      className="primary"
                      disabled={
                        busy || (modal === "Checkout" && !!cartPricingError)
                      }
                    >
                      {busy
                        ? "Saving…"
                        : modal === "Checkout"
                          ? "Complete sale"
                          : "Save changes"}
                      <Check size={16} />
                    </button>
                  </div>
                </form>
              )}
              {modal === "Select IMEI" && (
                <>
                  <p>Select the exact unit being sold.</p>
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
              {modal === "Product batches" && (
                <>
                  <h3>{selected.name}</h3>
                  <PriceSummary
                    pricing={getPricing(
                      data.products.find((p) => p.id === selected.id) ||
                        selected,
                    )}
                  />
                  {can("inventory.manage") && (
                    <button
                      className="secondary small"
                      onClick={() =>
                        open(
                          "Edit product prices",
                          data.products.find((p) => p.id === selected.id) ||
                            selected,
                        )
                      }
                    >
                      Edit product defaults
                    </button>
                  )}
                  <Table
                    heads={[
                      "BATCH",
                      "SUPPLIER",
                      "REMAINING",
                      "UNIT COST",
                      "SELLING PRICES",
                      "",
                    ]}
                    rows={data.batches
                      .filter((b) => b.productId === selected.id)
                      .map((b) => [
                        b.lot,
                        b.supplier,
                        `${b.remaining} / ${b.quantity}`,
                        money(b.unitCost),
                        <PriceSummary
                          key="prices"
                          pricing={getPricing(
                            data.products.find((p) => p.id === b.productId)!,
                            b,
                          )}
                        />,
                        can("purchasing.manage")
                          ? rowAction("Edit prices", () =>
                              open("Edit batch prices", b),
                            )
                          : "—",
                      ])}
                  />
                  <div className="modal-footer">
                    <button
                      disabled={
                        !!actionPermission[modalAction["Receive stock"]] &&
                        !can(actionPermission[modalAction["Receive stock"]])
                      }
                      className="primary"
                      onClick={() => open("Receive stock", selected)}
                    >
                      <Plus size={16} />
                      Receive stock
                    </button>
                  </div>
                </>
              )}
              {modal === "Repair details" && (
                <RepairDetails
                  repair={
                    data.repairs.find((r) => r.id === selected.id) || selected
                  }
                  action={action}
                  busy={busy}
                  can={can}
                  open={open}
                />
              )}
              {modal === "Customer details" && (
                <>
                  <h3>{selected.name}</h3>
                  <p>{selected.phone}</p>
                  {data.sales
                    .filter((s) => s.customerId === selected.id)
                    .map((s) => (
                      <div className="customer-sale" key={s.id}>
                        <div>
                          <strong>{s.number}</strong>
                          <small>
                            {money(s.total)} · Paid {money(s.paid)}
                          </small>
                        </div>
                        {s.total > s.paid && s.status !== "Returned" ? (
                          <button
                            disabled={
                              !!actionPermission[
                                modalAction["Collect payment"]
                              ] &&
                              !can(
                                actionPermission[
                                  modalAction["Collect payment"]
                                ],
                              )
                            }
                            className="secondary small"
                            onClick={() => open("Collect payment", s)}
                          >
                            Collect {money(s.total - s.paid)}
                          </button>
                        ) : (
                          <Badge>{s.status}</Badge>
                        )}
                      </div>
                    ))}
                </>
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
                      disabled={!can("dashboard.view")}
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
                        {l.priceTier} · {l.lot || ""} · Tier{" "}
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
                <span>Paid · {receipt.method}</span>
                <span>{money(receipt.paid)}</span>
              </div>
              <div className="receipt-line">
                <span>Balance</span>
                <span>{money(receipt.total - receipt.paid)}</span>
              </div>
              <hr />
              <p>Thank you for shopping with Fido LK.</p>
              {mode === "demo" && <p>DEMO RECEIPT</p>}
            </div>
            <div className="modal-footer no-print">
              {receipt.status !== "Returned" && can("sales.manage") && (
                <>
                  <button
                    className="secondary small"
                    onClick={() => {
                      open("Return items", receipt);
                      setReceipt(null);
                    }}
                  >
                    Return items
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      open("Return invoice", receipt);
                      setReceipt(null);
                    }}
                  >
                    Return invoice
                  </button>
                </>
              )}
              <button className="secondary" onClick={() => setReceipt(null)}>
                Done
              </button>
              <button className="primary" onClick={() => window.print()}>
                <Printer size={16} />
                Print receipt
              </button>
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
            <stop offset="0%" stopColor="#3264eb" stopOpacity=".14" />
            <stop offset="100%" stopColor="#3264eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[36, 100, 164].map((y) => (
          <line
            key={y}
            x1="35"
            x2="603"
            y1={y}
            y2={y}
            stroke="#edf0f4"
            strokeDasharray="4 4"
          />
        ))}
        <polygon points={`48,164 ${points} 582,164`} fill="url(#chartFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#3264eb"
          strokeWidth="2.7"
          strokeLinejoin="round"
        />
        {days.map((d, i) => (
          <circle
            key={i}
            cx={48 + i * 89}
            cy={164 - (d.value / max) * 128}
            r={i === 6 ? 4.5 : 3}
            fill={i === 6 ? "#3264eb" : "white"}
            stroke="#3264eb"
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
}: {
  can: (p: string) => boolean;
  open: (m: string, s?: any) => void;
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
        <div>
          <h3>{r.device}</h3>
          <p>
            {r.number} · {r.customerName} · {r.phone}
          </p>
        </div>
        <Badge>{r.status}</Badge>
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
            {credential}
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
      {can("repairs.manage") && next[r.status] && (
        <form
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
  if (page === "Purchases")
    return (
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
          rows={(data.purchaseOrders || [])
            .slice()
            .reverse()
            .map((po) => [
              <div>
                <strong>{po.number}</strong>
                <small>{po.supplierName}</small>
              </div>,
              `${po.lines.reduce((a, l) => a + l.ordered, 0)} / ${po.lines.reduce((a, l) => a + l.received, 0)} units`,
              money(po.total),
              date(po.dueDate),
              <Badge>{po.status}</Badge>,
              ["Ordered", "Partially received"].includes(po.status)
                ? actionButton("Receive goods", "Receive purchase order", po)
                : "—",
            ])}
        />
      </section>
    );
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
      <div className="extension-stack">
        <div className="alert-controls">
          <div>
            <strong>Stay ahead of arrivals</strong>
            <p>
              Arrival times are checked every second on this page; saved
              acknowledgements refresh across devices every 10 seconds.
              Acknowledge explicitly when you will collect the part.
            </p>
          </div>
          <PushEnableButton notify={notify} />
        </div>
        <section className="panel">
          <Table
            heads={["ALERT", "ARRIVAL", "ASSIGNED TO", "STATUS", "ACTIONS"]}
            rows={filter(data.alerts || [])
              .slice()
              .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
              .map((a) => [
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.busRoute} · {a.arrivalLocation}
                  </small>
                  <small>{a.minutesBefore} minute advance reminder</small>
                </div>,
                new Date(a.dueAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Colombo",
                }),
                a.assigneeName || "Unassigned",
                <div>
                  <Badge>{a.status}</Badge>
                  {a.acknowledgedAt && (
                    <small>
                      Acknowledged by {a.acknowledgedByName || "staff"} ·{" "}
                      {new Date(a.acknowledgedAt).toLocaleString("en-GB", {
                        timeZone: "Asia/Colombo",
                      })}
                    </small>
                  )}
                </div>,
                <div className="row-buttons">
                  {!["Acknowledged", "Cancelled"].includes(a.status) &&
                    user &&
                    canAcknowledgeAlert(a, user) && (
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() => action("acknowledgeAlert", { id: a.id })}
                      >
                        Acknowledge
                      </button>
                    )}
                  {!["Acknowledged", "Cancelled", "Escalated"].includes(
                    a.status,
                  ) &&
                    can("alerts.manage") && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => action("escalateAlert", { id: a.id })}
                      >
                        Escalate
                      </button>
                    )}
                </div>,
              ])}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>SMS delivery status</h2>
            <p>Gateway results, never assumed delivery</p>
          </div>
          <Table
            heads={["RECIPIENT", "MESSAGE", "STATUS"]}
            rows={data.sms
              .slice(-8)
              .reverse()
              .map((m) => [
                m.phone,
                <span className="wrap-cell">{m.message}</span>,
                <Badge>{m.status}</Badge>,
              ])}
          />
        </section>
      </div>
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
        <div className="metrics small-metrics">
          <Metric
            label="Recognized gross margin"
            value={money(recognized)}
            note="Completed sales & repairs, before overhead"
            icon={<BarChart3 size={18} />}
          />
          <Metric
            label="Cash-realized margin"
            value={money(realized)}
            note="Gross margin allocated to collected payments"
            icon={<Banknote size={18} />}
          />
          <Metric
            label="Uncollected margin"
            value={money(recognized - realized)}
            note="Recognized margin still tied to unpaid balances"
            icon={<Wallet size={18} />}
          />
        </div>
        <p className="margin-definition">
          Cash-realized margin is a proportional management view: each sale or
          completed repair’s positive gross margin × its collected share.
          Uncollected margin is the difference. These figures exclude provider
          commissions and are before commissions and operating expenses; they do
          not replace the accounting P&amp;L.
        </p>
        <details className="panel reporting-details">
          <summary>
            Balances, aging & reconciliation <ChevronDown size={16} />
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
  close,
}: {
  modal: string;
  selected: any;
  data: Workspace;
  action: ExtensionProps["action"];
  busy: boolean;
  close: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>(
    selected?.permissions || presets["Sales & service"],
  );
  const [role, setRole] = useState(selected?.role || "Sales & service");
  const [poLines, setPoLines] = useState<
    { productId: string; quantity: number; unitCost: number }[]
  >([{ productId: "", quantity: 1, unitCost: 0 }]);
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
              busRoute: str("busRoute"),
              arrivalLocation: str("arrivalLocation"),
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
              reason: str("reason"),
            };
            break;
        }
        await action(type, p);
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
        <>
          <Field
            label="Alert title"
            name="title"
            value="Collect incoming spare part"
            required
          />
          <div className="form-grid">
            <Field label="Bus route / bus details" name="busRoute" required />
            <Field
              label="Collection location"
              name="arrivalLocation"
              required
            />
            <Field
              label="Expected arrival (Sri Lanka time)"
              name="dueAt"
              type="datetime-local"
              required
            />
            <Field
              label="Alert before arrival (minutes)"
              name="minutesBefore"
              type="number"
              min={0}
              value={10}
            />
          </div>
          <Field label="Assigned staff member" name="assigneeUserId" required>
            <option value="">Choose a staff account</option>
            {((data as any).users || [])
              .filter((u: any) => u.active)
              .map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Field>
          <Field label="Linked repair (optional)" name="repairId">
            <option value="">No linked repair</option>
            {data.repairs
              .filter((r) => !["Collected", "Declined"].includes(r.status))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.device}
                </option>
              ))}
          </Field>
          <p className="footnote">
            The assignee must acknowledge collection responsibility. Escalation
            and SMS status appear in Alerts.
          </p>
        </>
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
          <Field label="Return reason" name="reason" required />
          <p className="footnote">
            Exchange creates credit/refund for this return; complete the
            replacement as a separate POS sale. Discounts and commissions are
            adjusted by the server.
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
function DeviceSecretInput() {
  const [mode, setMode] = useState("None");
  const [pattern, setPattern] = useState<number[]>([]);
  const [secret, setSecret] = useState("");
  const [drawing, setDrawing] = useState(false);
  function add(n: number) {
    setPattern((p) => (p.includes(n) ? p : [...p, n]));
  }
  return (
    <div className="device-secret-input">
      <label className="field">
        <span>Device access (optional)</span>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setPattern([]);
            setSecret("");
          }}
        >
          <option>None</option>
          <option>PIN / password</option>
          <option>Pattern</option>
        </select>
      </label>
      <input
        type="hidden"
        name="deviceAccessSecret"
        value={
          mode === "Pattern" && pattern.length
            ? `Pattern: ${pattern.join("-")}`
            : mode === "PIN / password"
              ? secret
              : ""
        }
      />
      {mode === "PIN / password" && (
        <label className="field">
          <span>PIN / password</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {mode === "Pattern" && (
        <>
          <div
            className="pattern-grid"
            onPointerUp={() => setDrawing(false)}
            onPointerLeave={() => setDrawing(false)}
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                className={pattern.includes(n) ? "chosen" : ""}
                aria-label={`Pattern dot ${n}${pattern.includes(n) ? `, step ${pattern.indexOf(n) + 1}` : ""}`}
                onPointerDown={() => {
                  setDrawing(true);
                  add(n);
                }}
                onPointerEnter={() => {
                  if (drawing) add(n);
                }}
                onClick={() => add(n)}
              >
                {n}
                <small>
                  {pattern.includes(n) ? pattern.indexOf(n) + 1 : ""}
                </small>
              </button>
            ))}
          </div>
          <div className="pattern-caption">
            <small>
              Draw or tap dots in order. Sequence:{" "}
              {pattern.join(" → ") || "not entered"}
            </small>
            <button
              type="button"
              className="text-button"
              onClick={() => setPattern([])}
            >
              Clear pattern
            </button>
          </div>
        </>
      )}
    </div>
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
        <div className="notice auth-error">{loadError}</div>
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
}: {
  pricing?: PriceSettings;
  prefix?: string;
  required?: boolean;
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
                  : `${key} price`
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
function PriceSummary({ pricing }: { pricing: PriceSettings }) {
  return (
    <div className="price-summary">
      {PRICE_TIERS.map((tier) => (
        <span key={tier}>
          {tier}{" "}
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
  if (!batches.length) return `Retail ${money(getPricing(product).Retail)}`;
  const prices = batches.map((batch) => getPricing(product, batch).Retail);
  if (product.serialized && Math.min(...prices) !== Math.max(...prices))
    return `Retail ${money(Math.min(...prices))}–${money(Math.max(...prices))}`;
  return `Retail ${money(prices[0])}`;
}
