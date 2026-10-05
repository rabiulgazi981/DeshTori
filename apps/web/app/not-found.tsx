import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-5xl font-bold text-gold">৪০৪</span>
        <h1 className="text-xl font-bold">পেজটা পাওয়া যায়নি</h1>
        <Link href="/" className="btn-gold">হোমে ফিরুন</Link>
      </div>
    </div>
  );
}
