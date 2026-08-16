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
import { Upload } from 'lucide-react';

interface Dispute {
  id: string;
  disputeId: string;
  paymentId: string;
  refundId?: string;
  customerId: string;
  amount: number;
  reason: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'EVIDENCE_REQUIRED' | 'RESPONDING' | 'RESOLVED' | 'CLOSED' | 'WON' | 'LOST';
  evidenceCount: number;
  dueDate: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

interface Evidence {
  id: string;
  evidenceId: string;
  disputeId: string;
  uploadedBy: string;
  uploadedByRole: string;
  evidenceType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  description?: string;
  createdAt: string;
}

interface DisputeAnalytics {
  totalDisputes: number;
  totalDisputedAmount: number;
  statusBreakdown: Record<string, number>;
  wonDisputes: number;
  lostDisputes: number;
  winRate: number;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [analytics, setAnalytics] = useState<DisputeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [selectedDisputeEvidence, setSelectedDisputeEvidence] = useState<Evidence[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchDisputes();
    fetchAnalytics();
  }, [filters]);

  const fetchDisputes = async () => {
    try {
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== '') as [string, string][]
      );
      const response = await fetch(`/api/disputes?${queryParams}`);
      const data = await response.json();
      setDisputes(data.data || []);
    } catch (error) {
      console.error('Failed to fetch disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/analytics/disputes?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchDisputeEvidence = async (disputeId: string) => {
    try {
      const response = await fetch(`/api/disputes/${disputeId}/evidence`);
      const data = await response.json();
      setSelectedDisputeEvidence(data);
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
    }
  };

  const handleCreateDispute = async (formData: FormData) => {
    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: formData.get('paymentId'),
          reason: formData.get('reason'),
          reasonDescription: formData.get('reasonDescription'),
          amount: formData.get('amount'),
        }),
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        fetchDisputes();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to create dispute:', error);
    }
  };

  const handleUpdateDispute = async (disputeId: string, updates: any) => {
    try {
      const response = await fetch(`/api/disputes/${disputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchDisputes();
        fetchAnalytics();
        if (selectedDispute?.disputeId === disputeId) {
          setSelectedDispute(null);
        }
      }
    } catch (error) {
      console.error('Failed to update dispute:', error);
    }
  };

  const handleUploadEvidence = async (formData: FormData) => {
    try {
      const response = await fetch(`/api/disputes/${selectedDispute?.disputeId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selectedDispute?.disputeId,
          evidenceType: formData.get('evidenceType'),
          fileName: formData.get('fileName'),
          fileUrl: formData.get('fileUrl'),
          fileSize: formData.get('fileSize'),
          mimeType: formData.get('mimeType'),
          description: formData.get('description'),
        }),
      });

      if (response.ok) {
        setIsEvidenceDialogOpen(false);
        if (selectedDispute) {
          fetchDisputeEvidence(selectedDispute.disputeId);
          setSelectedDispute({ ...selectedDispute, evidenceCount: selectedDispute.evidenceCount + 1 });
        }
      }
    } catch (error) {
      console.error('Failed to upload evidence:', error);
    }
  };

  const handleViewDispute = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    await fetchDisputeEvidence(dispute.disputeId);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-yellow-100 text-yellow-800',
      UNDER_REVIEW: 'bg-blue-100 text-blue-800',
      EVIDENCE_REQUIRED: 'bg-orange-100 text-orange-800',
      RESPONDING: 'bg-purple-100 text-purple-800',
      RESOLVED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-gray-800',
      WON: 'bg-green-100 text-green-800',
      LOST: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dispute Management</h1>
          <p className="text-muted-foreground">Handle payment disputes and chargebacks</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Dispute</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Dispute</DialogTitle>
              <DialogDescription>
                Open a dispute for a payment transaction
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateDispute} className="space-y-4">
              <div>
                <Label htmlFor="paymentId">Payment ID</Label>
                <Input id="paymentId" name="paymentId" required />
              </div>
              <div>
                <Label htmlFor="amount">Disputed Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Select name="reason" required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCT_NOT_RECEIVED">Product Not Received</SelectItem>
                    <SelectItem value="PRODUCT_NOT_AS_DESCRIBED">Product Not As Described</SelectItem>
                    <SelectItem value="UNAUTHORIZED_TRANSACTION">Unauthorized Transaction</SelectItem>
                    <SelectItem value="DUPLICATE_CHARGE">Duplicate Charge</SelectItem>
                    <SelectItem value="CREDIT_NOT_PROCESSED">Credit Not Processed</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reasonDescription">Description</Label>
                <Textarea id="reasonDescription" name="reasonDescription" />
              </div>
              <Button type="submit" className="w-full">Create Dispute</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="disputes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="disputes" className="space-y-4">
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
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                      <SelectItem value="EVIDENCE_REQUIRED">Evidence Required</SelectItem>
                      <SelectItem value="RESPONDING">Responding</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="WON">Won</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
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
                <div className="p-8 text-center">Loading disputes...</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4">Dispute ID</th>
                      <th className="text-left p-4">Payment ID</th>
                      <th className="text-left p-4">Amount</th>
                      <th className="text-left p-4">Reason</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Evidence</th>
                      <th className="text-left p-4">Due Date</th>
                      <th className="text-left p-4">Created</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map((dispute) => (
                      <tr key={dispute.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-mono text-sm">{dispute.disputeId}</td>
                        <td className="p-4 font-mono text-sm">{dispute.paymentId}</td>
                        <td className="p-4">${dispute.amount.toFixed(2)}</td>
                        <td className="p-4">{dispute.reason.replace(/_/g, ' ')}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(dispute.status)}>
                            {dispute.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{dispute.evidenceCount} files</Badge>
                        </td>
                        <td className="p-4">
                          <span className={isOverdue(dispute.dueDate) ? 'text-red-600 font-bold' : ''}>
                            {new Date(dispute.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4">{new Date(dispute.createdAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDispute(dispute)}
                            >
                              View
                            </Button>
                            {dispute.status === 'OPEN' && (
                              <Button
                                size="sm"
                                onClick={() => handleUpdateDispute(dispute.disputeId, { status: 'UNDER_REVIEW' })}
                              >
                                Review
                              </Button>
                            )}
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
                  <CardTitle>Total Disputes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.totalDisputes}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${analytics.totalDisputedAmount.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.winRate.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Won / Lost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {analytics.wonDisputes} / {analytics.lostDisputes}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {analytics && (
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
          )}
        </TabsContent>
      </Tabs>

      {selectedDispute && (
        <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dispute Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dispute ID</Label>
                  <div className="font-mono text-sm">{selectedDispute.disputeId}</div>
                </div>
                <div>
                  <Label>Payment ID</Label>
                  <div className="font-mono text-sm">{selectedDispute.paymentId}</div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <div className="font-bold">${selectedDispute.amount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedDispute.status)}>
                    {selectedDispute.status}
                  </Badge>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <div className={isOverdue(selectedDispute.dueDate) ? 'text-red-600 font-bold' : ''}>
                    {new Date(selectedDispute.dueDate).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label>Evidence Count</Label>
                  <div className="font-bold">{selectedDispute.evidenceCount} files</div>
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <div>{selectedDispute.reason.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <Label>Created</Label>
                <div>{new Date(selectedDispute.createdAt).toLocaleString()}</div>
              </div>
              {selectedDispute.resolvedAt && (
                <div>
                  <Label>Resolved</Label>
                  <div>{new Date(selectedDispute.resolvedAt).toLocaleString()}</div>
                </div>
              )}
              {selectedDispute.resolutionNotes && (
                <div>
                  <Label>Resolution Notes</Label>
                  <div className="text-sm">{selectedDispute.resolutionNotes}</div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">Evidence</h3>
                  <Dialog open={isEvidenceDialogOpen} onOpenChange={setIsEvidenceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Evidence
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Evidence</DialogTitle>
                      </DialogHeader>
                      <form action={handleUploadEvidence} className="space-y-4">
                        <div>
                          <Label htmlFor="evidenceType">Evidence Type</Label>
                          <Select name="evidenceType" required>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DOCUMENT">Document</SelectItem>
                              <SelectItem value="IMAGE">Image</SelectItem>
                              <SelectItem value="VIDEO">Video</SelectItem>
                              <SelectItem value="TRANSACTION_PROOF">Transaction Proof</SelectItem>
                              <SelectItem value="DELIVERY_CONFIRMATION">Delivery Confirmation</SelectItem>
                              <SelectItem value="COMMUNICATION">Communication</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="fileName">File Name</Label>
                          <Input id="fileName" name="fileName" required />
                        </div>
                        <div>
                          <Label htmlFor="fileUrl">File URL</Label>
                          <Input id="fileUrl" name="fileUrl" required />
                        </div>
                        <div>
                          <Label htmlFor="fileSize">File Size (bytes)</Label>
                          <Input id="fileSize" name="fileSize" type="number" required />
                        </div>
                        <div>
                          <Label htmlFor="mimeType">MIME Type</Label>
                          <Input id="mimeType" name="mimeType" />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea id="description" name="description" />
                        </div>
                        <Button type="submit" className="w-full">Upload</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-2">
                  {selectedDisputeEvidence.map((evidence) => (
                    <div key={evidence.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{evidence.fileName}</div>
                        <div className="text-sm text-muted-foreground">
                          {evidence.evidenceType} • {(evidence.fileSize / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={evidence.fileUrl} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                  {selectedDisputeEvidence.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No evidence uploaded yet
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-bold mb-2">Actions</h3>
                <div className="flex gap-2 flex-wrap">
                  {selectedDispute.status === 'OPEN' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateDispute(selectedDispute.disputeId, { status: 'UNDER_REVIEW' })}
                    >
                      Start Review
                    </Button>
                  )}
                  {selectedDispute.status === 'UNDER_REVIEW' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateDispute(selectedDispute.disputeId, { status: 'EVIDENCE_REQUIRED' })}
                      >
                        Request Evidence
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateDispute(selectedDispute.disputeId, { status: 'RESPONDING' })}
                      >
                        Respond
                      </Button>
                    </>
                  )}
                  {selectedDispute.status === 'RESPONDING' && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleUpdateDispute(selectedDispute.disputeId, { 
                          status: 'WON',
                          resolutionNotes: 'Dispute resolved in merchant favor'
                        })}
                      >
                        Mark as Won
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUpdateDispute(selectedDispute.disputeId, { 
                          status: 'LOST',
                          resolutionNotes: 'Dispute resolved in customer favor'
                        })}
                      >
                        Mark as Lost
                      </Button>
                    </>
                  )}
                  {(selectedDispute.status === 'WON' || selectedDispute.status === 'LOST') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateDispute(selectedDispute.disputeId, { status: 'CLOSED' })}
                    >
                      Close Dispute
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
