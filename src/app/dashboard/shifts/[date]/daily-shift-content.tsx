'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, addDays, subDays, getDay, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Save,
  Trash2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { TIME_SLOTS, timeToMinutes, addHoursToTime, DEFAULT_SHIFT } from '@/lib/time-constants';
import { AutoAssignButton } from '@/components/shifts/auto-assign-button';
import { AutoAssignPreviewDialog } from '@/components/shifts/auto-assign-preview';
import { ApiKeySettingsDialog } from '@/components/shifts/api-key-settings';
import { useGeminiApi } from '@/hooks/use-gemini-api';
import { proposeShifts, applyProposedShifts, type ShiftProposalResult } from '@/lib/auto-assign/shift-proposer';

interface Store {
  id: number;
  name: string;
}

interface Staff {
  id: number;
  name: string;
  role: string;
  employmentType: string;
  storeId: number;
}

interface Shift {
  id: number;
  staffId: number;
  storeId: number;
  date: string;
  startTime: string;
  endTime: string;
  staffName: string | null;
  staffRole: string | null;
  staffEmploymentType: string | null;
}

interface ShiftRequirement {
  id: number;
  storeId: number;
  dayOfWeek: number;
  timeSlot: string;
  requiredCount: number;
}

interface AvailabilityPattern {
  id: number;
  staffId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface DailyShiftContentProps {
  user: SessionUser;
  date: string;
  initialStoreId?: number;
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土'];

// ローディングスケルトン
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-8 bg-[#E5E5EA] rounded-xl w-full" />
      {[...Array(10)].map((_, i) => (
        <div key={i} className="h-6 bg-[#E5E5EA] rounded-xl" />
      ))}
    </div>
  );
});

