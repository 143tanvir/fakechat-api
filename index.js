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

const TEMPLATE_URL = "https://i.imgur.com/eiJWxND.jpeg";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.type("html").send(`
    <h2>Tanvir143 FakeChat API</h2>
    <p>Status: Online</p>
    <p>Endpoint: /api/fakechat?name=Tanvir&avatarurl=IMAGE_URL&text=Hi</p>
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

function numberParam(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function allowedImageUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && (
      url.hostname === "i.imgur.com" ||
      url.hostname === "images.unsplash.com" ||
      url.hostname.endsWith(".cdninstagram.com") ||
      url.hostname.endsWith(".fbcdn.net")
    ) ? url.href : null;
  } catch {
    return null;
  }
}

async function downloadImage(url) {
  const safeUrl = allowedImageUrl(url);

  if (!safeUrl) {
    throw new Error("Invalid or unsupported image URL");
  }

  const response = await fetch(safeUrl, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "Tanvir143-FakeChat/1.0" }
  });

  if (!response.ok) {
    throw new Error(`Image request failed: ${response.status}`);
  }

  const type = response.headers.get("content-type") || "";

  if (!type.startsWith("image/")) {
    throw new Error("URL did not return an image");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error("Image is too large");
  }

  return buffer;
}

async function makeCircularAvatar(buffer, size) {
  const resized = await sharp(buffer)
    .rotate()
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();

  const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}"
        r="${size / 2}" fill="white"/>
    </svg>
  `);

  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function wrapText(text, maxChars = 32) {
  const lines = [];

  for (const paragraph of String(text).split("\n")) {
    let line = "";

    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;

      if (word.length > maxChars) {
        if (line) lines.push(line);
        line = "";

        for (let i = 0; i < word.length; i += maxChars) {
          const part = word.slice(i, i + maxChars);

          if (part.length === maxChars) {
            lines.push(part);
          } else {
            line = part;
          }
        }

        continue;
      }

      const next = line ? `${line} ${word}` : word;

      if (next.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : [""];
}

function makeOverlay({
  width,
  height,
  text,
  textX,
  textY,
  fontSize
}) {
  const messages = String(text).slice(0, 2000).split("|").slice(0, 15);

  let allLines = [];
  for (const message of messages) {
    const lines = wrapText(message, 32);
    allLines.push(...lines);
  }

  const lineHeight = fontSize * 1.35;
  const paddingX = 14;
  const paddingY = 10;
  
  let maxLineLength = 1;
  for (const line of allLines) {
    if (line.length > maxLineLength) maxLineLength = line.length;
  }

  const bubbleWidth = Math.max(45, maxLineLength * (fontSize * 0.52) + paddingX * 2);
  const bubbleHeight = allLines.length * lineHeight + paddingY * 2;
  const bubbleX = textX - paddingX;
  const bubbleY = textY - fontSize - paddingY + 2;

  let output = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${width}" height="${height}">
  `;

  // Dynamic Instagram style dark grey chat bubble
  output += `
    <rect x="${bubbleX}" y="${bubbleY}"
      width="${bubbleWidth}" height="${bubbleHeight}"
      rx="18" ry="18"
      fill="#262626" />
  `;

  let y = textY;
  for (const message of messages) {
    const lines = wrapText(message, 32);

    for (const line of lines) {
      if (y > height - 10) break;

      output += `
        <text x="${textX}" y="${y}"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          font-size="${fontSize}"
          fill="#ffffff">${escapeXml(line)}</text>
      `;

      y += lineHeight;
    }

    y += fontSize * 0.2;
  }

  output += "</svg>";
  return Buffer.from(output);
}

app.get("/api/fakechat", async (req, res) => {
  try {
    const q = req.query;

    if (!q.text) {
      return res.status(400).json({
        error: "Missing required parameter: text",
        example: "/api/fakechat?name=Tanvir&avatarurl=https%3A%2F%2Fi.imgur.com%2Fyo08TRQ.jpeg&text=Hi"
      });
    }

    const text = String(q.text).slice(0, 2000);

    const template = await downloadImage(TEMPLATE_URL);

    const metadata = await sharp(template).metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      throw new Error("Could not read template dimensions");
    }

    const minSide = Math.min(width, height);
    const fontSize = numberParam(
      q.fontSize,
      Math.max(13, Math.round(minSide * 0.030)),
      10,
      100
    );

    const avatarSize = numberParam(
      q.avatarSize,
      Math.round(minSide * 0.09),
      20,
      Math.round(minSide * 0.4)
    );

    // Precise coordinates matching the provided screenshot layout
    const avatarX = Math.round(numberParam(q.avatarX, width * 0.04, 0, width - avatarSize));
    const avatarY = Math.round(numberParam(q.avatarY, height * 0.72, 0, height - avatarSize));

    // Text & bubble starts right beside the avatar horizontally, aligned vertically
    const textX = numberParam(q.textX, avatarX + avatarSize + 16, 0, width);
    const textY = numberParam(q.textY, avatarY + (avatarSize * 0.58), 0, height);

    const overlays = [];

    const avatarUrl = q.avatarurl || q.avatarUrl || q.avatar;

    if (avatarUrl) {
      const avatarBuffer = await downloadImage(String(avatarUrl));
      const avatar = await makeCircularAvatar(avatarBuffer, avatarSize);

      overlays.push({
        input: avatar,
        left: avatarX,
        top: avatarY
      });
    }

    overlays.push({
      input: makeOverlay({
        width,
        height,
        text,
        textX,
        textY,
        fontSize
      }),
      left: 0,
      top: 0
    });

    const png = await sharp(template)
      .composite(overlays)
      .png()
      .toBuffer();

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "no-store"
    });

    return res.send(png);
  } catch (error) {
    console.error("FakeChat error:", error.message);

    const isClientError = 
      error.message.includes("Invalid or unsupported") || 
      error.message.includes("Image request failed") || 
      error.message.includes("URL did not return") ||
      error.message.includes("Image is too large");

    return res.status(isClientError ? 400 : 500).json({
      error: isClientError ? "Invalid request or image source" : "Image generation failed",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tanvir143 FakeChat API running on port ${PORT}`);
});
