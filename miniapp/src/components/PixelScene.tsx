import { useEffect, useRef } from 'react';

type SceneName = 'home'|'new_deal'|'deal_room'|'payment'|'review'|'dispute'|'live_deals'|'profile'|'job_board';

const W=252,H=56,S=3;

const G='#00ff88',G2='#00cc66',G3='#009944',G4='#005522',G5='#002211';
const AU='#ffaa00',AU2='#cc8800',AU3='#884400',AU4='#552200',AU5='#ffdd55';
const BL='#0088ff',BL2='#0055cc',BL3='#003399',BL4='#001166',BL5='#55aaff';
const RD='#ff4466',RD2='#cc1133';
const PU='#cc44ff';
const GR='#aaccff',GR2='#667799',GR3='#334466';
const WH2='#cccccc';
const DK='#04040e',DK2='#080816',DK3='#0c0c1e';

type Ctx = CanvasRenderingContext2D;
function px(ctx:Ctx,x:number,y:number,c:string){if(x<0||y<0||x*S+S>W||y*S+S>H)return;ctx.fillStyle=c;ctx.fillRect(x*S,y*S,S,S);}
function bk(ctx:Ctx,x:number,y:number,w:number,h:number,c:string){ctx.fillStyle=c;ctx.fillRect(x*S,y*S,w*S,h*S);}
function rw(ctx:Ctx,y:number,xs:number[],c:string){xs.forEach(x=>px(ctx,x,y,c));}
function star(ctx:Ctx,x:number,y:number,c:string){px(ctx,x,y,c);ctx.fillStyle=c+'55';ctx.fillRect((x-1)*S,y*S,S,S);ctx.fillRect((x+1)*S,y*S,S,S);ctx.fillRect(x*S,(y-1)*S,S,S);ctx.fillRect(x*S,(y+1)*S,S,S);}

// ── HOME ──────────────────────────────────────────────────
function drawHome(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[2,1],[10,2],[20,1],[35,2],[55,1],[62,2],[72,1],[76,2],[80,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,0,14,84,2,'#111122');
  for(let i=0;i<84;i+=3)px(ctx,i,14,i%6<3?'#1a1a2e':'#111122');
  bk(ctx,1,8,13,6,'#1e2d55');bk(ctx,1,8,13,1,'#2a3d6e');bk(ctx,1,13,13,1,'#141e3a');
  bk(ctx,1,8,1,6,'#2a3d6e');bk(ctx,13,8,1,6,'#141e3a');
  bk(ctx,2,9,3,3,'#2255aa');bk(ctx,3,9,1,1,BL5+'66');
  bk(ctx,9,9,3,3,'#2255aa');bk(ctx,10,9,1,1,BL5+'66');
  ctx.fillStyle=BL+'11';ctx.fillRect(2*S,9*S,3*S,3*S);ctx.fillRect(9*S,9*S,3*S,3*S);
  bk(ctx,5,10,4,4,'#331100');bk(ctx,6,11,1,2,AU3);px(ctx,7,12,AU);
  [[7,4],[6,5],[5,6],[4,7],[3,7],[8,5],[9,6],[10,7],[11,7],[12,7],[13,7],[2,7],[14,7]].forEach(([x,y])=>px(ctx,x,y,G3));
  rw(ctx,7,[3,4,5,6,7,8,9,10,11,12,13,14],G4);px(ctx,7,3,G2);px(ctx,8,4,G2);
  bk(ctx,11,4,2,4,'#662211');px(ctx,11,4,'#883322');
  px(ctx,11,3,'#aaaaaa88');px(ctx,12,2,'#aaaaaa55');
  bk(ctx,18,2,12,1,AU3);bk(ctx,18,13,12,1,AU3);
  bk(ctx,18,3,12,10,'#2a1800');bk(ctx,19,4,10,8,'#332000');
  rw(ctx,5,[20,21,22,23,24,25,26],AU+'55');rw(ctx,7,[20,21,22,23,24,25],AU+'44');
  rw(ctx,9,[20,21,22,23,24,25,26],AU+'33');rw(ctx,11,[20,21,22,23],AU+'22');
  px(ctx,20,5,G);px(ctx,20,7,G);
  bk(ctx,18,3,1,10,AU2);bk(ctx,29,3,1,10,AU2);
  bk(ctx,33,9,3,1,GR);bk(ctx,32,10,5,1,GR2);
  bk(ctx,33,10,1,1,AU);bk(ctx,34,10,1,1,AU);
  bk(ctx,32,11,5,3,GR2);bk(ctx,33,12,1,1,AU);
  bk(ctx,31,12,1,2,GR3);bk(ctx,36,12,1,2,GR3);
  bk(ctx,32,14,2,2,'#334455');bk(ctx,34,14,2,2,'#334455');
  for(let y=8;y<=13;y++)px(ctx,37,y,GR2);
  bk(ctx,36,11,3,1,AU);px(ctx,36,11,AU5);
  star(ctx,45,3,G);star(ctx,55,8,AU);star(ctx,65,2,BL);
  star(ctx,75,5,G);star(ctx,82,3,AU);
}

