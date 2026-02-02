// src/components/auth/LoginCard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  KeyRound,
  ArrowRight,
  RotateCcw,
  User,
  Stethoscope,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import {
  normalizePhone,
  type Role,
  getShortIdByUid,
  getUserRoleByShortId,
  setUserRole,
} from "@/lib/Auth";

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

type Step = "phone" | "otp";

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function maskPhone(phone: string) {
  const cleaned = onlyDigits(phone);
  if (cleaned.length < 6) return phone;
  return `•••••••${cleaned.slice(-3)}`;
}

// ✅ ESLint-safe error parsing (no `any`)
function getErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

type LoginCardProps = {
  /** Optional: show a close button and call this when user closes */
  onClose?: () => void;
  /** Optional: called after successful login (useful for closing modals) */
  onSuccess?: () => void;
};

export default function LoginCard({ onClose, onSuccess }: LoginCardProps) {
  const router = useRouter();

  // Role selected in UI (used only if we need to set it)
  const [role, setRole] = useState<Role>("patient");
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Firebase OTP state
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const canSendOtp = useMemo(() => onlyDigits(phone).length >= 10, [phone]);
  const canVerify = useMemo(() => onlyDigits(otp).length === 6, [otp]);

  // cleanup any timers
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  function startCooldown(seconds = 25) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setCooldown(seconds);
    timerRef.current = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function getOrCreateRecaptcha() {
    if (typeof window === "undefined") return null;
    if (recaptchaRef.current) return recaptchaRef.current;

    // Mount point created here (so LoginModal doesn't need to own it)
    const id = "recaptcha-container-login";
    if (!document.getElementById(id)) {
      const el = document.createElement("div");
      el.id = id;
      el.style.display = "none";
      document.body.appendChild(el);
    }

    recaptchaRef.current = new RecaptchaVerifier(auth, id, { size: "invisible" });
    return recaptchaRef.current;
  }

  async function handleSendOtp() {
    if (!canSendOtp || loading) return;

    setLoading(true);
    setError(null);

    try {
      const verifier = getOrCreateRecaptcha();
      if (!verifier) {
        setError("Unable to start verification. Please refresh and try again.");
        return;
      }

      const e164 = normalizePhone(phone);
      const confirmation = await signInWithPhoneNumber(auth, e164, verifier);
      confirmationRef.current = confirmation;

      setStep("otp");
      setOtp("");
      startCooldown(25);
    } catch (e: unknown) {
      const message = getErrorMessage(e);

      const msg =
        message.includes("too-many-requests") || message.includes("TOO_MANY_ATTEMPTS_TRY_LATER")
          ? "Too many attempts. Please wait a bit and try again."
          : message.includes("invalid-phone-number")
          ? "That phone number looks invalid. Please check and try again."
          : "Could not send OTP. Please try again.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /**
   * ✅ After OTP confirm:
   * - We do NOT write to users/{uid} anymore.
   * - We look up uidMap/{uid} -> shortId
   * - Then read users/{shortId} to get stored role.
   *
   * If mapping/profile doesn't exist → user hasn't signed up → ask them to signup.
   */
  async function handleVerifyOtp() {
    if (!canVerify || loading) return;

    setLoading(true);
    setError(null);

    try {
      const confirmation = confirmationRef.current;
      if (!confirmation) {
        setError("OTP session expired. Please resend OTP.");
        setStep("phone");
        return;
      }

      const cred = await confirmation.confirm(otp);
      const uid = cred.user.uid;

      const shortId = await getShortIdByUid(uid);
      if (!shortId) {
        setError("No MEDXERN ID found for this number. Please sign up first.");
        setStep("phone");
        return;
      }

      // Role source-of-truth is in users/{shortId}
      const roleFromDb = await getUserRoleByShortId(shortId);

      if (!roleFromDb) {
        setError("Profile incomplete. Please sign up again to create your MEDXERN ID.");
        setStep("phone");
        return;
      }

      // Optional: if user selected a different role in UI, you can either:
      // A) ignore it (recommended: role is determined by profile), OR
      // B) allow updating role (not recommended for doctor/patient switching)
      //
      // We'll do A) use DB role always:
      const finalRole = roleFromDb;

      onSuccess?.();
      onClose?.();

      router.push(finalRole === "patient" ? "/patient" : "/doctor");
      router.refresh();
    } catch (e: unknown) {
      const message = getErrorMessage(e);

      const msg = message.includes("invalid-verification-code")
        ? "Incorrect OTP. Please try again."
        : "Could not verify OTP. Please try again.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleChangeNumber() {
    setError(null);
    setStep("phone");
    setOtp("");

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCooldown(0);
  }

  return (
    <div className="w-full max-w-md">
      <div className="relative rounded-[2.5rem] border border-medx-teal/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
        {/* Close (only when used in a modal) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/70 text-medx-navy/70 shadow-sm transition hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center">
          <div className="text-xs tracking-[0.3em] text-medx-navy/50">MEDXERN</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-medx-navy">Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "phone"
              ? "Enter your phone number to receive an OTP."
              : `Enter the OTP sent to ${maskPhone(phone)}.`}
          </p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Role toggle (UI only; real role comes from Firestore) */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole("patient")}
            className={[
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
              role === "patient"
                ? "border-medx-teal/40 bg-medx-teal/10 text-medx-navy"
                : "border-border bg-white/60 text-muted-foreground hover:bg-white",
            ].join(" ")}
          >
            <User className="h-4 w-4" />
            Patient
          </button>

          <button
            type="button"
            onClick={() => setRole("doctor")}
            className={[
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
              role === "doctor"
                ? "border-medx-gold/40 bg-medx-gold/20 text-medx-navy"
                : "border-border bg-white/60 text-muted-foreground hover:bg-white",
            ].join(" ")}
          >
            <Stethoscope className="h-4 w-4" />
            Doctor
          </button>
        </div>

        {/* Body */}
        <div className="mt-6 space-y-4">
          {step === "phone" ? (
            <>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-medx-navy/40" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="Phone number"
                  className="h-11 rounded-xl border-border bg-white pl-10"
                />
              </div>

              <Button
                disabled={!canSendOtp || loading}
                onClick={handleSendOtp}
                className="h-11 w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send OTP"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="pt-2 text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link
                  href="/signup"
                  className="text-medx-navy underline underline-offset-4"
                  onClick={() => onClose?.()}
                >
                  Create MEDXERN ID
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-medx-navy/40" />
                <Input
                  value={otp}
                  onChange={(e) => setOtp(onlyDigits(e.target.value).slice(0, 6))}
                  inputMode="numeric"
                  placeholder="Enter 6-digit OTP"
                  className="h-11 rounded-xl border-border bg-white pl-10"
                />
              </div>

              <Button
                disabled={!canVerify || loading}
                onClick={handleVerifyOtp}
                className="h-11 w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify & Continue"}
              </Button>

              <div className="flex items-center justify-between pt-1 text-sm text-medx-navy/70">
                <button
                  type="button"
                  onClick={handleChangeNumber}
                  className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-medx-navy"
                >
                  <RotateCcw className="h-4 w-4" />
                  Change number
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="underline underline-offset-4 hover:text-medx-navy disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-muted-foreground">
                Didn’t get it? Check your network / SMS inbox.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
