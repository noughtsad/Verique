'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { clearAuthToken, getCurrentUser } from '@/lib/api';
import { User } from '@/lib/types';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { Sidebar } from '@/app/components/Sidebar';
import { MessagesView } from '../MessagesView';

export default function MessagesThreadPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = params?.username as string;
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setUser(u);
        setAuthChecked(true);
      })
      .catch(async () => {
        await clearAuthToken();
        setUser(null);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (authChecked && !user) {
      router.push('/login');
    }
  }, [authChecked, user, router]);

  return (
    <div className="min-h-screen bg-transparent flex overflow-hidden font-sans">
      <AnimatedCanvas className="fixed inset-0 z-0" interactive={false} />
      <div className="w-full bg-transparent flex overflow-hidden min-h-screen relative z-10">
        <div className="w-[100px] flex-shrink-0 hidden sm:block"></div>
        <Sidebar user={user} onLogout={() => setUser(null)} />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto px-8 py-10 relative">
          <MessagesView currentUser={user} activeUsername={username} />
        </main>
      </div>
    </div>
  );
}
