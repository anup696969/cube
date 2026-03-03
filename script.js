'use strict';
/* ═══════════════════════════════════════════════════════════════════
   CubeSolve — script.js  (No-Worker / file:// Compatible Edition)

   The Kociemba lookup tables are built in small async chunks via
   setTimeout(0), so the main thread is NEVER blocked — no Web Worker
   needed, works perfectly on file://.

   Build phases (all non-blocking):
     Phase A: coMove / eoMove / udMove  (3 × 18 loops)
     Phase B: cpMove / ep8Move / udpMove (3 × 10 loops)
     Phase C: coPrun / eoPrun / phase2Prun (iterative BFS per depth)

   While tables build, UI and 3D animation run freely.
   If Solve is clicked before tables finish, it shows
   "Building tables…" and auto-solves the moment they're ready.
═══════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────
// CONSTANTS & GLOBALS
// ─────────────────────────────────────────────────────────────────
const FACES    = ['U','L','F','R','B','D'];
const DEF_CLR  = { U:'X', L:'X', F:'X', R:'X', B:'X', D:'X' };
const FACE_CLR = { U:'W', L:'O', F:'G', R:'R', B:'B', D:'Y' };
const CMAP     = { W:'#f2f2f2', Y:'#f5e642', R:'#e63946', O:'#f4852a', B:'#4361ee', G:'#2dc653', X:'#c8c8c8' };
const FACE_GAP = 5;
const CS_FOR_N = { 2:52, 3:36 };

let N = 3;
let faceData = {};
let selectedColor = 'W';

// ─────────────────────────────────────────────────────────────────
// FACE-STATE HELPERS
// ─────────────────────────────────────────────────────────────────
function initFaces() {
  faceData = {};
  FACES.forEach(f => {
    faceData[f] = Array(N * N).fill('X');
    if (N % 2 === 1) {
      const mid = Math.floor(N / 2);
      faceData[f][mid * N + mid] = FACE_CLR[f]; // center is always fixed
    }
  });
}
function copyState()     { const c = {}; FACES.forEach(f => c[f] = [...faceData[f]]); return c; }
function restoreState(s) { FACES.forEach(f => faceData[f] = [...s[f]]); }
function isSolved()      { return FACES.every(f => !faceData[f].includes('X') && faceData[f].every(c => c === faceData[f][0])); }

// ─────────────────────────────────────────────────────────────────
// MOVE ENGINE
// ─────────────────────────────────────────────────────────────────
function applyMove(mv) {
  const base  = mv.replace("'", '').replace('2', '');
  const ccw   = mv.includes("'");
  const times = mv.includes('2') ? 2 : 1;
  for (let t = 0; t < times; t++) {
    rotateFace(base, ccw);
    const strips = sideStrips(base);
    const saved  = strips.map(s => s.map(({ f, i }) => faceData[f][i]));
    if (ccw) {
      for (let k = 0; k < 4; k++) { const src = saved[(k+3)%4]; strips[k].forEach(({f,i},j) => { faceData[f][i] = src[j]; }); }
    } else {
      for (let k = 0; k < 4; k++) { const src = saved[(k+1)%4]; strips[k].forEach(({f,i},j) => { faceData[f][i] = src[j]; }); }
    }
  }
}
function sideStrips(face) {
  const n = N;
  const row = (f,r,rev=false) => Array.from({length:n},(_,c)=>({f,i:r*n+(rev?n-1-c:c)}));
  const col = (f,c,rev=false) => Array.from({length:n},(_,r)=>({f,i:(rev?n-1-r:r)*n+c}));

  switch(face) {

    case 'U':
      return [
        row('F',0),
        row('R',0),
        row('B',0),
        row('L',0)
      ];

    case 'D':
      return [
        row('R',n-1),
        row('F',n-1),
        row('L',n-1),
        row('B',n-1)
      ];

    case 'F':
      return [
        row('U',n-1),
        col('L',n-1,true),
        row('D',0,true),
        col('R',0)
      ];

    case 'B':
      return [
        row('U',0,true),
        col('R',n-1,true),
        row('D',n-1),
        col('L',0)
      ];

    case 'R':
      return [
        col('U', n-1),
        col('F', n-1),
        col('D', n-1),
        col('B', 0, true)
      ];
    case 'L':
      return [
        col('U', 0),
        col('B', n-1, true),
        col('D', 0),
        col('F', 0)
      ];
  }

  return [];
}
function rotateFace(face, ccw) {
  // U and D faces have row0=back in our grid, so grid-CW is physically CCW on the cube.
  // We must flip the rotation direction for U and D to match physical cube rotation.
  const flip = (face === 'U' || face === 'D');
  const actualCCW = flip ? !ccw : ccw;
  const a = [...faceData[face]], n = N;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      faceData[face][actualCCW ? (n-1-c)*n+r : c*n+(n-1-r)] = a[r*n+c];
}
function baseOf(m)     { return m.replace("'",'').replace('2',''); }
function invertMove(m) { if(m.includes('2')) return m; return m.includes("'") ? baseOf(m) : baseOf(m)+"'"; }
function simplify(r) {
  let ch = true;
  while (ch) {
    ch = false;
    for (let i = 0; i < r.length-1; i++) {
      const a=r[i], b=r[i+1];
      if (baseOf(a)!==baseOf(b)) continue;
      const cw =m=>!m.includes("'")&&!m.includes('2');
      const ccw=m=> m.includes("'");
      const tw =m=> m.includes('2');
      if((cw(a)&&ccw(b))||(ccw(a)&&cw(b))){ r.splice(i,2);              ch=true; break; }
      if(cw(a) &&cw(b))  { r.splice(i,2,baseOf(a)+'2');  ch=true; break; }
      if(ccw(a)&&ccw(b)) { r.splice(i,2,baseOf(a)+'2');  ch=true; break; }
      if(tw(a) &&tw(b))  { r.splice(i,2);                ch=true; break; }
      if(tw(a) &&cw(b))  { r.splice(i,2,baseOf(a)+"'"); ch=true; break; }
      if(tw(a) &&ccw(b)) { r.splice(i,2,baseOf(a));      ch=true; break; }
      if(cw(a) &&tw(b))  { r.splice(i,2,baseOf(a)+"'"); ch=true; break; }
      if(ccw(a)&&tw(b))  { r.splice(i,2,baseOf(a));      ch=true; break; }
    }
  }
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
   KOCIEMBA TWO-PHASE  —  tables built asynchronously in chunks
   so the main thread is never blocked and file:// works fine.
═══════════════════════════════════════════════════════════════════ */
const Kociemba = (() => {
  const Uf=0,Rf=9,Ff=18,Df=27,Lf=36,Bf=45;
  const COLOR_FACE={W:Uf,R:Rf,G:Ff,Y:Df,O:Lf,B:Bf};
  const cornerFacelet=[[Uf+8,Rf+0,Ff+2],[Uf+6,Ff+0,Lf+2],[Uf+0,Lf+0,Bf+2],[Uf+2,Bf+0,Rf+2],[Df+2,Ff+8,Rf+6],[Df+0,Lf+8,Ff+6],[Df+6,Bf+8,Lf+6],[Df+8,Rf+8,Bf+6]];
  const edgeFacelet  =[[Uf+5,Rf+1],[Uf+7,Ff+1],[Uf+3,Lf+1],[Uf+1,Bf+1],[Df+5,Rf+7],[Df+1,Ff+7],[Df+3,Lf+7],[Df+7,Bf+7],[Ff+5,Rf+3],[Ff+3,Lf+5],[Bf+5,Lf+3],[Bf+3,Rf+5]];
  const cornerColor  =[[Uf,Rf,Ff],[Uf,Ff,Lf],[Uf,Lf,Bf],[Uf,Bf,Rf],[Df,Ff,Rf],[Df,Lf,Ff],[Df,Bf,Lf],[Df,Rf,Bf]];
  const edgeColor    =[[Uf,Rf],[Uf,Ff],[Uf,Lf],[Uf,Bf],[Df,Rf],[Df,Ff],[Df,Lf],[Df,Bf],[Ff,Rf],[Ff,Lf],[Bf,Lf],[Bf,Rf]];

  function CC(){ this.cp=[0,1,2,3,4,5,6,7];this.co=[0,0,0,0,0,0,0,0];this.ep=[0,1,2,3,4,5,6,7,8,9,10,11];this.eo=[0,0,0,0,0,0,0,0,0,0,0,0]; }
  CC.prototype.clone=function(){ const c=new CC();c.cp=[...this.cp];c.co=[...this.co];c.ep=[...this.ep];c.eo=[...this.eo];return c; };
  function mul(a,b,d){ for(let i=0;i<8;i++){d.cp[i]=a.cp[b.cp[i]];d.co[i]=(a.co[b.cp[i]]+b.co[i])%3;} for(let i=0;i<12;i++){d.ep[i]=a.ep[b.ep[i]];d.eo[i]=(a.eo[b.ep[i]]+b.eo[i])%2;} }

  const moveDefs=[
    {cp:[3,0,1,2,4,5,6,7],co:[0,0,0,0,0,0,0,0],ep:[3,0,1,2,4,5,6,7,8,9,10,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0]},
    {cp:[4,1,2,0,7,5,6,3],co:[2,0,0,1,1,0,0,2],ep:[11,1,2,3,8,5,6,7,4,9,10,0], eo:[0,0,0,0,0,0,0,0,0,0,0,0]},
    {cp:[1,5,2,3,0,4,6,7],co:[1,2,0,0,2,1,0,0],ep:[0,9,2,3,4,8,6,7,1,5,10,11], eo:[0,1,0,0,0,1,0,0,1,1,0,0]},
    {cp:[0,1,2,3,5,6,7,4],co:[0,0,0,0,0,0,0,0],ep:[0,1,2,3,7,4,5,6,8,9,10,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0]},
    {cp:[0,2,6,3,4,1,5,7],co:[0,1,2,0,0,2,1,0],ep:[0,1,10,3,4,5,9,7,8,2,6,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0]},
    {cp:[0,1,3,7,4,5,2,6],co:[0,0,1,2,0,0,2,1],ep:[0,1,2,11,4,5,6,10,8,9,3,7], eo:[0,0,0,1,0,0,0,1,0,0,1,1]},
  ];
  const moveCubes=[];
  for(let f=0;f<6;f++){
    const m1=new CC();m1.cp=[...moveDefs[f].cp];m1.co=[...moveDefs[f].co];m1.ep=[...moveDefs[f].ep];m1.eo=[...moveDefs[f].eo];
    const m2=new CC();mul(m1,m1,m2); const m3=new CC();mul(m2,m1,m3);
    moveCubes.push(m1,m2,m3);
  }
  const MOVE_NAMES=['U','U2',"U'",'R','R2',"R'",'F','F2',"F'",'D','D2',"D'",'L','L2',"L'",'B','B2',"B'"];
  const PHASE2_MOVES=[0,1,2,9,10,11,4,13,7,16];

  function C(n,k){ if(k<0||k>n)return 0;if(k===0||k===n)return 1;if(k===1)return n;let r=1;for(let i=0;i<k;i++)r=r*(n-i)/(i+1);return Math.round(r); }
  function fact(n){ let r=1;for(let i=2;i<=n;i++)r*=i;return r; }
  function getCornerOri(c){ let v=0;for(let i=0;i<7;i++) v=v*3+c.co[i];return v; }
  function getEdgeOri(c)  { let v=0;for(let i=0;i<11;i++)v=v*2+c.eo[i];return v; }
  function getUDSlice(c)  { let cnt=0,v=0;for(let i=11;i>=0;i--){if(c.ep[i]>=8){v+=C(11-i,cnt+1);cnt++;}}return v; }
  function getCornerPerm(c) { const q=[...c.cp];           let r=0;for(let i=0;i<8;i++){r+=q[i]*fact(7-i);for(let j=i+1;j<8;j++)if(q[j]>q[i])q[j]--;}return r; }
  function getEdgePerm8(c)  { const q=[...c.ep.slice(0,8)];let r=0;for(let i=0;i<8;i++){r+=q[i]*fact(7-i);for(let j=i+1;j<8;j++)if(q[j]>q[i])q[j]--;}return r; }
  function getUDSlicePerm(c){ const sl=c.ep.filter(e=>e>=8).map(e=>e-8);let r=0;for(let i=0;i<4;i++){r+=sl[i]*fact(3-i);for(let j=i+1;j<4;j++)if(sl[j]>sl[i])sl[j]--;}return r; }
  function setCO(c,v){ let s=0;for(let i=6;i>=0;i--){c.co[i]=v%3;s+=v%3;v=Math.floor(v/3);}c.co[7]=(3-s%3)%3; }
  function setEO(c,v){ let s=0;for(let i=10;i>=0;i--){c.eo[i]=v%2;s+=v%2;v=Math.floor(v/2);}c.eo[11]=s%2; }
  function setUD(c,v){ const s=new Array(12).fill(false);let k=4,vv=v;for(let i=11;i>=0&&k>0;i--){if(C(i,k)<=vv){s[i]=true;vv-=C(i,k);k--;}}let si=8,ni=0;for(let i=0;i<12;i++)c.ep[i]=s[i]?si++:ni++; }
  function setCP(c,v){ const a=[0,1,2,3,4,5,6,7];let val=v;for(let i=7;i>=0;i--){const fi=fact(i),idx=Math.floor(val/fi);val%=fi;c.cp[7-i]=a.splice(idx,1)[0];} }
  function setEP8(c,v){ const a=[0,1,2,3,4,5,6,7];let val=v;for(let i=7;i>=0;i--){const fi=fact(i),idx=Math.floor(val/fi);val%=fi;c.ep[7-i]=a.splice(idx,1)[0];} }
  function setUDP(c,v){ const a=[8,9,10,11];let val=v;const res=[];for(let i=3;i>=0;i--){const fi=fact(i),idx=Math.floor(val/fi);val%=fi;res.push(a.splice(idx,1)[0]);}let si=0;for(let i=0;i<12;i++)if(c.ep[i]>=8)c.ep[i]=res[si++]; }

  // ── Table storage ───────────────────────────────────────────────
  let coMove,eoMove,udMove,cpMove,ep8Move,udpMove;
  let coPrun,eoPrun,phase2Prun;
  let tablesReady    = false;
  let buildInProgress= false;
  let pendingCallbacks = [];

  // ── Chunked async builder ────────────────────────────────────────
  const CHUNK = 250; // rows per setTimeout slice

  function runChunk(fn, total, onFinish) {
    let cur = 0;
    function step() {
      const end = Math.min(cur + CHUNK, total);
      for (; cur < end; cur++) fn(cur);
      if (cur >= total) { onFinish(); }
      else setTimeout(step, 0);
    }
    setTimeout(step, 0);
  }

  function buildAsync(onDone) {
    if (tablesReady) { onDone && onDone(); return; }
    if (onDone) pendingCallbacks.push(onDone);
    if (buildInProgress) return;
    buildInProgress = true;

    // Allocate
    coMove  = Array.from({length:2187},  ()=>new Int16Array(18));
    eoMove  = Array.from({length:2048},  ()=>new Int16Array(18));
    udMove  = Array.from({length:495},   ()=>new Int16Array(18));
    cpMove  = Array.from({length:40320}, ()=>new Int16Array(10));
    ep8Move = Array.from({length:40320}, ()=>new Int16Array(10));
    udpMove = Array.from({length:24},    ()=>new Int16Array(10));
    coPrun     = new Int8Array(2187*495).fill(-1);
    eoPrun     = new Int8Array(2048*495).fill(-1);
    phase2Prun = new Int8Array(40320*24).fill(-1);

    // Chain of chunked phases
    runChunk(co=>{
      const c=new CC();setCO(c,co);
      for(let m=0;m<18;m++){const t=new CC();mul(c,moveCubes[m],t);coMove[co][m]=getCornerOri(t);}
    },2187,()=>
    runChunk(eo=>{
      const c=new CC();setEO(c,eo);
      for(let m=0;m<18;m++){const t=new CC();mul(c,moveCubes[m],t);eoMove[eo][m]=getEdgeOri(t);}
    },2048,()=>
    runChunk(ud=>{
      const c=new CC();setUD(c,ud);
      for(let m=0;m<18;m++){const t=new CC();mul(c,moveCubes[m],t);udMove[ud][m]=getUDSlice(t);}
    },495,()=>
    runChunk(cp=>{
      const c=new CC();setCP(c,cp);
      for(let mi=0;mi<10;mi++){const t=new CC();mul(c,moveCubes[PHASE2_MOVES[mi]],t);cpMove[cp][mi]=getCornerPerm(t);}
    },40320,()=>
    runChunk(ep=>{
      const c=new CC();setEP8(c,ep);
      for(let mi=0;mi<10;mi++){const t=new CC();mul(c,moveCubes[PHASE2_MOVES[mi]],t);ep8Move[ep][mi]=getEdgePerm8(t);}
    },40320,()=>
    runChunk(udp=>{
      const c=new CC();setUDP(c,udp);
      for(let mi=0;mi<10;mi++){const t=new CC();mul(c,moveCubes[PHASE2_MOVES[mi]],t);udpMove[udp][mi]=getUDSlicePerm(t);}
    },24,()=>
    buildPruningAsync(()=>{
      tablesReady=true; buildInProgress=false;
      const cbs=pendingCallbacks.splice(0);
      cbs.forEach(cb=>cb());
    })))))));
  }

  function buildPruningAsync(onDone) {
    // coPrun
    coPrun[0]=0; let cnt=1,d=0;
    function stepCO(){
      if(cnt>=2187*495||d>12){buildEO();return;}
      for(let co=0;co<2187;co++) for(let ud=0;ud<495;ud++){
        if(coPrun[co*495+ud]!==d)continue;
        for(let m=0;m<18;m++){const nc=coMove[co][m],nu=udMove[ud][m];if(coPrun[nc*495+nu]===-1){coPrun[nc*495+nu]=d+1;cnt++;}}
      }
      d++; setTimeout(stepCO,0);
    }
    // eoPrun
    function buildEO(){ eoPrun[0]=0;cnt=1;d=0;stepEO(); }
    function stepEO(){
      if(cnt>=2048*495||d>12){buildP2();return;}
      for(let eo=0;eo<2048;eo++) for(let ud=0;ud<495;ud++){
        if(eoPrun[eo*495+ud]!==d)continue;
        for(let m=0;m<18;m++){const ne=eoMove[eo][m],nu=udMove[ud][m];if(eoPrun[ne*495+nu]===-1){eoPrun[ne*495+nu]=d+1;cnt++;}}
      }
      d++; setTimeout(stepEO,0);
    }
    // phase2Prun
    function buildP2(){ phase2Prun[0]=0;cnt=1;d=0;stepP2(); }
    function stepP2(){
      if(cnt>=40320*24||d>18){onDone();return;}
      for(let cp=0;cp<40320;cp++) for(let udp=0;udp<24;udp++){
        if(phase2Prun[cp*24+udp]!==d)continue;
        for(let mi=0;mi<10;mi++){const nc=cpMove[cp][mi],nu=udpMove[udp][mi];if(phase2Prun[nc*24+nu]===-1){phase2Prun[nc*24+nu]=d+1;cnt++;}}
      }
      d++; setTimeout(stepP2,0);
    }
    setTimeout(stepCO,0);
  }

  // ── Facelet parser ───────────────────────────────────────────────
  function faceletsToCubie(fd){
    const faceOrder=['U','R','F','D','L','B'];
    const flet=new Array(54);
    for(let fi=0;fi<6;fi++){const fn=faceOrder[fi],of_=fd[fn];for(let k=0;k<9;k++)flet[fi*9+k]=COLOR_FACE[of_[k]];}
    const cc=new CC();

    // U and D face values for orientation detection
    const UD = new Set([Uf, Df]);

    for(let i=0;i<8;i++){
      const c0=flet[cornerFacelet[i][0]],
            c1=flet[cornerFacelet[i][1]],
            c2=flet[cornerFacelet[i][2]];

      let found=-1;
      for(let j=0;j<8;j++){
        const [a,b,c]=cornerColor[j];
        if((a===c0&&b===c1&&c===c2)||
          (a===c1&&b===c2&&c===c0)||
          (a===c2&&b===c0&&c===c1)){
            found=j;break;
        }
      }
      if(found===-1) return null;
      cc.cp[i]=found;

      let ori=-1;
      if(UD.has(c0)) ori=0;
      else if(UD.has(c1)) ori=1;
      else if(UD.has(c2)) ori=2;
      if(ori===-1) return null;
      cc.co[i]=ori;
    }

    for(let i=0;i<12;i++){
      const c0=flet[edgeFacelet[i][0]],c1=flet[edgeFacelet[i][1]];
      let found=false;
      for(let j=0;j<12;j++){
        if(edgeColor[j][0]===c0&&edgeColor[j][1]===c1){cc.ep[i]=j;cc.eo[i]=0;found=true;break;}
        if(edgeColor[j][0]===c1&&edgeColor[j][1]===c0){cc.ep[i]=j;cc.eo[i]=1;found=true;break;}
      }
      if(!found) return null;
    }
    return cc;
  }

  // ── IDA* ────────────────────────────────────────────────────────
  function phase1(co,eo,ud,depth,max,moves){
    if(co===0&&eo===0&&ud===0)return true;
    if(depth===max)return false;
    for(let m=0;m<18;m++){
      if(moves.length>0){
        const last=moves[moves.length-1];
        if(Math.floor(m/3)===Math.floor(last/3))continue;
        if(moves.length>1){
          const prev=moves[moves.length-2];
          const opp=[[0,3],[1,4],[2,5]];
          if(opp.some(([a,b])=>(Math.floor(m/3)===a&&Math.floor(last/3)===b)||(Math.floor(m/3)===b&&Math.floor(last/3)===a))&&Math.floor(prev/3)===Math.floor(m/3))continue;
        }
      }
      const nco=coMove[co][m],neo=eoMove[eo][m],nud=udMove[ud][m];
      const h=Math.max(coPrun[nco*495+nud]||0,eoPrun[neo*495+nud]||0);
      if(h<=max-depth-1){moves.push(m);if(phase1(nco,neo,nud,depth+1,max,moves))return true;moves.pop();}
    }
    return false;
  }
  function phase2(cp,ep8,udp,depth,max,moves){
    if(cp===0&&ep8===0&&udp===0)return true;
    if(depth===max)return false;
    for(let mi=0;mi<10;mi++){
      const m=PHASE2_MOVES[mi];
      if(moves.length>0){const last=moves[moves.length-1];if(Math.floor(m/3)===Math.floor(last/3))continue;}
      const ncp=cpMove[cp][mi],nep=ep8Move[ep8][mi],nudp=udpMove[udp][mi];
      const h=phase2Prun[ncp*24+nudp]||0;
      if(h<=max-depth-1){moves.push(m);if(phase2(ncp,nep,nudp,depth+1,max,moves))return true;moves.pop();}
    }
    return false;
  }

  function solveSync(fd){
    const cc=faceletsToCubie(fd);
    if(!cc)return{error:'Could not parse cube state'};
    if(getCornerOri(cc)===0&&getEdgeOri(cc)===0&&getUDSlice(cc)===0&&getCornerPerm(cc)===0&&getEdgePerm8(cc)===0&&getUDSlicePerm(cc)===0)return{moves:[]};
    const co=getCornerOri(cc),eo=getEdgeOri(cc),ud=getUDSlice(cc);
    let p1=[],f1=false;
    for(let d=0;d<=12&&!f1;d++){const m=[];if(phase1(co,eo,ud,0,d,m)){p1=m;f1=true;}}
    if(!f1)return{error:'Phase 1 failed'};
    let cur=cc.clone();
    for(const m of p1){const t=new CC();mul(cur,moveCubes[m],t);cur=t;}
    const cp2=getCornerPerm(cur),ep2=getEdgePerm8(cur),udp2=getUDSlicePerm(cur);
    let p2=[],f2=false;
    for(let d=0;d<=18&&!f2;d++){const m=[];if(phase2(cp2,ep2,udp2,0,d,m)){p2=m;f2=true;}}
    if(!f2)return{error:'Phase 2 failed'};
    return{moves:simplify([...p1,...p2].map(i=>MOVE_NAMES[i]))};
  }

  return { buildAsync, solveSync, get ready(){ return tablesReady; } };
})();

