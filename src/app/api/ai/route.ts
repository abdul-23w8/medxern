import { NextResponse } from "next/server";

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

export async function POST(req: Request) {
  try {
    const { message, location } = await req.json();

    // 1. Ask AI what the intent is
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a medical assistant. Decide if the user is asking for nearby medical services or general medical advice. If location-based, return JSON with {type:'location', specialty}. Else {type:'medical'}",
          },
          { role: "user", content: message },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const decision = aiData.choices[0].message.content;

    // 2. If location-based → Google Places
    if (decision.includes("location")) {
      const mapsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=5000&type=hospital&key=${GOOGLE_MAPS_KEY}`
      );

      const places = await mapsRes.json();

      return NextResponse.json({
        type: "places",
        results: places.results,
      });
    }

    // 3. Otherwise return AI medical answer
    return NextResponse.json({
      type: "text",
      answer: aiData.choices[0].message.content,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "AI service failed" },
      { status: 500 }
    );
  }
}
