import { csrfHeader } from "@/lib/auth/csrf-client";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      typeof body.error === "string" ? body.error : "İstek başarısız"
    );
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: { ...csrfHeader() },
  });
  return handleResponse<T>(res);
}
