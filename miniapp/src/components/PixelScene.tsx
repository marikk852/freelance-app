import { useEffect, useRef } from 'react';

// ============================================================
// PixelScene — Canvas API пиксельные сцены для каждого экрана
// ============================================================

interface PixelSceneProps {
  scene: 'home' | 'new_deal' | 'deal_room' | 'payment' | 'review' | 'dispute' | 'live_deals' | 'profile' | 'job_board';
  width?: number;
  height?: number;
}

export function PixelScene({ scene, width = 320, height = 120 }: PixelSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let tick = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      tick++;

      switch (scene) {
        case 'home':      drawHome(ctx, width, height, tick); break;
        case 'new_deal':  drawNewDeal(ctx, width, height, tick); break;
        case 'deal_room': drawDealRoom(ctx, width, height, tick); break;
        case 'payment':   drawPayment(ctx, width, height, tick); break;
        case 'review':    drawReview(ctx, width, height, tick); break;
        case 'dispute':   drawDispute(ctx, width, height, tick); break;
        case 'live_deals':drawLiveDeals(ctx, width, height, tick); break;
        case 'profile':   drawProfile(ctx, width, height, tick); break;
        case 'job_board': drawJobBoard(ctx, width, height, tick); break;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', margin: '0 auto', imageRendering: 'pixelated' }}
    />
  );
}

// ---- Вспомогательные функции рисования ----

function px(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, size = 8) {
  ctx.fillStyle = color;
  ctx.font      = `${size}px "Press Start 2P", monospace`;
  ctx.fillText(str, x, y);
}

// HOME: дом + свиток квестов
function drawHome(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // Дом (пиксельный)
  const hx = w / 2 - 30;
  ctx.fillStyle = '#00FF88';
  // Крыша
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(hx + 20 - i * 4, 20 + i * 4, (i + 1) * 8, 4);
  }
  // Стены
  ctx.fillStyle = 'rgba(0,255,136,0.3)';
  ctx.fillRect(hx + 8, 40, 44, 32);
  // Дверь
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(hx + 24, 55, 12, 17);
  // Окна
  ctx.fillStyle = '#0088FF';
  ctx.fillRect(hx + 12, 45, 8, 8);
  ctx.fillRect(hx + 40, 45, 8, 8);

  // Свиток квестов (пульсирует)
  const sx = hx + 80;
  const sy = 28 + Math.sin(t * 0.05) * 4;
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(sx, sy, 28, 36);
  ctx.fillStyle = '#000';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx + 4, sy + 8 + i * 6, 20, 2);
  // Звёздочки вокруг
  if (t % 30 < 15) {
    ctx.fillStyle = '#FFAA00';
    [[sx - 8, sy - 4], [sx + 32, sy + 8], [sx + 28, sy + 36]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 4, 4);
    });
  }
}

// NEW DEAL: перо пишет контракт
function drawNewDeal(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  // Лист бумаги
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(cx - 50, 10, 100, 80);
  ctx.strokeStyle = '#FFAA00';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 50, 10, 100, 80);
  // Строчки текста (рисуются постепенно)
  const lines = Math.min(6, Math.floor(t / 10));
  ctx.fillStyle = '#00FF88';
  for (let i = 0; i < lines; i++) ctx.fillRect(cx - 38, 22 + i * 10, 76 - (i === lines - 1 ? 76 - (t % 10) * 8 : 0), 2);
  // Перо (движется)
  const penX = cx - 38 + (t % 10) * 8;
  const penY = 22 + (lines - 1) * 10 - 12;
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(penX, penY, 4, 16);
  ctx.fillRect(penX - 2, penY + 12, 8, 4);
}

// DEAL ROOM: два персонажа + сейф
function drawDealRoom(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const float = Math.sin(t * 0.06) * 3;
  // Клиент (синий)
  drawPixelPerson(ctx, w / 2 - 70, 20 + float, '#0088FF');
  // Фрилансер (зелёный)
  drawPixelPerson(ctx, w / 2 + 30, 20 - float, '#00FF88');
  // Сейф посередине
  const sx = w / 2 - 18;
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(sx, 30, 36, 50);
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + 4, 34, 28, 36);
  // Замок пульсирует
  ctx.fillStyle = t % 40 < 20 ? '#00FF88' : '#FFAA00';
  ctx.beginPath();
  ctx.arc(sx + 18, 56, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + 15, 56, 6, 8);
}

