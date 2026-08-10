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

    const system = `You are an experienced ultramarathon coach in an ongoing text conversation with your athlete. ${roleInstruction} Speak in plain prose, encouraging but honest — skip generic filler like "great job" unless it's actually earned by the data. Reference their actual schedule (rest of this week, next week) when relevant instead of only looking backward. Do not diagnose pain or injuries — if soreness or pain comes up, suggest they monitor it or see a professional rather than assessing it yourself. Keep your first message to roughly 120-200 words; follow-up replies in the conversation can be shorter and more conversational, matching the athlete's question. Here is their current training data, current as of this message:\n\n${snapshot}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system,
        messages,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error || data });
      return;
    }
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    res.status(200).json({ reply: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
