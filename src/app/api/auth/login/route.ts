import { NextRequest, NextResponse } from 'next/server';
import { login, DEMO_USERS } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userKey } = await request.json();

    if (!userKey || !(userKey in DEMO_USERS)) {
      return NextResponse.json(
        { error: '無効なユーザーです' },
        { status: 400 }
      );
    }

    const user = await login(userKey as keyof typeof DEMO_USERS);

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    );
  }
}
