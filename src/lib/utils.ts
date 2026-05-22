export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const uid = () => Math.random().toString(36).slice(2, 9);

export const LS = {
  get: <T>(k: string, def: T): T => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : def;
    } catch {
      return def;
    }
  },
  set: <T>(k: string, v: T) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// ── Zoho API fetch (client-side, direct — for reads only) ──────────────────
const ZOHO_BASES: Record<string, string> = {
  ".com":    "https://www.zohoapis.com",
  ".in":     "https://www.zohoapis.in",
  ".com.au": "https://www.zohoapis.com.au",
  ".eu":     "https://www.zohoapis.eu",
  ".jp":     "https://www.zohoapis.jp",
};

export const zohoFetch = async (
  accessToken: string,
  region: string,
  organizationId: string,
  path: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>> => {
  const base = ZOHO_BASES[region] || ZOHO_BASES[".com"];
  const qs = new URLSearchParams({ organization_id: organizationId, ...params }).toString();
  const r = await fetch(`${base}/books/v3${path}?${qs}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Zoho API error ${r.status} on ${path}`);
  return r.json();
};

// ── Claude API call (goes through Next.js API route) ───────────────────────
export const callClaude = async (
  journals: unknown[],
  section: string,
  type: "section" | "summary" = "section"
): Promise<unknown> => {
  const r = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ journals, section, type }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || `API error ${r.status}`);
  }
  const data = await r.json();
  return data.result;
};

// ── Demo journal generator ─────────────────────────────────────────────────
export function generateDemoJournals(count: number) {
  const accounts = [
    "1100-Cash", "1200-Accounts Receivable", "2100-Accounts Payable",
    "3000-Revenue", "4000-COGS", "5000-Salaries", "6000-Rent", "6100-Utilities",
    "7000-Depreciation", "8000-Income Tax",
  ];
  const users = ["asim@hexamatics.com", "finance@hexamatics.com", "manager@hexamatics.com"];
  const refs  = ["INV-001", "BILL-045", "ADJ-023", "JNL-099", "MEM-012"];

  return Array.from({ length: count }, (_, i) => {
    const amount   = Math.round(Math.random() * 100_000 * 100) / 100;
    const isRound  = Math.random() > 0.7;
    const isWeekend= Math.random() > 0.88;
    const date     = new Date(Date.now() - Math.random() * 365 * 86_400_000);
    if (isWeekend) date.setDate(date.getDate() + (6 - date.getDay()));

    const debit  = isRound ? Math.round(amount / 1000) * 1000 : amount;
    const credit = debit; // balanced

    return {
      journal_id:        `JNL-${String(i + 1).padStart(4, "0")}`,
      date:              date.toISOString().split("T")[0],
      reference_number:  refs[Math.floor(Math.random() * refs.length)],
      notes:             Math.random() > 0.15 ? `Journal entry — ${accounts[Math.floor(Math.random() * accounts.length)]}` : "",
      created_by_name:   users[Math.floor(Math.random() * users.length)],
      line_items: [
        { account_name: accounts[Math.floor(Math.random() * accounts.length)], debit,   credit: 0 },
        { account_name: accounts[Math.floor(Math.random() * accounts.length)], debit: 0, credit },
      ],
    };
  });
}
