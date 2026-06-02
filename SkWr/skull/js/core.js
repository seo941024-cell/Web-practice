const C = document.getElementById("c");
const ctx = C.getContext("2d");
ctx.imageSmoothingEnabled = false;

const CW = 640, CH = 360, GRAV = 0.55, TILE = 20;

window.Game = {
  gs: "menu", score: 0, kills: 0, worldN: 1, levelN: 1, camX: 0, invT: 0, camShake: 0, hitStop: 0,
  comboCount: 0, comboTimer: 0,
  
  // 💡 죽었을 때 암전 연출을 위한 타이머 변수
  deadTimer: 0,

  player: null, platforms: [], enemies: [], bullets: [], eBullets: [], parts: [], doors: [], lasers: [], texts: [], items: [],
  levelW: 0,

  pMaxHp: 50, pBaseDmg: 30, pSkillMax: 600, pRangeBonus: 0, pBaseDef: 0, pShield: 0, pMp: 0, pMaxMp: 100,
  pSkillDmgMul: 1.0, pParryBonus: 0, pExtraDmg: 0.0, pAtkSpd: 1.0, pHealOnHit: false, 
  
  offeredItems: [],  
  highScore: localStorage.getItem("skull_highscore") || 0
};

const K = {};
document.addEventListener("keydown", (e) => { K[e.code] = true; if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); });
document.addEventListener("keyup", (e) => { K[e.code] = false; });
const dn = (...c) => c.some((x) => K[x]);

let audioCtx = null, noiseBuffer = null, isBgmPlaying = false, bgmInterval = null, currentBgmScene = ''; 

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 1; 
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1; 
}

function playSfx(type) {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;

  if (type === 'jump') { 
    const osc = audioCtx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'atk') { 
    const osc = audioCtx.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800;
    const noiseGain = audioCtx.createGain(); noiseGain.gain.setValueAtTime(0.4, now); noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.15);
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(audioCtx.destination); noise.start(now); noise.stop(now + 0.15);
  } else if (type === 'dash') { 
    const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(400, now); filter.frequency.linearRampToValueAtTime(100, now + 0.25);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); noise.start(now); noise.stop(now + 0.25);
  } else if (type === 'hit') { 
    const osc = audioCtx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.15);
    const gain1 = audioCtx.createGain(); gain1.gain.setValueAtTime(0.5, now); gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain1); gain1.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.15);
    const noiseSrc = audioCtx.createBufferSource(); noiseSrc.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1500;
    const gain2 = audioCtx.createGain(); gain2.gain.setValueAtTime(0.4, now); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noiseSrc.connect(filter); filter.connect(gain2); gain2.connect(audioCtx.destination); noiseSrc.start(now); noiseSrc.stop(now + 0.15);
  } else if (type === 'parry') { 
    const osc1 = audioCtx.createOscillator(); osc1.type = 'square';
    osc1.frequency.setValueAtTime(300, now); osc1.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    const osc2 = audioCtx.createOscillator(); osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(450, now); osc2.frequency.exponentialRampToValueAtTime(50, now + 0.4);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
    osc1.start(now); osc1.stop(now + 0.4); osc2.start(now); osc2.stop(now + 0.4);
  } else if (type === 'skill') { 
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, now); osc.frequency.linearRampToValueAtTime(40, now + 0.8);
    const noiseSrc = audioCtx.createBufferSource(); noiseSrc.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.8);
    osc.connect(gain); noiseSrc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); noiseSrc.start(now); osc.stop(now + 0.8); noiseSrc.stop(now + 0.8);
  } else if (type === 'dmg') { 
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'enemy_die') { 
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'player_die') { 
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 1.5);
  } else if (type === 'item') {
    const osc = audioCtx.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(700, now); osc.frequency.setValueAtTime(1000, now + 0.1);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'clear') { 
    [150, 180, 220].forEach(f => {
      const osc = audioCtx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.4, now + 0.5); gain.gain.exponentialRampToValueAtTime(0.01, now + 4);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 4);
    });
  }
}

