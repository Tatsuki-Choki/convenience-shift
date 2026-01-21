'use client';

import { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SessionUser } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
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
}

interface StaffListContentProps {
  user: SessionUser;
}

const roleLabels: Record<string, string> = {
  owner: 'オーナー',
  manager: '店長',
  staff: 'スタッフ',
};

const employmentTypeLabels: Record<string, string> = {
  employee: '社員',
  part_time: 'アルバイト',
};

export function StaffListContent({ user }: StaffListContentProps) {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        // 店長の場合は自店舗を選択
        if (user.role === 'manager' && user.storeId) {
          setSelectedStoreId(user.storeId.toString());
        }
      }
    } catch (error) {
      console.error('店舗取得エラー:', error);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let url = '/api/staff';
      if (selectedStoreId && selectedStoreId !== 'all') {
        url += `?storeId=${selectedStoreId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch (error) {
      console.error('スタッフ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStoreName = (storeId: number) => {
    const store = stores.find((s) => s.id === storeId);
    return store?.name || '不明';
  };

  const getSkillLevelBadge = (level: number | null) => {
    if (!level) return null;
    const colors = {
      1: 'bg-gray-100 text-gray-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-green-100 text-green-700',
      4: 'bg-yellow-100 text-yellow-700',
      5: 'bg-red-100 text-red-700',
    };
    return (
      <Badge className={colors[level as keyof typeof colors] || colors[1]}>
        Lv.{level}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">スタッフ管理</h2>
            <p className="text-[#86868B]">スタッフ情報の確認・編集</p>
          </div>
          <Button
            onClick={() => router.push('/dashboard/staff/new')}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white"
          >
            スタッフを追加
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#1D1D1F]">
                スタッフ一覧
                <span className="ml-2 text-sm font-normal text-[#86868B]">
                  ({staffList.length}名)
                </span>
              </CardTitle>
              {user.role === 'owner' && (
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="店舗を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての店舗</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[#86868B]">読み込み中...</p>
              </div>
            ) : staffList.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[#86868B]">スタッフが登録されていません</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">名前</TableHead>
                    {user.role === 'owner' && <TableHead>店舗</TableHead>}
                    <TableHead>役職</TableHead>
                    <TableHead>雇用形態</TableHead>
                    <TableHead>時給</TableHead>
                    <TableHead>スキル</TableHead>
                    <TableHead>入社日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-[#F5F5F7]">
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-[#1D1D1F]">{s.name}</p>
                          {s.notes && (
                            <p className="text-xs text-[#86868B]">{s.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      {user.role === 'owner' && (
                        <TableCell>{getStoreName(s.storeId)}</TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant={s.role === 'staff' ? 'outline' : 'default'}
                          className={
                            s.role === 'owner'
                              ? 'bg-[#FF3B30] text-white'
                              : s.role === 'manager'
                              ? 'bg-[#007AFF] text-white'
                              : 'border-[#D2D2D7] text-[#86868B]'
                          }
                        >
                          {roleLabels[s.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{employmentTypeLabels[s.employmentType]}</TableCell>
                      <TableCell>¥{s.hourlyRate.toLocaleString()}</TableCell>
                      <TableCell>{getSkillLevelBadge(s.skillLevel)}</TableCell>
                      <TableCell>{s.joinedAt}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/staff/${s.id}`)}
                          className="border-[#D2D2D7]"
                        >
                          詳細
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
