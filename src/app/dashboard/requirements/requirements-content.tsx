'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { SessionUser } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
}

interface ShiftRequirement {
  id: number;
  storeId: number;
  dayOfWeek: number;
  timeSlot: string;
  requiredCount: number;
}

interface RequirementsContentProps {
  user: SessionUser;
}

const dayOfWeekLabels = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const dayOfWeekShortLabels = ['日', '月', '火', '水', '木', '金', '土'];

// 30分刻みの時間スロットを生成（6:00〜24:00）
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 6; hour < 24; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  slots.push('24:00');
  return slots;
};

const timeSlots = generateTimeSlots();

export function RequirementsContent({ user }: RequirementsContentProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // デフォルトは月曜日
  const [requirements, setRequirements] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchRequirements();
    }
  }, [selectedStoreId, selectedDayOfWeek]);

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

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/shift-requirements?storeId=${selectedStoreId}&dayOfWeek=${selectedDayOfWeek}`
      );
      if (res.ok) {
        const data: ShiftRequirement[] = await res.json();
        const reqMap = new Map<string, number>();
        data.forEach((r) => {
          reqMap.set(r.timeSlot, r.requiredCount);
        });
        setRequirements(reqMap);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('必要人数取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequirementChange = (timeSlot: string, count: number) => {
    const newRequirements = new Map(requirements);
    if (count <= 0) {
      newRequirements.delete(timeSlot);
    } else {
      newRequirements.set(timeSlot, count);
    }
    setRequirements(newRequirements);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const requirementsArray = Array.from(requirements.entries())
        .filter(([_, count]) => count > 0)
        .map(([timeSlot, requiredCount]) => ({
          timeSlot,
          requiredCount,
        }));

      const res = await fetch('/api/shift-requirements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: parseInt(selectedStoreId),
          dayOfWeek: selectedDayOfWeek,
          requirements: requirementsArray,
        }),
      });

      if (res.ok) {
        setHasChanges(false);
        alert('保存しました');
      } else {
        const error = await res.json();
        alert(error.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToOtherDays = async (targetDays: number[]) => {
    if (!confirm(`選択した曜日に現在の設定をコピーしますか？\n対象: ${targetDays.map(d => dayOfWeekLabels[d]).join(', ')}`)) {
      return;
    }

    setSaving(true);
    try {
      const requirementsArray = Array.from(requirements.entries())
        .filter(([_, count]) => count > 0)
        .map(([timeSlot, requiredCount]) => ({
          timeSlot,
          requiredCount,
        }));

      for (const day of targetDays) {
        await fetch('/api/shift-requirements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: parseInt(selectedStoreId),
            dayOfWeek: day,
            requirements: requirementsArray,
          }),
        });
      }

      alert('コピーしました');
    } catch (error) {
      console.error('コピーエラー:', error);
      alert('コピーに失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const getRequirementColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-blue-100';
    if (count === 2) return 'bg-blue-200';
    if (count === 3) return 'bg-blue-300';
    return 'bg-blue-400';
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">必要人数設定</h2>
            <p className="text-[#86868B]">
              曜日・時間帯ごとに必要なスタッフ人数を設定します
            </p>
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

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-[#1D1D1F]">時間帯別必要人数</CardTitle>
                <CardDescription>
                  各時間帯に必要なスタッフ人数を設定してください
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <Badge className="bg-yellow-100 text-yellow-800">未保存の変更あり</Badge>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
                >
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 曜日タブ */}
            <Tabs
              value={selectedDayOfWeek.toString()}
              onValueChange={(v) => setSelectedDayOfWeek(parseInt(v))}
              className="mb-6"
            >
              <TabsList className="grid grid-cols-7 w-full">
                {dayOfWeekShortLabels.map((label, index) => (
                  <TabsTrigger
                    key={index}
                    value={index.toString()}
                    className={`${
                      index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : ''
                    }`}
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[#86868B]">読み込み中...</p>
              </div>
            ) : (
              <>
                {/* 時間帯グリッド */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
                  {timeSlots.map((timeSlot) => {
                    const count = requirements.get(timeSlot) || 0;
                    return (
                      <div
                        key={timeSlot}
                        className={`p-3 rounded-lg border border-[#D2D2D7] ${getRequirementColor(count)}`}
                      >
                        <div className="text-sm font-medium text-[#1D1D1F] mb-2">
                          {timeSlot}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleRequirementChange(timeSlot, Math.max(0, count - 1))}
                          >
                            -
                          </Button>
                          <span className="text-lg font-semibold w-8 text-center">{count}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleRequirementChange(timeSlot, count + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 一括操作 */}
                <div className="border-t border-[#D2D2D7] pt-4">
                  <h4 className="text-sm font-medium text-[#1D1D1F] mb-3">一括操作</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToOtherDays([1, 2, 3, 4, 5])}
                      disabled={saving}
                    >
                      平日（月〜金）にコピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToOtherDays([0, 6])}
                      disabled={saving}
                    >
                      土日にコピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToOtherDays([0, 1, 2, 3, 4, 5, 6].filter(d => d !== selectedDayOfWeek))}
                      disabled={saving}
                    >
                      全曜日にコピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('すべての時間帯をクリアしますか？')) {
                          setRequirements(new Map());
                          setHasChanges(true);
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      クリア
                    </Button>
                  </div>
                </div>

                {/* 凡例 */}
                <div className="border-t border-[#D2D2D7] pt-4 mt-4">
                  <h4 className="text-sm font-medium text-[#1D1D1F] mb-3">凡例</h4>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-100 border border-[#D2D2D7] rounded" />
                      <span className="text-sm text-[#86868B]">0人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 border border-[#D2D2D7] rounded" />
                      <span className="text-sm text-[#86868B]">1人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-200 border border-[#D2D2D7] rounded" />
                      <span className="text-sm text-[#86868B]">2人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-300 border border-[#D2D2D7] rounded" />
                      <span className="text-sm text-[#86868B]">3人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-400 border border-[#D2D2D7] rounded" />
                      <span className="text-sm text-[#86868B]">4人以上</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 週間サマリー */}
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#1D1D1F]">週間サマリー</CardTitle>
            <CardDescription>各曜日の設定状況を確認できます</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklySummary storeId={selectedStoreId} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// 週間サマリーコンポーネント
function WeeklySummary({ storeId }: { storeId: string }) {
  const [weeklyData, setWeeklyData] = useState<Map<number, ShiftRequirement[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      fetchWeeklyData();
    }
  }, [storeId]);

  const fetchWeeklyData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-requirements?storeId=${storeId}`);
      if (res.ok) {
        const data: ShiftRequirement[] = await res.json();
        const grouped = new Map<number, ShiftRequirement[]>();
        for (let i = 0; i < 7; i++) {
          grouped.set(i, data.filter((r) => r.dayOfWeek === i));
        }
        setWeeklyData(grouped);
      }
    } catch (error) {
      console.error('週間データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-[#86868B]">読み込み中...</p>;
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {dayOfWeekShortLabels.map((label, index) => {
        const dayRequirements = weeklyData.get(index) || [];
        const totalSlots = dayRequirements.length;
        const totalStaff = dayRequirements.reduce((acc, r) => acc + r.requiredCount, 0);

        return (
          <div
            key={index}
            className={`p-3 rounded-lg border border-[#D2D2D7] text-center ${
              totalSlots > 0 ? 'bg-blue-50' : 'bg-gray-50'
            }`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-[#1D1D1F]'
              }`}
            >
              {label}
            </div>
            <div className="text-xs text-[#86868B]">
              {totalSlots > 0 ? (
                <>
                  <div>{totalSlots}枠</div>
                  <div>計{totalStaff}人</div>
                </>
              ) : (
                <div>未設定</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
