// Lightweight PDF text extraction via pdfjs-dist (browser).
// Robust against worker import issues (uses CDN worker fallback).

let pdfjsPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const pdfjs: any = await import("pdfjs-dist");
    try {
      // Vite-friendly worker import (ESM)
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch {
      // Fallback to CDN worker matching the installed version
      const version = pdfjs.version || "5.7.284";
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

export async function extractPdfText(file: File): Promise<string> {
  if (!file) throw new Error("File mancante");
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Il file non è un PDF");
  }

  const buf = await file.arrayBuffer();

  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs?.getDocument) throw new Error("pdfjs non disponibile");
    const pdf = await pdfjs.getDocument({ data: buf, disableWorker: false }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items || []).map((it: any) => it.str || "").join(" ");
      text += pageText + "\n\n";
    }
    const cleaned = text.trim();
    if (cleaned.length >= 30) return cleaned;
    // fallthrough to fallback if too short
  } catch (err) {
    console.warn("pdfjs extract failed, trying fallback", err);
  }

  // Fallback: brute-force extract readable strings from raw bytes.
  // Useful when worker fails or PDF has uncompressed text streams.
  try {
    const bytes = new Uint8Array(buf);
    let raw = "";
    for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
    const matches = raw.match(/\(([^()\\]{2,})\)/g) || [];
    const text = matches.map((m) => m.slice(1, -1)).join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 50) return text;
  } catch {}

  throw new Error("Impossibile estrarre testo dal PDF. Incolla il contenuto manualmente.");
}
