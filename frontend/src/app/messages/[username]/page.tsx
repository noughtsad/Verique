'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { MessagesView } from '../MessagesView';

export default function MessagesThreadPage() {
  const params = useParams<{ username: string }>();
  return (
    <AppShell rightRail={false} width="xl" fullHeight>
      {(user) => user && <MessagesView currentUser={user} activeUsername={decodeURIComponent(params.username)} />}
    </AppShell>
  );
}
