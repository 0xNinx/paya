import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "frontend/data");
const DATA_FILE = path.join(DATA_DIR, "payments.json");

interface CreatePaymentRequest {
  amount: number | string;
  merchant: string;
}

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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

function validateAmount(amount: number | string): number {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    throw new Error("Invalid amount: must be a number");
  }
  if (numAmount <= 0) {
    throw new Error("Invalid amount: must be greater than 0");
  }
  if (numAmount > 1000000) {
    throw new Error("Invalid amount: maximum amount is 1,000,000");
  }
  return numAmount;
}

function validateMerchant(merchant: string): string {
  if (!merchant || typeof merchant !== "string") {
    throw new Error("Invalid merchant: must be a non-empty string");
  }
  if (merchant.length < 3 || merchant.length > 100) {
    throw new Error("Invalid merchant: must be between 3 and 100 characters");
  }
  return merchant.trim();
}

export async function POST(request: Request) {
  try {
    ensureDataFile();
    
    const body: CreatePaymentRequest = await request.json();
    const { amount, merchant } = body;

    // Validate input
    if (!amount || !merchant) {
      return NextResponse.json(
        { error: "missing_fields", message: "Amount and merchant are required" },
        { status: 400 }
      );
    }

    const validatedAmount = validateAmount(amount);
    const validatedMerchant = validateMerchant(merchant);

    const paymentId = uuidv4();
    const depositAddress = process.env.MVP_DEPOSIT_ADDRESS || "GCF6EXAMPLEDEMOADDRESSFORUSDC3";
    const memo = paymentId;

    const record: PaymentRecord = {
      id: paymentId,
      amount: validatedAmount,
      merchant: validatedMerchant,
      status: "PENDING",
      depositAddress,
      memo,
      createdAt: Date.now(),
    };

    const existing: PaymentRecord[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    existing.push(record);
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));

    // NOTE: For Option B (on-chain create at creation time) you will need to:
    // - deploy the payment_registry contract and set PAYMENT_REGISTRY_CONTRACT_ID env var
    // - have SOROBAN_SOURCE and SOROBAN_RPC_URL set
    // - call soroban-cli or a Soroban JS SDK here to invoke contract.create_payment(...)
    //
    // That logic is not implemented automatically here to avoid shelling out from this demo script.

    return NextResponse.json({
      paymentId,
      depositAddress,
      memo,
      amount: validatedAmount,
      status: "PENDING",
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
