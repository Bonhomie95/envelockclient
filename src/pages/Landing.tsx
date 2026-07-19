import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  Compass,
  Eye,
  Fingerprint,
  Globe,
  Link2,
  Loader2,
  Radar,
  Search,
  Target,
  Users,
} from "lucide-react";
import { api, type ScanResult } from "../lib/api";
import {
  Button,
  Cell,
  FeatureCell,
  SectionHead,
  TierChip,
  cn,
} from "../components/primitives";

/* ── 01 · Live scanner ──────────────────────────────────────────────────────
   Runs the real Channel 3 engine. Needs no mailbox access at all, which is
   exactly why it works as the pre-sales demo (PRD S12).                     */
function Scanner() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.scanDomain(domain.trim()));
    } catch {
      setError("Scanner unreachable. Is the API running on :8010?");
    } finally {
      setLoading(false);
    }
  }

  const armed = result?.hits.filter((h) => h.armed).length ?? 0;

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="mono-xs fg-3">LIVE&nbsp;/&nbsp;DOMAIN&nbsp;SCAN</span>
        <span className="mono-xs flex items-center gap-1.5 fg-3">
          <span
            className="size-1.5 rounded-full bg-[var(--ok)] blink"
            aria-hidden
          />
          NO&nbsp;SIGNUP
        </span>
      </div>

      <form onSubmit={onSubmit} className="border-b p-5">
        <label htmlFor="scan" className="block text-sm font-semibold">
          Who is already impersonating you?
        </label>
        <p className="fg-3 mt-1.5 text-xs leading-relaxed">
          We read Certificate Transparency logs and registry zone files. Nothing
          installed, no mailbox access.
        </p>
        <div className="mt-4 flex flex-col gap-px sm:flex-row">
          <div className="relative flex-1">
            <Globe
              size={15}
              className="fg-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="scan"
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
                SCANNING
              </>
            ) : (
              <>
                <Search size={14} aria-hidden />
                SCAN
              </>
            )}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-[var(--danger)]">
            {error}
          </p>
        )}
      </form>

      <div className={cn("flex-1 p-5", loading && "scan")}>
        {!result && !loading && (
          <div className="flex h-full min-h-40 flex-col justify-center">
            <div className="hatch h-px w-full" aria-hidden />
            <p className="fg-3 py-6 text-xs leading-relaxed">
              Typosquats, homoglyphs, cousin domains and TLD swaps — ranked by
              whether they are configured to send mail.
            </p>
            <div className="hatch h-px w-full" aria-hidden />
          </div>
        )}

        {loading && (
          <p className="fg-3 mono-xs py-10 text-center" aria-live="polite">
            COMPARING AGAINST KNOWN IMPERSONATION TECHNIQUES…
          </p>
        )}

        {result && (
          <div className="rise">
            <div className="flex items-baseline gap-3 border-b pb-3">
              <span className="font-mono tnum accent text-2xl font-semibold">
                {result.hits.length}
              </span>
              <span className="text-xs font-semibold">
                patterns matching {result.protected_domain}
              </span>
              {armed > 0 && (
                <span className="mono-xs ml-auto text-[var(--danger)]">
                  {armed} ARMED
                </span>
              )}
            </div>

            {result.hits.length === 0 ? (
              <p className="fg-2 py-6 text-sm">
                Nothing matched. That is good news.
              </p>
            ) : (
              <ul className="divide-y" role="list">
                {result.hits.slice(0, 5).map((hit) => (
                  <li
                    key={hit.candidate}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <TierChip tier={hit.tier} />
                    <code className="flex-1 truncate font-mono text-xs">
                      {hit.candidate}
                    </code>
                    <span className="mono-xs fg-3 hidden sm:inline">
                      {hit.technique.replace("_", " ").toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="fg-3 mono-xs mt-4 border-t pt-3">
              GUARD TIER — FREE FOREVER, NO CARD
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const THREATS = [
  {
    icon: Banknote,
    code: "A1",
    title: "Payment detail changes",
    body: "We hold the known-good bank record for every vendor. When an invoice arrives with different details we stop it and hand you the number to call — the one on file with us, never the one in the email.",
    span: 6 as const,
  },
  {
    icon: Globe,
    code: "A3 / A4",
    title: "Lookalike and homoglyph domains",
    body: "gemini.org against gemini.com. A Cyrillic і that renders identically. rn where you read m. We compare rendered glyphs, not spelling.",
    span: 6 as const,
  },
  {
    icon: Users,
    code: "A8 / A9",
    title: "Hijacked conversations",
    body: "A reply quoting your history but breaking the thread chain. A supplier whose writing style shifts mid-negotiation.",
    span: 4 as const,
  },
  {
    icon: Link2,
    code: "C1 / C4",
    title: "Mailbox takeover",
    body: "Forwarding rules to outside addresses, rules that hide invoices, and app permissions granted to attackers — which survive password resets and MFA.",
    span: 4 as const,
  },
  {
    icon: Fingerprint,
    code: "C11",
    title: "Silent access",
    body: "A message marked read while none of your devices are signed in means someone else is in the mailbox. You know in minutes.",
    span: 4 as const,
  },
];

const CHANNELS = [
  {
    n: "CH1",
    name: "Mail",
    what: "What was said, by whom, with what attached",
    how: "Graph and Gmail APIs, admin APIs, direct IMAP, or a forwarded copy.",
    fallback: "Every mail system ever built supports forwarding.",
  },
  {
    n: "CH2",
    name: "Identity",
    what: "Who opened the mailbox, from where, on which device",
    how: "Provider sign-in logs, or our client sensor running in the browser or mail client.",
    fallback: "The sensor lives on the device, so it works on any provider.",
  },
  {
    n: "CH3",
    name: "External",
    what: "The world outside the mailbox",
    how: "Certificate Transparency, registry zone files, RDAP, DMARC reports.",
    fallback:
      "Needs no mailbox access at all — this one runs before you sign up.",
  },
];

const PROVIDERS = [
  "Microsoft 365",
  "Google Workspace",
  "HiNet hiBox",
  "263 Enterprise",
  "SingNet",
  "Tencent Exmail",
  "NetEase 163/126",
  "Alibaba Mail",
  "Zoho Mail",
  "Zimbra",
  "Fastmail",
  "Rackspace",
  "Titan Mail",
  "Yandex 360",
  "IONOS",
  "OVHcloud",
  "GoDaddy",
  "Namecheap",
  "Hostinger",
  "cPanel / Dovecot",
  "Proton Mail",
  "Exchange on-prem",
  "Rediffmail Pro",
  "Mail.ru Business",
  "Naver Works",
];

const PLANS = [
  {
    name: "Guard",
    price: "Free",
    unit: "forever · no card",
    line: "Domain and brand monitoring.",
    features: [
      "Lookalike domain monitoring",
      "Certificate Transparency alerts",
      "DMARC posture and spoof reports",
      "No mailbox access required",
    ],
    cta: "Start free",
    variant: "line" as const,
  },
  {
    name: "Essential",
    price: "$25",
    unit: "/mo · 5 mailboxes",
    line: "Payment fraud and impersonation.",
    features: [
      "Everything in Guard",
      "Bank-detail change detection",
      "Lookalike and display-name spoofing",
      "Mailbox rule tampering",
      "Admin dashboard and audit trail",
    ],
    cta: "Start 15-day trial",
    variant: "accent" as const,
    featured: true,
  },
  {
    name: "Complete",
    price: "$47.50",
    unit: "/mo · 5 mailboxes",
    line: "Adds account-takeover protection.",
    features: [
      "Everything in Essential",
      "Session and impossible-travel alerts",
      "Silent-access detection",
      "Writing-style analysis",
      "Quarantine and claw-back",
    ],
    cta: "Start 15-day trial",
    variant: "line" as const,
  },
];

export default function Landing() {
  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="shell grid12 items-end py-16 md:py-24">
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
              <span className="sect-label">Business email compromise</span>
            </div>

            <h1 className="display mt-8">
              Your money should
              <br />
              not go to the
              <br />
              <span className="accent">wrong account.</span>
            </h1>

            <p className="lede mt-8">
              Envelock watches for the invoice that isn't from your supplier,
              the domain that isn't quite yours, and the login that isn't you.
              You keep the mailbox you already have.
            </p>

            <div className="mt-10 flex flex-col gap-px sm:flex-row">
              <Link to="/signin">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  START FREE
                  <ArrowRight size={14} aria-hidden />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="line" size="lg" className="w-full sm:w-auto">
                  SEE IT WORKING
                </Button>
              </Link>
            </div>
          </div>

          <div className="col-span-12 mt-12 lg:col-span-5 lg:mt-0">
            <Scanner />
          </div>
        </div>

        {/* Metrics strip */}
        <div className="border-t">
          <div className="shell grid grid-cols-2 divide-x lg:grid-cols-4">
            {[
              ["$3.05bn", "Lost to BEC in 2025", "FBI IC3, 24,768 incidents"],
              [
                "$123k",
                "Average loss per incident",
                "One invoice is all it takes",
              ],
              ["0", "Mail apps to change", "Outlook, Gmail, hiBox, anything"],
              ["1", "Click to connect", "Or one forwarding rule"],
            ].map(([v, l, n], i) => (
              <div key={l} className={cn("py-8 pr-6", i > 0 && "pl-6")}>
                <div className="font-mono tnum text-2xl font-semibold tracking-tight sm:text-3xl">
                  {v}
                </div>
                <div className="mt-2 text-xs font-semibold">{l}</div>
                <div className="fg-3 mt-1 text-xs">{n}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · About ───────────────────────────────────────────────────── */}
      <section id="about" className="border-b">
        <div className="shell grid12 py-20 md:py-28">
          <div className="col-span-12 lg:col-span-5">
            <SectionHead
              label="About"
              title="Fraud that looks like business as usual."
            />
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <div className="space-y-5 text-base leading-relaxed">
              <p>
                Most money lost to email fraud carries no virus and no malicious
                link. It is a well-written message about an invoice, sent from a
                domain one character off, or from a supplier's real account
                after someone else took it over.
              </p>
              <p className="fg-2">
                Traditional filters look for malware. That is the wrong problem.
                The expensive attack is a plain-text email asking a finance team
                to update a bank account — and it works because it arrives
                inside a conversation that has been running for months.
              </p>
              <p className="fg-2">
                Envelock is built for that attack specifically: it learns who
                your counterparties are, what account details they use, how they
                write, and what infrastructure they send from. When any of it
                changes, you hear about it before the payment leaves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · Mission & Vision ────────────────────────────────────────── */}
      <section className="border-b">
        <div className="shell py-20 md:py-28">
          <SectionHead
            label="Why we exist"
            title="Security that small businesses can actually buy."
          />

          <div className="bento mt-12">
            <Cell span={6} className="p-8 md:p-10">
              <div className="flex items-center gap-3">
                <Target size={18} className="accent" aria-hidden />
                <span className="sect-label">Mission</span>
              </div>
              <p className="mt-6 text-xl leading-snug font-semibold text-balance md:text-2xl">
                Make sure our users are never hacked and never lose money to
                fraud — without asking them to change how they work.
              </p>
              <p className="fg-2 mt-5 text-sm leading-relaxed">
                No migration, no new mail client, no handing over the keys to
                the company. Protection has to fit around an existing business,
                or the businesses that need it most will never adopt it.
              </p>
            </Cell>

            <Cell span={6} className="p-8 md:p-10">
              <div className="flex items-center gap-3">
                <Compass size={18} className="accent" aria-hidden />
                <span className="sect-label">Vision</span>
              </div>
              <p className="mt-6 text-xl leading-snug font-semibold text-balance md:text-2xl">
                Every business — on any mail provider, in any market — defended
                as well as a company with its own security team.
              </p>
              <p className="fg-2 mt-5 text-sm leading-relaxed">
                The freight forwarder in Lagos and the manufacturer in Taipei
                lose the most to this fraud and are served the least. Enterprise
                tools only speak Microsoft and Google. We speak to everyone.
              </p>
            </Cell>

            <Cell
              span={12}
              className="grid gap-px bg-[var(--rule)] md:grid-cols-3"
            >
              {[
                [
                  "Say what is not covered",
                  "Every mailbox shows its exact protection level and names any detection that is inactive. Believing you are covered when you are not is worse than knowing you are not.",
                ],
                [
                  "Silence on a clean message",
                  "An alert that fires constantly gets muted, and a muted channel protects nobody. If Critical fires more than a handful of times a quarter, we got it wrong.",
                ],
                [
                  "Never in the delivery path",
                  "We sit beside your mail, not in front of it. If we go down, your business keeps running.",
                ],
              ].map(([h, b]) => (
                <div key={h} className="bg-[var(--bg-raised)] p-8">
                  <h3 className="text-sm font-semibold">{h}</h3>
                  <p className="fg-2 mt-3 text-sm leading-relaxed">{b}</p>
                </div>
              ))}
            </Cell>
          </div>
        </div>
      </section>

      {/* ── 04 · Coverage ────────────────────────────────────────────────── */}
      <section id="product" className="border-b">
        <div className="shell py-20 md:py-28">
          <SectionHead
            label="Coverage"
            title="What actually takes the money."
            lede="Fifty-seven detections ship in version one. These are the ones that stop the wire transfer."
          />
          <div className="bento mt-12">
            {THREATS.map((t) => (
              <FeatureCell key={t.code} {...t} />
            ))}
            <Cell
              span={12}
              className="flex flex-wrap items-center gap-x-8 gap-y-3 p-7"
            >
              <span className="sect-label">Also in v1</span>
              {[
                "Phishing URLs",
                "QR-code phishing",
                "Attachment sandboxing",
                "Reply-To mismatch",
                "First contact",
                "Urgency scoring",
                "Impossible travel",
                "OAuth consent grants",
                "MFA posture",
                "DMARC reports",
                "Takedown workflow",
              ].map((s) => (
                <span key={s} className="fg-2 text-xs">
                  {s}
                </span>
              ))}
            </Cell>
          </div>
        </div>
      </section>

      {/* ── 05 · How it works ────────────────────────────────────────────── */}
      <section id="how" className="border-b">
        <div className="shell py-20 md:py-28">
          <SectionHead
            label="How it works"
            title="Three channels. Each one has a fallback that works everywhere."
            lede="That is what makes coverage universal instead of Microsoft-only — and why fidelity is disclosed per mailbox rather than promised in general."
          />

          <div className="mt-12 divide-y border">
            {CHANNELS.map((c) => (
              <div key={c.n} className="grid12 items-start p-7 md:p-8">
                <div className="col-span-12 flex items-center gap-4 md:col-span-3">
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                </div>
                <p className="col-span-12 mt-3 text-sm font-medium md:col-span-3 md:mt-0">
                  {c.what}
                </p>
                <p className="fg-2 col-span-12 mt-2 text-sm leading-relaxed md:col-span-3 md:mt-0">
                  {c.how}
                </p>
                <p className="fg-3 col-span-12 mt-2 text-xs leading-relaxed md:col-span-3 md:mt-0">
                  {c.fallback}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <div className="grid12">
              <div className="col-span-12 lg:col-span-5">
                <h3 className="text-lg font-semibold">
                  Nobody changes their mail app
                </h3>
                <p className="fg-2 mt-3 text-sm leading-relaxed">
                  We support every mail provider. Microsoft 365 and Google
                  connect with one admin click; everything else connects
                  directly or with a single forwarding rule. You keep your
                  address, your password, your folders and your habits.
                </p>
                <p className="fg-2 mt-4 text-sm leading-relaxed">
                  These are the providers we recognise automatically and
                  pre-configure for you — the list is what we can set up without
                  you looking anything up, not the limit of what we cover.
                </p>
              </div>

              <div className="col-span-12 mt-8 lg:col-span-7 lg:mt-0">
                <ul
                  className="grid grid-cols-2 gap-px bg-[var(--rule)] sm:grid-cols-3"
                  role="list"
                >
                  {PROVIDERS.map((name) => (
                    <li
                      key={name}
                      className="bg-[var(--bg-raised)] px-4 py-3.5 text-sm font-medium"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
                <p className="fg-3 mt-4 text-xs leading-relaxed">
                  Running something else, including on-premises Exchange or your
                  own mail server? That works too — the connection advisor reads
                  your MX records and gives your IT team the exact steps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 06 · Alerts ──────────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="shell grid12 py-20 md:py-28">
          <div className="col-span-12 lg:col-span-5">
            <SectionHead
              label="Alerts"
              title="Four levels, defined by what you must do."
              lede="Not by how alarming they sound. Every alert reaches your IT team too, with a record of who read it and who acted."
            />
          </div>

          <div className="col-span-12 mt-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <ul className="divide-y border-y" role="list">
              {(
                [
                  [
                    "critical",
                    "Money or access at risk now. We interrupt you, and quarantine the message where we can.",
                  ],
                  ["high", "Probable attack. Act within the hour."],
                  [
                    "medium",
                    "Worth a human glance. Dashboard and daily digest.",
                  ],
                  ["low", "Logged for context. No notification."],
                ] as const
              ).map(([tier, text]) => (
                <li key={tier} className="flex items-start gap-4 py-4">
                  <span className="w-24 shrink-0">
                    <TierChip tier={tier} />
                  </span>
                  <span className="fg-2 text-sm leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <span className="sect-label">Escalation path</span>
              <ul className="mt-4 space-y-2.5" role="list">
                {[
                  ["IMMEDIATE", "In-app, dashboard and browser push"],
                  [
                    "HIGH / CRITICAL",
                    "Email to a separate address — not the mailbox under attack",
                  ],
                  ["15 MIN UNACKED", "Escalates to your IT admin"],
                  ["60 MIN UNACKED", "Escalates to all admins, plus SMS"],
                ].map(([when, what]) => (
                  <li key={when} className="flex items-baseline gap-4 text-sm">
                    <span className="mono-xs fg-3 w-36 shrink-0">{when}</span>
                    <span className="fg-2">{what}</span>
                  </li>
                ))}
              </ul>
              <p className="fg-3 mt-6 border-t pt-4 text-xs leading-relaxed">
                We never rely on the mailbox we are protecting to warn you about
                itself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 07 · Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="border-b">
        <div className="shell py-20 md:py-28">
          <SectionHead
            label="Pricing"
            title="Priced so a five-person company can buy it."
            lede="A platform fee per domain plus a per-mailbox rate that falls sharply with volume. Five people and a thousand people should not pay the same."
          />

          <div className="bento mt-12">
            {PLANS.map((p) => (
              <Cell
                key={p.name}
                span={4}
                className={cn(
                  "flex flex-col p-8",
                  p.featured && "ring-1 ring-[var(--accent)]",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.featured && (
                    <span className="mono-xs accent">POPULAR</span>
                  )}
                </div>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-mono tnum text-4xl font-semibold tracking-tight">
                    {p.price}
                  </span>
                </div>
                <span className="fg-3 mono-xs mt-1">{p.unit}</span>
                <p className="fg-2 mt-4 text-sm">{p.line}</p>
                <ul className="mt-7 flex-1 space-y-3" role="list">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3 text-sm">
                      <Check
                        size={14}
                        className="accent mt-0.5 shrink-0"
                        aria-hidden
                      />
                      <span className="fg-2">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signin" className="mt-8">
                  <Button variant={p.variant} className="w-full">
                    {p.cta.toUpperCase()}
                  </Button>
                </Link>
              </Cell>
            ))}

            <Cell
              span={12}
              className="grid gap-px bg-[var(--rule)] md:grid-cols-4"
            >
              {[
                [
                  "Every mailbox covered",
                  "Staff who never touch invoices are monitored for takeover at a fraction of the price — so an attacker cannot slip in through an unprotected account.",
                ],
                [
                  "Extra domains",
                  "Half price. Domains you registered defensively are monitored free, with no limit.",
                ],
                [
                  "Working alone?",
                  "$6 per mailbox per month. No domain needed, no platform fee.",
                ],
                [
                  "Billing",
                  "15 days free. Quarterly, half-yearly and annual save 5%, 10% and 20% — monthly is never penalised.",
                ],
              ].map(([h, b]) => (
                <div key={h} className="bg-[var(--bg-raised)] p-7">
                  <h4 className="text-sm font-semibold">{h}</h4>
                  <p className="fg-2 mt-2 text-xs leading-relaxed">{b}</p>
                </div>
              ))}
            </Cell>
          </div>
        </div>
      </section>

      {/* ── 08 · CTA ─────────────────────────────────────────────────────── */}
      <section>
        <div className="shell grid12 items-center py-20 md:py-28">
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
              <span className="sect-label">Get started</span>
            </div>
            <h2 className="headline mt-5 text-balance">
              Find out who is already impersonating you.
            </h2>
            <p className="lede mt-5">
              The scan is free and permanent. It needs your domain name and
              nothing else.
            </p>
          </div>
          <div className="col-span-12 mt-8 flex flex-col gap-px sm:flex-row lg:col-span-4 lg:col-start-9 lg:mt-0 lg:justify-end">
            <a href="#top">
              <Button variant="accent" size="lg" className="w-full sm:w-auto">
                SCAN MY DOMAIN
                <ArrowUpRight size={14} aria-hidden />
              </Button>
            </a>
            <Link to="/analyse">
              <Button variant="line" size="lg" className="w-full sm:w-auto">
                <Eye size={14} aria-hidden />
                TEST AN EMAIL
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export { Radar };
