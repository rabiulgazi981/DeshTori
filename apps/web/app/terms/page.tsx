import type { Metadata } from 'next';
import { StaticPage } from '@/components/StaticPage';

export const metadata: Metadata = { title: 'শর্তাবলি — DeshTori' };
export default function Page() {
  return <StaticPage title="শর্তাবলি" field="terms" fallback={`১. অর্ডারের মুহূর্তের দাম ও রেট অর্ডারে লক থাকে।
২. অগ্রিম পেমেন্টের পরই ক্রয় শুরু হয়। বাকি টাকা পণ্য বাংলাদেশে পৌঁছালে দিতে হয়।
৩. শিপিং চার্জ বাংলাদেশে পৌঁছানোর পর প্রকৃত ওজন অনুযায়ী হিসাব হয়।
৪. সাপ্লায়ারের স্টক বা দামে সমস্যা হলে আপনার হ্যাঁ/না সিদ্ধান্ত নিয়েই কাজ হবে।
৫. নিষিদ্ধ পণ্য অর্ডার বা শিপ করা যাবে না।
৬. ডেলিভারির সময় দেশের বাইরের পরিস্থিতি (কাস্টমস, ফ্লাইট) অনুযায়ী বদলাতে পারে।`} />;
}
