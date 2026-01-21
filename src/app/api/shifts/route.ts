import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, staff } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireAdmin, getSession, canAccessStore } from '@/lib/auth';

// シフト一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');

    if (!storeId) {
      return NextResponse.json({ error: '店舗IDが必要です' }, { status: 400 });
    }

    const storeIdNum = parseInt(storeId);

    // 店舗アクセス権限チェック
    if (!canAccessStore(session, storeIdNum)) {
      return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
    }

    // 条件を構築
    const conditions = [eq(shifts.storeId, storeIdNum)];

    if (startDate) {
      conditions.push(gte(shifts.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(shifts.date, endDate));
    }
    if (staffId) {
      conditions.push(eq(shifts.staffId, parseInt(staffId)));
    }

    const shiftList = await db
      .select({
        id: shifts.id,
        staffId: shifts.staffId,
        storeId: shifts.storeId,
        date: shifts.date,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        isHelpFromOtherStore: shifts.isHelpFromOtherStore,
        createdAt: shifts.createdAt,
        staffName: staff.name,
        staffRole: staff.role,
        staffEmploymentType: staff.employmentType,
      })
      .from(shifts)
      .leftJoin(staff, eq(shifts.staffId, staff.id))
      .where(and(...conditions));

    return NextResponse.json(shiftList);
  } catch (error) {
    console.error('シフト一覧取得エラー:', error);
    return NextResponse.json({ error: 'シフト一覧の取得に失敗しました' }, { status: 500 });
  }
}

// シフト作成
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();

    const { staffId, storeId, date, startTime, endTime, isHelpFromOtherStore } = body;

    // 必須フィールドチェック
    if (!staffId || !storeId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: '必須フィールドが不足しています' }, { status: 400 });
    }

    // 店舗アクセス権限チェック
    if (!canAccessStore(session, storeId)) {
      return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
    }

    // スタッフの存在確認
    const [staffMember] = await db.select().from(staff).where(eq(staff.id, staffId));
    if (!staffMember) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 });
    }

    const [newShift] = await db.insert(shifts).values({
      staffId,
      storeId,
      date,
      startTime,
      endTime,
      isHelpFromOtherStore: isHelpFromOtherStore || false,
    }).returning();

    return NextResponse.json(newShift, { status: 201 });
  } catch (error) {
    console.error('シフト作成エラー:', error);
    if (error instanceof Error && error.message === '管理者権限が必要です') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'シフトの作成に失敗しました' }, { status: 500 });
  }
}

// シフト一括作成・更新
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();

    const { storeId, date, shifts: shiftData } = body;

    if (!storeId || !date || !Array.isArray(shiftData)) {
      return NextResponse.json({ error: '必須フィールドが不足しています' }, { status: 400 });
    }

    // 店舗アクセス権限チェック
    if (!canAccessStore(session, storeId)) {
      return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
    }

    // 該当日のシフトを削除
    await db.delete(shifts).where(
      and(
        eq(shifts.storeId, storeId),
        eq(shifts.date, date)
      )
    );

    // 新しいシフトを挿入
    if (shiftData.length > 0) {
      const newShifts = shiftData.map((s: { staffId: number; startTime: string; endTime: string; isHelpFromOtherStore?: boolean }) => ({
        staffId: s.staffId,
        storeId,
        date,
        startTime: s.startTime,
        endTime: s.endTime,
        isHelpFromOtherStore: s.isHelpFromOtherStore || false,
      }));

      await db.insert(shifts).values(newShifts);
    }

    // 更新後のシフトを取得
    const updatedShifts = await db
      .select({
        id: shifts.id,
        staffId: shifts.staffId,
        storeId: shifts.storeId,
        date: shifts.date,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        isHelpFromOtherStore: shifts.isHelpFromOtherStore,
        createdAt: shifts.createdAt,
        staffName: staff.name,
        staffRole: staff.role,
        staffEmploymentType: staff.employmentType,
      })
      .from(shifts)
      .leftJoin(staff, eq(shifts.staffId, staff.id))
      .where(and(eq(shifts.storeId, storeId), eq(shifts.date, date)));

    return NextResponse.json(updatedShifts);
  } catch (error) {
    console.error('シフト一括更新エラー:', error);
    if (error instanceof Error && error.message === '管理者権限が必要です') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'シフトの更新に失敗しました' }, { status: 500 });
  }
}
