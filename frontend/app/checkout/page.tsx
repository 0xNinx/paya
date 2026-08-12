import Link from 'next/link'
import { useState } from 'react'

export default function CheckoutPage() {
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('demo-merchant')
  const [response, setResponse] = useState<any>(null)

  async function createPayment(e: any) {
    e.preventDefault()
    const res = await fetch('/api/create-payment', { method: 'POST', body: JSON.stringify({ amount, merchant }) })
    const json = await res.json()
    setResponse(json)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Checkout (MVP)</h1>
      <form onSubmit={createPayment} className="space-y-4 mt-4">
        <div>
          <label>Amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="border p-2" />
        </div>
        <div>
          <label>Merchant</label>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className="border p-2" />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2">Create Payment</button>
      </form>

      {response && (
        <div className="mt-6 p-4 border">
          <h2 className="font-semibold">Payment Created</h2>
          <p>ID: {response.paymentId}</p>
          <p>Deposit Address: {response.depositAddress}</p>
          <p>Memo: {response.memo}</p>
          <p>Amount: {response.amount}</p>
          <Link href={`/payment/${response.paymentId}`}><a className="text-blue-600">View Status</a></Link>
        </div>
      )}
    </div>
  )
}
