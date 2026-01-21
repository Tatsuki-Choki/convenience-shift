'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { SessionUser } from '@/lib/auth';

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

// 時間スロットを生成（6:00〜24:00を30分単位）
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 6; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

// 時間を分に変換
const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// 分を時間に変換
const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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

  // シフト編集用
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('17:00');

  const currentDate = parseISO(date);
  const dayOfWeek = getDay(currentDate);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchData();
    }
  }, [selectedStoreId, date]);

  const fetchStores = async () => {
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
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStaff(), fetchShifts(), fetchRequirements()]);
    setLoading(false);
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch(`/api/staff?storeId=${selectedStoreId}`);
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);

        // 各スタッフの勤務可能時間を取得
        const availMap = new Map<number, AvailabilityPattern[]>();
        for (const s of data) {
          const availRes = await fetch(`/api/staff/${s.id}/availability`);
          if (availRes.ok) {
            const patterns = await availRes.json();
            availMap.set(s.id, patterns);
          }
        }
        setAvailabilityMap(availMap);
      }
    } catch (error) {
      console.error('スタッフ取得エラー:', error);
    }
  };

  const fetchShifts = async () => {
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
  };

  const fetchRequirements = async () => {
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
  };

  const getStaffAvailability = (staffId: number) => {
    const patterns = availabilityMap.get(staffId) || [];
    return patterns.find((p) => p.dayOfWeek === dayOfWeek);
  };

  const isStaffAvailable = (staffId: number, time: string) => {
    const availability = getStaffAvailability(staffId);
    if (!availability) return false;

    const timeMin = timeToMinutes(time);
    const startMin = timeToMinutes(availability.startTime);
    const endMin = timeToMinutes(availability.endTime);

    return timeMin >= startMin && timeMin < endMin;
  };

  const getShiftForStaff = (staffId: number) => {
    return shifts.find((s) => s.staffId === staffId);
  };

  const isTimeInShift = (staffId: number, time: string) => {
    const shift = getShiftForStaff(staffId);
    if (!shift) return false;

    const timeMin = timeToMinutes(time);
    const startMin = timeToMinutes(shift.startTime);
    const endMin = timeToMinutes(shift.endTime);

    return timeMin >= startMin && timeMin < endMin;
  };

  const getRequiredCountForSlot = (time: string) => {
    const req = requirements.find((r) => r.timeSlot === time);
    return req?.requiredCount || 0;
  };

  const getActualCountForSlot = (time: string) => {
    return shifts.filter((s) => {
      const timeMin = timeToMinutes(time);
      const startMin = timeToMinutes(s.startTime);
      const endMin = timeToMinutes(s.endTime);
      return timeMin >= startMin && timeMin < endMin;
    }).length;
  };

  const handleOpenEditDialog = (staffId: number) => {
    const existingShift = getShiftForStaff(staffId);
    const availability = getStaffAvailability(staffId);

    setEditingStaffId(staffId);
    if (existingShift) {
      setEditStartTime(existingShift.startTime);
      setEditEndTime(existingShift.endTime);
    } else if (availability) {
      setEditStartTime(availability.startTime);
      setEditEndTime(availability.endTime);
    } else {
      setEditStartTime('09:00');
      setEditEndTime('17:00');
    }
    setEditDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!editingStaffId) return;

    setSaving(true);
    try {
      const existingShift = getShiftForStaff(editingStaffId);

      if (existingShift) {
        // 更新
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
        // 新規作成
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
  };

  const handleDeleteShift = async () => {
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
  };

  const handlePrevDay = () => {
    router.push(
      `/dashboard/shifts/${format(subDays(currentDate, 1), 'yyyy-MM-dd')}?storeId=${selectedStoreId}`
    );
  };

  const handleNextDay = () => {
    router.push(
      `/dashboard/shifts/${format(addDays(currentDate, 1), 'yyyy-MM-dd')}?storeId=${selectedStoreId}`
    );
  };

  const editingStaff = staffList.find((s) => s.id === editingStaffId);
  const editingAvailability = editingStaffId ? getStaffAvailability(editingStaffId) : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-full mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/shifts')}
              className="mb-2 -ml-4 text-[#86868B]"
            >
              ← 月別サマリーに戻る
            </Button>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">日別シフト編集</h2>
          </div>
          {user.role === 'owner' && (
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

        {/* 日付選択 */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handlePrevDay}>
                ← 前日
              </Button>
              <CardTitle className="text-xl text-[#1D1D1F]">
                {format(currentDate, 'yyyy年M月d日', { locale: ja })}
                <span
                  className={`ml-2 ${
                    dayOfWeek === 0
                      ? 'text-red-500'
                      : dayOfWeek === 6
                      ? 'text-blue-500'
                      : ''
                  }`}
                >
                  ({dayOfWeekLabels[dayOfWeek]})
                </span>
              </CardTitle>
              <Button variant="outline" onClick={handleNextDay}>
                翌日 →
              </Button>
            </div>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[#86868B]">読み込み中...</p>
          </div>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-[#D2D2D7]">
                      <th className="sticky left-0 bg-white p-3 text-left text-sm font-medium text-[#86868B] w-[150px] z-10">
                        スタッフ
                      </th>
                      {timeSlots.map((time) => (
                        <th
                          key={time}
                          className="p-1 text-center text-xs font-normal text-[#86868B] min-w-[40px]"
                        >
                          {time.endsWith(':00') ? time.split(':')[0] : ''}
                        </th>
                      ))}
                    </tr>
                    {/* 必要人数行 */}
                    <tr className="border-b border-[#D2D2D7] bg-gray-50">
                      <td className="sticky left-0 bg-gray-50 p-3 text-sm text-[#86868B] z-10">
                        必要人数
                      </td>
                      {timeSlots.map((time) => {
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
                                  ? 'text-green-600'
                                  : status === 'warning'
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
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
                      const shift = getShiftForStaff(staffMember.id);
                      const availability = getStaffAvailability(staffMember.id);

                      return (
                        <tr
                          key={staffMember.id}
                          className="border-b border-[#D2D2D7] hover:bg-[#F5F5F7]"
                        >
                          <td className="sticky left-0 bg-white p-3 z-10">
                            <div
                              className="cursor-pointer"
                              onClick={() => handleOpenEditDialog(staffMember.id)}
                            >
                              <p className="text-sm font-medium text-[#1D1D1F]">
                                {staffMember.name}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    staffMember.role === 'manager'
                                      ? 'border-blue-300 text-blue-700'
                                      : 'border-gray-300 text-gray-600'
                                  }`}
                                >
                                  {staffMember.employmentType === 'employee'
                                    ? '社員'
                                    : 'アルバイト'}
                                </Badge>
                              </div>
                              {!availability && (
                                <p className="text-xs text-red-500 mt-1">勤務不可</p>
                              )}
                            </div>
                          </td>
                          {timeSlots.map((time) => {
                            const isAvailable = isStaffAvailable(staffMember.id, time);
                            const isInShift = isTimeInShift(staffMember.id, time);

                            return (
                              <td
                                key={time}
                                className={`p-0 h-12 ${
                                  isInShift
                                    ? 'bg-[#007AFF]'
                                    : isAvailable
                                    ? 'bg-green-100'
                                    : 'bg-gray-100'
                                }`}
                                onClick={() => handleOpenEditDialog(staffMember.id)}
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
              <div className="flex items-center gap-6 p-4 border-t border-[#D2D2D7]">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#007AFF]" />
                  <span className="text-sm text-[#86868B]">シフト</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100" />
                  <span className="text-sm text-[#86868B]">勤務可能</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100" />
                  <span className="text-sm text-[#86868B]">勤務不可</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* シフト編集ダイアログ */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStaff?.name}さんのシフト
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingAvailability && (
                <div className="text-sm text-[#86868B]">
                  勤務可能時間: {editingAvailability.startTime} 〜 {editingAvailability.endTime}
                </div>
              )}
              {!editingAvailability && (
                <div className="text-sm text-red-500">
                  この曜日は勤務可能時間が設定されていません
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#1D1D1F]">開始時間</label>
                  <Select value={editStartTime} onValueChange={setEditStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1D1D1F]">終了時間</label>
                  <Select value={editEndTime} onValueChange={setEditEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              {getShiftForStaff(editingStaffId || 0) && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteShift}
                  disabled={saving}
                >
                  削除
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleSaveShift}
                  disabled={saving}
                  className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
                >
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
