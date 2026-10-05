import Link from 'next/link';

/** Placeholder for pages that are designed but not built yet. */
export function ComingSoon() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden="true">🛠</span>
        <h1 className="text-xl font-bold">এই পেজটা তৈরি হচ্ছে</h1>
        <p className="text-muted">খুব শিগগিরই চালু হবে। জরুরি হলে হটলাইনে কল করুন: 01938-27 38 78</p>
        <Link href="/" className="btn-gold">হোমে ফিরুন</Link>
      </div>
    </div>
  );
}
