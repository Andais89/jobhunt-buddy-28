const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string", description: "Nome dell'azienda finale" },
    agency: { type: "string", description: "Agenzia o intermediario, se presente" },
    role: { type: "string", description: "Titolo del ruolo / posizione" },
    status: { type: "string", enum: ["da_valutare", "in_attesa", "colloquio", "positiva", "negativa"] },
    location: { type: "string", description: "Città o località di lavoro" },
    contract_type: { type: "string", description: "Tipo di contratto" },
    salary: { type: "string", description: "Retribuzione o range salariale" },
    applied_at: { type: "string", description: "Data candidatura in formato YYYY-MM-DD, se inferibile" },
    description: { type: "string", description: "Breve descrizione del ruolo, max 2-3 frasi" },
    notes: { type: "string", description: "Requisiti chiave o note utili" },
    source: { type: "string", description: "Portale o fonte originale" },
    work_mode: { type: "string", description: "Remote, Hybrid o On-site se presente" },
    seniority_level: { type: "string", description: "Livello di seniority" },
    benefits: { type: "string", description: "Benefit principali" },
    contact_email: { type: "string", description: "Email di contatto, se presente" }
  },
  additionalProperties: false,
};

const AGENCY_KEYWORDS = [
  "adecco", "gigroup", "gi group", "randstad", "manpower", "umana", "synergie", "during", "orienta", "maw",
  "tempor", "aliro", "etjca", "humangest", "jobtech", "openjobmetis", "lavoropiù", "e-work", "e work"
];

function normalizeSpace(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function cleanEntity(value?: string | null) {
  return normalizeSpace(value)
    .replace(/^(azienda|company|agenzia|agency)\s*[:\-]\s*/i, "")
    .replace(/^(via|tramite)\s+/i, "")
    .replace(/^annuncio pubblicato da\s+/i, "");
}

function isAgencyName(value?: string | null) {
  const normalized = cleanEntity(value).toLowerCase();
  return !!normalized && AGENCY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, selector: RegExp) {
  return normalizeSpace(html.match(selector)?.[1] ?? "");
}

function extractEmails(text: string) {
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(emails)].filter((email) => !email.includes("example."));
}

function sourceFromUrl(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("indeed")) return "Indeed";
    if (h.includes("linkedin")) return "LinkedIn";
    if (h.includes("adecco")) return "Adecco";
    if (h.includes("infojobs")) return "InfoJobs";
    if (h.includes("gigroup")) return "Gi Group";
    if (h.includes("jooble")) return "Jooble";
    if (h.includes("randstad")) return "Randstad";
    if (h.includes("monster")) return "Monster";
    return "Sito aziendale";
  } catch {
    return undefined;
  }
}

async function fetchDirect(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, html };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, html: "" };
  }
}

/**
 * r.jina.ai vuole `https://r.jina.ai/<URL_COMPLETO_INCLUSO_SCHEMA>`.
 * Il vecchio formato `r.jina.ai/http://${url}` perdeva https → 308 / contenuto vuoto su Indeed.
 */
async function fetchViaJina(url: string) {
  try {
    const target = `https://r.jina.ai/${url}`;
    const res = await fetch(target, {
      headers: {
        "Accept": "text/plain, text/markdown;q=0.9, */*;q=0.8",
        "X-Return-Format": "markdown",
      },
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

/**
 * Indeed blocca lo scraping diretto (403/blank). Costruisce variante viewjob desktop/mobile
 * e tenta sempre via Jina che esegue il rendering lato server.
 */
function indeedVariants(url: string): string[] {
  try {
    const u = new URL(url);
    const jk = u.searchParams.get("jk") || u.searchParams.get("vjk");
    const variants = [url];
    if (jk) {
      variants.push(`https://${u.hostname}/viewjob?jk=${jk}`);
      variants.push(`https://it.indeed.com/viewjob?jk=${jk}`);
      variants.push(`https://it.indeed.com/m/viewjob?jk=${jk}`);
    }
    return [...new Set(variants)];
  } catch {
    return [url];
  }
}

function extractJsonLdText(html: string) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const snippets: string[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const type = item?.["@type"];
        if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
          snippets.push(JSON.stringify(item));
        }
      }
    } catch {
      // ignore invalid blocks
    }
  }
  return snippets.join("\n").slice(0, 10000);
}

function buildContext(url: string, direct: Awaited<ReturnType<typeof fetchDirect>> | null, jina: Awaited<ReturnType<typeof fetchViaJina>> | null) {
  const html = direct?.html ?? "";
  const title = extractMeta(html, /<title[^>]*>([^<]+)<\/title>/i);
  const metaDescription = extractMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const ogDescription = extractMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const bodyText = stripHtml(html).slice(0, 24000);
  const jsonLd = extractJsonLdText(html);
  const jinaText = normalizeSpace(jina?.text).slice(0, 20000);

  return [
    `URL: ${url}`,
    direct?.finalUrl ? `FINAL_URL: ${direct.finalUrl}` : "",
    title ? `[TITLE]\n${title}` : "",
    metaDescription ? `[META DESCRIPTION]\n${metaDescription}` : "",
    ogDescription ? `[OG DESCRIPTION]\n${ogDescription}` : "",
    jsonLd ? `[JSON-LD JOBPOSTING]\n${jsonLd}` : "",
    bodyText ? `[VISIBLE HTML TEXT]\n${bodyText}` : "",
    jinaText ? `[FALLBACK RENDERED TEXT]\n${jinaText}` : "",
  ].filter(Boolean).join("\n\n");
}

