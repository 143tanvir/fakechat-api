/**
 * File Name: index.js
 * Project: Tanvir143 FakeChat API
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: https://github.com/143tanvir
 */

"use strict";

const express = require("express");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

const WIDTH = 900;

app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.type("html").send(`
    <h2>Tanvir143 FakeChat API</h2>
    <p>Status: Online</p>
    <p>Endpoint: /api/fakechat?name=Tanvir&text=Hello</p>
    <p>Response: PNG image</p>
  `);
});

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validColor(value, fallback) {
  return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?$/.test(
    String(value || "")
  )
    ? value
    : fallback;
}

function wrapText(text, maxChars = 31) {
  const result = [];

  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/);
    let line = "";

    for (let word of words) {
      while (word.length > maxChars) {
        if (line) {
          result.push(line);
          line = "";
        }

        result.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }

      const next = line ? `${line} ${word}` : word;

      if (next.length > maxChars && line) {
        result.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    result.push(line);
  }

  return result.length ? result : [""];
}

function textSvg(lines, x, y, options = {}) {
  const size = options.size || 25;
  const color = options.color || "#262626";
  const weight = options.weight || 400;
  const lineHeight = options.lineHeight || 34;

  return lines.map((line, index) => `
    <text
      x="${x}"
      y="${y + index * lineHeight}"
      font-family="Arial, sans-serif"
      font-size="${size}"
      font-weight="${weight}"
      fill="${color}"
    >${escapeXml(line)}</text>
  `).join("");
}

function icon(name, x, y, color = "#262626") {
  const common =
    `fill="none" stroke="${color}" stroke-width="3.5" ` +
    `stroke-linecap="round" stroke-linejoin="round"`;

  const shapes = {
    back: `<path ${common} d="M25 10 L10 25 L25 40 M11 25 H43"/>`,

    video: `<rect ${common} x="7" y="13" width="29" height="24" rx="5"/>
      <path ${common} d="M36 20 L47 14 V36 L36 30 Z"/>`,

    phone: `<path ${common} d="M14 8 Q8 10 12 20 Q21 39 36 43 Q44 45 47 37
      L37 29 L30 35 Q21 31 18 23 L24 17 Z"/>`,

    camera: `<rect ${common} x="6" y="15" width="40" height="27" rx="7"/>
      <path ${common} d="M16 15 L20 9 H32 L36 15"/>
      <circle ${common} cx="26" cy="28" r="8"/>`,

    gallery: `<rect ${common} x="7" y="8" width="38" height="35" rx="5"/>
      <circle ${common} cx="18" cy="19" r="3"/>
      <path ${common} d="M10 37 L23 25 L30 31 L36 23 L43 33"/>`,

    mic: `<rect ${common} x="19" y="6" width="15" height="28" rx="8"/>
      <path ${common} d="M12 25 V28 A14 14 0 0 0 41 28 V25 M26 42 V48 M18 48 H34"/>`,

    plus: `<circle ${common} cx="26" cy="26" r="19"/>
      <path ${common} d="M26 16 V36 M16 26 H36"/>`,

    heart: `<path ${common} d="M26 43 L9 26 C-1 12 14 3 26 17 C38 3 53 12 43 26 Z"/>`
  };

  return `<g transform="translate(${x},${y})">${shapes[name] || ""}</g>`;
}

function avatarPlaceholder(x, y, size, name, bg = "#d9d9d9") {
  const initial = escapeXml(
    String(name || "?").trim().charAt(0).toUpperCase() || "?"
  );

  return `
    <circle cx="${x + size / 2}" cy="${y + size / 2}"
      r="${size / 2}" fill="${bg}"/>
    <text x="${x + size / 2}" y="${y + size * 0.67}"
      text-anchor="middle" font-family="Arial, sans-serif"
      font-size="${size * 0.48}" fill="#555">${initial}</text>
  `;
}

/*
 * Only allow image requests from selected HTTPS hosts.
 */
function allowedImageHost(host) {
  const h = host.toLowerCase();

  return (
    h === "i.imgur.com" ||
    h === "images.unsplash.com" ||
    h.endsWith(".cdninstagram.com") ||
    h.endsWith(".fbcdn.net")
  );
}

