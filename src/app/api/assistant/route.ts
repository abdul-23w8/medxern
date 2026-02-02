// src/app/api/assistant/route.ts
import { NextResponse } from "next/server";
import "server-only";

import { adminDb } from "@/lib/firebaseAdmin";

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

type PlaceResult = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  openNow?: boolean;
};

type GateLabel = "ALLOW_MEDICAL" | "REJECT_NON_MEDICAL";

type PlacesStatus = "OK" | "NONE" | "FAILED";

type AssistantMeta = {
  places?: PlaceResult[];
  provider?: string;
  placesStatus?: PlacesStatus;
  gate?: { label: GateLabel; reason?: string };
};

/** ✅ Typed helper */
function msg(role: ChatRole, content: string): ChatMessage {
  return { role, content };
}

/** ✅ Strict role guard */
function isChatRole(x: unknown): x is ChatRole {
  return x === "system" || x === "user" || x === "assistant";
}

/** -------------------------------
 * Intent helpers
 * ------------------------------*/

function wantsNearbyPlaces(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("nearby") ||
    t.includes("near me") ||
    t.includes("closest") ||
    t.includes("nearest") ||
    t.includes("hospital") ||
    t.includes("clinic") ||
    t.includes("pharmacy") ||
    t.includes("doctor") ||
    t.includes("urgent care") ||
    t.includes("emergency") ||
    t.includes("ambulance") ||
    t.includes("maps") ||
    t.includes("directions") ||
    t.includes("location") ||
    t.includes("er")
  );
}

function isObviouslyNonMedical(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("recipe") ||
    t.includes("cook") ||
    t.includes("butter chicken") ||
    t.includes("code") ||
    t.includes("program") ||
    t.includes("javascript") ||
    t.includes("nextjs") ||
    t.includes("startup") ||
    t.includes("business") ||
    t.includes("joke") ||
    t.includes("meme")
  );
}

/** ✅ Allow-list for clearly medical content */
function isClearlyMedical(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("broke") ||
    t.includes("broken") ||
    t.includes("fracture") ||
    t.includes("fractured") ||
    t.includes("sprain") ||
    t.includes("disloc") ||
    t.includes("bleed") ||
    t.includes("burn") ||
    t.includes("cut") ||
    t.includes("wound") ||
    t.includes("shot") ||
    t.includes("gun") ||
    t.includes("stab") ||
    t.includes("pain") ||
    t.includes("hurt") ||
    t.includes("swelling") ||
    t.includes("fever") ||
    t.includes("cough") ||
    t.includes("vomit") ||
    t.includes("nausea") ||
    t.includes("dizzy") ||
    t.includes("faint") ||
    t.includes("headache") ||
    t.includes("breath") ||
    t.includes("chest") ||
    t.includes("allerg") ||
    t.includes("medicine") ||
    t.includes("meds") ||
    t.includes("tablet") ||
    t.includes("dose") ||
    t.includes("injury")
  );
}

function seemsUrgent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("shot") ||
    t.includes("gun") ||
    t.includes("stab") ||
    t.includes("severe") ||
    t.includes("very bad") ||
    t.includes("can't breathe") ||
    t.includes("trouble breathing") ||
    t.includes("chest pain") ||
    t.includes("stroke") ||
    t.includes("unconscious") ||
    t.includes("seizure") ||
    t.includes("heavy bleeding") ||
    t.includes("fracture") ||
    t.includes("broken") ||
    t.includes("fractured") ||
    t.includes("deform") ||
    t.includes("blue") ||
    t.includes("numb")
  );
}

/** Detect when message looks like a location string (e.g., "tolichowki") */
function looksLikeLocationText(message: string) {
  const t = message.trim();
  if (t.length < 3 || t.length > 60) return false;
  // not medical, not obviously non-medical → treat as location/area
  if (isClearlyMedical(t) || isObviouslyNonMedical(t)) return false;
  // avoid “ok location??” etc; those should trigger GPS prompt
  if (t.toLowerCase().includes("location")) return false;
  return true;
}

/** -------------------------------
 * Provider selection (rule-based)
 * ------------------------------*/

function pickProvider(message: string): { provider: string; includedTypes: string[] } {
  const t = message.toLowerCase();

  if (
    t.includes("shot") ||
    t.includes("gun") ||
    t.includes("stab") ||
    t.includes("heavy bleeding") ||
    t.includes("unconscious") ||
    t.includes("seizure") ||
    t.includes("stroke") ||
    t.includes("can't breathe") ||
    t.includes("trouble breathing") ||
    t.includes("chest pain")
  ) {
    return { provider: "Emergency / Trauma", includedTypes: ["hospital"] };
  }

  if (t.includes("fracture") || t.includes("broken") || t.includes("broke") || t.includes("disloc")) {
    return { provider: "Orthopedics", includedTypes: ["doctor", "hospital"] };
  }

  if (t.includes("pharmacy") || t.includes("medicine") || t.includes("meds")) {
    return { provider: "Pharmacy", includedTypes: ["pharmacy"] };
  }

  return { provider: "Nearby care", includedTypes: ["doctor", "hospital", "pharmacy"] };
}