async function callAI(messages: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY non configurata");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: [{
        type: "function",
        function: {
          name: "extract_job",
          description: "Estrae tutti i dati possibili di un annuncio di lavoro con distinzione pulita tra azienda finale e agenzia.",
          parameters: SCHEMA,
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_job" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Limite richieste raggiunto, riprova tra poco");
    if (res.status === 402) throw new Error("Crediti AI esauriti");
    throw new Error(`AI error ${res.status}: ${text}`);
  }

  const payload = await res.json();
  const args = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

function normalizeResult(result: Record<string, string>, sourceUrl?: string) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(result)) {
    const normalized = normalizeSpace(value);
    if (normalized) cleaned[key] = normalized;
  }

  cleaned.company = cleanEntity(cleaned.company);
  cleaned.agency = cleanEntity(cleaned.agency);

  if (cleaned.company && isAgencyName(cleaned.company) && !cleaned.agency) {
    cleaned.agency = cleaned.company;
    delete cleaned.company;
  }

  if (cleaned.company && cleaned.agency && cleaned.company.toLowerCase() === cleaned.agency.toLowerCase() && isAgencyName(cleaned.agency)) {
    delete cleaned.company;
  }

  if (!cleaned.status) cleaned.status = "in_attesa";
  if (!cleaned.applied_at || !/^\d{4}-\d{2}-\d{2}$/.test(cleaned.applied_at)) {
    cleaned.applied_at = new Date().toISOString().slice(0, 10);
  }
  if (!cleaned.source && sourceUrl) {
    const inferred = sourceFromUrl(sourceUrl);
    if (inferred) cleaned.source = inferred;
  }

  return cleaned;
}

function isStrongEnough(result: Record<string, string>) {
  return !!result.role && !!(result.company || result.agency);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { url, image } = body as { url?: string; image?: string };

    if (!url && !image) {
      return new Response(JSON.stringify({ error: "Fornisci `url` o `image`" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (image) {
      const aiImage = await callAI([
        {
          role: "system",
          content: "Analizza screenshot di annunci di lavoro e compila quanti più campi possibili. Distingui sempre azienda finale e agenzia. Se l'azienda finale non è esplicita, lascia vuota company e compila agency. Imposta status a in_attesa se non presente. applied_at in formato YYYY-MM-DD se deducibile, altrimenti oggi.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Estrai tutti i dati possibili da questo annuncio di lavoro." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]);

      const normalized = normalizeResult(aiImage, undefined);
      if (!normalized.source) normalized.source = "Screenshot";
      if (!isStrongEnough(normalized)) {
        return new Response(JSON.stringify({ error: "Unable to read this source. Please try another link or screenshot." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(normalized), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeUrl = normalizeSpace(url);
    const isIndeed = /indeed\./i.test(safeUrl);
    let direct: Awaited<ReturnType<typeof fetchDirect>> | null = null;
    let jina: Awaited<ReturnType<typeof fetchViaJina>> | null = null;

    if (isIndeed) {
      // Indeed: cycle through variants until one yields useful content via Jina.
      const variants = indeedVariants(safeUrl);
      for (const v of variants) {
        const j = await fetchViaJina(v);
        if (j.ok && j.text && j.text.length > 400) { jina = j; break; }
        if (!jina && j.text) jina = j;
      }
      // Direct fetch is unlikely to work but try anyway for JSON-LD.
      direct = await fetchDirect(safeUrl);
    } else {
      direct = await fetchDirect(safeUrl);
      jina = await fetchViaJina(safeUrl);
    }

    const context = buildContext(safeUrl, direct, jina);
    const foundEmails = extractEmails(context);

    const aiResult = await callAI([
      {
        role: "system",
        content:
          "Sei un assistente premium per import automatico di candidature. Devi completare il form nel modo più completo possibile usando TUTTE le fonti disponibili, inclusi testo renderizzato, meta tag, JSON-LD e fallback testuali. Non fermarti al primo indizio. Regole: 1) distingui sempre azienda finale e agenzia; 2) se compare solo un'agenzia, lascia company vuoto e compila agency; 3) non duplicare mai la stessa entità in company e agency; 4) compila role, location, contract_type, description, notes, salary, work_mode, seniority_level, benefits, contact_email quando disponibili o inferibili in modo ragionevole; 5) description breve e pulita, notes focalizzate sui requisiti; 6) status di default in_attesa; 7) applied_at in formato YYYY-MM-DD se non leggibile usa la data odierna.",
      },
      {
        role: "user",
        content: `Analizza questo annuncio e restituisci il massimo numero di campi affidabili.\n\nEMAIL TROVATE: ${foundEmails.join(", ") || "nessuna"}\n\nCONTENUTO:\n${context}`,
      },
    ]);

    const normalized = normalizeResult(aiResult, direct?.finalUrl || safeUrl);
    if (!normalized.contact_email && foundEmails[0]) normalized.contact_email = foundEmails[0];

    if (!isStrongEnough(normalized)) {
      return new Response(JSON.stringify({ error: "Unable to read this source. Please try another link or screenshot." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore";
    console.error("import-job error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
