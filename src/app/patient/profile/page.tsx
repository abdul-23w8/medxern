// src/app/patient/profile/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Copy,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Pencil,
  Save,
  X,
  HeartPulse,
  PhoneCall,
  SlidersHorizontal,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { logout } from "@/lib/Auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "patient" | "doctor";

type VerificationStatus = "pending" | "verified" | "rejected";
type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "Unknown";

type ShareMode = "manual" | "time_limited";

type UserDoc = {
  uid: string;
  shortId: string;
  role: Role;
  phone?: string;

  profile?: {
    name?: string;
    email?: string | null;
    dob?: string;
  };

  // ✅ Patient additions
  health?: {
    bloodGroup?: BloodGroup;
    heightCm?: number | null;
    weightKg?: number | null;
    allergies?: string[]; // tags
    conditions?: string[]; // tags
  };

  emergency?: {
    contactName?: string;
    relationship?: string;
    phone?: string;
    preferredHospital?: string;
    insuranceProvider?: string;
  };

  preferences?: {
    sharing?: {
      mode?: ShareMode;
      defaultDurationHours?: number | null; // used when mode=time_limited
    };
    ai?: {
      enabled?: boolean;
      allowSummaries?: boolean;
      showSources?: boolean;
    };
    notifications?: {
      enabled?: boolean;
    };
    language?: string; // e.g. "en", "hi"
  };

  // Doctor/provider fields (kept for completeness; most are read-only/limited edit)
  provider?: {
    name?: string;
    speciality?: string;
    clinic?: string;
    city?: string;
    registrationNumber?: string;
    council?: string;
    verificationStatus?: VerificationStatus;
  };

  createdAt?: unknown;
  updatedAt?: unknown;
};

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function tagsToString(tags?: string[]) {
  return (tags ?? []).join(", ");
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shortId, setShortId] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

  // ---------- Edit modes ----------
  const [editCore, setEditCore] = useState(false);
  const [editHealth, setEditHealth] = useState(false);
  const [editEmergency, setEditEmergency] = useState(false);
  const [editPrefs, setEditPrefs] = useState(false);
  const [editProvider, setEditProvider] = useState(false);

  // ---------- Form state (editable) ----------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("Unknown");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [allergiesText, setAllergiesText] = useState("");
  const [conditionsText, setConditionsText] = useState("");

  const [emName, setEmName] = useState("");
  const [emRelation, setEmRelation] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [preferredHospital, setPreferredHospital] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");

  const [shareMode, setShareMode] = useState<ShareMode>("manual");
  const [shareDurationHours, setShareDurationHours] = useState<string>("24");

  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSummaries, setAiSummaries] = useState(true);
  const [aiShowSources, setAiShowSources] = useState(true);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [language, setLanguage] = useState("en");

  // provider (doctor)
  const [pSpeciality, setPSpeciality] = useState("");
  const [pClinic, setPClinic] = useState("");
  const [pCity, setPCity] = useState("");
  const [pCouncil, setPCouncil] = useState("");

  const displayName = useMemo(() => {
    if (!userDoc) return "";
    if (userDoc.role === "doctor") return userDoc.provider?.name ?? userDoc.profile?.name ?? "Doctor";
    return userDoc.profile?.name ?? "Patient";
  }, [userDoc]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  function hydrateForm(d: UserDoc) {
    // Core
    setName(d.profile?.name ?? "");
    setEmail((d.profile?.email ?? "") || "");
    setDob(d.profile?.dob ?? "");

    // Health
    setBloodGroup(d.health?.bloodGroup ?? "Unknown");
    setHeightCm(d.health?.heightCm != null ? String(d.health.heightCm) : "");
    setWeightKg(d.health?.weightKg != null ? String(d.health.weightKg) : "");
    setAllergiesText(tagsToString(d.health?.allergies));
    setConditionsText(tagsToString(d.health?.conditions));

    // Emergency
    setEmName(d.emergency?.contactName ?? "");
    setEmRelation(d.emergency?.relationship ?? "");
    setEmPhone(d.emergency?.phone ?? "");
    setPreferredHospital(d.emergency?.preferredHospital ?? "");
    setInsuranceProvider(d.emergency?.insuranceProvider ?? "");

    // Preferences
    setShareMode(d.preferences?.sharing?.mode ?? "manual");
    setShareDurationHours(
      d.preferences?.sharing?.defaultDurationHours != null
        ? String(d.preferences.sharing.defaultDurationHours)
        : "24"
    );

    setAiEnabled(d.preferences?.ai?.enabled ?? true);
    setAiSummaries(d.preferences?.ai?.allowSummaries ?? true);
    setAiShowSources(d.preferences?.ai?.showSources ?? true);

    setNotifEnabled(d.preferences?.notifications?.enabled ?? true);
    setLanguage(d.preferences?.language ?? "en");

    // Provider (doctor)
    setPSpeciality(d.provider?.speciality ?? "");
    setPClinic(d.provider?.clinic ?? "");
    setPCity(d.provider?.city ?? "");
    setPCouncil(d.provider?.council ?? "");
  }

  async function loadProfile() {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        router.push("/");
        return;
      }

      // uidMap/{uid} -> shortId
      const mapSnap = await getDoc(doc(db, "uidMap", user.uid));
      if (!mapSnap.exists()) {
        setError("No MEDXERN profile found for this account.");
        return;
      }

      const sid = (mapSnap.data() as { shortId?: string }).shortId;
      if (!sid) {
        setError("Profile mapping is incomplete.");
        return;
      }

      // users/{shortId}
      const uSnap = await getDoc(doc(db, "users", sid));
      if (!uSnap.exists()) {
        setError("Profile document is missing.");
        return;
      }

      const d = uSnap.data() as UserDoc;

      setShortId(sid);
      setUserDoc(d);
      hydrateForm(d);
    } catch {
      setError("Could not load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadProfile();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  function endAllEdits() {
    setEditCore(false);
    setEditHealth(false);
    setEditEmergency(false);
    setEditPrefs(false);
    setEditProvider(false);
  }

  function cancelSection(section: "core" | "health" | "emergency" | "prefs" | "provider") {
    if (!userDoc) return;
    hydrateForm(userDoc);
    if (section === "core") setEditCore(false);
    if (section === "health") setEditHealth(false);
    if (section === "emergency") setEditEmergency(false);
    if (section === "prefs") setEditPrefs(false);
    if (section === "provider") setEditProvider(false);
  }

  // ✅ Only update fields that are safe to edit.
  // ❌ Never allow editing: uid, shortId, role, phone (phone is auth-verified), verificationStatus, registrationNumber
  async function saveSection(section: "core" | "health" | "emergency" | "prefs" | "provider") {
    if (!shortId || !userDoc) return;

    setSaving(true);
    setError(null);

    try {
      const userRef = doc(db, "users", shortId);

      if (section === "core") {
        const safeEmail = email.trim();
        await setDoc(
          userRef,
          {
            profile: {
              name: name.trim(),
              email: safeEmail ? safeEmail : null,
              dob: dob || "",
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setEditCore(false);
      }

      if (section === "health") {
        const h = heightCm.trim() ? Number(heightCm) : null;
        const w = weightKg.trim() ? Number(weightKg) : null;

        await setDoc(
          userRef,
          {
            health: {
              bloodGroup: bloodGroup ?? "Unknown",
              heightCm: Number.isFinite(h as number) ? h : null,
              weightKg: Number.isFinite(w as number) ? w : null,
              allergies: parseTags(allergiesText),
              conditions: parseTags(conditionsText),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setEditHealth(false);
      }

      if (section === "emergency") {
        const normalizedEmergencyPhone = emPhone.trim()
          ? emPhone.trim().startsWith("+")
            ? emPhone.trim()
            : /^\d{10}$/.test(onlyDigits(emPhone))
            ? `+91${onlyDigits(emPhone)}`
            : emPhone.trim()
          : "";

        await setDoc(
          userRef,
          {
            emergency: {
              contactName: emName.trim(),
              relationship: emRelation.trim(),
              phone: normalizedEmergencyPhone,
              preferredHospital: preferredHospital.trim(),
              insuranceProvider: insuranceProvider.trim(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setEditEmergency(false);
      }

      if (section === "prefs") {
        const hrs = shareDurationHours.trim() ? Number(shareDurationHours) : null;

        await setDoc(
          userRef,
          {
            preferences: {
              sharing: {
                mode: shareMode,
                defaultDurationHours:
                  shareMode === "time_limited" && hrs != null && Number.isFinite(hrs) ? hrs : null,
              },
              ai: {
                enabled: !!aiEnabled,
                allowSummaries: !!aiSummaries,
                showSources: !!aiShowSources,
              },
              notifications: {
                enabled: !!notifEnabled,
              },
              language: language.trim() || "en",
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setEditPrefs(false);
      }

      if (section === "provider") {
        // Only allow limited edits; do NOT allow changing verificationStatus or registrationNumber.
        await setDoc(
          userRef,
          {
            provider: {
              ...(userDoc.provider ?? {}),
              speciality: pSpeciality.trim(),
              clinic: pClinic.trim(),
              city: pCity.trim(),
              council: pCouncil.trim(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setEditProvider(false);
      }

      // reload fresh doc (single source of truth)
      await loadProfile();
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Loading profile…</div>
        </div>
      </div>
    );
  }

  if (error || !userDoc || !shortId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-medx-navy">Profile</div>
          <div className="mt-2 text-sm text-red-600">{error ?? "Unknown error"}</div>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => router.push("/signup")}>
              Create account
            </Button>
            <Button onClick={() => router.push("/")}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }

  const phoneValue = userDoc.phone ?? auth.currentUser?.phoneNumber ?? "—";
  const roleLabel = userDoc.role === "doctor" ? "Doctor / Clinic" : "Patient";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">MEDXERN</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-medx-navy">Your profile</h1>

            <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              {roleLabel}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLogout} className="rounded-xl">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* MEDXERN ID (read-only) */}
        <div className="mt-6 rounded-2xl border border-medx-teal/20 bg-medx-teal/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-medx-navy/80">Your MEDXERN ID</div>
              <div className="mt-1 text-xl font-bold tracking-wider text-medx-navy">{shortId}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Share this with a doctor only when you choose.
              </div>
            </div>

            <Button
              onClick={() => copy(shortId)}
              className="w-full rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 sm:w-auto"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>

        {/* Core identity (editable except phone/role/id) */}
        <SectionCard
          title="Core identity"
          icon={<UserIcon className="h-4 w-4 text-medx-teal" />}
          editing={editCore}
          setEditing={(v) => {
            endAllEdits();
            setEditCore(v);
          }}
          saving={saving}
          onSave={() => saveSection("core")}
          onCancel={() => cancelSection("core")}
          note="MEDXERN ID, phone and role are locked for security."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <EditableField
              label="Name"
              value={name}
              setValue={setName}
              placeholder="Full name"
              editable={editCore}
            />
            <ReadOnlyField label="Phone (verified)" value={phoneValue} />
            <EditableField
              label="Email (optional)"
              value={email}
              setValue={setEmail}
              placeholder="you@example.com"
              editable={editCore}
            />
            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">Date of birth</div>
              {editCore ? (
                <Input
                  type="date"
                  value={dob}
                  max={todayISO()}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-2 h-11 rounded-xl"
                />
              ) : (
                <div className="mt-2 text-sm text-medx-navy">{dob || "—"}</div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Health snapshot */}
        <SectionCard
          title="Health snapshot"
          icon={<HeartPulse className="h-4 w-4 text-medx-teal" />}
          editing={editHealth}
          setEditing={(v) => {
            endAllEdits();
            setEditHealth(v);
          }}
          saving={saving}
          onSave={() => saveSection("health")}
          onCancel={() => cancelSection("health")}
          note="This is self-reported. Keep it short and accurate."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">Blood group</div>
              {editHealth ? (
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                >
                  {(["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as BloodGroup[]).map(
                    (bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    )
                  )}
                </select>
              ) : (
                <div className="mt-2 text-sm text-medx-navy">{bloodGroup || "Unknown"}</div>
              )}
            </div>

            <EditableField
              label="Height (cm)"
              value={heightCm}
              setValue={setHeightCm}
              placeholder="e.g., 175"
              editable={editHealth}
              inputMode="numeric"
            />
            <EditableField
              label="Weight (kg)"
              value={weightKg}
              setValue={setWeightKg}
              placeholder="e.g., 70"
              editable={editHealth}
              inputMode="numeric"
            />

            <div className="rounded-2xl border border-border bg-white p-4 md:col-span-2">
              <div className="text-xs font-semibold text-medx-navy/70">Allergies (comma separated)</div>
              {editHealth ? (
                <Input
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  placeholder="e.g., Penicillin, Peanuts"
                  className="mt-2 h-11 rounded-xl"
                />
              ) : (
                <div className="mt-2 text-sm text-medx-navy">{allergiesText || "—"}</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-4 md:col-span-2">
              <div className="text-xs font-semibold text-medx-navy/70">Chronic conditions (comma separated)</div>
              {editHealth ? (
                <Input
                  value={conditionsText}
                  onChange={(e) => setConditionsText(e.target.value)}
                  placeholder="e.g., Diabetes, Asthma"
                  className="mt-2 h-11 rounded-xl"
                />
              ) : (
                <div className="mt-2 text-sm text-medx-navy">{conditionsText || "—"}</div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Emergency */}
        <SectionCard
          title="Emergency"
          icon={<PhoneCall className="h-4 w-4 text-medx-teal" />}
          editing={editEmergency}
          setEditing={(v) => {
            endAllEdits();
            setEditEmergency(v);
          }}
          saving={saving}
          onSave={() => saveSection("emergency")}
          onCancel={() => cancelSection("emergency")}
          note="Add at least one emergency contact."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <EditableField
              label="Emergency contact name"
              value={emName}
              setValue={setEmName}
              placeholder="e.g., Parent/Guardian name"
              editable={editEmergency}
            />
            <EditableField
              label="Relationship"
              value={emRelation}
              setValue={setEmRelation}
              placeholder="e.g., Father, Mother, Spouse"
              editable={editEmergency}
            />
            <EditableField
              label="Emergency phone"
              value={emPhone}
              setValue={setEmPhone}
              placeholder="e.g., +91xxxxxxxxxx"
              editable={editEmergency}
              inputMode="tel"
            />
            <EditableField
              label="Preferred hospital (optional)"
              value={preferredHospital}
              setValue={setPreferredHospital}
              placeholder="e.g., Apollo Hospitals"
              editable={editEmergency}
            />
            <div className="md:col-span-2">
              <EditableField
                label="Insurance provider (optional)"
                value={insuranceProvider}
                setValue={setInsuranceProvider}
                placeholder="e.g., Star Health"
                editable={editEmergency}
              />
            </div>
          </div>
        </SectionCard>

        {/* Preferences */}
        <SectionCard
          title="Preferences"
          icon={<SlidersHorizontal className="h-4 w-4 text-medx-teal" />}
          editing={editPrefs}
          setEditing={(v) => {
            endAllEdits();
            setEditPrefs(v);
          }}
          saving={saving}
          onSave={() => saveSection("prefs")}
          onCancel={() => cancelSection("prefs")}
          note="You control sharing and AI behavior."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">Default sharing mode</div>
              {editPrefs ? (
                <select
                  value={shareMode}
                  onChange={(e) => setShareMode(e.target.value as ShareMode)}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="manual">Manual approval only</option>
                  <option value="time_limited">Time-limited access</option>
                </select>
              ) : (
                <div className="mt-2 text-sm text-medx-navy">
                  {shareMode === "manual" ? "Manual approval only" : "Time-limited access"}
                </div>
              )}

              {shareMode === "time_limited" && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-medx-navy/70">Default duration (hours)</div>
                  {editPrefs ? (
                    <Input
                      value={shareDurationHours}
                      onChange={(e) => setShareDurationHours(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g., 24"
                      className="mt-2 h-11 rounded-xl"
                    />
                  ) : (
                    <div className="mt-2 text-sm text-medx-navy">{shareDurationHours || "—"}</div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">AI assistant</div>

              <ToggleRow
                label="Enable AI assistant"
                checked={aiEnabled}
                setChecked={setAiEnabled}
                editable={editPrefs}
              />
              <ToggleRow
                label="Allow AI summaries"
                checked={aiSummaries}
                setChecked={setAiSummaries}
                editable={editPrefs}
                disabled={!aiEnabled}
              />
              <ToggleRow
                label="Show sources used by AI"
                checked={aiShowSources}
                setChecked={setAiShowSources}
                editable={editPrefs}
                disabled={!aiEnabled}
              />
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">Notifications</div>
              <ToggleRow
                label="Enable notifications"
                checked={notifEnabled}
                setChecked={setNotifEnabled}
                editable={editPrefs}
              />
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-xs font-semibold text-medx-navy/70">Language</div>
              {editPrefs ? (
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                  <option value="ur">Urdu</option>
                </select>
              ) : (
                <div className="mt-2 text-sm text-medx-navy">
                  {language === "en"
                    ? "English"
                    : language === "hi"
                    ? "Hindi"
                    : language === "te"
                    ? "Telugu"
                    : language === "ur"
                    ? "Urdu"
                    : language}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Doctor provider section (only if doctor) */}
        {userDoc.role === "doctor" && (
          <SectionCard
            title="Provider details"
            icon={<ShieldCheck className="h-4 w-4 text-medx-teal" />}
            editing={editProvider}
            setEditing={(v) => {
              endAllEdits();
              setEditProvider(v);
            }}
            saving={saving}
            onSave={() => saveSection("provider")}
            onCancel={() => cancelSection("provider")}
            note="Verification status and registration number are locked."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Verification status" value={userDoc.provider?.verificationStatus ?? "pending"} />
              <ReadOnlyField label="Registration no." value={userDoc.provider?.registrationNumber ?? "—"} />
              <EditableField
                label="Speciality"
                value={pSpeciality}
                setValue={setPSpeciality}
                placeholder="e.g., Cardiology"
                editable={editProvider}
              />
              <EditableField
                label="Clinic / Hospital"
                value={pClinic}
                setValue={setPClinic}
                placeholder="Clinic name"
                editable={editProvider}
              />
              <EditableField label="City" value={pCity} setValue={setPCity} placeholder="City" editable={editProvider} />
              <EditableField
                label="Council / State"
                value={pCouncil}
                setValue={setPCouncil}
                placeholder="Council/State"
                editable={editProvider}
              />
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function SectionCard(props: {
  title: string;
  icon: React.ReactNode;
  note?: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const { title, icon, note, editing, setEditing, saving, onSave, onCancel, children } = props;

  return (
    <div className="mt-8 rounded-3xl border border-border bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-medx-navy">
            {icon}
            {title}
          </div>
          {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
        </div>

        <div className="flex gap-2">
          {!editing ? (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditing(true)}
              disabled={saving}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                className="rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90"
                onClick={onSave}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </Button>

              <Button variant="outline" className="rounded-xl" onClick={onCancel} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="text-xs font-semibold text-medx-navy/70">{label}</div>
      <div className="mt-2 text-sm text-medx-navy">{value || "—"}</div>
    </div>
  );
}

function EditableField(props: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  placeholder?: string;
  editable: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const { label, value, setValue, placeholder, editable, inputMode } = props;

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="text-xs font-semibold text-medx-navy/70">{label}</div>
      {editable ? (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="mt-2 h-11 rounded-xl"
        />
      ) : (
        <div className="mt-2 text-sm text-medx-navy">{value || "—"}</div>
      )}
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  setChecked: (v: boolean) => void;
  editable: boolean;
  disabled?: boolean;
}) {
  const { label, checked, setChecked, editable, disabled } = props;

  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <span className="text-sm text-medx-navy">{label}</span>

      <input
        type="checkbox"
        className="h-4 w-4 accent-medx-teal"
        checked={checked}
        disabled={!editable || disabled}
        onChange={(e) => setChecked(e.target.checked)}
      />
    </label>
  );
}
