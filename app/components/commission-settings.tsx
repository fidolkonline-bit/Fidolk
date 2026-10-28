"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import type { CategoryCommission } from "@/lib/types";

type Action = (
  type: string,
  payload: Record<string, unknown>,
) => Promise<unknown>;

type Row = {
  category: string;
  ratePercent: string;
  salespersonPercent: string;
};

/** Every product category, plus any that still has a rate after its products were renamed. */
function rowsFor(categories: string[], rules: CategoryCommission[]): Row[] {
  const names = new Map<string, string>();
  for (const name of [...rules.map((rule) => rule.category), ...categories])
    if (name.trim() && !names.has(name.trim().toLowerCase()))
      names.set(name.trim().toLowerCase(), name.trim());
  return [...names.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => {
      const rule = rules.find(
        (item) => item.category.toLowerCase() === category.toLowerCase(),
      );
      return {
        category,
        ratePercent: rule ? String(rule.ratePercent) : "",
        salespersonPercent: rule ? String(rule.salespersonPercent) : "",
      };
    });
}

const value = (text: string) => (text.trim() ? Number(text) : 0);

export function CommissionSettingsPanel({
  categories,
  rules,
  action,
  busy,
}: {
  categories: string[];
  rules: CategoryCommission[];
  action: Action;
  busy: boolean;
}) {
  // Compared by content: the page hands over new arrays on every render, which must not wipe what is being typed.
  const saved = JSON.stringify(rowsFor(categories, rules));
  const [rows, setRows] = useState<Row[]>(() => JSON.parse(saved));
  useEffect(() => setRows(JSON.parse(saved)), [saved]);

  const edit = (index: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action("setCategoryCommissions", {
      rules: rows.map((row) => ({
        category: row.category,
        ratePercent: value(row.ratePercent),
        salespersonPercent: value(row.salespersonPercent),
      })),
    });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <h2>Sales commission by category</h2>
        </div>
      </div>
      <p className="muted">
        Each item earns its category&apos;s rate on its profit (price after
        discount, less what its lot cost). The salesperson gets their part and
        the agent who brought the sale gets the rest. With no agent, the shop
        keeps the agent&apos;s part. Leave a category blank to pay nothing on
        it.
      </p>
      <p className="muted">
        Example: Back covers at 8% with the salesperson on 2%. On Rs 1,000
        profit, the salesperson gets Rs 20 and the agent Rs 60.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Commission (% of profit)</th>
              <th>Salesperson (%)</th>
              <th>Agent (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const agent =
                value(row.ratePercent) - value(row.salespersonPercent);
              return (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>
                    <input
                      aria-label={`${row.category} commission %`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.ratePercent}
                      onChange={(event) =>
                        edit(index, { ratePercent: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${row.category} salesperson %`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.salespersonPercent}
                      onChange={(event) =>
                        edit(index, { salespersonPercent: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    {agent < 0 ? (
                      <span className="badge bad">
                        More than the category rate
                      </span>
                    ) : (
                      `${Number(agent.toFixed(2))}%`
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="muted">
                  Add products with categories first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button className="primary" disabled={busy}>
        Save commission rates
        <Check size={16} />
      </button>
    </form>
  );
}
