import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { useCountUp } from '../hooks/useCountUp';
import { useTonWalletConnect } from '../hooks/useTonWallet';
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
  const { address: tonAddress, isConnected: walletConnected, connect: connectWallet, disconnect: disconnectWallet } = useTonWalletConnect();
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

  const [referralStats, setReferralStats] = useState<any>(null);

  useEffect(() => {
    const initData = (window as any).Telegram?.WebApp?.initData || '';
    fetch('/api/referrals/me', { headers: { 'X-Telegram-Init-Data': initData } })
      .then(r => r.json())
      .then(data => { if (data.referral_link) setReferralStats(data); })
      .catch(() => {});
  }, []);

  const handleClaimReferral = async (tierKey: string) => {
    const initData = (window as any).Telegram?.WebApp?.initData || '';
    try {
      const res = await fetch(`/api/referrals/claim/${tierKey}`, {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': initData },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`+${data.crystals_awarded} Safe Crystals!`);
      setReferralStats((s: any) => ({
        ...s,
        tiers: s.tiers.map((t: any) => t.key === tierKey ? { ...t, claimed: true } : t),
      }));
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const xpMax     = 1000;
  const xp        = profile?.xp ?? 0;
  const xpPct     = Math.min(100, Math.round((xp / xpMax) * 100));

  const countDeals  = useCountUp(profile?.deals_completed ?? 0);
  const countCoins  = useCountUp(profile?.safe_crystals ?? 0, 1500);
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

  // Reusable upload label component
  const UploadLabel = ({ text, color, borderColor, bg }: { text: string; color: string; borderColor: string; bg: string }) => (
    <span style={{
      display: 'block', textAlign: 'center', padding: '9px', borderRadius: '6px', cursor: 'pointer',
      border: `1px dashed ${borderColor}`, background: bg, color, fontSize: '6px',
      fontFamily: '"Press Start 2P", monospace',
    }}>{text}</span>
  );

  const SlideCarousel = () => profile?.slide_images?.length > 0 ? (
    <div style={{ marginBottom: '8px', position: 'relative' }}>
      <div style={{ width: '100%', height: '130px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <img src={profile.slide_images[slideIndex]} alt={`slide ${slideIndex + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {profile.slide_images.length > 1 && (
        <>
          <button onClick={() => setSlideIndex((i: number) => (i - 1 + profile.slide_images.length) % profile.slide_images.length)}
            style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontSize: '12px' }}>‹</button>
          <button onClick={() => setSlideIndex((i: number) => (i + 1) % profile.slide_images.length)}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontSize: '12px' }}>›</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '5px' }}>
            {profile.slide_images.map((_: string, i: number) => (
              <div key={i} onClick={() => setSlideIndex(i)} style={{ width: '5px', height: '5px', borderRadius: '50%', cursor: 'pointer', background: i === slideIndex ? '#00ff88' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  ) : null;

  const WalletPanel = ({ compact }: { compact?: boolean }) => (
    <div className="gl" style={{ padding: compact ? '12px 14px' : undefined }}>
      <div className="pxgrid" />{!compact && <div className="sh" />}
      <div style={{ fontSize: compact ? '7px' : '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>💎 TON WALLET</div>
      {walletConnected && tonAddress ? (
        <>
          <div style={{ fontSize: '7px', color: '#00FF88', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', wordBreak: 'break-all', lineHeight: '1.8' }}>
            ✅ {tonAddress.slice(0, 8)}...{tonAddress.slice(-6)}
          </div>
          <button className="btn btn-full" onClick={disconnectWallet}
            style={{ fontSize: '6px', background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.3)', color: '#FF4466' }}>
            [ 🔌 DISCONNECT ]
          </button>
        </>
      ) : (
        <>
          {profile?.ton_wallet_address && (
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', wordBreak: 'break-all' }}>
              Saved: {profile.ton_wallet_address.slice(0, 8)}...{profile.ton_wallet_address.slice(-6)}
            </div>
          )}
          <button className="btn btn-b btn-full" onClick={connectWallet} style={{ marginBottom: compact ? 0 : '10px' }}>
            [ 💎 CONNECT TONKEEPER ]
          </button>
          {!compact && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' }}>OR PASTE MANUALLY</div>
              <input type="text" placeholder="UQ..." value={wallet} onChange={e => setWallet(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '9px 12px', color: '#fff', fontSize: '7px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '7px' }} />
              <button className="btn btn-full" onClick={handleSaveWallet} disabled={!wallet.trim() || loading}
                style={{ fontSize: '7px', opacity: wallet.trim() ? 1 : 0.4 }}>
                [ 💾 SAVE WALLET ]
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="page fade-in">

      {/* ── Desktop topbar ── */}
      <div className="desktop-topbar desktop-only">
        <div className="desktop-topbar-title">DASHBOARD / <span>PROFILE</span></div>
        {user?.username && <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontFamily: '"Press Start 2P", monospace' }}>@{user.username}</span>}
        {profile && <span style={{ fontSize: '7px', color: '#ffaa00', fontFamily: '"Press Start 2P", monospace' }}>LVL {profile.level} · {profile.deals_completed} DEALS</span>}
      </div>

      <div className="page-inner">
        {/* Mobile-only pixel scene */}
        <div className="mobile-only"><PixelScene scene="profile" width={252} height={56} /></div>

        <div className="profile-layout">

          {/* ══ LEFT PANEL ══ */}
          <div className="profile-left">
            {/* Banner */}
            {profile?.banner_url && (
              <div style={{ width: '100%', height: '70px', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={profile.banner_url} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Profile card */}
            <div className="gl hud card-stagger-1">
              <div className="pxgrid" /><div className="sh" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '8px' }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,255,136,0.4)', display: 'inline-block' }} />
                  ) : (
                    <div style={{ fontSize: '30px' }}>🛡</div>
                  )}
                </div>
                <div className="logo" style={{ fontSize: '12px' }}>{user?.first_name?.toUpperCase() || 'GUEST'}</div>
                {user?.username && <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginTop: '5px' }}>@{user.username}</div>}
                {profile && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div className="gl-pill lvl" style={{ padding: '4px 10px' }}>⚔ LVL {profile.level}</div>
                    {profile.subscription_plan === 'basic' && new Date(profile.subscription_expires) > new Date() && (
                      <div style={{ padding: '4px 10px', borderRadius: '100px', background: 'rgba(0,136,255,0.15)', border: '1px solid rgba(0,136,255,0.4)', fontSize: '7px', color: '#0088ff', fontFamily: '"Press Start 2P", monospace' }}>✦ BASIC</div>
                    )}
                    {profile.subscription_plan === 'pro' && new Date(profile.subscription_expires) > new Date() && (
                      <div style={{ padding: '4px 10px', borderRadius: '100px', background: 'rgba(204,68,255,0.15)', border: '1px solid rgba(204,68,255,0.4)', fontSize: '7px', color: '#cc44ff', fontFamily: '"Press Start 2P", monospace' }}>✦✦ PRO</div>
                    )}
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
                <div className="xp-fill" style={{ background: 'linear-gradient(90deg,#ffaa00,#ff6600)', width: `${xpPct}%`, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
                <div className="xp-shine" />
              </div>
            </div>

            {/* Stats */}
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
                <span className="stat-n" style={{ color: '#cc44ff' }}>{profile?.rating > 0 ? `⭐${profile.rating}` : '—'}</span>
                <span className="stat-l">RANK</span>
              </div>
              <div className="stat gl-sm" style={{ borderColor: 'rgba(255,136,0,0.3)' }}>
                <div className="pxgrid" />
                <span className="stat-n" style={{ color: '#ff8800', fontSize: '11px' }}>🔥{countStreak}</span>
                <span className="stat-l">STREAK</span>
              </div>
            </div>

            {/* Desktop: compact wallet */}
            <div className="desktop-only"><WalletPanel compact /></div>

            {/* Desktop: slide carousel */}
            <div className="desktop-only"><SlideCarousel /></div>
          </div>

          {/* ══ RIGHT PANEL (tabs + content) ══ */}
          <div className="profile-right">
            {/* Mobile-only: banner + slides above tabs */}
            <div className="mobile-only">
              {profile?.banner_url && (
                <div style={{ width: '100%', height: '90px', borderRadius: '14px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={profile.banner_url} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <SlideCarousel />
            </div>

            {/* Tabs */}
            <div className="filter-row card-stagger-4" style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
              {(['stats', 'portfolio', 'reviews', 'edit'] as Tab[]).map(t => (
                <button key={t} onClick={() => switchTab(t)} className={`fb ${tab === t ? 'fb-on' : 'fb-off'}`}>
                  {t === 'stats' ? '📊 STATS' : t === 'portfolio' ? '📁 PORT' : t === 'reviews' ? '⭐ REV' : '✏️ EDIT'}
                </button>
              ))}
            </div>

            {/* ── STATS TAB ── */}
            {tab === 'stats' && profile && (
              <>
                <div className="gl card-stagger-4">
                  <div className="pxgrid" /><div className="sh" />
                  <DataRow label="Deals completed" value={String(profile.deals_completed)} color="#00ff88" />
                  <DataRow label="Rating"          value={profile.rating > 0 ? `⭐ ${profile.rating}` : 'None'} color="#ffaa00" />
                  <DataRow label="🔥 Streak"       value={`${profile.streak_days} days`} />
                  <DataRow label="🪙 Safe Crystals"     value={String(profile.safe_crystals)} color="#cc44ff" />
                  <DataRow label="Total XP"        value={String(profile.xp)} color="#0088ff" />
                  {profile.role    && <DataRow label="Role"     value={profile.role.toUpperCase()} />}
                  {profile.country && <DataRow label="Country"  value={profile.country} />}
                </div>
                {/* Referral block */}
                {referralStats && (() => {
                  const tier1 = referralStats.tiers?.[0]; // 3 users
                  const tier2 = referralStats.tiers?.[1]; // 20 active users
                  const TIER_COLORS = ['#ffaa00', '#cc44ff'];
                  return (
                    <div className="gl card-stagger-5" style={{ marginTop: '10px' }}>
                      <div className="pxgrid" /><div className="sh" />
                      <div style={{ fontSize: '9px', color: '#ffaa00', marginBottom: '12px', letterSpacing: '1px' }}>👥 REFERRAL PROGRAM</div>

                      {/* Referral link */}
                      <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>YOUR INVITE LINK</div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                        <div style={{
                          flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', padding: '8px 10px', fontSize: '7px', color: 'rgba(255,255,255,0.5)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {referralStats.referral_link}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(referralStats.referral_link);
                            toast.success('Link copied!');
                            tg?.HapticFeedback?.impactOccurred('light');
                          }}
                          style={{
                            fontFamily: '"Press Start 2P", monospace', fontSize: '6px', padding: '8px 10px',
                            borderRadius: '8px', border: '1px solid rgba(0,255,136,0.4)',
                            background: 'rgba(0,255,136,0.08)', color: '#00ff88', cursor: 'pointer', flexShrink: 0,
                          }}
                        >COPY</button>
                      </div>

                      {/* Tier 1 */}
                      {tier1 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div>
                              <div style={{ fontSize: '7px', color: '#fff' }}>Invite {tier1.required} users</div>
                              <div style={{ fontSize: '6px', color: TIER_COLORS[0], marginTop: '2px' }}>+{tier1.crystals.toLocaleString()} Safe Crystals</div>
                            </div>
                            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>
                              {Math.min(tier1.progress, tier1.required)}/{tier1.required}
                            </div>
                          </div>
                          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '6px' }}>
                            <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg,#ffaa00,#ff6600)', width: `${Math.min(100, (tier1.progress / tier1.required) * 100)}%`, transition: 'width 0.6s ease' }} />
                          </div>
                          {tier1.progress >= tier1.required && (
                            <button onClick={() => handleClaimReferral(tier1.key)} disabled={tier1.claimed}
                              style={{
                                width: '100%', fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
                                padding: '7px', borderRadius: '6px', cursor: tier1.claimed ? 'not-allowed' : 'pointer',
                                border: tier1.claimed ? '1px solid rgba(255,255,255,0.1)' : `1px solid rgba(255,170,0,0.5)`,
                                background: tier1.claimed ? 'rgba(255,255,255,0.04)' : 'rgba(255,170,0,0.1)',
                                color: tier1.claimed ? 'rgba(255,255,255,0.3)' : TIER_COLORS[0],
                              }}
                            >{tier1.claimed ? '✓ CLAIMED' : '[ CLAIM REWARD ]'}</button>
                          )}
                        </div>
                      )}

                      {/* Tier 2 */}
                      {tier2 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div>
                              <div style={{ fontSize: '7px', color: '#fff' }}>{tier2.required} active users</div>
                              <div style={{ fontSize: '6px', color: TIER_COLORS[1], marginTop: '2px' }}>+{tier2.crystals.toLocaleString()} Safe Crystals</div>
                            </div>
                            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>
                              {Math.min(tier2.progress, tier2.required)}/{tier2.required}
                            </div>
                          </div>
                          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '6px' }}>
                            <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg,#cc44ff,#8822cc)', width: `${Math.min(100, (tier2.progress / tier2.required) * 100)}%`, transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: '4px' }}>
                            Active = 5+ visits in last 30 days
                          </div>
                          {tier2.progress >= tier2.required && (
                            <button onClick={() => handleClaimReferral(tier2.key)} disabled={tier2.claimed}
                              style={{
                                width: '100%', fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
                                padding: '7px', borderRadius: '6px', cursor: tier2.claimed ? 'not-allowed' : 'pointer',
                                border: tier2.claimed ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(204,68,255,0.5)',
                                background: tier2.claimed ? 'rgba(255,255,255,0.04)' : 'rgba(204,68,255,0.1)',
                                color: tier2.claimed ? 'rgba(255,255,255,0.3)' : TIER_COLORS[1],
                              }}
                            >{tier2.claimed ? '✓ CLAIMED' : '[ CLAIM REWARD ]'}</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Mobile: full wallet UI */}
                <div className="mobile-only"><WalletPanel /></div>
              </>
            )}

            {/* ── PORTFOLIO TAB ── */}
            {tab === 'portfolio' && (
              portfolio.length === 0 ? (
                <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
                  <div className="pxgrid" /><div className="sh" />
                  <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>📁</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>PORTFOLIO EMPTY<br/>COMPLETE DEALS!</div>
                </div>
              ) : (
                <div className="profile-portfolio-grid">
                  {portfolio.map((p, i) => (
                    <div key={p.id} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
                      <div className="pxgrid" /><div className="sh" />
                      <div style={{ fontSize: '8px', color: '#fff', marginBottom: '4px' }}>{p.title?.toUpperCase()}</div>
                      <div style={{ fontSize: '9px', color: '#ffaa00' }}>${p.amount_usd} {p.currency}</div>
                      {p.tags?.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {p.tags.map((tag: string) => (
                            <span key={tag} className="gl-pill" style={{ fontSize: '6px', padding: '2px 7px', color: '#cc44ff', border: '1px solid rgba(204,68,255,0.4)' }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── REVIEWS TAB ── */}
            {tab === 'reviews' && (
              reviews.length === 0 ? (
                <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
                  <div className="pxgrid" /><div className="sh" />
                  <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>⭐</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>NO REVIEWS YET</div>
                </div>
              ) : reviews.map((r, i) => (
                <div key={i} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
                  <div className="pxgrid" /><div className="sh" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>@{r.reviewer_username}</span>
                    <span style={{ color: '#ffaa00', fontSize: '9px' }}>{'⭐'.repeat(r.rating)}</span>
                  </div>
                  {r.comment && <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.8' }}>{r.comment}</div>}
                </div>
              ))
            )}

            {/* ── EDIT TAB ── */}
            {tab === 'edit' && (
              <div className="profile-edit-grid">
                {/* Left col: uploads */}
                <div className="gl card-stagger-4" style={{ padding: '14px 12px' }}>
                  <div className="pxgrid" /><div className="sh" />

                  <SectionLabel label="AVATAR" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,255,136,0.4)', flexShrink: 0 }} />
                      : <div style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🛡</div>
                    }
                    <label style={{ flex: 1, cursor: 'pointer' }}>
                      <UploadLabel text={avatarUploading ? '⏳...' : '📷 AVATAR'} color={avatarUploading ? 'rgba(255,255,255,0.3)' : '#00ff88'} borderColor="rgba(0,255,136,0.4)" bg="rgba(0,255,136,0.06)" />
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={avatarUploading} onChange={handleAvatarUpload} />
                    </label>
                  </div>

                  <SectionLabel label="BANNER" />
                  <div style={{ marginBottom: '14px' }}>
                    {profile?.banner_url && <div style={{ width: '100%', height: '55px', borderRadius: '7px', overflow: 'hidden', marginBottom: '6px', border: '1px solid rgba(255,255,255,0.1)' }}><img src={profile.banner_url} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                    <label style={{ cursor: 'pointer' }}>
                      <UploadLabel text={bannerUploading ? '⏳...' : '📷 BANNER'} color={bannerUploading ? 'rgba(255,255,255,0.3)' : '#0088ff'} borderColor="rgba(0,136,255,0.4)" bg="rgba(0,136,255,0.06)" />
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={bannerUploading} onChange={handleBannerUpload} />
                    </label>
                  </div>

                  <SectionLabel label={`SLIDES (${(profile?.slide_images || []).length}/5)`} />
                  <div style={{ marginBottom: '8px' }}>
                    {(profile?.slide_images || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px', marginBottom: '6px' }}>
                        {(profile.slide_images as string[]).map((url: string, i: number) => (
                          <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                            <img src={url} alt={`slide ${i+1}`} style={{ width: '70px', height: '44px', objectFit: 'cover', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <button onClick={() => handleDeleteSlide(i)} style={{ position: 'absolute', top: '-4px', right: '-4px', width: '15px', height: '15px', borderRadius: '50%', background: '#ff4466', border: 'none', color: '#fff', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {(profile?.slide_images || []).length < 5 && (
                      <label style={{ cursor: 'pointer' }}>
                        <UploadLabel text={slideUploading ? '⏳...' : '+ ADD SLIDE'} color={slideUploading ? 'rgba(255,255,255,0.3)' : '#cc44ff'} borderColor="rgba(204,68,255,0.4)" bg="rgba(204,68,255,0.06)" />
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={slideUploading} onChange={handleAddSlide} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Right col: form fields */}
                <div className="gl card-stagger-4" style={{ padding: '14px 12px' }}>
                  <div className="pxgrid" /><div className="sh" />

                  <SectionLabel label="ABOUT" />
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>BIO</div>
                    <textarea className="input" value={edit.bio} maxLength={300} rows={3} onChange={e => setE('bio', e.target.value)} placeholder="Tell about yourself..."
                      style={{ resize: 'none', width: '100%', fontFamily: '"Press Start 2P", monospace', fontSize: '7px', lineHeight: '1.8' }} />
                    <div style={{ fontSize: '5px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>{edit.bio.length}/300</div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>COUNTRY</div>
                    <input className="input" value={edit.country} onChange={e => setE('country', e.target.value)} placeholder="e.g. Ukraine" style={{ width: '100%' }} />
                  </div>

                  <SectionLabel label="ROLE" />
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                    {toggleBtn('CLIENT',     edit.role === 'client',     () => setE('role', 'client'))}
                    {toggleBtn('FREELANCE',  edit.role === 'freelancer', () => setE('role', 'freelancer'))}
                    {toggleBtn('BOTH',       edit.role === 'both',       () => setE('role', 'both'))}
                  </div>

                  {edit.role !== 'client' && (
                    <>
                      <SectionLabel label="SKILLS" />
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
                        <select className="input" value={edit.skill_category} onChange={e => setE('skill_category', e.target.value as SkillCategory)}
                          style={{ flex: 1, fontFamily: '"Press Start 2P", monospace', fontSize: '6px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '5px', padding: '8px', cursor: 'pointer' }}>
                          {SKILL_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        {(['junior', 'middle', 'senior'] as const).map(lvl => toggleBtn(lvl.toUpperCase(), edit.experience === lvl, () => setE('experience', lvl)))}
                      </div>
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                        <input className="input" value={edit.skillInput} onChange={e => setE('skillInput', e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Add skill" style={{ flex: 1 }} />
                        <button onClick={addSkill} disabled={edit.skills.length >= 15} style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', padding: '8px', borderRadius: '5px', border: '1px solid rgba(0,255,136,0.4)', background: 'rgba(0,255,136,0.08)', color: '#00ff88', cursor: 'pointer', flexShrink: 0 }}>ADD</button>
                      </div>
                      {edit.skills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {edit.skills.map(skill => (
                            <span key={skill} className="gl-pill" style={{ fontSize: '6px', padding: '3px 7px', color: '#cc44ff', border: '1px solid rgba(204,68,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {skill}<span onClick={() => removeSkill(skill)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '8px' }}>×</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <SectionLabel label="LINKS" />
                  <div style={{ marginBottom: '7px' }}>
                    <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>PORTFOLIO URL</div>
                    <input className="input" value={edit.portfolio_url} onChange={e => setE('portfolio_url', e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>GITHUB / BEHANCE</div>
                    <input className="input" value={edit.github_url} onChange={e => setE('github_url', e.target.value)} placeholder="https://github.com/..." style={{ width: '100%' }} />
                  </div>

                  <button className="btn btn-g btn-full" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? '[ ⏳ SAVING... ]' : '[ 💾 SAVE PROFILE ]'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
