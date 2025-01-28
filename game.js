import * as THREE from 'three';


const TIME_SETTINGS = {
    DAY_LENGTH_SECONDS: 600,
    CELESTIAL_RADIUS: 300,
    SKY_COLORS: {
        DAY: 0x87CEEB,    
        NIGHT: 0x000022   
    },
    AMBIENT_LIGHT: {
        DAY: 0.8,         
        NIGHT: 0.2
    },
    DIRECTIONAL_LIGHT: {
        DAY: 1.2,         
        NIGHT: 0.0
    },
    TIMES: {
        SUNRISE: 0.25,    
        NOON: 0.5,        
        SUNSET: 0.75,     
        MIDNIGHT: 0.0     
    }
};

const SETTINGS = {
    CHUNK_SIZE: 16,
    RENDER_DISTANCE: 2,
    WORLD_HEIGHT: 32,
    GRAVITY: -0.1,           
    MOVE_SPEED: 0.2,         
    JUMP_FORCE: 0.7,         
    MAX_FALL_SPEED: -2.0,    
    MOUSE_SENSITIVITY: 0.002, 
    PLAYER_HEIGHT: 1.8,      
    PLAYER_WIDTH: 0.6,       
    PLAYER_EYE_HEIGHT: 1.6,
    MIN_TERRAIN_HEIGHT: 3,
    STAR_COUNT: 1000
};

const NOISE = {
    SCALE: 0.03,
    HEIGHT_SCALE: 12,
    ROUGHNESS: 0.5,
    WATER_LEVEL: 4
};

const stats = {
    fps: 0,
    playerPos: { x: 0, y: 0, z: 0 },
    playerChunk: { x: 0, z: 0 },
    loadedChunks: 0
};

const BLOCKS = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    SAND: 4,
    WATER: 5,
    WOOD: 6,
    LEAVES: 7
};

const BLOCK_COLORS = {
    [BLOCKS.DIRT]: 0x8B4513,
    [BLOCKS.GRASS]: 0x355E3B,
    [BLOCKS.STONE]: 0x808080,
    [BLOCKS.SAND]: 0xDCD6A1,
    [BLOCKS.WATER]: 0x3F76AF,
    [BLOCKS.WOOD]: 0x8B4513,
    [BLOCKS.LEAVES]: 0x2D5A27
};

const style = document.createElement('style');
style.textContent = `
    .menu {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        padding: 10px;
        border-radius: 5px;
        color: white;
        font-family: monospace;
    }
    .menu button {
        background: #444;
        border: none;
        color: white;
        padding: 5px 10px;
        cursor: pointer;
        margin: 5px;
        border-radius: 3px;
        display: block;
        width: 100%;
    }
    .menu button:hover {
        background: #666;
    }
`;
document.head.appendChild(style);

const menu = document.createElement('div');
menu.className = 'menu';
menu.innerHTML = `
    <button id="sunrise">Sunrise (6:00)</button>
    <button id="noon">Noon (12:00)</button>
    <button id="sunset">Sunset (18:00)</button>
    <button id="midnight">Midnight (0:00)</button>
    <button id="autoTime">Auto Time</button>
    <div id="timeStatus">Current: Auto</div>
`;
document.body.appendChild(menu);

