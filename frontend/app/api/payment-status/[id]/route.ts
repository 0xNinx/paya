import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve(process.cwd(), "frontend/data/payments.json");

interface PaymentRecord {
  id: string;
  amount: number;
  merchant: string;
  status: "PENDING" | "PAID" | "FAILED";
  depositAddress: string;
  memo: string;
  createdAt: number;
  updatedAt?: number;
  txHash?: string;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "invalid_id", message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(DATA_FILE)) {
      return NextResponse.json(
        { error: "not_found", message: "Payment not found" },
        { status: 404 }
      );
    }

    const existing: PaymentRecord[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const rec = existing.find((r: PaymentRecord) => r.id === id);

    if (!rec) {
      return NextResponse.json(
        { error: "not_found", message: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rec);
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
