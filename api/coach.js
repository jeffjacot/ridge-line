export const config = { maxDuration: 30 }; // extend past Vercel's default 10s — Sonnet occasionally takes a bit longer

async function callClaude(system, messages) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system,
      messages,
    }),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  try {
    const { mode, snapshot, messages } = req.body || {};
    if (!snapshot) {
      res.status(400).json({ error: "Missing snapshot" });
      return;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Missing messages" });
      return;
    }

    const roleInstruction =
      mode === "post"
        ? "This is post-run feedback: how the most recent session fits into their recent training, whether they're on track for the week/phase given what's still scheduled, and 1-2 concrete, specific suggestions for the next few days. Reference actual numbers and actual scheduled days from the data."
        : "This is pre-run guidance for today's prescribed session: effort/pacing cues, fueling reminders if relevant, anything from their recent trend (HR/pace, mileage vs plan, body comp, recovery) worth keeping in mind today, and how today fits into the rest of the week's schedule.";

    const system = `You are an experienced ultramarathon coach in an ongoing text conversation with your athlete. ${roleInstruction} Speak in plain prose, encouraging but honest — skip generic filler like "great job" unless it's actually earned by the data. Reference their actual schedule (rest of this week, next week) when relevant instead of only looking backward. The schedule data below already labels each day's relative timing (TODAY, TOMORROW, in N days, N days ago) — use those labels directly rather than computing the gap yourself from the dates, since that's an easy place to introduce an off-by-one error. Do not diagnose pain or injuries — if soreness or pain comes up, suggest they monitor it or see a professional rather than assessing it yourself. Your first message must be under 180 words — this is a hard limit, not a target, so pick the 2-3 things that matter most rather than trying to cover everything in the data; there's no need to touch on every run, every metric, or every day of the week. Follow-up replies in the conversation should be shorter still, a few sentences, conversational, matching the athlete's actual question. Here is their current training data, current as of this message:\n\n${snapshot}`;

    // Transient upstream failures (rate limit / overloaded / momentary 5xx)
    // are common enough with LLM APIs that it's worth a couple of quick
    // retries here before making the client surface an error at all. An
    // empty/blank reply on an otherwise-"successful" response counts as a
    // failure too — that's exactly the silent-blank-message bug this guards
    // against — so it gets the same retry treatment.
    const RETRYABLE = new Set([429, 500, 502, 503, 529]);
    let response, data, text = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await callClaude(system, messages);
      data = await response.json();
      if (response.ok) {
        text = (data.content || []).map((b) => b.text || "").join("").trim();
        if (text) break; // got real content — done
        if (attempt === 2) break; // out of retries, will fall through to the empty-reply error below
      } else if (!RETRYABLE.has(response.status) || attempt === 2) {
        break;
      }
      await sleep(500 * (attempt + 1));
    }

    if (!response.ok) {
      res.status(response.status).json({ error: data.error || data });
      return;
    }
    if (!text) {
      res.status(502).json({ error: { message: "The coach came back with an empty response after retrying — please try again." } });
      return;
    }
    res.status(200).json({ reply: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
