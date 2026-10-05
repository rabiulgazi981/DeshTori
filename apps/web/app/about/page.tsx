import type { Metadata } from 'next';
import { StaticPage } from '@/components/StaticPage';

export const metadata: Metadata = { title: 'আমাদের সম্পর্কে — DeshTori' };
export default function Page() {
  return <StaticPage title="আমাদের সম্পর্কে" field="about" fallback={`DeshTori Door To Door — চীনের বাজার থেকে আপনার দুয়ারে।

আমরা বাংলাদেশের ছোট-বড় উদ্যোক্তাদের জন্য 1688 ও Taobao থেকে পণ্য কিনে দিই এবং নিজস্ব চায়না গুদাম হয়ে Air ও Sea-তে বাংলাদেশে পৌঁছে দিই। আপনি বাংলা টাকায় লাইভ দাম দেখে আমাদের সাইটেই অর্ডার করেন; আমাদের চায়না টিম একই স্পেসিফিকেশনের পণ্য উপযুক্ত সাপ্লায়ার থেকে কিনে, চেক করে পাঠায়।

DeshTori — A Sister Concern of Quick Clear Door To Door Service.
ঠিকানা: 219 West Monipur, Barek Mollar Mor, 60 Feet Road, Mirpur-2, Dhaka-1216
ফোন: 01938-27 38 78 · ইমেইল: info@deshtori.com`} />;
}
