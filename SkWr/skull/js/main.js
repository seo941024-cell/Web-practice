function drawBone(isLarge) {
    ctx.save();
    if (isLarge) ctx.scale(1.5, 1.5);
    const ext = Game.pRangeBonus; 
    ctx.fillStyle = "#d4b895"; ctx.fillRect(0, -2, 10 + ext, 4); 
    ctx.fillStyle = "#f8f8fa"; ctx.fillRect(2, -3, 14 + ext, 6); 
    ctx.fillRect(14 + ext, -5, 4, 4); ctx.fillRect(14 + ext, 1, 4, 4);  
    ctx.fillStyle = "#d0d0d5"; ctx.fillRect(4, 1, 10 + ext, 2);  
    ctx.fillRect(15 + ext, 3, 2, 2);
    ctx.restore();
}

function updateEnvironment() {
    Game.platforms.forEach(t => { 
        if (t.vx) { 
            t.x += t.vx; 
            if (t.x < t.boundL || t.x > t.boundR) t.vx *= -1; 
        } 
        if (t.drop) {
            if (Game.player && Game.player.onGround && Game.player.riding === t && Game.gs !== "dead") { t.fallActive = true; }
            if (t.fallActive) {
                t.fallTimer = (t.fallTimer || 0) + 1;
                if (t.fallTimer > 30) { t.vy = (t.vy || 0) + GRAV; t.y += t.vy; }
            }
        }
    });
    Game.platforms = Game.platforms.filter(t => t.y < CH + 200);
}

function updatePlayer() {
    const p = Game.player;
    // 💡 죽었을 때 조작 불가능 및 암전 처리 
    if (p.dead) {
        if (Game.deadTimer > 0) {
            Game.deadTimer--;
            if (Game.deadTimer <= 0) {
                Game.gs = "dead";
                if (Game.score > Game.highScore) { Game.highScore = Game.score; localStorage.setItem("skull_highscore", Game.highScore); }
                showOv("YOU DIED", "스코어: " + Game.score, "최고 스코어: " + Game.highScore, "▶ RETRY");
            }
        }
        // 시체는 중력만 받아 떨어지게 둠
        p.vy += GRAV; p.y += p.vy;
        return; 
    }

    p.frT++; if (p.frT > 7) { p.fr = (p.fr + 1) % 4; p.frT = 0; }
    
    if (Game.camShake > 0) Game.camShake--;
    if (Game.comboTimer > 0) { Game.comboTimer--; if (Game.comboTimer <= 0) Game.comboCount = 0; }

    if (p.onGround && p.riding && p.riding.vx) p.x += p.riding.vx;

    const guardNow = dn("KeyV");
    if (guardNow && !p.guarding && p.kbT <= 0 && p.dashT <= 0 && p.atkT === 0) { 
        p.parryT = 21 + Game.pParryBonus; 
    }
    if (p.parryT > 0) p.parryT--; 
    p.guarding = guardNow;

    if (dn("KeyZ") && p.dashCD <= 0 && !p.guarding && p.kbT <= 0 && p.atkT === 0) {
        p.dashT = 15; p.dashCD = 75; p.vy = 0; p.plunging = false; playSfx('dash'); 
    }
    
    if (p.dashT > 0) {
        p.dashT--; p.vx = p.facing * 8; p.vy = 0; addPart(p.x + 7, p.y + 9, "#ffffff", 10); 
    } else if (p.kbT > 0) {
        p.kbT--; p.vx *= 0.9;
    } else {
        let mx = 0; 
        if (!p.guarding && !p.plunging) { 
            if (dn("ArrowLeft", "KeyA")) mx = -1; 
            if (dn("ArrowRight", "KeyD")) mx = 1; 
        }
        if (mx !== 0) p.facing = mx; 
        p.vx = mx * 3.6; 
    }
    if (p.dashCD > 0) p.dashCD--;

    if (p.onGround) p.jumpCount = 0;
    const jpNow = dn("KeyX", "ArrowUp", "Space");
    if (jpNow && !p.jpOld && !p.guarding && p.kbT <= 0 && !p.plunging && p.atkT === 0) {
        if (p.onGround || p.dashT > 0) { 
            p.vy = -9.6; p.jumpCount = 1; 
            if(p.dashT > 0) { p.dashT = 0; p.vx = p.facing * 5; } 
            playSfx('jump'); 
            for (let i = 0; i < 4; i++) addPart(p.x + 7, p.y + 18, "#6060ff", 12); 
        } else if (p.jumpCount < 2) { 
            p.vy = -8.8; p.jumpCount = 2; p.dashT = 0; 
            playSfx('jump');
            for (let i = 0; i < 6; i++) addPart(p.x + 7, p.y + 18, "#ff60ff", 15); 
        }
    }
    p.jpOld = jpNow;

    if (!p.onGround && dn("ArrowDown") && dn("KeyC") && !p.plunging && p.atkT === 0 && p.dashT <= 0) { p.plunging = true; p.vy = 16; p.vx = 0; }
    if (p.plunging) { p.vy = 16; p.vx = 0; addPart(p.x + 7, p.y + 9, "#ffaa00", 5); } else if (p.dashT <= 0) { p.vy = Math.min(p.vy + GRAV, 14); }

    resolveAABB(p);
    
    if (p.plunging && p.onGround) {
        p.plunging = false; p.atkT = 20; Game.camShake = 15; Game.hitStop = 8; playSfx('hit');
        for (let i = 0; i < 20; i++) addPart(p.x + 7, p.y + 18, "#ffffff", 20);
        let pdmg = Math.floor(Game.pBaseDmg * 2.5 * (1 + Game.pExtraDmg));
        Game.bullets.push({ x: p.x - 10, y: p.y + 5, vx: -10, vy: 0, life: 15, r: 12, sk: false, dmg: pdmg });
        Game.bullets.push({ x: p.x + 10, y: p.y + 5, vx: 10, vy: 0, life: 15, r: 12, sk: false, dmg: pdmg });
    }

    p.x = Math.max(0, Math.min(Game.levelW - p.w, p.x));
    if (p.y > CH + 60) { p.guarding = false; p.plunging = false; takeDmg(10, null, true); p.x = 80; p.y = CH - TILE - 22; p.vx = 0; p.vy = 0; }

    if (p.atkT > 0) p.atkT--; if (p.atkAnim > 0) p.atkAnim--; if (Game.invT > 0) Game.invT--;
}

