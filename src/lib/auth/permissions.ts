export const ROLES = [
  "SYSTEM_ADMIN",
  "ADMIN",
  "MANAGER",
  "STOCK",
  "ACCOUNTING",
  "PRODUCTION",
  "SALES",
  "HR",
] as const;

export type Role = (typeof ROLES)[number];

export const RESOURCES = [
  "dashboard",
  "personnel",
  "factory",
  "recipes",
  "raw_materials",
  "raw_material_orders",
  "products",
  "stock",
  "warehouses",
  "orders",
  "customers",
  "suppliers",
  "invoices",
  "delivery_notes",
  "ledger",
  "budget",
  "lab",
  "admin",
  "users",
  "backups",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Permission = `${Resource}:read` | `${Resource}:write`;

export type SessionUser = {
  userId: string;
  username: string;
  name: string;
  role: Role;
  /** true ise kullanıcı şifresini değiştirene kadar uygulamaya erişemez */
  mustChangePassword: boolean;
  /** Kullanıcı kaydındaki tokenVersion ile eşleşmezse oturum geçersizdir */
  tokenVersion: number;
};

export const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: "Sistem Yöneticisi",
  ADMIN: "Yönetici",
  MANAGER: "Müdür",
  STOCK: "Stok",
  ACCOUNTING: "Muhasebe",
  PRODUCTION: "Üretim",
  SALES: "Satış Pazarlama",
  HR: "İK",
};

/** Eski kurulumlarda kalan rol adları → yeni roller (ADMIN ayrı ele alınır) */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  WAREHOUSE: "STOCK",
  COMMERCIAL: "SALES",
  LAB: "PRODUCTION",
};

const BUSINESS_RESOURCES: Resource[] = [
  "personnel",
  "factory",
  "recipes",
  "raw_materials",
  "raw_material_orders",
  "products",
  "stock",
  "warehouses",
  "orders",
  "customers",
  "suppliers",
  "invoices",
  "delivery_notes",
  "ledger",
  "budget",
  "lab",
];

function resourcePerms(
  resources: Resource[],
  level: "read" | "write" | "both"
): Permission[] {
  const perms: Permission[] = [];
  for (const r of resources) {
    if (level === "read" || level === "both") perms.push(`${r}:read`);
    if (level === "write" || level === "both") perms.push(`${r}:write`);
  }
  return perms;
}

const ADMIN_LIKE_PERMISSIONS: Permission[] = [
  ...resourcePerms(BUSINESS_RESOURCES, "both"),
  ...resourcePerms(["admin", "users"], "both"),
];

/** Rol → izin listesi (SYSTEM_ADMIN ayrı ele alınır) */
const ROLE_PERMISSIONS: Record<Exclude<Role, "SYSTEM_ADMIN">, Permission[]> = {
  ADMIN: ADMIN_LIKE_PERMISSIONS,
  MANAGER: ADMIN_LIKE_PERMISSIONS,
  STOCK: [
    ...resourcePerms(["stock", "raw_material_orders", "orders"], "both"),
    ...resourcePerms(["warehouses", "raw_materials", "products", "delivery_notes"], "read"),
  ],
  ACCOUNTING: [
    ...resourcePerms(
      ["invoices", "delivery_notes", "ledger", "budget", "suppliers", "personnel"],
      "both"
    ),
    ...resourcePerms(["customers", "orders"], "read"),
  ],
  PRODUCTION: [
    ...resourcePerms(["factory", "recipes", "raw_material_orders", "lab"], "both"),
    ...resourcePerms(["stock"], "both"),
    ...resourcePerms(
      ["warehouses", "raw_materials", "products", "orders", "suppliers"],
      "read"
    ),
  ],
  SALES: [
    ...resourcePerms(["customers", "orders", "delivery_notes"], "both"),
    ...resourcePerms(["factory", "raw_materials", "raw_material_orders"], "read"),
  ],
  HR: [
    ...resourcePerms(BUSINESS_RESOURCES, "read"),
    ...resourcePerms(["admin"], "read"),
    ...resourcePerms(["users"], "both"),
  ],
};

export function isSystemAdmin(role: Role): boolean {
  return role === "SYSTEM_ADMIN";
}

