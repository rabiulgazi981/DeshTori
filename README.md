# DeshTori Door To Door

**চীনের বাজার থেকে আপনার দুয়ারে।** — 1688 / Taobao থেকে বাংলাদেশে সোর্সিং, শিপিং ও ডেলিভারির ওয়েবসাইট।

ডিজাইন: https://claude.ai/artifact/AiU1ePCF1iqom4EdHULVBs

## গঠন (monorepo)

| ফোল্ডার | কী | টেকনোলজি |
|---|---|---|
| `apps/web` | কাস্টমারের ওয়েবসাইট + অ্যাডমিন প্যানেল (`/admin`) – deshtori.com | Next.js 14, Tailwind |
| `apps/api` | Backend API – api.deshtori.com | NestJS, Prisma, PostgreSQL, Redis |
| `packages/shared` | দাম, স্ট্যাটাস, বাংলা ফরম্যাট – দুই দিকেই একই হিসাব | TypeScript (টেস্টসহ) |

### নিয়ম যা কোডে মানা হয়েছে
- টাকা সবসময় **পয়সায় integer** (৳১ = ১০০)। ইউয়ান ফেনে। কখনো float না।
- দাম: `BDT = CNY × রেট × (1 + মার্জিন%)`, প্রতি পিস পূর্ণ টাকায় উপরের দিকে রাউন্ড। রেট/মার্জিন অ্যাডমিন থেকে।
- কাস্টমারকে কখনো চীনের দাম বা ¥ রেট পাঠানো হয় না (API থেকেই বাদ)।
- অর্ডারের মুহূর্তে রেট, মার্জিন, দাম **লক**।
- অ্যাডভান্স ৬০/৮০/১০০% – ছাড় শুধু পণ্যের দামে। Air ও Sea আলাদা অর্ডার।
- নতুন কাস্টমার: একবার OTP → পাসওয়ার্ড সেট। পুরনো: পাসওয়ার্ডে লগইন (SMS খরচ বাঁচাতে)। স্টাফ: পাসওয়ার্ড + OTP (2FA)।
- ৫ বার ভুল পাসওয়ার্ড → ১৫ মিনিট লক। OTP: ৬০ সেকেন্ডে ১টা, দিনে ৫টা।
- সব API key শুধু সার্ভারের `.env`-এ। ব্রাউজারে কখনো না।
- টাকার এন্ট্রি মুছে না; সব পরিবর্তন অডিট লগে।

## লোকাল কম্পিউটারে চালানো

### Mac — সবচেয়ে সহজ
ফোল্ডারের **`DeshTori চালু করুন.command`** ফাইলে ডাবল-ক্লিক করুন। প্রথমবার Homebrew, Node 22, PostgreSQL, Redis বসাবে, অ্যাডমিন পাসওয়ার্ড চাইবে, তারপর সাইট খুলে দেবে। পরের বার শুধু ডাবল-ক্লিক।
(Mac যদি “unidentified developer” বলে: ফাইলে রাইট-ক্লিক → Open → Open।)

