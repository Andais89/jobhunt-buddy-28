// Estrae i dati di un annuncio da link (HTML) o screenshot (immagine base64)
// usando Lovable AI Gateway (gemini-2.5-flash) con structured output.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    location: { type: "string" },
    contract_type: { type: "string" },
    salary: { type: "string" },
    source: { type: "string" },
  },
  additionalProperties: false,
};

async function callAI(messages: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY non configurata");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [{
        type: "function",
        function: {
          name: "extract_job",
          description: "Estrae i campi principali di un annuncio di lavoro",
          parameters: SCHEMA,
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_job" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite richieste raggiunto, riprova tra poco");
    if (res.status === 402) throw new Error("Crediti AI esauriti");
    throw new Error(`AI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  return JSON.parse(args);
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RegiaCarrieraBot/1.0)",
      "Accept-Language": "it,en;q=0.8",
    },
    redirect: "follow",
  });
  const html = await res.text();
  // strip tags / scripts
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 8000);
}

function sourceFromUrl(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("indeed")) return "Indeed";
    if (h.includes("linkedin")) return "LinkedIn";
    if (h.includes("adecco")) return "Adecco";
    if (h.includes("infojobs")) return "InfoJobs";
    if (h.includes("gigroup")) return "GiGroup";
    return "Sito aziendale";
  } catch { return undefined; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { url, image } = body as { url?: string; image?: string };

    if (!url && !image) {
      return new Response(JSON.stringify({ error: "Fornisci `url` o `image`" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: Record<string, string> = {};

    if (image) {
      result = await callAI([
        {
          role: "system",
          content: "Estrai i dati di un annuncio di lavoro dall'immagine. Restituisci solo i campi presenti, in italiano.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Estrai azienda, ruolo, località, tipo di contratto, stipendio." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]);
      if (!result.source) result.source = "Screenshot";
    } else if (url) {
      const text = await fetchPageText(url);
      result = await callAI([
        {
          role: "system",
          content: "Estrai i dati di un annuncio di lavoro dal testo della pagina. Restituisci solo campi attendibili, in italiano. Ignora boilerplate del sito.",
        },
        { role: "user", content: `URL: ${url}\n\nTESTO:\n${text}` },
      ]);
      if (!result.source) {
        const s = sourceFromUrl(url);
        if (s) result.source = s;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-job error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
