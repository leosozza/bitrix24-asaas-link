// Shared Bitrix helpers (form-urlencoded + bracket notation)
export function flattenParams(obj: unknown, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...flattenParams(v, prefix ? `${prefix}[${i}]` : String(i))));
    return out;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === "object") {
        out.push(...flattenParams(v, key));
      } else if (v !== undefined && v !== null) {
        out.push([key, String(v)]);
      }
    }
    return out;
  }
  out.push([prefix, String(obj)]);
  return out;
}

export async function callBitrix(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string): Promise<any> {
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    return { error: "INVALID_ENDPOINT", error_description: `Endpoint Bitrix ausente ou inválido (recebido: "${endpoint}"). Reinstale o app no Bitrix24.` };
  }
  const base = endpoint.endsWith("/") ? endpoint : endpoint + "/";
  const form = new URLSearchParams();
  for (const [k, v] of flattenParams(params)) form.append(k, v);
  form.append("auth", accessToken);
  const r = await fetch(`${base}${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: "INVALID_JSON", error_description: text.slice(0, 300) }; }
}