/* ═══════════════════════════════════════════════════════════════════
   2×2 SOLVER  (IDA* — fast, no tables)
═══════════════════════════════════════════════════════════════════ */
function solve2x2(startState) {
  const MOVES_2=['U',"U'","U2",'R',"R'",'R2','F',"F'",'F2'];
  const saved=copyState();
  function applyTo(st,mv){ restoreState(st);applyMove(mv);const n=copyState();restoreState(saved);return n; }
  function isDone(s){ return FACES.every(f=>{const a=s[f];return a.every(c=>c===a[0]);}); }
  function h(s){ let bad=0;FACES.forEach(f=>{if(!s[f].every(c=>c===s[f][0]))bad++;});return Math.ceil(bad/3); }
  function dfs(st,depth,maxD,moves,lastBase){
    if(isDone(st))return[...moves];
    if(depth>=maxD||h(st)>maxD-depth)return null;
    for(const mv of MOVES_2){
      const base=mv.replace("'","").replace("2","");
      if(base===lastBase)continue;
      const ns=applyTo(st,mv);moves.push(mv);
      const res=dfs(ns,depth+1,maxD,moves,base);
      if(res)return res;
      moves.pop();
    }
    return null;
  }
  for(let d=0;d<=11;d++){ const res=dfs(startState,0,d,[],''); if(res){restoreState(saved);return simplify(res);} }
  restoreState(saved);
  return biBFS(startState,300000);
}

