# Kârnet — Sistem Mimarisi ve Değişmez Kurallar
> v2.0 · 9 Katmanlı · Production-Grade · Security-First
> Bu dosya Kârnet'in anayasasıdır. Hiçbir kural hiçbir gerekçeyle çiğnenemez.
> Yazar: Süleyman Hilmi İşbilir

---

## ⚠️ DEĞİŞMEZ TEMEL KURAL

```
UI KATMANINDA HİÇBİR ZAMAN:
- Veritabanı kodu olmaz
- Veritabanı dosya adı geçmez
- Veritabanı bağlantısı olmaz
- SQL sorgusu olmaz
- Tablo adı olmaz
- Repository importu olmaz
- Service importu olmaz
- DB adapter importu olmaz

BU KURAL DÜNYA YANSA DEĞİŞMEZ.
```

---

## 9 KATMANLI MİMARİ AKIŞ

```
┌─────────────────────────────────────────────────────┐
│  KATMAN 1 — SUNUM KATMANI                           │
│  Next.js App Router Pages                           │
│  /dashboard, /analysis, /products, /settings        │
│  /admin, /auth, /blog, /pricing                     │
│                                                     │
│  ✅ Sadece UI kodu                                  │
│  ✅ Sadece fetch('/api/...') çağrısı                │
│  ✅ Sadece lib/api/ helper'ları                     │
│  ❌ DB, SQL, Service, Repository YASAK              │
└─────────────────────┬───────────────────────────────┘
                      ↓ fetch('/api/v1/...')
┌─────────────────────────────────────────────────────┐
│  KATMAN 2 — ŞEMA KATMANI                            │
│  Zod Schema Collections                             │
│  lib/validators/schemas/                            │
│                                                     │
│  • analysis.schema.ts                               │
│  • user.schema.ts                                   │
│  • product.schema.ts                                │
│  • payment.schema.ts                                │
│  • support.schema.ts                                │
│                                                     │
│  Payload CMS Collections karşılığı.                 │
│  Tüm veri tipleri ve validasyon burada.             │
│  API'ye girmeden her veri burada doğrulanır.        │
└─────────────────────┬───────────────────────────────┘
                      ↓ validate(data)
┌─────────────────────────────────────────────────────┐
│  KATMAN 3 — PROXY KATMANI (GATEWAY)                 │
│  GatewayAdapter                                     │
│  lib/gateway/gateway.adapter.ts                     │
│                                                     │
│  • Tüm istekler buradan geçer                       │
│  • DB'ye HİÇBİR ZAMAN doğrudan gitmez              │
│  • Trace ID üretir (her istek izlenir)              │
│  • Rate limit kontrolü yapar                        │
│  • Auth token doğrular                              │
│  • Hataları merkezi yakalar                         │
│  • GlobalService'i çağırır                          │
│                                                     │
│  CustomDatabaseAdapter (PROXY) karşılığı.           │
└─────────────────────┬───────────────────────────────┘
                      ↓ gateway.route(traceId, request)
┌─────────────────────────────────────────────────────┐
│  KATMAN 4 — GLOBAL SERVİS KATMANI                   │
│  GlobalService                                      │
│  lib/gateway/global.service.ts                      │
│                                                     │
│  • İstekleri doğru LogicService'e yönlendirir       │
│  • Servisler arası koordinasyonu sağlar             │
│  • Trace ID'yi her katmana taşır                    │
│  • GlobalService.callService() ana metot            │
│                                                     │
│  GlobalService.fetchFromPython() karşılığı.         │
│  (Python yerine TypeScript içi çağrı)               │
└─────────────────────┬───────────────────────────────┘
                      ↓ globalService.callService(name, payload)
┌─────────────────────────────────────────────────────┐
│  KATMAN 5 — SERVİS KÖPRÜSÜ                          │
│  ServiceBridge                                      │
│  lib/gateway/service.bridge.ts                      │
│                                                     │
│  • Her LogicService'i kayıt altına alır             │
│  • İsme göre doğru servisi çağırır                  │
│  • Servisler arası bağımlılığı keser                │
│  • Hata durumunda fallback sağlar                   │
│                                                     │
│  PythonBridge (gRPC) karşılığı.                     │
│  (gRPC yerine TypeScript internal bridge)           │
└─────────────────────┬───────────────────────────────┘
                      ↓ bridge.call(serviceName, method, args)
┌─────────────────────────────────────────────────────┐
│  KATMAN 6 — MANTIK SERVİSİ                          │
│  LogicService (İş Mantığı + Trace)                  │
│  services/                                          │
│                                                     │
│  • analysis.logic.ts  → Kâr, komisyon, risk         │
│  • user.logic.ts      → Profil, tercihler           │
│  • payment.logic.ts   → Ödeme akışı 🔒              │
│  • notification.logic.ts → Email bildirimleri       │
│  • marketplace.logic.ts  → Trendyol/Hepsiburada     │
│  • risk.logic.ts      → Risk puanı hesaplama        │
│                                                     │
│  Her işlem Trace ID ile loglanır.                   │
│  İş mantığının döndüğü tek yer.                     │
│  DBHelper'ı çağırır, DB'yi görmez.                  │
│                                                     │
│  LogicService (İş Mantığı + Trace) karşılığı.       │
└─────────────────────┬───────────────────────────────┘
                      ↓ logic.process(traceId, data)
┌─────────────────────────────────────────────────────┐
│  KATMAN 7 — VERİTABANI YARDIMCISI                   │
│  DBHelper (AES-256-GCM)                             │
│  lib/db/db.helper.ts                                │
│                                                     │
│  • Hassas verileri şifreler (AES-256-GCM)           │
│  • Marketplace API key'lerini şifreler              │
│  • Şifreli veriyi BaseRepo'ya verir                 │
│  • Şifreli veriyi çözer                             │
│  • Audit log kaydı oluşturur                        │
│                                                     │
│  DBHelper (AES-GCM) karşılığı.                      │
│  (Aynı teknoloji: AES-256-GCM)                      │
└─────────────────────┬───────────────────────────────┘
                      ↓ dbHelper.encrypt(data) → repo.save()
┌─────────────────────────────────────────────────────┐
│  KATMAN 8 — REPOSITORY KATMANI                      │
│  BaseRepository + Özel Repository'ler               │
│  repositories/                                      │
│                                                     │
│  • base.repository.ts      → Generic CRUD           │
│  • analysis.repository.ts  → Analiz sorguları       │
│  • user.repository.ts      → Kullanıcı sorguları    │
│  • product.repository.ts   → Ürün sorguları         │
│  • payment.repository.ts   → Ödeme kayıtları 🔒     │
│  • support.repository.ts   → Destek talepleri       │
│                                                     │
│  Veri erişiminin TEK noktası.                       │
│  Tüm sorgular parametrize.                          │
│  JSONB alanlar desteklenir.                         │
│  İş mantığı YOKTUR.                                 │
│                                                     │
│  BaseRepo (JSONB) karşılığı.                        │
└─────────────────────┬───────────────────────────────┘
                      ↓ repository.query(params)
┌─────────────────────────────────────────────────────┐
│  KATMAN 9 — VERİTABANI                              │
│  Supabase PostgreSQL                                │
│                                                     │
│  • RLS (Row Level Security) her tabloda zorunlu     │
│  • audit_logs tablosu (tüm işlemler)                │
│  • Supabase Migrations (sürüm kontrolü)             │
│  • Automated Backups (günlük)                       │
│  • Supabase Auth (JWT)                              │
│  • Supabase Storage (dosyalar)                      │
│                                                     │
│  PostgreSQL karşılığı.                              │
│  (Aynı teknoloji: PostgreSQL)                       │
└─────────────────────────────────────────────────────┘
```

