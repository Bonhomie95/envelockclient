import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Check,
  Globe,
  Loader2,
  Search,
  UserCheck,
} from "lucide-react";
import { api, type ScanResult } from "../lib/api";
import { Button, SectionHead, TierChip, cn } from "../components/primitives";

/* Deliberately plain. Anything technical belongs in /docs — a landing page
   that reads like a manual convinces nobody. */

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
                </li>
              ))}
            </ul>
          )}
          <p className="fg-3 mt-4 text-xs">
            We keep watching these for free, and tell you if one starts sending mail.
          </p>
        </div>
      )}
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
    icon: Globe,
    title: "The domain that isn't quite yours",
    body: "One character different from your company's, or a letter swapped for one that looks identical on screen. We find these the moment they are registered and warn you before anyone is fooled.",
  },
  {
    icon: UserCheck,
    title: "The login that isn't you",
    body: "Someone else reading your mail, quietly, for weeks before they act. We notice a mailbox being opened when none of your devices are, and tell you the same day.",
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
            <h1 className="display">
              Your money should
              <br />
              not go to the
              <br />
              <span className="accent">wrong account.</span>
            </h1>

            <p className="lede mt-8">
              Businesses lose money every day to emails that look exactly like the
              real thing. Envelock spots them before anyone pays.
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
            <Scanner />
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

          <div className="mt-12 grid gap-px bg-[var(--rule)] md:grid-cols-3">
            {PROBLEMS.map((p) => {
              const Icon = p.icon;
              return (
                <article key={p.title} className="bg-[var(--bg-raised)] p-8">
                  <Icon size={20} className="accent" aria-hidden />
                  <h3 className="mt-6 text-base font-semibold text-balance">{p.title}</h3>
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

      {/* Pricing */}
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

      {/* Close */}
      <section>
        <div className="shell grid12 items-center py-16 md:py-24">
          <div className="col-span-12 lg:col-span-7">
            <h2 className="headline text-balance">
              Find out who is already impersonating you.
            </h2>
            <p className="lede mt-4">
              Free, permanent, and it only needs your domain name.
            </p>
          </div>
          <div className="col-span-12 mt-8 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:justify-self-end">
            <a href="#top">
              <Button variant="accent" size="lg" className="w-full sm:w-auto">
                CHECK MY DOMAIN
                <ArrowRight size={14} aria-hidden />
              </Button>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
