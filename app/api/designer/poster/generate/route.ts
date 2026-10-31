import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generatePosterHtml } from "@/lib/services/posterRenderer";

// Module-level caches to avoid re-reading and re-encoding on every request
let cachedFonts: any = null;
let cachedHeaderBase64: string | null = null;
let cachedFooterBase64: string | null = null;

function getFonts() {
  if (cachedFonts) return cachedFonts;

  const loadFont = (relPath: string) => {
    const p = path.join(process.cwd(), "public", relPath);
    if (!fs.existsSync(p)) {
      throw new Error(`Font file not found at ${p}`);
    }
    return fs.readFileSync(p).toString("base64");
  };

  cachedFonts = {
    shajiBold: loadFont("fonts/mlkv-shaji/MLKVShaji-Bold.ttf"),
    shajiNormal: loadFont("fonts/mlkv-shaji/MLKVShaji-Normal.ttf"),
    athiraBold: loadFont("fonts/mvm-athira/MVMAthira-Bold.ttf"),
    athiraNormal: loadFont("fonts/mvm-athira/MVMAthira-Normal.ttf"),
    gilmerRegular: loadFont("fonts/gilmer/Gilmer-Regular.otf"),
    gilmerBold: loadFont("fonts/gilmer/Gilmer-Bold.otf"),
    gilmerMedium: loadFont("fonts/gilmer/Gilmer-Medium.otf"),
    goboldUplow: loadFont("fonts/gobold/Gobold-Uplow.otf"),
  };
  return cachedFonts;
}

function getHeaderBase64() {
  if (cachedHeaderBase64) return cachedHeaderBase64;
  const headerPath = path.join(process.cwd(), "public", "Header 2.png");
  if (!fs.existsSync(headerPath)) {
    throw new Error(`Header image not found at ${headerPath}`);
  }
  cachedHeaderBase64 = fs.readFileSync(headerPath).toString("base64");
  return cachedHeaderBase64;
}

function getFooterBase64() {
  if (cachedFooterBase64) return cachedFooterBase64;
  const footerPath = path.join(process.cwd(), "public", "footer.png");
  if (!fs.existsSync(footerPath)) {
    throw new Error(`Footer image not found at ${footerPath}`);
  }
  cachedFooterBase64 = fs.readFileSync(footerPath).toString("base64");
  return cachedFooterBase64;
}

// Global browser instance reuse to eliminate 2-4s process launch on every poster request
let sharedBrowser: any = null;

async function getBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  const commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ];

  if (process.env.NODE_ENV === "production") {
    const puppeteerCore = await import("puppeteer-core");
    const chromium = (await import("@sparticuz/chromium")).default as any;

    let executablePath;
    try {
      const binPath = path.join(process.cwd(), "node_modules/@sparticuz/chromium/bin");
      if (fs.existsSync(binPath)) {
        executablePath = await chromium.executablePath(binPath);
      } else {
        executablePath = await chromium.executablePath();
      }
    } catch {
      executablePath = await chromium.executablePath();
    }

    sharedBrowser = await puppeteerCore.launch({
      args: [...chromium.args, ...commonArgs],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  } else {
    const puppeteerLocal = await import("puppeteer");
    const localBrowserPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    const detectedExecPath = localBrowserPaths.find((p) => fs.existsSync(p));

    sharedBrowser = await puppeteerLocal.launch({
      headless: true,
      args: commonArgs,
      ...(detectedExecPath ? { executablePath: detectedExecPath } : {}),
    });
  }

  return sharedBrowser;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dateString, items, showPhysiotherapy, datePositionX, datePositionY } = body;

    if (!dateString || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request payload. Must provide dateString and items array." },
        { status: 400 }
      );
    }

    // Load fonts and images from cache (instant on 2nd+ requests)
    let fonts;
    let headerBase64: string;
    let footerBase64: string;
    try {
      fonts = getFonts();
      headerBase64 = getHeaderBase64();
      footerBase64 = getFooterBase64();
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to load assets" },
        { status: 500 }
      );
    }

    // Parse and sanitize positioning coordinates
    const parsedX = typeof datePositionX === "number" ? datePositionX : parseInt(datePositionX, 10);
    const parsedY = typeof datePositionY === "number" ? datePositionY : parseInt(datePositionY, 10);
    const finalX = isNaN(parsedX) ? 80 : parsedX;
    const finalY = isNaN(parsedY) ? 80 : parsedY;

    // Generate HTML
    const htmlContent = generatePosterHtml(dateString, items, headerBase64, footerBase64, fonts, showPhysiotherapy, finalX, finalY);

    // Reuse warmed browser instance
    const browser = await getBrowser();
    const page = await browser.newPage();
    let imageBuffer: any;

    try {
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

      // Wait for fonts to be ready
      await page.evaluate(() => document.fonts.ready);

      // Capture screenshot
      imageBuffer = await page.screenshot({ type: "png", fullPage: true });
    } finally {
      await page.close().catch(() => {});
    }

    // Return raw PNG image response
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating poster:", error);
    // Reset shared browser on unexpected failure so it will cleanly recreate next time
    try {
      if (sharedBrowser) {
        await sharedBrowser.close();
      }
    } catch {}
    sharedBrowser = null;

    return NextResponse.json(
      { error: `Generation failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