function updatePlayerCombat() {
    const p = Game.player;
    if (p.dead) return;

    if (dn("KeyC") && !dn("ArrowDown") && p.atkT === 0 && !p.guarding && p.kbT <= 0 && p.dashT <= 0 && !p.plunging) {
        playSfx('atk');
        p.combo = (p.combo % 3) + 1; const isLastHit = p.combo === 3;
        
        p.atkT = Math.max(1, Math.floor((isLastHit ? 35 : 16) / Game.pAtkSpd));
        p.atkAnim = Math.max(1, Math.floor((isLastHit ? 20 : 12) / Game.pAtkSpd));
        
        p.comboT = 50;
        if (!p.onGround) p.vy = Math.min(p.vy, 1);

        const rangeX = (isLastHit ? 45 : 30) + Game.pRangeBonus; 
        const rangeY = (isLastHit ? 55 : 40) + Game.pRangeBonus * 0.5; 
        const cx = p.x + 7 + p.facing * (rangeX / 2 + 5); const cy = p.y + 9;

        let baseRoll = Math.floor((isLastHit ? Game.pBaseDmg * 2.2 : Game.pBaseDmg) * (0.8 + Math.random() * 0.4));
        let dmg = Math.floor(baseRoll * (1 + Game.pExtraDmg)); 
        let isCrit = false;

        if (Math.random() < 0.20) { dmg = Math.floor(dmg * 1.5); isCrit = true; }
        if (dmg < 1) dmg = 1;

        let hitTarget = false;
        Game.enemies.forEach((e) => {
            if (!e.dead && Math.abs(e.x + e.w / 2 - cx) < rangeX / 2 + e.w / 2 && Math.abs(e.y + e.h / 2 - cy) < rangeY / 2 + e.h / 2) {
                hitE(e, dmg, p.facing, isCrit); hitTarget = true;
            }
        });

        if (isLastHit) Game.camShake = 8; 
        if (hitTarget) { Game.pMp = Math.min(Game.pMaxMp, Game.pMp + (isLastHit ? 15 : 8)); if (isLastHit) Game.hitStop = 6; } 
        for (let i = 0; i < (isLastHit ? 15 : 6); i++) { addPart(cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20, isLastHit ? "#ff2222" : "#ffffff", 15); }
    }

    if (dn("ShiftLeft", "ShiftRight") && Game.pMp >= Game.pMaxMp && !p.guarding && p.kbT <= 0 && p.dashT <= 0 && !p.plunging) {
        Game.pMp = 0; playSfx('skill'); Game.camShake = 45; Game.hitStop = 10;
        const megaDmg = Math.floor(Game.pBaseDmg * 15 * Game.pSkillDmgMul); 
        
        const arcs = Game.pMultiLaser ? [-0.2, 0, 0.2] : [0];
        arcs.forEach(angle => {
            Game.lasers.push({
                x: p.facing > 0 ? p.x + p.w : 0, y: p.y - 25 + (angle * 100),
                w: p.facing > 0 ? Game.levelW : p.x, h: 70, life: 50, maxLife: 50, color: "#0088ff", dmg: megaDmg, unblockable: false, isPlayer: true 
            });
        });
        for (let i = 0; i < 40; i++) addPart(p.x + 7, p.y + 9, "#0088ff", 35);
        Game.texts.push({ x: p.x, y: p.y - 30, text: "OBLITERATE!!", color: "#00ffff", life: 60, size: 26 });
    }
}

function updateEnemies() {
    Game.enemies.forEach(e => {
        if (e.dead) return;
        e.frT++; if (e.frT > 10) { e.fr = (e.fr + 1) % 2; e.frT = 0; }
        if (e.flash > 0) e.flash--;

        if (e.isBoss) { if (typeof updateBoss === 'function') updateBoss(e); return; }

        e.vy = Math.min(e.vy + GRAV, 14);
        if (e.onGround && e.riding && e.riding.vx) e.x += e.riding.vx;

        let attemptedVx = 0;

        if (e.kbT > 0) {
            e.kbT--; e.vx *= 0.88;
            attemptedVx = e.vx;
        } else {
            const dx = Game.player.x - e.x; const dy = Game.player.y - e.y;
            
            if (e.type === "melee") {
                e.sT--;
                if (Math.abs(dx) < 65 && Math.abs(dy) < 40 && e.sT <= 0 && e.warnT <= 0 && e.atkAnim <= 0) {
                    e.warnT = 35; e.sT = e.sI; e.vx = 0; e.facing = dx > 0 ? 1 : -1; 
                }
                
                if (e.warnT > 0) {
                    e.warnT--; e.vx = 0; 
                    if (e.warnT <= 0) {
                        e.atkAnim = 15; playSfx('atk');
                        if ((e.facing > 0 && Game.player.x > e.x && Game.player.x - e.x < 70) || (e.facing < 0 && Game.player.x < e.x && e.x - Game.player.x < 70)) {
                            if (Math.abs(Game.player.y - e.y) < 45) takeDmg(e.atk, e);
                        }
                    }
                } else if (e.atkAnim > 0) {
                    e.atkAnim--; e.vx = 0;
                } else {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 350) {
                        e.facing = dx > 0 ? 1 : -1; e.vx += (dx > 0 ? 1 : -1) * 0.2; e.vx = Math.max(-2.2, Math.min(2.2, e.vx));
                    } else {
                        e.pT--; if (e.pT <= 0) { e.pT = 60 + Math.random() * 60; e.pDir *= -1; } e.vx = e.pDir * 1.5;
                    }
                }
            } else if (e.type === "archer") {
                if (e.warnT > 0) {
                    e.warnT--; e.vx *= 0.5;
                    if (e.warnT <= 0) {
                        const T = 60; const targetX = Game.player.x + Game.player.vx * 10; 
                        const pDX = targetX - e.x; const pDY = Game.player.y - e.y;
                        const bVx = pDX / T; const bVy = (pDY - 0.5 * 0.4 * T * T) / T; 
                        Game.eBullets.push({ x: e.x + 6, y: e.y + 8, vx: bVx, vy: bVy, life: 120, r: 5, dmg: e.atk, grav: true, isArrow: true });
                    }
                } else {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 400) {
                        e.facing = dx > 0 ? 1 : -1;
                        if (dist < 200) e.vx += (dx > 0 ? -1 : 1) * 0.2; 
                        else e.vx *= 0.9;
                        e.vx = Math.max(-1.8, Math.min(1.8, e.vx)); e.sT--;
                        if (e.sT <= 0) { e.sT = e.sI; e.warnT = 30; e.warnData = { facing: e.facing }; }
                    } else { e.pT--; if (e.pT <= 0) { e.pT = 60 + Math.random() * 60; e.pDir *= -1; } e.vx = e.pDir * 1.0; }
                }
            } else { 
                if (e.warnT > 0) {
                    e.warnT--; e.vx *= 0.8;
                    if (e.warnT <= 0) {
                        const ang = e.warnData.ang;
                        if (e.type === "ranged_bullet") {
                            for (let s = -1; s <= 1; s++) { Game.eBullets.push({ x: e.x + 6, y: e.y + 8, vx: Math.cos(ang + s * 0.15) * 7, vy: Math.sin(ang + s * 0.15) * 7, life: 80, r: 4, dmg: e.atk }); }
                        } else {
                            const originX = e.facing > 0 ? e.x + e.w : e.x;
                            const lBox = calcLaser(originX, e.y + 6, 6, e.facing);
                            Game.lasers.push({ x: lBox.x, y: e.y + 6, w: lBox.w, h: 6, life: 12, maxLife: 12, color: "#ff3300", dmg: e.atk, unblockable: false });
                        }
                    }
                } else {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 250) {
                        e.facing = dx > 0 ? 1 : -1;
                        if (dist < 120) e.vx += (dx > 0 ? -1 : 1) * 0.15; else e.vx *= 0.9;
                        e.vx = Math.max(-2.0, Math.min(2.0, e.vx)); e.sT--;
                        if (e.sT <= 0) { e.sT = e.sI; e.warnT = e.type === "ranged_laser" ? 40 : 25; e.warnData = { ang: Math.atan2(dy, dx), facing: e.facing }; }
                    } else { e.pT--; if (e.pT <= 0) { e.pT = 60 + Math.random() * 60; e.pDir *= -1; } e.vx = e.pDir * 1.2; }
                }
            }
            attemptedVx = e.vx;
        }

        if (e.onGround && e.kbT <= 0 && e.warnT <= 0 && e.atkAnim <= 0) {
            let cx = e.vx > 0 ? e.x + e.w + e.vx + 2 : e.x + e.vx - 2; 
            let cy = e.y + e.h + 4; let safe = false;
            for (const t of Game.platforms) { if (cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h) { safe = true; break; } }
            if (!safe) { 
                if (e.type === "melee" && Math.abs(Game.player.x - e.x) < 250 && (Game.player.y - e.y) < 0) { e.vy = -10.5; } 
                else { e.vx = 0; e.pDir *= -1; attemptedVx = 0; }
            }
        }

        resolveAABB(e); 
        
        if (e.vx === 0 && attemptedVx !== 0 && e.kbT <= 0 && e.type === "melee") {
            if (e.onGround) e.vy = -10.5;
            e.pDir *= -1;
        }

        e.x = Math.max(0, Math.min(Game.levelW - e.w, e.x));
        
        // 💡 몹 낙사 버그 완벽 수정 (화면 밖으로 떨어지면 즉사 처리)
        if (e.y > CH + 50) { e.hp = 0; e.dead = true; }
        
        if (Game.invT === 0 && overlap(Game.player, { x: e.x, y: e.y, w: e.w, h: e.h }) && !Game.player.dead) takeDmg(e.atk, e);
    });

    Game.enemies = Game.enemies.filter((e) => {
        if (e.dead) {
            Game.score += e.isBoss ? 500 : 50; Game.kills++;
            playSfx('enemy_die'); 
            for (let i = 0; i < 25; i++) addPart(e.x + e.w / 2, e.y + e.h / 2, Math.random() < 0.5 ? "#ff0000" : "#aa0000", 20 + Math.random() * 20);

            if (Math.random() < 0.35 || e.isBoss) {
                let randType = "hp"; let roll = Math.random();
                if (e.isBoss) { if(roll < 0.33) randType = "atk_drop"; else if(roll < 0.66) randType = "range_drop"; else randType = "def_drop"; } 
                else { if (roll < 0.40) randType = "hp"; else if (roll < 0.60) randType = "atk_drop"; else if (roll < 0.80) randType = "range_drop"; else randType = "def_drop"; }
                Game.items.push({ x: e.x + e.w/2 - 5, y: Math.min(e.y, CH - 20), w: 10, h: 10, vy: -4, life: 600, type: randType });
            }
            if (Game.enemies.length === 1 && !e.isBoss) { playSfx('clear'); } else if (e.isBoss) { playSfx('clear'); }
            return false;
        }
        return true;
    });
}