---

## KATMAN ↔ ORIJINAL MİMARİ EŞLEŞMESİ

| # | Orijinal | Kârnet Karşılığı | Teknoloji |
|---|----------|-----------------|-----------|
| 1 | Next.js Custom Pages | Next.js App Router | Aynı |
| 2 | Payload CMS Collections | Zod Schema Collections | Zod (tip güvenli) |
| 3 | CustomDatabaseAdapter (PROXY) | GatewayAdapter (PROXY) | TypeScript |
| 4 | GlobalService.fetchFromPython() | GlobalService.callService() | TypeScript (Python yok) |
| 5 | PythonBridge (gRPC) | ServiceBridge (internal) | TypeScript (gRPC yok) |
| 6 | LogicService (İş + Trace) | LogicService (İş + Trace) | Aynı mantık |
| 7 | DBHelper (AES-GCM) | DBHelper (AES-256-GCM) | Aynı |
| 8 | BaseRepo (JSONB) | BaseRepository (JSONB) | Aynı |
| 9 | PostgreSQL | Supabase PostgreSQL | Aynı |

---

## KLASÖR YAPISI

```
karnet/
│
├── app/                              # KATMAN 1 — UI
│   ├── (auth)/
│   │   └── auth/
│   │       ├── page.tsx              # Giriş/kayıt UI
│   │       └── callback/            # 🔒 DOKUNULAMAZ
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── analysis/
│   │   ├── products/
│   │   ├── settings/
│   │   └── support/
│   ├── (marketing)/
│   │   ├── page.tsx                  # Ana sayfa
│   │   └── blog/
│   ├── admin/                        # Admin paneli UI
│   └── api/
│       ├── v1/                       # Public API
│       │   ├── analyses/route.ts
│       │   ├── products/route.ts
│       │   └── support/route.ts
│       ├── paytr/                    # 🔒 DOKUNULAMAZ
│       └── verify-payment/          # 🔒 DOKUNULAMAZ
│
├── lib/
│   │
│   ├── validators/                   # KATMAN 2 — ŞEMA
│   │   └── schemas/
│   │       ├── analysis.schema.ts
│   │       ├── user.schema.ts
│   │       ├── product.schema.ts
│   │       ├── payment.schema.ts
│   │       └── support.schema.ts
│   │
│   ├── gateway/                      # KATMAN 3-5 — PROXY + GLOBAL + BRIDGE
│   │   ├── gateway.adapter.ts        # PROXY — tüm istekler buradan
│   │   ├── global.service.ts         # GlobalService — yönlendirici
│   │   └── service.bridge.ts         # ServiceBridge — köprü
│   │
│   ├── db/                           # KATMAN 7 — DB HELPER
│   │   └── db.helper.ts              # AES-256-GCM şifreleme
│   │
│   ├── supabase/                     # KATMAN 9 bağlantısı
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # SSR client
│   │   └── admin.ts                  # 🔒 Sadece Repository kullanır
│   │
│   ├── security/                     # Güvenlik araçları
│   │   ├── rate-limit.ts             # Upstash Redis
│   │   └── audit.ts                  # Audit logger
│   │
│   ├── email/                        # Email araçları
│   │   ├── smtp.ts                   # Brevo bağlantı
│   │   └── templates/                # Email şablonları
│   │
│   └── api/                          # UI fetch helper'ları
│       ├── analyses.ts               # UI'ın kullandığı
│       └── notifications.ts
│
├── services/                         # KATMAN 6 — MANTIK
│   ├── analysis.logic.ts
│   ├── user.logic.ts
│   ├── payment.logic.ts              # 🔒 Kritik
│   ├── notification.logic.ts
│   ├── marketplace.logic.ts
│   └── risk.logic.ts
│
├── repositories/                     # KATMAN 8 — REPOSITORY
│   ├── base.repository.ts
│   ├── analysis.repository.ts
│   ├── user.repository.ts
│   ├── product.repository.ts
│   ├── payment.repository.ts         # 🔒 Kritik
│   └── support.repository.ts
│
├── components/                       # UI Bileşenleri
│   ├── ui/                           # shadcn primitives
│   ├── layout/                       # Navbar, Sidebar
│   ├── features/                     # Özellik bileşenleri
│   └── shared/                       # Paylaşımlı
│
├── types/                            # TypeScript tipleri
│   ├── database.types.ts
│   └── index.ts
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
└── .claude/
    └── CLAUDE.md                     # Bu dosya
```

