export default async function handler(req, res) {
  const code = req.query.code;
  const redirectUri = req.query.redirect_uri;
  if (!code || !redirectUri) {
    res.status(400).json({ error: "Missing code or redirect_uri" });
    return;
  }
  try {
    const params = new URLSearchParams();
    params.set("action", "requesttoken");
    params.set("client_id", process.env.WITHINGS_CLIENT_ID);
    params.set("client_secret", process.env.WITHINGS_CLIENT_SECRET);
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);

    const r = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await r.json();
    if (data.status !== 0) {
      res.status(400).json({ error: data.error || data });
      return;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    res.status(200).json({
      access_token: data.body.access_token,
      refresh_token: data.body.refresh_token,
      expires_at: nowSec + data.body.expires_in,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