// ── NEW DEAL ──────────────────────────────────────────────
function drawNewDeal(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[3,1],[12,2],[22,1],[38,2],[55,1],[68,2],[78,1],[83,2]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,1,1,15,14,'#ede0be');
  bk(ctx,1,1,15,1,AU3);bk(ctx,1,14,15,1,AU3);
  bk(ctx,1,1,1,14,'#e0d0a0');bk(ctx,15,1,1,14,'#c8b078');
  bk(ctx,13,1,3,3,'#c8b070');px(ctx,13,1,'#d4bc84');px(ctx,15,3,'#b8a060');
  [2,4,6,8,10,12].forEach((y,i)=>{
    const w=10-i;ctx.fillStyle=i<2?'#4466ffaa':'#44444477';
    ctx.fillRect(2*S,y*S+1,w*S,S*0.4);
  });
  rw(ctx,13,[2,3,4,5,6,7,8,9,10,11,12,13],'#33333333');
  [2,3,4,5,6].forEach((x,i)=>px(ctx,x,13,AU+(i%2?'aa':'88')));
  [[22,1,AU5],[23,2,AU],[24,3,AU2],[23,3,AU5],[22,2,'#ffffcc'],[25,2,AU],[21,2,'#ffffaa']].forEach(([x,y,c])=>px(ctx,x as number,y as number,c as string));
  [[21,3,AU3],[25,3,AU2],[20,4,AU4],[24,4,AU3],[19,5,AU4],[23,5,AU4]].forEach(([x,y,c])=>px(ctx,x as number,y as number,c as string));
  [[21,4,'#aaa'],[20,5,'#999'],[19,6,'#777'],[18,7,'#555'],[17,8,'#333']].forEach(([x,y,c])=>px(ctx,x as number,y as number,c as string));
  px(ctx,17,9,BL+'cc');ctx.fillStyle=BL+'44';ctx.fillRect(16*S,9*S,S,S);
  bk(ctx,28,2,15,12,'#f0e6c5');
  bk(ctx,28,2,15,1,AU3);bk(ctx,28,13,15,1,AU3);
  bk(ctx,28,2,1,12,'#e0d098');bk(ctx,42,2,1,12,'#c0a870');
  [3,5,7,9,11].forEach((y,i)=>{
    const w=i<3?11:8;
    ctx.fillStyle=i<2?'#4466ffcc':i<4?'#4466ff88':'#4466ff44';
    ctx.fillRect(29*S,y*S+1,w*S,S*0.4);
    if(i<2)ctx.fillRect(29*S,(y+1)*S,(w-2)*S,S*0.35);
  });
  px(ctx,33,11,BL);ctx.fillStyle=BL+'44';ctx.fillRect(34*S,11*S,S,S);
  star(ctx,26,5,G);star(ctx,26,10,AU);star(ctx,17,6,G);
  star(ctx,48,2,G);star(ctx,56,7,AU);star(ctx,65,3,G);star(ctx,74,8,BL);star(ctx,82,4,AU);
}