function updateProjectiles() {
    Game.bullets.forEach((b) => { b.x += b.vx; b.y += b.vy; b.vy += b.sk ? 0.05 : 0; b.life--; }); 
    Game.bullets = Game.bullets.filter((b) => b.life > 0);
    Game.bullets.forEach((b) => {
        for (const t of Game.platforms) { if (overlap({ x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 }, t)) { b.life = 0; return; } }
        Game.enemies.forEach((e) => {
            if (!e.dead && Math.abs(e.x + e.w / 2 - b.x) < e.w / 2 + b.r && Math.abs(e.y + e.h / 2 - b.y) < e.h / 2 + b.r) { 
                hitE(e, b.dmg || Game.pBaseDmg, b.vx > 0 ? 1 : -1, false); if (b.sk) Game.hitStop = 3; b.life = 0; 
            }
        });
    });

    Game.eBullets.forEach((b) => { 
        b.x += b.vx; b.y += b.vy; 
        if (b.grav) b.vy += 0.4; else b.vy += 0.12; 
        b.life--; 
    }); 
    Game.eBullets = Game.eBullets.filter((b) => b.life > 0 && b.y < CH + 30);
    
    Game.eBullets.forEach((b) => {
        for (const t of Game.platforms) { if (overlap({ x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 }, t)) { b.life = 0; return; } }
        if (Game.invT === 0 && Math.abs(Game.player.x + 7 - b.x) < 11 && Math.abs(Game.player.y + 9 - b.y) < 12 && !Game.player.dead) { takeDmg(b.dmg || 15, b, b.unblockable); b.life = 0; }
    });

    Game.lasers.forEach((l) => {
        if (l.isPlayer) {
            if (!l.hitTargets) l.hitTargets = new Set();
            if (l.life > l.maxLife - 15) { 
                Game.enemies.forEach(e => {
                    if (!e.dead && overlap(e, l) && !l.hitTargets.has(e)) { hitE(e, l.dmg, Game.player.facing, true); l.hitTargets.add(e); }
                });
            }
        } else {
            if (l.life > l.maxLife - 5) { 
                if (Game.invT === 0 && Game.player.x + Game.player.w > l.x && Game.player.x < l.x + l.w && Game.player.y + Game.player.h > l.y && Game.player.y < l.y + l.h && !Game.player.dead) { takeDmg(l.dmg || 20, null, l.unblockable); }
            }
        }
        l.life--;
    });
    Game.lasers = Game.lasers.filter((l) => l.life > 0);
}

function updateItemsAndMisc() {
    Game.texts.forEach(t => { t.y -= 0.8; t.life--; }); 
    Game.texts = Game.texts.filter(t => t.life > 0);

    Game.items.forEach(i => {
        i.vy = Math.min(i.vy + GRAV, 8);  i.y += i.vy; let groundFound = false;
        Game.platforms.forEach(t => { if (overlap({x: i.x, y: i.y, w: i.w, h: i.h}, t) && i.vy > 0) { i.y = t.y - i.h; i.vy = 0; groundFound = true; } });
        if(groundFound) i.life--;
        
        if (overlap(Game.player, {x: i.x, y: i.y, w: i.w, h: i.h}) && !Game.player.dead) {
            playSfx('item');
            if (i.type === "hp") {
                if (Game.player.hp < Game.pMaxHp) { Game.player.hp = Math.min(Game.pMaxHp, Game.player.hp + 20); Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: "+20 HP", color: "#27ae60", life: 40, size: 14 }); } 
                else { Game.score += 100; Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: "+100 SCORE", color: "#aaaaff", life: 40, size: 14 }); }
            } else if (i.type === "atk_drop") { Game.pBaseDmg += 5; Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: "ATK UP! (+5)", color: "#ff6200", life: 50, size: 16 });
            } else if (i.type === "range_drop") { Game.pRangeBonus += 6; Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: "RANGE UP! (+6)", color: "#00ccff", life: 50, size: 16 }); // 💡 범위 증가치 너프 복구
            } else if (i.type === "def_drop") { Game.pBaseDef += 5; Game.texts.push({ x: Game.player.x, y: Game.player.y - 10, text: "DEF UP! (+5)", color: "#b0bec5", life: 50, size: 16 }); }
            i.life = 0; updateHUD();
        }
    });
    Game.items = Game.items.filter(i => i.life > 0);

    Game.parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vx *= 0.87; p.vy *= 0.87; p.life--; }); 
    Game.parts = Game.parts.filter((p) => p.life > 0);
    
    const allDead = Game.enemies.length === 0;
    Game.doors.forEach((d) => { d.open = allDead; if (d.open && Game.player && overlap(Game.player, { x: d.x, y: d.y, w: d.w, h: d.h }) && !Game.player.dead) nextStage(); });
}

function update() {
    if (Game.hitStop > 0) { Game.hitStop--; if (Game.camShake > 0) Game.camShake--; return; }
    if (!Game.player) return;

    updateEnvironment();
    updatePlayer();
    updatePlayerCombat();
    updateEnemies();
    updateProjectiles();
    updateItemsAndMisc();

    Game.camX += (Game.player.x - CW / 3 - Game.camX) * 0.1; 
    Game.camX = Math.max(0, Math.min(Game.levelW - CW, Game.camX));
    updateHUD();
}

