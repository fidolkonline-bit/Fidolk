"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, Search } from "lucide-react";
import {
  groupProfit,
  profitCsv,
  profitKey,
  profitTotals,
  PROFIT_DRILL,
  type ProfitDimension,
  type ProfitGroup,
  type ProfitRow,
} from "@/lib/profit";
import styles from "./profit-report.module.css";

const DIMENSIONS: { value: ProfitDimension; label: string; one: string }[] = [
  { value: "product", label: "Product", one: "Product" },
  { value: "category", label: "Category", one: "Category" },
  { value: "brand", label: "Brand", one: "Brand" },
  { value: "shop", label: "Shop", one: "Shop" },
  { value: "invoice", label: "Bill", one: "Bill" },
  { value: "customer", label: "Customer", one: "Customer" },
  { value: "day", label: "Day", one: "Day" },
];
const nameOf = (by: ProfitDimension) =>
  DIMENSIONS.find((d) => d.value === by)!.one;

type SortKey =
  | "label"
  | "units"
  | "sales"
  | "cost"
  | "grossProfit"
  | "commission"
  | "netProfit"
  | "margin";
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "units", label: "Units" },
  { key: "sales", label: "Sales" },
  { key: "cost", label: "Stock cost" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "commission", label: "Commission" },
  { key: "netProfit", label: "Net profit" },
  { key: "margin", label: "Margin" },
];
const sortValue = (group: ProfitGroup, key: SortKey) =>
  key === "label"
    ? group.label
    : key === "commission"
      ? group.staffCommission + group.agentCommission
      : key === "margin"
        ? (group.margin ?? -Infinity)
        : group[key];

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
/** Amounts in the table, in rupees without the currency, to keep columns narrow. */
const figure = (cents: number) =>
  Math.round(cents / 100).toLocaleString("en-LK");
