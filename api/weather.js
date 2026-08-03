export default async function handler(req, res) {
  const { lat, lon, date, hour } = req.query;
  if (!lat || !lon || !date) {
    res.status(400).json({ error: "Missing lat, lon, or date" });
    return;
  }
  try {
    const params = new URLSearchParams();
    params.set("latitude", lat);
    params.set("longitude", lon);
    params.set("start_date", date);
    params.set("end_date", date);
    params.set("hourly", "temperature_2m,relative_humidity_2m");
    params.set("temperature_unit", "fahrenheit");
    params.set("timezone", "auto");
    const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: data });
      return;
    }
    const idx = Math.max(0, Math.min(23, Number(hour) || 0));
    const tempF = data.hourly?.temperature_2m?.[idx];
    const humidityPct = data.hourly?.relative_humidity_2m?.[idx];
    res.status(200).json({
      tempF: tempF != null ? Math.round(tempF) : null,
      humidityPct: humidityPct != null ? Math.round(humidityPct) : null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
