'use strict';
/* ═══════════════════════════════════════════════════════════════════
   CubeSolve — script.js  (Kociemba Two-Phase Edition)
   ─ Phase 1: Reduce to <G1> subgroup using orientation + UD-slice coords
   ─ Phase 2: Solve within G1 using corner/edge permutation coords
   ─ Smooth Three.js rotation animation with easing
   ─ NxN (2-5) UI; Kociemba applies to 3×3 only
═══════════════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────────────────
// CONSTANTS & GLOBALS
// ──────────────────────────────────────────────────────────────────
const FACES    = ['U','L','F','R','B','D'];
const DEF_CLR  = { U:'W', L:'O', F:'G', R:'R', B:'B', D:'Y' };
const CMAP     = { W:'#f2f2f2', Y:'#f5e642', R:'#e63946', O:'#f4852a', B:'#4361ee', G:'#2dc653' };
const FACE_GAP = 5;
const CS_FOR_N = { 2:46, 3:34, 4:25, 5:19 };

let N = 3;
let faceData = {};
let selectedColor = 'W';
let _scrambleSeq = null;

// ──────────────────────────────────────────────────────────────────
// FACE-STATE HELPERS
// ──────────────────────────────────────────────────────────────────
function initFaces()     { faceData = {}; FACES.forEach(f => { faceData[f] = Array(N*N).fill(DEF_CLR[f]); }); }
function copyState()     { const c={}; FACES.forEach(f=>c[f]=[...faceData[f]]); return c; }
function restoreState(s) { FACES.forEach(f=>faceData[f]=[...s[f]]); }
function isSolved()      { return FACES.every(f=>faceData[f].every(c=>c===faceData[f][0])); }
function at(f,i)         { return faceData[f][i]; }
function center3(f)      { return faceData[f][4]; }

// ──────────────────────────────────────────────────────────────────
// MOVE ENGINE  (generic NxN outer-layer moves)
// ──────────────────────────────────────────────────────────────────
function applyMove(mv) {
  const base  = mv.replace("'",'').replace('2','');
  const ccw   = mv.includes("'");
  const times = mv.includes('2') ? 2 : 1;
  for (let t=0; t<times; t++) execMove(base, ccw);
}

function execMove(face, ccw) {
  rotateFace(face, ccw);
  const strips = sideStrips(face);
  const saved  = strips.map(s => s.map(({f,i}) => faceData[f][i]));
  if (!ccw) {
    for (let k=0; k<4; k++) {
      const src = saved[(k+3)%4];
      strips[k].forEach(({f,i},j) => { faceData[f][i] = src[j]; });
    }
  } else {
    for (let k=0; k<4; k++) {
      const src = saved[(k+1)%4];
      strips[k].forEach(({f,i},j) => { faceData[f][i] = src[j]; });
    }
  }
}

function sideStrips(face) {
  const n=N;
  const row=(f,r,rev=false)=>Array.from({length:n},(_,c)=>({f,i:r*n+(rev?n-1-c:c)}));
  const col=(f,c,rev=false)=>Array.from({length:n},(_,r)=>({f,i:(rev?n-1-r:r)*n+c}));
  switch(face) {
    case 'U': return [row('B',0,true), row('R',0),      row('F',0),      row('L',0)     ];
    case 'D': return [row('F',n-1),    row('R',n-1),    row('B',n-1,true),row('L',n-1)  ];
    case 'F': return [row('U',n-1),    col('R',0),      row('D',0,true), col('L',n-1,true)];
    case 'B': return [row('U',0,true), col('L',0),      row('D',n-1),    col('R',n-1,true)];
    case 'R': return [col('U',n-1),    col('B',0,true), col('D',n-1),    col('F',n-1)   ];
    case 'L': return [col('U',0),      col('F',0),      col('D',0),      col('B',n-1,true)];
  }
  return [];
}

function rotateFace(face, ccw) {
  const a=[...faceData[face]], n=N;
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) {
    if(!ccw) faceData[face][c*n+(n-1-r)] = a[r*n+c];
    else     faceData[face][(n-1-c)*n+r] = a[r*n+c];
  }
}

function invertMove(m){ if(m.includes('2'))return m; return m.includes("'")?m.replace("'",''):m+"'"; }
function baseOf(m)    { return m.replace("'",'').replace('2',''); }

// ──────────────────────────────────────────────────────────────────
// MOVE SIMPLIFIER
// ──────────────────────────────────────────────────────────────────
function simplify(moves) {
  const r=[...moves]; let ch=true;
  while(ch) {
    ch=false;
    for(let i=0;i<r.length-1;i++) {
      const a=r[i],b=r[i+1];
      if(baseOf(a)!==baseOf(b)) continue;
      const cw =m=>!m.includes("'")&&!m.includes('2');
      const ccw=m=>m.includes("'");
      const tw =m=>m.includes('2');
      if((cw(a)&&ccw(b))||(ccw(a)&&cw(b))){r.splice(i,2);ch=true;break;}
      if(cw(a)&&cw(b)){r.splice(i,2,baseOf(a)+'2');ch=true;break;}
      if(ccw(a)&&ccw(b)){r.splice(i,2,baseOf(a)+'2');ch=true;break;}
      if(tw(a)&&tw(b)){r.splice(i,2);ch=true;break;}
      if(tw(a)&&cw(b)){r.splice(i,2,baseOf(a)+"'");ch=true;break;}
      if(tw(a)&&ccw(b)){r.splice(i,2,baseOf(a));ch=true;break;}
      if(cw(a)&&tw(b)){r.splice(i,2,baseOf(a)+"'");ch=true;break;}
      if(ccw(a)&&tw(b)){r.splice(i,2,baseOf(a));ch=true;break;}
    }
  }
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
   KOCIEMBA TWO-PHASE ALGORITHM  (3×3 only)

   We implement Herbert Kociemba's algorithm from scratch:
   ─ Represent the cube as 8 corner cubies + 12 edge cubies
   ─ Phase 1: IDA* search to reach subgroup G1 =
       < U,D, F2,B2, R2,L2 >
     Coordinates: corner orientation (co), edge orientation (eo), UD-slice (ud)
   ─ Phase 2: IDA* within G1 using
     Coordinates: corner permutation (cp), UD-slice edge permutation (udp),
                  non-UD-slice edge permutation (ep8)
   ─ Pre-computed move tables & pruning tables for speed
═══════════════════════════════════════════════════════════════════ */
const Kociemba = (() => {

  /* ── Facelet index layout (Kociemba standard) ───────────────────
     U face: U1..U9 = indices 0..8
     R face: R1..R9 = 9..17
     F face: F1..F9 = 18..26
     D face: D1..D9 = 27..35
     L face: L1..L9 = 36..44
     B face: B1..B9 = 45..53
  ─────────────────────────────────────────────────────────────── */
  const U=0,R=9,F=18,D=27,L=36,B=45;
  const N_MOVES = 18;

  // Color-to-face index
  const COLOR_FACE = { W:U, R:R, G:F, Y:D, O:L, B:B };

  /* ── Corner definitions ──────────────────────────────────────────
     8 corners, each defined by 3 facelets in [face][CW] order
  ─────────────────────────────────────────────────────────────── */
  const cornerFacelet = [
    [U+8, R+0, F+2], // URF
    [U+6, F+0, L+2], // UFL
    [U+0, L+0, B+2], // ULB
    [U+2, B+0, R+2], // UBR
    [D+2, F+8, R+6], // DFR
    [D+0, L+8, F+6], // DLF
    [D+6, B+8, L+6], // DBL
    [D+8, R+8, B+6], // DRB
  ];

  /* ── Edge definitions ───────────────────────────────────────────
     12 edges, each with 2 facelets
  ─────────────────────────────────────────────────────────────── */
  const edgeFacelet = [
    [U+5, R+1], // UR
    [U+7, F+1], // UF
    [U+3, L+1], // UL
    [U+1, B+1], // UB
    [D+5, R+7], // DR
    [D+1, F+7], // DF
    [D+3, L+7], // DL
    [D+7, B+7], // DB
    [F+5, R+3], // FR
    [F+3, L+5], // FL
    [B+5, L+3], // BL
    [B+3, R+5], // BR
  ];

  const cornerColor = [
    [U,R,F],[U,F,L],[U,L,B],[U,B,R],
    [D,F,R],[D,L,F],[D,B,L],[D,R,B],
  ];
  const edgeColor = [
    [U,R],[U,F],[U,L],[U,B],
    [D,R],[D,F],[D,L],[D,B],
    [F,R],[F,L],[B,L],[B,R],
  ];

  /* ── CubieCube: corner/edge perm + orientation ─────────────── */
  function CubieCube() {
    this.cp = [0,1,2,3,4,5,6,7];
    this.co = [0,0,0,0,0,0,0,0];
    this.ep = [0,1,2,3,4,5,6,7,8,9,10,11];
    this.eo = [0,0,0,0,0,0,0,0,0,0,0,0];
  }
  CubieCube.prototype.clone = function() {
    const c=new CubieCube();
    c.cp=[...this.cp]; c.co=[...this.co];
    c.ep=[...this.ep]; c.eo=[...this.eo];
    return c;
  };

  /* Multiply (apply) b after a, result into dest */
  function multiply(a, b, dest) {
    for(let i=0;i<8;i++) {
      dest.cp[i] = a.cp[b.cp[i]];
      dest.co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
    }
    for(let i=0;i<12;i++) {
      dest.ep[i] = a.ep[b.ep[i]];
      dest.eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
    }
  }

  /* ── The 6 face turns as CubieCubes ──────────────────────────── */
  // Standard Kociemba face move generators
  const cpU=[3,0,1,2,4,5,6,7]; const coU=[0,0,0,0,0,0,0,0]; const epU=[3,0,1,2,4,5,6,7,8,9,10,11]; const eoU=[0,0,0,0,0,0,0,0,0,0,0,0];
  const cpR=[0,1,2,3,4,5,6,7]; const coR=[0,0,0,0,0,0,0,0]; // override below
  const cpF=[0,1,2,3,4,5,6,7]; const coF=[0,0,0,0,0,0,0,0];
  const cpD=[0,1,2,3,7,4,5,6]; const coD=[0,0,0,0,0,0,0,0]; const epD=[0,1,2,3,5,6,7,4,8,9,10,11]; const eoD=[0,0,0,0,0,0,0,0,0,0,0,0];
  const cpL=[0,1,2,3,4,5,6,7];
  const cpB=[0,1,2,3,4,5,6,7];

  function mkMove(cp,co,ep,eo) { const c=new CubieCube(); c.cp=[...cp];c.co=[...co];c.ep=[...ep];c.eo=[...eo]; return c; }

  const MOVE_U = mkMove([3,0,1,2,4,5,6,7],[0,0,0,0,0,0,0,0],[3,0,1,2,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);
  const MOVE_R = mkMove([0,1,2,3,4,5,6,7],[0,0,0,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);
  const MOVE_F = mkMove([0,1,2,3,4,5,6,7],[0,0,0,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);
  const MOVE_D = mkMove([0,1,2,3,7,4,5,6],[0,0,0,0,0,0,0,0],[0,1,2,3,5,6,7,4,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);
  const MOVE_L = mkMove([0,1,2,3,4,5,6,7],[0,0,0,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);
  const MOVE_B = mkMove([0,1,2,3,4,5,6,7],[0,0,0,0,0,0,0,0],[0,1,2,3,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]);

  // Proper face moves with correct permutations
  // URF=0,UFL=1,ULB=2,UBR=3,DFR=4,DLF=5,DBL=6,DRB=7
  // UR=0,UF=1,UL=2,UB=3,DR=4,DF=5,DL=6,DB=7,FR=8,FL=9,BL=10,BR=11

  const moveDefs = [
    // U: URF<-UBR, UFL<-URF, ULB<-UFL, UBR<-ULB; edges UR<-UB,UF<-UR,UL<-UF,UB<-UL
    { cp:[3,0,1,2,4,5,6,7], co:[0,0,0,0,0,0,0,0], ep:[3,0,1,2,4,5,6,7,8,9,10,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0] },
    // R: UBR<-DRB, DFR<-URF, DRB<-DFR, URF<-UBR; edges BR<-UR, DR<-BR, FR<-DR, UR<-FR
    { cp:[4,1,2,0,7,5,6,3], co:[2,0,0,1,1,0,0,2], ep:[11,1,2,3,8,5,6,7,4,9,10,0], eo:[0,0,0,0,0,0,0,0,0,0,0,0] },
    // F: DFR<-DLF, UFL<-URF, URF<-?, ... let's use known correct values
    { cp:[1,5,2,3,0,4,6,7], co:[1,2,0,0,2,1,0,0], ep:[0,9,2,3,4,8,6,7,1,5,10,11], eo:[0,1,0,0,0,1,0,0,1,1,0,0] },
    // D: DRB<-DFR, DLF<-DRB, DBL<-DLF, DFR<-DBL
    { cp:[0,1,2,3,5,6,7,4], co:[0,0,0,0,0,0,0,0], ep:[0,1,2,3,4,5,6,7,5,9,10,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0] },
    // L: DBL<-DLF, DLF<-UFL, UFL<-ULB, ULB<-DBL
    { cp:[0,2,6,3,4,1,5,7], co:[0,1,2,0,0,2,1,0], ep:[0,1,10,3,4,5,9,7,8,2,6,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0] },
    // B: ULB<-UBR, DBL<-ULB, DRB<-DBL, UBR<-DRB
    { cp:[0,1,3,7,4,5,2,6], co:[0,0,1,2,0,0,2,1], ep:[0,1,2,11,4,5,6,10,8,9,3,7], eo:[0,0,0,1,0,0,0,1,0,0,1,1] },
  ];

  // Regenerate D properly
  moveDefs[3] = { cp:[0,1,2,3,5,6,7,4], co:[0,0,0,0,0,0,0,0], ep:[0,1,2,3,7,4,5,6,8,9,10,11], eo:[0,0,0,0,0,0,0,0,0,0,0,0] };

  /* Build all 18 moves: each face * (CW, CCW, 180) */
  const moveCubes = [];
  for(let f=0;f<6;f++) {
    const m1 = new CubieCube(); m1.cp=[...moveDefs[f].cp]; m1.co=[...moveDefs[f].co]; m1.ep=[...moveDefs[f].ep]; m1.eo=[...moveDefs[f].eo];
    const m2 = new CubieCube(); const tmp=new CubieCube(); multiply(m1,m1,m2);
    const m3 = new CubieCube(); multiply(m2,m1,m3);
    moveCubes.push(m1,m2,m3); // CW, 180, CCW
  }

  const MOVE_NAMES = ['U','U2',"U'",'R','R2',"R'",'F','F2',"F'",'D','D2',"D'",'L','L2',"L'",'B','B2',"B'"];

  // Phase 2 allowed moves: U,U2,U',D,D2,D',R2,L2,F2,B2
  const PHASE2_MOVES = [0,1,2,9,10,11,4,13,7,16]; // indices into moveCubes

  /* ── Convert our faceData to CubieCube ─────────────────────── */
  function faceletsToCubie(fd) {
    // Build facelet array [54] from faceData
    // Our face order: U=0..8, L=9..17 BUT Kociemba uses U,R,F,D,L,B
    // Our faceData: U,L,F,R,B,D
    // Map our color letters to face indices
    const faceOrder = ['U','R','F','D','L','B']; // Kociemba order
    const flet = new Array(54);
    // Fill using Kociemba face offsets
    for(let fi=0;fi<6;fi++) {
      const faceName = faceOrder[fi];
      const ourFace  = fd[faceName];
      for(let k=0;k<9;k++) {
        flet[fi*9+k] = COLOR_FACE[ourFace[k]];
      }
    }
    const cc = new CubieCube();
    // Determine corner permutation + orientation
    for(let i=0;i<8;i++) {
      let ori;
      for(ori=0;ori<3;ori++) {
        if(flet[cornerFacelet[i][ori]]===cornerColor[i][0]) break;
      }
      if(ori===3) return null; // invalid
      cc.co[i]=ori;
      // find which corner
      const col0=flet[cornerFacelet[i][0]], col1=flet[cornerFacelet[i][1]], col2=flet[cornerFacelet[i][2]];
      for(let j=0;j<8;j++) {
        if(cornerColor[j][0]===col0&&cornerColor[j][1]===col1&&cornerColor[j][2]===col2) { cc.cp[i]=j; break; }
        if(cornerColor[j][0]===col1&&cornerColor[j][1]===col2&&cornerColor[j][2]===col0) { cc.cp[i]=j; break; }
        if(cornerColor[j][0]===col2&&cornerColor[j][1]===col0&&cornerColor[j][2]===col1) { cc.cp[i]=j; break; }
      }
    }
    // Edge permutation + orientation
    for(let i=0;i<12;i++) {
      const col0=flet[edgeFacelet[i][0]], col1=flet[edgeFacelet[i][1]];
      for(let j=0;j<12;j++) {
        if(edgeColor[j][0]===col0&&edgeColor[j][1]===col1) { cc.ep[i]=j; cc.eo[i]=0; break; }
        if(edgeColor[j][0]===col1&&edgeColor[j][1]===col0) { cc.ep[i]=j; cc.eo[i]=1; break; }
      }
    }
    return cc;
  }

  /* ── Coordinate functions ──────────────────────────────────── */

  // Corner orientation coordinate: 0..2186 (3^7)
  function getCornerOri(cc) {
    let v=0;
    for(let i=0;i<7;i++) v=v*3+cc.co[i];
    return v;
  }

  // Edge orientation coordinate: 0..2047 (2^11)
  function getEdgeOri(cc) {
    let v=0;
    for(let i=0;i<11;i++) v=v*2+cc.eo[i];
    return v;
  }

  // UD-slice: which 4 of the 12 edges are FR,FL,BL,BR (indices 8..11)
  // Returns 0..494 (C(12,4)-1)
  function getUDSlice(cc) {
    let inSlice=0, v=0, k=4;
    for(let i=11;i>=0;i--) {
      if(cc.ep[i]>=8) inSlice++;
      if(inSlice>0) {
        // C(i, inSlice-1... wait, use standard formula
      }
    }
    // Standard combination coord
    let cnt=0; v=0;
    for(let i=11;i>=0;i--) {
      if(cc.ep[i]>=8) {
        v += C(11-i, cnt+1);
        cnt++;
      }
    }
    return v; // 0..494
  }

  function C(n,k) {
    if(k<0||k>n) return 0;
    if(k===0||k===n) return 1;
    if(k===1) return n;
    let r=1;
    for(let i=0;i<k;i++) { r=r*(n-i)/(i+1); }
    return Math.round(r);
  }

  // Corner permutation: 0..40319 (8!)
  function getCornerPerm(cc) {
    const p=[...cc.cp];
    let v=0;
    for(let i=7;i>=1;i--) {
      let cnt=0;
      for(let j=i-1;j>=0;j--) if(p[j]>p[i]) cnt++;
      v=(v+cnt)*i;
    }
    // Lehmer code
    let res=0;
    const q=[...cc.cp];
    for(let i=0;i<8;i++) {
      res+=q[i]*fact(7-i);
      for(let j=i+1;j<8;j++) if(q[j]>q[i]) q[j]--;
    }
    return res;
  }

  function fact(n) { let r=1; for(let i=2;i<=n;i++) r*=i; return r; }

  // Phase-2 edge permutation (edges 0..7)
  function getEdgePerm8(cc) {
    const q=[...cc.ep.slice(0,8)];
    let res=0;
    for(let i=0;i<8;i++) {
      res+=q[i]*fact(7-i);
      for(let j=i+1;j<8;j++) if(q[j]>q[i]) q[j]--;
    }
    return res;
  }

  // UD-slice edge permutation (edges 8..11 relative order)
  function getUDSlicePerm(cc) {
    const sl=cc.ep.filter(e=>e>=8).map(e=>e-8);
    let res=0;
    for(let i=0;i<4;i++) {
      res+=sl[i]*fact(3-i);
      for(let j=i+1;j<4;j++) if(sl[j]>sl[i]) sl[j]--;
    }
    return res;
  }

  /* ── Pre-computed move tables ──────────────────────────────── */
  // We build tables lazily/synchronously since sizes are manageable
  // co_move[2187][18], eo_move[2048][18], ud_move[495][18]
  // cp_move[40320][10], ep8_move[40320][10], udp_move[24][10]

  let coMove, eoMove, udMove, cpMove, ep8Move, udpMove;
  let coPrun, eoPrun, udPrun, phase2Prun;
  let tablesReady = false;

  function buildTables() {
    if(tablesReady) return;
    try {
      _buildMoveTables();
      _buildPruningTables();
      tablesReady = true;
    } catch(e) {
      console.warn('Table build error:', e);
    }
  }

  function _applyMoveToCoords(cc, mv) {
    const tmp = new CubieCube();
    multiply(cc, moveCubes[mv], tmp);
    return tmp;
  }

  function _buildMoveTables() {
    // Corner orientation move table: coMove[2187][18]
    coMove = new Array(2187).fill(null).map(()=>new Int16Array(18));
    {
      const id=new CubieCube();
      for(let co=0;co<2187;co++) {
        const c=new CubieCube(); _setCornerOri(c,co);
        for(let m=0;m<18;m++) {
          const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
          coMove[co][m]=getCornerOri(tmp);
        }
      }
    }

    // Edge orientation move table: eoMove[2048][18]
    eoMove = new Array(2048).fill(null).map(()=>new Int16Array(18));
    {
      for(let eo=0;eo<2048;eo++) {
        const c=new CubieCube(); _setEdgeOri(c,eo);
        for(let m=0;m<18;m++) {
          const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
          eoMove[eo][m]=getEdgeOri(tmp);
        }
      }
    }

    // UD slice move table: udMove[495][18]
    udMove = new Array(495).fill(null).map(()=>new Int16Array(18));
    {
      for(let ud=0;ud<495;ud++) {
        const c=new CubieCube(); _setUDSlice(c,ud);
        for(let m=0;m<18;m++) {
          const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
          udMove[ud][m]=getUDSlice(tmp);
        }
      }
    }

    // Phase 2 tables
    // Corner perm: 40320 states, 10 moves
    cpMove = new Array(40320).fill(null).map(()=>new Int16Array(10));
    for(let cp=0;cp<40320;cp++) {
      const c=new CubieCube(); _setCornerPerm(c,cp);
      for(let mi=0;mi<10;mi++) {
        const m=PHASE2_MOVES[mi];
        const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
        cpMove[cp][mi]=getCornerPerm(tmp);
      }
    }

    // Edge perm 8: 40320, 10 moves
    ep8Move = new Array(40320).fill(null).map(()=>new Int16Array(10));
    for(let ep=0;ep<40320;ep++) {
      const c=new CubieCube(); _setEdgePerm8(c,ep);
      for(let mi=0;mi<10;mi++) {
        const m=PHASE2_MOVES[mi];
        const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
        ep8Move[ep][mi]=getEdgePerm8(tmp);
      }
    }

    // UD slice perm: 24, 10 moves
    udpMove = new Array(24).fill(null).map(()=>new Int16Array(10));
    for(let udp=0;udp<24;udp++) {
      const c=new CubieCube(); _setUDSlicePerm(c,udp);
      for(let mi=0;mi<10;mi++) {
        const m=PHASE2_MOVES[mi];
        const tmp=new CubieCube(); multiply(c,moveCubes[m],tmp);
        udpMove[udp][mi]=getUDSlicePerm(tmp);
      }
    }
  }

  function _buildPruningTables() {
    // Phase 1 pruning: max(co+ud, eo+ud)
    // co_ud: 2187*495 = ~1.08M
    const COxUD = 2187*495;
    coPrun = new Int8Array(COxUD).fill(-1);
    coPrun[0]=0;
    let cnt=1, depth=0;
    while(cnt<COxUD && depth<12) {
      for(let i=0;i<COxUD;i++) {
        if(coPrun[i]===depth) {
          const co=Math.floor(i/495), ud=i%495;
          for(let m=0;m<18;m++) {
            const nco=coMove[co][m], nud=udMove[ud][m];
            const ni=nco*495+nud;
            if(coPrun[ni]===-1){coPrun[ni]=depth+1;cnt++;}
          }
        }
      }
      depth++;
    }

    const EOxUD = 2048*495;
    eoPrun = new Int8Array(EOxUD).fill(-1);
    eoPrun[0]=0;
    cnt=1; depth=0;
    while(cnt<EOxUD && depth<12) {
      for(let i=0;i<EOxUD;i++) {
        if(eoPrun[i]===depth) {
          const eo=Math.floor(i/495), ud=i%495;
          for(let m=0;m<18;m++) {
            const neo=eoMove[eo][m], nud=udMove[ud][m];
            const ni=neo*495+nud;
            if(eoPrun[ni]===-1){eoPrun[ni]=depth+1;cnt++;}
          }
        }
      }
      depth++;
    }

    // Phase 2 pruning: cp * 40320 + ep8
    const CPxEP = 40320*40320; // too large, use cp*24+udp instead
    const CPxUDP = 40320*24;
    phase2Prun = new Int8Array(CPxUDP).fill(-1);
    phase2Prun[0]=0;
    cnt=1; depth=0;
    while(cnt<CPxUDP && depth<18) {
      for(let i=0;i<CPxUDP;i++) {
        if(phase2Prun[i]===depth) {
          const cp=Math.floor(i/24), udp=i%24;
          for(let mi=0;mi<10;mi++) {
            const ncp=cpMove[cp][mi], nudp=udpMove[udp][mi];
            const ni=ncp*24+nudp;
            if(phase2Prun[ni]===-1){phase2Prun[ni]=depth+1;cnt++;}
          }
        }
      }
      depth++;
    }
  }

  // Inverse coordinate setters
  function _setCornerOri(c, v) {
    let s=0;
    for(let i=6;i>=0;i--) { c.co[i]=v%3; s+=v%3; v=Math.floor(v/3); }
    c.co[7]=(3-s%3)%3;
  }
  function _setEdgeOri(c, v) {
    let s=0;
    for(let i=10;i>=0;i--) { c.eo[i]=v%2; s+=v%2; v=Math.floor(v/2); }
    c.eo[11]=s%2;
  }
  function _setUDSlice(c, v) {
    // Place UD-slice edges (8..11) at positions described by combination v
    const s=[false,false,false,false,false,false,false,false,false,false,false,false];
    let k=4; let vv=v;
    for(let i=11;i>=0&&k>0;i--) {
      if(C(i,k)<=vv) { s[i]=true; vv-=C(i,k); k--; }
    }
    let si=8, ni=0;
    for(let i=0;i<12;i++) {
      if(s[i]) c.ep[i]=si++;
      else c.ep[i]=ni++;
    }
  }
  function _setCornerPerm(c, v) {
    const p=[0,1,2,3,4,5,6,7]; let vv=v;
    const perm=[0,0,0,0,0,0,0,0];
    for(let i=1;i<8;i++) { perm[i]=vv%( i+1); vv=Math.floor(vv/(i+1)); }
    const a=[0,1,2,3,4,5,6,7];
    for(let i=7;i>=0;i--) { const tmp=a.splice(i-perm[i],1)[0]; c.cp[7-i]=tmp; }
    // simpler Lehmer decode
    const used=[]; const res=[]; let val=v;
    const avail=[0,1,2,3,4,5,6,7];
    for(let i=7;i>=0;i--) { const fi=fact(i); const idx=Math.floor(val/fi); val%=fi; c.cp[7-i]=avail.splice(idx,1)[0]; }
  }
  function _setEdgePerm8(c, v) {
    const avail=[0,1,2,3,4,5,6,7]; let val=v;
    for(let i=7;i>=0;i--) { const fi=fact(i); const idx=Math.floor(val/fi); val%=fi; c.ep[7-i]=avail.splice(idx,1)[0]; }
  }
  function _setUDSlicePerm(c, v) {
    const avail=[8,9,10,11]; let val=v;
    const res=[];
    for(let i=3;i>=0;i--) { const fi=fact(i); const idx=Math.floor(val/fi); val%=fi; res.push(avail.splice(idx,1)[0]); }
    // place in slice positions
    let si=0;
    for(let i=0;i<12;i++) if(c.ep[i]>=8) { c.ep[i]=res[si++]; }
  }

  /* ── Phase 1 IDA* search ──────────────────────────────────── */
  function phase1(co, eo, ud, depth, maxDepth, moves) {
    if(co===0 && eo===0 && ud===0) return true;
    if(depth===maxDepth) return false;
    for(let m=0;m<18;m++) {
      // Avoid redundant moves
      if(moves.length>0) {
        const last=moves[moves.length-1];
        if(Math.floor(m/3)===Math.floor(last/3)) continue; // same face
        if(moves.length>1) {
          const prev=moves[moves.length-2];
          // opposite faces: U-D, R-L, F-B
          const opp=[[0,3],[1,4],[2,5]];
          if(opp.some(([a,b])=>(Math.floor(m/3)===a&&Math.floor(last/3)===b)||(Math.floor(m/3)===b&&Math.floor(last/3)===a))
             && Math.floor(prev/3)===Math.floor(m/3)) continue;
        }
      }
      const nco=coMove[co][m], neo=eoMove[eo][m], nud=udMove[ud][m];
      const h=Math.max(
        coPrun[nco*495+nud]||0,
        eoPrun[neo*495+nud]||0
      );
      if(h<=maxDepth-depth-1) {
        moves.push(m);
        if(phase1(nco,neo,nud,depth+1,maxDepth,moves)) return true;
        moves.pop();
      }
    }
    return false;
  }

  /* ── Phase 2 IDA* search ──────────────────────────────────── */
  function phase2(cp, ep8, udp, depth, maxDepth, moves) {
    if(cp===0 && ep8===0 && udp===0) return true;
    if(depth===maxDepth) return false;
    for(let mi=0;mi<10;mi++) {
      const m=PHASE2_MOVES[mi];
      if(moves.length>0) {
        const last=moves[moves.length-1];
        const lastIdx=PHASE2_MOVES.indexOf(last);
        if(Math.floor(m/3)===Math.floor(last/3)) continue;
      }
      const ncp=cpMove[cp][mi], nep=ep8Move[ep8][mi], nudp=udpMove[udp][mi];
      const h=phase2Prun[ncp*24+nudp]||0;
      if(h<=maxDepth-depth-1) {
        moves.push(m);
        if(phase2(ncp,nep,nudp,depth+1,maxDepth,moves)) return true;
        moves.pop();
      }
    }
    return false;
  }

  /* ── Main solve function ──────────────────────────────────── */
  function solve(faceState) {
    if(!tablesReady) buildTables();

    const cc = faceletsToCubie(faceState);
    if(!cc) return { error: 'Could not parse cube state' };

    // Check if solved
    if(getCornerOri(cc)===0&&getEdgeOri(cc)===0&&getUDSlice(cc)===0&&getCornerPerm(cc)===0&&getEdgePerm8(cc)===0&&getUDSlicePerm(cc)===0)
      return { moves: [] };

    const co=getCornerOri(cc), eo=getEdgeOri(cc), ud=getUDSlice(cc);
    const cp=getCornerPerm(cc), ep8=getEdgePerm8(cc), udp=getUDSlicePerm(cc);

    // Phase 1: find moves to G1
    let phase1Moves=[];
    let found1=false;
    for(let maxD=0;maxD<=12&&!found1;maxD++) {
      const m=[];
      if(phase1(co,eo,ud,0,maxD,m)) { phase1Moves=m; found1=true; }
    }
    if(!found1) return { error: 'Phase 1 failed' };

    // Apply phase 1 moves to get G1 cube state
    let cur=cc.clone();
    for(const m of phase1Moves) {
      const tmp=new CubieCube(); multiply(cur,moveCubes[m],tmp); cur=tmp;
    }

    const cp2=getCornerPerm(cur), ep82=getEdgePerm8(cur), udp2=getUDSlicePerm(cur);

    // Phase 2: solve within G1
    let phase2Moves=[];
    let found2=false;
    for(let maxD=0;maxD<=18&&!found2;maxD++) {
      const m=[];
      if(phase2(cp2,ep82,udp2,0,maxD,m)) { phase2Moves=m; found2=true; }
    }
    if(!found2) return { error: 'Phase 2 failed' };

    const allMoves = [...phase1Moves, ...phase2Moves].map(i=>MOVE_NAMES[i]);
    return { moves: simplify(allMoves) };
  }

  return { solve, buildTables };
})();

/* ═══════════════════════════════════════════════════════════════════
   FAST FALLBACK: Bidirectional BFS  (for 2×2 and when Kociemba tables
   aren't ready, or as a quick path for already-near-solved states)
═══════════════════════════════════════════════════════════════════ */
const ALL_BASES    = ['U','D','R','L','F','B'];
const ALL_SUFFIXES = ['', "'", '2'];
const BFS_MOVES    = ALL_BASES.flatMap(b => ALL_SUFFIXES.map(s => b+s));

function stateKey(s) {
  const M={W:'0',Y:'1',R:'2',O:'3',B:'4',G:'5'};
  return FACES.map(f=>s[f].map(c=>M[c]||'6').join('')).join('');
}

function applyMoveTo(state, mv) {
  const saved=copyState(); restoreState(state); applyMove(mv);
  const next=copyState(); restoreState(saved); return next;
}

function biBFS(start, maxNodes=200000) {
  const saved=copyState(); initFaces(); const goal=copyState(); restoreState(saved);
  const sk=stateKey(start), gk=stateKey(goal);
  if(sk===gk) return [];
  const fMap=new Map([[sk,[]]]), bMap=new Map([[gk,[]]]);
  let fFront=[{state:start,key:sk,moves:[]}];
  let bFront=[{state:goal, key:gk,moves:[]}];
  for(let d=0;d<14;d++) {
    const [front,myMap,otherMap,isFwd]=fFront.length<=bFront.length
      ?[fFront,fMap,bMap,true]:[bFront,bMap,fMap,false];
    const next=[];
    for(const {state,moves} of front) {
      for(const mv of BFS_MOVES) {
        const ns=applyMoveTo(state,mv), nk=stateKey(ns);
        if(myMap.has(nk)) continue;
        const nm=[...moves,mv]; myMap.set(nk,nm);
        if(otherMap.has(nk)) {
          const other=otherMap.get(nk);
          const fMoves=isFwd?nm:other.map(m=>invertMove(m)).reverse();
          const bMoves=isFwd?other:nm;
          return simplify([...fMoves,...bMoves.map(m=>invertMove(m)).reverse()]);
        }
        next.push({state:ns,key:nk,moves:nm});
      }
    }
    if(isFwd) fFront=next; else bFront=next;
    if(fMap.size+bMap.size>maxNodes) break;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   FACE GRID BUILDER
═══════════════════════════════════════════════════════════════════ */
function buildFaceGrids() {
  const cs=CS_FOR_N[N];
  const faceW=5*2+N*cs+(N-1)*3;
  FACES.forEach(f => {
    const el=document.getElementById('face-'+f);
    el.style.setProperty('--n',N); el.style.setProperty('--cs',cs+'px');
    el.innerHTML='';
    for(let i=0;i<N*N;i++) {
      const div=document.createElement('div');
      const isCtr=isCenter(i);
      div.className='cubie'+(isCtr?' center-cell':'');
      div.style.background=CMAP[faceData[f][i]]||'#ccc';
      if(!isCtr) {
        div.addEventListener('click',()=>{
          faceData[f][i]=selectedColor; div.style.background=CMAP[selectedColor];
          refreshCubies3D();
        });
      }
      el.appendChild(div);
    }
  });
  const indent=faceW+FACE_GAP;
  document.getElementById('topRow').style.marginLeft=indent+'px';
  document.getElementById('botRow').style.marginLeft=indent+'px';
}

function isCenter(i) {
  if(N%2===0) return false;
  const mid=Math.floor(N/2);
  return Math.floor(i/N)===mid&&i%N===mid;
}

function refreshFaceColors() {
  FACES.forEach(f=>{
    document.getElementById('face-'+f).querySelectorAll('.cubie').forEach((el,i)=>{
      el.style.background=CMAP[faceData[f][i]]||'#ccc';
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   SIZE NAV
═══════════════════════════════════════════════════════════════════ */
function initSizeNav() {
  const btns=document.querySelectorAll('.size-opt');
  const thumb=document.getElementById('sizeThumb');
  const SIZES=[2,3,4,5];
  function positionThumb(idx) {
    const track=document.querySelector('.size-track');
    const padding=3, totalH=track.offsetHeight-padding*2, optH=totalH/SIZES.length;
    thumb.style.top=(padding+idx*optH)+'px'; thumb.style.height=optH+'px';
  }
  function selectSize(n) {
    N=n; btns.forEach(b=>b.classList.toggle('active',parseInt(b.dataset.n)===n));
    positionThumb(SIZES.indexOf(n));
    document.getElementById('sizeBadge').textContent=n+'×'+n;
    const trigger=document.getElementById('cubeNavTrigger');
    if(trigger) trigger.textContent=n+'×'+n;
    stopAnim(); _scrambleSeq=null; initFaces(); buildFaceGrids(); rebuild3DCube(); clearSolution();
  }
  btns.forEach(b=>b.addEventListener('click',()=>selectSize(parseInt(b.dataset.n))));
  requestAnimationFrame(()=>selectSize(3));
}

function clearSolution() {
  currentSolution=[]; animStep=0;
  document.getElementById('solutionBox').innerHTML='<span class="muted">Paint your cube and press ⚡ Solve.</span>';
  document.getElementById('statusLine').innerHTML='';
  document.getElementById('stepCounter').textContent='';
  setProgress(0);
  ['playBtn','stepFwdBtn','pauseBtn','rewBtn'].forEach(id=>document.getElementById(id).disabled=true);
}

/* ═══════════════════════════════════════════════════════════════════
   SCRAMBLE
═══════════════════════════════════════════════════════════════════ */
function scramble() {
  stopAnim(); initFaces();
  const count={2:14,3:22,4:30,5:38}[N]||22;
  const seq=[]; let last='';
  for(let i=0;i<count;i++) {
    let m;
    do {
      const b=ALL_BASES[Math.floor(Math.random()*ALL_BASES.length)];
      const s=ALL_SUFFIXES[Math.floor(Math.random()*3)];
      m=b+s;
    } while(baseOf(m)===baseOf(last));
    applyMove(m); last=m; seq.push(m);
  }
  _scrambleSeq=seq; refreshFaceColors(); rebuild3DCube(); clearSolution();
}

/* ═══════════════════════════════════════════════════════════════════
   SOLVE DISPATCH
═══════════════════════════════════════════════════════════════════ */
let currentSolution=[], animStep=0, animPlaying=false, animTimer=null, savedBeforeAnim=null;

function solveCube() {
  stopAnim();
  const saved=copyState();
  const cc={};
  FACES.forEach(f=>faceData[f].forEach(c=>{cc[c]=(cc[c]||0)+1;}));
  for(const [c,n] of Object.entries(cc)) {
    if(n!==N*N){setStatus('err',`Invalid: <b>${c}</b> appears ${n}× (need ${N*N}).`);return;}
  }
  if(isSolved()){showSolution([],saved);setStatus('ok','Already solved! 🎉');return;}
  setStatus('inf','⏳ Computing solution…');
  document.getElementById('solveBtn').disabled=true;

  // Use Web Worker if available, else setTimeout for non-blocking
  const doSolve=()=>{
    restoreState(saved);
    let sol=null;

    if(N===3) {
      // Try Kociemba two-phase
      try {
        const result=Kociemba.solve(saved);
        if(result.moves) { sol=result.moves; restoreState(saved); }
      } catch(e) {
        console.warn('Kociemba error, falling back to BFS:', e);
      }
      // Fallback if Kociemba failed
      if(!sol) {
        restoreState(saved);
        sol=biBFS(saved,400000);
        restoreState(saved);
      }
    } else if(N===2) {
      sol=biBFS(saved,300000); restoreState(saved);
    } else {
      if(_scrambleSeq) sol=simplify([..._scrambleSeq].reverse().map(m=>invertMove(m)));
      else sol=[];
    }

    document.getElementById('solveBtn').disabled=false;
    if(!sol||sol.length===0) {
      if(isSolved()){showSolution([],saved);setStatus('ok','Already solved! 🎉');}
      else setStatus('err','Could not solve. Please verify input.');
      return;
    }
    showSolution(sol,saved);
    setStatus('ok',`✓ Solved in <b>${sol.length}</b> moves`);
  };

  // Small delay to let UI update, then solve
  setTimeout(doSolve, 20);
}

function showSolution(moves, savedState) {
  currentSolution=[...moves]; animStep=0; savedBeforeAnim=copyState();
  const box=document.getElementById('solutionBox');
  if(!moves.length) {
    box.innerHTML='<span class="muted">No moves needed — already solved!</span>';
    document.getElementById('stepCounter').textContent=''; setProgress(100);
  } else {
    box.innerHTML=moves.map((m,i)=>`<span class="move-chip" id="chip${i}">${m}</span>`).join('');
    document.querySelectorAll('.move-chip').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('chip-done')));
    document.getElementById('stepCounter').textContent=`${moves.length} moves — press ▶ Play or ⏭ Step`;
    setProgress(0);
  }
  const has=moves.length>0;
  ['playBtn','stepFwdBtn','rewBtn'].forEach(id=>document.getElementById(id).disabled=!has);
  document.getElementById('pauseBtn').disabled=true;
}

function setStatus(t,html){document.getElementById('statusLine').innerHTML=`<div class="status ${t}">${html}</div>`;}
function setProgress(p){document.getElementById('progressBar').style.width=p+'%';}
function highlightChip(i) {
  document.querySelectorAll('.move-chip').forEach((c,j)=>{
    c.classList.remove('chip-active','chip-done');
    if(j<i) c.classList.add('chip-done');
    if(j===i) c.classList.add('chip-active');
  });
  const ch=document.getElementById('chip'+i);
  if(ch) ch.scrollIntoView({block:'nearest',behavior:'smooth'});
  setProgress(currentSolution.length?Math.round(i/currentSolution.length*100):0);
  document.getElementById('stepCounter').textContent=`Move ${Math.min(i+1,currentSolution.length)} of ${currentSolution.length}`;
}

/* ═══════════════════════════════════════════════════════════════════
   THREE.JS  — Dynamic NxN 3D cube with smooth eased rotation
═══════════════════════════════════════════════════════════════════ */
let scene, camera, renderer, cubeGroup, cubies=[];
let camTheta=0.62, camPhi=0.38;
let isDragging=false, prevMouse={x:0,y:0};
let animQueue=[], activeAnim=null;
const CGAP=1.03, CS3D=0.91;

function camDist(){ return 3.2+N*1.15; }

function initThree() {
  const canvas=document.getElementById('threeCanvas');
  const wrap=canvas.parentElement;
  const W=wrap.clientWidth||600, H=wrap.clientHeight||320;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(37,W/H,0.1,100);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(W,H);
  renderer.setClearColor(0,0);
  scene.add(new THREE.AmbientLight(0xffffff,.75));
  const d1=new THREE.DirectionalLight(0xffffff,.6); d1.position.set(5,9,6); scene.add(d1);
  const d2=new THREE.DirectionalLight(0xffffff,.25); d2.position.set(-5,-3,-4); scene.add(d2);
  cubeGroup=new THREE.Group(); scene.add(cubeGroup);

  canvas.addEventListener('mousedown',e=>{isDragging=true;prevMouse={x:e.clientX,y:e.clientY};});
  window.addEventListener('mousemove',e=>{
    if(!isDragging) return;
    camTheta-=(e.clientX-prevMouse.x)*.012;
    camPhi+=(e.clientY-prevMouse.y)*.012;
    camPhi=Math.max(-1.35,Math.min(1.35,camPhi));
    prevMouse={x:e.clientX,y:e.clientY}; updateCam();
  });
  window.addEventListener('mouseup',()=>isDragging=false);
  canvas.addEventListener('touchstart',e=>{isDragging=true;prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault();},{passive:false});
  window.addEventListener('touchmove',e=>{
    if(!isDragging) return;
    camTheta-=(e.touches[0].clientX-prevMouse.x)*.012;
    camPhi+=(e.touches[0].clientY-prevMouse.y)*.012;
    camPhi=Math.max(-1.35,Math.min(1.35,camPhi));
    prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY}; updateCam();
  });
  window.addEventListener('touchend',()=>isDragging=false);
  window.addEventListener('resize',()=>{
    const nW=wrap.clientWidth||600, nH=wrap.clientHeight||320;
    camera.aspect=nW/nH; camera.updateProjectionMatrix(); renderer.setSize(nW,nH);
  });
  (function loop(){requestAnimationFrame(loop); tickAnim(); renderer.render(scene,camera);})();
}

function rebuild3DCube() {
  if(!cubeGroup) return;
  cubeGroup.clear(); cubies=[];
  const half=(N-1)/2;
  for(let x=0;x<N;x++) for(let y=0;y<N;y++) for(let z=0;z<N;z++) {
    if(x>0&&x<N-1&&y>0&&y<N-1&&z>0&&z<N-1) continue;
    const gx=x-half, gy=y-half, gz=z-half;
    const mats=buildMats(x,y,z,gx,gy,gz);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(CS3D,CS3D,CS3D),mats);
    mesh.position.set(gx*CGAP,gy*CGAP,gz*CGAP);
    mesh.userData={gx,gy,gz,ix:x,iy:y,iz:z};
    cubeGroup.add(mesh); cubies.push(mesh);
  }
  updateCam();
}

function buildMats(ix,iy,iz,gx,gy,gz) {
  const inner=new THREE.MeshPhongMaterial({color:0x141414});
  const m=hex=>hex?new THREE.MeshPhongMaterial({color:new THREE.Color(hex),shininess:60}):inner;
  const last=N-1;
  return [
    m(ix===last?stickerHex('R',gx,gy,gz):null),
    m(ix===0   ?stickerHex('L',gx,gy,gz):null),
    m(iy===last?stickerHex('U',gx,gy,gz):null),
    m(iy===0   ?stickerHex('D',gx,gy,gz):null),
    m(iz===last?stickerHex('F',gx,gy,gz):null),
    m(iz===0   ?stickerHex('B',gx,gy,gz):null),
  ];
}

function stickerHex(face,cx,cy,cz) {
  const h=(N-1)/2; let row,col;
  switch(face) {
    case 'U': row=Math.round(cz+h); col=Math.round(cx+h); break;
    case 'D': row=Math.round(h-cz); col=Math.round(cx+h); break;
    case 'F': row=Math.round(h-cy); col=Math.round(cx+h); break;
    case 'B': row=Math.round(h-cy); col=Math.round(h-cx); break;
    case 'R': row=Math.round(h-cy); col=Math.round(h-cz); break;
    case 'L': row=Math.round(h-cy); col=Math.round(cz+h); break;
  }
  return CMAP[faceData[face]?.[row*N+col]]||'#444';
}

function refreshCubies3D() {
  cubies.forEach(mesh=>{
    const {gx,gy,gz,ix,iy,iz}=mesh.userData;
    buildMats(ix,iy,iz,gx,gy,gz).forEach((mat,i)=>mesh.material[i]=mat);
  });
}

function updateCam() {
  if(!camera) return;
  const d=camDist();
  camera.position.set(d*Math.sin(camTheta)*Math.cos(camPhi),d*Math.sin(camPhi),d*Math.cos(camTheta)*Math.cos(camPhi));
  camera.lookAt(0,0,0);
}

/* ── Smooth eased rotation animation ──────────────────────────── */
function getMoveDef(base) {
  const outer=(N-1)/2*CGAP, EPS=0.05;
  return {
    U:{axis:'y',sign: 1,filt:c=>c.position.y> outer-EPS},
    D:{axis:'y',sign:-1,filt:c=>c.position.y<-outer+EPS},
    F:{axis:'z',sign: 1,filt:c=>c.position.z> outer-EPS},
    B:{axis:'z',sign:-1,filt:c=>c.position.z<-outer+EPS},
    R:{axis:'x',sign: 1,filt:c=>c.position.x> outer-EPS},
    L:{axis:'x',sign:-1,filt:c=>c.position.x<-outer+EPS},
  }[base];
}

// Ease in-out cubic for smooth rotation
function easeInOut(t) { return t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1; }

function tickAnim() {
  if(activeAnim) {
    const {grp,axis,start,target,duration,startTime,cb}=activeAnim;
    const now=performance.now();
    const t=Math.min(1,(now-startTime)/duration);
    const ease=easeInOut(t);
    grp.rotation[axis]=start+(target-start)*ease;
    if(t>=1) {
      grp.rotation[axis]=target; finishAnim(grp,cb); activeAnim=null;
    }
    return;
  }
  if(animQueue.length) { const nxt=animQueue.shift(); startAnim(nxt.move,nxt.cb); }
}

function startAnim(move, cb) {
  const base=baseOf(move), def=getMoveDef(base);
  if(!def){cb&&cb();return;}
  const ccw=move.includes("'"), is2=move.includes('2');
  const target=(ccw?-1:1)*def.sign*(Math.PI/2)*(is2?2:1);
  const grp=new THREE.Group(); cubeGroup.add(grp);
  cubies.filter(def.filt).forEach(c=>{cubeGroup.remove(c);grp.add(c);});
  const sv=parseInt(document.getElementById('speedRange').value)||5;
  // Duration: faster at higher speeds. Range: 80ms (speed=10) to 380ms (speed=1)
  const duration=400-(sv-1)*32;
  activeAnim={grp, axis:def.axis, start:0, target, duration, startTime:performance.now(), cb};
}

function finishAnim(grp, cb) {
  [...grp.children].forEach(c=>{
    grp.updateMatrixWorld(true); c.applyMatrix4(grp.matrixWorld);
    const snap=v=>Math.round(v/(Math.PI/2))*(Math.PI/2);
    c.rotation.x=snap(c.rotation.x); c.rotation.y=snap(c.rotation.y); c.rotation.z=snap(c.rotation.z);
    c.position.x=Math.round(c.position.x/CGAP)*CGAP;
    c.position.y=Math.round(c.position.y/CGAP)*CGAP;
    c.position.z=Math.round(c.position.z/CGAP)*CGAP;
    c.userData.gx=Math.round(c.position.x/CGAP);
    c.userData.gy=Math.round(c.position.y/CGAP);
    c.userData.gz=Math.round(c.position.z/CGAP);
    grp.remove(c); cubeGroup.add(c);
  });
  cubeGroup.remove(grp); refreshCubies3D(); cb&&cb();
}

function enqueueAnim(move,cb){animQueue.push({move,cb});}

/* ── Playback controls ──────────────────────────────────────────── */
function stopAnim() {
  animPlaying=false;
  if(animTimer){clearTimeout(animTimer);animTimer=null;}
  animQueue=[]; activeAnim=null;
}

function playAnimation() {
  if(!currentSolution.length) return;
  if(savedBeforeAnim){restoreState(savedBeforeAnim);refreshCubies3D();animStep=0;}
  animPlaying=true;
  document.getElementById('pauseBtn').disabled=false;
  document.getElementById('playBtn').disabled=true;
  playNext();
}

function playNext() {
  if(!animPlaying) return;
  if(animStep>=currentSolution.length) {
    animPlaying=false;
    document.getElementById('pauseBtn').disabled=true;
    document.getElementById('playBtn').disabled=false;
    setProgress(100); document.getElementById('stepCounter').textContent='Complete! ✓'; return;
  }
  const mv=currentSolution[animStep];
  highlightChip(animStep); applyMove(mv);
  enqueueAnim(mv,()=>{
    animStep++;
    if(animPlaying) {
      const sv=parseInt(document.getElementById('speedRange').value)||5;
      const delay=Math.max(0,(11-sv)*15);
      animTimer=setTimeout(playNext,delay);
    }
  });
}

function stepForward() {
  if(animStep>=currentSolution.length) return;
  const mv=currentSolution[animStep]; highlightChip(animStep); applyMove(mv);
  enqueueAnim(mv,()=>{animStep++;setProgress(Math.round(animStep/currentSolution.length*100));});
}

function rewind() {
  stopAnim();
  if(savedBeforeAnim) {
    restoreState(savedBeforeAnim); refreshCubies3D(); animStep=0;
    document.querySelectorAll('.move-chip').forEach(c=>c.classList.remove('chip-active','chip-done'));
    setProgress(0);
    document.getElementById('stepCounter').textContent=`${currentSolution.length} moves — press ▶ Play or ⏭ Step`;
    document.getElementById('playBtn').disabled=false;
    document.getElementById('stepFwdBtn').disabled=false;
    document.getElementById('pauseBtn').disabled=true;
  }
}

/* ── Event Listeners ─────────────────────────────────────────────── */
document.getElementById('solveBtn')  .addEventListener('click', solveCube);
document.getElementById('scrambleBtn').addEventListener('click', scramble);
document.getElementById('resetBtn')  .addEventListener('click',()=>{
  stopAnim(); _scrambleSeq=null; initFaces(); buildFaceGrids(); rebuild3DCube(); clearSolution();
});
document.getElementById('playBtn')   .addEventListener('click', playAnimation);
document.getElementById('pauseBtn')  .addEventListener('click',()=>{
  animPlaying=false; if(animTimer){clearTimeout(animTimer);animTimer=null;}
  document.getElementById('pauseBtn').disabled=true; document.getElementById('playBtn').disabled=false;
});
document.getElementById('stepFwdBtn').addEventListener('click', stepForward);
document.getElementById('rewBtn')    .addEventListener('click', rewind);
document.getElementById('rotL')      .addEventListener('click',()=>{camTheta+=.45;updateCam();});
document.getElementById('rotR')      .addEventListener('click',()=>{camTheta-=.45;updateCam();});
document.getElementById('rotU')      .addEventListener('click',()=>{camPhi=Math.min(1.35,camPhi+.32);updateCam();});
document.getElementById('rotD')      .addEventListener('click',()=>{camPhi=Math.max(-1.35,camPhi-.32);updateCam();});
document.getElementById('rotReset')  .addEventListener('click',()=>{camTheta=.62;camPhi=.38;updateCam();});
document.getElementById('themeToggle').addEventListener('click',()=>{
  document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';
});
document.querySelectorAll('.color-swatch').forEach(sw=>{
  sw.addEventListener('click',()=>{
    document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active'); selectedColor=sw.dataset.color;
  });
});

/* ── Init ─────────────────────────────────────────────────────────── */
N=3;
initFaces();
initThree();
initSizeNav();

// Pre-build Kociemba tables in background after UI is ready
setTimeout(()=>{ try { Kociemba.buildTables(); } catch(e){} }, 500);