function playBGM(scene = 'play') {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const sceneId = scene === 'play' ? `play_${Game.worldN}` : scene;
  if (currentBgmScene === sceneId && isBgmPlaying) return;
  if (bgmInterval) clearInterval(bgmInterval);
  
  currentBgmScene = sceneId; isBgmPlaying = true;
  let step = 0; let chordStep = 0;

  if (scene === 'dead') {
    bgmInterval = setInterval(() => {
      if (!isBgmPlaying) return;
      const now = audioCtx.currentTime;
      const bFreq = step % 2 === 0 ? 35 : 38; 
      const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
      const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(150, now); filter.frequency.linearRampToValueAtTime(20, now + 1.5);
      const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.5, now + 0.1); gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); osc.frequency.value = bFreq; osc.start(now); osc.stop(now + 2.0);
      
      if (step % 3 === 0) {
         const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(200 + Math.random()*100, now); osc2.frequency.exponentialRampToValueAtTime(180, now + 2.0);
         const gain2 = audioCtx.createGain(); gain2.gain.setValueAtTime(0, now); gain2.gain.linearRampToValueAtTime(0.15, now + 0.5); gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
         osc2.connect(gain2); gain2.connect(audioCtx.destination); osc2.start(now); osc2.stop(now + 2.0);
      }
      step++;
    }, 1000);
    return;
  }

  let tempo = 500, melodyNotes = [], bassNotes = [];
  if (Game.worldN <= 2) {
      tempo = 450; melodyNotes = [ [60, 64, 67, 64], [58, 62, 65, 62], [55, 59, 62, 59] ]; bassNotes = [48, 46, 43];
  } else if (Game.worldN <= 5) {
      tempo = 550; melodyNotes = [ [55, 58, 55, 51], [55, 58, 60, 58], [51, 55, 51, 48] ]; bassNotes = [43, 43, 39];
  } else if (Game.worldN <= 8) {
      tempo = 650; melodyNotes = [ [50, 51, 50, 45], [50, 51, 47, 50], [45, 46, 45, 40] ]; bassNotes = [38, 34, 33];
  } else {
      tempo = 800; melodyNotes = [ [76, 75, 76, 72], [76, 79, 75, 72], [72, 71, 72, 67] ]; bassNotes = [28, 32, 27]; 
  }

  bgmInterval = setInterval(() => {
    if (!isBgmPlaying) return;
    const now = audioCtx.currentTime;
    
    if (scene.startsWith('play') && Game.gs === "play") {
      const chord = melodyNotes[chordStep % melodyNotes.length]; 
      const freq = 440 * Math.pow(2, (chord[step % 4] - 69) / 12);
      
      const isDemonKing = Game.worldN >= 9;
      const osc1 = audioCtx.createOscillator(); osc1.type = isDemonKing ? 'sine' : 'triangle';
      const gain1 = audioCtx.createGain(); gain1.gain.setValueAtTime(0, now); gain1.gain.linearRampToValueAtTime(0.2, now + 0.2); gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      
      osc1.frequency.value = freq; osc1.connect(gain1); gain1.connect(audioCtx.destination);
      osc1.start(now); osc1.stop(now + 1.2); 

      if (isDemonKing) {
          const osc1_detune = audioCtx.createOscillator(); osc1_detune.type = 'sine'; osc1_detune.frequency.value = freq + 3.5; 
          osc1_detune.connect(gain1); osc1_detune.start(now); osc1_detune.stop(now + 1.2);
      }

      if (step % 2 === 0) {
        const bFreq = 440 * Math.pow(2, (bassNotes[chordStep % bassNotes.length] - 69) / 12);
        const osc2 = audioCtx.createOscillator(); osc2.type = isDemonKing ? 'sine' : 'sawtooth';
        const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(isDemonKing ? 300 : 180, now);
        const gain2 = audioCtx.createGain(); gain2.gain.setValueAtTime(isDemonKing ? 0.6 : 0.3, now); gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        osc2.frequency.value = bFreq; osc2.connect(filter); filter.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.start(now); osc2.stop(now + 1.0);
      }
      
      if (step % 1 === 0 && !isDemonKing) {
        const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000;
        const gain3 = audioCtx.createGain(); gain3.gain.setValueAtTime(0.15, now); gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        noise.connect(filter); filter.connect(gain3); gain3.connect(audioCtx.destination);
        noise.start(now); noise.stop(now + 0.1);
      }
      step++; if (step % 4 === 0) { step = 0; chordStep++; }
    } else if (scene === 'upgrade' && Game.gs === "upgrade") {
      if (step % 2 === 0) {
        const freq = 440 * Math.pow(2, ([45, 48, 52, 48][chordStep % 4] - 69) / 12);
        const osc = audioCtx.createOscillator(); osc.type = 'sine';
        const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.15, now + 1.0); gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
        osc.frequency.value = freq; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 3.0); chordStep++;
      }
      step++;
    }
  }, tempo); 
}

function overlap(a, b) { return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y); }
function resolveAABB(obj) {
  obj.x += obj.vx;
  for (const t of Game.platforms) { 
    if (overlap(obj, t)) { 
      if (obj.vx > 0) obj.x = t.x - obj.w; else if (obj.vx < 0) obj.x = t.x + t.w; 
      obj.vx = 0; 
    } 
  }
  obj.y += obj.vy; obj.onGround = false; obj.riding = null; 
  for (const t of Game.platforms) { 
    if (overlap(obj, t)) { 
      if (obj.vy > 0) { obj.y = t.y - obj.h; obj.onGround = true; obj.riding = t; } 
      else if (obj.vy < 0) obj.y = t.y + t.h; 
      obj.vy = 0; 
    } 
  }
}
function addPart(x, y, col, life) { Game.parts.push({ x, y, col, vx: (Math.random() - 0.5) * 4.5, vy: (Math.random() - 0.5) * 4.5, life, ml: life }); }