---

## HER KATMANIN SORUMLULUĞU

### KATMAN 1 — UI
```
✅ React component, hook
✅ fetch('/api/v1/...')
✅ lib/api/ helper importu
✅ types/ tip importu
✅ Tailwind, shadcn/ui, Framer Motion
❌ Başka HİÇBİR ŞEY
```

### KATMAN 2 — ŞEMA
```
✅ Zod şema tanımları
✅ TypeScript tip export'ları
✅ Validasyon kuralları
❌ İş mantığı
❌ DB bağlantısı
```

### KATMAN 3 — GATEWAY (PROXY)
```
✅ Trace ID üretir
✅ Rate limit kontrolü
✅ Auth token doğrulama
✅ GlobalService'i çağırır
✅ Hata yakalama
❌ DB'ye doğrudan gitmez (ASLA)
❌ İş mantığı yoktur
```

### KATMAN 4 — GLOBAL SERVİS
```
✅ İstekleri doğru servise yönlendirir
✅ Trace ID taşır
✅ ServiceBridge'i çağırır
❌ İş mantığı yoktur
❌ DB bilmez
```

### KATMAN 5 — SERVİS KÖPRÜSÜ
```
✅ Servisleri kayıt altında tutar
✅ İsme göre doğru servisi çağırır
✅ Bağımlılıkları keser
❌ İş mantığı yoktur
❌ DB bilmez
```

### KATMAN 6 — LOGIC SERVİS
```
✅ Tüm iş mantığı burada
✅ Hesaplama, dönüştürme, işleme
✅ DBHelper'ı çağırır
✅ Audit log yazar
✅ Trace ID ile her adım loglanır
❌ HTTP bilmez
❌ DB'ye doğrudan bağlanmaz
```

### KATMAN 7 — DB HELPER
```
✅ Hassas verileri şifreler (AES-256-GCM)
✅ Şifreli veriyi çözer
✅ Audit kaydı oluşturur
✅ BaseRepository'yi çağırır
❌ İş mantığı yoktur
```

