

---
name: karnet-dev
description: "Kârnet geliştirme skill'i — proje bağlamı, mimari kurallar, güvenlik kontrolleri, UX standartları, kod kalite rehberi ve görev yönetimi. Yeni sohbette veya görev başında çağır."
---

# Kârnet Dev — Tam Kapsamlı Geliştirme Skill'i

## 1. PROJE

**Ne:** Türkiye'deki marketplace satıcıları için kâr hesaplama SaaS.
**Kim:** Süleyman Hilmi İşbilir (Hilmi) — tek geliştirici ve kurucu.
**Nerede:** `C:\Users\isbil\Trendyol-1` | GitHub: `hgkings/Trendyol` | Canlı: `www.xn--krnet-3qa.com`
**Deploy:** Vercel — git push ile otomatik. **Hilmi "deploy et" demeden push YASAK.**

### Tech Stack
| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript 5 (strict) |
| Stil | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Validasyon | Zod |
| DB | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (JWT) |
| Ödeme | PayTR 🔒 (Stripe DEĞİL) |
| Email | Brevo SMTP + nodemailer |
| Rate Limit | Upstash Redis |
| Şifreleme | AES-256-GCM |

---

## 2. MİMARİ — 9 KATMAN

```
Katman 1 — UI          app/, components/        Sadece fetch + UI
Katman 2 — Şema        lib/validators/          Zod validasyon
Katman 3 — Gateway     lib/gateway/adapter      Auth, rate limit, trace
Katman 4 — Global      lib/gateway/global       Servis yönlendirme
Katman 5 — Bridge      lib/gateway/bridge       Servis çözümleme
Katman 6 — Logic       services/*.logic.ts      İş mantığı
Katman 7 — DBHelper    lib/db/                  AES-256-GCM şifreleme
Katman 8 — Repository  repositories/            Tek DB erişim noktası
Katman 9 — DB          Supabase PostgreSQL      RLS zorunlu
```

### DEĞİŞMEZ KURAL
```
UI KATMANINDA (app/, components/) HİÇBİR ZAMAN:
- Supabase server/admin importu
- Service importu
- Repository importu
- DB helper importu
- Gateway importu
- SQL sorgusu / tablo adı
BU KURAL DÜNYA YANSA DEĞİŞMEZ.
```

---

## 3. GÖREV BAŞLATMA PROTOKOLÜ

Her görevde bu sıra izlenir — istisnasız:

```
1. CLAUDE.md oku          → Mimari kurallar
2. add.md oku             → Günlük, durum, kalan işler, bekleyen deploy
3. Kullanıcıdan isim al   → Yoksa sor
4. SPEC sun               → Dosyalar, katmanlar, yaklaşım, risk
5. Onay bekle             → Hilmi "go" demeden kod yazılmaz
6. BUILD                  → Sadece onaylanan scope
7. SELF-REVIEW            → Kontrol listesi çalıştır
8. RAPOR                  → add.md'ye kayıt yaz
```

### SPEC Formatı
```
TASK: [ne yapılacak]
LAYERS: [etkilenen katmanlar]
FILES TO CHANGE: [liste]
FILES TO CREATE: [liste]
FILES NOT TOUCHED: [yakın ama dokunulmayacaklar]
APPROACH: [2-3 cümle]
RISK: [edge case, yan etki]
→ Awaiting approval.
```

---

## 4. KORUNAN DOSYALAR 🔒

```
app/api/paytr/callback/route.ts
app/api/paytr/create-payment/route.ts
app/api/verify-payment/route.ts
app/auth/callback/route.ts
middleware.ts
services/payment.logic.ts
repositories/payment.repository.ts
lib/supabase/admin.ts
```

Dokunmak gerekirse → HEMEN DUR → Hilmi'ye söyle → Onay olmadan devam etme.

---

## 5. GÜVENLİK KURALLARI

Bu kurallar hook (karnet-guard v3, 30 kural) ile otomatik denetlenir:

### Kesin Yasak (HATA verir, commit engellenebilir)
- `any` tipi kullanma
- `eval()` / `new Function()`
- UI'da Supabase/Service/Repository import
- `createAdminClient` app/ içinde (helpers.ts ve audit.ts hariç)
- API response'ta `data.session`, `access_token`, `refresh_token` döndürme
- SSRF: `request.headers.get('origin')` ile URL oluşturma
- Auth route'larda user enumeration (409 status, "bulunamadı" mesajı)
- Hardcoded secret/key
- "Stripe" referansı (PayTR kullanılıyor)

### Uyarı (düzeltilmeli ama engellemez)
- `console.log` (console.error/warn izinli)
- Hata yutma (catch without throw/return)
- Zod validasyonu olmayan POST/PATCH API route
- Türkçe karakter hataları (Basarili→Başarılı, Urun→Ürün vb.)
- `<img>` yerine `<Image>` kullanılmalı
- `fetch()` timeout/AbortController yok
- Hardcoded `localhost` URL
- localStorage kullanımında cleanup yok
- Büyük dosya (500+ satır)
- Kullanılmayan import
- `.map()` içinde `key` prop eksik
- return null — empty state mesajı gerekli
- Admin sayfalarında pagination yok
- Şifre validasyonu min 6 (min 8 olmalı)
- API'de İngilizce hata mesajı (Türkçe olmalı)

---

## 6. UX STANDARTLARI

