'use client';
import { MediaBrowser } from '@/components/admin/media';
import { PageHead, Panel } from '@/components/admin/ui';
import { can, useMe } from '@/components/admin/me';

export default function MediaLibrary() {
  const me = useMe();
  return (
    <>
      <PageHead title="মিডিয়া লাইব্রেরি" />
      <Panel>
        <p className="text-sm text-muted">ব্যানার, ব্লগ, ক্যাটাগরি — সব ছবি এখানে রাখুন। ফর্মে “🖼 বাছুন” চাপলে এখান থেকেই ছবি নেওয়া যাবে।</p>
        <MediaBrowser allowScopes={can(me, ['OWNER'])} />
      </Panel>
    </>
  );
}
