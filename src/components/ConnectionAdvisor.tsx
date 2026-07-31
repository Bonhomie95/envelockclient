import { useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Loader2,
  Search,
  Server,
  ShieldOff,
  Users,
} from "lucide-react";
import { api, type ConnectMethod, type ConnectionPlan } from "../lib/api";
import { Button, LevelChip, cn } from "./primitives";

/* Reads the domain's MX records and hands IT the exact setup path for their
   mail server (PRD §5 — tier is determined by MX lookup, not by asking). */
function MethodBlock({
  method,
  primary,
}: {
  method: ConnectMethod;
  primary: boolean;
}) {
  return (
    <div className={cn("p-5", primary && "bg-[var(--bg-hover)]")}>
      <div className="flex flex-wrap items-center gap-2">
        {primary && <span className="mono-xs accent">RECOMMENDED</span>}
        <h4 className="text-sm font-semibold">{method.name}</h4>
        <span className="ml-auto">
          <LevelChip level={method.protection_level} />
        </span>
      </div>

      <div className="fg-3 mono-xs mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>{method.effort.toUpperCase()}</span>
        <span>· {method.who.toUpperCase()}</span>
        {method.remediation ? (
          <span className="text-[var(--ok)]">· CAN QUARANTINE</span>
        ) : (
          <span className="flex items-center gap-1">
            <ShieldOff size={10} aria-hidden /> ALERT ONLY
          </span>
        )}
      </div>

      <ol className="mt-4 space-y-2" role="list">
        {method.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="mono-xs fg-3 mt-0.5 shrink-0 tnum">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="fg-2 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <p className="fg-3 mt-4 flex items-start gap-2 text-xs leading-relaxed">
        <Users size={12} className="mt-0.5 shrink-0" aria-hidden />
        Session and silent-access monitoring on this path comes from{" "}
        {method.identity_from.toLowerCase()}.
      </p>
    </div>
  );
}

export default function ConnectionAdvisor({
  defaultDomain = "",
}: {
  defaultDomain?: string;
}) {
  const [domain, setDomain] = useState(defaultDomain);
  const [plan, setPlan] = useState<ConnectionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setShowAll(false);
    try {
      setPlan(await api.connect(domain.trim()));
    } catch {
      setError("Lookup failed. Check the domain and try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyImap() {
    if (!plan?.imap.host) return;
    void navigator.clipboard.writeText(`${plan.imap.host}:${plan.imap.port}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="panel">
      <div className="border-b px-5 py-3.5">
        <h2 className="sect-label">Connection advisor</h2>
        <p className="fg-3 mt-1 text-xs leading-relaxed">
          Reads your MX records and returns the exact setup path for your mail
          server
        </p>
      </div>

      <form onSubmit={run} className="flex flex-col gap-px border-b p-5 sm:flex-row">
        <div className="relative flex-1">
          <Server
            size={15}
            className="fg-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="advisor-domain" className="sr-only">
            Domain to look up
          </label>
          <input
            id="advisor-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourcompany.com"
            autoComplete="url"
            className="field pl-10"
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={loading || !domain.trim()}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              CHECKING
            </>
          ) : (
            <>
              <Search size={14} aria-hidden />
              CHECK
            </>
          )}
        </Button>
      </form>

      {error && (
        <p role="alert" className="p-5 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {!plan && !error && !loading && (
        <p className="fg-3 p-5 text-xs leading-relaxed">
          Works for any provider. If we recognise the mail server we prefill the
          connection details; if we do not, the universal paths still apply.
        </p>
      )}

      {plan && (
        <div className="rise">
          {/* Detected provider */}
          <div className="border-b p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="sect-label">Detected</span>
              <span className="text-base font-semibold">
                {plan.provider.name}
              </span>
              {!plan.detected && (
                <span className="mono-xs fg-3">NOT RECOGNISED</span>
              )}
            </div>

            {plan.provider.aliases.length > 0 && (
              <p className="fg-3 mt-1 text-xs">
                Also known as {plan.provider.aliases.join(", ")}
              </p>
            )}

            {plan.mx_hosts.length > 0 && (
              <div className="mt-4">
                <span className="sect-label">MX records</span>
                <ul className="mt-2 space-y-1" role="list">
                  {plan.mx_hosts.slice(0, 3).map((h) => (
                    <li key={h} className="fg-2 truncate font-mono text-xs">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.imap.host && (
              <div className="mt-4 flex items-center gap-3">
                <div className="min-w-0">
                  <span className="sect-label">IMAP</span>
                  <p className="fg-2 truncate font-mono text-xs">
                    {plan.imap.host}:{plan.imap.port}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="line"
                  onClick={copyImap}
                  className="ml-auto"
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
            )}

            {/* DNS posture — free, and worth showing whether or not they connect */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-4">
              <span className="mono-xs">
                <span className="fg-3">SPF </span>
                <span className={plan.dns.spf_present ? "text-[var(--ok)]" : "text-[var(--warn)]"}>
                  {plan.dns.spf_present ? "PRESENT" : "MISSING"}
                </span>
              </span>
              <span className="mono-xs">
                <span className="fg-3">DMARC </span>
                <span
                  className={
                    plan.dns.dmarc_policy === "reject" ||
                    plan.dns.dmarc_policy === "quarantine"
                      ? "text-[var(--ok)]"
                      : "text-[var(--warn)]"
                  }
                >
                  {plan.dns.dmarc_policy
                    ? `p=${plan.dns.dmarc_policy}`.toUpperCase()
                    : "MISSING"}
                </span>
              </span>
            </div>

            {/* Plain-English posture — "p=none" means nothing to most IT staff. */}
            {plan.dns.dmarc_policy === "reject" ||
            plan.dns.dmarc_policy === "quarantine" ? (
              <p className="fg-3 mt-2 text-xs leading-relaxed">
                DMARC is enforcing — spoofed mail claiming to be {domain.trim()} is
                rejected or quarantined by receivers. Good.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-[var(--warn,#d97706)]">
                {plan.dns.dmarc_policy === "none"
                  ? "DMARC is set to p=none — it only monitors, so anyone can still spoof this domain. Move it to p=quarantine, then p=reject."
                  : "No DMARC record — anyone can send mail as this domain. Publish a DMARC record (start at p=none to observe, then enforce)."}{" "}
                Guard's free DMARC reports show who's already spoofing you.
              </p>
            )}

            {plan.provider.notes && (
              <p className="fg-3 mt-4 text-xs leading-relaxed">
                {plan.provider.notes}
              </p>
            )}
          </div>

          <MethodBlock method={plan.recommended} primary />

          {plan.alternatives.length > 0 && (
            <div className="border-t">
              <button
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="fg-2 mono-xs w-full cursor-pointer px-5 py-3 text-left transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
              >
                {showAll ? "− " : "+ "}
                {plan.alternatives.length} OTHER WAY
                {plan.alternatives.length === 1 ? "" : "S"} TO CONNECT
              </button>
              {showAll && (
                <div className="divide-y border-t">
                  {plan.alternatives.map((m) => (
                    <MethodBlock key={m.id} method={m} primary={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
