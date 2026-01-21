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
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import type { SessionUser } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
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

interface ShiftsContentProps {
  user: SessionUser;
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土'];

export function ShiftsContent({ user }: ShiftsContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchShifts();
      fetchRequirements();
    }
  }, [selectedStoreId, currentMonth]);

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

  const fetchShifts = async () => {
    if (!selectedStoreId) return;
    setLoading(true);

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      const res = await fetch(
        `/api/shifts?storeId=${selectedStoreId}&startDate=${start}&endDate=${end}`
      );
      if (res.ok) {
        const data = await res.json();
        setShifts(data);
      }
    } catch (error) {
      console.error('シフト取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequirements = async () => {
    if (!selectedStoreId) return;

    try {
      const res = await fetch(`/api/shift-requirements?storeId=${selectedStoreId}`);
      if (res.ok) {
        const data = await res.json();
        setRequirements(data);
      }
    } catch (error) {
      console.error('必要人数取得エラー:', error);
    }
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // 月初の曜日に合わせて空白を追加
    const startDayOfWeek = getDay(start);
    const emptyDays = Array(startDayOfWeek).fill(null);

    return [...emptyDays, ...days];
  }, [currentMonth]);

  const getShiftCountForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter((s) => s.date === dateStr).length;
  };

  const getRequiredCountForDate = (date: Date) => {
    const dayOfWeek = getDay(date);
    const dayRequirements = requirements.filter((r) => r.dayOfWeek === dayOfWeek);
    // 最大必要人数を返す（簡易的な計算）
    return dayRequirements.length > 0
      ? Math.max(...dayRequirements.map((r) => r.requiredCount))
      : 0;
  };

  const getDateStatus = (date: Date): 'good' | 'warning' | 'danger' | 'none' => {
    const shiftCount = getShiftCountForDate(date);
    const requiredCount = getRequiredCountForDate(date);

    if (requiredCount === 0) return 'none';
    if (shiftCount >= requiredCount) return 'good';
    if (shiftCount >= requiredCount * 0.7) return 'warning';
    return 'danger';
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    router.push(`/dashboard/shifts/${format(date, 'yyyy-MM-dd')}?storeId=${selectedStoreId}`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">シフト作成</h2>
            <p className="text-[#86868B]">月別サマリーと日別編集</p>
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

        {/* 月選択 */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handlePrevMonth}>
                ← 前月
              </Button>
              <CardTitle className="text-xl text-[#1D1D1F]">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}
              </CardTitle>
              <Button variant="outline" onClick={handleNextMonth}>
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
                    return <div key={`empty-${index}`} className="h-24" />;
                  }

                  const dayOfWeek = getDay(day);
                  const status = getDateStatus(day);
                  const shiftCount = getShiftCountForDate(day);
                  const requiredCount = getRequiredCountForDate(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => handleDateClick(day)}
                      className={`h-24 p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        isToday(day)
                          ? 'border-[#007AFF] bg-blue-50'
                          : 'border-[#D2D2D7] hover:border-[#007AFF]'
                      } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`text-sm font-medium ${
                            dayOfWeek === 0
                              ? 'text-red-500'
                              : dayOfWeek === 6
                              ? 'text-blue-500'
                              : 'text-[#1D1D1F]'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        {status !== 'none' && (
                          <div
                            className={`w-2 h-2 rounded-full ${
                              status === 'good'
                                ? 'bg-green-500'
                                : status === 'warning'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                          />
                        )}
                      </div>
                      <div className="mt-2">
                        {shiftCount > 0 && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              status === 'good'
                                ? 'border-green-300 text-green-700 bg-green-50'
                                : status === 'warning'
                                ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
                                : status === 'danger'
                                ? 'border-red-300 text-red-700 bg-red-50'
                                : ''
                            }`}
                          >
                            {shiftCount}名 / {requiredCount}名
                          </Badge>
                        )}
                        {shiftCount === 0 && requiredCount > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-300 text-gray-500"
                          >
                            未設定
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 凡例 */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#D2D2D7]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-[#86868B]">充足</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm text-[#86868B]">やや不足</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-[#86868B]">不足</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 月間統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#86868B]">総シフト数</p>
              <p className="text-2xl font-semibold text-[#1D1D1F]">{shifts.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#86868B]">シフト入力済み日数</p>
              <p className="text-2xl font-semibold text-[#1D1D1F]">
                {new Set(shifts.map((s) => s.date)).size}日
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#86868B]">登録スタッフ数</p>
              <p className="text-2xl font-semibold text-[#1D1D1F]">
                {new Set(shifts.map((s) => s.staffId)).size}名
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#86868B]">今月の残り日数</p>
              <p className="text-2xl font-semibold text-[#1D1D1F]">
                {eachDayOfInterval({ start: new Date(), end: endOfMonth(currentMonth) }).length}日
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
