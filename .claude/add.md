# ADD.md — Karnet Multi-Agent Gelistirme Gunlugu
> Bu dosya Karnet'in merkezi hafizasidir. Tum ajanlar bu dosyayi okur ve yazar.
> Son guncelleme: 2026-03-31

---

## OKUMA TALIMATLARI (HER SOHBET BASINDA ZORUNLU)

```
ADIM 1 → .claude/CLAUDE.md dosyasini oku (mimari + kurallar)
ADIM 2 → .claude/add.md dosyasini oku (bu dosya — gunluk + durum)
ADIM 3 → Kullaniciya sor:
         "Bana bir isim ver ve ne yapmami istedigini soyle."
         (Eger isim zaten verildiyse tekrar sorma, hatirla.)

BU SIRALAMA DEGISMEZ. GOREV ALMADAN ONCE BU 3 ADIM TAMAMLANMALI.
```

### YAZMA KURALLARI

- Her gorev bitince bu dosyaya kayit yaz
- Format: `| Tarih | Ajan | Ozet | Dosyalar | Commit |`
- Eski kayitlari SILME — sadece arsive tasi
- Bir goreve baslamadan once "KALAN ISLER" ve "SON DEGISIKLIKLER" kontrol et
- Ayni is daha once yapildiysa kullaniciya bildir: "Bu gorev [ajan] tarafindan [tarih]'de yapildi. Tekrar yapmami ister misin?"
- Commit hash'i varsa yaz, yoksa "—" koy

### AJAN ISIMLENDIRME

- Her ajan kullanicidan isim alir
- Isim verilmediyse: "Bana bir isim ver" diye sor
- Ismi UNUTMA — sohbet boyunca ayni ismi kullan
- Ayni isimde baska ajan varsa kullaniciya sor

---

## AKTIF AJANLAR

| Ajan Adi | Platform | Son Gorev | Son Aktif |
|----------|----------|-----------|-----------|
| Terminal Claude | Claude Code CLI (Opus 4.6) | Guvenlik denetimi + runtime fix | 2026-03-31 |
| Eklenti 1 | Claude Code VSCode Extension (Opus 4.6) | cash-plan + break-even premium tasarim + logout fix | 2026-03-30 |

---

## KALAN ISLER (YAPILMAMIS)

### Guvenlik Iyilestirme Plani (Adim 2-9)
| # | Gorev | Zorluk | Durum |
|---|-------|--------|-------|
| 2 | npm audit + bagimlilk guncelleme | Kolay | ✅ YAPILDI (Terminal Claude, 03-31) |
| 3 | Admin 2FA (Supabase MFA) | Orta | ✅ YAPILDI (Terminal Claude, 03-31) |
| 4 | User-ID bazli rate limiting | Orta | BEKLIYOR |
| 5 | Cloudflare WAF entegrasyonu | Orta | BEKLIYOR |
| 6 | Monitoring/Alerting sistemi | Orta-Zor | BEKLIYOR |
| 7 | Otomatik secret rotation | Zor | BEKLIYOR |
| 8 | Backup/disaster recovery testi | Zor | BEKLIYOR |
| 9 | SOC2/KVKK compliance framework | Cok Zor | BEKLIYOR |

### Supabase Manuel SQL (Hilmi tarafindan calistirildi)
| SQL | Amac | Durum |
|-----|------|-------|
| Plan CHECK constraint genisletme | starter planlar icin | ✅ YAPILDI (Hilmi, 2026-03-31) |
| Profiles RLS duzeltme (SELECT) | Herkese acik → kullanici bazli | ✅ YAPILDI (Hilmi, 2026-03-31) |
| audit_logs tablo olusturma | Guvenlik log tablosu | ✅ YAPILDI (Hilmi, 2026-03-31) |

---

## SON DEGISIKLIKLER (en yeniden eskiye)

### 2026-03-30 (Eklenti 1 — VSCode Extension)

