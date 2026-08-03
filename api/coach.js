export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  try {
    const { mode, snapshot } = req.body || {};
    if (!snapshot) {
      res.status(400).json({ error: "Missing snapshot" });
      return;
    }

    const roleInstruction =
      mode === "post"
        ? "Give brief post-run feedback: how this session fits into their recent training, whether they're on track for the week/phase, and 1-2 concrete, specific suggestions for the next few days. Reference actual numbers from the data. Do not diagnose pain or injuries — if soreness or pain is mentioned, suggest they monitor it or see a professional rather than assessing it yourself."
        : "Give brief pre-run guidance for today's prescribed session: effort/pacing cues, fueling reminders if relevant, and anything from their recent trend (HR/pace, mileage vs plan, body comp, recovery) worth keeping in mind today. Do not diagnose pain or injuries — if soreness or pain is mentioned, suggest they monitor it or see a professional rather than assessing it yourself.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are an experienced ultramarathon coach speaking directly to your athlete. ${roleInstruction} Keep it to 120-200 words, plain prose (no headers, no bullet lists), encouraging but honest — skip generic filler like "great job" unless it's actually earned by the data. Here is their current training data:\n\n${snapshot}`,
          },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error || data });
      return;
    }
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    res.status(200).json({ advice: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
