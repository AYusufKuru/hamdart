export const ROLES = [
  "SYSTEM_ADMIN",
  "ADMIN",
  "MANAGER",
  "STOCK",
  "ACCOUNTING",
  "PRODUCTION",
  "SALES",
  "HR",
  "EXECUTIVE",
  "STOCK_FACTORY",
  "STOCK_INTERNET",
  "STOCK_ISTANBUL",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_ACCESS = ["view", "edit"] as const;
export type RoleAccess = (typeof ROLE_ACCESS)[number];

export const ROLE_ACCESS_LABELS: Record<RoleAccess, string> = {
  view: "Görüntüleme",
  edit: "Değişiklik",
};

/** Kullanıcıya verilen rol ve o roldeki erişim düzeyi */
export type RoleGrant = { role: Role; access: RoleAccess };

/** Tek rol (değişiklik erişimiyle) veya rol listesi taşıyan kullanıcı */
export type Principal = Role | { role: Role; grants?: readonly RoleGrant[] };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Ham rol listesini doğrular: tekrar eden rolde "edit" kazanır, sistem yöneticisi
 * her zaman "edit"tir, sıra ROLES sırasıdır (ilk eleman birincil roldür).
 * Liste boşsa yedek rol "edit" erişimiyle kullanılır.
 */
export function normalizeGrants(raw: unknown, fallbackRole?: string): RoleGrant[] {
  const byRole = new Map<Role, RoleAccess>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const role = (item as { role?: unknown })?.role;
      const access = (item as { access?: unknown })?.access;
      if (!isRole(role)) continue;
      const next: RoleAccess =
        role === "SYSTEM_ADMIN" || access !== "view" ? "edit" : "view";
      if (byRole.get(role) !== "edit") byRole.set(role, next);
    }
  }
  if (byRole.size === 0 && isRole(fallbackRole)) {
    byRole.set(fallbackRole, "edit");
  }
  return ROLES.filter((role) => byRole.has(role)).map((role) => ({
    role,
    access: byRole.get(role)!,
  }));
}

export function grantsOf(principal: Principal): readonly RoleGrant[] {
  if (typeof principal === "string") return [{ role: principal, access: "edit" }];
  return principal.grants && principal.grants.length > 0
    ? principal.grants
    : [{ role: principal.role, access: "edit" }];
}

function editGrants(principal: Principal): RoleGrant[] {
  return grantsOf(principal).filter((g) => g.access === "edit");
}

export function hasRole(principal: Principal, role: Role): boolean {
  return grantsOf(principal).some((g) => g.role === role);
}

export function grantsLabel(grants: readonly RoleGrant[]): string {
  return grants
    .map((g) =>
      g.access === "view" ? `${ROLE_LABELS[g.role]} (görüntüleme)` : ROLE_LABELS[g.role]
    )
    .join(", ");
}

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
  /** Birincil rol (grants içindeki ilk rol) */
  role: Role;
  grants: RoleGrant[];
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
  EXECUTIVE: "Yönetim",
  STOCK_FACTORY: "Fabrika Depo",
  STOCK_INTERNET: "İnternet Depo",
  STOCK_ISTANBUL: "İstanbul Depo",
};

/** Yalnızca belirli depoları görebilen roller → depo kimlikleri */
const ROLE_WAREHOUSE_SCOPE: Partial<Record<Role, readonly string[]>> = {
  STOCK_FACTORY: ["wh-mamul-fabrika"],
  STOCK_INTERNET: ["wh-mamul-internet"],
  STOCK_ISTANBUL: ["wh-mamul-istanbul"],
};

/** Depoya bağlı rollerin birbirine mamul aktarabildiği depolar */
const FINISHED_TRANSFER_WAREHOUSES: readonly string[] = [
  "wh-mamul-fabrika",
  "wh-mamul-internet",
  "wh-mamul-istanbul",
];

function roleWarehouseScope(role: Role): readonly string[] | null {
  return ROLE_WAREHOUSE_SCOPE[role] ?? null;
}

/** Kaynağı okuyabilen rollerin depo kapsamlarının birleşimi; kapsamsız rol varsa null */
function scopeFor(principal: Principal, resource: Resource): readonly string[] | null {
  const relevant = grantsOf(principal).filter((g) =>
    grantHasPermission(g, `${resource}:read`)
  );
  if (relevant.length === 0) return null;
  const ids = new Set<string>();
  for (const g of relevant) {
    const scope = roleWarehouseScope(g.role);
    if (!scope) return null;
    for (const id of scope) ids.add(id);
  }
  return [...ids];
}

