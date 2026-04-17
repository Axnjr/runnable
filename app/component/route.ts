import { NextRequest, NextResponse } from "next/server";

import { createComponent } from "@/lib/component-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { source?: string };

    if (!body.source || typeof body.source !== "string") {
      return NextResponse.json(
        { error: "`source` is required and must be a string." },
        { status: 400 },
      );
    }

    const stored = await createComponent(body.source);

    return NextResponse.json(stored, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create component." },
      { status: 500 },
    );
  }
}
