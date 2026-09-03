const fs = require('fs');
const path = require('path');

try {
  const sharp = require('sharp');
  const publicDir = path.join(__dirname, '..', 'public');
  const logoPath = path.join(publicDir, 'logo.png');
  const out192 = path.join(publicDir, 'pwa-192x192.png');
  const out512 = path.join(publicDir, 'pwa-512x512.png');
  const brandColor = '#0d3b66';
  const accent = '#f18f01';

  if (!fs.existsSync(logoPath)) {
    console.error('[PWA icons] logo.png not found at', logoPath);
    process.exit(0);
  }

  const safeRound = (size) => {
    try {
      return Math.max(12, Math.floor(size * 0.22));
    } catch {
      return Math.max(12, Math.floor(192 * 0.22));
    }
  };

  const makeIcon = async (px) => {
    const padding = Math.max(8, Math.floor(px * 0.08));
    const inner = px - padding * 2;
    const r = safeRound(px);
    const logoBuffer = await sharp(logoPath)
      .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    const svgRounded = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <defs>
    <linearGradient id="g${px}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brandColor}"/>
      <stop offset="100%" stop-color="#1a6bb0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${px}" height="${px}" rx="${r}" ry="${r}" fill="url(#g${px})"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${Math.max(4, r - 8)}" ry="${Math.max(4, r - 8)}" fill="white" opacity="0.08"/>
  <circle cx="${px - padding - Math.floor(px * 0.08)}" cy="${padding + Math.floor(px * 0.08)}" r="${Math.max(2, Math.floor(px * 0.04))}" fill="${accent}"/>
</svg>`;

    await sharp(Buffer.from(svgRounded))
      .composite([{ input: logoBuffer, left: padding, top: padding }])
      .png({ quality: 95, compressionLevel: 6 })
      .toFile(px === 192 ? out192 : out512);

    console.log(`[PWA icons] Generated ${px}x${px}`);
  };

  Promise.all([makeIcon(192), makeIcon(512)])
    .then(() => console.log('[PWA icons] Done'))
    .catch((err) => console.error('[PWA icons] Error:', err.message));
} catch (err) {
  console.warn('[PWA icons] sharp not available, skipping icon generation. Expected package.json postinstall step when deps installed.');
  console.warn('       ', err.message);
}
