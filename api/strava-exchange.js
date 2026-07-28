export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    res.status(400).json({ error: "Missing code" });
    return;
  }
  try {
    const r = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: data });
      return;
    }
    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_name: data.athlete ? `${data.athlete.firstname} ${data.athlete.lastname}` : null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
