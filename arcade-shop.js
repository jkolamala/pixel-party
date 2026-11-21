/* Shared, browser-local arcade economy. Game scores and betting chips stay separate. */
(() => {
  'use strict';
  const key='pixelPartyShopV1';
  const goals={blackjack:2,'2048':512,snow:750};
  const items=[
    {id:'mint',group:'theme',name:'Moonlit mint',cost:60,icon:'mint',description:'A mint accent and a deep green arcade background.'},
    {id:'sunset',group:'theme',name:'Sunset arcade',cost:60,icon:'sunset',description:'Warm coral accents and a plum arcade background.'},
    {id:'royal',group:'cards',name:'Royal deck',cost:40,icon:'royal',description:'Indigo and gold patterned card backs in Blackjack.'},
    {id:'ocean',group:'tiles',name:'Ocean tiles',cost:40,icon:'128',description:'A blue and turquoise tile palette for 2048.'},
    {id:'aurora',group:'sled',name:'Aurora finish',cost:40,icon:'aurora',description:'An emerald and violet finish for all three sleigh models.'}
  ];
  const fresh=()=>({coins:0,earned:0,owned:[],equipped:{},progress:{blackjack:0,'2048':0,snow:0}});
  let state=fresh(),storageOK=true,toastTimer;
  const safeNumber=n=>Number.isFinite(n)&&n>=0?Math.min(n,1e9):0;
  function read(){
    try {
      const raw=JSON.parse(localStorage.getItem(key)||'null');
      if(!raw||typeof raw!=='object')return fresh();
      const clean=fresh();clean.coins=Math.floor(safeNumber(raw.coins));clean.earned=Math.floor(safeNumber(raw.earned));
      clean.owned=items.filter(i=>Array.isArray(raw.owned)&&raw.owned.includes(i.id)).map(i=>i.id);
      for(const item of items)if(clean.owned.includes(item.id)&&raw.equipped?.[item.group]===item.id)clean.equipped[item.group]=item.id;
      for(const game of Object.keys(goals))clean.progress[game]=safeNumber(raw.progress?.[game])%goals[game];
      return clean;
    } catch {storageOK=false;return state;}
  }
  state=read();
  function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{storageOK=false;}render();}
  function notify(message){
    const toast=document.getElementById('coinToast');toast.textContent=message;toast.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,4000);
  }
  function render(){
    document.querySelectorAll('[data-coin-balance]').forEach(n=>n.textContent=state.coins);
    const body=document.body;
    for(const group of ['theme','cards','tiles','sled'])body.dataset['shop'+group[0].toUpperCase()+group.slice(1)]=state.equipped[group]||'default';
    document.getElementById('shopStorage').textContent=storageOK?'Coins and purchases are saved on this device until you clear your browser’s site data.':'Your browser cannot save data, so coins and purchases will last only for this visit.';
    for(const item of items){
      const button=document.getElementById('buy-'+item.id),owned=state.owned.includes(item.id),equipped=state.equipped[item.group]===item.id;
      button.textContent=equipped?'Remove':owned?'Equip':`${item.cost} coins`;
      button.disabled=!owned&&state.coins<item.cost;button.setAttribute('aria-pressed',String(equipped));
      document.getElementById('status-'+item.id).textContent=equipped?'Equipped':owned?'Owned':state.coins<item.cost?`${item.cost-state.coins} more coins needed`:'Available';
    }
    const labels={blackjack:'Blackjack','2048':'2048',snow:'Snow Rider'};
    for(const game of Object.keys(goals)){
      const percent=Math.floor(state.progress[game]/goals[game]*100);
      document.getElementById('progress-'+game).value=percent;
      document.getElementById('progress-label-'+game).textContent=`${labels[game]} · ${percent}% to +10 coins`;
    }
    window.dispatchEvent(new CustomEvent('arcade-shop-change'));
  }
  function progress(game,amount){
    if(!goals[game]||!Number.isFinite(amount)||amount<=0)return 0;
    if(storageOK)state=read();
    const total=state.progress[game]+amount,steps=Math.floor((total+1e-8)/goals[game]),reward=steps*10;
    state.progress[game]=Math.max(0,total-steps*goals[game]);state.coins+=reward;state.earned+=reward;
    persist();if(reward)notify(`You earned ${reward} coins. Your balance is ${state.coins}.`);return reward;
  }
  function purchase(id){
    if(storageOK)state=read();
    const item=items.find(i=>i.id===id);if(!item)return;
    if(state.owned.includes(id))state.equipped[item.group]=state.equipped[item.group]===id?'default':id;
    else {
      if(state.coins<item.cost){render();return;}
      state.coins-=item.cost;state.owned.push(id);state.equipped[item.group]=id;
      document.getElementById('shopMessage').textContent=`${item.name} unlocked and equipped.`;
    }
    persist();
  }
  const previewPaths={mint:'M29 5A12 12 0 1 0 33 26 12 12 0 0 1 29 5Z',sunset:'M5 24h34M9 29h26M12 19a10 10 0 0 1 20 0',royal:'M13 3h20v28H13ZM8 8H5v23h3M18 17l5-8 5 8-5 8Z',aurora:'M5 25 15 5l7 14L31 4l8 21M5 30h34'};
  const preview=icon=>previewPaths[icon]?`<svg viewBox="0 0 44 36" aria-hidden="true"><path d="${previewPaths[icon]}"/></svg>`:icon;
  const grid=document.getElementById('shopItems');
  for(const item of items){
    const card=document.createElement('article');card.className='shop-item';
    card.innerHTML=`<div class="shop-swatch shop-${item.id}" aria-hidden="true">${preview(item.icon)}</div><h3>${item.name}</h3><p>${item.description}</p><span class="shop-item-status" id="status-${item.id}"></span><button id="buy-${item.id}" type="button"></button>`;
    grid.appendChild(card);document.getElementById('buy-'+item.id).addEventListener('click',()=>purchase(item.id));
  }
  const dialog=document.getElementById('arcadeShop');
  document.getElementById('openShop').addEventListener('click',()=>{if(storageOK)state=read();render();window.SnowRider?.pauseForShop();dialog.showModal();});
  document.getElementById('closeShop').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){storageOK=true;state=read();render();}});
  window.ArcadeEconomy={progress,isEquipped:id=>Object.values(state.equipped).includes(id)};
  render();
})();