// ── DEAL ROOM ─────────────────────────────────────────────
function drawRoom(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  bk(ctx,0,13,84,3,'#0d0d1a');
  for(let i=0;i<84;i+=2)for(let j=13;j<16;j++)px(ctx,i,j,(i+j)%2===0?'#111122':'#0d0d18');
  [[3,1],[14,2],[25,1],[40,2],[60,1],[72,2],[80,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,1,5,4,1,GR);bk(ctx,0,6,6,1,GR2);
  bk(ctx,1,6,1,1,AU);bk(ctx,3,6,1,1,AU);
  bk(ctx,0,7,6,4,GR2);bk(ctx,1,8,1,1,BL5);
  bk(ctx,0,7,1,2,GR);bk(ctx,5,7,1,2,GR);
  bk(ctx,1,11,2,3,'#1a2a44');bk(ctx,3,11,2,3,'#1a2a44');
  bk(ctx,6,7,2,4,BL2);bk(ctx,6,7,2,1,BL);px(ctx,6,7,BL5);
  for(let y=5;y<=10;y++)px(ctx,7,y,GR);bk(ctx,6,8,3,1,AU);px(ctx,6,8,AU5);
  ctx.fillStyle=BL+'66';ctx.font='4px monospace';ctx.textAlign='center';ctx.fillText('CLIENT',3*S,4*S);
  bk(ctx,34,2,16,13,G5);bk(ctx,35,3,14,11,G4+'88');
  rw(ctx,2,[34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49],G3);
  rw(ctx,14,[34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49],G3);
  for(let y=2;y<=14;y++){px(ctx,34,y,G3);px(ctx,49,y,G3);}
  bk(ctx,36,4,12,9,G4);bk(ctx,37,5,10,7,'#003322');
  bk(ctx,38,7,8,3,AU2);bk(ctx,39,8,6,1,AU5);bk(ctx,38,7,8,1,AU);bk(ctx,38,9,8,1,AU3);
  bk(ctx,40,7,4,3,AU);bk(ctx,41,8,2,1,AU5);px(ctx,40,7,AU5);
  [[36,4],[47,4],[36,12],[47,12]].forEach(([x,y])=>{bk(ctx,x,y,2,2,G3);px(ctx,x,y,G2);px(ctx,x+1,y+1,G5);});
  bk(ctx,40,9,4,2,G2);bk(ctx,41,9,2,2,G);px(ctx,41,9,G);px(ctx,42,9,'#88ffcc');
  ctx.fillStyle=G+'14';ctx.fillRect(34*S,2*S,16*S,13*S);
  ctx.fillStyle=G+'55';ctx.font='4px monospace';ctx.textAlign='center';ctx.fillText('LOCKED',41.5*S,1*S+2);
  bk(ctx,74,5,4,1,AU5);bk(ctx,73,6,6,1,AU2);
  bk(ctx,74,6,1,1,RD);bk(ctx,76,6,1,1,RD);
  bk(ctx,73,7,6,4,AU2);bk(ctx,74,8,1,1,G3);
  bk(ctx,73,7,1,2,AU3);bk(ctx,78,7,1,2,AU3);
  bk(ctx,74,11,2,3,AU4);bk(ctx,76,11,2,3,AU4);
  bk(ctx,72,8,2,4,AU3);bk(ctx,72,8,2,1,AU2);px(ctx,72,8,AU);
  ctx.fillStyle=AU+'66';ctx.font='4px monospace';ctx.textAlign='center';ctx.fillText('FREELANCER',76*S,4*S);
  ctx.strokeStyle=AU+'55';ctx.lineWidth=1.5;ctx.setLineDash([2,2]);
  ctx.beginPath();ctx.moveTo(9*S,8*S);ctx.lineTo(34*S,8*S);ctx.stroke();
  ctx.beginPath();ctx.moveTo(72*S,8*S);ctx.lineTo(50*S,8*S);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle=AU+'88';
  ctx.beginPath();ctx.moveTo(34*S,7*S);ctx.lineTo(34*S,9*S);ctx.lineTo(35*S,8*S);ctx.fill();
  ctx.beginPath();ctx.moveTo(50*S,7*S);ctx.lineTo(50*S,9*S);ctx.lineTo(49*S,8*S);ctx.fill();
}

// ── PAYMENT ───────────────────────────────────────────────
function drawPayment(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[2,1],[8,2],[18,1],[30,2],[55,1],[70,2],[80,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,1,2,12,13,BL3);
  bk(ctx,1,2,12,1,BL2);bk(ctx,1,14,12,1,BL4);
  bk(ctx,1,2,1,13,BL2);bk(ctx,12,2,1,13,BL4);
  [4,6,8,10,12].forEach(y=>rw(ctx,y,[2,3,4,5,6,7,8,9,10,11],BL2+'55'));
  bk(ctx,4,2,5,1,'#000d1a');bk(ctx,5,2,3,1,DK);
  px(ctx,4,2,BL4);px(ctx,8,2,BL4);
  bk(ctx,12,5,3,7,GR3);bk(ctx,12,5,3,1,GR2);bk(ctx,12,11,3,1,'#223344');
  bk(ctx,13,6,1,6,'#445566');px(ctx,13,8,GR2);px(ctx,13,9,GR2);
  bk(ctx,3,5,5,5,AU4);bk(ctx,3,5,5,1,AU3);bk(ctx,3,9,5,1,AU4);
  bk(ctx,4,6,3,3,AU);bk(ctx,5,7,1,1,AU5);px(ctx,4,6,AU5);
  bk(ctx,2,3,9,2,BL4);bk(ctx,2,3,9,1,BL3);px(ctx,2,3,BL);
  [[20,1,'#ffaa0022'],[20,2,'#ffaa0044'],[20,3,'#ffaa0066']].forEach(([x,y,c])=>bk(ctx,x as number,y as number,4,1,c as string));
  const coin=[[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,2,3,3,2,1,1],[1,2,3,4,4,3,2,1],[1,2,3,4,4,3,2,1],[1,1,2,3,3,2,1,1],[0,1,1,1,1,1,1,0],[0,0,1,1,1,1,0,0]];
  const cc:Record<string,string>={'1':AU3,'2':AU2,'3':AU,'4':AU5};
  coin.forEach((row,y)=>row.forEach((v,x)=>{if(cc[v])px(ctx,18+x,4+y,cc[v]);}));
  rw(ctx,4,[19,20,21,22,23,24],AU5);rw(ctx,11,[19,20,21,22,23,24],AU4);
  bk(ctx,20,5,4,1,AU4);bk(ctx,21,6,2,3,AU4);
  px(ctx,20,5,AU5);px(ctx,23,5,AU5);
  bk(ctx,29,0,13,16,G5);bk(ctx,30,1,11,14,G4);
  rw(ctx,0,[29,30,31,32,33,34,35,36,37,38,39,40,41],G3);
  rw(ctx,15,[29,30,31,32,33,34,35,36,37,38,39,40,41],G3);
  for(let y=0;y<=15;y++){px(ctx,29,y,G3);px(ctx,41,y,G3);}
  bk(ctx,32,0,7,2,'#000');rw(ctx,0,[32,33,34,35,36,37,38],G+'22');
  px(ctx,32,0,G+'55');px(ctx,38,0,G+'55');
  bk(ctx,31,2,10,12,G4);bk(ctx,32,3,8,10,'#003322');
  bk(ctx,32,7,8,3,AU2);bk(ctx,33,8,6,1,AU5);
  bk(ctx,32,7,8,1,AU);bk(ctx,32,9,8,1,AU3);
  bk(ctx,34,7,4,3,AU);bk(ctx,35,8,2,1,AU5);px(ctx,34,7,AU5);
  [[31,3],[39,3],[31,12],[39,12]].forEach(([x,y])=>{bk(ctx,x,y,2,2,G3);px(ctx,x,y,G2);});
  bk(ctx,34,10,6,1,G2);bk(ctx,35,10,4,1,G);
  ctx.fillStyle=G+'10';ctx.fillRect(29*S,0,13*S,16*S);
  ctx.strokeStyle=AU+'88';ctx.lineWidth=1.5;ctx.setLineDash([2,2]);
  ctx.beginPath();ctx.moveTo(15*S,8*S);ctx.lineTo(18*S,8*S);ctx.stroke();
  ctx.beginPath();ctx.moveTo(27*S,8*S);ctx.lineTo(29*S,8*S);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle=AU+'aa';
  ctx.beginPath();ctx.moveTo(29*S,7*S);ctx.lineTo(29*S,9*S);ctx.lineTo(30*S,8*S);ctx.fill();
  star(ctx,50,2,G);star(ctx,58,8,AU);star(ctx,66,3,G);star(ctx,74,7,BL);star(ctx,81,4,AU);
}

// ── REVIEW ────────────────────────────────────────────────
function drawReview(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[2,1],[10,2],[20,1],[35,2],[55,1],[68,2],[78,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,1,0,17,16,'#ede0be');
  bk(ctx,1,0,17,1,AU3);bk(ctx,1,15,17,1,AU3);
  bk(ctx,1,0,1,16,'#e0d0a0');bk(ctx,17,0,1,16,'#c0a868');
  bk(ctx,15,0,3,3,'#c8b070');px(ctx,15,0,'#d4bc84');px(ctx,17,2,'#b09050');
  ctx.fillStyle='#55443388';ctx.fillRect(2*S,1*S,10*S,S*0.5);
  const items=[{y:3,done:true},{y:6,done:true},{y:9,done:false},{y:12,done:false}];
  items.forEach(({y,done})=>{
    bk(ctx,2,y,2,2,done?G4:'#c8b888');
    if(done){
      bk(ctx,2,y,2,2,G);px(ctx,2,y+1,G3);px(ctx,3,y,G3);
      px(ctx,2,y,G+'cc');px(ctx,3,y+1,G2);
      ctx.fillStyle=G+'22';ctx.fillRect(2*S,y*S,2*S,2*S);
    } else {
      bk(ctx,2,y,2,1,'#d0c090');bk(ctx,2,y+1,2,1,'#c8b880');
    }
    const w=done?11:8;
    ctx.fillStyle=done?'#33333388':'#88776655';
    ctx.fillRect(5*S,y*S+1,w*S,S*0.45);
    ctx.fillRect(5*S,(y+1)*S+1,(w-3)*S,S*0.35);
    if(done){ctx.fillStyle=G3+'33';ctx.fillRect(5*S,y*S+S*0.35,w*S,0.5);}
  });
  bk(ctx,20,10,10,6,'#cc9966');bk(ctx,20,10,10,1,'#dda977');bk(ctx,20,15,10,1,'#aa7744');
  bk(ctx,20,10,1,6,'#ddaa77');bk(ctx,29,10,1,6,'#bb8855');
  [12,14].forEach(y=>rw(ctx,y,[21,22,23,24,25,26,27,28],'#bb885533'));
  bk(ctx,20,7,3,5,'#ddaa77');bk(ctx,20,7,3,1,'#eebb88');px(ctx,20,7,'#ffccaa');
  bk(ctx,20,3,3,8,'#eebb88');bk(ctx,20,3,3,1,'#ffccaa');bk(ctx,20,4,1,6,'#ffccaa');bk(ctx,22,5,1,4,'#cc9966');
  px(ctx,20,3,'#ffddbb');
  bk(ctx,23,9,3,3,'#cc9966');bk(ctx,26,9,3,3,'#cc9966');
  [23,26,29].forEach(x=>px(ctx,x,9,'#ddaa77'));
  [23,26,29].forEach(x=>px(ctx,x,10,'#bb8855'));
  bk(ctx,5,8,16,2,AU2);bk(ctx,5,8,16,1,AU);bk(ctx,5,9,16,1,AU3);
  [7,9,11,13,15,17].forEach(x=>bk(ctx,x,8,1,2,'#cc880033'));
  bk(ctx,3,8,2,2,'#d4c090');bk(ctx,3,8,2,1,'#e0cc99');
  bk(ctx,2,8,1,2,'#888');bk(ctx,1,8,1,2,'#555');px(ctx,1,8,'#333');
  bk(ctx,21,8,2,2,'#ff88aa');bk(ctx,21,8,2,1,'#ffaabb');
  bk(ctx,19,8,2,2,AU4);bk(ctx,19,8,2,1,AU3);
  px(ctx,1,9,G+'bb');ctx.fillStyle=G+'33';ctx.fillRect(0,9*S,2*S,2*S);
  bk(ctx,14,0,4,4,G4+'44');bk(ctx,14,0,4,1,G3+'55');
  const chk=[[0,0,0,1],[0,0,1,1],[1,0,1,0],[1,1,0,0]];
  chk.forEach((r,y)=>r.forEach((v,x)=>{if(v)px(ctx,14+x,y,G);}));
  star(ctx,38,2,G);star(ctx,45,8,AU);star(ctx,52,3,G);star(ctx,60,7,G2);star(ctx,68,4,AU);star(ctx,76,9,G);star(ctx,82,3,BL);
}

// ── DISPUTE ───────────────────────────────────────────────
function drawDispute(ctx:Ctx){
  ctx.fillStyle='#080008';ctx.fillRect(0,0,W,H);
  [[2,1],[10,2],[20,1],[35,2],[55,1],[68,2],[78,1]].forEach(([x,y])=>px(ctx,x,y,'#ff446622'));
  for(let y=3;y<=14;y++)bk(ctx,40,y,2,1,'#886644');
  bk(ctx,38,13,6,2,'#886644');bk(ctx,37,15,8,1,'#664422');
  bk(ctx,14,3,58,1,'#aa8855');
  bk(ctx,39,2,4,2,AU2);bk(ctx,40,2,2,2,AU);px(ctx,40,2,AU5);
  for(let y=4;y<=9;y++)px(ctx,18,y,'#886644');
  for(let y=5;y<=10;y++)px(ctx,24,y,'#886644');
  bk(ctx,13,10,14,1,BL2);bk(ctx,14,11,12,1,BL3);
  bk(ctx,13,10,14,1,BL);bk(ctx,13,10,1,1,BL5);bk(ctx,26,10,1,1,BL3);
  bk(ctx,15,7,4,1,AU4);bk(ctx,15,8,4,1,AU3);bk(ctx,15,9,4,1,AU2);bk(ctx,15,9,4,1,AU);
  px(ctx,15,9,AU5);px(ctx,16,8,AU5);
  bk(ctx,19,8,4,1,AU3);bk(ctx,19,9,4,1,AU);px(ctx,19,9,AU5);
  bk(ctx,17,6,4,1,AU4);px(ctx,17,6,AU5);
  for(let y=4;y<=7;y++)px(ctx,57,y,'#886644');
  for(let y=4;y<=8;y++)px(ctx,62,y,'#886644');
  bk(ctx,53,8,14,1,RD2);bk(ctx,54,9,12,1,'#880022');
  bk(ctx,53,8,14,1,RD);bk(ctx,53,8,1,1,'#ff7788');bk(ctx,66,8,1,1,RD2);
  px(ctx,56,5,RD);px(ctx,57,6,RD);px(ctx,58,7,RD);
  px(ctx,58,5,RD);px(ctx,57,6,RD);px(ctx,56,7,RD);
  px(ctx,56,5,'#ff6688');px(ctx,58,5,'#ff6688');
  px(ctx,74,12,'#884422');px(ctx,73,13,'#884422');px(ctx,72,14,'#aa5533');px(ctx,71,15,'#aa5533');
  bk(ctx,75,9,5,4,'#553322');bk(ctx,75,9,5,1,'#774433');
  px(ctx,74,9,RD);px(ctx,73,10,RD+'88');px(ctx,75,8,RD+'66');
  ([RD,AU,WH2] as string[]).forEach((c,i)=>px(ctx,73+i,8,c+'88'));
  [[0,0],[83,0],[0,15],[83,15]].forEach(([x,y])=>px(ctx,x,y,RD));
  [[8,2,AU],[9,4,AU],[75,2,AU],[74,4,AU]].forEach(([x,y,c])=>px(ctx,x as number,y as number,c as string));
}

// ── LIVE FEED ─────────────────────────────────────────────
function drawLive(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[8,1],[18,2],[28,1],[45,2],[60,1],[72,2],[80,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff22'));
  [[3,0.5],[5,0.35],[7,0.2]].forEach(([r,a])=>{
    ctx.strokeStyle=`rgba(0,136,255,${a})`;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(14*S,8*S,r*S,-Math.PI*0.75,-Math.PI*0.05);ctx.stroke();
    ctx.beginPath();ctx.arc(14*S,8*S,r*S,-Math.PI*1.05,-Math.PI*1.85);ctx.stroke();
  });
  for(let y=0;y<=14;y++)bk(ctx,13,y,2,1,'#778888');
  bk(ctx,11,8,6,1,'#667777');bk(ctx,10,11,8,1,'#556666');bk(ctx,9,13,10,1,'#445555');
  bk(ctx,13,0,2,1,'#aabbbb');
  px(ctx,13,0,RD);px(ctx,12,0,RD+'55');
  [[22,12,BL],[30,8,G],[38,5,AU],[47,3,PU],[56,1,BL5]].forEach(([x,y,c],i)=>{
    const a=Math.round(60+i*30).toString(16).padStart(2,'0');
    bk(ctx,x as number,y as number,10,5,'#0d0d1a');
    bk(ctx,x as number,y as number,10,1,(c as string)+a);
    bk(ctx,(x as number)+1,(y as number)+1,3,3,(c as string)+'55');
    px(ctx,(x as number)+1,(y as number)+1,c as string);px(ctx,(x as number)+2,(y as number)+1,(c as string)+'88');
    rw(ctx,(y as number)+1,[(x as number)+5,(x as number)+6,(x as number)+7,(x as number)+8],(c as string)+'66');
    rw(ctx,(y as number)+2,[(x as number)+5,(x as number)+6,(x as number)+7],(c as string)+'44');
    rw(ctx,(y as number)+3,[(x as number)+1,(x as number)+2,(x as number)+3,(x as number)+4,(x as number)+5,(x as number)+6,(x as number)+7,(x as number)+8],(c as string)+'22');
    ctx.fillStyle=(c as string)+'18';ctx.fillRect((x as number)*S,((y as number)+5)*S,10*S,S);
    ctx.fillStyle=(c as string)+'0a';ctx.fillRect((x as number)*S,((y as number)+6)*S,10*S,S);
    px(ctx,(x as number)+5,(y as number)-1,(c as string)+'66');px(ctx,(x as number)+5,(y as number)-2,(c as string)+'33');
  });
  [1,3,5,7,9,11,13].forEach(y=>{ctx.fillStyle='rgba(255,255,255,0.04)';ctx.fillRect(21*S,y*S,2*S,1);});
  bk(ctx,65,1,19,6,'#0d1a0d');bk(ctx,65,1,19,1,G+'33');
  ctx.fillStyle=G+'88';ctx.font='4px monospace';ctx.textAlign='left';ctx.fillText('TODAY',66*S,2*S+2);
  ctx.fillStyle=G;ctx.font='bold 6px monospace';ctx.fillText('$184K',66*S,5*S);
  bk(ctx,65,9,5,4,'#1a0000');
  px(ctx,65,9,RD);px(ctx,66,9,RD+'88');
  ctx.fillStyle=RD+'cc';ctx.font='bold 5px monospace';ctx.textAlign='left';ctx.fillText('LIVE',67*S,12*S);
}

// ── PROFILE ───────────────────────────────────────────────
function drawProfile(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[2,1],[10,2],[62,1],[70,2],[78,1],[83,2]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  const sm=[
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],[0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  ];
  const ox=3,oy=0;
  sm.forEach((row,y)=>row.forEach((v,x)=>{if(v)px(ctx,ox+x+1,oy+y+1,'#00000055');}));
  sm.forEach((row,y)=>row.forEach((v,x)=>{if(v){const t=y/sm.length;px(ctx,ox+x,oy+y,t<0.3?BL3:t<0.6?BL4:'#001144');}}));
  sm.forEach((row,y)=>row.forEach((v,x)=>{if(v&&x===0)px(ctx,ox+x,oy+y,BL2+'77');if(v&&x===1)px(ctx,ox+x,oy+y,BL2+'33');}));
  sm[0].forEach((v,x)=>{if(v)px(ctx,ox+x,oy,BL5+'66');});
  sm[1].forEach((v,x)=>{if(v)px(ctx,ox+x,oy+1,BL5+'33');});
  sm.forEach((row,y)=>{let f=-1,l=-1;row.forEach((v,x)=>{if(v){if(f<0)f=x;l=x;}});if(f>=0){px(ctx,ox+f,oy+y,G);px(ctx,ox+l,oy+y,G);}});
  sm[0].forEach((v,x)=>{if(v)px(ctx,ox+x,oy,G);});
  sm.forEach((row,y)=>{const c=row.filter(v=>v).length;if(c<=3)row.forEach((v,x)=>{if(v)px(ctx,ox+x,oy+y,G);});});
  const cr=[[1,0,1,0,1,0,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]];
  cr.forEach((row,y)=>row.forEach((v,x)=>{if(v)px(ctx,ox+4+x,oy+y,y===0?AU5:y===1?AU:AU2);}));
  [[ox+4,oy,RD],[ox+6,oy,BL5],[ox+8,oy,G],[ox+10,oy,PU]].forEach(([x,y,c])=>px(ctx,x as number,y as number,c as string));
  rw(ctx,oy+1,[ox+4,ox+5,ox+6,ox+7,ox+8,ox+9,ox+10],AU5+'44');
  for(let y=oy+4;y<=oy+12;y++)px(ctx,ox+7,y,G4);
  for(let x=ox+1;x<=ox+13;x++)px(ctx,x,oy+8,G4);
  for(let y=oy+4;y<=oy+7;y++)px(ctx,ox+3,y,GR);
  for(let y=oy+4;y<=oy+6;y++)px(ctx,ox+4,y,GR2);
  for(let y=oy+4;y<=oy+5;y++)px(ctx,ox+5,y,GR3);
  px(ctx,ox+3,oy+4,WH2);
  bk(ctx,ox+2,oy+7,5,1,AU);px(ctx,ox+2,oy+7,AU5);px(ctx,ox+6,oy+7,AU3);
  bk(ctx,ox+3,oy+8,2,2,AU3);bk(ctx,ox+3,oy+10,2,2,AU2);px(ctx,ox+3,oy+10,AU5);
  [[ox+9,oy+5,AU],[ox+11,oy+5,AU],[ox+10,oy+6,AU],[ox+9,oy+7,AU],[ox+11,oy+7,AU]].forEach(([x,y,c])=>{px(ctx,x as number,y as number,c as string);px(ctx,x as number,y as number,AU5);});
  px(ctx,ox+10,oy+5,AU);px(ctx,ox+10,oy+7,AU);
  sm.slice(10).forEach((row,y)=>row.forEach((v,x)=>{if(v)px(ctx,ox+x,oy+10+y,DK3);}));
  bk(ctx,ox+2,oy+11,11,5,DK3);bk(ctx,ox+2,oy+11,11,1,'#1a2a44');
  bk(ctx,ox+5,oy+11,1,5,'#0088ff22');bk(ctx,ox+9,oy+11,1,5,'#0088ff22');
  ctx.fillStyle=PU;ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText('7',(ox+3+1)*S,(oy+14)*S+2);
  ctx.fillStyle='#663388';ctx.font='4px monospace';ctx.fillText('LVL',(ox+3+1)*S,(oy+12)*S);
  ctx.fillStyle=G;ctx.font='bold 7px monospace';ctx.fillText('12',(ox+7)*S,(oy+14)*S+2);
  ctx.fillStyle=G4;ctx.font='4px monospace';ctx.fillText('DLS',(ox+7)*S,(oy+12)*S);
  ctx.fillStyle=AU;ctx.font='bold 7px monospace';ctx.fillText('4.9',(ox+11)*S,(oy+14)*S+2);
  ctx.fillStyle=AU4;ctx.font='4px monospace';ctx.fillText('RTG',(ox+11)*S,(oy+12)*S);
  ctx.fillStyle=G+'0a';
  sm.forEach((row,y)=>row.forEach((v,x)=>{if(v)ctx.fillRect((ox+x)*S,(oy+y)*S,S,S);}));
  star(ctx,26,3,G);star(ctx,30,10,AU);star(ctx,36,5,G2);star(ctx,40,13,BL);
  bk(ctx,42,1,40,14,'#0d1221');
  bk(ctx,42,1,40,1,BL3+'55');bk(ctx,42,14,40,1,BL4+'33');
  bk(ctx,42,1,1,14,BL2+'22');bk(ctx,81,1,1,14,BL4+'22');
  bk(ctx,44,3,8,8,BL4);
  [[0,1,1,0],[1,1,1,1],[1,1,1,1],[0,1,1,0]].forEach((r,y)=>r.forEach((v,x)=>{if(v)bk(ctx,45+x*2,4+y*2,2,2,BL2);}));
  px(ctx,46,5,WH2);px(ctx,47,5,WH2);
  rw(ctx,7,[46,47,48],'#cc998844');
  bk(ctx,44,3,8,1,BL);bk(ctx,44,10,8,1,BL2);
  bk(ctx,44,3,1,8,BL);bk(ctx,51,3,1,8,BL2);
  ctx.fillStyle=WH2;ctx.font='bold 5px monospace';ctx.textAlign='left';ctx.fillText('@username',54*S,5*S);
  ctx.fillStyle=G+'88';ctx.font='4px monospace';ctx.fillText('VERIFIED',54*S,7*S);
  px(ctx,54,7,G);ctx.fillStyle=G+'44';ctx.fillRect(54*S,7*S,S,S);
  [54,56,58,60,62].forEach((x,i)=>{bk(ctx,x,9,2,2,i<4?AU:GR3);if(i<4)px(ctx,x,9,AU5);});
  bk(ctx,54,11,8,3,'#0d1525');
  ctx.fillStyle=G;ctx.font='bold 5px monospace';ctx.textAlign='left';ctx.fillText('12',55*S,13*S);
  ctx.fillStyle=GR3;ctx.font='4px monospace';ctx.fillText('deals',58*S,13*S);
  ctx.fillStyle=AU;ctx.font='bold 5px monospace';ctx.fillText('4.9',55*S,15*S);
  ctx.fillStyle=GR3;ctx.font='4px monospace';ctx.fillText('rate',58*S,15*S);
  bk(ctx,65,11,15,4,'#0d1525');bk(ctx,65,11,15,1,GR3+'44');
  [65,70,75].forEach((x,i)=>{const c=[BL,G,AU][i];bk(ctx,x,12,4,3,c+'22');bk(ctx,x,12,4,1,c+'55');px(ctx,x,12,c+'88');});
}

// ── JOB BOARD ─────────────────────────────────────────────
function drawBoard(ctx:Ctx){
  ctx.fillStyle=DK;ctx.fillRect(0,0,W,H);
  [[5,1],[15,2],[28,1],[42,2],[60,1],[72,2],[80,1]].forEach(([x,y])=>px(ctx,x,y,'#ffffff33'));
  bk(ctx,0,0,84,16,'#6b3010');bk(ctx,1,1,82,14,'#8a4520');
  bk(ctx,1,1,82,1,'#9a5530');bk(ctx,1,13,82,1,'#5a2808');
  bk(ctx,1,1,1,14,'#9a5530');bk(ctx,82,1,1,14,'#5a2808');
  [3,5,7,9,11,13].forEach(y=>rw(ctx,y,[2,3,4,5,6,7,8,9,10],AU4+'33'));
  [[1,1],[82,1],[1,13],[82,13]].forEach(([x,y])=>{bk(ctx,x,y,2,2,AU2);px(ctx,x,y,AU5);px(ctx,x+1,y+1,AU3);});
  bk(ctx,2,2,18,11,'#f0e8cc');bk(ctx,2,2,18,1,'#e0d0a8');bk(ctx,2,12,18,1,'#c8b080');
  bk(ctx,2,2,1,11,'#e8d8b0');bk(ctx,19,2,1,11,'#c0a870');
  ctx.fillStyle='#55443399';ctx.fillRect(3*S,3*S,14*S,S*0.5);
  [4,6,8,10].forEach(y=>{ctx.fillStyle='#88776655';ctx.fillRect(3*S,y*S,12*S,S*0.4);});
  px(ctx,19,2,RD);
  bk(ctx,23,1,20,12,'#fffaee');bk(ctx,23,1,20,1,'#fff0cc');bk(ctx,23,12,20,1,'#d4c080');
  bk(ctx,23,1,1,12,'#fff5dd');bk(ctx,42,1,1,12,'#c0a870');
  bk(ctx,23,1,20,1,G2+'33');
  ctx.fillStyle='#33333399';ctx.fillRect(24*S,2*S,16*S,S*0.55);
  [3,5,7,9,11].forEach(y=>{ctx.fillStyle=y<6?'#44443399':'#88776655';ctx.fillRect(24*S,y*S,y<6?14*S:11*S,S*0.45);});
  bk(ctx,41,2,2,2,G3);px(ctx,41,2,G);px(ctx,42,3,G2);
  px(ctx,42,1,AU);
  bk(ctx,64,2,18,11,'#f0e8cc');bk(ctx,64,2,18,1,'#e0d0a8');bk(ctx,64,12,18,1,'#c8b080');
  bk(ctx,64,2,1,11,'#e8d8b0');bk(ctx,81,2,1,11,'#c0a870');
  ctx.fillStyle='#55443388';ctx.fillRect(65*S,3*S,13*S,S*0.5);
  [4,6,8,10].forEach(y=>{ctx.fillStyle='#88776644';ctx.fillRect(65*S,y*S,10*S,S*0.4);});
  px(ctx,81,2,RD);
  const mg=[[0,1,1,1,0],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[0,1,1,1,0]];
  mg.forEach((r,y)=>r.forEach((v,x)=>{if(v)px(ctx,45+x,8+y,AU2);}));
  bk(ctx,46,9,3,3,AU+'11');px(ctx,46,9,AU5+'44');
  px(ctx,50,13,AU3);px(ctx,51,14,AU4);px(ctx,52,15,AU4);
  bk(ctx,44,4,3,7,'#ddaa77');bk(ctx,44,4,3,1,'#eebb88');bk(ctx,44,5,1,5,'#eebb88');
  bk(ctx,46,6,1,4,'#cc9966');bk(ctx,43,7,2,3,'#ddaa77');
  px(ctx,44,4,'#ffddbb');px(ctx,45,4,'#ffddbb');
  ctx.fillStyle=AU+'44';ctx.font='4px monospace';ctx.textAlign='center';ctx.fillText('JOB BOARD',42*S,15*S+1);
}

const drawFns: Record<SceneName, (ctx: Ctx) => void> = {
  home: drawHome, new_deal: drawNewDeal, deal_room: drawRoom,
  payment: drawPayment, review: drawReview, dispute: drawDispute,
  live_deals: drawLive, profile: drawProfile, job_board: drawBoard,
};

export function PixelScene({ scene, width = 252, height = 56 }: { scene: SceneName; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    drawFns[scene](ctx);
  }, [scene]);
  return <canvas ref={ref} width={width} height={height} style={{ display:'block', margin:'0 auto 8px', imageRendering:'pixelated' }} />;
}
