'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SessionUser } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
}

interface NewStaffContentProps {
  user: SessionUser;
}

export function NewStaffContent({ user }: NewStaffContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    employmentType: 'part_time' as 'employee' | 'part_time',
    hourlyRate: 1100,
    joinedAt: new Date().toISOString().split('T')[0],
    skillLevel: 1,
    notes: '',
    role: 'staff' as 'owner' | 'manager' | 'staff',
    storeId: user.storeId || 0,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        // 店長の場合は自店舗を設定
        if (user.role === 'manager' && user.storeId) {
          setFormData((prev) => ({ ...prev, storeId: user.storeId! }));
        } else if (data.length > 0 && !formData.storeId) {
          setFormData((prev) => ({ ...prev, storeId: data[0].id }));
        }
      }
    } catch (error) {
      console.error('店舗取得エラー:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      setError('名前は必須です');
      return;
    }
    if (!formData.storeId) {
      setError('店舗を選択してください');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newStaff = await res.json();
        router.push(`/dashboard/staff/${newStaff.id}`);
      } else {
        const errorData = await res.json();
        setError(errorData.error || '作成に失敗しました');
      }
    } catch (error) {
      console.error('作成エラー:', error);
      setError('作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/staff')}
            className="mb-2 -ml-4 text-[#86868B]"
          >
            ← スタッフ一覧に戻る
          </Button>
          <h2 className="text-2xl font-semibold text-[#1D1D1F]">
            新規スタッフ登録
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#1D1D1F]">基本情報</CardTitle>
            <CardDescription>新しいスタッフの情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  名前 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="山田太郎"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeId">
                  店舗 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.storeId.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, storeId: parseInt(value) })
                  }
                  disabled={user.role !== 'owner'}
                >
                  <SelectTrigger>
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
                  placeholder="example@mail.com"
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
                  placeholder="090-1234-5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employmentType">
                  雇用形態 <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="hourlyRate">
                  時給（円） <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="joinedAt">
                  入社日 <span className="text-red-500">*</span>
                </Label>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/staff')}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
              >
                {saving ? '作成中...' : 'スタッフを作成'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
