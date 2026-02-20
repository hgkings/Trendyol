# Test Scenarios for Validation Logic

Please use these scenarios to verify the new transparency and validation features.

## 1. Dashboard Trust Warning (Veri Tutarlılığı Uyarısı)
**Goal:** Verify that the dashboard warns when total profit is high but margins are suspiciously low.

**Steps:**
1. Create a new analysis or edit an existing one.
2. Set **Satış Fiyatı**: `100 ₺`
3. Set **Ürün Maliyeti**: `98 ₺` (Very low margin)
4. Set **Aylık Satış Adedi**: `5000` (High volume to generate high total profit)
5. Save.
6. Go to **Dashboard**.
7. **Expected Result:** You should see a yellow "Veri Tutarlılığı Uyarısı" box below the KPI cards stating "Toplam kârınız yüksek görünmesine rağmen ortalama marjınız çok düşük".

## 2. Analysis Form Soft Validation
**Goal:** Verify that the form warns about invalid inputs but allows saving after confirmation.

**Steps:**
1. Go to **Yeni Analiz**.
2. Enter **Ürün Adı**: "Test Ürün"
3. Enter **Satış Fiyatı**: `0` or `-10`
4. Enter **Ürün Maliyeti**: `50`
5. Click "Analiz Et".
6. **Expected Result:** 
   - A yellow warning box appears: "Satış fiyatı 0 veya geçersiz".
   - The button text changes to "Yine de Kaydet / Hesapla".
7. Click the button again.
8. **Expected Result:** The analysis is saved/calculated despite the warning.

## 3. CSV Import Warnings
**Goal:** Verify warnings for missing optional data in CSV.

**Steps:**
1. Create a CSV file with the following content:
   ```csv
   marketplace,product_name,sale_price,product_cost
   trendyol,Eksik Veri Ürünü,100,50
   ```
   *(Note: `monthly_sales_volume` is missing)*
2. Go to **Products** -> **CSV / Toplu Analiz Yükle**.
3. Upload this CSV.
4. **Expected Result:**
   - A blue "Dikkat Edilmesi Gerekenler" box appears.
   - It lists: "1 ürünün satış adedi girilmemiş (Varsayılan: 0)".
   - The "İçe Aktarımı Başlat" button is enabled (not blocked).
