'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, Bookmark, Compass, Home as HomeIcon,
  LogOut, MessageCircle, Settings, ShieldCheck, UserCircle
} from 'lucide-react';
import { clearAuthToken } from '@/lib/api';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Sidebar({ user, onLogout }: { user: User | null, onLogout: () => void }) {
  const pathname = usePathname();
  
  // Example state that might need to be passed down if we want the fact check panel globally,
  // but for now we'll just style the button to look active if on the home page and clicked,
  // or we can make it a regular button for this UI component.
  
  return (
    <aside className="fixed top-0 left-0 h-screen w-[100px] hover:w-[240px] z-50 transition-all duration-300 ease-in-out bg-[#18181b]/55 backdrop-blur-xl flex flex-col py-8 overflow-hidden group shadow-xl hidden sm:flex border-r border-white/10">
      {/* User Profile / Logo */}
      <div className="flex items-center px-6 mb-16 w-[240px]">
        {user ? (
          <>
            <Link href={`/profile/${user.username}`} className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-white/10 hover:ring-2 hover:ring-blue-500/50 transition-all">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover bg-white/5" />
            </Link>
            <div className="ml-4 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
              <Link href={`/profile/${user.username}`} className="font-semibold text-white text-[15px] truncate hover:text-blue-300 transition-colors">
                {user.full_name || user.username}
              </Link>
              <span className="text-xs text-slate-400 font-medium truncate">@{user.username}</span>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xl tracking-tight">V</span>
            </div>
            <span className="ml-4 font-semibold text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Verique</span>
          </>
        )}
      </div>

      {/* Nav Icons */}
      <div className="flex flex-col gap-6 text-slate-400 w-[240px]">
        <Link href="/" className={cn("flex items-center px-9 py-3 relative group/btn transition", pathname === '/' ? "text-white hover:bg-white/5" : "hover:text-white hover:bg-white/5")}>
          <HomeIcon className="w-6 h-6 flex-shrink-0" />
          {pathname === '/' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full"></div>}
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Home</span>
        </Link>
        <button className="flex items-center px-9 py-3 hover:text-white hover:bg-white/5 transition group/btn">
          <Compass className="w-6 h-6 flex-shrink-0" />
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Explore Feed</span>
        </button>
        <button className="flex items-center px-9 py-3 hover:text-white hover:bg-white/5 transition group/btn">
          <Bell className="w-6 h-6 flex-shrink-0" />
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Notifications</span>
        </button>
        <button className="flex items-center px-9 py-3 hover:text-white hover:bg-white/5 transition group/btn">
          <MessageCircle className="w-6 h-6 flex-shrink-0" />
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Chat</span>
        </button>
        <Link href={user ? `/profile/${user.username}` : '/login'} className={cn("flex items-center px-9 py-3 relative group/btn transition", pathname.startsWith('/profile') ? "text-white hover:bg-white/5" : "hover:text-white hover:bg-white/5")}>
          <UserCircle className="w-6 h-6 flex-shrink-0" />
          {pathname.startsWith('/profile') && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full"></div>}
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Profile</span>
        </Link>
        <button className="flex items-center px-9 py-3 hover:text-white hover:bg-white/5 transition group/btn">
          <Bookmark className="w-6 h-6 flex-shrink-0" />
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Bookmarks</span>
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-6 text-slate-400 w-[240px]">
        <button className="flex items-center px-9 py-3 hover:text-white hover:bg-white/5 transition group/btn">
          <Settings className="w-6 h-6 flex-shrink-0" />
          <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span>
        </button>
        {user && (
          <button onClick={async () => { await clearAuthToken(); onLogout(); }} className="flex items-center px-9 py-3 hover:text-red-400 hover:bg-white/5 transition group/btn text-slate-400" title="Logout">
            <LogOut className="w-6 h-6 flex-shrink-0" />
            <span className="ml-8 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
