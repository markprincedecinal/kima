// GET /api/rsvp/:token
// Response: { fullName, guestsCount, checkedIn, checkedInAt }
export async function onRequestGet({ params, env }) {
  const { token } = params;
  if (!token) return json({ error: "Missing token." }, 400);

  const row = await env.DB.prepare(
    `SELECT full_name, guests_count, checked_in, checked_in_at
     FROM rsvps WHERE qr_token = ?`
  )
    .bind(token)
    .first();

  if (!row) return json({ error: "QR code not recognized." }, 404);

  return json({
    fullName: row.full_name,
    guestsCount: row.guests_count,
    checkedIn: !!row.checked_in,
    checkedInAt: row.checked_in_at,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