### Sayfa Yapısı
- Marketing/blog sayfaları: Navbar + Footer **zorunlu**
- Dashboard sayfaları: DashboardLayout wrapper **zorunlu**
- Her public page.tsx'te `metadata` export **zorunlu** (SEO)

### Kullanıcı Geri Bildirimi
- Loading state: Her veri çekiminde spinner veya skeleton
- Empty state: Veri yoksa mesaj göster (null dönme)
- Error state: Türkçe hata mesajı + retry imkanı
- Success: toast bildirimi
- Tehlikeli işlem: onay dialogu (silme, plan değiştirme vb.)

### Türkçe Kuralları
- Tüm kullanıcıya görünen metinler Türkçe
- Supabase hata mesajları çevrilmeli
- Para formatı: `Intl.NumberFormat('tr-TR', { currency: 'TRY' })`
- Tarih formatı: `toLocaleDateString('tr-TR')`
- Doğru Türkçe karakterler: ç, ğ, ı, ö, ş, ü, İ

### Güvenlik UX
- Session token body'de dönmez — cookie ile taşınır
- Şifre sıfırlamada generic mesaj (user enumeration engellenir)
- Şifre değiştirmede mevcut şifre sorulmalı
- localStorage'da hassas veri saklanmaz
- logout'ta localStorage temizlenir

---

## 7. YENİ ÖZELLİK EKLEME SIRASI

```
Adım 1 → lib/validators/schemas/  → Zod şeması
Adım 2 → lib/gateway/             → Gateway'e route/tip kayıt
Adım 3 → services/                → Logic servis fonksiyonu
Adım 4 → repositories/            → Repository sorgusu
Adım 5 → app/api/                 → API endpoint (Zod + auth + audit)
Adım 6 → lib/api/                 → UI fetch helper
Adım 7 → app/ + components/       → UI bileşeni
```

Hiçbir adım atlanamaz. Her adım kendi katmanında kalır.

---

## 8. KOD KALİTE REHBERİ

### Yapılacaklar
- TypeScript strict — `tsc --noEmit` sıfır hata
- Her API route'ta: `requireAuth()` + Zod validasyon + audit log
- Hata mesajları Türkçe + generic (detay loglanır, kullanıcıya gösterilmez)
- Her catch bloğu ya throw eder ya return eder
- fetch() çağrılarında AbortController/timeout
- API response'ta sadece gerekli veri — session/token ASLA

### Yapılmayacaklar
- `any` tipi
- `console.log` (production)
- `eval()` / `new Function()`
- MD5 / SHA1
- Pages Router (App Router kullanılıyor)
- Gereksiz abstraction, over-engineering
- Onaysız scope genişletme

---

## 9. SELF-REVIEW KONTROL LİSTESİ

Her görev bitmeden bu listeyi çalıştır:

```
□ Sadece onaylanan dosyalara dokunuldu mu?
□ any tipi kullanıldı mı?                    → kullanılmamalı
□ Hata yakalanıp yutuldu mu?                → yutulmamalı
□ Hardcoded env variable var mı?             → olmamalı
□ app/ içinde Supabase/Service/Repository import var mı? → olmamalı
□ console.log production'a gitti mi?         → gitmemeli
□ tsc --noEmit sıfır hata veriyor mu?
□ Türkçe locale uygulandı mı?
□ API response'ta token/session var mı?      → olmamalı
□ fetch() timeout var mı?                    → olmalı
□ Empty state mesajı var mı?                 → olmalı
□ Loading state var mı?                      → olmalı
□ add.md güncellendi mi?
```

---

## 10. BİLİNEN SORUNLAR VE BEKLEYEN İŞLER

Her zaman `add.md` dosyasını kontrol et — güncel durum orada.

### Güvenlik İyileştirme Planı
| # | Görev | Durum |
|---|-------|-------|
| 2 | npm audit + bağımlılık güncelleme | ✅ |
| 3 | Admin 2FA (Supabase MFA) | ✅ (UI'da "Yakında" olarak kilitli) |
| 4 | Auth proxy + rate limiting | ⚠️ Kod hazır, deploy bekliyor |
| 5 | Cloudflare WAF | Bekliyor |
| 6 | Monitoring/Alerting | Bekliyor |
| 7 | Secret rotation | Bekliyor |
| 8 | Backup/DR testi | Bekliyor |
| 9 | SOC2/KVKK compliance | Bekliyor |
| 10 | Cookie bildirimi | Bekliyor |

### UX Denetim Raporu (39 Bulgu)
3 kritik, 12 yüksek, 14 orta, 10 düşük — detaylar add.md'de.

---

## 11. DEPLOY KURALI

```
⛔ Hilmi açıkça "deploy et" demedikçe git push YASAK.
✅ Commit yapılabilir — local'de kalır.
✅ Push sadece Hilmi'nin onayı ile.
```

Push guard hook (PreToolUse) bu kuralı otomatik denetler.

---

## 12. HOOK SİSTEMİ

### karnet-guard.sh (PostToolUse — Write/Edit sonrası)
30 kurallı kod kalite ve güvenlik denetçisi. Her dosya yazımında otomatik çalışır.
Hata (exit 2) → düzeltilmeden devam edilmez.
Uyarı (exit 0) → bilgi amaçlı, düzeltilmeli.

### push-guard.sh (PreToolUse — Bash öncesi)
git push komutlarını bloklar. Hilmi onayı gerektirir.

---

*Bu skill Kârnet projesinin tüm bilgi birikimini içerir.*
*Yeni konuşmalarda `/karnet-dev` ile çağır.*