/* ═══════════════════════════════════════════════════════════════════
   BIDIRECTIONAL BFS  (3×3 fallback)
═══════════════════════════════════════════════════════════════════ */
const BFS_MOVES=['U','D','R','L','F','B'].flatMap(b=>['',  "'", '2'].map(s=>b+s));
function stateKey(s){ const M={W:'0',Y:'1',R:'2',O:'3',B:'4',G:'5',X:'6'}; return FACES.map(f=>s[f].map(c=>M[c]||'6').join('')).join(''); }
function applyMoveTo(st,mv){ const sv=copyState();restoreState(st);applyMove(mv);const n=copyState();restoreState(sv);return n; }
function biBFS(start,maxNodes=200000){
  const sv=copyState();initFaces();const goal=copyState();restoreState(sv);
  const sk=stateKey(start),gk=stateKey(goal);
  if(sk===gk)return[];
  const fMap=new Map([[sk,[]]]),bMap=new Map([[gk,[]]]);
  let fFront=[{state:start,moves:[]}],bFront=[{state:goal,moves:[]}];
  for(let d=0;d<14;d++){
    const isFwd=fFront.length<=bFront.length;
    const[front,myMap,otherMap]=isFwd?[fFront,fMap,bMap]:[bFront,bMap,fMap];
    const next=[];
    for(const{state:st,moves}of front){
      for(const mv of BFS_MOVES){
        const ns=applyMoveTo(st,mv),nk=stateKey(ns);
        if(myMap.has(nk))continue;
        const nm=[...moves,mv];myMap.set(nk,nm);
        if(otherMap.has(nk)){
          const other=otherMap.get(nk);
          const fM=isFwd?nm:other.map(m=>invertMove(m)).reverse();
          const bM=isFwd?other:nm;
          restoreState(sv);
          return simplify([...fM,...bM.map(m=>invertMove(m)).reverse()]);
        }
        next.push({state:ns,moves:nm});
      }
    }
    if(isFwd)fFront=next;else bFront=next;
    if(fMap.size+bMap.size>maxNodes)break;
  }
  restoreState(sv);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   FACE GRID BUILDER
═══════════════════════════════════════════════════════════════════ */
function buildFaceGrids(){
  const cs=CS_FOR_N[N];
  const faceW=5*2+N*cs+(N-1)*3;
  FACES.forEach(f=>{
    const el=document.getElementById('face-'+f);
    el.style.setProperty('--n',N);
    el.style.setProperty('--cs',cs+'px');
    el.innerHTML='';
    for(let i=0;i<N*N;i++){
      const div=document.createElement('div');
      const isX=faceData[f][i]==='X';
      div.className='cubie'+(isCenter(i)?' center-cell':'')+(isX?' unpainted':'');
      if(!isX) div.style.background=CMAP[faceData[f][i]];
      div.addEventListener('click',()=>{
        if(isCenter(i))return;
        faceData[f][i]=selectedColor;
        div.style.background=CMAP[selectedColor];
        div.classList.remove('unpainted');
        rebuild3DCube();
      });
      el.appendChild(div);
    }
  });
  document.getElementById('topRow').style.marginLeft=(faceW+FACE_GAP)+'px';
  document.getElementById('botRow').style.marginLeft=(faceW+FACE_GAP)+'px';
}
function isCenter(i){ if(N%2===0)return false;const mid=Math.floor(N/2);return Math.floor(i/N)===mid&&i%N===mid; }
function refreshFaceColors(){ FACES.forEach(f=>{ document.getElementById('face-'+f).querySelectorAll('.cubie').forEach((el,i)=>{ 
  const isX=faceData[f][i]==='X';
  el.classList.toggle('unpainted',isX);
  el.style.background=isX?'':CMAP[faceData[f][i]]||'#ccc';
}); }); }

function highlightUnpaintedCells(){
  FACES.forEach(f=>{
    document.getElementById('face-'+f).querySelectorAll('.cubie').forEach((el,i)=>{
      if(faceData[f][i]==='X'){
        el.style.outline='2.5px solid #e63946';
        el.style.outlineOffset='-2px';
        el.style.animation='pulse-red 0.6s ease-in-out 3';
        setTimeout(()=>{el.style.outline='';el.style.outlineOffset='';el.style.animation='';},2000);
      }
    });
  });
}

function highlightInvalidCells(){
  // Count how many of each color
  const cc={};
  FACES.forEach(f=>faceData[f].forEach(c=>{cc[c]=(cc[c]||0)+1;}));
  const expected=N*N;
  // Find which colors are over-represented (likely default unpainted)
  const overColors=new Set(Object.entries(cc).filter(([,n])=>n>expected).map(([c])=>c));
  // Flash cells that have over-represented colors with a red outline
  FACES.forEach(f=>{
    document.getElementById('face-'+f).querySelectorAll('.cubie').forEach((el,i)=>{
      if(overColors.has(faceData[f][i])){
        el.style.outline='2.5px solid #e63946';
        el.style.outlineOffset='-2px';
        setTimeout(()=>{el.style.outline='';el.style.outlineOffset='';},2500);
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   SIZE NAV
═══════════════════════════════════════════════════════════════════ */
let _selectSize;
function initSizeNav(){
  const btns=document.querySelectorAll('.size-tab');
  function selectSize(n){ N=n;btns.forEach(b=>b.classList.toggle('active',parseInt(b.dataset.n)===n));stopAnim();initFaces();buildFaceGrids();rebuild3DCube();clearSolution(); }
  btns.forEach(b=>b.addEventListener('click',()=>selectSize(parseInt(b.dataset.n))));
  _selectSize=selectSize;
}
function clearSolution(){
  currentSolution=[];animStep=0;
  document.getElementById('solutionBox').innerHTML='<span class="muted">Paint your cube and press ⚡ Solve.</span>';
  document.getElementById('statusLine').innerHTML='';
  document.getElementById('stepCounter').textContent='';
  setProgress(0);
  ['playBtn','stepFwdBtn','pauseBtn','rewBtn'].forEach(id=>document.getElementById(id).disabled=true);
}

/* ═══════════════════════════════════════════════════════════════════
   SOLVE  — async, never blocks, works on file://
═══════════════════════════════════════════════════════════════════ */
let currentSolution=[],animStep=0,savedBeforeAnim=null;
let animPlaying=false,animTimer=null;
let _pendingSolveState=null;

function solveCube(){
  stopAnim();
  const saved=copyState();

  // Validate: no unpainted (X) cells remain
  const unpaintedCount = FACES.reduce((a,f) => a + faceData[f].filter(c=>c==='X').length, 0);
  if(unpaintedCount > 0){
    setStatus('err', `${unpaintedCount} sticker${unpaintedCount>1?'s are':' is'} still unpainted — paint every cell first.`);
    highlightUnpaintedCells(); return;
  }
  // Validate color counts — each of the 6 colors must appear exactly N*N times
  const cc={};
  FACES.forEach(f=>faceData[f].forEach(c=>{cc[c]=(cc[c]||0)+1;}));
  const expected=N*N;
  const colorEntries=Object.entries(cc);
  if(colorEntries.length!==6){
    setStatus('err',`Need exactly 6 colors — found ${colorEntries.length}. Make sure every cell is painted.`);
    highlightInvalidCells();return;
  }
  for(const[c,n]of colorEntries){
    if(n!==expected){
      setStatus('err',`${c} appears ${n}× but needs ${expected}. Check all faces are fully painted.`);
      highlightInvalidCells();return;
    }
  }
  // Validate centers match expected face colors (3×3 only)
  if(N%2===1){
    const mid=Math.floor(N/2), ci=mid*N+mid;
    for(const f of FACES){
      if(faceData[f][ci]!==FACE_CLR[f]){
        setStatus('err',`The ${f}-face center must stay ${FACE_CLR[f]}. Centers are fixed reference points.`);return;
      }
    }
  }
  if(isSolved()){showSolution([],saved);setStatus('ok','Already solved! 🎉');return;}

  _pendingSolveState=saved;
  document.getElementById('solveBtn').disabled=true;

  if(N===2){
    // 2×2 is fast — yield once so status renders, then solve
    setStatus('inf','⏳ Computing solution…');
    setTimeout(()=>{
      let sol=null;
      try{ sol=solve2x2(saved); }catch(e){ console.warn(e); }
      handleSolverResult(sol);
    },20);
    return;
  }

  // 3×3: build tables async if needed, then solve
  if(!Kociemba.ready){
    setStatus('inf','⏳ Building solver tables (first run only)…');
    Kociemba.buildAsync(()=>{
      // Tables just finished — now run the actual solve
      setStatus('inf','⏳ Computing solution…');
      setTimeout(()=>runKociemba(saved),4);
    });
  } else {
    setStatus('inf','⏳ Computing solution…');
    // Yield one tick so the status text paints before the solve runs
    setTimeout(()=>runKociemba(saved),4);
  }
}

function runKociemba(saved){
  let sol=null;
  try{
    const result=Kociemba.solveSync(saved);
    if(result&&result.moves) sol=result.moves;
  }catch(e){ console.warn('Kociemba failed, trying BFS:',e); }
  if(!sol){ try{ sol=biBFS(saved,400000); }catch(e){ console.warn(e); } }
  handleSolverResult(sol);
}

function handleSolverResult(sol){
  document.getElementById('solveBtn').disabled=false;
  if(sol===null||sol===undefined){
    const diag=diagnoseCubeState(_pendingSolveState||copyState());
    setStatus('err', diag || 'Could not solve. Please verify your input.');
  } else {
    showSolution(sol,_pendingSolveState);
    if(sol.length===0) setStatus('ok','Already solved! 🎉');
    else setStatus('ok',`✓ Solved in ${sol.length} moves`);
  }
  _pendingSolveState=null;
}

function diagnoseCubeState(fd){
  const cc={};
  FACES.forEach(f=>fd[f].forEach(c=>{cc[c]=(cc[c]||0)+1;}));
  const expected=N*N;
  for(const[c,n] of Object.entries(cc)){
    if(n!==expected) return `Color count error: ${c} appears ${n}× (need ${expected}).`;
  }
  const cols=Object.keys(cc);
  if(cols.length!==6) return `Need exactly 6 colors, found ${cols.length}.`;
  if(N%2===1){
    const mid=Math.floor(N/2);
    const centerIdx=mid*N+mid;
    for(const f of FACES){
      if(fd[f][centerIdx]!==FACE_CLR[f])
        return `Center of ${f} face must be ${FACE_CLR[f]} (got ${fd[f][centerIdx]}). Centers are fixed.`;
    }
  }
  return 'Cube state is physically impossible (bad corner/edge permutation). Please re-check all stickers carefully.';
}

function showSolution(moves,savedState){
  currentSolution=[...moves]; animStep=0;
  // Deep-copy savedState as the "rewind" checkpoint
  savedBeforeAnim=savedState?Object.fromEntries(FACES.map(f=>[f,[...savedState[f]]])):copyState();
  restoreState(savedBeforeAnim);
  rebuild3DCube();
  const box=document.getElementById('solutionBox');
  if(!moves.length){
    box.innerHTML='No moves needed — already solved!';
    document.getElementById('stepCounter').textContent='';
    setProgress(100);
  } else {
    box.innerHTML=moves.map((m,i)=>`<span class="move-chip" data-i="${i}">${m}</span>`).join('');
    document.querySelectorAll('.move-chip').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('chip-done')));
    document.getElementById('stepCounter').textContent=`${moves.length} moves — press ▶ Play or ⏭ Step`;
    setProgress(0);
  }
  const has=moves.length>0;
  ['playBtn','stepFwdBtn','rewBtn'].forEach(id=>document.getElementById(id).disabled=!has);
  document.getElementById('pauseBtn').disabled=true;
}

function setStatus(t,html){ document.getElementById('statusLine').innerHTML=`<div class="status ${t}">${html}</div>`; }
function setProgress(p){ document.getElementById('progressBar').style.width=p+'%'; }
function highlightChip(i){
  document.querySelectorAll('.move-chip').forEach((c,j)=>{
    c.classList.remove('chip-active','chip-done');
    if(j<i)c.classList.add('chip-done');
    if(j===i)c.classList.add('chip-active');
  });
  setProgress(Math.round((i+1)/currentSolution.length*100));
}

/* ═══════════════════════════════════════════════════════════════════
   THREE.JS 3D ENGINE
═══════════════════════════════════════════════════════════════════ */
let scene,camera,renderer,cubeGroup,cubies=[];
let camTheta=0,camPhi=0.38;
let isDragging=false,prevMouse={x:0,y:0};
let activeAnim=null,animQueue=[];
const CGAP=1.05;

function camDist(){ return N*2.6+2; }

function initThree(){
  const canvas=document.getElementById('threeCanvas');
  const wrap=canvas.parentElement;
  const W=wrap.clientWidth||600,H=wrap.clientHeight||320;

  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(W,H);

  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(38,W/H,0.1,100);
  updateCam();

  scene.add(new THREE.AmbientLight(0xffffff,0.65));
  const dl=new THREE.DirectionalLight(0xffffff,0.9);dl.position.set(5,8,6);scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,0.3);dl2.position.set(-4,-3,-5);scene.add(dl2);

  cubeGroup=new THREE.Group();scene.add(cubeGroup);

  canvas.addEventListener('mousedown',e=>{isDragging=true;prevMouse={x:e.clientX,y:e.clientY};e.preventDefault();});
  window.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    camTheta-=(e.clientX-prevMouse.x)*0.012;
    camPhi  +=(e.clientY-prevMouse.y)*0.012;
    camPhi=Math.max(-1.35,Math.min(1.35,camPhi));
    prevMouse={x:e.clientX,y:e.clientY};updateCam();
  });
  window.addEventListener('mouseup',()=>isDragging=false);
  window.addEventListener('mouseleave',()=>isDragging=false);
  canvas.addEventListener('touchstart',e=>{isDragging=true;prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault();},{passive:false});
  window.addEventListener('touchmove',e=>{
    if(!isDragging)return;
    camTheta-=(e.touches[0].clientX-prevMouse.x)*0.012;
    camPhi  +=(e.touches[0].clientY-prevMouse.y)*0.012;
    camPhi=Math.max(-1.35,Math.min(1.35,camPhi));
    prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};updateCam();
  },{passive:true});
  window.addEventListener('touchend',()=>isDragging=false);

  if(typeof ResizeObserver!=='undefined'){
    new ResizeObserver(()=>{ const nW=wrap.clientWidth||600,nH=wrap.clientHeight||320; camera.aspect=nW/nH;camera.updateProjectionMatrix();renderer.setSize(nW,nH); }).observe(wrap);
  } else {
    window.addEventListener('resize',()=>{ const nW=wrap.clientWidth||600,nH=wrap.clientHeight||320; camera.aspect=nW/nH;camera.updateProjectionMatrix();renderer.setSize(nW,nH); });
  }

  (function loop(){ requestAnimationFrame(loop);tickAnim();renderer.render(scene,camera); })();
}

/* ── Materials (per-cubie, no sharing) ─────────────────────────── */
const innerColor=new THREE.Color(0x111111);
const innerMat  =()=>new THREE.MeshPhongMaterial({color:innerColor.clone(),shininess:5});
function stickerMat(hex){ return new THREE.MeshPhongMaterial({color:new THREE.Color(hex),shininess:90}); }

/* ── Sticker lookup ─────────────────────────────────────────────── */
function stickerColor(face, ix, iy, iz) {

  const last = N - 1;
  let row, col;

  switch (face) {

    case 'U': // Up — row 0 of grid = back edge (iz=0), row last = front edge
      row = iz;
      col = ix;
      break;

    case 'D': // Down — row 0 of grid = front edge (iz=last), row last = back
      row = last - iz;
      col = ix;
      break;

    case 'F': // Front
      row = last - iy;
      col = ix;
      break;

    case 'B': // Back
      row = last - iy;
      col = last - ix;
      break;

    case 'R': // Right
      row = last - iy;
      col = last - iz;
      break;

    case 'L': // Left
      row = last - iy;
      col = iz;
      break;

    default:
      return '#3a3a3a';
  }

  const clr = faceData[face]?.[row * N + col];
  return clr === 'X' ? '#3a3a3a' : CMAP[clr] || '#3a3a3a';
}
/* ── Build / refresh 3D cube ────────────────────────────────────── */
function rebuild3DCube(){
  if(!cubeGroup)return;
  cubies.forEach(m=>{ m.geometry.dispose();if(Array.isArray(m.material))m.material.forEach(mat=>mat.dispose()); });
  cubeGroup.clear();cubies=[];animQueue=[];activeAnim=null;
  const half=(N-1)/2;
  for(let x=0;x<N;x++) for(let y=0;y<N;y++) for(let z=0;z<N;z++){
    const geo=new THREE.BoxGeometry(0.93,0.93,0.93);
    const mats=[
      x===N-1?stickerMat(stickerColor('R',x,y,z)):innerMat(),
      x===0  ?stickerMat(stickerColor('L',x,y,z)):innerMat(),
      y===N-1?stickerMat(stickerColor('U',x,y,z)):innerMat(),
      y===0  ?stickerMat(stickerColor('D',x,y,z)):innerMat(),
      z===N-1?stickerMat(stickerColor('F',x,y,z)):innerMat(),
      z===0  ?stickerMat(stickerColor('B',x,y,z)):innerMat(),
    ];
    const mesh=new THREE.Mesh(geo,mats);
    mesh.position.set((x-half)*CGAP,(y-half)*CGAP,(z-half)*CGAP);
    mesh.userData={ix:x,iy:y,iz:z};
    cubeGroup.add(mesh);cubies.push(mesh);
  }
}
function refreshCubies3D() {

  const last = N - 1;

  cubies.forEach(mesh => {

    const { ix, iy, iz } = mesh.userData;
    const mats = mesh.material;

    // Right
    if (ix === last)
      mats[0].color.set(stickerColor('R', ix, iy, iz));
    else
      mats[0].color.copy(innerColor);

    // Left
    if (ix === 0)
      mats[1].color.set(stickerColor('L', ix, iy, iz));
    else
      mats[1].color.copy(innerColor);

    // Up
    if (iy === last)
      mats[2].color.set(stickerColor('U', ix, iy, iz));
    else
      mats[2].color.copy(innerColor);

    // Down
    if (iy === 0)
      mats[3].color.set(stickerColor('D', ix, iy, iz));
    else
      mats[3].color.copy(innerColor);

    // Front
    if (iz === last)
      mats[4].color.set(stickerColor('F', ix, iy, iz));
    else
      mats[4].color.copy(innerColor);

    // Back
    if (iz === 0)
      mats[5].color.set(stickerColor('B', ix, iy, iz));
    else
      mats[5].color.copy(innerColor);

  });
}
function updateCam(){
  if(!camera)return;
  const d=camDist();
  camera.position.set(d*Math.sin(camTheta)*Math.cos(camPhi),d*Math.sin(camPhi),d*Math.cos(camTheta)*Math.cos(camPhi));
  camera.lookAt(0,0,0);
}

/* ── Move → axis ────────────────────────────────────────────────── */
function getMoveDef(base){
  const outer=(N-1)/2*CGAP,EPS=CGAP*0.45;
  return{
    U:{axis:'y',cwSign:-1,filt:c=>c.position.y> outer-EPS},
    D:{axis:'y',cwSign: 1,filt:c=>c.position.y<-outer+EPS},
    F:{axis:'z',cwSign:-1,filt:c=>c.position.z> outer-EPS},
    B:{axis:'z',cwSign: 1,filt:c=>c.position.z<-outer+EPS},
    R:{axis:'x',cwSign:-1,filt:c=>c.position.x> outer-EPS},
    L:{axis:'x',cwSign: 1,filt:c=>c.position.x<-outer+EPS},
  }[base];
}
function easeInOut(t){ return t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1; }

/* ── Animation tick ─────────────────────────────────────────────── */
function tickAnim(){
  if(activeAnim){
    const{grp,axis,target,duration,startTime,cb,move}=activeAnim;
    const t=Math.min(1,(performance.now()-startTime)/duration);
    grp.rotation[axis]=target*easeInOut(t);
    if(t>=1){grp.rotation[axis]=target;activeAnim=null;finishAnim(grp,cb,move);}
    return;
  }
  if(animQueue.length){const nxt=animQueue.shift();startAnim(nxt.move,nxt.cb);}
}

function startAnim(move,cb){
  const base=baseOf(move),def=getMoveDef(base);
  if(!def){cb&&cb();return;}
  const isCCW=move.includes("'"),is2=move.includes('2');
  const target=def.cwSign*(isCCW?-1:1)*(Math.PI/2)*(is2?2:1);
  const moving=cubies.filter(def.filt);
  const grp=new THREE.Group();cubeGroup.add(grp);
  moving.forEach(c=>{cubeGroup.remove(c);grp.add(c);});
  const sv=parseInt(document.getElementById('speedRange').value)||5;
  const duration=Math.max(80,500-(sv-1)*45);
  activeAnim={grp,axis:def.axis,target,duration,startTime:performance.now(),cb,move};
}

/* ── Finish animation — world-matrix decomposition ─────────────── */
const _tmpPos=new THREE.Vector3(),_tmpQuat=new THREE.Quaternion(),_tmpSca=new THREE.Vector3(),_tmpMat=new THREE.Matrix4();
function finishAnim(grp, cb, move) {

  const half = (N - 1) / 2;

  grp.updateMatrixWorld(true);

  const children = [...grp.children];

  children.forEach(cubie => {

    // Get world matrix BEFORE detach
    cubie.updateMatrixWorld(true);

    const worldMatrix = cubie.matrixWorld.clone();

    // Attach back to cubeGroup
    cubeGroup.attach(cubie);

    // Convert world matrix → cubeGroup local space
    const localMatrix = new THREE.Matrix4()
      .copy(cubeGroup.matrixWorld).invert()
      .multiply(worldMatrix);

    localMatrix.decompose(
      cubie.position,
      cubie.quaternion,
      cubie.scale
    );

    // Snap in LOCAL space
    cubie.position.set(
      Math.round(cubie.position.x / CGAP) * CGAP,
      Math.round(cubie.position.y / CGAP) * CGAP,
      Math.round(cubie.position.z / CGAP) * CGAP
    );

    // Update logical coordinates
    cubie.userData.ix = Math.round(cubie.position.x / CGAP + half);
    cubie.userData.iy = Math.round(cubie.position.y / CGAP + half);
    cubie.userData.iz = Math.round(cubie.position.z / CGAP + half);
  });

  cubeGroup.remove(grp);

  if (move) {
    applyMove(move);
    rebuild3DCube();
  }

  if (cb) cb();
}
function enqueueAnim(move,cb){ animQueue.push({move,cb}); }

/* ── Playback ───────────────────────────────────────────────────── */
function stopAnim(){
  animPlaying=false;
  if(animTimer){clearTimeout(animTimer);animTimer=null;}
  animQueue=[];activeAnim=null;
  // Flatten any mid-animation groups back into cubeGroup cleanly
  if(cubeGroup){
    const rem=[];
    cubeGroup.children.forEach(c=>{if(c.isGroup)rem.push(c);});
    rem.forEach(g=>{
      g.updateMatrixWorld(true);
      [...g.children].forEach(cubie=>{
        cubie.updateMatrixWorld(true);
        const wm=cubie.matrixWorld.clone();
        cubeGroup.attach(cubie);
        const lm=new THREE.Matrix4().copy(cubeGroup.matrixWorld).invert().multiply(wm);
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
        lm.decompose(p,q,s);
        const half=(N-1)/2;
        cubie.position.set(
          Math.round(p.x/CGAP)*CGAP,
          Math.round(p.y/CGAP)*CGAP,
          Math.round(p.z/CGAP)*CGAP
        );
        cubie.userData.ix=Math.round(cubie.position.x/CGAP+half);
        cubie.userData.iy=Math.round(cubie.position.y/CGAP+half);
        cubie.userData.iz=Math.round(cubie.position.z/CGAP+half);
      });
      cubeGroup.remove(g);
    });
  }
}
function playAnimation(){
  if(!currentSolution.length)return;
  // Full restart: reset cube state and step counter
  stopAnim();
  if(savedBeforeAnim){restoreState(savedBeforeAnim);rebuild3DCube();animStep=0;}
  enqueueRemainingMoves();
}
function enqueueRemainingMoves(){
  animPlaying=true;
  setMoveControlsEnabled(false);
  document.getElementById('pauseBtn').disabled=false;
  document.getElementById('playBtn').disabled=true;
  // Enqueue moves from current animStep onwards
  for(let idx=animStep;idx<currentSolution.length;idx++){
    const capturedIdx=idx;
    animQueue.push({move:currentSolution[capturedIdx], cb:()=>{
      animStep=capturedIdx+1;
      highlightChip(capturedIdx);
      setProgress(Math.round(animStep/currentSolution.length*100));
      document.getElementById('stepCounter').textContent=`Move ${animStep} / ${currentSolution.length}`;
      if(animStep>=currentSolution.length){
        animPlaying=false;
        setMoveControlsEnabled(true);
        document.getElementById('pauseBtn').disabled=true;
        document.getElementById('playBtn').disabled=false;
        document.getElementById('stepCounter').textContent='Complete! ✓';
        setProgress(100);
      }
    }});
  }
}
function playNext(){ /* legacy stub */ }
function stepForward(){
  if(animStep>=currentSolution.length)return;
  highlightChip(animStep);
  enqueueAnim(currentSolution[animStep],()=>{
    animStep++;
    setProgress(Math.round(animStep/currentSolution.length*100));
    document.getElementById('stepCounter').textContent=`Move ${animStep} / ${currentSolution.length}`;
  });
}
function rewind(){
  stopAnim();
  setMoveControlsEnabled(true);
  if(savedBeforeAnim){
    restoreState(savedBeforeAnim);rebuild3DCube();animStep=0;
    document.querySelectorAll('.move-chip').forEach(c=>c.classList.remove('chip-active','chip-done'));
    setProgress(0);
    document.getElementById('stepCounter').textContent=`${currentSolution.length} moves — press ▶ Play or ⏭ Step`;
    document.getElementById('playBtn').disabled=false;
    document.getElementById('stepFwdBtn').disabled=false;
    document.getElementById('pauseBtn').disabled=true;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   MOVE CONTROLS  — clickable buttons that animate the 3D cube
═══════════════════════════════════════════════════════════════════ */
const MOVE_ROWS = [
  { label: 'U', moves: ['U', "U'", 'U2'] },
  { label: 'D', moves: ['D', "D'", 'D2'] },
  { label: 'F', moves: ['F', "F'", 'F2'] },
  { label: 'B', moves: ['B', "B'", 'B2'] },
  { label: 'R', moves: ['R', "R'", 'R2'] },
  { label: 'L', moves: ['L', "L'", 'L2'] },
];

function buildMoveControls() {
  const grid = document.getElementById('moveControlsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  MOVE_ROWS.forEach(({ label, moves }) => {
    const row = document.createElement('div');
    row.className = 'move-row';
    const lbl = document.createElement('span');
    lbl.className = 'move-row-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    moves.forEach(mv => {
      const btn = document.createElement('button');
      btn.className = 'move-btn' +
        (mv.includes("'") ? ' move-btn-prime' :
         mv.includes('2')  ? ' move-btn-double' : '');
      btn.textContent = mv;
      btn.title = mv.includes("'") ? `${label} counter-clockwise` :
                  mv.includes('2')  ? `${label} 180°` :
                  `${label} clockwise`;
      btn.addEventListener('click', () => triggerManualMove(mv));
      row.appendChild(btn);
    });
    grid.appendChild(row);
  });
}

