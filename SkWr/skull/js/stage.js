function genStage(w, l) {
  Game.platforms = []; Game.enemies = []; Game.bullets = []; Game.eBullets = []; 
  Game.parts = []; Game.doors = []; Game.lasers = []; Game.texts = []; Game.items = [];
  Game.kills = 0; Game.invT = 0; Game.hitStop = 0;
  
  const isBoss = l === 3;
  Game.levelW = isBoss ? 1400 : 2000;

  for (let x = 0; x < Game.levelW; x += TILE) Game.platforms.push({ x, y: CH - TILE, w: TILE, h: TILE });
  for (let y = 0; y < CH; y += TILE) {
    Game.platforms.push({ x: -TILE, y, w: TILE, h: TILE });
    Game.platforms.push({ x: Game.levelW, y, w: TILE, h: TILE });
  }

  if (!isBoss) {
    const tier1Y = CH - TILE - 65, tier2Y = CH - TILE - 130, tier3Y = CH - TILE - 195;
    
    for (let px = 300; px < Game.levelW - 300; px += 250) {
      let isDrop = Math.random() < 0.3;
      Game.platforms.push({ x: px + Math.random() * 50, y: tier1Y, w: 100 + Math.random() * 40, h: TILE, float: true, drop: isDrop });
      if (Math.random() < 0.8) Game.platforms.push({ x: px + 80 + Math.random() * 50, y: tier2Y, w: 80 + Math.random() * 40, h: TILE, float: true, drop: Math.random() < 0.3 });
      if (Math.random() < 0.5) Game.platforms.push({ x: px + 20 + Math.random() * 80, y: tier3Y, w: 80, h: TILE, float: true });
    }

    Game.platforms.push({ x: 500, y: CH - TILE - 90, w: 80, h: TILE, float: true, vx: 1.5, boundL: 400, boundR: 700 });
    Game.platforms.push({ x: 900, y: CH - TILE - 160, w: 80, h: TILE, float: true, vx: -2, boundL: 750, boundR: 1100 });
    Game.platforms.push({ x: 1300, y: CH - TILE - 120, w: 80, h: TILE, float: true, vx: 2.2, boundL: 1100, boundR: 1500 });

    const pits = [];
    for (let i = 0; i < Math.min(2, w); i++) {
      let gx = 400 + Math.random() * (Game.levelW - 800); let gw = TILE * 3;
      pits.push({ x: gx, w: gw });
      Game.platforms = Game.platforms.filter(p => !(p.float == null && p.x >= gx && p.x < gx + gw && p.y === CH - TILE));
    }

    const ec = 5 + w * 3 + l * 2;
    for (let i = 0; i < ec; i++) {
      let ex = 300 + Math.random() * (Game.levelW - 500); let ey = CH - TILE - 18;
      let floaters = Game.platforms.filter(p => p.float && !p.vx && !p.drop);
      if (floaters.length > 0 && Math.random() < 0.6) {
        let f = floaters[Math.floor(Math.random() * floaters.length)];
        ex = f.x + Math.random() * (f.w - 12); ey = f.y - 18;
      }
      Game.enemies.push(mkEnemy(ex, ey, w));
    }
  } else {
    Game.platforms.push({ x: 200, y: CH - TILE - 80, w: TILE * 4, h: TILE, float: true });
    Game.platforms.push({ x: 600, y: CH - TILE - 100, w: TILE * 4, h: TILE, float: true });
    Game.platforms.push({ x: 1000, y: CH - TILE - 80, w: TILE * 4, h: TILE, float: true });
    Game.enemies.push(mkBoss(Game.levelW / 2, CH - TILE - 90, w));
    
    document.getElementById("bossBarWrap").style.display = "block";
    const bossNames = ["", "고블린 킹 [월드 1]", "고블린 워로드 [월드 2]", "오크 치프틴 [월드 3]", "오크 요새 수문장 [월드 4]", "언데드 네크로맨서 [월드 5]", "저주받은 대주교 [월드 6]", "어둠의 정령 [월드 7]", "마족 근위대장 [월드 8]", "마왕성 문지기 [월드 9]", "마왕 (Demon King) [월드 10]"];
    document.getElementById("bossBarLabel").textContent = bossNames[Math.min(w, 10)];
  }
  
  Game.doors.push({ x: Game.levelW - 60, y: CH - TILE - 64, w: 24, h: 64, open: false });
  Game.player = mkP(40, CH - TILE - 20);
  Game.camX = 0;
  updateHUD();
}

function nextStage() {
  Game.levelN++;
  if (Game.levelN > 3) {
    Game.levelN = 1;
    Game.worldN++;
    if (Game.worldN > 10) { 
      Game.gs = "win";
      if (Game.score > Game.highScore) { Game.highScore = Game.score; localStorage.setItem("skull_highscore", Game.highScore); }
      showOv("LORD OF SKULLS (CLEAR)", "모든 악몽을 정복했습니다.", "스코어: " + Game.score + " (최고: " + Game.highScore + ")", "▶ PLAY AGAIN");
      return;
    }
    
    Game.gs = "upgrade";
    playBGM('upgrade');
    
    Game.offeredItems = [];
    let pool = [1,2,3,4,5,6,7,8,9,10];
    for (let i = 0; i < 3; i++) {
        let r = Math.floor(Math.random() * pool.length);
        Game.offeredItems.push(pool[r]);
        pool.splice(r, 1);
    }
    return;
  }
  document.getElementById("bossBarWrap").style.display = "none";
  genStage(Game.worldN, Game.levelN);
  updateHUD();
}