// ==========================================
// 3. 그래픽(Render) 분할 모듈화
// ==========================================
function drawBackground() {
    const themes = [
        ["#050508", "#0d0d14", "#1a1a25"], 
        ["#0a140a", "#142214", "#2a3c2a"], ["#05101a", "#0a1a2a", "#1a2a3c"], 
        ["#1a0505", "#2a0a0a", "#4a1414"], ["#1a1a1a", "#2a2a2a", "#ddcc88"], 
        ["#10001a", "#1a002a", "#3a0055"], ["#220000", "#330000", "#550000"], 
        ["#000022", "#000033", "#000055"], ["#001111", "#002222", "#003333"], 
        ["#111111", "#222222", "#444444"], ["#2a0000", "#110000", "#000000"]  
    ];
    const tColors = themes[Math.min(Game.worldN, 10)];

    ctx.fillStyle = tColors[0]; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = tColors[1];
    for (let i = 0; i < 18; i++) {
        const bx = ((i * 173) % Game.levelW) * 0.3 - Game.camX * 0.3; const mod = bx % CW;
        if (mod > -20 && mod < CW + 20) ctx.fillRect(mod, 20 + ((i * 61) % 100), 4, 30 + ((i * 7) % 60));
    }
    return tColors;
}

function drawEnvironment(tColors) {
    Game.items.forEach(i => {
        const ix = i.x - Game.camX; if (ix < -10 || ix > CW) return;
        if (i.life < 100 && Math.floor(i.life / 5) % 2 === 0) return;
        if (i.type === "hp") ctx.fillStyle = "#ff1111"; else if (i.type === "atk_drop") ctx.fillStyle = "#ff6200"; else if (i.type === "def_drop") ctx.fillStyle = "#b0bec5"; else ctx.fillStyle = "#00ccff"; 
        ctx.fillRect(ix, i.y, 10, 10); ctx.fillStyle = "#ffffff"; ctx.fillRect(ix + 3, i.y + 2, 4, 4); ctx.strokeStyle = "#000000"; ctx.strokeRect(ix, i.y, 10, 10);
    });

    Game.platforms.forEach((t) => {
        const tx = t.x - Game.camX, ty = t.y; if (tx > CW + TILE || tx < -TILE) return;
        if (t.float) { 
            ctx.fillStyle = t.drop ? "#3a2222" : tColors[2]; 
            if (t.fallTimer > 0) { ctx.globalAlpha = Math.max(0, 1 - (t.fallTimer/50)); }
            ctx.fillRect(tx + (t.fallTimer > 0 && t.fallTimer < 30 ? Math.random()*2-1 : 0), ty, t.w, t.h); 
            ctx.fillStyle = t.drop ? "#552222" : "#333344"; ctx.fillRect(tx, ty, t.w, 4); 
            ctx.globalAlpha = 1;
        } else { 
            ctx.fillStyle = "#110d0d"; ctx.fillRect(tx, ty, t.w, t.h); ctx.fillStyle = "#2a1a1a"; ctx.fillRect(tx, ty, t.w, 4); ctx.fillStyle = "#0a0505"; ctx.fillRect(tx, ty + 4, t.w, t.h - 4); ctx.fillStyle = "#150a0a"; for (let i = 0; i < t.w; i += TILE) ctx.fillRect(tx + i, ty, 1, t.h); 
        }
    });

    Game.doors.forEach((d) => {
        const dx = d.x - Game.camX;
        ctx.fillStyle = d.open ? "#00220a" : "#110000"; ctx.fillRect(dx, d.y, d.w, d.h);
        ctx.fillStyle = d.open ? "#00aa44" : "#551111"; ctx.fillRect(dx + 4, d.y + 4, d.w - 8, d.h - 8);
        if (d.open) { ctx.fillStyle = "#44ff88"; ctx.fillRect(dx + 8, d.y + 8, d.w - 16, d.h - 16); }
        ctx.fillStyle = d.open ? "#ffffff" : "#ff5555"; ctx.font = "10px NeoDunggeunmo"; ctx.textAlign = "center"; ctx.fillText(d.open ? "ENTER" : "SEALED", dx + d.w / 2, d.y + d.h / 2 + 3); ctx.textAlign = "left";
    });
}

