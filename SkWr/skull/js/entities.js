function mkP(x, y) {
  return {
    x, y, w: 14, h: 18, vx: 0, vy: 0, onGround: false,
    hp: Game.pMaxHp, maxHp: Game.pMaxHp, facing: 1, atkT: 0, atkAnim: 0, fr: 0, frT: 0,
    jpOld: false, kbT: 0, guarding: false, jumpCount: 0,
    combo: 0, comboT: 0, dashT: 0, dashCD: 0, parryT: 0, plunging: false,
    dead: false // 💡 캐릭터 사망 상태 추적 변수 추가
  };
}

function mkEnemy(x, y, w) {
  const rand = Math.random(); 
  let type = "melee";
  if (w >= 1) { 
    if (rand < 0.2) type = "ranged_laser"; 
    else if (rand < 0.4) type = "ranged_bullet"; 
    else if (rand < 0.55 && w >= 2) type = "archer"; 
  }
  
  const hp = (15 + w * 10 + (type === "melee" ? 5 : 0)) * 5;
  return {
    x, y, w: 18, h: 24, vx: 0, vy: 0, onGround: false, hp, maxHp: hp, type,
    isBoss: false, facing: 1, fr: 0, frT: 0, flash: 0, 
    sT: 60 + Math.random() * 40, sI: type === "archer" ? 100 : 60,
    atk: 10 + w * 5, pDir: Math.random() < 0.5 ? 1 : -1, pT: 0, dead: false, kbT: 0, 
    warnT: 0, warnData: null, atkAnim: 0, world: w,
  };
}

function mkBoss(x, y, w) {
  const hps = [0, 1500, 2000, 3000, 4500, 6500, 9000, 12000, 16000, 22000, 35000]; 
  const hp = hps[Math.min(w, 10)]; 
  return {
    x, y, w: 70, h: 90, vx: 0, vy: 0, onGround: false, hp, maxHp: hp, type: "boss",
    isBoss: true, facing: 1, fr: 0, frT: 0, flash: 0, 
    sT: 60, sI: 60, phase: 1,
    mT: 50, ap: 0, atk: 15 + w * 5, dead: false, kbT: 0, warnT: 0, warnData: null, atkAnim: 0, world: w,
  };
}

function calcLaser(startX, startY, height, facing) {
  let minHitDist = Game.levelW;
  for (const t of Game.platforms) {
    if (t.y < startY + height && t.y + t.h > startY) {
      if (facing > 0 && t.x > startX) minHitDist = Math.min(minHitDist, t.x - startX);
      else if (facing < 0 && t.x + t.w < startX) minHitDist = Math.min(minHitDist, startX - (t.x + t.w));
    }
  }
  return { x: facing > 0 ? startX : Math.max(0, startX - minHitDist), w: minHitDist };
}

