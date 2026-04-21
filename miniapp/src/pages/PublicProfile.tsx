import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

// ============================================================
// Public Profile — открывается по роуту /profile/:telegramId
// ============================================================

type Role = 'client' | 'freelancer' | 'both';

interface PublicUser {
  id: number;
  telegram_id: number | string;
  username?: string;
  first_name?: string;
  bio?: string;
  country?: string;
  role?: Role;
  skill_category?: string;
  experience?: string;
  skills?: string[];
  account_type?: 'individual' | 'company';
  company_name?: string;
  company_website?: string;
  portfolio_url?: string;
  github_url?: string;
  deals_completed?: number;
  rating?: number;
  level?: number;
  xp?: number;
  banner_url?: string;
  avatar_url?: string;
  slide_images?: string[];
}

function RolePill({ role }: { role: Role }) {
  const map: Record<Role, { label: string; color: string; bg: string }> = {
    client:     { label: '💼 CLIENT',            color: '#4488ff', bg: 'rgba(68,136,255,0.12)' },
    freelancer: { label: '🛠 FREELANCER',        color: '#00ff88', bg: 'rgba(0,255,136,0.10)' },
    both:       { label: '🔄 CLIENT + FREELANCER', color: '#ffaa00', bg: 'rgba(255,170,0,0.10)' },
  };
  const cfg = map[role] ?? map.client;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '6px',
      padding: '4px 10px',
      borderRadius: '34px',
      border: `1px solid ${cfg.color}66`,
      color: cfg.color,
      background: cfg.bg,
      fontFamily: '"Press Start 2P", monospace',
    }}>
      {cfg.label}
    </span>
  );
}

