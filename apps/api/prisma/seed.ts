/* Seed: owner account, freight categories, blocked words, welcome coupon.
 * Run: pnpm db:seed   (set SEED_OWNER_PHONE and SEED_OWNER_PASSWORD in .env first) */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const taka = (n: number) => Math.round(n * 100);

async function main() {
  const phone = process.env.SEED_OWNER_PHONE ?? '+8801938273878';
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password) throw new Error('Set SEED_OWNER_PASSWORD in .env (min 8 chars, letters + numbers)');

  await prisma.user.upsert({
    where: { phone },
    create: { phone, phoneVerified: true, kind: 'STAFF', roles: ['OWNER'], name: 'Owner', passwordHash: await bcrypt.hash(password, 12) },
    update: { kind: 'STAFF', roles: ['OWNER'] },
  });

  const cats = [
    { code: 'A', nameBn: 'ক্যাটাগরি এ', itemsBn: 'জুতা, ব্যাগ, জুয়েলারি, যন্ত্রপাতি, স্টিকার, ইলেকট্রনিক্স, কম্পিউটার এক্সেসরিজ, সিরামিক, ধাতব, চামড়া, রাবার, প্লাস্টিক জাতীয় পণ্য, ব্যাটারি ছাড়া খেলনা।', airPaisa: taka(760), seaPaisa: taka(170), sortOrder: 1 },
    { code: 'B', nameBn: 'ক্যাটাগরি বি', itemsBn: 'ব্যাটারি জাতীয় যেকোনো পণ্য, ডুপ্লিকেট ব্র্যান্ড বা কপি পণ্য, জীবন্ত উদ্ভিদ, বীজ, রাসায়নিক দ্রব্য, নেটওয়ার্কিং আইটেম, ম্যাগনেট বা লেজার জাতীয় পণ্য।', airPaisa: taka(1150), seaPaisa: taka(450), sortOrder: 2 },
    { code: 'C', nameBn: 'ক্যাটাগরি সি', itemsBn: 'পোশাক / গার্মেন্টস, কিচেন নাইফ, খাদ্যপণ্য, তরল / কসমেটিক্স, শুধু ব্যাটারি বা পাওয়ার ব্যাংক, হিজাব / ওড়না, সানগ্লাস, স্মার্ট ওয়াচ, সাধারণ ঘড়ি, ব্লুটুথ হেডফোন – পণ্য অনুযায়ী আলাদা রেট।', airPaisa: taka(750), seaPaisa: taka(450), sortOrder: 3 },
  ];
  for (const c of cats) await prisma.freightCategory.upsert({ where: { code: c.code }, create: c, update: c });

  for (const keyword of ['sex toy', 'adult toy', '情趣', 'vibrator', 'weapon', 'gun']) {
    await prisma.blockedKeyword.upsert({ where: { keyword }, create: { keyword }, update: {} });
  }

  await prisma.coupon.upsert({
    where: { code: 'WELCOME200' },
    create: { code: 'WELCOME200', type: 'FLAT', value: taka(200), minOrder: taka(2000), firstOrderOnly: true },
    update: {},
  });
  console.log('Seed done. Owner:', phone);
}

main().finally(() => prisma.$disconnect());
