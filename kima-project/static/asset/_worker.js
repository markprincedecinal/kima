// ============================================================
// Gwyneth's Debut — single Worker entry point
// ============================================================
// This project runs on Cloudflare's unified Workers platform, which
// (unlike the older "Pages" product) does not auto-detect a functions/
// folder. Instead, everything — API routes AND serving the static
// HTML/images — goes through this one script.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      // POST /api/rsvp
      if (pathname === "/api/rsvp" && request.method === "POST") {
        return await handleCreateRsvp(request, env);
      }

      // GET /api/rsvp/:token
      const rsvpMatch = pathname.match(/^\/api\/rsvp\/([^/]+)$/);
      if (rsvpMatch && request.method === "GET") {
        return await handleGetRsvp(rsvpMatch[1], env);
      }

      // POST /api/checkin
      if (pathname === "/api/checkin" && request.method === "POST") {
        return await handleCheckin(request, env);
      }
    } catch (err) {
      return json({ error: "Unexpected server error." }, 500);
    }

    // Everything else (index.html, rsvp.html, confirmation.html, images, etc.)
    // falls through to the static assets Cloudflare deployed alongside this Worker.
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------
// POST /api/rsvp
// Body: { fullName, phone, email?, guests?, attendance: "yes"|"no", message? }
// Response: { success: true, attendance, qrToken? }
// ---------------------------------------------------------------
async function handleCreateRsvp(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const fullName = (body.fullName || "").trim();
  const phone = (body.phone || "").trim();
  const email = (body.email || "").trim();
  const message = (body.message || "").trim();
  const attendance = body.attendance;
  const guests = body.guests ? Number(body.guests) : null;

  if (!fullName) return json({ error: "Full name is required." }, 400);
  if (!phone) return json({ error: "Phone number is required." }, 400);
  if (attendance !== "yes" && attendance !== "no") {
    return json({ error: "Please indicate whether you'll be attending." }, 400);
  }
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 5)) {
    return json({ error: "Guest count must be between 1 and 5." }, 400);
  }
  if (message.length > 200) {
    return json({ error: "Message must be 200 characters or fewer." }, 400);
  }

  const id = crypto.randomUUID();
  const qrToken = attendance === "yes" ? crypto.randomUUID() : null;

  try {
    await env.DB.prepare(
      `INSERT INTO rsvps (id, full_name, phone, email, guests_count, attendance, message, qr_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, fullName, phone, email || null, guests, attendance, message || null, qrToken)
      .run();
  } catch (err) {
    return json({ error: "Could not save your RSVP. Please try again." }, 500);
  }

  return json({ success: true, attendance, qrToken });
}

// ---------------------------------------------------------------
// GET /api/rsvp/:token
// Response: { fullName, guestsCount, checkedIn, checkedInAt }
// ---------------------------------------------------------------
async function handleGetRsvp(token, env) {
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

// ---------------------------------------------------------------
// POST /api/checkin
// Body: { token }
// ---------------------------------------------------------------
async function handleCheckin(request, env) {
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
