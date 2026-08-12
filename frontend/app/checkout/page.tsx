'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function CheckoutPage() {
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('demo-merchant')
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [amountError, setAmountError] = useState('')

  const validateAmount = (value: string) => {
    const numValue = parseFloat(value)
    if (!value || isNaN(numValue)) {
      setAmountError('Please enter a valid amount')
      return false
    }
    if (numValue <= 0) {
      setAmountError('Amount must be greater than 0')
      return false
    }
    if (numValue > 1000000) {
      setAmountError('Maximum amount is 1,000,000')
      return false
    }
    setAmountError('')
    return true
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAmount(value)
    if (value) validateAmount(value)
  }

  async function createPayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (!validateAmount(amount)) {
      return
    }

    if (!merchant || merchant.length < 3) {
      setError('Merchant name must be at least 3 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/create-payment', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, merchant }) 
      })
      const json = await res.json()
      
      if (!res.ok) {
        setError(json.message || 'Failed to create payment')
        return
      }
      
      setResponse(json)
      setAmount('')
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-2 text-gray-600">Complete your payment securely</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={createPayment} className="space-y-6">
            <div>
              <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 mb-2">
                Merchant
              </label>
              <input
                id="merchant"
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter merchant name"
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={handleAmountChange}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    amountError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {amountError && (
                <p className="mt-1 text-sm text-red-600">{amountError}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : null}
              {loading ? 'Processing...' : 'Create Payment'}
            </button>
          </form>

          {response && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-semibold text-green-900">Payment Created Successfully</h2>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID:</span>
                  <span className="font-mono text-gray-900">{response.paymentId.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium text-gray-900">${response.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                    {response.status}
                  </span>
                </div>
                <div className="pt-3 border-t border-green-200">
                  <p className="text-gray-600 mb-1">Deposit Address:</p>
                  <p className="font-mono text-xs bg-white p-2 rounded border break-all">{response.depositAddress}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Memo (required):</p>
                  <p className="font-mono text-sm bg-white p-2 rounded border">{response.memo}</p>
                </div>
              </div>

              <Link href={`/payment/${response.paymentId}`} className="mt-6 block">
                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                  View Payment Status
                </button>
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
