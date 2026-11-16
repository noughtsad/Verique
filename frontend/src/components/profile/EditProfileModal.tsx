'use client';

import { User } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { ProfileForm } from '@/components/profile/ProfileForm';

export function EditProfileModal({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      {open && <ProfileForm user={user} onSaved={onClose} />}
    </Modal>
  );
}
