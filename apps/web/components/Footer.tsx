import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-12 bg-navy text-[#C8D3EA]">
      <div className="flex flex-wrap justify-between gap-x-14 gap-y-7 px-4 pb-5 pt-9 md:px-7">
        <div className="max-w-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-footer.png" alt="DeshTori – চীনের বাজার থেকে আপনার দুয়ারে।" className="block h-auto w-full max-w-[330px]" />
        </div>
        <div className="flex flex-col gap-2 text-[15px]">
          <b className="text-white">সাহায্য</b>
          <Link href="/account">অর্ডার ট্র্যাক</Link>
          <Link href="/rates">শিপিং রেট</Link>
          <Link href="/refund-policy">রিফান্ড নীতি</Link>
          <Link href="/rates#banned">নিষিদ্ধ পণ্য</Link>
        </div>
        <div className="flex flex-col gap-2 text-[15px]">
          <b className="text-white">কোম্পানি</b>
          <Link href="/about">আমাদের সম্পর্কে</Link>
          <Link href="/blog">ব্লগ</Link>
          <Link href="/terms">শর্তাবলি</Link>
          <Link href="/privacy">প্রাইভেসি</Link>
        </div>
        <div className="flex max-w-[280px] flex-col gap-2 text-[15px]">
          <b className="text-white">যোগাযোগ</b>
          <a href="mailto:info@deshtori.com">info@deshtori.com</a>
          <a href="tel:+8801938273878">01938273878</a>
          <span className="leading-relaxed">219 West Monipur, Barek Mollar Mor, 60 Feet Road, Mirpur-2, Dhaka-1216</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-gold-light/30 px-4 py-4 text-[13px] md:px-7">
        <span>পেমেন্ট: bKash · Nagad · কার্ড · ব্যাংক</span>
        <span>
          Design &amp; Development by{' '}
          <a href="https://bongshaltech.com/" className="font-bold text-gold-light">BONGSHAL TECH</a> · © 2026 DeshTori
        </span>
      </div>
    </footer>
  );
}
