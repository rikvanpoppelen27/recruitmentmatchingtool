import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

/** Eén gedeelde browser-instantie voor de hele run — niet per document opnieuw opstarten. */
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

/** Sluit de gedeelde browser-instantie af. Aanroepen aan het eind van een CLI-run. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

/** Rendert een HTML-string naar een A4-PDF-buffer via headless Chromium. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}
