// Estrae i dati di un annuncio da link (HTML) o screenshot (immagine base64)
// usando Lovable AI Gateway con structured output via tool calling.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string", description: "Nome dell'azienda finale (datore di lavoro reale)" },
    agency: { type: "string", description: "Agenzia per il lavoro o intermediario, se presente (es. Adecco, GiGroup, Randstad)" },
    role: { type: "string", description: "Titolo del ruolo / posizione" },
    location: { type: "string", description: "Città o località di lavoro" },
    contract_type: { type: "string", description: "Tipo di contratto (es. tempo indeterminato, determinato, full-time, part-time, stage, somministrazione)" },
    salary: { type: "string", description: "Retribuzione o range salariale, se indicato" },
    description: { type: "string", description: "Breve descrizione del ruolo (max 2-3 frasi)" },
    notes: { type: "string", description: "Requisiti chiave / competenze richieste, in formato lista breve separata da virgole" },
    source: { type: "string", description: "Portale di pubblicazione (Indeed, LinkedIn, Adecco, ecc.)" },
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
          description: "Estrae i campi principali di un annuncio di lavoro. Compila quanti più campi possibile sulla base del contenuto fornito.",
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
  try { return JSON.parse(args); } catch { return {}; }
}

async function fetchPageText(url: string): Promise<{ text: string; title: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.7",
    },
    redirect: "follow",
  });
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";

  // Try to extract JSON-LD JobPosting (most accurate)
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let jsonLdText = "";
  for (const m of jsonLdBlocks) {
    try {
      const raw = m[1].trim();
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of arr) {
        const t = obj?.["@type"];
        if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) {
          jsonLdText += "\n[JSON-LD JobPosting]\n" + JSON.stringify(obj).slice(0, 6000);
        }
      }
    } catch { /* ignore */ }
  }

  // Try meta description
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const combined = [
    title && `[TITLE] ${title}`,
    metaDesc && `[META] ${metaDesc}`,
    ogDesc && `[OG] ${ogDesc}`,
    jsonLdText,
    `[BODY] ${cleaned}`,
  ].filter(Boolean).join("\n\n");

  return { text: combined.slice(0, 16000), title };
}

function sourceFromUrl(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("indeed")) return "Indeed";
    if (h.includes("linkedin")) return "LinkedIn";
    if (h.includes("adecco")) return "Adecco";
    if (h.includes("infojobs")) return "InfoJobs";
    if (h.includes("gigroup")) return "GiGroup";
    if (h.includes("randstad")) return "Randstad";
    if (h.includes("manpower")) return "Manpower";
    if (h.includes("monster")) return "Monster";
    if (h.includes("subito")) return "Subito";
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
          content: "Sei un estrattore di dati da annunci di lavoro. Analizza l'immagine e compila TUTTI i campi disponibili (azienda, agenzia se presente, ruolo, località, contratto, stipendio, descrizione breve, requisiti chiave). Rispondi in italiano. Se un campo non è presente, ometterlo.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Estrai tutti i dati possibili da questo annuncio di lavoro." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]);
      if (!result.source) result.source = "Screenshot";
    } else if (url) {
      const { text } = await fetchPageText(url);
      if (!text || text.length < 50) {
        // Fallback minimo: almeno la fonte dall'URL
        const s = sourceFromUrl(url);
        return new Response(JSON.stringify({ source: s, _warning: "Pagina non leggibile, compila manualmente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = await callAI([
        {
          role: "system",
          content: `Sei un estrattore esperto di annunci di lavoro italiani. Compila TUTTI i campi possibili dal contenuto fornito.
REGOLE IMPORTANTI:
- Distingui sempre tra AZIENDA finale (datore di lavoro reale) e AGENZIA (intermediario/agenzia per il lavoro come Adecco, GiGroup, Randstad, Manpower, Synergie, Umana, Gi Group).
- Se l'annuncio è pubblicato da un'agenzia per conto di un'azienda cliente, popola entrambi i campi.
- Se l'azienda finale non è esplicita ma è solo un'agenzia, lascia 'company' vuoto e popola 'agency'.
- 'description' deve essere una sintesi breve (max 2-3 frasi) del ruolo.
- 'notes' deve contenere i requisiti chiave separati da virgole (es. "Excel avanzato, patente B, esperienza 2+ anni").
- Estrai sempre 'role', 'location' e 'contract_type' se presenti.
- Risposta in italiano.`,
        },
        { role: "user", content: `URL annuncio: ${url}\n\nCONTENUTO PAGINA:\n${text}` },
      ]);
      if (!result.source) {
        const s = sourceFromUrl(url);
        if (s) result.source = s;
      }
    }

    // Pulizia: rimuovi stringhe vuote
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === "string" && v.trim()) cleaned[k] = v.trim();
    }

    // Conta campi utili compilati per warning client-side
    const usefulKeys = ["company", "agency", "role", "location", "contract_type", "salary", "description", "notes"];
    const filledCount = usefulKeys.filter(k => cleaned[k]).length;
    if (filledCount < 3) {
      cleaned._warning = "Estrazione parziale: completa manualmente i campi mancanti.";
    }

    return new Response(JSON.stringify(cleaned), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-job error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
