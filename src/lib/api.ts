export type Tier = "low" | "medium" | "high" | "critical";

export interface Finding {
  // Null for anonymous callers — the internal detection code is withheld
  // server-side (PRD §16); `category` is the public, plain-English grouping.
  service: string | null;
  category?: string;
  tier: Tier;
  score?: number;
  summary: string;
  evidence?: Record<string, unknown>;
}

export interface Assessment {
  tier: Tier;
  score: number;
  title: string;
  body: string;
  services: string[] | null;
  requires_callback: boolean;
  callback_phone: string | null;
  rationale: string[];
  alertable: boolean;
}

export interface AnalyseResult {
  message: {
    from: string;
    display_name: string | null;
    reply_to: string | null;
    subject: string | null;
    attachments: string[];
    urls: string[];
    remediable: boolean;
  };
  findings: Finding[];
  assessment: Assessment | null;
}

export interface ScanHit {
  candidate: string;
  technique: string;
  similarity: number;
  tier: Tier;
  armed: boolean;
}

export interface ScanResult {
  protected_domain: string;
  candidates_checked: number;
  hits: ScanHit[];
  note: string;
}

export interface Quote {
  plan: string;
  term: string;
  platform_cents: number;
  protected_cents: number;
  monitored_cents: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  total_usd: number;
  breakdown: Record<string, unknown>;
}

export interface Coverage {
  sources: string[];
  capabilities: string[];
  protection_level: "full" | "standard" | "limited";
  active_detections: string[];
  inactive_detections: string[];
}

export interface ConnectMethod {
  id: string;
  name: string;
  tier: number;
  effort: string;
  who: string;
  steps: string[];
  remediation: boolean;
  identity_from: string;
  protection_level: "full" | "standard" | "limited";
}

export interface ConnectionPlan {
  domain: string;
  detected: boolean;
  mx_hosts: string[];
  provider: {
    id: string;
    name: string;
    aliases: string[];
    notes: string | null;
  };
  imap: { host: string | null; port: number };
  dns: { dmarc_policy: string | null; spf_present: boolean };
  recommended: ConnectMethod;
  alternatives: ConnectMethod[];
}

export interface AlertRecord {
  id: string;
  tier: Tier;
  title: string;
  body: string;
  state: string;
  mailbox_id: string | null;
  requires_callback: boolean;
  callback_phone: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

export interface MailboxRecord {
  id: string;
  address: string;
  mailbox_class: string;
  sources: string[];
  protection_level: "full" | "standard" | "limited";
  inactive_detections: string[];
  is_shared: boolean;
}

export interface Oversight {
  total: number;
  open: number;
  critical_open: number;
  acknowledged: number;
  unacknowledged_over_15m: number;
  mailboxes: number;
  domains: number;
  by_tier: Record<string, number>;
  coverage: Record<string, number>;
}

export interface SimulationResult {
  runs: { id: string; expected: string; detected: string[]; passed: boolean }[];
  passed: number;
  total: number;
}

const TOKEN_KEY = "envelock.access_token";

export const auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
  get signedIn(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  get unauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  analyse: (body: {
    raw_message: string;
    owned_domains?: string[];
    known_counterparties?: string[];
    counterparty_known_bank_ids?: string[];
    counterparty_message_count?: number;
    counterparty_phone?: string | null;
    source?: string;
  }) =>
    request<AnalyseResult>("/api/v1/analyse", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  scanDomain: (domain: string) =>
    request<ScanResult>("/api/v1/domains/scan", {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),

  quote: (body: {
    plan: string;
    term: string;
    mail_domains: number;
    protected: number;
    monitored: number;
  }) =>
    request<Quote>("/api/v1/pricing/quote", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  coverage: (sources: string[]) =>
    request<Coverage>(
      `/api/v1/coverage?sources=${encodeURIComponent(sources.join(","))}`,
    ),

  connect: (domain: string) =>
    request<ConnectionPlan>(
      `/api/v1/domains/${encodeURIComponent(domain)}/connect`,
    ),

  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (body: { email: string; password: string; tenant_name: string }) =>
    request<{ user_id: string; tenant_id: string; next: string }>(
      "/api/v1/auth/register",
      { method: "POST", body: JSON.stringify(body) },
    ),

  login: (body: { email: string; password: string }) =>
    request<{ mfa_token: string; mfa_setup_required?: boolean }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify(body) },
    ),

  mfaSetup: (mfaToken: string) =>
    request<{ secret: string; otpauth_uri: string }>("/api/v1/auth/mfa/setup", {
      method: "POST",
      body: JSON.stringify({ refresh_token: mfaToken }),
    }),

  mfaVerify: (body: { mfa_token: string; code: string }) =>
    request<{ access_token: string; role: string; recovery_codes?: string[] }>(
      "/api/v1/auth/mfa/verify",
      { method: "POST", body: JSON.stringify(body) },
    ),

  me: () =>
    request<{ email: string; role: string; tenant_id: string; is_admin: boolean }>(
      "/api/v1/auth/me",
    ),

  // ── Tenant data ───────────────────────────────────────────────────────────
  bootstrap: (body: { name: string; domain: string }) =>
    request<{ tenant_id: string; domain: string; ingest_address: string }>(
      "/api/v1/tenants/bootstrap",
      { method: "POST", body: JSON.stringify(body) },
    ),

  alerts: (state?: string) =>
    request<{ alerts: AlertRecord[]; count: number }>(
      `/api/v1/alerts${state ? `?state=${state}` : ""}`,
    ),

  acknowledgeAlert: (id: string) =>
    request<AlertRecord>(`/api/v1/alerts/${id}/acknowledge`, { method: "POST" }),

  quarantineAlert: (id: string) =>
    request<{ succeeded: boolean; reason: string; alert_only: boolean }>(
      `/api/v1/alerts/${id}/quarantine`,
      { method: "POST" },
    ),

  mailboxes: () => request<{ mailboxes: MailboxRecord[] }>("/api/v1/mailboxes"),

  addMailbox: (body: {
    address: string;
    mailbox_class: string;
    sources: string[];
  }) =>
    request<MailboxRecord>("/api/v1/mailboxes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  oversight: () => request<Oversight>("/api/v1/oversight"),

  audit: () =>
    request<{ events: { action: string; at: string; detail: unknown }[] }>(
      "/api/v1/audit",
    ),

  simulate: (protected_domain: string) =>
    request<SimulationResult>("/api/v1/simulate", {
      method: "POST",
      body: JSON.stringify({ protected_domain }),
    }),

  brandPosture: (domain: string) =>
    request<{
      domain: string;
      spf_present: boolean;
      dmarc_present: boolean;
      dmarc_policy: string | null;
      protected: boolean;
      tier: Tier;
      summary: string;
      recommendations: string[];
    }>(`/api/v1/brand/${encodeURIComponent(domain)}/posture`),

  channelStatus: () =>
    request<{
      mail_providers: { source: string; configured: boolean; reason: string | null }[];
      imap_broker: Record<string, number | string>;
      notification_rungs: { rung: string; configured: boolean; metered: boolean }[];
    }>("/api/v1/status/channels"),

  health: () =>
    request<{ status: string; version: string; env: string }>("/health"),
};
