import { useEffect, useRef } from 'react';

type SceneName = 'home'|'new_deal'|'deal_room'|'payment'|'review'|'dispute'|'live_deals'|'profile'|'job_board';

const PS = 4;
function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c; ctx.fillRect(x*PS, y*PS, PS, PS);
}
function row(ctx: CanvasRenderingContext2D, y: number, xs: number[], c: string) {
  xs.forEach(x => px(ctx, x, y, c));
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c; ctx.fillRect(x*PS, y*PS, w*PS, h*PS);
}

function drawHome(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[2,0],[8,1],[18,0],[26,1],[34,0],[40,1],[50,0],[56,1],[60,0]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  rect(ctx,0,12,63,2,'#1a1a3a');
  rect(ctx,2,6,12,6,'#2233aa');
  row(ctx,6,[2,13],'#3344cc'); row(ctx,11,[2,3,4,5,6,7,8,9,10,11,12,13],'#3344cc');
  [[7,2],[6,3],[5,4],[4,5],[3,5],[8,3],[9,4],[10,5],[11,5],[12,5],[13,5]].forEach(([x,y])=>px(ctx,x,y,'#cc4422'));
  px(ctx,7,1,'#cc4422');
  rect(ctx,6,9,3,3,'#884400'); px(ctx,8,10,'#ffaa00');
  rect(ctx,3,7,2,2,'#aaddff'); rect(ctx,11,7,2,2,'#aaddff');
  px(ctx,3,7,'#ffffff88'); px(ctx,11,7,'#ffffff88');
  rect(ctx,10,3,2,3,'#884433'); px(ctx,10,2,'#aaaaaa88'); px(ctx,11,1,'#aaaaaa55');
  rect(ctx,17,2,10,11,'#2a1a00'); rect(ctx,18,3,8,9,'#3a2800');
  [4,6,8,10].forEach(y=>row(ctx,y,[19,20,21,22,23,24,25],'#ffaa0055'));
  row(ctx,2,[17,18,19,20,21,22,23,24,25,26],'#8b5e2a');
  row(ctx,12,[17,18,19,20,21,22,23,24,25,26],'#8b5e2a');
  px(ctx,19,4,'#00ff88');
  rect(ctx,29,3,10,11,'#1a2a1a'); rect(ctx,30,4,8,9,'#1e3a1e');
  [5,7,9,11].forEach(y=>row(ctx,y,[31,32,33,34,35,36,37],'#00ff8844'));
  row(ctx,3,[29,30,31,32,33,34,35,36,37,38],'#2a5a2a');
  row(ctx,13,[29,30,31,32,33,34,35,36,37,38],'#2a5a2a');
  px(ctx,31,5,'#00ff88'); px(ctx,31,7,'#00ff88');
  row(ctx,8,[15,16,17],'#ffffff22'); row(ctx,8,[27,28,29],'#ffffff22');
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('QUESTS',22*PS+2,14*PS+2);
  ctx.fillText('ACHIEVEMENTS',33*PS+2,14*PS+2);
}

