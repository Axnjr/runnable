import { NextResponse } from "next/server";

import { getComponent } from "@/lib/component-store";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const component = await getComponent(id);

    if (!component) {
      return NextResponse.json(
        { error: "Component not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(component);
  } catch {
    return NextResponse.json(
      { error: "Could not load component." },
      { status: 500 },
    );
  }
}
