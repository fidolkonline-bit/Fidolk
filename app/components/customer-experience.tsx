"use client";

import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Customer,
  PaymentMethod,
  PriceTier,
  Sale,
  Shipment,
} from "@/lib/types";
import { priceTierLabel } from "@/lib/pricing";
import {
  allocateCustomerPayment,
  canonicalSriLankanPhone,
  customerFinancialSummary,
  customerMatches,
  isWalkInCustomer,
  saleBalance,
} from "@/lib/customers";
import styles from "./customer-experience.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(value / 100);
const shortDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Colombo",
      })
    : "No purchases yet";
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

type CommonProps = {
  customers: Customer[];
  sales: Sale[];
  shipments: Shipment[];
};

export function CustomerPicker({
  customers,
  sales,
  shipments,
  value,
  onChange,
  canCreate,
  canCollect,
  onQuickAdd,
  onCollect,
  onView,
  priceTierLabels,
}: CommonProps & {
  value: string;
  onChange: (id: string) => void;
  canCreate: boolean;
  canCollect: boolean;
  onQuickAdd: (query: string) => void;
  onCollect: (customer: Customer) => void;
  onView: (customer: Customer) => void;
  priceTierLabels?: Partial<Record<PriceTier, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected =
    customers.find((customer) => customer.id === value) || customers[0];
  const named = useMemo(
    () =>
      customers
        .filter(
          (customer) =>
            !isWalkInCustomer(customer) && customerMatches(customer, query),
        )
        .slice(0, 7),
    [customers, query],
  );
  const phone = canonicalSriLankanPhone(query);
  const exactPhone =
    !!phone &&
    customers.some(
      (customer) => canonicalSriLankanPhone(customer.phone) === phone,
    );
  const choices = [{ id: "cust-walkin" }, ...named];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => setActive(0), [query]);

  const choose = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };
  const summary =
    selected && !isWalkInCustomer(selected)
      ? customerFinancialSummary(selected, sales, shipments)
      : null;

  return (
    <div className={styles.pickerWrap} ref={root}>
      <label className={styles.fieldLabel} htmlFor={`${listId}-input`}>
        Search or select <span>· name or phone</span>
      </label>
      <div className={`${styles.combobox} ${open ? styles.comboboxOpen : ""}`}>
        <Search size={17} aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          value={open ? query : selected?.name || "Walk-in customer"}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            const max =
              choices.length +
              (canCreate && query.trim() && !exactPhone ? 1 : 0);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % max);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index - 1 + max) % max);
            } else if (event.key === "Escape") setOpen(false);
            else if (event.key === "Enter") {
              event.preventDefault();
              if (active < choices.length) choose(choices[active].id);
              else onQuickAdd(query);
            }
          }}
          placeholder="Search customer or 077…"
        />
        {selected && !isWalkInCustomer(selected) && !open && (
          <span className={styles.tier}>
            {priceTierLabel(priceTierLabels, selected.priceTier || "Retail")}
          </span>
        )}
        <ChevronDown size={16} aria-hidden />
      </div>
      {open && (
        <div className={styles.results} id={listId} role="listbox">
          <div className={styles.resultCaption}>
            {query ? "Matching customers" : "Quick access"}
          </div>
          <button
            id={`${listId}-0`}
            role="option"
            aria-selected={active === 0}
            className={active === 0 ? styles.activeResult : ""}
            onMouseEnter={() => setActive(0)}
            onClick={() => choose("cust-walkin")}
          >
            <span className={styles.walkinIcon}>
              <UserRound size={17} />
            </span>
            <span>
              <strong>Walk-in customer</strong>
              <small>Fast cash sale · no customer record</small>
            </span>
          </button>
          {named.map((customer, index) => {
            const financial = customerFinancialSummary(
              customer,
              sales,
              shipments,
            );
            return (
              <button
                key={customer.id}
                id={`${listId}-${index + 1}`}
                role="option"
                aria-selected={active === index + 1}
                className={active === index + 1 ? styles.activeResult : ""}
                onMouseEnter={() => setActive(index + 1)}
                onClick={() => choose(customer.id)}
              >
                <span className={styles.avatar}>{initials(customer.name)}</span>
                <span className={styles.resultIdentity}>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.phone} ·{" "}
                    {priceTierLabel(
                      priceTierLabels,
                      customer.priceTier || "Retail",
                    )}
                  </small>
                </span>
                <span
                  className={
                    financial.outstanding
                      ? styles.balanceDue
                      : styles.balanceClear
                  }
                >
                  {financial.outstanding
                    ? money(financial.outstanding)
                    : "Clear"}
                </span>
              </button>
            );
          })}
          {!named.length && query && (
            <p className={styles.noMatch}>No matching customer found.</p>
          )}
          {canCreate && query.trim() && !exactPhone && (
            <button
              id={`${listId}-${choices.length}`}
              role="option"
              aria-selected={active === choices.length}
              className={`${styles.createResult} ${active === choices.length ? styles.activeResult : ""}`}
              onMouseEnter={() => setActive(choices.length)}
              onClick={() => onQuickAdd(query)}
            >
              <span className={styles.addIcon}>
                <Plus size={17} />
              </span>
              <span>
                <strong>Create customer</strong>
                <small>Add “{query.trim()}” without leaving this sale</small>
              </span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      {selected && summary && (
        <CustomerBalanceCard
          customer={selected}
          priceTierLabels={priceTierLabels}
          summary={summary}
          canCollect={canCollect}
          onCollect={() => onCollect(selected)}
          onView={() => onView(selected)}
        />
      )}
    </div>
  );
}

function CustomerBalanceCard({
  customer,
  priceTierLabels,
  summary,
  canCollect,
  onCollect,
  onView,
}: {
  customer: Customer;
  priceTierLabels?: Partial<Record<PriceTier, string>>;
  summary: ReturnType<typeof customerFinancialSummary>;
  canCollect: boolean;
  onCollect: () => void;
  onView: () => void;
}) {
  const overdue = summary.overdue > 0;
  return (
    <aside
      className={`${styles.balanceCard} ${overdue ? styles.overdueCard : ""}`}
    >
      <div className={styles.identityLine}>
        <span className={styles.avatar}>{initials(customer.name)}</span>
        <span>
          <strong>{customer.name}</strong>
          <small>
            {customer.phone} ·{" "}
            {priceTierLabel(priceTierLabels, customer.priceTier || "Retail")}
          </small>
        </span>
      </div>
      <div className={styles.balanceRail}>
        <small>{summary.outstanding ? "Outstanding" : "Account clear"}</small>
        <strong
          className={
            summary.outstanding ? styles.balanceDue : styles.balanceClear
          }
        >
          {money(summary.outstanding)}
        </strong>
        <span>
          {summary.openInvoices.length} open{" "}
          {summary.openInvoices.length === 1 ? "invoice" : "invoices"}
          {overdue ? ` · ${summary.overdueInvoices.length} overdue` : ""}
        </span>
        {summary.outstanding > summary.collectibleOutstanding && (
          <span>
            {money(summary.outstanding - summary.collectibleOutstanding)} in
            active COD
          </span>
        )}
      </div>
      <div className={styles.cardActions}>
        <button type="button" className={styles.quietButton} onClick={onView}>
          View profile
        </button>
        <button
          type="button"
          className={styles.collectButton}
          onClick={onCollect}
          disabled={!canCollect || !summary.collectibleOutstanding}
        >
          <Banknote size={15} /> Collect outstanding
        </button>
      </div>
    </aside>
  );
}

export function CustomerDirectory({
  customers,
  sales,
  shipments,
  onOpen,
}: CommonProps & {
  onOpen: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "With balance" | "Overdue">(
    "All",
  );
  const named = customers.filter((customer) => !isWalkInCustomer(customer));
  const rows = named
    .map((customer) => ({
      customer,
      summary: customerFinancialSummary(customer, sales, shipments),
    }))
    .filter(
      ({ customer, summary }) =>
        customerMatches(customer, query) &&
        (filter === "All" ||
          (filter === "With balance"
            ? summary.outstanding > 0
            : summary.overdue > 0)),
    );
  const totals = named.map((customer) =>
    customerFinancialSummary(customer, sales, shipments),
  );
  const receivable = totals.reduce((sum, item) => sum + item.outstanding, 0);
  const overdue = totals.reduce((sum, item) => sum + item.overdue, 0);

  return (
    <section className={styles.directory}>
      <div className={styles.metrics}>
        <div>
          <Users size={18} />
          <span>
            <small>Named customers</small>
            <strong>{named.length}</strong>
          </span>
        </div>
        <div>
          <WalletCards size={18} />
          <span>
            <small>Total receivable</small>
            <strong>{money(receivable)}</strong>
          </span>
        </div>
        <div className={overdue ? styles.metricDanger : ""}>
          <Clock3 size={18} />
          <span>
            <small>Overdue receivable</small>
            <strong>{money(overdue)}</strong>
          </span>
        </div>
        <div>
          <CreditCard size={18} />
          <span>
            <small>Customers with balances</small>
            <strong>{totals.filter((item) => item.outstanding).length}</strong>
          </span>
        </div>
      </div>
      <div className={styles.directoryToolbar}>
        <label>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or phone…"
            aria-label="Search customers"
          />
        </label>
        <div className={styles.filters} aria-label="Customer filters">
          {(["All", "With balance", "Overdue"] as const).map((item) => (
            <button
              key={item}
              className={filter === item ? styles.activeFilter : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className={styles.customerTable}>
          <div className={styles.tableHead}>
            <span>Customer</span>
            <span>Recent activity</span>
            <span>Relationship</span>
            <span>Balance</span>
            <span />
          </div>
          {rows.map(({ customer, summary }) => (
            <button
              className={styles.customerRow}
              key={customer.id}
              onClick={() => onOpen(customer)}
            >
              <span className={styles.customerIdentity}>
                <span className={styles.avatar}>{initials(customer.name)}</span>
                <span>
                  <strong>{customer.name}</strong>
                  <small>
                    <Phone size={11} /> {customer.phone}
                  </small>
                </span>
              </span>
              <span className={styles.mobileRelationship}>
                Last purchase {shortDate(summary.lastSaleAt)} ·{" "}
                {summary.sales.length}{" "}
                {summary.sales.length === 1 ? "sale" : "sales"} ·{" "}
                {money(summary.totalSales)} lifetime
              </span>
              <span>
                <small>Last purchase</small>
                <strong>{shortDate(summary.lastSaleAt)}</strong>
              </span>
              <span>
                <small>
                  {summary.sales.length}{" "}
                  {summary.sales.length === 1 ? "sale" : "sales"}
                </small>
                <strong>{money(summary.totalSales)} lifetime</strong>
              </span>
              <span>
                <small>
                  {summary.overdue
                    ? `${summary.overdueInvoices.length} overdue`
                    : summary.outstanding
                      ? `${summary.openInvoices.length} open`
                      : "Up to date"}
                </small>
                <strong
                  className={
                    summary.overdue
                      ? styles.overdueText
                      : summary.outstanding
                        ? styles.balanceDue
                        : styles.balanceClear
                  }
                >
                  {money(summary.outstanding)}
                </strong>
              </span>
              <span className={styles.openAction}>
                Open <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Search size={24} />
          <h3>No customers found</h3>
          <p>Try another name, phone number, or balance filter.</p>
          <button
            onClick={() => {
              setQuery("");
              setFilter("All");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}

export function CustomerProfile({
  customer,
  priceTierLabels,
  sales,
  shipments,
  canCollect,
  onCollect,
  onStartSale,
}: {
  customer: Customer;
  priceTierLabels?: Partial<Record<PriceTier, string>>;
  sales: Sale[];
  shipments: Shipment[];
  canCollect: boolean;
  onCollect: () => void;
  onStartSale: () => void;
}) {
  const summary = customerFinancialSummary(customer, sales, shipments);
  const settled = summary.sales
    .filter((sale) => !summary.openInvoices.some((open) => open.id === sale.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className={styles.profile}>
      <header className={styles.profileHeader}>
        <span className={styles.profileAvatar}>{initials(customer.name)}</span>
        <div>
          <span className={styles.kicker}>CUSTOMER PROFILE</span>
          <h3>{customer.name}</h3>
          <p>
            <Phone size={13} /> {customer.phone}
            {customer.address ? ` · ${customer.address}` : ""}
          </p>
        </div>
        <span className={styles.profileTier}>
          {priceTierLabel(priceTierLabels, customer.priceTier || "Retail")}{" "}
          pricing
        </span>
      </header>
      <div className={styles.profileMetrics}>
        <div>
          <small>Total sales</small>
          <strong>{money(summary.totalSales)}</strong>
          <span>{summary.sales.length} invoices</span>
        </div>
        <div>
          <small>Outstanding</small>
          <strong
            className={
              summary.outstanding ? styles.balanceDue : styles.balanceClear
            }
          >
            {money(summary.outstanding)}
          </strong>
          <span>{summary.openInvoices.length} open</span>
        </div>
        <div>
          <small>Overdue</small>
          <strong
            className={
              summary.overdue ? styles.overdueText : styles.balanceClear
            }
          >
            {money(summary.overdue)}
          </strong>
          <span>{summary.overdueInvoices.length} invoices</span>
        </div>
        <div>
          <small>Store credit</small>
          <strong>{money(customer.storeCredit || 0)}</strong>
          <span>Available balance</span>
        </div>
      </div>
      <div className={styles.profileActions}>
        <button className={styles.primaryAction} onClick={onStartSale}>
          Start new sale <ArrowRight size={15} />
        </button>
        <button
          className={styles.collectButton}
          disabled={!canCollect || !summary.collectibleOutstanding}
          onClick={onCollect}
        >
          <Banknote size={15} /> Collect payment
        </button>
      </div>
      {summary.outstanding > summary.collectibleOutstanding && (
        <p className={styles.codNotice}>
          {money(summary.outstanding - summary.collectibleOutstanding)} is tied
          to active COD delivery and must be collected through its shipment
          record.
        </p>
      )}
      <section className={styles.invoiceSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>ACTION NEEDED</span>
            <h4>Open invoices</h4>
          </div>
          <strong>{money(summary.outstanding)}</strong>
        </div>
        {summary.openInvoices.length ? (
          summary.openInvoices.map((sale) => (
            <InvoiceRow key={sale.id} sale={sale} />
          ))
        ) : (
          <div className={styles.clearState}>
            <Check size={16} /> This customer has no outstanding invoices.
          </div>
        )}
      </section>
      {!!settled.length && (
        <section className={styles.invoiceSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>HISTORY</span>
              <h4>Settled invoices</h4>
            </div>
          </div>
          {settled.slice(0, 8).map((sale) => (
            <InvoiceRow key={sale.id} sale={sale} />
          ))}
        </section>
      )}
    </div>
  );
}

function InvoiceRow({ sale }: { sale: Sale }) {
  const balance = saleBalance(sale);
  return (
    <div className={styles.invoiceRow}>
      <span>
        <strong>{sale.number}</strong>
        <small>
          {shortDate(sale.createdAt)}
          {sale.dueDate ? ` · Due ${shortDate(sale.dueDate)}` : ""}
        </small>
      </span>
      <span>
        <small>Total</small>
        <strong>{money(sale.total)}</strong>
      </span>
      <span>
        <small>Paid</small>
        <strong>{money(sale.paid)}</strong>
      </span>
      <span>
        <small>Balance</small>
        <strong className={balance ? styles.balanceDue : styles.balanceClear}>
          {money(balance)}
        </strong>
      </span>
    </div>
  );
}

export function CustomerPaymentForm({
  customer,
  sales,
  shipments,
  busy,
  onSubmit,
}: {
  customer: Customer;
  sales: Sale[];
  shipments: Shipment[];
  busy: boolean;
  onSubmit: (amount: number, method: PaymentMethod) => Promise<void>;
}) {
  const summary = customerFinancialSummary(customer, sales, shipments);
  const [amount, setAmount] = useState(
    String(summary.collectibleOutstanding / 100),
  );
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const cents = Math.round(Number(amount || 0) * 100);
  const preview = allocateCustomerPayment(
    summary.collectibleInvoices,
    Math.min(cents, summary.collectibleOutstanding),
  );
  return (
    <form
      className={styles.paymentForm}
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(cents, method);
      }}
    >
      <div className={styles.paymentHero}>
        <span className={styles.avatar}>{initials(customer.name)}</span>
        <div>
          <span className={styles.kicker}>COLLECT OUTSTANDING</span>
          <h3>{customer.name}</h3>
          <p>
            {summary.collectibleInvoices.length} eligible invoices ·{" "}
            {money(summary.collectibleOutstanding)} collectible
          </p>
        </div>
      </div>
      <div className={styles.paymentFields}>
        <label>
          <span>Amount received (Rs.)</span>
          <input
            type="number"
            min="0.01"
            max={summary.collectibleOutstanding / 100}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Payment method</span>
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {["Cash", "Card", "Bank transfer"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <section className={styles.allocation}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>ALLOCATION PREVIEW</span>
            <h4>Oldest dues paid first</h4>
          </div>
          <strong>
            {money(Math.min(cents, summary.collectibleOutstanding))}
          </strong>
        </div>
        {preview.map((item) => (
          <div key={item.saleId}>
            <span>{item.number}</span>
            <strong>{money(item.amount)}</strong>
          </div>
        ))}
      </section>
      <p className={styles.paymentNote}>
        This payment is recorded separately from the current sale. Your cart
        stays exactly as it is.
      </p>
      <div className={styles.paymentFooter}>
        <button
          type="submit"
          className={styles.primaryAction}
          disabled={
            busy || cents <= 0 || cents > summary.collectibleOutstanding
          }
        >
          {busy ? "Recording…" : "Record payment"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