function takeDmg(d, attacker) {
  if (!Game.player) return;
  if (Game.player.dashT > 0 || Game.invT > 0 || Game.player.dead) return; 

  let dir = Game.player.facing;
  if (attacker) { dir = Game.player.x < attacker.x ? -1 : 1; } else { dir = -Game.player.facing; }

  let variance = 0.8 + Math.random() * 0.4;
  let defMultiplier = 50 / (50 + Game.pBaseDef);
  let finalDmg = Math.floor((d * variance) * defMultiplier);
  if (finalDmg < 1) finalDmg = 1;

  if (Game.player.parryT > 0) {
    playSfx('parry'); 
    Game.camShake = 20; Game.hitStop = 15; 
    Game.pMp = Math.min(Game.pMaxMp, Game.pMp + 50); 
    Game.player.parryT = 0; Game.invT = 60; 
    Game.texts.push({ x: Game.player.x, y: Game.player.y - 20, text: "PARRY! MP+50", color: "#ffee00", life: 50, size: 24 });
    for (let i = 0; i < 15; i++) addPart(Game.player.x + 7, Game.player.y + 9, "#ffee00", 25);
    Game.comboCount += 2; Game.comboTimer = 150;
    if (attacker && attacker.hp !== undefined) { attacker.vx = -dir * (attacker.isBoss ? 2 : 8); attacker.kbT = 30; }
    return;
  }

  if (Game.player.guarding) {
    playSfx('hit');
    for (let i = 0; i < 5; i++) addPart(Game.player.x + 7, Game.player.y + 9, "#80d0ff", 15);
    Game.player.vx = dir * 6.5; Game.player.vy = -3.5; Game.player.kbT = 18; Game.invT = 60;
    Game.texts.push({ x: Game.player.x, y: Game.player.y, text: "BLOCK!", color: "#80d0ff", life: 30 }); 
    if (attacker && attacker.hp !== undefined) { attacker.vx = -dir * (attacker.isBoss ? 1 : 5); attacker.kbT = 15; }
    return;
  }

  if (Game.pShield > 0) {
    playSfx('hit');
    if (Game.pShield >= finalDmg) { Game.pShield -= finalDmg; finalDmg = 0; Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: `SHIELD!`, color: "#00ccff", life: 40, size: 20 }); } 
    else { finalDmg -= Game.pShield; Game.pShield = 0; }
  }

  if (finalDmg > 0) {
    playSfx('dmg'); 
    Game.player.hp -= finalDmg; 
    Game.invT = 100; 
    Game.player.vx = dir * 4.5; Game.player.vy = -4.5; Game.player.kbT = 15; Game.camShake = 15; Game.comboCount = 0; 
    for (let i = 0; i < 10; i++) addPart(Game.player.x + 7, Game.player.y + 9, "#ff2222", 20);
    Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: `-${finalDmg}`, color: "#ff2222", life: 40, size: 20 });
  }
  
  if (Game.player.hp <= 0 && !Game.player.dead) {
    // 💡 주인공 사망 연출 트리거! 
    playSfx('player_die'); 
    playBGM('dead'); 
    Game.player.dead = true;
    Game.deadTimer = 120; // 2초간 화면 암전
    
    // 해골이 박살나는 이펙트
    for (let i = 0; i < 40; i++) {
        addPart(Game.player.x + 7, Game.player.y + 9, "#f8f8fa", 60 + Math.random() * 40);
        addPart(Game.player.x + 7, Game.player.y + 9, "#d0d0d5", 50 + Math.random() * 30);
        addPart(Game.player.x + 7, Game.player.y + 9, "#ff0000", 30 + Math.random() * 20);
    }
  }
}

function hitE(e, d, dir, isCrit = false) {
  if (e.dead) return;
  e.hp -= d; e.flash = 8; e.vx = dir * (e.isBoss ? 0.5 : 1); e.vy = -2; e.kbT = 18; 
  playSfx('hit'); 
  
  Game.comboCount++; Game.comboTimer = 150; 
  
  if (Game.pHealOnHit && Math.random() < 0.05 && Game.player.hp < Game.pMaxHp) {
      Game.player.hp = Math.min(Game.pMaxHp, Game.player.hp + 1);
      Game.texts.push({ x: Game.player.x, y: Game.player.y - 20, text: "LIFESTEAL +1", color: "#ff4444", life: 40, size: 16 });
      addPart(Game.player.x + 7, Game.player.y + 9, "#ff4444", 25);
  }

  Game.texts.push({ x: e.x + e.w / 2 + (Math.random() - 0.5) * 12, y: e.y - 5, text: isCrit ? `${d} CRIT!` : d.toString(), color: isCrit ? "#ff1100" : (d > Game.pBaseDmg * 1.2 ? "#ffeb3b" : "#ffffff"), life: 35, size: isCrit ? 22 : 14 });
  if (e.hp <= 0) e.dead = true;
}

