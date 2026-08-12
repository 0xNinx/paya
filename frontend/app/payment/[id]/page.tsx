import { useEffect, useState } from 'react'

export default function PaymentStatusPage({ params }: any) {
  const id = params.id
  const [rec, setRec] = useState<any>(null)

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch(`/api/payment-status/${id}`)
      const json = await res.json()
      setRec(json)
    }
    fetchStatus()
  }, [id])

  if (!rec) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Payment Status</h1>
      <p>ID: {rec.id}</p>
      <p>Amount: {rec.amount}</p>
      <p>Status: {rec.status}</p>
      <p>Deposit Address: {rec.depositAddress}</p>
      <p>Memo: {rec.memo}</p>
    </div>
  )
}
