'use client';

import { AppShell } from '@/components/layout/AppShell';
import { MessagesView } from './MessagesView';

export default function MessagesPage() {
  return (
    <AppShell rightRail={false} width="xl" fullHeight>
      {(user) => user && <MessagesView currentUser={user} />}
    </AppShell>
  );
}
