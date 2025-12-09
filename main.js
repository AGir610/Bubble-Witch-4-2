const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let chapters = [];
let currentChapterIndex = 0;
let currentLevelIndex = 0;
let grid = [];
let shooter = { x: canvas.width / 2, y: canvas.height - 100, radius: 30 };
let shootBubble = null;
let aimPos = { x: shooter.x, y: shooter.y - 200 };
let bubbleRadius = 40;
let colors = ["R","G","B","P"];
let particles = [];

// Kapitel UI
const chapterUI = document.getElementById('chapterUI');
const levelInfo = document.getElementById('levelInfo');

// Laden von Kapitel Daten
fetch('data.json')
  .then(response => response.json())
  .then(data => {
      chapters = data.chapters;
      loadProgress();
      renderChapterButtons();
      loadLevel();
      gameLoop();
  });

// Fortschritt speichern
function saveProgress() {
    localStorage.setItem('bw4Progress', JSON.stringify({ chapter: currentChapterIndex, level: currentLevelIndex }));
}

function loadProgress() {
    let p = JSON.parse(localStorage.getItem('bw4Progress'));
    if(p){ currentChapterIndex = p.chapter; currentLevelIndex = p.level; }
}

// Kapitel Buttons
function renderChapterButtons(){
    chapterUI.innerHTML = "";
    chapters.forEach((c,i)=>{
        let btn = document.createElement('button');
        btn.innerText = c.title;
        btn.onclick = ()=>{ currentChapterIndex = i; currentLevelIndex = 0; loadLevel(); }
        chapterUI.appendChild(btn);
    });
}

// Level generieren
function generateRandomLevel(rows=6, cols=8){
    let layout = [];
    for(let r=0;r<rows;r++){
        let row = [];
        for(let c=0;c<cols;c++){
            row.push(Math.random()<0.5?colors[Math.floor(Math.random()*colors.length)]:"-");
        }
        layout.push(row);
    }
    return {rows, cols, layout};
}

function loadLevel(){
    let levelData = chapters[currentChapterIndex];
    // Wenn levelData.levels ist eine Zahl, generieren wir zufällig
    let numLevels = levelData.levels;
    grid = generateRandomLevel();
    shootBubble = createBubble();
    levelInfo.innerText = "Kapitel "+(currentChapterIndex+1)+" - Level "+(currentLevelIndex+1);
    saveProgress();
}

// Bubble erstellen
function createBubble(){
    return {x: shooter.x, y: shooter.y, color: colors[Math.floor(Math.random()*colors.length)], vx:0, vy:0, moving:false};
}

// Shooter Steuerung
canvas.addEventListener('mousemove',e=>{ aimPos.x = e.clientX; aimPos.y = e.clientY; });
canvas.addEventListener('touchmove',e=>{ e.preventDefault(); aimPos.x = e.touches[0].clientX; aimPos.y = e.touches[0].clientY; }, {passive:false});
canvas.addEventListener('click', shoot);
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); shoot(); }, {passive:false});

function shoot(){
    if(!shootBubble.moving){
        let dx = aimPos.x - shooter.x;
        let dy = aimPos.y - shooter.y;
        let mag = Math.sqrt(dx*dx + dy*dy);
        shootBubble.vx = dx/mag*15;
        shootBubble.vy = dy/mag*15;
        shootBubble.moving = true;
    }
}

// Partikel
function createParticles(x, y, color){
    for(let i=0;i<10;i++){
        particles.push({
            x, y,
            vx: Math.random()*4-2,
            vy: Math.random()*-4,
            alpha:1,
            color
        });
    }
}

function updateParticles(){
    particles.forEach(p=>{
        p.x += p.vx; p.y += p.vy; p.alpha -=0.03;
    });
    particles = particles.filter(p=>p.alpha>0);
}

// Game Loop
function gameLoop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid();
    drawShooter();
    updateBubble();
    drawParticles();
    updateParticles();
    requestAnimationFrame(gameLoop);
}

// Draw Grid
function drawGrid(){
    for(let r=0;r<grid.length;r++){
        for(let c=0;c<grid[r].length;c++){
            let color = grid[r][c];
            if(color && color!="-"){
                ctx.fillStyle = colorToHex(color);
                ctx.beginPath();
                ctx.arc(c*bubbleRadius*1.05+bubbleRadius, r*bubbleRadius*1.05+bubbleRadius, bubbleRadius-2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
}

// Draw Shooter
function drawShooter(){
    ctx.fillStyle="#ffff00";
    ctx.beginPath();
    ctx.arc(shooter.x, shooter.y, shooter.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle="#fff";
    ctx.beginPath();
    ctx.moveTo(shooter.x, shooter.y);
    ctx.lineTo(aimPos.x, aimPos.y);
    ctx.stroke();

    ctx.fillStyle=colorToHex(shootBubble.color);
    ctx.beginPath();
    ctx.arc(shootBubble.x, shootBubble.y, bubbleRadius-2, 0, Math.PI*2);
    ctx.fill();
}

// Update Bubble
function updateBubble(){
    if(shootBubble.moving){
        shootBubble.x += shootBubble.vx;
        shootBubble.y += shootBubble.vy;
        if(shootBubble.x<bubbleRadius || shootBubble.x>canvas.width-bubbleRadius) shootBubble.vx*=-1;
        if(checkCollision()){attachBubble(shootBubble); shootBubble=createBubble();}
    }
}

// Collision
function checkCollision(){
    if(shootBubble.y<bubbleRadius) return true;
    for(let r=0;r<grid.length;r++){
        for(let c=0;c<grid[r].length;c++){
            let color = grid[r][c];
            if(color && color!="-"){
                let gx = c*bubbleRadius*1.05+bubbleRadius;
                let gy = r*bubbleRadius*1.05+bubbleRadius;
                if(Math.hypot(shootBubble.x-gx, shootBubble.y-gy)<bubbleRadius*1.05) return true;
            }
        }
    }
    return false;
}

// Attach Bubble
function attachBubble(b){
    let r=Math.floor(b.y/(bubbleRadius*1.05));
    let c=Math.floor(b.x/(bubbleRadius*1.05));
    if(r>=grid.length) r=grid.length-1;
    if(c>=grid[0].length) c=grid[0].length-1;
    grid[r][c] = b.color;
    createParticles(b.x, b.y, colorToHex(b.color));
    checkClusters(r,c,b.color);
}

// Cluster Check
function checkClusters(r,c,color){
    let visited=[];
    for(let i=0;i<grid.length;i++) visited[i]=[];
    let stack=[[r,c]], cluster=[];
    while(stack.length>0){
        let [x,y]=stack.pop();
        if(x<0||y<0||x>=grid.length||y>=grid[0].length) continue;
        if(visited[x][y]) continue; visited[x][y]=true;
        if(grid[x][y]===color){cluster.push([x,y]); stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);}
    }
    if(cluster.length>=3){for(let [x,y] of cluster) grid[x][y]="-";}
}

// Partikel zeichnen
function drawParticles(){
    particles.forEach(p=>{
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

// Farben
function colorToHex(c){
    switch(c){
        case "R": return "#ff4d4d";
        case "G": return "#4dff4d";
        case "B": return "#4d4dff";
        case "P": return "#ff4dff";
        default: return "#fff";
    }
}
