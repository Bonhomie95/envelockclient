import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { ApiError, api, auth } from "../lib/api";
import { Button, cn } from "../components/primitives";

type Step = "credentials" | "mfa-setup" | "mfa-verify" | "recovery";

export default function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<Step>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [code, setCode] = useState("");

  const [mfaToken, setMfaToken] = useState("");
  const [secret, setSecret] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(e: unknown) {
    setError(
      e instanceof ApiError
        ? e.message
        : "Could not reach the API. Is the server running?",
    );
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await api.register({ email, password, tenant_name: domain || email });
      }
      const login = await api.login({ email, password });
      setMfaToken(login.mfa_token);

      if (login.mfa_setup_required) {
        const setup = await api.mfaSetup(login.mfa_token);
        setSecret(setup.secret);
        setStep("mfa-setup");
      } else {
        setStep("mfa-verify");
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.mfaVerify({ mfa_token: mfaToken, code });
      auth.set(result.access_token);

      if (mode === "signup" && domain) {
        try {
          await api.bootstrap({ name: domain, domain });
        } catch {
          /* tenant may already exist */
        }
      }

      if (result.recovery_codes?.length) {
        setRecovery(result.recovery_codes);
        setStep("recovery");
      } else {
        navigate("/dashboard");
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function copySecret() {
    void navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="grid12 shell min-h-[calc(100dvh-4rem)] items-center py-16">
      <div className="col-span-12 lg:col-span-5">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
          <span className="sect-label">
            {step === "credentials"
              ? mode === "signin"
                ? "Sign in"
                : "Create account"
              : step === "recovery"
                ? "Recovery codes"
                : "Two-factor"}
          </span>
        </div>

        {/* ── Credentials ────────────────────────────────────────────────── */}
        {step === "credentials" && (
          <>
            <h1 className="headline mt-5 text-balance">
              {mode === "signin" ? "Welcome back." : "Start with the free scan."}
            </h1>
            <p className="lede mt-4 text-base">
              {mode === "signin"
                ? "Your alert queue, mailbox coverage and audit trail."
                : "Guard is free forever and needs no card."}
            </p>

            <form onSubmit={submitCredentials} className="mt-10 space-y-5">
              {mode === "signup" && (
                <div>
                  <label htmlFor="domain" className="block text-sm font-semibold">
                    Company domain
                  </label>
                  <input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourcompany.com"
                    autoComplete="url"
                    className="field mt-2"
                  />
                  <p className="fg-3 mt-2 text-xs">
                    We verify ownership with a DNS record. That same step turns on
                    your spoof reports.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  required
                  className="field mt-2"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold">
                  {mode === "signup" ? "Passphrase" : "Password"}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  minLength={12}
                  required
                  className="field mt-2"
                />
                {mode === "signup" && (
                  <p className="fg-3 mt-2 text-xs">
                    Use a passphrase — several unrelated words, 16+ characters. We
                    reject common passwords, and MFA is mandatory on every account.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    WORKING
                  </>
                ) : (
                  <>
                    {mode === "signin" ? "CONTINUE" : "CREATE ACCOUNT"}
                    <ArrowRight size={14} aria-hidden />
                  </>
                )}
              </Button>
            </form>

            <p className="fg-2 mt-8 text-sm">
              {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
                className="accent cursor-pointer font-semibold underline underline-offset-4"
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
          </>
        )}

        {/* ── MFA enrolment ──────────────────────────────────────────────── */}
        {step === "mfa-setup" && (
          <>
            <h1 className="headline mt-5 text-balance">Set up two-factor.</h1>
            <p className="lede mt-4 text-base">
              Mandatory, not optional. A security product whose own accounts rely
              on a password alone is indefensible.
            </p>

            <div className="panel mt-8 p-5">
              <span className="sect-label">Secret key</span>
              <div className="mt-3 flex items-center gap-3">
                <code className="font-mono flex-1 text-sm break-all">{secret}</code>
                <Button size="sm" variant="line" onClick={copySecret}>
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
              <p className="fg-3 mt-3 text-xs leading-relaxed">
                Add it to your authenticator app, then enter the 6-digit code it
                shows.
              </p>
            </div>

            <form onSubmit={submitCode} className="mt-6 space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-semibold">
                  Authentication code
                </label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  required
                  className="field font-mono mt-2 tracking-[0.4em]"
                />
              </div>
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={busy || code.length !== 6}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <KeyRound size={14} aria-hidden />
                )}
                ACTIVATE
              </Button>
            </form>
          </>
        )}

        {step === "mfa-verify" && (
          <>
            <h1 className="headline mt-5 text-balance">Enter your code.</h1>
            <p className="lede mt-4 text-base">
              The 6-digit code from your authenticator app.
            </p>
            <form onSubmit={submitCode} className="mt-8 space-y-4">
              <label htmlFor="code2" className="block text-sm font-semibold">
                Authentication code
              </label>
              <input
                id="code2"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                required
                autoFocus
                className="field font-mono tracking-[0.4em]"
              />
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={busy || code.length !== 6}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : null}
                SIGN IN
              </Button>
            </form>
          </>
        )}

        {/* ── Recovery codes ─────────────────────────────────────────────── */}
        {step === "recovery" && (
          <>
            <h1 className="headline mt-5 text-balance">Save these codes.</h1>
            <p className="lede mt-4 text-base">
              Shown once. Each works a single time if you lose your authenticator.
            </p>
            <div className="panel mt-8 grid grid-cols-2 gap-2 p-5">
              {recovery.map((c) => (
                <code key={c} className="font-mono text-sm">
                  {c}
                </code>
              ))}
            </div>
            <Button
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              onClick={() => navigate("/dashboard")}
            >
              I HAVE SAVED THEM
              <ArrowRight size={14} aria-hidden />
            </Button>
          </>
        )}

        {error && (
          <p role="alert" className="callout mt-6 px-4 py-3 text-xs leading-relaxed">
            {error}
          </p>
        )}

        <p className="fg-3 mt-6 flex items-start gap-2 text-xs leading-relaxed">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
          We never ask for your mailbox password here. Mail connections are made
          separately, through your provider or an app-specific credential.
        </p>
      </div>

      <aside className="col-span-12 mt-12 lg:col-span-6 lg:col-start-7 lg:mt-0">
        <div className="panel p-8 md:p-10">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="accent" aria-hidden />
            <span className="sect-label">What happens next</span>
          </div>

          <ol className="mt-8 divide-y" role="list">
            {[
              [
                "Verify your domain",
                "A DNS record proves ownership and switches on spoof reporting. No mailbox access involved.",
              ],
              [
                "See your exposure",
                "Lookalike domains already registered against you, ranked by whether they can send mail.",
              ],
              [
                "Connect a mailbox",
                "One click on Microsoft or Google. One forwarding rule anywhere else. Nothing installed.",
              ],
              [
                "Add a payment method",
                "Only when you connect a mailbox — never before. The trial starts once the connection is live, not at signup.",
              ],
            ].map(([h, b], i) => (
              <li key={h} className="flex gap-5 py-5 first:pt-0 last:pb-0">
                <span className="mono-xs fg-3 mt-0.5 shrink-0 tnum">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{h}</h3>
                  <p className="fg-2 mt-1.5 text-sm leading-relaxed">{b}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={cn("mt-8 border-t pt-6")}>
            <span className="sect-label">Included free, forever</span>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2" role="list">
              {[
                "Lookalike domain monitoring",
                "Certificate Transparency alerts",
                "DMARC posture reports",
                "Unlimited defensive domains",
              ].map((f) => (
                <li key={f} className="flex gap-2.5 text-xs">
                  <Check size={13} className="accent mt-0.5 shrink-0" aria-hidden />
                  <span className="fg-2">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="fg-3 mt-5 text-xs">
          Prefer to look first?{" "}
          <Link
            to="/analyse"
            className="underline underline-offset-4 hover:text-[var(--fg)]"
          >
            Test a suspicious email
          </Link>{" "}
          — no account needed.
        </p>
      </aside>
    </main>
  );
}