function updateBoss(e) {
  const p = Game.player; if (!p || p.dead) return;
  const isP2 = e.hp < e.maxHp * 0.5;
  e.phase = isP2 ? 2 : 1; e.vy = Math.min(e.vy + GRAV, 14);
  const dx = p.x + p.w / 2 - (e.x + e.w / 2), dy = p.y + p.h / 2 - (e.y + e.h / 2);
  if (!e.warnT && e.atkAnim <= 0) e.facing = dx > 0 ? 1 : -1; 
  
  const w = e.world; 
  let currentSpd = isP2 ? 4.5 + w * 0.2 : 3.0 + w * 0.2; 
  
  if (e.atkAnim > 0) e.atkAnim--;
  if (e.kbT > 0) { e.kbT--; e.vx *= 0.88; } 
  else if (e.warnT > 0) {
    e.warnT--; e.vx *= 0.8;
    if (e.warnT <= 0) {
      e.atkAnim = 20; 
      const wd = e.warnData; const originX = wd.facing > 0 ? e.x + e.w : e.x;
      const bDmg = e.atk; const spdM = isP2 ? 1.5 : 1.2; 
      
      if ((w === 5 || w === 9 || w === 10) && isP2 && Math.random() < 0.3) { p.vx -= Math.sign(dx) * 12; p.vy = -3; Game.texts.push({ x: p.x, y: p.y, text: "PULLED!", color: "#cc00ff", life: 30 }); }

      if (w === 1 || w === 2) { 
        if (e.ap === 0) { let arc = isP2 ? 3 : 2; for (let s = -arc; s <= arc; s++) Game.eBullets.push({ x: e.x + 14, y: e.y + 18, vx: Math.cos(wd.ang + s * 0.15) * 8 * spdM, vy: Math.sin(wd.ang + s * 0.15) * 8 * spdM, life: 100, r: 4, dmg: bDmg }); } 
        else { const lBox = calcLaser(originX, e.y + 18, isP2?24:16, wd.facing); Game.lasers.push({ x: lBox.x, y: e.y + 18, w: lBox.w, h: isP2?24:16, life: 18, maxLife: 18, color: "#aa00ff", dmg: Math.floor(bDmg*1.5), unblockable: false }); Game.camShake = 5; } 
      } else if (w === 3 || w === 4) { 
        if (e.ap === 0) { const lBox = calcLaser(originX, e.y + 18, 10, wd.facing); Game.lasers.push({ x: lBox.x, y: e.y + 18, w: lBox.w, h: 10, life: 15, maxLife: 15, color: "#ff1111", dmg: Math.floor(bDmg*1.5), unblockable: false }); let amt = isP2 ? 12 : 8; for (let i = 0; i < amt; i++) Game.eBullets.push({ x: e.x + 14, y: e.y + 18, vx: Math.cos((i * Math.PI) / (amt/2)) * 9 * spdM, vy: Math.sin((i * Math.PI) / (amt/2)) * 9 * spdM, life: 100, r: 4, dmg: bDmg }); } 
        else { let amt = isP2 ? 10 : 6; for (let i = 0; i < amt; i++) { Game.eBullets.push({ x: e.x + e.w/2, y: e.y, vx: e.facing * (3 + Math.random()*6) * spdM, vy: -12 - Math.random()*8, life: 180, r: 6, dmg: bDmg, grav: true, isBomb: true }); } }
      } else if (w >= 5 && w <= 7) { 
        if (e.ap === 0) { const lBox = calcLaser(originX, e.y + 10, isP2?60:40, wd.facing); Game.lasers.push({ x: lBox.x, y: e.y + 10, w: lBox.w, h: isP2?60:40, life: 25, maxLife: 25, color: "#330066", dmg: Math.floor(bDmg*2), unblockable: false }); Game.camShake = 15; } 
        else { let amt = isP2 ? 30 : 20; for (let i = 0; i < amt; i++) Game.eBullets.push({ x: e.x + 14, y: e.y + 18, vx: Math.cos((i * Math.PI) / (amt/2)) * 8 * spdM, vy: Math.sin((i * Math.PI) / (amt/2)) * 8 * spdM, life: 150, r: 5, dmg: bDmg }); } 
      } else if (w === 8 || w === 9) { 
        if (e.ap === 0) { const lBox = calcLaser(originX, e.y + 10, 40, wd.facing); Game.lasers.push({ x: lBox.x, y: e.y + 10, w: lBox.w, h: 40, life: 20, maxLife: 20, color: "#00ff88", dmg: Math.floor(bDmg*2), unblockable: false }); Game.camShake = 12; }
        else { let amt = isP2 ? 15 : 8; for (let i = 0; i < amt; i++) Game.eBullets.push({ x: e.x + e.w/2, y: e.y, vx: (Math.random()-0.5)*18, vy: -15 - Math.random()*8, life: 180, r: 6, dmg: bDmg, grav: true, isBomb: true }); }
      } else { 
        if (e.ap === 0) { 
            const lBox = calcLaser(originX, e.y, 80, wd.facing); 
            Game.lasers.push({ x: lBox.x, y: e.y - 20, w: lBox.w, h: 40, life: 30, maxLife: 30, color: "#ff0000", dmg: Math.floor(bDmg*3), unblockable: false }); 
            Game.lasers.push({ x: lBox.x, y: e.y + 40, w: lBox.w, h: 40, life: 35, maxLife: 35, color: "#aa0000", dmg: Math.floor(bDmg*3), unblockable: false }); 
            Game.camShake = 25; 
        }
        else if (e.ap === 1) { 
            let amt = 50; 
            for (let i = 0; i < amt; i++) Game.eBullets.push({ x: e.x + 14, y: e.y + 18, vx: Math.cos((i * Math.PI) / (amt/2)) * 12 * spdM, vy: Math.sin((i * Math.PI) / (amt/2)) * 12 * spdM, life: 150, r: 6, dmg: bDmg }); 
        }
        else { 
            let amt = 35; 
            for (let i = 0; i < amt; i++) Game.eBullets.push({ x: e.x + e.w/2, y: e.y, vx: (Math.random()-0.5)*30, vy: -20 - Math.random()*15, life: 250, r: 8, dmg: bDmg, grav: true, isBomb: true }); 
        }
      }
    }
  } else {
    e.mT -= (w === 10 ? 1.5 : 1); 
    if (e.mT <= 0) { 
      e.mT = isP2 ? 15 : 30; 
      if (Math.abs(dx) > 250) currentSpd *= 2.5; 
      if (e.onGround && dy < -60 && Math.random() < 0.7) { e.vy = -13; } 
      if ((w === 2 || w === 7 || w === 10) && isP2 && Math.random() < 0.4) { e.x = p.x - e.facing * 50; e.y = p.y - 10; Game.texts.push({x: e.x, y: e.y, text: "TELEPORT!", color: "#aa00ff", life: 30}); } 
    }
    e.vx = e.facing * currentSpd; 
    e.sT--;
    
    if (e.sT <= 0) { 
        e.sI = Math.max(15, 80 - w * 6); 
        e.sT = e.sI * (isP2 ? 0.4 : 0.7); 
        e.ap = Math.floor(Math.random() * (isP2 ? 3 : 2)); 
        e.warnT = isP2 ? 15 : 25; 
        e.warnData = { ang: Math.atan2(dy, dx), facing: e.facing, ap: e.ap }; 
        e.vx = 0; 
    }
  }

  let attemptedVx = e.vx;
  resolveAABB(e); 
  e.x = Math.max(0, Math.min(Game.levelW - e.w, e.x));
  
  if (e.onGround && attemptedVx !== 0 && e.vx === 0 && e.atkAnim <= 0 && e.warnT <= 0) {
      e.vy = -13; 
  }

  if (Game.invT === 0 && overlap(Game.player, { x: e.x, y: e.y, w: e.w, h: e.h }) && Game.gs !== "dead") takeDmg(e.atk, e);
  if (e.y > CH + 60) e.dead = true;
}