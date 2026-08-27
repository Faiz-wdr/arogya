import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generatePosterHtml } from "@/lib/services/posterRenderer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dateString, items, showPhysiotherapy, datePositionX, datePositionY } = body;

    console.log("POSTER GENERATE API RECEIVED:", {
      dateString,
      showPhysiotherapy,
      datePositionX,
      datePositionY,
      itemsCount: items?.length
    });

    if (!dateString || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request payload. Must provide dateString and items array." },
        { status: 400 }
      );
    }

    // Load all required fonts
    const loadFont = (relPath: string) => {
      const p = path.join(process.cwd(), "public", relPath);
      if (!fs.existsSync(p)) {
        throw new Error(`Font file not found at ${p}`);
      }
      return fs.readFileSync(p).toString("base64");
    };

    let fonts;
    try {
      fonts = {
        shajiBold: loadFont("fonts/mlkv-shaji/MLKVShaji-Bold.ttf"),
        shajiNormal: loadFont("fonts/mlkv-shaji/MLKVShaji-Normal.ttf"),
        athiraBold: loadFont("fonts/mvm-athira/MVMAthira-Bold.ttf"),
        athiraNormal: loadFont("fonts/mvm-athira/MVMAthira-Normal.ttf"),
        gilmerRegular: loadFont("fonts/gilmer/Gilmer-Regular.otf"),
        gilmerBold: loadFont("fonts/gilmer/Gilmer-Bold.otf"),
        gilmerMedium: loadFont("fonts/gilmer/Gilmer-Medium.otf"),
        goboldUplow: loadFont("fonts/gobold/Gobold-Uplow.otf"),
      };
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to load fonts" },
        { status: 500 }
      );
    }

    // Load header banner file
    const headerPath = path.join(process.cwd(), "public", "header.png");
    if (!fs.existsSync(headerPath)) {
      return NextResponse.json(
        { error: `Header image not found at ${headerPath}` },
        { status: 500 }
      );
    }
    const headerBase64 = fs.readFileSync(headerPath).toString("base64");

    // Load footer banner file
    const footerPath = path.join(process.cwd(), "public", "footer.png");
    if (!fs.existsSync(footerPath)) {
      return NextResponse.json(
        { error: `Footer image not found at ${footerPath}` },
        { status: 500 }
      );
    }
    const footerBase64 = fs.readFileSync(footerPath).toString("base64");

    // Parse and sanitize positioning coordinates
    const parsedX = typeof datePositionX === "number" ? datePositionX : parseInt(datePositionX, 10);
    const parsedY = typeof datePositionY === "number" ? datePositionY : parseInt(datePositionY, 10);
    const finalX = isNaN(parsedX) ? 80 : parsedX;
    const finalY = isNaN(parsedY) ? 80 : parsedY;

    // Generate HTML
    const htmlContent = generatePosterHtml(dateString, items, headerBase64, footerBase64, fonts, showPhysiotherapy, finalX, finalY);

    // Launch Puppeteer
    let browser: any;
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
      } catch (e) {
        executablePath = await chromium.executablePath();
      }

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
      });
    } else {
      const puppeteerLocal = await import("puppeteer");
      browser = await puppeteerLocal.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(htmlContent);

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Capture screenshot
    const imageBuffer = await page.screenshot({ type: "png", fullPage: true });
    await browser.close();

    // Return raw PNG image response
    return new Response(imageBuffer as any, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating poster:", error);
    return NextResponse.json(
      { error: `Generation failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