function drawDeal(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[1,0],[12,1],[28,0],[40,1],[55,0],[60,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  rect(ctx,3,1,13,13,'#f5f0e8');
  [3,5,7,9,11].forEach(y=>[4,5,6,7,8,9,10,11,12,13,14,15].forEach(x=>px(ctx,x,y,'#ccbbaa66')));
  row(ctx,3,[4,5,6,7,8,9],'#4466ff88');
  row(ctx,5,[4,5,6,7,8,9,10,11],'#4466ff66');
  row(ctx,7,[4,5,6,7,8],'#4466ff55');
  row(ctx,11,[4,5,6,7,8,9,10,11,12,13,14,15],'#33333344');
  [4,5,6,7,8,9].forEach((x,i)=>px(ctx,x,12+((i%2)),'#ffaa00'));
  const quill:Array<[number,number,string]>=[[20,2,'#ff8866'],[21,3,'#ff6644'],[22,4,'#ff4422'],[23,3,'#ff6644'],[24,2,'#ff8866'],[25,1,'#ffaaaa'],[22,5,'#aaaaaa'],[21,6,'#999999'],[20,7,'#777777'],[19,8,'#555555'],[18,9,'#333333']];
  quill.forEach(([x,y,c])=>px(ctx,x,y,c));
  px(ctx,17,10,'#4466ffaa'); px(ctx,16,10,'#4466ff55');
  px(ctx,16,9,'#ffaa00'); px(ctx,15,8,'#ffaa0077'); px(ctx,17,8,'#ffaa0077');
  rect(ctx,29,2,13,12,'#f5f0e8');
  [4,6,8,10].forEach(y=>[30,31,32,33,34,35,36,37,38,39].forEach(x=>px(ctx,x,y,'#ccbbaa55')));
  row(ctx,3,[30,31,32,33,34,35,36],'#0055ff77');
  row(ctx,5,[30,31,32,33,34,35],'#0055ff66');
  row(ctx,7,[30,31,32,33,34,35,36],'#0055ff55');
  row(ctx,10,[30,31,32,33,34,35,36,37,38,39],'#33333344');
  [30,31,32,33,34].forEach((x,i)=>px(ctx,x,11+((i%2)),'#ffaa0088'));
  rect(ctx,43,3,8,9,'#1a3a1a'); rect(ctx,44,4,6,7,'#1e4a1e');
  [5,7,9].forEach(y=>row(ctx,y,[45,46,47,48,49],'#00ff8844'));
  row(ctx,3,[43,44,45,46,47,48,49,50,51],'#2a5a2a'); row(ctx,11,[43,44,45,46,47,48,49,50,51],'#2a5a2a');
  px(ctx,45,5,'#00ff88'); px(ctx,45,7,'#00ff88');
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('SIGN',47*PS+2,13*PS+2);
}

function drawRoom(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  rect(ctx,0,12,63,2,'#1a1a2a');
  for(let i=0;i<63;i+=2) px(ctx,i,12,i%4===0?'#2a2a3a':'#1a1a2a');
  [[3,0],[14,1],[25,0],[38,1],[50,0],[60,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff44'));
  const char=[[0,1,1,0],[1,2,2,1],[0,1,1,0],[0,1,1,0],[1,0,0,1]];
  char.forEach((r,y)=>r.forEach((v,x)=>{if(v===1)px(ctx,1+x,7+y,'#2255cc');if(v===2)px(ctx,1+x,7+y,'#4488ff');}));
  ctx.fillStyle='#4488ff88'; ctx.font='3px monospace'; ctx.textAlign='center'; ctx.fillText('CLIENT',3*PS+2,6*PS-2);
  char.forEach((r,y)=>r.forEach((v,x)=>{if(v===1)px(ctx,57+x,7+y,'#229944');if(v===2)px(ctx,57+x,7+y,'#44cc66');}));
  ctx.fillStyle='#44cc6688'; ctx.fillText('FL',59*PS+2,6*PS-2);
  rect(ctx,26,4,11,8,'#004422'); rect(ctx,27,5,9,6,'#005533');
  row(ctx,4,[26,27,28,29,30,31,32,33,34,35,36],'#00ff8866');
  row(ctx,11,[26,27,28,29,30,31,32,33,34,35,36],'#00ff8866');
  [26,36].forEach(x=>[4,5,6,7,8,9,10,11].forEach(y=>px(ctx,x,y,'#00ff8866')));
  rect(ctx,29,7,4,2,'#ffaa00'); px(ctx,30,7,'#ffdd44'); px(ctx,31,7,'#ffdd44');
  [[28,5],[34,5],[28,10],[34,10]].forEach(([x,y])=>px(ctx,x,y,'#00aa55'));
  px(ctx,31,8,'#00ff88');
  row(ctx,8,[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],'#ffaa0033');
  row(ctx,8,[37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56],'#ffaa0033');
  px(ctx,25,7,'#ffaa0055'); px(ctx,25,9,'#ffaa0055');
  px(ctx,37,7,'#ffaa0055'); px(ctx,37,9,'#ffaa0055');
  ctx.fillStyle='#00ff8866'; ctx.font='3px monospace'; ctx.textAlign='center';
  ctx.fillText('LOCKED',31*PS+2,3*PS-1);
}

function drawPayment(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[2,0],[12,1],[30,0],[45,1],[58,0]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  rect(ctx,44,3,15,10,'#004422'); rect(ctx,45,4,13,8,'#005533');
  row(ctx,3,[44,45,46,47,48,49,50,51,52,53,54,55,56,57,58],'#00ff8855');
  row(ctx,12,[44,45,46,47,48,49,50,51,52,53,54,55,56,57,58],'#00ff8855');
  [44,58].forEach(x=>[3,4,5,6,7,8,9,10,11,12].forEach(y=>px(ctx,x,y,'#00ff8855')));
  rect(ctx,49,7,4,2,'#ffaa00'); px(ctx,50,7,'#ffdd44');
  [[46,4],[54,4],[46,10],[54,10]].forEach(([x,y])=>px(ctx,x,y,'#00aa55'));
  rect(ctx,50,3,2,1,'#000000');
  [[0,1,1,0],[1,2,2,1],[0,1,1,0]].forEach((r,y)=>r.forEach((v,x)=>{if(v===1)px(ctx,0+x,9+y,'#cc8800');if(v===2)px(ctx,0+x,9+y,'#ffaa00');}));
  [[0,1,1,0],[1,2,2,1],[0,1,1,0]].forEach((r,y)=>r.forEach((v,x)=>{if(v===1)px(ctx,1+x,7+y,'#dd9900');if(v===2)px(ctx,1+x,7+y,'#ffbb00');}));
  [[0,1,1,0],[1,2,2,1],[0,1,1,0]].forEach((r,y)=>r.forEach((v,x)=>{if(v===1)px(ctx,0+x,5+y,'#ee9900');if(v===2)px(ctx,0+x,5+y,'#ffcc00');}));
  ([[8,7,'#ffaa00','ff'],[17,5,'#ffbb00','cc'],[27,3,'#ffcc00','99'],[37,2,'#ffdd44','77']] as Array<[number,number,string,string]>).forEach(([x,y,c,a])=>{
    [[0,1,0],[1,2,1],[0,1,0]].forEach((r,ry)=>r.forEach((v,rx)=>{
      if(v===1){ctx.fillStyle=c+a;ctx.fillRect((x+rx)*PS,y*PS,PS,PS);}
      if(v===2){ctx.fillStyle='#ffee88'+a;ctx.fillRect((x+rx)*PS,y*PS,PS,PS);}
    }));
    for(let t=1;t<=2;t++){ctx.fillStyle=`rgba(255,170,0,${0.15/t})`;ctx.fillRect((x-t)*PS,y*PS,PS,PS);}
  });
  ctx.strokeStyle='rgba(255,170,0,0.2)'; ctx.lineWidth=2; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(3*PS,8*PS); ctx.bezierCurveTo(10*PS,0,35*PS,0,51*PS,3*PS); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,170,0,0.35)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('SEND TO ESCROW',31*PS+2,14*PS+2);
}

function drawReview(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[1,0],[15,1],[30,0],[45,1],[58,0]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  rect(ctx,1,1,16,12,'#f5f0e8');
  [2,4,6,8,10].forEach(y=>[2,3,4,5,6,7,8,9,10,11,12,13,14,15].forEach(x=>px(ctx,x,y,'#ccbbaa55')));
  ([[2,2,'#00ff88',true],[2,4,'#00ff88',true],[2,6,'#ff4466',false],[2,8,'#888',false],[2,10,'#888',false]] as Array<[number,number,string,boolean]>).forEach(([x,y,c,done])=>{
    rect(ctx,x,y,1,1,done?c:'#ccbbaa88');
    [x+2,x+3,x+4,x+5,x+6,x+7,x+8,x+9,x+10,x+11,x+12].forEach(lx=>px(ctx,lx,y,done?'#333333aa':'#ccbbaa55'));
  });
  [[0,1,1,0],[1,0,0,1],[1,0,0,1],[0,1,1,0]].forEach((r,y)=>r.forEach((v,x)=>{if(v)px(ctx,22+x,5+y,'#00ff8899');}));
  rect(ctx,23,6,2,2,'#00ff8822'); px(ctx,23,6,'#aaffcc44');
  px(ctx,25,9,'#00aa55'); px(ctx,26,10,'#009944'); px(ctx,27,11,'#008833'); px(ctx,28,12,'#007722');
  const check=[[0,0,0,0,0,1],[0,0,0,0,1,1],[0,0,0,1,1,0],[1,0,0,1,0,0],[1,1,0,1,0,0],[0,1,1,0,0,0]];
  check.forEach((r,y)=>r.forEach((v,x)=>{if(v){ctx.fillStyle='#00ff88';ctx.fillRect((38+x)*PS,(4+y)*PS,PS+1,PS+1);}}));
  ctx.fillStyle='rgba(0,255,136,0.07)'; ctx.fillRect(37*PS,3*PS,8*PS,9*PS);
  ctx.fillStyle='rgba(0,255,136,0.35)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('VERIFY QUALITY',31*PS+2,14*PS+2);
  const xmark=[[1,0,1],[0,1,0],[1,0,1]];
  xmark.forEach((r,y)=>r.forEach((v,x)=>{if(v)px(ctx,50+x,5+y,'#ff4466aa');}));
}

function drawDispute(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[2,0],[18,1],[35,0],[50,1],[60,0]].forEach(([x,y])=>px(ctx,x,y,'#ff446633'));
  for(let y=1;y<=11;y++) row(ctx,y,[28,29],'#886644');
  row(ctx,11,[26,27,28,29,30,31,32],'#886644');
  row(ctx,1,[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50],'#aa8855');
  [8,7,6].forEach((x,i)=>px(ctx,x,4+i,'#886644'));
  row(ctx,7,[6,7,8,9,10,11,12,13,14],'#4466cc'); row(ctx,8,[7,8,9,10,11,12,13],'#3355aa');
  px(ctx,9,6,'#ffaa00'); px(ctx,10,6,'#ffcc44'); px(ctx,11,6,'#ffaa00');
  [50,51,52].forEach((x,i)=>px(ctx,x,4+i,'#886644'));
  row(ctx,7,[48,49,50,51,52,53,54,55,56],'#4466cc'); row(ctx,8,[49,50,51,52,53,54,55],'#3355aa');
  px(ctx,51,6,'#ff4466'); px(ctx,52,6,'#ff6688'); px(ctx,53,6,'#ff4466');
  px(ctx,28,3,'#ffaa00'); px(ctx,29,2,'#ffcc44'); px(ctx,30,3,'#ffaa00');
  ctx.fillStyle='rgba(255,68,102,0.35)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('ARBITER DECIDES',31*PS+2,14*PS+2);
}

function drawLive(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  [[3,0],[18,1],[35,0],[50,1],[60,0]].forEach(([x,y])=>px(ctx,x,y,'#00ff8833'));
  for(let y=2;y<=12;y++) px(ctx,31,y,'#886644');
  row(ctx,2,[29,30,31,32,33],'#886644');
  px(ctx,31,1,'#ffaa00');
  [
    [24,3,6,4,'#0088ff'],[35,3,6,4,'#00ff88'],[24,9,6,4,'#cc44ff'],[35,9,6,4,'#ffaa00']
  ].forEach(([x,y,w,h,c])=>{
    rect(ctx,x as number,y as number,w as number,h as number,'rgba(255,255,255,0.03)');
    row(ctx,y as number,Array.from({length:w as number},(_, i)=>( x as number)+i),c as string+'66');
    row(ctx,(y as number)+(h as number)-1,Array.from({length:w as number},(_, i)=>( x as number)+i),c as string+'66');
  });
  for(let i=0;i<4;i++){
    const cardY=2+i*3;
    ctx.fillStyle=`rgba(0,255,136,${0.6-i*0.12})`;
    ctx.fillRect(17*PS,cardY*PS,5*PS,2*PS);
  }
  for(let r=1;r<=3;r++){
    ctx.strokeStyle=`rgba(0,255,136,${0.15/r})`;
    ctx.lineWidth=1; ctx.beginPath();
    ctx.arc(31*PS+2,2*PS,r*10,0,Math.PI*2); ctx.stroke();
  }
  ctx.fillStyle='rgba(255,68,68,0.9)'; ctx.beginPath();
  ctx.arc(31*PS+2,1*PS,PS/2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,255,136,0.3)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('LIVE FEED',31*PS+2,14*PS+2);
}

function drawProfile(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  rect(ctx,26,1,11,11,'#1a2a3a');
  [[27,2],[28,2],[29,2],[30,2],[31,2],[32,2],[33,2],[34,2],[35,2],[36,2]].forEach(([x,y])=>px(ctx,x,y,'#2244aa'));
  rect(ctx,28,3,7,6,'#4488ff');
  rect(ctx,29,4,5,3,'#ffcc88');
  px(ctx,29,5,'#cc8844'); px(ctx,33,5,'#cc8844');
  rect(ctx,29,7,5,2,'#ffcc88');
  row(ctx,9,[27,28,29,30,31,32,33,34,35,36],'#2266cc');
  for(let i=0;i<3;i++){
    const tx=4+i*18;
    rect(ctx,tx,3,14,10,'rgba(255,255,255,0.03)');
    row(ctx,3,Array.from({length:14},(_,j)=>tx+j),'rgba(255,170,0,0.3)');
    ctx.fillStyle='#ffaa00'; ctx.font='6px monospace'; ctx.textAlign='center';
    ctx.fillText(['🏆','⭐','🔥'][i],(tx+7)*PS,10*PS);
  }
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('PROFILE',31*PS+2,14*PS+2);
}

function drawJobBoard(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!; ctx.clearRect(0,0,cv.width,cv.height);
  rect(ctx,2,1,40,12,'#1a1a1a');
  row(ctx,1,Array.from({length:40},(_,i)=>2+i),'#333');
  row(ctx,12,Array.from({length:40},(_,i)=>2+i),'#333');
  [2,41].forEach(x=>[1,2,3,4,5,6,7,8,9,10,11,12].forEach(y=>px(ctx,x,y,'#333')));
  [5,7,9,11].forEach(y=>row(ctx,y,[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],'rgba(255,255,255,0.06)'));
  row(ctx,3,[4,5,6,7,8,9,10,11,12],'#0088ff55');
  row(ctx,5,[4,5,6,7,8,9,10,11,12,13,14],'#ffffff22');
  row(ctx,7,[4,5,6,7,8,9,10],'#ffffff22');
  px(ctx,39,3,'#00ff88'); px(ctx,39,5,'#ffaa00'); px(ctx,39,7,'#ff4466');
  rect(ctx,45,3,14,10,'#111');
  row(ctx,3,Array.from({length:14},(_,i)=>45+i),'#222');
  [[46,5,'#0088ff'],[46,7,'#00ff88'],[46,9,'#ffaa00']].forEach(([x,y,c])=>{
    row(ctx,y as number,[x as number,(x as number)+1,(x as number)+2],(c as string)+'88');
    row(ctx,y as number,Array.from({length:9},(_,i)=>(x as number)+4+i),'rgba(255,255,255,0.15)');
  });
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='4px monospace'; ctx.textAlign='center';
  ctx.fillText('JOB BOARD',31*PS+2,14*PS+2);
}

const drawFns: Record<SceneName, (cv: HTMLCanvasElement) => void> = {
  home      : drawHome,
  new_deal  : drawDeal,
  deal_room : drawRoom,
  payment   : drawPayment,
  review    : drawReview,
  dispute   : drawDispute,
  live_deals: drawLive,
  profile   : drawProfile,
  job_board : drawJobBoard,
};

export function PixelScene({ scene, width = 252, height = 56 }: { scene: SceneName; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) drawFns[scene]?.(ref.current);
  }, [scene]);

  return <canvas ref={ref} width={width} height={height} style={{ display:'block', margin:'0 auto 8px', imageRendering:'pixelated' }} />;
}
