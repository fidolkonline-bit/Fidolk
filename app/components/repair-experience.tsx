"use client";

import JsBarcode from "jsbarcode";
import {
  CheckCircle2,
  MessageCircle,
  Printer,
  RotateCcw,
  Tag,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { Repair, Settings, Staff } from "@/lib/types";
import {
  expandPatternPath,
  isActiveRepair,
  type RepairPeriodFilter,
  type RepairSort,
  type RepairStatusFilter,
} from "@/lib/repairs";

const DOTS = [
  { n: 1, x: 50, y: 50 },
  { n: 2, x: 150, y: 50 },
  { n: 3, x: 250, y: 50 },
  { n: 4, x: 50, y: 150 },
  { n: 5, x: 150, y: 150 },
  { n: 6, x: 250, y: 150 },
  { n: 7, x: 50, y: 250 },
  { n: 8, x: 150, y: 250 },
  { n: 9, x: 250, y: 250 },
];

function PatternLines({
  pattern,
  pointer,
}: {
  pattern: number[];
  pointer?: { x: number; y: number } | null;
}) {
  const points = pattern
    .map((number) => DOTS.find((dot) => dot.n === number))
    .filter((dot): dot is (typeof DOTS)[number] => !!dot);
  return (
    <svg className="pattern-lines" viewBox="0 0 300 300" aria-hidden="true">
      {points.slice(1).map((point, index) => (
        <line
          key={`${points[index].n}-${point.n}`}
          x1={points[index].x}
          y1={points[index].y}
          x2={point.x}
          y2={point.y}
        />
      ))}
      {pointer && points.length > 0 && (
        <line
          className="pattern-live-line"
          x1={points.at(-1)!.x}
          y1={points.at(-1)!.y}
          x2={pointer.x}
          y2={pointer.y}
        />
      )}
    </svg>
  );
}

export function DeviceSecretInput() {
  const [mode, setMode] = useState("None");
  const [pattern, setPattern] = useState<number[]>([]);
  const [secret, setSecret] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const validityRef = useRef<HTMLInputElement>(null);

  const add = (number: number) => {
    setTouched(true);
    setPattern((current) => expandPatternPath(current, number));
  };
  useEffect(() => {
    validityRef.current?.setCustomValidity(
      mode === "Pattern" && pattern.length < 4
        ? "Connect at least 4 dots to save the pattern."
        : "",
    );
  }, [mode, pattern.length]);

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 300,
      y: ((event.clientY - bounds.top) / bounds.height) * 300,
    };
  };
  const addNearestDot = (position: { x: number; y: number }) => {
    const nearest = DOTS.map((dot) => ({
      ...dot,
      distance: Math.hypot(position.x - dot.x, position.y - dot.y),
    })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest.distance <= 44) add(nearest.n);
  };
  const stopDrawing = () => {
    setDrawing(false);
    setPointer(null);
  };

  return (
    <div className="device-secret-input">
      <label className="field">
        <span>Device access (optional)</span>
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value);
            setPattern([]);
            setSecret("");
            setTouched(false);
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
          mode === "Pattern" && pattern.length >= 4
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
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {mode === "Pattern" && (
        <div className="pattern-entry">
          <div className="phone-pattern-shell">
            <div className="pattern-phone-top" aria-hidden="true">
              <span />
            </div>
            <p>Draw an unlock pattern</p>
            <div
              className="pattern-grid"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const position = pointerPosition(event);
                setDrawing(true);
                setPointer(position);
                addNearestDot(position);
              }}
              onPointerMove={(event) => {
                if (!drawing) return;
                const position = pointerPosition(event);
                setPointer(position);
                addNearestDot(position);
              }}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            >
              <PatternLines
                pattern={pattern}
                pointer={drawing ? pointer : null}
              />
              {DOTS.map((dot) => (
                <button
                  type="button"
                  key={dot.n}
                  className={pattern.includes(dot.n) ? "chosen" : ""}
                  aria-label={`Pattern dot ${dot.n}${pattern.includes(dot.n) ? `, selected as step ${pattern.indexOf(dot.n) + 1}` : ""}`}
                  onClick={() => add(dot.n)}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
          <input
            ref={validityRef}
            className="pattern-validity-input"
            value={pattern.length >= 4 ? pattern.join("-") : ""}
            required
            tabIndex={-1}
            aria-hidden="true"
            onChange={() => undefined}
            onInvalid={() => setTouched(true)}
          />
          <div className="pattern-caption" aria-live="polite">
            <span>
              <strong>{pattern.length} dots connected</strong>
              <small>
                Connect at least 4 dots. Crossed dots join automatically.
              </small>
            </span>
            <button
              type="button"
              className="text-button"
              disabled={!pattern.length}
              onClick={() => {
                setPattern([]);
                setTouched(false);
              }}
            >
              <RotateCcw size={13} />
              {pattern.length ? "Draw again" : "Clear pattern"}
            </button>
          </div>
          {touched && pattern.length < 4 && (
            <p className="pattern-error" role="alert">
              Connect at least 4 unique dots before saving this repair.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ReadonlyPattern({ value }: { value: string }) {
  const pattern = value
    .replace(/^Pattern:\s*/i, "")
    .split("-")
    .map(Number)
    .filter((number) => number >= 1 && number <= 9);
  return (
    <div
      className="readonly-pattern"
      aria-label={`Stored pattern with ${pattern.length} dots`}
    >
      <div className="pattern-grid">
        <PatternLines pattern={pattern} />
        {DOTS.map((dot) => (
          <span
            key={dot.n}
            className={pattern.includes(dot.n) ? "chosen" : ""}
            aria-hidden="true"
          >
            <i />
          </span>
        ))}
      </div>
      <small>Pattern hidden again automatically after 30 seconds.</small>
    </div>
  );
}

export function RepairBarcode({
  value,
  compact = false,
}: {
  value: string;
  compact?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: !compact,
      font: "ui-monospace, monospace",
      fontSize: compact ? 0 : 10,
      height: compact ? 35 : 45,
      width: compact ? 1 : 1.35,
      margin: 0,
      background: "transparent",
    });
  }, [compact, value]);
  return (
    <svg
      ref={ref}
      className="repair-barcode"
      role="img"
      aria-label={`Barcode for ${value}`}
    />
  );
}

type FilterProps = {
  repairs: Repair[];
  staff: Staff[];
  status: RepairStatusFilter;
  setStatus: Dispatch<SetStateAction<RepairStatusFilter>>;
  technician: string;
  setTechnician: Dispatch<SetStateAction<string>>;
  period: RepairPeriodFilter;
  setPeriod: Dispatch<SetStateAction<RepairPeriodFilter>>;
  sort: RepairSort;
  setSort: Dispatch<SetStateAction<RepairSort>>;
  resultCount: number;
};

export function RepairOverview({
  repairs,
  staff,
  status,
  setStatus,
  technician,
  setTechnician,
  period,
  setPeriod,
  sort,
  setSort,
  resultCount,
}: FilterProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const summaries: {
    label: string;
    filter: RepairStatusFilter;
    count: number;
  }[] = [
    {
      label: "Active",
      filter: "Active",
      count: repairs.filter(isActiveRepair).length,
    },
    {
      label: "Received",
      filter: "Received",
      count: repairs.filter((r) => r.status === "Received").length,
    },
    {
      label: "Awaiting approval",
      filter: "Awaiting approval",
      count: repairs.filter((r) => r.status === "Awaiting approval").length,
    },
    {
      label: "In progress",
      filter: "In progress",
      count: repairs.filter((r) => r.status === "In progress").length,
    },
    {
      label: "Ready",
      filter: "Ready for collection",
      count: repairs.filter((r) => r.status === "Ready for collection").length,
    },
    {
      label: "Collected",
      filter: "Collected",
      count: repairs.filter((r) => r.status === "Collected").length,
    },
  ];
  const isDefault =
    status === "Active" &&
    technician === "All technicians" &&
    period === "All time" &&
    sort === "Newest";
  const reset = () => {
    setStatus("Active");
    setTechnician("All technicians");
    setPeriod("All time");
    setSort("Newest");
  };
  return (
    <div className="repair-overview">
      <div className="repair-summary-frame">
        <div
          className="repair-summary"
          aria-label="Repair status summary. Scroll horizontally for more statuses on small screens."
        >
          {summaries.map((summary) => (
            <button
              type="button"
              key={summary.filter}
              className={status === summary.filter ? "selected" : ""}
              aria-pressed={status === summary.filter}
              onClick={() => setStatus(summary.filter)}
            >
              <span>{summary.label}</span>
              <strong>{summary.count}</strong>
            </button>
          ))}
        </div>
        <small className="repair-summary-hint" aria-hidden="true">
          Swipe to see all statuses →
        </small>
      </div>
      <button
        type="button"
        className="repair-filter-toggle secondary"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        {filtersOpen ? "Hide filters" : "Filters"}
        <span>{resultCount}</span>
      </button>
      <div className={`repair-filter-bar ${filtersOpen ? "open" : ""}`}>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RepairStatusFilter)}
          >
            <option>Active</option>
            <option>All</option>
            <option>Received</option>
            <option>Diagnosing</option>
            <option>Awaiting approval</option>
            <option>Approved</option>
            <option>In progress</option>
            <option>Ready for collection</option>
            <option>Collected</option>
            <option>Declined</option>
          </select>
        </label>
        <label>
          <span>Technician</span>
          <select
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          >
            <option>All technicians</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RepairPeriodFilter)}
          >
            <option>All time</option>
            <option>Today</option>
            <option>Last 7 days</option>
            <option>This month</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RepairSort)}
          >
            <option>Newest</option>
            <option>Oldest</option>
            <option>Longest waiting</option>
          </select>
        </label>
        <div className="repair-filter-result">
          <strong>{resultCount}</strong>{" "}
          {resultCount === 1 ? "repair" : "repairs"}
        </div>
        {!isDefault && (
          <button className="text-button" type="button" onClick={reset}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
    </div>
  );
}

