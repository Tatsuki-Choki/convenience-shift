'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import type { SessionUser } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
}

interface TimeOffRequest {
  id: number;
  staffId: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  staffName: string | null;
  staffStoreId: number | null;
}

interface TimeOffContentProps {
  user: SessionUser;
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土'];

const statusLabels: Record<string, string> = {
  pending: '申請中',
  approved: '承認済',
  rejected: '却下',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
};

export function TimeOffContent({ user }: TimeOffContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isAdmin = user.role === 'owner' || user.role === 'manager';

  useEffect(() => {
    if (isAdmin) {
      fetchStores();
    }
    fetchRequests();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [selectedStoreId, currentMonth, statusFilter]);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0) {
          const defaultStore = user.storeId
            ? data.find((s: Store) => s.id === user.storeId)
            : data[0];
          setSelectedStoreId((defaultStore?.id || data[0].id).toString());
        }
      }
    } catch (error) {
      console.error('店舗取得エラー:', error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = '/api/time-off-requests?';
      const params = new URLSearchParams();

      if (isAdmin && selectedStoreId) {
        params.append('storeId', selectedStoreId);
      }

      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`${url}${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('休み希望取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const startDayOfWeek = getDay(start);
    const emptyDays = Array(startDayOfWeek).fill(null);

    return [...emptyDays, ...days];
  }, [currentMonth]);

  const getRequestForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return requests.find((r) => r.date === dateStr && r.staffId === user.id);
  };

  const toggleDateSelection = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const today = startOfDay(new Date());

    // 過去の日付は選択不可
    if (isBefore(date, today)) return;

    // すでに申請済みの日付は選択不可
    const existingRequest = getRequestForDate(date);
    if (existingRequest) return;

    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const handleSubmitRequests = async () => {
    if (selectedDates.size === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/time-off-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: Array.from(selectedDates),
        }),
      });

      if (res.ok) {
        setSelectedDates(new Set());
        await fetchRequests();
        alert('休み希望を申請しました');
      } else {
        const error = await res.json();
        alert(error.error || '申請に失敗しました');
      }
    } catch (error) {
      console.error('申請エラー:', error);
      alert('申請に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!confirm('この休み希望を取り消しますか？')) return;

    try {
      const res = await fetch(`/api/time-off-requests/${requestId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchRequests();
      } else {
        const error = await res.json();
        alert(error.error || '取り消しに失敗しました');
      }
    } catch (error) {
      console.error('取り消しエラー:', error);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      const res = await fetch(`/api/time-off-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (res.ok) {
        await fetchRequests();
      }
    } catch (error) {
      console.error('承認エラー:', error);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      const res = await fetch(`/api/time-off-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      if (res.ok) {
        await fetchRequests();
      }
    } catch (error) {
      console.error('却下エラー:', error);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">休み希望</h2>
            <p className="text-[#86868B]">
              {isAdmin ? '休み希望の確認と承認' : '休み希望日を入力してください'}
            </p>
          </div>
          {isAdmin && user.role === 'owner' && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="店舗を選択" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isAdmin ? (
          <Tabs defaultValue="approval" className="space-y-4">
            <TabsList>
              <TabsTrigger value="approval">
                承認待ち
                {pendingCount > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">すべての申請</TabsTrigger>
              <TabsTrigger value="my-request">自分の休み希望</TabsTrigger>
            </TabsList>

            <TabsContent value="approval">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1D1D1F]">承認待ちの休み希望</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-[#86868B] py-4">読み込み中...</p>
                  ) : requests.filter((r) => r.status === 'pending').length === 0 ? (
                    <p className="text-[#86868B] py-4">承認待ちの休み希望はありません</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>スタッフ</TableHead>
                          <TableHead>日付</TableHead>
                          <TableHead>申請日</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests
                          .filter((r) => r.status === 'pending')
                          .map((request) => (
                            <TableRow key={request.id}>
                              <TableCell>{request.staffName}</TableCell>
                              <TableCell>
                                {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                              </TableCell>
                              <TableCell>
                                {format(new Date(request.createdAt), 'M/d HH:mm')}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(request.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    承認
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleReject(request.id)}
                                  >
                                    却下
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[#1D1D1F]">すべての休み希望</CardTitle>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="pending">申請中</SelectItem>
                        <SelectItem value="approved">承認済</SelectItem>
                        <SelectItem value="rejected">却下</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-[#86868B] py-4">読み込み中...</p>
                  ) : requests.length === 0 ? (
                    <p className="text-[#86868B] py-4">休み希望がありません</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>スタッフ</TableHead>
                          <TableHead>日付</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead>申請日</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.staffName}</TableCell>
                            <TableCell>
                              {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[request.status]}>
                                {statusLabels[request.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.createdAt), 'M/d HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="my-request">
              <StaffRequestView
                currentMonth={currentMonth}
                calendarDays={calendarDays}
                requests={requests.filter((r) => r.staffId === user.id)}
                selectedDates={selectedDates}
                loading={loading}
                submitting={submitting}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToggleDate={toggleDateSelection}
                onSubmit={handleSubmitRequests}
                onDelete={handleDeleteRequest}
                getRequestForDate={(date) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  return requests.find((r) => r.date === dateStr && r.staffId === user.id);
                }}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <StaffRequestView
            currentMonth={currentMonth}
            calendarDays={calendarDays}
            requests={requests}
            selectedDates={selectedDates}
            loading={loading}
            submitting={submitting}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToggleDate={toggleDateSelection}
            onSubmit={handleSubmitRequests}
            onDelete={handleDeleteRequest}
            getRequestForDate={getRequestForDate}
          />
        )}
      </main>
    </div>
  );
}

// スタッフ用の休み希望入力ビュー
interface StaffRequestViewProps {
  currentMonth: Date;
  calendarDays: (Date | null)[];
  requests: TimeOffRequest[];
  selectedDates: Set<string>;
  loading: boolean;
  submitting: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleDate: (date: Date) => void;
  onSubmit: () => void;
  onDelete: (id: number) => void;
  getRequestForDate: (date: Date) => TimeOffRequest | undefined;
}

function StaffRequestView({
  currentMonth,
  calendarDays,
  requests,
  selectedDates,
  loading,
  submitting,
  onPrevMonth,
  onNextMonth,
  onToggleDate,
  onSubmit,
  onDelete,
  getRequestForDate,
}: StaffRequestViewProps) {
  const today = startOfDay(new Date());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* カレンダー */}
      <div className="lg:col-span-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={onPrevMonth}>
                ← 前月
              </Button>
              <CardTitle className="text-xl text-[#1D1D1F]">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}
              </CardTitle>
              <Button variant="outline" onClick={onNextMonth}>
                翌月 →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* カレンダーヘッダー */}
            <div className="grid grid-cols-7 mb-2">
              {dayOfWeekLabels.map((day, index) => (
                <div
                  key={day}
                  className={`text-center py-2 text-sm font-medium ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-[#86868B]'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* カレンダー本体 */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[#86868B]">読み込み中...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-16" />;
                  }

                  const dayOfWeek = getDay(day);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const request = getRequestForDate(day);
                  const isSelected = selectedDates.has(dateStr);
                  const isPast = isBefore(day, today);
                  const isSelectable = !isPast && !request;

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => isSelectable && onToggleDate(day)}
                      className={`h-16 p-2 border rounded-lg transition-all ${
                        isToday(day)
                          ? 'border-[#007AFF]'
                          : 'border-[#D2D2D7]'
                      } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''} ${
                        isSelectable
                          ? 'cursor-pointer hover:border-[#007AFF] hover:shadow-md'
                          : 'cursor-default'
                      } ${isPast ? 'bg-gray-100' : ''} ${
                        isSelected ? 'bg-blue-100 border-[#007AFF]' : ''
                      } ${request ? (request.status === 'approved' ? 'bg-green-50' : request.status === 'rejected' ? 'bg-red-50' : 'bg-yellow-50') : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`text-sm font-medium ${
                            dayOfWeek === 0
                              ? 'text-red-500'
                              : dayOfWeek === 6
                              ? 'text-blue-500'
                              : 'text-[#1D1D1F]'
                          } ${isPast ? 'opacity-50' : ''}`}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                      {request && (
                        <Badge className={`text-xs mt-1 ${statusColors[request.status]}`}>
                          {statusLabels[request.status]}
                        </Badge>
                      )}
                      {isSelected && !request && (
                        <div className="w-2 h-2 bg-[#007AFF] rounded-full mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 凡例 */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#D2D2D7]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-[#007AFF] rounded" />
                <span className="text-sm text-[#86868B]">選択中</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded" />
                <span className="text-sm text-[#86868B]">申請中</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-50 border border-green-300 rounded" />
                <span className="text-sm text-[#86868B]">承認済</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-50 border border-red-300 rounded" />
                <span className="text-sm text-[#86868B]">却下</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* サイドバー */}
      <div className="space-y-4">
        {/* 選択中の日付 */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#1D1D1F]">選択中の日付</CardTitle>
            <CardDescription>
              {selectedDates.size > 0
                ? `${selectedDates.size}日選択中`
                : 'カレンダーから日付を選択してください'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDates.size > 0 && (
              <div className="space-y-2 mb-4">
                {Array.from(selectedDates)
                  .sort()
                  .map((dateStr) => (
                    <div
                      key={dateStr}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded"
                    >
                      <span className="text-sm">
                        {format(new Date(dateStr), 'M月d日 (E)', { locale: ja })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleDate(new Date(dateStr))}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
              </div>
            )}
            <Button
              onClick={onSubmit}
              disabled={selectedDates.size === 0 || submitting}
              className="w-full bg-[#007AFF] hover:bg-[#0056b3] text-white"
            >
              {submitting ? '申請中...' : '休み希望を申請'}
            </Button>
          </CardContent>
        </Card>

        {/* 申請済みの休み希望 */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#1D1D1F]">今月の申請</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-[#86868B]">申請中の休み希望はありません</p>
            ) : (
              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-2 bg-[#F5F5F7] rounded"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                      </p>
                      <Badge className={`text-xs ${statusColors[request.status]}`}>
                        {statusLabels[request.status]}
                      </Badge>
                    </div>
                    {request.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(request.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        取消
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
