import { NextRequest, NextResponse } from 'next/server';

function sheetsUrlToExportUrl(url: string): string | null {
  // Handle: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=GID
  // or:     https://docs.google.com/spreadsheets/d/SHEET_ID/pubhtml
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const sheetId = match[1];
  // Extract gid if present
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL gerekli' }, { status: 400 });
    }

    const exportUrl = sheetsUrlToExportUrl(url.trim());
    if (!exportUrl) {
      return NextResponse.json(
        { error: 'Geçersiz Google Sheets URL. Örnek: https://docs.google.com/spreadsheets/d/...' },
        { status: 400 }
      );
    }

    const response = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Karnet/1.0' },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Sheets erişilemedi (${response.status}). Dosyanın herkese açık olduğundan emin olun.` },
        { status: 400 }
      );
    }

    const csv = await response.text();
    return NextResponse.json({ csv });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