class DayNightCycle {
    constructor(scene) {
        this.scene = scene;
        this.dayLengthMs = TIME_SETTINGS.DAY_LENGTH_SECONDS * 1000;
        this.forcedTimeStart = null;
        this.forcedTime = null;
        this.forcedTimeOffset = 0;

        const sunGeometry = new THREE.PlaneGeometry(40, 40);
        const sunMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1.0
        });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(this.sun);

        this.sunLight = new THREE.DirectionalLight(0xffffff, TIME_SETTINGS.DIRECTIONAL_LIGHT.DAY);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        this.sunLight.shadow.bias = -0.001;
        scene.add(this.sunLight);

        const moonGeometry = new THREE.PlaneGeometry(30, 30);
        const moonMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        scene.add(this.moon);

        const starGeometry = new THREE.BufferGeometry();
        const starPositions = [];
        const starColors = [];

        for(let i = 0; i < SETTINGS.STAR_COUNT; i++) {
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = TIME_SETTINGS.CELESTIAL_RADIUS * 0.9;

            starPositions.push(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );

            const brightness = 0.5 + Math.random() * 0.5;
            starColors.push(brightness, brightness, brightness);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true
        });

        this.stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(this.stars);

        this.ambientLight = scene.children.find(child => child instanceof THREE.AmbientLight);

        document.getElementById('sunrise').addEventListener('click', () => {
            this.setForcedTime(TIME_SETTINGS.TIMES.SUNRISE);
        });
        
        document.getElementById('noon').addEventListener('click', () => {
            this.setForcedTime(TIME_SETTINGS.TIMES.NOON);
        });
        
        document.getElementById('sunset').addEventListener('click', () => {
            this.setForcedTime(TIME_SETTINGS.TIMES.SUNSET);
        });
        
        document.getElementById('midnight').addEventListener('click', () => {
            this.setForcedTime(TIME_SETTINGS.TIMES.MIDNIGHT);
        });
        
        document.getElementById('autoTime').addEventListener('click', () => {
            this.forcedTime = null;
            this.forcedTimeStart = null;
            this.forcedTimeOffset = 0;
            this.updateTimeStatus();
        });
    }

    updateTimeStatus() {
        const timeString = this.forcedTime === null ? 'Auto' :
            this.forcedTime === TIME_SETTINGS.TIMES.SUNRISE ? 'Sunrise' :
            this.forcedTime === TIME_SETTINGS.TIMES.NOON ? 'Noon' :
            this.forcedTime === TIME_SETTINGS.TIMES.SUNSET ? 'Sunset' :
            'Midnight';
        document.getElementById('timeStatus').textContent = `Current: ${timeString}`;
    }

    getCurrentTime() {
        if (this.forcedTime !== null) {
            const elapsed = (Date.now() - this.forcedTimeStart) / this.dayLengthMs;
            return (this.forcedTime + elapsed) % 1.0;
        }
        return (Date.now() % this.dayLengthMs) / this.dayLengthMs;
    }

    setForcedTime(time) {
        this.forcedTime = time;
        this.forcedTimeStart = Date.now();
        this.forcedTimeOffset = 0;
        this.updateTimeStatus();
    }

    update(renderer) {
        const time = this.getCurrentTime();
        const angle = (time * Math.PI * 2) - Math.PI/2;

        this.sun.position.x = Math.cos(angle) * TIME_SETTINGS.CELESTIAL_RADIUS;
        this.sun.position.y = Math.sin(angle) * TIME_SETTINGS.CELESTIAL_RADIUS;
        this.moon.position.x = Math.cos(angle + Math.PI) * TIME_SETTINGS.CELESTIAL_RADIUS;
        this.moon.position.y = Math.sin(angle + Math.PI) * TIME_SETTINGS.CELESTIAL_RADIUS;

        this.sunLight.position.copy(this.sun.position);
        this.sunLight.position.multiplyScalar(0.1);

        this.sun.lookAt(camera.position);
        this.moon.lookAt(camera.position);

        const normalizedY = Math.sin(angle);
        if (normalizedY > 0) {
            const intensity = Math.min(1, normalizedY * 1.5);
            renderer.setClearColor(new THREE.Color(TIME_SETTINGS.SKY_COLORS.DAY));
            this.ambientLight.intensity = THREE.MathUtils.lerp(
                TIME_SETTINGS.AMBIENT_LIGHT.NIGHT,
                TIME_SETTINGS.AMBIENT_LIGHT.DAY,
                intensity
            );
            this.sunLight.intensity = intensity * TIME_SETTINGS.DIRECTIONAL_LIGHT.DAY;
            this.sun.material.opacity = Math.min(1, intensity * 1.5);
            this.stars.material.opacity = Math.max(0, 0.8 - normalizedY * 2);
        } else {
            renderer.setClearColor(TIME_SETTINGS.SKY_COLORS.NIGHT);
            this.ambientLight.intensity = TIME_SETTINGS.AMBIENT_LIGHT.NIGHT;
            this.sunLight.intensity = 0;
            this.sun.material.opacity = 0;
            this.stars.material.opacity = 0.8;
        }

        return Math.floor(time * 24);
    }
}