export function RepairCreated({
  repair,
  onLabel,
  onReceipt,
  onWhatsApp,
  onOpen,
  onAnother,
  onDone,
}: {
  repair: Repair;
  onLabel: () => void;
  onReceipt: () => void;
  onWhatsApp: () => void;
  onOpen: () => void;
  onAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div className="repair-created">
      <div className="repair-created-hero">
        <CheckCircle2 size={28} />
        <div>
          <strong>Repair booked and intake SMS queued</strong>
          <p>The device is ready to label and hand over.</p>
        </div>
      </div>
      <div className="repair-created-job">
        <span>{repair.number}</span>
        <strong>{repair.device}</strong>
        <p>
          {repair.customerName} · {repair.phone}
        </p>
        <small>{repair.issue}</small>
      </div>
      <div className="repair-action-grid">
        <button className="repair-action primary-action" onClick={onLabel}>
          <Tag size={20} />
          <span>
            <strong>Print device label</strong>
            <small>38 mm barcode sticker</small>
          </span>
        </button>
        <button className="repair-action" onClick={onReceipt}>
          <Printer size={20} />
          <span>
            <strong>Intake receipt</strong>
            <small>Preview and print at 80 mm</small>
          </span>
        </button>
        <div
          className="repair-action is-complete"
          aria-label="SMS summary queued"
        >
          <CheckCircle2 size={20} />
          <span>
            <strong>SMS queued</strong>
            <small>No duplicate message will be sent</small>
          </span>
        </div>
        <button className="repair-action" onClick={onWhatsApp}>
          <MessageCircle size={20} />
          <span>
            <strong>Share via WhatsApp</strong>
            <small>Opens a prefilled summary</small>
          </span>
        </button>
      </div>
      <div className="modal-footer repair-created-footer">
        <button className="text-button" onClick={onAnother}>
          <RotateCcw size={14} /> Create another
        </button>
        <button className="secondary" onClick={onOpen}>
          Open repair
        </button>
        <button className="primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

const currency = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount / 100);

export function RepairIntakeReceipt({
  repair,
  settings,
  onPrint,
  onWhatsApp,
  onClose,
}: {
  repair: Repair;
  settings: Settings;
  onPrint: () => void;
  onWhatsApp: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="receipt-paper repair-receipt-paper">
        <h2>{settings.businessName}</h2>
        <p>
          {settings.address}
          <br />
          {settings.phone}
        </p>
        <hr />
        <div className="receipt-job-heading">
          <strong>REPAIR INTAKE</strong>
          <span>{repair.number}</span>
        </div>
        <p>
          {new Date(repair.createdAt).toLocaleString("en-GB", {
            timeZone: "Asia/Colombo",
          })}
        </p>
        <RepairBarcode value={repair.number} />
        <hr />
        <ReceiptRow label="Customer" value={repair.customerName} />
        <ReceiptRow label="Phone" value={repair.phone} />
        <ReceiptRow label="Device" value={repair.device} />
        {repair.imei && (
          <ReceiptRow label="IMEI / serial" value={repair.imei} />
        )}
        <hr />
        <ReceiptRow label="Reported fault" value={repair.issue} stacked />
        <ReceiptRow label="Condition" value={repair.condition} stacked />
        <ReceiptRow
          label="Items received"
          value={repair.accessories.join(", ") || "None recorded"}
          stacked
        />
        <ReceiptRow
          label="Estimate"
          value={
            repair.estimate ? currency(repair.estimate) : "Estimate pending"
          }
        />
        {repair.warrantyDays > 0 && (
          <ReceiptRow label="Warranty" value={`${repair.warrantyDays} days`} />
        )}
        <ReceiptRow
          label="Technician"
          value={repair.technicianName || "To be assigned"}
        />
        <hr />
        <p className="receipt-terms">
          This is an intake record, not proof that work is approved. We will
          confirm the estimate with you before repair work begins.
        </p>
        <div className="receipt-signatures">
          <span>Customer signature</span>
          <span>Staff signature</span>
        </div>
        <p>
          Keep this receipt for collection.
          <br />
          Thank you for choosing {settings.businessName}.
        </p>
      </div>
      <div className="modal-footer no-print document-actions">
        <button className="secondary" onClick={onClose}>
          Back
        </button>
        <button className="secondary" onClick={onWhatsApp}>
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button className="primary" onClick={onPrint}>
          <Printer size={16} /> Print 80 mm
        </button>
      </div>
    </>
  );
}

function ReceiptRow({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={`receipt-line repair-receipt-row${stacked ? " stacked" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function RepairLabel({
  repair,
  settings,
  height,
  setHeight,
  detailed,
  setDetailed,
  onPrint,
  onClose,
}: {
  repair: Repair;
  settings: Settings;
  height: 25 | 30 | 40;
  setHeight: Dispatch<SetStateAction<25 | 30 | 40>>;
  detailed: boolean;
  setDetailed: Dispatch<SetStateAction<boolean>>;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="label-config no-print">
        <label>
          <span>Label height</span>
          <select
            value={height}
            onChange={(e) => setHeight(Number(e.target.value) as 25 | 30 | 40)}
          >
            <option value={25}>25 mm</option>
            <option value={30}>30 mm</option>
            <option value={40}>40 mm</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={detailed}
            onChange={(e) => setDetailed(e.target.checked)}
          />{" "}
          Detailed layout
        </label>
      </div>
      <div className="label-preview-stage">
        <div
          className={`repair-label-paper${detailed ? " detailed" : ""}`}
          style={{ "--label-height": `${height}mm` } as CSSProperties}
        >
          <div className="label-top">
            <strong>{settings.businessName}</strong>
            <span>{repair.number}</span>
          </div>
          <RepairBarcode value={repair.number} compact />
          <div className="label-customer">
            <strong>{repair.customerName}</strong>
            <span>{repair.phone}</span>
          </div>
          <div className="label-device">{repair.device}</div>
          {detailed && (
            <div className="label-fault">
              <strong>FAULT</strong> {repair.issue}
            </div>
          )}
        </div>
      </div>
      <p className="footnote no-print label-note">
        Actual margins and feed alignment depend on the thermal printer driver.
        The barcode contains only {repair.number}.
      </p>
      <div className="modal-footer no-print document-actions">
        <button className="secondary" onClick={onClose}>
          Back
        </button>
        <button className="primary" onClick={onPrint}>
          <Printer size={16} /> Print label
        </button>
      </div>
    </>
  );
}