/** Denetim kaydı yalnızca sistem yöneticisine açık */
export function canViewAuditLogs(role: Role): boolean {
  return role === "SYSTEM_ADMIN";
}

export function isStockRole(role: Role): boolean {
  return role === "STOCK";
}

/** Satış siparişi oluşturma — depo yalnızca sevkiyat yapar */
export function canCreateSalesOrder(role: Role): boolean {
  return canWrite(role, "orders") && role !== "STOCK";
}

/** Hammadde satın alma talebi — depo yalnızca mal kabul yapar */
export function canCreatePurchaseOrder(role: Role): boolean {
  return canWrite(role, "raw_material_orders") && role !== "STOCK";
}

/** Stok girişi — depo; üretim depodan talep eder, giriş yapmaz */
export function canCreateStockEntry(role: Role): boolean {
  return canWrite(role, "stock") && role !== "PRODUCTION";
}

/** Depolar arası aktarım / depodan hammadde talebi */
export function canCreateStockTransfer(role: Role): boolean {
  return canWrite(role, "stock");
}

export const STOCK_RECEIPT_ACTIONS = ["mark_received"] as const;

export function canApplyRawMaterialOrderAction(
  role: Role,
  action: string
): boolean {
  if (!canWrite(role, "raw_material_orders")) return false;
  if (role === "STOCK") {
    return (STOCK_RECEIPT_ACTIONS as readonly string[]).includes(action);
  }
  if (role === "PRODUCTION") {
    return action !== "mark_received";
  }
  return true;
}

export const SHIPMENT_STATUSES = ["picking", "shipped", "delivered"] as const;

export function canSetOrderStatus(role: Role, status: string): boolean {
  if (!canWrite(role, "orders")) return false;
  if (role === "STOCK") {
    return (SHIPMENT_STATUSES as readonly string[]).includes(status);
  }
  return true;
}

/** Depo için sıradaki sevkiyat adımı (bilgi girişinden teslime) */
export function nextShipmentStatus(
  current: string
): (typeof SHIPMENT_STATUSES)[number] | null {
  if (current === "pending" || current === "confirmed") return "picking";
  if (current === "picking") return "shipped";
  if (current === "shipped") return "delivered";
  return null;
}

/** Yönetici ve müdür — yetkiler aynı, yalnızca rol adı farklı */
export function isAdminLikeRole(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Sistem yöneticisi / yönetici / müdür — İK bunlara dokunamaz */
export function isProtectedUserRole(role: string): boolean {
  return role === "SYSTEM_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

/** Sistem yöneticisi veya yönetici/müdür */
export function isPrivilegedRole(role: Role): boolean {
  return role === "SYSTEM_ADMIN" || isAdminLikeRole(role);
}

export function assignableRoles(actor: Role): Role[] {
  if (actor === "SYSTEM_ADMIN") return [...ROLES];
  if (isAdminLikeRole(actor)) {
    return ROLES.filter((role) => role !== "SYSTEM_ADMIN");
  }
  if (actor === "HR") {
    return ROLES.filter((role) => !isProtectedUserRole(role));
  }
  return [];
}

/**
 * Hedef kullanıcının mevcut rolü üzerinde işlem (rol, şifre, kapatma, silme).
 * İK yalnızca kendi rolü ve alt roller; korumalı rollere asla.
 */
export function canManageUser(actor: Role, targetRole: string): boolean {
  if (actor === "SYSTEM_ADMIN") return true;
  if (isAdminLikeRole(actor)) return targetRole !== "SYSTEM_ADMIN";
  if (actor === "HR") return !isProtectedUserRole(targetRole);
  return false;
}

export function canAssignRole(actor: Role, targetRole: Role): boolean {
  return assignableRoles(actor).includes(targetRole);
}

export function rolePermissions(role: Role): Permission[] | "*" {
  if (role === "SYSTEM_ADMIN") return "*";
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = rolePermissions(role);
  if (perms === "*") return true;
  if (perms.includes(permission)) return true;
  const [resource, action] = permission.split(":") as [Resource, "read" | "write"];
  if (action === "read") {
    return perms.includes(`${resource}:write`);
  }
  return false;
}

export function canRead(role: Role, resource: Resource): boolean {
  return hasPermission(role, `${resource}:read`);
}

export function canWrite(role: Role, resource: Resource): boolean {
  return hasPermission(role, `${resource}:write`);
}

/** Sayfa yolu → kaynak */
export function pathToResource(pathname: string): Resource | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/personnel")) return "personnel";
  if (pathname.startsWith("/factory")) return "factory";
  if (pathname.startsWith("/recipes")) return "recipes";
  if (pathname.startsWith("/raw-material-orders")) return "raw_material_orders";
  if (pathname.startsWith("/raw-materials")) return "raw_materials";
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/stock")) return "stock";
  if (pathname.startsWith("/warehouses")) return "warehouses";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/suppliers")) return "suppliers";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/quotes")) return "invoices";
  if (pathname.startsWith("/document-settings")) return "invoices";
  if (pathname.startsWith("/delivery-notes")) return "delivery_notes";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/budget")) return "budget";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/rd-lab")) return "lab";
  return null;
}

