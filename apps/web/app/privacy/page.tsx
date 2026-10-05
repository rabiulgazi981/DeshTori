import type { Metadata } from 'next';
import { StaticPage } from '@/components/StaticPage';

export const metadata: Metadata = { title: 'প্রাইভেসি নীতি — DeshTori' };
export default function Page() {
  return <StaticPage title="প্রাইভেসি নীতি" field="privacy" fallback={`আপনার নাম, মোবাইল, ঠিকানা শুধু অর্ডার ও ডেলিভারির কাজে ব্যবহার হয়। আমরা কারো কাছে আপনার তথ্য বিক্রি করি না। পাসওয়ার্ড এনক্রিপ্ট করে রাখা হয়। পেমেন্ট গেটওয়ের কার্ড তথ্য আমাদের সার্ভারে আসে না। অ্যাকাউন্ট মুছতে চাইলে সাপোর্টে জানান।`} />;
}