const percent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("en-LK")}%`;

/** Distinct bills behind a set of rows. */
const billCount = (rows: ProfitRow[]) =>
  new Set(rows.map((row) => row.saleId).filter(Boolean)).size;

/**
 * Profit for the period, added up by product, category, brand, shop, bill,
 * customer or day. Opening a group shows what is inside it; opening a bill
 * shows the bill.
 */
export function ProfitReport({
  rows,
  period,
  money: format,
  onOpenBill,
}: {
  rows: ProfitRow[];
  period: { from: string; to: string };
  money: (cents: number) => string;
  onOpenBill: (saleId: string) => void;
}) {
  // Whole rupees on screen; the CSV keeps the exact amounts.
  const money = (cents: number) => format(Math.round(cents / 100) * 100);
  const [by, setBy] = useState<ProfitDimension>("product");
  const [trail, setTrail] = useState<
    { by: ProfitDimension; key: string; label: string }[]
  >([]);
  const [sort, setSort] = useState<{ key: SortKey; down: boolean } | null>(
    null,
  );
  const [query, setQuery] = useState("");

  const current = trail.length ? PROFIT_DRILL[trail.at(-1)!.by]! : by;
  const inView = useMemo(
    () =>
      rows.filter((row) =>
        trail.every((step) => profitKey(row, step.by) === step.key),
      ),
    [rows, trail],
  );
  const totals = profitTotals(inView);
  const groups = useMemo(() => {
    const grouped = groupProfit(
      inView,
      current,
      current === "day" ? period : undefined,
    );
    if (!sort) return grouped;
    return [...grouped].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      const order =
        typeof x === "string"
          ? x.localeCompare(String(y))
          : (x as number) - (y as number);
      return sort.down ? -order : order;
    });
  }, [inView, current, period, sort]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? groups.filter((group) =>
        words.every((word) =>
          `${group.label} ${detail(group, current)}`
            .toLowerCase()
            .includes(word),
        ),
      )
    : groups;

  const choose = (next: ProfitDimension) => {
    setBy(next);
    setTrail([]);
    setSort(null);
    setQuery("");
  };
  const openGroup = (group: ProfitGroup) => {
    if (current === "invoice") {
      if (group.key) onOpenBill(group.key);
      return;
    }
    if (!group.rows.length) return;
    setTrail((prev) => [
      ...prev,
      { by: current, key: group.key, label: labelOf(group, current) },
    ]);
    setSort(null);
    setQuery("");
  };
  const sortBy = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? { key, down: !prev.down }
        : { key, down: key !== "label" },
    );
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([profitCsv(shown, nameOf(current))], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fido-profit-by-${[
      ...trail.map((step) => step.label),
      nameOf(current),
    ]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${period.from}-${period.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const chart =
    current === "day" && groups.length > 1 && groups.length <= 92
      ? groups
      : null;
  const peak = Math.max(1, ...groups.map((g) => Math.abs(g.netProfit)));
  const commission = totals.staffCommission + totals.agentCommission;

  return (
    <section className={`panel printable-report ${styles.report}`}>
      <div className={styles.top}>
        <div className={styles.chips} role="radiogroup" aria-label="Profit by">
          <span>Profit by</span>
          {DIMENSIONS.map((d) => (
            <button
              key={d.value}
              role="radio"
              aria-checked={!trail.length && by === d.value}
              className={by === d.value ? styles.on : ""}
              onClick={() => choose(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          className="secondary"
          onClick={download}
          disabled={!shown.length}
        >
          <Download size={15} /> CSV
        </button>
      </div>

      {trail.length > 0 && (
        <nav className={styles.trail} aria-label="Where you are">
          <button onClick={() => setTrail([])}>All {plural(by)}</button>
          {trail.map((step, index) => (
            <span key={`${step.by}-${step.key}`}>
              <ChevronRight size={14} aria-hidden="true" />
              {index === trail.length - 1 ? (
                <strong>{step.label}</strong>
              ) : (
                <button onClick={() => setTrail(trail.slice(0, index + 1))}>
                  {step.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <dl className={styles.totals}>
        <div>
          <dt>Sales</dt>
          <dd>{money(totals.sales)}</dd>
        </div>
        <div>
          <dt>Stock cost</dt>
          <dd>{money(totals.cost)}</dd>
        </div>
        <div>
          <dt>Gross profit</dt>
          <dd>{money(totals.grossProfit)}</dd>
        </div>
        <div>
          <dt>Staff + agent commission</dt>
          <dd>{money(commission)}</dd>
        </div>
        <div className={styles.lead}>
          <dt>Net profit</dt>
          <dd className={totals.netProfit < 0 ? styles.loss : ""}>
            {money(totals.netProfit)}
          </dd>
          <small>{percent(totals.margin)} of sales</small>
        </div>
      </dl>

      {totals.costMissing > 0 && (
        <p className={styles.warn} role="note">
          {totals.costMissing} sold line
          {totals.costMissing === 1 ? " has" : "s have"} no stock cost recorded,
          so the profit here is higher than it really is. Receive stock with its
          cost to fix this for future sales.
        </p>
      )}

      {chart && (
        <figure className={styles.chartBox}>
          <div
            className={styles.chart}
            role="group"
            aria-label={`Net profit by day, ${dayLabel(period.from)} to ${dayLabel(period.to)}`}
          >
            {chart.map((group) => (
              <button
                key={group.key}
                title={`${dayLabel(group.key)}: ${money(group.netProfit)}`}
                aria-label={`${dayLabel(group.key)}: net profit ${money(group.netProfit)}`}
                onClick={() => openGroup(group)}
                disabled={!group.rows.length}
              >
                <i
                  className={group.netProfit < 0 ? styles.loss : ""}
                  style={{
                    height: `${Math.max(group.netProfit ? 3 : 0, (Math.abs(group.netProfit) / peak) * 100)}%`,
                  }}
                />
              </button>
            ))}
          </div>
          <figcaption>
            <span>{dayLabel(chart[0].key)}</span>
            <span>Net profit by day · tap a day to see its bills</span>
            <span>{dayLabel(chart.at(-1)!.key)}</span>
          </figcaption>
        </figure>
      )}

      {groups.length > 12 && (
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={`Find a ${nameOf(current).toLowerCase()}…`}
            aria-label={`Find a ${nameOf(current).toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}

      {!inView.length ? (
        <p className={styles.empty}>Nothing was sold in this period.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-sort={ariaSort(sort, "label")}>
                    <SortButton
                      label={nameOf(current)}
                      column="label"
                      sort={sort}
                      onSort={sortBy}
                    />
                  </th>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className={styles.num}
                      aria-sort={ariaSort(sort, column.key)}
                    >
                      <SortButton
                        label={column.label}
                        column={column.key}
                        sort={sort}
                        onSort={sortBy}
                      />
                    </th>
                  ))}
                  <th className={styles.num}>Share</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((group) => (
                  <tr
                    key={group.key}
                    className={group.netProfit < 0 ? styles.lossRow : ""}
                  >
                    <td>
                      <GroupName
                        group={group}
                        by={current}
                        onOpen={() => openGroup(group)}
                      />
                    </td>
                    <td className={styles.num}>{group.units}</td>
                    <td className={styles.num}>{figure(group.sales)}</td>
                    <td className={styles.num}>{figure(group.cost)}</td>
                    <td className={styles.num}>{figure(group.grossProfit)}</td>
                    <td
                      className={styles.num}
                      title={`Staff ${money(group.staffCommission)} · Agent ${money(group.agentCommission)}`}
                    >
                      {figure(group.staffCommission + group.agentCommission)}
                    </td>
                    <td className={`${styles.num} ${styles.net}`}>
                      {figure(group.netProfit)}
                    </td>
                    <td className={styles.num}>{percent(group.margin)}</td>
                    <td className={styles.num}>{percent(group.share)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    {words.length
                      ? `${shown.length} of ${groups.length} shown · total for all`
                      : "Total"}
                  </td>
                  <td className={styles.num}>{totals.units}</td>
                  <td className={styles.num}>{figure(totals.sales)}</td>
                  <td className={styles.num}>{figure(totals.cost)}</td>
                  <td className={styles.num}>{figure(totals.grossProfit)}</td>
                  <td className={styles.num}>{figure(commission)}</td>
                  <td className={`${styles.num} ${styles.net}`}>
                    {figure(totals.netProfit)}
                  </td>
                  <td className={styles.num}>{percent(totals.margin)}</td>
                  <td className={styles.num}>
                    {totals.netProfit ? "100%" : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className={styles.cards}>
            {shown.map((group) => (
              <li
                key={group.key}
                className={group.netProfit < 0 ? styles.lossRow : ""}
              >
                <GroupName
                  group={group}
                  by={current}
                  onOpen={() => openGroup(group)}
                />
                <strong className={group.netProfit < 0 ? styles.loss : ""}>
                  {money(group.netProfit)}
                </strong>
                <small>
                  Sales {money(group.sales)} · cost {money(group.cost)} ·
                  commission{" "}
                  {money(group.staffCommission + group.agentCommission)} ·{" "}
                  {percent(group.margin)} margin
                </small>
              </li>
            ))}
          </ul>
          {!shown.length && (
            <p className={styles.empty}>
              No {plural(current)} match “{query}”.
            </p>
          )}
        </>
      )}
      <p className={styles.note}>
        Net profit is sales after returns, minus what the stock cost, minus
        staff and agent commission. Returns count on the day they come back.
        Reloads count the commission you keep. Expenses are not taken off here.
        Amounts are in whole rupees; the CSV has them to the cent.
      </p>
    </section>
  );
}

