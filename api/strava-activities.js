export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  try {
    const { accessToken, refreshToken, expiresAt, after } = req.body || {};
    if (!refreshToken) {
      res.status(400).json({ error: "Missing refreshToken" });
      return;
    }

    let token = accessToken;
    let newRefreshToken = refreshToken;
    let newExpiresAt = expiresAt;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!token || !expiresAt || expiresAt < nowSec + 60) {
      const r = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(r.status).json({ error: data });
        return;
      }
      token = data.access_token;
      newRefreshToken = data.refresh_token;
      newExpiresAt = data.expires_at;
    }

    const params = new URLSearchParams();
    params.set("per_page", "100");
    if (after) params.set("after", String(after));
    const actRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activities = await actRes.json();
    if (!actRes.ok) {
      res.status(actRes.status).json({ error: activities });
      return;
    }

    res.status(200).json({
      activities,
      access_token: token,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
