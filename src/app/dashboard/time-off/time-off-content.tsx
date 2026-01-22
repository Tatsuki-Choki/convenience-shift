'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { DashboardLayout, PageSection } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
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
import {
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  Clock,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
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

export function TimeOffContent({ user }: TimeOffContentProps) {
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

  const fetchRequests = useCallback(async () => {
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
  }, [isAdmin, selectedStoreId, currentMonth, statusFilter]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDayOfWeek = getDay(start);
    const emptyDays: (Date | null)[] = Array(startDayOfWeek).fill(null);
    return [...emptyDays, ...days];
  }, [currentMonth]);

  const getRequestForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return requests.find((r) => r.date === dateStr && r.staffId === user.id);
    },
    [requests, user.id]
  );

  const toggleDateSelection = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const today = startOfDay(new Date());
      if (isBefore(date, today)) return;
      const existingRequest = getRequestForDate(date);
      if (existingRequest) return;
      setSelectedDates((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(dateStr)) {
          newSelected.delete(dateStr);
        } else {
          newSelected.add(dateStr);
        }
        return newSelected;
      });
    },
    [getRequestForDate]
  );

  const handleSubmitRequests = useCallback(async () => {
    if (selectedDates.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/time-off-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: Array.from(selectedDates) }),
      });
      if (res.ok) {
        setSelectedDates(new Set());
        await fetchRequests();
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
  }, [selectedDates, fetchRequests]);

  const handleDeleteRequest = useCallback(
    async (requestId: number) => {
      if (!confirm('この休み希望を取り消しますか？')) return;
      try {
        const res = await fetch(`/api/time-off-requests/${requestId}`, { method: 'DELETE' });
        if (res.ok) {
          await fetchRequests();
        } else {
          const error = await res.json();
          alert(error.error || '取り消しに失敗しました');
        }
      } catch (error) {
        console.error('取り消しエラー:', error);
      }
    },
    [fetchRequests]
  );

  const handleApprove = useCallback(
    async (requestId: number) => {
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
    },
    [fetchRequests]
  );

  const handleReject = useCallback(
    async (requestId: number) => {
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
    },
    [fetchRequests]
  );

  const handlePrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const handleNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const storeSelector = isAdmin && user.role === 'owner' && (
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
  );

  return (
    <DashboardLayout
      user={user}
      title="休み希望"
      description={isAdmin ? '休み希望の確認と承認' : '休み希望日を入力してください'}
      actions={storeSelector}
    >
      {isAdmin ? (
        <Tabs defaultValue="approval" className="space-y-4">
          <TabsList className="bg-[#E5E5EA]/50 p-1 rounded-xl">
            <TabsTrigger
              value="approval"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              承認待ち
              {pendingCount > 0 && (
                <Badge className="ml-2 bg-[#FF3B30] text-white">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              すべての申請
            </TabsTrigger>
            <TabsTrigger
              value="my-request"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              自分の休み希望
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approval">
            <PageSection>
              <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">承認待ちの休み希望</h3>
              {loading ? (
                <LoadingSkeleton />
              ) : requests.filter((r) => r.status === 'pending').length === 0 ? (
                <EmptyState message="承認待ちの休み希望はありません" />
              ) : (
                <div className="overflow-x-auto">
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
                            <TableCell className="font-medium">{request.staffName}</TableCell>
                            <TableCell>
                              {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                            </TableCell>
                            <TableCell className="text-[#86868B]">
                              {format(new Date(request.createdAt), 'M/d HH:mm')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(request.id)}
                                  className="bg-[#34C759] hover:bg-[#30D158] text-white"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  承認
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
                                  className="bg-[#FF3B30] hover:bg-[#FF453A]"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  却下
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PageSection>
          </TabsContent>

          <TabsContent value="all">
            <PageSection>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1D1D1F]">すべての休み希望</h3>
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
              {loading ? (
                <LoadingSkeleton />
              ) : requests.length === 0 ? (
                <EmptyState message="休み希望がありません" />
              ) : (
                <div className="overflow-x-auto">
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
                          <TableCell className="font-medium">{request.staffName}</TableCell>
                          <TableCell>
                            {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                          <TableCell className="text-[#86868B]">
                            {format(new Date(request.createdAt), 'M/d HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PageSection>
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
    </DashboardLayout>
  );
}

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-[#FF9500]/10 text-[#FF9500]',
    approved: 'bg-[#34C759]/10 text-[#34C759]',
    rejected: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  };
  return <Badge className={colors[status]}>{statusLabels[status]}</Badge>;
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-[#F5F5F7] rounded-xl animate-pulse" />
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <CalendarOff className="w-12 h-12 text-[#D2D2D7] mx-auto mb-4" />
      <p className="text-[#86868B]">{message}</p>
    </div>
  );
});

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

const StaffRequestView = memo(function StaffRequestView({
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
      <div className="lg:col-span-2">
        <PageSection>
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={onPrevMonth} className="hover:bg-[#F5F5F7]">
              <ChevronLeft className="w-5 h-5 mr-1" />
              前月
            </Button>
            <h3 className="text-xl font-semibold text-[#1D1D1F]">
              {format(currentMonth, 'yyyy年M月', { locale: ja })}
            </h3>
            <Button variant="ghost" size="sm" onClick={onNextMonth} className="hover:bg-[#F5F5F7]">
              翌月
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {dayOfWeekLabels.map((day, index) => (
              <div
                key={day}
                className={`text-center py-2 text-sm font-medium ${
                  index === 0 ? 'text-[#FF3B30]' : index === 6 ? 'text-[#007AFF]' : 'text-[#86868B]'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-16 bg-[#F5F5F7] rounded-xl animate-pulse" />
              ))}
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
                    className={`h-16 p-2 border rounded-xl transition-all ${
                      isToday(day) ? 'border-[#007AFF]' : 'border-[#E5E5EA]'
                    } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''} ${
                      isSelectable ? 'cursor-pointer hover:border-[#007AFF] hover:shadow-sm' : ''
                    } ${isPast ? 'bg-[#F5F5F7]' : ''} ${
                      isSelected ? 'bg-[#007AFF]/10 border-[#007AFF]' : ''
                    } ${
                      request
                        ? request.status === 'approved'
                          ? 'bg-[#34C759]/5'
                          : request.status === 'rejected'
                          ? 'bg-[#FF3B30]/5'
                          : 'bg-[#FF9500]/5'
                        : ''
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        dayOfWeek === 0
                          ? 'text-[#FF3B30]'
                          : dayOfWeek === 6
                          ? 'text-[#007AFF]'
                          : 'text-[#1D1D1F]'
                      } ${isPast ? 'opacity-50' : ''}`}
                    >
                      {format(day, 'd')}
                    </span>
                    {request && <StatusBadge status={request.status} />}
                    {isSelected && !request && (
                      <div className="w-2 h-2 bg-[#007AFF] rounded-full mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-4 border-t border-[#E5E5EA]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#007AFF]/10 border border-[#007AFF] rounded" />
              <span className="text-xs text-[#86868B]">選択中</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#FF9500]/5 border border-[#FF9500]/30 rounded" />
              <span className="text-xs text-[#86868B]">申請中</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#34C759]/5 border border-[#34C759]/30 rounded" />
              <span className="text-xs text-[#86868B]">承認済</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#FF3B30]/5 border border-[#FF3B30]/30 rounded" />
              <span className="text-xs text-[#86868B]">却下</span>
            </div>
          </div>
        </PageSection>
      </div>

      <div className="space-y-4">
        <PageSection>
          <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">選択中の日付</h3>
          <p className="text-sm text-[#86868B] mb-4">
            {selectedDates.size > 0
              ? `${selectedDates.size}日選択中`
              : 'カレンダーから日付を選択してください'}
          </p>
          {selectedDates.size > 0 && (
            <div className="space-y-2 mb-4">
              {Array.from(selectedDates)
                .sort()
                .map((dateStr) => (
                  <div
                    key={dateStr}
                    className="flex items-center justify-between p-2 bg-[#007AFF]/5 rounded-lg"
                  >
                    <span className="text-sm">
                      {format(new Date(dateStr), 'M月d日 (E)', { locale: ja })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleDate(new Date(dateStr))}
                      className="h-6 w-6 p-0 hover:bg-[#FF3B30]/10"
                    >
                      <X className="w-4 h-4 text-[#FF3B30]" />
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
        </PageSection>

        <PageSection>
          <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">今月の申請</h3>
          {requests.length === 0 ? (
            <p className="text-sm text-[#86868B]">申請中の休み希望はありません</p>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-xl"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1D1D1F]">
                      {format(new Date(request.date), 'M月d日 (E)', { locale: ja })}
                    </p>
                    <StatusBadge status={request.status} />
                  </div>
                  {request.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(request.id)}
                      className="text-[#FF3B30] hover:text-[#FF453A] hover:bg-[#FF3B30]/10"
                    >
                      取消
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </PageSection>
      </div>
    </div>
  );
});