async function fetchAvatar(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "https:" ||
      !allowedImageHost(parsed.hostname)
    ) {
      return null;
    }

    const response = await fetch(parsed.href, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      headers: {
        "User-Agent": "Tanvir143-FakeChat/1.0"
      }
    });

    if (!response.ok) return null;

    const type = response.headers.get("content-type") || "";

    if (!type.startsWith("image/")) return null;

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > 3 * 1024 * 1024) {
      return null;
    }

    return await sharp(Buffer.from(arrayBuffer))
      .rotate()
      .resize(100, 100, { fit: "cover" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function circularAvatar(buffer, size) {
  const resized = await sharp(buffer)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();

  const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}"
        r="${size / 2}" fill="#fff"/>
    </svg>
  `);

  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function buildSvg(q) {
  const name = String(q.name || "Instagram User").slice(0, 60);
  const theme = String(q.theme || "light").toLowerCase();
  const dark = theme === "dark";

  const pageBg = dark ? "#000000" : "#ffffff";
  const mainText = dark ? "#f5f5f5" : "#262626";
  const muted = dark ? "#a8a8a8" : "#8e8e8e";
  const divider = dark ? "#262626" : "#efefef";
  const incomingBg = dark ? "#262626" : "#efefef";

  const incomingText = validColor(q.textColor, mainText);
  const outgoingBg = validColor(q.ownTextBg, "#3797f0");
  const outgoingText = validColor(q.ownTextColor, "#ffffff");
  const incomingBubble = validColor(q.textBg, incomingBg);

  // FIX: Empty text no longer creates an unwanted "Hello!" message.
  const incoming = String(q.text || "")
    .slice(0, 5000)
    .split("|")
    .filter(Boolean)
    .slice(0, 30);

  const outgoing = String(q.ownText || "")
    .slice(0, 5000)
    .split("|")
    .filter(Boolean)
    .slice(0, 30);

  const messages = [];
  let y = 150;

  for (const text of incoming) {
    const lines = wrapText(text, 31);
    const bubbleWidth = clamp(
      Math.max(...lines.map(line => line.length)) * 14 + 42,
      100,
      490
    );
    const bubbleHeight = lines.length * 34 + 28;

    messages.push({
      type: "in",
      lines,
      x: 92,
      y,
      width: bubbleWidth,
      height: bubbleHeight
    });

    y += bubbleHeight + 22;
  }

  for (const text of outgoing) {
    const lines = wrapText(text, 31);
    const bubbleWidth = clamp(
      Math.max(...lines.map(line => line.length)) * 14 + 42,
      100,
      490
    );
    const bubbleHeight = lines.length * 34 + 28;

    messages.push({
      type: "out",
      lines,
      x: WIDTH - 28 - bubbleWidth,
      y,
      width: bubbleWidth,
      height: bubbleHeight
    });

    y += bubbleHeight + 22;
  }

  const footerHeight = 105;
  const height = clamp(y + footerHeight + 20, 520, 12000);

  let body = "";

  for (const msg of messages) {
    const isOut = msg.type === "out";
    const fill = isOut ? outgoingBg : incomingBubble;
    const color = isOut ? outgoingText : incomingText;

    body += `
      <rect x="${msg.x}" y="${msg.y}"
        width="${msg.width}" height="${msg.height}"
        rx="27" fill="${fill}"/>

      ${textSvg(
        msg.lines,
        msg.x + 21,
        msg.y + 40,
        { size: 25, color, lineHeight: 34 }
      )}
    `;

    if (!isOut) {
      body += avatarPlaceholder(
        25,
        msg.y + msg.height - 40,
        36,
        name
      );
    }
  }

  const footerY = height - footerHeight;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${WIDTH}" height="${height}"
      viewBox="0 0 ${WIDTH} ${height}">

      <rect width="100%" height="100%" fill="${pageBg}"/>

      <!-- Header -->
      ${icon("back", 18, 20, mainText)}

      ${avatarPlaceholder(82, 20, 58, name, "#d8c3ed")}

      <text x="155" y="43"
        font-family="Arial, sans-serif"
        font-size="27" font-weight="700"
        fill="${mainText}">${escapeXml(name)}</text>

      <text x="155" y="70"
        font-family="Arial, sans-serif"
        font-size="18" fill="${muted}">Active now</text>

      ${icon("phone", 710, 25, mainText)}
      ${icon("video", 785, 25, mainText)}
      ${icon("heart", 845, 25, mainText)}

      <path d="M0 98 H900"
        stroke="${divider}" stroke-width="2"/>

      ${body}

      <!-- Message composer -->
      <path d="M0 ${footerY} H900"
        stroke="${divider}" stroke-width="2"/>

      <rect x="15" y="${footerY + 18}"
        width="870" height="68" rx="35"
        fill="${dark ? "#262626" : "#ffffff"}"
        stroke="${dark ? "#444444" : "#dbdbdb"}"
        stroke-width="2"/>

      ${icon("camera", 28, footerY + 28, "#3797f0")}

      <text x="100" y="${footerY + 59}"
        font-family="Arial, sans-serif"
        font-size="23" fill="${muted}">Message...</text>

      ${icon("mic", 690, footerY + 26, mainText)}
      ${icon("gallery", 750, footerY + 27, mainText)}
      ${icon("plus", 818, footerY + 27, mainText)}

    </svg>
  `;

  return { svg, height, avatarUrl: q.avatar || "" };
}

app.get("/api/fakechat", async (req, res) => {
  try {
    const q = req.query;

    if (!q.text && !q.ownText) {
      return res.status(400).json({
        error: "Missing required parameter: text or ownText",
        example: "/api/fakechat?name=Tanvir&text=Hello"
      });
    }

    const { svg, height, avatarUrl } = buildSvg(q);

    let image = sharp(Buffer.from(svg));

    const avatar = await fetchAvatar(avatarUrl);

    if (avatar) {
      const circle = await circularAvatar(avatar, 58);

      image = image.composite([
        { input: circle, left: 82, top: 20 }
      ]);
    }

    const png = await image.png().toBuffer();

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Image-Width": String(WIDTH),
      "X-Image-Height": String(height)
    });

    return res.send(png);
  } catch (error) {
    console.error("FakeChat error:", error.message);

    return res.status(500).json({
      error: "Image generation failed",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tanvir143 FakeChat API running on port ${PORT}`);
});
