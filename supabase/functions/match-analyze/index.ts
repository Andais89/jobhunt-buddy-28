const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    job_summary: { type: "string", description: "Riassunto della posizione in 2-3 frasi" },
    match_score: { type: "integer", minimum: 0, maximum: 100, description: "Compatibilità tra profilo candidato e job description (0-100)" },
    gap_analysis: {
      type: "array",
      items: { type: "string" },
      minItems: 0,
      maxItems: 5,
      description: "Da 3 a 5 punti chiave del job che mancano o sono deboli nel profilo del candidato. Frasi brevi.",
    },
    rationale: { type: "string", description: "Motivazione breve dello score" },
  },
  required: ["match_score", "gap_analysis"],
  additionalProperties: false,
};

async function callAI(messages: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY non configurata");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: [{
        type: "function",
        function: { name: "analyze_match", description: "Analizza compatibilità tra job description e profilo candidato.", parameters: SCHEMA },
      }],
      tool_choice: { type: "function", function: { name: "analyze_match" } },
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
  try { return JSON.parse(args); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { job_text, profile_text, company, role } = body as {
      job_text?: string; profile_text?: string; company?: string; role?: string;
    };

    if (!job_text || job_text.trim().length < 30) {
      return new Response(JSON.stringify({ error: "Inserisci una Job Description di almeno 30 caratteri." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileBlock = (profile_text && profile_text.trim().length > 10)
      ? profile_text.trim().slice(0, 8000)
      : "(Profilo candidato non fornito. Stima score in modo conservativo basandoti solo sulla genericità del ruolo.)";

    const result = await callAI([
      {
        role: "system",
        content:
          "Sei un coach di carriera. Confronta il profilo del candidato con la job description e produci: " +
          "1) match_score 0-100 onesto (non gonfiare i numeri); " +
          "2) gap_analysis con 3-5 punti chiave brevi (skill, esperienza, certificazioni mancanti o deboli) scritti in italiano in seconda persona ('Manca esperienza di...', 'Aggiungi certificazione...'); " +
          "3) job_summary breve in italiano. Sii pragmatico.",
      },
      {
        role: "user",
        content:
          `JOB DESCRIPTION (${role || "ruolo non specificato"} @ ${company || "azienda non specificata"}):\n${job_text.slice(0, 12000)}\n\n` +
          `PROFILO CANDIDATO:\n${profileBlock}`,
      },
    ]);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore";
    console.error("match-analyze error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
