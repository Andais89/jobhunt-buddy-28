import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    display_name: { type: "string", description: "Nome e cognome del candidato se identificabile" },
    skills: { type: "string", description: "Lista skills tecniche e soft, separate da virgola" },
    experience_summary: { type: "string", description: "Sintesi esperienza professionale in 3-5 righe" },
    languages: { type: "string", description: "Lingue parlate con livello, separate da virgola" },
  },
  required: ["skills", "experience_summary", "languages"],
  additionalProperties: false,
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function extractFromPdfBytes(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (cleaned.length >= 50) return cleaned;
  } catch (e) {
    console.warn("unpdf failed", e);
  }
  return "";
}

async function visionExtractFromPdf(bytes: Uint8Array, apiKey: string): Promise<string> {
  const dataUrl = `data:application/pdf;base64,${bytesToBase64(bytes)}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Estrai TUTTO il testo leggibile dal documento PDF. Restituisci solo il testo." },
        { role: "user", content: [
          { type: "text", text: "Estrai il testo completo da questo CV." },
          { type: "image_url", image_url: { url: dataUrl } },
        ] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision OCR ${res.status}`);
  const j = await res.json();
  return String(j?.choices?.[0]?.message?.content || "").trim();
}

async function structureCv(cvText: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Estrai dati strutturati dal CV in italiano. Sii conciso e fattuale." },
        { role: "user", content: `CV:\n${cvText.slice(0, 16000)}` },
      ],
      tools: [{ type: "function", function: { name: "extract_cv", description: "Estrae sezioni del CV", parameters: SCHEMA } }],
      tool_choice: { type: "function", function: { name: "extract_cv" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite richieste raggiunto");
    if (res.status === 402) throw new Error("Crediti AI esauriti");
    throw new Error(`AI ${res.status}: ${t}`);
  }
  const payload = await res.json();
  const args = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configurata");

    const body = await req.json().catch(() => ({}));
    const { cv_text, storage_path } = body as { cv_text?: string; storage_path?: string };

    let text = (cv_text || "").trim();

    if (!text && storage_path) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: file, error } = await supabase.storage.from("cvs").download(storage_path);
      if (error || !file) throw new Error("Impossibile leggere il file dal cloud: " + (error?.message || ""));
      const bytes = new Uint8Array(await file.arrayBuffer());

      text = await extractFromPdfBytes(bytes);
      if (text.length < 50) {
        console.log("Fallback to Vision OCR");
        text = await visionExtractFromPdf(bytes, apiKey);
      }
    }

    if (!text || text.length < 30) {
      return new Response(JSON.stringify({ error: "Impossibile leggere testo dal CV." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await structureCv(text, apiKey);
    return new Response(JSON.stringify({ ...data, cv_text: text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore";
    console.error("extract-cv error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
