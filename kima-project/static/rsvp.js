// POST /api/rsvp
// Body: { fullName, phone, email?, guests?, attendance: "yes"|"no", message? }
// Response: { success: true, attendance, qrToken? }
export async function onRequestPost({ request, env }) {
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

  // ---- server-side validation (never trust the client) ----
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
  // Only attendees who confirmed "yes" get a QR / entry pass.
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
