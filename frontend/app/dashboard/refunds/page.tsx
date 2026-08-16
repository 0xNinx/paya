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

interface Refund {
  id: string;
  refundId: string;
  paymentId: string;
  customerId: string;
  originalAmount: number;
  refundAmount: number;
  refundType: 'FULL' | 'PARTIAL';
  reason: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  feeAmount: number;
  netAmount: number;
  createdAt: string;
  processedAt?: string;
  transactionHash?: string;
}

interface RefundAnalytics {
  totalRefunds: number;
  totalRefundAmount: number;
  totalFees: number;
  statusBreakdown: Record<string, number>;
  reasonBreakdown: Record<string, number>;
  averageRefundAmount: number;
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [analytics, setAnalytics] = useState<RefundAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    reason: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchRefunds();
    fetchAnalytics();
  }, [filters]);

  const fetchRefunds = async () => {
    try {
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== '') as [string, string][]
      );
      const response = await fetch(`/api/refunds?${queryParams}`);
      const data = await response.json();
      setRefunds(data.data || []);
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/analytics/refunds?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleCreateRefund = async (formData: FormData) => {
    try {
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: formData.get('paymentId'),
          refundType: formData.get('refundType'),
          partialAmount: formData.get('partialAmount'),
          reason: formData.get('reason'),
          reasonDescription: formData.get('reasonDescription'),
        }),
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        fetchRefunds();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to create refund:', error);
    }
  };

  const handleProcessRefund = async (refundId: string) => {
    try {
      const response = await fetch(`/api/refunds/${refundId}/process`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchRefunds();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to process refund:', error);
    }
  };

  const handleReverseRefund = async (refundId: string) => {
    try {
      const response = await fetch(`/api/refunds/${refundId}/reverse`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchRefunds();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to reverse refund:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      REVERSED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Refund Management</h1>
          <p className="text-muted-foreground">Process and track customer refunds</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Refund</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Refund</DialogTitle>
              <DialogDescription>
                Process a refund for a customer payment
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateRefund} className="space-y-4">
              <div>
                <Label htmlFor="paymentId">Payment ID</Label>
                <Input id="paymentId" name="paymentId" required />
              </div>
              <div>
                <Label htmlFor="refundType">Refund Type</Label>
                <Select name="refundType" defaultValue="FULL">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full Refund</SelectItem>
                    <SelectItem value="PARTIAL">Partial Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="partialAmount">Partial Amount (if applicable)</Label>
                <Input id="partialAmount" name="partialAmount" type="number" step="0.01" />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Select name="reason" required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER_REQUEST">Customer Request</SelectItem>
                    <SelectItem value="PRODUCT_NOT_RECEIVED">Product Not Received</SelectItem>
                    <SelectItem value="PRODUCT_DEFECTIVE">Product Defective</SelectItem>
                    <SelectItem value="WRONG_ITEM">Wrong Item</SelectItem>
                    <SelectItem value="DUPLICATE_PAYMENT">Duplicate Payment</SelectItem>
                    <SelectItem value="FRAUDULENT">Fraudulent</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reasonDescription">Description</Label>
                <Textarea id="reasonDescription" name="reasonDescription" />
              </div>
              <Button type="submit" className="w-full">Create Refund</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="refunds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="refunds" className="space-y-4">
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
                      <SelectItem value="PROCESSING">Processing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="REVERSED">Reversed</SelectItem>
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
                <div className="p-8 text-center">Loading refunds...</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4">Refund ID</th>
                      <th className="text-left p-4">Payment ID</th>
                      <th className="text-left p-4">Amount</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Reason</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Created</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.map((refund) => (
                      <tr key={refund.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-mono text-sm">{refund.refundId}</td>
                        <td className="p-4 font-mono text-sm">{refund.paymentId}</td>
                        <td className="p-4">${refund.refundAmount.toFixed(2)}</td>
                        <td className="p-4">{refund.refundType}</td>
                        <td className="p-4">{refund.reason.replace(/_/g, ' ')}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(refund.status)}>
                            {refund.status}
                          </Badge>
                        </td>
                        <td className="p-4">{new Date(refund.createdAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {refund.status === 'PENDING' && (
                              <Button
                                size="sm"
                                onClick={() => handleProcessRefund(refund.refundId)}
                              >
                                Process
                              </Button>
                            )}
                            {refund.status === 'COMPLETED' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReverseRefund(refund.refundId)}
                              >
                                Reverse
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRefund(refund)}
                            >
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
                  <CardTitle>Total Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.totalRefunds}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${analytics.totalRefundAmount.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Fees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${analytics.totalFees.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Average Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${analytics.averageRefundAmount.toFixed(2)}</div>
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
                        <span>{status}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Reason Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.reasonBreakdown).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between">
                        <span>{reason.replace(/_/g, ' ')}</span>
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

      {selectedRefund && (
        <Dialog open={!!selectedRefund} onOpenChange={() => setSelectedRefund(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Refund Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Refund ID</Label>
                <div className="font-mono text-sm">{selectedRefund.refundId}</div>
              </div>
              <div>
                <Label>Payment ID</Label>
                <div className="font-mono text-sm">{selectedRefund.paymentId}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Original Amount</Label>
                  <div className="font-bold">${selectedRefund.originalAmount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Refund Amount</Label>
                  <div className="font-bold">${selectedRefund.refundAmount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Fee Amount</Label>
                  <div className="font-bold">${selectedRefund.feeAmount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Net Amount</Label>
                  <div className="font-bold">${selectedRefund.netAmount.toFixed(2)}</div>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Badge className={getStatusColor(selectedRefund.status)}>
                  {selectedRefund.status}
                </Badge>
              </div>
              {selectedRefund.transactionHash && (
                <div>
                  <Label>Transaction Hash</Label>
                  <div className="font-mono text-sm">{selectedRefund.transactionHash}</div>
                </div>
              )}
              <div>
                <Label>Created</Label>
                <div>{new Date(selectedRefund.createdAt).toLocaleString()}</div>
              </div>
              {selectedRefund.processedAt && (
                <div>
                  <Label>Processed</Label>
                  <div>{new Date(selectedRefund.processedAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
