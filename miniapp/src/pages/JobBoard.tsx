import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard } from '../components/GlassCard';
import { jobs as jobsApi } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Экран 09: JOB BOARD — биржа заказов, фильтры, публикация
// ============================================================

const CATEGORIES = ['Все', 'design', 'dev', 'writing', 'video', 'marketing', 'other'];

export function JobBoard() {
  const navigate   = useNavigate();
  const [jobs,     setJobs]     = useState<any[]>([]);
  const [category, setCategory] = useState('Все');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState<'list'|'create'>('list');
  const [form, setForm] = useState({
    title: '', description: '', budget_min: '', budget_max: '',
    currency: 'USDT', deadline: '', category: 'dev', skills_required: '',
  });

  useEffect(() => {
    loadJobs();
  }, [category]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category !== 'Все') params.category = category;
      if (search) params.search = search;
      const res = await jobsApi.list(params);
      setJobs(res.data);
    } catch { setJobs([]); } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.title || !form.description) return toast.error('Заполни обязательные поля');
    try {
      await jobsApi.create({
        ...form,
        budget_min     : form.budget_min ? Number(form.budget_min) : undefined,
        budget_max     : form.budget_max ? Number(form.budget_max) : undefined,
        deadline       : form.deadline ? Number(form.deadline) : undefined,
        skills_required: form.skills_required.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast.success('Заказ опубликован!');
      setMode('list');
      loadJobs();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="job_board" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '11px', color: '#FF8800' }}>📌 БИРЖА ЗАКАЗОВ</h1>
      </div>

      {/* Переключатель список / создать */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button className={`btn btn-full ${mode === 'list' ? 'btn-orange' : 'btn-ghost'}`}
          style={{ background: mode === 'list' ? '#FF8800' : undefined, color: mode === 'list' ? '#000' : undefined }}
          onClick={() => setMode('list')}>
          🔍 ЗАКАЗЫ
        </button>
        <button className={`btn btn-full ${mode === 'create' ? 'btn-orange' : 'btn-ghost'}`}
          style={{ background: mode === 'create' ? '#FF8800' : undefined, color: mode === 'create' ? '#000' : undefined }}
          onClick={() => setMode('create')}>
          + РАЗМЕСТИТЬ
        </button>
      </div>

      {mode === 'list' ? (
        <>
          {/* Поиск */}
          <input className="input" placeholder="🔍 Поиск заказов..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadJobs()}
            style={{ marginBottom: '10px' }} />

          {/* Фильтры по категориям */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`btn ${category === c ? 'btn-gold' : 'btn-ghost'}`}
                style={{ fontSize: '7px', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                {c}
              </button>
            ))}
          </div>

          {/* Список заказов */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', fontSize: '24px', animation: 'pulse 1s infinite' }}>⏳</div>
          ) : jobs.length === 0 ? (
            <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '24px' }}>📭</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Заказов не найдено</div>
            </GlassCard>
          ) : (
            jobs.map(j => (
              <GlassCard key={j.id} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#fff' }}>{j.title}</span>
                  <span style={{ fontSize: '9px', color: '#FFAA00' }}>
                    {j.budget_min ? `$${j.budget_min}` : ''}{j.budget_max ? `—$${j.budget_max}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  {j.description.slice(0, 80)}...
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill pill-orange">{j.category || 'general'}</span>
                  <button className="btn btn-gold" style={{ fontSize: '7px', padding: '6px 12px' }}
                    onClick={() => jobsApi.apply(j.id, {}).then(() => toast.success('Отклик отправлен!')).catch(() => toast.error('Ошибка'))}>
                    📨 ОТКЛИКНУТЬСЯ
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </>
      ) : (
        /* Форма создания заказа */
        <>
          <GlassCard>
            {[
              { label: 'Название *', key: 'title',       placeholder: 'Разработка сайта...' },
              { label: 'Описание *', key: 'description', placeholder: 'Подробное описание...', multi: true },
              { label: 'Бюджет от ($)', key: 'budget_min', placeholder: '50', type: 'number' },
              { label: 'Бюджет до ($)', key: 'budget_max', placeholder: '500', type: 'number' },
              { label: 'Срок (дней)', key: 'deadline',   placeholder: '7', type: 'number' },
              { label: 'Навыки (через запятую)', key: 'skills_required', placeholder: 'React, Node.js...' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{field.label}</div>
                {field.multi ? (
                  <textarea className="input" placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    style={{ minHeight: '70px', resize: 'vertical' }} />
                ) : (
                  <input className="input" placeholder={field.placeholder} type={field.type || 'text'}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                )}
              </div>
            ))}
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Категория</div>
            <select className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ marginBottom: '0' }}>
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </GlassCard>

          <button className="btn btn-gold btn-full" onClick={handleCreate}>
            📌 ОПУБЛИКОВАТЬ ЗАКАЗ
          </button>
        </>
      )}
    </div>
  );
}
