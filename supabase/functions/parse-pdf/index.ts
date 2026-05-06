import pdfParse from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return new Response(JSON.stringify({ error: "pdfBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clean = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
    const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));

    if (bytes.byteLength > 15 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "PDF too large (max 15MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pdfParse(bytes);
    const text = String(result?.text || "").slice(0, 40000);

    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore";
    console.error("parse-pdf error", message);
    return new Response(JSON.stringify({ error: `Failed to parse PDF: ${message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
