'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, DollarSign, AlertCircle } from 'lucide-react';

interface PaymentSplit {
  id: string;
  splitId: string;
  paymentId: string;
  merchantAddress: string;
  totalAmount: number;
  currency: string;
  splitType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'MILESTONE';
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'CANCELLED';
  recipients: Array<{
    address: string;
    percentage?: number;
    fixedAmount?: number;
    splitType: string;
    distributedAmount: number;
    distributionStatus: string;
  }>;
  retryCount: number;
  maxRetries: number;
  executedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface SplitAnalytics {
  totalSplits: number;
  completedSplits: number;
  failedSplits: number;
  totalAmount: number;
  averageSplitAmount: number;
  statusBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
}

export default function PaymentSplitsPage() {
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [analytics, setAnalytics] = useState<SplitAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSplit, setSelectedSplit] = useState<PaymentSplit | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    splitType: '',
    startDate: '',
    endDate: '',
  });

  const [newRecipients, setNewRecipients] = useState<Array<{ address: string; percentage?: number; fixedAmount?: number }>>([
    { address: '', percentage: 50 },
    { address: '', percentage: 50 },
  ]);

  useEffect(() => {
    fetchSplits();
    fetchAnalytics();
  }, [filters]);

  const fetchSplits = async () => {
    try {
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== '') as [string, string][]
      );
      const response = await fetch(`/api/payment-splits?${queryParams}`);
      const data = await response.json();
      setSplits(data || []);
    } catch (error) {
      console.error('Failed to fetch splits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/payment-splits/analytics/summary?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleCreateSplit = async (formData: FormData) => {
    try {
      const response = await fetch('/api/payment-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: formData.get('paymentId'),
          merchantAddress: formData.get('merchantAddress'),
          totalAmount: formData.get('totalAmount'),
          currency: formData.get('currency'),
          splitType: formData.get('splitType'),
          recipients: newRecipients,
        }),
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        fetchSplits();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to create split:', error);
    }
  };

  const handleExecuteSplit = async (splitId: string) => {
    try {
      const response = await fetch(`/api/payment-splits/${splitId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executor: 'current_user' }),
      });

      if (response.ok) {
        fetchSplits();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to execute split:', error);
    }
  };

  const handleCancelSplit = async (splitId: string) => {
    try {
      const response = await fetch(`/api/payment-splits/${splitId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchSplits();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to cancel split:', error);
    }
  };

  const handleRetrySplit = async (splitId: string) => {
    try {
      const response = await fetch(`/api/payment-splits/${splitId}/retry`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchSplits();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to retry split:', error);
    }
  };

  const addRecipient = () => {
    setNewRecipients([...newRecipients, { address: '', percentage: 0 }]);
  };

  const updateRecipient = (index: number, field: string, value: any) => {
    const updated = [...newRecipients];
    updated[index] = { ...updated[index], [field]: value };
    setNewRecipients(updated);
  };

  const removeRecipient = (index: number) => {
    if (newRecipients.length > 1) {
      setNewRecipients(newRecipients.filter((_, i) => i !== index));
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      EXECUTING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
| PARTIALLY_COMPLETED: 'bg-orange-100 text-orange-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const calculateTotalPercentage = () => {
    return newRecipients.reduce((sum, r) => sum + (r.percentage || 0), 0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Splits</h1>
          <p className="text-muted-foreground">Manage payment distributions across multiple recipients</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Split
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Payment Split</DialogTitle>
              <DialogDescription>
                Split a payment across multiple recipients
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateSplit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentId">Payment ID</Label>
                  <Input id="paymentId" name="paymentId" required />
                </div>
                <div>
                  <Label htmlFor="merchantAddress">Merchant Address</Label>
                  <Input id="merchantAddress" name="merchantAddress" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  <Input id="totalAmount" name="totalAmount" type="number" step="0.01" required />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" name="currency" defaultValue="USDC" required />
                </div>
              </div>
              <div>
                <Label htmlFor="splitType">Split Type</Label>
                <Select name="splitType" defaultValue="PERCENTAGE">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage Based</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                    <SelectItem value="MILESTONE">Milestone Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Recipients</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addRecipient}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Recipient
                  </Button>
                </div>
                <div className="space-y-2">
                  {newRecipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="Recipient Address"
                        value={recipient.address}
                        onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="%"
                        value={recipient.percentage || ''}
                        onChange={(e) => updateRecipient(index, 'percentage', parseFloat(e.target.value))}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeRecipient(index)}
                        disabled={newRecipients.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-sm">
                  <span className={calculateTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}>
                    Total: {calculateTotalPercentage()}%
                  </span>
                  {calculateTotalPercentage() !== 100 && ' (must equal 100%)'}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={calculateTotalPercentage() !== 100}>
                Create Split
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="splits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="splits">Splits</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="splits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="EXECUTING">Executing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="PARTIALLY_COMPLETED">Partially Completed</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Split Type</Label>
                  <Select value={filters.splitType} onValueChange={(v) => setFilters({ ...filters, splitType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                      <SelectItem value="MILESTONE">Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">Loading splits...</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4">Split ID</th>
                      <th className="text-left p-4">Payment ID</th>
                      <th className="text-left p-4">Amount</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Recipients</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Created</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splits.map((split) => (
                      <tr key={split.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-mono text-sm">{split.splitId}</td>
                        <td className="p-4 font-mono text-sm">{split.paymentId}</td>
                        <td className="p-4">{split.currency} {split.totalAmount.toFixed(2)}</td>
                        <td className="p-4">{split.splitType.replace(/_/g, ' ')}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{split.recipients.length}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={getStatusColor(split.status)}>
                            {split.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-4">{new Date(split.createdAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {split.status === 'PENDING' && (
                              <Button size="sm" onClick={() => handleExecuteSplit(split.splitId)}>
                                Execute
                              </Button>
                            )}
                            {split.status === 'FAILED' && (
                              <Button size="sm" variant="outline" onClick={() => handleRetrySplit(split.splitId)}>
                                Retry
                              </Button>
                            )}
                            {(split.status === 'PENDING' || split.status === 'FAILED') && (
                              <Button size="sm" variant="destructive" onClick={() => handleCancelSplit(split.splitId)}>
                                Cancel
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setSelectedSplit(split)}>
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Splits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.totalSplits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{analytics.completedSplits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{analytics.failedSplits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${analytics.totalAmount.toFixed(2)}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {analytics && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span>{status.replace(/_/g, ' ')}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.typeBreakdown).map(([type, count]) => (
                      <div key={type} className="flex justify-between">
                        <span>{type.replace(/_/g, ' ')}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedSplit && (
        <Dialog open={!!selectedSplit} onOpenChange={() => setSelectedSplit(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Split Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Split ID</Label>
                  <div className="font-mono text-sm">{selectedSplit.splitId}</div>
                </div>
                <div>
                  <Label>Payment ID</Label>
                  <div className="font-mono text-sm">{selectedSplit.paymentId}</div>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <div className="font-bold">{selectedSplit.currency} {selectedSplit.totalAmount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedSplit.status)}>
                    {selectedSplit.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              
              <div>
                <Label>Recipients</Label>
                <div className="space-y-2 mt-2">
                  {selectedSplit.recipients.map((recipient, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-sm">{recipient.address}</div>
                          <div className="text-sm text-muted-foreground">
                            {recipient.percentage ? `${recipient.percentage}%` : `${recipient.fixedAmount} fixed`}
                          </div>
                        </div>
                        <Badge className={getStatusColor(recipient.distributionStatus)}>
                          {recipient.distributionStatus.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm">
                        Distributed: {recipient.distributedAmount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Retry Count</Label>
                  <div>{selectedSplit.retryCount} / {selectedSplit.maxRetries}</div>
                </div>
                <div>
                  <Label>Created</Label>
                  <div>{new Date(selectedSplit.createdAt).toLocaleString()}</div>
                </div>
                {selectedSplit.executedAt && (
                  <div>
                    <Label>Executed</Label>
                    <div>{new Date(selectedSplit.executedAt).toLocaleString()}</div>
                  </div>
                )}
                {selectedSplit.completedAt && (
                  <div>
                    <Label>Completed</Label>
                    <div>{new Date(selectedSplit.completedAt).toLocaleString()}</div>
                  </div>
                )}
              </div>

              {selectedSplit.status === 'FAILED' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold">Split Failed</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    Some distributions failed. You can retry the split or cancel it.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