export function getPageReadPermission(pathname: string): Permission | null {
  const resource = pathToResource(pathname);
  if (!resource) return null;
  return `${resource}:read`;
}

const CATALOG_ENTITY_RESOURCE: Record<string, Resource> = {
  customers: "customers",
  suppliers: "suppliers",
  personnel: "personnel",
  products: "products",
  invoices: "invoices",
  "invoice-lines": "invoices",
  "delivery-notes": "delivery_notes",
  "delivery-note-lines": "delivery_notes",
  ledger: "ledger",
  budget: "budget",
  warehouses: "warehouses",
};

export type ApiAccess =
  | { kind: "skip" }
  | { kind: "require"; permission: Permission }
  | { kind: "deny" };

/**
 * API yolu → yetki. Eşleşme yoksa `deny` (varsayılan reddet).
 * `/api/auth/*` oturum kurallarını proxy'ye bırakır (`skip`).
 */
export function getApiPermission(
  pathname: string,
  method: string
): ApiAccess {
  if (pathname.startsWith("/api/auth")) return { kind: "skip" };
  if (pathname === "/api/health") return { kind: "skip" };

  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  const suffix = write ? "write" : "read";

  if (pathname.startsWith("/api/orders")) {
    return { kind: "require", permission: `orders:${suffix}` };
  }
  if (pathname.startsWith("/api/recipes")) {
    return { kind: "require", permission: `recipes:${suffix}` };
  }
  if (pathname.startsWith("/api/raw-material-orders")) {
    return { kind: "require", permission: `raw_material_orders:${suffix}` };
  }
  if (pathname.startsWith("/api/raw-materials")) {
    return { kind: "require", permission: `raw_materials:${suffix}` };
  }
  if (pathname.startsWith("/api/stock")) {
    return { kind: "require", permission: `stock:${suffix}` };
  }
  if (pathname.startsWith("/api/production/lines")) {
    return { kind: "require", permission: `factory:${suffix}` };
  }
  if (pathname.startsWith("/api/production/batches")) {
    return { kind: "require", permission: `factory:${suffix}` };
  }
  if (pathname.startsWith("/api/lab/experiments")) {
    return { kind: "require", permission: `lab:${suffix}` };
  }
  if (pathname.startsWith("/api/lab/samples")) {
    return { kind: "require", permission: `lab:${suffix}` };
  }
  if (pathname.startsWith("/api/lab/people")) {
    return { kind: "require", permission: `lab:${suffix}` };
  }
  if (pathname.startsWith("/api/audit")) {
    return { kind: "require", permission: "admin:read" };
  }
  if (pathname.startsWith("/api/backups")) {
    return {
      kind: "require",
      permission: write ? "backups:write" : "backups:read",
    };
  }
  if (pathname.startsWith("/api/users")) {
    return {
      kind: "require",
      permission: write ? "users:write" : "users:read",
    };
  }
  if (pathname.startsWith("/api/departments")) {
    if (write) {
      return { kind: "require", permission: "admin:write" };
    }
    // Form açılır listeleri — oturum yeter, dashboard yetkisi gerekmez
    return { kind: "skip" };
  }

  if (pathname.startsWith("/api/invoice-events")) {
    return { kind: "require", permission: `invoices:${suffix}` };
  }
  if (pathname.startsWith("/api/cheque-notes")) {
    return { kind: "require", permission: `invoices:${suffix}` };
  }
  if (pathname.startsWith("/api/budget-entries") || pathname.startsWith("/api/budget-categories")) {
    return { kind: "require", permission: `budget:${suffix}` };
  }
  if (pathname.startsWith("/api/invoice-docs")) {
    return { kind: "require", permission: "invoices:read" };
  }
  if (pathname.startsWith("/api/document-settings")) {
    return { kind: "require", permission: `invoices:${suffix}` };
  }

  const catalogMatch = pathname.match(/^\/api\/catalog\/([^/]+)/);
  if (catalogMatch) {
    const resource = CATALOG_ENTITY_RESOURCE[catalogMatch[1]];
    if (!resource) return { kind: "deny" };
    return { kind: "require", permission: `${resource}:${suffix}` };
  }

  return { kind: "deny" };
}

