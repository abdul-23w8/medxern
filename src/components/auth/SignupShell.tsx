// src/components/auth/SignupShell.tsx
"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoginModal } from "@/components/auth/LoginModalProvider";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
  CalendarDays,
  Building2,
  MapPin,
  IdCard,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { normalizePhone, type Role } from "@/lib/Auth";
import { createProfileWithShortId } from "@/lib/createProfileWithShortId";

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

type Step = "role" | "phone" | "otp" | "details";

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function maskPhone(phone: string) {
  const cleaned = onlyDigits(phone);
  if (cleaned.length < 6) return phone;
  return `•••••••${cleaned.slice(-3)}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ✅ no `any` (ESLint-safe)
function getErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

export default function SignupShell() {
  const router = useRouter();
  const { open } = useLoginModal();

  const [role, setRole] = useState<Role>("patient");
  const [step, setStep] = useState<Step>("role");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // patient fields
  const [pName, setPName] = useState("");
  const [pDob, setPDob] = useState("");
  const [pEmail, setPEmail] = useState("");

  // doctor fields
  const [dName, setDName] = useState("");
  const [dSpeciality, setDSpeciality] = useState("");
  const [dClinic, setDClinic] = useState("");
  const [dCity, setDCity] = useState("");
  const [dRegNo, setDRegNo] = useState("");
  const [dCouncil, setDCouncil] = useState("");

  // Firebase OTP state (correct names)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const canSendOtp = useMemo(() => onlyDigits(phone).length >= 10, [phone]);
  const canVerifyOtp = useMemo(() => onlyDigits(otp).length === 6, [otp]);

  const canSubmitDetails = useMemo(() => {
    if (role === "patient") return pName.trim().length >= 2 && pDob.trim().length >= 6;
    return (
      dName.trim().length >= 2 &&
      dSpeciality.trim().length >= 2 &&
      dClinic.trim().length >= 2 &&
      dCity.trim().length >= 2 &&
      dRegNo.trim().length >= 4 &&
      dCouncil.trim().length >= 2
    );
  }, [role, pName, pDob, dName, dSpeciality, dClinic, dCity, dRegNo, dCouncil]);

  function goToPhone() {
    setError(null);
    setStep("phone");
    setOtp("");
  }

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    const id = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function getOrCreateRecaptcha() {
    if (typeof window === "undefined") return null;
    if (recaptchaRef.current) return recaptchaRef.current;

    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });

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

  async function handleVerifyOtp() {
    if (!canVerifyOtp || loading) return;

    setLoading(true);
    setError(null);

    try {
      const confirmation = confirmationRef.current;
      if (!confirmation) {
        setError("OTP session expired. Please resend OTP.");
        setStep("phone");
        return;
      }

      await confirmation.confirm(otp);
      setStep("details");
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

  async function handleCreateAccount() {
    if (!canSubmitDetails || loading) return;

    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Session not found. Please verify OTP again.");
        setStep("phone");
        return;
      }

      // ✅ Build payload for profile creation
      const e164 = user.phoneNumber ?? normalizePhone(phone);

      if (role === "patient") {
        // ✅ Creates:
        // - users/{shortId}
        // - uidMap/{uid}
        // - publicIds/{shortId}
        await createProfileWithShortId(
          // db is imported inside createProfileWithShortId signature; we pass it here
          // but we don't import db in this file to avoid confusion — use direct import below
          // (we will import db now)
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          db,
          { uid: user.uid },
          {
            role,
            phone: e164,
            profile: {
              name: pName.trim(),
              dob: pDob,
              email: pEmail.trim() || "",
            },
          }
        );
      } else {
        // For doctors, keep provider details inside "profile" in a structured way
        await createProfileWithShortId(
          db,
          { uid: user.uid },
          {
            role,
            phone: e164,
            profile: {
              name: dName.trim(),
              email: "", // optional; you can add later if you collect it
              dob: "",
            },
          }
        );

        // NOTE:
        // Provider-specific details should live in users/{shortId} too.
        // We’ll do a second write after we know shortId, but createProfileWithShortId
        // currently returns shortId — so we can use it here.
        // To avoid changing that file again, easiest is to re-call and capture return:

        const { shortId } = await createProfileWithShortId(db, { uid: user.uid }, {
          role,
          phone: e164,
          profile: { name: dName.trim(), email: "", dob: "" },
        });

        // Now attach provider details in the same user doc
        const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
        await setDoc(
          doc(db, "users", shortId),
          {
            provider: {
              name: dName.trim(),
              speciality: dSpeciality.trim(),
              clinic: dClinic.trim(),
              city: dCity.trim(),
              registrationNumber: dRegNo.trim(),
              council: dCouncil.trim(),
              verificationStatus: "pending",
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.push(role === "patient" ? "/patient" : "/doctor");
      router.refresh();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      // Common reason: trying to create profile twice on same uid (uidMap already exists)
      const msg =
        message.toLowerCase().includes("uidmap") || message.toLowerCase().includes("mapping")
          ? "Your account already exists. Please login."
          : "Could not create your account. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      {/* Required for Firebase Phone Auth */}
      <div id="recaptcha-container" className="hidden" />

      {/* Top */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="max-w-2xl">
          <div className="text-sm text-muted-foreground">MEDXERN</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-medx-navy md:text-4xl">
            Create your account
          </h1>
          <p className="mt-3 text-muted-foreground">
            {step === "role" && "Choose your role to continue."}
            {step === "phone" && "Enter your phone number to receive an OTP."}
            {step === "otp" && `Enter the OTP sent to ${maskPhone(phone)}.`}
            {step === "details" &&
              (role === "patient"
                ? "Add minimal details to create your MEDXERN ID."
                : "Add provider details. Verification is required to access patient records.")}
          </p>

          {error && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            onClick={open}
            className="text-medx-navy underline underline-offset-4 hover:text-medx-navy/80"
          >
            Login
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_0.9fr]">
        {/* Left: Form card */}
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          {/* Step: role */}
          {step === "role" && (
            <div>
              <div className="text-sm font-semibold text-medx-navy">Continue as</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("patient")}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    role === "patient"
                      ? "border-medx-teal/40 bg-medx-teal/10"
                      : "border-border bg-white hover:bg-medx-teal/5",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-medx-teal/10 text-medx-teal ring-1 ring-medx-teal/20">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-medx-navy">Patient</div>
                      <div className="text-sm text-muted-foreground">Store records. Share when needed.</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("doctor")}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    role === "doctor"
                      ? "border-medx-gold/40 bg-medx-gold/20"
                      : "border-border bg-white hover:bg-medx-teal/5",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-medx-gold/20 text-medx-navy ring-1 ring-medx-gold/25">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-medx-navy">Doctor / Clinic</div>
                      <div className="text-sm text-muted-foreground">View shared timelines (verified).</div>
                    </div>
                  </div>
                </button>
              </div>

              <Button
                onClick={goToPhone}
                className="mt-6 h-11 w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="mt-3 text-xs text-muted-foreground">
                Doctors can’t browse patients. Access only works when a patient shares an ID/QR.
              </div>
            </div>
          )}

          {/* Step: phone */}
          {step === "phone" && (
            <div>
              <div className="text-sm font-semibold text-medx-navy">Phone verification</div>

              <div className="mt-5 relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-medx-navy/40" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="Phone number"
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <Button
                disabled={!canSendOtp || loading}
                onClick={handleSendOtp}
                className="mt-4 h-11 w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send OTP"}
              </Button>

              <button
                type="button"
                className="mt-3 text-sm text-medx-navy/70 underline underline-offset-4 hover:text-medx-navy"
                onClick={() => {
                  setError(null);
                  setStep("role");
                }}
              >
                Change role
              </button>
            </div>
          )}

          {/* Step: otp */}
          {step === "otp" && (
            <div>
              <div className="text-sm font-semibold text-medx-navy">Enter OTP</div>

              <div className="mt-5 relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-medx-navy/40" />
                <Input
                  value={otp}
                  onChange={(e) => setOtp(onlyDigits(e.target.value).slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6-digit OTP"
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <Button
                disabled={!canVerifyOtp || loading}
                onClick={handleVerifyOtp}
                className="mt-4 h-11 w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify"}
              </Button>

              <div className="mt-4 flex items-center justify-between text-sm text-medx-navy/70">
                <button
                  type="button"
                  className="underline underline-offset-4 hover:text-medx-navy"
                  onClick={() => {
                    setError(null);
                    setStep("phone");
                  }}
                >
                  Change number
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  className="underline underline-offset-4 hover:text-medx-navy disabled:opacity-60"
                  onClick={handleSendOtp}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">OTP can take a few seconds depending on network.</div>
            </div>
          )}

          {/* Step: details */}
          {step === "details" && (
            <div>
              <div className="text-sm font-semibold text-medx-navy">
                {role === "patient" ? "Patient details" : "Provider details"}
              </div>

              <div className="mt-5 grid gap-4">
                {role === "patient" ? (
                  <>
                    <Field icon={<User className="h-4 w-4" />}>
                      <Input
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="Full name"
                        className="h-11 rounded-xl"
                      />
                    </Field>

                    <Field icon={<CalendarDays className="h-4 w-4" />}>
                      <Input
                        type="date"
                        value={pDob}
                        onChange={(e) => setPDob(e.target.value)}
                        max={todayISO()}
                        className={[
                          "h-11 rounded-xl",
                          "[&::-webkit-calendar-picker-indicator]:opacity-0",
                          "[&::-webkit-calendar-picker-indicator]:absolute",
                          "[&::-webkit-calendar-picker-indicator]:right-3",
                          "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                        ].join(" ")}
                      />
                    </Field>

                    <Input
                      value={pEmail}
                      onChange={(e) => setPEmail(e.target.value)}
                      placeholder="Email (optional)"
                      className="h-11 rounded-xl"
                    />
                  </>
                ) : (
                  <>
                    <Field icon={<User className="h-4 w-4" />}>
                      <Input
                        value={dName}
                        onChange={(e) => setDName(e.target.value)}
                        placeholder="Full name"
                        className="h-11 rounded-xl"
                      />
                    </Field>

                    <Field icon={<Stethoscope className="h-4 w-4" />}>
                      <Input
                        value={dSpeciality}
                        onChange={(e) => setDSpeciality(e.target.value)}
                        placeholder="Speciality (e.g., Cardiology)"
                        className="h-11 rounded-xl"
                      />
                    </Field>

                    <Field icon={<Building2 className="h-4 w-4" />}>
                      <Input
                        value={dClinic}
                        onChange={(e) => setDClinic(e.target.value)}
                        placeholder="Clinic / Hospital name"
                        className="h-11 rounded-xl"
                      />
                    </Field>

                    <Field icon={<MapPin className="h-4 w-4" />}>
                      <Input
                        value={dCity}
                        onChange={(e) => setDCity(e.target.value)}
                        placeholder="City"
                        className="h-11 rounded-xl"
                      />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field icon={<IdCard className="h-4 w-4" />}>
                        <Input
                          value={dRegNo}
                          onChange={(e) => setDRegNo(e.target.value)}
                          placeholder="Registration number"
                          className="h-11 rounded-xl"
                        />
                      </Field>

                      <Input
                        value={dCouncil}
                        onChange={(e) => setDCouncil(e.target.value)}
                        placeholder="Council / State"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </>
                )}

                <Button
                  disabled={!canSubmitDetails || loading}
                  onClick={handleCreateAccount}
                  className="h-11 rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 disabled:opacity-60"
                >
                  {loading ? "Creating…" : role === "patient" ? "Create my MEDXERN ID" : "Create provider account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="text-xs text-muted-foreground">
                  {role === "patient"
                    ? "Free to start • You control access"
                    : "Provider accounts require verification before accessing patient records."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Reassurance panel */}
        <div className="rounded-3xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4 text-medx-teal" />
            Patient-owned • Permission-based
          </div>

          <div className="mt-5 text-sm font-semibold text-medx-navy">What you get</div>

          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-medx-teal" />
              <div>A clean, chronological timeline from your existing files</div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-medx-teal" />
              <div>One MEDXERN ID you can share with any doctor</div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-medx-teal" />
              <div>Original PDFs/photos preserved and always accessible</div>
            </div>
          </div>

          {role === "doctor" && (
            <div className="mt-6 rounded-2xl border border-border bg-white p-4 text-xs text-muted-foreground">
              Doctors can’t browse patients. Access only works when a patient shares an ID/QR.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-medx-navy/40">{icon}</div>
      <div className="[&>input]:pl-10">{children}</div>
    </div>
  );
}

// ✅ IMPORTANT: add this import at top (kept here to avoid missing it if you copy-paste)
import { db } from "@/lib/firebase";
