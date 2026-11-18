'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';

import { changePassword } from '@/lib/api';
import { User } from '@/lib/types';
import { useLogout } from '@/hooks/useCurrentUser';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { inputClass } from '@/components/ui/Input';
import { useTheme } from '@/hooks/useTheme';
import { Choice } from '@/components/ui/Choice';

const field = `mt-1.5 ${inputClass}`;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
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
      <label className="block text-sm font-medium text-ink-2">
        Current password
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); change.reset(); }} className={field} required />
      </label>
      <label className="block text-sm font-medium text-ink-2">
        New password
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); change.reset(); }} className={field} required />
        {tooShort && <span className="mt-1 block text-xs text-warning-ink">Use at least 8 characters.</span>}
      </label>
      <label className="block text-sm font-medium text-ink-2">
        Confirm new password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} required />
        {mismatch && <span className="mt-1 block text-xs text-warning-ink">The passwords don&apos;t match.</span>}
      </label>
      {change.isError && <ErrorBanner error={change.error} />}
      {change.isSuccess && <p role="status" className="text-sm text-success-ink">Password changed.</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={change.isPending} disabled={!current || !next || mismatch || tooShort}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function AppearancePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <Choice
      label="Theme"
      value={preference}
      onChange={setPreference}
      options={[
        { value: 'system', label: 'System', icon: Monitor },
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
      ]}
    />
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
      <Section title="Appearance" description="System follows your device setting.">
        <AppearancePicker />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
      <Section title="Account">
        <dl className="text-sm">
          <dt className="text-ink-3">Email</dt>
          <dd className="mt-0.5 text-ink">{user.email}</dd>
          <dt className="mt-3 text-ink-3">Username</dt>
          <dd className="mt-0.5 text-ink">@{user.username}</dd>
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
