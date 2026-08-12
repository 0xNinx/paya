'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PaymentRecord {
  id: string
  amount: number
  merchant: string
  status: 'PENDING' | 'PAID' | 'FAILED'
  depositAddress: string
  memo: string
  createdAt: number
  updatedAt?: number
  txHash?: string
}

export default function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('')
  const [rec, setRec] = useState<PaymentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const resolvedParams = await params
      setId(resolvedParams.id)
      fetchStatus(resolvedParams.id)
    }
    init()
  }, [params])

  const fetchStatus = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payment-status/${paymentId}`)
      const json = await res.json()
      
      if (!res.ok) {
        setError(json.message || 'Payment not found')
        return
      }
      
      setRec(json)
    } catch (err) {
      setError('Failed to fetch payment status')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800 border-green-200'
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-200'
      case 'PENDING': default: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'FAILED':
        return (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'PENDING': default:
        return (
          <svg className="w-8 h-8 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-4 text-gray-600">Loading payment status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-center">
            <svg className="w-16 h-16 text-red-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/dashboard">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Return to Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!rec) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Payment not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Payment Status</h1>
              <Link href="/dashboard">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Back to Dashboard
                </button>
              </Link>
            </div>
          </div>

          {/* Status Banner */}
          <div className={`px-6 py-8 border-b ${getStatusColor(rec.status)}`}>
            <div className="flex items-center">
              {getStatusIcon(rec.status)}
              <div className="ml-4">
                <p className="text-sm font-medium uppercase tracking-wide opacity-75">
                  {rec.status}
                </p>
                <p className="text-2xl font-bold">
                  {rec.status === 'PAID' ? 'Payment Complete' : 
                   rec.status === 'FAILED' ? 'Payment Failed' : 
                   'Awaiting Payment'}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Payment ID</span>
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{rec.id}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Merchant</span>
                <span className="font-medium text-gray-900">{rec.merchant}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Amount</span>
                <span className="text-2xl font-bold text-gray-900">${rec.amount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Created</span>
                <span className="text-gray-900">
                  {new Date(rec.createdAt).toLocaleString()}
                </span>
              </div>

              {rec.updatedAt && (
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="text-gray-900">
                    {new Date(rec.updatedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {rec.txHash && (
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Transaction Hash</span>
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{rec.txHash}</span>
                </div>
              )}
            </div>

            {/* Deposit Instructions */}
            {rec.status === 'PENDING' && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Deposit Instructions</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-blue-700 mb-1">Send exactly ${rec.amount.toFixed(2)} USDC to:</p>
                    <p className="font-mono bg-white p-2 rounded border break-all">{rec.depositAddress}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 mb-1">Include this memo (required):</p>
                    <p className="font-mono bg-white p-2 rounded border">{rec.memo}</p>
                  </div>
                  <p className="text-blue-600 text-xs mt-2">
                    ⚠️ Payments without the correct memo may not be credited
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex gap-3">
              <button
                onClick={() => fetchStatus(id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Refresh Status
              </button>
              {rec.status === 'PENDING' && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${rec.depositAddress}\nMemo: ${rec.memo}`)
                    alert('Address and memo copied to clipboard!')
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Copy Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
