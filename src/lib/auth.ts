import { cookies } from 'next/headers';

// デモユーザー定義
export const DEMO_USERS = {
  owner: {
    id: 1,
    name: '山田太郎',
    role: 'owner' as const,
    storeId: null, // オーナーは全店舗アクセス可能
  },
  manager1: {
    id: 2,
    name: '佐藤花子',
    role: 'manager' as const,
    storeId: 1, // 渋谷店
  },
  manager2: {
    id: 3,
    name: '鈴木一郎',
    role: 'manager' as const,
    storeId: 2, // 新宿店
  },
  manager3: {
    id: 4,
    name: '高橋美咲',
    role: 'manager' as const,
    storeId: 3, // 池袋店
  },
  staff1: {
    id: 5,
    name: '田中健太',
    role: 'staff' as const,
    storeId: 1, // 渋谷店
  },
} as const;

export type DemoUser = (typeof DEMO_USERS)[keyof typeof DEMO_USERS];
export type UserRole = 'owner' | 'manager' | 'staff';

const SESSION_COOKIE_NAME = 'demo_session';

export interface SessionUser {
  id: number;
  name: string;
  role: UserRole;
  storeId: number | null;
}

// セッション取得
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as SessionUser;
  } catch {
    return null;
  }
}

// ログイン
export async function login(userKey: keyof typeof DEMO_USERS): Promise<SessionUser> {
  const user = DEMO_USERS[userKey];
  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7日間
  });

  return sessionUser;
}

// ログアウト
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// 認証チェック（管理者のみ）
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || session.role === 'staff') {
    throw new Error('管理者権限が必要です');
  }
  return session;
}

// 認証チェック（ログイン必須）
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('ログインが必要です');
  }
  return session;
}

// 店舗アクセス権限チェック
export function canAccessStore(user: SessionUser, storeId: number): boolean {
  if (user.role === 'owner') {
    return true;
  }
  return user.storeId === storeId;
}