/** -------------------------------
 * Firestore Admin: store/load location
 * ------------------------------*/

async function saveLastKnownLocation(shortId: string, loc: { lat: number; lng: number }) {
  await adminDb()
    .collection("users")
    .doc(shortId)
    .set(
      {
        lastKnownLocation: {
          lat: loc.lat,
          lng: loc.lng,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );
}

async function loadLastKnownLocation(shortId: string): Promise<{ lat: number; lng: number } | null> {
  const snap = await adminDb().collection("users").doc(shortId).get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = snap.data() as any;
  const loc = data?.lastKnownLocation;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  return { lat: loc.lat, lng: loc.lng };
}

/** -------------------------------
 * Google Geocode: city/area -> lat/lng
 * ------------------------------*/

async function geocodeArea(text: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(text)}&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const loc = data?.results?.[0]?.geometry?.location;

  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  return { lat: loc.lat, lng: loc.lng };
}

/** -------------------------------
 * Google Places (New): nearby search
 * ------------------------------*/

async function placesNearby(params: {
  lat: number;
  lng: number;
  includedTypes: string[];
}): Promise<{ status: PlacesStatus; places: PlaceResult[] }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { status: "FAILED", places: [] };

  const url = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    includedTypes: params.includedTypes,
    maxResultCount: 8,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: 12000.0,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.currentOpeningHours",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("placesNearby failed:", res.status, errText);
    return { status: "FAILED", places: [] };
  }

  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      googleMapsUri?: string;
      currentOpeningHours?: { openNow?: boolean };
    }>;
  };

  const places = (data.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    phone: p.internationalPhoneNumber,
    website: p.websiteUri,
    googleMapsUri: p.googleMapsUri,
    openNow: p.currentOpeningHours?.openNow,
  }));

  return { status: places.length ? "OK" : "NONE", places };
}

/** -------------------------------
 * OpenAI call (Chat Completions)
 * ------------------------------*/

async function callOpenAI(opts: {
  openaiKey: string;
  model: string;
  input: ChatMessage[];
}): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.input,
      temperature: 0.2,
    }),
  });

  if (!resp.ok) throw new Error("openai_failed");

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** -------------------------------
 * Context-aware medical gate (LLM)
 * ------------------------------*/

async function gateMedicalWithContext(opts: {
  openaiKey: string;
  model: string;
  message: string;
  history: ChatMessage[];
  threadMedicalContext?: boolean;
}): Promise<{ label: GateLabel; reason?: string }> {
  const { openaiKey, model, message, history, threadMedicalContext } = opts;

  if (threadMedicalContext && isObviouslyNonMedical(message)) {
    return { label: "REJECT_NON_MEDICAL", reason: "topic_switch_in_medical_thread" };
  }

  const ctx = history.slice(-12);
  const transcript = ctx
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")
    .slice(0, 6000);

  const gateSystem = `
You are a strict classifier for a medical-only assistant.

Output ONLY one label:
- ALLOW_MEDICAL
- REJECT_NON_MEDICAL
`.trim();

  try {
    const out = await callOpenAI({
      openaiKey,
      model,
      input: [
        msg("system", gateSystem),
        msg("system", `Thread medical context flag: ${threadMedicalContext ? "true" : "false"}`),
        msg("system", `Conversation so far:\n${transcript || "(no prior messages)"}`),
        msg("user", `New user message:\n${message}`),
      ],
    });

    const upper = out.toUpperCase();
    if (upper.includes("REJECT_NON_MEDICAL")) return { label: "REJECT_NON_MEDICAL" };
    return { label: "ALLOW_MEDICAL" };
  } catch {
    return { label: "ALLOW_MEDICAL", reason: "gate_failed_open" };
  }
}

