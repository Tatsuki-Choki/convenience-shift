'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AvailabilityEditor } from '@/components/staff/availability-editor';

interface Store {
  id: number;
  name: string;
}

interface AvailabilityPattern {
  id: number;
  staffId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Staff {
  id: number;
  storeId: number;
  name: string;
  email: string | null;
  phone: string | null;
  employmentType: 'employee' | 'part_time';
  hourlyRate: number;
  joinedAt: string;
  skillLevel: number | null;
  notes: string | null;
  role: 'owner' | 'manager' | 'staff';
  createdAt: string;
  availabilityPatterns: AvailabilityPattern[];
}

interface StaffDetailContentProps {
  user: SessionUser;
  staffId: number;
}

const roleLabels: Record<string, string> = {
  owner: 'オーナー',
  manager: '店長',
  staff: 'スタッフ',
};

export function StaffDetailContent({ user, staffId }: StaffDetailContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームの状態
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    employmentType: 'part_time' as 'employee' | 'part_time',
    hourlyRate: 1100,
    joinedAt: '',
    skillLevel: 1,
    notes: '',
    role: 'staff' as 'owner' | 'manager' | 'staff',
    storeId: 0,
  });

  useEffect(() => {
    fetchStores();
    fetchStaff();
  }, [staffId]);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
      }
    } catch (error) {
      console.error('店舗取得エラー:', error);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/${staffId}`);
      if (res.ok) {
        const data = await res.json();
        setStaffData(data);
        setFormData({
          name: data.name,
          email: data.email || '',
          phone: data.phone || '',
          employmentType: data.employmentType,
          hourlyRate: data.hourlyRate,
          joinedAt: data.joinedAt,
          skillLevel: data.skillLevel || 1,
          notes: data.notes || '',
          role: data.role,
          storeId: data.storeId,
        });
      } else {
        setError('スタッフが見つかりません');
      }
    } catch (error) {
      console.error('スタッフ取得エラー:', error);
      setError('スタッフの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updatedStaff = await res.json();
        setStaffData({ ...staffData!, ...updatedStaff });
        alert('保存しました');
      } else {
        const errorData = await res.json();
        setError(errorData.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('このスタッフを削除してもよろしいですか？この操作は取り消せません。')) {
      return;
    }

    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/dashboard/staff');
      } else {
        const errorData = await res.json();
        setError(errorData.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      setError('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <Header user={user} />
        <main className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-[#86868B]">読み込み中...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !staffData) {
    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <Header user={user} />
        <main className="max-w-4xl mx-auto p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-red-500">{error}</p>
              <Button
                onClick={() => router.push('/dashboard/staff')}
                className="mt-4"
              >
                スタッフ一覧に戻る
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/staff')}
              className="mb-2 -ml-4 text-[#86868B]"
            >
              ← スタッフ一覧に戻る
            </Button>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">
              {staffData?.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                className={
                  staffData?.role === 'owner'
                    ? 'bg-[#FF3B30] text-white'
                    : staffData?.role === 'manager'
                    ? 'bg-[#007AFF] text-white'
                    : 'border-[#D2D2D7] text-[#86868B]'
                }
              >
                {roleLabels[staffData?.role || 'staff']}
              </Badge>
              <span className="text-[#86868B]">
                {stores.find((s) => s.id === staffData?.storeId)?.name}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info">基本情報</TabsTrigger>
            <TabsTrigger value="availability">勤務可能時間</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-[#1D1D1F]">基本情報</CardTitle>
                <CardDescription>スタッフの基本情報を編集します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">名前</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storeId">店舗</Label>
                    <Select
                      value={formData.storeId.toString()}
                      onValueChange={(value) =>
                        setFormData({ ...formData, storeId: parseInt(value) })
                      }
                      disabled={user.role !== 'owner'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">電話番号</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employmentType">雇用形態</Label>
                    <Select
                      value={formData.employmentType}
                      onValueChange={(value: 'employee' | 'part_time') =>
                        setFormData({ ...formData, employmentType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">社員</SelectItem>
                        <SelectItem value="part_time">アルバイト</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">役職</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'owner' | 'manager' | 'staff') =>
                        setFormData({ ...formData, role: value })
                      }
                      disabled={user.role !== 'owner'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {user.role === 'owner' && (
                          <>
                            <SelectItem value="owner">オーナー</SelectItem>
                            <SelectItem value="manager">店長</SelectItem>
                          </>
                        )}
                        <SelectItem value="staff">スタッフ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">時給（円）</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hourlyRate: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skillLevel">スキルレベル</Label>
                    <Select
                      value={formData.skillLevel.toString()}
                      onValueChange={(value) =>
                        setFormData({ ...formData, skillLevel: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            Lv.{level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinedAt">入社日</Label>
                    <Input
                      id="joinedAt"
                      type="date"
                      value={formData.joinedAt}
                      onChange={(e) =>
                        setFormData({ ...formData, joinedAt: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">備考</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="学生、主婦など"
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    削除
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
                  >
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="availability">
            <AvailabilityEditor
              staffId={staffId}
              initialPatterns={staffData?.availabilityPatterns || []}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
