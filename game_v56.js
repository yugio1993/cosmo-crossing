// Cosmo Crossing v42 - Auto-leave Timer, 1min Warning & Departure Notifications
// コンセプト: どうぶつの森の宇宙版。植物を増やすと住人が移り住んでくる。

// シーン・カメラ・レンダラーのセットアップ
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();

// 深い宇宙空間（ネイビーブルー）と対応するフォグ
scene.background = new THREE.Color(0x050716);
let baseFogDensity = 0.012;
scene.fog = new THREE.FogExp2(0x050716, baseFogDensity);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ライティング
const ambientLight = new THREE.AmbientLight(0xfff3e5, 1.15);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff8ea, 1.55);
sunLight.position.set(20, 80, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
const d = 50;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x7585ff, 0.75);
fillLight.position.set(-20, -10, -20);
scene.add(fillLight);

// 星空きらめき用グローバル変数
let starfield;
let starBaseColors = [];
let starPhases = [];
let starSpeeds = [];

// 星空テクスチャの作成
function createCircleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(255, 225, 255, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

// 宇宙空間の大きな星々
function createStarfield() {
    const starCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const pastelColors = [
        new THREE.Color(0xffd166),
        new THREE.Color(0xff85a1),
        new THREE.Color(0x06d6a0),
        new THREE.Color(0x4ea8de),
        new THREE.Color(0xffffff)
    ];

    starBaseColors = [];
    starPhases = [];
    starSpeeds = [];

    for (let i = 0; i < starCount; i++) {
        const r = 140 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const color = pastelColors[Math.floor(Math.random() * pastelColors.length)].clone();
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        starBaseColors.push(color);
        starPhases.push(Math.random() * Math.PI * 2);
        starSpeeds.push(0.5 + Math.random() * 1.5); // きらめき速度
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starTexture = createCircleTexture();
    const material = new THREE.PointsMaterial({
        size: 7.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        map: starTexture,
        depthWrite: false
    });

    starfield = new THREE.Points(geometry, material);
    scene.add(starfield);
}
createStarfield();

// 星空のきらめきアニメーションの更新
function updateStarfield(delta) {
    if (!starfield) return;
    const colorsAttr = starfield.geometry.attributes.color;
    const count = colorsAttr.count;
    
    for (let i = 0; i < count; i++) {
        starPhases[i] += delta * starSpeeds[i];
        
        // きらめき係数 (0.1 〜 1.1 程度)
        const twinkle = 0.3 + (1.0 + Math.sin(starPhases[i])) * 0.4;
        
        const baseColor = starBaseColors[i];
        colorsAttr.setXYZ(i, baseColor.r * twinkle, baseColor.g * twinkle, baseColor.b * twinkle);
    }
    colorsAttr.needsUpdate = true;
}

// ==========================================
// コズミック・バックドロップ (遠景装飾: 巨大ガス惑星＆流星)
// ==========================================
let gasGiantGroup;
const shootingStars = [];

function createCosmicBackdrop() {
    gasGiantGroup = new THREE.Group();
    
    // ガス巨大惑星 of テクスチャ (縞模様)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // 美しいグラデーション縞模様
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, '#3f37c9');
    grad.addColorStop(0.15, '#7209b7');
    grad.addColorStop(0.3, '#f72585');
    grad.addColorStop(0.45, '#ffd166');
    grad.addColorStop(0.6, '#f72585');
    grad.addColorStop(0.75, '#7209b7');
    grad.addColorStop(0.9, '#3f37c9');
    grad.addColorStop(1.0, '#10002b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
    
    // 微細な波模様の追加
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i=0; i<20; i++){
        ctx.fillRect(0, Math.random()*128, 256, 1 + Math.random()*3);
    }
    
    const planetTexture = new THREE.CanvasTexture(canvas);
    
    // ガス惑星本体の球体
    const giantGeom = new THREE.SphereGeometry(15, 32, 32);
    const giantMat = new THREE.MeshStandardMaterial({
        map: planetTexture,
        roughness: 0.8,
        metalness: 0.1,
        emissive: 0x24113a,
        emissiveIntensity: 0.15
    });
    const giantMesh = new THREE.Mesh(giantGeom, giantMat);
    gasGiantGroup.add(giantMesh);
    
    // 土星風のフラットリング
    const ringGeom = new THREE.RingGeometry(18, 30, 64);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x4ea8de,
        emissive: 0x4ea8de,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = 0.2;
    gasGiantGroup.add(ringMesh);
    
    // 遠景に配置
    gasGiantGroup.position.set(-65, 45, -120);
    scene.add(gasGiantGroup);
}
createCosmicBackdrop();

// 流星(シューティングスター)の追加
function spawnShootingStar() {
    if (shootingStars.length > 3) return; 
    
    const geom = new THREE.BufferGeometry();
    const length = 4.0 + Math.random() * 5.0;
    
    // 軌道の始点と進行方向
    const startX = -100 - Math.random() * 40;
    const startY = 60 + Math.random() * 40;
    const startZ = -110 + (Math.random() - 0.5) * 40;
    
    const direction = new THREE.Vector3(1.8 + Math.random()*0.5, -0.8 - Math.random()*0.4, 0).normalize();
    
    const points = [
        new THREE.Vector3(startX, startY, startZ),
        new THREE.Vector3(startX, startY, startZ).addScaledVector(direction, -length)
    ];
    geom.setFromPoints(points);
    
    const colors = [0x00f0ff, 0xff85a1, 0xffffff, 0xffd166];
    const col = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95
    });
    
    const line = new THREE.Line(geom, mat);
    scene.add(line);
    
    shootingStars.push({
        line: line,
        pos: new THREE.Vector3(startX, startY, startZ),
        dir: direction,
        speed: 110 + Math.random() * 60,
        age: 0,
        maxAge: 0.8 + Math.random() * 0.5,
        opacity: 0.95
    });
}

function updateShootingStars(delta) {
    if (Math.random() < 0.012) { 
        spawnShootingStar();
    }
    
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.age += delta;
        
        if (s.age >= s.maxAge) {
            scene.remove(s.line);
            s.line.geometry.dispose();
            s.line.material.dispose();
            shootingStars.splice(i, 1);
            continue;
        }
        
        // 移動
        s.pos.addScaledVector(s.dir, s.speed * delta);
        
        // 頂点情報の更新
        const points = [
            s.pos.clone(),
            s.pos.clone().addScaledVector(s.dir, -6.0)
        ];
        s.line.geometry.setFromPoints(points);
        
        const progress = s.age / s.maxAge;
        s.line.material.opacity = s.opacity * (1.0 - progress);
    }
}

// ==========================================
// 昼夜サイクルシステム
// ==========================================
let dayNightTime = 0;     // 0〜1 (0=夜明け, 0.25=昼, 0.5=夕暮れ, 0.75=深夜)
const DAY_CYCLE_DURATION = 300; // 5分で1日
const timeDisplayEl = document.getElementById('time-display');

const DAY_CYCLE = [
    { t: 0.00, ambientColor: 0x3a2a4a, ambientIntensity: 0.5,  sunColor: 0xffaa55, sunIntensity: 0.4,  label: '🌄 夜明け' },
    { t: 0.15, ambientColor: 0xfff3e5, ambientIntensity: 1.15, sunColor: 0xfff8ea, sunIntensity: 1.55, label: '🌤 朝' },
    { t: 0.30, ambientColor: 0xfff3e5, ambientIntensity: 1.25, sunColor: 0xfffcea, sunIntensity: 1.7,  label: '☀️ 昼' },
    { t: 0.50, ambientColor: 0xff9955, ambientIntensity: 0.9,  sunColor: 0xff7733, sunIntensity: 1.1,  label: '🌅 夕暮れ' },
    { t: 0.65, ambientColor: 0x1a1030, ambientIntensity: 0.4,  sunColor: 0x2244aa, sunIntensity: 0.3,  label: '🌙 夜' },
    { t: 0.85, ambientColor: 0x0f0822, ambientIntensity: 0.32, sunColor: 0x112255, sunIntensity: 0.2,  label: '✨ 深夜' },
];

function lerpColor(a, b, t) {
    const ca = new THREE.Color(a);
    const cb = new THREE.Color(b);
    return ca.lerp(cb, t);
}

function updateDayNight(delta) {
    dayNightTime = (dayNightTime + delta / DAY_CYCLE_DURATION) % 1.0;

    // 前後のキーフレームを見つけてlerpで補間
    let prev = DAY_CYCLE[DAY_CYCLE.length - 1];
    let next = DAY_CYCLE[0];
    for (let i = 0; i < DAY_CYCLE.length; i++) {
        if (DAY_CYCLE[i].t <= dayNightTime) { prev = DAY_CYCLE[i]; }
        if (DAY_CYCLE[i].t > dayNightTime)  { next = DAY_CYCLE[i]; break; }
    }

    const segLen = next.t > prev.t ? (next.t - prev.t) : (1.0 - prev.t + next.t);
    const elapsed = dayNightTime >= prev.t ? (dayNightTime - prev.t) : (1.0 - prev.t + dayNightTime);
    const f = segLen > 0 ? Math.min(elapsed / segLen, 1.0) : 0;

    ambientLight.color.copy(lerpColor(prev.ambientColor, next.ambientColor, f));
    ambientLight.intensity = prev.ambientIntensity + (next.ambientIntensity - prev.ambientIntensity) * f;

    sunLight.color.copy(lerpColor(prev.sunColor, next.sunColor, f));
    sunLight.intensity = prev.sunIntensity + (next.sunIntensity - prev.sunIntensity) * f;

    // フォグの濃さも夜は少し濃くなる
    const nightFactor = dayNightTime > 0.6 || dayNightTime < 0.1 ? 0.3 : 0.0;
    scene.fog.density = baseFogDensity * (1.0 + nightFactor);

    if (timeDisplayEl) timeDisplayEl.textContent = prev.label;
}

// ==========================================
// Web Audio APIによるリアルタイム効果音の合成ロジック
let audioCtx = null;
let noiseBuffer = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const bufferSize = audioCtx.sampleRate * 0.5;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    // BGM自動演奏エンジンを開始
    startBGM();
}

// ==========================================
// Web Audio APIを用いた小惑星気候別BGM自動演奏エンジン（楽器音版）
// ==========================================
let bgmIntervalId = null;
let bgmDroneOsc1 = null;
let bgmDroneOsc2 = null;
let bgmDroneGain = null;
let bgmNextNoteTime = 0;
let isBGMEnabled = true;

// マリンバ・木琴風の打楽器音合成
function playMarimbaNote(freq, time, volume, duration) {
    if (!audioCtx) return;

    // 基音：三角波（木の暖かみ）
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);

    // 3倍音：サイン波（倍音）
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 3.0, time);

    // 各オシレーターのゲイン
    const g1 = audioCtx.createGain();
    const g2 = audioCtx.createGain();
    // 打楽器らしい：素早いアタック + 急峻ディケイ
    g1.gain.setValueAtTime(0, time);
    g1.gain.linearRampToValueAtTime(volume, time + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    g2.gain.setValueAtTime(0, time);
    g2.gain.linearRampToValueAtTime(volume * 0.25, time + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.6);

    osc1.connect(g1); g1.connect(audioCtx.destination);
    osc2.connect(g2); g2.connect(audioCtx.destination);

    osc1.start(time); osc1.stop(time + duration + 0.05);
    osc2.start(time); osc2.stop(time + duration * 0.6 + 0.05);
}

// アコースティックギター風アルペジオ音合成
function playGuitarNote(freq, time, volume) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    // 高域カットで丸みを出す
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, time);
    filter.Q.value = 0.5;

    const gain = audioCtx.createGain();
    // ギターらしいアタックとディケイ
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

    osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.start(time); osc.stop(time + 2.0);
}

function startBGM() {
    if (!audioCtx) return;
    if (!isBGMEnabled) return;
    if (bgmIntervalId) return;

    // 低音コード（ギター低弦の雰囲気）
    bgmDroneGain = audioCtx.createGain();
    bgmDroneGain.gain.setValueAtTime(0.008, audioCtx.currentTime);
    bgmDroneGain.connect(audioCtx.destination);

    playBgmDrone();

    bgmNextNoteTime = audioCtx.currentTime;
    bgmIntervalId = setInterval(schedulerBGM, 100.0);
}

function playBgmDrone() {
    if (!audioCtx || !bgmDroneGain) return;
    if (!isBGMEnabled) return;

    stopBgmDrone();

    const now = audioCtx.currentTime;
    // 惑星ごとのルート音（明るい長調ベース）
    let rootFreq = 196.00; // アルテミス: G3
    if (currentPlanet.id === 'boreas') rootFreq = 261.63; // C4
    else if (currentPlanet.id === 'helios') rootFreq = 220.00; // A3

    // サイン波2本でほんのりとした低音ドローン
    bgmDroneOsc1 = audioCtx.createOscillator();
    bgmDroneOsc1.type = 'sine';
    bgmDroneOsc1.frequency.setValueAtTime(rootFreq / 2, now); // 1オクターブ下

    bgmDroneOsc2 = audioCtx.createOscillator();
    bgmDroneOsc2.type = 'sine';
    bgmDroneOsc2.frequency.setValueAtTime(rootFreq * 0.75, now); // 完全5度

    bgmDroneOsc1.connect(bgmDroneGain);
    bgmDroneOsc2.connect(bgmDroneGain);
    bgmDroneOsc1.start(now);
    bgmDroneOsc2.start(now);
}

function stopBgmDrone() {
    if (bgmDroneOsc1) {
        try { bgmDroneOsc1.stop(); bgmDroneOsc1.disconnect(); } catch(e) {}
        bgmDroneOsc1 = null;
    }
    if (bgmDroneOsc2) {
        try { bgmDroneOsc2.stop(); bgmDroneOsc2.disconnect(); } catch(e) {}
        bgmDroneOsc2 = null;
    }
}

// BGMノート進行カウンタ
let bgmNoteIndex = 0;

function schedulerBGM() {
    if (!audioCtx) return;
    const scheduleAheadTime = 0.25;
    while (bgmNextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        playBgmNote(bgmNextNoteTime);
        // 軽快なテンポ：0.22〜0.30秒ステップ
        let step = 0.25;
        if (currentPlanet.id === 'boreas') step = 0.20;  // 少し速め
        else if (currentPlanet.id === 'helios') step = 0.30; // ゆったり
        bgmNextNoteTime += step + (Math.random() - 0.5) * 0.04;
        bgmNoteIndex++;
    }
}

function playBgmNote(time) {
    if (!audioCtx) return;
    if (!isBGMEnabled) return;

    // 明るいメジャーペンタトニックスケール（Gメジャー/Cメジャー/Aメジャー）
    let marimbaScale, guitarScale;

    if (currentPlanet.id === 'boreas') {
        // ボレアス：C メジャーペンタトニック（高め・軽やか）
        marimbaScale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
        guitarScale  = [130.81, 164.81, 196.00, 261.63, 329.63];
    } else if (currentPlanet.id === 'helios') {
        // ヘリオス：A メジャーペンタトニック（温かい）
        marimbaScale = [440.00, 493.88, 554.37, 659.25, 739.99, 880.00, 987.77];
        guitarScale  = [110.00, 138.59, 164.81, 220.00, 277.18];
    } else {
        // アルテミス：G メジャーペンタトニック
        marimbaScale = [392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00];
        guitarScale  = [98.00, 123.47, 146.83, 196.00, 246.94];
    }

    // マリンバ主旋律（4拍に3回程度）
    if (Math.random() < 0.75) {
        const freq = marimbaScale[bgmNoteIndex % marimbaScale.length];
        const vol  = 0.028 + Math.random() * 0.01;
        const dur  = 0.55 + Math.random() * 0.3;
        playMarimbaNote(freq, time, vol, dur);
    }

    // ギターアルペジオ（8拍に1回程度）
    if (Math.random() < 0.13) {
        const freq = guitarScale[Math.floor(Math.random() * guitarScale.length)];
        playGuitarNote(freq, time, 0.018);
    }
}

function updateBGMPlanet() {
    if (!audioCtx) return;
    playBgmDrone();
    bgmNextNoteTime = audioCtx.currentTime + 0.2;
}

// ホバー用のスラスター音制御
let thrusterSoundSource = null;
let thrusterGainNode = null;

function startThrusterSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (thrusterSoundSource) return;

    thrusterSoundSource = audioCtx.createBufferSource();
    thrusterSoundSource.buffer = noiseBuffer;
    thrusterSoundSource.loop = true;

    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 240;
    lpFilter.Q.value = 2.0;

    thrusterGainNode = audioCtx.createGain();
    thrusterGainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
    thrusterGainNode.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.15); 

    thrusterSoundSource.connect(lpFilter);
    lpFilter.connect(thrusterGainNode);
    thrusterGainNode.connect(audioCtx.destination);

    thrusterSoundSource.start(0);
}

function stopThrusterSound() {
    if (!thrusterSoundSource) return;
    
    const now = audioCtx.currentTime;
    const fadeTime = 0.15;
    
    thrusterGainNode.gain.setValueAtTime(thrusterGainNode.gain.value, now);
    thrusterGainNode.gain.linearRampToValueAtTime(0.01, now + fadeTime);
    
    const src = thrusterSoundSource;
    thrusterSoundSource = null;
    
    setTimeout(() => {
        try {
            src.stop();
            src.disconnect();
        } catch(e) {}
    }, fadeTime * 1000);
}

// ホバー用パーティクル制御
const hoverParticles = [];

function spawnJetParticles() {
    for (let i = 0; i < 3; i++) {
        const size = 0.08 + Math.random() * 0.1;
        const geom = new THREE.SphereGeometry(size, 5, 5);
        
        // 極上リッチ化: シアン、マゼンタ、パープル、ホワイトのネオンカラーグラデーション
        const colors = [0x00f0ff, 0xff5c8a, 0x9b5de5, 0xffffff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        const localEmitPos = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            0.15,
            -0.38
        );
        localEmitPos.applyQuaternion(playerGroup.quaternion);
        const worldEmitPos = playerGroup.position.clone().add(localEmitPos);
        mesh.position.copy(worldEmitPos);
        
        scene.add(mesh);
        
        const localVel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            -4.0 - Math.random() * 3.0,
            -1.5 - Math.random() * 1.5
        );
        localVel.applyQuaternion(playerGroup.quaternion);
        
        hoverParticles.push({
            mesh: mesh,
            vel: localVel,
            age: 0,
            maxAge: 0.35 + Math.random() * 0.2
        });
    }
}

// 歩行音の再生
function playFootstep(pitchScale = 1.0) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    
    // より柔らかく低めのトーンで草や土を踏む心地よい足音に
    const randomFrequency = (260 + Math.random() * 60) * pitchScale;
    const randomQ = 2.0;
    const randomGain = 0.05 + Math.random() * 0.02; // 音量を控えめに
    const randomDecay = 0.06 + Math.random() * 0.02; // 短く軽快に
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = randomFrequency; 
    filter.Q.value = randomQ;
    
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(randomGain, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + randomDecay);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    source.start(now);
    source.stop(now + randomDecay + 0.01);
}

// 植物を植えたときの心地よい「ポコッ」という土の音
function playPlantSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.08); // クイックな周波数上昇
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.008); // 柔らかいアタック
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600; // 高周波をカットして丸みを出す
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.16);
}

// 住人が登場したときのSFチャイム音 (より穏やかでドリーミーに)
function playVillagerSpawnSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const notes = [329.63, 392.00, 523.25, 659.25]; // E4, G4, C5, E5
    
    notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        
        gainNode.gain.setValueAtTime(0, now + idx * 0.07);
        gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.07 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.45);
    });
}

// ジャンプ開始時の「ふわっ」とした上昇浮遊音
function playJumpSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // ふわりとした風のノイズ
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.35); // 緩やかに上昇
    filter.Q.value = 1.5;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.05); // ゆっくりアタック
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    
    // 優しいサイン波のハーモニー
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.3); // E4へ
    
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    
    noise.start(now);
    osc.start(now);
    
    noise.stop(now + 0.4);
    osc.stop(now + 0.4);
}

// 着地時の「サクッ」という心地よい草地着地音
function playLandSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 1.2;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.07);
    
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.12, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    
    noise.start(now);
    osc.start(now);
    
    noise.stop(now + 0.1);
    osc.stop(now + 0.1);
}

// ロケットエンジンの噴射音 (音量をまろやかに)
function playRocketEngineSound(duration = 2.0) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220; // フィルターを低くしてこもらせる
    
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 75;
    
    const oscFilter = audioCtx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 140;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.15); // 音量を優しめに
    gainNode.gain.linearRampToValueAtTime(0.12, now + duration - 0.4);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    source.connect(filter);
    filter.connect(gainNode);
    
    osc.connect(oscFilter);
    oscFilter.connect(gainNode);
    
    gainNode.connect(audioCtx.destination);
    
    source.start(now);
    osc.start(now);
    
    source.stop(now + duration);
    osc.stop(now + duration);
}

// 会話文字送り用のどうぶつ語ポポポポ音
function playAnimalTalkSound(char, voicePitch = 1.0) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    if (char === ' ' || char === '！' || char === '。' || char === '、' || char === '？' || char === '〜') return;
    
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    
    const code = char.charCodeAt(0);
    const baseFreq = (450 + (code % 140)) * voicePitch; // ピッチを少しマイルドに
    
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.04);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.005); // 少し音量を下げる
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.045);
}

// 宇宙ポータルワープ時の効果音
function playWarpSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 1.2);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 1.4);
}

// 果物収穫時の「ポコッ」という心地よいもぎ取り音
function playHarvestSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05); // 下降スイープでポロッと取れる感
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
}

// プレゼントをあげたときの「ティリン〜♪」という優しい癒やしアルペジオ
function playPresentSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    
    notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine'; // 三角波からサイン波にして柔らかく
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        
        gainNode.gain.setValueAtTime(0, now + idx * 0.06);
        gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.38);
    });
}

// 住人が食事した時の「ムシャムシャごちそうさま！」効果音
function playEatSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.15);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.18);
}

window.addEventListener('click', initAudio);
window.addEventListener('keydown', initAudio);

// ==========================================
// 3惑星のテーマとインメモリデータの定義
// ==========================================
const ASTEROID_RADIUS = 36;
let asteroid;
let gridHelperGroup;
let isGuideActive = true;

const GRID_LAT_DIVISIONS = 48; 
const GRID_LON_DIVISIONS = 96; 
const deltaLat = Math.PI / GRID_LAT_DIVISIONS;
const deltaLon = (Math.PI * 2) / GRID_LON_DIVISIONS;

const planetsData = {
    artemis: {
        id: "artemis",
        name: "アルテミス",
        climate: "ルミナス・ファンタジー",
        bgColor: 0x050716,
        fogColor: 0x050716,
        fogDensity: 0.012,
        dirtColor: '#261712', 
        dirtSpeck1: 'rgba(20, 11, 8, 0.3)',
        dirtSpeck2: 'rgba(64, 43, 31, 0.25)',
        dirtColor1: '#140b08',
        dirtColor2: '#402b1f',
        plantedGridCells: new Set(),
        plants: [],
        activeVillagers: [],
        completedMilestones: [], // マイルストーン達成状態
        unlockedVillagerIds: [], // 一度出現した住人のIDリスト
        unlockedVillagersInfo: {}, // 住人のマイルストーン条件などの情報
        houses: [], // v50: 家データ保存用
        particleType: "sparkle",
        gravity: 25.0,
        jumpForce: 20.1,
        platforms: [
            {
                id: "artemis_platform_1",
                theta: 0.8,
                phi: 1.1,
                radius: 3.5,
                height: 1.8,
                color: 0xffa6c9 // かわいいピンク
            }
        ],
        lakes: [
            {
                id: "artemis_lake_1",
                theta: -0.8,
                phi: 1.2,
                radius: 4.5,
                color: 0x00f0ff // ネオンブルーの神秘的な泉
            }
        ]
    },
    boreas: {
        id: "boreas",
        name: "ボレアス",
        climate: "アイス・クリスタル",
        bgColor: 0x070c1b,
        fogColor: 0x070c1b,
        fogDensity: 0.016,
        dirtColor: '#1c2e4a', 
        dirtSpeck1: 'rgba(12, 36, 60, 0.3)',
        dirtSpeck2: 'rgba(50, 100, 150, 0.25)',
        dirtColor1: '#070f24',
        dirtColor2: '#2c4a6f',
        plantedGridCells: new Set(),
        plants: [],
        activeVillagers: [],
        completedMilestones: [], // マイルストーン達成状態
        unlockedVillagerIds: [], // 一度出現した住人のIDリスト
        unlockedVillagersInfo: {}, // 住人のマイルストーン条件などの情報
        houses: [], // v50: 家データ保存用
        particleType: "snow",
        gravity: 13.0,
        jumpForce: 16.3,
        platforms: [
            {
                id: "boreas_platform_1",
                theta: 1.5,
                phi: 0.7,
                radius: 3.8,
                height: 2.6,
                color: 0xd0f0ff // 氷山氷結ライトブルー
            }
        ],
        lakes: [
            {
                id: "boreas_lake_1",
                theta: -1.5,
                phi: 1.4,
                radius: 5.5,
                color: 0x1b4f72 // ディープブルーの氷の奈落
            }
        ]
    },
    helios: {
        id: "helios",
        name: "ヘリオス",
        climate: "黄金の砂漠",
        bgColor: 0x160c04,
        fogColor: 0x160c04,
        fogDensity: 0.014,
        dirtColor: '#3c2509', 
        dirtSpeck1: 'rgba(62, 38, 8, 0.3)',
        dirtSpeck2: 'rgba(112, 78, 20, 0.25)',
        dirtColor1: '#1b0d00',
        dirtColor2: '#5d3d0c',
        plantedGridCells: new Set(),
        plants: [],
        activeVillagers: [],
        completedMilestones: [], // マイルストーン達成状態
        unlockedVillagerIds: [], // 一度出現した住人のIDリスト
        unlockedVillagersInfo: {}, // 住人のマイルストーン条件などの情報
        houses: [], // v50: 家データ保存用
        particleType: "gold",
        gravity: 42.0,
        jumpForce: 24.7,
        platforms: [
            {
                id: "helios_platform_1",
                theta: -1.0,
                phi: 0.9,
                radius: 3.2,
                height: 1.5,
                color: 0xd4a373 // 砂岩オレンジゴールド
            }
        ],
        lakes: [
            {
                id: "helios_lake_1",
                theta: 1.0,
                phi: 1.0,
                radius: 4.0,
                color: 0xc86400 // 不気味な黄金の底なし流砂
            }
        ]
    }
};

let currentPlanet = planetsData.artemis;

// プレイヤーインベントリ：所持果物数 (全惑星共通で保持される)
let playerFruits = 0;

// インベントリ定義
let playerInventory = {
    flowerSeeds: {
        cosmic: 5,         // 最初は1種類のタネ×5
        lily: 0,
        rose: 0,
        tulip: 0,
        ice_flower: 0,
        desert_flower: 0
    },
    treeSaplings: {
        cosmic_tree: 5,    // 最初は1種類の苗×5
        berry_tree: 0,
        ice_tree: 0,
        desert_tree: 0
    },
    grassSeeds: 50         // 草のタネ×50
};

// 選択中のタネ/苗のID
let selectedFlowerSeed = 'cosmic';
let selectedTreeSapling = 'cosmic_tree';

// タネ・苗の日本語表示名マッピング
const seedNames = {
    cosmic: "宇宙の花のタネ",
    lily: "星光の百合のタネ",
    rose: "ルナローズのタネ",
    tulip: "オーロラチューリップのタネ",
    ice_flower: "氷結の花のタネ",
    desert_flower: "砂漠の花のタネ",
    cosmic_tree: "宇宙の木の苗",
    berry_tree: "ベリーの木の苗",
    ice_tree: "凍てつく木の苗",
    desert_tree: "砂漠の木の苗"
};

// シームレスな「小惑星の地面柄テクスチャ」を生成 (惑星テーマ別)
function createDirtTexture(theme) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = theme.dirtColor; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = theme.dirtSpeck1; 
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const w = 1 + Math.random() * 2;
        const h = 1 + Math.random() * 2;
        ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = theme.dirtSpeck2; 
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const w = 1 + Math.random() * 2;
        const h = 1 + Math.random() * 2;
        ctx.fillRect(x, y, w, h);
    }

    function drawTiledShape(drawFunc, count) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = 5 + Math.random() * 6;
            
            for (let offsetH = -1; offsetH <= 1; offsetH++) {
                for (let offsetV = -1; offsetV <= 1; offsetV++) {
                    const drawX = x + offsetH * canvas.width;
                    const drawY = y + offsetV * canvas.height;
                    drawFunc(ctx, drawX, drawY, size);
                }
            }
        }
    }

    ctx.fillStyle = theme.dirtColor1;
    drawTiledShape((c, px, py, s) => {
        c.beginPath();
        c.moveTo(px, py - s / 2);
        c.lineTo(px - s / 2, py + s / 2);
        c.lineTo(px + s / 2, py + s / 2);
        c.closePath();
        c.fill();
    }, 45);

    ctx.fillStyle = theme.dirtColor2;
    drawTiledShape((c, px, py, s) => {
        c.beginPath();
        c.arc(px, py, s / 2.5, 0, Math.PI * 2);
        c.fill();
    }, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 8); 
    return texture;
}

let cachedLeafGeom = null;
function getLeafGeometry() {
    if (!cachedLeafGeom) {
        cachedLeafGeom = new THREE.SphereGeometry(0.18, 8, 8);
        cachedLeafGeom.scale(1.4, 0.5, 0.85); 
        cachedLeafGeom.translate(0, 0.04, 0); 
    }
    return cachedLeafGeom;
}

const grassMaterialCache = new Map();
function getGrassMaterial(color) {
    if (!grassMaterialCache.has(color)) {
        grassMaterialCache.set(color, new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.28,
            roughness: 0.65,
            flatShading: false
        }));
    }
    return grassMaterialCache.get(color);
}

// 草オブジェクト
function createGrassClump(theme) {
    const group = new THREE.Group();
    const bladeCount = 6 + Math.floor(Math.random() * 5);
    
    let colors = [0x7efc00, 0x3cfd3c, 0x00ff88, 0x9eff00, 0xb8ff98]; 
    if (theme.id === "boreas") {
        colors = [0x00ffff, 0x80f8ff, 0xbdfcff, 0x3ad5ff, 0xeefcff]; 
    } else if (theme.id === "helios") {
        colors = [0xffd700, 0xffea4a, 0xffaa00, 0xfff68f, 0xfff8d0]; 
    }
    
    const leafGeom = getLeafGeometry();
    
    for (let i = 0; i < bladeCount; i++) {
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = getGrassMaterial(col);
        
        const blade = new THREE.Mesh(leafGeom, mat);
        // blade.castShadow = true; // 軽量化のため影を無効化
        
        const angle = (i / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const tilt = 0.75 + Math.random() * 0.4;
        
        blade.rotation.y = angle;
        blade.rotateX(tilt);
        
        const s = 0.85 + Math.random() * 0.5;
        blade.scale.multiplyScalar(s);
        
        group.add(blade);
    }
    
    return group;
}

// ==========================================
// 惑星固有の構造物（高台・湖）の生成と管理
// ==========================================
let planetStructures = []; 
let lastSplashTime = 0;

function clearPlanetStructures() {
    planetStructures.forEach(mesh => {
        asteroid.remove(mesh);
        mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    });
    planetStructures = [];
}

function spawnPlanetStructures() {
    clearPlanetStructures();
    
    const platforms = currentPlanet.platforms || [];
    const lakes = currentPlanet.lakes || [];
    
    // 高台の描画
    platforms.forEach(p => {
        const x = ASTEROID_RADIUS * Math.sin(p.phi) * Math.cos(p.theta);
        const y = ASTEROID_RADIUS * Math.sin(p.phi) * Math.sin(p.theta);
        const z = ASTEROID_RADIUS * Math.cos(p.phi);
        p.localPos = new THREE.Vector3(x, y, z);
        
        const normal = p.localPos.clone().normalize();
        const geom = new THREE.CylinderGeometry(p.radius, p.radius, p.height, 16);
        let mat;
        
        if (currentPlanet.id === "artemis") {
            mat = new THREE.MeshStandardMaterial({
                color: p.color,
                emissive: 0x9b5de5,
                emissiveIntensity: 0.4,
                roughness: 0.7,
                flatShading: true
            });
        } else if (currentPlanet.id === "boreas") {
            mat = new THREE.MeshPhysicalMaterial({
                color: p.color,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.5,
                roughness: 0.1,
                transmission: 0.9,
                transparent: true,
                opacity: 0.8
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: p.color,
                roughness: 0.9,
                flatShading: true
            });
        }
        
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const meshPos = p.localPos.clone().addScaledVector(normal, p.height * 0.5);
        mesh.position.copy(meshPos);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        
        asteroid.add(mesh);
        planetStructures.push(mesh);
        
        // 装飾
        if (currentPlanet.id === "artemis") {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const decoGeom = new THREE.DodecahedronGeometry(0.25, 0);
                const decoMat = new THREE.MeshStandardMaterial({ color: 0xffe57f, emissive: 0xffaa00, emissiveIntensity: 1.5 });
                const deco = new THREE.Mesh(decoGeom, decoMat);
                
                const localOffset = new THREE.Vector3(Math.cos(angle) * (p.radius - 0.5), p.height * 0.5 + 0.15, Math.sin(angle) * (p.radius - 0.5));
                localOffset.applyQuaternion(mesh.quaternion);
                
                deco.position.copy(p.localPos).add(localOffset);
                asteroid.add(deco);
                planetStructures.push(deco);
            }
        } else if (currentPlanet.id === "boreas") {
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const decoGeom = new THREE.ConeGeometry(0.15, 0.7, 4);
                const decoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
                const deco = new THREE.Mesh(decoGeom, decoMat);
                
                const localOffset = new THREE.Vector3(Math.cos(angle) * (p.radius - 0.6), p.height * 0.5 + 0.35, Math.sin(angle) * (p.radius - 0.6));
                localOffset.applyQuaternion(mesh.quaternion);
                
                deco.position.copy(p.localPos).add(localOffset);
                deco.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                asteroid.add(deco);
                planetStructures.push(deco);
            }
        } else if (currentPlanet.id === "helios") {
            for (let i = 0; i < 2; i++) {
                const angle = (i / 2) * Math.PI * 2;
                const decoGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6);
                const decoMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.9 });
                const deco = new THREE.Mesh(decoGeom, decoMat);
                
                const localOffset = new THREE.Vector3(Math.cos(angle) * (p.radius - 0.5), p.height * 0.5 + 0.25, Math.sin(angle) * (p.radius - 0.5));
                localOffset.applyQuaternion(mesh.quaternion);
                
                deco.position.copy(p.localPos).add(localOffset);
                deco.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                asteroid.add(deco);
                planetStructures.push(deco);
            }
        }
    });
    
    // 湖の描画
    lakes.forEach(l => {
        const x = ASTEROID_RADIUS * Math.sin(l.phi) * Math.cos(l.theta);
        const y = ASTEROID_RADIUS * Math.sin(l.phi) * Math.sin(l.theta);
        const z = ASTEROID_RADIUS * Math.cos(l.phi);
        l.localPos = new THREE.Vector3(x, y, z);
        
        const normal = l.localPos.clone().normalize();
        const geom = new THREE.CylinderGeometry(l.radius, l.radius, 0.1, 32);
        
        // 頂点を歪ませて自然な形状にする
        const posAttr = geom.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            let px = posAttr.getX(i);
            let py = posAttr.getY(i);
            let pz = posAttr.getZ(i);
            
            const r = Math.sqrt(px*px + pz*pz);
            if (r > 0.01) {
                const angle = Math.atan2(pz, px);
                const noise = 1 + 0.15 * Math.sin(angle * 3) + 0.08 * Math.cos(angle * 5) + 0.04 * Math.sin(angle * 7);
                const targetR = r * noise;
                px = Math.cos(angle) * targetR;
                pz = Math.sin(angle) * targetR;
                posAttr.setXYZ(i, px, py, pz);
            }
        }
        geom.computeVertexNormals();
        
        let mat;
        if (currentPlanet.id === "artemis") {
            mat = new THREE.MeshStandardMaterial({
                color: l.color,
                emissive: l.color,
                emissiveIntensity: 1.2,
                transparent: true,
                opacity: 0.8,
                roughness: 0.1
            });
        } else if (currentPlanet.id === "boreas") {
            mat = new THREE.MeshPhysicalMaterial({
                color: l.color,
                emissive: 0x0055ff,
                emissiveIntensity: 0.6,
                transparent: true,
                opacity: 0.85,
                roughness: 0.05,
                metalness: 0.9
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: l.color,
                emissive: 0x8b4513,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.9,
                roughness: 0.9
            });
        }
        
        const mesh = new THREE.Mesh(geom, mat);
        const meshPos = l.localPos.clone().addScaledVector(normal, 0.04);
        mesh.position.copy(meshPos);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        
        asteroid.add(mesh);
        planetStructures.push(mesh);
        
        const rimGeom = new THREE.RingGeometry(l.radius, l.radius + 0.3, 32);
        
        // 頂点を歪ませて自然な形状にする
        const rimPosAttr = rimGeom.attributes.position;
        for (let i = 0; i < rimPosAttr.count; i++) {
            let px = rimPosAttr.getX(i);
            let py = rimPosAttr.getY(i);
            let pz = rimPosAttr.getZ(i);
            
            const r = Math.sqrt(px*px + py*py);
            if (r > 0.01) {
                const angle = Math.atan2(py, px);
                const noise = 1 + 0.15 * Math.sin(angle * 3) + 0.08 * Math.cos(angle * 5) + 0.04 * Math.sin(angle * 7);
                const targetR = r * noise;
                px = Math.cos(angle) * targetR;
                py = Math.sin(angle) * targetR;
                rimPosAttr.setXYZ(i, px, py, pz);
            }
        }
        rimGeom.computeVertexNormals();
        
        let rimMat;
        if (currentPlanet.id === "artemis") {
            rimMat = new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.9, side: THREE.DoubleSide });
        } else if (currentPlanet.id === "boreas") {
            rimMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.9, side: THREE.DoubleSide });
        } else {
            rimMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9, side: THREE.DoubleSide });
        }
        const rim = new THREE.Mesh(rimGeom, rimMat);
        rim.position.copy(l.localPos.clone().addScaledVector(normal, 0.06));
        rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        asteroid.add(rim);
        planetStructures.push(rim);
    });
}

function triggerLakeSplash(localPos) {
    const now = Date.now();
    if (now - lastSplashTime < 800) return;
    lastSplashTime = now;
    
    playSplashSound();
    spawnSplashParticles(localPos);
}

function playSplashSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.25);
    filter.Q.value = 1.0;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noise.start(now);
    noise.stop(now + 0.26);
}

function spawnSplashParticles(pos) {
    const particleCount = 8 + Math.floor(Math.random() * 5);
    const splashColor = currentPlanet.id === "boreas" ? 0x1b4f72 : (currentPlanet.id === "helios" ? 0xc86400 : 0x00f0ff);
    const normal = pos.clone().normalize();
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.06 + Math.random() * 0.08;
        const geom = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: splashColor,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        const startPos = pos.clone().addScaledVector(normal, 0.1);
        mesh.position.copy(startPos);
        
        asteroid.add(mesh);
        
        const tangent = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).projectOnPlane(normal).normalize();
        const speed = 1.5 + Math.random() * 2.0;
        const vel = tangent.clone().multiplyScalar(speed).addScaledVector(normal, 2.0 + Math.random() * 2.0);
        
        activeParticles.push({
            mesh: mesh,
            dir: vel.clone().normalize(),
            speed: vel.length(),
            age: 0,
            maxAge: 0.4 + Math.random() * 0.3,
            rotSpeed: 0,
            angle: 0,
            spiralRadius: 0
        });
    }
}

const grassClumps = [];

// 小惑星オブジェクトの作成
function createAsteroid() {
    const geometry = new THREE.SphereGeometry(ASTEROID_RADIUS, 64, 64);
    const dirtTexture = createDirtTexture(currentPlanet);

    const material = new THREE.MeshStandardMaterial({
        map: dirtTexture,
        roughness: 0.94,
        metalness: 0.02,
        flatShading: false
    });

    asteroid = new THREE.Mesh(geometry, material);
    asteroid.receiveShadow = true;
    asteroid.castShadow = true;
    scene.add(asteroid);

    // 草を2600個初期配置
    if (!currentPlanet.grownGrassIndices) {
        currentPlanet.grownGrassIndices = new Set();
    }
    const grassCount = 2600;
    for (let i = 0; i < grassCount; i++) {
        const grass = createGrassClump(currentPlanet);
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = ASTEROID_RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = ASTEROID_RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = ASTEROID_RADIUS * Math.cos(phi);
        
        const pos = new THREE.Vector3(x, y, z);
        grass.position.copy(pos);
        
        const normal = pos.clone().normalize();
        grass.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        
        const baseScale = 0.85 + Math.random() * 0.5;
        const isGrown = currentPlanet.grownGrassIndices.has(i);
        const startScale = isGrown ? baseScale : 0.0;
        grass.scale.set(startScale, startScale, startScale);
        asteroid.add(grass);

        grassClumps.push({
            mesh: grass,
            scale: startScale,
            targetScale: startScale,
            baseScale: baseScale,
            age: Math.random() * 100
        });
    }

    gridHelperGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ 
        color: 0x140b08, 
        transparent: true, 
        opacity: 0.22 
    });

    for (let i = 1; i < GRID_LAT_DIVISIONS; i++) {
        const phi = -Math.PI / 2 + i * deltaLat;
        const r = Math.cos(phi) * (ASTEROID_RADIUS + 0.02);
        const y = Math.sin(phi) * (ASTEROID_RADIUS + 0.02);
        
        const ringPoints = [];
        for (let j = 0; j <= 96; j++) {
            const theta = (j / 96) * Math.PI * 2;
            ringPoints.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
        }
        const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringLine = new THREE.Line(ringGeom, lineMat);
        gridHelperGroup.add(ringLine);
    }

    for (let i = 0; i < GRID_LON_DIVISIONS; i++) {
        const theta = i * deltaLon;
        const archPoints = [];
        for (let j = 0; j <= 48; j++) {
            const phi = -Math.PI / 2 + (j / 48) * Math.PI;
            const r = Math.cos(phi) * (ASTEROID_RADIUS + 0.02);
            const y = Math.sin(phi) * (ASTEROID_RADIUS + 0.02);
            archPoints.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
        }
        const archGeom = new THREE.BufferGeometry().setFromPoints(archPoints);
        const archLine = new THREE.Line(archGeom, lineMat);
        gridHelperGroup.add(archLine);
    }

    asteroid.add(gridHelperGroup);
    spawnPlanetStructures();
}
createAsteroid();

// ==========================================
// 宇宙ワープポータル (3Dオブジェクト) の作成
// ==========================================
let warpPortalGroup;
let portalLocalPos = new THREE.Vector3();
let portalBeacon;

function createWarpPortal3D() {
    warpPortalGroup = new THREE.Group();
    
    // 土台リングの金属プレート
    const baseGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.35, 24);
    const baseMat = new THREE.MeshStandardMaterial({ 
        color: 0x4a4e69, 
        metalness: 0.88, 
        roughness: 0.15 
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    warpPortalGroup.add(baseMesh);
    
    // 土台の上に光る内側のリング
    const innerRingGeom = new THREE.TorusGeometry(1.3, 0.08, 8, 32);
    const innerRingMat = new THREE.MeshStandardMaterial({
        color: 0x9b5de5,
        emissive: 0x9b5de5,
        emissiveIntensity: 1.2
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeom, innerRingMat);
    innerRingMesh.rotation.x = Math.PI / 2;
    innerRingMesh.position.y = 0.18;
    warpPortalGroup.add(innerRingMesh);
    
    // 2本のクリスタルオベリスク柱 (両端)
    const pillarGeom = new THREE.ConeGeometry(0.24, 2.4, 4);
    pillarGeom.scale(1.0, 1.0, 0.4);
    const pillarMat = new THREE.MeshStandardMaterial({ 
        color: 0x9b5de5, 
        emissive: 0x7209b7,
        emissiveIntensity: 1.0,
        roughness: 0.1,
        metalness: 0.6
    });
    
    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-1.15, 1.2, 0);
    leftPillar.castShadow = true;
    warpPortalGroup.add(leftPillar);
    
    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(1.15, 1.2, 0);
    rightPillar.castShadow = true;
    warpPortalGroup.add(rightPillar);
    
    // 中央に浮き上がるワープエネルギーコア (半透明リング)
    const coreRingGeom = new THREE.TorusGeometry(0.72, 0.07, 8, 24);
    const coreRingMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00bfff,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1
    });
    const coreRing = new THREE.Mesh(coreRingGeom, coreRingMat);
    coreRing.position.y = 1.15;
    coreRing.name = "coreRing";
    warpPortalGroup.add(coreRing);
    
    // ゲート中心のプラズマ球
    const sphereGeom = new THREE.SphereGeometry(0.22, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const coreSphere = new THREE.Mesh(sphereGeom, sphereMat);
    coreSphere.position.y = 1.15;
    coreSphere.name = "coreSphere";
    warpPortalGroup.add(coreSphere);
    
    // 📡 ポータルガイドビーコン (紫色のネオン)
    const portalBeaconGeom = new THREE.CylinderGeometry(0.05, 0.6, 25, 8, 1, true);
    portalBeaconGeom.translate(0, 12.5, 0); 
    const portalBeaconMat = new THREE.MeshBasicMaterial({
        color: 0x9b5de5, // 紫色
        transparent: true,
        opacity: isGuideActive ? 0.35 : 0,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    portalBeacon = new THREE.Mesh(portalBeaconGeom, portalBeaconMat);
    portalBeacon.position.set(0, 1.15, 0);
    portalBeacon.name = "portalBeacon";
    portalBeacon.visible = isGuideActive;
    warpPortalGroup.add(portalBeacon);
    
    portalLocalPos.set(0, 0, ASTEROID_RADIUS);
    warpPortalGroup.position.copy(portalLocalPos);
    
    const normal = portalLocalPos.clone().normalize();
    warpPortalGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    
    asteroid.add(warpPortalGroup);
    updatePortalVisibility(false);
}
createWarpPortal3D();

// 配置プレビューマス
let gridIndicator;
function createGridIndicator() {
    const ringGeom = new THREE.RingGeometry(0.55, 0.7, 16);
    const ringMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.65, 
        side: THREE.DoubleSide 
    });
    gridIndicator = new THREE.Mesh(ringGeom, ringMat);
    gridIndicator.rotation.x = Math.PI / 2;
    asteroid.add(gridIndicator);
}
createGridIndicator();

// プレイヤーの作成
let player;
const playerGroup = new THREE.Group();
let playerLocalPos = new THREE.Vector3(0, ASTEROID_RADIUS, 0); 
let playerHeight = 0; 
let playerJumpVel = 0; 
let isJumping = false;
let isHoveringMode = false;
let grassSeeds = [];

// プレイヤー表情関連の変数
let playerFaceCanvas, playerFaceCtx, playerFaceTexture;
let currentExpression = "NORMAL";
let lastExpression = "";
let blinkTimer = 0;
let isBlinking = false;
let timeSinceLastBlink = 0;
let nextBlinkTime = 2.0 + Math.random() * 3.0;
const blinkDuration = 0.12;

function drawPlayerFace(expression) {
    if (!playerFaceCanvas) {
        playerFaceCanvas = document.createElement('canvas');
        playerFaceCanvas.width = 256;
        playerFaceCanvas.height = 128;
        playerFaceCtx = playerFaceCanvas.getContext('2d');
    }
    
    const ctx = playerFaceCtx;
    ctx.clearRect(0, 0, 256, 128);
    
    // ネオンブルーの発光色を設定
    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // ネオンの光彩エフェクト
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    
    const eyeY = 64;
    const leftEyeX = 80;
    const rightEyeX = 176;
    const eyeWidth = 36;
    
    if (expression === "BLINK") {
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - eyeWidth/2, eyeY);
        ctx.lineTo(leftEyeX + eyeWidth/2, eyeY);
        ctx.moveTo(rightEyeX - eyeWidth/2, eyeY);
        ctx.lineTo(rightEyeX + eyeWidth/2, eyeY);
        ctx.stroke();
    } else if (expression === "PLANTING") {
        ctx.beginPath();
        ctx.moveTo(leftEyeX - eyeWidth/2, eyeY + 8);
        ctx.lineTo(leftEyeX, eyeY - 12);
        ctx.lineTo(leftEyeX + eyeWidth/2, eyeY + 8);
        
        ctx.moveTo(rightEyeX - eyeWidth/2, eyeY + 8);
        ctx.lineTo(rightEyeX, eyeY - 12);
        ctx.lineTo(rightEyeX + eyeWidth/2, eyeY + 8);
        ctx.stroke();
    } else if (expression === "WARPING") {
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 14, eyeY - 14); ctx.lineTo(leftEyeX + 14, eyeY + 14);
        ctx.moveTo(leftEyeX + 14, eyeY - 14); ctx.lineTo(leftEyeX - 14, eyeY + 14);
        ctx.moveTo(rightEyeX - 14, eyeY - 14); ctx.lineTo(rightEyeX + 14, eyeY + 14);
        ctx.moveTo(rightEyeX + 14, eyeY - 14); ctx.lineTo(rightEyeX - 14, eyeY + 14);
        ctx.stroke();
    } else if (expression === "JUMPING") {
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 16, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 16, 0, Math.PI * 2);
        ctx.fill();
    } else if (expression === "WALKING") {
        ctx.beginPath();
        const villagerTypes = [
    {
        id: "cat",
        name: "ニャンコ",
        suitColor: 0xffb5c5, 
        skinColor: 0xfff0db,
        scale: 0.95,
        voicePitch: 1.0,
        earType: "cat",
        dialogues: [
            "ニャァー！この小惑星の空気、すっごく澄んでいて最高だニャ！飾り付けのセンスもピカイチだニャ！",
            "こんなに綺麗な星、宇宙のどこを探しても見つからないニャ！君は天才的なテラフォーマーだニャ！",
            "ここから見る宇宙の星空と、君が植えてくれたネオン植物の輝きのコラボ……センス抜群だニャ！大絶賛ニャ！",
            "ふかふかの草のじゅうたんが気持ち良すぎるニャ〜！毎日ここで寝転がりたいニャ！君のおかげだニャ！"
        ],
        negotiation: "あのニャ……実はこの星がすごく気に入っちゃったのニャ。ずっとここに定住して、君と暮らしたいのニャ！いいかニャ？"
    },
    {
        id: "rabbit",
        name: "ウサ吉",
        suitColor: 0x98ffeb, 
        skinColor: 0xffffff,
        scale: 0.9,
        voicePitch: 1.25,
        earType: "rabbit",
        dialogues: [
            "ピョン！この星の地面はふかふかでジャンプしがいがあるピョン！センス良すぎピョン！",
            "うわぁ、光るキノコやベリーがとっても神秘的だピョン！最高の惑星開拓センスだピョン！",
            "君がこの美しい花を植えてくれたの？本当にありがとうピョン！居心地が最高ピョン！",
            "ここから星空を眺めていると、心がすごくぽかぽかしてくるピョン！君に大感謝ピョン！"
        ],
        negotiation: "ねぇねぇピョン！僕、この素敵な星に定住して、ずっとここで遊びたいピョン！許可をくれるピョン？"
    },
    {
        id: "dog",
        name: "ワン太",
        suitColor: 0xffe298, 
        skinColor: 0xd7a15c,
        scale: 1.0,
        voicePitch: 0.85,
        earType: "dog",
        dialogues: [
            "ワン！星がどんどん美しくなっていって、走り回るのがすっごく楽しいワン！センス抜群ワン！",
            "この土の匂い、いい匂いがするワン！君がお手入れしてくれたからだワン！大絶賛ワン！",
            "こんな綺麗な星に招待してくれてありがとうだワン！君と友達になれて嬉しいワン！",
            "宇宙の隅っこにこんな天国みたいな星があるなんて驚きだワン！君の開拓魂はすごいワン！"
        ],
        negotiation: "ワン！僕、この小惑星にずーっと定住したいワン！毎日一緒にお散歩させてほしいワン！いいワン？"
    },
    {
        id: "bear",
        name: "クマ五郎",
        suitColor: 0xd8b5ff, 
        skinColor: 0x8b5a2b,
        scale: 1.2,
        voicePitch: 0.7,
        earType: "bear",
        dialogues: [
            "ふむ、この星のネオン植物たちの癒やし効果は極上クオリティだクマ！大したものクマ！",
            "小惑星がこんなに美しく生まれ変わるなんて感動したクマ！君のセンスは一流クマ！",
            "この柔らかい草の上でお昼寝するのが最近の夢クマ。本当にいい環境をありがとうクマ！",
            "これほど綺麗な景色に囲まれるのは久しぶりクマ！君の努力を私は大絶賛するクマ！"
        ],
        negotiation: "うむ、決めたクマ！私をこの星の正式な住人として、定住させてはくれないクマ？ずっと星を見守りたいクマ！"
    },
    {
        id: "bee",
        name: "ハチスケ",
        suitColor: 0xffe066, 
        skinColor: 0x222222,
        scale: 0.85,
        voicePitch: 1.4,
        earType: "bee",
        dialogues: [
            "ブーン！お花がいっぱいで、とってもいい香りのする星だブーン！センス最高だブーン！",
            "木は一本もないのに、こんなに綺麗な花がたくさん咲いているなんて、ここは天国だブーン！",
            "お花畑を飛び回るのが本当に楽しいブーン！君に大感謝だブーン！",
            "ハチミツがたくさん取れそうな予感がするブーン！君のお花の開拓センスは大絶賛だブーン！"
        ],
        negotiation: "実は、このお花だらけの星がすごく気に入っちゃったブーン！ずっとここに定住して、美味しいハチミツを集めてあげたいブーン！いいブーン？"
    },
    {
        id: "koala",
        name: "コアラノシン",
        suitColor: 0xa8a8a8, 
        skinColor: 0xb0b0b0,
        scale: 1.05,
        voicePitch: 0.6,
        earType: "koala",
        dialogues: [
            "ふあぁ……木がたくさん生い茂っていて、木登りに最高の星だコアラ……のんびりできるコアラ……",
            "お花は全然ないけれど、この豊かな森 of 匂い、すっごく落ち着くコアラ……センス抜群コアラ。",
            "美味しい葉っぱがたくさん茂るこの木、大絶賛コアラ！のぼり心地も最高コアラ〜",
            "木陰でお昼寝するのが一番の幸せコアラ。こんな静かな森を作ってくれてありがとうコアラ。"
        ],
        negotiation: "ふむ……この静かな森がとても気に入ったコアラ. ここに定住して、のんびり暮らしてもいいコアラ？"
    },
    {
        id: "fox",
        name: "コン太",
        suitColor: 0xff7a00, 
        skinColor: 0xffa040,
        scale: 1.0,
        voicePitch: 1.1,
        earType: "fox",
        dialogues: [
            "コンコン！この星はどこか不思議な魅力に満ちているコン！センス最高だコン！",
            "こんなにキラキラした星で遊べるなんて、狐冥利に尽きるコン！大絶賛だコン！",
            "君の作ったこの景色、ずっと眺めていても飽きないコン！本当にありがとうコン！",
            "風が心地よく通り抜けていくコン！君が開拓したこの星は極上コン！"
        ],
        negotiation: "コンコン！実はこの美しい星が気に入っちゃったコン。ここに定住して、ずっと君とお喋りしたいコン！いいコン？"
    },
    {
        id: "mouse",
        name: "チュウ助",
        suitColor: 0x9bafd9, 
        skinColor: 0xccd5ff,
        scale: 0.75,
        voicePitch: 1.55,
        earType: "mouse",
        dialogues: [
            "チュウ！こんなに広い星を自由に走り回れるなんてハッピーだチュウ！",
            "あちこち探検するのがワクワクするチュウ！君のセンスは最高だチュウ！",
            "こんなに綺麗な花や木を植えてくれて感謝だチュウ！大絶賛するチュウ！",
            "小さくて可愛いものがたくさんあって、落ち着く星だチュウ！"
        ],
        negotiation: "チュウ！僕もこの小惑星の住人になりたいチュウ！隅っこに定住させてほしいチュウ！いいチュウ？"
    },
    {
        id: "pig",
        name: "ぶう太",
        suitColor: 0xffc0cb, 
        skinColor: 0xffccd5,
        scale: 1.05,
        voicePitch: 0.8,
        earType: "pig",
        dialogues: [
            "ブヒッ！この星の土はとっても掘りやすくて心地よいブヒ！",
            "美味しい食べ物がたくさん育ちそうな素晴らしい星だブヒ！大絶賛ブヒ！",
            "君が植えてくれた植物のおかげで、空気がとっても美味しいブヒ！",
            "のんびりゴロゴロするのに最高の場所だブヒ！君の開拓センスに感謝ブヒ！"
        ],
        negotiation: "ブヒッ！決めたブヒ！この住み心地の良い星に定住して、ずっと暮らしたいブヒ！お許しをブヒ？"
    },
    {
        id: "frog",
        name: "ケロ助",
        suitColor: 0x5cd65c, 
        skinColor: 0x77dd77,
        scale: 0.85,
        voicePitch: 1.2,
        earType: "frog",
        dialogues: [
            "ケロケロ！水辺や高台があって、跳ねるのがとっても楽しいケロ！",
            "この星の湿度がボクにとって快適すぎるケロ！君のセンスは大絶賛ケロ！",
            "綺麗な植物たちに囲まれて、毎日がフェスティバルケロ！ありがとうケロ！",
            "こんな夢のような小惑星を開拓するなんて、君はすごいテラフォーマーケロ！"
        ],
        negotiation: "ケロケロ！ボク、この星に定住して、ずっと大ジャンプしていたいケロ！ここに住んでもいいケロ？"
    },
    {
        id: "alien",
        name: "ゾルゲル",
        suitColor: 0xbc13fe, 
        skinColor: 0x39ff14,
        scale: 0.9,
        voicePitch: 0.95,
        earType: "alien",
        dialogues: [
            "ピピッ……この星のエネルギーフィールドは非常に安定しているゾル。センス優秀ゾル。",
            "地球の植物と宇宙のネオンの融合……大絶賛に値する芸術ゾル！",
            "遠い銀河から来たが、ここが一番落ち着くポータブル星ゾル。感謝するゾル。",
            "君が開拓したこの大地、極めて高度な文明的テラフォーミングゾル！"
        ],
        negotiation: "ピピッ！私のインテリジェンスがここに定住することを推奨しているゾル。正式な定住を許可してほしいゾル！"
    },
    {
        id: "panda",
        name: "パン助",
        suitColor: 0x333333, 
        skinColor: 0xffffff,
        scale: 1.15,
        voicePitch: 0.75,
        earType: "panda",
        dialogues: [
            "パオーン？いや, パンダだから笹が食べたいパン！でもこの星の植物も綺麗で美味しいパン！",
            "白と黒の対比が美しいこの星の景色, 大絶賛だパン！センス抜群パン！",
            "木陰で笹（？）をかじりながら星空を見るのがお気に入りだパン。ありがとうパン！",
            "のんびり転がっているだけでハッピーになれる星だパン。君のおかげだパン！"
        ],
        negotiation: "うむ、この星に定住するパン！毎日美味しい空気を吸って、君とゴロゴロしたいパン！いいパン？"
    },
    {
        id: "monkey",
        name: "サル吉",
        suitColor: 0xb5651d, 
        skinColor: 0xcd853f,
        scale: 0.95,
        voicePitch: 1.15,
        earType: "monkey",
        dialogues: [
            "ウキッ！高いところがいっぱいで最高にアクティブになれる星だウキ！",
            "君が植えてくれた木々は、どれも登りやすくて最高だウキ！大絶賛ウキ！",
            "あっちの惑星からこっちの惑星まで飛び回るのも楽しいウキ！センス最高ウキ！",
            "美味しい果物をたくさん実らせてくれてありがとうウキ！ウキウキするウキ！"
        ],
        negotiation: "ウキッ！このアクティブで美味しい星に定住したいウキ！毎日木登りして暮らしたいウキ！お許しをウキ！"
    },
    {
        id: "sheep",
        name: "メエ子",
        suitColor: 0xf5f5f5, 
        skinColor: 0xffe4e1,
        scale: 1.0,
        voicePitch: 1.3,
        earType: "sheep",
        dialogues: [
            "メェ〜！ふわふわ of 草が生い茂っていて、食べてしまいたいほど素敵メェ！",
            "空に浮かぶ星々がとっても優しく輝いているメェ。センスの塊メェ！",
            "こんな綺麗な星でお散歩できるなんて、夢のようだメェ。大絶賛メェ！",
            "優しくて暖かみのあるこの大地、作ってくれてありがとうメェ〜"
        ],
        negotiation: "メェ〜！実はこの居心地の良い星に定住したいメェ。ずっとここで草をはんでいたいメェ。いいメェ？"
    },
    {
        id: "squirrel",
        name: "リスミ",
        suitColor: 0xe67e22, 
        skinColor: 0xd35400,
        scale: 0.8,
        voicePitch: 1.45,
        earType: "squirrel",
        dialogues: [
            "キキッ！木の実がたくさん収穫できそうな大好物の星だリス！センス抜群だリス！",
            "このしっぽを振り回して走りたくなる軽快な星だリス！大絶賛だリス！",
            "たくさん木を植えてくれてありがとうリス！木漏れ日が最高だリス！",
            "宇宙の中で一番お気に入りの秘密基地になりそうだリス！感謝だリス！"
        ],
        negotiation: "キキッ！決めたリス！この星に定住して、木の実の貯蔵庫を作りたいリス！ここに住んでもいいリス？"
    }
];�やし効果は極上クオリティだクマ！大したものクマ！",
            "小惑星がこんなに美しく生まれ変わるなんて感動したクマ！君のセンスは一流クマ！",
            "この柔らかい草の上でお昼寝するのが最近の夢クマ。本当にいい環境をありがとうクマ！",
            "これほど綺麗な景色に囲まれるのは久しぶりクマ！君の努力を私は大絶賛するクマ！"
        ],
        negotiation: "うむ、決めたクマ！私をこの星の正式な住人として、定住させてはくれないクマ？ずっと星を見守りたいクマ！"
    },
    {
        id: "bee",
        name: "ハチスケ",
        suitColor: 0xffe066, 
        voicePitch: 1.4,
        earType: "bee",
        dialogues: [
            "ブーン！お花がいっぱいで、とってもいい香りのする星だブーン！センス最高だブーン！",
            "木は一本もないのに、こんなに綺麗な花がたくさん咲いているなんて、ここは天国だブーン！",
            "お花畑を飛び回るのが本当に楽しいブーン！君に大感謝だブーン！",
            "ハチミツがたくさん取れそうな予感がするブーン！君のお花の開拓センスは大絶賛だブーン！"
        ],
        negotiation: "実は、このお花だらけの星がすごく気に入っちゃったブーン！ずっとここに定住して、美味しいハチミツを集めてあげたいブーン！いいブーン？"
    },
    {
        id: "koala",
        name: "コアラノシン",
        suitColor: 0xa8a8a8, 
        voicePitch: 0.6,
        earType: "koala",
        dialogues: [
            "ふあぁ……木がたくさん生い茂っていて、木登りに最高の星だコアラ……のんびりできるコアラ……",
            "お花は全然ないけれど、この豊かな森 of 匂い、すっごく落ち着くコアラ……センス抜群コアラ。",
            "美味しい葉っぱがたくさん茂るこの木、大絶賛コアラ！のぼり心地も最高コアラ〜",
            "木陰でお昼寝するのが一番の幸せコアラ。こんな静かな森を作ってくれてありがとうコアラ。"
        ],
        negotiation: "ふむ……この静かな森がとても気に入ったコアラ。ここに定住して、のんびり暮らしてもいいコアラ？"
    },
    {
        id: "fox",
        name: "コン太",
        suitColor: 0xff7a00, 
        voicePitch: 1.1,
        earType: "fox",
        dialogues: [
            "コンコン！この星はどこか不思議な魅力に満ちているコン！センス最高だコン！",
            "こんなにキラキラした星で遊べるなんて、狐冥利に尽きるコン！大絶賛だコン！",
            "君の作ったこの景色、ずっと眺めていても飽きないコン！本当にありがとうコン！",
            "風が心地よく通り抜けていくコン！君が開拓したこの星は極上コン！"
        ],
        negotiation: "コンコン！実はこの美しい星が気に入っちゃったコン。ここに定住して、ずっと君とお喋りしたいコン！いいコン？"
    },
    {
        id: "mouse",
        name: "チュウ助",
        suitColor: 0x9bafd9, 
        voicePitch: 1.55,
        earType: "mouse",
        dialogues: [
            "チュウ！こんなに広い星を自由に走り回れるなんてハッピーだチュウ！",
            "あちこち探検するのがワクワクするチュウ！君のセンスは最高だチュウ！",
            "こんなに綺麗な花や木を植えてくれて感謝だチュウ！大絶賛するチュウ！",
            "小さくて可愛いものがたくさんあって、落ち着く星だチュウ！"
        ],
        negotiation: "チュウ！僕もこの小惑星の住人になりたいチュウ！隅っこに定住させてほしいチュウ！いいチュウ？"
    },
    {
        id: "pig",
        name: "ぶう太",
        suitColor: 0xffc0cb, 
        voicePitch: 0.8,
        earType: "pig",
        dialogues: [
            "ブヒッ！この星の土はとっても掘りやすくて心地よいブヒ！",
            "美味しい食べ物がたくさん育ちそうな素晴らしい星だブヒ！大絶賛ブヒ！",
            "君が植えてくれた植物のおかげで、空気がとっても美味しいブヒ！",
            "のんびりゴロゴロするのに最高の場所だブヒ！君の開拓センスに感謝ブヒ！"
        ],
        negotiation: "ブヒッ！決めたブヒ！この住み心地の良い星に定住して、ずっと暮らしたいブヒ！お許しをブヒ？"
    },
    {
        id: "frog",
        name: "ケロ助",
        suitColor: 0x5cd65c, 
        voicePitch: 1.2,
        earType: "frog",
        dialogues: [
            "ケロケロ！水辺や高台があって、跳ねるのがとっても楽しいケロ！",
            "この星の湿度がボクにとって快適すぎるケロ！君のセンスは大絶賛ケロ！",
            "綺麗な植物たちに囲まれて、毎日がフェスティバルケロ！ありがとうケロ！",
            "こんな夢のような小惑星を開拓するなんて、君はすごいテラフォーマーケロ！"
        ],
        negotiation: "ケロケロ！ボク、この星に定住して、ずっと大ジャンプしていたいケロ！ここに住んでもいいケロ？"
    },
    {
        id: "alien",
        name: "ゾルゲル",
        suitColor: 0xbc13fe, 
        voicePitch: 0.95,
        earType: "alien",
        dialogues: [
            "ピピッ……この星のエネルギーフィールドは非常に安定しているゾル。センス優秀ゾル。",
            "地球の植物と宇宙のネオンの融合……大絶賛に値する芸術ゾル！",
            "遠い銀河から来たが、ここが一番落ち着くポータブル星ゾル。感謝するゾル。",
            "君が開拓したこの大地、極めて高度な文明的テラフォーミングゾル！"
        ],
        negotiation: "ピピッ！私のインテリジェンスがここに定住することを推奨しているゾル。正式な定住を許可してほしいゾル！"
    },
    {
        id: "panda",
        name: "パン助",
        suitColor: 0x333333, 
        voicePitch: 0.75,
        earType: "panda",
        dialogues: [
            "パオーン？いや、パンダだから笹が食べたいパン！でもこの星の植物も綺麗で美味しいパン！",
            "白と黒の対比が美しいこの星の景色、大絶賛だパン！センス抜群パン！",
            "木陰で笹（？）をかじりながら星空を見るのがお気に入りだパン。ありがとうパン！",
            "のんびり転がっているだけでハッピーになれる星だパン。君のおかげだパン！"
        ],
        negotiation: "うむ、この星に定住するパン！毎日美味しい空気を吸って、君とゴロゴロしたいパン！いいパン？"
    },
    {
        id: "monkey",
        name: "サル吉",
        suitColor: 0xb5651d, 
        voicePitch: 1.15,
        earType: "monkey",
        dialogues: [
            "ウキッ！高いところがいっぱいで最高にアクティブになれる星だウキ！",
            "君が植えてくれた木々は、どれも登りやすくて最高だウキ！大絶賛ウキ！",
            "あっちの惑星からこっちの惑星まで飛び回るのも楽しいウキ！センス最高ウキ！",
            "美味しい果物をたくさん実らせてくれてありがとうウキ！ウキウキするウキ！"
        ],
        negotiation: "ウキッ！このアクティブで美味しい星に定住したいウキ！毎日木登りして暮らしたいウキ！お許しをウキ！"
    },
    {
        id: "sheep",
        name: "メエ子",
        suitColor: 0xf5f5f5, 
        voicePitch: 1.3,
        earType: "sheep",
        dialogues: [
            "メェ〜！ふわふわの草が生い茂っていて、食べてしまいたいほど素敵メェ！",
            "空に浮かぶ星々がとっても優しく輝いているメェ。センスの塊メェ！",
            "こんな綺麗な星でお散歩できるなんて、夢のようだメェ。大絶賛メェ！",
            "優しくて暖かみのあるこの大地、作ってくれてありがとうメェ〜"
        ],
        negotiation: "メェ〜！実はこの居心地の良い星に定住したいメェ。ずっとここで草をはんでいたいメェ。いいメェ？"
    },
    {
        id: "squirrel",
        name: "リスミ",
        suitColor: 0xe67e22, 
        voicePitch: 1.45,
        earType: "squirrel",
        dialogues: [
            "キキッ！木の実がたくさん収穫できそうな大好物の星だリス！センス抜群だリス！",
            "このしっぽを振り回して走りたくなる軽快な星だリス！大絶賛だリス！",
            "たくさん木を植えてくれてありがとうリス！木漏れ日が最高だリス！",
            "宇宙の中で一番お気に入りの秘密基地になりそうだリス！感謝だリス！"
        ],
        negotiation: "キキッ！決めたリス！この星に定住して、木の実の貯蔵庫を作りたいリス！ここに住んでもいいリス？"
    }
];

// ハートの愛でる演出パーティクル
const adorationParticles = [];

function spawnAdorationHeart(localPos) {
    const geom = new THREE.SphereGeometry(0.08, 6, 6);
    geom.scale(1.0, 1.2, 0.7); 
    const mat = new THREE.MeshBasicMaterial({
        color: 0xff4d6d,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    });
    
    const group = new THREE.Group();
    const lSphere = new THREE.Mesh(geom, mat);
    lSphere.position.x = -0.06;
    lSphere.rotation.z = -0.3;
    group.add(lSphere);
    
    const rSphere = new THREE.Mesh(geom, mat);
    rSphere.position.x = 0.06;
    rSphere.rotation.z = 0.3;
    group.add(rSphere);
    
    const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0.8 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
    );
    group.position.copy(localPos).add(offset);
    asteroid.add(group);
    
    const dir = localPos.clone().normalize();
    adorationParticles.push({
        mesh: group,
        dir: dir,
        speed: 1.2 + Math.random() * 0.8,
        age: 0,
        maxAge: 1.2 + Math.random() * 0.6
    });
}

// 3D感情ポップアップシステム
const activeEmotions = [];

function spawnEmotionIcon(parentMesh, type) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let text = "🎵";
    if (type === 'notice') text = "❗";
    if (type === 'heart') text = "❤️";
    if (type === 'star') text = "⭐";
    if (type === 'question') text = "❓";
    
    ctx.fillText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.position.set(0, 1.4, 0);
    sprite.scale.set(0.65, 0.65, 0.65);
    
    parentMesh.add(sprite);
    
    activeEmotions.push({
        sprite: sprite,
        parent: parentMesh,
        age: 0,
        maxAge: 1.2,
        baseY: 1.4
    });
}

function updateEmotions(delta) {
    for (let i = activeEmotions.length - 1; i >= 0; i--) {
        const emo = activeEmotions[i];
        emo.age += delta;
        
        if (emo.age >= emo.maxAge) {
            try {
                emo.parent.remove(emo.sprite);
                emo.sprite.material.map.dispose();
                emo.sprite.material.dispose();
            } catch(e){}
            activeEmotions.splice(i, 1);
            continue;
        }
        
        const progress = emo.age / emo.maxAge;
        emo.sprite.position.y = emo.baseY + progress * 0.45;
        emo.sprite.material.opacity = 1.0 - progress;
        
        const scale = 0.65 * (1.0 + Math.sin(progress * Math.PI) * 0.15);
        emo.sprite.scale.set(scale, scale, scale);
    }
}

// ロケットの3Dモデリング
// ロケットの3Dモデリング
function buildRocket(styleType = 0) {
    const group = new THREE.Group();
    
    // スタイルごとの設定
    let bodyColor = 0xffffff;
    let accentColor = 0xff3344;
    let windowColor = 0x00f0ff;
    let emissiveColor = 0x00bfff;
    let isCyber = (styleType === 1);
    let isSteampunk = (styleType === 2);
    let isWood = (styleType === 3);
    let isPop = (styleType === 4);
    
    if (isCyber) {
        bodyColor = 0x1b1c26; // サイバーダーク
        accentColor = 0xff007f; // ネオンピンク
        windowColor = 0x00ffff;
        emissiveColor = 0x00ffcc;
    } else if (isSteampunk) {
        bodyColor = 0xcd7f32; // ブロンズ
        accentColor = 0xd4af37; // ゴールド
        windowColor = 0xffcc00;
        emissiveColor = 0xff8800;
    } else if (isWood) {
        bodyColor = 0x8b5a2b; // ウッドブラウン
        accentColor = 0x228b22; // フォレストグリーン
        windowColor = 0x98ffeb;
        emissiveColor = 0x00fa9a;
    } else if (isPop) {
        bodyColor = 0xffb5c5; // パステルピンク
        accentColor = 0xffd166; // パステルイエロー
        windowColor = 0xffffff;
        emissiveColor = 0xff66cc;
    }

    // 1. 本体 (Body)
    let bodyGeom;
    if (isCyber) {
        bodyGeom = new THREE.CylinderGeometry(0.65, 0.7, 2.4, 8);
    } else if (isSteampunk) {
        bodyGeom = new THREE.CylinderGeometry(0.75, 0.8, 2.2, 16);
    } else if (isWood) {
        bodyGeom = new THREE.CylinderGeometry(0.7, 0.75, 2.0, 10);
    } else if (isPop) {
        bodyGeom = new THREE.CylinderGeometry(0.7, 0.75, 2.1, 14);
    } else {
        bodyGeom = new THREE.CylinderGeometry(0.7, 0.75, 2.2, 12);
    }
    
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: bodyColor, 
        roughness: isCyber ? 0.15 : (isSteampunk ? 0.45 : (isWood ? 0.85 : 0.3)),
        metalness: isSteampunk ? 0.8 : (isCyber ? 0.5 : 0.0)
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // スチームパンクのリベット・歯車の追加
    if (isSteampunk) {
        const ringGeom1 = new THREE.CylinderGeometry(0.82, 0.82, 0.12, 16);
        const ringMat1 = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.9, roughness: 0.3 });
        const ring1 = new THREE.Mesh(ringGeom1, ringMat1);
        ring1.position.y = 1.6;
        group.add(ring1);
        
        const ring2 = new THREE.Mesh(ringGeom1, ringMat1);
        ring2.position.y = 0.6;
        group.add(ring2);
    }
    
    // 2. アクセントリング
    if (!isSteampunk && !isWood) {
        const ringGeom = new THREE.CylinderGeometry(0.71, 0.71, 0.3, 12);
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: accentColor, 
            roughness: 0.3,
            emissive: isCyber ? accentColor : 0x000000,
            emissiveIntensity: isCyber ? 0.8 : 0
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 1.1;
        group.add(ring);
    }

    // 3. 頭頂コーン (Cone)
    let coneGeom;
    if (isCyber) {
        coneGeom = new THREE.ConeGeometry(0.65, 1.2, 8);
    } else if (isSteampunk) {
        coneGeom = new THREE.ConeGeometry(0.75, 0.8, 16);
    } else if (isWood) {
        coneGeom = new THREE.SphereGeometry(0.7, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    } else if (isPop) {
        coneGeom = new THREE.SphereGeometry(0.7, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    } else {
        coneGeom = new THREE.ConeGeometry(0.7, 0.9, 12);
    }
    
    const coneMat = new THREE.MeshStandardMaterial({ 
        color: accentColor, 
        roughness: isWood ? 0.9 : 0.3,
        metalness: isSteampunk ? 0.8 : 0.0,
        emissive: isCyber ? accentColor : 0x000000,
        emissiveIntensity: isCyber ? 0.6 : 0
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    if (isWood || isPop) {
        cone.position.y = 2.1;
        cone.scale.set(1.0, 1.1, 1.0);
    } else {
        cone.position.y = 2.65;
    }
    cone.castShadow = true;
    group.add(cone);
    
    // 木ロケットのてっぺんにお花や葉っぱの飾り
    if (isWood) {
        const leafGeom = new THREE.DodecahedronGeometry(0.22, 0);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x32cd32, roughness: 0.9 });
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        leaf.position.set(0, 2.7, 0);
        group.add(leaf);
    }
    
    // ポップロケットのてっぺんに星の飾り
    if (isPop) {
        const starGeom = new THREE.DodecahedronGeometry(0.2, 0);
        const starMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.2, emissive: 0xffaa00, emissiveIntensity: 0.5 });
        const star = new THREE.Mesh(starGeom, starMat);
        star.position.set(0, 2.8, 0);
        group.add(star);
    }
    
    // 4. 窓 (Window)
    let windowMesh;
    if (isPop) {
        const windowGeom = new THREE.SphereGeometry(0.28, 8, 8);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0xff66cc, roughness: 0.1 });
        windowMesh = new THREE.Mesh(windowGeom, windowMat);
        windowMesh.position.set(0, 1.4, 0.7);
        windowMesh.scale.set(1.0, 1.0, 0.2);
    } else if (isWood) {
        const windowGeom = new THREE.SphereGeometry(0.24, 8, 8);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0xcd853f, roughness: 0.9 });
        windowMesh = new THREE.Mesh(windowGeom, windowMat);
        windowMesh.position.set(0, 1.3, 0.72);
        windowMesh.scale.set(1.0, 1.0, 0.15);
    } else if (isSteampunk) {
        const windowGeom = new THREE.SphereGeometry(0.25, 8, 8);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.9, roughness: 0.2 });
        windowMesh = new THREE.Mesh(windowGeom, windowMat);
        windowMesh.position.set(0, 1.4, 0.76);
        windowMesh.scale.set(1.0, 1.0, 0.2);
    } else {
        const windowGeom = new THREE.SphereGeometry(0.26, 8, 8);
        const windowMat = new THREE.MeshStandardMaterial({
            color: windowColor,
            emissive: emissiveColor,
            emissiveIntensity: isCyber ? 1.5 : 0.9,
            roughness: 0.1
        });
        windowMesh = new THREE.Mesh(windowGeom, windowMat);
        windowMesh.position.set(0, 1.4, 0.7);
        windowMesh.scale.set(1.0, 1.0, 0.2);
    }
    group.add(windowMesh);
    
    // 5. 脚/フィン (Legs/Fins)
    const legMat = new THREE.MeshStandardMaterial({ 
        color: isWood ? 0x228b22 : (isCyber ? 0xff007f : (isSteampunk ? 0xd4af37 : 0xffffff)), 
        roughness: isWood ? 0.9 : 0.4,
        metalness: isSteampunk ? 0.8 : (isCyber ? 0.3 : 0.0)
    });
    
    let legGeom;
    if (isCyber) {
        legGeom = new THREE.BoxGeometry(0.1, 0.9, 0.75);
    } else if (isWood) {
        legGeom = new THREE.BoxGeometry(0.18, 0.7, 0.6);
    } else if (isPop) {
        legGeom = new THREE.BoxGeometry(0.2, 0.75, 0.55);
    } else {
        legGeom = new THREE.BoxGeometry(0.2, 0.8, 0.6);
    }
    legGeom.translate(0, -0.2, -0.3); 
    
    for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.y = 0.4;
        
        const angle = (i / 3) * Math.PI * 2;
        leg.rotation.y = angle;
        
        leg.position.x = Math.sin(angle) * (isSteampunk ? 0.82 : 0.72);
        leg.position.z = Math.cos(angle) * (isSteampunk ? 0.82 : 0.72);
        leg.rotation.z = 0.2; 
        
        leg.castShadow = true;
        group.add(leg);
    }
    
    const nozzleGeom = new THREE.CylinderGeometry(0.3, 0.45, 0.3, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({ 
        color: isCyber ? 0x222222 : (isSteampunk ? 0x8b5a2b : 0x333333), 
        metalness: 0.8 
    });
    const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
    nozzle.position.y = 0.0;
    group.add(nozzle);
    
    // ロケットをもっと巨大にする（2.5倍）
    group.scale.set(2.5, 2.5, 2.5);
    
    return group;
}

// v50: ロケットと一致するスタイルの家を構築
function buildHouse(styleType = 0) {
    const group = new THREE.Group();
    
    let bodyColor = 0xffffff;
    let roofColor = 0xff3344;
    let windowColor = 0x00f0ff;
    let emissiveColor = 0x00bfff;
    let doorColor = 0x8b5a2b;
    let isCyber = (styleType === 1);
    let isSteampunk = (styleType === 2);
    let isWood = (styleType === 3);
    let isPop = (styleType === 4);
    
    if (isCyber) {
        bodyColor = 0x1b1c26;
        roofColor = 0xff007f;
        windowColor = 0x00ffff;
        emissiveColor = 0x00ffcc;
        doorColor = 0x222222;
    } else if (isSteampunk) {
        bodyColor = 0xcd7f32;
        roofColor = 0xd4af37;
        windowColor = 0xffcc00;
        emissiveColor = 0xff8800;
        doorColor = 0x5a3d28;
    } else if (isWood) {
        bodyColor = 0x8b5a2b;
        roofColor = 0x228b22;
        windowColor = 0x98ffeb;
        emissiveColor = 0x00fa9a;
        doorColor = 0x5c4033;
    } else if (isPop) {
        bodyColor = 0xffb5c5;
        roofColor = 0xffd166;
        windowColor = 0xffffff;
        emissiveColor = 0xff66cc;
        doorColor = 0xffa6c9;
    }

    // 1. 壁 (Wall)
    let bodyGeom;
    if (isCyber) {
        bodyGeom = new THREE.BoxGeometry(1.2, 1.4, 1.2);
    } else if (isSteampunk) {
        bodyGeom = new THREE.CylinderGeometry(0.7, 0.7, 1.3, 16);
    } else if (isWood) {
        bodyGeom = new THREE.CylinderGeometry(0.65, 0.7, 1.2, 10);
    } else if (isPop) {
        bodyGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    } else {
        bodyGeom = new THREE.BoxGeometry(1.2, 1.3, 1.2);
    }
    
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: bodyColor, 
        roughness: isCyber ? 0.15 : (isSteampunk ? 0.45 : (isWood ? 0.85 : 0.3)),
        metalness: isSteampunk ? 0.8 : (isCyber ? 0.5 : 0.0)
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = (isSteampunk || isWood) ? 0.6 : 0.65;
    if (isCyber) body.position.y = 0.7;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. 屋根 (Roof)
    let roofGeom;
    if (isCyber) {
        roofGeom = new THREE.ConeGeometry(0.9, 0.8, 4);
        roofGeom.rotateY(Math.PI / 4);
    } else if (isSteampunk) {
        roofGeom = new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    } else if (isWood) {
        roofGeom = new THREE.ConeGeometry(0.85, 0.9, 10);
    } else if (isPop) {
        roofGeom = new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    } else {
        roofGeom = new THREE.ConeGeometry(0.9, 0.8, 4);
        roofGeom.rotateY(Math.PI / 4);
    }
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: roofColor, 
        roughness: isWood ? 0.9 : 0.3,
        metalness: isSteampunk ? 0.8 : 0.0,
        emissive: isCyber ? roofColor : 0x000000,
        emissiveIntensity: isCyber ? 0.6 : 0
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    if (isSteampunk) {
        roof.position.y = 1.25;
        roof.scale.set(1.0, 0.7, 1.0);
    } else if (isWood) {
        roof.position.y = 1.65;
    } else if (isPop) {
        roof.position.y = 1.2;
        roof.scale.set(1.0, 0.75, 1.0);
    } else {
        roof.position.y = 1.7;
    }
    roof.castShadow = true;
    group.add(roof);

    // 3. ドア (Door)
    const doorGeom = new THREE.BoxGeometry(0.35, 0.65, 0.08);
    const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.8 });
    const door = new THREE.Mesh(doorGeom, doorMat);
    
    let offsetZ = 0.61;
    if (isSteampunk || isWood) {
        offsetZ = 0.71;
    }
    door.position.set(0, 0.325, offsetZ);
    door.castShadow = true;
    group.add(door);

    // ドアノブ
    const knobGeom = new THREE.SphereGeometry(0.03, 6, 6);
    const knobMat = new THREE.MeshStandardMaterial({ color: isCyber ? 0x00ffff : 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const knob = new THREE.Mesh(knobGeom, knobMat);
    knob.position.set(0.12, 0.325, offsetZ + 0.04);
    group.add(knob);

    // 4. 窓 (Window)
    const windowGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: windowColor, 
        emissive: emissiveColor, 
        emissiveIntensity: isCyber ? 1.5 : 0.8,
        roughness: 0.1 
    });
    const windowMesh = new THREE.Mesh(windowGeom, windowMat);
    if (isSteampunk || isWood) {
        const angle = Math.PI / 4;
        windowMesh.position.set(Math.sin(angle) * offsetZ, 0.75, Math.cos(angle) * offsetZ);
        windowMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    } else {
        windowMesh.position.set(0.61, 0.75, 0);
        windowMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    }
    windowMesh.scale.set(1.0, 1.0, 0.2);
    group.add(windowMesh);

    // 煙突や装飾
    if (isSteampunk || styleType === 0) {
        const chimGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const chimMat = new THREE.MeshStandardMaterial({ color: isSteampunk ? 0x8b5a2b : 0x555555, metalness: isSteampunk ? 0.8 : 0 });
        const chimney = new THREE.Mesh(chimGeom, chimMat);
        chimney.position.set(0.35, isSteampunk ? 1.4 : 1.7, -0.3);
        group.add(chimney);
    }
    
    if (isSteampunk) {
        const gearGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
        const gearMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 });
        const gear = new THREE.Mesh(gearGeom, gearMat);
        gear.position.set(-0.71, 0.65, 0);
        gear.rotation.z = Math.PI / 2;
        group.add(gear);
    }

    if (isWood) {
        const leafGeom = new THREE.DodecahedronGeometry(0.18, 0);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x32cd32, roughness: 0.9 });
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        leaf.position.set(0, 2.15, 0);
        group.add(leaf);
    }
    
    if (isPop) {
        const starGeom = new THREE.DodecahedronGeometry(0.18, 0);
        const starMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.2, emissive: 0xffaa00, emissiveIntensity: 0.5 });
        const star = new THREE.Mesh(starGeom, starMat);
        star.position.set(0, 1.85, 0);
        group.add(star);
    }

    group.scale.set(2.5, 2.5, 2.5);
    return group;
}

// v50: 家になるための3Dプッシュボタンの構築
function buildTriggerButton() {
    const group = new THREE.Group();
    
    // 台座
    const baseGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.15, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.075;
    group.add(base);
    
    // 赤いボタン
    const buttonGeom = new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.2, emissive: 0x330000 });
    const button = new THREE.Mesh(buttonGeom, buttonMat);
    button.position.y = 0.15;
    button.name = "red_button";
    group.add(button);
    
    group.scale.set(2.5, 2.5, 2.5);
    return group;
}

// 住人の個別3Dメッシュ組み立て
function createVillagerMesh(typeData) {
    const group = new THREE.Group();
    const visualGroup = new THREE.Group();
    group.add(visualGroup);

    const skinColor = typeData.skinColor || 0xffffff;
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.4 });

    // 1. 体 (宇宙服)
    const bodyGeom = new THREE.SphereGeometry(0.38, 12, 12);
    bodyGeom.scale(1.0, 1.2, 1.0);
    // マテリアルに微細なラフネスとメタルネスを設定して少し高級なプラスチックおもちゃ感に
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: typeData.suitColor, 
        roughness: 0.4,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    visualGroup.add(body);

    // 2. 胸元の飾り (白いお腹の当て布 + 黄色い星/ボタン)
    // お腹の白い部分
    const bellyGeom = new THREE.SphereGeometry(0.24, 10, 10);
    bellyGeom.scale(1.0, 1.1, 0.4);
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const belly = new THREE.Mesh(bellyGeom, bellyMat);
    belly.position.set(0, 0.42, 0.22);
    visualGroup.add(belly);

    // 胸のボタン
    const buttonGeom = new THREE.SphereGeometry(0.04, 8, 8);
    buttonGeom.scale(1.0, 1.0, 0.4);
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.2 });
    
    const btn1 = new THREE.Mesh(buttonGeom, buttonMat);
    btn1.position.set(0, 0.48, 0.29);
    visualGroup.add(btn1);

    const btn2 = new THREE.Mesh(buttonGeom, buttonMat);
    btn2.position.set(0, 0.36, 0.29);
    visualGroup.add(btn2);

    // 3. 襟 (Collar) - 宇宙服の首周りのリング
    const collarGeom = new THREE.TorusGeometry(0.26, 0.045, 8, 20);
    collarGeom.scale(1.0, 1.0, 0.5);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const collar = new THREE.Mesh(collarGeom, collarMat);
    collar.position.set(0, 0.68, 0.02);
    collar.rotation.x = Math.PI / 2;
    visualGroup.add(collar);

    // 4. バックパック
    const packGeom = new THREE.BoxGeometry(0.32, 0.45, 0.22);
    const packMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 });
    const pack = new THREE.Mesh(packGeom, packMat);
    pack.position.set(0, 0.45, -0.3);
    pack.castShadow = true;
    visualGroup.add(pack);

    // バックパックの小さなアンテナ
    const pAntennaGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4);
    const pAntennaMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const pAntenna = new THREE.Mesh(pAntennaGeom, pAntennaMat);
    pAntenna.position.set(0.1, 0.7, -0.3);
    pAntenna.rotation.z = -0.1;
    visualGroup.add(pAntenna);

    const pAntennaTipGeom = new THREE.SphereGeometry(0.025, 6, 6);
    const pAntennaTipMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const pAntennaTip = new THREE.Mesh(pAntennaTipGeom, pAntennaTipMat);
    pAntennaTip.position.set(0.11, 0.78, -0.3);
    visualGroup.add(pAntennaTip);

    // 5. 頭部
    const headGeom = new THREE.SphereGeometry(0.32, 16, 16);
    const headMat = skinMat;
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(0, 0.8, 0);
    head.castShadow = true;
    visualGroup.add(head);

    // 個性ごとの耳パーツ
    if (typeData.earType === "cat") {
        const earGeom = new THREE.ConeGeometry(0.08, 0.18, 4);
        earGeom.rotateX(0.15);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.18, 1.05, 0);
        leftEar.rotation.z = 0.25;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.18, 1.05, 0);
        rightEar.rotation.z = -0.25;
        visualGroup.add(rightEar);

        const innerEarGeom = new THREE.ConeGeometry(0.05, 0.13, 4);
        const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xff9fb2 });
        
        const leftInnerEar = new THREE.Mesh(innerEarGeom, innerEarMat);
        leftInnerEar.position.set(-0.17, 1.04, 0.02);
        leftInnerEar.rotation.z = 0.25;
        visualGroup.add(leftInnerEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeom, innerEarMat);
        rightInnerEar.position.set(0.17, 1.04, 0.02);
        rightInnerEar.rotation.z = -0.25;
        visualGroup.add(rightInnerEar);
        
    } else if (typeData.earType === "rabbit") {
        const earGeom = new THREE.SphereGeometry(0.07, 8, 8);
        earGeom.scale(1.0, 3.2, 0.7); 
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.13, 1.15, 0);
        leftEar.rotation.z = 0.1;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.13, 1.15, 0);
        rightEar.rotation.z = -0.1;
        visualGroup.add(rightEar);

        const innerEarGeom = new THREE.SphereGeometry(0.045, 8, 8);
        innerEarGeom.scale(1.0, 2.5, 0.5);
        const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xff9fb2 });

        const leftInner = new THREE.Mesh(innerEarGeom, innerEarMat);
        leftInner.position.set(-0.13, 1.14, 0.035);
        leftInner.rotation.z = 0.1;
        visualGroup.add(leftInner);

        const rightInner = new THREE.Mesh(innerEarGeom, innerEarMat);
        rightInner.position.set(0.13, 1.14, 0.035);
        rightInner.rotation.z = -0.1;
        visualGroup.add(rightInner);

    } else if (typeData.earType === "dog") {
        const earGeom = new THREE.SphereGeometry(0.08, 8, 8);
        earGeom.scale(1.0, 2.0, 1.1); 
        const earMat = skinMat; 
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.28, 0.85, 0);
        leftEar.rotation.z = 0.45; 
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.28, 0.85, 0);
        rightEar.rotation.z = -0.45;
        visualGroup.add(rightEar);
        
    } else if (typeData.earType === "bear") {
        const earGeom = new THREE.SphereGeometry(0.1, 8, 8);
        earGeom.scale(1.1, 1.1, 0.7);
        const earMat = skinMat;

        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.2, 1.02, 0);
        leftEar.rotation.z = 0.35;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.2, 1.02, 0);
        rightEar.rotation.z = -0.35;
        visualGroup.add(rightEar);

        const innerGeom = new THREE.SphereGeometry(0.06, 6, 6);
        innerGeom.scale(1.0, 1.0, 0.6);
        const innerMat = new THREE.MeshStandardMaterial({ color: 0xffdf8c });
        
        const leftInner = new THREE.Mesh(innerGeom, innerMat);
        leftInner.position.set(-0.19, 1.01, 0.035);
        leftInner.rotation.z = 0.35;
        visualGroup.add(leftInner);

        const rightInner = new THREE.Mesh(innerGeom, innerMat);
        rightInner.position.set(0.19, 1.01, 0.035);
        rightInner.rotation.z = -0.35;
        visualGroup.add(rightInner);
    } else if (typeData.earType === "bee") {
        const antennaGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4);
        const tipGeom = new THREE.SphereGeometry(0.04, 6, 6);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const tipMat = new THREE.MeshStandardMaterial({ color: 0xffe066 });

        const leftAntenna = new THREE.Mesh(antennaGeom, antennaMat);
        leftAntenna.position.set(-0.1, 1.15, 0.1);
        leftAntenna.rotation.z = 0.3;
        leftAntenna.rotation.x = 0.2;
        visualGroup.add(leftAntenna);
        
        const leftTip = new THREE.Mesh(tipGeom, tipMat);
        leftTip.position.set(-0.16, 1.25, 0.12);
        visualGroup.add(leftTip);

        const rightAntenna = new THREE.Mesh(antennaGeom, antennaMat);
        rightAntenna.position.set(0.1, 1.15, 0.1);
        rightAntenna.rotation.z = -0.3;
        rightAntenna.rotation.x = 0.2;
        visualGroup.add(rightAntenna);
        
        const rightTip = new THREE.Mesh(tipGeom, tipMat);
        rightTip.position.set(0.16, 1.25, 0.12);
        visualGroup.add(rightTip);

        const wingGeom = new THREE.SphereGeometry(0.12, 8, 8);
        wingGeom.scale(2.2, 0.3, 1.0);
        const wingMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.65,
            roughness: 0.1,
            transmission: 0.8
        });

        const leftWing = new THREE.Mesh(wingGeom, wingMat);
        leftWing.position.set(-0.25, 0.6, -0.35);
        leftWing.rotation.set(0.2, 0.4, 0.5);
        visualGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeom, wingMat);
        rightWing.position.set(0.25, 0.6, -0.35);
        rightWing.rotation.set(0.2, -0.4, -0.5);
        visualGroup.add(rightWing);

        const stripeGeom = new THREE.CylinderGeometry(0.39, 0.39, 0.08, 12, 1, true);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        
        const stripe1 = new THREE.Mesh(stripeGeom, stripeMat);
        stripe1.position.set(0, 0.42, 0);
        stripe1.rotation.x = Math.PI / 2;
        visualGroup.add(stripe1);
        
        const stripe2 = new THREE.Mesh(stripeGeom, stripeMat);
        stripe2.position.set(0, 0.55, 0);
        stripe2.rotation.x = Math.PI / 2;
        visualGroup.add(stripe2);

    } else if (typeData.earType === "koala") {
        const earGeom = new THREE.SphereGeometry(0.14, 8, 8);
        earGeom.scale(1.2, 1.2, 0.5);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.3, 0.85, 0);
        leftEar.rotation.y = 0.2;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.3, 0.85, 0);
        rightEar.rotation.y = -0.2;
        visualGroup.add(rightEar);

        const innerGeom = new THREE.SphereGeometry(0.09, 8, 8);
        innerGeom.scale(1.2, 1.2, 0.4);
        const innerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        const leftInner = new THREE.Mesh(innerGeom, innerMat);
        leftInner.position.set(-0.29, 0.85, 0.04);
        leftInner.rotation.y = 0.2;
        visualGroup.add(leftInner);

        const rightInner = new THREE.Mesh(innerGeom, innerMat);
        rightInner.position.set(0.29, 0.85, 0.04);
        rightInner.rotation.y = -0.2;
        visualGroup.add(rightInner);

        const koalaNoseGeom = new THREE.SphereGeometry(0.06, 8, 8);
        koalaNoseGeom.scale(0.8, 1.6, 1.0);
        const koalaNoseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        const koalaNose = new THREE.Mesh(koalaNoseGeom, koalaNoseMat);
        koalaNose.position.set(0, 0.78, 0.31);
        visualGroup.add(koalaNose);
    } else if (typeData.earType === "fox") {
        const earGeom = new THREE.ConeGeometry(0.1, 0.22, 4);
        earGeom.rotateX(0.15);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.19, 1.06, 0);
        leftEar.rotation.z = 0.28;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.19, 1.06, 0);
        rightEar.rotation.z = -0.28;
        visualGroup.add(rightEar);

        const innerEarGeom = new THREE.ConeGeometry(0.06, 0.16, 4);
        const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xffe2e8 });
        
        const leftInnerEar = new THREE.Mesh(innerEarGeom, innerEarMat);
        leftInnerEar.position.set(-0.18, 1.05, 0.02);
        leftInnerEar.rotation.z = 0.28;
        visualGroup.add(leftInnerEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeom, innerEarMat);
        rightInnerEar.position.set(0.18, 1.05, 0.02);
        rightInnerEar.rotation.z = -0.28;
        visualGroup.add(rightInnerEar);

    } else if (typeData.earType === "mouse") {
        const earGeom = new THREE.SphereGeometry(0.13, 8, 8);
        earGeom.scale(1.0, 1.0, 0.15);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.25, 0.98, 0);
        leftEar.rotation.y = 0.25;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.25, 0.98, 0);
        rightEar.rotation.y = -0.25;
        visualGroup.add(rightEar);

        const innerGeom = new THREE.SphereGeometry(0.09, 8, 8);
        innerGeom.scale(1.0, 1.0, 0.1);
        const innerMat = new THREE.MeshStandardMaterial({ color: 0xffccd5 });
        
        const leftInner = new THREE.Mesh(innerGeom, innerMat);
        leftInner.position.set(-0.24, 0.98, 0.02);
        leftInner.rotation.y = 0.25;
        visualGroup.add(leftInner);

        const rightInner = new THREE.Mesh(innerGeom, innerMat);
        rightInner.position.set(0.24, 0.98, 0.02);
        rightInner.rotation.y = -0.25;
        visualGroup.add(rightInner);

    } else if (typeData.earType === "pig") {
        const earGeom = new THREE.SphereGeometry(0.08, 8, 8);
        earGeom.scale(0.8, 1.4, 0.6);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.24, 0.88, 0);
        leftEar.rotation.z = 0.6;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.24, 0.88, 0);
        rightEar.rotation.z = -0.6;
        visualGroup.add(rightEar);

        const pigNoseGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
        const pigNoseMat = new THREE.MeshStandardMaterial({ color: 0xff85a1, roughness: 0.8 });
        const pigNose = new THREE.Mesh(pigNoseGeom, pigNoseMat);
        pigNose.position.set(0, 0.76, 0.31);
        pigNose.rotation.x = Math.PI / 2;
        visualGroup.add(pigNose);

    } else if (typeData.earType === "frog") {
        const frogEyeGeom = new THREE.SphereGeometry(0.1, 10, 10);
        const frogEyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        const leftFrogEye = new THREE.Mesh(frogEyeGeom, frogEyeMat);
        leftFrogEye.position.set(-0.16, 1.05, 0.06);
        visualGroup.add(leftFrogEye);

        const rightFrogEye = new THREE.Mesh(frogEyeGeom, frogEyeMat);
        rightFrogEye.position.set(0.16, 1.05, 0.06);
        visualGroup.add(rightFrogEye);

        const frogPupilGeom = new THREE.SphereGeometry(0.045, 6, 6);
        const frogPupilMat = new THREE.MeshBasicMaterial({ color: 0x1b1c26 });
        
        const leftPupil = new THREE.Mesh(frogPupilGeom, frogPupilMat);
        leftPupil.position.set(-0.15, 1.05, 0.14);
        visualGroup.add(leftPupil);

        const rightPupil = new THREE.Mesh(frogPupilGeom, frogPupilMat);
        rightPupil.position.set(0.15, 1.05, 0.14);
        visualGroup.add(rightPupil);

        // カエルの目のハイライト
        const frogPupilHlGeom = new THREE.SphereGeometry(0.015, 6, 6);
        const frogPupilHlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftPupilHl = new THREE.Mesh(frogPupilHlGeom, frogPupilHlMat);
        leftPupilHl.position.set(-0.13, 1.07, 0.17);
        visualGroup.add(leftPupilHl);

        const rightPupilHl = new THREE.Mesh(frogPupilHlGeom, frogPupilHlMat);
        rightPupilHl.position.set(0.17, 1.07, 0.17);
        visualGroup.add(rightPupilHl);

    } else if (typeData.earType === "alien") {
        const antennaGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4);
        const tipGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); 

        const ant = new THREE.Mesh(antennaGeom, antennaMat);
        ant.position.set(0, 1.25, 0);
        visualGroup.add(ant);
        
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.position.set(0, 1.45, 0);
        visualGroup.add(tip);

    } else if (typeData.earType === "panda") {
        const earGeom = new THREE.SphereGeometry(0.09, 8, 8);
        earGeom.scale(1.1, 1.1, 0.6);
        const earMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.2, 1.02, 0);
        leftEar.rotation.z = 0.35;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.2, 1.02, 0);
        rightEar.rotation.z = -0.35;
        visualGroup.add(rightEar);

        const patchGeom = new THREE.SphereGeometry(0.08, 8, 8);
        patchGeom.scale(1.0, 1.3, 0.2);
        const patchMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        
        const leftPatch = new THREE.Mesh(patchGeom, patchMat);
        leftPatch.position.set(-0.11, 0.81, 0.23);
        leftPatch.rotation.z = -0.15;
        visualGroup.add(leftPatch);

        const rightPatch = new THREE.Mesh(patchGeom, patchMat);
        rightPatch.position.set(0.11, 0.81, 0.23);
        rightPatch.rotation.z = 0.15;
        visualGroup.add(rightPatch);

    } else if (typeData.earType === "monkey") {
        const earGeom = new THREE.SphereGeometry(0.09, 8, 8);
        earGeom.scale(1.0, 1.0, 0.5);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.28, 0.82, 0);
        leftEar.rotation.y = 0.4;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.28, 0.82, 0);
        rightEar.rotation.y = -0.4;
        visualGroup.add(rightEar);

    } else if (typeData.earType === "sheep") {
        const hornGeom = new THREE.TorusGeometry(0.09, 0.035, 6, 12, Math.PI * 1.6);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffebcd, roughness: 0.6 });
        
        const leftHorn = new THREE.Mesh(hornGeom, hornMat);
        leftHorn.position.set(-0.28, 0.9, 0.05);
        leftHorn.rotation.set(0.2, 0.4, 0.6);
        visualGroup.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeom, hornMat);
        rightHorn.position.set(0.28, 0.9, 0.05);
        rightHorn.rotation.set(0.2, -0.4, -0.6);
        visualGroup.add(rightHorn);

    } else if (typeData.earType === "squirrel") {
        const earGeom = new THREE.ConeGeometry(0.08, 0.2, 4);
        const earMat = skinMat;
        
        const leftEar = new THREE.Mesh(earGeom, earMat);
        leftEar.position.set(-0.16, 1.05, 0);
        leftEar.rotation.z = 0.18;
        visualGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeom, earMat);
        rightEar.position.set(0.16, 1.05, 0);
        rightEar.rotation.z = -0.18;
        visualGroup.add(rightEar);

        const tailGeom = new THREE.SphereGeometry(0.18, 8, 8);
        tailGeom.scale(1.0, 2.2, 1.0);
        const tailMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.9 });
        const tail = new THREE.Mesh(tailGeom, tailMat);
        tail.position.set(0, 0.55, -0.45);
        tail.rotation.x = -0.4;
        visualGroup.add(tail);
    }

    // 6. 目 (ハイライト付き) とほっぺ
    if (typeData.earType !== "frog") {
        const eyeGeom = new THREE.SphereGeometry(0.035, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1c26 });
        
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.11, 0.82, 0.26);
        visualGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.11, 0.82, 0.26);
        visualGroup.add(rightEye);

        // 目のうるうるハイライト
        const hlGeom = new THREE.SphereGeometry(0.012, 6, 6);
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const leftHl = new THREE.Mesh(hlGeom, hlMat);
        leftHl.position.set(-0.095, 0.835, 0.285);
        visualGroup.add(leftHl);

        const rightHl = new THREE.Mesh(hlGeom, hlMat);
        rightHl.position.set(0.125, 0.835, 0.285);
        visualGroup.add(rightHl);

        // ほんのりほっぺ (チーク)
        const cheekGeom = new THREE.SphereGeometry(0.045, 8, 8);
        cheekGeom.scale(1.2, 0.6, 0.3);
        const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9fb2, transparent: true, opacity: 0.75 });
        
        const leftCheek = new THREE.Mesh(cheekGeom, cheekMat);
        leftCheek.position.set(-0.18, 0.75, 0.24);
        leftCheek.rotation.y = 0.2;
        visualGroup.add(leftCheek);
        
        const rightCheek = new THREE.Mesh(cheekGeom, cheekMat);
        rightCheek.position.set(0.18, 0.75, 0.24);
        rightCheek.rotation.y = -0.2;
        visualGroup.add(rightCheek);
    }

    // 7. 鼻
    const noseGeom = new THREE.SphereGeometry(0.02, 6, 6);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xff85a1 });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.set(0, 0.77, 0.29);
    visualGroup.add(nose);

    // 8. 宇宙ヘルメット
    const helmetGeom = new THREE.SphereGeometry(0.44, 16, 16);
    if (typeData.earType === "rabbit") {
        helmetGeom.scale(1.15, 1.5, 1.15);
    }
    // clearcoatを追加して、よりガラスの反射・リッチ感のあるマテリアルに変更
    const helmetMat = new THREE.MeshPhysicalMaterial({
        color: 0x88e3ff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.05,
        transmission: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        ior: 1.15
    });
    const helmet = new THREE.Mesh(helmetGeom, helmetMat);
    helmet.position.set(0, 0.82, 0);
    if (typeData.earType === "rabbit") {
        helmet.position.y = 0.95;
    }
    visualGroup.add(helmet);

    // ヘルメット側面のインカム（アンテナ）
    const hAntennaGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6);
    const hAntennaTipGeom = new THREE.SphereGeometry(0.025, 6, 6);
    const hAntennaMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 });
    const hAntennaTipMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc }); 

    const hAntenna = new THREE.Mesh(hAntennaGeom, hAntennaMat);
    hAntenna.position.set(0.43, 0.85, 0.05);
    hAntenna.rotation.z = -0.4;
    hAntenna.rotation.y = 0.2;
    visualGroup.add(hAntenna);

    const hAntennaTip = new THREE.Mesh(hAntennaTipGeom, hAntennaTipMat);
    hAntennaTip.position.set(0.49, 0.92, 0.07);
    visualGroup.add(hAntennaTip);

    // 9. 手と脚・靴
    const limbGeom = new THREE.SphereGeometry(0.09, 8, 8);
    const limbMat = skinMat;
    
    const leftHand = new THREE.Mesh(limbGeom, limbMat);
    leftHand.position.set(-0.4, 0.45, 0.1);
    leftHand.name = "leftHand";
    visualGroup.add(leftHand);

    const rightHand = new THREE.Mesh(limbGeom, limbMat);
    rightHand.position.set(0.4, 0.45, 0.1);
    rightHand.name = "rightHand";
    visualGroup.add(rightHand);

    // 脚
    const legGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
    const legMat = skinMat;
    
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.16, 0.08, 0);
    leftLeg.name = "leftLeg";
    visualGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.position.set(0.16, 0.08, 0);
    rightLeg.name = "rightLeg";
    visualGroup.add(rightLeg);

    // 丸みのある可愛いブーツを足元に追加
    const bootGeom = new THREE.SphereGeometry(0.095, 8, 8);
    bootGeom.scale(1.0, 0.6, 1.3);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x3a3b4c, roughness: 0.6 });
    
    const leftBoot = new THREE.Mesh(bootGeom, bootMat);
    leftBoot.position.set(-0.16, 0.01, 0.04);
    visualGroup.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeom, bootMat);
    rightBoot.position.set(0.16, 0.01, 0.04);
    visualGroup.add(rightBoot);

    // 📡 頭上ガイドビーコン
    const beaconGeom = new THREE.CylinderGeometry(0.05, 0.6, 25, 8, 1, true);
    beaconGeom.translate(0, 12.5, 0); 
    const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x06d6a0,
        transparent: true,
        opacity: isGuideActive ? 0.35 : 0,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(0, 1.0, 0);
    beacon.name = "beacon";
    beacon.visible = isGuideActive;
    group.add(beacon);

    // 11. 固有アクセサリー (バッジ・アタッチメント) の追加
    if (typeData.id === "cat") {
        const collarRingGeom = new THREE.TorusGeometry(0.27, 0.02, 6, 16);
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
        const collarRing = new THREE.Mesh(collarRingGeom, goldMat);
        collarRing.position.set(0, 0.68, 0.02);
        collarRing.rotation.x = Math.PI / 2;
        visualGroup.add(collarRing);

        const bellGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const bell = new THREE.Mesh(bellGeom, goldMat);
        bell.position.set(0, 0.61, 0.23);
        visualGroup.add(bell);
    } else if (typeData.id === "rabbit") {
        const carrotGeom = new THREE.ConeGeometry(0.04, 0.12, 6);
        carrotGeom.rotateX(-Math.PI / 2);
        const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff7f00, roughness: 0.5 });
        const carrot = new THREE.Mesh(carrotGeom, carrotMat);
        carrot.position.set(0.12, 0.55, 0.25);
        visualGroup.add(carrot);
        
        const leafGeom = new THREE.BoxGeometry(0.015, 0.04, 0.015);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        leaf.position.set(0.12, 0.55, 0.32);
        leaf.rotation.x = 0.3;
        visualGroup.add(leaf);
    } else if (typeData.id === "dog") {
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const boneCenterGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6);
        boneCenterGeom.rotateZ(Math.PI / 4);
        const boneCenter = new THREE.Mesh(boneCenterGeom, boneMat);
        boneCenter.position.set(0.12, 0.55, 0.25);
        visualGroup.add(boneCenter);
        
        const jointGeom = new THREE.SphereGeometry(0.016, 6, 6);
        const j1 = new THREE.Mesh(jointGeom, boneMat); j1.position.set(0.08, 0.51, 0.25); visualGroup.add(j1);
        const j2 = new THREE.Mesh(jointGeom, boneMat); j2.position.set(0.09, 0.52, 0.25); visualGroup.add(j2);
        const j3 = new THREE.Mesh(jointGeom, boneMat); j3.position.set(0.15, 0.58, 0.25); visualGroup.add(j3);
        const j4 = new THREE.Mesh(jointGeom, boneMat); j4.position.set(0.16, 0.59, 0.25); visualGroup.add(j4);
    } else if (typeData.id === "bear") {
        const nutGeom = new THREE.SphereGeometry(0.045, 8, 8);
        nutGeom.scale(1.0, 1.3, 1.0);
        const nutMat = new THREE.MeshStandardMaterial({ color: 0xcd853f, roughness: 0.6 });
        const nut = new THREE.Mesh(nutGeom, nutMat);
        nut.position.set(0.12, 0.55, 0.25);
        visualGroup.add(nut);
        
        const capGeom = new THREE.SphereGeometry(0.048, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
        const cap = new THREE.Mesh(capGeom, capMat);
        cap.position.set(0.12, 0.58, 0.25);
        visualGroup.add(cap);
    } else if (typeData.id === "koala") {
        const leafGeom = new THREE.SphereGeometry(0.045, 8, 8);
        leafGeom.scale(1.0, 0.2, 1.6);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3cb371, roughness: 0.6 });
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        leaf.position.set(0.12, 0.55, 0.25);
        leaf.rotation.set(0.3, 0.4, 0.5);
        visualGroup.add(leaf);
    } else if (typeData.id === "fox") {
        const scarfGeom = new THREE.TorusGeometry(0.27, 0.035, 6, 16);
        const scarfMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.7 });
        const scarf = new THREE.Mesh(scarfGeom, scarfMat);
        scarf.position.set(0, 0.67, 0.02);
        scarf.rotation.x = Math.PI / 2.1;
        visualGroup.add(scarf);
        
        const tailScarfGeom = new THREE.CylinderGeometry(0.03, 0.01, 0.18, 6);
        const tailScarf = new THREE.Mesh(tailScarfGeom, scarfMat);
        tailScarf.position.set(0.12, 0.55, 0.23);
        tailScarf.rotation.z = -0.4;
        visualGroup.add(tailScarf);
    } else if (typeData.id === "mouse") {
        const cheeseGeom = new THREE.ConeGeometry(0.05, 0.04, 3);
        cheeseGeom.rotateX(Math.PI / 2);
        const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4 });
        const cheese = new THREE.Mesh(cheeseGeom, cheeseMat);
        cheese.position.set(0.12, 0.55, 0.25);
        cheese.rotation.y = 0.5;
        visualGroup.add(cheese);
    } else if (typeData.id === "pig") {
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.5 });
        const leafGeom = new THREE.SphereGeometry(0.025, 6, 6);
        leafGeom.scale(1.0, 0.3, 1.0);
        for(let i=0; i<3; i++) {
            const leaf = new THREE.Mesh(leafGeom, greenMat);
            const angle = (i / 3) * Math.PI * 2;
            leaf.position.set(0.12 + Math.cos(angle)*0.025, 0.55 + Math.sin(angle)*0.025, 0.25);
            visualGroup.add(leaf);
        }
    } else if (typeData.id === "frog") {
        const padGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.008, 12);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.6 });
        const pad = new THREE.Mesh(padGeom, padMat);
        pad.position.set(0.12, 0.55, 0.25);
        pad.rotation.x = Math.PI / 2.2;
        visualGroup.add(pad);
    } else if (typeData.id === "alien") {
        const holoGeom = new THREE.TorusGeometry(0.5, 0.015, 4, 16);
        const holoMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
        const holo = new THREE.Mesh(holoGeom, holoMat);
        holo.position.set(0, 0.82, 0);
        holo.rotation.x = Math.PI / 2;
        visualGroup.add(holo);
    } else if (typeData.id === "panda") {
        const stemGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4);
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.6 });
        const stem = new THREE.Mesh(stemGeom, greenMat);
        stem.position.set(0.12, 0.55, 0.25);
        stem.rotation.z = -0.4;
        visualGroup.add(stem);
        
        const leafGeom = new THREE.SphereGeometry(0.015, 6, 6);
        leafGeom.scale(2.2, 0.3, 1.0);
        const leaf = new THREE.Mesh(leafGeom, greenMat);
        leaf.position.set(0.14, 0.58, 0.26);
        leaf.rotation.z = 0.5;
        visualGroup.add(leaf);
    } else if (typeData.id === "monkey") {
        const bananaGeom = new THREE.TorusGeometry(0.045, 0.012, 4, 8, Math.PI);
        const bananaMat = new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.5 });
        const banana = new THREE.Mesh(bananaGeom, bananaMat);
        banana.position.set(0.12, 0.55, 0.25);
        banana.rotation.z = 0.5;
        visualGroup.add(banana);
    } else if (typeData.id === "sheep") {
        const woolGeom = new THREE.SphereGeometry(0.07, 6, 6);
        const woolMat = new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.95 });
        const woolPositions = [
            [-0.24, 0.5, 0.2], [0.24, 0.5, 0.2],
            [-0.24, 0.3, 0.2], [0.24, 0.3, 0.2],
            [-0.2, 0.55, -0.2], [0.2, 0.55, -0.2],
            [0, 0.22, 0.28], [0, 0.6, -0.28]
        ];
        woolPositions.forEach(pos => {
            const wool = new THREE.Mesh(woolGeom, woolMat);
            wool.position.set(pos[0], pos[1], pos[2]);
            visualGroup.add(wool);
        });
    } else if (typeData.id === "squirrel") {
        const nutGeom = new THREE.SphereGeometry(0.04, 8, 8);
        nutGeom.scale(1.0, 1.3, 1.0);
        const nutMat = new THREE.MeshStandardMaterial({ color: 0xcd853f, roughness: 0.6 });
        const nut = new THREE.Mesh(nutGeom, nutMat);
        nut.position.set(0.12, 0.55, 0.25);
        visualGroup.add(nut);
        
        const capGeom = new THREE.SphereGeometry(0.043, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
        const cap = new THREE.Mesh(capGeom, capMat);
        cap.position.set(0.12, 0.58, 0.25);
        visualGroup.add(cap);
    }

    // スケールの適用
    const scaleVal = typeData.scale || 1.0;
    visualGroup.scale.set(scaleVal, scaleVal, scaleVal);

    return { group, visualGroup, beacon };
};
}

// 住人の新規作成・小惑星への出現処理
function spawnVillager(typeData, milestone, isRevisitor = false) {
    const { group, visualGroup, beacon } = createVillagerMesh(typeData);

    // 一度出現した住人のIDとマイルストーン条件を記録
    if (!currentPlanet.unlockedVillagerIds) {
        currentPlanet.unlockedVillagerIds = [];
    }
    if (!currentPlanet.unlockedVillagerIds.includes(typeData.id)) {
        currentPlanet.unlockedVillagerIds.push(typeData.id);
    }
    if (!currentPlanet.unlockedVillagersInfo) {
        currentPlanet.unlockedVillagersInfo = {};
    }
    if (milestone) {
        currentPlanet.unlockedVillagersInfo[typeData.id] = {
            settleReqFlower: milestone.settleReqFlower,
            settleReqTree: milestone.settleReqTree,
            milestoneId: milestone.id
        };
    } else if (!currentPlanet.unlockedVillagersInfo[typeData.id]) {
        // フォールバック用の適度な条件
        currentPlanet.unlockedVillagersInfo[typeData.id] = {
            settleReqFlower: 8,
            settleReqTree: 4,
            milestoneId: -1
        };
    }

    const info = currentPlanet.unlockedVillagersInfo[typeData.id];

    // プレイヤーの位置を取得し、地表上のベース位置を算出
    const pPos = new THREE.Vector3();
    player.getWorldPosition(pPos);
    const pBase = pPos.clone().normalize().multiplyScalar(ASTEROID_RADIUS);

    const pNormal = pBase.clone().normalize();
    let tangent = new THREE.Vector3(1, 0, 0).projectOnPlane(pNormal).normalize();
    if (tangent.lengthSq() < 0.01) {
        tangent = new THREE.Vector3(0, 0, 1).projectOnPlane(pNormal).normalize();
    }
    const bitangent = new THREE.Vector3().crossVectors(pNormal, tangent).normalize();

    const rocketRadius = 0.82 * 2.5; // ロケットの半径 (巨大化スケール2.5倍)
    const minDistance = 2 * rocketRadius; // ロケット2台分の半径 (約4.1)

    let localPos = null;
    
    // 他のロケットと重ならない位置を探索
    for (let attempt = 0; attempt < 100; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        // プレイヤーの近く（5.0 〜 10.0 ユニット離れた位置）
        const dist = 5.0 + Math.random() * 5.0; 
        const candPos = pBase.clone()
            .addScaledVector(tangent, Math.cos(angle) * dist)
            .addScaledVector(bitangent, Math.sin(angle) * dist)
            .normalize().multiplyScalar(ASTEROID_RADIUS);
            
        let tooClose = false;
        for (const v of currentPlanet.activeVillagers) {
            if (v.rocketInstance) {
                const rPos = v.rocketInstance.baseLocalPos;
                if (candPos.distanceTo(rPos) < minDistance) {
                    tooClose = true;
                    break;
                }
            }
        }
        
        if (!tooClose && currentPlanet.plants) {
            for (const p of currentPlanet.plants) {
                if (p.localPos && candPos.distanceTo(p.localPos) < 4.0) {
                    tooClose = true;
                    break;
                }
            }
        }
        
        if (!tooClose) {
            localPos = candPos;
            break;
        }
    }
    
    // 見つからなかった場合のフォールバック（少し離れた位置にする）
    if (!localPos) {
        const angle = Math.random() * Math.PI * 2;
        localPos = pBase.clone()
            .addScaledVector(tangent, Math.cos(angle) * 12.0)
            .addScaledVector(bitangent, Math.sin(angle) * 12.0)
            .normalize().multiplyScalar(ASTEROID_RADIUS);
    }

    group.position.copy(localPos);

    const normal = localPos.clone().normalize();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

    // 最初は非表示にし、ロケットで降下させる
    group.visible = false;
    beacon.visible = false;
    asteroid.add(group);

    // ロケットスタイルの決定 (0〜4)
    const rocketStyle = Math.floor(Math.random() * 5);
    const rocketMesh = buildRocket(rocketStyle);
    
    // 上空に配置
    rocketMesh.position.copy(localPos).addScaledVector(normal, 25.0);
    rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    asteroid.add(rocketMesh);
    
    // ロケット降下音を再生
    playRocketEngineSound(2.0);

    const instance = {
        id: typeData.id,
        name: typeData.name,
        typeData: typeData,
        group: group,
        visualGroup: visualGroup,
        beacon: beacon,
        localPos: localPos,
        state: "ARRIVING", // ARRIVING 状態からスタート
        settled: false, 
        leavingTimer: 0, 
        stateTimer: 0.0, 
        targetPos: new THREE.Vector3(),
        targetPlant: null,
        walkCycle: 0,
        bounce: 0.45, 
        happyJumpCount: 0, 
        happyJumpTimer: 0,
        age: Math.random() * 100,
        rocketStyle: rocketStyle,
        rocketInstance: {
            mesh: rocketMesh,
            baseLocalPos: localPos.clone(),
            normal: normal.clone(),
            height: 25.0,
            targetHeight: 0.0,
            phase: "DESCENDING", // DESCENDING, WAITING, ASCENDING
            timer: 0.0,
            style: rocketStyle
        },
        hungerTimer: 20.0 + Math.random() * 20.0, // 空腹タイマー (秒)
        // 未定住の場合、一定時間後に自動的に旅立つタイマー (180〜360秒)
        stayTimer: 180.0 + Math.random() * 180.0,
        warningShown: false, // 1分前警告を表示済みかどうか
        milestoneId: info.milestoneId, // やってきた条件のマイルストーンID
        settleReqFlower: info.settleReqFlower, // 定住申し込みに必要な花の数
        settleReqTree:   info.settleReqTree,   // 定住申し込みに必要な木の数
        isRevisitor: isRevisitor, // 再来した住人かどうか
        hasSpokenThisVisit: false // この来訪で話しかけられたかどうか
    };

    currentPlanet.activeVillagers.push(instance);
    updateVillagerCountUI();
}

// カメラ初期アングル (正面固定ベース)
camera.position.set(0, ASTEROID_RADIUS + 4.5, 8.5);
camera.lookAt(0, ASTEROID_RADIUS + 0.5, 0);

// キーボード入力の状態管理
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    r: false,
    t: false,
    e: false,
    f: false // プレゼント用キー
};

// UI要素・会話モーダル制御変数
let isDialogOpen = false;
let dialogueTextIndex = 0;
let dialogueTimeout = null;
let currentDialogueText = "";
let currentSpeaker = "";
let currentSpeakerInstance = null;
let isNegotiationActive = false; 
let isWarpMenuOpen = false;
let isWarping = false;
let isIntroDialogShowing = false; // 導入ダイアログ表示中フラグ
let isIntroFinished = false; // 導入ダイアログ完了フラグ
let isIntroConfirmActive = false; // チュートリアル確認中フラグ
let isTutorialShowing = false; // チュートリアル表示中フラグ

const btnSkipIntroEl = document.getElementById('btn-skip-intro');

// 住人通知クリック時のカメラフォーカス
let notifFocusVillager = null; // フォーカス中の住人インスタンス
let isNotifCameraFocus = false; // カメラフォーカスモード中かどうか

// UI要素の取得
const dialogBoxEl = document.getElementById('dialog-box');
const dialogTextEl = document.getElementById('dialog-text');
const dialogSpeakerEl = document.getElementById('dialog-speaker');
const dialogOptionsEl = document.getElementById('dialog-options');
const dialogTipEl = document.getElementById('dialog-tip');

// v35 見上げるモード用 HTML要素の取得
const btnLookupEl = document.getElementById('btn-lookup');
const lookupTooltipEl = document.getElementById('lookup-tooltip');
const tooltipPlanetNameEl = document.getElementById('tooltip-planet-name');
const tooltipPlanetClimateEl = document.getElementById('tooltip-planet-climate');
const tooltipPlantCountEl = document.getElementById('tooltip-plant-count');
const tooltipVillagerCountEl = document.getElementById('tooltip-villager-count');

// ==========================================
// v35 見上げるモード用変数定義
// ==========================================
let isLookUpMode = false;
let lookUpGroup = null;      // 上空アセット一括表示用のグループ
let skyPlanets = [];         // 上空に浮かぶ他惑星メッシュのリスト
let cosmicGalaxy = null;     // 渦巻き銀河
let cosmicNebula = null;     // 宇宙塵・星雲ガス
let lookUpStars = null;       // 見上げるモード用満天の星空
let lookUpStarBaseColors = []; // 星の基本色
let lookUpStarPhases = [];    // 星のきらめきフェーズ
let lookUpStarSpeeds = [];    // 星のきらめき速度
let skyComets = [];          // プレミアム彗星
let ufoGroup = null;         // UFO
let ufoActive = false;
let ufoTimer = 5.0;          // UFO出現インターバル
let ufoSpeed = 38.0;
let ufoDirection = new THREE.Vector3();
let skyAuroras = [];         // オーロラ
let cosmicWhale = null;      // 宇宙クジラ
let cosmicWhaleActive = false;
let cosmicWhaleTimer = 10.0; // クジラ出現インターバル
let cosmicWhaleSpeed = 6.0;
let cosmicWhaleDirection = new THREE.Vector3();
let supernovas = [];         // 超新星爆発リング
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hoveredSkyPlanet = null;
const arrivalToastEl = document.getElementById('arrival-toast');
const arrivalToastTextEl = document.getElementById('arrival-toast-text');
const btnTalkEl = document.getElementById('btn-talk');
const worldTalkBubbleEl = document.getElementById('world-talk-bubble');

// 住人のセリフ使用頻度管理と加重ランダム選択
let dialogueUseCount = {};
function getWeightedRandom(arr) {
    if (!arr || arr.length === 0) return "";
    const weights = arr.map(item => {
        const count = dialogueUseCount[item] || 0;
        return 1 / (1 + count);
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < arr.length; i++) {
        rand -= weights[i];
        if (rand <= 0) {
            dialogueUseCount[arr[i]] = (dialogueUseCount[arr[i]] || 0) + 1;
            return arr[i];
        }
    }
    const selected = arr[arr.length - 1];
    dialogueUseCount[selected] = (dialogueUseCount[selected] || 0) + 1;
    return selected;
}

// 住人のセリフ自動生成＆植物不足時おねだりセリフ取得
function generateVillagerDialogue(target) {
    const typeId = target.typeData.id;
    const plantCount = currentPlanet.plants.length;

    // 0. 再来時の初回会話
    if (target.isRevisitor && !target.hasSpokenThisVisit) {
        target.hasSpokenThisVisit = true;
        const revisitorDialogues = {
            cat: [
                "ニャッホー！また来ちゃったニャ！ここの居心地が忘れられなくて、宇宙船をUターンさせちゃったニャ！",
                "ふにゃ〜！またこの星の綺麗な空気に会いに来たニャ！ただいまニャ！",
                "ニャァー！やっぱりこの星が一番落ち着くニャ！またしばらくお邪魔するニャ！"
            ],
            rabbit: [
                "ピョンピョン！また来ちゃったピョン！ここのフカフカな地面が恋しかったピョン！",
                "やっほーピョン！また遊びに来たピョン！また一緒に遊んでほしいピョン！",
                "ピョン！この星の綺麗な景色が忘れられなくて、またロケットで飛んできたピョン！"
            ],
            dog: [
                "ワンワン！また来ちゃったワン！こ高的いい匂いが懐かしくて、また戻ってきたワン！",
                "ハァハァ、ワン！またこの星に遊びに来れて嬉しいワン！またよろしくワン！",
                "ワンッ！やっぱりこの星が大好きで、またロケットを走らせて来ちゃったワン！"
            ],
            bear: [
                "うむ、また来てしまったクマ。ここの素晴らしい癒やし効果が忘れられなくてね。",
                "やあ、開拓者君。また少しばかりこの星でお世話になるクマ。ここのお昼寝スポットは最高だからな。",
                "ふむ、やはりこの美しい景色が恋しくなって、また戻ってきたクマ。よろしく頼むクマ。"
            ],
            bee: [
                "ブーン！お花の香りに誘われて、また戻ってきちゃったブーン！",
                "ハチスケ、ただいま戻ったブーン！やっぱりここが一番のお気に入りだブーン！"
            ],
            koala: [
                "ふあぁ……のんびりしたくなって、また木登りに来ちゃったコアラ……",
                "コアラノシン、また来たコアラ。ここの木の香りはやっぱり落ち着くコアラ。"
            ],
            fox: [
                "コンコン！また来ちゃったコン！ここの不思議な魅力に引き寄せられたコン！",
                "コン太、ただいま参上コン！またお喋りしに来たコンよ！"
            ],
            mouse: [
                "チュウ！また走り回りに来ちゃったチュウ！やっぱりここが最高だチュウ！",
                "ヤッホーチュウ！また遊びに来たチュウ！"
            ],
            pig: [
                "ブヒッ！ここの美味しい空気が恋しくて、また戻ってきたブヒ！",
                "ただいまブヒ！またしばらくのんびりさせてほしいブヒ！"
            ],
            frog: [
                "ケロケロ！また大ジャンプしにきちゃったケロ！ただいまケロ！",
                "ケロ！ここの快適な湿度が忘れられなくて、また遊びに来たケロ！"
            ],
            alien: [
                "ピピッ……やはりこの星の安定したエネルギーフィールドが恋しくなり、再訪したゾル。",
                "システムチェック……再訪完了ゾル。またよろしくゾル。"
            ],
            panda: [
                "パオーン！パン助、また来たパン！またのんびり転がらせてほしいパン！",
                "パンダはやはりここがお気に入りだパン！また戻ってきたパン！"
            ],
            monkey: [
                "ウキッ！また美味しい果物を食べにきちゃったウキ！ただいまウキ！",
                "サル吉、また来たウキ！また木登りさせてほしいウキ！"
            ],
            sheep: [
                "メェ〜！ふわふわの草が恋しくて、また戻ってきたメェ〜。",
                "メエ子、ただいまメェ。また美味しい草をはんでもいいメェ？"
            ],
            squirrel: [
                "キキッ！また木の実の様子を見に来ちゃったリス！ただいまリス！",
                "やっぱりここが一番の秘密基地だリス！また遊びに来たリス！"
            ]
        };
        const list = revisitorDialogues[typeId] || ["また遊びに来ちゃった！ただいま！"];
        return getWeightedRandom(list);
    }

    // 1. 植物不足（5本未満）のおねだり（柔らかい口調のバリエーション）
    if (plantCount < 5) {
        const dialogs = {
            cat: [
                "あのニャ……この星,もっとお花やキノコ、木がたくさん増えるともっともっと嬉しいのニャ！よかったらもっと植えてほしいニャ〜。",
                "ふにゃ〜、この星にもっと緑やお花があると、とっても素敵だと思うのニャ〜。もっと植えてほしいニャ！",
                "お花や木がもっとたくさんあると、なんだかワクワクするニャ〜。もう少し増やしてほしいニャ？",
                "緑の香りがもっとほしいニャ〜。お花を植えてくれるのを、のんびり待ってるニャ〜。"
            ],
            rabbit: [
                "ねぇねぇ、この星にもっと植物を植えてほしいピョン！お花や木がいっぱいあると、もっと高くジャンプできて楽しいピョン！",
                "ピョンピョン！ここをもっとお花でいっぱいにしたいピョン！もっと植えてくれたら嬉しいピョン！",
                "お花や木がたくさんあると、かくれんぼができて楽しいピョン！もっともっと植えてほしいピョン！",
                "緑がいっぱいになると、フカフカで気持ちいいピョン！お花や木を少し増やしてほしいピョン〜！"
            ],
            dog: [
                "クンクン……！この星、もっといい匂いにしたいワン！お花や木をたくさん植えてくれると嬉しいワン！",
                "ワンワン！お花や木が増えると、探検がもっと楽しくなるワン！もっと植えてほしいワン！",
                "もっとフニフニの草むらや、可愛いお花がほしいワン！君の植えてくれる植物が大好きだワン！",
                "クンクン、お花の香りがもっとすると嬉しいワン！もう少し植えてくれるワン？"
            ],
            bear: [
                "ふむ……緑や花がもう少し増えると、素晴らしいお昼寝スポットになりそうだクマ。ぜひ植物を植えてほしいクマ。",
                "やあ。この星にもう少しお花や木があると、心がとっても穏やかになるクマ。もっと植えてほしいクマ。",
                "ふむ、緑の木々やお花が足りない気がするクマ。君が植えてくれるのを、のんびり楽しみにしているクマ。",
                "お花や木がたくさんあると、森の中にいるみたいで落ち着くクマ。もう少し増やしてクマ。"
            ]
        };
        const list = dialogs[typeId] || ["もっと植物を植えてほしいな。"];
        return getWeightedRandom(list);
    }

    // 2. 通常時の自動生成会話
    const templates = {
        cat: {
            greetings: ["ニャッホー！", "ニャァー！", "こんにちはニャ！", "ふにゃ〜、"],
            states: [
                "この星はとても気持ちよくて、のんびりできるのニャ。",
                "開拓が進んで、景色がすごく綺麗になってきたニャ〜。",
                "君が植えてくれた植物たちがキラキラ輝いているニャ！",
                "星空を眺めていると、宇宙の広さを感じるのニャ。"
            ],
            feelings: [
                "ここでの暮らしは最高だニャ！大絶賛するニャ！",
                "君は本当にセンス抜群 of テラフォーマーニャ！",
                "もっとこの星が賑やかになるといいニャ！",
                "君の隣にいると、すごく安心するのニャ。"
            ]
        },
        rabbit: {
            greetings: ["ピョンピョン！", "やっほーピョン！", "こんにちはピョン！", "ピョン！"],
            states: [
                "地面がふかふかだから、毎日大ジャンプしてるピョン！",
                "キラキラ光るキノコや果物がすごく美味しそうだピョン！",
                "風が気持ちよくて、走り回るのに最高の星だピョン！",
                "小惑星のまわりをフワフワ浮かぶ星屑が綺麗だピョン！"
            ],
            feelings: [
                "この星のセンスは間違いなくピカイチだピョン！",
                "ここへ連れてきてくれて本当にありがとうピョン！",
                "ずーっとここで遊んでいたいピョン！",
                "君の開拓魂には本当に驚かされるピョン！"
            ]
        },
        dog: {
            greetings: ["ワンワン！", "やあ！こんにちはワン！", "ワンッ！", "ハァハァ,ワン！"],
            states: [
                "この星の土の匂い、すっごくいい匂いで大好きだワン！",
                "植えてくれた木に美味しそうな果物がなっているのを見つけたワン！",
                "走り回っていたら、なんだかお腹が空いてきちゃったワン！",
                "この惑星の探検は、どこに行ってもワクワクするワン！"
            ],
            feelings: [
                "君の開拓センスは大絶賛レベルだワン！",
                "ここで君と一緒にお散歩できるのがすごく幸せだワン！",
                "もっとたくさんの植物たちに囲まれたいワン！",
                "君と友達になれて、本当によかったワン！"
            ]
        },
        bear: {
            greetings: ["うむ、こんにちはクマ。", "やあ、開拓者君。調子はどうクマ？", "ふむ、いい天気クマね。", "やあ。"],
            states: [
                "この星のネオン植物たちの癒やし効果は極上クオリティクマ。",
                "風の音を聞きながら、緑を眺めるのは実実にいものクマ。",
                "君の植えた木々が立派に育っているのを見て感心したクマ。",
                "静かな宇宙で、こうして静養するのは贅沢の極みクマ。"
            ],
            feelings: [
                "これほど美しい星に仕上げるなんて、君のセンスは一流クマ！",
                "実に見事な環境づくりクマ.心から敬意を表するクマ。",
                "これからもこの星がどう発展していくか、楽しみで仕方ないクマ。",
                "この地を生涯の安住の地にしたいと考えているクマ。"
            ]
        }
    };

    const t = templates[typeId];
    if (!t) {
        const lines = target.typeData.dialogues;
        return getWeightedRandom(lines);
    }

    const greeting = getWeightedRandom(t.greetings);
    const state = getWeightedRandom(t.states);
    const feeling = getWeightedRandom(t.feelings);

    return `${greeting}${state}${feeling}`;
}

const btnWarpEl = document.getElementById('btn-warp');
const btnPlantFlowerEl = document.getElementById('btn-plant-flower');
const btnPlantTreeEl = document.getElementById('btn-plant-tree');
const btnGuideEl = document.getElementById('btn-guide');
const btnBgmEl = document.getElementById('btn-bgm');
const btnTutorialEl = document.getElementById('btn-tutorial');
const optYesEl = document.getElementById('opt-yes');
const optNoEl = document.getElementById('opt-no');

const btnHarvestEl = document.getElementById('btn-harvest');
const btnCollectSeedEl = document.getElementById('btn-collect-seed');
const invGrassSeedsEl = document.getElementById('inv-grass-seeds');
const invFlowerSeedsListEl = document.getElementById('inv-flower-seeds-list');
const invTreeSaplingsListEl = document.getElementById('inv-tree-saplings-list');
const btnPresentEl = document.getElementById('btn-present');
const fruitCountEl = document.getElementById('fruit-count');

const warpModalEl = document.getElementById('warp-modal');
const btnWarpCloseEl = document.getElementById('btn-warp-close');
const warpOverlayEl = document.getElementById('warp-overlay');
const warpLoadingTextEl = document.getElementById('warp-loading-text');

const tutorialSummaryModalEl = document.getElementById('tutorial-summary-modal');
const btnTutorialSummaryCloseEl = document.getElementById('btn-tutorial-summary-close');

// 惑星カード要素
const cardArtemisEl = document.getElementById('card-artemis');
const cardBoreasEl = document.getElementById('card-boreas');
const cardHeliosEl = document.getElementById('card-helios');

// ダッシュボード更新用
const currentPlanetNameEl = document.getElementById('current-planet-name');
const currentPlanetClimateEl = document.getElementById('current-planet-climate');
const statArtemisPlantsEl = document.getElementById('stat-artemis-plants');
const statBoreasPlantsEl = document.getElementById('stat-boreas-plants');
const statHeliosPlantsEl = document.getElementById('stat-helios-plants');

// 📡 ガイドボタンの制御
btnGuideEl.addEventListener('click', (e) => {
    e.stopPropagation();
    isGuideActive = !isGuideActive;

    if (isGuideActive) {
        btnGuideEl.classList.add('active');
        btnGuideEl.innerHTML = '<span class="btn-icon">📡</span> ガイド: ON';
    } else {
        btnGuideEl.classList.remove('active');
        btnGuideEl.innerHTML = '<span class="btn-icon">📡</span> ガイド: OFF';
    }

    currentPlanet.activeVillagers.forEach(v => {
        v.beacon.visible = isGuideActive;
        v.beacon.material.opacity = isGuideActive ? 0.35 : 0;
    });

    if (portalBeacon) {
        portalBeacon.visible = isGuideActive;
        portalBeacon.material.opacity = isGuideActive ? 0.35 : 0;
    }
});

// 🎵 BGMボタンの制御
if (btnBgmEl) {
    btnBgmEl.addEventListener('click', (e) => {
        e.stopPropagation();
        isBGMEnabled = !isBGMEnabled;

        if (isBGMEnabled) {
            btnBgmEl.classList.add('active');
            btnBgmEl.innerHTML = '<span class="btn-icon">🎵</span> BGM: ON';
            startBGM();
        } else {
            btnBgmEl.classList.remove('active');
            btnBgmEl.innerHTML = '<span class="btn-icon">🔇</span> BGM: OFF';
            stopBgmDrone();
        }
    });
}

// 🔰 チュートリアルボタンの制御
if (btnTutorialEl) {
    btnTutorialEl.addEventListener('click', (e) => {
        e.stopPropagation();
        btnTutorialEl.blur();
        if (isTutorialShowing) {
            stopTutorial();
        } else {
            if (hasPlayedTutorial) {
                showTutorialModeSelect();
            } else {
                isTutorialTextOnlyMode = false;
                showTutorialDialogue();
            }
        }
    });
}

// チュートリアル概要モーダルの閉じるボタン制御
if (btnTutorialSummaryCloseEl && tutorialSummaryModalEl) {
    btnTutorialSummaryCloseEl.addEventListener('click', (e) => {
        e.stopPropagation();
        tutorialSummaryModalEl.style.display = 'none';
    });
}

// 住民数UIの更新
function updateVillagerCountUI() {
    const el = document.getElementById('villager-count');
    if (!el) return;
    const settled = currentPlanet.activeVillagers.filter(v => v.settled).length;
    const total   = currentPlanet.activeVillagers.length;
    el.textContent = `${settled} / ${total}`;
}

// 緑化率の計算
function getGreenRate() {
    let totalBaseScale = 0;
    let currentScaleSum = 0;
    grassClumps.forEach(gc => {
        totalBaseScale += gc.baseScale || 1.0;
        currentScaleSum += gc.scale || 0;
    });
    return totalBaseScale > 0 ? Math.min(100, Math.round((currentScaleSum / totalBaseScale) * 100)) : 0;
}

// 統計パネルUI（花・木・緑化率）の更新
function updateStatsUI() {
    const plants = currentPlanet.plants || [];
    const flowerCount = plants.filter(p => p.type === 'flower').length;
    const treeCount = plants.filter(p => p.type === 'tree').length;

    const flowerEl = document.getElementById('flower-count');
    const treeEl = document.getElementById('tree-count');
    const greenRateEl = document.getElementById('green-rate');

    if (flowerEl) flowerEl.textContent = flowerCount;
    if (treeEl) treeEl.textContent = treeCount;
    if (greenRateEl) greenRateEl.textContent = getGreenRate();
    
    // インベントリUIも更新
    updateInventoryUI();
}

// インベントリUIの更新とイベントリスナーの設定
function updateInventoryUI() {
    if (invGrassSeedsEl) {
        invGrassSeedsEl.textContent = playerInventory.grassSeeds;
    }
    
    // 選択中のシードを調整
    adjustSelectedItems();

    if (invFlowerSeedsListEl) {
        invFlowerSeedsListEl.innerHTML = '';
        Object.keys(playerInventory.flowerSeeds).forEach(key => {
            const count = playerInventory.flowerSeeds[key];
            let isAvailableOnPlanet = false;
            if (currentPlanet.id === "boreas" && key === "ice_flower") isAvailableOnPlanet = true;
            else if (currentPlanet.id === "helios" && key === "desert_flower") isAvailableOnPlanet = true;
            else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic", "lily", "rose", "tulip"].includes(key)) isAvailableOnPlanet = true;

            if (count > 0 || isAvailableOnPlanet) {
                const itemEl = document.createElement('div');
                itemEl.className = 'inv-item';
                if (key === selectedFlowerSeed) {
                    itemEl.classList.add('selected');
                }
                if (count <= 0) {
                    itemEl.classList.add('disabled');
                }
                
                let label = "";
                if (key === "cosmic") label = "宇宙";
                else if (key === "lily") label = "百合";
                else if (key === "rose") label = "バラ";
                else if (key === "tulip") label = "チューリップ";
                else if (key === "ice_flower") label = "氷結";
                else if (key === "desert_flower") label = "砂漠";
                
                itemEl.textContent = `${label} (${count})`;
                
                if (count > 0) {
                    itemEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectedFlowerSeed = key;
                        updateInventoryUI();
                    });
                }
                invFlowerSeedsListEl.appendChild(itemEl);
            }
        });
    }

    if (invTreeSaplingsListEl) {
        invTreeSaplingsListEl.innerHTML = '';
        Object.keys(playerInventory.treeSaplings).forEach(key => {
            const count = playerInventory.treeSaplings[key];
            let isAvailableOnPlanet = false;
            if (currentPlanet.id === "boreas" && key === "ice_tree") isAvailableOnPlanet = true;
            else if (currentPlanet.id === "helios" && key === "desert_tree") isAvailableOnPlanet = true;
            else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic_tree", "berry_tree"].includes(key)) isAvailableOnPlanet = true;

            if (count > 0 || isAvailableOnPlanet) {
                const itemEl = document.createElement('div');
                itemEl.className = 'inv-item';
                if (key === selectedTreeSapling) {
                    itemEl.classList.add('selected');
                }
                if (count <= 0) {
                    itemEl.classList.add('disabled');
                }
                
                let label = "";
                if (key === "cosmic_tree") label = "宇宙の木";
                else if (key === "berry_tree") label = "ベリーの木";
                else if (key === "ice_tree") label = "氷結の木";
                else if (key === "desert_tree") label = "砂漠の木";
                
                itemEl.textContent = `${label} (${count})`;
                
                if (count > 0) {
                    itemEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectedTreeSapling = key;
                        updateInventoryUI();
                    });
                }
                invTreeSaplingsListEl.appendChild(itemEl);
            }
        });
    }
}

function adjustSelectedItems() {
    // 花のタネの調整
    const currentFlowerCount = playerInventory.flowerSeeds[selectedFlowerSeed] || 0;
    let flowerAvailable = false;
    if (currentPlanet.id === "boreas" && selectedFlowerSeed === "ice_flower") flowerAvailable = true;
    else if (currentPlanet.id === "helios" && selectedFlowerSeed === "desert_flower") flowerAvailable = true;
    else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic", "lily", "rose", "tulip"].includes(selectedFlowerSeed)) flowerAvailable = true;

    if (currentFlowerCount <= 0 || !flowerAvailable) {
        const keys = Object.keys(playerInventory.flowerSeeds);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            let isAvail = false;
            if (currentPlanet.id === "boreas" && k === "ice_flower") isAvail = true;
            else if (currentPlanet.id === "helios" && k === "desert_flower") isAvail = true;
            else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic", "lily", "rose", "tulip"].includes(k)) isAvail = true;
            
            if (playerInventory.flowerSeeds[k] > 0 && isAvail) {
                selectedFlowerSeed = k;
                break;
            }
        }
    }

    // 木の苗の調整
    const currentTreeCount = playerInventory.treeSaplings[selectedTreeSapling] || 0;
    let treeAvailable = false;
    if (currentPlanet.id === "boreas" && selectedTreeSapling === "ice_tree") treeAvailable = true;
    else if (currentPlanet.id === "helios" && selectedTreeSapling === "desert_tree") treeAvailable = true;
    else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic_tree", "berry_tree"].includes(selectedTreeSapling)) treeAvailable = true;

    if (currentTreeCount <= 0 || !treeAvailable) {
        const keys = Object.keys(playerInventory.treeSaplings);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            let isAvail = false;
            if (currentPlanet.id === "boreas" && k === "ice_tree") isAvail = true;
            else if (currentPlanet.id === "helios" && k === "desert_tree") isAvail = true;
            else if (currentPlanet.id !== "boreas" && currentPlanet.id !== "helios" && ["cosmic_tree", "berry_tree"].includes(k)) isAvail = true;
            
            if (playerInventory.treeSaplings[k] > 0 && isAvail) {
                selectedTreeSapling = k;
                break;
            }
        }
    }
}


// 住人のセリフ自動生成＆植物不足時おねだりセリフ取得
function generateVillagerDialogue(target) {
    const typeId = target.typeData.id;
    const plantCount = currentPlanet.plants.length;

    // 0. 再来時の初回会話
    if (target.isRevisitor && !target.hasSpokenThisVisit) {
        target.hasSpokenThisVisit = true;
        const revisitorDialogues = {
            cat: [
                "ニャッホー！また来ちゃったニャ！ここの居心地が忘れられなくて、宇宙船をUターンさせちゃったニャ！",
                "ふにゃ〜！またこの星の綺麗な空気に会いに来たニャ！ただいまニャ！",
                "ニャァー！やっぱりこの星が一番落ち着くニャ！またしばらくお邪魔するニャ！"
            ],
            rabbit: [
                "ピョンピョン！また来ちゃったピョン！ここのフカフカな地面が恋しかったピョン！",
                "やっほーピョン！また遊びに来たピョン！また一緒に遊んでほしいピョン！",
                "ピョン！この星の綺麗な景色が忘れられなくて、またロケットで飛んできたピョン！"
            ],
            dog: [
                "ワンワン！また来ちゃったワン！こ高的いい匂いが懐かしくて、また戻ってきたワン！",
                "ハァハァ、ワン！またこの星に遊びに来れて嬉しいワン！またよろしくワン！",
                "ワンッ！やっぱりこの星が大好きで、またロケットを走らせて来ちゃったワン！"
            ],
            bear: [
                "うむ、また来てしまったクマ。ここの素晴らしい癒やし効果が忘れられなくてね。",
                "やあ、開拓者君。また少しばかりこの星でお世話になるクマ。ここのお昼寝スポットは最高だからな。",
                "ふむ、やはりこの美しい景色が恋しくなって、また戻ってきたクマ。よろしく頼むクマ。"
            ],
            bee: [
                "ブーン！お花の香りに誘われて、また戻ってきちゃったブーン！",
                "ハチスケ、ただいま戻ったブーン！やっぱりここが一番のお気に入りだブーン！"
            ],
            koala: [
                "ふあぁ……のんびりしたくなって、また木登りに来ちゃったコアラ……",
                "コアラノシン、また来たコアラ。ここの木の香りはやっぱり落ち着くコアラ。"
            ],
            fox: [
                "コンコン！また来ちゃったコン！ここの不思議な魅力に引き寄せられたコン！",
                "コン太、ただいま参上コン！またお喋りしに来たコンよ！"
            ],
            mouse: [
                "チュウ！また走り回りに来ちゃったチュウ！やっぱりここが最高だチュウ！",
                "ヤッホーチュウ！また遊びに来たチュウ！"
            ],
            pig: [
                "ブヒッ！ここの美味しい空気が恋しくて、また戻ってきたブヒ！",
                "ただいまブヒ！またしばらくのんびりさせてほしいブヒ！"
            ],
            frog: [
                "ケロケロ！また大ジャンプしにきちゃったケロ！ただいまケロ！",
                "ケロ！ここの快適な湿度が忘れられなくて、また遊びに来たケロ！"
            ],
            alien: [
                "ピピッ……やはりこの星の安定したエネルギーフィールドが恋しくなり、再訪したゾル。",
                "システムチェック……再訪完了ゾル。またよろしくゾル。"
            ],
            panda: [
                "パオーン！パン助、また来たパン！またのんびり転がらせてほしいパン！",
                "パンダはやはりここがお気に入りだパン！また戻ってきたパン！"
            ],
            monkey: [
                "ウキッ！また美味しい果物を食べにきちゃったウキ！ただいまウキ！",
                "サル吉、また来たウキ！また木登りさせてほしいウキ！"
            ],
            sheep: [
                "メェ〜！ふわふわの草が恋しくて、また戻ってきたメェ〜。",
                "メエ子、ただいまメェ。また美味しい草をはんでもいいメェ？"
            ],
            squirrel: [
                "キキッ！また木の実の様子を見に来ちゃったリス！ただいまリス！",
                "やっぱりここが一番の秘密基地だリス！また遊びに来たリス！"
            ]
        };
        const list = revisitorDialogues[typeId] || ["また遊びに来ちゃった！ただいま！"];
        return getWeightedRandom(list);
    }

    // 1. 植物不足（5本未満）のおねだり（柔らかい口調のバリエーション）
    if (plantCount < 5) {
        const dialogs = {
            cat: [
                "あのニャ……この星、もっとお花やキノコ、木がたくさん増えるともっともっと嬉しいのニャ！よかったらもっと植えてほしいニャ〜。",
                "ふにゃ〜、この星にもっと緑やお花があると、とっても素敵だと思うのニャ〜。もっと植えてほしいニャ！",
                "お花や木がもっとたくさんあると、なんだかワクワクするニャ〜。もう少し増やしてほしいニャ？",
                "緑の香りがもっとほしいニャ〜。お花を植えてくれるのを、のんびり待ってるニャ〜。"
            ],
            rabbit: [
                "ねぇねぇ、この星にもっと植物を植えてほしいピョン！お花や木がいっぱいあると、もっと高くジャンプできて楽しいピョン！",
                "ピョンピョン！ここをもっとお花でいっぱいにしたいピョン！もっと植えてくれたら嬉しいピョン！",
                "お花や木がたくさんあると、かくれんぼができて楽しいピョン！もっともっと植えてほしいピョン！",
                "緑がいっぱいになると、フカフカで気持ちいいピョン！お花や木を少し増やしてほしいピョン〜！"
            ],
            dog: [
                "クンクン……！この星、もっといい匂いにしたいワン！お花や木をたくさん植えてくれると嬉しいワン！",
                "ワンワン！お花や木が増えると、探検がもっと楽しくなるワン！もっと植えてほしいワン！",
                "もっとフニフニの草むらや、可愛いお花がほしいワン！君の植えてくれる植物が大好きだワン！",
                "クンクン、お花の香りがもっとすると嬉しいワン！もう少し植えてくれるワン？"
            ],
            bear: [
                "ふむ……緑や花がもう少し増えると、素晴らしいお昼寝スポットになりそうだクマ。ぜひ植物を植えてほしいクマ。",
                "やあ。この星にもう少しお花や木があると、心がとっても穏やかになるクマ。もっと植えてほしいクマ。",
                "ふむ、緑の木々やお花が足りない気がするクマ。君が植えてくれるのを、のんびり楽しみにしているクマ。",
                "お花や木がたくさんあると、森の中にいるみたいで落ち着くクマ。もう少し増やしてクマ。"
            ]
        };
        const list = dialogs[typeId] || ["もっと植物を植えてほしいな。"];
        return list[Math.floor(Math.random() * list.length)];
    }

    // 2. 通常時の自動生成会話
    const templates = {
        cat: {
            greetings: ["ニャッホー！", "ニャァー！", "こんにちはニャ！", "ふにゃ〜、"],
            states: [
                "この星はとても気持ちよくて、のんびりできるのニャ。",
                "開拓が進んで、景色がすごく綺麗になってきたニャ〜。",
                "君が植えてくれた植物たちがキラキラ輝いているニャ！",
                "星空を眺めていると、宇宙の広さを感じるのニャ。"
            ],
            feelings: [
                "ここでの暮らしは最高だニャ！大絶賛するニャ！",
                "君は本当にセンス抜群のテラフォーマーニャ！",
                "もっとこの星が賑やかになるといいニャ！",
                "君の隣にいると、すごく安心するのニャ。"
            ]
        },
        rabbit: {
            greetings: ["ピョンピョン！", "やっほーピョン！", "こんにちはピョン！", "ピョン！"],
            states: [
                "地面がふかふかだから、毎日大ジャンプしてるピョン！",
                "キラキラ光るキノコや果物がすごく美味しそうだピョン！",
                "風が気持ちよくて、走り回るのに最高の星だピョン！",
                "小惑星のまわりをフワフワ浮かぶ星屑が綺麗だピョン！"
            ],
            feelings: [
                "この星のセンスは間違いなくピカイチだピョン！",
                "ここへ連れてきてくれて本当にありがとうピョン！",
                "ずーっとここで遊んでいたいピョン！",
                "君の開拓魂には本当に驚かされるピョン！"
            ]
        },
        dog: {
            greetings: ["ワンワン！", "やあ！こんにちはワン！", "ワンッ！", "ハァハァ,ワン！"],
            states: [
                "この星の土の匂い、すっごくいい匂いで大好きだワン！",
                "植えてくれた木に美味しそうな果物がなっているのを見つけたワン！",
                "走り回っていたら、なんだかお腹が空いてきちゃったワン！",
                "この惑星の探検は、どこに行ってもワクワクするワン！"
            ],
            feelings: [
                "君の開拓センスは大絶賛レベルだワン！",
                "ここで君と一緒にお散歩できるのがすごく幸せだワン！",
                "もっとたくさんの植物たちに囲まれたいワン！",
                "君と友達になれて、本当によかったワン！"
            ]
        },
        bear: {
            greetings: ["うむ、こんにちはクマ。", "やあ、開拓者君。調子はどうクマ？", "ふむ、いい天気クマね。", "やあ。"],
            states: [
                "この星のネオン植物たちの癒やし効果は極上クオリティクマ。",
                "風の音を聞きながら、緑を眺めるのは実によいものクマ。",
                "君の植えた木々が立派に育っているのを見て感心したクマ。",
                "静かな宇宙で、こうして静養するのは贅沢の極みクマ。"
            ],
            feelings: [
                "これほど美しい星に仕上げるなんて、君のセンスは一流クマ！",
                "実に見事な環境づくりクマ.心から敬意を表するクマ。",
                "これからもこの星がどう発展していくか、楽しみで仕方ないクマ。",
                "この地を生涯の安住の地にしたいと考えているクマ。"
            ]
        }
    };

    const t = templates[typeId];
    if (!t) {
        const lines = target.typeData.dialogues;
        return lines[Math.floor(Math.random() * lines.length)];
    }

    const greeting = t.greetings[Math.floor(Math.random() * t.greetings.length)];
    const state = t.states[Math.floor(Math.random() * t.states.length)];
    const feeling = t.feelings[Math.floor(Math.random() * t.feelings.length)];

    return `${greeting}${state}${feeling}`;
}

// 会話を開始する
function startDialogue() {
    if (isDialogOpen || isWarpMenuOpen || isWarping) return;
    
    const result = findNearestVillager();
    if (!result || !result.villager) return;
    const target = result.villager;

    isDialogOpen = true;
    dialogBoxEl.classList.remove('dialog-finished');
    currentSpeakerInstance = target;
    currentSpeaker = target.name;
    dialogSpeakerEl.textContent = currentSpeaker;
    
    playerBounce = 0.15;
    target.bounce = 0.32;
    
    faceVillagerToPlayer(target);

    btnTalkEl.style.display = "none";
    if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
    btnPresentEl.style.display = "none";
    dialogBoxEl.style.display = "block";
    dialogOptionsEl.style.display = "none";
    
    if (!target.settled && target.leavingTimer <= 0 && Math.random() < 0.10) {
        // 定住条件チェック
        const plants = currentPlanet.plants;
        const fc = plants.filter(p => p.type === 'flower').length;
        const tc = plants.filter(p => p.type === 'tree').length;
        const needF = Math.max(0, target.settleReqFlower - fc);
        const needT = Math.max(0, target.settleReqTree   - tc);
        if (needF > 0 || needT > 0) {
            // 条件未達 → 定住を申し込む代わりに「もっと植えて」セリフ
            isNegotiationActive = false;
            let hint = "";
            if (needF > 0 && needT > 0) hint = `花があと${needF}本、木があと${needT}本増えたら…もっとここに居たくなるな`;
            else if (needF > 0)         hint = `お花があと${needF}本増えたら…ずっとここに居たいんだけどな`;
            else                         hint = `木があと${needT}本増えたら…この星に骨を埋めたい気分なんだけど`;
            const suffix = { cat:"ニャ。", rabbit:"ピョン。", dog:"ワン。", bear:"クマ。" };
            currentDialogueText = hint + (suffix[target.typeData.id] || "。");
            dialogTipEl.textContent = "画面またはEキーで進む";
        } else {
            isNegotiationActive = true;
            currentDialogueText = target.typeData.negotiation;
            dialogTipEl.textContent = "回答を選択してください";
        }
    } else {
        isNegotiationActive = false;
        
        // 30%の確率でタネや苗をプレゼントしてくれる
        if (Math.random() < 0.30) {
            let itemKey = "";
            const isFlower = Math.random() < 0.6; // 60% の確率で花
            if (currentPlanet.id === "boreas") {
                itemKey = isFlower ? "ice_flower" : "ice_tree";
            } else if (currentPlanet.id === "helios") {
                itemKey = isFlower ? "desert_flower" : "desert_tree";
            } else {
                if (isFlower) {
                    const flowers = ["cosmic", "lily", "rose", "tulip"];
                    itemKey = flowers[Math.floor(Math.random() * flowers.length)];
                } else {
                    const trees = ["cosmic_tree", "berry_tree"];
                    itemKey = trees[Math.floor(Math.random() * trees.length)];
                }
            }
            
            if (isFlower) {
                playerInventory.flowerSeeds[itemKey]++;
            } else {
                playerInventory.treeSaplings[itemKey]++;
            }
            
            const itemName = seedNames[itemKey];
            const suffix = { cat:"ニャ。", rabbit:"ピョン。", dog:"ワン。", bear:"クマ。" };
            const voiceSuffix = suffix[target.typeData.id] || "。";
            currentDialogueText = `あ、そうだ！旅の途中でいいものを見つけたから、キミにあげる${voiceSuffix}\n（「${itemName}」をもらった！）`;
            updateStatsUI();
        } else {
            currentDialogueText = generateVillagerDialogue(target);
        }
        dialogTipEl.textContent = "画面またはEキーで進む";
    }
    
    dialogueTextIndex = 0;
    dialogTextEl.textContent = "";
    
    streamDialogueText();
}

// 住人をプレイヤーの方向へ向かせる
function faceVillagerToPlayer(v) {
    const playerWorldPos = new THREE.Vector3();
    const villagerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    v.group.getWorldPosition(villagerWorldPos);

    const toPlayer = new THREE.Vector3().subVectors(playerWorldPos, villagerWorldPos);
    const normal = villagerWorldPos.clone().normalize();
    const flatDir = toPlayer.clone().projectOnPlane(normal).normalize();
    
    const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
    let angle = localForward.angleTo(flatDir);
    const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
    if (cross.dot(normal) < 0) {
        angle = -angle;
    }
    v.visualGroup.rotation.y = angle;
}

// 1文字ずつダイアログを表示
function streamDialogueText() {
    if (dialogueTextIndex < currentDialogueText.length) {
        const char = currentDialogueText[dialogueTextIndex];
        dialogTextEl.textContent += char;
        
        const voicePitch = currentSpeakerInstance ? (currentSpeakerInstance.typeData.voicePitch || 1.0) : 1.1;
        playAnimalTalkSound(char, voicePitch);
        
        dialogueTextIndex++;
        dialogueTimeout = setTimeout(streamDialogueText, 50);
    } else {
        dialogueTimeout = null;
        dialogBoxEl.classList.add('dialog-finished');
        if (isNegotiationActive) {
            dialogOptionsEl.style.display = "flex";
        }
    }
}

// ポータルの可視性とアンロック演出を制御
function updatePortalVisibility(showDialogue = false) {
    if (!warpPortalGroup) return;

    const settledCount = currentPlanet.activeVillagers.filter(v => v.settled).length;
    // 閾値：定住住人が1人以上
    const isUnlocked = settledCount >= 1;

    warpPortalGroup.visible = isUnlocked;

    if (portalBeacon) {
        portalBeacon.visible = isUnlocked && isGuideActive;
    }

    if (isUnlocked && !currentPlanet.portalUnlocked) {
        currentPlanet.portalUnlocked = true;
        if (showDialogue) {
            setTimeout(triggerCosmoPortalDialogue, 500);
        }
    }
}

// コスモのポータル出現気づきセリフダイアログ
function triggerCosmoPortalDialogue() {
    isDialogOpen = true;
    currentSpeakerInstance = null;
    currentSpeaker = "🤖 コスモ";
    dialogSpeakerEl.textContent = currentSpeaker;

    playerBounce = 0.15;

    btnTalkEl.style.display = "none";
    if (worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
    btnPresentEl.style.display = "none";
    dialogBoxEl.style.display = "block";
    dialogOptionsEl.style.display = "none";
    
    isNegotiationActive = false;
    currentDialogueText = "おや？ 星のエネルギーが高まって、不思議なポータルが出現したみたいだ！ これで他の惑星へ旅立てるかもしれないぞ！";
    dialogTipEl.textContent = "画面またはEキーで進む";

    dialogueTextIndex = 0;
    dialogTextEl.textContent = "";
    
    streamDialogueText();
}

// 会話を終了またはスキップ
function closeDialogue() {
    if (!isDialogOpen) return;
    
    if (dialogueTimeout) {
        // テキスト表示中の場合は表示を完了（スキップ）させる
        clearTimeout(dialogueTimeout);
        dialogueTimeout = null;
        dialogTextEl.textContent = currentDialogueText;
        dialogBoxEl.classList.add('dialog-finished');
        if (isNegotiationActive) {
            dialogOptionsEl.style.display = "flex";
        }
        return;
    }

    // すでに表示完了している場合はダイアログを閉じる
    if (isNegotiationActive) return;

    // v50: 定住が決まったらロケットに戻り、家づくりを開始
    let shouldCheckPortal = false;
    if (currentSpeakerInstance && currentSpeakerInstance.settled && currentSpeakerInstance.rocketInstance) {
        shouldCheckPortal = true;
        if (currentSpeakerInstance.state !== "GO_TO_ROCKET" && 
            currentSpeakerInstance.state !== "APPROACH_BUTTON" && 
            currentSpeakerInstance.state !== "PRESS_BUTTON" && 
            currentSpeakerInstance.state !== "HOUSE_MUTATION") {
            currentSpeakerInstance.state = "GO_TO_ROCKET";
            currentSpeakerInstance.targetPos.copy(currentSpeakerInstance.rocketInstance.baseLocalPos);
            currentSpeakerInstance.beacon.visible = false;
        }
    }

    isDialogOpen = false;
    dialogBoxEl.style.display = "none";
    dialogBoxEl.classList.remove('dialog-finished');
    currentSpeakerInstance = null;
    
    checkVillagerProximity();

    if (shouldCheckPortal) {
        updatePortalVisibility(true);
    }
}

// 祝福のスターバーストパーティクル
const starbursts = [];

function spawnStarburst(localPos) {
    const particleCount = 28 + Math.floor(Math.random() * 10);
    const colors = [0xff5c8a, 0xffd166, 0x06d6a0, 0x118ab2, 0xffffff, 0xb5179e];
    
    const normal = localPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    for (let i = 0; i < particleCount; i++) {
        const geom = new THREE.BoxGeometry(0.07, 0.07, 0.07);
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        mesh.position.copy(localPos).addScaledVector(normal, 0.5);
        asteroid.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.35 + Math.random() * 0.75; 
        const upward = 0.6 + Math.random() * 1.0; 
        
        const vel = new THREE.Vector3()
            .addScaledVector(right, Math.cos(angle) * spread)
            .addScaledVector(forward, Math.sin(angle) * spread)
            .addScaledVector(normal, upward)
            .normalize().multiplyScalar(2.6 + Math.random() * 2.2); 
            
        starbursts.push({
            mesh: mesh,
            vel: vel,
            age: 0,
            maxAge: 0.9 + Math.random() * 0.4,
            rotX: (Math.random() - 0.5) * 12,
            rotY: (Math.random() - 0.5) * 12,
            rotZ: (Math.random() - 0.5) * 12
        });
    }
}

function updateStarbursts(delta) {
    for (let i = starbursts.length - 1; i >= 0; i--) {
        const s = starbursts[i];
        s.age += delta;
        
        if (s.age >= s.maxAge) {
            asteroid.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            starbursts.splice(i, 1);
            continue;
        }
        
        const progress = s.age / s.maxAge;
        
        s.mesh.position.addScaledVector(s.vel, delta);
        const normal = s.mesh.position.clone().normalize();
        s.vel.addScaledVector(normal, -6.5 * delta); 
        
        s.mesh.rotation.x += s.rotX * delta;
        s.mesh.rotation.y += s.rotY * delta;
        s.mesh.rotation.z += s.rotZ * delta;
        
        s.mesh.material.opacity = 0.95 * (1.0 - progress);
        const scale = 1.0 - progress * 0.4;
        s.mesh.scale.set(scale, scale, scale);
    }
}

// 選択肢：ぜひ住んで！(Yes)
optYesEl.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (isTutorialModeSelectActive) {
        isTutorialModeSelectActive = false;
        dialogOptionsEl.style.display = "none";
        dialogBoxEl.style.display = "none";
        dialogBoxEl.classList.remove('dialog-finished');
        optYesEl.textContent = "ぜひ住んで！";
        optNoEl.textContent = "また今度ね";
        if (tutorialSummaryModalEl) {
            tutorialSummaryModalEl.style.display = "block";
        }
        return;
    }
    
    if (isIntroConfirmActive) {
        isIntroConfirmActive = false;
        dialogOptionsEl.style.display = "none";
        optYesEl.textContent = "ぜひ住んで！";
        optNoEl.textContent = "また今度ね";
        if (hasPlayedTutorial) {
            showTutorialModeSelect();
        } else {
            isTutorialTextOnlyMode = false;
            showTutorialDialogue();
        }
        return;
    }
    
    isNegotiationActive = false;
    dialogOptionsEl.style.display = "none";
    dialogTipEl.textContent = "画面またはEキーで閉じる";
    
    currentSpeakerInstance.settled = true;
    currentSpeakerInstance.bounce = 0.55;
    updateVillagerCountUI(); // 定住確定時に住民数を更新
    saveGame(false);

    
    currentSpeakerInstance.happyJumpCount = 3;
    
    spawnStarburst(currentSpeakerInstance.localPos);
    
    currentDialogueText = "本当ニャ！？ヤッター！君の作ったこの美しい星で、一生のんびり暮らすピョワン！これからよろしくニャ！";
    if (currentSpeakerInstance.id === "rabbit") currentDialogueText = "ピョン！ヤッター！この星に住めるなんて夢みたいだピョン！一生ジャンプし続けるピョン！";
    if (currentSpeakerInstance.id === "dog") currentDialogueText = "ワンワン！大感謝だワン！この最高な星の土を一生掘り続けるワン！末永くよろしくワン！";
    if (currentSpeakerInstance.id === "bear") currentDialogueText = "おお, 許可してくれたクマ！恩に着るクマ！この星の美しさを全力で守り、愛でるクマ！";
    
    dialogueTextIndex = 0;
    dialogTextEl.textContent = "";
    
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            if (currentSpeakerInstance && currentSpeakerInstance.group) {
                spawnAdorationHeart(currentSpeakerInstance.localPos);
            }
        }, i * 150);
    }

    streamDialogueText();
});

// 選択肢：また今度ね(No)
optNoEl.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (isTutorialModeSelectActive) {
        isTutorialModeSelectActive = false;
        dialogOptionsEl.style.display = "none";
        dialogBoxEl.style.display = "none";
        dialogBoxEl.classList.remove('dialog-finished');
        optYesEl.textContent = "ぜひ住んで！";
        optNoEl.textContent = "また今度ね";
        isTutorialTextOnlyMode = false;
        showTutorialDialogue();
        return;
    }
    
    if (isIntroConfirmActive) {
        isIntroConfirmActive = false;
        dialogOptionsEl.style.display = "none";
        optYesEl.textContent = "ぜひ住んで！";
        optNoEl.textContent = "また今度ね";
        dialogBoxEl.style.display = "none";
        dialogBoxEl.classList.remove('dialog-finished');
        return;
    }
    
    isNegotiationActive = false;
    dialogOptionsEl.style.display = "none";
    dialogTipEl.textContent = "画面またはEキーで閉じる";
    
    currentSpeakerInstance.state = "LEAVING_PENDING";
    currentSpeakerInstance.leavingTimer = 60.0; 
    
    currentDialogueText = "そっかぁ……残念だニャ……。でも、もうしばらくはここで綺麗な景色を楽しませてもらうニャ……。";
    if (currentSpeakerInstance.id === "rabbit") currentDialogueText = "ピョン……そっかぁ、しかたないピョン……。別の魅力的な星を探す旅に出るピョン。少ししたら行くピョン。";
    if (currentSpeakerInstance.id === "dog") currentDialogueText = "うぅ, ワン……残念だワン。でも、旅立つ最後の瞬間まで、この星の空気をめいっぱい吸わせてもらうワン！";
    if (currentSpeakerInstance.id === "bear") currentDialogueText = "ふむ、残念クマ。だが君の決断を尊重するクマ。ロケットが到着するまで、ここの植物をもう少し眺めているクマ。";
    
    dialogueTextIndex = 0;
    dialogTextEl.textContent = "";
    
    spawnStardust(currentSpeakerInstance.localPos);
    streamDialogueText();
});

// 話しかけボタンのクリック
btnTalkEl.addEventListener('click', (e) => {
    e.stopPropagation();
    startDialogue();
});

// 収穫ボタンのクリック
btnHarvestEl.addEventListener('click', (e) => {
    e.stopPropagation();
    harvestFruit();
});

// プレゼントボタンのクリック
btnPresentEl.addEventListener('click', (e) => {
    e.stopPropagation();
    presentFruit();
});

// ダイアログボックスをクリックした際の送り
dialogBoxEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isTutorialShowing) {
        advanceTutorialDialogue();
    } else if (isIntroDialogShowing) {
        advanceIntroDialogue();
    } else if (isDialogOpen) {
        closeDialogue();
    } else if (isArrivalDialogueShowing) {
        closeArrivalDialogueDirectly();
    }
});

// 到着フキダシをクリックした際にも閉じる / 住人通知の場合はカメラフォーカス
if (arrivalToastEl) {
    arrivalToastEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isArrivalDialogueShowing) {
            closeArrivalDialogueDirectly();
        } else if (notifFocusVillager && arrivalToastEl.dataset.notifFocus === 'true') {
            // クリックで住人にカメラフォーカス
            focusOnVillager(notifFocusVillager);
        }
    });
}

// キャンバスや背景クリック時のクローズ処理
window.addEventListener('click', () => {
    if (isIntroDialogShowing) {
        advanceIntroDialogue();
    } else if (isDialogOpen) {
        closeDialogue();
    } else if (isArrivalDialogueShowing) {
        closeArrivalDialogueDirectly();
    }
});

// プレイヤーと最も近い住人を検索する
function findNearestVillager() {
    const villagers = currentPlanet.activeVillagers;
    if (villagers.length === 0) return null;
    
    const playerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    
    let nearest = null;
    let minDist = 9999;
    
    villagers.forEach(v => {
        if (v.state === "LEAVING" && v.group.visible === false) return;
        
        const vPos = new THREE.Vector3();
        v.group.getWorldPosition(vPos);
        const dist = playerWorldPos.distanceTo(vPos);
        
        if (dist < minDist) {
            minDist = dist;
            nearest = v;
        }
    });
    
    return { villager: nearest, dist: minDist };
}

// プレイヤーによる果物収穫処理
function harvestFruit() {
    const plants = currentPlanet.plants;
    let nearestTree = null;
    let minDist = 9999;
    
    const playerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    
    plants.forEach(p => {
        if (p.type !== 'tree') return;
        if (!p.fruitProgress || !p.fruitProgress.some(prog => prog >= 1.0)) return;
        
        const treeWorldPos = new THREE.Vector3();
        p.mesh.getWorldPosition(treeWorldPos);
        const dist = playerWorldPos.distanceTo(treeWorldPos);
        
        if (dist < minDist) {
            minDist = dist;
            nearestTree = p;
        }
    });
    
    if (nearestTree && minDist <= 2.5) {
        const idx = nearestTree.fruitProgress.findIndex(prog => prog >= 1.0);
        if (idx !== -1) {
            nearestTree.fruitProgress[idx] = 0.01; // 再成長へ (極小にして徐々に成長させる)
            playerFruits++;
            fruitCountEl.textContent = playerFruits;
            
            playHarvestSound();
            spawnStarburst(nearestTree.localPos);
            checkVillagerProximity();
            saveGame(false);
        }
    }
}

// プレイヤーによる種・苗採取処理
function collectSeed() {
    const plants = currentPlanet.plants;
    let nearestPlant = null;
    let minDist = 9999;
    
    const playerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    
    plants.forEach(p => {
        if (p.harvestedSeed) return;
        if (p.scale < p.targetScale * 0.95) return; // 未成熟
        
        const plantWorldPos = new THREE.Vector3();
        p.mesh.getWorldPosition(plantWorldPos);
        const dist = playerWorldPos.distanceTo(plantWorldPos);
        
        if (dist < minDist) {
            minDist = dist;
            nearestPlant = p;
        }
    });
    
    if (nearestPlant && minDist <= 2.5) {
        nearestPlant.harvestedSeed = true;
        
        let itemKey = "";
        let itemName = "";
        
        if (nearestPlant.type === 'flower') {
            if (currentPlanet.id === "boreas") {
                itemKey = "ice_flower";
            } else if (currentPlanet.id === "helios") {
                itemKey = "desert_flower";
            } else {
                const sub = nearestPlant.subtype;
                if (sub === 1) itemKey = "lily";
                else if (sub === 2) itemKey = "rose";
                else if (sub === 3) itemKey = "tulip";
                else itemKey = "cosmic";
            }
            playerInventory.flowerSeeds[itemKey]++;
            itemName = seedNames[itemKey];
        } else {
            if (currentPlanet.id === "boreas") {
                itemKey = "ice_tree";
            } else if (currentPlanet.id === "helios") {
                itemKey = "desert_tree";
            } else {
                const sub = nearestPlant.subtype;
                if (sub === 1) itemKey = "berry_tree";
                else itemKey = "cosmic_tree";
            }
            playerInventory.treeSaplings[itemKey]++;
            itemName = seedNames[itemKey];
        }
        
        playHarvestSound();
        spawnStarburst(nearestPlant.localPos);
        showVillagerNotification(`🌾 ${itemName} を採取しました！`);
        updateStatsUI();
        checkVillagerProximity();
        saveGame(false);
    }
}

// プレイヤーから住人への果物プレゼント処理
function presentFruit() {
    if (playerFruits <= 0) return;
    const result = findNearestVillager();
    if (!result || !result.villager) return;
    const v = result.villager;
    if (v.state === "LEAVING") return; 

    playerFruits--;
    fruitCountEl.textContent = playerFruits;
    
    v.happyJumpCount = 3;
    v.bounce = 0.55; 
    v.state = "IDLE";
    v.stateTimer = 4.0;
    
    spawnEmotionIcon(v.group, 'heart');
    spawnStarburst(v.localPos); 
    
    // 大喜びのハートマークをたくさん放出
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            if (v && v.group && v.group.parent) {
                spawnAdorationHeart(v.localPos);
            }
        }, i * 100);
    }
    
    playPresentSound();
    
    // 会話ウィンドウを開いてお礼セリフを表示
    isDialogOpen = true;
    currentSpeakerInstance = v;
    currentSpeaker = v.name;
    dialogSpeakerEl.textContent = currentSpeaker;
    
    btnTalkEl.style.display = "none";
    if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
    btnPresentEl.style.display = "none";
    dialogBoxEl.style.display = "block";
    dialogOptionsEl.style.display = "none";
    isNegotiationActive = false;
    
    // キャラクターごとの大喜びお礼セリフ
    let message = "わぁ、美味しそうな果物！ありがとう！とっても嬉しいな！";
    if (v.id === "cat") message = "ニャ！？美味しそうな果物ニャ！大感謝ニャ、もぐもぐ…美味しいニャ〜！";
    else if (v.id === "rabbit") message = "ピョン！大好物の果物だピョン！嬉しすぎて耳がピコピコ動いちゃうピョン！ありがとう！";
    else if (v.id === "dog") message = "ワンワン！いい匂いの果物だワン！君は最高の友達だワン！ガブッ、うまいワン！";
    else if (v.id === "bear") message = "おお、これは見事な果物クマ！ありがたくいただくクマ！心がポカポカするクマ！";
    
    currentDialogueText = message;
    dialogTipEl.textContent = "画面またはEキーで閉じる";
    
    dialogueTextIndex = 0;
    dialogTextEl.textContent = "";
    streamDialogueText();
    saveGame(false);
}

// 接近判定 (住人、ポータル、収穫可能な木、採取可能な植物)
function checkVillagerProximity() {
    if (isDialogOpen || isWarpMenuOpen || isWarping) {
        btnTalkEl.style.display = "none";
        if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
        btnWarpEl.style.display = "none";
        btnHarvestEl.style.display = "none";
        btnCollectSeedEl.style.display = "none";
        btnPresentEl.style.display = "none";
        return;
    }
    
    // 1. 住人接近およびプレゼント判定
    const result = findNearestVillager();
    if (result && result.dist <= 4.0 && result.villager.state !== "LEAVING") {
        btnTalkEl.style.display = "flex";
        
        // --- ここから追加 ---
        if(worldTalkBubbleEl) {
            worldTalkBubbleEl.style.display = "block";
            const vWorldPos = new THREE.Vector3();
            result.villager.group.getWorldPosition(vWorldPos);
            vWorldPos.add(vWorldPos.clone().normalize().multiplyScalar(1.5));
            vWorldPos.project(camera);
            
            const x = (vWorldPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (vWorldPos.y * -0.5 + 0.5) * window.innerHeight;
            
            worldTalkBubbleEl.style.left = `${x}px`;
            worldTalkBubbleEl.style.top = `${y}px`;
        }
        // --- ここまで追加 ---
        
        // プレイヤーが果物を持っている場合、プレゼントボタンを表示
        if (playerFruits > 0) {
            btnPresentEl.style.display = "flex";
        } else {
            btnPresentEl.style.display = "none";
        }
    } else {
        btnTalkEl.style.display = "none";
        if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = "none";
        btnPresentEl.style.display = "none";
    }
    
    // 2. ポータル接近判定
    const portalWorldPos = new THREE.Vector3();
    warpPortalGroup.getWorldPosition(portalWorldPos);
    const playerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    const distToPortal = playerWorldPos.distanceTo(portalWorldPos);

    if (warpPortalGroup.visible) {
        // ポータルに近づいたらビーコンを自動非表示（ガイドON時のみ）
        if (portalBeacon && isGuideActive) {
            portalBeacon.visible = distToPortal >= 10.0;
        }
        
        if (distToPortal <= 4.2) {
            btnWarpEl.style.display = "flex";
        } else {
            btnWarpEl.style.display = "none";
        }
    } else {
        if (portalBeacon) portalBeacon.visible = false;
        btnWarpEl.style.display = "none";
    }
    
    // 3. 収穫可能な木への接近判定
    let nearestTreeDist = 9999;
    
    currentPlanet.plants.forEach(p => {
        if (p.type !== 'tree') return;
        if (!p.fruitProgress || !p.fruitProgress.some(prog => prog >= 1.0)) return;
        
        const treeWorldPos = new THREE.Vector3();
        p.mesh.getWorldPosition(treeWorldPos);
        const dist = playerWorldPos.distanceTo(treeWorldPos);
        
        if (dist < nearestTreeDist) {
            nearestTreeDist = dist;
        }
    });
    
    if (nearestTreeDist <= 2.5) {
        btnHarvestEl.style.display = "flex";
    } else {
        btnHarvestEl.style.display = "none";
    }

    // 4. 採取可能な植物（成熟していて未採取）への接近判定
    let nearestSeedDist = 9999;
    currentPlanet.plants.forEach(p => {
        if (p.harvestedSeed) return;
        if (p.scale < p.targetScale * 0.95) return; // 未成熟
        
        const plantWorldPos = new THREE.Vector3();
        p.mesh.getWorldPosition(plantWorldPos);
        const dist = playerWorldPos.distanceTo(plantWorldPos);
        
        if (dist < nearestSeedDist) {
            nearestSeedDist = dist;
        }
    });
    
    if (nearestSeedDist <= 2.5) {
        btnCollectSeedEl.style.display = "flex";
    } else {
        btnCollectSeedEl.style.display = "none";
    }
}

// ==========================================
// 宇宙ワープポータル メニューUIの制御
// ==========================================
function openWarpMenu() {
    if (isDialogOpen || isWarpMenuOpen || isWarping) return;

    isWarpMenuOpen = true;
    checkVillagerProximity();

    document.querySelectorAll('.planet-card').forEach(card => card.classList.remove('active'));
    document.getElementById(`card-${currentPlanet.id}`).classList.add('active');

    statArtemisPlantsEl.textContent = planetsData.artemis.plants.length;
    statBoreasPlantsEl.textContent = planetsData.boreas.plants.length;
    statHeliosPlantsEl.textContent = planetsData.helios.plants.length;

    // 各惑星の住民数を表示
    const settled = (pd) => pd.activeVillagers.filter(v => v.settled).length;
    const statArtVil = document.getElementById('stat-artemis-villagers');
    const statBorVil = document.getElementById('stat-boreas-villagers');
    const statHelVil = document.getElementById('stat-helios-villagers');
    if (statArtVil) statArtVil.textContent = settled(planetsData.artemis);
    if (statBorVil) statBorVil.textContent = settled(planetsData.boreas);
    if (statHelVil) statHelVil.textContent = settled(planetsData.helios);

    warpModalEl.style.display = "block";
}

function closeWarpMenu() {
    if (!isWarpMenuOpen) return;
    isWarpMenuOpen = false;
    warpModalEl.style.display = "none";
    checkVillagerProximity();
}

// 惑星間ワープ実行処理
function executeWarp(targetPlanetId) {
    if (targetPlanetId === currentPlanet.id || isWarping) return;
    
    saveGame(false); // ワープ直前にセーブ
    
    isWarping = true;
    closeWarpMenu();

    
    warpLoadingTextEl.textContent = `${planetsData[targetPlanetId].name} 小惑星へワープ軌道計算中...`;
    warpOverlayEl.style.display = "flex";
    
    playWarpSound();
    
    setTimeout(() => {
        // --- 1. 現惑星の3Dモデルシーンのクリーンアップ ---
        clearPlanetStructures();
        
        // 植栽ライトの削除
        currentPlanet.plants.forEach(p => {
            if (p.light) {
                asteroid.remove(p.light);
                p.light = null;
            }
        });
        activePlantLights.length = 0;
        
        // 植物メッシュを小惑星から削除 (データ構造は planetsData で維持)
        currentPlanet.plants.forEach(p => {
            asteroid.remove(p.mesh);
        });
        
        // 住人メッシュを小惑星から削除
        currentPlanet.activeVillagers.forEach(v => {
            asteroid.remove(v.group);
            if (v.rocketInstance) {
                asteroid.remove(v.rocketInstance.mesh);
            }
            if (v.mutationButton) {
                asteroid.remove(v.mutationButton);
                v.mutationButton.traverse(obj => {
                    if (obj.isMesh) {
                        obj.geometry.dispose();
                        obj.material.dispose();
                    }
                });
            }
            v.group.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                }
            });
        });

        // v50: 家メッシュを小惑星から削除
        if (currentPlanet.houses) {
            currentPlanet.houses.forEach(h => {
                if (h.mesh) {
                    asteroid.remove(h.mesh);
                    h.mesh.traverse(obj => {
                        if (obj.isMesh) {
                            obj.geometry.dispose();
                            obj.material.dispose();
                        }
                    });
                }
            });
        }
        
        // 草のクリーンアップ
        grassClumps.forEach(gc => {
            asteroid.remove(gc.mesh);
            gc.mesh.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                }
            });
        });
        grassClumps.length = 0;
        
        // --- 2. 惑星データを切り替え ---
        currentPlanet = planetsData[targetPlanetId];
        
        // --- 3. 環境アセットの再生成 ---
        
        const newTexture = createDirtTexture(currentPlanet);
        asteroid.material.map.dispose();
        asteroid.material.map = newTexture;
        asteroid.material.needsUpdate = true;
        
        scene.background.setHex(currentPlanet.bgColor);
        scene.fog.color.setHex(currentPlanet.fogColor);
        scene.fog.density = currentPlanet.fogDensity;
        baseFogDensity = currentPlanet.fogDensity;
        
        sunLight.color.setHex(currentPlanet.id === "boreas" ? 0xe0f7ff : (currentPlanet.id === "helios" ? 0xfff3d1 : 0xfff8ea));
        fillLight.color.setHex(currentPlanet.id === "boreas" ? 0x00bfff : (currentPlanet.id === "helios" ? 0xffaa00 : 0x7585ff));
        
        // 草の再生成
        if (!currentPlanet.grownGrassIndices) {
            currentPlanet.grownGrassIndices = new Set();
        }
        const grassCount = 2600;
        for (let i = 0; i < grassCount; i++) {
            const grass = createGrassClump(currentPlanet);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = ASTEROID_RADIUS * Math.sin(phi) * Math.cos(theta);
            const y = ASTEROID_RADIUS * Math.sin(phi) * Math.sin(theta);
            const z = ASTEROID_RADIUS * Math.cos(phi);
            
            const pos = new THREE.Vector3(x, y, z);
            grass.position.copy(pos);
            const normal = pos.clone().normalize();
            grass.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            
            const baseScale = 0.85 + Math.random() * 0.5;
            const isGrown = currentPlanet.grownGrassIndices.has(i);
            const startScale = isGrown ? baseScale : 0.0;
            grass.scale.set(startScale, startScale, startScale);
            asteroid.add(grass);

            grassClumps.push({
                mesh: grass,
                scale: startScale,
                targetScale: startScale,
                baseScale: baseScale,
                age: Math.random() * 100
            });
        }
        
        // ポータルのエネルギーコアカラーを惑星に合わせて変更
        const portalRing = warpPortalGroup.getObjectByName("coreRing");
        if (portalRing) {
            portalRing.material.color.setHex(currentPlanet.id === "boreas" ? 0x00f0ff : (currentPlanet.id === "helios" ? 0xffd166 : 0xff5c8a));
            portalRing.material.emissive.setHex(currentPlanet.id === "boreas" ? 0x00bfff : (currentPlanet.id === "helios" ? 0xffaa00 : 0xff5c8a));
        }
        
        spawnPlanetStructures();
        
        // --- 4. 復元処理 ---
        
        // 植物の3Dモデル再配置
        currentPlanet.plants.forEach(p => {
            const visualGroup = new THREE.Group();
            p.mesh.clear(); 
            p.mesh.add(visualGroup);
            
            if (p.type === 'flower') {
                if (currentPlanet.id === "boreas") {
                    buildIceFlower(visualGroup);
                } else if (currentPlanet.id === "helios") {
                    buildDesertFlower(visualGroup);
                } else {
                    if (p.subtype === 1) {
                        buildStarlightLily(visualGroup);
                    } else if (p.subtype === 2) {
                        buildLunaRose(visualGroup);
                    } else if (p.subtype === 3) {
                        buildAuroraTulip(visualGroup);
                    } else {
                        buildCosmicFlower(visualGroup);
                    }
                }
            } else {
                if (currentPlanet.id === "boreas") {
                    buildIceTree(visualGroup);
                } else if (currentPlanet.id === "helios") {
                    buildDesertTree(visualGroup);
                } else {
                    const randVal = Math.random();
                    if (randVal < 0.5) buildCosmicTree(visualGroup);
                    else buildBerryTree(visualGroup);
                }
            }
            
            p.scale = 0.01;
            p.mesh.scale.set(0.01, 0.01, 0.01);
            
            // 各惑星の木の果実の結実状態 (fruitProgress) を3Dモデルに再適用
            if (p.type === 'tree') {
                const fruitMeshes = [];
                p.mesh.traverse(obj => {
                    if (obj.isMesh && obj.name === "fruit") {
                        fruitMeshes.push(obj);
                    }
                });
                
                if (!p.fruitProgress) {
                    p.fruitProgress = new Array(fruitMeshes.length).fill(1.0);
                }
                
                fruitMeshes.forEach(fruit => {
                    const idx = fruit.userData.fruitIndex ?? 0;
                    const progress = p.fruitProgress[idx] ?? 1.0;
                    const baseScale = fruit.userData.baseScale ?? 1.0;
                    
                    if (fruit.material && !fruit.userData.materialCloned) {
                        fruit.material = fruit.material.clone();
                        fruit.userData.materialCloned = true;
                        fruit.userData.originalEmissiveIntensity = fruit.material.emissiveIntensity ?? 1.0;
                    }

                    // 成長スケールで常に描写する
                    fruit.scale.setScalar(baseScale * progress);
                    fruit.visible = (progress > 0.08);

                    if (progress >= 1.0) {
                        // 完熟時は少し大きく強調し、輝かせる
                        fruit.scale.setScalar(baseScale * 1.25);
                        if (fruit.material) {
                            fruit.material.emissiveIntensity = fruit.userData.originalEmissiveIntensity * 1.5;
                        }
                    } else {
                        // 成長中は光らせない
                        if (fruit.material) {
                            fruit.material.emissiveIntensity = 0.0;
                        }
                    }
                });
            }
            
            asteroid.add(p.mesh);
            addPlantLight(p);
        });
        
        // v50: 家の3Dモデル再配置
        if (currentPlanet.houses) {
            currentPlanet.houses.forEach(h => {
                const houseMesh = buildHouse(h.style);
                houseMesh.position.copy(h.localPos);
                houseMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.normal);
                h.mesh = houseMesh;
                asteroid.add(houseMesh);
            });
        }
        
        // 住人の3Dモデル再配置
        currentPlanet.activeVillagers.forEach(v => {
            const { group, visualGroup, beacon } = createVillagerMesh(v.typeData);
            
            group.position.copy(v.localPos);
            const normal = v.localPos.clone().normalize();
            group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            
            v.group = group;
            v.visualGroup = visualGroup;
            v.beacon = beacon;
            v.beacon.visible = isGuideActive;
            v.beacon.material.opacity = isGuideActive ? 0.35 : 0;
            
            asteroid.add(group);
            
            if (v.rocketInstance) {
                const rocketMesh = buildRocket(v.rocketStyle !== undefined ? v.rocketStyle : 0);
                rocketMesh.position.copy(v.rocketInstance.baseLocalPos).addScaledVector(v.rocketInstance.normal, v.rocketInstance.height);
                const rNormal = v.rocketInstance.baseLocalPos.clone().normalize();
                rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rNormal);
                
                v.rocketInstance.mesh = rocketMesh;
                asteroid.add(rocketMesh);
            }
        });
        
        // --- 5. プレイヤーの位置補正とカメラ引き効果 ---
        asteroid.quaternion.set(0, 0, 0, 1);
        const qReset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 3);
        asteroid.quaternion.premultiply(qReset);
        
        playerHeight = 30.0;
        playerJumpVel = -18.0;
        isJumping = true;
        
        currentPlanetNameEl.textContent = currentPlanet.name;
        currentPlanetClimateEl.textContent = currentPlanet.climate;
        updateStatsUI();
        fruitCountEl.textContent = playerFruits; 
        
        updatePlanetEnvironment();
        updateBGMPlanet();
        
        // v35: 新しい惑星の宇宙アセットを生成
        createLookUpAssets();
        
        camera.position.set(0, ASTEROID_RADIUS + 30, 45);
        
        setTimeout(() => {
            warpOverlayEl.style.display = "none";
            isWarping = false;
            updatePortalVisibility(false);
            checkVillagerProximity();
            saveGame(false); // ワープ完了後にオートセーブ
        }, 800);

        
    }, 1500);
}

// ユーザーキー入力制御
window.addEventListener('keydown', (e) => {
    if (e.key === 'v' || e.key === 'V') {
        if (!isWarping && !isDialogOpen && !isArrivalDialogueShowing && !isWarpMenuOpen && !isTutorialShowing) {
            toggleLookUpMode();
        }
        return;
    }
    if (isTutorialShowing) {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
            advanceTutorialDialogue();
            return;
        }
        
        const isMoveKey = ['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D', 'ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S'].includes(e.key);
        const isInteractivePhase = (tutorialDialogIndex === 1 || tutorialDialogIndex === 2 || tutorialDialogIndex === 3);
        if (isInteractivePhase && isMoveKey) {
            // 移動キーを許可
        } else if (tutorialDialogIndex === 1 && (e.key === 'r' || e.key === 'R')) {
            // 花フェーズでRキーを許可
        } else if (tutorialDialogIndex === 2 && (e.key === 't' || e.key === 'T')) {
            // 木フェーズでTキーを許可
        } else if (tutorialDialogIndex === 3 && (e.key === ' ' || e.key === 'Spacebar' || e.key === 'r' || e.key === 'R' || e.key === 't' || e.key === 'T')) {
            // 草フェーズでジャンプとタネ発射を許可
        } else {
            return; // それ以外のキーはすべて無効化
        }
    }
    if (isIntroDialogShowing) {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
            advanceIntroDialogue();
            return;
        }
    }
    if (isArrivalDialogueShowing) {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
            closeArrivalDialogueDirectly();
            return;
        }
    }
    if (isDialogOpen) {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
            closeDialogue();
        }
        return;
    }
    if (isWarpMenuOpen) {
        if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
            closeWarpMenu();
        }
        return;
    }
    
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
    
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // スクロールおよびフォーカスされたボタンの誤トリガーを防止
        if (!isWarping) {
            if (!isJumping) {
                // 地上からジャンプ開始
                isJumping = true;
                playerJumpVel = currentPlanet.jumpForce !== undefined ? currentPlanet.jumpForce : 20.1;
                playJumpSound();
            }
            keys.space = true;
        }
    }
    
    if (e.key === 'r' || e.key === 'R') {
        if (!keys.r && !isWarping && !isPlanting) {
            keys.r = true;
            if (isJumping) {
                shootGrassSeed();
            } else {
                startPlanting('flower');
            }
        }
    }
    
    if (e.key === 't' || e.key === 'T') {
        if (!keys.t && !isWarping && !isPlanting) {
            keys.t = true;
            if (isJumping) {
                shootGrassSeed();
            } else {
                startPlanting('tree');
            }
        }
    }
    
    if (e.key === 'e' || e.key === 'E') {
        if (!keys.e && !isWarping) {
            keys.e = true;
            
            // 収穫、採取、話す、ポータル起動の優先順位
            if (btnHarvestEl.style.display === "flex") {
                harvestFruit();
            } else if (btnCollectSeedEl.style.display === "flex") {
                collectSeed();
            } else if (btnTalkEl.style.display === "flex") {
                startDialogue();
            } else if (btnWarpEl.style.display === "flex") {
                openWarpMenu();
            }
        }
    }

    if (e.key === 'f' || e.key === 'F') {
        if (!keys.f && !isWarping) {
            keys.f = true;
            if (btnPresentEl.style.display === "flex") {
                presentFruit();
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
    if (e.key === ' ' || e.key === 'Spacebar') {
        keys.space = false;
        if (isJumping && playerJumpVel > 0) {
            playerJumpVel *= 0.35;
        }
    }
    if (e.key === 'r' || e.key === 'R') keys.r = false;
    if (e.key === 't' || e.key === 'T') keys.t = false;
    if (e.key === 'e' || e.key === 'E') keys.e = false;
    if (e.key === 'f' || e.key === 'F') keys.f = false;
});

// 🔭 見上げるボタンのクリック
if (btnLookupEl) {
    btnLookupEl.addEventListener('click', (e) => {
        e.stopPropagation();
        btnLookupEl.blur(); // ボタンからフォーカスを外してSpaceキーでの誤爆を防止
        if (!isWarping && !isDialogOpen && !isArrivalDialogueShowing && !isWarpMenuOpen) {
            toggleLookUpMode();
        }
    });
}

// マウス移動（ホバー用座標更新）
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ポータルワープメニューイベントリスナー
btnWarpCloseEl.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWarpMenu();
});
cardArtemisEl.addEventListener('click', (e) => {
    e.stopPropagation();
    executeWarp("artemis");
});
cardBoreasEl.addEventListener('click', (e) => {
    e.stopPropagation();
    executeWarp("boreas");
});
cardHeliosEl.addEventListener('click', (e) => {
    e.stopPropagation();
    executeWarp("helios");
});

// 収穫・プレゼント用のアクションボタン連携
btnPlantFlowerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isTutorialShowing) {
        if (tutorialDialogIndex !== 1 && tutorialDialogIndex !== 3) return;
    }
    if (isJumping) {
        shootGrassSeed();
    } else if (!isPlanting) {
        startPlanting('flower');
    }
});
btnPlantTreeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isTutorialShowing) {
        if (tutorialDialogIndex !== 2 && tutorialDialogIndex !== 3) return;
    }
    if (isJumping) {
        shootGrassSeed();
    } else if (!isPlanting) {
        startPlanting('tree');
    }
});
btnCollectSeedEl.addEventListener('click', (e) => {
    e.stopPropagation();
    collectSeed();
});

// 最も近くにある「実っている木」を検索するヘルパー関数
function findNearestFruitingTree(localPos) {
    const plants = currentPlanet.plants;
    let nearest = null;
    let minDist = 9999;
    
    plants.forEach(p => {
        if (p.type !== 'tree') return;
        if (!p.fruitProgress || !p.fruitProgress.some(prog => prog >= 1.0)) return;
        
        const dist = localPos.distanceTo(p.localPos);
        if (dist < minDist) {
            minDist = dist;
            nearest = p;
        }
    });
    
    return nearest;
}

// 住人の食事もぐもぐクズエフェクトの発生
function spawnEatParticles(localPos, normal) {
    const geom = new THREE.SphereGeometry(0.04, 4, 4);
    const colors = [0xffffff, 0xffa500, 0xff3300, 0x00f0ff, 0xffd166];
    
    const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    
    // 口元付近 (頭の下あたり) に配置
    mesh.position.copy(localPos).addScaledVector(normal, 0.62);
    asteroid.add(mesh);
    
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.2 + Math.random() * 0.35;
    const vel = new THREE.Vector3()
        .addScaledVector(right, Math.cos(angle) * spread)
        .addScaledVector(forward, Math.sin(angle) * spread)
        .addScaledVector(normal, -0.15) 
        .normalize().multiplyScalar(0.7 + Math.random() * 0.9);
        
    activeParticles.push({
        mesh: mesh,
        dir: vel,
        speed: 1.1,
        age: 0,
        maxAge: 0.45 + Math.random() * 0.2,
        spiralRadius: 0,
        angle: 0,
        rotSpeed: 0
    });
}

// ==========================================
// 植えられた「木」の果実の時間経過による成長・結実更新ループ
// ==========================================
function updateFruits(delta) {
    const plants = currentPlanet.plants;
    plants.forEach(p => {
        if (p.type !== 'tree') return;
        
        const fruitMeshes = [];
        p.mesh.traverse(obj => {
            if (obj.isMesh && obj.name === "fruit") {
                fruitMeshes.push(obj);
            }
        });
        
        if (!p.fruitProgress) {
            p.fruitProgress = new Array(fruitMeshes.length).fill(1.0);
        }
        
        fruitMeshes.forEach(fruit => {
            const idx = fruit.userData.fruitIndex ?? 0;
            let progress = p.fruitProgress[idx] ?? 0.0;
            const baseScale = fruit.userData.baseScale ?? 1.0;
            
            if (progress < 1.0) {
                // 25秒で完熟 (成長)
                progress += delta / 25.0; 
                if (progress > 1.0) progress = 1.0;
                p.fruitProgress[idx] = progress;
            }
            
            if (fruit.material && !fruit.userData.materialCloned) {
                fruit.material = fruit.material.clone();
                fruit.userData.materialCloned = true;
                fruit.userData.originalEmissiveIntensity = fruit.material.emissiveIntensity ?? 1.0;
            }

            // 成長スケールで常に描写する
            fruit.scale.setScalar(baseScale * progress);
            fruit.visible = (progress > 0.08);

            if (progress >= 1.0) {
                // 完熟時は少し大きく強調し、輝かせる
                fruit.scale.setScalar(baseScale * 1.25);
                if (fruit.material) {
                    // 完熟時は本来の輝きをもとにゆっくりパルス明滅させる
                    const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.3;
                    fruit.material.emissiveIntensity = fruit.userData.originalEmissiveIntensity * pulse;
                }
            } else {
                // 成長中は光らせない
                if (fruit.material) {
                    fruit.material.emissiveIntensity = 0.0;
                }
            }
        });
    });
}

let revisitorSpawnTimer = 30.0 + Math.random() * 30.0;

function updateRevisitorSpawn(delta) {
    if (!gameStarted) return;
    if (revisitorSpawnTimer === undefined) {
        revisitorSpawnTimer = 30.0 + Math.random() * 30.0;
    }
    revisitorSpawnTimer -= delta;
    if (revisitorSpawnTimer <= 0) {
        revisitorSpawnTimer = 40.0 + Math.random() * 40.0; // 40〜80秒間隔
        
        if (!currentPlanet.unlockedVillagerIds) {
            currentPlanet.unlockedVillagerIds = [];
        }
        const activeV = currentPlanet.activeVillagers || [];
        
        // 同時にこの惑星に存在できる「非定住」の住人が多すぎないようにする（例えば、非定住が現在1人以上の時はスポーンしない）
        const nonSettledActive = activeV.filter(v => !v.settled && v.state !== "LEAVING" && v.state !== "LEAVING_PENDING");
        if (nonSettledActive.length >= 1) {
            return;
        }
        
        const activeIds = activeV.map(v => v.id);
        const inactiveUnlockedIds = currentPlanet.unlockedVillagerIds.filter(id => !activeIds.includes(id));
        
        if (inactiveUnlockedIds.length > 0) {
            if (Math.random() < 0.5) { // 50%確率で出現
                const randId = inactiveUnlockedIds[Math.floor(Math.random() * inactiveUnlockedIds.length)];
                const typeData = villagerTypes.find(t => t.id === randId);
                if (typeData) {
                    spawnVillager(typeData, null, true);
                }
            }
        }
    }
}

function updateVillagers(delta) {
    const playerWorldPos = new THREE.Vector3();
    player.getWorldPosition(playerWorldPos);
    
    const villagers = currentPlanet.activeVillagers;
    const plants = currentPlanet.plants;

    for (let idx = villagers.length - 1; idx >= 0; idx--) {
        const v = villagers[idx];
        v.age += delta;

        const vWorldPos = new THREE.Vector3();
        v.group.getWorldPosition(vWorldPos);
        const distToPlayer = playerWorldPos.distanceTo(vWorldPos);

        // 1. 会話中の住人の処理
        if (isDialogOpen && currentSpeakerInstance === v) {
            faceVillagerToPlayer(v);
            
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            v.visualGroup.scale.y = 1.0 + Math.sin(v.age * 2.0) * 0.015;
            
            if (v.bounce > 0.005) {
                v.visualGroup.position.y += v.bounce;
                v.bounce *= 0.82;
            }
            continue;
        }

        // 2. 空腹度タイマーの更新と食事AIのトリガー
        const canGetHungry = (v.state !== "LEAVING" && v.state !== "LEAVING_PENDING" && 
                              v.state !== "GO_TO_ROCKET" && v.state !== "APPROACH_BUTTON" && 
                              v.state !== "PRESS_BUTTON" && v.state !== "HOUSE_MUTATION" &&
                              !v.happyJumpCount && (!isDialogOpen || currentSpeakerInstance !== v));
        if (canGetHungry) {
            if (v.hungerTimer === undefined) {
                v.hungerTimer = 20.0 + Math.random() * 20.0;
            }
            v.hungerTimer -= delta;
            
            if (v.hungerTimer <= 0 && v.state !== "WANDERING_TO_EAT" && v.state !== "EATING" && v.state !== "APPROACH_PLAYER") {
                const fruitTree = findNearestFruitingTree(v.localPos);
                if (fruitTree) {
                    v.state = "WANDERING_TO_EAT";
                    v.targetPlant = fruitTree;
                    
                    const pLocalPos = fruitTree.localPos;
                    const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(fruitTree.mesh.quaternion);
                    const angle = Math.random() * Math.PI * 2;
                    v.targetPos.copy(pLocalPos)
                        .addScaledVector(tangent.clone().applyAxisAngle(pLocalPos.clone().normalize(), angle), 1.15);
                    v.targetPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                    
                    v.stateTimer = 15.0; // タイムアウト
                    spawnEmotionIcon(v.group, 'notice');
                } else {
                    // 実った木がない場合は数秒後に再スキャン
                    v.hungerTimer = 6.0 + Math.random() * 4.0;
                }
            }
        }

        // 2.5. 未定住の住人の自動旅立ちタイマー
        const canAutoLeave = !v.settled && v.state !== "LEAVING" && v.state !== "LEAVING_PENDING" && v.state !== "ARRIVING";
        if (canAutoLeave) {
            if (v.stayTimer === undefined) {
                v.stayTimer = 180.0 + Math.random() * 180.0;
                v.warningShown = false;
            }
            v.stayTimer -= delta;
            
            // 1分前警告
            if (!v.warningShown && v.stayTimer <= 60.0 && v.stayTimer > 0) {
                v.warningShown = true;
                const msg = `🚀 「${v.name}」が1分後にほかの星へ旅立ちます！`;
                showVillagerNotification(msg, v, 8000);
            }
            
            // タイマー切れ → 旅立ち開始
            if (v.stayTimer <= 0) {
                v.state = "LEAVING_PENDING";
                v.leavingTimer = 0; // 即時旅立ち
            }
        }
        
        // 3. 旅立ち猶予状態のタイマーカウントダウン
        if (v.state === "LEAVING_PENDING") {
            v.leavingTimer -= delta;
            if (v.leavingTimer <= 0) {
                v.leavingTimer = 0;
                v.state = "LEAVING";
                
                // すでにロケットが存在しているはずなので、それを使う。
                // 万が一ロケットが無い場合のみ新規作成する。
                if (!v.rocketInstance) {
                    if (v.rocketStyle === undefined) {
                        v.rocketStyle = Math.floor(Math.random() * 5);
                    }
                    const rocketMesh = buildRocket(v.rocketStyle);
                    let rPosLocal = null;
                    for (let attempt = 0; attempt < 100; attempt++) {
                        const angleOffset = Math.random() * Math.PI * 2;
                        const distOffset = 5.0; // 巨大化したため、距離を増やす (元は 2.4)
                        const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(v.group.quaternion);
                        const bitangent = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                        
                        const candPos = v.localPos.clone()
                            .addScaledVector(tangent, Math.cos(angleOffset) * distOffset)
                            .addScaledVector(bitangent, Math.sin(angleOffset) * distOffset)
                            .normalize().multiplyScalar(ASTEROID_RADIUS);
                        
                        let tooClose = false;
                        if (currentPlanet.plants) {
                            for (const p of currentPlanet.plants) {
                                if (p.localPos && candPos.distanceTo(p.localPos) < 4.0) {
                                    tooClose = true;
                                    break;
                                }
                            }
                        }
                        if (!tooClose) {
                            rPosLocal = candPos;
                            break;
                        }
                    }
                    if (!rPosLocal) {
                        const angleOffset = Math.random() * Math.PI * 2;
                        const distOffset = 5.0;
                        const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(v.group.quaternion);
                        const bitangent = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                        rPosLocal = v.localPos.clone()
                            .addScaledVector(tangent, Math.cos(angleOffset) * distOffset)
                            .addScaledVector(bitangent, Math.sin(angleOffset) * distOffset)
                            .normalize().multiplyScalar(ASTEROID_RADIUS);
                    }
                    
                    rocketMesh.position.copy(rPosLocal);
                    const rNormal = rPosLocal.clone().normalize();
                    rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rNormal);
                    rocketMesh.position.addScaledVector(rNormal, 20); 
                    
                    asteroid.add(rocketMesh);
                    playRocketEngineSound(2.2);
                    
                    v.rocketInstance = {
                        mesh: rocketMesh,
                        baseLocalPos: rPosLocal,
                        normal: rNormal,
                        height: 20.0,
                        targetHeight: 0.0,
                        phase: "DESCENDING", 
                        timer: 0.0,
                        style: v.rocketStyle
                    };
                } else {
                    // すでにロケットがある場合は、その場に残っているはず。
                    // フェーズを WAITING (搭乗待ち) に変更し、住人はそこへ歩き出す。
                    const rocket = v.rocketInstance;
                    rocket.phase = "WAITING";
                    rocket.timer = 0;
                    rocket.height = 0; // 地上にあることを保証
                    rocket.mesh.position.copy(rocket.baseLocalPos);
                    v.targetPos.copy(rocket.baseLocalPos);
                }
                v.stateTimer = 0; 
            }
        }

        // 3.5. ロケット来星フェーズ処理
        if (v.state === "ARRIVING" && v.rocketInstance) {
            const rocket = v.rocketInstance;
            
            if (rocket.phase === "DESCENDING") {
                rocket.height += (rocket.targetHeight - rocket.height) * 0.06;
                rocket.mesh.position.copy(rocket.baseLocalPos).addScaledVector(rocket.normal, rocket.height);
                
                if (Math.random() < 0.5) {
                    spawnRocketExhaust(rocket.mesh.position, rocket.normal);
                }
                
                if (Math.abs(rocket.height) < 0.05) {
                    rocket.height = 0;
                    rocket.mesh.position.copy(rocket.baseLocalPos);
                    rocket.phase = "WAITING";
                    rocket.timer = 1.0; // 着陸後の余韻タイマー
                    
                    spawnStarburst(rocket.baseLocalPos); // 着陸エフェクト
                    playLandSound();
                }
                
                v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
                v.visualGroup.scale.y = 1.0 + Math.sin(v.age * 2.0) * 0.015;
                continue;
            }
            
            if (rocket.phase === "WAITING") {
                if (rocket.timer > 0) {
                    rocket.timer -= delta;
                    if (rocket.timer <= 0) {
                        // 住人を表示させ、降車を開始
                        v.group.visible = true;
                        
                        // 降車目標位置（ロケットの手前）を設定
                        const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(v.group.quaternion);
                        v.targetPos.copy(rocket.baseLocalPos).addScaledVector(tangent, 3.5); // 巨大化に伴い1.5から3.5に変更してめり込み防止
                        v.targetPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                        
                        // 住人の現在位置をロケットの底に設定
                        v.localPos.copy(rocket.baseLocalPos);
                        v.group.position.copy(v.localPos);
                        
                        playVillagerSpawnSound();
                        spawnStardust(v.localPos);
                    }
                } else {
                    // 住人が降車地点に向かって歩く
                    const toTarget = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
                    const dist = toTarget.length();
                    
                    if (dist > 0.15) {
                        const speed = 1.25;
                        const dir = toTarget.clone().normalize();
                        v.localPos.addScaledVector(dir, speed * delta);
                        v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                        
                        v.group.position.copy(v.localPos);
                        const normal = v.localPos.clone().normalize();
                        v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                        
                        v.walkCycle += delta * 12;
                        v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                        v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                        
                        const flatDir = toTarget.clone().projectOnPlane(normal).normalize();
                        const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                        let angle = localForward.angleTo(flatDir);
                        const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                        if (cross.dot(normal) < 0) angle = -angle;
                        v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.12;
                    } else {
                        // 降車完了。ジャンプして喜ぶ
                        v.group.getObjectByName("leftLeg").rotation.x = 0;
                        v.group.getObjectByName("rightLeg").rotation.x = 0;
                        
                        v.bounce = 0.55;
                        v.happyJumpCount = 2;
                        spawnStarburst(v.localPos);
                        
                        // アナウンスメッセージを表示（プレイヤーは動ける！）
                        showArrivalDialogue(v.typeData, v);
                        
                        // 【変更】ロケットは上昇させず、その場に残す
                        rocket.phase = "STATIONARY";
                        rocket.height = 0;
                        rocket.mesh.position.copy(rocket.baseLocalPos);
                        
                        // 住人はIDLE状態に遷移し、ビーコンを表示
                        v.state = "IDLE";
                        v.stateTimer = 2.0;
                        if (isGuideActive) {
                            v.beacon.visible = true;
                        }
                        checkVillagerProximity();
                    }
                }
                v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
                continue;
            }
            
            if (rocket.phase === "ASCENDING") {
                if (rocket.timer > 0) {
                    rocket.timer -= delta;
                } else {
                    rocket.height += (rocket.targetHeight - rocket.height) * 0.08;
                    rocket.mesh.position.copy(rocket.baseLocalPos).addScaledVector(rocket.normal, rocket.height);
                    
                    if (Math.random() < 0.7) {
                        spawnRocketExhaust(rocket.mesh.position, rocket.normal);
                    }
                    
                    if (rocket.height >= 22.0) {
                        // ロケット去り完了、アセット削除
                        asteroid.remove(rocket.mesh);
                        rocket.mesh.geometry?.dispose();
                        rocket.mesh.traverse(obj => {
                            if (obj.isMesh) {
                                obj.geometry.dispose();
                                obj.material.dispose();
                            }
                        });
                        
                        v.rocketInstance = null;
                        v.state = "IDLE";
                        v.stateTimer = 2.0;
                        if (isGuideActive) {
                            v.beacon.visible = true;
                        }
                        checkVillagerProximity();
                    }
                }
                v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
                continue;
            }
        }

        // 4. ロケット旅立ちフェーズ処理
        if (v.state === "LEAVING" && v.rocketInstance) {
            const rocket = v.rocketInstance;
            
            if (rocket.phase === "DESCENDING") {
                rocket.height += (rocket.targetHeight - rocket.height) * 0.06;
                rocket.mesh.position.copy(rocket.baseLocalPos).addScaledVector(rocket.normal, rocket.height);
                
                if (Math.random() < 0.5) {
                    spawnRocketExhaust(rocket.mesh.position, rocket.normal);
                }
                
                if (Math.abs(rocket.height) < 0.05) {
                    rocket.height = 0;
                    rocket.mesh.position.copy(rocket.baseLocalPos);
                    rocket.phase = "WAITING";
                    v.targetPos.copy(rocket.baseLocalPos);
                }
                
                v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
                v.visualGroup.scale.y = 1.0 + Math.sin(v.age * 2.0) * 0.015;
                continue;
            }
            
            if (rocket.phase === "WAITING") {
                const toRocket = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
                const distToRocket = toRocket.length();
                
                if (distToRocket > 0.4) {
                    const speed = 1.3;
                    const dir = toRocket.clone().normalize();
                    v.localPos.addScaledVector(dir, speed * delta);
                    v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                    
                    v.group.position.copy(v.localPos);
                    const normal = v.localPos.clone().normalize();
                    v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                    
                    v.walkCycle += delta * 12;
                    v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                    v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                    
                    const flatDir = toRocket.clone().projectOnPlane(normal).normalize();
                    const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                    let angle = localForward.angleTo(flatDir);
                    const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                    if (cross.dot(normal) < 0) angle = -angle;
                    v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.12;
                } else {
                    v.group.visible = false;
                    v.beacon.visible = false;
                    
                    rocket.phase = "ASCENDING";
                    rocket.targetHeight = 25.0; 
                    rocket.timer = 0.5; 
                    playRocketEngineSound(2.5);
                }
                
                v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
                continue;
            }
            
            if (rocket.phase === "ASCENDING") {
                if (rocket.timer > 0) {
                    rocket.timer -= delta;
                } else {
                    rocket.height += (rocket.targetHeight - rocket.height) * 0.08;
                    rocket.mesh.position.copy(rocket.baseLocalPos).addScaledVector(rocket.normal, rocket.height);
                    
                    if (Math.random() < 0.7) {
                        spawnRocketExhaust(rocket.mesh.position, rocket.normal);
                    }
                    
                    if (rocket.height >= 22.0) {
                        // 旅立ち完了通知
                        const departMsg = `🚀 「${v.name}」がほかの星へ旅立ちました。`;
                        showVillagerNotification(departMsg, null, 6000);
                        
                        asteroid.remove(rocket.mesh);
                        asteroid.remove(v.group);
                        villagers.splice(idx, 1);
                        checkVillagerProximity();
                        updatePlanetEnvironment();
                    }
                }
                continue;
            }
        }

        // 連続祝福ジャンプの処理 (Yes選択時 & プレゼント時共通)
        if (v.happyJumpCount && v.happyJumpCount > 0) {
            if (v.bounce <= 0.01) {
                v.bounce = 0.55;
                v.happyJumpCount--;
                spawnStarburst(v.localPos);
                playJumpSound();
            }
        }

        // 5. プレイヤー接近による追従AI
        const canFollow = (v.state !== "LEAVING" && v.state !== "LEAVING_PENDING" && 
                           v.state !== "GO_TO_ROCKET" && v.state !== "APPROACH_BUTTON" && 
                           v.state !== "PRESS_BUTTON" && v.state !== "HOUSE_MUTATION" &&
                           v.state !== "WANDERING_TO_EAT" && v.state !== "EATING" && !v.happyJumpCount);
        if (canFollow) {
            if (distToPlayer < 7.0) {
                if (v.state !== "APPROACH_PLAYER") {
                    v.state = "APPROACH_PLAYER";
                    spawnEmotionIcon(v.group, Math.random() < 0.5 ? 'notice' : 'star');
                }
            } else if (v.state === "APPROACH_PLAYER" && distToPlayer >= 8.5) {
                v.state = "IDLE";
                v.stateTimer = 2.0 + Math.random() * 2.0;
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
            }
        }

        // 6. 通常の自律AI行動更新 (食事AI移動時を除く)
        if (v.state !== "APPROACH_PLAYER" && v.state !== "WANDERING_TO_EAT" && v.state !== "EATING" &&
            v.state !== "GO_TO_ROCKET" && v.state !== "APPROACH_BUTTON" && 
            v.state !== "PRESS_BUTTON" && v.state !== "HOUSE_MUTATION") {
            v.stateTimer -= delta;
            if (v.stateTimer <= 0) {
                if (v.state === "IDLE" || v.state === "ADORE_PLANT" || v.state === "LEAVING_PENDING") {
                    const nextAct = Math.random();
                    if (nextAct < 0.35 && plants.length > 0) {
                        v.state = (v.state === "LEAVING_PENDING") ? "LEAVING_PENDING" : "APPROACH_PLANT";
                        v.targetPlant = plants[Math.floor(Math.random() * plants.length)];
                        
                        const pLocalPos = v.targetPlant.localPos;
                        const tangent = new THREE.Vector3(1,0,0).applyQuaternion(v.targetPlant.mesh.quaternion);
                        const angle = Math.random() * Math.PI * 2;
                        v.targetPos.copy(pLocalPos)
                            .addScaledVector(tangent.clone().applyAxisAngle(pLocalPos.clone().normalize(), angle), 1.25);
                        v.targetPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                        
                        v.stateTimer = 4.5 + Math.random() * 3;
                    } else {
                        v.state = (v.state === "LEAVING_PENDING") ? "LEAVING_PENDING" : "WANDER";
                        
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 5.0 + Math.random() * 6.0;
                        const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(v.group.quaternion);
                        const bitangent = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                        
                        v.targetPos.copy(v.localPos)
                            .addScaledVector(tangent, Math.cos(angle) * dist)
                            .addScaledVector(bitangent, Math.sin(angle) * dist)
                            .normalize().multiplyScalar(ASTEROID_RADIUS);
                        
                        v.stateTimer = 5.0 + Math.random() * 4;
                    }
                } else if (v.state === "WANDER" || v.state === "APPROACH_PLANT") {
                    v.state = (v.state === "LEAVING_PENDING") ? "LEAVING_PENDING" : "IDLE";
                    v.stateTimer = 2.0 + Math.random() * 3.0;
                    v.group.getObjectByName("leftLeg").rotation.x = 0;
                    v.group.getObjectByName("rightLeg").rotation.x = 0;
                }
            }
        }

        // ==========================================
        // v50: 定住演出ステート処理
        // ==========================================
        if (v.state === "GO_TO_ROCKET") {
            if (!v.rocketInstance) {
                v.state = "IDLE";
                v.stateTimer = 2.0;
                continue;
            }
            const toRocket = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
            const dist = toRocket.length();
            
            if (dist > 1.8) {
                const speed = 1.35;
                const dir = toRocket.clone().normalize();
                v.localPos.addScaledVector(dir, speed * delta);
                v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                
                v.group.position.copy(v.localPos);
                const normal = v.localPos.clone().normalize();
                v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                v.walkCycle += delta * 12;
                v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                
                const flatDir = toRocket.clone().projectOnPlane(normal).normalize();
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.12;
            } else {
                // ロケットの手前に到着、ボタンを生成
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
                
                const normal = v.localPos.clone().normalize();
                let tangent = new THREE.Vector3(1, 0, 0).projectOnPlane(normal).normalize();
                if (tangent.lengthSq() < 0.01) tangent = new THREE.Vector3(0, 0, 1).projectOnPlane(normal).normalize();
                
                // ロケットの横にボタンを生成
                const buttonPos = v.rocketInstance.baseLocalPos.clone().addScaledVector(tangent, 1.8).normalize().multiplyScalar(ASTEROID_RADIUS);
                const btn = buildTriggerButton();
                btn.position.copy(buttonPos);
                btn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                asteroid.add(btn);
                
                v.mutationButton = btn;
                v.buttonPos = buttonPos;
                v.targetPos.copy(buttonPos);
                v.state = "APPROACH_BUTTON";
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            continue;
        }

        if (v.state === "APPROACH_BUTTON") {
            const toButton = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
            const dist = toButton.length();
            
            if (dist > 0.15) {
                const speed = 1.1;
                const dir = toButton.clone().normalize();
                v.localPos.addScaledVector(dir, speed * delta);
                v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                
                v.group.position.copy(v.localPos);
                const normal = v.localPos.clone().normalize();
                v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                v.walkCycle += delta * 12;
                v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                
                const flatDir = toButton.clone().projectOnPlane(normal).normalize();
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.12;
            } else {
                // ボタンの真上に到着、ジャンプ準備
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
                
                v.state = "PRESS_BUTTON";
                v.stateTimer = 1.0;
                v.bounce = 0.6; // ジャンプ上昇させる
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            continue;
        }

        if (v.state === "PRESS_BUTTON") {
            if (!v.rocketInstance) {
                v.state = "IDLE";
                v.stateTimer = 2.0;
                continue;
            }
            v.stateTimer -= delta;
            
            // ジャンプアニメーション
            if (v.bounce > 0.01) {
                v.visualGroup.position.y = v.bounce;
                v.bounce *= 0.88;
            } else {
                v.visualGroup.position.y = 0;
            }
            
            if (v.stateTimer <= 0) {
                // ボタンを押し込む
                const redBtn = v.mutationButton.getObjectByName("red_button");
                if (redBtn) {
                    redBtn.position.y = 0.05;
                    redBtn.scale.set(1.0, 0.2, 1.0);
                }
                
                playLandSound();
                spawnStarburst(v.rocketInstance.baseLocalPos);
                spawnStardust(v.buttonPos);
                
                // ロケットを消して家にする
                if (v.rocketInstance && v.rocketInstance.mesh) {
                    asteroid.remove(v.rocketInstance.mesh);
                    v.rocketInstance.mesh.traverse(obj => {
                        if (obj.isMesh) {
                            obj.geometry.dispose();
                            obj.material.dispose();
                        }
                    });
                }
                
                const houseMesh = buildHouse(v.rocketStyle);
                houseMesh.position.copy(v.rocketInstance.baseLocalPos);
                houseMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.rocketInstance.normal);
                houseMesh.scale.set(0.01, 0.01, 0.01);
                asteroid.add(houseMesh);
                
                const houseData = {
                    style: v.rocketStyle,
                    localPos: v.rocketInstance.baseLocalPos.clone(),
                    normal: v.rocketInstance.normal.clone(),
                    mesh: houseMesh
                };
                if (!currentPlanet.houses) currentPlanet.houses = [];
                currentPlanet.houses.push(houseData);
                v.targetHouseData = houseData;
                v.rocketInstance = null;
                
                v.state = "HOUSE_MUTATION";
                v.stateTimer = 1.5;
            }
            continue;
        }

        if (v.state === "HOUSE_MUTATION") {
            v.stateTimer -= delta;
            
            const progress = (1.5 - v.stateTimer) / 1.5; // 0.0 -> 1.0
            if (v.targetHouseData && v.targetHouseData.mesh) {
                // スケールアップしながら回転させる演出
                const s = Math.min(1.0, progress) * 2.5; // 家は元々2.5倍
                v.targetHouseData.mesh.scale.set(s, s, s);
                v.targetHouseData.mesh.rotation.y = (1.0 - progress) * Math.PI * 2;
            }
            
            // 住人の大喜びジャンプ
            v.visualGroup.position.y = Math.sin(v.age * 5.0) * 0.15;
            
            if (v.stateTimer <= 0) {
                if (v.targetHouseData && v.targetHouseData.mesh) {
                    v.targetHouseData.mesh.scale.set(2.5, 2.5, 2.5);
                    v.targetHouseData.mesh.rotation.set(0, 0, 0);
                }
                
                // ボタンを消す
                if (v.mutationButton) {
                    asteroid.remove(v.mutationButton);
                    v.mutationButton.traverse(obj => {
                        if (obj.isMesh) {
                            obj.geometry.dispose();
                            obj.material.dispose();
                        }
                    });
                    v.mutationButton = null;
                }
                
                v.state = "IDLE";
                v.stateTimer = 3.0;
                if (isGuideActive) {
                    v.beacon.visible = true;
                }
                
                const finishMsg = `🏠 「${v.name}」のマイホームが完成しました！`;
                showVillagerNotification(finishMsg, v, 6000);
            }
            continue;
        }

        // 7. 各ステートごとの動作処理
        if (v.state === "IDLE") {
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            v.visualGroup.scale.y = 1.0 + Math.sin(v.age * 2.0) * 0.015;
            
            if (distToPlayer < 6.0) {
                faceVillagerToPlayer(v);
            }
        } else if (v.state === "APPROACH_PLAYER") {
            const localPlayerPos = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
            asteroid.worldToLocal(localPlayerPos);
            v.targetPos.copy(localPlayerPos);

            const toPlayerVec = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
            const dist = toPlayerVec.length();

            if (dist > 1.8) {
                const speed = 1.32;
                const dir = toPlayerVec.clone().normalize();
                v.localPos.addScaledVector(dir, speed * delta);
                v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                
                v.group.position.copy(v.localPos);
                const normal = v.localPos.clone().normalize();
                v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                v.walkCycle += delta * 11;
                v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                
                if (Math.random() < 0.008) {
                    playFootstep(1.35);
                }
                
                const flatDir = toPlayerVec.clone().projectOnPlane(normal).normalize();
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.1;
            } else {
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
                faceVillagerToPlayer(v);

                if (Math.sin(v.age * 5.5) > 0.8 && v.bounce <= 0.01) {
                    v.bounce = 0.24;
                    if (Math.random() < 0.2) {
                        spawnEmotionIcon(v.group, Math.random() < 0.5 ? 'heart' : 'music');
                    }
                }
                if (Math.random() < 0.02) {
                    spawnAdorationHeart(v.localPos);
                }
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            
        } else if (v.state === "WANDER" || v.state === "APPROACH_PLANT" || (v.state === "LEAVING_PENDING" && v.targetPos.lengthSq() > 0)) {
            const toTarget = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
            const dist = toTarget.length();
            
            if (dist > 0.3) {
                const speed = 1.25;
                const dir = toTarget.clone().normalize();
                v.localPos.addScaledVector(dir, speed * delta);
                v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                
                v.group.position.copy(v.localPos);
                const normal = v.localPos.clone().normalize();
                v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                v.walkCycle += delta * 10;
                v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.62;
                v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.62;
                
                if (Math.random() < 0.007) {
                    playFootstep(1.35);
                }
                
                const flatDir = toTarget.clone().projectOnPlane(normal).normalize();
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.08;
            } else {
                if (v.state === "APPROACH_PLANT") {
                    v.state = "ADORE_PLANT";
                    v.stateTimer = 3.5 + Math.random() * 2; 
                } else if (v.state === "WANDER") {
                    v.state = "IDLE";
                    v.stateTimer = 2.0 + Math.random() * 2.0;
                    v.group.getObjectByName("leftLeg").rotation.x = 0;
                    v.group.getObjectByName("rightLeg").rotation.x = 0;
                }
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            
        } else if (v.state === "ADORE_PLANT") {
            if (v.targetPlant && v.targetPlant.mesh) {
                const toPlant = new THREE.Vector3().subVectors(v.targetPlant.localPos, v.localPos);
                const normal = v.localPos.clone().normalize();
                const flatDir = toPlant.clone().projectOnPlane(normal).normalize();
                
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.1;
            }
            
            if (Math.sin(v.age * 9) > 0.7 && v.bounce <= 0.01) {
                v.bounce = 0.22;
            }
            
            if (Math.random() < 0.035) {
                spawnAdorationHeart(v.localPos);
            }
            
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            
        } else if (v.state === "WANDERING_TO_EAT") {
            // お腹が空いて実った木へ向かう動作
            const toTarget = new THREE.Vector3().subVectors(v.targetPos, v.localPos);
            const dist = toTarget.length();
            
            // 移動中に他の要因などで対象の木から実が全て無くなったら諦める
            const hasFruit = v.targetPlant && v.targetPlant.fruitProgress && v.targetPlant.fruitProgress.some(p => p >= 1.0);
            if (!hasFruit) {
                v.state = "IDLE";
                v.stateTimer = 1.5;
                v.hungerTimer = 2.0; // 即再探索
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
            } else if (dist > 0.4 && v.stateTimer > 0) {
                const speed = 1.35; 
                const dir = toTarget.clone().normalize();
                v.localPos.addScaledVector(dir, speed * delta);
                v.localPos.normalize().multiplyScalar(ASTEROID_RADIUS);
                
                v.group.position.copy(v.localPos);
                const normal = v.localPos.clone().normalize();
                v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                v.walkCycle += delta * 11;
                v.group.getObjectByName("leftLeg").rotation.x = Math.sin(v.walkCycle) * 0.65;
                v.group.getObjectByName("rightLeg").rotation.x = -Math.sin(v.walkCycle) * 0.65;
                
                if (Math.random() < 0.008) {
                    playFootstep(1.35);
                }
                
                const flatDir = toTarget.clone().projectOnPlane(normal).normalize();
                const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                let angle = localForward.angleTo(flatDir);
                const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                if (cross.dot(normal) < 0) angle = -angle;
                v.visualGroup.rotation.y += (angle - v.visualGroup.rotation.y) * 0.1;
                
                v.stateTimer -= delta;
            } else {
                // 木に到着、もぐもぐ食事を開始
                v.state = "EATING";
                v.stateTimer = 2.5; 
                v.group.getObjectByName("leftLeg").rotation.x = 0;
                v.group.getObjectByName("rightLeg").rotation.x = 0;
                
                if (v.targetPlant) {
                    const toPlant = new THREE.Vector3().subVectors(v.targetPlant.localPos, v.localPos);
                    const normal = v.localPos.clone().normalize();
                    const flatDir = toPlant.clone().projectOnPlane(normal).normalize();
                    const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(v.group.quaternion);
                    let angle = localForward.angleTo(flatDir);
                    const cross = new THREE.Vector3().crossVectors(localForward, flatDir);
                    if (cross.dot(normal) < 0) angle = -angle;
                    v.visualGroup.rotation.y = angle;
                }
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
            
        } else if (v.state === "EATING") {
            v.stateTimer -= delta;
            
            // 食事中の小刻みなピョコピョコ跳ねともぐもぐパーティクル
            if (Math.sin(v.age * 12.0) > 0.6 && v.bounce <= 0.01) {
                v.bounce = 0.15;
                const normal = v.localPos.clone().normalize();
                spawnEatParticles(v.group.position, normal);
            }
            
            if (v.stateTimer <= 0) {
                // 食事完了、木から完熟している実を1つ消費
                if (v.targetPlant && v.targetPlant.fruitProgress) {
                    const idx = v.targetPlant.fruitProgress.findIndex(p => p >= 1.0);
                    if (idx !== -1) {
                        v.targetPlant.fruitProgress[idx] = 0.01; // 収穫扱い（再成長）
                    }
                }
                
                v.hungerTimer = 30.0 + Math.random() * 25.0; // お腹いっぱい
                v.state = "IDLE";
                v.stateTimer = 2.0 + Math.random() * 2.0;
                
                playEatSound();
                spawnEmotionIcon(v.group, 'music'); 
                
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (v && v.group && v.group.parent) {
                            spawnAdorationHeart(v.localPos);
                        }
                    }, i * 200);
                }
            }
            v.visualGroup.position.y = Math.sin(v.age * 2.0) * 0.022;
        }

        if (v.bounce > 0.005) {
            v.visualGroup.position.y += v.bounce;
            v.bounce *= 0.82;
        }

        // 住人に近づいたらビーコンを自動非表示（ガイドON時のみ）
        if (v.beacon && isGuideActive) {
            v.beacon.visible = distToPlayer >= 10.0;
        }
    }
}

// 愛でるハートマークパーティクルの更新
function updateAdorationParticles(delta) {
    for (let i = adorationParticles.length - 1; i >= 0; i--) {
        const p = adorationParticles[i];
        p.age += delta;
        
        if (p.age >= p.maxAge) {
            asteroid.remove(p.mesh);
            p.mesh.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                }
            });
            adorationParticles.splice(i, 1);
            continue;
        }
        
        const progress = p.age / p.maxAge;
        p.mesh.position.addScaledVector(p.dir, p.speed * delta);
        p.mesh.material?.opacity && (p.mesh.material.opacity = 0.95 * (1.0 - progress));
        
        // 吹き抜けるようにスケール縮小
        const s = 1.0 - progress;
        p.mesh.scale.set(s, s, s);
    }
}

// 足元スターダスト/植物キラキラ粒子の更新用配列
const activeParticles = [];

function spawnStardust(localPos) {
    const particleCount = 14 + Math.floor(Math.random() * 8);
    const colors = [0x00f0ff, 0xff5c8a, 0xffd166, 0xffffff];
    
    const normal = localPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.04 + Math.random() * 0.06;
        const geom = new THREE.BoxGeometry(size, size, size);
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        mesh.position.copy(localPos).addScaledVector(normal, 0.1);
        asteroid.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.15 + Math.random() * 0.45;
        const upward = 0.4 + Math.random() * 0.6;
        
        const vel = new THREE.Vector3()
            .addScaledVector(right, Math.cos(angle) * spread)
            .addScaledVector(forward, Math.sin(angle) * spread)
            .addScaledVector(normal, upward)
            .normalize().multiplyScalar(1.2 + Math.random() * 1.5);
            
        activeParticles.push({
            mesh: mesh,
            dir: vel,
            speed: 1.0,
            age: 0,
            maxAge: 0.7 + Math.random() * 0.4,
            spiralRadius: 0,
            angle: 0,
            rotSpeed: 0
        });
    }
}

// 歩行/着地時の足元スターダスト土煙
function spawnFootstepStardust(localPos) {
    const particleCount = 4 + Math.floor(Math.random() * 3);
    const colors = currentPlanet.id === "boreas" ? [0xd0f5ff, 0xa5d8ff, 0xffffff] :
                   (currentPlanet.id === "helios" ? [0xffd166, 0xe0a96d, 0x8a5a36] : [0x9b5de5, 0xf15bb5, 0x00f0ff]);
                   
    const normal = localPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.04 + Math.random() * 0.04;
        const geom = new THREE.BoxGeometry(size, size, size);
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.82,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        mesh.position.copy(localPos).addScaledVector(normal, 0.05);
        asteroid.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.25 + Math.random() * 0.35;
        const upward = 0.12 + Math.random() * 0.22;
        
        const vel = new THREE.Vector3()
            .addScaledVector(right, Math.cos(angle) * spread)
            .addScaledVector(forward, Math.sin(angle) * spread)
            .addScaledVector(normal, upward)
            .normalize().multiplyScalar(0.75 + Math.random() * 0.75);
            
        activeParticles.push({
            mesh: mesh,
            dir: vel,
            speed: 0.9,
            age: 0,
            maxAge: 0.45 + Math.random() * 0.25,
            spiralRadius: 0,
            angle: 0,
            rotSpeed: 0
        });
    }
}

// 植えたネオン植物の常時舞い散るキラキラ粒子
const plantSparks = [];

function spawnPlantSparks(localPos, type) {
    if (Math.random() > 0.075) return; 
    
    const colors = type === 'tree' ? 
        (currentPlanet.id === "boreas" ? [0x00f0ff, 0xffffff] : (currentPlanet.id === "helios" ? [0xffaa00, 0xffe298] : [0x00b4d8, 0x0077b6])) :
        (currentPlanet.id === "boreas" ? [0xe0f7ff, 0x98ffeb] : (currentPlanet.id === "helios" ? [0xffd166, 0xffe298] : [0xff85a1, 0xffc4d6]));
        
    const normal = localPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    const geom = new THREE.SphereGeometry(0.026 + Math.random() * 0.03, 4, 4);
    const col = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    
    // 植物の頭上付近からスポーン
    mesh.position.copy(localPos).addScaledVector(normal, 0.75 + Math.random() * 0.8);
    asteroid.add(mesh);
    
    const angle = Math.random() * Math.PI * 2;
    const spiral = 0.25 + Math.random() * 0.4;
    
    plantSparks.push({
        mesh: mesh,
        dir: normal,
        speed: 0.32 + Math.random() * 0.42,
        age: 0,
        maxAge: 1.6 + Math.random() * 0.9,
        spiralRadius: spiral,
        angle: angle,
        rotSpeed: 3.5 + Math.random() * 4.0,
        rightVec: right,
        forwardVec: forward
    });
}

function updatePlantSparks(delta) {
    for (let i = plantSparks.length - 1; i >= 0; i--) {
        const p = plantSparks[i];
        p.age += delta;
        
        if (p.age >= p.maxAge) {
            asteroid.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            plantSparks.splice(i, 1);
            continue;
        }
        
        p.angle += p.rotSpeed * delta;
        const progress = p.age / p.maxAge;
        
        p.mesh.position.addScaledVector(p.dir, p.speed * delta);
        if (p.spiralRadius > 0) {
            p.mesh.position.addScaledVector(p.rightVec, Math.cos(p.angle) * 0.012);
            p.mesh.position.addScaledVector(p.forwardVec, Math.sin(p.angle) * 0.012);
        }
        
        p.mesh.material.opacity = 0.95 * (1.0 - progress);
        const s = 1.0 - progress * 0.5;
        p.mesh.scale.set(s, s, s);
    }
}

// 惑星環境の固有舞い散るパーティクル (Artemis=Sparkle, Boreas=Snow, Helios=Gold Dust)
const envParticles = [];

function spawnEnvParticle() {
    if (envParticles.length >= 350) return;
    
    const geom = new THREE.SphereGeometry(0.04 + Math.random() * 0.05, 4, 4);
    
    let color = 0xffffff;
    if (currentPlanet.particleType === "sparkle") {
        const cols = [0xffffff, 0xff85a1, 0x9b5de5, 0x00f0ff];
        color = cols[Math.floor(Math.random() * cols.length)];
    } else if (currentPlanet.particleType === "snow") {
        color = 0xd0f5ff;
    } else if (currentPlanet.particleType === "gold") {
        color = 0xffd166;
    }
    
    const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const height = ASTEROID_RADIUS + 0.5 + Math.random() * 12.0; 
    
    mesh.position.set(
        height * Math.sin(phi) * Math.cos(theta),
        height * Math.sin(phi) * Math.sin(theta),
        height * Math.cos(phi)
    );
    
    scene.add(mesh);
    
    const driftDir = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
    ).normalize();
    
    envParticles.push({
        mesh: mesh,
        dir: driftDir,
        speed: 0.8 + Math.random() * 1.2,
        age: 0,
        maxAge: 4.0 + Math.random() * 3.0
    });
}

function updateEnvParticles(delta) {
    if (Math.random() < 0.28) {
        spawnEnvParticle();
    }
    
    for (let i = envParticles.length - 1; i >= 0; i--) {
        const p = envParticles[i];
        p.age += delta;
        
        if (p.age >= p.maxAge) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            envParticles.splice(i, 1);
            continue;
        }
        
        p.mesh.position.addScaledVector(p.dir, p.speed * delta);
        
        // 小惑星自転に合わせて流れるような微弱風力
        const wind = new THREE.Vector3(0.12, 0.05, 0.08);
        p.mesh.position.addScaledVector(wind, delta);
        
        const progress = p.age / p.maxAge;
        p.mesh.material.opacity = 0.85 * (1.0 - progress);
    }
}

// 旅立ちロケットエンジンのネオン噴射パーティクル
const rocketParticles = [];

function spawnRocketExhaust(pos, normal) {
    const particleCount = 4;
    const colors = [0xff5c8a, 0xffaa00, 0x00f0ff, 0xffffff];
    
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(normal, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.12 + Math.random() * 0.18;
        const geom = new THREE.SphereGeometry(size, 5, 5);
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        
        // ノズル口付近 (少し下方) に配置
        mesh.position.copy(pos);
        asteroid.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const spread = 0.35 + Math.random() * 0.65;
        const vel = new THREE.Vector3()
            .addScaledVector(right, Math.cos(angle) * spread)
            .addScaledVector(forward, Math.sin(angle) * spread)
            .addScaledVector(normal, -3.2) 
            .normalize().multiplyScalar(4.5 + Math.random() * 4.0);
            
        rocketParticles.push({
            mesh: mesh,
            dir: vel,
            age: 0,
            maxAge: 0.45 + Math.random() * 0.25
        });
    }
}

function updateRocketParticles(delta) {
    for (let i = rocketParticles.length - 1; i >= 0; i--) {
        const rp = rocketParticles[i];
        rp.age += delta;
        
        if (rp.age >= rp.maxAge) {
            asteroid.remove(rp.mesh);
            rp.mesh.geometry.dispose();
            rp.mesh.material.dispose();
            rocketParticles.splice(i, 1);
            continue;
        }
        
        rp.mesh.position.addScaledVector(rp.dir, delta);
        
        const progress = rp.age / rp.maxAge;
        const scale = 1.0 - progress;
        rp.mesh.scale.set(scale, scale, scale);
        rp.mesh.material.opacity = 0.95 * (1.0 - progress);
    }
}

function shootGrassSeed() {
    if (playerInventory.grassSeeds <= 0) {
        showVillagerNotification("🌾 草のタネがありません！");
        return;
    }
    
    playerInventory.grassSeeds--;
    updateStatsUI();

    const geom = new THREE.SphereGeometry(0.12, 6, 6);
    let seedColor = 0xa3e2a5;
    let emissiveColor = 0x4caf50;
    if (currentPlanet.id === "boreas") {
        seedColor = 0xa5cbe2;
        emissiveColor = 0x2196f3;
    } else if (currentPlanet.id === "helios") {
        seedColor = 0xe2cba5;
        emissiveColor = 0xff9800;
    }
    const mat = new THREE.MeshStandardMaterial({
        color: seedColor,
        emissive: emissiveColor,
        emissiveIntensity: 1.2,
        roughness: 0.5
    });
    const mesh = new THREE.Mesh(geom, mat);
    
    const startPos = new THREE.Vector3(0, ASTEROID_RADIUS + playerHeight, 0);
    mesh.position.copy(startPos);
    
    scene.add(mesh);
    
    // 真下（惑星の中心方向）へ発射
    const velocity = new THREE.Vector3(0, -20.0, 0);
    
    grassSeeds.push({
        mesh: mesh,
        velocity: velocity,
        position: startPos
    });
    
    playPlantSound();
}

function updateGrassSeeds(delta) {
    const gravity = -16.0;
    for (let i = grassSeeds.length - 1; i >= 0; i--) {
        const seed = grassSeeds[i];
        
        seed.velocity.y += gravity * delta;
        seed.position.addScaledVector(seed.velocity, delta);
        seed.mesh.position.copy(seed.position);
        
        seed.mesh.rotation.x += delta * 6;
        seed.mesh.rotation.y += delta * 4;
        
        const distToCenter = seed.position.length();
        if (distToCenter <= ASTEROID_RADIUS) {
            const hitWorldPos = seed.position.clone().normalize().multiplyScalar(ASTEROID_RADIUS);
            
            const hitLocalPos = hitWorldPos.clone();
            asteroid.worldToLocal(hitLocalPos);
            
            const radius = 4.8;
            let grassGrown = false;
            for (let j = 0; j < grassClumps.length; j++) {
                const gc = grassClumps[j];
                const d = gc.mesh.position.distanceTo(hitLocalPos);
                if (d < radius) {
                    gc.targetScale = gc.baseScale;
                    grassGrown = true;
                    if (!currentPlanet.grownGrassIndices) {
                        currentPlanet.grownGrassIndices = new Set();
                    }
                    currentPlanet.grownGrassIndices.add(j);
                }
            }
            
            if (grassGrown) {
                spawnStardust(hitWorldPos);
                updateStatsUI();
                
                if (isTutorialShowing && tutorialDialogIndex === 3) {
                    setTimeout(() => {
                        advanceTutorialDialogue(3);
                    }, 1000);
                }
            }
            
            scene.remove(seed.mesh);
            seed.mesh.geometry.dispose();
            seed.mesh.material.dispose();
            grassSeeds.splice(i, 1);
        }
    }
}


// マイルストーン条件定義
const spawnMilestones = [
    { id: 0, reqFlower: 4,  reqTree: 1,  settleReqFlower: 6,  settleReqTree: 2,  check: (f, t) => (f >= 4  && t >= 1),  clue: "緑と花が少し増えた頃…",           name: "最初の訪問者" },
    { id: 1, reqFlower: 8,  reqTree: 5,  settleReqFlower: 10, settleReqTree: 7,  check: (f, t) => (f >= 8  && t >= 5),  clue: "バランスよく自然が育った頃…",       name: "二番目の訪問者" },
    { id: 2, reqFlower: 8,  reqTree: 15, settleReqFlower: 10, settleReqTree: 20, check: (f, t) => (t >= 15 && f >= 8),  clue: "木々が鬱蒼と茂りだした頃…",         name: "三番目の訪問者" },
    { id: 3, reqFlower: 18, reqTree: 18, settleReqFlower: 22, settleReqTree: 22, check: (f, t) => (f >= 18 && t >= 18), clue: "花と木が満ち溢れた楽園の頃…",       name: "四番目の訪問者" },
    { id: 4, reqFlower: 8,  reqTree: 0,  settleReqFlower: 12, settleReqTree: 0,  check: (f, t) => (f >= 8  && t === 0), clue: "木を植えず、花だけを植えた頃…",     name: "お花畑の訪問者" },
    { id: 5, reqFlower: 0,  reqTree: 8,  settleReqFlower: 0,  settleReqTree: 12, check: (f, t) => (t >= 8  && f === 0), clue: "花を植えず, 木だけを植えた頃…",     name: "森の訪問者" }
];

// 次にやってくる住人のヒント情報を取得する
function getNextVillagerHint(flowerCount, treeCount) {
    if (!currentPlanet.completedMilestones) {
        currentPlanet.completedMilestones = [];
    }

    const incompleteMilestones = spawnMilestones.filter(m => !currentPlanet.completedMilestones.includes(m.id));
    
    // お花畑 (id:4) は木があったらダメ、森 (id:5) は花があったらダメ
    const reachableMilestones = incompleteMilestones.filter(m => {
        if (m.id === 4 && treeCount > 0) return false;
        if (m.id === 5 && flowerCount > 0) return false;
        return true;
    });

    if (reachableMilestones.length === 0) {
        return null;
    }

    let bestCandidate = null;
    let minDiff = Infinity;

    reachableMilestones.forEach(m => {
        const diffF = Math.max(0, m.reqFlower - flowerCount);
        const diffT = Math.max(0, m.reqTree - treeCount);
        const diffTotal = diffF + diffT;

        if (diffTotal < minDiff) {
            minDiff = diffTotal;
            bestCandidate = { milestone: m, diffF: diffF, diffT: diffT };
        } else if (diffTotal === minDiff && bestCandidate) {
            const currentTotal = m.reqFlower + m.reqTree;
            const bestTotal = bestCandidate.milestone.reqFlower + bestCandidate.milestone.reqTree;
            if (currentTotal < bestTotal) {
                bestCandidate = { milestone: m, diffF: diffF, diffT: diffT };
            }
        }
    });

    return bestCandidate;
}

// 画面左のヒントUIを更新する
function updateVillagerHintUI() {
    const hintClueEl = document.getElementById('hint-villager-clue');
    const flowerNeedEl = document.getElementById('hint-flower-need');
    const treeNeedEl = document.getElementById('hint-tree-need');

    if (!hintClueEl || !flowerNeedEl || !treeNeedEl) return;

    const plants = currentPlanet.plants;
    const flowerCount = plants.filter(p => p.type === 'flower').length;
    const treeCount = plants.filter(p => p.type === 'tree').length;

    const hint = getNextVillagerHint(flowerCount, treeCount);

    if (hint) {
        hintClueEl.textContent = `噂：${hint.milestone.clue}`;
        flowerNeedEl.textContent = `花 ${hint.milestone.reqFlower}本 (あと ${hint.diffF}本)`;
        treeNeedEl.textContent = `木 ${hint.milestone.reqTree}本 (あと ${hint.diffT}本)`;
    } else {
        hintClueEl.textContent = `噂：次の住人の気配はない...`;
        flowerNeedEl.textContent = `達成済み`;
        treeNeedEl.textContent = `達成済み`;
    }
}

// 植えた植物数の変動に応じた住人の自発登場・環境アセット制御
function updatePlanetEnvironment() {
    const plants = currentPlanet.plants;
    const flowerCount = plants.filter(p => p.type === 'flower').length;
    const treeCount = plants.filter(p => p.type === 'tree').length;
    
    if (!currentPlanet.completedMilestones) {
        currentPlanet.completedMilestones = [];
    }

    for (const milestone of spawnMilestones) {
        if (currentPlanet.completedMilestones.includes(milestone.id)) {
            continue;
        }

        if (milestone.check(flowerCount, treeCount)) {
            const activeV = currentPlanet.activeVillagers || [];
            // まだこの惑星にいない住民タイプをフィルタ
            const unspawnedTypes = villagerTypes.filter(t => !activeV.some(v => v.id === t.id));

            if (unspawnedTypes.length > 0) {
                const randomIndex = Math.floor(Math.random() * unspawnedTypes.length);
                const chosenType = unspawnedTypes[randomIndex];

                spawnVillager(chosenType, milestone);
                currentPlanet.completedMilestones.push(milestone.id);
                break; // 1回で1体スポーン
            }
        }
    }

    // ヒントUIの更新
    updateVillagerHintUI();
}

// 植物の環境ライト管理配列と追加関数
let activePlantLights = [];
const MAX_PLANT_LIGHTS = 4;

function addPlantLight(plant) {
    if (activePlantLights.length >= MAX_PLANT_LIGHTS) {
        const oldest = activePlantLights.shift();
        if (oldest.light) {
            asteroid.remove(oldest.light);
            oldest.light = null;
        }
    }
    
    let lightColor = 0xff85a1; 
    if (plant.type === 'tree') {
        lightColor = currentPlanet.id === "boreas" ? 0x00f0ff : (currentPlanet.id === "helios" ? 0xffaa00 : 0x00bfff);
    } else {
        lightColor = currentPlanet.id === "boreas" ? 0xe0f7ff : (currentPlanet.id === "helios" ? 0xffd166 : 0xff85a1);
    }
    
    const light = new THREE.PointLight(lightColor, 1.8, 5.0);
    light.position.copy(plant.localPos).addScaledVector(plant.localPos.clone().normalize(), 0.75);
    
    asteroid.add(light);
    plant.light = light;
    activePlantLights.push(plant);
}

// 植物を植える
// 植えるモーション開始
function startPlanting(type) {
    if (isPlanting || isJumping) return;
    
    if (type === 'flower') {
        const count = playerInventory.flowerSeeds[selectedFlowerSeed] || 0;
        if (count <= 0) {
            showVillagerNotification("🌸 花のタネを持っていません！");
            return;
        }
    } else if (type === 'tree') {
        const count = playerInventory.treeSaplings[selectedTreeSapling] || 0;
        if (count <= 0) {
            showVillagerNotification("🌳 木の苗を持っていません！");
            return;
        }
    }
    
    isPlanting = true;
    plantingType = type;
    // 花: 0.5秒, 木: 1.0秒
    plantingDuration = (type === 'tree') ? 1.0 : 0.5;
    plantingTimer = plantingDuration;
}

function plantObjectAtGrid(type) {
    if (isTutorialShowing) {
        if (tutorialDialogIndex === 1 && type === 'flower') {
            advanceTutorialDialogue(1);
        } else if (tutorialDialogIndex === 2 && type === 'tree') {
            advanceTutorialDialogue(2);
        }
    }
    
    // インベントリ減算
    if (type === 'flower') {
        if (playerInventory.flowerSeeds[selectedFlowerSeed] <= 0) return;
        playerInventory.flowerSeeds[selectedFlowerSeed]--;
    } else {
        if (playerInventory.treeSaplings[selectedTreeSapling] <= 0) return;
        playerInventory.treeSaplings[selectedTreeSapling]--;
    }

    const plants = currentPlanet.plants;
    if (plants.length >= 100) return;

    const snapData = getSnappedLocalData();

    if (currentPlanet.plantedGridCells.has(snapData.key)) {
        playerBounce = 0.1;
        // インベントリの払い戻し
        if (type === 'flower') playerInventory.flowerSeeds[selectedFlowerSeed]++;
        else playerInventory.treeSaplings[selectedTreeSapling]++;
        return;
    }

    currentPlanet.plantedGridCells.add(snapData.key);

    const plantGroup = new THREE.Group();
    const visualGroup = new THREE.Group();
    plantGroup.add(visualGroup);

    let targetScaleSize = 1.35;
    let subtype = 0;
    if (type === 'flower') {
        if (currentPlanet.id === "boreas") {
            buildIceFlower(visualGroup);
            subtype = 0;
        } else if (currentPlanet.id === "helios") {
            buildDesertFlower(visualGroup);
            subtype = 0;
        } else {
            if (selectedFlowerSeed === "cosmic") {
                buildCosmicFlower(visualGroup);
                subtype = 0;
            } else if (selectedFlowerSeed === "lily") {
                buildStarlightLily(visualGroup);
                subtype = 1;
            } else if (selectedFlowerSeed === "rose") {
                buildLunaRose(visualGroup);
                subtype = 2;
            } else if (selectedFlowerSeed === "tulip") {
                buildAuroraTulip(visualGroup);
                subtype = 3;
            } else {
                buildCosmicFlower(visualGroup);
                subtype = 0;
            }
        }
        targetScaleSize = 1.25;
    } else {
        if (currentPlanet.id === "boreas") {
            buildIceTree(visualGroup);
            subtype = 0;
        } else if (currentPlanet.id === "helios") {
            buildDesertTree(visualGroup);
            subtype = 0;
        } else {
            if (selectedTreeSapling === "cosmic_tree") {
                buildCosmicTree(visualGroup);
                subtype = 0;
            } else if (selectedTreeSapling === "berry_tree") {
                buildBerryTree(visualGroup);
                subtype = 1;
            } else {
                buildCosmicTree(visualGroup);
                subtype = 0;
            }
        }
        targetScaleSize = 1.65; 
    }

    plantGroup.position.copy(snapData.pos);
    const normal = snapData.pos.clone().normalize();
    plantGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    plantGroup.scale.set(0.01, 0.01, 0.01);

    asteroid.add(plantGroup);
    
    const plantObj = {
        mesh: plantGroup,
        visualGroup: visualGroup,
        scale: 0.01,
        targetScale: targetScaleSize,
        age: 0,
        localPos: snapData.pos,
        type: type,
        subtype: subtype,
        light: null,
        harvestedSeed: false // 採取可能かどうかのフラグ
    };

    // 木の場合、果実の初期実り状態を設定
    if (type === 'tree') {
        const fruitMeshes = [];
        plantGroup.traverse(obj => {
            if (obj.isMesh && obj.name === "fruit") {
                fruitMeshes.push(obj);
            }
        });
        plantObj.fruitProgress = new Array(fruitMeshes.length).fill(0.0); // 最初は実っていない状態 (少し立たないと実がならない)
    }

    plants.push(plantObj);

    playPlantSound();
    spawnStardust(snapData.pos);
    
    addPlantLight(plantObj);
    updatePlanetEnvironment();

    updateStatsUI();
    playerBounce = 0.28;
    saveGame(false);
}

// ==========================================
// 3D 植物モデリング (テーマバリエーション対応)
// ==========================================
function buildCosmicFlower(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x82d989, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.3;
    stem.castShadow = true;
    parent.add(stem);

    const centerGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const centerMat = new THREE.MeshStandardMaterial({ 
        color: 0xfffae0, 
        emissive: 0xffd166,
        emissiveIntensity: 1.2,
        roughness: 0.2 
    });
    const center = new THREE.Mesh(centerGeom, centerMat);
    center.position.y = 0.65;
    parent.add(center);

    const petalColors = [0xff6b8b, 0xff85a1, 0xb388ff, 0x4ea8de];
    const flowerColor = petalColors[Math.floor(Math.random() * petalColors.length)];
    const petalGeom = new THREE.SphereGeometry(0.24, 8, 8);
    const petalMat = new THREE.MeshStandardMaterial({ 
        color: flowerColor,
        emissive: flowerColor,
        emissiveIntensity: 0.7,
        roughness: 0.4 
    });

    for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeom, petalMat);
        const angle = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.25, 0.65, Math.sin(angle) * 0.25);
        petal.scale.set(1.4, 0.5, 1.0);
        petal.rotation.y = -angle;
        petal.rotation.x = 0.2;
        petal.castShadow = true;
        parent.add(petal);
    }
}

// ✨ スターライトリリー (星光の百合)
function buildStarlightLily(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.04, 0.06, 0.75, 6);
    const stemMat = new THREE.MeshStandardMaterial({ 
        color: 0x52b788, 
        roughness: 0.7 
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.325;
    stem.castShadow = true;
    parent.add(stem);

    const pistilGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4);
    const pistilMat = new THREE.MeshStandardMaterial({
        color: 0xfffae0,
        emissive: 0xffd166,
        emissiveIntensity: 1.5,
        roughness: 0.2
    });
    
    for (let i = 0; i < 3; i++) {
        const pMesh = new THREE.Mesh(pistilGeom, pistilMat);
        pMesh.position.set((Math.random() - 0.5) * 0.08, 0.75, (Math.random() - 0.5) * 0.08);
        pMesh.rotation.x = (Math.random() - 0.5) * 0.4;
        pMesh.rotation.z = (Math.random() - 0.5) * 0.4;
        parent.add(pMesh);
    }

    const petalGeom = new THREE.ConeGeometry(0.14, 0.45, 5);
    const petalMat = new THREE.MeshStandardMaterial({
        color: 0x00b4d8,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9
    });

    for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(petalGeom, petalMat);
        const angle = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.18, 0.65, Math.sin(angle) * 0.18);
        petal.scale.set(1.5, 1.0, 0.3);
        petal.rotation.z = -0.7;
        petal.rotation.y = -angle - Math.PI / 2;
        petal.castShadow = true;
        parent.add(petal);
    }
}

// ✨ ルナローズ (月光の薔薇)
function buildLunaRose(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.05, 0.07, 0.65, 6);
    const stemMat = new THREE.MeshStandardMaterial({ 
        color: 0x3d3056, 
        roughness: 0.8 
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.28;
    stem.castShadow = true;
    parent.add(stem);

    const coreGeom = new THREE.SphereGeometry(0.12, 8, 8);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xffaa00,
        emissiveIntensity: 1.8,
        roughness: 0.1
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.y = 0.62;
    parent.add(core);

    const innerPetalGeom = new THREE.SphereGeometry(0.16, 8, 8);
    const innerPetalMat = new THREE.MeshStandardMaterial({
        color: 0xff5c8a,
        emissive: 0xff00d0,
        emissiveIntensity: 0.9,
        roughness: 0.4
    });

    for (let i = 0; i < 4; i++) {
        const petal = new THREE.Mesh(innerPetalGeom, innerPetalMat);
        const angle = (i / 4) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.1, 0.6, Math.sin(angle) * 0.1);
        petal.scale.set(1.2, 0.8, 0.6);
        petal.rotation.y = -angle + 0.5;
        petal.rotation.x = 0.3;
        petal.castShadow = true;
        parent.add(petal);
    }

    const outerPetalGeom = new THREE.SphereGeometry(0.22, 8, 8);
    const outerPetalMat = new THREE.MeshStandardMaterial({
        color: 0x7209b7,
        emissive: 0x9b5de5,
        emissiveIntensity: 0.6,
        roughness: 0.5
    });

    for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(outerPetalGeom, outerPetalMat);
        const angle = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.22, 0.56, Math.sin(angle) * 0.22);
        petal.scale.set(1.4, 0.9, 0.5);
        petal.rotation.y = -angle;
        petal.rotation.x = 0.5;
        petal.castShadow = true;
        parent.add(petal);
    }
}

// ✨ オーロラチューリップ (極光の鬱金香)
function buildAuroraTulip(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6);
    const stemMat = new THREE.MeshStandardMaterial({ 
        color: 0x70e000, 
        roughness: 0.7 
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.3;
    stem.castShadow = true;
    parent.add(stem);

    const glowGeom = new THREE.SphereGeometry(0.14, 8, 8);
    const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x06d6a0,
        emissiveIntensity: 1.6,
        roughness: 0.1
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.y = 0.62;
    parent.add(glow);

    const petalGeom = new THREE.SphereGeometry(0.24, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const petalMat = new THREE.MeshStandardMaterial({
        color: 0xff5c00,
        emissive: 0xff0055,
        emissiveIntensity: 0.8,
        roughness: 0.3
    });

    for (let i = 0; i < 4; i++) {
        const petal = new THREE.Mesh(petalGeom, petalMat);
        const angle = (i / 4) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.14, 0.6, Math.sin(angle) * 0.14);
        petal.scale.set(1.0, 1.4, 0.6);
        petal.rotation.y = -angle - Math.PI / 2;
        petal.rotation.x = -0.2;
        petal.castShadow = true;
        parent.add(petal);
    }
}

function buildNeonMushroom(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.12, 0.18, 0.65, 8);
    const stemMat = new THREE.MeshStandardMaterial({ 
        color: 0x9f86ff, 
        emissive: 0x5a34e0,
        emissiveIntensity: 0.4,
        roughness: 0.5 
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.275;
    stem.castShadow = true;
    parent.add(stem);

    const capColors = [0xff3366, 0x00f0ff, 0xff00d0];
    const neonColor = capColors[Math.floor(Math.random() * capColors.length)];
    const capGeom = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9);
    const capMat = new THREE.MeshStandardMaterial({ 
        color: neonColor,
        emissive: neonColor,
        emissiveIntensity: 1.1,
        roughness: 0.2
    });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.y = 0.625;
    cap.scale.set(1.1, 0.7, 1.1);
    cap.castShadow = true;
    parent.add(cap);

    const dotGeom = new THREE.SphereGeometry(0.06, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dotPositions = [
        new THREE.Vector3(0.18, 0.825, 0.18),
        new THREE.Vector3(-0.2, 0.825, 0.12),
        new THREE.Vector3(0.05, 0.925, -0.2),
        new THREE.Vector3(-0.08, 0.895, 0.22)
    ];

    dotPositions.forEach(pos => {
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.copy(pos);
        parent.add(dot);
    });
}

// ==========================================
// 4つの木の3Dモデリング関数 (果物メッシュに識別用タグを付与)
// ==========================================
function buildBerryTree(parent) {
    const trunkGeom = new THREE.CylinderGeometry(0.08, 0.16, 0.85, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.35;
    trunk.castShadow = true;
    parent.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ 
        color: 0x2e8b57, 
        roughness: 0.9, 
        flatShading: true 
    });

    const leafPos = [
        { pos: new THREE.Vector3(0, 0.9, 0), size: 0.55 },
        { pos: new THREE.Vector3(-0.3, 0.75, 0.2), size: 0.38 },
        { pos: new THREE.Vector3(0.28, 0.78, -0.2), size: 0.4 },
        { pos: new THREE.Vector3(0.25, 0.7, 0.25), size: 0.35 },
        { pos: new THREE.Vector3(-0.25, 0.72, -0.25), size: 0.35 }
    ];

    leafPos.forEach(data => {
        const lGeom = new THREE.SphereGeometry(data.size, 8, 8);
        const mesh = new THREE.Mesh(lGeom, leavesMat);
        mesh.position.copy(data.pos);
        mesh.castShadow = true;
        parent.add(mesh);
    });

    const berryGeom = new THREE.SphereGeometry(0.08, 6, 6);
    const berryColor = 0xff3300; 
    const berryMat = new THREE.MeshStandardMaterial({ 
        color: berryColor,
        emissive: berryColor,
        emissiveIntensity: 1.5,
        roughness: 0.1
    });

    const berryPos = [
        new THREE.Vector3(-0.35, 0.675, 0.32),
        new THREE.Vector3(0.38, 0.705, -0.05),
        new THREE.Vector3(0.1, 1.025, 0.15),
        new THREE.Vector3(-0.1, 0.875, -0.32),
        new THREE.Vector3(0.28, 0.575, -0.35)
    ];

    berryPos.forEach((pos, idx) => {
        const berry = new THREE.Mesh(berryGeom, berryMat);
        berry.position.copy(pos);
        berry.castShadow = true;
        berry.name = "fruit"; // 識別用
        berry.userData = {
            fruitIndex: idx,
            baseScale: 1.0
        };
        parent.add(berry);
    });
}

function buildCosmicTree(parent) {
    const trunkGeom = new THREE.CylinderGeometry(0.12, 0.22, 1.3, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c5a, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.65;
    trunk.castShadow = true;
    parent.add(trunk);

    const colors = [0x00f0ff, 0x9b5de5, 0xf15bb5, 0x00b4d8, 0x7209b7];
    const leafNodes = [
        { pos: new THREE.Vector3(0, 1.5, 0), size: 0.75, color: colors[0] },
        { pos: new THREE.Vector3(-0.4, 1.25, 0.3), size: 0.55, color: colors[1] },
        { pos: new THREE.Vector3(0.4, 1.35, -0.3), size: 0.58, color: colors[2] },
        { pos: new THREE.Vector3(0.3, 1.15, 0.4), size: 0.52, color: colors[3] },
        { pos: new THREE.Vector3(-0.35, 1.2, -0.35), size: 0.50, color: colors[4] }
    ];

    leafNodes.forEach(node => {
        const leafGeom = new THREE.IcosahedronGeometry(node.size, 1);
        const leavesMat = new THREE.MeshStandardMaterial({ 
            color: node.color, 
            emissive: node.color,
            emissiveIntensity: 0.4,
            roughness: 0.5,
            flatShading: true
        });
        const leaf = new THREE.Mesh(leafGeom, leavesMat);
        leaf.position.copy(node.pos);
        leaf.castShadow = true;
        parent.add(leaf);
    });

    const ringGeom = new THREE.TorusGeometry(0.9, 0.04, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0xff00d0,
        emissive: 0xff00d0,
        emissiveIntensity: 1.2,
        roughness: 0.1
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.set(0, 1.35, 0);
    ring.rotation.x = Math.PI / 2.3;
    parent.add(ring);

    const fruitGeom = new THREE.SphereGeometry(0.12, 6, 6);
    const fruitColors = [0xffb703, 0xfb8500, 0xff006e];
    
    const fruitPos = [
        new THREE.Vector3(-0.5, 1.1, 0.5),
        new THREE.Vector3(0.55, 1.2, -0.1),
        new THREE.Vector3(0.1, 1.7, 0.25),
        new THREE.Vector3(-0.2, 1.4, -0.5),
        new THREE.Vector3(0.4, 0.95, 0.45),
        new THREE.Vector3(-0.45, 0.95, -0.3)
    ];

    fruitPos.forEach((pos, idx) => {
        const color = fruitColors[idx % fruitColors.length];
        const fruitMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.6,
            roughness: 0.1
        });
        const fruit = new THREE.Mesh(fruitGeom, fruitMat);
        fruit.position.copy(pos);
        fruit.castShadow = true;
        fruit.name = "fruit"; // 識別用
        fruit.userData = {
            fruitIndex: idx,
            baseScale: 1.0
        };
        parent.add(fruit);
    });
}

// --- ボレアス(氷惑星)の固有植物 ---
function buildIceFlower(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.05, 0.07, 0.7, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x9be3a0, roughness: 0.4, metalness: 0.3 });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.3;
    parent.add(stem);
    
    const petalGeom = new THREE.ConeGeometry(0.2, 0.48, 4);
    const petalMat = new THREE.MeshStandardMaterial({
        color: 0xe0f7ff,
        emissive: 0x00bfff,
        emissiveIntensity: 1.3,
        roughness: 0.05,
        transparent: true,
        opacity: 0.85
    });
    
    for(let i=0; i<6; i++){
        const petal = new THREE.Mesh(petalGeom, petalMat);
        const angle = (i/6) * Math.PI * 2;
        petal.position.set(Math.cos(angle)*0.22, 0.65, Math.sin(angle)*0.22);
        petal.rotation.z = -0.5;
        petal.rotation.y = -angle;
        parent.add(petal);
    }
}

function buildIceTree(parent) {
    const trunkGeom = new THREE.CylinderGeometry(0.1, 0.2, 1.25, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb0e0e6, metalness: 0.8, roughness: 0.1 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    parent.add(trunk);
    
    const iceMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0ffff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.8,
        roughness: 0.05,
        transmission: 0.95,
        transparent: true,
        opacity: 0.8
    });
    
    const iceNodes = [
        { pos: new THREE.Vector3(0, 1.4, 0), size: 0.7 },
        { pos: new THREE.Vector3(-0.35, 1.15, 0.2), size: 0.48 },
        { pos: new THREE.Vector3(0.35, 1.2, -0.2), size: 0.5 }
    ];
    
    iceNodes.forEach(node => {
        const iceGeom = new THREE.IcosahedronGeometry(node.size, 1);
        const mesh = new THREE.Mesh(iceGeom, iceMat);
        mesh.position.copy(node.pos);
        mesh.castShadow = true;
        parent.add(mesh);
    });

    const icicleGeom = new THREE.ConeGeometry(0.06, 0.4, 4);
    const icicleMat = iceMat;
    const iciclePos = [
        new THREE.Vector3(-0.25, 0.85, 0.15),
        new THREE.Vector3(0.25, 0.88, -0.15),
        new THREE.Vector3(0.1, 1.1, 0.3),
        new THREE.Vector3(-0.1, 1.1, -0.3)
    ];
    iciclePos.forEach(pos => {
        const icicle = new THREE.Mesh(icicleGeom, icicleMat);
        icicle.position.copy(pos);
        icicle.rotation.x = Math.PI; 
        icicle.castShadow = true;
        parent.add(icicle);
    });

    // 💎 新設: 青白く輝く結晶の果実「クリスタル・アイス・アップル」を追加
    const fruitGeom = new THREE.IcosahedronGeometry(0.12, 0); 
    const fruitMat = new THREE.MeshStandardMaterial({
        color: 0x80e0ff,
        emissive: 0x00d0ff,
        emissiveIntensity: 1.6,
        roughness: 0.05,
        transparent: true,
        opacity: 0.9
    });

    const fruitPos = [
        new THREE.Vector3(-0.45, 0.95, 0.3),
        new THREE.Vector3(0.45, 1.0, -0.3),
        new THREE.Vector3(0.1, 1.6, 0.15)
    ];

    fruitPos.forEach((pos, idx) => {
        const fruit = new THREE.Mesh(fruitGeom, fruitMat);
        fruit.position.copy(pos);
        fruit.castShadow = true;
        fruit.name = "fruit"; // 識別用
        fruit.userData = {
            fruitIndex: idx,
            baseScale: 1.0
        };
        parent.add(fruit);
    });
}

// --- ヘリオス(砂漠惑星)の固有植物 ---
function buildDesertFlower(parent) {
    const stemGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.28;
    parent.add(stem);
    
    const flowerGeom = new THREE.SphereGeometry(0.32, 12, 12);
    const flowerMat = new THREE.MeshStandardMaterial({
        color: 0xffb703,
        emissive: 0xfb8500,
        emissiveIntensity: 1.4,
        roughness: 0.3
    });
    const bloom = new THREE.Mesh(flowerGeom, flowerMat);
    bloom.position.y = 0.58;
    bloom.scale.set(1.2, 0.8, 1.2);
    parent.add(bloom);
}

function buildDesertTree(parent) {
    const trunkGeom = new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    parent.add(trunk);
    
    const armGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 });
    
    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-0.35, 0.95, 0);
    leftArm.rotation.z = Math.PI / 3;
    leftArm.castShadow = true;
    trunk.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(0.35, 0.85, 0);
    rightArm.rotation.z = -Math.PI / 3;
    rightArm.castShadow = true;
    trunk.add(rightArm);
    
    const spikeGeom = new THREE.ConeGeometry(0.015, 0.08, 4);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffe3a0, roughness: 0.5 });
    const spikeData = [
        { pos: new THREE.Vector3(0.2, 0.5, 0.1), rot: new THREE.Vector3(0, 0, -Math.PI/2.5) },
        { pos: new THREE.Vector3(-0.2, 0.4, -0.1), rot: new THREE.Vector3(0, 0, Math.PI/2.5) },
        { pos: new THREE.Vector3(0, 0.8, 0.2), rot: new THREE.Vector3(Math.PI/2.5, 0, 0) },
        { pos: new THREE.Vector3(0, 0.3, -0.2), rot: new THREE.Vector3(-Math.PI/2.5, 0, 0) },
        { pos: new THREE.Vector3(-0.45, 1.1, 0.1), rot: new THREE.Vector3(0, 0, Math.PI/3) },
        { pos: new THREE.Vector3(0.45, 1.0, -0.1), rot: new THREE.Vector3(0, 0, -Math.PI/3) }
    ];
    spikeData.forEach(data => {
        const spike = new THREE.Mesh(spikeGeom, spikeMat);
        spike.position.copy(data.pos);
        spike.rotation.set(data.rot.x, data.rot.y, data.rot.z);
        parent.add(spike);
    });

    const bloomGeom = new THREE.ConeGeometry(0.12, 0.18, 5);
    const bloomMat = new THREE.MeshStandardMaterial({
        color: 0xff4d6d,
        emissive: 0xff4d6d,
        emissiveIntensity: 1.0,
        roughness: 0.3
    });
    const blooms = [
        { pos: new THREE.Vector3(0, 1.42, 0), rot: new THREE.Vector3(0, 0, 0) },
        { pos: new THREE.Vector3(-0.52, 1.25, 0), rot: new THREE.Vector3(0, 0, Math.PI/4) },
        { pos: new THREE.Vector3(0.52, 1.15, 0), rot: new THREE.Vector3(0, 0, -Math.PI/4) }
    ];
    blooms.forEach(b => {
        const bloom = new THREE.Mesh(bloomGeom, bloomMat);
        bloom.position.copy(b.pos);
        bloom.rotation.set(b.rot.x, b.rot.y, b.rot.z);
        parent.add(bloom);
    });

    const fruitGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const fruitMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xffaa00,
        emissiveIntensity: 1.5,
        roughness: 0.2
    });
    
    const fruitPos = [
        new THREE.Vector3(0, 1.5, 0),
        new THREE.Vector3(-0.55, 1.2, 0)
    ];

    fruitPos.forEach((pos, idx) => {
        const fruit = new THREE.Mesh(fruitGeom, fruitMat);
        fruit.position.copy(pos);
        fruit.castShadow = true;
        fruit.name = "fruit"; // 識別用
        fruit.userData = {
            fruitIndex: idx,
            baseScale: 1.0
        };
        parent.add(fruit);
    });
}

function getSnappedLocalData() {
    const localTop = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
    asteroid.worldToLocal(localTop);

    const r = localTop.length();
    const phi = Math.asin(localTop.y / r);
    const theta = Math.atan2(localTop.z, localTop.x);

    const latIndex = Math.round((phi - (-Math.PI / 2)) / deltaLat);
    const lonIndex = Math.round((theta - (-Math.PI)) / deltaLon);

    const snappedPhi = -Math.PI / 2 + latIndex * deltaLat;
    const snappedTheta = -Math.PI + lonIndex * deltaLon;

    const snappedLocalPos = new THREE.Vector3(
        Math.cos(snappedPhi) * Math.cos(snappedTheta) * r,
        Math.sin(snappedPhi) * r,
        Math.cos(snappedPhi) * Math.sin(snappedTheta) * r
    );

    return {
        pos: snappedLocalPos,
        key: `${lonIndex}_${latIndex}`
    };
}

let walkCycle = 0;
let playerBounce = 0;
let playerRotY = 0;

// 植えるモーション
let isPlanting = false;
let plantingTimer = 0;
let plantingDuration = 0;
let plantingType = '';
const rotateVelocity = new THREE.Vector2(0, 0);

const clock = new THREE.Clock();

// ==========================================
// メインのアニメーションループ
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    if (!gameStarted) return; // タイトル画面表示中はゲームループを止める


    const delta = clock.getDelta();
    let isMoving = false;

    let dx = 0;
    let dz = 0;

    // 見上げるモード中に移動しようとしたら自動解除する
    if (isLookUpMode && (keys.left || keys.right || keys.up || keys.down)) {
        toggleLookUpMode();
    }

    const isTutorialMovementAllowed = isTutorialShowing && (
        (tutorialDialogIndex === 1 || tutorialDialogIndex === 2 || tutorialDialogIndex === 3) &&
        (tutorialStreamTimeout === null && tutorialSubDialogIndex === TUTORIAL_DIALOGUES[tutorialDialogIndex].length - 1)
    );
    if (isIntroFinished && !isIntroConfirmActive && !isDialogOpen && !isWarpMenuOpen && !isWarping && !isLookUpMode && !isPlanting && (!isTutorialShowing || isTutorialMovementAllowed)) {
        if (keys.left) dx = -1;
        if (keys.right) dx = 1;
        if (keys.up) dz = -1;
        if (keys.down) dz = 1;
    }

    if (dx !== 0 || dz !== 0) {
        isMoving = true;
        const length = Math.sqrt(dx*dx + dz*dz);
        dx = dx / length;
        dz = dz / length;

        // v42: 移動開始でカメラフォーカスを解除
        if (isNotifCameraFocus) cancelNotifCameraFocus();

        const targetAngle = Math.atan2(dx, dz);
        playerRotY = targetAngle;
    }

    // v35: 見上げるモード中はプレイヤーを強制的に画面奥に向かせる
    if (isLookUpMode) {
        playerRotY = Math.PI;
    }

    // チュートリアルでキャラクターが喋っているときは正面を向く
    if (isTutorialShowing) {
        const isInteractiveWaiting = (tutorialDialogIndex === 1 || tutorialDialogIndex === 2 || tutorialDialogIndex === 3) && (tutorialStreamTimeout === null && tutorialSubDialogIndex === TUTORIAL_DIALOGUES[tutorialDialogIndex].length - 1);
        if (!isInteractiveWaiting) {
            playerRotY = 0;
        }
    }

    let diff = playerRotY - player.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.rotation.y += diff * 0.15;

    const targetSpeed = 0.65; 
    
    const targetVelX = -dz * targetSpeed; 
    const targetVelY = dx * targetSpeed;   

    rotateVelocity.x += (targetVelX - rotateVelocity.x) * 0.38;
    rotateVelocity.y += (targetVelY - rotateVelocity.y) * 0.38;

    // 衝突判定用に回転前のクォータニオンをコピーしておく
    const prevAsteroidQuaternion = asteroid.quaternion.clone();
    
    // 回転前のプレイヤーのローカル位置を計算
    const prevLocalTop = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
    asteroid.worldToLocal(prevLocalTop);

    if (Math.abs(rotateVelocity.y) > 0.001) {
        const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotateVelocity.y * delta);
        asteroid.quaternion.premultiply(qZ);
    }
    if (Math.abs(rotateVelocity.x) > 0.001) {
        const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotateVelocity.x * delta);
        asteroid.quaternion.premultiply(qX);
    }

    // 衝突判定と地面の高さ計算
    let activePlatform = null;
    let collided = false;
    let fellInLake = false;

    // 現在のプレイヤーのローカル位置を計算
    // クォータニオン適用後に行列を強制更新し、正確なローカル座標を得る
    asteroid.updateMatrixWorld(true);
    const localTop = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
    asteroid.worldToLocal(localTop);

    const platforms = currentPlanet.platforms || [];
    const lakes = currentPlanet.lakes || [];

    // 高台との衝突判定
    for (let p of platforms) {
        if (!p.localPos) continue;
        const dist = localTop.distanceTo(p.localPos);
        if (dist < p.radius) {
            // 領域内に進入している
            // プレイヤーの高さが高台の高さより少し低い場合は進入不可（登っていない）
            if (playerHeight >= p.height - 0.2) {
                activePlatform = p;
            } else {
                collided = true;
            }
        }
    }

    // 湖との衝突判定（自然な形状の歪みを考慮した判定）
    for (let l of lakes) {
        if (!l.localPos) continue;
        
        const normal = l.localPos.clone().normalize();
        
        // 投影用基準軸の作成
        let binormal = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
        if (binormal.lengthSq() < 0.01) {
            binormal = new THREE.Vector3(1, 0, 0).projectOnPlane(normal).normalize();
        }
        const tangent = new THREE.Vector3().crossVectors(normal, binormal).normalize();

        // 1. 移動後の判定
        const toPlayer = localTop.clone().sub(l.localPos);
        const proj = toPlayer.clone().projectOnPlane(normal);
        const dist2D = proj.length();
        const px = proj.dot(binormal);
        const py = proj.dot(tangent);
        const angle = Math.atan2(py, px);
        const noise = 1 + 0.15 * Math.sin(angle * 3) + 0.08 * Math.cos(angle * 5) + 0.04 * Math.sin(angle * 7);
        const actualRadius = l.radius * noise;

        if (dist2D < actualRadius) {
            // 領域内に進入している
            // 2. 移動前の判定
            const toPlayerPrev = prevLocalTop.clone().sub(l.localPos);
            const projPrev = toPlayerPrev.clone().projectOnPlane(normal);
            const dist2DPrev = projPrev.length();
            const pxPrev = projPrev.dot(binormal);
            const pyPrev = projPrev.dot(tangent);
            const anglePrev = Math.atan2(pyPrev, pxPrev);
            const noisePrev = 1 + 0.15 * Math.sin(anglePrev * 3) + 0.08 * Math.cos(anglePrev * 5) + 0.04 * Math.sin(anglePrev * 7);
            const actualRadiusPrev = l.radius * noisePrev;
            
            const wasOutside = dist2DPrev >= actualRadiusPrev;

            // プレイヤーが空中にいない（着地している）かつ、移動前が湖の外だった場合は進入不可（衝突）
            if (playerHeight <= 0.1) {
                if (wasOutside) {
                    collided = true;
                } else {
                    fellInLake = true;
                }
            }
        }
    }

    if (collided) {
        // 移動を巻き戻す
        asteroid.quaternion.copy(prevAsteroidQuaternion);
        rotateVelocity.set(0, 0);
        
        // 巻き戻した後の正しいローカル位置を再計算
        localTop.set(0, ASTEROID_RADIUS, 0);
        asteroid.worldToLocal(localTop);
        
        activePlatform = null;
        for (let p of platforms) {
            if (!p.localPos) continue;
            const dist = localTop.distanceTo(p.localPos);
            if (dist < p.radius && playerHeight >= p.height - 0.2) {
                activePlatform = p;
            }
        }
        
        if (fellInLake) {
            triggerLakeSplash(localTop);
        }
    }

    // 現在の地面の高さを決定
    const groundHeight = activePlatform ? activePlatform.height : 0;

    // 宇宙大ジャンプの物理計算 (惑星固有重力 & ホバー対応)
    let isHovering = false;
    const gravity = currentPlanet.gravity !== undefined ? currentPlanet.gravity : 25.0;

    // 高台から歩いて踏み外した場合、自由落下を開始する
    if (!isJumping && playerHeight > groundHeight) {
        isJumping = true;
        playerJumpVel = 0;
    }

    if (isJumping) {
        // 落下中（playerJumpVel <= 0）にのみSpace長押しでブースターホバー可能
        if (keys.space && !isWarping && playerJumpVel <= 0) {
            isHovering = true;
            playerHeight += playerJumpVel * delta;
            
            // 落下中の速度であっても、スムーズにまろやかな滞空下降速度へと補間する
            const targetHoverVel = -0.8;
            playerJumpVel = THREE.MathUtils.lerp(playerJumpVel, targetHoverVel, 6.0 * delta);
        } else {
            playerHeight += playerJumpVel * delta;
            playerJumpVel -= gravity * delta; 
        }

        if (playerHeight <= groundHeight) {
            playerHeight = groundHeight;
            playerJumpVel = 0;
            isJumping = false;
            playLandSound(); 
            
            const localPlayerPos = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
            asteroid.worldToLocal(localPlayerPos);
            spawnFootstepStardust(localPlayerPos);
        }
    }

    if (isHovering) {
        startThrusterSound();
        spawnJetParticles();
    } else {
        stopThrusterSound();
    }

    // ホバーパーティクルの更新
    for (let i = hoverParticles.length - 1; i >= 0; i--) {
        const p = hoverParticles[i];
        p.age += delta;

        if (p.age >= p.maxAge) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            hoverParticles.splice(i, 1);
            continue;
        }

        p.mesh.position.addScaledVector(p.vel, delta);

        const progress = p.age / p.maxAge;
        const scale = 1.0 - progress;
        p.mesh.scale.set(scale, scale, scale);
        p.mesh.material.opacity = 0.9 * (1.0 - progress);
    }

    // キラキラ/足元スターダスト粒子の更新
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.age += delta;

        if (p.age >= p.maxAge) {
            asteroid.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            activeParticles.splice(i, 1);
            continue;
        }

        p.angle += p.rotSpeed * delta;
        const progress = p.age / p.maxAge;
        
        const upVec = new THREE.Vector3(0, 1, 0);
        let rightVec = new THREE.Vector3().crossVectors(p.dir, upVec).normalize();
        if (rightVec.lengthSq() < 0.01) {
            rightVec = new THREE.Vector3(1, 0, 0);
        }
        const forwardVec = new THREE.Vector3().crossVectors(p.dir, rightVec).normalize();

        p.mesh.position.addScaledVector(p.dir, p.speed * delta);
        if (p.spiralRadius > 0) {
            p.mesh.position.addScaledVector(rightVec, Math.cos(p.angle) * 0.03);
            p.mesh.position.addScaledVector(forwardVec, Math.sin(p.angle) * 0.03);
        }

        p.mesh.material.opacity = 0.9 * (1.0 - progress);
        const s = 1.0 - progress * 0.5;
        p.mesh.scale.set(s, s, s);
    }

    // 配置インジケータ
    const snapData = getSnappedLocalData();
    gridIndicator.position.copy(snapData.pos);
    const snapNormal = snapData.pos.clone().normalize();
    gridIndicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), snapNormal);
    gridIndicator.position.addScaledVector(snapNormal, 0.04);

    if (currentPlanet.plantedGridCells.has(snapData.key)) {
        gridIndicator.material.color.setHex(0xff5c8a);
        gridIndicator.material.opacity = 0.6;
    } else {
        gridIndicator.material.color.setHex(0xffffff);
        gridIndicator.material.opacity = 0.55;
    }

    // 宇宙ワープポータルコアのフワフワ＆自転アニメーション
    const coreRing = warpPortalGroup.getObjectByName("coreRing");
    if (coreRing) {
        coreRing.rotation.z += delta * 1.8;
        coreRing.rotation.x = Math.sin(clock.getElapsedTime() * 2.0) * 0.15;
    }
    const coreSphere = warpPortalGroup.getObjectByName("coreSphere");
    if (coreSphere) {
        const floatScale = 1.0 + Math.sin(clock.getElapsedTime() * 4.0) * 0.08;
        coreSphere.scale.setScalar(floatScale);
    }

    // 遠景ガス巨大惑星のゆっくり自転
    if (gasGiantGroup) {
        gasGiantGroup.children[0].rotation.y += delta * 0.015;
    }

    // 流星の更新
    updateShootingStars(delta);

    // v35: 見上げるモード中のプレイヤーの頭部・バイザーの回転制御
    const playerHead = player.getObjectByName("head");
    const playerVisor = player.getObjectByName("visor");
    if (playerHead && playerVisor) {
        if (isLookUpMode) {
            // 上空を見上げる角度に補間（頭部を後ろに倒し、バイザーをやや上に傾ける）
            playerHead.rotation.x += (-Math.PI / 3.0 - playerHead.rotation.x) * 0.15;
            playerVisor.rotation.x += ((Math.PI / 2.5 - Math.PI / 3.0) - playerVisor.rotation.x) * 0.15;
        } else {
            // 通常角度に戻す
            playerHead.rotation.x += (0 - playerHead.rotation.x) * 0.15;
            playerVisor.rotation.x += (Math.PI / 2.5 - playerVisor.rotation.x) * 0.15;
        }
    }

    const leftLeg = player.getObjectByName("leftLeg");
    const rightLeg = player.getObjectByName("rightLeg");
    const leftArm = player.getObjectByName("leftArm");
    const rightArm = player.getObjectByName("rightArm");

    // 歩行アニメーション
    if (isMoving) {
        const prevWalkCycle = walkCycle;
        walkCycle += delta * 11;
        
        leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
        rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
        leftArm.position.z = -Math.sin(walkCycle) * 0.2;
        rightArm.position.z = Math.sin(walkCycle) * 0.2;
        leftArm.position.y = 0.55 + Math.cos(walkCycle * 2) * 0.05;
        rightArm.position.y = 0.55 + Math.cos(walkCycle * 2) * 0.05;

        playerGroup.position.set(0, ASTEROID_RADIUS + playerHeight, 0);
        if (!isJumping) {
            playerGroup.position.y += Math.abs(Math.sin(walkCycle)) * 0.12;
        }

        const stepInterval = Math.PI;
        const prevStep = Math.floor(prevWalkCycle / stepInterval);
        const currStep = Math.floor(walkCycle / stepInterval);
        if (currStep > prevStep && !isJumping) {
            playFootstep(1.0);
            
            const localPlayerPos = new THREE.Vector3(0, ASTEROID_RADIUS, 0);
            asteroid.worldToLocal(localPlayerPos);
            spawnFootstepStardust(localPlayerPos);
            
            // 足元に生えている草がある場合、10%の確率で草のタネを獲得
            let onGrass = false;
            for (let i = 0; i < grassClumps.length; i++) {
                const gc = grassClumps[i];
                if (gc.scale > 0.1) {
                    const dist = localPlayerPos.distanceTo(gc.mesh.position);
                    if (dist < 1.2) {
                        onGrass = true;
                        break;
                    }
                }
            }
            if (onGrass && Math.random() < 0.10) {
                playerInventory.grassSeeds++;
                showVillagerNotification(`🌾 足元から「草のタネ」を拾った！ (所持数: ${playerInventory.grassSeeds})`);
                updateStatsUI();
            }
        }
    } else if (isPlanting) {
        // 植えるモーション
        walkCycle = 0;
        plantingTimer -= delta;
        const plantProgress = 1.0 - Math.max(0, plantingTimer / plantingDuration);
        // 前半：腕を前に伸ばし前傾き、後半：元に戻す
        const phase = Math.sin(plantProgress * Math.PI); // 0→1→0 の波
        const armReach = phase * 0.55; // 腕を前に伸ばす量
        const bodyTilt = phase * 0.35; // 前傾き
        const legBend  = phase * 0.4;  // 膝を軽く曲げる（足を後ろに引く）

        leftArm.position.z  += (-armReach - leftArm.position.z)  * 0.18;
        rightArm.position.z += (-armReach - rightArm.position.z) * 0.18;
        leftArm.position.y  += (0.3 - leftArm.position.y)  * 0.12;
        rightArm.position.y += (0.3 - rightArm.position.y) * 0.12;
        leftArm.rotation.x  += (bodyTilt - leftArm.rotation.x)  * 0.18;
        rightArm.rotation.x += (bodyTilt - rightArm.rotation.x) * 0.18;
        leftLeg.rotation.x  += (-legBend - leftLeg.rotation.x)  * 0.18;
        rightLeg.rotation.x += (legBend  - rightLeg.rotation.x) * 0.18;

        playerGroup.position.set(0, ASTEROID_RADIUS + playerHeight - phase * 0.08, 0);

        if (plantingTimer <= 0) {
            // モーション完了→実際に植える
            isPlanting = false;
            plantingTimer = 0;
            leftArm.rotation.x  = 0;
            rightArm.rotation.x = 0;
            plantObjectAtGrid(plantingType);
        }
    } else {
        walkCycle = 0;
        leftLeg.rotation.x += (0 - leftLeg.rotation.x) * 0.15;
        rightLeg.rotation.x += (0 - rightLeg.rotation.x) * 0.15;
        leftArm.position.z += (0 - leftArm.position.z) * 0.15;
        rightArm.position.z += (0 - rightArm.position.z) * 0.15;
        leftArm.position.y += (0.5 - leftArm.position.y) * 0.15;
        rightArm.position.y += (0.5 - rightArm.position.y) * 0.15;
        leftArm.rotation.x  += (0 - leftArm.rotation.x)  * 0.15;
        rightArm.rotation.x += (0 - rightArm.rotation.x) * 0.15;

        const floatSpeed = (isDialogOpen || isWarpMenuOpen || isTutorialShowing) ? 0.8 : 1.8;
        const floatAmp = (isDialogOpen || isWarpMenuOpen || isTutorialShowing) ? 0.01 : 0.025;
        
        playerGroup.position.set(0, ASTEROID_RADIUS + playerHeight, 0);
        if (!isJumping) {
            if (isIntroDialogShowing || isTutorialShowing) {
                if (introStreamTimeout !== null || tutorialStreamTimeout !== null) {
                    // 文字送り中：かわいくぴょこぴょこ跳ねる＆腕をパタパタ
                    const bouncePhase = clock.getElapsedTime() * 18;
                    playerGroup.position.y += Math.abs(Math.sin(bouncePhase)) * 0.12;
                    playerGroup.rotation.z = Math.sin(bouncePhase) * 0.06;
                    
                    leftArm.position.y += Math.sin(bouncePhase) * 0.08;
                    rightArm.position.y += Math.sin(bouncePhase) * 0.08;
                    leftArm.rotation.z = -0.15 - Math.abs(Math.sin(bouncePhase)) * 0.2;
                    rightArm.rotation.z = 0.15 + Math.abs(Math.sin(bouncePhase)) * 0.2;
                } else {
                    // セリフ表示完了：左右にかわいく体をゆらす
                    const tiltPhase = clock.getElapsedTime() * 4.5;
                    playerGroup.rotation.z = Math.sin(tiltPhase) * 0.07;
                    playerGroup.position.y += Math.abs(Math.sin(tiltPhase)) * 0.02;
                    
                    leftArm.rotation.z = -0.1;
                    rightArm.rotation.z = 0.1;
                }
            } else {
                playerGroup.rotation.z += (0 - playerGroup.rotation.z) * 0.15;
                leftArm.rotation.z += (0 - leftArm.rotation.z) * 0.15;
                rightArm.rotation.z += (0 - rightArm.rotation.z) * 0.15;
                playerGroup.position.y += Math.sin(clock.getElapsedTime() * floatSpeed) * floatAmp;
            }
        }
    }

    if (playerBounce > 0.005) {
        playerGroup.position.y += playerBounce;
        playerBounce *= 0.84;
    }

    // 雑草の生長
    let grassChanged = false;
    for (let i = 0; i < grassClumps.length; i++) {
        const gc = grassClumps[i];
        if (Math.abs(gc.scale - gc.targetScale) > 0.001) {
            gc.scale += (gc.targetScale - gc.scale) * 0.08;
            gc.mesh.scale.set(gc.scale, gc.scale, gc.scale);
            grassChanged = true;
        }
        
        if (gc.scale > 0.01) {
            gc.age += delta;
            gc.mesh.rotation.z = Math.sin(gc.age * 1.5 + i) * 0.02;
            gc.mesh.rotation.x = Math.cos(gc.age * 1.2 + i) * 0.015;
        }
    }
    if (grassChanged) {
        updateStatsUI();
    }

    // 植えた宇宙植物のゆらゆら
    const plants = currentPlanet.plants;
    for (let i = 0; i < plants.length; i++) {
        const p = plants[i];
        if (p.scale < p.targetScale) {
            p.scale += (p.targetScale - p.scale) * 0.12;
            p.mesh.scale.set(p.scale, p.scale, p.scale);
            
            if (p.light) {
                p.light.intensity = 1.8 * (p.scale / p.targetScale);
            }
        }
        
        p.age += delta;
        p.visualGroup.rotation.z = Math.sin(p.age * 1.8 + i) * 0.035;
        p.visualGroup.rotation.x = Math.cos(p.age * 1.3 + i) * 0.02;
        p.visualGroup.rotation.y = Math.sin(p.age * 0.5 + i) * 0.04;

        // キラキラ粒子の舞い散り
        if (p.scale > p.targetScale * 0.8) {
            spawnPlantSparks(p.localPos, p.type);
        }
    }

    // 果物の時間経過成長・結実ループの更新
    updateFruits(delta);

    // 昼夜サイクル更新
    updateDayNight(delta);

    // 星空のきらめき更新
    updateStarfield(delta);


    // 各種AIとリッチエフェクト更新
    updateRevisitorSpawn(delta);
    updateVillagers(delta);
    updateAdorationParticles(delta);
    updateEmotions(delta);
    updatePlantSparks(delta);
    updateStarbursts(delta);
    updateRocketParticles(delta);
    updateGrassSeeds(delta);

    // v35: 見上げる用の宇宙演出とインタラクションの更新
    updateLookUpAssets(delta);
    updateLookUpInteraction();

    checkVillagerProximity();

    // ==========================================
    // 快適化：グローバル正面固定カメラワーク (ジャンプ連動ズーム & 見上げる対応)
    // ==========================================
    const cameraBaseY = ASTEROID_RADIUS + 4.5;
    const cameraBaseZ = 8.5;

    let targetCameraY = cameraBaseY + playerHeight * 0.52;
    let targetCameraZ = cameraBaseZ + playerHeight * 0.82;
    let lookAtTarget = new THREE.Vector3(0, ASTEROID_RADIUS + 0.5 + playerHeight * 0.42, 0);

    if (isLookUpMode) {
        // V48: 宇宙と地面の比率を写真に完璧に合わせる（仰角を約13度、Z距離を4.5にしてキャラクターの足元と地平線を画面下から約14%の位置に調整）
        targetCameraY = ASTEROID_RADIUS + 0.8 + playerHeight * 0.52; // 地面より少し上の高さ
        targetCameraZ = 4.5 + playerHeight * 0.82; // 写真のキャラクターサイズに合わせた中距離
        lookAtTarget.set(0, ASTEROID_RADIUS + 4.2 + playerHeight * 0.42, -10.0); // 仰角を急にしてキャラクターと地平線を画面下部に配置
    } else if (isWarping && camera.position.y > ASTEROID_RADIUS + 10) {
        targetCameraY = camera.position.y;
        targetCameraZ = camera.position.z;
    }
    
    // プレイヤーの表情更新
    let nextExpression = "NORMAL";
    if (isWarping) {
        nextExpression = "WARPING";
    } else if (isPlanting) {
        nextExpression = "PLANTING";
    } else if (isJumping) {
        nextExpression = "JUMPING";
    } else if (isMoving) {
        nextExpression = "WALKING";
    } else if (isIntroDialogShowing || isTutorialShowing) {
        if (introStreamTimeout !== null || tutorialStreamTimeout !== null) {
            nextExpression = "TALKING";
        } else {
            nextExpression = "NORMAL";
        }
    } else if (isDialogOpen) {
        nextExpression = "TALKING";
    } else {
        nextExpression = "NORMAL";
    }

    // 瞬きアニメーションの制御
    if (nextExpression === "NORMAL") {
        timeSinceLastBlink += delta;
        if (isBlinking) {
            blinkTimer -= delta;
            if (blinkTimer <= 0) {
                isBlinking = false;
                timeSinceLastBlink = 0;
                nextBlinkTime = 1.5 + Math.random() * 4.0;
            } else {
                nextExpression = "BLINK";
            }
        } else {
            if (timeSinceLastBlink >= nextBlinkTime) {
                isBlinking = true;
                blinkTimer = blinkDuration;
            }
        }
    } else {
        isBlinking = false;
    }

    if (nextExpression !== lastExpression) {
        drawPlayerFace(nextExpression);
        lastExpression = nextExpression;
    }
    
    camera.position.y += (targetCameraY - camera.position.y) * 0.14;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.14;

    // 見上げるモード中はカメラの微細な揺れを少し抑える
    const shakeSpeed = isLookUpMode ? 0.15 : 0.45;
    const shakeAmp = isLookUpMode ? 0.04 : 0.14;
    camera.position.x = Math.sin(clock.getElapsedTime() * shakeSpeed) * shakeAmp;

    if (!isLookUpMode) {
        camera.position.y += Math.cos(clock.getElapsedTime() * 0.6) * 0.006; 
    }

    // v42: 住人通知クリック時のカメラフォーカス
    if (isNotifCameraFocus && notifFocusVillager && notifFocusVillager.group) {
        const vWorldPos = new THREE.Vector3();
        notifFocusVillager.group.getWorldPosition(vWorldPos);
        
        // カメラを住人の方向に向ける（lookAt）
        // 住人のワールド座標から少し上を見る
        const focusLookAt = vWorldPos.clone().addScaledVector(
            vWorldPos.clone().normalize(), 1.2
        );
        camera.lookAt(focusLookAt);
        
        renderer.render(scene, camera);
        return;
    }

    camera.lookAt(lookAtTarget);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ==========================================
// 操作説明パネルの自動折りたたみ＆手動クリックトグル
// ==========================================
let controlPanelTimer = null;

function initControlPanelCollapse() {
    const panel = document.querySelector('.control-panel');
    if (!panel) return;
    
    function startCollapseTimer() {
        if (controlPanelTimer) clearTimeout(controlPanelTimer);
        controlPanelTimer = setTimeout(() => {
            panel.classList.add('collapsed');
        }, 6000); // 6秒後に自動折りたたみ
    }
    
    // 初回読み込み時にタイマー開始
    startCollapseTimer();
    
    panel.addEventListener('click', (e) => {
        panel.classList.toggle('collapsed');
        
        // 開いたときは再び自動で折りたたむタイマーをセット
        if (!panel.classList.contains('collapsed')) {
            startCollapseTimer();
        } else {
            if (controlPanelTimer) clearTimeout(controlPanelTimer);
        }
    });
}

// ==========================================
// タイトル画面ロジック
// ==========================================
let gameStarted = false;

function createTitleStars() {
    const container = document.getElementById('title-stars');
    if (!container) return;
    for (let i = 0; i < 120; i++) {
        const star = document.createElement('div');
        star.className = 'title-star';
        const size = 1 + Math.random() * 3;
        star.style.cssText = [
            `width:${size}px`, `height:${size}px`,
            `top:${Math.random()*100}%`, `left:${Math.random()*100}%`,
            `--dur:${2 + Math.random()*4}s`,
            `--op:${0.4 + Math.random()*0.6}`,
            `animation-delay:${Math.random()*4}s`
        ].join(';');
        container.appendChild(star);
    }
}

function startGame(isContinue = false) {
    if (gameStarted) return;
    gameStarted = true;

    initAudio();

    const titleEl = document.getElementById('title-screen');
    const uiEl    = document.getElementById('ui-container');

    titleEl.classList.add('fade-out');
    setTimeout(() => {
        titleEl.style.display = 'none';
        uiEl.style.display = 'block';
        if (isContinue) {
            isIntroFinished = true;
            rebuildCurrentPlanetScene();
        } else {
            // 導入ダイアログを表示
            setTimeout(showIntroDialogue, 600);
        }
    }, 800);
}

// ==========================================
// 導入ダイアログ（ロボットの使命説明）
// ==========================================
const INTRO_DIALOGUES = [
    "やあ、はじめまして！ぼくの名前は「コスモ」。未開の惑星を緑化する使命を持ったロボットさ。",
    "宇宙にはまだ、だれにも開拓されていない小惑星がたくさんある。荒れた岩だらけの星をさ……",
    "花や木が咲き誇る、美しい星に変えること——それがぼくたちの使命なんだ。",
    "そして今回は、きみに一緒にやってほしいことがあって。花を植えたり、木を育てたりすることで、この星に命を吹き込んでほしいんだ。",
    "そのうち、緑の美しさに惹かれた住人たちもやってくるはずさ。一緒に、素敵な星を作ろう！よろしくね！"
];
let introDialogIndex = 0;
let introStreamTimeout = null;
let introStreamIndex = 0;
let introCurrentText = "";

function showIntroDialogue() {
    isIntroDialogShowing = true;
    dialogBoxEl.classList.remove('dialog-finished');
    introDialogIndex = 0;
    dialogSpeakerEl.textContent = "🤖 コスモ";
    dialogOptionsEl.style.display = "none";
    if (btnSkipIntroEl) btnSkipIntroEl.style.display = "block"; // スキップボタンを表示
    dialogTipEl.textContent = "クリックまたはEキーで次へ";
    dialogBoxEl.style.display = "block";
    _streamIntroText();
}

function _streamIntroText() {
    introCurrentText = INTRO_DIALOGUES[introDialogIndex];
    introStreamIndex = 0;
    dialogTextEl.textContent = "";
    _introNextChar();
}

function _introNextChar() {
    if (!isIntroDialogShowing) return;
    if (introStreamIndex < introCurrentText.length) {
        dialogTextEl.textContent += introCurrentText[introStreamIndex];
        introStreamIndex++;
        introStreamTimeout = setTimeout(_introNextChar, 45);
    } else {
        introStreamTimeout = null;
        dialogBoxEl.classList.add('dialog-finished');
        // 最後のセリフなら「確認へ」に変更
        if (introDialogIndex === INTRO_DIALOGUES.length - 1) {
            dialogTipEl.textContent = "クリックまたはEキーで確認へ";
        }
    }
}

function advanceIntroDialogue() {
    if (!isIntroDialogShowing) return;
    // ストリーム中なら即全文表示
    if (introStreamTimeout !== null) {
        clearTimeout(introStreamTimeout);
        introStreamTimeout = null;
        dialogTextEl.textContent = introCurrentText;
        dialogBoxEl.classList.add('dialog-finished');
        if (introDialogIndex === INTRO_DIALOGUES.length - 1) {
            dialogTipEl.textContent = "クリックまたはEキーで確認へ";
        }
        return;
    }
    // 次のセリフへ
    introDialogIndex++;
    dialogBoxEl.classList.remove('dialog-finished');
    if (introDialogIndex >= INTRO_DIALOGUES.length) {
        // 終了
        isIntroDialogShowing = false;
        isIntroFinished = true;
        if (btnSkipIntroEl) btnSkipIntroEl.style.display = "none"; // スキップボタン非表示
        showTutorialConfirm();
        return;
    }
    dialogTipEl.textContent = "クリックまたはEキーで次へ";
    _streamIntroText();
}

// 導入をスキップする処理
function skipIntro() {
    if (!isIntroDialogShowing) return;
    if (introStreamTimeout !== null) {
        clearTimeout(introStreamTimeout);
        introStreamTimeout = null;
    }
    isIntroDialogShowing = false;
    isIntroFinished = true;
    if (btnSkipIntroEl) btnSkipIntroEl.style.display = "none";
    showTutorialConfirm();
}

// チュートリアルを始めるか確認するフェーズ
function showTutorialConfirm() {
    isIntroConfirmActive = true;
    dialogBoxEl.classList.remove('dialog-finished');
    dialogSpeakerEl.textContent = "🤖 コスモ";
    dialogTextEl.textContent = "ゲームの基本的な遊び方を覚えるために、チュートリアルを始めますか？";
    dialogTipEl.textContent = "選択肢を選んでね";
    
    // 選択肢ボタンのテキストを変更
    optYesEl.textContent = "チュートリアルを始める";
    optNoEl.textContent = "スキップして自由に遊ぶ";
    
    dialogOptionsEl.style.display = "flex";
    dialogBoxEl.style.display = "block";
}

// イベントリスナーの登録
if (btnSkipIntroEl) {
    btnSkipIntroEl.addEventListener('click', (e) => {
        e.stopPropagation();
        skipIntro();
    });
}

// ==========================================
// チュートリアルダイアログ
// ==========================================
const TUTORIAL_DIALOGUES = [
    [
        "やあ！この星の緑化に興味を持ってくれて嬉しいな！",
        "実際に操作しながら植物の植え方を覚えてみよう！"
    ],
    [
        "まずは【花】の植え方だよ。",
        "地面に立っているときに『Rキー』を押すか、画面下の『🌸 花を植える』ボタンを押してね。",
        "実際に花を1つ植えてみてね！"
    ],
    [
        "よくできたね！次は【木】の植え方だよ。",
        "地面に立っているときに『Tキー』を押すか、画面下の『🌳 木を植える』ボタンを押して、木を1つ植えてみてね。",
        "木が育つと美味しい果物が実るよ！"
    ],
    [
        "バッチリだね！最後は【草】の植え方だよ！",
        "ジャンプ（Spaceキー）中に『Rキー』か『Tキー』を押すか、画面下のボタンを押して、草のタネを発射してね！",
        "タネが地面に届くと草が生えるよ！"
    ],
    [
        "素晴らしい！植物の植え方はこれで完璧だね！",
        "そうそう、植えるための【花のタネ】や【木の苗】は、この星に遊びに来てくれた住人に話しかけると、たまにお裾分けとしてプレゼントしてもらえるんだよ。",
        "そして【草のタネ】は、すでに生えている草の上を歩いていると、たまに足元から拾って補充することができるんだ。",
        "この星に花や木をたくさん植えて綺麗にしていると、その美しさに惹かれて宇宙から誰かが遊びに来てくれるかもしれないよ。",
        "その人がこの星を気に入れば、そのまま住人になってくれるはずさ！",
        "色々な植物をたくさん植えて、素敵な惑星にしようね！"
    ]
];
let tutorialDialogIndex = 0;
let tutorialSubDialogIndex = 0;
let tutorialStreamTimeout = null;
let tutorialStreamIndex = 0;
let tutorialCurrentText = "";

let hasPlayedTutorial = localStorage.getItem('hasPlayedTutorial') === 'true';
let isTutorialModeSelectActive = false;
let isTutorialTextOnlyMode = false;

function showTutorialModeSelect() {
    isTutorialModeSelectActive = true;
    dialogBoxEl.classList.remove('dialog-finished');
    dialogSpeakerEl.textContent = "🤖 コスモ";
    dialogTextEl.textContent = "チュートリアルは2回目以降です。どのように進めますか？";
    dialogTipEl.textContent = "選択肢を選んでね";
    
    optYesEl.textContent = "文字で内容を確認する";
    optNoEl.textContent = "もう一度体験する";
    
    dialogOptionsEl.style.display = "flex";
    dialogBoxEl.style.display = "block";
}

function showTutorialDialogue() {
    if (isWarping || isDialogOpen || isArrivalDialogueShowing || isWarpMenuOpen || isIntroDialogShowing || isTutorialShowing) return;
    
    isTutorialShowing = true;
    dialogBoxEl.classList.remove('dialog-finished');
    tutorialDialogIndex = 0;
    tutorialSubDialogIndex = 0;
    dialogSpeakerEl.textContent = "🤖 コスモ";
    dialogOptionsEl.style.display = "none";
    dialogTipEl.textContent = "クリックまたはEキーで次へ";
    dialogBoxEl.style.display = "block";
    
    // チュートリアルボタンのアクティブクラス付与とテキスト変更
    if (btnTutorialEl) {
        btnTutorialEl.classList.add('active');
        btnTutorialEl.innerHTML = '<span class="btn-icon">❌</span> チュートリアルをやめる';
    }
    
    _streamTutorialText();
}

function _streamTutorialText() {
    tutorialCurrentText = TUTORIAL_DIALOGUES[tutorialDialogIndex][tutorialSubDialogIndex];
    tutorialStreamIndex = 0;
    dialogTextEl.textContent = "";
    _tutorialNextChar();
}

function _tutorialNextChar() {
    if (!isTutorialShowing) return;
    if (tutorialStreamIndex < tutorialCurrentText.length) {
        dialogTextEl.textContent += tutorialCurrentText[tutorialStreamIndex];
        tutorialStreamIndex++;
        tutorialStreamTimeout = setTimeout(_tutorialNextChar, 45);
    } else {
        tutorialStreamTimeout = null;
        dialogBoxEl.classList.add('dialog-finished');
        updateTutorialTip();
    }
}

function updateTutorialTip() {
    const isLastSub = (tutorialSubDialogIndex === TUTORIAL_DIALOGUES[tutorialDialogIndex].length - 1);
    if (!isLastSub) {
        dialogTipEl.textContent = "クリックまたはEキーで次へ";
        return;
    }

    if (isTutorialTextOnlyMode) {
        if (tutorialDialogIndex === 4) {
            dialogTipEl.textContent = "クリックまたはEキーで閉じる";
        } else {
            dialogTipEl.textContent = "クリックまたはEキーで次へ";
        }
        return;
    }

    if (tutorialDialogIndex === 0) {
        dialogTipEl.textContent = "クリックまたはEキーで次へ";
    } else if (tutorialDialogIndex === 1) {
        dialogTipEl.textContent = "🌸 実際に花を植えてみてね！";
    } else if (tutorialDialogIndex === 2) {
        dialogTipEl.textContent = "🌳 実際に木を植えてみてね！";
    } else if (tutorialDialogIndex === 3) {
        dialogTipEl.textContent = "🌱 空中でRまたはTを押して、草のタネをまいてみてね！";
    } else if (tutorialDialogIndex === 4) {
        dialogTipEl.textContent = "クリックまたはEキーで閉じる";
    }
}

function stopTutorial() {
    isTutorialShowing = false;
    isTutorialTextOnlyMode = false;
    dialogBoxEl.style.display = "none";
    dialogBoxEl.classList.remove('dialog-finished');
    if (btnTutorialEl) {
        btnTutorialEl.classList.remove('active');
        btnTutorialEl.innerHTML = '<span class="btn-icon">🔰</span> チュートリアル';
    }
    if (tutorialStreamTimeout !== null) {
        clearTimeout(tutorialStreamTimeout);
        tutorialStreamTimeout = null;
    }
}

function advanceTutorialDialogue(fromIndex) {
    if (!isTutorialShowing) return;
    if (fromIndex !== undefined && tutorialDialogIndex !== fromIndex) return;
    // ストリーム中なら即全文表示
    if (tutorialStreamTimeout !== null) {
        clearTimeout(tutorialStreamTimeout);
        tutorialStreamTimeout = null;
        dialogTextEl.textContent = tutorialCurrentText;
        dialogBoxEl.classList.add('dialog-finished');
        updateTutorialTip();
        return;
    }
    
    // 現在のフェーズにまだ次のページがある場合は、次のページに進む
    const maxSubIndex = TUTORIAL_DIALOGUES[tutorialDialogIndex].length - 1;
    if (tutorialSubDialogIndex < maxSubIndex) {
        tutorialSubDialogIndex++;
        dialogBoxEl.classList.remove('dialog-finished');
        _streamTutorialText();
        return;
    }
    
    // 課題フェーズ（1, 2, 3）かつ最後のページではプレイヤーの操作による自動進行のみ許可（キー/クリック送り無効）
    if (!isTutorialTextOnlyMode && fromIndex === undefined && (tutorialDialogIndex === 1 || tutorialDialogIndex === 2 || tutorialDialogIndex === 3)) {
        return;
    }
    
    // 次のセリフへ
    tutorialDialogIndex++;
    tutorialSubDialogIndex = 0;
    dialogBoxEl.classList.remove('dialog-finished');
    if (tutorialDialogIndex >= TUTORIAL_DIALOGUES.length) {
        // 終了
        hasPlayedTutorial = true;
        localStorage.setItem('hasPlayedTutorial', 'true');
        stopTutorial();
        saveGame(false);
        return;
    }
    _streamTutorialText();
}

const titleScreen = document.getElementById('title-screen');
const btnStart    = document.getElementById('btn-start');

if (btnStart) {
    btnStart.addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
}
if (titleScreen) {
    titleScreen.addEventListener('click', startGame);
}
window.addEventListener('keydown', (e) => {
    if (!gameStarted && (e.key === 'Enter' || e.key === ' ')) startGame();
});

createTitleStars();

// ==========================================
// 来星セリフ演出
// ==========================================
let arrivalDialogueQueue = [];
let isArrivalDialogueShowing = false;

const ARRIVAL_DIALOGUES = {
    cat: [
        `この星の植物たちがすごく美しくてニャ！遠くからでも輝きが見えたニャ！移り住んでいい？`,
        `ここの空気、すっごく澄んでるニャ！君が丹精込めて育てた星だってすぐわかったニャ！よろしくニャ！`,
        `旅してたら、キラキラ輝く星を見つけたニャ！こんなに綺麗な惑星、見たことないニャ！`
    ],
    rabbit: [
        `遠くからでも君の星のキラキラが見えたピョン！植物がたくさんあって、飛び回りたくなっちゃったピョン！`,
        `こんなに緑と花がいっぱいの星、どこにもないピョン！ここに住みたくてピョンピョン飛んできたピョン！`,
        `うわぁ！すごく綺麗な星だピョン！君が開拓したって聞いて、絶対来たかったんだピョン！`
    ],
    dog: [
        `ワン！この星の植物から漂ういい匂いに引き寄せられてきたワン！君のセンスに大感動ワン！`,
        `クンクン……こんなにいい匂いがする星は初めてだワン！植えてくれた木と花がすごいワン！`,
        `ワンワン！宇宙を旅してたら、ひときわ輝く星を見つけたワン！それが君の星だったワン！`
    ],
    bear: [
        `ふむ。これほど丁寧に開拓された星は、宇宙広しといえどもなかなかないクマ。感服したクマ。`,
        `旅の途中で、とても美しい光を放つ小惑星を見つけたクマ。君が育てた植物たちの光だったクマ。`,
        `うむ、この惑星の植物たちの美しさは格別クマ。ぜひここで暮らさせてほしいクマ。`
    ],
    bee: [
        `お花のいい香りに誘われて飛んできたブーン！この綺麗なお花畑に定住させてほしいブーン！`,
        `遠くからでもお花の輝きが見えたブーン！木はなくてもお花があれば大満足だブーン！`,
        `ブーン！こんなに見事なお花畑、見たことないブーン！ここに住みたいブーン！`
    ],
    koala: [
        `おや、木がたくさんあって居心地がよさそうな星だコアラ.ゆっくりしていってもいいコアラ？`,
        `花はないけれど、大きな木がたくさんあって木登りがはかどりそうだコアラ.よろしくコアラ。`,
        `ふあぁ……この木陰、最高のお昼寝スポットだコアラ.ここに住みたいコアラ。`
    ]
};

let arrivalAutoCloseTimeout = null;

function showArrivalDialogue(typeData, instance) {
    // 会話中や別のセリフ演出中は少し遅らせてキューに積む
    if (isDialogOpen || isArrivalDialogueShowing) {
        arrivalDialogueQueue.push({ typeData, instance });
        setTimeout(processArrivalQueue, 3000);
        return;
    }
    displayArrivalDialogue(typeData, instance);
}

function processArrivalQueue() {
    if (isDialogOpen || isArrivalDialogueShowing || arrivalDialogueQueue.length === 0) return;
    const { typeData, instance } = arrivalDialogueQueue.shift();
    displayArrivalDialogue(typeData, instance);
}

function closeArrivalDialogueDirectly() {
    if (!isArrivalDialogueShowing) return;
    isArrivalDialogueShowing = false;
    
    if (arrivalToastEl) {
        arrivalToastEl.style.display = 'none';
    }
    currentSpeakerInstance = null;
    
    if (dialogueTimeout) {
        clearTimeout(dialogueTimeout);
        dialogueTimeout = null;
    }
    if (arrivalAutoCloseTimeout) {
        clearTimeout(arrivalAutoCloseTimeout);
        arrivalAutoCloseTimeout = null;
    }
    
    checkVillagerProximity();
    setTimeout(processArrivalQueue, 1000);
}

function displayArrivalDialogue(typeData, instance) {
    if (isDialogOpen) {
        arrivalDialogueQueue.push({ typeData, instance });
        return;
    }
    isArrivalDialogueShowing = true;

    const text = `新しい住人「${typeData.name}」がロケットに乗ってやってきました！`;

    currentSpeakerInstance = instance;
    currentSpeaker = 'システム';

    btnTalkEl.style.display = 'none';
    if(worldTalkBubbleEl) worldTalkBubbleEl.style.display = 'none';
    btnPresentEl.style.display = 'none';

    if (arrivalToastTextEl && arrivalToastEl) {
        arrivalToastTextEl.textContent = text;
        arrivalToastEl.style.display = 'block';
    }

    // 4秒後に自動で閉じる
    if (arrivalAutoCloseTimeout) clearTimeout(arrivalAutoCloseTimeout);
    arrivalAutoCloseTimeout = setTimeout(() => {
        if (isArrivalDialogueShowing) {
            closeArrivalDialogueDirectly();
        }
    }, 4000);
}

// ==========================================
// v42 住人の旅立ち通知システム
// ==========================================

/**
 * 住人通知トーストを表示する（arrivalToastを流用）
 * @param {string} message 表示するメッセージ
 * @param {object|null} villagerInstance クリック時にフォーカスする住人（nullなら無効）
 * @param {number} duration 自動非表示までの秒数（デフォルト6秒）
 */
let notifToastTimeout = null;
function showVillagerNotification(message, villagerInstance = null, duration = 6000) {
    if (!arrivalToastEl || !arrivalToastTextEl) return;
    
    // 既存のタイムアウトをキャンセル
    if (notifToastTimeout) {
        clearTimeout(notifToastTimeout);
        notifToastTimeout = null;
    }
    
    arrivalToastTextEl.textContent = message;
    arrivalToastEl.style.display = 'block';
    
    // クリック可能かどうかでスタイル変更
    if (villagerInstance) {
        arrivalToastEl.style.cursor = 'pointer';
        arrivalToastEl.dataset.notifFocus = 'true';
    } else {
        arrivalToastEl.style.cursor = 'default';
        arrivalToastEl.dataset.notifFocus = 'false';
    }
    
    // クリックイベント用に一時的に住人を保持
    notifFocusVillager = villagerInstance;
    
    notifToastTimeout = setTimeout(() => {
        if (!isArrivalDialogueShowing) {
            arrivalToastEl.style.display = 'none';
        }
        notifFocusVillager = null;
    }, duration);
}

/**
 * 通知トーストクリック時にカメラを住人にフォーカスする
 */
function focusOnVillager(villager) {
    if (!villager || !villager.group) return;
    isNotifCameraFocus = true;
    notifFocusVillager = villager;
}

/**
 * カメラフォーカスを解除する（プレイヤー移動時に呼ばれる）
 */
function cancelNotifCameraFocus() {
    isNotifCameraFocus = false;
    notifFocusVillager = null;
}

// ==========================================
// v35 見上げるモード用関数群の実装
// ==========================================

function toggleLookUpMode() {
    isLookUpMode = !isLookUpMode;
    
    // キー入力をリセット (開始時のみ)
    if (isLookUpMode) {
        keys.left = false; keys.right = false; keys.up = false; keys.down = false; keys.space = false;
    }
    
    // ボタンのスタイル切り替え
    if (btnLookupEl) {
        if (isLookUpMode) {
            btnLookupEl.classList.add('active');
            btnLookupEl.innerHTML = '<span class="btn-icon">戻</span> 戻る (V)';
        } else {
            btnLookupEl.classList.remove('active');
            btnLookupEl.innerHTML = '<span class="btn-icon">🔭</span> 見上げる (V)';
        }
    }
    
    // HUDのフェードアウト処理
    const hudElements = [
        document.querySelector('.top-left-panel'),
        document.querySelector('.control-panel'),
        document.querySelector('.stats-panel'),
        document.getElementById('btn-guide'),
        document.getElementById('btn-bgm'),
        document.getElementById('btn-tutorial')
    ];
    
    hudElements.forEach(el => {
        if (el) {
            if (isLookUpMode) {
                el.classList.add('hud-fade-out');
            } else {
                el.classList.remove('hud-fade-out');
            }
        }
    });

    // アクションパネルの表示切り替えクラス追加 (見上げるモード中は見上げるボタン以外を非表示にする)
    const actionPanelEl = document.querySelector('.action-panel');
    if (actionPanelEl) {
        if (isLookUpMode) {
            actionPanelEl.classList.add('lookup-active');
        } else {
            actionPanelEl.classList.remove('lookup-active');
        }
    }
    
    // ツールチップ非表示
    if (!isLookUpMode && lookupTooltipEl) {
        lookupTooltipEl.style.display = 'none';
        if (hoveredSkyPlanet) {
            const parent = hoveredSkyPlanet.userData.parentGroup;
            if (parent) parent.scale.setScalar(hoveredSkyPlanet.userData.baseScale);
            hoveredSkyPlanet = null;
        }
    }
    
    // 上空アセットの構築と可視化
    if (isLookUpMode) {
        createLookUpAssets();
    } else {
        if (lookUpGroup) {
            lookUpGroup.visible = false;
        }
    }
}

function createLookUpAssets() {
    // 既存アセットの破棄
    if (lookUpGroup) {
        scene.remove(lookUpGroup);
        lookUpGroup.traverse(obj => {
            if (obj.isMesh || obj.isPoints || obj.isLine) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        lookUpGroup = null;
    }
    
    lookUpGroup = new THREE.Group();
    skyPlanets = [];
    skyComets = [];
    skyAuroras = [];
    ufoGroup = null;
    ufoActive = false;
    cosmicWhale = null;
    cosmicWhaleActive = false;
    supernovas = [];
    
    // 惑星ごとの設定
    let galaxyColor1, galaxyColor2, nebulaColor;
    let starCount = 3500;
    let spiralArms = 2;
    
    if (currentPlanet.id === "artemis") {
        galaxyColor1 = new THREE.Color(0xff85a1);
        galaxyColor2 = new THREE.Color(0x00f0ff);
        nebulaColor = new THREE.Color(0x0d061f);
    } else if (currentPlanet.id === "boreas") {
        galaxyColor1 = new THREE.Color(0x98ffeb);
        galaxyColor2 = new THREE.Color(0x4ea8de);
        nebulaColor = new THREE.Color(0x041124);
        spiralArms = 3;
    } else if (currentPlanet.id === "helios") {
        galaxyColor1 = new THREE.Color(0xffd166);
        galaxyColor2 = new THREE.Color(0xff007f);
        nebulaColor = new THREE.Color(0x240e00);
    }
    
    cosmicGalaxy = null;
    cosmicNebula = null;

    // --- C. 他の小惑星の生成 ---
    // 他の惑星2個を小さくし、きれいに整列していない不規則な配置にします。
    const otherPlanets = Object.values(planetsData).filter(p => p.id !== currentPlanet.id);
    const skyPositions = [
        new THREE.Vector3(-14, ASTEROID_RADIUS + 21, -33),
        new THREE.Vector3(9, ASTEROID_RADIUS + 11, -23)
    ];
    
    otherPlanets.forEach((pData, idx) => {
        const planetModel = new THREE.Group();
        const geom = new THREE.SphereGeometry(1.2, 24, 24); // 3.6から1.2に縮小
        let mat;
        
        if (pData.id === "artemis") {
            mat = new THREE.MeshStandardMaterial({
                color: 0xff6b8b,
                emissive: 0x3d0010,
                roughness: 0.8,
                metalness: 0.1
            });
        } else if (pData.id === "boreas") {
            mat = new THREE.MeshStandardMaterial({
                color: 0x80d0ff,
                emissive: 0x051d3b,
                roughness: 0.2,
                metalness: 0.8
            });
        } else if (pData.id === "helios") {
            mat = new THREE.MeshStandardMaterial({
                color: 0xffd166,
                emissive: 0x3b1a00,
                roughness: 0.9,
                metalness: 0.1
            });
        }
        
        const mesh = new THREE.Mesh(geom, mat);
        planetModel.add(mesh);
        
        if (pData.id === "boreas") {
            const ringGeom = new THREE.RingGeometry(1.6, 2.5, 32); // 4.8, 7.5 から縮小
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0x90e0ff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2.2;
            planetModel.add(ring);
        } else if (pData.id === "helios") {
            const shieldGeom = new THREE.SphereGeometry(1.3, 16, 16); // 3.9 から縮小
            const shieldMat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.15,
                blending: THREE.AdditiveBlending
            });
            const shield = new THREE.Mesh(shieldGeom, shieldMat);
            planetModel.add(shield);
        } else if (pData.id === "artemis") {
            const cloudGeom = new THREE.DodecahedronGeometry(0.5, 1); // 1.5 から縮小
            const cloudMat = new THREE.MeshBasicMaterial({
                color: 0xffb5c5,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            });
            for(let i=0; i<3; i++) {
                const cloud = new THREE.Mesh(cloudGeom, cloudMat);
                cloud.position.set((Math.random()-0.5)*1, (Math.random()-0.5)*1, (Math.random()-0.5)*1); // 3から1へ縮小
                planetModel.add(cloud);
            }
        }
        
        planetModel.position.copy(skyPositions[idx]);
        mesh.name = "skyPlanet";
        mesh.userData = {
            planetId: pData.id,
            planetData: pData,
            parentGroup: planetModel,
            baseScale: 1.0
        };
        
        skyPlanets.push(mesh);
        lookUpGroup.add(planetModel);
    });

    if (currentPlanet.id === "boreas" || Math.random() < 0.35) {
        spawnLookUpAurora();
    }
    
    // --- 満点の星空（輝く星星）の追加 ---
    const skyStarCount = 2500;
    const skyStarGeom = new THREE.BufferGeometry();
    const skyStarPos = new Float32Array(skyStarCount * 3);
    const skyStarColors = new Float32Array(skyStarCount * 3);
    
    lookUpStarBaseColors = [];
    lookUpStarPhases = [];
    lookUpStarSpeeds = [];
    
    const starColorsList = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xffd166),
        new THREE.Color(0xff85a1),
        new THREE.Color(0x00f0ff),
        new THREE.Color(0xa2d2ff)
    ];

    for (let i = 0; i < skyStarCount; i++) {
        const r = 60 + Math.random() * 80;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random()); // 0 から PI/2 (上半分)
        
        skyStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        skyStarPos[i * 3 + 1] = ASTEROID_RADIUS + r * Math.sin(phi) * Math.sin(theta);
        skyStarPos[i * 3 + 2] = r * Math.cos(phi) - 20; // 少し奥に寄せる
        
        const col = starColorsList[Math.floor(Math.random() * starColorsList.length)].clone();
        skyStarColors[i * 3] = col.r;
        skyStarColors[i * 3 + 1] = col.g;
        skyStarColors[i * 3 + 2] = col.b;
        
        lookUpStarBaseColors.push(col);
        lookUpStarPhases.push(Math.random() * Math.PI * 2);
        lookUpStarSpeeds.push(1.2 + Math.random() * 2.8); // キラキラ瞬く速度
    }
    
    skyStarGeom.setAttribute('position', new THREE.BufferAttribute(skyStarPos, 3));
    skyStarGeom.setAttribute('color', new THREE.BufferAttribute(skyStarColors, 3));
    
    const skyStarTexture = createCircleTexture();
    const skyStarMat = new THREE.PointsMaterial({
        size: 1.5 + Math.random() * 2.0, // さまざまな大きさ
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        map: skyStarTexture,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    lookUpStars = new THREE.Points(skyStarGeom, skyStarMat);
    lookUpGroup.add(lookUpStars);
    
    scene.add(lookUpGroup);
    lookUpGroup.visible = true;
}

function updateLookUpAssets(delta) {
    if (!isLookUpMode || !lookUpGroup) return;

    // --- 満点の星空のきらめきアニメーション ---
    if (lookUpStars) {
        const colorsAttr = lookUpStars.geometry.attributes.color;
        const count = colorsAttr.count;
        for (let i = 0; i < count; i++) {
            lookUpStarPhases[i] += delta * lookUpStarSpeeds[i];
            const twinkle = 0.2 + (1.0 + Math.sin(lookUpStarPhases[i])) * 0.45;
            const baseColor = lookUpStarBaseColors[i];
            colorsAttr.setXYZ(i, baseColor.r * twinkle, baseColor.g * twinkle, baseColor.b * twinkle);
        }
        colorsAttr.needsUpdate = true;
    }

    if (cosmicGalaxy) cosmicGalaxy.rotation.z += delta * 0.025;
    if (cosmicNebula) cosmicNebula.rotation.y += delta * 0.008;
    
    skyPlanets.forEach(mesh => {
        mesh.rotation.y += delta * 0.05;
        if (mesh.userData.parentGroup) {
            mesh.userData.parentGroup.rotation.y += delta * 0.01;
        }
    });

    if (Math.random() < 0.003) {
        spawnLookUpComet();
    }
    for (let i = skyComets.length - 1; i >= 0; i--) {
        const c = skyComets[i];
        c.age += delta;
        if (c.age >= c.maxAge) {
            lookUpGroup.remove(c.mesh);
            c.mesh.geometry.dispose();
            c.mesh.material.dispose();
            skyComets.splice(i, 1);
            continue;
        }
        c.pos.addScaledVector(c.dir, c.speed * delta);
        
        const points = [
            c.pos.clone(),
            c.pos.clone().addScaledVector(c.dir, -c.length)
        ];
        c.mesh.geometry.setFromPoints(points);
        c.mesh.material.opacity = 0.95 * (1.0 - c.age / c.maxAge);
    }

    ufoTimer -= delta;
    if (ufoTimer <= 0 && !ufoActive) {
        if (Math.random() < 0.25) {
            spawnLookUpUFO();
        } else {
            ufoTimer = 4.0 + Math.random() * 6.0;
        }
    }
    if (ufoActive && ufoGroup) {
        ufoGroup.position.addScaledVector(ufoDirection, ufoSpeed * delta);
        if (Math.random() < 0.04) {
            const drift = new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.2);
            ufoDirection.add(drift).normalize();
        }
        const core = ufoGroup.getObjectByName("ufoCore");
        if (core) {
            core.material.emissiveIntensity = 1.5 + Math.sin(clock.getElapsedTime() * 18.0) * 0.8;
        }
        if (Math.random() < 0.4) {
            spawnUFOTrail(ufoGroup.position.clone());
        }
        if (ufoGroup.position.x > 80 || ufoGroup.position.x < -80 || ufoGroup.position.y > ASTEROID_RADIUS + 40) {
            lookUpGroup.remove(ufoGroup);
            ufoGroup.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                }
            });
            ufoGroup = null;
            ufoActive = false;
            ufoTimer = 10.0 + Math.random() * 15.0;
        }
    }
    
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        if (p.mesh.name === "ufoTrail") {
            p.age += delta;
            if (p.age >= p.maxAge) {
                asteroid.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                activeParticles.splice(i, 1);
                continue;
            }
            const progress = p.age / p.maxAge;
            p.mesh.material.opacity = 0.9 * (1.0 - progress);
            p.mesh.scale.setScalar(1.0 - progress);
        }
    }

    skyAuroras.forEach(aurora => {
        aurora.age += delta;
        const posAttr = aurora.mesh.geometry.attributes.position;
        const count = posAttr.count;
        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = Math.sin(x * 0.08 + aurora.age * 0.85) * 2.2 + Math.cos(z * 0.05 + aurora.age * 0.6) * 1.5;
            posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
        aurora.mesh.material.color.setHSL((0.45 + Math.sin(aurora.age * 0.05) * 0.15) % 1.0, 0.9, 0.6);
    });

    cosmicWhaleTimer -= delta;
    if (cosmicWhaleTimer <= 0 && !cosmicWhaleActive) {
        if (Math.random() < 0.2) {
            spawnLookUpCosmicWhale();
        } else {
            cosmicWhaleTimer = 8.0 + Math.random() * 8.0;
        }
    }
    if (cosmicWhaleActive && cosmicWhale) {
        cosmicWhale.position.addScaledVector(cosmicWhaleDirection, cosmicWhaleSpeed * delta);
        const time = clock.getElapsedTime();
        cosmicWhale.traverse(obj => {
            if (obj.name === "tail") {
                obj.rotation.y = Math.sin(time * 1.8) * 0.28;
            } else if (obj.name === "leftFin") {
                obj.rotation.z = Math.sin(time * 1.2) * 0.18;
            } else if (obj.name === "rightFin") {
                obj.rotation.z = -Math.sin(time * 1.2) * 0.18;
            }
        });
        if (cosmicWhale.position.x > 90 || cosmicWhale.position.x < -90) {
            lookUpGroup.remove(cosmicWhale);
            cosmicWhale.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                }
            });
            cosmicWhale = null;
            cosmicWhaleActive = false;
            cosmicWhaleTimer = 22.0 + Math.random() * 25.0;
        }
    }

    if (Math.random() < 0.001) {
        spawnLookUpSupernova();
    }
    for (let i = supernovas.length - 1; i >= 0; i--) {
        const s = supernovas[i];
        s.age += delta;
        if (s.age >= s.maxAge) {
            lookUpGroup.remove(s.ringMesh);
            s.ringMesh.geometry.dispose();
            s.ringMesh.material.dispose();
            lookUpGroup.remove(s.starMesh);
            s.starMesh.geometry.dispose();
            s.starMesh.material.dispose();
            supernovas.splice(i, 1);
            continue;
        }
        const progress = s.age / s.maxAge;
        const scale = 0.1 + progress * 24.0;
        s.ringMesh.scale.set(scale, scale, 1.0);
        s.ringMesh.material.opacity = 0.9 * (1.0 - progress);
        s.starMesh.material.opacity = Math.max(0, 1.0 - progress * 4.0);
        s.starMesh.scale.setScalar(1.0 - progress);
    }
}

function updateLookUpInteraction() {
    if (!isLookUpMode || !lookUpGroup) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(skyPlanets, true);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        if (hoveredSkyPlanet !== hitMesh) {
            if (hoveredSkyPlanet && hoveredSkyPlanet.userData.parentGroup) {
                hoveredSkyPlanet.userData.parentGroup.scale.setScalar(hoveredSkyPlanet.userData.baseScale);
            }
            hoveredSkyPlanet = hitMesh;
            if (audioCtx && audioCtx.state === 'running') {
                playFootstep(1.8);
            }
        }
        const parentGroup = hitMesh.userData.parentGroup;
        const pData = hitMesh.userData.planetData;
        if (parentGroup) {
            parentGroup.scale.setScalar(hitMesh.userData.baseScale * 1.12);
        }
        if (lookupTooltipEl) {
            tooltipPlanetNameEl.textContent = pData.name;
            tooltipPlanetClimateEl.textContent = `環境: ${pData.climate}`;
            const plantCount = pData.plants.length;
            const villagerCount = pData.activeVillagers.filter(v => v.settled).length;
            tooltipPlantCountEl.textContent = plantCount;
            tooltipVillagerCountEl.textContent = villagerCount;
            
            const worldPos = new THREE.Vector3();
            parentGroup.getWorldPosition(worldPos);
            worldPos.project(camera);
            
            const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (worldPos.y * -0.5 + 0.5) * window.innerHeight;
            lookupTooltipEl.style.left = `${x}px`;
            lookupTooltipEl.style.top = `${y}px`;
            lookupTooltipEl.style.display = 'block';
        }
    } else {
        if (hoveredSkyPlanet) {
            const parentGroup = hoveredSkyPlanet.userData.parentGroup;
            if (parentGroup) {
                parentGroup.scale.setScalar(hoveredSkyPlanet.userData.baseScale);
            }
            hoveredSkyPlanet = null;
        }
        if (lookupTooltipEl) {
            lookupTooltipEl.style.display = 'none';
        }
    }
}

function spawnLookUpComet() {
    const geom = new THREE.BufferGeometry();
    const length = 12.0 + Math.random() * 8.0;
    const startX = -80 - Math.random() * 30;
    const startY = ASTEROID_RADIUS + 18 + Math.random() * 8;
    const startZ = -45 + (Math.random() - 0.5) * 15;
    const direction = new THREE.Vector3(2.5, -0.6, 0.4).normalize();
    const pos = new THREE.Vector3(startX, startY, startZ);
    const points = [
        pos.clone(),
        pos.clone().addScaledVector(direction, -length)
    ];
    geom.setFromPoints(points);
    const cometColors = [0x00ffff, 0xff85a1, 0xffffff, 0xffd166, 0x9b5de5];
    const col = cometColors[Math.floor(Math.random() * cometColors.length)];
    const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95
    });
    const line = new THREE.Line(geom, mat);
    lookUpGroup.add(line);
    skyComets.push({
        mesh: line,
        pos: pos,
        dir: direction,
        speed: 120.0 + Math.random() * 50.0,
        age: 0,
        maxAge: 0.8 + Math.random() * 0.6,
        length: length
    });
}

function spawnLookUpUFO() {
    ufoActive = true;
    ufoGroup = new THREE.Group();
    const bodyGeom = new THREE.CylinderGeometry(1.8, 2.2, 0.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1b1c26,
        roughness: 0.2,
        metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    ufoGroup.add(body);
    const domeGeom = new THREE.SphereGeometry(0.8, 8, 8, 0, Math.PI*2, 0, Math.PI/2);
    const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.6,
        transmission: 0.9
    });
    const dome = new THREE.Mesh(domeGeom, domeMat);
    dome.position.y = 0.2;
    ufoGroup.add(dome);
    const coreGeom = new THREE.SphereGeometry(0.4, 8, 8);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0xff00d0,
        emissive: 0xff00d0,
        emissiveIntensity: 2.0
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.y = -0.2;
    core.name = "ufoCore";
    ufoGroup.add(core);

    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -75 : 75;
    const startY = ASTEROID_RADIUS + 14 + Math.random() * 6;
    const startZ = -30 + (Math.random() - 0.5) * 10;
    
    ufoGroup.position.set(startX, startY, startZ);
    ufoGroup.rotation.x = 0.2;
    ufoGroup.rotation.z = fromLeft ? -0.15 : 0.15;
    ufoDirection.set(fromLeft ? 1 : -1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1).normalize();
    ufoSpeed = 32.0 + Math.random() * 12.0;
    lookUpGroup.add(ufoGroup);
}

function spawnUFOTrail(pos) {
    const size = 0.15 + Math.random() * 0.15;
    const geom = new THREE.SphereGeometry(size, 4, 4);
    const colors = [0x00f0ff, 0xff00d0, 0x9b5de5];
    const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.name = "ufoTrail";
    asteroid.add(mesh);
    activeParticles.push({
        mesh: mesh,
        dir: new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5),
        speed: 1.0,
        age: 0,
        maxAge: 0.8 + Math.random() * 0.4,
        spiralRadius: 0,
        angle: 0,
        rotSpeed: 0
    });
}

function spawnLookUpAurora() {
    const geom = new THREE.PlaneGeometry(120, 15, 24, 2);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffa3,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, ASTEROID_RADIUS + 16, -40);
    mesh.rotation.x = Math.PI / 2.1;
    lookUpGroup.add(mesh);
    skyAuroras.push({
        mesh: mesh,
        age: Math.random() * 10.0
    });
}

function spawnLookUpCosmicWhale() {
    cosmicWhaleActive = true;
    cosmicWhale = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x98e3ff,
        emissive: 0x0e2f5c,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.45,
        transmission: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const bodyGeom = new THREE.SphereGeometry(3.5, 12, 12);
    bodyGeom.scale(2.2, 0.9, 0.9);
    const body = new THREE.Mesh(bodyGeom, mat);
    cosmicWhale.add(body);
    const finGeom = new THREE.ConeGeometry(0.8, 3.0, 4);
    finGeom.rotateX(Math.PI / 2);
    const leftFin = new THREE.Mesh(finGeom, mat);
    leftFin.name = "leftFin";
    leftFin.position.set(-1.0, 0, 1.8);
    leftFin.rotation.y = 0.5;
    cosmicWhale.add(leftFin);
    const rightFin = new THREE.Mesh(finGeom, mat);
    rightFin.name = "rightFin";
    rightFin.position.set(-1.0, 0, -1.8);
    rightFin.rotation.y = -0.5;
    cosmicWhale.add(rightFin);
    const tailGroup = new THREE.Group();
    tailGroup.name = "tail";
    tailGroup.position.set(-6.5, 0, 0);
    const tailBarGeom = new THREE.CylinderGeometry(0.4, 0.8, 2.5, 8);
    tailBarGeom.rotateZ(Math.PI/2);
    const tailBar = new THREE.Mesh(tailBarGeom, mat);
    tailGroup.add(tailBar);
    const fin2Geom = new THREE.ConeGeometry(0.6, 2.2, 4);
    fin2Geom.rotateX(Math.PI/2);
    const tFin1 = new THREE.Mesh(fin2Geom, mat);
    tFin1.position.set(-0.8, 0, 0.9);
    tailGroup.add(tFin1);
    const tFin2 = new THREE.Mesh(fin2Geom, mat);
    tFin2.position.set(-0.8, 0, -0.9);
    tailGroup.add(tFin2);
    cosmicWhale.add(tailGroup);
    
    const startX = 85;
    const startY = ASTEROID_RADIUS + 16 + Math.random() * 4;
    const startZ = -36 + (Math.random() - 0.5) * 8;
    cosmicWhale.position.set(startX, startY, startZ);
    cosmicWhale.rotation.y = -Math.PI / 2;
    cosmicWhaleDirection.set(-1, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05).normalize();
    cosmicWhaleSpeed = 4.2 + Math.random() * 1.5;
    lookUpGroup.add(cosmicWhale);
}

function spawnLookUpSupernova() {
    const posX = (Math.random() - 0.5) * 75;
    const posY = ASTEROID_RADIUS + 15 + Math.random() * 8;
    const posZ = -40 + (Math.random() - 0.5) * 10;
    const pos = new THREE.Vector3(posX, posY, posZ);
    const starGeom = new THREE.SphereGeometry(1.6, 8, 8);
    const starMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
    });
    const starMesh = new THREE.Mesh(starGeom, starMat);
    starMesh.position.copy(pos);
    lookUpGroup.add(starMesh);
    const ringGeom = new THREE.RingGeometry(0.1, 0.45, 32);
    const colors = [0xff5c8a, 0x00f0ff, 0xffd166, 0x9b5de5];
    const ringMat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.copy(pos);
    ringMesh.rotation.x = Math.PI / 3.5;
    lookUpGroup.add(ringMesh);
    supernovas.push({
        starMesh: starMesh,
        ringMesh: ringMesh,
        age: 0,
        maxAge: 1.8 + Math.random() * 0.8
    });
    if (audioCtx && audioCtx.state === 'running') {
        playVillagerSpawnSound();
    }
}

// 住民数UI の初回更新
updateVillagerCountUI();

// 初期化の実行
initControlPanelCollapse();
updatePlanetEnvironment();
animate();

// ==========================================
// セーブ＆ロードシステム
// ==========================================

function saveGame(showToast = false) {
    const saveData = {
        playerFruits: playerFruits,
        playerInventory: playerInventory,
        hasPlayedTutorial: hasPlayedTutorial,
        isIntroFinished: isIntroFinished,
        currentPlanetId: currentPlanet.id,
        planets: {}
    };

    for (const key in planetsData) {
        const p = planetsData[key];
        
        // plantsのシリアライズ
        const serializedPlants = p.plants.map(plant => ({
            latIndex: plant.latIndex,
            lonIndex: plant.lonIndex,
            scale: plant.scale,
            targetScale: plant.targetScale,
            age: plant.age,
            localPos: { x: plant.localPos.x, y: plant.localPos.y, z: plant.localPos.z },
            type: plant.type,
            subtype: plant.subtype,
            harvestedSeed: plant.harvestedSeed,
            fruitProgress: plant.fruitProgress || []
        }));

        // 定住している住人（settled === true）のみシリアライズ
        const serializedVillagers = p.activeVillagers
            .filter(v => v.settled)
            .map(v => ({
                id: v.id,
                name: v.name,
                localPos: { x: v.localPos.x, y: v.localPos.y, z: v.localPos.z },
                rocketStyle: v.rocketStyle,
                settled: v.settled
            }));

        // 家のシリアライズ
        const serializedHouses = (p.houses || []).map(h => ({
            style: h.style,
            localPos: { x: h.localPos.x, y: h.localPos.y, z: h.localPos.z },
            normal: { x: h.normal.x, y: h.normal.y, z: h.normal.z }
        }));

        saveData.planets[key] = {
            plants: serializedPlants,
            activeVillagers: serializedVillagers,
            completedMilestones: p.completedMilestones || [],
            unlockedVillagerIds: p.unlockedVillagerIds || [],
            unlockedVillagersInfo: p.unlockedVillagersInfo || {},
            houses: serializedHouses,
            grownGrassIndices: Array.from(p.grownGrassIndices || []),
            plantedGridCells: Array.from(p.plantedGridCells || [])
        };
    }

    localStorage.setItem('cosmo_crossing_save_data', JSON.stringify(saveData));

    if (showToast) {
        const toast = document.getElementById('save-toast');
        if (toast) {
            toast.style.display = 'block';
            toast.style.opacity = '1';
            // 3秒後にフェードアウト
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }
}

function loadGame() {
    const raw = localStorage.getItem('cosmo_crossing_save_data');
    if (!raw) return false;
    try {
        const saveData = JSON.parse(raw);
        playerFruits = saveData.playerFruits;
        playerInventory = saveData.playerInventory;
        hasPlayedTutorial = saveData.hasPlayedTutorial;
        isIntroFinished = saveData.isIntroFinished;

        // 各惑星データの復元
        for (const key in saveData.planets) {
            const sp = saveData.planets[key];
            const p = planetsData[key];
            if (!p) continue;

            p.completedMilestones = sp.completedMilestones || [];
            p.unlockedVillagerIds = sp.unlockedVillagerIds || [];
            p.unlockedVillagersInfo = sp.unlockedVillagersInfo || {};
            p.grownGrassIndices = new Set(sp.grownGrassIndices || []);
            p.plantedGridCells = new Set(sp.plantedGridCells || []);

            // 植物オブジェクトの復元 (3Dメッシュ以外)
            p.plants = (sp.plants || []).map(spObj => {
                const plantGroup = new THREE.Group();
                const visualGroup = new THREE.Group();
                plantGroup.add(visualGroup);
                
                plantGroup.position.set(spObj.localPos.x, spObj.localPos.y, spObj.localPos.z);
                const normal = plantGroup.position.clone().normalize();
                plantGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                plantGroup.scale.set(spObj.scale, spObj.scale, spObj.scale);

                const plantObj = {
                    latIndex: spObj.latIndex,
                    lonIndex: spObj.lonIndex,
                    mesh: plantGroup,
                    visualGroup: visualGroup,
                    scale: spObj.scale,
                    targetScale: spObj.targetScale,
                    age: spObj.age,
                    localPos: new THREE.Vector3(spObj.localPos.x, spObj.localPos.y, spObj.localPos.z),
                    type: spObj.type,
                    subtype: spObj.subtype,
                    light: null,
                    harvestedSeed: spObj.harvestedSeed,
                    fruitProgress: spObj.fruitProgress || []
                };

                return plantObj;
            });

            // 家データの復元
            p.houses = (sp.houses || []).map(sh => {
                const houseMesh = buildHouse(sh.style);
                houseMesh.position.set(sh.localPos.x, sh.localPos.y, sh.localPos.z);
                const normal = new THREE.Vector3(sh.normal.x, sh.normal.y, sh.normal.z);
                houseMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                houseMesh.scale.set(2.5, 2.5, 2.5); // 家のベーススケール

                return {
                    style: sh.style,
                    localPos: new THREE.Vector3(sh.localPos.x, sh.localPos.y, sh.localPos.z),
                    normal: normal,
                    mesh: houseMesh
                };
            });

            // 定住した住人の復元
            p.activeVillagers = (sp.activeVillagers || []).map(sv => {
                const typeData = VILLAGER_TYPES[sv.id];
                const info = VILLAGER_INFO[sv.id] || {};
                
                const group = new THREE.Group();
                const visualGroup = new THREE.Group();
                group.add(visualGroup);
                
                buildVillagerBody(visualGroup, typeData.color, typeData.headStyle, typeData.earColor);
                
                const localPos = new THREE.Vector3(sv.localPos.x, sv.localPos.y, sv.localPos.z);
                const normal = localPos.clone().normalize();
                
                group.position.copy(localPos);
                group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                
                const beacon = buildGuideBeacon(typeData.id);
                beacon.position.copy(localPos).addScaledVector(normal, 1.4);
                beacon.quaternion.copy(group.quaternion);
                
                return {
                    id: sv.id,
                    name: sv.name,
                    typeData: typeData,
                    group: group,
                    visualGroup: visualGroup,
                    beacon: beacon,
                    localPos: localPos,
                    state: "IDLE",
                    settled: true,
                    leavingTimer: 0,
                    stateTimer: 0.0,
                    targetPos: new THREE.Vector3(),
                    targetPlant: null,
                    walkCycle: 0,
                    bounce: 0.45,
                    happyJumpCount: 0,
                    happyJumpTimer: 0,
                    age: Math.random() * 100,
                    rocketStyle: sv.rocketStyle,
                    rocketInstance: null,
                    hungerTimer: 20.0 + Math.random() * 20.0,
                    stayTimer: 999999.0,
                    warningShown: false,
                    milestoneId: info.milestoneId,
                    settleReqFlower: info.settleReqFlower,
                    settleReqTree: info.settleReqTree,
                    isRevisitor: true,
                    hasSpokenThisVisit: false
                };
            });
        }

        currentPlanet = planetsData[saveData.currentPlanetId || 'artemis'];
        return true;
    } catch (e) {
        console.error("Failed to load game", e);
        return false;
    }
}

function rebuildCurrentPlanetScene() {
    clearPlanetStructures();
    
    // 植栽ライトと植物メッシュの削除 (全惑星分を一括クリア)
    for (const key in planetsData) {
        const p = planetsData[key];
        p.plants.forEach(plant => {
            if (plant.light) {
                asteroid.remove(plant.light);
                plant.light = null;
            }
            if (plant.mesh) {
                asteroid.remove(plant.mesh);
            }
        });
        
        p.activeVillagers.forEach(v => {
            if (v.group) asteroid.remove(v.group);
            if (v.beacon) asteroid.remove(v.beacon);
            if (v.rocketInstance && v.rocketInstance.mesh) {
                asteroid.remove(v.rocketInstance.mesh);
            }
        });

        if (p.houses) {
            p.houses.forEach(h => {
                if (h.mesh) asteroid.remove(h.mesh);
            });
        }
    }
    activePlantLights.length = 0;
    
    // 草のクリーンアップ
    grassClumps.forEach(gc => {
        asteroid.remove(gc.mesh);
        gc.mesh.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                obj.material.dispose();
            }
        });
    });
    grassClumps.length = 0;
    
    // 惑星テクスチャとカラーの適用
    const newTexture = createDirtTexture(currentPlanet);
    asteroid.material.map.dispose();
    asteroid.material.map = newTexture;
    asteroid.material.needsUpdate = true;
    
    scene.background.setHex(currentPlanet.bgColor);
    scene.fog.color.setHex(currentPlanet.fogColor);
    scene.fog.density = currentPlanet.fogDensity;
    baseFogDensity = currentPlanet.fogDensity;
    
    sunLight.color.setHex(currentPlanet.id === "boreas" ? 0xe0f7ff : (currentPlanet.id === "helios" ? 0xfff3d1 : 0xfff8ea));
    fillLight.color.setHex(currentPlanet.id === "boreas" ? 0x00bfff : (currentPlanet.id === "helios" ? 0xffaa00 : 0x7585ff));
    
    // 草の再配置
    if (!currentPlanet.grownGrassIndices) {
        currentPlanet.grownGrassIndices = new Set();
    }
    const grassCount = 2600;
    for (let i = 0; i < grassCount; i++) {
        const grass = createGrassClump(currentPlanet);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = ASTEROID_RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = ASTEROID_RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = ASTEROID_RADIUS * Math.cos(phi);
        
        const pos = new THREE.Vector3(x, y, z);
        grass.position.copy(pos);
        const normal = pos.clone().normalize();
        grass.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        
        const baseScale = 0.85 + Math.random() * 0.5;
        const isGrown = currentPlanet.grownGrassIndices.has(i);
        const startScale = isGrown ? baseScale : 0.0;
        grass.scale.set(startScale, startScale, startScale);
        asteroid.add(grass);

        grassClumps.push({
            mesh: grass,
            scale: startScale,
            targetScale: startScale,
            baseScale: baseScale,
            age: Math.random() * 100
        });
    }
    
    const portalRing = warpPortalGroup.getObjectByName("coreRing");
    if (portalRing) {
        portalRing.material.color.setHex(currentPlanet.id === "boreas" ? 0x00f0ff : (currentPlanet.id === "helios" ? 0xffd166 : 0xff5c8a));
        portalRing.material.emissive.setHex(currentPlanet.id === "boreas" ? 0x00bfff : (currentPlanet.id === "helios" ? 0xffaa00 : 0xff5c8a));
    }
    
    spawnPlanetStructures();
    
    // 植物アセットの3D再生成・配置
    currentPlanet.plants.forEach(p => {
        const visualGroup = p.visualGroup;
        visualGroup.clear();
        
        if (p.type === 'flower') {
            if (currentPlanet.id === "boreas") {
                buildIceFlower(visualGroup);
            } else if (currentPlanet.id === "helios") {
                buildDesertFlower(visualGroup);
            } else {
                if (p.subtype === 1) buildStarlightLily(visualGroup);
                else if (p.subtype === 2) buildLunaRose(visualGroup);
                else if (p.subtype === 3) buildAuroraTulip(visualGroup);
                else buildCosmicFlower(visualGroup);
            }
        } else {
            if (currentPlanet.id === "boreas") {
                buildIceTree(visualGroup);
            } else if (currentPlanet.id === "helios") {
                buildDesertTree(visualGroup);
            } else {
                const randVal = Math.random();
                if (randVal < 0.5) buildCosmicTree(visualGroup);
                else buildBerryTree(visualGroup);
            }
        }
        
        p.mesh.scale.set(p.scale, p.scale, p.scale);
        
        if (p.type === 'tree') {
            const fruitMeshes = [];
            p.mesh.traverse(obj => {
                if (obj.isMesh && obj.name === "fruit") {
                    fruitMeshes.push(obj);
                }
            });
            
            if (!p.fruitProgress) {
                p.fruitProgress = new Array(fruitMeshes.length).fill(1.0);
            }
            
            fruitMeshes.forEach(fruit => {
                const idx = fruit.userData.fruitIndex ?? 0;
                const progress = p.fruitProgress[idx] ?? 1.0;
                const baseScale = fruit.userData.baseScale ?? 1.0;
                
                if (fruit.material && !fruit.userData.materialCloned) {
                    fruit.material = fruit.material.clone();
                    fruit.userData.materialCloned = true;
                    fruit.userData.originalEmissiveIntensity = fruit.material.emissiveIntensity ?? 1.0;
                }

                fruit.scale.setScalar(baseScale * progress);
                fruit.visible = (progress > 0.08);

                if (progress >= 1.0) {
                    fruit.scale.setScalar(baseScale * 1.25);
                    if (fruit.material) {
                        fruit.material.emissiveIntensity = fruit.userData.originalEmissiveIntensity * 1.5;
                    }
                } else {
                    if (fruit.material) {
                        fruit.material.emissiveIntensity = 0.0;
                    }
                }
            });
        }
        
        asteroid.add(p.mesh);
        addPlantLight(p);
    });

    // 家メッシュの配置
    if (currentPlanet.houses) {
        currentPlanet.houses.forEach(h => {
            if (h.mesh) {
                asteroid.add(h.mesh);
            }
        });
    }

    // 住人メッシュの配置
    currentPlanet.activeVillagers.forEach(v => {
        if (v.group) {
            asteroid.add(v.group);
            if (v.beacon) {
                asteroid.add(v.beacon);
            }
        }
    });

    updateStatsUI();
    updatePlanetNameDisplay();
}

// セーブデータの存在確認とUIボタンの設定
const saveBtn = document.getElementById('btn-save');
if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveGame(true);
    });
}

const continueBtn = document.getElementById('btn-continue');
if (continueBtn) {
    if (localStorage.getItem('cosmo_crossing_save_data')) {
        continueBtn.style.display = 'block';
    }
    continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (loadGame()) {
            startGame(true);
        }
    });
}

