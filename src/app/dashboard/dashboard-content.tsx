'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SessionUser } from '@/lib/auth';

interface DashboardContentProps {
  user: SessionUser;
}

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter();

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
          {(user.role === 'owner' || user.role === 'manager') && (
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

              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

        {/* 今後の予定（プレースホルダー） */}
        <Card className="mt-8 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#1D1D1F]">今週のシフト</CardTitle>
            <CardDescription className="text-[#86868B]">
              データベース接続後に表示されます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 bg-[#F5F5F7] rounded-lg flex items-center justify-center text-[#86868B]">
              シフトデータがここに表示されます
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