/** Stok ve aktarımları görebildiği depolar; null: tüm depolar */
export function warehouseScope(principal: Principal): readonly string[] | null {
  return scopeFor(principal, "stock");
}

/** Depo listesinde görebildiği depolar (aktarım hedefleri dahil); null: tüm depolar */
export function warehouseListScope(principal: Principal): readonly string[] | null {
  return scopeFor(principal, "warehouses") ? FINISHED_TRANSFER_WAREHOUSES : null;
}

/** Depoya bağlı rol aktarımı: kaynak kendi deposu, hedef diğer mamul depoları */
export function canTransferBetween(
  principal: Principal,
  fromWarehouseId: string,
  toWarehouseId: string
): boolean {
  return editGrants(principal).some((g) => {
    if (!grantHasPermission(g, "stock:write")) return false;
    const scope = roleWarehouseScope(g.role);
    if (!scope) return true;
    return (
      scope.includes(fromWarehouseId) && FINISHED_TRANSFER_WAREHOUSES.includes(toWarehouseId)
    );
  });
}

/** Mamul transfer talebi: kendi deposuna (kapsamlı rol) veya herhangi bir mamul deposuna */
export function canRequestStockTransfer(principal: Principal, toWarehouseId?: string): boolean {
  return editGrants(principal).some((g) => {
    if (!grantHasPermission(g, "stock:write") || g.role === "PRODUCTION") return false;
    const scope = roleWarehouseScope(g.role);
    if (!scope) return true;
    return toWarehouseId === undefined || scope.includes(toWarehouseId);
  });
}

/** Talebi gönderen depo yanıtlar (onay / ret) */
export function canRespondTransferRequest(
  principal: Principal,
  request: { fromWarehouseId: string }
): boolean {
  return editGrants(principal).some((g) => {
    if (!grantHasPermission(g, "stock:write") || g.role === "PRODUCTION") return false;
    const scope = roleWarehouseScope(g.role);
    return !scope || scope.includes(request.fromWarehouseId);
  });
}

/** İstanbul sevkiyat adımı: onay ve çıkış gönderen depoda, varış alan depoda */
export function canAdvanceStockTransfer(
  principal: Principal,
  transfer: { fromWarehouseId: string; toWarehouseId: string },
  action: string
): boolean {
  return editGrants(principal).some((g) => {
    if (!grantHasPermission(g, "stock:write")) return false;
    const scope = roleWarehouseScope(g.role);
    if (!scope) return true;
    return action === "arrive"
      ? scope.includes(transfer.toWarehouseId)
      : scope.includes(transfer.fromWarehouseId);
  });
}

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
      [
        "invoices",
        "delivery_notes",
        "ledger",
        "budget",
        "suppliers",
        "personnel",
        "raw_material_orders",
      ],
      "both"
    ),
    ...resourcePerms(
      ["customers", "orders", "raw_materials", "products", "warehouses"],
      "read"
    ),
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
    ...resourcePerms(
      ["customers", "orders", "delivery_notes", "raw_material_orders", "invoices"],
      "both"
    ),
    ...resourcePerms(["factory", "raw_materials", "warehouses", "suppliers"], "read"),
  ],
  HR: [
    ...resourcePerms(BUSINESS_RESOURCES, "read"),
    ...resourcePerms(["admin"], "read"),
    ...resourcePerms(["users"], "both"),
  ],
  EXECUTIVE: resourcePerms(
    [
      "customers",
      "invoices",
      "stock",
      "factory",
      "recipes",
      "raw_material_orders",
      "raw_materials",
      "warehouses",
    ],
    "read"
  ),
  STOCK_FACTORY: [...resourcePerms(["stock"], "both"), ...resourcePerms(["warehouses"], "read")],
  STOCK_INTERNET: [...resourcePerms(["stock"], "both"), ...resourcePerms(["warehouses"], "read")],
  STOCK_ISTANBUL: [...resourcePerms(["stock"], "both"), ...resourcePerms(["warehouses"], "read")],
};

const SCOPED_STOCK_PAGES = ["/stock", "/warehouses"];

/** Rapor ve dashboard yalnızca sistem yöneticisine açık */
const SYSTEM_ADMIN_PAGES = ["/dashboard", "/ledger"];

