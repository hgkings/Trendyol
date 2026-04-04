# ✅ CHECKLİST — COMMIT ATILMADAN ÖNCE DOLDURULUR

Bu dosya her commit öncesi doldurulur.
Tamamlanmadan commit atılamaz.
Şef bu dosyayı kontrol eder — eksik varsa geri gönderir.

## Son Görevin Checklist'i

**Görev:** Desktop tabloya ürün fotoğrafı + stok badge
**Agent:** Şef (koordinasyon) + Geliştirici (kod) + UI/CSS (stil) + Güvenlik (tarama)
**Tarih:** 2026-04-04
**Commit:** d36ecc7

### Zorunlu Kontroller

**Katman İzolasyonu:**
- [x] CSS/UI dosyalarında DB, API, business logic YOK
- [x] components/ içinde repositories/ import YOK
- [x] app/ içinde createAdminClient() YOK

**Güvenlik:**
- [x] .env'e dokunulmadı
- [x] Migration çalıştırılmadı
- [x] Yeni endpoint yok (sadece UI değişikliği)
- [x] Güvenlik taraması tamamlandı ✅ (grep ile doğrulandı)

**Kalite:**
- [x] npm run build → GEÇTI ✅
- [x] npx tsc --noEmit → GEÇTI ✅ (sıfır hata)
- [x] Türkçe metinler doğru ("Stok:")
- [x] Değişiklik minimum (sadece ekleme, silme yok)
- [x] Dark mode destekleniyor (dark: prefix'ler mevcut)
- [x] cn() kullanıldı (stok badge'de)

**Dosyalar:**
- [x] changelog.md güncellendi
- [x] results.md güncellendi
- [x] queue.md güncellendi
- [x] locks.md temiz (kilit yok)

**Commit:**
- [x] Commit mesajı formatına uygun
- [x] Push yapıldı (Hilmi onayladı)

### Şef'in Kalite Kontrolü

- [x] Tüm checkler tamamlandı
- [x] Build ve typecheck geçti
- [x] Güvenlik taraması temiz
- [x] Hilmi'ye sunuldu ve onaylandı

---

*(Her commit için bu template'i sıfırla ve yeniden doldur)*