function setMoveControlsEnabled(enabled) {
  document.querySelectorAll('.move-btn').forEach(b => b.disabled = !enabled);
}

function triggerManualMove(mv) {
  // Don't allow during solution playback
  if (animPlaying) return;
  setMoveControlsEnabled(false);
  // Clear any previous solve status — the cube state has changed
  document.getElementById('statusLine').innerHTML = '';
  // Push to animQueue — finishAnim will call applyMove(mv) + rebuild3DCube() internally,
  // then our cb runs to resync the 2D face grid.
  animQueue.push({ move: mv, cb: () => {
    // Rebuild the 2D face grid DOM so it reflects the new faceData
    buildFaceGrids();
    setMoveControlsEnabled(true);
  }});
}

document.getElementById('solveBtn') .addEventListener('click',solveCube);
document.getElementById('resetBtn') .addEventListener('click',()=>{ stopAnim();initFaces();buildFaceGrids();rebuild3DCube();clearSolution();document.getElementById('statusLine').innerHTML=''; });
document.getElementById('playBtn')  .addEventListener('click',()=>{
  if(animStep>0 && animStep<currentSolution.length && !animPlaying){
    // Resume from where we paused
    enqueueRemainingMoves();
  } else {
    // Fresh start
    playAnimation();
  }
});
document.getElementById('pauseBtn') .addEventListener('click',()=>{
  // Just flag as paused — don't clear queue or active anim
  // tickAnim checks animPlaying before starting next queued move
  animPlaying=false;
  animQueue=[];  // drain remaining queued moves (current move finishes naturally)
  setMoveControlsEnabled(true);
  document.getElementById('pauseBtn').disabled=true;
  document.getElementById('playBtn').disabled=false;
});
document.getElementById('stepFwdBtn').addEventListener('click',stepForward);
document.getElementById('rewBtn')   .addEventListener('click',rewind);
document.getElementById('rotL')     .addEventListener('click',()=>{camTheta+=0.45;updateCam();});
document.getElementById('rotR')     .addEventListener('click',()=>{camTheta-=0.45;updateCam();});
document.getElementById('rotU')     .addEventListener('click',()=>{camPhi=Math.min(1.35,camPhi+0.32);updateCam();});
document.getElementById('rotD')     .addEventListener('click',()=>{camPhi=Math.max(-1.35,camPhi-0.32);updateCam();});
document.getElementById('rotReset') .addEventListener('click',()=>{camTheta=0;camPhi=0.38;updateCam();});
document.getElementById('themeToggle').addEventListener('click',()=>{
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem('cubesolve-theme', next);
});
document.querySelectorAll('.color-swatch').forEach(sw=>{
  sw.addEventListener('click',()=>{
    document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active');selectedColor=sw.dataset.color;
  });
});

/* ═══════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════ */
// Restore saved theme
(function(){ const t=localStorage.getItem('cubesolve-theme'); if(t) document.body.dataset.theme=t; })();

initThree();
initSizeNav();
_selectSize(3);
buildMoveControls();
// Start building Kociemba tables silently in background.
// By the time the user paints their cube (typically 30-60s), they'll be ready.
Kociemba.buildAsync(()=>{ console.log('Kociemba tables ready ✓'); });
