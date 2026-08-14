import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ApiError, api, auth } from "../lib/api";
import {
  checkPassphrase,
  isConsumerEmail,
  isLikelyDisposableEmail,
  looksLikeDomain,
} from "../lib/passphrase";
import { Button, cn } from "../components/primitives";

const STRENGTH_COLOR = ["#dc2626", "#dc2626", "#d97706", "#16a34a", "#16a34a"];

type Step =
  | "credentials"
  | "mfa-setup"
  | "mfa-verify"
  | "recovery"
  | "set-password";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<Step>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [code, setCode] = useState("");

  const [mfaToken, setMfaToken] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [newPass, setNewPass] = useState("");
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
    // The domain drives every downstream lookup (MX, DMARC, CT, lookalikes) and
    // the forwarding ingest address, so reject a company name typed here before
    // we create the account — not with a silent failure after registration.
    if (mode === "signup" && domain && !looksLikeDomain(domain)) {
      setError("Enter your company's domain, like yourcompany.com — not its name.");
      return;
    }
    if (mode === "signup" && isConsumerEmail(email)) {
      setError(
        "Use your work email — consumer inboxes like Gmail or Outlook.com can't " +
          "be used. Company accounts on Google Workspace or Microsoft 365 work; " +
          "sign up with your own company address.",
      );
      return;
    }
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
        setOtpauthUri(setup.otpauth_uri);
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

  // A user the owner provisioned must set their own password before anything else.
  async function routeAfterAuth(recoveryCodes?: string[]) {
    try {
      const who = await api.me();
      if (who.must_change_password) {
        setStep("set-password");
        return;
      }
    } catch {
      /* fall through to the normal routes */
    }
    if (recoveryCodes?.length) {
      setRecovery(recoveryCodes);
      setStep("recovery");
      return;
    }
    navigate("/dashboard");
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.mfaVerify({ mfa_token: mfaToken, code });
      auth.set(result.access_token, result.refresh_token);

      if (mode === "signup" && domain) {
        try {
          await api.bootstrap({ name: domain, domain });
        } catch {
          /* tenant may already exist */
        }
      }
      await routeAfterAuth(result.recovery_codes);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitInitialPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.setInitialPassword(newPass);
      navigate("/dashboard");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function skipMfa() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.mfaSkip(mfaToken);
      auth.set(result.access_token, result.refresh_token);

      if (mode === "signup" && domain) {
        try {
          await api.bootstrap({ name: domain, domain });
        } catch {
          /* tenant may already exist */
        }
      }
      await routeAfterAuth();
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
                : step === "set-password"
                  ? "Set your password"
                  : "Two-factor"}
          </span>
        </div>

        {/* ── Credentials ────────────────────────────────────────────────── */}
        {step === "credentials" && (
          <>
            {notice && step === "credentials" && (
              <p
                role="status"
                className="callout mt-5 flex items-center gap-2 px-4 py-3 text-xs font-medium"
              >
                <Check size={14} aria-hidden />
                {notice}
              </p>
            )}
            <h1 className="headline mt-5 text-balance">
              {mode === "signin" ? "Welcome back." : "Start with the free scan."}
            </h1>
            <p className="lede mt-4 text-base">
              {mode === "signin"
                ? "Your alert queue, mailbox coverage and audit trail."
                : "Your full-plan trial starts today — no card needed."}
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
                    Right after sign-in you'll add one DNS record to prove you own
                    this domain — it's the first step and unlocks your dashboard.
                    It switches on your spoof reports too. No mailbox access involved.
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
                {mode === "signup" && isLikelyDisposableEmail(email) && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    Disposable email addresses aren't allowed — use a permanent
                    inbox so you can receive fraud alerts and account recovery.
                  </p>
                )}
                {mode === "signup" &&
                  !isLikelyDisposableEmail(email) &&
                  isConsumerEmail(email) && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      Use your work email. Envelock protects a company domain, so
                      consumer inboxes like Gmail or Outlook.com can't be used —
                      but if your company runs on Google&nbsp;Workspace or
                      Microsoft&nbsp;365, sign up with your own company address.
                    </p>
                  )}
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
                {mode === "signup" &&
                  (() => {
                    const s = checkPassphrase(password);
                    if (!password)
                      return (
                        <p className="fg-3 mt-2 text-xs">
                          Use a passphrase — several unrelated words, 16+
                          characters. You can add two-factor now or later.
                        </p>
                      );
                    return (
                      <div className="mt-2" aria-live="polite">
                        <div className="flex gap-1" aria-hidden>
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="h-1 flex-1 rounded-full transition-colors"
                              style={{
                                backgroundColor:
                                  i < s.score
                                    ? STRENGTH_COLOR[s.score]
                                    : "var(--border, #e2e8f0)",
                              }}
                            />
                          ))}
                        </div>
                        <p
                          className="mt-1.5 text-xs font-medium"
                          style={{ color: s.ok ? "#16a34a" : STRENGTH_COLOR[s.score] }}
                        >
                          {s.label}
                          {s.hint ? ` — ${s.hint}` : ""}
                        </p>
                      </div>
                    );
                  })()}
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={
                  busy ||
                  (mode === "signup" &&
                    (!checkPassphrase(password).ok ||
                      isLikelyDisposableEmail(email)))
                }
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

              {mode === "signin" && (
                <p className="text-right">
                  <Link
                    to="/reset-password"
                    className="fg-3 text-xs font-medium underline underline-offset-4 hover:text-[var(--fg)]"
                  >
                    Forgot password?
                  </Link>
                </p>
              )}
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
              Scan this with your authenticator app (Google Authenticator, Authy,
              1Password, …). Strongly recommended — but you can skip it now and
              turn it on later from your dashboard.
            </p>

            <div className="panel mt-8 p-5">
              <div className="flex flex-col items-center gap-4">
                {otpauthUri ? (
                  <div className="rounded-lg bg-white p-3">
                    <QRCodeSVG value={otpauthUri} size={168} marginSize={0} />
                  </div>
                ) : null}
                <p className="fg-3 text-center text-xs leading-relaxed">
                  After scanning, enter the 6-digit code your app shows below.
                </p>
              </div>

              <div className="mt-4 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="fg-2 cursor-pointer text-xs font-semibold underline underline-offset-4"
                >
                  {showSecret ? "Hide setup key" : "Can't scan? Enter a key instead"}
                </button>
                {showSecret && (
                  <div className="mt-3 flex items-center gap-3">
                    <code className="font-mono flex-1 text-sm break-all">
                      {secret}
                    </code>
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
                )}
              </div>
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

            <div className="mt-6 border-t pt-6">
              <button
                type="button"
                onClick={skipMfa}
                disabled={busy}
                className="fg-2 cursor-pointer text-sm font-semibold underline underline-offset-4 hover:text-[var(--fg)] disabled:opacity-45"
              >
                Skip for now — set up two-factor later
              </button>
              <p className="fg-3 mt-2 text-xs leading-relaxed">
                Your dashboard will remind you until it's on. Two-factor is what
                keeps a stolen password from becoming a stolen account.
              </p>
            </div>
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

        {/* ── Set password (owner-provisioned first login) ────────────────── */}
        {step === "set-password" && (
          <>
            <h1 className="headline mt-5 text-balance">Set your password.</h1>
            <p className="lede mt-4 text-base">
              Your account was created for you with a temporary password. Choose
              your own to continue — no one else will know it.
            </p>
            <form onSubmit={submitInitialPassword} className="mt-8 space-y-4">
              <div>
                <label htmlFor="set-pw" className="block text-sm font-semibold">
                  New password
                </label>
                <input
                  id="set-pw"
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  autoFocus
                  className="field mt-2"
                />
                {newPass &&
                  (() => {
                    const s = checkPassphrase(newPass);
                    return (
                      <p
                        className="mt-2 text-xs font-medium"
                        style={{ color: s.ok ? "#16a34a" : STRENGTH_COLOR[s.score] }}
                      >
                        {s.label}
                        {s.hint ? ` — ${s.hint}` : ""}
                      </p>
                    );
                  })()}
              </div>
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={busy || !checkPassphrase(newPass).ok}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <KeyRound size={14} aria-hidden />
                )}
                SET PASSWORD
              </Button>
            </form>
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
                "Verify your domain first",
                "Right after two-factor, add one DNS record to prove ownership. It unlocks your dashboard and switches on spoof reporting — no mailbox access involved. We check automatically and continue the moment it's found.",
              ],
              [
                "See your exposure",
                "Once verified, your dashboard opens: lookalike domains already registered against you, ranked by whether they can send mail.",
              ],
              [
                "Connect a mailbox",
                "One click on Microsoft or Google. One forwarding rule anywhere else. Nothing installed.",
              ],
              [
                "Add a card only to keep it",
                "Your full-plan trial starts the moment you sign up — no card needed. Add one any time before it ends to stay protected; if you don't, you drop to Guard (free), never locked out.",
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
