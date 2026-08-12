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

export async function GET() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return NextResponse.json([]);
    }

    const payments: PaymentRecord[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    
    // Sort by createdAt descending (newest first)
    const sortedPayments = payments.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json(sortedPayments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
