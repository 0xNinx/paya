import Link from 'next/link'
import fs from 'fs'
import path from 'path'

export default function Dashboard() {
  const dataFile = path.resolve(process.cwd(), 'frontend/data/payments.json')
  let payments = []
  if (fs.existsSync(dataFile)) {
    payments = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Merchant Dashboard (MVP)</h1>
      <table className="mt-4 w-full border">
        <thead>
          <tr className="text-left">
            <th>ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td><Link href={`/payment/${p.id}`}><a className="text-blue-600">{p.id}</a></Link></td>
              <td>{p.amount}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
