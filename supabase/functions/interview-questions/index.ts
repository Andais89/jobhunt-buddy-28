const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 10,
      description: "Domande probabili al colloquio in italiano, brevi e specifiche al ruolo/JD",
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { job_text, role, company, profile_text } = await req.json().catch(() => ({}));
    if (!job_text || String(job_text).trim().length < 30) {
      return new Response(JSON.stringify({ error: "Job description troppo corta." }), {
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
          { role: "system", content: "Sei un coach di colloqui. Genera 6-8 domande probabili per il colloquio: mix di tecniche, comportamentali e motivazionali, calibrate sul ruolo. Italiano." },
          { role: "user", content: `RUOLO: ${role || "—"} @ ${company || "—"}\nJOB DESCRIPTION:\n${String(job_text).slice(0, 8000)}\n\nPROFILO CANDIDATO:\n${String(profile_text || "").slice(0, 4000)}` },
        ],
        tools: [{ type: "function", function: { name: "gen_questions", description: "Genera domande", parameters: SCHEMA } }],
        tool_choice: { type: "function", function: { name: "gen_questions" } },
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
    const data = args ? JSON.parse(args) : { questions: [] };
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
