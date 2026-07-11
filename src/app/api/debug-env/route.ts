// TEMPORARY — delete this file once the GEMINI_API_KEY issue is resolved.
// src/app/api/debug-env/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  return NextResponse.json({
    hasKey: Boolean(key),
    // Only reveals length + first/last couple chars — enough to confirm
    // it's the right value without exposing the actual key.
    preview: key ? `${key.slice(0, 4)}...${key.slice(-4)} (length ${key.length})` : null,
  });
}
