export const ROLES = [
  "ADMIN",
  "MANAGER",
  "PRODUCTION",
  "WAREHOUSE",
  "LAB",
  "COMMERCIAL",
  "VIEWER",
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
  "ledger",
  "budget",
  "admin",
  "lab",
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
  ADMIN: "Sistem Yöneticisi",
  MANAGER: "Genel Müdür",
  PRODUCTION: "Üretim",
  WAREHOUSE: "Depo & Lojistik",
  LAB: "Laboratuvar",
  COMMERCIAL: "Ticari",
  VIEWER: "İzleyici",
};

function allReadPermissions(): Permission[] {
  return RESOURCES.map((r) => `${r}:read` as Permission);
}

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

/** Rol → izin listesi (ADMIN ayrı ele alınır) */
const ROLE_PERMISSIONS: Record<Exclude<Role, "ADMIN">, Permission[]> = {
  MANAGER: [
    ...resourcePerms(
      [
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
        "ledger",
        "budget",
        "lab",
      ],
      "both"
    ),
    "admin:read",
  ],
  PRODUCTION: resourcePerms(
    [
      "dashboard",
      "factory",
      "recipes",
      "raw_materials",
      "raw_material_orders",
      "products",
    ],
    "both"
  ),
  WAREHOUSE: resourcePerms(
    ["dashboard", "stock", "warehouses", "orders"],
    "both"
  ),
  LAB: resourcePerms(["dashboard", "lab"], "both"),
  COMMERCIAL: resourcePerms(
    ["dashboard", "customers", "suppliers", "invoices", "ledger", "budget"],
    "both"
  ),
  VIEWER: allReadPermissions(),
};

export function rolePermissions(role: Role): Permission[] | "*" {
  if (role === "ADMIN") return "*";
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
  if (pathname.startsWith("/api/audit")) {
    return { kind: "require", permission: "admin:read" };
  }
  if (pathname.startsWith("/api/backups")) {
    return {
      kind: "require",
      permission: write ? "admin:write" : "admin:read",
    };
  }
  if (pathname.startsWith("/api/users")) {
    return {
      kind: "require",
      permission: write ? "admin:write" : "admin:read",
    };
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
}[] = [
  { title: "Genel", href: "/dashboard", resource: "dashboard", label: "Dashboard" },
  { title: "Genel", href: "/personnel", resource: "personnel", label: "Personel" },
  { title: "Üretim", href: "/factory", resource: "factory", label: "Fabrika & Üretim" },
  { title: "Üretim", href: "/recipes", resource: "recipes", label: "Reçeteler" },
  { title: "Üretim", href: "/raw-materials", resource: "raw_materials", label: "Hammadde" },
  {
    title: "Üretim",
    href: "/raw-material-orders",
    resource: "raw_material_orders",
    label: "Hammadde Siparişleri",
  },
  { title: "Üretim", href: "/products", resource: "products", label: "Mamul Ürün" },
  { title: "Lojistik", href: "/stock", resource: "stock", label: "Stok Durumu" },
  { title: "Lojistik", href: "/warehouses", resource: "warehouses", label: "Depolar" },
  { title: "Lojistik", href: "/orders", resource: "orders", label: "Siparişler" },
  { title: "Ticari", href: "/customers", resource: "customers", label: "Müşteriler" },
  { title: "Ticari", href: "/suppliers", resource: "suppliers", label: "Tedarikçiler" },
  { title: "Ticari", href: "/invoices", resource: "invoices", label: "Cari Açık" },
  { title: "Ticari", href: "/ledger", resource: "ledger", label: "Yevmiye" },
  { title: "Ticari", href: "/budget", resource: "budget", label: "Bütçe" },
  { title: "Sistem", href: "/admin", resource: "admin", label: "Denetim & Yedek" },
  { title: "Ar-Ge", href: "/rd-lab", resource: "lab", label: "Laboratuvar" },
];

export function getFirstAllowedPath(role: Role): string {
  for (const item of NAV_ITEMS) {
    if (canRead(role, item.resource)) return item.href;
  }
  return "/login";
}