/** Yalnızca listelenen sayfaları açabilen roller; diğer sayfalar okuma izni olsa da kapalıdır */
const ROLE_PAGES: Partial<Record<Role, readonly string[]>> = {
  HR: ["/personnel", "/admin"],
  PRODUCTION: ["/factory", "/recipes", "/rd-lab"],
  STOCK: [
    "/raw-materials",
    "/products",
    "/stock",
    "/warehouses",
    "/raw-material-orders",
    "/orders",
  ],
  SALES: ["/customers", "/quotes", "/orders"],
  ACCOUNTING: [
    "/suppliers",
    "/invoices",
    "/quotes",
    "/delivery-notes",
    "/raw-material-tracking",
    "/cash",
    "/budget",
    "/document-settings",
  ],
  EXECUTIVE: [
    "/customers",
    "/quotes",
    "/stock",
    "/factory",
    "/recipes",
    "/raw-material-orders",
    "/raw-material-tracking",
  ],
  STOCK_FACTORY: SCOPED_STOCK_PAGES,
  STOCK_INTERNET: SCOPED_STOCK_PAGES,
  STOCK_ISTANBUL: SCOPED_STOCK_PAGES,
};

function matchesPage(pages: readonly string[], pathname: string): boolean {
  return pages.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

function isRolePage(role: Role, pathname: string): boolean {
  if (role === "SYSTEM_ADMIN") return true;
  if (matchesPage(SYSTEM_ADMIN_PAGES, pathname)) return false;
  const pages = ROLE_PAGES[role];
  return !pages || matchesPage(pages, pathname);
}

export function isSystemAdmin(principal: Principal): boolean {
  return hasRole(principal, "SYSTEM_ADMIN");
}

/** Denetim kaydı yalnızca sistem yöneticisine açık */
export function canViewAuditLogs(principal: Principal): boolean {
  return hasRole(principal, "SYSTEM_ADMIN");
}

/** Depo rolüyle sınırlı kullanıcı: sevkiyatta yalnızca depo adımlarını görür */
export function isStockRole(principal: Principal): boolean {
  return (
    hasRole(principal, "STOCK") &&
    !editGrants(principal).some(
      (g) => g.role !== "STOCK" && grantHasPermission(g, "orders:write")
    )
  );
}

/** Satış siparişi oluşturma — depo yalnızca sevkiyat yapar */
export function canCreateSalesOrder(principal: Principal): boolean {
  return editGrants(principal).some(
    (g) => g.role !== "STOCK" && grantHasPermission(g, "orders:write")
  );
}

/** Depo (ve üretim) hammadde talebi açar. Satış ve muhasebe talep açmaz. */
export function canCreateMaterialRequest(principal: Principal): boolean {
  return editGrants(principal).some(
    (g) =>
      g.role !== "SALES" &&
      g.role !== "ACCOUNTING" &&
      grantHasPermission(g, "raw_material_orders:write")
  );
}

const PURCHASE_ROLES: readonly Role[] = ["SALES", "ACCOUNTING", "SYSTEM_ADMIN", "ADMIN", "MANAGER"];

/** Tedarikçi, fiyat ve planlama — satış, muhasebe ve yönetici roller */
export function canEditRawMaterialPurchase(principal: Principal): boolean {
  return editGrants(principal).some((g) => PURCHASE_ROLES.includes(g.role));
}

/** Fatura, çek/senet gibi teklif dışı muhasebe belgeleri */
export function canCreateInvoiceDocuments(principal: Principal): boolean {
  return editGrants(principal).some(
    (g) => g.role !== "SALES" && grantHasPermission(g, "invoices:write")
  );
}

/** Fatura kayıtlarına yalnızca satış rolüyle yazabilen kullanıcı: yalnızca teklif */
export function isQuoteOnlyRole(principal: Principal): boolean {
  return canWrite(principal, "invoices") && !canCreateInvoiceDocuments(principal);
}

/** Yol bazlı yetkiden sonra rol bazlı ek API kısıtları */
export function isApiBlockedForRole(
  principal: Principal,
  pathname: string,
  method: string
): boolean {
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (write && isQuoteOnlyRole(principal)) {
    return ["/api/invoice-events", "/api/cheque-notes", "/api/document-settings"].some(
      (prefix) => pathname.startsWith(prefix)
    );
  }
  return false;
}

/** Stok girişi — depo; üretim depodan talep eder, depoya bağlı roller giriş yapmaz */
export function canCreateStockEntry(principal: Principal): boolean {
  return editGrants(principal).some(
    (g) =>
      g.role !== "PRODUCTION" &&
      !roleWarehouseScope(g.role) &&
      grantHasPermission(g, "stock:write")
  );
}

/** Depolar arası aktarım / depodan hammadde talebi */
export function canCreateStockTransfer(principal: Principal): boolean {
  return canWrite(principal, "stock");
}

export const STOCK_RECEIPT_ACTIONS = [
  "mark_received",
  "start_qc",
  "approve_qc",
  "reject_qc",
] as const;

function roleCanApplyRawMaterialOrderAction(role: Role, action: string): boolean {
  if (!roleHasPermission(role, "raw_material_orders:write")) return false;
  if (role === "SALES") return false;
  if (role === "STOCK") {
    return (STOCK_RECEIPT_ACTIONS as readonly string[]).includes(action);
  }
  if (role === "PRODUCTION") {
    return action !== "mark_received";
  }
  return true;
}

export function canApplyRawMaterialOrderAction(
  principal: Principal,
  action: string
): boolean {
  return editGrants(principal).some((g) => roleCanApplyRawMaterialOrderAction(g.role, action));
}

export const SHIPMENT_STATUSES = ["picking", "shipped", "delivered"] as const;

function roleCanSetOrderStatus(role: Role, status: string): boolean {
  if (!roleHasPermission(role, "orders:write")) return false;
  if (role === "STOCK") {
    return (SHIPMENT_STATUSES as readonly string[]).includes(status);
  }
  return true;
}

export function canSetOrderStatus(principal: Principal, status: string): boolean {
  return editGrants(principal).some((g) => roleCanSetOrderStatus(g.role, status));
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

/** Sistem yöneticisi veya yönetici/müdür (değişiklik erişimiyle) */
export function isPrivilegedRole(principal: Principal): boolean {
  return editGrants(principal).some(
    (g) => g.role === "SYSTEM_ADMIN" || isAdminLikeRole(g.role)
  );
}

/** Teklif kalemlerinde yönetici olmayan rollerin verebileceği en yüksek iskonto (%) */
export const QUOTE_DISCOUNT_LIMIT = 10;

export function maxQuoteDiscountRate(principal: Principal): number {
  return isPrivilegedRole(principal) ? 100 : QUOTE_DISCOUNT_LIMIT;
}

function roleAssignableRoles(actor: Role): Role[] {
  if (actor === "SYSTEM_ADMIN") return [...ROLES];
  if (isAdminLikeRole(actor)) {
    return ROLES.filter((role) => role !== "SYSTEM_ADMIN");
  }
  if (actor === "HR") {
    return ROLES.filter((role) => !isProtectedUserRole(role));
  }
  return [];
}

export function assignableRoles(actor: Principal): Role[] {
  const allowed = new Set<Role>();
  for (const g of editGrants(actor)) {
    for (const role of roleAssignableRoles(g.role)) allowed.add(role);
  }
  return ROLES.filter((role) => allowed.has(role));
}

function roleCanManageUser(actor: Role, targetRole: string): boolean {
  if (actor === "SYSTEM_ADMIN") return true;
  if (isAdminLikeRole(actor)) return targetRole !== "SYSTEM_ADMIN";
  if (actor === "HR") return !isProtectedUserRole(targetRole);
  return false;
}

/**
 * Hedef kullanıcının rolleri üzerinde işlem (rol, şifre, kapatma, silme).
 * Hedefin tüm rollerini yönetebilen bir rol gerekir; İK korumalı rollere asla dokunamaz.
 */
export function canManageUser(
  actor: Principal,
  targetRoles: string | readonly string[]
): boolean {
  const targets = typeof targetRoles === "string" ? [targetRoles] : targetRoles;
  return editGrants(actor).some((g) =>
    targets.every((target) => roleCanManageUser(g.role, target))
  );
}

export function canAssignRole(actor: Principal, targetRole: Role): boolean {
  return assignableRoles(actor).includes(targetRole);
}

export function rolePermissions(role: Role): Permission[] | "*" {
  if (role === "SYSTEM_ADMIN") return "*";
  return ROLE_PERMISSIONS[role] ?? [];
}

function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = rolePermissions(role);
  if (perms === "*") return true;
  if (perms.includes(permission)) return true;
  const [resource, action] = permission.split(":") as [Resource, "read" | "write"];
  if (action === "read") {
    return perms.includes(`${resource}:write`);
  }
  return false;
}

/** Görüntüleme erişimli rol yalnızca okuma izni verir */
function grantHasPermission(grant: RoleGrant, permission: Permission): boolean {
  if (grant.access === "view" && permission.endsWith(":write")) return false;
  return roleHasPermission(grant.role, permission);
}

export function hasPermission(principal: Principal, permission: Permission): boolean {
  return grantsOf(principal).some((g) => grantHasPermission(g, permission));
}

export function canRead(principal: Principal, resource: Resource): boolean {
  return hasPermission(principal, `${resource}:read`);
}

export function canWrite(principal: Principal, resource: Resource): boolean {
  return hasPermission(principal, `${resource}:write`);
}

/** Sayfa yolu → kaynak */
export function pathToResource(pathname: string): Resource | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/personnel")) return "personnel";
  if (pathname.startsWith("/factory")) return "factory";
  if (pathname.startsWith("/recipes")) return "recipes";
  if (pathname.startsWith("/raw-material-orders")) return "raw_material_orders";
  if (pathname.startsWith("/raw-material-tracking")) return "raw_material_orders";
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
  if (pathname.startsWith("/cash")) return "budget";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/rd-lab")) return "lab";
  return null;
}

