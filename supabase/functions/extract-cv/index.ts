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
    languages: { type: "string", description: "Lingue parlate con livello, separate da virgola (es. 'Italiano madrelingua, Inglese B2')" },
  },
  required: ["skills", "experience_summary", "languages"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cv_text } = await req.json().catch(() => ({}));
    if (!cv_text || cv_text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Testo CV troppo corto." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configurata");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Estrai dati strutturati dal CV in italiano. Sii conciso e fattuale." },
          { role: "user", content: `CV:\n${String(cv_text).slice(0, 16000)}` },
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
    const data = args ? JSON.parse(args) : {};
    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
