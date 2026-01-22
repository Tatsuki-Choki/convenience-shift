'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getDay,
  isToday,
  parseISO,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import type { SessionUser } from '@/lib/auth';

interface DashboardContentProps {
  user: SessionUser;
}

interface Shift {
  id: number;
  staffId: number;
  storeId: number;
  date: string;
  startTime: string;
  endTime: string;
  isHelpFromOtherStore: boolean | null;
  storeName?: string | null;
  staffName?: string | null;
}

interface TimeOffRequest {
  id: number;
  staffId: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土'];

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user.role === 'owner' || user.role === 'manager';

  // 今週の日付範囲を計算
  const weekDays = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 0 });
    const end = endOfWeek(now, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, []);

  useEffect(() => {
    fetchWeeklyData();
  }, []);

  const fetchWeeklyData = async () => {
    setLoading(true);
    try {
      const startDate = format(weekDays[0], 'yyyy-MM-dd');
      const endDate = format(weekDays[6], 'yyyy-MM-dd');

      // スタッフの場合はマイシフトAPI、管理者の場合は店舗シフトAPIを使用
      const res = await fetch(`/api/my-shifts?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
        setTimeOffRequests(data.timeOffRequests || []);
      }
    } catch (error) {
      console.error('週間シフト取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // 今週の勤務統計
  const weeklyStats = useMemo(() => {
    const shiftCount = shifts.length;
    let totalMinutes = 0;

    shifts.forEach((shift) => {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      totalMinutes += (endHour * 60 + endMin) - (startHour * 60 + startMin);
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return {
      shiftCount,
      totalTime: `${hours}時間${mins > 0 ? `${mins}分` : ''}`,
    };
  }, [shifts]);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-2">
            ようこそ、{user.name}さん
          </h2>
          <p className="text-[#86868B]">
            {user.role === 'owner'
              ? '全店舗のシフト管理が可能です'
              : user.role === 'manager'
              ? '担当店舗のシフト管理が可能です'
              : '自分のシフトと休み希望の確認ができます'}
          </p>
        </div>

        {/* クイックアクセス */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isAdmin && (
            <>
              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push('/dashboard/shifts')}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-[#1D1D1F]">シフト作成</CardTitle>
                  <CardDescription className="text-[#86868B]">
                    月別サマリー・日別ガントチャート
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="bg-[#007AFF] text-white">
                    管理者機能
                  </Badge>
                </CardContent>
              </Card>

              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push('/dashboard/staff')}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-[#1D1D1F]">スタッフ管理</CardTitle>
                  <CardDescription className="text-[#86868B]">
                    スタッフ情報・勤務可能時間の管理
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="bg-[#007AFF] text-white">
                    管理者機能
                  </Badge>
                </CardContent>
              </Card>

              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push('/dashboard/requirements')}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-[#1D1D1F]">必要人数設定</CardTitle>
                  <CardDescription className="text-[#86868B]">
                    時間帯別の必要人数を設定
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="bg-[#007AFF] text-white">
                    管理者機能
                  </Badge>
                </CardContent>
              </Card>
            </>
          )}

          <Card
            className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/my-shifts')}
          >
            <CardHeader>
              <CardTitle className="text-lg text-[#1D1D1F]">マイシフト</CardTitle>
              <CardDescription className="text-[#86868B]">
                自分のシフト・勤務時間を確認
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="border-[#D2D2D7] text-[#86868B]">
                全員
              </Badge>
            </CardContent>
          </Card>

          <Card
            className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/time-off')}
          >
            <CardHeader>
              <CardTitle className="text-lg text-[#1D1D1F]">休み希望</CardTitle>
              <CardDescription className="text-[#86868B]">
                休み希望日を入力
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="border-[#D2D2D7] text-[#86868B]">
                全員
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* 今週のシフト */}
        <Card className="mt-8 border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-[#1D1D1F]">今週のシフト</CardTitle>
                <CardDescription className="text-[#86868B]">
                  {format(weekDays[0], 'M月d日', { locale: ja })} - {format(weekDays[6], 'M月d日', { locale: ja })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-[#86868B]">今週の勤務</p>
                  <p className="text-lg font-semibold text-[#1D1D1F]">
                    {weeklyStats.shiftCount}回 / {weeklyStats.totalTime}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/my-shifts')}
                >
                  詳細を見る
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <p className="text-[#86868B]">読み込み中...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayOfWeek = getDay(day);
                  const shift = getShiftForDate(day);
                  const timeOff = getTimeOffForDate(day);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-3 rounded-lg border ${
                        isTodayDate
                          ? 'border-[#007AFF] bg-blue-50'
                          : 'border-[#D2D2D7] bg-white'
                      }`}
                    >
                      <div className="text-center mb-2">
                        <span
                          className={`text-xs font-medium ${
                            dayOfWeek === 0
                              ? 'text-red-500'
                              : dayOfWeek === 6
                              ? 'text-blue-500'
                              : 'text-[#86868B]'
                          }`}
                        >
                          {dayOfWeekLabels[dayOfWeek]}
                        </span>
                        <p
                          className={`text-lg font-semibold ${
                            isTodayDate ? 'text-[#007AFF]' : 'text-[#1D1D1F]'
                          }`}
                        >
                          {format(day, 'd')}
                        </p>
                      </div>

                      {shift ? (
                        <div className="bg-[#007AFF] text-white rounded p-2 text-center">
                          <p className="text-xs font-medium">
                            {shift.startTime.slice(0, 5)}
                          </p>
                          <p className="text-[10px] text-blue-100">〜</p>
                          <p className="text-xs font-medium">
                            {shift.endTime.slice(0, 5)}
                          </p>
                          {shift.isHelpFromOtherStore && (
                            <Badge className="mt-1 bg-orange-500 text-white text-[10px] px-1">
                              ヘルプ
                            </Badge>
                          )}
                        </div>
                      ) : timeOff ? (
                        <div
                          className={`rounded p-2 text-center text-xs ${
                            timeOff.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : timeOff.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {timeOff.status === 'approved'
                            ? '休み'
                            : timeOff.status === 'pending'
                            ? '申請中'
                            : '却下'}
                        </div>
                      ) : (
                        <div className="h-16 flex items-center justify-center">
                          <span className="text-xs text-[#86868B]">-</span>
                        </div>
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
                <span className="text-xs text-[#86868B]">シフト</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded" />
                <span className="text-xs text-[#86868B]">ヘルプ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                <span className="text-xs text-[#86868B]">休み</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
                <span className="text-xs text-[#86868B]">申請中</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
