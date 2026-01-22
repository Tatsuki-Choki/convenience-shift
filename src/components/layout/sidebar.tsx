'use client';

import { memo, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarOff,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/lib/auth';
import { useState } from 'react';

interface SidebarProps {
  user: SessionUser;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  description?: string;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'ダッシュボード',
    icon: LayoutDashboard,
    roles: ['owner', 'manager', 'staff'],
    description: '概要を確認',
  },
  {
    href: '/dashboard/shifts',
    label: 'シフト作成',
    icon: Calendar,
    roles: ['owner', 'manager'],
    description: 'シフトを管理',
  },
  {
    href: '/dashboard/staff',
    label: 'スタッフ管理',
    icon: Users,
    roles: ['owner', 'manager'],
    description: 'スタッフ情報',
  },
  {
    href: '/dashboard/requirements',
    label: '必要人数設定',
    icon: ClipboardList,
    roles: ['owner', 'manager'],
    description: '時間帯別設定',
  },
  {
    href: '/dashboard/my-shifts',
    label: 'マイシフト',
    icon: CalendarDays,
    roles: ['owner', 'manager', 'staff'],
    description: '自分のシフト',
  },
  {
    href: '/dashboard/time-off',
    label: '休み希望',
    icon: CalendarOff,
    roles: ['owner', 'manager', 'staff'],
    description: '休暇申請',
  },
];

const roleLabels: Record<string, string> = {
  owner: 'オーナー',
  manager: '店長',
  staff: 'スタッフ',
};

const NavLink = memo(function NavLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={true}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
        ${isActive
          ? 'bg-[#007AFF] text-white shadow-sm'
          : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
        }
      `}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
          isActive ? 'text-white' : 'text-[#86868B]'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
      </div>
      {isActive && (
        <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60" />
      )}
    </Link>
  );
});

const MobileNavLink = memo(function MobileNavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={true}
      onClick={onClick}
      className={`
        flex items-center gap-4 px-4 py-4 transition-all duration-200 border-b border-[#F5F5F7] last:border-b-0
        ${isActive
          ? 'bg-[#007AFF]/5 text-[#007AFF]'
          : 'text-[#1D1D1F] active:bg-[#F5F5F7]'
        }
      `}
    >
      <Icon
        className={`w-6 h-6 flex-shrink-0 ${
          isActive ? 'text-[#007AFF]' : 'text-[#86868B]'
        }`}
      />
      <div className="flex-1">
        <p className="text-base font-medium">{item.label}</p>
        <p className="text-xs text-[#86868B] mt-0.5">{item.description}</p>
      </div>
      <ChevronRight className={`w-5 h-5 ${isActive ? 'text-[#007AFF]' : 'text-[#D2D2D7]'}`} />
    </Link>
  );
});

export const Sidebar = memo(function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(user.role)),
    [user.role]
  );

  const isActiveLink = useCallback(
    (href: string) => {
      if (href === '/dashboard') {
        return pathname === '/dashboard';
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <>
      {/* デスクトップサイドバー */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E5E5EA] z-30">
        {/* ロゴ */}
        <div className="h-16 flex items-center px-6 border-b border-[#E5E5EA]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-[#1D1D1F]">シフト管理</span>
          </Link>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={isActiveLink(item.href)}
            />
          ))}
        </nav>

        {/* ユーザー情報 */}
        <div className="p-4 border-t border-[#E5E5EA]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#34C759] to-[#30D158] rounded-full flex items-center justify-center text-white font-medium text-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1D1D1F] truncate">{user.name}</p>
              <p className="text-xs text-[#86868B]">{roleLabels[user.role]}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/5"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </Button>
        </div>
      </aside>

      {/* モバイルヘッダー */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] z-40 px-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="text-base font-semibold text-[#1D1D1F]">シフト管理</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2"
        >
          <Menu className="w-6 h-6 text-[#1D1D1F]" />
        </Button>
      </header>

      {/* モバイルメニューオーバーレイ */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          onClick={closeMobileMenu}
        />
      )}

      {/* モバイルスライドメニュー */}
      <div
        className={`
          lg:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white z-50
          transform transition-transform duration-300 ease-out
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* メニューヘッダー */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#E5E5EA]">
          <span className="text-base font-semibold text-[#1D1D1F]">メニュー</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={closeMobileMenu}
            className="p-2"
          >
            <X className="w-6 h-6 text-[#86868B]" />
          </Button>
        </div>

        {/* ユーザー情報 */}
        <div className="px-4 py-4 border-b border-[#E5E5EA] bg-[#F5F5F7]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#34C759] to-[#30D158] rounded-full flex items-center justify-center text-white font-medium">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="text-base font-medium text-[#1D1D1F]">{user.name}</p>
              <p className="text-sm text-[#86868B]">{roleLabels[user.role]}</p>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {filteredNavItems.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              isActive={isActiveLink(item.href)}
              onClick={closeMobileMenu}
            />
          ))}
        </nav>

        {/* ログアウト */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E5E5EA] bg-white">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-center gap-2 text-[#FF3B30] hover:bg-[#FF3B30]/5"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </Button>
        </div>
      </div>
    </>
  );
});
