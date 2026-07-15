import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { importWearableCsv } from "@/lib/wearables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wearables/import  (multipart form: file=<csv>, source?=csv)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const source = (form.get("source") as string)?.trim() || "csv";

    // Duck-type the upload instead of `instanceof File` — the `File` global
    // isn't defined in every Node version that runs the Next server.
    if (!file || typeof file === "string" || typeof (file as Blob).text !== "function") {
      return NextResponse.json(
        { error: "No CSV file uploaded (field 'file')." },
        { status: 400 }
      );
    }

    const text = await (file as Blob).text();
    const summary = importWearableCsv(getDb(), text, source);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
