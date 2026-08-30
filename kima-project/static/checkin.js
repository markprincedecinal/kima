// POST /api/checkin
// Body: { token }
// Used by whatever scanning tool/app door staff use on the night of the event.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const token = body.token;
  if (!token) return json({ error: "Missing QR token." }, 400);

  const row = await env.DB.prepare(
    `SELECT full_name, guests_count, checked_in, checked_in_at FROM rsvps WHERE qr_token = ?`
  )
    .bind(token)
    .first();

  if (!row) return json({ error: "QR code not recognized." }, 404);

  if (row.checked_in) {
    return json(
      {
        error: "This QR code has already been used.",
        fullName: row.full_name,
        checkedInAt: row.checked_in_at,
      },
      409
    );
  }

  await env.DB.prepare(
    `UPDATE rsvps SET checked_in = 1, checked_in_at = datetime('now') WHERE qr_token = ?`
  )
    .bind(token)
    .run();

  return json({ success: true, fullName: row.full_name, guestsCount: row.guests_count });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
