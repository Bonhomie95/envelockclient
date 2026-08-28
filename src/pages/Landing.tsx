import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  // Check, // parked: not in two-feature v1 (was only used by the pricing grid)
  Globe,
  Link2,
  Loader2,
  MessageSquareText,
  ScanEye,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { api, type ScanResult } from "../lib/api";
import { Button, SectionHead, TierChip, cn } from "../components/primitives";

/* Deliberately plain. Anything technical belongs in /docs — a landing page
   that reads like a manual convinces nobody. */

/* "registered 3 days ago" reads as urgency far better than a raw date — a
   lookalike registered this week is the one actively being weaponised. */
function registeredLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "registered";
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  if (days <= 0) return "registered today";
  if (days === 1) return "registered 1 day ago";
  if (days < 30) return `registered ${days} days ago`;
  if (days < 365) return `registered ${Math.floor(days / 30)} mo ago`;
  return `registered ${when.getFullYear()}`;
}

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
      setError("Could not complete the scan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <form onSubmit={onSubmit} className="p-6">
        <label htmlFor="scan" className="block text-base font-semibold">
          Is anyone impersonating your business?
        </label>
        <p className="fg-2 mt-2 text-sm leading-relaxed">
          Free to check. No account, no access to your email.
        </p>

        <div className="mt-5 flex flex-col gap-px sm:flex-row">
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
          <Button type="submit" variant="accent" size="lg" disabled={loading || !domain.trim()}>
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
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="rise border-t p-6">
          <p className="text-sm font-semibold">
            <span className="font-mono tnum accent text-xl">{result.hits.length}</span>{" "}
            lookalike domains found for {result.protected_domain}
          </p>
          {result.hits.length > 0 && (
            <ul className="mt-4 divide-y" role="list">
              {result.hits.slice(0, 4).map((hit) => (
                <li key={hit.candidate} className="flex items-center gap-3 py-2.5">
                  <TierChip tier={hit.tier} />
                  <code className="flex-1 truncate font-mono text-xs">{hit.candidate}</code>
                  <span className="fg-3 mono-xs shrink-0 tnum">
                    {hit.registered_at ? registeredLabel(hit.registered_at) : "unregistered"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="fg-3 mt-4 text-xs">
            Sorted newest first — a domain registered days ago is the live threat.
            We keep watching these for free, and tell you if one starts sending mail.
          </p>
        </div>
      )}
    </div>
  );
}

/* Static illustration of the two features in the product's own visual language:
   a click-time link verdict list, and a held payment. No live calls — the hero
   must never depend on an API to render. */
function ClickCheckDemo() {
  const links = [
    ["invoices.yoursupplier.com/aug", "SAFE · OPENED", "accent"],
    ["secure-payment-update.net/login", "PHISHING · BLOCKED", "text-[var(--danger)]"],
    ["docs-share.icu/Invoice_884.exe", "MALWARE · BLOCKED", "text-[var(--danger)]"],
  ] as const;
  return (
    <div className="panel">
      <div className="p-6">
        <p className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={16} className="accent" aria-hidden />
          Every link, checked when it&rsquo;s clicked
        </p>
        <p className="fg-2 mt-2 text-sm leading-relaxed">
          Links in protected mail are rewritten to pass through Envelock. Safe
          pages open instantly. Phishing and malware stop at the click — on any
          device, even ones we&rsquo;ve never seen.
        </p>
        <ul className="mt-5 divide-y" role="list">
          {links.map(([url, verdict, tone]) => (
            <li key={url} className="flex items-center gap-3 py-2.5">
              <code className="flex-1 truncate font-mono text-xs">{url}</code>
              <span className={cn("mono-xs shrink-0", tone)}>{verdict}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t p-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Banknote size={15} className="accent" aria-hidden />
          Bank details changed mid-thread
        </p>
        <p className="fg-2 mt-2 text-xs leading-relaxed">
          &ldquo;Please use our new account for this invoice.&rdquo; The account
          your supplier has always used is on file — the mail is quarantined and
          your team alerted before any money moves.
        </p>
      </div>
    </div>
  );
}

const PROBLEMS = [
  {
    icon: Banknote,
    title: "The invoice that isn't from your supplier",
    body: "Someone asks you to pay a new bank account. It arrives inside a conversation you have been having for months, so it looks completely ordinary. We hold the account details your supplier has always used, and stop the payment when they change.",
  },
  {
    icon: Link2,
    title: "The link that isn't what it says",
    body: "A convincing email, a link that looks right, and a login page built to steal a password. Every link in protected mail passes through Envelock first — checked at the moment it's clicked, on any device, and blocked if it's phishing or malware.",
  },
  {
    icon: UserCheck,
    title: "The supplier whose mailbox was hijacked",
    body: "The scariest fraud comes from a real supplier's real address — their mailbox was broken into, and the 'updated bank details' are the criminal's. Because we verify the payment details, not just the sender, the switch is caught and the mail is quarantined.",
  },
];

const AI_POINTS = [
  {
    icon: Sparkles,
    title: "Reads intent, not just red flags",
    body: "It weighs the whole message the way a wary colleague would — is this really your supplier, or someone impersonating them to reroute a payment? Business email compromise (a fake invoice, changed bank details, a 'CEO' asking for an urgent transfer) is exactly what it's built to catch.",
  },
  {
    icon: ScanEye,
    title: "Used only where judgment is needed",
    body: "The fast rules settle the clear-cut cases on their own. The AI is held back for the genuine grey area — the clever fakes that fool people — so you get a sharper verdict without a flood of false alarms, and without running your mail through AI wholesale.",
  },
  {
    icon: MessageSquareText,
    title: "Explained in plain English",
    body: "Every alert reads like an analyst told you why — “this looks like a scam: the bank details changed and the sender's domain was registered last week” — never a mysterious score. Your team can act in seconds.",
  },
];

const PLANS = [
  {
    name: "Guard",
    price: "Free",
    unit: "no card needed",
    line: "We watch for people impersonating your business.",
    features: ["Lookalike domain monitoring", "Alerts when one starts sending mail"],
    cta: "Start free",
    variant: "line" as const,
  },
  {
    name: "Essential",
    price: "$25",
    unit: "per month, 5 mailboxes",
    line: "Protects your mail from invoice fraud.",
    features: [
      "Everything in Guard",
      "Bank detail change alerts",
      "Fake supplier detection",
      "AI analyst on suspicious payment emails",
      "Dashboard for your IT team",
    ],
    cta: "Start free trial",
    variant: "accent" as const,
    featured: true,
  },
  {
    name: "Complete",
    price: "$47.50",
    unit: "per month, 5 mailboxes",
    line: "Adds protection if a mailbox is broken into.",
    features: [
      "Everything in Essential",
      "Unusual sign-in alerts",
      "Silent access detection",
      "Remove dangerous mail automatically",
    ],
    cta: "Start free trial",
    variant: "line" as const,
  },
];

export default function Landing() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b">
        <div className="shell grid12 items-center py-16 md:py-24">
          <div className="col-span-12 lg:col-span-6">
            <span className="mono-xs accent inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] px-3 py-1">
              <Sparkles size={12} aria-hidden /> NOW WITH AN AI FRAUD ANALYST
            </span>
            <h1 className="display mt-6">
              We stop your money
              <br />
              going to the
              <br />
              <span className="accent">wrong bank account.</span>
            </h1>

            <p className="lede mt-8">
              And your team can&rsquo;t click a phishing link — we check every
              link at the moment it&rsquo;s clicked, on any device. Two frauds,
              stopped where they actually happen.
            </p>

            <div className="mt-10 flex flex-col gap-px sm:flex-row">
              <Link to="/signin">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  GET STARTED FREE
                  <ArrowRight size={14} aria-hidden />
                </Button>
              </Link>
              <Link to="/docs">
                <Button variant="line" size="lg" className="w-full sm:w-auto">
                  READ THE DOCS
                </Button>
              </Link>
            </div>

            <p className="fg-3 mt-6 text-sm">
              Works with the email you already use. Nothing to install.
            </p>
          </div>

          <div className="col-span-12 mt-12 lg:col-span-5 lg:col-start-8 lg:mt-0">
            {/* parked: not in two-feature v1 (brand protection) — <Scanner /> */}
            <ClickCheckDemo />
          </div>
        </div>
      </section>

      {/* What we stop */}
      <section id="problems" className="border-b">
        <div className="shell py-16 md:py-24">
          <SectionHead
            label="What we stop"
            title="Three ways businesses lose money to email."
          />

          {/* Numbered and ruled rather than boxed. The index gives the set an
              order to read in, and the hairline under each label does the
              separating a card border would otherwise do — which keeps three
              long paragraphs from reading as three heavy blocks. */}
          <div className="mt-12 grid gap-x-8 gap-y-12 md:grid-cols-3">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              return (
                <article key={p.title}>
                  <div className="flex items-end justify-between gap-3 border-b border-[var(--rule-strong)] pb-2.5">
                    <span className="sect-label">
                      Vector {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon size={17} className="accent shrink-0" aria-hidden />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-balance">
                    {p.title}
                  </h3>
                  <p className="fg-2 mt-3 text-sm leading-relaxed">{p.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b">
        <div className="shell py-16 md:py-24">
          <SectionHead
            label="How it works"
            title="Three steps, then it runs quietly."
            lede="You keep your existing email — Outlook, Gmail, or anything else. We sit alongside it, never in the way."
          />

          <ol className="mt-12 grid gap-px bg-[var(--rule)] md:grid-cols-3" role="list">
            {[
              ["Connect your email", "One click for Microsoft and Google. One simple rule for everything else. Your IT team gets exact instructions for your provider."],
              ["We learn what normal looks like", "Who you deal with, which bank accounts they use, how they write. This takes minutes, not months."],
              ["You hear from us only when it matters", "A quiet inbox is the point. When something is wrong, you know within seconds — and so does your IT team."],
            ].map(([title, body], i) => (
              <li key={title} className="bg-[var(--bg-raised)] p-8">
                <span className="font-mono accent text-sm font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="fg-2 mt-3 text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>

          <p className="fg-2 mt-10 text-sm">
            Curious about the detail?{" "}
            <Link to="/docs" className="accent underline underline-offset-4">
              The documentation
            </Link>{" "}
            covers every detection, integration and data-handling policy.
          </p>
        </div>
      </section>

      {/* AI analyst */}
      <section className="border-b">
        <div className="shell py-16 md:py-24">
          <SectionHead
            label="AI on your side"
            title="An AI fraud analyst on the emails built to fool people."
            lede="Rules catch the obvious. For the cleverly-disguised payment scams that slip past them, Envelock brings in an AI analyst to judge intent before you're ever asked to pay."
          />

          <div className="mt-12 grid gap-px bg-[var(--rule)] md:grid-cols-3">
            {AI_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <article key={p.title} className="bg-[var(--bg-raised)] p-8">
                  <Icon size={20} className="accent" aria-hidden />
                  <h3 className="mt-6 text-base font-semibold text-balance">
                    {p.title}
                  </h3>
                  <p className="fg-2 mt-3 text-sm leading-relaxed">{p.body}</p>
                </article>
              );
            })}
          </div>

          <p className="fg-3 mt-10 text-sm leading-relaxed">
            Your mail is never used to train anyone's model — the analyst only takes
            a closer read of the few messages that warrant one, and the deterministic
            checks always run first so nothing depends on the AI being right.
          </p>
        </div>
      </section>

      {/* Pricing */}
      {/* parked: not in two-feature v1 — billing flows are unmounted server-side
      <section id="pricing" className="border-b">
        <div className="shell py-16 md:py-24">
          <SectionHead
            label="Pricing"
            title="Priced so a small business can afford it."
            lede="Five people and a thousand people should not pay the same. Bigger teams pay much less per person."
          />

          <div className="bento mt-12">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "col-span-12 flex flex-col p-8 md:col-span-6 lg:col-span-4",
                  p.featured && "ring-1 ring-[var(--accent)]",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.featured && <span className="mono-xs accent">POPULAR</span>}
                </div>
                <div className="mt-6 font-mono tnum text-4xl font-semibold tracking-tight">
                  {p.price}
                </div>
                <span className="fg-3 mt-1 text-xs">{p.unit}</span>
                <p className="fg-2 mt-4 text-sm">{p.line}</p>
                <ul className="mt-7 flex-1 space-y-3" role="list">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3 text-sm">
                      <Check size={14} className="accent mt-0.5 shrink-0" aria-hidden />
                      <span className="fg-2">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signin" className="mt-8">
                  <Button variant={p.variant} className="w-full">
                    {p.cta.toUpperCase()}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="fg-3 mt-8 text-sm">
            15 days free. Pay monthly with no penalty, or save up to 20% by paying
            yearly. Working on your own? $6 a month.
          </p>
        </div>
      </section>
      */}

      {/* Close */}
      <section>
        <div className="shell grid12 items-center py-16 md:py-24">
          <div className="col-span-12 lg:col-span-7">
            <h2 className="headline text-balance">
              Two ways to lose money by email. Close both today.
            </h2>
            <p className="lede mt-4">
              Works with the mail you already use — protection starts the day
              you connect.
            </p>
          </div>
          <div className="col-span-12 mt-8 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:justify-self-end">
            <Link to="/signin">
              <Button variant="accent" size="lg" className="w-full sm:w-auto">
                GET STARTED FREE
                <ArrowRight size={14} aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* parked: not in two-feature v1 — the lookalike Scanner and the pricing grid are
   unmounted above but kept for later; referencing them keeps noUnusedLocals quiet. */
void Scanner;
void PLANS;
