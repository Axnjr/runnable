import { NextRequest, NextResponse } from "next/server";

import { updateComponent } from "@/lib/component-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { source?: string };

    if (!body.source || typeof body.source !== "string") {
      return NextResponse.json(
        { error: "`source` is required and must be a string." },
        { status: 400 },
      );
    }

    const updated = await updateComponent(id, body.source);

    if (!updated) {
      return NextResponse.json(
        { error: "Component not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Could not update component." },
      { status: 500 },
    );
  }
}
