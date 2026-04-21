const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const multer  = require('multer');
const sharp   = require('sharp');
const { query } = require('../../database/db');
const { User } = require('../../database/models');

const BANNERS_DIR = path.join(__dirname, '../../storage/banners');
const AVATARS_DIR = path.join(__dirname, '../../storage/avatars');
const SLIDES_DIR  = path.join(__dirname, '../../storage/slides');
[BANNERS_DIR, AVATARS_DIR, SLIDES_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const imgUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images are allowed'));
    cb(null, true);
  },
});

// ============================================================
// Routes: /api/users — user profile
// ============================================================

/**
 * GET /api/users/me/deals
 * All deals of the current user (as client + as freelancer).
 */
router.get('/me/deals', async (req, res) => {
  try {
    const { rows: userRows } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [req.user.telegramId]
    );
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' });
    const userId = userRows[0].id;

    const { rows } = await query(
      `SELECT
         c.id            AS contract_id,
         c.title,
         c.description,
         c.amount_usd,
         c.currency,
         c.status,
         c.deadline,
         c.crypto_amount,
         r.invite_link,
         e.status        AS escrow_status,
         CASE WHEN r.client_id = $1 THEN 'client' ELSE 'freelancer' END AS role
       FROM rooms r
       JOIN contracts c ON c.room_id = r.id
       LEFT JOIN escrow e ON e.contract_id = c.id
       WHERE r.client_id = $1 OR r.freelancer_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const as_client     = rows.filter(r => r.role === 'client');
    const as_freelancer = rows.filter(r => r.role === 'freelancer');

    res.json({ as_client, as_freelancer, total: rows.length });
  } catch (err) {
    console.error('[API] GET /users/me/deals error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/me
 * Get the current user's profile (all fields including extended profile).
 */
router.get('/me', async (req, res) => {
  try {
    // Upsert — auto-registration on first Mini App open
    await User.upsert({
      telegram_id: req.user.telegramId,
      username   : req.user.username,
      first_name : req.user.firstName,
      last_name  : req.user.lastName,
    });

    const { rows } = await query(
      `SELECT
         u.telegram_id,
         u.username,
         u.first_name,
         u.last_name,
         u.ton_wallet_address,
         u.rating,
         u.deals_count        AS deals_completed,
         u.level,
         u.xp,
         u.streak_days,
         u.safe_coins,
         u.is_verified,
         u.bio,
         u.role,
         u.category,
         u.skills,
         u.experience,
         u.account_type,
         u.company_name,
         u.company_url,
         u.country,
         u.portfolio_url,
         u.github_url,
         u.profile_completed,
         u.banner_url,
         u.avatar_url,
         u.slide_images,
         u.created_at,
         COALESCE(r.review_count, 0) AS review_count
       FROM users u
       LEFT JOIN (
         SELECT reviewee_id, COUNT(*) AS review_count
         FROM reviews GROUP BY reviewee_id
       ) r ON r.reviewee_id = u.id
       WHERE u.telegram_id = $1`,
      [req.user.telegramId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[API] GET /users/me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/me/profile
 * Update extended profile fields for the current user.
 * Sets profile_completed = TRUE when bio or at least one skill is provided.
 */
router.patch('/me/profile', async (req, res) => {
  try {
    const VALID_ROLES         = ['client', 'freelancer', 'both'];
    const VALID_EXPERIENCE    = ['junior', 'middle', 'senior'];
    const VALID_ACCOUNT_TYPES = ['individual', 'company'];
    const VALID_CATEGORIES    = ['design', 'dev', 'writing', 'video', 'marketing', 'other'];

    const {
      bio,
      role,
      category,
      skills,
      experience,
      account_type,
      company_name,
      company_url,
      country,
      portfolio_url,
      github_url,
    } = req.body;

    const errors = [];

    if (bio !== undefined) {
      if (typeof bio !== 'string') errors.push('bio must be a string');
      else if (bio.length > 300) errors.push('bio must be at most 300 characters');
    }

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (skills !== undefined) {
      if (!Array.isArray(skills)) {
        errors.push('skills must be an array of strings');
      } else {
        if (skills.length > 15) errors.push('skills may contain at most 15 items');
        for (const s of skills) {
          if (typeof s !== 'string') { errors.push('each skill must be a string'); break; }
          if (s.length > 30)         { errors.push('each skill must be at most 30 characters'); break; }
        }
      }
    }

    if (experience !== undefined && !VALID_EXPERIENCE.includes(experience)) {
      errors.push(`experience must be one of: ${VALID_EXPERIENCE.join(', ')}`);
    }

    if (account_type !== undefined && !VALID_ACCOUNT_TYPES.includes(account_type)) {
      errors.push(`account_type must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
    }

    if (company_name !== undefined) {
      if (typeof company_name !== 'string') errors.push('company_name must be a string');
      else if (company_name.length > 150)   errors.push('company_name must be at most 150 characters');
    }

    if (company_url !== undefined) {
      if (typeof company_url !== 'string') errors.push('company_url must be a string');
      else if (company_url.length > 255)   errors.push('company_url must be at most 255 characters');
    }

    if (country !== undefined) {
      if (typeof country !== 'string') errors.push('country must be a string');
      else if (country.length > 60)    errors.push('country must be at most 60 characters');
    }

    if (portfolio_url !== undefined) {
      if (typeof portfolio_url !== 'string') errors.push('portfolio_url must be a string');
      else if (portfolio_url.length > 255)   errors.push('portfolio_url must be at most 255 characters');
    }

    if (github_url !== undefined) {
      if (typeof github_url !== 'string') errors.push('github_url must be a string');
      else if (github_url.length > 255)   errors.push('github_url must be at most 255 characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], details: errors });
    }

    // Fetch existing record to merge skills for profile_completed check
    const { rows: existingRows } = await query(
      'SELECT bio, skills FROM users WHERE telegram_id = $1',
      [req.user.telegramId]
    );
    if (!existingRows[0]) return res.status(404).json({ error: 'User not found' });

    const mergedBio    = bio    !== undefined ? bio    : existingRows[0].bio;
    const mergedSkills = skills !== undefined ? skills : (existingRows[0].skills || []);
    const profileCompleted = !!(mergedBio || (Array.isArray(mergedSkills) && mergedSkills.length > 0));

    // Build dynamic SET clause only for provided fields
    const setClauses = ['profile_completed = $1', 'updated_at = NOW()'];
    const params     = [profileCompleted];
    let idx = 2;

    const fieldMap = {
      bio, role, category,
      experience, account_type,
      company_name, company_url, country,
      portfolio_url, github_url,
    };

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    // skills is JSONB — stringify explicitly
    if (skills !== undefined) {
      setClauses.push(`skills = $${idx++}`);
      params.push(JSON.stringify(skills));
    }

    params.push(req.user.telegramId);

    const { rows } = await query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE telegram_id = $${idx}
       RETURNING
         telegram_id, username, first_name, last_name,
         bio, role, category, skills, experience,
         account_type, company_name, company_url, country,
         portfolio_url, github_url, profile_completed`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[API] PATCH /users/me/profile error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/users/me/wallet
 * Save user's TON wallet.
 */
router.patch('/me/wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress is required' });

    // Validate TON address format
    const TON_ADDRESS_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46}$/;
    if (!TON_ADDRESS_RE.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid TON address format (expected UQ... or EQ...)' });
    }

    const user = await User.setWallet(req.user.telegramId, walletAddress);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/me/banner
 * Upload profile banner image. Resized to 900×300 JPEG, max 5 MB.
 */
router.post('/me/banner', imgUpload.single('banner'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const filename = `${req.user.telegramId}_${Date.now()}.jpg`;
    const outPath  = path.join(BANNERS_DIR, filename);

    // Resize to 900x300, convert to JPEG, quality 85
    await sharp(req.file.path)
      .resize(900, 300, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outPath);

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});

    const bannerUrl = `/banners/${filename}`;

    // Delete old banner if exists
    const { rows: old } = await query(
      'SELECT banner_url FROM users WHERE telegram_id = $1', [req.user.telegramId]
    );
    if (old[0]?.banner_url) {
      const oldFile = path.join(BANNERS_DIR, path.basename(old[0].banner_url));
      if (fs.existsSync(oldFile)) fs.unlink(oldFile, () => {});
    }

    await query(
      'UPDATE users SET banner_url = $1, updated_at = NOW() WHERE telegram_id = $2',
      [bannerUrl, req.user.telegramId]
    );

    res.json({ bannerUrl });
  } catch (err) {
    console.error('[API] POST /users/me/banner error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/me/avatar
 * Upload square profile avatar. Resized to 400x400 JPEG.
 */
router.post('/me/avatar', imgUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const filename = `${req.user.telegramId}_${Date.now()}.jpg`;
    const outPath  = path.join(AVATARS_DIR, filename);

    await sharp(req.file.path)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outPath);

    fs.unlink(req.file.path, () => {});

    const avatarUrl = `/avatars/${filename}`;

    // Delete old avatar
    const { rows: old } = await query(
      'SELECT avatar_url FROM users WHERE telegram_id = $1', [req.user.telegramId]
    );
    if (old[0]?.avatar_url) {
      const oldFile = path.join(AVATARS_DIR, path.basename(old[0].avatar_url));
      if (fs.existsSync(oldFile)) fs.unlink(oldFile, () => {});
    }

    await query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE telegram_id = $2',
      [avatarUrl, req.user.telegramId]
    );

    res.json({ avatarUrl });
  } catch (err) {
    console.error('[API] POST /users/me/avatar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/me/slides
 * Add a slide image (max 5). Resized to 900x500 JPEG.
 */
router.post('/me/slides', imgUpload.single('slide'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    // Check current count
    const { rows } = await query(
      'SELECT slide_images FROM users WHERE telegram_id = $1', [req.user.telegramId]
    );
    const slides = rows[0]?.slide_images || [];
    if (slides.length >= 5) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Maximum 5 slides allowed' });
    }

    const filename = `${req.user.telegramId}_${Date.now()}.jpg`;
    const outPath  = path.join(SLIDES_DIR, filename);

    await sharp(req.file.path)
      .resize(900, 500, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outPath);

    fs.unlink(req.file.path, () => {});

    const slideUrl = `/slides/${filename}`;
    const updated  = [...slides, slideUrl];

    await query(
      'UPDATE users SET slide_images = $1, updated_at = NOW() WHERE telegram_id = $2',
      [JSON.stringify(updated), req.user.telegramId]
    );

    res.json({ slideUrl, slides: updated });
  } catch (err) {
    console.error('[API] POST /users/me/slides error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/me/slides/:index
 * Remove a slide by index (0-4).
 */
router.delete('/me/slides/:index', async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0 || idx > 4) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const { rows } = await query(
      'SELECT slide_images FROM users WHERE telegram_id = $1', [req.user.telegramId]
    );
    const slides = rows[0]?.slide_images || [];
    if (idx >= slides.length) return res.status(404).json({ error: 'Slide not found' });

    // Delete file
    const oldFile = path.join(SLIDES_DIR, path.basename(slides[idx]));
    if (fs.existsSync(oldFile)) fs.unlink(oldFile, () => {});

    const updated = slides.filter((_, i) => i !== idx);
    await query(
      'UPDATE users SET slide_images = $1, updated_at = NOW() WHERE telegram_id = $2',
      [JSON.stringify(updated), req.user.telegramId]
    );

    res.json({ slides: updated });
  } catch (err) {
    console.error('[API] DELETE /users/me/slides error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/freelancers
 * List of freelancers with completed profiles.
 */
router.get('/freelancers', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         u.telegram_id,
         u.username,
         u.first_name,
         u.bio,
         u.role,
         u.category,
         u.skills,
         u.experience,
         u.country,
         u.rating,
         u.deals_count AS deals_completed,
         u.level
       FROM users u
       WHERE u.profile_completed = TRUE
         AND u.role IN ('freelancer', 'both')
       ORDER BY u.rating DESC, u.deals_count DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('[API] GET /users/freelancers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:telegramId
 * Public profile of a user by Telegram ID.
 * IMPORTANT: Must be declared before /:telegramId/portfolio and /:telegramId/reviews
 * so Express matches it correctly.
 */
router.get('/:telegramId', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId, 10);
    if (isNaN(telegramId)) {
      return res.status(400).json({ error: 'telegramId must be a number' });
    }

    const { rows } = await query(
      `SELECT
         u.telegram_id,
         u.username,
         u.first_name,
         u.bio,
         u.role,
         u.category,
         u.skills,
         u.experience,
         u.account_type,
         u.company_name,
         u.company_url,
         u.country,
         u.portfolio_url,
         u.github_url,
         u.rating,
         u.deals_count  AS deals_completed,
         u.level,
         u.xp,
         u.profile_completed,
         u.banner_url,
         u.avatar_url,
         u.slide_images
       FROM users u
       WHERE u.telegram_id = $1`,
      [telegramId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[API] GET /users/:telegramId error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:telegramId/portfolio
 * Get a freelancer's portfolio.
 */
router.get('/:telegramId/portfolio', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.title AS contract_title, c.amount_usd, c.currency
       FROM portfolio_items p
       JOIN contracts c ON c.id = p.contract_id
       JOIN users u ON u.id = p.freelancer_id
       WHERE u.telegram_id = $1 AND p.is_visible = TRUE
       ORDER BY p.created_at DESC`,
      [req.params.telegramId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:telegramId/reviews
 * Get reviews for a user.
 */
router.get('/:telegramId/reviews', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.rating, r.comment, r.created_at,
              u.username AS reviewer_username
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       JOIN users rev ON rev.id = r.reviewee_id
       WHERE rev.telegram_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.telegramId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