/** Sidebar href → kaynak eşlemesi */
export const NAV_ITEMS: {
  title: string;
  href: string;
  resource: Resource;
  label: string;
  hiddenFor?: Role[];
}[] = [
  {
    title: "Genel",
    href: "/dashboard",
    resource: "dashboard",
    label: "Dashboard",
    hiddenFor: ["ADMIN", "MANAGER", "HR"],
  },
  { title: "İK", href: "/personnel", resource: "personnel", label: "Personel" },
  { title: "Üretim", href: "/factory", resource: "factory", label: "Fabrika & Üretim" },
  { title: "Üretim", href: "/recipes", resource: "recipes", label: "Reçeteler" },
  { title: "Üretim", href: "/rd-lab", resource: "lab", label: "Laboratuvar" },
  { title: "Stok", href: "/raw-materials", resource: "raw_materials", label: "Hammadde" },
  { title: "Stok", href: "/products", resource: "products", label: "Mamul Ürün" },
  { title: "Stok", href: "/stock", resource: "stock", label: "Stok Durumu" },
  {
    title: "Stok",
    href: "/warehouses",
    resource: "warehouses",
    label: "Depolar",
    hiddenFor: ["PRODUCTION"],
  },
  {
    title: "Stok",
    href: "/raw-material-orders",
    resource: "raw_material_orders",
    label: "Hammadde Talepleri",
    hiddenFor: ["PRODUCTION"],
  },
  {
    title: "Stok",
    href: "/orders",
    resource: "orders",
    label: "Sevkiyat",
    hiddenFor: ["PRODUCTION"],
  },
  { title: "Satış", href: "/customers", resource: "customers", label: "Müşteriler" },
  {
    title: "Muhasebe",
    href: "/suppliers",
    resource: "suppliers",
    label: "Tedarikçiler",
    hiddenFor: ["PRODUCTION"],
  },
  { title: "Muhasebe", href: "/invoices", resource: "invoices", label: "Faturalar" },
  { title: "Muhasebe", href: "/ledger", resource: "ledger", label: "Rapor" },
  { title: "Muhasebe", href: "/budget", resource: "budget", label: "Bütçe" },
  { title: "Sistem", href: "/document-settings", resource: "invoices", label: "PDF ayarları" },
  { title: "Sistem", href: "/admin", resource: "admin", label: "Yönetim" },
];

const ROLE_HOME: Record<Role, string> = {
  SYSTEM_ADMIN: "/dashboard",
  ADMIN: "/admin",
  MANAGER: "/admin",
  STOCK: "/stock",
  ACCOUNTING: "/invoices",
  PRODUCTION: "/factory",
  SALES: "/orders",
  HR: "/personnel",
};

export function isNavItemVisible(role: Role, item: (typeof NAV_ITEMS)[number]): boolean {
  if (item.hiddenFor?.includes(role)) return false;
  return canRead(role, item.resource);
}

export function getFirstAllowedPath(role: Role): string {
  const home = ROLE_HOME[role];
  const homeResource = pathToResource(home);
  if (homeResource && canRead(role, homeResource)) return home;
  for (const item of NAV_ITEMS) {
    if (isNavItemVisible(role, item)) return item.href;
  }
  return "/login";
}
