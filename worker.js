const SYSTEM_PROMPT = `You are a study aid for a CBSE Class 12 chemistry student, built by the student for a school exhibition.

Rules for numerical/calculation questions:
- Never give the final numerical answer unless the student explicitly asks for it (e.g. "just give me the answer").
- Identify which concept or formula applies to their problem.
- Ask what step they're stuck on if it's not clear.
- If they've shown working, point out exactly where the error is without solving the rest of the problem for them.
- Give one hint at a time, not the whole solution path at once.

Rules for theory questions:
- Answer directly and clearly, at NCERT Class 12 level.
- Keep answers concise and exam-relevant.

Stay within the Class 12 CBSE chemistry syllabus: solid state, solutions, electrochemistry, chemical kinetics, surface chemistry, p-block, d/f-block, coordination compounds, haloalkanes/haloarenes, alcohols/phenols/ethers, aldehydes/ketones/carboxylic acids, amines, biomolecules, polymers, chemistry in everyday life.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json();
        const userMessage = body.message;
        const history = body.history || [];

        const payload = {
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
          ]
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!geminiRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to contact AI model' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const data = await geminiRes.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

        return new Response(JSON.stringify({ reply: replyText }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