/** -------------------------------
 * Route handler
 * ------------------------------*/

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      shortId?: string;
      chatId?: string;
      message: string;
      history?: Array<{ role: unknown; content: unknown }>;
      location?: { lat: number; lng: number } | null;
      threadMedicalContext?: boolean;
    };

    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ reply: "Please type your health question." }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ reply: "Server is missing OPENAI_API_KEY." }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const safeHistory: ChatMessage[] = (body.history ?? [])
      .filter((m) => m && typeof m === "object")
      .map((m) => {
        const mm = m as { role?: unknown; content?: unknown };
        if (!isChatRole(mm.role)) return null;
        if (typeof mm.content !== "string") return null;
        return msg(mm.role, mm.content);
      })
      .filter(Boolean)
      .slice(-12) as ChatMessage[];

    // Early reject only when fresh thread + clearly non-medical
    if (!body.threadMedicalContext && safeHistory.length === 0 && isObviouslyNonMedical(message)) {
      return NextResponse.json({
        reply:
          "I can only help with medical or health-related questions. Please ask about symptoms, injuries, medications, test results, or nearby care.",
        meta: { gate: { label: "REJECT_NON_MEDICAL", reason: "local_non_medical_hint" } },
      });
    }

    const allowDirect =
      body.threadMedicalContext === true ||
      isClearlyMedical(message) ||
      (safeHistory.length > 0 && message.length <= 32 && !isObviouslyNonMedical(message));

    let gate: { label: GateLabel; reason?: string } = { label: "ALLOW_MEDICAL", reason: "allow_direct" };

    if (!allowDirect) {
      gate = await gateMedicalWithContext({
        openaiKey,
        model,
        message,
        history: safeHistory,
        threadMedicalContext: body.threadMedicalContext,
      });
    }

    if (gate.label === "REJECT_NON_MEDICAL") {
      return NextResponse.json({
        reply:
          "I can only help with medical or health-related topics. If you meant a health concern, tell me symptoms/injury details, duration, age, and any medications/allergies.",
        meta: { gate },
      });
    }

    const needsNearby = wantsNearbyPlaces(message) || seemsUrgent(message);
    const providerPick = pickProvider(message);

    // ---- Location persistence
    let loc: { lat: number; lng: number } | null = body.location ?? null;

    // Save GPS if provided
    if (body.shortId && loc) {
      await saveLastKnownLocation(body.shortId, loc).catch(() => {});
    }

    // Load last-known if missing
    if (!loc && body.shortId) {
      loc = await loadLastKnownLocation(body.shortId).catch(() => null);
    }

    // If still missing AND user typed a location string like "tolichowki", geocode it
    if (!loc && needsNearby && looksLikeLocationText(message)) {
      const geo = await geocodeArea(message).catch(() => null);
      if (geo) {
        loc = geo;
        if (body.shortId) await saveLastKnownLocation(body.shortId, geo).catch(() => {});
      }
    }

    // Fetch places (verified)
    let places: PlaceResult[] = [];
    let placesStatus: PlacesStatus = "NONE";

    if (needsNearby && loc) {
      const out = await placesNearby({
        lat: loc.lat,
        lng: loc.lng,
        includedTypes: providerPick.includedTypes,
      });
      places = out.places;
      placesStatus = out.status;
    } else if (needsNearby && !loc) {
      placesStatus = "NONE";
    }

    const system = `
You are MEDXERN Assistant.

You must respond ONLY to medical/health-related questions.

Verified facilities rule (CRITICAL):
- ONLY mention specific facility names (hospitals/clinics/pharmacies) if they are provided in the system message "Nearby care options (VERIFIED)".
- If no verified facilities are provided, DO NOT guess or invent names. Ask for location permission or city and say you cannot fetch verified results right now.

Safety:
- You are NOT a doctor. Do NOT diagnose.
- Provide general first aid and urgency guidance.
- Ask 1–3 focused follow-up questions if needed.
- If emergency red flags exist, advise emergency services immediately.

Style:
- Calm, concise, practical steps.
- Use bullets for instructions.
`.trim();

    const verifiedPlacesBlock =
      places.length > 0
        ? `Provider focus: ${providerPick.provider}\nNearby care options (VERIFIED):\n${places
            .map((p, i) => {
              const rating = typeof p.rating === "number" ? ` (⭐ ${p.rating})` : "";
              const open = typeof p.openNow === "boolean" ? (p.openNow ? " • Open now" : " • Closed now") : "";
              return `${i + 1}. ${p.name}${rating}${open} — ${p.address ?? "Address unavailable"}`;
            })
            .join("\n")}`
        : "";

    const locationMissingHint =
      needsNearby && !loc
        ? `Note: I can show verified nearby ${providerPick.provider} options if you enable location, or tell me your city/area.`
        : "";

    const placesFailedHint =
      needsNearby && loc && placesStatus !== "OK"
        ? `Note: I could not fetch verified nearby facilities right now (Maps lookup failed/empty). Please try again or broaden the radius.`
        : "";

    const input: ChatMessage[] = [
      msg("system", system),
      ...safeHistory,
      ...(verifiedPlacesBlock ? [msg("system", verifiedPlacesBlock)] : []),
      ...(locationMissingHint ? [msg("system", locationMissingHint)] : []),
      ...(placesFailedHint ? [msg("system", placesFailedHint)] : []),
      msg("user", message),
    ];

    let reply = "";
    try {
      reply = await callOpenAI({ openaiKey, model, input });
    } catch {
      return NextResponse.json({ reply: "Assistant request failed." }, { status: 500 });
    }

    const meta: AssistantMeta = {
      provider: providerPick.provider,
      placesStatus,
      ...(places.length ? { places } : {}),
      gate,
    };

    return NextResponse.json({
      reply:
        reply ||
        "I can help with medical questions. Please share your symptoms or injury details (when it started, severity, age, and any meds/allergies).",
      meta,
    });
  } catch {
    return NextResponse.json({ reply: "Bad request." }, { status: 400 });
  }
}
