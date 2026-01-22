'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
  differenceInMinutes,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import type { SessionUser } from '@/lib/auth';

interface Shift {
  id: number;
  staffId: number;
  storeId: number;
  date: string;
  startTime: string;
  endTime: string;
  isHelpFromOtherStore: boolean | null;
  createdAt: string;
  storeName: string | null;
}

interface TimeOffRequest {
  id: number;
  staffId: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface StaffInfo {
  id: number;
  name: string;
  hourlyRate: number;
  storeId: number;
  storeName: string | null;
}

interface MyShiftsContentProps {
  user: SessionUser;
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土'];

const timeOffStatusLabels: Record<string, string> = {
  pending: '申請中',
  approved: '承認済',
  rejected: '却下',
};

const timeOffStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

// 勤務時間を計算（分）
function calculateWorkMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

// 分を時間:分の形式にフォーマット
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins > 0 ? `${mins}分` : ''}`;
}

export function MyShiftsContent({ user }: MyShiftsContentProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyShifts();
  }, [currentMonth]);

  const fetchMyShifts = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const res = await fetch(`/api/my-shifts?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts);
        setTimeOffRequests(data.timeOffRequests);
        setStaffInfo(data.staffInfo);
      }
    } catch (error) {
      console.error('マイシフト取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 月間カレンダーの日付を生成
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const startDayOfWeek = getDay(start);
    const emptyDays = Array(startDayOfWeek).fill(null);

    return [...emptyDays, ...days];
  }, [currentMonth]);

  // 週間カレンダーの日付を生成
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const end = endOfWeek(currentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentWeek]);

  // 特定の日付のシフトを取得
  const getShiftForDate = (date: Date): Shift | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.find((s) => s.date === dateStr);
  };

  // 特定の日付の休み希望を取得
  const getTimeOffForDate = (date: Date): TimeOffRequest | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return timeOffRequests.find((r) => r.date === dateStr);
  };

  // 月間の合計勤務時間を計算
  const monthlyStats = useMemo(() => {
    const totalMinutes = shifts.reduce((acc, shift) => {
      return acc + calculateWorkMinutes(shift.startTime, shift.endTime);
    }, 0);

    const shiftCount = shifts.length;
    const estimatedPay = staffInfo ? Math.round((totalMinutes / 60) * staffInfo.hourlyRate) : 0;

    return {
      totalMinutes,
      shiftCount,
      estimatedPay,
    };
  }, [shifts, staffInfo]);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">マイシフト</h2>
            <p className="text-[#86868B]">
              {staffInfo?.storeName || '所属店舗'} - {user.name}
            </p>
          </div>
        </div>

        {/* 月間サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>今月の勤務回数</CardDescription>
              <CardTitle className="text-3xl text-[#1D1D1F]">
                {monthlyStats.shiftCount}<span className="text-lg ml-1">回</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>今月の勤務時間</CardDescription>
              <CardTitle className="text-3xl text-[#1D1D1F]">
                {formatMinutes(monthlyStats.totalMinutes)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>今月の見込み給与</CardDescription>
              <CardTitle className="text-3xl text-[#1D1D1F]">
                ¥{monthlyStats.estimatedPay.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="month" className="space-y-4">
          <TabsList>
            <TabsTrigger value="month">月表示</TabsTrigger>
            <TabsTrigger value="week">週表示</TabsTrigger>
            <TabsTrigger value="list">リスト</TabsTrigger>
          </TabsList>

          {/* 月表示 */}
          <TabsContent value="month">
            <Card className="border-0 shadow-sm">
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
                      const shift = getShiftForDate(day);
                      const timeOff = getTimeOffForDate(day);

                      return (
                        <div
                          key={day.toISOString()}
                          className={`h-24 p-2 border rounded-lg ${
                            isToday(day)
                              ? 'border-[#007AFF] bg-blue-50'
                              : 'border-[#D2D2D7]'
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
                          </div>
                          {shift && (
                            <div className="mt-1 p-1 bg-[#007AFF] text-white rounded text-xs">
                              <div className="font-medium">
                                {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                              </div>
                              {shift.isHelpFromOtherStore && (
                                <Badge className="mt-0.5 bg-orange-500 text-white text-[10px] px-1">
                                  ヘルプ
                                </Badge>
                              )}
                            </div>
                          )}
                          {timeOff && !shift && (
                            <Badge className={`mt-1 text-xs ${timeOffStatusColors[timeOff.status]}`}>
                              {timeOffStatusLabels[timeOff.status]}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 凡例 */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#D2D2D7]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#007AFF] rounded" />
                    <span className="text-sm text-[#86868B]">シフト</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded" />
                    <span className="text-sm text-[#86868B]">ヘルプ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
                    <span className="text-sm text-[#86868B]">休み申請中</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                    <span className="text-sm text-[#86868B]">休み承認済</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 週表示 */}
          <TabsContent value="week">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={handlePrevWeek}>
                    ← 前週
                  </Button>
                  <CardTitle className="text-xl text-[#1D1D1F]">
                    {format(weekDays[0], 'M月d日', { locale: ja })} - {format(weekDays[6], 'M月d日', { locale: ja })}
                  </CardTitle>
                  <Button variant="outline" onClick={handleNextWeek}>
                    翌週 →
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-[#86868B]">読み込み中...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weekDays.map((day) => {
                      const dayOfWeek = getDay(day);
                      const shift = getShiftForDate(day);
                      const timeOff = getTimeOffForDate(day);
                      const workMinutes = shift
                        ? calculateWorkMinutes(shift.startTime, shift.endTime)
                        : 0;

                      return (
                        <div
                          key={day.toISOString()}
                          className={`flex items-center p-4 rounded-lg border ${
                            isToday(day)
                              ? 'border-[#007AFF] bg-blue-50'
                              : 'border-[#D2D2D7] bg-white'
                          }`}
                        >
                          <div className="w-20">
                            <div
                              className={`text-sm font-medium ${
                                dayOfWeek === 0
                                  ? 'text-red-500'
                                  : dayOfWeek === 6
                                  ? 'text-blue-500'
                                  : 'text-[#1D1D1F]'
                              }`}
                            >
                              {format(day, 'M/d (E)', { locale: ja })}
                            </div>
                          </div>
                          <div className="flex-1 ml-4">
                            {shift ? (
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-semibold text-[#1D1D1F]">
                                    {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
                                  </span>
                                  {shift.isHelpFromOtherStore && (
                                    <Badge className="bg-orange-500 text-white">ヘルプ</Badge>
                                  )}
                                </div>
                                <span className="text-[#86868B]">
                                  ({formatMinutes(workMinutes)})
                                </span>
                              </div>
                            ) : timeOff ? (
                              <Badge className={timeOffStatusColors[timeOff.status]}>
                                休み {timeOffStatusLabels[timeOff.status]}
                              </Badge>
                            ) : (
                              <span className="text-[#86868B]">シフトなし</span>
                            )}
                          </div>
                          {shift && staffInfo && (
                            <div className="text-right">
                              <span className="text-sm text-[#86868B]">
                                ¥{Math.round((workMinutes / 60) * staffInfo.hourlyRate).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* リスト表示 */}
          <TabsContent value="list">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={handlePrevMonth}>
                    ← 前月
                  </Button>
                  <CardTitle className="text-xl text-[#1D1D1F]">
                    {format(currentMonth, 'yyyy年M月', { locale: ja })}のシフト
                  </CardTitle>
                  <Button variant="outline" onClick={handleNextMonth}>
                    翌月 →
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-[#86868B]">読み込み中...</p>
                  </div>
                ) : shifts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#86868B]">今月のシフトはありません</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shifts
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((shift) => {
                        const workMinutes = calculateWorkMinutes(shift.startTime, shift.endTime);
                        const date = parseISO(shift.date);

                        return (
                          <div
                            key={shift.id}
                            className={`flex items-center justify-between p-4 rounded-lg border ${
                              isToday(date)
                                ? 'border-[#007AFF] bg-blue-50'
                                : 'border-[#D2D2D7] bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-24">
                                <div className="text-sm font-medium text-[#1D1D1F]">
                                  {format(date, 'M月d日 (E)', { locale: ja })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold text-[#1D1D1F]">
                                  {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
                                </span>
                                {shift.isHelpFromOtherStore && (
                                  <Badge className="bg-orange-500 text-white">ヘルプ</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-[#86868B]">
                                {formatMinutes(workMinutes)}
                              </div>
                              {staffInfo && (
                                <div className="text-sm font-medium text-[#1D1D1F]">
                                  ¥{Math.round((workMinutes / 60) * staffInfo.hourlyRate).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
