import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { useCountUp } from '../hooks/useCountUp';
import toast from 'react-hot-toast';

// ============================================================
// Screen 08: PROFILE — avatar, stats, wallet, portfolio, edit
// ============================================================

const SKILL_CATEGORIES = ['design', 'dev', 'writing', 'video', 'marketing', 'other'] as const;
type SkillCategory = typeof SKILL_CATEGORIES[number];
type Role = 'client' | 'freelancer' | 'both';
type AccountType = 'individual' | 'company';
type Tab = 'stats' | 'portfolio' | 'reviews' | 'edit';

interface EditForm {
  bio: string;
  country: string;
  role: Role;
  skill_category: SkillCategory;
  experience: 'junior' | 'middle' | 'senior';
  skills: string[];
  skillInput: string;
  account_type: AccountType;
  company_name: string;
  company_website: string;
  portfolio_url: string;
  github_url: string;
}

const defaultEdit: EditForm = {
  bio: '',
  country: '',
  role: 'client',
  skill_category: 'dev',
  experience: 'junior',
  skills: [],
  skillInput: '',
  account_type: 'individual',
  company_name: '',
  company_website: '',
  portfolio_url: '',
  github_url: '',
};

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '1px' }}>
      -- {label} --
    </div>
  );
}

export function Profile() {
  const { user, tg } = useTelegram();
  const [profile,   setProfile]   = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews,   setReviews]   = useState<any[]>([]);
  const [wallet,    setWallet]    = useState('');
  const [tab,       setTab]       = useState<Tab>('stats');
  const [loading,   setLoading]   = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [bannerUploading,  setBannerUploading]  = useState(false);
  const [avatarUploading,  setAvatarUploading]  = useState(false);
  const [slideUploading,   setSlideUploading]   = useState(false);
  const [slideIndex,       setSlideIndex]       = useState(0);

  // Edit form state — isolated from main state
  const [edit, setEdit] = useState<EditForm>(defaultEdit);

  useEffect(() => {
    (async () => {
      try {
        const [p, port, rev] = await Promise.all([
          usersApi.me(),
          user?.id ? usersApi.portfolio(user.id) : Promise.resolve({ data: [] }),
          user?.id ? usersApi.reviews(user.id)   : Promise.resolve({ data: [] }),
        ]);
        setProfile(p.data);
        setPortfolio(port.data);
        setReviews(rev.data);
        setWallet(p.data.ton_wallet_address || '');

        // Pre-fill edit form from loaded profile
        const d = p.data;
        setEdit({
          bio:              d.bio              || '',
          country:          d.country          || '',
          role:             d.role             || 'client',
          skill_category:   d.skill_category   || 'dev',
          experience:       d.experience       || 'junior',
          skills:           Array.isArray(d.skills) ? d.skills : [],
          skillInput:       '',
          account_type:     d.account_type     || 'individual',
          company_name:     d.company_name     || '',
          company_website:  d.company_website  || '',
          portfolio_url:    d.portfolio_url    || '',
          github_url:       d.github_url       || '',
        });
      } catch { /* guest */ }
    })();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const r = await usersApi.uploadAvatar(file);
      setProfile((p: any) => ({ ...p, avatar_url: r.data.avatarUrl }));
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Avatar uploaded!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally { setAvatarUploading(false); e.target.value = ''; }
  };

  const handleAddSlide = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlideUploading(true);
    try {
      const r = await usersApi.addSlide(file);
      setProfile((p: any) => ({ ...p, slide_images: r.data.slides }));
      setSlideIndex((r.data.slides.length || 1) - 1);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Slide added!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally { setSlideUploading(false); e.target.value = ''; }
  };

  const handleDeleteSlide = async (idx: number) => {
    try {
      const r = await usersApi.deleteSlide(idx);
      setProfile((p: any) => ({ ...p, slide_images: r.data.slides }));
      setSlideIndex(i => Math.max(0, i - (idx <= i ? 1 : 0)));
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Slide removed');
    } catch { toast.error('Error'); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const r = await usersApi.uploadBanner(file);
      setProfile((p: any) => ({ ...p, banner_url: r.data.bannerUrl }));
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Banner uploaded!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveWallet = async () => {
    if (!wallet.trim()) return;
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      await usersApi.setWallet(wallet);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Wallet saved!');
    } catch { toast.error('Error'); } finally { setLoading(false); }
  };

  const handleSaveProfile = async () => {
    tg?.HapticFeedback?.impactOccurred('medium');
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        bio:           edit.bio.trim(),
        country:       edit.country.trim(),
        role:          edit.role,
        category:      edit.skill_category,
        experience:    edit.experience,
        skills:        edit.skills,
        account_type:  edit.account_type,
        portfolio_url: edit.portfolio_url.trim(),
        github_url:    edit.github_url.trim(),
      };
      if (edit.account_type === 'company') {
        payload.company_name = edit.company_name.trim();
        payload.company_url  = edit.company_website.trim();
      }
      await usersApi.updateProfile(payload);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Profile saved!');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Error saving profile';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const addSkill = () => {
    const s = edit.skillInput.trim();
    if (!s || edit.skills.length >= 15 || edit.skills.includes(s)) return;
    setEdit(e => ({ ...e, skills: [...e.skills, s], skillInput: '' }));
  };

  const removeSkill = (skill: string) => {
    setEdit(e => ({ ...e, skills: e.skills.filter(s => s !== skill) }));
  };

  const xpMax     = 1000;
  const xp        = profile?.xp ?? 0;
  const xpPct     = Math.min(100, Math.round((xp / xpMax) * 100));

  const countDeals  = useCountUp(profile?.deals_completed ?? 0);
  const countCoins  = useCountUp(profile?.safe_coins ?? 0, 1500);
  const countStreak = useCountUp(profile?.streak_days ?? 0, 800);

  const switchTab = (t: Tab) => {
    tg?.HapticFeedback?.selectionChanged();
    setTab(t);
  };

  const setE = <K extends keyof EditForm>(key: K, val: EditForm[K]) =>
    setEdit(e => ({ ...e, [key]: val }));

  const toggleBtn = (
    label: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        padding: '9px 4px',
        borderRadius: '4px',
        cursor: 'pointer',
        border: active ? '1px solid rgba(0,255,136,0.7)' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00ff88' : 'rgba(255,255,255,0.3)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="page fade-in">
      <PixelScene scene="profile" width={252} height={56} />

      {/* Banner */}
      {profile?.banner_url && (
        <div style={{
          width: '100%', height: '90px', borderRadius: '14px',
          overflow: 'hidden', marginBottom: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <img src={profile.banner_url} alt="banner"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Profile header */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" style={{
                width: '64px', height: '64px', borderRadius: '50%',
                objectFit: 'cover', border: '2px solid rgba(0,255,136,0.4)',
                display: 'inline-block',
              }} />
            ) : (
              <div style={{ fontSize: '32px' }}>🛡</div>
            )}
          </div>
          <div className="logo" style={{ fontSize: '13px' }}>
            {user?.first_name?.toUpperCase() || 'GUEST'}
          </div>
          {user?.username && (
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
              @{user.username}
            </div>
          )}
          {profile && (
            <div className="gl-pill lvl" style={{ padding: '5px 12px', margin: '10px auto 0', display: 'inline-block' }}>
              ⚔ LVL {profile.level}
            </div>
          )}
        </div>
      </div>

      {/* XP Bar */}
      <div className="gl xp-w card-stagger-2">
        <div className="pxgrid" />
        <div className="xp-top">
          <span className="xp-lbl" style={{ color: '#ffaa00' }}>XP</span>
          <span className="xp-lbl">{xp}/{xpMax}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{
            background: 'linear-gradient(90deg,#ffaa00,#ff6600)',
            width: `${xpPct}%`,
            transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
          }} />
          <div className="xp-shine" />
        </div>
      </div>

      {/* Slides slider */}
      {profile?.slide_images?.length > 0 && (
        <div style={{ marginBottom: '8px', position: 'relative' }}>
          <div style={{
            width: '100%', height: '160px', borderRadius: '14px',
            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <img
              src={profile.slide_images[slideIndex]}
              alt={`slide ${slideIndex + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          {profile.slide_images.length > 1 && (
            <>
              <button onClick={() => setSlideIndex(i => (i - 1 + profile.slide_images.length) % profile.slide_images.length)}
                style={{
                  position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
                  borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '12px',
                }}>‹</button>
              <button onClick={() => setSlideIndex(i => (i + 1) % profile.slide_images.length)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
                  borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '12px',
                }}>›</button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '6px' }}>
                {profile.slide_images.map((_: string, i: number) => (
                  <div key={i} onClick={() => setSlideIndex(i)} style={{
                    width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer',
                    background: i === slideIndex ? '#00ff88' : 'rgba(255,255,255,0.2)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mini stats */}
      <div className="stats card-stagger-3">
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#00ff88' }}>{countDeals}</span>
          <span className="stat-l">DONE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ffaa00', fontSize: '11px' }}>{countCoins.toLocaleString()}</span>
          <span className="stat-l">COINS</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(170,0,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#cc44ff' }}>
            {profile?.rating > 0 ? `⭐${profile.rating}` : '—'}
          </span>
          <span className="stat-l">RANK</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,136,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ff8800', fontSize: '11px' }}>🔥{countStreak}</span>
          <span className="stat-l">STREAK</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-row card-stagger-4" style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['stats', 'portfolio', 'reviews', 'edit'] as Tab[]).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`fb ${tab === t ? 'fb-on' : 'fb-off'}`}>
            {t === 'stats'     ? '📊 STATS'
            : t === 'portfolio' ? '📁 PORT'
            : t === 'reviews'   ? '⭐ REV'
            :                    '✏️ EDIT'}
          </button>
        ))}
      </div>

      {/* ---- STATS TAB ---- */}
      {tab === 'stats' && profile && (
        <>
          <div className="gl card-stagger-4">
            <div className="pxgrid" /><div className="sh" />
            <DataRow label="Deals completed"    value={String(profile.deals_completed)} color="#00ff88" />
            <DataRow label="Rating"             value={profile.rating > 0 ? `⭐ ${profile.rating}` : 'None'} color="#ffaa00" />
            <DataRow label="🔥 Streak"          value={`${profile.streak_days} days`} />
            <DataRow label="🪙 SafeCoins"        value={String(profile.safe_coins)} color="#cc44ff" />
            <DataRow label="Total XP"           value={String(profile.xp)} color="#0088ff" />
          </div>

          {/* TON Wallet */}
          <div className="gl card-stagger-5">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
              💎 TON WALLET
            </div>
            <input className="input" value={wallet} onChange={e => setWallet(e.target.value)}
              placeholder="UQ..." style={{ marginBottom: '8px' }} />
            <button className="btn btn-b btn-full" onClick={handleSaveWallet} disabled={loading}>
              {loading ? '[ ⏳ ]' : '[ 💾 SAVE ]'}
            </button>
          </div>
        </>
      )}

      {/* ---- PORTFOLIO TAB ---- */}
      {tab === 'portfolio' && (
        portfolio.length === 0 ? (
          <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>📁</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
              PORTFOLIO EMPTY<br/>COMPLETE DEALS!
            </div>
          </div>
        ) : (
          portfolio.map((p, i) => (
            <div key={p.id} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '9px', color: '#fff', marginBottom: '4px' }}>{p.title?.toUpperCase()}</div>
              <div style={{ fontSize: '9px', color: '#ffaa00' }}>
                ${p.amount_usd} {p.currency}
              </div>
              {p.tags?.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {p.tags.map((tag: string) => (
                    <span key={tag} className="gl-pill"
                      style={{ fontSize: '6px', padding: '2px 7px',
                        color: '#cc44ff', border: '1px solid rgba(204,68,255,0.4)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )
      )}

      {/* ---- REVIEWS TAB ---- */}
      {tab === 'reviews' && (
        reviews.length === 0 ? (
          <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>⭐</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>
              NO REVIEWS YET
            </div>
          </div>
        ) : (
          reviews.map((r, i) => (
            <div key={i} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>
                  @{r.reviewer_username}
                </span>
                <span style={{ color: '#ffaa00', fontSize: '9px' }}>{'⭐'.repeat(r.rating)}</span>
              </div>
              {r.comment && (
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.8' }}>
                  {r.comment}
                </div>
              )}
            </div>
          ))
        )
      )}

      {/* ---- EDIT TAB ---- */}
      {tab === 'edit' && (
        <div className="gl card-stagger-4" style={{ padding: '14px 12px' }}>
          <div className="pxgrid" /><div className="sh" />

          {/* AVATAR */}
          <SectionLabel label="AVATAR" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" style={{
                width: '56px', height: '56px', borderRadius: '50%',
                objectFit: 'cover', border: '2px solid rgba(0,255,136,0.4)', flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>🛡</div>
            )}
            <label style={{
              flex: 1, textAlign: 'center', padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: '1px dashed rgba(0,255,136,0.4)', background: 'rgba(0,255,136,0.06)',
              color: avatarUploading ? 'rgba(255,255,255,0.3)' : '#00ff88',
              fontSize: '7px', fontFamily: '"Press Start 2P", monospace',
            }}>
              {avatarUploading ? '⏳ UPLOADING...' : profile?.avatar_url ? '🔄 CHANGE' : '📷 UPLOAD AVATAR'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                disabled={avatarUploading} onChange={handleAvatarUpload} />
            </label>
          </div>

          {/* SLIDES */}
          <SectionLabel label={`PORTFOLIO SLIDES (${(profile?.slide_images || []).length}/5)`} />
          <div style={{ marginBottom: '18px' }}>
            {(profile?.slide_images || []).length > 0 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
                {(profile.slide_images as string[]).map((url, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={url} alt={`slide ${i + 1}`} style={{
                      width: '80px', height: '50px', objectFit: 'cover',
                      borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                    }} />
                    <button onClick={() => handleDeleteSlide(i)} style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: '#ff4466', border: 'none', color: '#fff',
                      fontSize: '8px', cursor: 'pointer', lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {(profile?.slide_images || []).length < 5 && (
              <label style={{
                display: 'block', textAlign: 'center', padding: '10px', borderRadius: '6px', cursor: 'pointer',
                border: '1px dashed rgba(204,68,255,0.4)', background: 'rgba(204,68,255,0.06)',
                color: slideUploading ? 'rgba(255,255,255,0.3)' : '#cc44ff',
                fontSize: '7px', fontFamily: '"Press Start 2P", monospace',
              }}>
                {slideUploading ? '⏳ UPLOADING...' : '+ ADD SLIDE'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  disabled={slideUploading} onChange={handleAddSlide} />
              </label>
            )}
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.2)', marginTop: '5px', textAlign: 'center' }}>
              900×500px · max 5 MB each
            </div>
          </div>

          {/* BANNER */}
          <SectionLabel label="BANNER" />
          <div style={{ marginBottom: '14px' }}>
            {profile?.banner_url && (
              <div style={{
                width: '100%', height: '72px', borderRadius: '8px',
                overflow: 'hidden', marginBottom: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <img src={profile.banner_url} alt="banner"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <label style={{
              display: 'block', textAlign: 'center',
              padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: '1px dashed rgba(0,136,255,0.4)',
              background: 'rgba(0,136,255,0.06)',
              color: bannerUploading ? 'rgba(255,255,255,0.3)' : '#0088ff',
              fontSize: '7px', fontFamily: '"Press Start 2P", monospace',
            }}>
              {bannerUploading ? '⏳ UPLOADING...' : profile?.banner_url ? '🔄 CHANGE BANNER' : '📷 UPLOAD BANNER'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                disabled={bannerUploading} onChange={handleBannerUpload} />
            </label>
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.2)', marginTop: '5px', textAlign: 'center' }}>
              900×300px · JPG/PNG · max 5 MB
            </div>
          </div>

          {/* ABOUT */}
          <SectionLabel label="ABOUT" />

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>BIO</div>
            <textarea
              className="input"
              value={edit.bio}
              maxLength={300}
              rows={4}
              onChange={e => setE('bio', e.target.value)}
              placeholder="Tell about yourself..."
              style={{
                resize: 'none',
                width: '100%',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '7px',
                lineHeight: '1.8',
              }}
            />
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: '3px' }}>
              {edit.bio.length}/300
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>COUNTRY</div>
            <input
              className="input"
              value={edit.country}
              onChange={e => setE('country', e.target.value)}
              placeholder="e.g. Ukraine"
              style={{ width: '100%' }}
            />
          </div>

          {/* ROLE */}
          <SectionLabel label="ROLE" />
          <div style={{ display: 'flex', gap: '5px', marginBottom: '14px' }}>
            {toggleBtn('💼 CLIENT',         edit.role === 'client',     () => setE('role', 'client'))}
            {toggleBtn('🛠 FREELANCER',     edit.role === 'freelancer', () => setE('role', 'freelancer'))}
            {toggleBtn('🔄 BOTH',           edit.role === 'both',       () => setE('role', 'both'))}
          </div>

          {/* SKILLS — shown only if role !== 'client' */}
          {edit.role !== 'client' && (
            <>
              <SectionLabel label="SKILLS" />

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>CATEGORY</div>
                <select
                  className="input"
                  value={edit.skill_category}
                  onChange={e => setE('skill_category', e.target.value as SkillCategory)}
                  style={{
                    width: '100%',
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '7px',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.13)',
                    borderRadius: '5px',
                    padding: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {SKILL_CATEGORIES.map(c => (
                    <option key={c} value={c} style={{ background: '#111' }}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>EXPERIENCE</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {(['junior', 'middle', 'senior'] as const).map(lvl => (
                    toggleBtn(lvl.toUpperCase(), edit.experience === lvl, () => setE('experience', lvl))
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>
                  SKILLS ({edit.skills.length}/15)
                </div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '7px' }}>
                  <input
                    className="input"
                    value={edit.skillInput}
                    onChange={e => setE('skillInput', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                    placeholder="e.g. React"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={addSkill}
                    disabled={edit.skills.length >= 15}
                    style={{
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: '7px',
                      padding: '8px 10px',
                      borderRadius: '5px',
                      border: '1px solid rgba(0,255,136,0.4)',
                      background: 'rgba(0,255,136,0.08)',
                      color: '#00ff88',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ADD
                  </button>
                </div>
                {edit.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {edit.skills.map(skill => (
                      <span
                        key={skill}
                        className="gl-pill"
                        style={{
                          fontSize: '6px',
                          padding: '4px 8px',
                          color: '#cc44ff',
                          border: '1px solid rgba(204,68,255,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        {skill}
                        <span
                          onClick={() => removeSkill(skill)}
                          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '8px' }}
                        >
                          ×
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* COMPANY */}
          <SectionLabel label="COMPANY" />
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            {toggleBtn('👤 INDIVIDUAL', edit.account_type === 'individual', () => setE('account_type', 'individual'))}
            {toggleBtn('🏢 COMPANY',    edit.account_type === 'company',    () => setE('account_type', 'company'))}
          </div>

          {edit.account_type === 'company' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>COMPANY NAME</div>
                <input
                  className="input"
                  value={edit.company_name}
                  onChange={e => setE('company_name', e.target.value)}
                  placeholder="Acme Corp"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>COMPANY WEBSITE</div>
                <input
                  className="input"
                  value={edit.company_website}
                  onChange={e => setE('company_website', e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          {/* LINKS */}
          <SectionLabel label="LINKS" />

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>PORTFOLIO URL</div>
            <input
              className="input"
              value={edit.portfolio_url}
              onChange={e => setE('portfolio_url', e.target.value)}
              placeholder="https://myportfolio.com"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>GITHUB / BEHANCE</div>
            <input
              className="input"
              value={edit.github_url}
              onChange={e => setE('github_url', e.target.value)}
              placeholder="https://github.com/..."
              style={{ width: '100%' }}
            />
          </div>

          <button
            className="btn btn-g btn-full"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? '[ ⏳ SAVING... ]' : '[ 💾 SAVE PROFILE ]'}
          </button>
        </div>
      )}

      <div className="div" />
    </div>
  );
}