function plural(by: ProfitDimension) {
  return {
    product: "products",
    category: "categories",
    brand: "brands",
    shop: "shops",
    invoice: "bills",
    customer: "customers",
    day: "days",
  }[by];
}

function labelOf(group: ProfitGroup, by: ProfitDimension) {
  return by === "day" ? dayLabel(group.key) : group.label;
}

function detail(group: ProfitGroup, by: ProfitDimension) {
  const first = group.rows[0];
  if (!first) return "No sales";
  const bills = billCount(group.rows);
  const billText = `${bills} bill${bills === 1 ? "" : "s"}`;
  if (by === "product") return `${first.category} · ${first.brand}`;
  if (by === "invoice")
    return first.saleId
      ? `${first.customerName} · ${dayLabel(first.day)}`
      : "Reloads done without a bill";
  return billText;
}

function GroupName({
  group,
  by,
  onOpen,
}: {
  group: ProfitGroup;
  by: ProfitDimension;
  onOpen: () => void;
}) {
  const opens = by === "invoice" ? !!group.key : group.rows.length > 0;
  const content = (
    <>
      <strong>{labelOf(group, by)}</strong>
      <small>{detail(group, by)}</small>
    </>
  );
  return opens ? (
    <button
      className={styles.name}
      onClick={onOpen}
      title={
        by === "invoice"
          ? "Open this bill"
          : `See ${plural(PROFIT_DRILL[by]!)} in ${labelOf(group, by)}`
      }
    >
      <span>{content}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  ) : (
    <span className={styles.name}>
      <span>{content}</span>
    </span>
  );
}

function ariaSort(
  sort: { key: SortKey; down: boolean } | null,
  column: SortKey,
) {
  return sort?.key === column
    ? sort.down
      ? ("descending" as const)
      : ("ascending" as const)
    : undefined;
}

function SortButton({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; down: boolean } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === column;
  return (
    <button className={styles.sort} onClick={() => onSort(column)}>
      {label}
      {active ? (sort!.down ? " ↓" : " ↑") : ""}
    </button>
  );
}
