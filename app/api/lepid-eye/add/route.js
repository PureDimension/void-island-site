import { NextResponse } from "next/server";
import { addLepidEyeRecord, verifyLepidEyeCreatorToken } from "@/lib/server/lepidEye";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!verifyLepidEyeCreatorToken(body.key ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = addLepidEyeRecord({
      entity: body.entity,
      payload: body.payload ?? {}
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add record" },
      { status: 400 }
    );
  }
}