### হাতে চালাতে চাইলে
দরকার: Node 20+, pnpm 9, PostgreSQL 16, Redis (না থাকলেও চলে)।

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # SEED_OWNER_PASSWORD ও JWT_SECRET বসান
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                   # Docker থাকলে: PostgreSQL + Redis
pnpm db:push                                 # টেবিল তৈরি
pnpm db:seed                                 # মালিকের অ্যাকাউন্ট, ফ্রেইট রেট, কুপন
pnpm dev                                     # web: http://localhost:3000  api: http://localhost:4000/api
```

- অ্যাডমিন: http://localhost:3000/admin — মোবাইল `01938273878` + আপনার পাসওয়ার্ড, তারপর OTP (ডেভেলপমেন্টে লগইন পেজেই দেখায়)।
- ডেভেলপমেন্টে SMS যায় না; `GATEWAY_MOCK=true` থাকলে “টেস্ট পেমেন্ট” বাটনে পেমেন্ট পরীক্ষা করা যায়।
- প্রোডাক্ট ডেটা আসে নমুনা (mock) প্রোভাইডার থেকে, যতদিন আসল API ঠিক না হয়।

## আসল পণ্যের ডেটা (1688 / Taobao)

| প্রোভাইডার (RapidAPI) | `PRODUCT_PROVIDER` | অবস্থা (২০২৬-১০-০৫ লাইভ টেস্ট) |
|---|---|---|
| **Alibaba 1688 API** (dataapiman) | `alibaba-1688` | ✅ 1688 সার্চ + বিস্তারিত: ছবি, দাম, দামের টিয়ার, স্টক, ওজন, দোকান। ❌ রং/মডেলের তালিকা দেয় না |
| Taobao DataHub (ecommdatahub) | `taobao-datahub` | ✅ সার্চ, ❌ বিস্তারিত (সব পণ্যে "no results") |

চালু করতে `apps/api/.env`-এ:
```
PRODUCT_PROVIDER=alibaba-1688
RAPIDAPI_KEY=<আপনার নতুন key>      # শুধু সার্ভারে, কখনো GitHub-এ না
PRODUCT_CACHE_MINUTES=1440          # ফ্রি প্ল্যানে মাসে ৫০টা রিকোয়েস্ট — ক্যাশ লম্বা রাখুন
```
- 1688-এর পণ্যে ভেরিয়েন্টের তালিকা আসে না, তাই প্রোডাক্ট পেজে একটা অপশন + **"রং / মডেল / সাইজ"** লেখার ঘর। লেখাটা কার্ট, অর্ডার, ইনভয়েস আর চায়না টিমের ক্রয় তালিকায় দেখায়।
- ভেরিয়েন্টভেদে দাম আলাদা হলে (¥0.60–1.50) **সবচেয়ে বেশি দাম** ধরা হয়, যাতে লোকসান না হয়।
- এই API-তে পেজিং/সাজানো নেই: প্রথম পাতায় ৬০টা পণ্য।
- বিস্তারিতের গঠন না মিললে API লগে কারণ লেখা থাকে। নতুন প্রোভাইডার: `apps/api/src/products/provider.ts`-এর `ProductProvider` মেনে ক্লাস + `products.service.ts`-এর `createProvider()`।

## যা হয়েছে (v0.2)
- [x] দাম, টিয়ার, অ্যাডভান্স, কুপন, ফ্রেইট, বিল – shared প্যাকেজ + টেস্ট
- [x] লগইন: নতুন গ্রাহক একবার OTP → পাসওয়ার্ড; স্টাফ পাসওয়ার্ড + OTP; লক, রিসেট
- [x] সার্চ (নাম/লিংক/ছবি), প্রোডাক্ট পেজ, উইশলিস্ট, কার্ট, চেকআউট (Air/Sea আলাদা অর্ডার)
- [x] পেমেন্ট: bKash গেটওয়ে, SSLCommerz (কার্ড/Nagad/ব্যাংক), ওয়ালেট, ম্যানুয়াল TrxID + স্ক্রিনশট; ডাবল-ক্রেডিট সুরক্ষা
- [x] অর্ডার পেজ: ধাপ, টাইমলাইন, QC ছবি, বিল, বাকি পরিশোধ, অভিযোগ
- [x] সাপ্লায়ার সমস্যায় হ্যাঁ/না লিংক (SMS, লগইন ছাড়া), রিমাইন্ডার
- [x] শুধু শিপিং (Ship for me): ফর্ম, গুদামের ঠিকানা কপি, কার্টন/পিস যাচাই, ওজন থেকে বিল
- [x] শিপমেন্ট (ফ্লাইট/জাহাজ) — একসাথে অনেক অর্ডার পাঠানো ও পৌঁছানো, সবাইকে SMS
- [x] ইনভয়েস (একাধিক অর্ডার, প্রিন্ট/PDF, স্বাক্ষর “অনুমোদনকারী, DeshTori”)
- [x] ওয়ালেট, রিফান্ড, উত্তোলন; সাপোর্ট টিকেট; কোটেশন
- [x] অ্যাডমিন প্যানেল (রোল অনুযায়ী মেনু): ড্যাশবোর্ড, অর্ডার (একসাথে স্ট্যাটাস), পেমেন্ট যাচাই, ক্রয় তালিকা, পার্সেল, শিপমেন্ট, ইনভয়েস, গ্রাহক ও ওয়ালেট, সাপোর্ট/অভিযোগ, অসমাপ্ত কার্ট, কুপন, হিসাব (লেজার, CSV, উত্তোলন), ওয়েবসাইট কনটেন্ট (ব্যানার, ভিডিও, ক্যাটাগরি, সেবা, পপআপ, ক্যাম্পেইন, যোগাযোগ, গুদাম, SEO, পেজ, ব্লগ, SMS টেমপ্লেট), রেট/নোটিশ/নিষিদ্ধ, স্টাফ ও অডিট লগ
- [x] ব্লগ, স্ট্যাটিক পেজ, sitemap.xml, robots.txt, SEO মেটা, মোবাইল বটম মেনু
- [x] CI: টাইপচেক, বিল্ড, ১০০+ ধাপের end-to-end টেস্ট, ৩৯০px ও ডেস্কটপ স্ক্রিনশট

## বাকি
- [x] 1688 আসল ডেটা (RapidAPI Alibaba 1688 API) — সার্চ ও বিস্তারিত, লাইভ রেসপন্সে টেস্ট করা
- [ ] Taobao-র কাজের বিস্তারিত API (DataHub-এর বিস্তারিত ভাঙা); ছবি দিয়ে খোঁজা
- [ ] পেইড প্ল্যান (ফ্রি: মাসে ৫০ রিকোয়েস্ট)
- [ ] Nagad সরাসরি গেটওয়ে (এখন SSLCommerz দিয়ে Nagad চলে)
- [ ] WhatsApp Business API ও ইমেইল নোটিফিকেশন (এখন SMS + WhatsApp লিংক)
- [ ] সার্ভারে লাইভ করা (VPS, ডোমেইন, SSL)
- [ ] Android অ্যাপ

---
Design & Development by [BONGSHAL TECH](https://bongshaltech.com/) · © 2026 DeshTori

## Dashboard থেকে API ও website control

Owner-এর নতুন দুটি menu:
- `/admin/integrations`: Product provider (mock / RapidAPI Alibaba 1688 / experimental Taobao DataHub), cache time, SMS provider ও Sender ID, bKash / SSLCommerz credentials ও Sandbox/Live environment।
- `/admin/appearance`: primary/accent/secondary/background colors, header/footer logo upload, default Light/Dark/System theme, image-search button, shipping navigation ও mobile bottom navigation।

Server-এ `INTEGRATIONS_ENCRYPTION_KEY` হিসেবে ৩২+ random character সেট করুন (অথবা বিদ্যমান ৩২+ character JWT_SECRET fallback)। Key স্থায়ী রাখুন; database backup-এর সঙ্গে encryption key নিরাপদভাবে রাখুন। Credentials AES-256-GCM encrypted হয়; dashboard শুধু configured status দেখায় এবং audit log-এ credentials যায় না। খালি password input পুরোনো key রাখে, explicit clear server environment fallback-ও নিষ্ক্রিয় করে। Dashboard-এ override না থাকলে পুরোনো environment configuration কাজ করে।

Product API test একটি search request করতে পারে (quota খরচ), Alpha SMS test শুধু balance দেখে। Payment gateway configuration live transaction validation নয়। Pending gateway session শেষ হওয়ার আগে credentials/environment পরিবর্তন করবেন না। Appearance পরের page load-এ কার্যকর; visitor-এর নিজস্ব theme choice default-এর আগে ব্যবহৃত হয়। Navigation switch feature access বন্ধ করে না।

1688 adapters PR #4 থেকে পুনর্ব্যবহার করা হয়েছে। বর্তমান provider-এ full variant list, image search, pagination/sorting নেই; Taobao details experimental। নতুন arbitrary provider URL অথবা Hiobuy adapter এই dashboard-এর অংশ নয়। Generic HTTP SMS URL এখনো server environment থেকে আসে।

Validation: `pnpm test:dashboard` (API build + dashboard credential/settings tests)।
# Render demo deployment

Deploy the `codex/dashboard-integrations-appearance` branch as a Node Web Service
from the repository root. Build with:

```sh
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @deshtori/shared build && pnpm --filter @deshtori/api build && pnpm --filter @deshtori/web build
```

Start with `node scripts/render-start.cjs`. Set `NODE_ENV=production`,
`NEXT_PUBLIC_API_URL=/api`, `INTERNAL_API_URL=http://127.0.0.1:4000/api`,
`DATABASE_URL` to the Neon pooled connection, and distinct random secrets of at
least 32 characters for `JWT_SECRET` and `INTEGRATIONS_ENCRYPTION_KEY`.
Set `SEED_OWNER_PHONE` and `SEED_OWNER_PASSWORD` to initialize the owner and
default freight settings on an empty database. Remove the seed password after
the first successful deployment. Never commit secrets.

The startup script uses a direct connection for versioned Prisma migrations,
refuses to migrate an existing database without migration history, and only
seeds when there are no users. Render's external URL supplies the public API
URL and allowed web origin. Next.js proxies `/api` to Nest on port 4000, so
session cookies stay on the website's origin.

Free hosting is for demos: uploads on Render's local filesystem disappear on
restart or redeployment. Add durable object storage before taking customer
uploads. Real SMS, product providers and payment gateways require separately
configured credentials; production console SMS deliberately refuses OTP sends.
