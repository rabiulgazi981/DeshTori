import type { Metadata } from 'next';
import { StaticPage } from '@/components/StaticPage';

export const metadata: Metadata = { title: 'রিফান্ড নীতি — DeshTori' };
export default function Page() {
  return <StaticPage title="রিফান্ড নীতি" field="refund" fallback={`সাপ্লায়ার পণ্য দিতে না পারলে বা আপনি পরিবর্তিত প্রস্তাবে না বললে সেই অংশের টাকা আপনার ওয়ালেটে ফেরত যাবে। ওয়ালেট থেকে পরের অর্ডারে ব্যবহার বা bKash/ব্যাংকে তুলে নিতে পারবেন।

পণ্য হাতে পাওয়ার ৪৮ ঘণ্টার মধ্যে ছবি/আনবক্সিং ভিডিওসহ অভিযোগ করলে ভাঙা, কম বা ভুল পণ্যের জন্য যাচাই করে ফেরত বা বদলে দেওয়া হবে।`} />;
}