export function DailyShiftContent({ user, date, initialStoreId }: DailyShiftContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    initialStoreId?.toString() || ''
  );
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Map<number, AvailabilityPattern[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 自動割り振り用
  const {
    apiKey,
    isApiKeySet,
    isValidating,
    setApiKey,
    clearApiKey,
  } = useGeminiApi();
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignPreviewOpen, setAutoAssignPreviewOpen] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<ShiftProposalResult | null>(null);
  const [isApplyingShifts, setIsApplyingShifts] = useState(false);

  // シフト編集用
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('17:00');

  const currentDate = parseISO(date);
  const dayOfWeek = getDay(currentDate);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (!selectedStoreId && data.length > 0) {
          const defaultStore = user.storeId
            ? data.find((s: Store) => s.id === user.storeId)
            : data[0];
          setSelectedStoreId((defaultStore?.id || data[0].id).toString());
        }
      }
    } catch (error) {
      console.error('店舗取得エラー:', error);
    }
  }, [user.storeId, selectedStoreId]);

  const fetchStaff = useCallback(async () => {
    try {
      // スタッフ一覧と勤務可能時間を並列取得（N+1解消）
      const [staffRes, availRes] = await Promise.all([
        fetch(`/api/staff?storeId=${selectedStoreId}`),
        fetch(`/api/availability?storeId=${selectedStoreId}`),
      ]);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(staffData);
      }

      if (availRes.ok) {
        const availData: Record<string, AvailabilityPattern[]> = await availRes.json();
        const availMap = new Map<number, AvailabilityPattern[]>();
        for (const [staffId, patterns] of Object.entries(availData)) {
          availMap.set(parseInt(staffId), patterns);
        }
        setAvailabilityMap(availMap);
      }
    } catch (error) {
      console.error('スタッフ取得エラー:', error);
    }
  }, [selectedStoreId]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/shifts?storeId=${selectedStoreId}&startDate=${date}&endDate=${date}`
      );
      if (res.ok) {
        const data = await res.json();
        setShifts(data);
      }
    } catch (error) {
      console.error('シフト取得エラー:', error);
    }
  }, [selectedStoreId, date]);

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/shift-requirements?storeId=${selectedStoreId}&dayOfWeek=${dayOfWeek}`
      );
      if (res.ok) {
        const data = await res.json();
        setRequirements(data);
      }
    } catch (error) {
      console.error('必要人数取得エラー:', error);
    }
  }, [selectedStoreId, dayOfWeek]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStaff(), fetchShifts(), fetchRequirements()]);
    setLoading(false);
  }, [fetchStaff, fetchShifts, fetchRequirements]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchData();
    }
  }, [selectedStoreId, date, fetchData]);

  const getStaffAvailability = useCallback((staffId: number) => {
    const patterns = availabilityMap.get(staffId) || [];
    return patterns.find((p) => p.dayOfWeek === dayOfWeek);
  }, [availabilityMap, dayOfWeek]);

  const isStaffAvailable = useCallback((staffId: number, time: string) => {
    const availability = getStaffAvailability(staffId);
    if (!availability) return false;

    const timeMin = timeToMinutes(time);
    const startMin = timeToMinutes(availability.startTime);
    const endMin = timeToMinutes(availability.endTime);

    return timeMin >= startMin && timeMin < endMin;
  }, [getStaffAvailability]);

  const getShiftForStaff = useCallback((staffId: number) => {
    return shifts.find((s) => s.staffId === staffId);
  }, [shifts]);

  const isTimeInShift = useCallback((staffId: number, time: string) => {
    const shift = getShiftForStaff(staffId);
    if (!shift) return false;

    const timeMin = timeToMinutes(time);
    const startMin = timeToMinutes(shift.startTime);
    const endMin = timeToMinutes(shift.endTime);

    return timeMin >= startMin && timeMin < endMin;
  }, [getShiftForStaff]);

  // シフトが8時間超（残業）かどうかをチェック
  const isOvertimeShift = useCallback((staffId: number) => {
    const shift = getShiftForStaff(staffId);
    if (!shift) return false;

    const startMin = timeToMinutes(shift.startTime);
    const endMin = timeToMinutes(shift.endTime);
    const durationMinutes = endMin - startMin;

    return durationMinutes > 8 * 60; // 8時間 = 480分
  }, [getShiftForStaff]);

  const getRequiredCountForSlot = useCallback((time: string) => {
    const req = requirements.find((r) => r.timeSlot === time);
    return req?.requiredCount || 0;
  }, [requirements]);

  const getActualCountForSlot = useCallback((time: string) => {
    return shifts.filter((s) => {
      const timeMin = timeToMinutes(time);
      const startMin = timeToMinutes(s.startTime);
      const endMin = timeToMinutes(s.endTime);
      return timeMin >= startMin && timeMin < endMin;
    }).length;
  }, [shifts]);

  const handleOpenEditDialog = useCallback((staffId: number, clickedTime?: string) => {
    const existingShift = getShiftForStaff(staffId);
    const availability = getStaffAvailability(staffId);

    setEditingStaffId(staffId);
    if (existingShift) {
      // 既存シフトはその時間を使用
      setEditStartTime(existingShift.startTime);
      setEditEndTime(existingShift.endTime);
    } else if (clickedTime) {
      // クリックした時間を開始時間、+3時間を終了時間に設定
      setEditStartTime(clickedTime);
      setEditEndTime(addHoursToTime(clickedTime, DEFAULT_SHIFT.duration));
    } else if (availability) {
      // 勤務可能時間を使用
      setEditStartTime(availability.startTime);
      setEditEndTime(availability.endTime);
    } else {
      // デフォルト時間を使用
      setEditStartTime(DEFAULT_SHIFT.startTime);
      setEditEndTime(DEFAULT_SHIFT.endTime);
    }
    setEditDialogOpen(true);
  }, [getShiftForStaff, getStaffAvailability]);

  const handleSaveShift = useCallback(async () => {
    if (!editingStaffId) return;

    setSaving(true);
    try {
      const existingShift = getShiftForStaff(editingStaffId);

      if (existingShift) {
        const res = await fetch(`/api/shifts/${existingShift.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime: editStartTime,
            endTime: editEndTime,
          }),
        });

        if (res.ok) {
          await fetchShifts();
        }
      } else {
        const res = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffId: editingStaffId,
            storeId: parseInt(selectedStoreId),
            date,
            startTime: editStartTime,
            endTime: editEndTime,
          }),
        });

        if (res.ok) {
          await fetchShifts();
        }
      }

      setEditDialogOpen(false);
    } catch (error) {
      console.error('シフト保存エラー:', error);
    } finally {
      setSaving(false);
    }
  }, [editingStaffId, editStartTime, editEndTime, selectedStoreId, date, getShiftForStaff, fetchShifts]);

  const handleDeleteShift = useCallback(async () => {
    if (!editingStaffId) return;

    const existingShift = getShiftForStaff(editingStaffId);
    if (!existingShift) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/shifts/${existingShift.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchShifts();
        setEditDialogOpen(false);
      }
    } catch (error) {
      console.error('シフト削除エラー:', error);
    } finally {
      setSaving(false);
    }
  }, [editingStaffId, getShiftForStaff, fetchShifts]);

  const handlePrevDay = useCallback(() => {
    router.push(
      `/dashboard/shifts/${format(subDays(currentDate, 1), 'yyyy-MM-dd')}?storeId=${selectedStoreId}`
    );
  }, [router, currentDate, selectedStoreId]);

  const handleNextDay = useCallback(() => {
    router.push(
      `/dashboard/shifts/${format(addDays(currentDate, 1), 'yyyy-MM-dd')}?storeId=${selectedStoreId}`
    );
  }, [router, currentDate, selectedStoreId]);

  const handleBackToMonthly = useCallback(() => {
    router.push('/dashboard/shifts');
  }, [router]);

  const handleStoreChange = useCallback((value: string) => {
    setSelectedStoreId(value);
  }, []);

  // 自動割り振りハンドラ
  const handleAutoAssign = useCallback(async () => {
    setAutoAssignLoading(true);
    try {
      const result = await proposeShifts(date, parseInt(selectedStoreId));
      setAutoAssignResult(result);
      setAutoAssignPreviewOpen(true);
    } catch (error) {
      console.error('自動割り振りエラー:', error);
    } finally {
      setAutoAssignLoading(false);
    }
  }, [date, selectedStoreId]);

  const handleRecalculate = useCallback(async () => {
    setAutoAssignLoading(true);
    try {
      const result = await proposeShifts(date, parseInt(selectedStoreId));
      setAutoAssignResult(result);
    } catch (error) {
      console.error('再計算エラー:', error);
    } finally {
      setAutoAssignLoading(false);
    }
  }, [date, selectedStoreId]);

  const handleApplyShifts = useCallback(async () => {
    if (!autoAssignResult || autoAssignResult.proposedShifts.length === 0) return;

    setIsApplyingShifts(true);
    try {
      await applyProposedShifts(date, parseInt(selectedStoreId), autoAssignResult.proposedShifts);
      await fetchShifts();
      setAutoAssignPreviewOpen(false);
      setAutoAssignResult(null);
    } catch (error) {
      console.error('シフト適用エラー:', error);
    } finally {
      setIsApplyingShifts(false);
    }
  }, [date, selectedStoreId, autoAssignResult, fetchShifts]);

  const editingStaff = useMemo(() =>
    staffList.find((s) => s.id === editingStaffId),
    [staffList, editingStaffId]
  );

  const editingAvailability = useMemo(() =>
    editingStaffId ? getStaffAvailability(editingStaffId) : null,
    [editingStaffId, getStaffAvailability]
  );

  const storeSelector = useMemo(() => {
    if (user.role !== 'owner') return null;
    return (
      <Select value={selectedStoreId} onValueChange={handleStoreChange}>
        <SelectTrigger className="w-[180px] border-[#E5E5EA] bg-white">
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
  }, [user.role, selectedStoreId, stores, handleStoreChange]);

  const backButton = useMemo(() => (
    <Button
      variant="outline"
      onClick={handleBackToMonthly}
      className="rounded-xl border-[#E5E5EA] hover:bg-[#F5F5F7]"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      月別サマリー
    </Button>
  ), [handleBackToMonthly]);

  const actions = useMemo(() => (
    <div className="flex items-center gap-3">
      {backButton}
      {storeSelector}
    </div>
  ), [backButton, storeSelector]);

  return (
    <DashboardLayout
      user={user}
      title="日別シフト編集"
      description="スタッフごとのシフトを編集"
      actions={actions}
    >
      {/* 日付ナビゲーション */}
      <PageSection className="mb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevDay}
            className="rounded-xl border-[#E5E5EA] hover:bg-[#F5F5F7]"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            前日
          </Button>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-[#1D1D1F]">
              {format(currentDate, 'yyyy年M月d日', { locale: ja })}
              <span
                className={`ml-2 ${
                  dayOfWeek === 0
                    ? 'text-[#FF3B30]'
                    : dayOfWeek === 6
                    ? 'text-[#007AFF]'
                    : 'text-[#86868B]'
                }`}
              >
                ({dayOfWeekLabels[dayOfWeek]})
              </span>
            </h2>
            <AutoAssignButton
              onAutoAssign={handleAutoAssign}
              onOpenSettings={() => setApiKeyDialogOpen(true)}
              isLoading={autoAssignLoading}
              isApiKeySet={isApiKeySet}
              disabled={loading}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleNextDay}
            className="rounded-xl border-[#E5E5EA] hover:bg-[#F5F5F7]"
          >
            翌日
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </PageSection>

      {/* シフト表 */}
      <PageSection>
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-[#E5E5EA]">
                    <th className="sticky left-0 bg-white p-1 text-left text-xs font-medium text-[#86868B] w-[100px] z-10">
                      名前
                    </th>
                    <th className="sticky left-[100px] bg-white p-1 text-left text-xs font-medium text-[#86868B] w-[50px] z-10">
                      役職
                    </th>
                    {TIME_SLOTS.map((time) => (
                      <th
                        key={time}
                        className="p-1 text-center text-xs font-normal text-[#86868B] min-w-[40px]"
                      >
                        {time.endsWith(':00') ? time.split(':')[0] : ''}
                      </th>
                    ))}
                  </tr>
                  {/* 必要人数行 */}
                  <tr className="border-b border-[#E5E5EA] bg-[#F5F5F7]">
                    <td colSpan={2} className="sticky left-0 bg-[#F5F5F7] p-1 text-xs text-[#86868B] z-10 w-[150px]">
                      必要人数
                    </td>
                    {TIME_SLOTS.map((time) => {
                      const required = getRequiredCountForSlot(time);
                      const actual = getActualCountForSlot(time);
                      const status =
                        actual >= required
                          ? 'good'
                          : actual >= required * 0.7
                          ? 'warning'
                          : 'danger';

                      return (
                        <td key={time} className="p-1 text-center">
                          <div
                            className={`text-xs font-medium ${
                              status === 'good'
                                ? 'text-[#34C759]'
                                : status === 'warning'
                                ? 'text-[#FF9500]'
                                : 'text-[#FF3B30]'
                            }`}
                          >
                            {actual}/{required}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staffMember) => {
                    const availability = getStaffAvailability(staffMember.id);

                    return (
                      <tr
                        key={staffMember.id}
                        className="border-b border-[#E5E5EA] hover:bg-[#F5F5F7]/50 transition-colors"
                      >
                        {/* 名前セル */}
                        <td
                          className="sticky left-0 bg-white p-1 z-10 w-[100px] cursor-pointer"
                          onClick={() => handleOpenEditDialog(staffMember.id)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-[#1D1D1F] truncate">
                              {staffMember.name}
                            </span>
                            {!availability && (
                              <AlertCircle className="w-3 h-3 text-[#FF3B30] flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        {/* 役職セル */}
                        <td
                          className="sticky left-[100px] bg-white p-1 z-10 w-[50px] cursor-pointer"
                          onClick={() => handleOpenEditDialog(staffMember.id)}
                        >
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 border-0 ${
                              staffMember.role === 'manager'
                                ? 'bg-[#007AFF]/10 text-[#007AFF]'
                                : 'bg-[#F5F5F7] text-[#86868B]'
                            }`}
                          >
                            {staffMember.employmentType === 'employee'
                              ? '社員'
                              : 'ﾊﾞｲﾄ'}
                          </Badge>
                        </td>
                        {TIME_SLOTS.map((time) => {
                          const isAvailable = isStaffAvailable(staffMember.id, time);
                          const isInShift = isTimeInShift(staffMember.id, time);
                          const isOvertime = isOvertimeShift(staffMember.id);

                          return (
                            <td
                              key={time}
                              className={`p-0 h-6 cursor-pointer transition-colors ${
                                isInShift
                                  ? isOvertime
                                    ? 'bg-[#FF9500]' // 8時間超（残業）はオレンジ
                                    : 'bg-[#007AFF]' // 通常シフトは青
                                  : isAvailable
                                  ? 'bg-[#34C759]/20 hover:bg-[#34C759]/30'
                                  : 'bg-[#F5F5F7] hover:bg-[#E5E5EA]'
                              }`}
                              onClick={() => handleOpenEditDialog(staffMember.id, time)}
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap items-center gap-6 pt-4 mt-4 border-t border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#007AFF] rounded" />
                <span className="text-sm text-[#86868B]">シフト</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#FF9500] rounded" />
                <span className="text-sm text-[#86868B]">残業（8h超）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#34C759]/20 border border-[#34C759]/30 rounded" />
                <span className="text-sm text-[#86868B]">勤務可能</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#F5F5F7] border border-[#E5E5EA] rounded" />
                <span className="text-sm text-[#86868B]">勤務不可</span>
              </div>
            </div>
          </>
        )}
      </PageSection>

      {/* シフト編集ダイアログ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#007AFF]" />
              {editingStaff?.name}さんのシフト
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingAvailability ? (
              <div className="p-3 bg-[#34C759]/10 rounded-xl">
                <p className="text-sm text-[#34C759]">
                  勤務可能時間: {editingAvailability.startTime} 〜 {editingAvailability.endTime}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#FF3B30]/10 rounded-xl">
                <p className="text-sm text-[#FF3B30] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  この曜日は勤務可能時間が設定されていません
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#1D1D1F] mb-2 block">開始時間</label>
                <Select value={editStartTime} onValueChange={setEditStartTime}>
                  <SelectTrigger className="border-[#E5E5EA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1D1D1F] mb-2 block">終了時間</label>
                <Select value={editEndTime} onValueChange={setEditEndTime}>
                  <SelectTrigger className="border-[#E5E5EA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {getShiftForStaff(editingStaffId || 0) && (
              <Button
                variant="outline"
                onClick={handleDeleteShift}
                disabled={saving}
                className="text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] border-[#E5E5EA]"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                削除
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="border-[#E5E5EA]"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSaveShift}
                disabled={saving}
                className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APIキー設定ダイアログ */}
      <ApiKeySettingsDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        currentApiKey={apiKey}
        isValidating={isValidating}
        onSave={setApiKey}
        onClear={clearApiKey}
      />

      {/* 自動割り振りプレビューダイアログ */}
      <AutoAssignPreviewDialog
        open={autoAssignPreviewOpen}
        onOpenChange={setAutoAssignPreviewOpen}
        date={format(currentDate, 'yyyy年M月d日', { locale: ja })}
        beforeCoverage={autoAssignResult?.beforeCoverage ?? 0}
        afterCoverage={autoAssignResult?.afterCoverage ?? 0}
        proposedShifts={autoAssignResult?.proposedShifts ?? []}
        unfilledSlots={autoAssignResult?.unfilledSlots ?? []}
        isLoading={autoAssignLoading}
        isApplying={isApplyingShifts}
        onRecalculate={handleRecalculate}
        onApply={handleApplyShifts}
      />
    </DashboardLayout>
  );
}
