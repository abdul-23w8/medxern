import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY; // ✅ server var
  if (!key) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const radius = 8000; // 8km
  const url =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
    `?location=${lat},${lng}` +
    `&radius=${radius}` +
    `&type=hospital` +
    `&key=${key}`;

  const r = await fetch(url);
  const data = await r.json();

  return NextResponse.json(data);
}