export function getPageReadPermission(pathname: string): Permission | null {
  const resource = pathToResource(pathname);
  if (!resource) return null;
  return `${resource}:read`;
}

/** Sayfa açılabilir mi — rollerden biri sayfayı listeler ve kaynağı okuyabilir */
export function canOpenPage(principal: Principal, pathname: string): boolean {
  const permission = getPageReadPermission(pathname);
  if (!permission) return true;
  return grantsOf(principal).some(
    (g) => isRolePage(g.role, pathname) && grantHasPermission(g, permission)
  );
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
  if (pathname.startsWith("/api/cash-accounts")) {
    return { kind: "require", permission: `budget:${suffix}` };
  }
  if (pathname.startsWith("/api/invoice-docs")) {
    return { kind: "require", permission: "invoices:read" };
  }
  if (pathname.startsWith("/api/budget-docs")) {
    return { kind: "require", permission: "budget:read" };
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
  onlyFor?: Role[];
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
    hiddenFor: ["PRODUCTION", "SALES"],
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
    hiddenFor: ["PRODUCTION", "SALES"],
  },
  { title: "Satış", href: "/customers", resource: "customers", label: "Müşteriler" },
  {
    title: "Satış",
    href: "/quotes",
    resource: "invoices",
    label: "Fiyat Teklifi",
    onlyFor: ["EXECUTIVE", "SALES"],
  },
  {
    title: "Satış",
    href: "/orders",
    resource: "orders",
    label: "Sevkiyat",
    onlyFor: ["SALES"],
  },
  {
    title: "Muhasebe",
    href: "/suppliers",
    resource: "suppliers",
    label: "Tedarikçiler",
    hiddenFor: ["PRODUCTION", "SALES"],
  },
  { title: "Muhasebe", href: "/invoices", resource: "invoices", label: "Faturalar" },
  {
    title: "Muhasebe",
    href: "/raw-material-tracking",
    resource: "raw_material_orders",
    label: "Hammadde Talep Takip",
  },
  { title: "Muhasebe", href: "/cash", resource: "budget", label: "Kasa" },
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
  SALES: "/customers",
  HR: "/personnel",
  EXECUTIVE: "/customers",
  STOCK_FACTORY: "/stock",
  STOCK_INTERNET: "/stock",
  STOCK_ISTANBUL: "/stock",
};

export function isNavItemVisible(
  principal: Principal,
  item: (typeof NAV_ITEMS)[number]
): boolean {
  return grantsOf(principal).some(
    (g) =>
      !item.hiddenFor?.includes(g.role) &&
      (!item.onlyFor || item.onlyFor.includes(g.role)) &&
      isRolePage(g.role, item.href) &&
      grantHasPermission(g, `${item.resource}:read`)
  );
}

export function getFirstAllowedPath(principal: Principal): string {
  for (const g of grantsOf(principal)) {
    const home = ROLE_HOME[g.role];
    if (canOpenPage(principal, home)) return home;
  }
  for (const item of NAV_ITEMS) {
    if (isNavItemVisible(principal, item)) return item.href;
  }
  return "/login";
}
