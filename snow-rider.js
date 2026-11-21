/* Standalone software 3D renderer and game UI. No libraries or remote assets. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const canvas = el('riderCanvas'), ctx = canvas.getContext('2d');
  const stage = el('riderStage'), menu = el('riderMenu');
  const run = new SnowRun();
  const input = { left:false, right:false };
  let coinPaid=false;
  let mode = 'ready', visible = false, frame = 0, last = 0, accumulator = 0;
  let width = 960, height = 600, cameraX = 0, polygons = [], palette = 0;
  const colors = ['#c95749','#b98659','#376d86'];
  let debris = [], crashTime = 0, sledParts = [], fallPose = null;
  let terrainPass = false;
  const ravineFloor = -2.4;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const load = key => { try { return Math.max(0, Number(localStorage.getItem(key)) || 0); } catch { return 0; } };
  const save = (key,value) => { try { localStorage.setItem(key,String(value)); } catch {} };
  let record = load('ppRiderRecord'), wallet = load('ppRiderGifts');
  palette = Math.min(2, load('ppRiderSleigh'));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const shade = (hex, factor) => {
    const value = parseInt(hex.slice(1),16);
    return `rgb(${[value>>16,(value>>8)&255,value&255].map(c=>Math.round(clamp(c*factor,0,255))).join(',')})`;
  };
  function resize() {
    width = stage.clientWidth; height = stage.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.8);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    render();
  }
  // Camera space: fixed pitch preserves a level horizon, with a small follow lag.
  function view(p) {
    const dy = p[1] - (3 + run.y*.55), dz = p[2] - (run.z-6);
    return [p[0]-cameraX, dy*.98877+dz*.14944, dz*.98877-dy*.14944];
  }
  function face(points,color) {
    let vertices = points.map(view), clipped = [];
    for (let i=0;i<vertices.length;i++) {
      const a=vertices[i],b=vertices[(i+1)%vertices.length],inside=a[2]>.25,next=b[2]>.25;
      if (inside) clipped.push(a);
      if (inside!==next) { const t=(.25-a[2])/(b[2]-a[2]); clipped.push(a.map((v,j)=>v+(b[j]-v)*t)); }
    }
    if (clipped.length<3) return;
    const depth=clipped.reduce((n,p)=>n+p[2],0)/clipped.length;
    const focal=Math.min(width*.82,height*1.18);
    polygons.push({ points:clipped.map(p=>[width/2+p[0]*focal/p[2],height*.43-p[1]*focal/p[2]]),depth,color,terrain:terrainPass });
  }
  function box(x,y,z,w,h,d,color,yaw=0,pitch=0) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const pts=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w/2,h,-d/2],[w/2,h,-d/2],[w/2,h,d/2],[-w/2,h,d/2]].map(p=>{const dy=p[1]-h/2,py=dy*Math.cos(pitch)-p[2]*Math.sin(pitch),pz=dy*Math.sin(pitch)+p[2]*Math.cos(pitch);return [x+p[0]*c+pz*s,y+py+h/2,z+pz*c-p[0]*s];});
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach((indices,i)=>face(indices.map(n=>pts[n]),shade(color,[.76,.85,.9,.72,1.08][i])));
  }
  function cone(x,y,z,r,h,color,segments=7) {
    for(let i=0;i<segments;i++) {
      const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
      face([[x+r*Math.cos(a),y,z+r*Math.sin(a)],[x,y+h,z],[x+r*Math.cos(b),y,z+r*Math.sin(b)]],shade(color,.78+.2*Math.cos(a-.6)));
    }
  }
  function sphere(x,y,z,r,color,squash=1) {
    const ring=(a,b)=>[x+Math.cos(a)*Math.cos(b)*r,y+Math.sin(a)*r*squash,z+Math.cos(a)*Math.sin(b)*r];
    for(let j=0;j<5;j++) for(let i=0;i<8;i++) {
      const a=-Math.PI/2+j*Math.PI/5,b=a+Math.PI/5,c=i*Math.PI/4,d=c+Math.PI/4;
      face([ring(a,c),ring(a,d),ring(b,d),ring(b,c)],shade(color,.77+.16*Math.sin(b)+.12*Math.cos(c)));
    }
  }
  function pine(x,z,size=1) {
    box(x,0,z,.32*size,.8*size,.32*size,'#756657');
    for(let i=0;i<3;i++) {
      const y=(.5+i*1.12)*size,r=(1.35-i*.3)*size,h=2.1*size;
      cone(x,y,z,r,h,'#53796f');
      cone(x,y+.28*size,z,r*.89,h-.22*size,'#e9f2ef');
    }
  }
  function object(o) {
    if(o.type==='tree') pine(o.x,o.z,1);
    if(o.type==='rock') { sphere(o.x,.32,o.z,.9,'#91a8b5',.65); cone(o.x,.55,o.z,.64,.24,'#eef6f5',6); }
    if(o.type==='log') { box(o.x,.08,o.z,2.4,.45,.7,'#9a6f4e'); box(o.x,.49,o.z,2.25,.12,.65,'#edf4f3'); }
    if(o.type==='snowman') {
      sphere(o.x,.54,o.z,.6,'#f2f6f5'); sphere(o.x,1.3,o.z,.43,'#f4f8f7');
      box(o.x,1.06,o.z,.79,.13,.81,'#ba655b'); box(o.x,1.67,o.z,.88,.08,.8,'#375264');box(o.x,1.71,o.z,.53,.38,.5,'#375264');
      box(o.x-.13,1.4,o.z-.4,.055,.055,.05,'#344b58');box(o.x+.13,1.4,o.z-.4,.055,.055,.05,'#344b58');
      box(o.x,1.27,o.z-.47,.12,.1,.25,'#d48a45');
    }
    if(o.type==='gift') {
      const y=o.height-.3+Math.sin(run.z*.1+o.z)*.07;
      box(o.x,y,o.z,.6,.6,.6,'#d26053');box(o.x,y+.61,o.z,.64,.09,.64,'#e7806d');
      box(o.x,y+.7,o.z,.13,.025,.66,'#f8d78e');box(o.x,y+.7,o.z,.66,.025,.13,'#f8d78e');
      box(o.x,y,o.z-.305,.12,.7,.025,'#f8d78e');
    }
  }
  function sled() {
    sledParts=[];
    const pose=fallPose || run;
    const x=pose.x,z=pose.z,y=pose.y,angle=-run.vx*.014,pitch=fallPose?fallPose.pitch:0;
    function part(dx,dy,dz,w,h,d,color) {
      if(window.ArcadeEconomy?.isEquipped('aurora')){
        if(['#b98659','#c29462','#bd8856','#b85648'].includes(color))color='#58bead';
        else if(['#c95749','#376d86','#5c9bb1'].includes(color))color='#8276bd';
      }
      const cy=dy+h/2,py=cy*Math.cos(pitch)-dz*Math.sin(pitch),rz=cy*Math.sin(pitch)+dz*Math.cos(pitch);
      const px=x+dx*Math.cos(angle)+rz*Math.sin(angle),pz=z+rz*Math.cos(angle)-dx*Math.sin(angle),base=y+py-h/2;
      sledParts.push({x:px,y:base,z:pz,w,h,d,color,angle,pitch});
      box(px,base,pz,w,h,d,color,angle,pitch);
    }
    if(palette===0) { // Traditional raised wooden sleigh, metal runners.
      for(const side of [-1,1]) {
        part(side*.54,.06,0,.12,.12,2.1,'#6f8e9d');part(side*.54,.12,.98,.12,.28,.25,'#6f8e9d');
        part(side*.44,.12,-.6,.1,.45,.12,colors[0]);part(side*.44,.12,.6,.1,.45,.12,colors[0]);
      }
      for(let i=0;i<5;i++)part(0,.55,-.64+i*.32,1.18,.13,.26,'#b98659');
      part(-.6,.48,0,.1,.22,1.72,colors[0]);part(.6,.48,0,.1,.22,1.72,colors[0]);
      part(0,.64,-.81,1.2,.09,.1,colors[0]);
    } else if(palette===1) { // Low, long toboggan with a curled nose and rope handles.
      for(let i=0;i<6;i++)part((i-2.5)*.19,.08,0,.17,.12,2.5,'#c29462');
      for(let i=0;i<4;i++)part(0,.18+i*.12,1.13+i*.06,1.14,.15,.16,'#bd8856');
      part(0,.22,-.1,.78,.12,1.15,'#b85648');
      for(const side of [-1,1]) {part(side*.58,.22,-.25,.05,.08,1.55,'#705c46');part(side*.58,.22,.5,.06,.23,.06,'#705c46');}
    } else { // Alpine racer: narrow skis, bucket seat, steering bar and tapered nose.
      for(const side of [-1,1]) {
        part(side*.65,.04,0,.19,.1,2.55,'#394f60');part(side*.65,.1,1.2,.19,.22,.22,'#394f60');
        part(side*.42,.15,0,.12,.27,1.25,'#9eb8c6');part(side*.46,.4,0,.13,.3,1.55,'#376d86');
      }
      part(0,.34,0,.86,.19,1.65,'#376d86');part(0,.53,-.18,.65,.13,.9,'#263e51');
      part(0,.51,-.73,.83,.5,.15,'#376d86');part(0,.42,.92,.62,.14,.36,'#5c9bb1');
      part(0,.55,.7,.08,.32,.08,'#b8ccd4');part(0,.85,.7,.8,.08,.08,'#263e51');
    }
  }
  function bounds(p) {
    const vertical=Math.abs(Math.cos(p.pitch))*p.h/2+Math.abs(Math.sin(p.pitch))*p.d/2;
    const along=Math.abs(Math.sin(p.pitch))*p.h/2+Math.abs(Math.cos(p.pitch))*p.d/2;
    return {vertical,x:Math.abs(Math.cos(p.angle))*p.w/2+Math.abs(Math.sin(p.angle))*along,
      z:Math.abs(Math.sin(p.angle))*p.w/2+Math.abs(Math.cos(p.angle))*along};
  }
  function floorFor(p,b) {
    return run.gaps.some(g=>p.z-b.z>g.start&&p.z+b.z<g.end&&Math.abs(p.x)+b.x<10)?ravineFloor:0;
  }
  function beginCrash() {
    if(run.failure?.type==='ravine') {
      mode='falling';input.left=input.right=false;el('riderPause').disabled=true;
      const gap=run.failure.gap;
      fallPose={x:run.x,y:run.y,z:run.z,pitch:0,vy:Math.min(0,run.vy),time:0,gap,startZ:run.z};
      return;
    }
    splinter();
  }
  function animateFall(dt) {
    const p=fallPose;p.time+=dt;p.vy-=11*dt;p.y+=p.vy*dt;
    p.z=p.startZ+(p.gap.start+(p.gap.end-p.gap.start)*.62-p.startZ)*(1-Math.exp(-p.time*5));
    p.pitch=Math.min(.65,p.time*.95);
    sled();
    const bottom=Math.min(...sledParts.map(part=>part.y+part.h/2-bounds(part).vertical));
    if(bottom<=ravineFloor+.035) {p.y+=ravineFloor+.035-bottom;splinter();}
  }
  function splinter() {
    mode='crashing';input.left=input.right=false;crashTime=0;
    sled(); // Break the selected model's actual parts into smaller pieces.
    debris=sledParts.flatMap(p=> {
      const count=p.w>.7?3:p.d>1?3:1;
      return Array.from({length:count},(_,i)=> {
        const splitX=p.w>.7,offset=(i-(count-1)/2)*(splitX?p.w:p.d)/count;
        const localZ=splitX?0:offset,localX=splitX?offset:0;
        return {x:p.x+localX*Math.cos(p.angle)+localZ*Math.cos(p.pitch)*Math.sin(p.angle),
          y:p.y-localZ*Math.sin(p.pitch),z:p.z+localZ*Math.cos(p.pitch)*Math.cos(p.angle)-localX*Math.sin(p.angle),
          w:splitX?p.w/count:p.w,h:p.h,d:splitX?p.d:p.d/count,color:p.color,
          angle:p.angle,pitch:p.pitch,vx:(Math.random()-.5)*6+run.vx*.4,vy:(fallPose?1:2)+Math.random()*(fallPose?2:4),
          vz:(fallPose?0:2)+Math.random()*(fallPose?2:5),spin:(Math.random()-.5)*15};
      });
    });
    for(let i=0;i<20;i++)debris.push({x:(fallPose||run).x+(Math.random()-.5),y:(fallPose?ravineFloor:run.y)+.1,z:(fallPose||run).z+(Math.random()-.5)*2,w:.06,h:.06,d:.06,color:'#f5fafc',angle:0,pitch:0,vx:(Math.random()-.5)*8,vy:2+Math.random()*4,vz:(Math.random()-.5)*6,spin:8});
    el('riderPause').disabled=true;
  }
  function animateCrash(dt) {
    crashTime+=dt;
    for(const p of debris) {
      p.vy-=13*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.angle+=p.spin*dt;p.pitch+=p.spin*.7*dt;
      const b=bounds(p);
      // Below the rim, fragments collide with the ravine walls instead of entering snow.
      if(p.y+p.h/2-b.vertical<0) {
        const gap=run.gaps.find(g=>p.z>g.start&&p.z<g.end);
        if(gap) {
          const z=clamp(p.z,gap.start+b.z+.025,gap.end-b.z-.025),x=clamp(p.x,-10+b.x+.025,10-b.x-.025);
          if(z!==p.z)p.vz*=-.3;if(x!==p.x)p.vx*=-.3;p.z=z;p.x=x;
        }
      }
      const floor=floorFor(p,b),lowest=p.y+p.h/2-b.vertical;
      if(lowest<floor+.025){p.y=floor+.025+b.vertical-p.h/2;p.vy=p.vy<-.5?-p.vy*.2:0;p.vx*=Math.exp(-9*dt);p.vz*=Math.exp(-9*dt);p.spin*=Math.exp(-9*dt);}
    }
    if(crashTime>(reducedMotion?.55:1.55))finish();
  }
  function render() {
    if(!width||!height)return;
    polygons=[];
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#9ac4dc');sky.addColorStop(.65,'#e5f0f3');sky.addColorStop(1,'#f6f9f9');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // Distant mountain silhouettes are generated locally, with no image assets.
    for(let layer=0;layer<2;layer++) {
      ctx.beginPath();ctx.moveTo(0,height*.39);
      for(let i=0;i<=16;i++)ctx.lineTo(i*width/16,height*(.22+layer*.055)-Math.sin(i*2.7+layer)*height*.06);
      ctx.lineTo(width,height*.5);ctx.lineTo(0,height*.5);ctx.closePath();ctx.fillStyle=layer?'#dce9ee':'#b9d4e0';ctx.fill();
    }
    terrainPass=true;
    const start=Math.floor((run.z-8)/4)*4;
    const cuts=[];for(let z=start;z<run.z+204;z+=4)cuts.push(z);
    for(const g of run.gaps)for(const z of [g.start,g.end])if(z>start&&z<run.z+200)cuts.push(z);
    cuts.sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++) {
      const z=cuts[i],end=cuts[i+1];
      const gap=run.gaps.some(g=>(z+end)/2>g.start&&(z+end)/2<g.end);
      const color=(Math.floor(z/4)%3===0)?'#eaf2f5':'#eff5f7';
      if(gap) {
        face([[-100,0,z],[-10,0,z],[-10,0,end],[-100,0,end]],color);
        face([[10,0,z],[100,0,z],[100,0,end],[10,0,end]],color);
        face([[-10,-2.4,z],[10,-2.4,z],[10,-2.4,end],[-10,-2.4,end]],'#7797ae');
      } else face([[-100,0,z],[100,0,z],[100,0,end],[-100,0,end]],color);
    }
    terrainPass=false;
    for(const g of run.gaps) for(const z of [g.start,g.end])face([[-10,0,z],[10,0,z],[10,-2.4,z],[-10,-2.4,z]],'#a5bfcd');
    for(let i=Math.floor((run.z-10)/13);i<(run.z+160)/13;i++) {
      const z=i*13;
      for(const side of [-1,1]) {
        const x=side*(12+Math.abs(Math.sin(i*7.3+side))*9);
        pine(x,z,.9+Math.abs(Math.cos(i*3.9))*.65);
        if(i%2===0) {box(side*10,.02,z,.06,.9,.06,'#768e9a');box(side*10,.64,z,.12,.26,.08,'#b75f58');}
      }
    }
    for(const o of run.objects) if(o.z>run.z-5&&o.z<run.z+180&&!o.collected)object(o);
    // Contact shadow stays on the snow while the sled follows its jump arc.
    if(!fallPose&&!run.gaps.some(g=>run.z>g.start&&run.z<g.end))face([[run.x-.75,.025,run.z-1],[run.x+.75,.025,run.z-1],[run.x+.75,.025,run.z+1],[run.x-.75,.025,run.z+1]],'#b8ccd6');
    if(mode==='crashing'||(mode==='over'&&debris.length)) {
      for(const p of debris)box(p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.angle,p.pitch);
    } else sled();
    // Snow is a supporting surface, not a depth-sorted object: large terrain strips
    // otherwise paint over nearby runners and debris despite being below them.
    polygons.sort((a,b)=>Number(b.terrain)-Number(a.terrain)||b.depth-a.depth);
    for(const p of polygons) {
      ctx.beginPath();p.points.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=p.color;ctx.fill();
      const fog=clamp((p.depth-65)/150,0,.8);if(fog){ctx.fillStyle=`rgba(220,236,243,${fog})`;ctx.fill();}
    }
    ctx.fillStyle='#ffffff88';for(let i=0;i<32;i++) {const x=(i*193.7+Math.sin(i)*run.z*.15)%width,y=(i*107.3+run.z*(.22+i%3*.05))%height;ctx.fillRect(x,y,1.5,1.5);}
  }
  function hud() {el('riderDistance').textContent=Math.floor(run.z);el('riderGifts').textContent=run.gifts;el('riderBest').textContent=record;el('riderSpeed').textContent=Math.round(run.speed*3.6);}
  function garage() {
    el('riderWallet').textContent=`${wallet} total gifts`;
    document.querySelectorAll('[data-sled]').forEach((button,i)=> {button.disabled=false;button.setAttribute('aria-pressed',String(i===palette));});
  }
  function showMenu(title,description,button) {el('riderTitle').textContent=title;el('riderDescription').textContent=description;el('riderStart').textContent=button;menu.hidden=false;garage();}
  function finish() {
    if(!coinPaid){coinPaid=true;window.ArcadeEconomy?.progress('snow',run.z+run.gifts*25);}
    mode='over';el('riderPause').disabled=false;record=Math.max(record,Math.floor(run.z));wallet+=run.gifts;save('ppRiderRecord',record);save('ppRiderGifts',wallet);hud();
    showMenu('Ride over',`${run.reason}. You travelled ${Math.floor(run.z)} metres and collected ${run.gifts} gifts.`, 'Ride again');
  }
  function tick(time) {
    if(!visible)return;
    const elapsed=Math.min((time-last)/1000,.05);last=time;
    if(mode==='playing') {
      accumulator+=elapsed;
      while(accumulator>=1/120&&mode==='playing') {
        run.step(1/120,Number(input.right)-Number(input.left));accumulator-=1/120;
        if(!run.alive)beginCrash();
      }
      cameraX+=(run.x-cameraX)*(1-Math.exp(-elapsed*8));hud();
    }
    if(mode==='falling')animateFall(elapsed);
    else if(mode==='crashing')animateCrash(elapsed);
    render();frame=requestAnimationFrame(tick);
  }
  function start() {
    if(mode==='crashing'||mode==='falling')return;
    if(mode!=='paused'){coinPaid=false;run.reset();cameraX=0;debris=[];crashTime=0;fallPose=null;}
    input.left=input.right=false;mode='playing';accumulator=0;last=performance.now();menu.hidden=true;canvas.focus();
  }
  function pause() {
    if(mode==='playing'){mode='paused';input.left=input.right=false;showMenu('Paused','Select Resume to continue your ride.','Resume');}
    else if(mode==='paused')start();
  }
  el('riderStart').addEventListener('click',start);el('riderPause').addEventListener('click',pause);
  document.querySelectorAll('[data-sled]').forEach((button,i)=>button.addEventListener('click',()=>{if(mode!=='crashing'&&mode!=='falling'){palette=i;save('ppRiderSleigh',i);if(mode==='over'){debris=[];fallPose=null;}garage();render();}}));
  window.addEventListener('keydown',e=> {
    if(!visible||document.getElementById('arcadeShop')?.open)return;
    if(['ArrowLeft','ArrowRight','ArrowUp',' ','a','A','d','D','p','P','Escape'].includes(e.key))e.preventDefault();
    if(['ArrowLeft','a','A'].includes(e.key))input.left=true;
    if(['ArrowRight','d','D'].includes(e.key))input.right=true;
    if(!e.repeat&&(e.key==='ArrowUp'||e.code==='Space')){if(mode==='playing')run.jump();else if(e.code==='Space')start();}
    if(!e.repeat&&['p','P','Escape'].includes(e.key))pause();
  });
  window.addEventListener('keyup',e=>{if(['ArrowLeft','a','A'].includes(e.key))input.left=false;if(['ArrowRight','d','D'].includes(e.key))input.right=false;});
  for(const side of ['left','right']) {
    const button=el('rider-'+side);
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input[side]=true;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>input[side]=false);
  }
  el('rider-jump').addEventListener('pointerdown',e=>{e.preventDefault();if(mode==='playing')run.jump();});
  window.addEventListener('blur',()=>{if(visible&&mode==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&visible&&mode==='playing')pause();});
  el('riderFullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else if(stage.requestFullscreen)stage.requestFullscreen().catch(()=>{});});
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('arcade-shop-change',()=>{if(visible)render();});
  window.SnowRider={
    pauseForShop(){if(visible&&mode==='playing')pause();},
    open(){visible=true;resize();hud();garage();last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);},
    close(){if(mode==='crashing'||mode==='falling')finish();if(mode==='playing')pause();visible=false;input.left=input.right=false;cancelAnimationFrame(frame);}
  };
})();