| Tarih | Ajan | Ozet | Dosyalar | Commit |
|-------|------|------|----------|--------|
| 03-30 | Eklenti 1 | Nakit Plani sayfasi premium tasarim — area chart, 4 ozet kart (en dusuk kasa + risk + nakit pisti + ort. net), senaryo karsilastirma (kotumser/normal/iyimser), stok simulasyonu ay secimi, floating save bar, akilli oneriler paneli, Framer Motion animasyonlar | app/cash-plan/page.tsx | b171544 |
| 03-30 | Eklenti 1 | Basabas sayfasi premium tasarim — gelir/maliyet kesisim grafigi, 4 KPI kart, fiyat hassasiyet slider (-30%/+30%), gunluk hedef kirilimi + progress bar, katki payi gostergesi, akilli oneriler, floating save bar | app/break-even/page.tsx | b171544 |
| 03-30 | Eklenti 1 | Logout fix — cikis yapinca bos sayfa yerine anasayfaya yonlendirme | contexts/auth-context.tsx | b171544 |
| 03-30 | Eklenti 1 | karnet-context skill olusturuldu — proje baglami, mimari, bilinen sorunlar, gelistirme kurallari | .claude/skills/karnet-context/SKILL.md | b171544 |

### 2026-03-31

| Tarih | Ajan | Ozet | Dosyalar | Commit |
|-------|------|------|----------|--------|
| 03-31 | Terminal Claude | Admin 2FA (TOTP MFA) — enrollment + login verify + ayarlar | mfa-setup.tsx, mfa-verify-form.tsx, auth.ts, auth-context.tsx, auth/page.tsx, settings/page.tsx | 9d742b1 |
| 03-31 | Terminal Claude | Next.js 13.5→14.2.35 yukseltme, middleware %50 kuculdu | server.ts, helpers.ts, layout.tsx, 4 route + package.json | 81b4bfd |
| 03-31 | Terminal Claude | npm audit — Next.js 13.5.1→13.5.11, 18→5 zafiyet | package.json, package-lock.json | 0433c7a |
| 03-31 | Terminal Claude | add.md + CLAUDE.md multi-agent protokol | .claude/add.md, .claude/CLAUDE.md | 9ee993d, c228775 |
| 03-31 | Terminal Claude | Runtime UX duzeltmeleri — timeout, unmount, hata gosterimi | auth/page.tsx, dashboard/page.tsx, alert-context.tsx, settings/page.tsx, marketplace/page.tsx | 22f4b90 |
| 03-31 | Terminal Claude | auditLog cagrilari 10 kritik endpoint'e eklendi | paytr/callback, create-payment, user/delete, admin/users, admin/activate-payment, cron/check-expiry, trendyol/webhook, helpers.ts, gateway.adapter.ts, audit.ts | b8afea6 |
| 03-31 | Terminal Claude | Kalan 6 guvenlik bulgusu — Zod, CSP, audit log, debug guard, rate limit | 15 dosya, audit_logs migration | 00ac34b |
| 03-31 | Terminal Claude | Tam guvenlik denetimi — 16 kritik+yuksek bulgu duzeltildi | paytr/callback, create-payment, admin/users, webhook, pdf, support.repo, commission-import, cron, helpers, analysis.logic, registry, profiles RLS migration | 9e83561 |

### 2026-03-30

| Tarih | Ajan | Ozet | Dosyalar | Commit |
|-------|------|------|----------|--------|
| 03-30 | Terminal Claude | Faz 3+4 — kalan route'lar gateway'e tasindi (korunanlar dahil) | payment.logic, payment.repo, admin/payments, admin/activate-payment, cron/check-expiry, notifications/check-risk, pdf/analysis, user.logic | 8a30425 |
| 03-30 | Terminal Claude | Faz 2 — 4 admin route gateway'e tasindi | admin/stats, admin/users, admin/support, user.logic, user.repo | 5bf31f0 |
| 03-30 | Terminal Claude | Faz 1 — 5 API route gateway'e tasindi | billing/backfill, paytr/check, paytr/test, blog-comments, analyses, analysis.logic, analysis.repo | c5e4d53 |
| 03-30 | Terminal Claude | N+1 sorgu duzeltmesi — marketplace cron | marketplace/cron/route.ts | 7a80ae1 |
| 03-30 | Terminal Claude | UI Supabase import temizligi — 4 dosyadan DB sorgusu kaldirildi | general-risk-card, auth/page, marketplace/matching, cash-plan + 3 yeni API endpoint | 81d6ee3 |
| 03-30 | Terminal Claude | Guvenlik + kod kalitesi denetim duzeltmeleri (oncelik 2-8) | blog XSS, 10 catch blok, 4 any tipi, 4 email template, console.log, user/profile Zod | 18bb725 |
| 03-30 | Terminal Claude | 3 planli sisteme tam gecis (Free/Starter/Pro) | utils/access, config/plans+navigation, pro-locked-section, upgrade-modal, ProStatusCard, sidebar, csv-import, analysis/[id], user.logic, types | dcc5cb0 |
| 03-30 | Terminal Claude | Admin panel duzeltmeleri — tablo adi, plan sayimi, Zod, starter | admin/stats, admin/users, admin/payments, admin/activate-payment, admin/blog-comments, admin/page, admin/users/page | 0807070 |
| 03-30 | Terminal Claude | Hesap silme — 12 tablo cascade + Supabase Auth | user.repo, user.logic, api/user/delete, settings/page | — |
| 03-30 | Terminal Claude | Urun yonetimi API + pazaryeri normalize | product.schema, gateway/types, marketplace.logic (4 stub impl), product.logic, registry, 6 API route, lib/api/products | c2d95ad |