export function PublicProfile() {
  const { telegramId } = useParams<{ telegramId: string }>();
  const navigate = useNavigate();
  const { tg } = useTelegram();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!telegramId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      try {
        const res = await usersApi.getPublic(telegramId);
        setProfile(res.data);
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [telegramId]);

  const handleBack = () => {
    tg?.HapticFeedback?.selectionChanged();
    navigate(-1);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
          LOADING...
        </div>
      </div>
    );
  }

  // ---- 404 state ----
  if (notFound || !profile) {
    return (
      <div className="page fade-in" style={{ textAlign: 'center', paddingTop: '60px' }}>
        <button
          onClick={handleBack}
          style={{
            display: 'block',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: 'rgba(255,255,255,0.4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '40px',
            textAlign: 'left',
          }}
        >
          ← BACK
        </button>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
          PROFILE NOT FOUND
        </div>
      </div>
    );
  }

  const showSkills  = profile.role !== 'client' && profile.skills && profile.skills.length > 0;
  const showCompany = profile.account_type === 'company';
  const hasLinks    = profile.portfolio_url || profile.github_url;

  return (
    <div className="page fade-in">

      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '7px',
          color: 'rgba(255,255,255,0.4)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: '10px',
          padding: '4px 0',
          display: 'block',
        }}
      >
        ← BACK
      </button>

      {/* Banner */}
      {profile.banner_url && (
        <div style={{
          width: '100%', height: '90px', borderRadius: '14px',
          overflow: 'hidden', marginBottom: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <img src={profile.banner_url} alt="banner"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Header card */}
      <div className="gl card-stagger-1" style={{ padding: '18px 14px', textAlign: 'center' }}>
        <div className="pxgrid" /><div className="sh" />
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="avatar"
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              objectFit: 'cover', border: '2px solid rgba(0,255,136,0.4)',
              marginBottom: '10px', display: 'block', margin: '0 auto 10px',
            }}
          />
        ) : (
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛡</div>
        )}
        <div className="logo" style={{ fontSize: '12px', marginBottom: '6px' }}>
          {profile.first_name?.toUpperCase() || 'ANONYMOUS'}
        </div>
        {profile.username && (
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>
            @{profile.username}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {profile.country && (
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)' }}>
              🌍 {profile.country}
            </span>
          )}
          {profile.role && <RolePill role={profile.role} />}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="gl card-stagger-2" style={{ padding: '12px 14px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', letterSpacing: '1px' }}>
            -- ABOUT --
          </div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.65)', lineHeight: '2.2' }}>
            {profile.bio}
          </div>
        </div>
      )}

      {/* Skills */}
      {showSkills && (
        <div className="gl card-stagger-2" style={{ padding: '12px 14px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '1px' }}>
            -- SKILLS --
          </div>
          {profile.skill_category && (
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
              {profile.skill_category.toUpperCase()}
              {profile.experience ? ` · ${profile.experience.toUpperCase()}` : ''}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {profile.skills!.map(skill => (
              <span
                key={skill}
                className="gl-pill"
                style={{
                  fontSize: '6px',
                  padding: '4px 9px',
                  color: '#cc44ff',
                  border: '1px solid rgba(204,68,255,0.4)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="gl card-stagger-3" style={{ padding: '12px 14px' }}>
        <div className="pxgrid" /><div className="sh" />
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '1px' }}>
          -- STATS --
        </div>
        <div className="stats" style={{ marginBottom: 0 }}>
          <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)', padding: '10px 4px' }}>
            <div className="pxgrid" />
            <span className="stat-n" style={{ color: '#00ff88', fontSize: '13px' }}>
              {profile.deals_completed ?? 0}
            </span>
            <span className="stat-l">✅ DEALS</span>
          </div>
          <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)', padding: '10px 4px' }}>
            <div className="pxgrid" />
            <span className="stat-n" style={{ color: '#ffaa00', fontSize: '11px' }}>
              {(profile.rating ?? 0) > 0 ? `⭐${profile.rating}` : '—'}
            </span>
            <span className="stat-l">RATING</span>
          </div>
          <div className="stat gl-sm" style={{ borderColor: 'rgba(204,68,255,0.3)', padding: '10px 4px' }}>
            <div className="pxgrid" />
            <span className="stat-n" style={{ color: '#cc44ff', fontSize: '13px' }}>
              ⚔ {profile.level ?? 1}
            </span>
            <span className="stat-l">LEVEL</span>
          </div>
          <div className="stat gl-sm" style={{ borderColor: 'rgba(0,136,255,0.3)', padding: '10px 4px' }}>
            <div className="pxgrid" />
            <span className="stat-n" style={{ color: '#0088ff', fontSize: '11px' }}>
              {profile.xp ?? 0}
            </span>
            <span className="stat-l">XP</span>
          </div>
        </div>
      </div>

      {/* Portfolio slides */}
      {profile.slide_images && profile.slide_images.length > 0 && (
        <div className="gl card-stagger-3" style={{ padding: '12px 14px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '1px' }}>
            -- PORTFOLIO --
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px', height: '160px', background: '#111' }}>
            <img
              src={profile.slide_images[slideIndex]}
              alt={`slide ${slideIndex + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {profile.slide_images.length > 1 && (
              <>
                <button onClick={() => setSlideIndex(i => (i - 1 + profile.slide_images!.length) % profile.slide_images!.length)}
                  style={{
                    position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff',
                    fontFamily: '"Press Start 2P", monospace', fontSize: '8px',
                    borderRadius: '4px', padding: '4px 7px', cursor: 'pointer',
                  }}>◀</button>
                <button onClick={() => setSlideIndex(i => (i + 1) % profile.slide_images!.length)}
                  style={{
                    position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff',
                    fontFamily: '"Press Start 2P", monospace', fontSize: '8px',
                    borderRadius: '4px', padding: '4px 7px', cursor: 'pointer',
                  }}>▶</button>
              </>
            )}
          </div>
          {profile.slide_images.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '8px' }}>
              {profile.slide_images.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  style={{
                    width: i === slideIndex ? '14px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i === slideIndex ? '#00ff88' : 'rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Company */}
      {showCompany && (
        <div className="gl card-stagger-4" style={{ padding: '12px 14px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', letterSpacing: '1px' }}>
            -- COMPANY --
          </div>
          {profile.company_name && (
            <div style={{ fontSize: '9px', color: '#fff', marginBottom: '5px' }}>
              🏢 {profile.company_name}
            </div>
          )}
          {profile.company_website && (
            <a
              href={profile.company_website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '7px', color: '#4488ff', textDecoration: 'none', wordBreak: 'break-all' }}
            >
              {profile.company_website}
            </a>
          )}
        </div>
      )}

      {/* Links */}
      {hasLinks && (
        <div className="gl card-stagger-4" style={{ padding: '12px 14px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '1px' }}>
            -- LINKS --
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.portfolio_url && (
              <a
                href={profile.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '7px',
                  color: '#00ff88',
                  textDecoration: 'none',
                  padding: '8px 10px',
                  background: 'rgba(0,255,136,0.06)',
                  border: '1px solid rgba(0,255,136,0.2)',
                  borderRadius: '5px',
                  wordBreak: 'break-all',
                }}
              >
                <span>🌐</span>
                <span>{profile.portfolio_url}</span>
              </a>
            )}
            {profile.github_url && (
              <a
                href={profile.github_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '7px',
                  color: '#cc44ff',
                  textDecoration: 'none',
                  padding: '8px 10px',
                  background: 'rgba(204,68,255,0.06)',
                  border: '1px solid rgba(204,68,255,0.2)',
                  borderRadius: '5px',
                  wordBreak: 'break-all',
                }}
              >
                <span>🔗</span>
                <span>{profile.github_url}</span>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="div" />
    </div>
  );
}
