import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  CheckCircle2,
  Fingerprint,
  Globe,
  Inbox,
  Link2,
  Loader2,
  PhoneCall,
  Play,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import {
  ApiError,
  api,
  auth,
  type AlertRecord,
  type MailboxRecord,
  type Oversight,
  type QualityMetric,
  type SimulationResult,
  type Tier,
} from "../lib/api";
import { Button, LevelChip, TierChip, cn } from "../components/primitives";
import ConnectionAdvisor from "../components/ConnectionAdvisor";

/* Icons are chosen from the detection id so the queue stays readable at a
   glance without the server having to send presentation details. */
const SERVICE_ICON: Record<string, LucideIcon> = {
  A1: Banknote,
  A2: Banknote,
  A13: Banknote,
  C1: Link2,
  C2: Link2,
  C3: Link2,
  C4: Link2,
  C11: Fingerprint,
  C7: Fingerprint,
  C6: Fingerprint,
  D4: Globe,
  A3: Globe,
  A4: Globe,
};

function iconFor(alert: AlertRecord): LucideIcon {
  const match = alert.body.match(/\b([ABCD]\d{1,2})\b/);
  return (match && SERVICE_ICON[match[1]]) || Inbox;
}

function timeOf(iso: string): string {
  const then = new Date(iso);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.floor(mins / 60)} hr`;
  return then.toLocaleDateString();
}

function AlertRow({
  alert,
  onAcknowledge,
  onQuarantine,
  onResolve,
}: {
  alert: AlertRecord;
  onAcknowledge: (id: string) => Promise<void>;
  onQuarantine: (id: string) => Promise<void>;
  onResolve: (id: string, dismiss: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const Icon = iconFor(alert);
  const acked = alert.state !== "open";

  async function run(action: "ack" | "quarantine" | "fraud" | "dismiss") {
    setBusy(action);
    setNote(null);
    try {
      if (action === "ack") await onAcknowledge(alert.id);
      else if (action === "quarantine") await onQuarantine(alert.id);
      else await onResolve(alert.id, action === "dismiss");
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={cn(
        "p-6 transition-colors hover:bg-[var(--bg-hover)]",
        acked && "opacity-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <TierChip tier={alert.tier} blink={!acked} />
        <span className="mono-xs fg-3 ml-auto tnum">
          {timeOf(alert.created_at)}
        </span>
      </div>

      <div className="mt-4 flex gap-4">
        <Icon size={17} className="fg-3 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-snug font-semibold text-pretty">
            {alert.title}
          </h3>
          <p className="fg-2 mt-3 text-sm leading-relaxed whitespace-pre-line">
            {alert.body}
          </p>

          {alert.requires_callback && !acked && (
            <div className="callout mt-4 flex flex-wrap items-center gap-2.5 px-4 py-3">
              <PhoneCall size={14} className="shrink-0" aria-hidden />
              <span className="text-xs font-semibold">
                {alert.callback_phone
                  ? `Call ${alert.callback_phone} to verify — the number on file with us, not the one in the email`
                  : "Verify by phone before paying. No number on file — add one so it appears here."}
              </span>
            </div>
          )}

          {note && (
            <p className="fg-3 mono-xs mt-3" role="status">
              {note}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {acked ? (
              <span className="fg-3 mono-xs flex items-center gap-1.5">
                <CheckCircle2 size={12} aria-hidden />
                {alert.state.toUpperCase()}
              </span>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="line"
                  disabled={busy !== null}
                  onClick={() => run("ack")}
                >
                  {busy === "ack" ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : null}
                  ACKNOWLEDGE
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy !== null}
                  onClick={() => run("quarantine")}
                >
                  QUARANTINE
                </Button>
                {/* Confirming real fraud reports the counterparty to the
                    cross-tenant graph, protecting every other customer (E8). */}
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy !== null}
                  onClick={() => run("fraud")}
                  title="Confirm this was real fraud — warns every other tenant"
                >
                  CONFIRM FRAUD
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy !== null}
                  onClick={() => run("dismiss")}
                >
                  DISMISS
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Simulation({ domain }: { domain: string }) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      setResult(await api.simulate(domain));
    } catch {
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="sect-label">Attack simulation</h2>
      <p className="fg-3 mt-1 text-xs leading-relaxed">
        Benign look-alike attacks, analysed but never stored as alerts
      </p>
      <Button
        size="sm"
        variant="line"
        className="mt-4 w-full"
        onClick={run}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 size={12} className="animate-spin" aria-hidden /> RUNNING
          </>
        ) : (
          <>
            <Play size={12} aria-hidden /> RUN SIMULATION
          </>
        )}
      </Button>

      {result && (
        <div className="rise mt-4 border-t pt-4">
          <p className="mono-xs">
            <span className={result.passed === result.total ? "accent" : "fg-2"}>
              {result.passed}/{result.total} DETECTED
            </span>
          </p>
          <ul className="mt-3 space-y-1.5" role="list">
            {result.runs.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span className={r.passed ? "accent" : "fg-3"}>
                  {r.passed ? "✓" : "✗"}
                </span>
                <code className="font-mono">{r.expected}</code>
                <span className="fg-3 ml-auto">
                  {r.detected.length} finding{r.detected.length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OAuthConnect({ address }: { address: string }) {
  const [providers, setProviders] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .oauthProviders()
      .then((r) => live && setProviders(r.configured))
      .catch(() => live && setProviders([]));
    return () => {
      live = false;
    };
  }, []);

  if (!providers || providers.length === 0) return null;

  async function connect(provider: string) {
    setBusy(provider);
    try {
      const { authorize_url } = await api.oauthAuthorize(provider, address);
      window.location.assign(authorize_url); // hand off to tenant consent
    } catch {
      setBusy(null);
    }
  }

  const label: Record<string, string> = { microsoft: "Microsoft 365", google: "Google" };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {providers.map((p) => (
        <Button
          key={p}
          size="sm"
          variant="line"
          onClick={() => connect(p)}
          disabled={busy !== null}
        >
          <Link2 size={12} aria-hidden /> Connect {label[p] ?? p}
        </Button>
      ))}
    </div>
  );
}

/* The two numbers that decide whether the product survives (PRD §15.4): if
   Critical false positives climb, the interrupt gets muted; if detonation
   fall-through climbs, so does COGS. Shown from live data, honestly blank until
   there is any. */
function GoverningMetrics() {
  const [metrics, setMetrics] = useState<QualityMetric[] | null>(null);

  useEffect(() => {
    api
      .qualityMetrics()
      .then((r) => setMetrics(r.metrics))
      .catch(() => setMetrics(null));
  }, []);

  if (!metrics) return null;

  const fmt = (m: QualityMetric): string => {
    if (m.observed === null) return "—";
    return m.unit === "ratio"
      ? `${(m.observed * 100).toFixed(1)}%`
      : String(m.observed);
  };

  return (
    <div className="panel p-5">
      <h2 className="sect-label">Detection quality</h2>
      <p className="fg-3 mt-1 text-xs leading-relaxed">
        The two numbers that govern the product, measured live
      </p>
      <ul className="mt-4 space-y-2.5" role="list">
        {metrics.map((m) => (
          <li
            key={m.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="fg-2">{m.name}</span>
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "tnum font-mono font-semibold",
                  m.meets === false && "text-red-500",
                  m.meets === true && "accent",
                )}
              >
                {fmt(m)}
              </span>
              <span className="fg-3 text-xs">
                {m.observed === null ? "no data" : m.meets ? "on target" : "off target"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRecord[]>([]);
  const [stats, setStats] = useState<Oversight | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([api.alerts(), api.mailboxes()]);
      setAlerts(a.alerts);
      setMailboxes(m.mailboxes);
      try {
        setStats(await api.oversight());
      } catch {
        setStats(null); // member role: no admin oversight
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.unauthorized
          ? "signed-out"
          : "Could not reach the API. Is the server running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => (filter === "open" ? alerts.filter((a) => a.state === "open") : alerts),
    [alerts, filter],
  );
  const open = alerts.filter((a) => a.state === "open");
  const critical = open.filter((a) => a.tier === "critical").length;

  async function acknowledge(id: string) {
    await api.acknowledgeAlert(id);
    await load();
  }

  async function quarantine(id: string) {
    const result = await api.quarantineAlert(id);
    if (!result.succeeded) throw new ApiError(409, result.reason);
    await load();
  }

  async function resolve(id: string, dismiss: boolean) {
    await api.resolveAlert(id, dismiss);
    await load();
  }

  if (error === "signed-out" || !auth.signedIn) {
    return (
      <main className="shell py-24">
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <h1 className="headline">Sign in to see your alerts</h1>
          <p className="lede mx-auto mt-4 text-base">
            The dashboard reads live data from your tenant, so it needs a session.
          </p>
          <Link to="/signin" className="mt-8 inline-block">
            <Button variant="accent" size="lg">
              SIGN IN
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const domain = mailboxes[0]?.address.split("@")[1] ?? "your domain";

  return (
    <main>
      <div className="border-b">
        <div className="shell flex flex-wrap items-center gap-x-8 gap-y-4 py-5">
          <div>
            <span className="sect-label">Tenant</span>
            <p className="mt-1 text-sm font-semibold">{domain}</p>
          </div>
          <div className="ml-auto flex items-center gap-8">
            {[
              ["OPEN", String(open.length), critical > 0],
              ["CRITICAL", String(critical), critical > 0],
              ["MAILBOXES", String(mailboxes.length), false],
              ["DOMAINS", String(stats?.domains ?? 0), false],
            ].map(([label, value, hot]) => (
              <div key={label as string}>
                <div
                  className={cn(
                    "font-mono tnum text-2xl font-semibold",
                    hot && "text-[var(--danger)]",
                  )}
                >
                  {value}
                </div>
                <div className="sect-label mt-1">{label}</div>
              </div>
            ))}
            <button
              onClick={() => void load()}
              aria-label="Refresh"
              className="fg-3 cursor-pointer p-2 transition-colors hover:text-[var(--fg)]"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin")} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {error && error !== "signed-out" && (
        <div className="shell py-4">
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        </div>
      )}

      <div className="shell grid12 py-8">
        <section className="col-span-12 lg:col-span-8">
          <div className="panel">
            <div className="flex items-center justify-between border-b px-6 py-3.5">
              <h2 className="sect-label">Alert queue</h2>
              <div className="flex gap-px" role="group" aria-label="Filter alerts">
                {(["open", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={cn(
                      "font-mono cursor-pointer border px-3 py-1.5 text-[11px] tracking-wide uppercase transition-colors",
                      filter === f
                        ? "accent border-[var(--accent)]"
                        : "fg-3 border-[var(--rule)] hover:text-[var(--fg)]",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y">
              {loading && alerts.length === 0 ? (
                <p className="fg-3 p-12 text-center text-sm">Loading…</p>
              ) : shown.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-semibold">Nothing open.</p>
                  <p className="fg-3 mt-2 text-sm">
                    Quiet is the correct state. Run a simulation to prove detection
                    is working.
                  </p>
                </div>
              ) : (
                shown.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    onAcknowledge={acknowledge}
                    onQuarantine={quarantine}
                    onResolve={resolve}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="col-span-12 mt-6 space-y-6 lg:col-span-4 lg:mt-0">
          <ConnectionAdvisor defaultDomain={domain === "your domain" ? "" : domain} />

          <div className="panel">
            <div className="border-b px-5 py-3.5">
              <h2 className="sect-label">Mailbox coverage</h2>
              <p className="fg-3 mt-1 text-xs">
                Derived from what each connection can do
              </p>
            </div>
            {mailboxes.length === 0 ? (
              <p className="fg-3 p-5 text-xs leading-relaxed">
                No mailboxes connected yet. The connection advisor above reads your
                MX records and gives your IT team the exact steps.
              </p>
            ) : (
              <ul className="divide-y" role="list">
                {mailboxes.map((m) => (
                  <li key={m.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.address}</p>
                        <p className="fg-3 mono-xs mt-0.5">
                          {(m.sources[0] ?? "unconnected").toUpperCase()} ·{" "}
                          {m.mailbox_class.toUpperCase()}
                        </p>
                      </div>
                      <LevelChip level={m.protection_level} />
                    </div>
                    {m.inactive_detections.length > 0 && (
                      <p className="fg-3 mono-xs mt-2">
                        INACTIVE: {m.inactive_detections.slice(0, 6).join(" ")}
                        {m.inactive_detections.length > 6 && " …"}
                      </p>
                    )}
                    {!m.sources.some((s) => s === "graph_api" || s === "gmail_api") && (
                      <OAuthConnect address={m.address} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Simulation domain={domain === "your domain" ? "example.com" : domain} />

          <GoverningMetrics />

          {stats && (
            <div className="panel p-5">
              <h2 className="sect-label">Oversight</h2>
              <ul className="mt-4 space-y-2.5" role="list">
                {[
                  ["Acknowledged", String(stats.acknowledged)],
                  ["Unacked over 15 min", String(stats.unacknowledged_over_15m)],
                  ["Full coverage", String(stats.coverage.full ?? 0)],
                  ["Limited coverage", String(stats.coverage.limited ?? 0)],
                ].map(([label, value]) => (
                  <li
                    key={label}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="fg-2">{label}</span>
                    <span className="tnum font-mono font-semibold">{value}</span>
                  </li>
                ))}
              </ul>
              <p className="fg-3 mt-5 border-t pt-4 text-xs leading-relaxed">
                Critical unacknowledged for 15 minutes escalates to IT; 60 minutes
                to all admins, plus SMS.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export type { Tier };
