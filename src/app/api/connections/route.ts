import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.zohoConnection.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(
    rows.map((c) => ({
      id:               c.id,
      organizationId:   c.organizationId,
      organizationName: c.organizationName,
      accessToken:      decrypt(c.accessToken),
      refreshToken:     c.refreshToken ? decrypt(c.refreshToken) : undefined,
      region:           c.region,
      currency:         c.currency,
    }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.organizationId && !body.organizationName) {
    return NextResponse.json({ error: "organizationId or organizationName required" }, { status: 400 });
  }
  if (!body.accessToken) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400 });
  }

  const conn = await db.zohoConnection.create({
    data: {
      organizationId:   body.organizationId   ?? "",
      organizationName: body.organizationName ?? "",
      accessToken:      encrypt(body.accessToken),
      refreshToken:     body.refreshToken ? encrypt(body.refreshToken) : null,
      region:           body.region    ?? ".com",
      currency:         body.currency  ?? "USD",
      createdByEmail:   session.user.email!,
    },
  });

  return NextResponse.json({
    id:               conn.id,
    organizationId:   conn.organizationId,
    organizationName: conn.organizationName,
    accessToken:      body.accessToken,
    refreshToken:     body.refreshToken,
    region:           conn.region,
    currency:         conn.currency,
  });
}
