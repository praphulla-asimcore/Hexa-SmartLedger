import { NextRequest, NextResponse } from "next/server";

const ZOHO_BASES: Record<string, string> = {
  ".com":    "https://www.zohoapis.com",
  ".in":     "https://www.zohoapis.in",
  ".com.au": "https://www.zohoapis.com.au",
  ".eu":     "https://www.zohoapis.eu",
  ".jp":     "https://www.zohoapis.jp",
};

export async function POST(req: NextRequest) {
  try {
    const { accessToken, region, organizationId } = await req.json();
    if (!accessToken) return NextResponse.json({ error: "accessToken is required" }, { status: 400 });

    const base = ZOHO_BASES[region] || ZOHO_BASES[".com"];
    const url = `${base}/books/v3/organizations`;

    const r = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.message || `Zoho error ${r.status}` }, { status: r.status });

    return NextResponse.json({ organizations: data.organizations || [], code: data.code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