---

## TAMAMLANAN BUYUK GOREVLER (ARSIV)

### 1. Urun Yonetimi Sistemi (2026-03-30)
- **Ajan:** Terminal Claude
- **Kapsam:** Manuel urun girisi + pazaryeri API entegrasyonu
- **Onemli:** product.logic.ts, 6 API route, normalizer implementasyonu
- **Commit:** c2d95ad

### 2. Hesap Silme (Cascade Delete) (2026-03-30)
- **Ajan:** Terminal Claude
- **Kapsam:** 12 tablo cascade + Supabase Auth silme
- **Onemli:** user.repository.ts deleteAllUserData()

### 3. 3 Planli Sistem (Free/Starter/Pro) (2026-03-30)
- **Ajan:** Terminal Claude
- **Kapsam:** Binary isPro → feature bazli erisim kontrolu
- **Onemli:** hasPaidPlan(), hasFeature(), getPlanLabel() in utils/access.ts
- **Commit:** dcc5cb0

### 4. Gateway Migration (17 Route) (2026-03-30/31)
- **Ajan:** Terminal Claude
- **Kapsam:** Direkt Supabase → callGatewayV1Format
- **Onemli:** 3 fazda tamamlandi, payment.logic + user.logic genisletildi
- **Commitler:** c5e4d53, 5bf31f0, 8a30425

### 5. Tam Guvenlik Denetimi (22 Bulgu) (2026-03-30/31)
- **Ajan:** Terminal Claude
- **Kapsam:** 4 kritik, 8 yuksek, 7 orta, 3 dusuk — tumu duzeltildi
- **Onemli:** PayTR hash bypass kaldirildi, RLS duzeltildi, plan limiti eklendi, SSRF korunmasi
- **Commitler:** 9e83561, 00ac34b

### 6. Audit Log Sistemi (2026-03-31)
- **Ajan:** Terminal Claude
- **Kapsam:** audit_logs tablosu + 10 kritik endpoint'e auditLog() cagrilari
- **Onemli:** lib/security/audit.ts DB yazma, fire-and-forget pattern
- **Commit:** b8afea6

---

## PROJE DURUMU OZETI

| Alan | Durum | Not |
|------|-------|-----|
| Mimari (9 katman) | ✅ %90 uyumlu | 2 debug route haric tumu gateway'de |
| Guvenlik | ✅ 6.5/10 → 7.5/10 | 22 bulgu duzeltildi, 2FA ve WAF eksik |
| TypeScript | ✅ Sifir hata | tsc --noEmit temiz |
| Plan sistemi | ✅ 3 katmanli | Free/Starter/Pro + feature bazli gating |
| Audit log | ✅ Aktif | 10 endpoint'te, DB'ye yaziyor |
| Email template | ✅ Tam | 4 eksik template eklendi |
| Zod validasyon | ✅ %95 | 8 route'a eklendi, 2 debug route haric |
| RLS | ⚠️ SQL bekliyor | Profiles SELECT policy Hilmi'nin calistirmasi lazim |
| Payment | ⚠️ SQL bekliyor | CHECK constraint genisletme Hilmi'nin calistirmasi lazim |

---

*Bu dosya Karnet'in merkezi hafizasidir. Silme, degistirme veya tasima yasaktir.*
*Her ajan bu dosyayi okumak ve yazmak ZORUNDADIR.*