### KATMAN 8 — REPOSITORY
```
✅ Ham CRUD işlemleri
✅ Parametrize sorgular
✅ JSONB alan desteği
✅ admin.ts client kullanır
❌ İş mantığı yoktur
❌ Şifreleme yapmaz (DBHelper'ın işi)
```

### KATMAN 9 — VERİTABANI
```
✅ RLS her tabloda aktif
✅ Sadece Repository erişebilir
✅ audit_logs tablosu
✅ Migration ile yönetilir
```

---

## GATEWAY ADAPTER — KOD ŞABLONU

```typescript
// lib/gateway/gateway.adapter.ts
// KATMAN 3 — Tüm istekler buradan geçer

export class GatewayAdapter {
  private static instance: GatewayAdapter

  async handle(request: GatewayRequest): Promise<GatewayResponse> {
    const traceId = this.generateTraceId()

    try {
      // 1. Auth kontrolü
      await this.verifyAuth(request.token)

      // 2. Rate limit
      await this.checkRateLimit(request.ip)

      // 3. GlobalService'e yönlendir
      const result = await globalService.callService(
        traceId,
        request.service,
        request.payload
      )

      return { success: true, data: result, traceId }
    } catch (error) {
      await auditLogger.logError(traceId, error)
      throw error
    }
  }

  private generateTraceId(): string {
    return `karnet-${Date.now()}-${crypto.randomUUID()}`
  }
}
```

---

## YENİ ÖZELLİK EKLEME KURALI

Yeni bir özellik eklenecekse **her katmana** eklenir:

```
1. lib/validators/schemas/ → Zod şeması ekle
2. lib/gateway/ → Yeni route gateway'e kayıt
3. services/ → Logic servis fonksiyonu ekle
4. repositories/ → Repository sorgusu ekle
5. app/api/v1/ → API endpoint ekle
6. lib/api/ → UI fetch helper ekle
7. app/ components/ → UI bileşeni ekle
```

**Hiçbir adım atlanamaz.**
**Her adım kendi katmanında kalır.**

---

## KORUNAN DOSYALAR

```
🔒 app/api/paytr/callback/route.ts     → İzinsiz dokunulamaz
🔒 app/api/paytr/create-payment/route.ts → İzinsiz dokunulamaz
🔒 app/api/verify-payment/route.ts    → İzinsiz dokunulamaz
🔒 app/auth/callback/route.ts         → İzinsiz dokunulamaz
🔒 middleware.ts                       → İzinsiz dokunulamaz
🔒 services/payment.logic.ts          → İzinsiz dokunulamaz
🔒 repositories/payment.repository.ts → İzinsiz dokunulamaz
🔒 lib/supabase/admin.ts              → İzinsiz dokunulamaz
```

---

## DEĞİŞİKLİK KURALLARI

### 🟢 Serbest
UI bileşen, stil, metin, yeni marketing sayfası

### 🟡 Önce Rapor, Sonra Yap
Yeni katman dosyası, API endpoint, migration, npm paketi

### 🔴 İzinsiz Asla
Korunan dosyalar, RLS silme, auth bypass, admin client UI'da

---

## PROMPT ŞABLONU (ZORUNLU)

```
[BAŞLANGIÇ RAPORU]
- Ne yapılacak?
- Hangi katmanlar etkilenecek?
- Hangi dosyalar değişecek?
- Korunan dosya var mı?

[İŞLEM]
...

[BİTİŞ RAPORU]
- Ne yapıldı?
- Katman kuralları ihlal edildi mi?
- Test sonucu?
- Dikkat edilmesi gereken?
```

---

## TEKNOLOJİ YIĞINI

| Kategori | Teknoloji |
|----------|-----------|
| UI | Next.js 15, TypeScript 5, Tailwind v4, shadcn/ui, Framer Motion |
| Şema | Zod (Payload CMS Collections yerine) |
| Gateway | TypeScript class (CustomDatabaseAdapter yerine) |
| Bridge | TypeScript internal (gRPC yerine) |
| Şifreleme | AES-256-GCM (Aynı) |
| Veritabanı | Supabase PostgreSQL (Aynı) |
| Rate Limit | Upstash Redis |
| Email | Brevo SMTP |
| Ödeme | PayTR 🔒 |
| Deploy | Vercel |

---

## YASAK TEKNOLOJİLER

```
❌ Pages Router
❌ any tipi
❌ console.log (production)
❌ MD5 / SHA1
❌ localStorage hassas veri
❌ eval() / new Function()
❌ Direkt Supabase UI'dan
❌ Service import UI'da
❌ Repository import UI'da
❌ DB adı UI'da
```

---

*Bu mimari Kârnet'in temelidir.*
*Değişmez. Silinmez. Unutulmaz.*
*Dünya yansa bu kurallar geçerlidir.*
*© 2026 Kârnet — Süleyman Hilmi İşbilir*
