import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button, cn } from "../components/primitives";

/* Everything technical lives here so the landing page can stay plain.
   Structure mirrors PRD.md, which remains the source of truth. */

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="fg-2 mt-4 text-[15px] leading-relaxed">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-10 text-base font-semibold">{children}</h3>;
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="sect-label pb-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={cn("py-3 pr-4 align-top", j === 0 && "font-medium")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="panel mt-5 overflow-x-auto p-4 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        <P>
          Envelock detects email fraud and mailbox takeover. It reads mail
          out-of-band — never in the delivery path — so an outage on our side
          never delays or drops a customer's mail.
        </P>
        <P>
          Coverage comes from three independent channels. Each has a fallback
          that works on every mail provider, which is why support is universal
          rather than Microsoft-only.
        </P>
        <Table
          head={["Channel", "Answers", "Sources", "Universal fallback"]}
          rows={[
            [
              "Mail",
              "What was said, by whom, with what attached",
              "Graph API, Gmail API, admin APIs, IMAP, forwarded copy",
              "Every mail system supports forwarding",
            ],
            [
              "Identity",
              "Who opened the mailbox, from where, on which device",
              "Entra sign-in logs, Google audit, client sensor, IMAP flags",
              "The sensor runs on the device, not the server",
            ],
            [
              "External",
              "The world outside the mailbox",
              "Certificate Transparency, zone files, RDAP, DMARC reports",
              "Requires no mailbox access at all",
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "connect",
    title: "Connecting a mailbox",
    body: (
      <>
        <P>
          Nobody changes their mail client. The connection method depends on the
          provider, which we detect from MX records — the connection advisor
          returns the exact steps for any domain.
        </P>
        <Table
          head={["Method", "Who sets it up", "Effort", "Can quarantine"]}
          rows={[
            ["OAuth (Microsoft 365)", "Global admin", "One click", "Yes"],
            ["OAuth (Google Workspace)", "Super admin", "One click", "Yes"],
            ["Admin API key", "Mail administrator", "Paste one key", "Yes"],
            ["Direct mailbox (IMAP)", "Mailbox owner", "One credential", "Yes"],
            ["Forwarding rule", "Mailbox owner", "One rule", "No — alert only"],
          ]}
        />
        <P>
          Forwarding receives a copy after delivery, so it can raise an alert but
          cannot pull a message back. That is the one functional difference
          between methods, and the product states it per mailbox rather than
          burying it.
        </P>
        <H3>Credential handling</H3>
        <P>
          Direct connections store a mailbox credential. It is envelope-encrypted
          under a KMS-held key, decrypted only inside the isolated connection
          service, and never written to logs or returned by the API. Use an
          app-specific password wherever the provider offers one.
        </P>
      </>
    ),
  },
  {
    id: "detections",
    title: "Detection catalogue",
    body: (
      <>
        <P>
          Detections are grouped by what they observe. Each declares the
          capabilities it needs; any it cannot get on a given mailbox is reported
          as inactive by name rather than silently skipped.
        </P>
        <H3>Group A — counterparty fraud</H3>
        <Table
          head={["ID", "Detects", "Typical severity"]}
          rows={[
            ["A1", "Payment or bank details differ from the record on file", "Critical"],
            ["A2", "Counterparty has no verified callback number", "Medium"],
            ["A3", "Cousin or typosquat domain", "High"],
            ["A4", "Homoglyph domain that renders identically", "High"],
            ["A5", "Display name claims a party the domain contradicts", "High"],
            ["A6", "Replies would be redirected elsewhere", "High"],
            ["A7", "First contact from a domain, discussing payment", "Medium"],
            ["A8", "Reply with no thread chain — conversation hijacking", "High"],
            ["A9", "Writing style diverges from the sender's baseline", "High"],
            ["A10", "Counterparty's sending infrastructure changed", "High"],
            ["A11", "Dormant thread revived with a payment request", "High"],
            ["A12", "Counterparty silent past their own reply baseline", "Medium"],
            ["A13", "Duplicate invoice number or anomalous amount", "High"],
            ["A14", "Urgency or secrecy pressure language", "Low"],
          ]}
        />
        <H3>Group B — content safety</H3>
        <Table
          head={["ID", "Detects", "Typical severity"]}
          rows={[
            ["B1", "Phishing URLs, shorteners, brand bait, bare IPs", "High"],
            ["B2", "Links rewritten for re-checking at click time", "Low"],
            ["B3", "QR codes alongside payment or sign-in language", "Medium"],
            ["B4", "Known malware, executable and script attachments", "Critical"],
            ["B5", "Password-protected or deeply nested archives", "High"],
            ["B6", "Macro documents, type mismatches, HTML smuggling", "High"],
            ["B7", "Sender domain on a threat feed", "High"],
            ["B8", "SPF, DKIM or DMARC failure", "Medium"],
            ["B9", "Sender domain registered within 30 days", "High"],
          ]}
        />
        <H3>Group C — mailbox and identity</H3>
        <Table
          head={["ID", "Detects", "Typical severity"]}
          rows={[
            ["C1", "Rule forwarding mail outside the organisation", "Critical"],
            ["C2", "Rule that hides finance-related mail", "Critical"],
            ["C3", "Delegate or permission change", "High"],
            ["C4", "Application granted mailbox access", "Critical"],
            ["C5", "Signature or reply address altered", "High"],
            ["C6", "Anomalous concurrent session", "High"],
            ["C7", "Impossible travel between sign-ins", "High"],
            ["C8", "Significant location or network change", "Medium"],
            ["C9", "VPN, proxy or hosting network", "Low"],
            ["C10", "First use of a device", "Low"],
            ["C11", "Message read with no device signed in", "Critical"],
            ["C12", "Password, MFA or recovery details changed", "Critical"],
            ["C13", "MFA missing or legacy authentication in use", "Medium"],
            ["C14", "Counterparty impossible travel", "High"],
          ]}
        />
        <H3>Group D — brand and domain</H3>
        <Table
          head={["ID", "Detects", "Typical severity"]}
          rows={[
            ["D1", "Lookalike domain registered against yours", "Medium"],
            ["D2", "Certificate issued to a lookalike", "Medium"],
            ["D3", "Newly registered domain matching your brand", "Medium"],
            ["D4", "Lookalike configured to send mail — armed", "High"],
            ["D5", "Your own SPF, DKIM or DMARC posture", "Medium"],
            ["D6", "Third parties spoofing your domain", "Medium"],
            ["D7", "Takedown evidence pack and submission", "—"],
          ]}
        />
      </>
    ),
  },
  {
    id: "alerts",
    title: "Alerts and escalation",
    body: (
      <>
        <P>
          Severity describes required action, not how alarming a finding sounds.
          A channel that fires constantly gets muted, and a muted channel
          protects nobody.
        </P>
        <Table
          head={["Level", "Meaning", "Delivery"]}
          rows={[
            ["Critical", "Money or access at risk now", "Interrupt, quarantine where possible"],
            ["High", "Probable attack — act within the hour", "Push and dashboard"],
            ["Medium", "Worth a human glance", "Dashboard and daily digest"],
            ["Low", "Logged for context", "No notification"],
          ]}
        />
        <H3>Notification order</H3>
        <P>
          Alerts never depend on the mailbox being protected. In-app and push run
          in our own systems; email goes to a separate address registered at
          onboarding.
        </P>
        <Table
          head={["When", "Channel"]}
          rows={[
            ["Immediately", "In-app, IT dashboard, browser push"],
            ["High and Critical", "Email to the registered out-of-band address"],
            ["Unacknowledged 15 min", "Escalates to IT admin"],
            ["Unacknowledged 60 min", "Escalates to all admins, plus SMS"],
          ]}
        />
        <P>
          Escalation is driven by acknowledgement, not delivery. A message
          reaching a device proves nothing about a human having seen it.
        </P>
      </>
    ),
  },
  {
    id: "api",
    title: "API",
    body: (
      <>
        <P>
          REST over HTTPS, JSON in and out. Authentication is a bearer token;
          export tokens are read-only by design.
        </P>
        <H3>Authentication</H3>
        <Code>{`POST /api/v1/auth/login
{ "email": "you@acme.com.ng", "password": "..." }

→ { "mfa_required": true, "mfa_token": "..." }

POST /api/v1/auth/mfa/verify
{ "mfa_token": "...", "code": "123456" }

→ { "access_token": "...", "refresh_token": "...", "expires_in": 900 }`}</Code>
        <P>
          Multi-factor authentication is mandatory. No path issues a session
          without it. Refresh tokens rotate on use; presenting one twice is
          treated as theft and revokes every session for that user.
        </P>
        <H3>Common endpoints</H3>
        <Table
          head={["Method", "Path", "Purpose"]}
          rows={[
            ["POST", "/api/v1/analyse", "Run the detection suite on a raw message"],
            ["POST", "/api/v1/domains/scan", "Lookalike domains for a domain"],
            ["GET", "/api/v1/domains/{d}/connect", "Setup steps for that mail provider"],
            ["GET", "/api/v1/coverage", "Protection level and inactive detections"],
            ["POST", "/api/v1/pricing/quote", "Price for a given seat mix"],
            ["GET", "/api/v1/retention/schedule", "Data retention policy"],
          ]}
        />
        <H3>Rate limits</H3>
        <Table
          head={["Endpoint group", "Limit"]}
          rows={[
            ["Login", "5 per 5 minutes"],
            ["Registration", "3 per hour"],
            ["MFA and recovery", "6 per 5 minutes"],
            ["Domain scan and analyse", "20–30 per minute"],
            ["Everything else", "120 per minute"],
          ]}
        />
        <P>
          Exceeding a limit returns <code className="font-mono">429</code> with a{" "}
          <code className="font-mono">Retry-After</code> header. Repeated failed
          sign-ins additionally lock the account with an increasing backoff.
        </P>
      </>
    ),
  },
  {
    id: "integrations",
    title: "Export and SIEM",
    body: (
      <>
        <P>
          Alerts are worth more inside the tools a security team already watches.
          Four formats are available to admins.
        </P>
        <Table
          head={["Format", "Endpoint", "Use"]}
          rows={[
            ["CSV", "/api/v1/export/alerts.csv", "Audit and review"],
            ["JSON Lines", "/api/v1/export/alerts.jsonl", "Log pipelines"],
            ["CEF", "/api/v1/export/alerts.cef", "ArcSight, Splunk, QRadar, Sentinel"],
            ["Syslog", "?syslog=true", "RFC 5424 framing"],
          ]}
        />
        <H3>Webhooks</H3>
        <P>
          Deliveries are signed with HMAC-SHA256 over the timestamp and raw body,
          so a captured payload cannot be replayed later with a fresh header.
          Verify before trusting:
        </P>
        <Code>{`signed  = f"{timestamp}.".encode() + raw_body
expected = "v1=" + hmac.new(secret, signed, sha256).hexdigest()

hmac.compare_digest(expected, received_signature)`}</Code>
        <P>
          Reject anything where the timestamp is more than 300 seconds from now.
          Failed deliveries retry on a backoff spanning roughly four hours.
        </P>
      </>
    ),
  },
  {
    id: "data",
    title: "Data handling",
    body: (
      <>
        <P>
          Retention is per data class, and deletion is demonstrable rather than
          promised.
        </P>
        <Table
          head={["Data", "Retention", "Note"]}
          rows={[
            ["Message bodies", "30 days", "Absent entirely in metadata-only mode"],
            ["Attachments", "30 days", "Deduplicated by hash"],
            ["Message metadata", "12 months", "Powers sender baselines"],
            ["Identity and audit events", "12 months", "Access history"],
            ["Alerts and findings", "24 months", "Your incident record"],
            ["Malicious file verdicts", "Indefinite", "Hash only, no customer data"],
          ]}
        />
        <P>
          On cancellation there is a 30-day grace period, then full deletion
          within 60 days. Aggregate billing counters and the domain trial ledger
          survive, as neither contains personal data.
        </P>
        <H3>Metadata-only mode</H3>
        <P>
          Message bodies and attachments are never persisted — only extracted
          features and hashes. Content-based detections continue to run at
          ingest; they simply leave nothing behind.
        </P>
      </>
    ),
  },
  {
    id: "security",
    title: "Our own security",
    body: (
      <>
        <P>
          A service holding mail access for many businesses is a supply-chain
          target. These are the controls that apply to us, not to customers.
        </P>
        <Table
          head={["Area", "Control"]}
          rows={[
            ["Passwords", "scrypt, per-user salt, parameters stored per hash"],
            ["Sessions", "15-minute access tokens, rotating refresh with reuse detection"],
            ["MFA", "Mandatory TOTP, single-use codes, single-use recovery codes"],
            ["Brute force", "Per-endpoint rate limits and account-scoped lockout"],
            ["Credentials", "Envelope encryption under a KMS key, isolated decryption"],
            ["Tenancy", "Tenant ID on every record, checked on every read"],
            ["Transport", "HSTS, strict CSP, no framing, no referrer leakage"],
            ["Exports", "Formula injection neutralised; log formats cannot be forged"],
          ]}
        />
        <P>
          Detection quality is measured against published targets: under 1% false
          positives on Critical, fewer than five Criticals per healthy tenant per
          quarter, and above 95% recall on payment-change fraud. Every Critical
          false positive gets a written post-mortem.
        </P>
      </>
    ),
  },
];

export default function Docs() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const [navOpen, setNavOpen] = useState(false);
  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return (
    <main className="shell py-10 md:py-14">
      <div className="grid12">
        {/* Contents */}
        <aside className="col-span-12 lg:col-span-3">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            className="panel fg-2 flex w-full items-center justify-between px-4 py-3 text-sm font-medium lg:hidden"
          >
            Contents
            {navOpen ? <X size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
          </button>

          <nav
            aria-label="Documentation"
            className={cn(
              "lg:sticky lg:top-24 lg:block",
              navOpen ? "block" : "hidden",
            )}
          >
            <p className="sect-label hidden lg:block">Contents</p>
            <ul className="mt-4 space-y-1" role="list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setNavOpen(false)}
                    className={cn(
                      "block border-l py-1.5 pl-3 text-sm transition-colors",
                      active === s.id
                        ? "accent border-[var(--accent)] font-medium"
                        : "fg-2 border-[var(--rule)] hover:text-[var(--fg)]",
                    )}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-8 hidden border-t pt-6 lg:block">
              <Link to="/analyse">
                <Button variant="line" size="sm" className="w-full">
                  TRY THE SANDBOX
                  <ArrowUpRight size={13} aria-hidden />
                </Button>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <div className="col-span-12 mt-8 lg:col-span-8 lg:col-start-5 lg:mt-0">
          <header>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
              <span className="sect-label">Documentation</span>
            </div>
            <h1 className="headline mt-4">How Envelock works</h1>
            <p className="lede mt-4">
              Reference for administrators and developers: what we detect, how
              mail is connected, how alerts reach people, and how data is
              handled.
            </p>
          </header>

          <div className="mt-14 space-y-16">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="border-b pb-3 text-xl font-bold">{s.title}</h2>
                {s.body}
              </section>
            ))}
          </div>

          <footer className="mt-16 border-t pt-8">
            <p className="fg-3 text-sm">
              Something unclear or missing? The full specification lives in{" "}
              <code className="font-mono">PRD.md</code> in the repository.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
