import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Loader2,
  LogOut,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { ApiError, api, auth, type TenantInfo } from "../lib/api";
import { Button } from "../components/primitives";
import MfaEnroll from "../components/MfaEnroll";

interface Me {
  email: string;
  role: string;
  tenant_id: string;
  is_admin: boolean;
  mfa_enabled: boolean;
  phone: string | null;
  phone_verified: boolean;
  recovery_codes_remaining: number;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-0">
      <span className="fg-2 text-sm">{label}</span>
      <div className="flex items-center gap-2 text-sm font-medium">{children}</div>
    </div>
  );
}

function PhoneSetup({ me, onChanged }: { me: Me; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null); // dev code, if returned
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.phoneStart(phone);
      setSent(r.dev_code ?? null);
      setStage("verify");
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setNote(null);
    try {
      await api.phoneVerify(code);
      setOpen(false);
      setStage("enter");
      setCode("");
      await onChanged();
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="line" onClick={() => setOpen(true)}>
        <Phone size={12} aria-hidden />
        {me.phone_verified ? "Change phone" : "Add a recovery phone"}
      </Button>
    );
  }

  return (
    <div className="w-full">
      {stage === "enter" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 415 555 0100"
            className="field w-52 text-sm"
            autoComplete="tel"
          />
          <Button size="sm" variant="accent" onClick={start} disabled={busy || phone.length < 8}>
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null} SEND CODE
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
            CANCEL
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="field font-mono w-28 text-sm tracking-[0.3em]"
          />
          <Button size="sm" variant="accent" onClick={verify} disabled={busy || code.length !== 6}>
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null} VERIFY
          </Button>
          {sent && (
            <span className="fg-3 mono-xs">dev code: {sent}</span>
          )}
        </div>
      )}
      {note && <p className="mt-2 text-xs text-red-600">{note}</p>}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([api.me(), api.tenant()]);
      setMe(m as Me);
      setTenant(t);
    } catch (e) {
      setError(e instanceof ApiError && e.unauthorized ? "signed-out" : "Could not load your profile.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* best-effort */
    }
    auth.clear();
    navigate("/");
  }

  if (error === "signed-out" || !auth.signedIn) {
    return (
      <main className="shell py-24">
        <div className="panel mx-auto max-w-lg p-8 text-center">
          <h1 className="headline">Sign in to manage your profile</h1>
          <Link to="/signin" className="mt-8 inline-block">
            <Button variant="accent" size="lg">
              SIGN IN
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell max-w-2xl py-12">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-[var(--accent)]" aria-hidden />
        <span className="sect-label">Your account</span>
      </div>
      <h1 className="headline mt-5">Profile &amp; security</h1>

      {!me ? (
        <p className="fg-3 mt-8 text-sm">Loading…</p>
      ) : (
        <>
          {/* Account */}
          <section className="panel mt-8 px-6 py-2">
            <Row label="Email">{me.email}</Row>
            <Row label="Role">
              <span className="font-mono text-xs uppercase">{me.role}</span>
            </Row>
            <Row label="Organisation">{tenant?.name ?? tenant?.primary_domain ?? "—"}</Row>
            <Row label="Plan">
              <span className="font-mono text-xs uppercase">{tenant?.plan ?? "guard"}</span>
              {tenant?.trial.active && tenant.trial.days_left !== null && (
                <span className="fg-3 text-xs">
                  · trial ends in {tenant.trial.days_left} day
                  {tenant.trial.days_left === 1 ? "" : "s"}
                </span>
              )}
            </Row>
          </section>

          {/* Security */}
          <div className="mt-8 flex items-center gap-2">
            <ShieldCheck size={16} className="accent" aria-hidden />
            <h2 className="text-sm font-semibold">Two-factor &amp; recovery</h2>
          </div>
          {!me.mfa_enabled && (
            <div className="callout mt-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <ShieldAlert size={18} className="shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-xs leading-relaxed">
                <span className="font-semibold">Two-factor is off.</span> A stolen
                password is enough to take this account. Turn it on below.
              </p>
            </div>
          )}
          <section className="panel mt-3 px-6 py-2">
            <Row label="Authenticator app (TOTP)">
              {me.mfa_enabled ? (
                <span className="accent flex items-center gap-1.5 text-xs font-semibold">
                  <BadgeCheck size={14} aria-hidden /> ACTIVE
                </span>
              ) : mfaOpen ? (
                <Button size="sm" variant="quiet" onClick={() => setMfaOpen(false)}>
                  CANCEL
                </Button>
              ) : (
                <Button size="sm" variant="accent" onClick={() => setMfaOpen(true)}>
                  <ShieldAlert size={12} aria-hidden /> SET UP NOW
                </Button>
              )}
            </Row>
            {!me.mfa_enabled && mfaOpen && (
              <div className="rise border-b py-4">
                <MfaEnroll
                  onDone={async () => {
                    setMfaOpen(false);
                    await load();
                  }}
                  onCancel={() => setMfaOpen(false)}
                />
              </div>
            )}
            <Row label="Recovery codes">
              {me.mfa_enabled ? (
                <span className="fg-3 text-xs">
                  {me.recovery_codes_remaining} remaining · single-use
                </span>
              ) : (
                <span className="fg-3 text-xs">Issued when you turn on two-factor</span>
              )}
            </Row>
            <Row label={me.phone_verified ? `Recovery phone (${me.phone})` : "Recovery phone"}>
              {me.phone_verified ? (
                <span className="accent flex items-center gap-1.5 text-xs font-semibold">
                  <BadgeCheck size={14} aria-hidden /> VERIFIED
                </span>
              ) : (
                <PhoneSetup me={me} onChanged={load} />
              )}
            </Row>
            {me.phone_verified && (
              <Row label="">
                <PhoneSetup me={me} onChanged={load} />
              </Row>
            )}
          </section>
          <p className="fg-3 mt-3 text-xs leading-relaxed">
            A hardware passkey (WebAuthn) is on the roadmap. Until then, your
            authenticator app is the primary factor, with recovery codes and a
            verified phone as backups.
          </p>

          <div className="mt-10 flex items-center gap-3">
            <Button variant="line" onClick={signOut}>
              <LogOut size={14} aria-hidden /> SIGN OUT
            </Button>
            <Link to="/dashboard">
              <Button variant="quiet">BACK TO DASHBOARD</Button>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