function drawPixelPerson(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 6, y, 12, 12);      // голова
  ctx.fillRect(x + 2, y + 14, 20, 18); // тело
  ctx.fillRect(x - 2, y + 14, 8, 14);  // рука лев
  ctx.fillRect(x + 18, y + 14, 8, 14); // рука прав
  ctx.fillRect(x + 2, y + 34, 8, 12);  // нога лев
  ctx.fillRect(x + 14, y + 34, 8, 12); // нога прав
}

// PAYMENT: монеты летят по дуге в сейф
function drawPayment(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // Сейф справа
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(w - 70, 20, 50, 70);
  ctx.fillStyle = '#000';
  ctx.fillRect(w - 64, 26, 38, 48);
  ctx.fillStyle = '#00FF88';
  ctx.beginPath(); ctx.arc(w - 45, 50, 8, 0, Math.PI * 2); ctx.fill();

  // Летящие монеты
  for (let i = 0; i < 5; i++) {
    const progress = ((t + i * 15) % 80) / 80;
    const cx = 40 + (w - 110) * progress;
    const cy = h / 2 - Math.sin(progress * Math.PI) * 40;
    const scale = 1 - progress * 0.4;
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.arc(cx, cy, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `${Math.floor(7 * scale)}px monospace`;
    ctx.fillText('$', cx - 3 * scale, cy + 3 * scale);
  }

  // Кошелёк слева
  ctx.fillStyle = '#0088FF';
  ctx.fillRect(20, h / 2 - 20, 40, 30);
  ctx.fillStyle = '#fff';
  text(ctx, 'PAY', 24, h / 2 - 2, '#fff', 7);
}

// REVIEW: лупа + чеклист + галочка
function drawReview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  // Чеклист
  for (let i = 0; i < 4; i++) {
    const checked = i < 3;
    ctx.fillStyle = checked ? '#00FF88' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(cx - 50, 20 + i * 18, 12, 12);
    if (checked) {
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - 48, 24 + i * 18, 8, 4);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(cx - 32, 24 + i * 18, 60, 4);
  }
  // Большая галочка (появляется)
  if (t > 40) {
    const alpha = Math.min(1, (t - 40) / 20);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00FF88';
    ctx.fillRect(cx + 30, 30, 8, 40);
    ctx.fillRect(cx + 14, 50, 16, 8);
    ctx.globalAlpha = 1;
  }
  // Лупа
  const lx = cx - 60, ly = 10 + Math.sin(t * 0.04) * 5;
  ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(lx + 14, ly + 14, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(lx + 22, ly + 22); ctx.lineTo(lx + 32, ly + 32); ctx.stroke();
}

// DISPUTE: весы + молоток
function drawDispute(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  const lean = Math.sin(t * 0.03) * 8;
  // Стойка весов
  ctx.fillStyle = '#CC44FF';
  ctx.fillRect(cx - 2, 20, 4, 60);
  ctx.fillRect(cx - 30, 20, 60, 4);
  // Чаши
  ctx.fillStyle = 'rgba(204,68,255,0.4)';
  ctx.fillRect(cx - 38, 28 + lean, 24, 12);
  ctx.fillRect(cx + 14, 28 - lean, 24, 12);
  // Нити
  ctx.strokeStyle = '#CC44FF'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 26, 24); ctx.lineTo(cx - 26, 28 + lean); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 26, 24); ctx.lineTo(cx + 26, 28 - lean); ctx.stroke();
  // Молоток (бьёт)
  const hammerY = 65 + Math.abs(Math.sin(t * 0.08)) * (-15);
  ctx.fillStyle = '#FF4466';
  ctx.fillRect(cx + 50, hammerY, 20, 12);
  ctx.fillRect(cx + 57, hammerY + 12, 6, 20);
}

