import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { ApiError, api } from "../lib/api";
import { Button } from "../components/primitives";

/**
 * Password reset — the "Forgot password?" destination and the target of the
 * emailed reset link.
 *
 *  - Arriving with `?token=…` (the emailed link): just set a new password.
 *  - Arriving without a token: enter your email. An account with MFA resets in
 *    place with its authenticator code; an account without MFA is emailed a link.
 */
type Phase = "enter-email" | "set-new" | "mfa-reset" | "email-sent" | "done";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const linkToken = params.get("token");

  const [phase, setPhase] = useState<Phase>(linkToken ? "set-new" : "enter-email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState(linkToken ?? "");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.forgotPassword(email.trim().toLowerCase());
      if (r.method === "mfa" && r.reset_token) {
        setResetToken(r.reset_token);
        setPhase("mfa-reset");
      } else {
        setDevLink(r.reset_link ?? null);
        setPhase("email-sent");
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(e: FormEvent, withCode: boolean) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({
        token: resetToken,
        new_password: newPass,
        ...(withCode ? { code } : {}),
      });
      setPhase("done");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    phase === "done"
      ? "Password updated"
      : phase === "email-sent"
        ? "Check your email"
        : "Reset your password";

  return (
    <main className="grid12 shell min-h-[calc(100dvh-4rem)] items-center py-16">
      <div className="col-span-12 mx-auto w-full max-w-md md:col-span-6 md:col-start-4">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
          <span className="sect-label">Account recovery</span>
        </div>
        <h1 className="headline mt-5 text-balance">{heading}</h1>

        {error && (
          <div className="callout mt-5 flex items-center gap-2 px-4 py-3 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Enter email → branch to MFA or emailed link */}
        {phase === "enter-email" && (
          <form onSubmit={submitEmail} className="mt-8 space-y-5">
            <p className="lede text-base">
              Enter your work email. If your account uses an authenticator, you'll
              reset it here with a code; otherwise we'll email you a link.
            </p>
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
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Continue"}
            </Button>
          </form>
        )}

        {/* Emailed-link path: set a new password, no code */}
        {phase === "set-new" && (
          <form onSubmit={(e) => submitNewPassword(e, false)} className="mt-8 space-y-5">
            <p className="lede text-base">Choose a new password for your account.</p>
            <NewPasswordField value={newPass} onChange={setNewPass} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Set new password"}
            </Button>
          </form>
        )}

        {/* MFA path: authenticator code + new password */}
        {phase === "mfa-reset" && (
          <form onSubmit={(e) => submitNewPassword(e, true)} className="mt-8 space-y-5">
            <p className="lede text-base">
              Enter the 6-digit code from your authenticator app and choose a new
              password.
            </p>
            <div>
              <label htmlFor="code" className="block text-sm font-semibold">
                Authenticator code
              </label>
              <input
                id="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoComplete="one-time-code"
                required
                className="field mt-2 tracking-[0.3em]"
              />
            </div>
            <NewPasswordField value={newPass} onChange={setNewPass} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <KeyRound size={16} /> Reset password
                </>
              )}
            </Button>
          </form>
        )}

        {/* Non-MFA: email sent */}
        {phase === "email-sent" && (
          <div className="mt-8 space-y-5">
            <div className="flex items-start gap-3">
              <Mail size={18} className="mt-0.5 text-[var(--accent)]" aria-hidden />
              <p className="lede text-base">
                If that account exists, we've sent a reset link to its email. The
                link is valid for 30 minutes.
              </p>
            </div>
            {devLink && (
              <p className="fg-3 break-all text-xs">
                Dev link:{" "}
                <a href={devLink} className="underline">
                  {devLink}
                </a>
              </p>
            )}
            <Link to="/signin" className="inline-block">
              <Button variant="line">Back to sign in</Button>
            </Link>
          </div>
        )}

        {/* Success */}
        {phase === "done" && (
          <div className="mt-8 space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" aria-hidden />
              <p className="lede text-base">
                Your password has been updated. Sign in with your new password.
              </p>
            </div>
            <Button onClick={() => navigate("/signin")} className="w-full">
              Go to sign in
            </Button>
          </div>
        )}

        {phase !== "done" && phase !== "email-sent" && (
          <p className="fg-3 mt-6 text-xs">
            Remembered it?{" "}
            <Link to="/signin" className="underline">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

function NewPasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor="newpass" className="block text-sm font-semibold">
        New password
      </label>
      <input
        id="newpass"
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="at least 12 characters — a passphrase is ideal"
        autoComplete="new-password"
        minLength={12}
        required
        className="field mt-2"
      />
    </div>
  );
}