class Chunk {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.blocks = new Array(SETTINGS.CHUNK_SIZE).fill(null).map(() =>
            new Array(SETTINGS.WORLD_HEIGHT).fill(null).map(() =>
                new Array(SETTINGS.CHUNK_SIZE).fill(0)
            )
        );
        this.mesh = null;
        this.generated = false;
    }

    getBlock(x, y, z) {
        if (x >= 0 && x < SETTINGS.CHUNK_SIZE &&
            y >= 0 && y < SETTINGS.WORLD_HEIGHT &&
            z >= 0 && z < SETTINGS.CHUNK_SIZE) {
            return this.blocks[x][y][z];
        }
        return 0;
    }

    generate() {
        for(let x = 0; x < SETTINGS.CHUNK_SIZE; x++) {
            for(let z = 0; z < SETTINGS.CHUNK_SIZE; z++) {
                const worldX = this.x * SETTINGS.CHUNK_SIZE + x;
                const worldZ = this.z * SETTINGS.CHUNK_SIZE + z;
                
                const baseNoise = Math.sin(worldX * NOISE.SCALE) * Math.cos(worldZ * NOISE.SCALE);
                const detailNoise = Math.sin(worldX * NOISE.SCALE * 2) * Math.cos(worldZ * NOISE.SCALE * 2) * NOISE.ROUGHNESS;
                
                let height = (baseNoise + detailNoise) * NOISE.HEIGHT_SCALE;
                height = Math.floor(height) + NOISE.WATER_LEVEL;
                
                for(let y = 0; y < SETTINGS.WORLD_HEIGHT; y++) {
                    if(y > height) {
                        this.blocks[x][y][z] = y <= NOISE.WATER_LEVEL ? BLOCKS.WATER : BLOCKS.AIR;
                    } else if(y === height) {
                        if(y <= NOISE.WATER_LEVEL + 1) {
                            this.blocks[x][y][z] = BLOCKS.SAND;
                        } else {
                            this.blocks[x][y][z] = BLOCKS.GRASS;
                        }
                    } else if(y > height - 3) {
                        this.blocks[x][y][z] = y <= NOISE.WATER_LEVEL + 1 ? BLOCKS.SAND : BLOCKS.DIRT;
                    } else {
                        this.blocks[x][y][z] = BLOCKS.STONE;
                    }
                }

                if(height > NOISE.WATER_LEVEL + 1 && 
                   Math.random() < 0.02 && 
                   this.blocks[x][height][z] === BLOCKS.GRASS) {
                    
                    const treeHeight = 4 + Math.floor(Math.random() * 2);
                    
                    for(let y = height + 1; y < height + treeHeight; y++) {
                        if(y < SETTINGS.WORLD_HEIGHT) {
                            this.blocks[x][y][z] = BLOCKS.WOOD;
                        }
                    }
                    
                    if(height + treeHeight < SETTINGS.WORLD_HEIGHT) {
                        for(let lx = -2; lx <= 2; lx++) {
                            for(let ly = -2; ly <= 2; ly++) {
                                for(let lz = -2; lz <= 2; lz++) {
                                    const tx = x + lx;
                                    const ty = height + treeHeight + ly;
                                    const tz = z + lz;
                                    
                                    if(tx >= 0 && tx < SETTINGS.CHUNK_SIZE &&
                                       ty >= 0 && ty < SETTINGS.WORLD_HEIGHT &&
                                       tz >= 0 && tz < SETTINGS.CHUNK_SIZE &&
                                       Math.random() < 0.6) {
                                        
                                        if(this.blocks[tx][ty][tz] === BLOCKS.AIR) {
                                            this.blocks[tx][ty][tz] = BLOCKS.LEAVES;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        this.createMesh();
        this.generated = true;
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial();
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let blockCount = 0;

        for(let x = 0; x < SETTINGS.CHUNK_SIZE; x++) {
            for(let y = 0; y < SETTINGS.WORLD_HEIGHT; y++) {
                for(let z = 0; z < SETTINGS.CHUNK_SIZE; z++) {
                    if(this.blocks[x][y][z] !== BLOCKS.AIR) blockCount++;
                }
            }
        }

        if (blockCount === 0) return;

        const instancedMesh = new THREE.InstancedMesh(geometry, material, blockCount);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        let index = 0;

        for(let x = 0; x < SETTINGS.CHUNK_SIZE; x++) {
            for(let y = 0; y < SETTINGS.WORLD_HEIGHT; y++) {
                for(let z = 0; z < SETTINGS.CHUNK_SIZE; z++) {
                    const blockType = this.blocks[x][y][z];
                    if(blockType !== BLOCKS.AIR) {
                        const worldX = this.x * SETTINGS.CHUNK_SIZE + x;
                        const worldZ = this.z * SETTINGS.CHUNK_SIZE + z;
                        matrix.setPosition(worldX + 0.5, y + 0.5, worldZ + 0.5);
                        instancedMesh.setMatrixAt(index, matrix);
                        color.setHex(BLOCK_COLORS[blockType]);
                        instancedMesh.setColorAt(index, color);
                        index++;
                    }
                }
            }
        }

        if (this.mesh) scene.remove(this.mesh);
        this.mesh = instancedMesh;
        scene.add(this.mesh);
    }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const hudElement = document.createElement('div');
hudElement.style.position = 'fixed';
hudElement.style.top = '10px';
hudElement.style.left = '10px';
hudElement.style.color = 'white';
hudElement.style.fontFamily = 'monospace';
hudElement.style.fontSize = '12px';
hudElement.style.textShadow = '1px 1px 1px black';
hudElement.style.userSelect = 'none';
document.body.appendChild(hudElement);

const ambientLight = new THREE.AmbientLight(0xffffff, TIME_SETTINGS.AMBIENT_LIGHT.DAY);
scene.add(ambientLight);

const dayNightCycle = new DayNightCycle(scene);

const chunks = new Map();

function getChunkKey(x, z) {
    return `${x},${z}`;
}

function getChunk(x, z) {
    return chunks.get(getChunkKey(x, z));
}

function getWorldBlock(x, y, z) {
    const chunkX = Math.floor(x / SETTINGS.CHUNK_SIZE);
    const chunkZ = Math.floor(z / SETTINGS.CHUNK_SIZE);
    const chunk = getChunk(chunkX, chunkZ);
    if (!chunk) return BLOCKS.AIR;
    
    const localX = x - chunkX * SETTINGS.CHUNK_SIZE;
    const localZ = z - chunkZ * SETTINGS.CHUNK_SIZE;
    return chunk.getBlock(localX, y, localZ);
}

function updateLoadedChunks() {
    const playerChunkX = Math.floor(player.position.x / SETTINGS.CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / SETTINGS.CHUNK_SIZE);

    for (const [key, chunk] of chunks.entries()) {
        const dx = chunk.x - playerChunkX;
        const dz = chunk.z - playerChunkZ;
        if (Math.abs(dx) > SETTINGS.RENDER_DISTANCE || Math.abs(dz) > SETTINGS.RENDER_DISTANCE) {
            if (chunk.mesh) scene.remove(chunk.mesh);
            chunks.delete(key);
        }
    }

    for (let dx = -SETTINGS.RENDER_DISTANCE; dx <= SETTINGS.RENDER_DISTANCE; dx++) {
        for (let dz = -SETTINGS.RENDER_DISTANCE; dz <= SETTINGS.RENDER_DISTANCE; dz++) {
            const chunkX = playerChunkX + dx;
            const chunkZ = playerChunkZ + dz;
            const key = getChunkKey(chunkX, chunkZ);
            
            if (!chunks.has(key)) {
                const chunk = new Chunk(chunkX, chunkZ);
                chunks.set(key, chunk);
                chunk.generate();
            }
        }
    }
}

const player = {
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    isOnGround: false
};

camera.position.copy(player.position);
camera.position.y += SETTINGS.PLAYER_EYE_HEIGHT;

const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

let canLook = false;

document.addEventListener('click', () => {
    if (!canLook) {
        renderer.domElement.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    canLook = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (event) => {
    if (!canLook) return;
    
    player.rotation.y -= event.movementX * SETTINGS.MOUSE_SENSITIVITY;
    player.rotation.x -= event.movementY * SETTINGS.MOUSE_SENSITIVITY;
    
    player.rotation.x = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, player.rotation.x));
    
    camera.rotation.copy(player.rotation);
});

document.addEventListener('keydown', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case ' ': 
            if(player.isOnGround) {
                player.velocity.y = SETTINGS.JUMP_FORCE;
                player.isOnGround = false;
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
    }
});

function isBlockBelow() {
    const x = Math.floor(player.position.x);
    const y = Math.floor(player.position.y - 0.1);
    const z = Math.floor(player.position.z);
    return getWorldBlock(x, y, z) !== BLOCKS.AIR;
}

function checkCollision(position) {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);
    
    const positions = [
        {x: position.x, y: position.y, z: position.z},
        {x: position.x, y: position.y + SETTINGS.PLAYER_HEIGHT, z: position.z}
    ];

    for (const pos of positions) {
        if (getWorldBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) !== BLOCKS.AIR) {
            return true;
        }
    }
    return false;
}

let lastTime = performance.now();
let frames = 0;

function animate() {
    requestAnimationFrame(animate);

    frames++;
    const time = performance.now();
    if (time >= lastTime + 1000) {
        stats.fps = Math.round((frames * 1000) / (time - lastTime));
        frames = 0;
        lastTime = time;
    }

    const currentHour = dayNightCycle.update(renderer);

    stats.playerPos = {
        x: Math.round(player.position.x * 100) / 100,
        y: Math.round(player.position.y * 100) / 100,
        z: Math.round(player.position.z * 100) / 100
    };
    stats.playerChunk = {
        x: Math.floor(player.position.x / SETTINGS.CHUNK_SIZE),
        z: Math.floor(player.position.z / SETTINGS.CHUNK_SIZE)
    };
    stats.loadedChunks = chunks.size;

    hudElement.innerHTML = `
        FPS: ${stats.fps}
        Time: ${currentHour}:00
        Position: ${stats.playerPos.x}, ${stats.playerPos.y}, ${stats.playerPos.z}
        Chunk: ${stats.playerChunk.x}, ${stats.playerChunk.z}
        Loaded Chunks: ${stats.loadedChunks}
        Velocity Y: ${Math.round(player.velocity.y * 100) / 100}
        On Ground: ${player.isOnGround}
    `;

    updateLoadedChunks();

    player.isOnGround = isBlockBelow();

    if (!player.isOnGround) {
        player.velocity.y += SETTINGS.GRAVITY;
        player.velocity.y = Math.max(player.velocity.y, SETTINGS.MAX_FALL_SPEED);
    } else {
        player.velocity.y = Math.max(0, player.velocity.y);
    }

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const moveVector = new THREE.Vector3(0, 0, 0);

    if (keys.w) moveVector.add(forward);
    if (keys.s) moveVector.sub(forward);
    if (keys.a) moveVector.sub(right);
    if (keys.d) moveVector.add(right);

    if (moveVector.length() > 0) {
        moveVector.normalize();
        moveVector.multiplyScalar(SETTINGS.MOVE_SPEED);
        player.velocity.x = moveVector.x;
        player.velocity.z = moveVector.z;
    } else {
        player.velocity.x = 0;
        player.velocity.z = 0;
    }

    const newPosition = player.position.clone();
    
    const xMove = newPosition.clone();
    xMove.x += player.velocity.x;
    if (!checkCollision(xMove)) {
        newPosition.x = xMove.x;
    }

    const yMove = newPosition.clone();
    yMove.y += player.velocity.y;
    if (!checkCollision(yMove)) {
        newPosition.y = yMove.y;
    } else {
        if (player.velocity.y < 0) {
            player.isOnGround = true;
        }
        player.velocity.y = 0;
    }

    const zMove = newPosition.clone();
    zMove.z += player.velocity.z;
    if (!checkCollision(zMove)) {
        newPosition.z = zMove.z;
    }

    player.position.copy(newPosition);
    camera.position.copy(player.position);
    camera.position.y += SETTINGS.PLAYER_EYE_HEIGHT;

    renderer.render(scene, camera);
}

animate();