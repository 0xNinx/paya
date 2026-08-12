// simple watcher that can be run with `node frontend/watcher.js` in dev
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.resolve(process.cwd(), 'frontend/data/payments.json')

async function check() {
  if (!fs.existsSync(DATA_FILE)) return
  const payments = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  // In a real watcher we would call soroban RPC or horizon to find txs for depositAddress + memo
  // For demo: we accept a file update that sets status to PAID
  for (const p of payments) {
    if (p.status === 'PENDING' && p.manualMarkPaid === true) {
      p.status = 'PAID'
      p.txHash = 'DEMO_TX_HASH'
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(payments, null, 2))
}

setInterval(check, 5000)
