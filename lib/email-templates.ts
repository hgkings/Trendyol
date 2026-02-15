// Email Templates

export const getRiskAlertTemplate = (productName: string, riskScore: number, riskLevel: string, analysisId: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
    .header { background: #fef2f2; padding: 15px; border-radius: 6px; text-align: center; }
    .title { color: #dc2626; margin: 0; font-size: 20px; font-weight: bold; }
    .content { padding: 20px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { font-size: 12px; color: #888; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">⚠️ Kritik Risk Uyarısı</h1>
    </div>
    <div class="content">
      <p>Merhaba,</p>
      <p><strong>${productName}</strong> ürünü için yapılan analizde kritik risk tespit edildi.</p>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Risk Puanı:</strong> ${riskScore}/100</p>
        <p style="margin: 5px 0;"><strong>Seviye:</strong> <span style="color: #dc2626; font-weight: bold;">${riskLevel}</span></p>
      </div>

      <p>Detayları incelemek ve aksiyon almak için panele gidin:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/analysis/${analysisId}" class="button">Analizi Görüntüle</a>
      </div>
    </div>
    <div class="footer">
      <p>Bu mail bildirim tercihleriniz gereği gönderilmiştir.</p>
    </div>
  </div>
</body>
</html>
`;

export const getTestEmailTemplate = () => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .header { background: #f0f9ff; padding: 15px; border-radius: 6px; text-align: center; }
    .title { color: #0284c7; margin: 0; font-size: 20px; font-weight: bold; }
    .content { padding: 20px 0; text-align: center; }
    .footer { font-size: 12px; color: #888; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">✅ Test Bildirimi</h1>
    </div>
    <div class="content">
      <p>Merhaba,</p>
      <p>Bu bir test e-postasıdır. Bildirim sisteminiz <strong>sorunsuz çalışıyor.</strong></p>
    </div>
    <div class="footer">
      <p>Kar Koçu Bildirim Sistemi</p>
    </div>
  </div>
</body>
</html>
`;
