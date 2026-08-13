import { useCallback, useEffect, useState } from "react";

import { api } from "../lib/api";
import { Button } from "./primitives";

/**
 * Domain-control verification (PRD signup funnel). Shows the DNS record the
 * customer must add and a "Verify" button. Until the domain is verified, no
 * mailbox on it can be connected for live mail — this is what stops someone
 * signing up with a company address they don't control.
 */
export function DomainVerify({
  domain,
  onVerified,
}: {
  domain: string;
  onVerified?: () => void;
}) {
  const [record, setRecord] = useState<{
    txt: { host: string; type: string; value: string };
    cname: { host: string; type: string; value: string };
    verified: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"txt" | "cname">("txt");

  const load = useCallback(async () => {
    try {
      const r = await api.domainVerification(domain);
      setRecord(r);
    } catch {
      /* domain may not be bootstrapped yet */
    }
  }, [domain]);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyDomain(domain);
      if (r.verified) {
        setRecord((prev) => (prev ? { ...prev, verified: true } : prev));
        onVerified?.();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "DNS record not found yet — it can take a few minutes to propagate.",
      );
    } finally {
      setBusy(false);
    }
  }, [domain, onVerified]);

  if (!record) return null;
  if (record.verified) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
        <span className="font-semibold text-emerald-500">✓ {domain} verified</span> — you
        control this domain, so mailboxes on it can be connected.
      </div>
    );
  }

  const chosen = method === "txt" ? record.txt : record.cname;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <p className="font-semibold text-amber-600 dark:text-amber-400">
        Verify control of {domain}
      </p>
      <p className="mt-1 opacity-80">
        Add this DNS record at your registrar, then click Verify. Until you do, we
        won't connect any mailbox on this domain — this stops anyone using an address
        they don't actually own.
      </p>

      <div className="mt-3 flex gap-2 text-xs">
        <button
          type="button"
          aria-pressed={method === "txt"}
          onClick={() => setMethod("txt")}
          className={`rounded px-2 py-1 ${method === "txt" ? "bg-amber-500/20 font-semibold" : "opacity-60"}`}
        >
          TXT
        </button>
        <button
          type="button"
          aria-pressed={method === "cname"}
          onClick={() => setMethod("cname")}
          className={`rounded px-2 py-1 ${method === "cname" ? "bg-amber-500/20 font-semibold" : "opacity-60"}`}
        >
          CNAME
        </button>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
        <dt className="opacity-60">Type</dt>
        <dd>{chosen.type}</dd>
        <dt className="opacity-60">Host</dt>
        <dd className="break-all">{chosen.host}</dd>
        <dt className="opacity-60">Value</dt>
        <dd className="break-all">{chosen.value}</dd>
      </dl>

      {error && <p className="mt-2 text-red-500">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button onClick={verify} disabled={busy}>
          {busy ? "Checking DNS…" : "Verify"}
        </Button>
        <Button variant="quiet" onClick={() => void load()} disabled={busy}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
