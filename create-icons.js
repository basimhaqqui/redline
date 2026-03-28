// Run this with Node.js to create PNG icons
// Or open generate-icons.html in a browser and save the images manually

const fs = require('fs');
const { createCanvas } = require('canvas');

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.18;

  // Red rounded square background
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#c0392b';
  ctx.fill();

  // Draw headphones in black
  const cx = size / 2;
  const cy = size / 2;
  const headR = size * 0.3;
  const bandWidth = size * 0.06;
  const earW = size * 0.14;
  const earH = size * 0.22;

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = bandWidth;
  ctx.lineCap = 'round';

  // Headband arc
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.02, headR, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Left ear cup
  const leftX = cx - headR * Math.cos(Math.PI * 0.1) - earW / 2;
  const leftY = cy - size * 0.02 + headR * Math.sin(Math.PI * 0.1) - earH * 0.15;
  drawRoundedRect(ctx, leftX, leftY, earW, earH, size * 0.04);

  // Right ear cup
  const rightX = cx + headR * Math.cos(Math.PI * 0.1) - earW / 2;
  const rightY = cy - size * 0.02 + headR * Math.sin(Math.PI * 0.1) - earH * 0.15;
  drawRoundedRect(ctx, rightX, rightY, earW, earH, size * 0.04);

  return canvas.toBuffer('image/png');
}

try {
  [16, 48, 128].forEach(size => {
    const buffer = createIcon(size);
    fs.writeFileSync(`icons/icon${size}.png`, buffer);
    console.log(`Created icon${size}.png`);
  });
  console.log('All icons created successfully!');
} catch (err) {
  console.log('Canvas module not installed. Please either:');
  console.log('1. Run: npm install canvas && node create-icons.js');
  console.log('2. Open generate-icons.html in browser and save images manually');
}