function drawEntities() {
    Game.eBullets.forEach((b) => {
        const bx = b.x - Game.camX; if (bx < -10 || bx > CW + 10) return;
        if (b.unblockable) { 
            ctx.fillStyle = "#9900ff"; ctx.beginPath(); ctx.arc(bx, b.y, b.r * 1.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(bx, b.y, b.r * 0.7, 0, Math.PI * 2); ctx.fill(); 
        } else if (b.isArrow) {
            ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.arc(bx, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(bx, b.y, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
        } else if (b.isBomb) {
            ctx.fillStyle = "#ff5500"; ctx.beginPath(); ctx.arc(bx, b.y, b.r*1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffff00"; ctx.beginPath(); ctx.arc(bx, b.y, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
        } else { 
            ctx.fillStyle = "#ff2222"; ctx.beginPath(); ctx.arc(bx, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffaaaa"; ctx.beginPath(); ctx.arc(bx, b.y, b.r * 0.5, 0, Math.PI * 2); ctx.fill(); 
        }
    });

    Game.bullets.forEach((b) => { const bx = b.x - Game.camX; if (bx < -10 || bx > CW + 10) return; ctx.fillStyle = b.sk ? "#44ddff" : "#ffcc22"; ctx.beginPath(); ctx.arc(bx, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
    
    Game.lasers.forEach((l) => { 
        const lx = l.x - Game.camX; if (lx + l.w < 0 || lx > CW) return; 
        ctx.save(); ctx.globalAlpha = l.life / l.maxLife; ctx.fillStyle = l.color; ctx.fillRect(lx, l.y, l.w, l.h); 
        if (l.isPlayer) { ctx.fillStyle = "#ffffff"; ctx.fillRect(lx, l.y + l.h * 0.2, l.w, l.h * 0.6); } 
        else { ctx.fillStyle = "#ffffff"; ctx.fillRect(lx, l.y + l.h * 0.3, l.w, l.h * 0.4); }
        ctx.restore(); 
    });
    
    Game.parts.forEach((pt) => { const px = pt.x - Game.camX; if (px < -10 || px > CW + 10) return; ctx.globalAlpha = pt.life / pt.ml; ctx.fillStyle = pt.col; ctx.fillRect(px - 2, pt.y - 2, 4, 4); ctx.globalAlpha = 1; });

    Game.enemies.forEach((e) => {
        const ex = e.x - Game.camX; if (ex < -50 || ex > CW + 50) return;
        ctx.save(); ctx.translate(Math.round(ex + e.w / 2), Math.round(e.y + e.h / 2));

        if (e.warnT > 0) {
            ctx.save();
            if (e.isBoss) {
                const maxW = e.phase === 1 ? 35 : 25; ctx.globalAlpha = 0.2 + (1 - e.warnT / maxW) * 0.5; ctx.fillStyle = "#ff0033"; const wd = e.warnData;
                if (e.world === 1) {
                    if (wd.ap === 0) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 450, wd.ang - 0.3, wd.ang + 0.3); ctx.fill(); }
                    else if (wd.ap === 1) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 450, wd.ang - 0.5, wd.ang + 0.5); ctx.fill(); }
                    else { ctx.beginPath(); ctx.arc(0, 0, 500, 0, Math.PI * 2); ctx.fill(); }
                } else if (e.world === 2) {
                    if (wd.ap === 0) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 400, wd.facing > 0 ? -Math.PI * 0.8 : -Math.PI, wd.facing > 0 ? 0 : -Math.PI * 0.2); ctx.fill(); }
                    else if (wd.ap === 1) { ctx.fillStyle = "#9900ff"; ctx.fillRect(wd.facing > 0 ? 0 : -800, -28, 800, 16); ctx.fillRect(wd.facing > 0 ? 0 : -800, 4, 800, 16); }
                    else { ctx.fillStyle = "#ff0033"; ctx.fillRect(wd.facing > 0 ? 0 : -800, -23, 800, 35); }
                } else if (e.world === 3) {
                    if (wd.ap === 0) { ctx.fillStyle = "#ff0000"; ctx.fillRect(-800, 0, 1600, 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 500, wd.ang - 0.2, wd.ang + 0.2); ctx.fill(); }
                    else if (wd.ap === 1) { ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.fill(); }
                    else { ctx.fillRect(-800, -28, 1600, 12); ctx.fillRect(-800, 17, 1600, 12); ctx.beginPath(); ctx.arc(0, 0, 500, 0, Math.PI * 2); ctx.fill(); }
                } else if (e.world === 4) {
                    ctx.fillStyle = "#ffd700";
                    if (wd.ap === 0) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 400, wd.ang - 0.4, wd.ang + 0.4); ctx.fill(); }
                    else if (wd.ap === 1) { ctx.fillRect(wd.facing > 0 ? 0 : -800, -10, 800, 20); }
                    else { ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.fill(); }
                } else {
                    ctx.fillStyle = "#330066";
                    if (wd.ap === 0) { ctx.fillRect(wd.facing > 0 ? 0 : -800, -20, 800, 40); }
                    else if (wd.ap === 1) { ctx.beginPath(); ctx.arc(0, 0, 600, 0, Math.PI * 2); ctx.fill(); }
                    else { ctx.fillRect(wd.facing > 0 ? 0 : -800, -10, 800, 16); ctx.beginPath(); ctx.arc(0, 0, 400, wd.ang - 0.5, wd.ang + 0.5); ctx.fill(); }
                }
            } else {
                if (e.type === "ranged_bullet") { ctx.globalAlpha = 0.2 + (1 - e.warnT / 25) * 0.4; ctx.fillStyle = "#ffaa00"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 350, e.warnData.ang - 0.3, e.warnData.ang + 0.3); ctx.fill(); }
                else if (e.type === "ranged_laser") { ctx.globalAlpha = 0.5 + (1 - e.warnT / 40) * 0.5; ctx.fillStyle = "#ff2222"; ctx.fillRect(e.warnData.facing > 0 ? 0 : -800, -2, 800, 4); }
                else if (e.type === "archer") { ctx.globalAlpha = 0.5 + (1 - e.warnT / 30) * 0.5; ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); }
                else if (e.type === "melee") { 
                    ctx.globalAlpha = 0.15 + (1 - e.warnT / 35) * 0.3; 
                    ctx.fillStyle = "#ff0033"; 
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 65, e.facing > 0 ? -0.7 : Math.PI - 0.7, e.facing > 0 ? 0.7 : Math.PI + 0.7); ctx.fill(); 
                }
            }
            ctx.restore();
        }

        ctx.scale(e.facing, 1); if (e.flash > 0 && e.flash % 2 === 0) ctx.globalAlpha = 0.4;
        const eBob = e.onGround && e.vx !== 0 ? (e.fr === 0 ? -1 : 0) : 0;
        const legL = e.fr === 0 ? 0 : -2; const legR = e.fr === 0 ? -2 : 0;
        const wRot = e.warnT > 0 ? -Math.PI*0.3 : (e.atkAnim > 0 ? Math.PI*0.6 : 0); 

        if (e.isBoss) {
            ctx.scale(2.5, 2.5);
            if (e.world === 1) { 
                ctx.fillStyle = "#1a552a"; ctx.fillRect(-12, -12 + eBob, 24, 22); ctx.fillStyle = "#2e8b57"; ctx.fillRect(-8, -20 + eBob, 16, 14); ctx.fillStyle = "#eeaa00"; ctx.fillRect(-8, -24 + eBob, 16, 4); ctx.fillRect(-8, -26 + eBob, 3, 2); ctx.fillRect(-2, -26 + eBob, 3, 2); ctx.fillRect(5, -26 + eBob, 3, 2); ctx.fillStyle = e.phase === 2 ? "#ff2222" : "#000"; ctx.fillRect(-4, -16 + eBob, 3, 3); ctx.fillRect(4, -16 + eBob, 3, 3); 
                ctx.save(); ctx.translate(10, -5 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#8b4513"; ctx.fillRect(0, -10, 6, 25); ctx.restore(); 
            } else if (e.world === 2) { 
                ctx.fillStyle = "#e0e0e0"; ctx.fillRect(-10, -22 + eBob, 20, 16); ctx.fillStyle = e.phase === 2 ? "#ff0033" : "#aa00ff"; ctx.fillRect(-6, -16 + eBob, 4, 4); ctx.fillRect(4, -16 + eBob, 4, 4); ctx.fillStyle = "#ccc"; ctx.fillRect(-8, -4 + eBob, 16, 14); ctx.fillStyle = "#111"; ctx.fillRect(-6, -2 + eBob, 12, 2); ctx.fillRect(-6, 2 + eBob, 12, 2); ctx.fillRect(-6, 6 + eBob, 12, 2); ctx.fillStyle = "#fff"; ctx.fillRect(-4, -6 + eBob, 8, 2); 
            } else if (e.world === 3) { 
                ctx.fillStyle = "#050505"; ctx.fillRect(-12, -20 + eBob, 4, 12); ctx.fillRect(8, -20 + eBob, 4, 12); ctx.fillStyle = "#8b0000"; ctx.fillRect(-8, -16 + eBob, 16, 14); ctx.fillStyle = "#1a0000"; ctx.fillRect(-12, -2 + eBob, 24, 16); ctx.fillStyle = e.phase === 2 ? "#ff0000" : "#ffea00"; ctx.fillRect(-4, -10 + eBob, 3, 3); ctx.fillRect(3, -10 + eBob, 3, 3); ctx.fillStyle = "#ff4500"; ctx.fillRect(-4, 4 + eBob, 8, 8); ctx.fillStyle = "#111"; ctx.fillRect(-18, -10 + eBob, 6, 16); ctx.fillRect(12, -10 + eBob, 6, 16); 
            } else if (e.world === 4) { 
                ctx.fillStyle = "#ffffff"; ctx.fillRect(-10, -22 + eBob, 20, 18); ctx.fillStyle = "#ffd700"; ctx.fillRect(-4, -18 + eBob, 8, 8); ctx.fillStyle = "#0055ff"; ctx.fillRect(-8, -4 + eBob, 16, 14); ctx.fillStyle = e.phase === 2 ? "#ff2222" : "#00bbff"; ctx.fillRect(-2, -16 + eBob, 4, 4); 
                ctx.save(); ctx.translate(8, -12 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#ffd700"; ctx.fillRect(0, -10, 4, 30); ctx.fillStyle = "#fff"; ctx.fillRect(-1, 0, 6, 2); ctx.restore();
            } else {
                ctx.fillStyle = "#111111"; ctx.fillRect(-14, -24 + eBob, 28, 20); ctx.fillStyle = "#330066"; ctx.fillRect(-10, -20 + eBob, 20, 16); ctx.fillStyle = e.phase === 2 ? "#ff0000" : "#ff00ff"; ctx.fillRect(-6, -16 + eBob, 4, 4); ctx.fillRect(6, -16 + eBob, 4, 4); ctx.fillStyle = "#222"; ctx.fillRect(-22, -20 + eBob, 8, 14); ctx.fillRect(14, -20 + eBob, 8, 14); ctx.fillStyle = "#440088"; ctx.fillRect(-12, -4 + eBob, 24, 14); 
            }
        } else {
            ctx.scale(1.5, 1.5);
            if (e.world === 1) { 
                ctx.fillStyle = "#3cb371"; ctx.fillRect(-4, -8 + eBob, 8, 6); ctx.fillStyle = "#795548"; ctx.fillRect(-5, -9 + eBob, 10, 2); ctx.fillStyle = "#708090"; ctx.fillRect(-3, -2 + eBob, 6, 6); ctx.fillStyle = "#ffeb3b"; ctx.fillRect(2, -6 + eBob, 1, 1); ctx.fillStyle = "#3cb371"; ctx.fillRect(-3, 4, 2, 4 + legL); ctx.fillRect(2, 4, 2, 4 + legR); 
                if(e.type==="melee"){ ctx.save(); ctx.translate(4, -5 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#b0bec5"; ctx.fillRect(0, 0, 3, 4); ctx.fillStyle = "#5d4037"; ctx.fillRect(1, -4, 1, 11); ctx.restore(); }
            } else if (e.world === 2) { 
                ctx.fillStyle = "#eceff1"; ctx.fillRect(-4, -8 + eBob, 8, 6); ctx.fillStyle = "#263238"; ctx.fillRect(-2, -6 + eBob, 4, 2); ctx.fillStyle = "#546e7a"; ctx.fillRect(-3, -2 + eBob, 6, 6); ctx.fillStyle = "#b0bec5"; ctx.fillRect(-3, 4, 1, 4 + legL); ctx.fillRect(2, 4, 1, 4 + legR); 
                if(e.type==="melee"){ ctx.save(); ctx.translate(4, -2 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#cfd8dc"; ctx.fillRect(0, -4, 3, 10); ctx.restore(); }
            } else if (e.world === 3) { 
                ctx.fillStyle = "#ff3d00"; ctx.fillRect(-5, -8 + eBob, 10, 6); ctx.fillStyle = "#212121"; ctx.fillRect(-3, -11 + eBob, 2, 3); ctx.fillRect(1, -11 + eBob, 2, 3); ctx.fillStyle = "#37474f"; ctx.fillRect(-5, -2 + eBob, 10, 6); ctx.fillStyle = "#ff9100"; ctx.fillRect(-4, 4, 2, 4 + legL); ctx.fillRect(2, 4, 2, 4 + legR); 
                if(e.type==="melee"){ ctx.save(); ctx.translate(4, -4 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#ffd700"; ctx.fillRect(0, -5, 2, 14); ctx.restore(); }
            } else if (e.world === 4) { 
                ctx.fillStyle = "#cfd8dc"; ctx.fillRect(-5, -9 + eBob, 10, 7); ctx.fillStyle = "#ffd700"; ctx.fillRect(-1, -7 + eBob, 3, 3); ctx.fillStyle = "#b0bec5"; ctx.fillRect(-4, -2 + eBob, 8, 7); ctx.fillStyle = "#ffd700"; ctx.fillRect(-3, 0 + eBob, 6, 2); ctx.fillStyle = "#eceff1"; ctx.fillRect(-3, 5, 2, 3 + legL); ctx.fillRect(1, 5, 2, 3 + legR); 
                if(e.type==="melee"){ ctx.save(); ctx.translate(4, -4 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#ffd700"; ctx.fillRect(0, -5, 2, 14); ctx.fillStyle = "#78909c"; ctx.fillRect(-1, -8, 4, 3); ctx.restore(); }
            } else { 
                ctx.fillStyle = "#1a0033"; ctx.fillRect(-5, -8 + eBob, 10, 6); ctx.fillStyle = "#00ffcc"; ctx.fillRect(-2, -6 + eBob, 4, 1); ctx.fillStyle = "#2a004d"; ctx.fillRect(-4, -2 + eBob, 8, 7); ctx.fillStyle = "#1a0033"; ctx.fillRect(-2, 5, 1, 3 + legL); ctx.fillRect(1, 5, 1, 3 + legR); 
                if(e.type==="melee"){ ctx.save(); ctx.translate(4, -6 + eBob); ctx.rotate(wRot); ctx.fillStyle = "#00ffcc"; ctx.fillRect(0, -6, 2, 18); ctx.fillStyle = "#330066"; ctx.fillRect(-1, -2, 4, 2); ctx.restore(); }
            }
        }
        ctx.restore();

        if (!e.isBoss) {
            const bw = 24 * 1.5, bx = ex + e.w / 2 - bw / 2, by = e.y - 10; 
            if (bx > -10 && bx < CW) { 
                ctx.fillStyle = "#220000"; ctx.fillRect(bx, by, bw, 3); 
                ctx.fillStyle = e.hp / e.maxHp > 0.5 ? "#22aa22" : "#cc2222"; 
                ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3); 
            }
        }
    });

    // 💡 캐릭터가 죽었을 땐 시체를 그리지 않음 (파티클만 보임)
    if (Game.player && !Game.player.dead) {
        const p = Game.player, px = Math.round(p.x - Game.camX), py = Math.round(p.y);
        if (Game.invT === 0 || Math.floor(Game.invT / 4) % 2 === 0 || p.dashT > 0) {
            const isMoving = p.vx !== 0, isJumping = p.vy < 0, isFalling = p.vy > 0;
            let pyOffset = 0; 
            if (isJumping) pyOffset = -2; else if (isFalling) pyOffset = 0; else if (isMoving) pyOffset = Math.sin(p.fr * Math.PI) * 1.5; 
            if (p.guarding) pyOffset += 3; 

            ctx.save(); ctx.translate(px + 7, py + 9 + pyOffset); ctx.scale(p.facing, 1);

            if (p.guarding || p.parryT > 0) {
                ctx.fillStyle = p.parryT > 0 ? "rgba(255, 238, 0, 0.4)" : "rgba(100, 220, 255, 0.4)"; ctx.beginPath(); ctx.arc(1, -pyOffset, 17, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = p.parryT > 0 ? "rgba(255, 255, 255, 0.9)" : "rgba(100, 220, 255, 0.9)"; ctx.lineWidth = p.parryT > 0 ? 3 : 2; ctx.stroke();
            }

            ctx.fillStyle = "#990000";
            if (isJumping || p.plunging || p.dashT > 0) { ctx.fillRect(-12, 2, 8, 6); ctx.fillRect(-14, 6, 6, 4); }
            else if (isFalling) { ctx.fillRect(-12, -8, 8, 10); ctx.fillRect(-14, -12, 6, 4); }
            else if (isMoving) { const flap = Math.sin(p.fr * Math.PI) * 2; ctx.fillRect(-14, 2 + flap, 10, 5); ctx.fillRect(-16, 4 + flap, 6, 4); }
            else { ctx.fillRect(-9, 3, 5, 8); ctx.fillRect(-11, 8, 5, 5); }

            ctx.fillStyle = "#1a1a25"; ctx.fillRect(-6, 2, 12, 6); ctx.fillStyle = "#2a2a35"; ctx.fillRect(-5, 2, 10, 5);

            let pLegL = 0, pLegR = 0; 
            if (isJumping || p.plunging || p.dashT > 0) { pLegL = -2; pLegR = -4; } else if (isFalling) { pLegL = -1; pLegR = -2; } else if (isMoving) { pLegL = Math.sin(p.fr * Math.PI) * 3; pLegR = -Math.sin(p.fr * Math.PI) * 3; }

            ctx.fillStyle = "#f8f8fa";
            if (!p.guarding) { ctx.fillRect(-4, 7, 3, 4 + pLegL); ctx.fillRect(2, 7, 3, 4 + pLegR); } else { ctx.fillRect(-5, 5, 4, 2); ctx.fillRect(3, 5, 4, 2); }

            ctx.fillStyle = "#f8f8fa"; ctx.fillRect(-6, -10, 14, 10); ctx.fillRect(-7, -8, 16, 6); ctx.fillStyle = "#d0d0d5"; ctx.fillRect(-4, 0, 10, 3);
            ctx.fillStyle = "#808085"; ctx.fillRect(-2, 0, 1, 3); ctx.fillRect(1, 0, 1, 3); ctx.fillRect(4, 0, 1, 3);
            ctx.fillStyle = "#0a0a0f"; ctx.fillRect(2, -7, 4, 4); ctx.fillRect(-4, -7, 4, 4);
            ctx.fillStyle = p.atkAnim > 0 ? "#ff0000" : "#fff"; ctx.fillRect(3, -6, 2, 2); ctx.fillRect(-3, -6, 2, 2);
            ctx.fillStyle = "#cc0000"; ctx.fillRect(-7, -1, 14, 4); ctx.fillStyle = "#ff3333"; ctx.fillRect(-6, -1, 12, 2);

            if (p.plunging) {
                ctx.save(); ctx.translate(5, 5); ctx.rotate(Math.PI * 0.8 * p.facing); drawBone(false); ctx.restore();
            } else if (p.atkAnim > 0) {
                ctx.save(); ctx.translate(5, 5);
                const maxAnim = p.combo === 3 ? 20 : 12; 
                const progress = 1 - (p.atkAnim / maxAnim); let angle = 0;
                
                if (p.combo === 1) { angle = -Math.PI * 0.7 + (Math.PI * 1.4 * progress); } 
                else if (p.combo === 2) { angle = Math.PI * 0.7 - (Math.PI * 1.4 * progress); } 
                else { 
                    if (progress < 0.3) { angle = -Math.PI * 0.8 - (progress * 1.5); } 
                    else { const p2 = (progress - 0.3) / 0.7; angle = -Math.PI * 1.2 + (Math.PI * 2.2 * p2); } 
                }
                
                ctx.rotate(angle * p.facing); 
                drawBone(p.combo === 3);
                
                if (p.combo === 3 && progress > 0.3 && progress < 0.8) { 
                    ctx.fillStyle = "rgba(255, 0, 0, 0.4)"; ctx.fillRect(0, -12, 20 + Game.pRangeBonus, 24); 
                }
                ctx.restore();
            } else {
                ctx.save(); ctx.translate(5, 5); drawBone(false); ctx.restore();
            }
            ctx.restore();
        }
    }
}

function drawUI() {
    Game.texts.forEach(t => { 
        const tx = t.x - Game.camX; if (tx < -20 || tx > CW + 20) return; 
        ctx.save(); ctx.globalAlpha = Math.max(0, t.life / 20); ctx.fillStyle = t.color; ctx.font = `bold ${t.size || 14}px NeoDunggeunmo`; ctx.fillText(t.text, tx, t.y); ctx.restore(); 
    });

    if (Game.comboCount > 1) {
        ctx.save(); ctx.fillStyle = "#ffee00"; ctx.font = "italic bold 24px NeoDunggeunmo"; ctx.shadowColor = "#ff3300"; ctx.shadowBlur = 4; ctx.fillText(`${Game.comboCount} COMBOS`, CW - 160, 60);
        ctx.fillStyle = "rgba(255,0,0,0.2)"; ctx.fillRect(CW - 160, 70, 120, 4); ctx.fillStyle = "#ffcc00"; ctx.fillRect(CW - 160, 70, 120 * (Game.comboTimer / 150), 4); ctx.restore();
    }

    if (Game.enemies.length === 0 && Game.doors.length > 0 && Game.doors[0].open) {
        ctx.fillStyle = "rgba(0,255,100,0.06)"; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = "#44ff88"; ctx.font = "16px NeoDunggeunmo"; ctx.textAlign = "center"; ctx.fillText("AREA CLEARED → ENTER THE DOOR", CW / 2, 30); ctx.textAlign = "left";
    }

    const dashPct = Game.player ? Game.player.dashCD / 75 : 0; ctx.fillStyle = "#111118"; ctx.fillRect(CW - 100, CH - 22, 90, 12);
    if (dashPct > 0) { ctx.fillStyle = "#aa5533"; ctx.fillRect(CW - 100, CH - 22, 90 * (1 - dashPct), 12); ctx.fillStyle = "#ffaa88"; ctx.font = "10px NeoDunggeunmo"; ctx.textAlign = "center"; ctx.fillText("DASH CD", CW - 55, CH - 13); } 
    else { ctx.fillStyle = "#332211"; ctx.fillRect(CW - 100, CH - 22, 90, 12); ctx.fillStyle = "#ffaa00"; ctx.font = "10px NeoDunggeunmo"; ctx.textAlign = "center"; ctx.fillText("DASH READY", CW - 55, CH - 13); }
    
    // 💡 왼쪽 상단 로그라이크 스탯 정렬 표기 
    if (Game.gs === "play" || Game.gs === "dead") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(10, 50, 110, 85);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "12px NeoDunggeunmo";
        ctx.textAlign = "left";
        ctx.fillText(`ATK     : ${Game.pBaseDmg}`, 15, 65);
        ctx.fillText(`DEF     : ${Game.pBaseDef}`, 15, 80);
        ctx.fillText(`SPD     : ${Math.round(Game.pAtkSpd * 100)}%`, 15, 95);
        ctx.fillText(`RNG     : +${Game.pRangeBonus}`, 15, 110);
        ctx.fillText(`SKL DMG : ${Math.round(Game.pSkillDmgMul * 100)}%`, 15, 125);
    }
    
    // 💡 사망 시 점진적 화면 암전(Fade Out) 효과
    if (Game.player && Game.player.dead) {
        let alpha = 1;
        if (Game.gs === "play") alpha = Math.max(0, Math.min(1, 1 - (Game.deadTimer / 120)));
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CW, CH);
    }
    
    ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = "14px NeoDunggeunmo"; ctx.fillText("Enemies: " + Game.enemies.length, 10, 20);
}

function render() {
    const tColors = drawBackground();
    ctx.save(); 
    if (Game.camShake > 0) ctx.translate((Math.random() - 0.5) * Game.camShake, (Math.random() - 0.5) * Game.camShake);
    drawEnvironment(tColors);
    drawEntities();
    ctx.restore();
    drawUI();
}

// ==========================================
// 4. UI 및 게임 흐름 제어 파트 (로그라이크)
// ==========================================

function applyUpgrade(id) {
    if(id === 1) Game.pShield += 30;
    else if(id === 2) Game.pBaseDmg += 5;
    else if(id === 3) { Game.pMaxHp += 20; Game.player.maxHp = Game.pMaxHp; Game.player.hp += 20; }
    else if(id === 4) Game.pSkillDmgMul += 0.3; 
    else if(id === 5) Game.pBaseDef += 10;
    else if(id === 6) Game.pParryBonus += 6;    
    else if(id === 7) Game.pExtraDmg += 0.15; 
    else if(id === 8) { Game.pMaxHp += 10; Game.player.maxHp = Game.pMaxHp; Game.player.hp += 10; Game.pBaseDmg += 3; Game.pRangeBonus += 6; Game.pBaseDef += 3; Game.pAtkSpd += 0.1; } 
    else if(id === 9) Game.pAtkSpd += 0.2;
    else if(id === 10) Game.pHealOnHit = true;  
}

function renderUpgrade() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "#ffcc00"; ctx.font = "30px NeoDunggeunmo"; ctx.textAlign = "center"; ctx.fillText("보스 처치 보상 (1, 2, 3번 키 선택)", CW / 2, 60);
    
    ctx.fillStyle = "#ffffff"; ctx.font = "18px NeoDunggeunmo";
    
    const icons = ["", "🛡️", "🗡️", "❤️", "💥", "🪖", "👁️", "💪", "💀", "🐾", "🐺"];
    const itemNames = [
        "",
        "뼈의 방패: 30 데미지 흡수 배리어",
        "사신의 낫: 공격력 +5",
        "전사의 피: 최대 HP +20",
        "파괴의 룬: 필살기 데미지 30% 증폭",
        "강철 갑옷: 방어력 +10",
        "매의 눈: 패링 판정 시간 증가 (+0.1초)",
        "거인의 힘: 평타 추가 데미지 +15%",
        "스컬의 축복: 올스탯 소폭 증가 (공속 포함)",
        "야수의 손톱: 공격속도 20% 증가",
        "늑대의 피갈퀴손: 평타 타격 시 5% 확률로 1 HP 회복"
    ];

    if (Game.offeredItems.length === 3) {
        ctx.fillText(`[1] ${icons[Game.offeredItems[0]]} ${itemNames[Game.offeredItems[0]]}`, CW / 2, 160);
        ctx.fillText(`[2] ${icons[Game.offeredItems[1]]} ${itemNames[Game.offeredItems[1]]}`, CW / 2, 220);
        ctx.fillText(`[3] ${icons[Game.offeredItems[2]]} ${itemNames[Game.offeredItems[2]]}`, CW / 2, 280);
    }

    if (dn("Digit1") || dn("Numpad1")) { applyUpgrade(Game.offeredItems[0]); exitUpgrade(); } 
    else if (dn("Digit2") || dn("Numpad2")) { applyUpgrade(Game.offeredItems[1]); exitUpgrade(); } 
    else if (dn("Digit3") || dn("Numpad3")) { applyUpgrade(Game.offeredItems[2]); exitUpgrade(); }
    
    ctx.textAlign = "left";
}

function exitUpgrade() {
    K["Digit1"] = false; K["Numpad1"] = false; K["Digit2"] = false; K["Numpad2"] = false; 
    K["Digit3"] = false; K["Numpad3"] = false; K["Digit4"] = false; K["Numpad4"] = false; K["Digit5"] = false; K["Numpad5"] = false;
    Game.gs = "play"; playBGM('play'); genStage(Game.worldN, Game.levelN);
}

function updateHUD() {
    if (!Game.player) return; 
    const fill = document.getElementById("playerHpFill");
    const sFill = document.getElementById("playerShieldFill");
    const hpTxt = document.getElementById("hpText");
    
    if (fill && hpTxt) {
        fill.style.width = (Math.max(0, Game.player.hp) / Game.pMaxHp * 100) + "%";
        if (sFill) {
            sFill.style.width = (Math.min(30, Game.pShield) / 30 * 100) + "%";
            sFill.style.display = Game.pShield > 0 ? "block" : "none";
        }
        hpTxt.textContent = Game.player.hp + " / " + Game.pMaxHp + (Game.pShield > 0 ? ` (+${Game.pShield})` : "");
    }
    
    const mpF = document.getElementById("mpFill");
    const sLab = document.getElementById("skillLabel");
    if (mpF && sLab) {
        const pct = Math.floor((Game.pMp / Game.pMaxMp) * 100);
        mpF.style.width = pct + "%";
        if (pct >= 100) { sLab.textContent = "READY!"; sLab.style.color = "#ffee00"; }
        else { sLab.textContent = pct + "%"; sLab.style.color = "#00ccff"; }
    }

    const boss = Game.enemies.find(e => e.isBoss && !e.dead);
    const bossBarWrap = document.getElementById("bossBarWrap");
    if (boss) {
        bossBarWrap.style.display = "flex";
        document.getElementById("bossFill").style.width = (Math.max(0, boss.hp) / boss.maxHp * 100) + "%";
    } else {
        bossBarWrap.style.display = "none";
    }

    document.getElementById("stageLabel").textContent = `STAGE ${Game.worldN}-${Game.levelN}${Game.levelN === 3 ? " [BOSS]" : ""}`;
    document.getElementById("scoreLabel").textContent = "SCORE: " + Game.score; document.getElementById("killLabel").textContent = "처치: " + Game.kills;
}

function showOv(t, s1, s2, btn) {
    document.getElementById("overlay").querySelector("h1").textContent = t;
    const subs = document.querySelectorAll("#overlay .sub"); if (subs.length > 0) subs[0].textContent = s1; if (subs.length > 1) subs[1].textContent = s2; if (subs.length > 2) subs[2].textContent = "";
    const btnEl = document.querySelector(".startBtn"); if (btnEl) btnEl.textContent = btn;
    document.getElementById("overlay").style.display = "flex";
}

function startGame() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    playBGM('play');
    
    Game.score = 0; Game.kills = 0; Game.worldN = 1; Game.levelN = 1; 
    Game.pMaxHp = 50; Game.pBaseDmg = 30; Game.pMp = 0; Game.comboCount = 0; Game.pRangeBonus = 0; Game.pBaseDef = 0; Game.pShield = 0;
    Game.pSkillDmgMul = 1.0; Game.pParryBonus = 0; Game.pExtraDmg = 0.0; Game.pAtkSpd = 1.0; Game.pHealOnHit = false;
    
    document.getElementById("bossBarWrap").style.display = "none";
    genStage(1, 1); 
    Game.gs = "play"; 
    document.getElementById("overlay").style.display = "none";
}

document.getElementById("startBtn").addEventListener("click", startGame);

let lastTime = 0; const FPS = 60; const interval = 1000 / FPS; 
function loop(currentTime) {
    requestAnimationFrame(loop); 
    const deltaTime = currentTime - lastTime;
    if (deltaTime >= interval) {
        lastTime = currentTime - (deltaTime % interval);
        if (Game.gs === "upgrade") { renderUpgrade(); } 
        else { 
            update(); 
            if (Game.gs === "menu") { 
                ctx.fillStyle = "#050508"; ctx.fillRect(0, 0, CW, CH); ctx.fillStyle = "#0a0505"; 
                for (let x = 0; x < CW; x += TILE) ctx.fillRect(x, CH - TILE, TILE, TILE); 
            } else if (Game.gs === "play" || Game.gs === "dead" || Game.gs === "win") { 
                render(); 
            } 
        }
    }
}
requestAnimationFrame((time) => { lastTime = time; loop(time); });