import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "frontend/data");
const DATA_FILE = path.join(DATA_DIR, "payments.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

export async function POST(request: Request) {
  ensureDataFile();
  const body = await request.json();
  const { amount, merchant } = body;
  if (!amount || !merchant) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const paymentId = uuidv4();
  const depositAddress = process.env.MVP_DEPOSIT_ADDRESS || "GCF6EXAMPLEDEMOADDRESSFORUSDC3";
  const memo = paymentId;

  const record = { id: paymentId, amount, merchant, status: "PENDING", depositAddress, memo, createdAt: Date.now() };
  const existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  existing.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));

  // NOTE: For Option B (on-chain create at creation time) you will need to:
  // - deploy the payment_registry contract and set PAYMENT_REGISTRY_CONTRACT_ID env var
  // - have SOROBAN_SOURCE and SOROBAN_RPC_URL set
  // - call soroban-cli or a Soroban JS SDK here to invoke contract.create_payment(...)
  //
  // That logic is not implemented automatically here to avoid shelling out from this demo script.
  return NextResponse.json({ paymentId, depositAddress, memo, amount });
}
