import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Fingerprint,
  Forward,
  Globe,
  Inbox,
  KeyRound,
  Link2,
  Loader2,
  PhoneCall,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ApiError,
  api,
  auth,
  type AlertRecord,
  type ConnectionPlan,
  type MailboxRecord,
  type Oversight,
  type QualityMetric,
  type SimulationResult,
  type TenantInfo,
  type Tier,
} from "../lib/api";

// Sources that mean a mailbox's MAIL is actually being ingested (vs identity-only
// signals like the sensor). Used to tell "connected" from "unconnected".
const MAIL_SOURCES = new Set([
  "graph_api",
  "gmail_api",
  "admin_api",
  "imap_idle",
  "imap_poll",
  "forward_ingest",
  "journal",
]);
import { Button, LevelChip, TierChip, cn } from "../components/primitives";
import ConnectionAdvisor from "../components/ConnectionAdvisor";
import MfaEnroll from "../components/MfaEnroll";
import { PLAN_RANK, PLAN_TIERS } from "../lib/plans";

interface Me {
  email: string;
  mfa_enabled: boolean;
}

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
  // Lowercase + createElement: the icon is a *value* looked up from a stable
  // module-level map, not a component defined during render.
  const icon = iconFor(alert);
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
        {createElement(icon, {
          size: 17,
          className: "fg-3 mt-0.5 shrink-0",
          "aria-hidden": true,
        })}
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
            <span
              className={result.passed === result.total ? "accent" : "fg-2"}
            >
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
                  {r.detected.length} finding
                  {r.detected.length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* Where each provider issues the app-specific password an IMAP login needs when
   the account has 2FA on (it usually does). Keyed by the advisor's provider id,
   with an IMAP-host fallback so an unrecognised-but-known host still helps. This
   is the single biggest IMAP-setup snag — "it rejected my normal password" — so
   we answer it inline instead of leaving the user to search. */
interface ImapHelp {
  label: string;
  url: string;
  note: string;
}
const IMAP_HELP: Record<string, ImapHelp> = {
  google: {
    label: "Google app password",
    url: "https://myaccount.google.com/apppasswords",
    note: "Google rejects your normal password over IMAP — create a 16-character app password.",
  },
  microsoft365: {
    label: "Microsoft app password",
    url: "https://account.microsoft.com/security",
    note: "With security defaults on, create an app password; your admin may need to enable IMAP first.",
  },
  icloud: {
    label: "Apple app-specific password",
    url: "https://appleid.apple.com/account/manage",
    note: "iCloud Mail requires an app-specific password for IMAP.",
  },
  fastmail: {
    label: "Fastmail app password",
    url: "https://app.fastmail.com/settings/security/apppassword",
    note: "Create an app password scoped to IMAP.",
  },
  zoho: {
    label: "Zoho app password",
    url: "https://accounts.zoho.com/home#security/app_password",
    note: "Generate an application-specific password for mail access.",
  },
};
const IMAP_HELP_BY_HOST: Record<string, string> = {
  "imap.gmail.com": "google",
  "outlook.office365.com": "microsoft365",
  "imap.mail.me.com": "icloud",
  "imap.fastmail.com": "fastmail",
  "imap.zoho.com": "zoho",
};

function imapHelpFor(plan: ConnectionPlan | null): ImapHelp | null {
  if (!plan) return null;
  const byId = IMAP_HELP[plan.provider.id];
  if (byId) return byId;
  const host = plan.imap.host ?? "";
  const mapped = IMAP_HELP_BY_HOST[host];
  return mapped ? IMAP_HELP[mapped] : null;
}

/* Connect a mailbox using the RIGHT method for its actual mail provider — detected
   from the domain's MX records, not from whichever OAuth apps this deployment
   happens to have configured. A Google/Microsoft domain gets one-click OAuth; any
   other provider (ISP, custom domain) connects over IMAP with an app password, or
   by forwarding a copy. This is the fix for "Connect Google" showing on a domain
   that isn't on Google. */
function MailboxConnect({
  mailbox,
  onConnected,
}: {
  mailbox: MailboxRecord;
  onConnected: () => Promise<void>;
}) {
  const address = mailbox.address;
  const emailDomain = address.split("@")[1] ?? "";
  const [plan, setPlan] = useState<ConnectionPlan | null>(null);
  const [configured, setConfigured] = useState<string[]>([]);
  const [mode, setMode] = useState<"imap" | "forward" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // IMAP form
  const [host, setHost] = useState("");
  const [port, setPort] = useState(993);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ingest, setIngest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .connect(emailDomain)
      .then((p) => {
        if (!live) return;
        setPlan(p);
        if (p.imap.host) setHost(p.imap.host);
        setPort(p.imap.port || 993);
      })
      .catch(() => {});
    api
      .oauthProviders()
      .then((r) => live && setConfigured(r.configured))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [emailDomain]);

  async function oauth(provider: string) {
    setBusy(provider);
    try {
      const { authorize_url } = await api.oauthAuthorize(provider, address);
      window.location.assign(authorize_url);
    } catch (e) {
      setBusy(null);
      setNote(
        e instanceof ApiError ? e.message : "Could not start connection.",
      );
    }
  }

  async function submitImap() {
    if (!host || !password) {
      setNote("Enter the IMAP host and the mailbox password.");
      return;
    }
    setBusy("imap");
    setNote(null);
    try {
      await api.connectImap(mailbox.id, {
        imap_host: host,
        imap_port: port,
        password,
      });
      setPassword("");
      setMode(null);
      await onConnected();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Could not connect.");
    } finally {
      setBusy(null);
    }
  }

  async function openForward() {
    setMode("forward");
    if (ingest === null) {
      try {
        setIngest((await api.ingestAddress()).ingest_address);
      } catch {
        setIngest("");
      }
    }
  }

  function copyIngest() {
    if (!ingest) return;
    void navigator.clipboard.writeText(ingest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // The user confirms they've set the forwarding rule — record it so the mailbox
  // reads as covered (alert-only) instead of leaving the address sitting there.
  async function markForwarding() {
    setBusy("forward");
    setNote(null);
    try {
      await api.connectForward(mailbox.id);
      setMode(null);
      await onConnected();
    } catch (e) {
      setNote(
        e instanceof ApiError ? e.message : "Could not confirm forwarding.",
      );
    } finally {
      setBusy(null);
    }
  }

  const rec = plan?.recommended.id ?? "";
  const providerName = plan?.provider.name ?? null;
  const isMs = rec === "oauth_microsoft" && configured.includes("microsoft");
  const isGoogle = rec === "oauth_google" && configured.includes("google");
  const imapHelp = imapHelpFor(plan);

  return (
    <div className="mt-2.5">
      {providerName && plan?.detected && (
        <p className="fg-3 mono-xs mb-2">DETECTED: {providerName}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {/* One-click OAuth only when the domain really is on that provider. */}
        {isMs && (
          <Button
            size="sm"
            variant="line"
            disabled={busy !== null}
            onClick={() => oauth("microsoft")}
          >
            <Link2 size={12} aria-hidden /> Connect Microsoft&nbsp;365
          </Button>
        )}
        {isGoogle && (
          <Button
            size="sm"
            variant="line"
            disabled={busy !== null}
            onClick={() => oauth("google")}
          >
            <Link2 size={12} aria-hidden /> Connect Google
          </Button>
        )}
        {/* IMAP works on any provider — the universal path for ISP / custom mail. */}
        <Button
          size="sm"
          variant={isMs || isGoogle ? "quiet" : "line"}
          disabled={busy !== null}
          onClick={() => setMode(mode === "imap" ? null : "imap")}
        >
          <KeyRound size={12} aria-hidden /> Connect via IMAP
        </Button>
        <Button
          size="sm"
          variant="line"
          disabled={busy !== null}
          aria-pressed={mode === "forward"}
          onClick={() =>
            mode === "forward" ? setMode(null) : void openForward()
          }
        >
          <Forward size={12} aria-hidden /> Forwarding
        </Button>
      </div>

      {mode === "imap" && (
        <div className="mt-3 space-y-3 border-l-2 border-[var(--accent)] pl-3">
          {/* Step 1 — get the right credential. This is where IMAP setups fail:
              providers with 2FA reject the normal password over IMAP. */}
          <div>
            <p className="fg-2 text-xs leading-relaxed">
              <span className="accent font-semibold">1.</span> Sign in as{" "}
              <code className="font-mono">{address}</code> and create an{" "}
              <span className="font-semibold">app-specific password</span> — most
              providers reject your normal password over IMAP once two-factor is on.
            </p>
            {imapHelp && (
              <a
                href={imapHelp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="accent mono-xs mt-1.5 inline-flex items-center gap-1.5 hover:underline"
              >
                <KeyRound size={11} aria-hidden /> {imapHelp.label} →
              </a>
            )}
            {imapHelp && (
              <p className="fg-3 mt-1 text-[11px] leading-relaxed">{imapHelp.note}</p>
            )}
          </div>

          {/* Step 2 — server + credential. Host/port are prefilled from the
              detected provider; the user usually only pastes the password. */}
          <div className="space-y-2">
            <p className="fg-2 text-xs">
              <span className="accent font-semibold">2.</span> Paste it below. The
              server details are prefilled{plan?.detected ? " from your provider" : ""}.
            </p>
            <label className="fg-3 mono-xs block">IMAP SERVER</label>
            <div className="flex gap-2">
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="imap.yourprovider.com"
                className="field flex-1 text-sm"
                autoComplete="off"
                aria-label="IMAP host"
              />
              <input
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 993)}
                inputMode="numeric"
                className="field w-20 text-sm"
                aria-label="IMAP port"
              />
            </div>
            <label className="fg-3 mono-xs block">APP PASSWORD</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="paste the app password"
                className="field w-full pr-16 text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="fg-3 mono-xs absolute inset-y-0 right-2 my-auto h-5 cursor-pointer hover:text-[var(--fg)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <Button
            size="sm"
            variant="accent"
            disabled={busy !== null}
            onClick={submitImap}
          >
            {busy === "imap" ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : null}{" "}
            CONNECT MAILBOX
          </Button>
          <p className="fg-3 text-[11px] leading-relaxed">
            Stored encrypted with a key we can't read in bulk, decrypted only inside
            the connection service. We never display it again. Connecting enables
            full content + fraud detection and lets us quarantine dangerous mail.
          </p>
        </div>
      )}

      {mode === "forward" && (
        <div className="mt-3 space-y-2.5 border-l-2 border-[var(--accent)] pl-3">
          <p className="fg-3 text-xs leading-relaxed">
            In your mail provider, forward a copy of inbound mail to this
            address. Works on every provider — alert-only, no quarantine.
          </p>
          <div className="flex items-center gap-2">
            <code className="font-mono flex-1 text-xs break-all">
              {ingest || "…"}
            </code>
            <Button
              size="sm"
              variant="line"
              onClick={copyIngest}
              disabled={!ingest}
            >
              {copied ? (
                <>
                  <Check size={12} aria-hidden /> COPIED
                </>
              ) : (
                <>
                  <Copy size={12} aria-hidden /> COPY
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              size="sm"
              variant="accent"
              disabled={busy !== null || !ingest}
              onClick={markForwarding}
            >
              {busy === "forward" ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Check size={12} aria-hidden />
              )}
              I'VE SET UP FORWARDING
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setMode(null)}
              disabled={busy !== null}
            >
              CANCEL
            </Button>
          </div>
          <p className="fg-3 text-[11px] leading-relaxed">
            Marking this done sets the mailbox to{" "}
            <span className="font-semibold">Limited</span> (alert-only) coverage
            — forwarding arrives after delivery, so it can warn but not
            quarantine. Connect via IMAP or OAuth for full protection.
          </p>
        </div>
      )}

      {note && <p className="mt-2 text-xs text-red-600">{note}</p>}
    </div>
  );
}

/* Plan / trial state at a glance. Guard is free forever (no countdown); a paid
   trial shows days remaining and turns amber, then red, as it runs out. */
function PlanBadge({ tenant }: { tenant: TenantInfo }) {
  const { plan, trial } = tenant;
  let text: string;
  let tone = "border-[var(--rule)] fg-2";

  let title: string | undefined;

  if (trial.active && trial.days_left !== null) {
    text = `TRIAL · ${trial.days_left} DAY${trial.days_left === 1 ? "" : "S"} LEFT`;
    tone =
      trial.days_left <= 3
        ? "border-[var(--danger)] text-[var(--danger)]"
        : "border-[var(--warn,#d97706)] text-[var(--warn,#d97706)]";
    const top = (tenant.subscribed_plan ?? "complete").toUpperCase();
    title = `${top} plan free until ${new Date(trial.ends_at!).toLocaleDateString()}. Add billing to keep it.`;
  } else if (tenant.trial_ended) {
    text = "TRIAL ENDED · ON GUARD";
    tone = "border-[var(--warn,#d97706)] text-[var(--warn,#d97706)]";
    title =
      "Your trial ended — now on Guard (free). Add billing to restore full protection.";
  } else if (plan === "guard") {
    text = "GUARD · FREE";
    tone = "border-[var(--accent)] accent";
    title = "Guard is free forever — Channel-3 domain & brand monitoring.";
  } else {
    text = `${plan.toUpperCase()}${trial.payment_method_ok ? "" : " · SET UP BILLING"}`;
  }

  return (
    <span
      className={cn(
        "font-mono rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        tone,
      )}
      title={title}
    >
      {text}
    </span>
  );
}

/* Split a pasted blob of addresses on commas, spaces or new lines — however IT
   copied them out of a spreadsheet or admin console. */
function parseAddresses(blob: string): string[] {
  return Array.from(
    new Set(
      blob
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function ClassPicker({
  klass,
  onChange,
}: {
  klass: "protected" | "monitored";
  onChange: (c: "protected" | "monitored") => void;
}) {
  return (
    <>
      <div className="flex gap-px" role="group" aria-label="Mailbox class">
        {(["protected", "monitored"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={klass === c}
            className={cn(
              "font-mono flex-1 cursor-pointer border px-2 py-1.5 text-[11px] tracking-wide uppercase transition-colors",
              klass === c
                ? "accent border-[var(--accent)]"
                : "fg-3 border-[var(--rule)] hover:text-[var(--fg)]",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="fg-3 mt-1.5 text-xs">
        {klass === "protected"
          ? "Full content + fraud detection — finance, execs, anyone who touches money."
          : "Account-takeover detection only — cheaper, for everyone else."}
      </p>
    </>
  );
}

/* Add mailboxes to the tenant — how IT brings whole departments under protection.
   A 50-seat domain is not added one box at a time, so this defaults to a bulk
   paste; a single-address mode stays for the one-off. */
function AddMailbox({
  onAdded,
  mailboxes,
}: {
  onAdded: () => Promise<void>;
  mailboxes?: TenantInfo["mailboxes"];
}) {
  const full = mailboxes ? !mailboxes.can_add : false;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"many" | "one">("many");
  const [address, setAddress] = useState("");
  const [blob, setBlob] = useState("");
  const [klass, setKlass] = useState<"protected" | "monitored">("protected");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
  } | null>(null);

  const parsed = mode === "many" ? parseAddresses(blob) : [];

  async function submitOne() {
    if (!address.includes("@")) {
      setNote("Enter a full email address.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api.addMailbox({
        address: address.trim(),
        mailbox_class: klass,
        sources: [],
      });
      setAddress("");
      setOpen(false);
      await onAdded();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Could not add mailbox.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMany() {
    if (parsed.length === 0) {
      setNote("Paste one or more email addresses.");
      return;
    }
    setBusy(true);
    setNote(null);
    setResult(null);
    try {
      const r = await api.addMailboxesBulk({
        addresses: parsed,
        mailbox_class: klass,
      });
      setResult({ added: r.created_count, skipped: r.skipped_count });
      setBlob("");
      await onAdded();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Could not add mailboxes.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t p-4">
        {mailboxes && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="fg-3 mono-xs tnum">
              {mailboxes.used} / {mailboxes.capacity} SEATS USED
            </span>
            {mailboxes.extra_seats > 0 && (
              <span className="fg-3 mono-xs">+{mailboxes.extra_seats} bought</span>
            )}
          </div>
        )}
        {full ? (
          <div className="callout p-3">
            <p className="text-xs font-semibold">
              {mailboxes && mailboxes.capacity === 0
                ? "Your plan can't protect mailboxes"
                : `All ${mailboxes?.capacity ?? ""} mailbox seats are in use`}
            </p>
            <p className="fg-2 mt-1 text-[11px] leading-relaxed">
              {mailboxes && mailboxes.capacity === 0
                ? "Upgrade to Essential or Complete to protect mailboxes."
                : "Buy more seats (or upgrade your plan) to add another mailbox."}
            </p>
            <Link to="/billing" className="mt-2 inline-block">
              <Button size="sm" variant="accent">
                <CreditCard size={12} aria-hidden />
                {mailboxes && mailboxes.capacity === 0 ? "UPGRADE" : "BUY SEATS"}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="line"
              className="w-full"
              onClick={() => setOpen(true)}
            >
              <Plus size={13} aria-hidden /> ADD MAILBOXES
            </Button>
            <p className="fg-3 mt-2 text-xs leading-relaxed">
              Paste your whole finance team or the full domain at once.
              Microsoft&nbsp;365 and Google can import the entire organisation with
              one admin consent; other providers connect per mailbox after adding.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border-t p-4">
      <div className="mb-3 flex gap-px" role="group" aria-label="Add mode">
        {(["many", "one"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setNote(null);
              setResult(null);
            }}
            aria-pressed={mode === m}
            className={cn(
              "font-mono flex-1 cursor-pointer border px-2 py-1.5 text-[11px] tracking-wide uppercase transition-colors",
              mode === m
                ? "accent border-[var(--accent)]"
                : "fg-3 border-[var(--rule)] hover:text-[var(--fg)]",
            )}
          >
            {m === "many" ? "Paste many" : "One address"}
          </button>
        ))}
      </div>

      {mode === "many" ? (
        <>
          <label
            className="block text-xs font-semibold"
            htmlFor="bulk-mailboxes"
          >
            Email addresses
          </label>
          <textarea
            id="bulk-mailboxes"
            value={blob}
            onChange={(e) => setBlob(e.target.value)}
            rows={5}
            placeholder={
              "finance@yourcompany.com\nexecs@yourcompany.com\naccounts@yourcompany.com"
            }
            spellCheck={false}
            className="field mt-1.5 h-auto resize-y py-2 text-sm leading-relaxed"
          />
          <p className="fg-3 mt-1 text-xs">
            {parsed.length > 0
              ? `${parsed.length} address${parsed.length === 1 ? "" : "es"} — separated by commas, spaces or new lines.`
              : "Paste from a spreadsheet — commas, spaces or new lines all work."}
          </p>
        </>
      ) : (
        <>
          <label className="block text-xs font-semibold" htmlFor="new-mailbox">
            Mailbox address
          </label>
          <input
            id="new-mailbox"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="accounts@yourcompany.com"
            autoComplete="off"
            className="field mt-1.5 text-sm"
          />
        </>
      )}

      <div className="mt-3">
        <ClassPicker klass={klass} onChange={setKlass} />
      </div>

      {result && (
        <p className="accent mt-2 text-xs font-semibold">
          Added {result.added}
          {result.skipped > 0 && (
            <span className="fg-3 font-normal">
              {" "}
              · skipped {result.skipped} (already added or invalid)
            </span>
          )}
        </p>
      )}
      {note && <p className="mt-2 text-xs text-red-600">{note}</p>}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="accent"
          onClick={mode === "many" ? submitMany : submitOne}
          disabled={busy || (mode === "many" && parsed.length === 0)}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : null}
          {mode === "many" ? `ADD ${parsed.length || ""}`.trim() : "ADD"}
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          {result ? "DONE" : "CANCEL"}
        </Button>
      </div>
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
                {/* `meets` is null when there's no sample to judge against yet —
                    that's "no data", not a failure. Keying the label off
                    `observed` alone printed "off target" for a healthy 0. */}
                {m.meets === null
                  ? "no data"
                  : m.meets
                    ? "on target"
                    : "off target"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Friendly labels for the audit actions that show up on a mailbox. */
const ACTION_LABEL: Record<string, string> = {
  "mailbox.connected": "Connection updated",
  "mailbox.removed": "Removed",
  "message.quarantined": "Message quarantined",
  "alert.raised": "Alert raised",
  "alert.acknowledged": "Alert acknowledged",
  "alert.resolved": "Alert resolved",
};

/* What has actually happened on this mailbox — so IT can see it is protected,
   not only when an alert fires. Fetched lazily when expanded. */
function MailboxActivity({ mailboxId }: { mailboxId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.mailboxActivity>
  > | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      try {
        setData(await api.mailboxActivity(mailboxId));
      } catch {
        /* surfaced by the queue banner on next load */
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-2.5">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="fg-3 mono-xs flex cursor-pointer items-center gap-1.5 transition-colors hover:text-[var(--fg)]"
      >
        <Activity size={11} aria-hidden />
        {open ? "HIDE ACTIVITY" : "ACTIVITY"}
      </button>

      {open && (
        <div className="rise mt-2 border-l border-[var(--rule)] pl-3">
          {loading || !data ? (
            <p className="fg-3 text-xs">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="mono-xs">
                  <span className="fg-3">SCANNED </span>
                  <span className="tnum">{data.messages_scanned}</span>
                </span>
                <span className="mono-xs">
                  <span className="fg-3">ALERTS </span>
                  <span className="tnum">{data.alerts_raised}</span>
                </span>
                {data.last_sync_at && (
                  <span className="mono-xs">
                    <span className="fg-3">LAST SYNC </span>
                    {timeOf(data.last_sync_at)}
                  </span>
                )}
              </div>
              <ul className="mt-2 space-y-1.5" role="list">
                {data.events.length === 0 ? (
                  <li className="fg-3 text-xs">
                    Connected and monitoring. Nothing to report — quiet is the
                    correct state.
                  </li>
                ) : (
                  data.events.map((e, i) => (
                    <li
                      key={`${e.at}-${i}`}
                      className="flex items-baseline gap-2 text-xs"
                    >
                      <span className="fg-2">
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                      <span className="fg-3 mono-xs ml-auto shrink-0">
                        {timeOf(e.at)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Getting-started checklist — the first thing a new owner needs, driven entirely
   by real tenant state. It disappears once every step is done, so it never nags a
   set-up account. Each open step carries the one action that completes it. */
function OnboardingChecklist({
  mailboxes,
  connectedCount,
  mfaEnabled,
  paymentOk,
  onSetupMfa,
}: {
  mailboxes: number;
  connectedCount: number;
  mfaEnabled: boolean;
  paymentOk: boolean;
  onSetupMfa: () => void;
}) {
  const steps = [
    {
      key: "add",
      done: mailboxes > 0,
      label: "Add the mailboxes that touch money",
      hint: "Finance, executives, accounts payable — the ones fraud targets.",
      action: (
        <a href="#coverage" className="accent mono-xs hover:underline">
          ADD MAILBOXES →
        </a>
      ),
    },
    {
      key: "connect",
      done: connectedCount > 0,
      label: "Connect a mailbox for full protection",
      hint: "One click on Microsoft/Google, or IMAP / forwarding for anything else.",
      action: (
        <a href="#coverage" className="accent mono-xs hover:underline">
          CONNECT →
        </a>
      ),
    },
    {
      key: "mfa",
      done: mfaEnabled,
      label: "Turn on two-factor authentication",
      hint: "Stops a stolen password from becoming a stolen account.",
      action: (
        <button
          onClick={onSetupMfa}
          className="accent mono-xs cursor-pointer hover:underline"
        >
          SET UP →
        </button>
      ),
    },
    {
      key: "billing",
      done: paymentOk,
      label: "Add billing to keep full protection",
      hint: "Your trial drops to Guard (free) if no card is on file when it ends.",
      action: (
        <Link to="/billing" className="accent mono-xs hover:underline">
          SET UP BILLING →
        </Link>
      ),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully set up — get out of the way

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="sect-label">Getting started</h2>
        <span className="fg-3 mono-xs tnum">
          {doneCount} / {steps.length} done
        </span>
      </div>
      <ul className="mt-4 space-y-3" role="list">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                s.done
                  ? "border-[var(--accent)] bg-[var(--accent)]"
                  : "border-[var(--rule)]",
              )}
              aria-hidden
            >
              {s.done && <Check size={11} className="text-[var(--accent-ink)]" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "text-sm font-medium",
                    s.done && "fg-3 line-through",
                  )}
                >
                  {s.label}
                </span>
                {!s.done && s.action}
              </div>
              {!s.done && (
                <p className="fg-3 mt-0.5 text-xs leading-relaxed">{s.hint}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Upgrade CTA — shown to anyone on Guard (free) or Essential (middle). During an
   active trial the tenant is already on Complete, so this stays hidden; once the
   trial lapses to Guard, or for a genuine free/Essential tenant, the higher
   plan(s) appear with a one-click upgrade. */
function UpgradePlans({
  tenant,
  onChanged,
}: {
  tenant: TenantInfo;
  onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const currentRank = PLAN_RANK[tenant.plan] ?? 0;
  const upgrades = PLAN_TIERS.filter((p) => (PLAN_RANK[p.id] ?? 0) > currentRank);
  const planName =
    (tenant.subscribed_plan ?? tenant.plan).charAt(0).toUpperCase() +
    (tenant.subscribed_plan ?? tenant.plan).slice(1);

  async function upgrade(planId: string) {
    setBusy(planId);
    setNote(null);
    try {
      // During the trial this switches the plan instantly (no card needed). Once
      // the trial has lapsed the server returns 402 — send them to checkout to
      // add a payment method, which then activates the plan.
      await api.changePlan(planId);
      await onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        navigate(`/billing?plan=${planId}`);
        return;
      }
      setNote(
        e instanceof ApiError
          ? e.message
          : "Could not change plan. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="sect-label">Your plan</h2>
        <Link to="/billing" className="accent mono-xs hover:underline">
          MANAGE BILLING →
        </Link>
      </div>
      <p className="fg-2 mt-2 text-sm">
        <span className="font-semibold">{planName}</span>
        {tenant.trial.active && (
          <span className="fg-3">
            {" "}
            · trial{tenant.trial.days_left !== null ? `, ${tenant.trial.days_left}d left` : ""}
          </span>
        )}
      </p>

      {upgrades.length === 0 ? (
        <p className="fg-3 mt-2 text-xs leading-relaxed">
          You're on Complete — the top plan, with full account-takeover protection.
          Change plan, update your card, or buy more mailbox seats from billing.
        </p>
      ) : (
        <>
          <p className="fg-3 mt-2 text-xs leading-relaxed">
            {tenant.plan === "guard"
              ? "You're on Guard (free) — domain & brand monitoring only. Add mailbox protection:"
              : "Move up to full account-takeover protection:"}
          </p>
          <div className="mt-4 space-y-3">
            {upgrades.map((p) => (
          <div key={p.id} className="rounded border border-[var(--rule)] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="tnum">
                <span className="font-mono text-base font-semibold">{p.price}</span>
                <span className="fg-3 text-[11px]">{p.per}</span>
              </span>
            </div>
            <p className="fg-3 mt-1 text-xs">{p.blurb}</p>
            <ul className="fg-2 mt-2.5 space-y-1" role="list">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs">
                  <Check size={12} className="accent mt-0.5 shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="accent"
              className="mt-3 w-full"
              disabled={busy !== null}
              onClick={() => upgrade(p.id)}
            >
              {busy === p.id ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : null}
              UPGRADE TO {p.name.toUpperCase()}
            </Button>
          </div>
        ))}
          </div>
          <p className="fg-3 mt-3 text-[11px] leading-relaxed">
            15 days free on signup. Pay monthly with no penalty, or save up to 20%
            yearly. Bigger teams pay much less per seat.
          </p>
        </>
      )}
      {note && (
        <p className="mt-3 text-xs text-[var(--warn,#d97706)]" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRecord[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [stats, setStats] = useState<Oversight | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mailboxQuery, setMailboxQuery] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m, t, who] = await Promise.all([
        api.alerts(),
        api.mailboxes(),
        api.tenant(),
        api.me(),
      ]);
      setAlerts(a.alerts);
      setMailboxes(m.mailboxes);
      setTenant(t);
      setMe(who);
      try {
        setStats(await api.oversight());
      } catch {
        setStats(null); // member role: no admin oversight
      }
    } catch (e) {
      // 401 = no/invalid session → sign in. 403 = a valid session that isn't
      // allowed to see tenant data yet — a colleague still awaiting admin
      // approval. These are different screens: telling an approved-pending user
      // to "sign in" is a dead end, because they already are.
      if (e instanceof ApiError && e.status === 403)
        setError("pending-approval");
      else if (e instanceof ApiError && e.unauthorized) setError("signed-out");
      else setError("Could not reach the API. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: load() flips a loading flag before its first await. That's
    // the intended pattern here, not the cascading-render case the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      filter === "open" ? alerts.filter((a) => a.state === "open") : alerts,
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

  async function removeMailbox(id: string) {
    if (!window.confirm("Remove this mailbox and its stored credential?"))
      return;
    try {
      await api.removeMailbox(id);
      await load();
    } catch {
      /* surfaced by the queue error banner on next load */
    }
  }

  if (error === "signed-out" || !auth.signedIn) {
    return (
      <main className="shell py-24">
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <h1 className="headline">Sign in to see your alerts</h1>
          <p className="lede mx-auto mt-4 text-base">
            The dashboard reads live data from your tenant, so it needs a
            session.
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

  // Signed in, but this account is a colleague who joined an existing tenant and
  // is still waiting for an admin to approve them (server returns 403 until then).
  // Show that plainly — not the "sign in" screen, which they'd read as a bug.
  if (error === "pending-approval") {
    return (
      <main className="shell py-24">
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <ShieldAlert size={28} className="fg-3 mx-auto" aria-hidden />
          <h1 className="headline mt-5">Waiting for approval</h1>
          <p className="lede mx-auto mt-4 text-base">
            You're signed in, but a workspace admin at your company still needs
            to approve your access. You'll see the alert queue and mailbox
            coverage as soon as they do — no need to sign up again.
          </p>
          <p className="fg-3 mt-6 text-sm">
            Already expecting access? Ask your Envelock admin to approve you
            from their Team page.
          </p>
          <Button
            variant="line"
            size="sm"
            className="mt-8"
            onClick={() => void load()}
          >
            <RefreshCw size={13} aria-hidden /> CHECK AGAIN
          </Button>
        </div>
      </main>
    );
  }

  // The tenant's own registered domain — falls back to a connected mailbox's
  // domain only if the tenant record somehow has none.
  const resolvedDomain =
    tenant?.primary_domain ?? mailboxes[0]?.address.split("@")[1] ?? null;
  const hasDomain = resolvedDomain !== null;
  const domain = resolvedDomain ?? "no domain yet";
  const domainCount = tenant?.domains.length ?? stats?.domains ?? 0;

  return (
    <main>
      <div className="border-b">
        <div className="shell flex flex-wrap items-center gap-x-8 gap-y-4 py-5">
          <div>
            <span className="sect-label">
              {tenant?.name && tenant.name !== domain ? tenant.name : "Tenant"}
            </span>
            <div className="mt-1 flex items-center gap-2.5">
              <p className="text-sm font-semibold">{domain}</p>
              {tenant && <PlanBadge tenant={tenant} />}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-8">
            {[
              ["OPEN", String(open.length), critical > 0],
              ["CRITICAL", String(critical), critical > 0],
              ["MAILBOXES", String(mailboxes.length), false],
              ["DOMAINS", String(domainCount), false],
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
              <RefreshCw
                size={15}
                className={cn(loading && "animate-spin")}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>

      {me && !me.mfa_enabled && (
        <div className="border-b border-[var(--warn)]/30">
          <div className="shell py-4">
            <div className="callout flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <ShieldAlert size={18} className="shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Two-factor authentication is off
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  A stolen password is enough to take this account. Turn on your
                  authenticator app — it takes about a minute.
                </p>
              </div>
              <Button
                size="sm"
                variant={mfaOpen ? "quiet" : "accent"}
                className="shrink-0"
                onClick={() => setMfaOpen((o) => !o)}
                aria-expanded={mfaOpen}
              >
                {mfaOpen ? (
                  <>
                    <X size={13} aria-hidden /> CLOSE
                  </>
                ) : (
                  <>
                    <ShieldAlert size={13} aria-hidden /> SET UP TWO-FACTOR
                  </>
                )}
              </Button>
            </div>

            {mfaOpen && (
              <div className="panel rise mt-3 p-5">
                <MfaEnroll
                  onDone={async () => {
                    setMfaOpen(false);
                    await load();
                  }}
                  onCancel={() => setMfaOpen(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {error && error !== "signed-out" && (
        <div className="shell py-4">
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        </div>
      )}

      {/* Trial countdown — shown while the trial runs and no card is on file, so
          the days remaining are always in view with a one-click path to keep it. */}
      {tenant?.trial.active &&
        tenant.trial.days_left !== null &&
        !tenant.trial.payment_method_ok && (
          <div className="shell pt-4">
            <div
              className={cn(
                "callout flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                tenant.trial.days_left <= 3 && "border-[var(--danger)]",
              )}
            >
              <Banknote size={18} className="shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {tenant.trial.days_left} day
                  {tenant.trial.days_left === 1 ? "" : "s"} left in your{" "}
                  {(tenant.subscribed_plan ?? "complete").toString().replace(/^\w/, (c) => c.toUpperCase())}{" "}
                  trial
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  Add a payment method to keep full protection when it ends —
                  otherwise you drop to Guard (free), never locked out.
                </p>
              </div>
              <Link to="/billing" className="shrink-0">
                <Button size="sm" variant="accent">
                  <CreditCard size={13} aria-hidden /> SET UP BILLING
                </Button>
              </Link>
            </div>
          </div>
        )}

      <div className="shell grid12 py-8">
        <section className="col-span-12 lg:col-span-8">
          <div className="panel">
            <div className="flex items-center justify-between border-b px-6 py-3.5">
              <h2 className="sect-label">Alert queue</h2>
              <div
                className="flex gap-px"
                role="group"
                aria-label="Filter alerts"
              >
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
                  <p className="text-sm font-semibold">
                    {filter === "all" ? "No alerts yet." : "Nothing open."}
                  </p>
                  <p className="fg-3 mx-auto mt-2 max-w-md text-sm leading-relaxed">
                    This is your alert queue. When Envelock spots invoice fraud,
                    a lookalike domain, or an account takeover in a connected
                    mailbox, it appears here with the action to take — verify,
                    quarantine or dismiss. An empty queue means nothing needs
                    you right now; quiet is the correct state. Run a simulation
                    below to see detection working end to end.
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
          {tenant && me && (
            <OnboardingChecklist
              mailboxes={mailboxes.length}
              connectedCount={
                mailboxes.filter((m) => m.sources.some((s) => MAIL_SOURCES.has(s)))
                  .length
              }
              mfaEnabled={me.mfa_enabled}
              paymentOk={tenant.trial.payment_method_ok}
              onSetupMfa={() => {
                setMfaOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {tenant && <UpgradePlans tenant={tenant} onChanged={load} />}

          <ConnectionAdvisor defaultDomain={hasDomain ? domain : ""} />

          <div className="panel" id="coverage">
            <div className="border-b px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="sect-label">Mailbox coverage</h2>
                {mailboxes.length > 0 && (
                  <span className="mono-xs fg-3 tnum">
                    {
                      mailboxes.filter((m) =>
                        m.sources.some((s) => MAIL_SOURCES.has(s)),
                      ).length
                    }
                    /{mailboxes.length} connected
                  </span>
                )}
              </div>
              <p className="fg-3 mt-1 text-xs">
                Derived from what each connection can do
              </p>
              {mailboxes.length > 6 && (
                <input
                  value={mailboxQuery}
                  onChange={(e) => setMailboxQuery(e.target.value)}
                  placeholder="Filter mailboxes…"
                  aria-label="Filter mailboxes"
                  className="field mt-3 h-9 text-sm"
                />
              )}
            </div>
            {mailboxes.length === 0 ? (
              <p className="fg-3 px-5 pt-5 text-xs leading-relaxed">
                No mailboxes connected yet. Add the ones that touch money first
                — finance, executives, accounts payable — then connect them
                below.
              </p>
            ) : (
              <ul
                className={cn(
                  "divide-y",
                  mailboxes.length > 8 && "max-h-[32rem] overflow-y-auto",
                )}
                role="list"
              >
                {mailboxes
                  .filter((m) =>
                    mailboxQuery
                      ? m.address
                          .toLowerCase()
                          .includes(mailboxQuery.toLowerCase())
                      : true,
                  )
                  .map((m) => {
                    const connected = m.sources.some((s) =>
                      MAIL_SOURCES.has(s),
                    );
                    return (
                      <li key={m.id} className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {m.address}
                            </p>
                            <p className="fg-3 mono-xs mt-0.5">
                              {connected
                                ? m.sources
                                    .filter((s) => MAIL_SOURCES.has(s))[0]
                                    .toUpperCase()
                                : "UNCONNECTED"}{" "}
                              · {m.mailbox_class.toUpperCase()}
                            </p>
                          </div>
                          <LevelChip level={m.protection_level} />
                          <button
                            onClick={() => void removeMailbox(m.id)}
                            aria-label={`Remove ${m.address}`}
                            title="Remove mailbox"
                            className="fg-3 cursor-pointer p-1 transition-colors hover:text-[var(--danger)]"
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                        {m.inactive_detections.length > 0 && (
                          <p className="fg-3 mono-xs mt-2">
                            INACTIVE:{" "}
                            {m.inactive_detections.slice(0, 6).join(" ")}
                            {m.inactive_detections.length > 6 && " …"}
                          </p>
                        )}
                        {!connected && (
                          <MailboxConnect mailbox={m} onConnected={load} />
                        )}
                        {connected && <MailboxActivity mailboxId={m.id} />}
                      </li>
                    );
                  })}
              </ul>
            )}
            <AddMailbox onAdded={load} mailboxes={tenant?.mailboxes} />
          </div>

          <Simulation domain={hasDomain ? domain : "example.com"} />

          <GoverningMetrics />

          {stats && (
            <div className="panel p-5">
              <h2 className="sect-label">Oversight</h2>
              <ul className="mt-4 space-y-2.5" role="list">
                {[
                  ["Acknowledged", String(stats.acknowledged)],
                  [
                    "Unacked over 15 min",
                    String(stats.unacknowledged_over_15m),
                  ],
                  ["Full coverage", String(stats.coverage.full ?? 0)],
                  ["Limited coverage", String(stats.coverage.limited ?? 0)],
                ].map(([label, value]) => (
                  <li
                    key={label}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="fg-2">{label}</span>
                    <span className="tnum font-mono font-semibold">
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="fg-3 mt-5 border-t pt-4 text-xs leading-relaxed">
                Critical unacknowledged for 15 minutes escalates to IT; 60
                minutes to all admins, plus SMS.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export type { Tier };
