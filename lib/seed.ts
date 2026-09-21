import type { Workspace, Product } from "./types";
export function createSeed(): Workspace {
  const now = new Date();
  const at = (days = 0, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 15, 0, 0);
    return d.toISOString();
  };
  const products: Product[] = [
    {
      id: "prod-1",
      sku: "PH-IP15-128",
      name: "Apple iPhone 15 · 128GB",
      category: "Smartphones",
      department: "Phones",
      price: 18990000,
      cost: 16900000,
      stock: 4,
      reorderLevel: 2,
      serialized: true,
      color: "blue",
    },
    {
      id: "prod-2",
      sku: "ACC-SIL-15",
      name: "iPhone 15 Silicone Case",
      category: "Accessories",
      department: "Phones",
      price: 120000,
      cost: 90000,
      stock: 24,
      reorderLevel: 5,
      serialized: false,
      color: "purple",
    },
    {
      id: "prod-3",
      sku: "ACC-USBC-20",
      name: "20W USB-C Power Adapter",
      category: "Accessories",
      department: "Phones",
      price: 450000,
      cost: 280000,
      stock: 3,
      reorderLevel: 5,
      serialized: false,
      color: "orange",
    },
    {
      id: "prod-4",
      sku: "ACC-GLASS-15",
      name: "Tempered Glass · iPhone 15",
      category: "Accessories",
      department: "Phones",
      price: 150000,
      cost: 50000,
      stock: 32,
      reorderLevel: 10,
      serialized: false,
      color: "green",
    },
    {
      id: "prod-5",
      sku: "CL-TEE-BLK-M",
      name: "Essential Tee · Black / M",
      category: "T-shirts",
      department: "Clothing",
      price: 240000,
      cost: 145000,
      stock: 18,
      reorderLevel: 5,
      serialized: false,
      color: "slate",
    },
    {
      id: "prod-6",
      sku: "GF-MUG-CRM",
      name: "Everyday Ceramic Mug",
      category: "Home & gifting",
      department: "Gifts",
      price: 185000,
      cost: 100000,
      stock: 12,
      reorderLevel: 4,
      serialized: false,
      color: "pink",
    },
    {
      id: "prod-7",
      sku: "ACC-BUDS-01",
      name: "Wireless Earbuds Pro",
      category: "Audio",
      department: "Phones",
      price: 650000,
      cost: 420000,
      stock: 8,
      reorderLevel: 3,
      serialized: false,
      color: "blue",
    },
    {
      id: "prod-8",
      sku: "PART-A14-DSP",
      name: "Samsung A14 Display",
      category: "Spare parts",
      department: "Phones",
      price: 350000,
      cost: 150000,
      stock: 2,
      reorderLevel: 3,
      serialized: false,
      color: "orange",
    },
  ];
  const batches = products.map((p, i) => ({
    id: `batch-${i + 1}`,
    productId: p.id,
    lot: `LOT-2609-${String(i + 1).padStart(3, "0")}`,
    supplier:
      i < 4
        ? "Colombo Mobile Trading"
        : i < 6
          ? "Lanka Distributors"
          : "Tech Parts LK",
    quantity: p.stock,
    remaining: p.stock,
    unitCost: p.cost,
    receivedAt: at(-7),
    imeis: p.serialized
      ? [
          "356789012340001",
          "356789012340002",
          "356789012340003",
          "356789012340004",
        ]
      : [],
  }));
  const customers = [
    { id: "cust-walkin", name: "Walk-in customer", phone: "" },
    { id: "cust-1", name: "Kasun Perera", phone: "0771234567" },
    { id: "cust-2", name: "Nethmi Silva", phone: "0712345678" },
    { id: "cust-3", name: "Dilshan Fernando", phone: "0763456789" },
    { id: "cust-4", name: "Amaya Jayasinghe", phone: "0774567890" },
  ];
  const specs = [
    ["prod-7", 1, "cust-1", 0, 9],
    ["prod-2", 2, "cust-walkin", 0, 10],
    ["prod-5", 2, "cust-2", 240000, 11],
    ["prod-4", 3, "cust-3", 0, 12],
    ["prod-6", 2, "cust-4", 0, 13],
  ] as const;
  const sales = specs.map(([pid, qty, cid, due, hour], i) => {
    const p = products.find((p) => p.id === pid)!;
    const b = batches.find((b) => b.productId === pid)!;
    b.quantity += qty;
    const total = p.price * qty;
    return {
      id: `sale-${i + 1}`,
      number: `INV-${String(i + 1).padStart(5, "0")}`,
      customerId: cid,
      customerName: customers.find((c) => c.id === cid)!.name,
      department: p.department,
      lines: [
        {
          productId: pid,
          name: p.name,
          quantity: qty,
          price: p.price,
          cost: p.cost,
          batchAllocations: [
            { batchId: b.id, quantity: qty, unitCost: p.cost },
          ],
        },
      ],
      subtotal: total,
      discount: 0,
      total,
      cost: p.cost * qty,
      paid: total - due,
      method: due ? ("Credit" as const) : ("Cash" as const),
      status: due ? ("Partial" as const) : ("Paid" as const),
      createdAt: at(0, hour),
      commission: 0,
      agentCommission: 0,
    };
  });
  const journal: Workspace["journal"] = sales.map((s) => ({
    id: `journal-${s.id}`,
    reference: s.number,
    description: "Sale completed",
    date: s.createdAt,
    lines: [
      { account: "Cash", debit: s.paid, credit: 0 },
      { account: "Accounts receivable", debit: s.total - s.paid, credit: 0 },
      { account: "Sales revenue", debit: 0, credit: s.total },
      { account: "Cost of goods sold", debit: s.cost, credit: 0 },
      { account: "Inventory", debit: 0, credit: s.cost },
    ].filter((l) => l.debit || l.credit),
  }));
  const inventoryOpening = batches.reduce(
    (s, b) => s + b.quantity * b.unitCost,
    0,
  );
  journal.unshift({
    id: "journal-opening",
    reference: "OPENING",
    description: "Demo opening stock",
    date: at(-7),
    lines: [
      { account: "Inventory", debit: inventoryOpening, credit: 0 },
      { account: "Opening equity", debit: 0, credit: inventoryOpening },
    ],
  });
  return {
    products,
    batches,
    customers,
    sales,
    journal,
    repairs: [
      {
        id: "repair-1",
        number: "REP-00001",
        customerName: "Kasun Perera",
        phone: "0771234567",
        device: "Samsung Galaxy A14",
        imei: "",
        issue: "Cracked display — replacement",
        condition: "Cracked screen, powers on",
        accessories: ["Back cover", "SIM card"],
        notes: "Customer will collect after work.",
        estimate: 500000,
        partsCost: 150000,
        parts: [
          {
            productId: "prod-8",
            name: "Samsung A14 Display",
            quantity: 1,
            estimatedUnitCost: 150000,
          },
        ],
        hasCredential: false,
        staffPercent: 50,
        status: "Awaiting approval",
        warrantyDays: 30,
        createdAt: at(-1),
        commission: 0,
        paid: 0,
      },
      {
        id: "repair-2",
        number: "REP-00002",
        customerName: "Nethmi Silva",
        phone: "0712345678",
        device: "Apple iPhone 12",
        imei: "",
        issue: "Battery drains quickly",
        condition: "Minor scratches on frame",
        accessories: ["SIM card"],
        notes: "Call before replacing any parts.",
        estimate: 850000,
        partsCost: 0,
        parts: [],
        hasCredential: false,
        staffPercent: 50,
        status: "Diagnosing",
        warrantyDays: 90,
        createdAt: at(0, 9),
        commission: 0,
        paid: 0,
      },
      {
        id: "repair-3",
        number: "REP-00003",
        customerName: "Dilshan Fernando",
        phone: "0763456789",
        device: "Samsung Galaxy A32",
        imei: "",
        issue: "Water damage inspection",
        condition: "Does not power on",
        accessories: [],
        notes: "Liquid damage; warranty to be confirmed.",
        estimate: 500000,
        partsCost: 0,
        parts: [],
        hasCredential: false,
        staffPercent: 50,
        status: "Received",
        warrantyDays: 0,
        createdAt: at(0, 11),
        commission: 0,
        paid: 0,
      },
    ],
    expenses: [],
    purchases: [],
    purchaseOrders: [],
    cheques: [],
    shipments: [],
    reloads: [],
    suppliers: [],
    supplierReturns: [],
    agents: [],
    commissionSettlements: [],
    returns: [],
    codSettlements: [],
    alerts: [],
    staff: [
      {
        id: "staff-1",
        name: "Sales & service",
        role: "Salesperson",
        salary: 3500000,
        advances: 0,
        paidCommission: 0,
      },
      {
        id: "staff-2",
        name: "Cashier",
        role: "Cashier",
        salary: 3000000,
        advances: 0,
        paidCommission: 0,
      },
    ],
    notifications: [
      {
        id: "notice-1",
        title: "3 products need attention",
        detail:
          "Power adapters, spare displays and other low-stock items are ready to review.",
        read: false,
        createdAt: at(),
      },
      {
        id: "notice-2",
        title: "Repair approval pending",
        detail: "Kasun Perera’s Samsung A14 is awaiting estimate approval.",
        read: false,
        createdAt: at(),
      },
    ],
    sms: [],
    pushSubscriptions: [],
    audit: [],
    settings: {
      businessName: "Fido LK",
      phone: "",
      address: "Sri Lanka",
      dailyTarget: 5000000,
      accessoryPercent: 2,
      agentSharePercent: 50,
      repairStaffPercent: 50,
      commissionConfirmed: false,
      smsEnabled: false,
      smsSenderId: "",
      smsApiKeyConfigured: false,
      providerRules: [],
      creditReminderDays: [3, 7, 14, 30],
      ai: {
        enabled: false,
        apiKeyConfigured: false,
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-2.5-flash-lite",
        dailyRequestLimit: 100,
        usageDate: "",
        requestsToday: 0,
        features: {
          dailyBrief: true,
          repairAssistant: true,
          customerMessages: true,
          invoiceExtraction: true,
          inventoryInsights: true,
          askFido: true,
          anomalyReview: true,
          marketingCopy: true,
        },
      },
    },
  };
}
export function createEmptyWorkspace(): Workspace {
  const s = createSeed();
  for (const key of Object.keys(s) as (keyof Workspace)[]) {
    if (Array.isArray(s[key]))
      (s as unknown as Record<string, unknown>)[key] = [];
  }
  s.customers = [{ id: "cust-walkin", name: "Walk-in customer", phone: "" }];
  s.staff = [
    {
      id: "staff-1",
      name: "Sales & service",
      role: "Salesperson",
      salary: 0,
      advances: 0,
      paidCommission: 0,
    },
    {
      id: "staff-2",
      name: "Cashier",
      role: "Cashier",
      salary: 0,
      advances: 0,
      paidCommission: 0,
    },
  ];
  return s;
}
