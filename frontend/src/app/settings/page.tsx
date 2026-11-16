'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { changePassword } from '@/lib/api';
import { User } from '@/lib/types';
import { useLogout } from '@/hooks/useCurrentUser';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageHeader } from '@/components/ui/PageHeader';

const field =
  'mt-1.5 w-full rounded-lg border border-line bg-black/20 px-3 py-2.5 text-sm text-white focus:border-accent/60 focus:outline-none';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
    },
  });
  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < 8;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!mismatch && !tooShort) change.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-300">
        Current password
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); change.reset(); }} className={field} required />
      </label>
      <label className="block text-sm font-medium text-zinc-300">
        New password
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); change.reset(); }} className={field} required />
        {tooShort && <span className="mt-1 block text-xs text-amber-300">Use at least 8 characters.</span>}
      </label>
      <label className="block text-sm font-medium text-zinc-300">
        Confirm new password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} required />
        {mismatch && <span className="mt-1 block text-xs text-amber-300">The passwords don&apos;t match.</span>}
      </label>
      {change.isError && <ErrorBanner error={change.error} />}
      {change.isSuccess && <p role="status" className="text-sm text-emerald-300">Password changed.</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={change.isPending} disabled={!current || !next || mismatch || tooShort}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function SettingsView({ user }: { user: User }) {
  const logout = useLogout();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <Section title="Profile" description="How other people see you.">
        <ProfileForm user={user} />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
      <Section title="Account">
        <dl className="text-sm">
          <dt className="text-zinc-400">Email</dt>
          <dd className="mt-0.5 text-white">{user.email}</dd>
          <dt className="mt-3 text-zinc-400">Username</dt>
          <dd className="mt-0.5 text-white">@{user.username}</dd>
        </dl>
        <Button variant="secondary" className="mt-5" onClick={logout}>
          <LogOut aria-hidden className="h-4 w-4" /> Log out
        </Button>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return <AppShell>{(user) => user && <SettingsView user={user} />}</AppShell>;
}
