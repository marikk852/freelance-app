const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');

// ============================================================
// Routes: /api/rooms — deal rooms
// ============================================================

/**
 * GET /api/rooms/join/:inviteLink
 * Find a contract by invite_link (room UUID).
 * Used by the freelancer when opening the invitation link.
 * Public — does not require being a participant.
 */
router.get('/join/:inviteLink', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         c.id             AS contract_id,
         c.title,
         c.description,
         c.amount_usd,
         c.currency,
         c.deadline,
         c.criteria,
         c.status,
         c.signed_by_client,
         c.signed_by_freelancer,
         c.deal_group_id,
         r.invite_link,
         r.status         AS room_status,
         r.freelancer_id,
         uc.first_name    AS client_first_name,
         uc.username      AS client_username,
         dg.title         AS group_title,
         dg.total_usd     AS group_total
       FROM rooms r
       JOIN contracts c  ON c.room_id = r.id
       JOIN users uc     ON uc.id = r.client_id
       LEFT JOIN deal_groups dg ON dg.room_id = r.id
       WHERE r.invite_link = $1
       ORDER BY c.milestone_idx ASC NULLS FIRST
       LIMIT 1`,
      [req.params.inviteLink]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Room not found' });

    // Для milestone-сделки добавим число этапов
    if (rows[0].deal_group_id) {
      const { rows: cnt } = await query(
        `SELECT COUNT(*)::int AS stages FROM contracts WHERE deal_group_id = $1`,
        [rows[0].deal_group_id]
      );
      rows[0].group_stages = cnt[0].stages;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[API] GET /rooms/join/:inviteLink error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
