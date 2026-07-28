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
      const rparams = new URLSearchParams();
      rparams.set("action", "requesttoken");
      rparams.set("client_id", process.env.WITHINGS_CLIENT_ID);
      rparams.set("client_secret", process.env.WITHINGS_CLIENT_SECRET);
      rparams.set("grant_type", "refresh_token");
      rparams.set("refresh_token", refreshToken);
      const rr = await fetch("https://wbsapi.withings.net/v2/oauth2", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: rparams.toString(),
      });
      const rdata = await rr.json();
      if (rdata.status !== 0) {
        res.status(400).json({ error: rdata.error || rdata });
        return;
      }
      token = rdata.body.access_token;
      newRefreshToken = rdata.body.refresh_token;
      newExpiresAt = nowSec + rdata.body.expires_in;
    }

    const mparams = new URLSearchParams();
    mparams.set("action", "getmeas");
    mparams.set("meastypes", "1,6,76"); // 1 = weight (kg), 6 = fat ratio (%), 76 = muscle mass (kg)
    mparams.set("category", "1"); // real measures, not user-declared goals
    if (after) mparams.set("startdate", String(after));
    const mr = await fetch("https://wbsapi.withings.net/measure", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: mparams.toString(),
    });
    const mdata = await mr.json();
    if (mdata.status !== 0) {
      res.status(400).json({ error: mdata.error || mdata });
      return;
    }

    res.status(200).json({
      measuregrps: mdata.body.measuregrps || [],
      access_token: token,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
