---
name: karnet-context
description: Kârnet proje bağlamı — marketplace satıcıları için kâr hesaplama SaaS. 9 katmanlı mimari, tech stack, bilinen sorunlar, korunan dosyalar ve geliştirme kuralları. Yeni konuşmalarda proje bağlamını hızlıca yüklemek için kullan.
---

# Kârnet — Proje Bağlamı

## Proje Nedir?
Kârnet, Türkiye'deki marketplace satıcılarının (Trendyol, Hepsiburada, n11, Amazon TR) gerçek net kârını hesaplayan SaaS platformu.

**Kurucu:** Süleyman Hilmi İşbilir (tek geliştirici)
**GitHub:** hgkings/Trendyol
**Canlı:** www.xn--krnet-3qa.com (Vercel, git push ile otomatik deploy)
**Proje dizini:** C:\Users\isbil\Trendyol-1

---

## Tech Stack
| Kategori | Teknoloji |
|----------|-----------|
| Framework | Next.js 13.5 (App Router) |
| Dil | TypeScript 5 |
| Stil | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Validasyon | Zod |
| Veritabanı | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT) |
| Ödeme | PayTR 🔒 |
| Email | Brevo SMTP |
| Rate Limit | Upstash Redis |
| Deploy | Vercel |

---

## 9 Katmanlı Mimari (Özet)

```
1. UI (app/, components/)     → Sadece fetch + UI kodu
2. Şema (lib/validators/)     → Zod validasyon
3. Gateway (lib/gateway/)     → Proxy, auth, rate limit
4. Global Service             → İstek yönlendirme
5. Service Bridge             → Servis köprüsü
6. Logic Services (services/) → İş mantığı
7. DB Helper (lib/db/)        → AES-256-GCM şifreleme
8. Repository (repositories/) → Tek DB erişim noktası
9. Veritabanı (Supabase)      → PostgreSQL + RLS
```

### Temel Kural
UI katmanında (app/, components/) **kesinlikle** DB kodu, Supabase import, Repository/Service import **YASAK**.

---

## V1 Uyumluluk Notları
- Next.js 13.5 → `cookies()` senkron, `await cookies()` DEĞİL
- `callGatewayV1Format()` → veriyi direkt döner (UI uyumlu)
- `callGateway()` → `{success, data, traceId}` döner (V2 format)
- Supabase client singleton: `lib/supabase/client.ts`

---

## 9 Katmanlı Refactor Durumu (2026-03)
**Tamamlanan:**
- repositories/ (10 dosya), services/*.logic.ts (11 dosya), lib/gateway/ (4 dosya) eklendi
- 50+ API route `callGatewayV1Format` pattern'e geçirildi
- 11 UI dosyasından doğrudan Supabase importu kaldırıldı
- dal/ klasörü ve eski servisler silindi
- 167 dosya değişikliği, GitHub'a push edildi

**Bilinen Sorunlar / TODO:**
1. `commission_rates` 406 hatası — Supabase'e doğrudan çağrı yapan yer var (mimari ihlali)
2. Başabaş sayfası — premium tasarıma geçirilecek (başlandı, bitmedi)
3. Hero kartına scroll animasyonu — planlandı, yapılmadı
4. `cash-plan` sayfası — Supabase doğrudan çağrı var (fetch ile değiştirilecek)
5. `marketplace/matching` sayfası — Supabase doğrudan çağrı var
6. Bazı admin route'larda hâlâ `createAdminClient` doğrudan kullanılıyor (gateway'e geçirilmeli)

---

## Korunan Dosyalar 🔒
Aşağıdaki dosyalar **sahibin açık onayı olmadan değiştirilemez:**

```
app/api/paytr/callback/route.ts
app/api/paytr/create-payment/route.ts
app/api/verify-payment/route.ts
app/basari/page.tsx
app/auth/callback/route.ts
middleware.ts
services/payment.logic.ts
repositories/payment.repository.ts
lib/supabase/admin.ts
```

---

## Değişiklik Seviyeleri
- 🟢 **Serbest:** UI bileşen, stil, metin, marketing sayfası
- 🟡 **Önce rapor:** Yeni katman dosyası, API endpoint, migration, npm paketi
- 🔴 **İzinsiz asla:** Korunan dosyalar, RLS silme, auth bypass

---

## Yeni Özellik Ekleme Sırası
```
1. lib/validators/schemas/  → Zod şeması
2. lib/gateway/             → Gateway'e route kayıt
3. services/                → Logic servis fonksiyonu
4. repositories/            → Repository sorgusu
5. app/api/v1/              → API endpoint
6. lib/api/                 → UI fetch helper
7. app/ + components/       → UI bileşeni
```
Hiçbir adım atlanamaz, her adım kendi katmanında kalır.

---

## Yasaklar
- `any` tipi kullanma
- `console.log` (production)
- MD5 / SHA1
- `localStorage` hassas veri
- `eval()` / `new Function()`
- Doğrudan Supabase çağrısı UI'dan
- Service/Repository import UI'da
