import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve(process.cwd(), "frontend/data/payments.json");

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!fs.existsSync(DATA_FILE)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const rec = existing.find((r: any) => r.id === id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(rec);
}