// LIVE DEALS: антенна + волны + карточки
function drawLiveDeals(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  // Антенна
  ctx.fillStyle = '#00FF88';
  ctx.fillRect(cx - 2, 10, 4, 50);
  ctx.fillRect(cx - 20, 10, 40, 4);
  // Волны
  for (let i = 1; i <= 3; i++) {
    const r = 20 + i * 16;
    const alpha = Math.max(0, Math.sin((t * 0.05) - i * 0.8));
    ctx.strokeStyle = `rgba(0,255,136,${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, 12, r, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // Карточки летят вверх
  for (let i = 0; i < 3; i++) {
    const cardY = h - ((t * 1.2 + i * 35) % (h + 20));
    ctx.fillStyle = `rgba(0,136,255,${0.3 + i * 0.15})`;
    ctx.fillRect(cx - 55 + i * 38, cardY, 34, 22);
    ctx.fillStyle = '#00FF88';
    ctx.fillRect(cx - 49 + i * 38, cardY + 4, 22, 2);
    ctx.fillRect(cx - 49 + i * 38, cardY + 10, 16, 2);
  }
}

// PROFILE: персонаж + трофеи + звёзды
function drawProfile(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  // Персонаж (пиксельный рыцарь)
  const float = Math.sin(t * 0.05) * 3;
  ctx.fillStyle = '#00FF88';
  ctx.fillRect(cx - 12, 8 + float, 24, 20); // голова
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(cx - 10, 10 + float, 20, 6); // шлем
  ctx.fillStyle = '#00FF88';
  ctx.fillRect(cx - 16, 30 + float, 32, 28); // тело (броня)
  ctx.fillStyle = '#FFAA00';
  ctx.fillRect(cx - 16, 30 + float, 6, 20);  // щит
  ctx.fillRect(cx + 10, 30 + float, 6, 28);  // меч
  // Трофеи
  [['#FFAA00', cx - 60, 25], ['#CCCCCC', cx - 60, 55], ['#FF8800', cx - 60, 75]] .forEach(([c, x, y]) => {
    ctx.fillStyle = c as string;
    ctx.fillRect(x as number, y as number, 14, 16);
    ctx.fillRect((x as number) + 3, (y as number) + 16, 8, 4);
    ctx.fillRect((x as number) - 2, (y as number) + 20, 18, 4);
  });
  // Звёзды рейтинга
  for (let i = 0; i < 5; i++) {
    const lit = i < 4;
    ctx.fillStyle = lit ? '#FFAA00' : 'rgba(255,255,255,0.2)';
    const sx = cx + 22 + i * 12, sy = 30;
    ctx.fillRect(sx + 2, sy, 6, 6);
    ctx.fillRect(sx, sy + 4, 10, 4);
    ctx.fillRect(sx + 2, sy + 8, 6, 6);
  }
}

// JOB BOARD: доска объявлений + лупа + карточки
function drawJobBoard(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  // Доска
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(cx - 70, 5, 140, 85);
  ctx.strokeStyle = '#FF8800'; ctx.lineWidth = 2;
  ctx.strokeRect(cx - 70, 5, 140, 85);
  // Заголовок
  ctx.fillStyle = '#FF8800';
  ctx.fillRect(cx - 70, 5, 140, 16);
  text(ctx, 'JOB BOARD', cx - 42, 17, '#000', 7);
  // Карточки заказов
  for (let i = 0; i < 3; i++) {
    const slideX = ((t * 0.5 + i * 50) % 160) - 20;
    ctx.fillStyle = `rgba(255,136,0,${0.15 + i * 0.05})`;
    ctx.fillRect(cx - 62 + slideX, 28 + i * 18, 55, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - 56 + slideX, 32 + i * 18, 30, 3);
    ctx.fillRect(cx - 56 + slideX, 37 + i * 18, 20, 2);
  }
  // Лупа
  const mx = cx + 50 + Math.sin(t * 0.04) * 8;
  const my = 65;
  ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx + 7, my + 7); ctx.lineTo(mx + 16, my + 16); ctx.stroke();
}
