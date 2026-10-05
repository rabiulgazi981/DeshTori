import Link from 'next/link';

export default function PayResult({ searchParams }: { searchParams: { ok?: string; order?: string } }) {
  const ok = searchParams.ok === '1';
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-5xl" aria-hidden="true">{ok ? '✅' : '⚠️'}</span>
        <h1 className="text-2xl font-bold">{ok ? 'পেমেন্ট সফল হয়েছে' : 'পেমেন্ট হয়নি'}</h1>
        <p className="text-muted">{ok ? 'ধন্যবাদ! আপনার অর্ডারের কাজ শুরু হচ্ছে। SMS-এ আপডেট পাবেন।' : 'টাকা কাটা হলে চিন্তা করবেন না — হটলাইনে কল করুন 01938-27 38 78। আবার চেষ্টা করতে পারেন।'}</p>
        {searchParams.order && <Link href={`/account/orders/${searchParams.order}`} className="btn-gold">অর্ডার {searchParams.order} দেখুন</Link>}
        <Link href="/account" className="underline">আমার অ্যাকাউন্ট</Link>
      </div>
    </div>
  );
}
