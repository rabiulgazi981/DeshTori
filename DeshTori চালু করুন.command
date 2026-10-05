#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  DeshTori — নিজের Mac-এ চালু করুন (ডাবল-ক্লিক করুন)
#  প্রথমবার: Homebrew, Node, pnpm, PostgreSQL, Redis বসাবে (১০–২০ মিনিট)।
#  পরের বার: সরাসরি সাইট চালু হবে।
#  বন্ধ করতে: এই Terminal উইন্ডোতে Control + C চাপুন।
# ─────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

say() { printf "\n\033[1;33m▶ %s\033[0m\n" "$1"; }
ok()  { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; echo "সাহায্যের জন্য এই উইন্ডোর স্ক্রিনশট পাঠান।"; read -r -p "বন্ধ করতে Enter চাপুন…"; exit 1; }
trap 'die "কোথাও সমস্যা হয়েছে (লাইন $LINENO)।"' ERR

echo "DeshTori লোকাল সার্ভার চালু হচ্ছে…"

# 1) Homebrew
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
if ! command -v brew >/dev/null 2>&1; then
  say "Homebrew বসানো হচ্ছে (Mac-এর পাসওয়ার্ড চাইবে, টাইপ করলে দেখা যাবে না — স্বাভাবিক)"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
ok "Homebrew"

# 2) Node 22, pnpm 9, PostgreSQL, Redis
need=()
brew list node@22 >/dev/null 2>&1 || need+=(node@22)
brew list postgresql@16 >/dev/null 2>&1 || need+=(postgresql@16)
brew list redis >/dev/null 2>&1 || need+=(redis)
if [ ${#need[@]} -gt 0 ]; then
  say "বসানো হচ্ছে: ${need[*]}"
  brew install "${need[@]}"
fi
export PATH="$(brew --prefix node@22)/bin:$(brew --prefix postgresql@16)/bin:$PATH"
corepack enable pnpm >/dev/null 2>&1 || npm i -g pnpm@9.12.0
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ok "Node $(node -v), pnpm $(pnpm -v)"

# 3) Database + cache services
say "ডাটাবেস চালু হচ্ছে"
brew services start postgresql@16 >/dev/null 2>&1 || true
brew services start redis >/dev/null 2>&1 || true
for i in $(seq 1 30); do pg_isready -q -h localhost && break; sleep 1; done
pg_isready -q -h localhost || die "PostgreSQL চালু হয়নি"
psql -h localhost -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='deshtori'" | grep -q 1 \
  || psql -h localhost -d postgres -qc "CREATE ROLE deshtori LOGIN PASSWORD 'deshtori' CREATEDB"
psql -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='deshtori'" | grep -q 1 \
  || createdb -h localhost -O deshtori deshtori
ok "PostgreSQL ও Redis"

# 4) Settings files (.env) — only created the first time
FIRST=0
if [ ! -f apps/api/.env ]; then
  FIRST=1
  say "প্রথমবারের সেটআপ"
  echo "অ্যাডমিন (মালিক) অ্যাকাউন্টের জন্য একটা পাসওয়ার্ড দিন (৮+ অক্ষর, অক্ষর ও সংখ্যা মিলিয়ে)।"
  while true; do
    read -r -s -p "পাসওয়ার্ড: " P1; echo
    read -r -s -p "আবার লিখুন: " P2; echo
    if [ "$P1" = "$P2" ] && [ ${#P1} -ge 8 ] && [[ "$P1" =~ [A-Za-z] ]] && [[ "$P1" =~ [0-9] ]]; then break; fi
    echo "মেলেনি বা দুর্বল — আবার চেষ্টা করুন।"
  done
  SECRET="$(openssl rand -hex 32)"
  sed -e "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" \
      -e "s|^SEED_OWNER_PASSWORD=.*|SEED_OWNER_PASSWORD=$P1|" \
      apps/api/.env.example > apps/api/.env
  chmod 600 apps/api/.env
  cp apps/web/.env.example apps/web/.env.local
  ok ".env তৈরি হয়েছে (শুধু এই কম্পিউটারে থাকবে)"
fi

# 5) Packages + database tables
say "প্যাকেজ বসানো হচ্ছে (প্রথমবার কয়েক মিনিট লাগবে)"
pnpm install
pnpm --filter @deshtori/shared build
(cd apps/api && pnpm exec prisma db push --skip-generate >/dev/null && pnpm exec prisma generate >/dev/null)
ok "ডাটাবেস টেবিল প্রস্তুত"
if [ "$FIRST" = "1" ]; then
  set -a; . apps/api/.env; set +a
  pnpm --filter @deshtori/api prisma:seed
  ok "মালিকের অ্যাকাউন্ট, শিপিং রেট ও নমুনা কুপন তৈরি"
fi

# 6) Start
say "সাইট চালু হচ্ছে…"
echo "  ওয়েবসাইট:      http://localhost:3000"
echo "  অ্যাডমিন প্যানেল: http://localhost:3000/admin   (মোবাইল 01938273878 + আপনার পাসওয়ার্ড)"
echo "  লগইনের OTP কোড SMS-এ যাবে না — লগইন পেজে আর এই উইন্ডোতে দেখাবে।"
echo "  বন্ধ করতে: Control + C"
( for i in $(seq 1 90); do curl -sf http://localhost:3000 >/dev/null 2>&1 && open http://localhost:3000 && break; sleep 2; done ) &
trap - ERR
pnpm dev
