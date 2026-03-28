import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../layout/Header';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { adminApi } from '../../lib/adminApi';
import type { RegistrationRequest, RegistrationRequestStatus } from '../../types';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, ClipboardList, RefreshCw } from 'lucide-react';

const statusLabel: Record<RegistrationRequestStatus, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下',
};

const statusBadge = (status: RegistrationRequestStatus) => {
  if (status === 'pending') return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">承認待ち</Badge>;
  if (status === 'approved') return <Badge className="bg-green-100 text-green-700 border-green-200">承認済み</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">却下</Badge>;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export const RegistrationRequestsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RegistrationRequestStatus | 'all'>('pending');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<RegistrationRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async (filter: RegistrationRequestStatus | 'all') => {
    setLoading(true);
    try {
      const data = await adminApi.listRegistrationRequests(filter);
      setRequests(data);
    } catch {
      toast.error('申請一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests(statusFilter);
  }, [statusFilter]);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const handleApprove = async (request: RegistrationRequest) => {
    if (!confirm(`${request.lastName} ${request.firstName}（${request.email}）の申請を承認しますか？\n招待メールが送信されます。`)) return;
    setProcessingId(request.id);
    try {
      await adminApi.approveRegistrationRequest(request.id);
      toast.success('申請を承認しました。招待メールを送信しました。');
      setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'approved' as const } : r));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      try {
        const parsed = JSON.parse(msg);
        toast.error(typeof parsed?.error === 'string' ? parsed.error : '承認に失敗しました');
      } catch {
        toast.error(msg || '承認に失敗しました');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request: RegistrationRequest) => {
    setRequestToReject(request);
    setRejectNotes('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!requestToReject) return;
    setProcessingId(requestToReject.id);
    try {
      await adminApi.rejectRegistrationRequest(requestToReject.id, rejectNotes);
      toast.success('申請を却下しました');
      setRequests((prev) => prev.map((r) => r.id === requestToReject.id ? { ...r, status: 'rejected' as const, notes: rejectNotes } : r));
      setRejectDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      try {
        const parsed = JSON.parse(msg);
        toast.error(typeof parsed?.error === 'string' ? parsed.error : '却下に失敗しました');
      } catch {
        toast.error(msg || '却下に失敗しました');
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl sm:text-3xl flex-1 flex items-center gap-3">
            登録申請管理
            {statusFilter === 'pending' && pendingCount > 0 && (
              <Badge className="bg-red-500 text-white text-sm">{pendingCount}</Badge>
            )}
          </h1>
          <Button variant="outline" size="sm" onClick={() => void loadRequests(statusFilter)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle className="flex-1">申請一覧</CardTitle>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as RegistrationRequestStatus | 'all')}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">承認待ち</SelectItem>
                  <SelectItem value="approved">承認済み</SelectItem>
                  <SelectItem value="rejected">却下</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>{statusLabel[statusFilter as RegistrationRequestStatus] ?? ''}の申請はありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>申請日時</TableHead>
                      <TableHead>氏名</TableHead>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>所属会社</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(request.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {request.lastName} {request.firstName}
                        </TableCell>
                        <TableCell className="text-sm">{request.email}</TableCell>
                        <TableCell className="text-sm">{request.companyName || '-'}</TableCell>
                        <TableCell>{statusBadge(request.status)}</TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                onClick={() => void handleApprove(request)}
                                disabled={processingId === request.id}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                承認
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRejectDialog(request)}
                                disabled={processingId === request.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4 mr-1" />
                                却下
                              </Button>
                            </div>
                          )}
                          {request.status === 'rejected' && request.notes && (
                            <span className="text-xs text-gray-500 max-w-xs truncate block">{request.notes}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申請を却下</DialogTitle>
            <DialogDescription>
              {requestToReject && `${requestToReject.lastName} ${requestToReject.firstName}（${requestToReject.email}）の申請を却下します。`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reject-notes">却下理由（任意）</Label>
              <Textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="例：申請内容に不備があります"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setRejectDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => void handleReject()}
              disabled={processingId === requestToReject?.id}
            >
              {processingId === requestToReject?.id ? '処理中...' : '却下する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
