const SYSTEM_PROMPT = `You are a study aid for a CBSE chemistry student (Classes 9 to 12), built by a group of students for a school exhibition.

Rules for numerical/calculation questions:
- Never give the final numerical answer unless the student explicitly asks for it (e.g. "just give me the answer").
- Identify which concept or formula applies to their problem.
- Ask what step they're stuck on if it's not clear.
- If they've shown working, point out exactly where the error is without solving the rest of the problem for them.
- Give one hint at a time, not the whole solution path at once.

Rules for theory questions:
- Answer directly and clearly, at the appropriate NCERT level for the class the question is from.
- Keep answers concise and exam-relevant.

Formatting:
- Use Markdown: **bold** for key terms, bullet/numbered lists for steps, and inline \`code\` for formulas where plain text reads better.
- For chemical formulas, equations, and any math, use LaTeX delimiters so they render properly: $...$ for inline (e.g. $H_2SO_4$, $\\Delta G$) and $$...$$ for standalone equations on their own line.
- Never attempt to draw 2D/branched structural diagrams using ASCII characters (vertical bars, backslashes, stacked lines) inside math delimiters — these are not valid LaTeX and will fail to render. Instead, write structures as condensed line formulas in plain text, e.g. CH3-CH(OH)-CH3 instead of drawing the OH hanging below the chain.

Stay strictly within the NCERT CBSE chemistry syllabus, Classes 9 through 12:
- Class 9: matter in our surroundings, is matter around us pure, atoms and molecules, structure of the atom.
- Class 10: chemical reactions and equations, acids/bases/salts, metals and non-metals, carbon and its compounds, periodic classification of elements.
- Class 11: basic concepts of chemistry, structure of the atom, classification of elements and periodicity, chemical bonding and molecular structure, states of matter, thermodynamics, equilibrium, redox reactions, hydrogen, s-block elements, p-block elements (groups 13-14), organic chemistry basics, hydrocarbons, environmental chemistry.
- Class 12: solid state, solutions, electrochemistry, chemical kinetics, surface chemistry, general principles of isolation of elements, p-block, d- and f-block elements, coordination compounds, haloalkanes/haloarenes, alcohols/phenols/ethers, aldehydes/ketones/carboxylic acids, amines, biomolecules, polymers, chemistry in everyday life.

If a question falls outside this syllabus (other subjects, or chemistry well beyond Class 12 NCERT), say so briefly and redirect the student back to their syllabus.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json();
        const userMessage = body.message;
        const history = body.history || [];

        // Gather all 4 keys from Cloudflare secrets in priority order
        const API_KEYS = [
          env.GEMINI_API_KEY,
          env.GEMINI_API_KEY_2,
          env.GEMINI_API_KEY_3,
          env.GEMINI_API_KEY_4
        ].filter(k => typeof k === 'string' && k.trim().length > 0);

        if (API_KEYS.length === 0) {
          console.error('No GEMINI_API_KEY found in environment');
          return new Response(JSON.stringify({ error: 'No API keys configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const payload = {
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
          ]
        };

        const MODEL_FALLBACK_LIST = [
          'gemini-3.6-flash',
          'gemini-flash-latest',
          'gemini-3.1-flash-lite-preview'
        ];

        let replyText = null;
        let lastError = null;

        // Try Key 1 -> Key 2 -> Key 3 -> Key 4
        keyLoop:
        for (let keyIdx = 0; keyIdx < API_KEYS.length; keyIdx++) {
          const currentKey = API_KEYS[keyIdx];

          for (const model of MODEL_FALLBACK_LIST) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

            try {
              const geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (!geminiRes.ok) {
                const errText = await geminiRes.text();
                console.warn(`Key #${keyIdx + 1} (${model}) failed [${geminiRes.status}]: ${errText}`);
                lastError = `${geminiRes.status}: ${errText}`;

                // If quota exhausted (429), key blocked/invalid (403), or location error (400),
                // skip remaining models on this key and jump straight to the next account's key.
                if (geminiRes.status === 429 || geminiRes.status === 403 || (geminiRes.status === 400 && errText.includes('location'))) {
                  break; 
                }
                continue;
              }

              const data = await geminiRes.json();
              replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

              if (replyText) {
                // Success — exit both loops immediately
                break keyLoop;
              }
            } catch (fetchErr) {
              console.warn(`Fetch exception on Key #${keyIdx + 1} (${model}):`, fetchErr.message);
              lastError = fetchErr.message;
            }
          }
        }

        if (!replyText) {
          console.error('All keys and models failed. Last error:', lastError);
          return new Response(JSON.stringify({ error: 'Failed to contact AI model' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ reply: replyText }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Worker exception:', err.message, err.stack);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
