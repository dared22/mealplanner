import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

const PlanSchema = z.object({
  days: z.array(z.object({
    date: z.string().optional(),
    meals: z.array(z.object({
      name: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      steps: z.array(z.string()).optional()
    }))
  })),
  shopping_list: z.array(z.object({
    item: z.string(),
    qty: z.number().optional(),
    unit: z.string().optional()
  })).default([])
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/plan', async (req, res) => {
  try {
    const { calories, days, diet, allergies = [], dislikes = [] } = req.body || {};

    // Basic input guardrails
    if (!calories || !days) {
      return res.status(400).json({ error: 'calories and days are required' });
    }

    const system = `You are a nutrition coach. Return ONLY JSON; no markdown. Each day should total within ±7% of the target kcal. Respect allergies and dislikes. Prefer simple, affordable ingredients.`;

    const user = {
      calories, days, diet,
      allergies, dislikes
    };

    const prompt = `
Create a ${days}-day meal plan at ~${calories} kcal/day.
Diet: ${diet || 'none'}
Allergies: ${allergies.join(', ') || 'none'}
Dislikes: ${dislikes.join(', ') || 'none'}

Return JSON with:
{
  "days": [
    {
      "date": "Day 1",
      "meals": [
        {"name": "...", "kcal": 600, "protein_g": 40, "carbs_g": 60, "fat_g": 20, "steps": ["...", "..."]}
      ]
    }
  ],
  "shopping_list": [{"item":"...", "qty": 2, "unit":"pcs"}]
}
Ensure numeric fields are numbers (not strings).
`;

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `OpenAI error (${r.status}): ${text}` });
    }

    const data = await r.json();

    
    const text =
      data.output_text ??
      data?.output?.[0]?.content?.[0]?.text ??
      data?.choices?.[0]?.message?.content ?? 
      '';

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Model did not return valid JSON', raw: text });
    }

    const parsed = PlanSchema.safeParse(json);
    if (!parsed.success) {
      return res.status(422).json({ error: 'Invalid plan schema', issues: parsed.error.issues, raw: json });
    }


    res.json(parsed.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
