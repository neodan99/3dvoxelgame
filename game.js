import * as THREE from 'three';

// Noise implementation
function noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return lerp(v, lerp(u, grad2D(p[A], x, y), 
                          grad2D(p[B], x - 1, y)),
                   lerp(u, grad2D(p[A + 1], x, y - 1),
                          grad2D(p[B + 1], x - 1, y - 1)));
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad2D(hash, x, y) {
    const h = hash & 15;
    const grad = 1 + (h & 7);
    return ((h & 8) ? -grad : grad) * x + ((h & 4) ? -grad : grad) * y;
}

const p = new Uint8Array(512);
for(let i = 0; i < 256; i++) p[i] = i;
for(let i = 0; i < 255; i++) {
    const r = i + ~~(Math.random() * (256 - i));
    const aux = p[i];
    p[i] = p[r];
    p[r] = aux;
}
for(let i = 256; i < 512; i++) p[i] = p[i-256];

const TIME_SETTINGS = {
    DAY_LENGTH_SECONDS: 600,
    CELESTIAL_RADIUS: 300,
    SKY_COLORS: {
        DAY: 0x87CEEB,    
        NIGHT: 0x000022   
    },
    AMBIENT_LIGHT: {
        DAY: 0.6,         
        NIGHT: 0.2
    },
    DIRECTIONAL_LIGHT: {
        DAY: 0.8,         
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
    STAR_COUNT: 1000,
    AO_STRENGTH: 0.5,
    MAX_REACH: 4
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

const INVENTORY = {
    slots: Array(9).fill(null),
    selectedSlot: 0,
    blockTypes: [
        BLOCKS.DIRT,
        BLOCKS.GRASS,
        BLOCKS.STONE,
        BLOCKS.SAND,
        BLOCKS.WOOD,
        BLOCKS.LEAVES
    ]
};





// Initialize inventory with default blocks
for (let i = 0; i < INVENTORY.blockTypes.length; i++) {
    INVENTORY.slots[i] = INVENTORY.blockTypes[i];
}

const NOISE = {
    SCALE: 0.03,
    WATER_LEVEL: 4
};



const BIOMES = {
    PLAINS: 'plains',
    FOREST: 'forest',
    DESERT: 'desert',
    OCEAN: 'ocean'
};

const BIOME_SETTINGS = {
    [BIOMES.PLAINS]: {
        heightScale: 8,
        surfaceBlock: BLOCKS.GRASS,
        subSurfaceBlock: BLOCKS.DIRT,
        treeDensity: 0.02
    },
    [BIOMES.FOREST]: {
        heightScale: 10,
        surfaceBlock: BLOCKS.GRASS,
        subSurfaceBlock: BLOCKS.DIRT,
        treeDensity: 0.2
    },
    [BIOMES.DESERT]: {
        heightScale: 6,
        surfaceBlock: BLOCKS.SAND,
        subSurfaceBlock: BLOCKS.SAND,
        treeDensity: 0
    },
    [BIOMES.OCEAN]: {
        heightScale: 4,
        surfaceBlock: BLOCKS.SAND,
        subSurfaceBlock: BLOCKS.SAND,
        treeDensity: 0,
        waterLevel: 8
    }
};

const BLOCK_COLORS = {
    [BLOCKS.DIRT]: 0x8B4513,
    [BLOCKS.GRASS]: 0x55AA55,
    [BLOCKS.STONE]: 0x808080,
    [BLOCKS.SAND]: 0xFFDB8C,
    [BLOCKS.WATER]: 0x3366FF,
    [BLOCKS.WOOD]: 0x6B4423,
    [BLOCKS.LEAVES]: 0x3ABB3A
};

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Enhanced lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 100, 100);
directionalLight.target.position.set(0, 0, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
directionalLight.shadow.bias = -0.001;
scene.add(directionalLight);
scene.add(directionalLight.target);

const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.2);
secondaryLight.position.set(-50, 50, -50);
scene.add(secondaryLight);

// Create instanced mesh for water
const waterGeometry = new THREE.BoxGeometry(1, 1, 1);
const waterMaterial = new THREE.MeshPhongMaterial({
    color: BLOCK_COLORS[BLOCKS.WATER],
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false
});

const chunks = new Map();
const waterInstances = new Map();

class DayNightCycle {
    constructor(scene) {
        this.scene = scene;
        this.time = 0;
        this.dayLength = TIME_SETTINGS.DAY_LENGTH_SECONDS;
        
        const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(this.sun);
        
        const moonGeometry = new THREE.SphereGeometry(8, 32, 32);
        const moonMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        scene.add(this.moon);

        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < SETTINGS.STAR_COUNT; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = TIME_SETTINGS.CELESTIAL_RADIUS;
            
            starVertices.push(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
        this.stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(this.stars);
    }

    update(renderer) {
        this.time += 1 / 60;
        if (this.time >= this.dayLength) {
            this.time = 0;
        }

        const dayProgress = (this.time / this.dayLength) % 1;
        const angle = dayProgress * Math.PI * 2;

        const radius = TIME_SETTINGS.CELESTIAL_RADIUS;
        this.sun.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );
        this.moon.position.set(
            Math.cos(angle + Math.PI) * radius,
            Math.sin(angle + Math.PI) * radius,
            0
        );

        const isDay = dayProgress >= TIME_SETTINGS.TIMES.SUNRISE && 
                     dayProgress < TIME_SETTINGS.TIMES.SUNSET;
        const transitionProgress = isDay ? 
            Math.min(1, (dayProgress - TIME_SETTINGS.TIMES.SUNRISE) * 4) :
            Math.max(0, 1 - (dayProgress - TIME_SETTINGS.TIMES.SUNSET) * 4);

        const skyColor = new THREE.Color(TIME_SETTINGS.SKY_COLORS.NIGHT)
            .lerp(new THREE.Color(TIME_SETTINGS.SKY_COLORS.DAY), transitionProgress);
        renderer.setClearColor(skyColor);

        ambientLight.intensity = THREE.MathUtils.lerp(
            TIME_SETTINGS.AMBIENT_LIGHT.NIGHT,
            TIME_SETTINGS.AMBIENT_LIGHT.DAY,
            transitionProgress
        );

        directionalLight.intensity = THREE.MathUtils.lerp(
            TIME_SETTINGS.DIRECTIONAL_LIGHT.NIGHT,
            TIME_SETTINGS.DIRECTIONAL_LIGHT.DAY,
            transitionProgress
        );

        this.stars.visible = transitionProgress < 0.5;
    }
}

class Chunk {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.mesh = null;
        this.waterMesh = null;
        this.blocks = new Array(SETTINGS.CHUNK_SIZE * SETTINGS.WORLD_HEIGHT * SETTINGS.CHUNK_SIZE).fill(BLOCKS.AIR);
        this.modified = false;
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= SETTINGS.WORLD_HEIGHT) return BLOCKS.AIR;
        return this.blocks[y * SETTINGS.CHUNK_SIZE * SETTINGS.CHUNK_SIZE + z * SETTINGS.CHUNK_SIZE + x];
    }

    setBlock(x, y, z, type) {
        if (y < 0 || y >= SETTINGS.WORLD_HEIGHT) return;
        this.blocks[y * SETTINGS.CHUNK_SIZE * SETTINGS.CHUNK_SIZE + z * SETTINGS.CHUNK_SIZE + x] = type;
        this.modified = true;
    }

    getBiome(worldX, worldZ) {
        const temperature = noise2D(worldX * 0.01, worldZ * 0.01);
        const moisture = noise2D(worldX * 0.01 + 500, worldZ * 0.01 + 500);

        if (temperature < -0.2) return BIOMES.OCEAN;
        if (temperature > 0.4 && moisture < 0) return BIOMES.DESERT;
        if (moisture > 0.3) return BIOMES.FOREST;
        return BIOMES.PLAINS;
    }

    generate() {
        for (let x = 0; x < SETTINGS.CHUNK_SIZE; x++) {
            for (let z = 0; z < SETTINGS.CHUNK_SIZE; z++) {
                const worldX = this.x * SETTINGS.CHUNK_SIZE + x;
                const worldZ = this.z * SETTINGS.CHUNK_SIZE + z;
                
                const biome = this.getBiome(worldX, worldZ);
                const biomeSettings = BIOME_SETTINGS[biome];
                
                const baseHeight = (noise2D(worldX * NOISE.SCALE, worldZ * NOISE.SCALE) + 1) 
                    * biomeSettings.heightScale + SETTINGS.MIN_TERRAIN_HEIGHT;
                const height = Math.floor(baseHeight);

                for (let y = 0; y < SETTINGS.WORLD_HEIGHT; y++) {
                    if (y === 0) {
                        this.setBlock(x, y, z, BLOCKS.STONE);
                    } else if (y < height - 4) {
                        this.setBlock(x, y, z, BLOCKS.STONE);
                    } else if (y < height) {
                        this.setBlock(x, y, z, biomeSettings.subSurfaceBlock);
                    } else if (y === height) {
                        this.setBlock(x, y, z, biomeSettings.surfaceBlock);
                    } else if (biome === BIOMES.OCEAN && y <= biomeSettings.waterLevel) {
                        this.setBlock(x, y, z, BLOCKS.WATER);
                    }
                }

                if (height > NOISE.WATER_LEVEL + 1 && 
                    Math.random() < biomeSettings.treeDensity) {
                    this.generateTree(x, height + 1, z);
                }
            }
        }
        this.createMesh();
    }

    generateTree(x, y, z) {
        const trunkHeight = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < trunkHeight; i++) {
            this.setBlock(x, y + i, z, BLOCKS.WOOD);
        }

        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = trunkHeight - 2; dy <= trunkHeight + 1; dy++) {
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    if (distance < (dy === trunkHeight + 1 ? 1.5 : 2.5)) {
                        const lx = x + dx;
                        const ly = y + dy;
                        const lz = z + dz;
                        if (this.isInChunk(lx, ly, lz)) {
                            this.setBlock(lx, ly, lz, BLOCKS.LEAVES);
                        }
                    }
                }
            }
        }
    }

    isInChunk(x, y, z) {
        return x >= 0 && x < SETTINGS.CHUNK_SIZE && 
               y >= 0 && y < SETTINGS.WORLD_HEIGHT && 
               z >= 0 && z < SETTINGS.CHUNK_SIZE;
    }

    calculateAO(x, y, z, side) {
        let ao = 0;
        const corners = [];
        
        switch(side) {
            case 'top':
                corners.push(
                    this.getBlock(x-1, y, z-1) !== BLOCKS.AIR,
                    this.getBlock(x-1, y, z+1) !== BLOCKS.AIR,
                    this.getBlock(x+1, y, z-1) !== BLOCKS.AIR,
                    this.getBlock(x+1, y, z+1) !== BLOCKS.AIR
                );
                break;
            case 'bottom':
                corners.push(
                    this.getBlock(x-1, y, z-1) !== BLOCKS.AIR,
                    this.getBlock(x-1, y, z+1) !== BLOCKS.AIR,
                    this.getBlock(x+1, y, z-1) !== BLOCKS.AIR,
                    this.getBlock(x+1, y, z+1) !== BLOCKS.AIR
                );
                break;
            // Add cases for other sides
        }
        
        ao = corners.filter(Boolean).length * SETTINGS.AO_STRENGTH;
        return 1 - ao;
    }

    createMesh() {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
        if (this.waterMesh) {
            scene.remove(this.waterMesh);
        }

        const geometry = new THREE.BufferGeometry();
        const waterGeometry = new THREE.BufferGeometry();
        const vertices = [];
        const waterVertices = [];
        const colors = [];
        const waterColors = [];
        const normals = [];
        const waterNormals = [];

        const shouldRenderFace = (x, y, z, adjacentX, adjacentY, adjacentZ) => {
            if (adjacentY < 0 || adjacentY >= SETTINGS.WORLD_HEIGHT) return true;
            if (x < 0 || x >= SETTINGS.CHUNK_SIZE || z < 0 || z >= SETTINGS.CHUNK_SIZE) {
                const worldX = this.x * SETTINGS.CHUNK_SIZE + x;
                const worldZ = this.z * SETTINGS.CHUNK_SIZE + z;
                const block = getWorldBlock(worldX, adjacentY, worldZ);
                return block === BLOCKS.AIR || 
                       (block === BLOCKS.WATER && this.getBlock(x, y, z) !== BLOCKS.WATER);
            }
            const block = this.getBlock(adjacentX, adjacentY, adjacentZ);
            return block === BLOCKS.AIR || 
                   (block === BLOCKS.WATER && this.getBlock(x, y, z) !== BLOCKS.WATER);
        };

        const addFace = (x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, color, normal, side, isWater = false) => {
            const targetVertices = isWater ? waterVertices : vertices;
            const targetColors = isWater ? waterColors : colors;
            const targetNormals = isWater ? waterNormals : normals;

            const ao = this.calculateAO(Math.floor(x1), Math.floor(y1), Math.floor(z1), side);
            const shadedColor = color.clone().multiplyScalar(ao);

            targetVertices.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
            targetVertices.push(x3, y3, z3, x4, y4, z4, x1, y1, z1);
            
            for (let i = 0; i < 6; i++) {
                targetNormals.push(normal.x, normal.y, normal.z);
                targetColors.push(shadedColor.r, shadedColor.g, shadedColor.b);
            }
        };

        for (let x = 0; x < SETTINGS.CHUNK_SIZE; x++) {
            for (let y = 0; y < SETTINGS.WORLD_HEIGHT; y++) {
                for (let z = 0; z < SETTINGS.CHUNK_SIZE; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BLOCKS.AIR) continue;

                    const isWater = block === BLOCKS.WATER;
                    const color = new THREE.Color(BLOCK_COLORS[block]);
                    const wx = x + this.x * SETTINGS.CHUNK_SIZE;
                    const wz = z + this.z * SETTINGS.CHUNK_SIZE;

                    if (shouldRenderFace(x, y, z, x, y + 1, z)) {
                        addFace(wx, y + 1, wz, wx, y + 1, wz + 1, wx + 1, y + 1, wz + 1, wx + 1, y + 1, wz, 
                            color, new THREE.Vector3(0, 1, 0), 'top', isWater);
                    }
                    if (shouldRenderFace(x, y, z, x, y - 1, z)) {
                        addFace(wx, y, wz, wx + 1, y, wz, wx + 1, y, wz + 1, wx, y, wz + 1, 
                            color, new THREE.Vector3(0, -1, 0), 'bottom', isWater);
                    }
                    if (shouldRenderFace(x, y, z, x - 1, y, z)) {
                        addFace(wx, y, wz, wx, y, wz + 1, wx, y + 1, wz + 1, wx, y + 1, wz, 
                            color, new THREE.Vector3(-1, 0, 0), 'left', isWater);
                    }
                    if (shouldRenderFace(x, y, z, x + 1, y, z)) {
                        addFace(wx + 1, y, wz + 1, wx + 1, y + 1, wz + 1, wx + 1, y + 1, wz, wx + 1, y, wz, 
                            color, new THREE.Vector3(1, 0, 0), 'right', isWater);
                    }
                    if (shouldRenderFace(x, y, z, x, y, z - 1)) {
                        addFace(wx + 1, y, wz, wx + 1, y + 1, wz, wx, y + 1, wz, wx, y, wz, 
                            color, new THREE.Vector3(0, 0, -1), 'front', isWater);
                    }
                    if (shouldRenderFace(x, y, z, x, y, z + 1)) {
                        addFace(wx, y, wz + 1, wx, y + 1, wz + 1, wx + 1, y + 1, wz + 1, wx + 1, y, wz + 1, 
                            color, new THREE.Vector3(0, 0, 1), 'back', isWater);
                    }
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.FrontSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);

        if (waterVertices.length > 0) {
            waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3));
            waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
            waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));

            const waterMaterial = new THREE.MeshLambertMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
            scene.add(this.waterMesh);
        }
    }
}

const player = {
    position: new THREE.Vector3(0, SETTINGS.WORLD_HEIGHT, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    isOnGround: false
};

camera.position.copy(player.position);
camera.position.y += SETTINGS.PLAYER_EYE_HEIGHT;

const keys = { w: false, a: false, s: false, d: false };
let canLook = false;

// Block interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersectedBlock() {
    raycaster.setFromCamera(mouse, camera);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.ray.direction.copy(direction);
    
    const position = new THREE.Vector3();
    for (let i = 0; i < SETTINGS.MAX_REACH * 10; i++) {
        position.copy(camera.position).add(direction.multiplyScalar(i * 0.1));
        const x = Math.floor(position.x);
        const y = Math.floor(position.y);
        const z = Math.floor(position.z);
        
        const block = getWorldBlock(x, y, z);
        if (block !== BLOCKS.AIR && block !== BLOCKS.WATER) {
            return { position, block, x, y, z };
        }
    }
    return null;
}

document.addEventListener('mousedown', (event) => {
    if (!canLook) return;
    
    const intersection = getIntersectedBlock();
    if (!intersection) return;

    if (event.button === 0) { // Left click - break block
        const chunkX = Math.floor(intersection.x / SETTINGS.CHUNK_SIZE);
        const chunkZ = Math.floor(intersection.z / SETTINGS.CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk) {
            const localX = ((intersection.x % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
            const localZ = ((intersection.z % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
            chunk.setBlock(localX, intersection.y, localZ, BLOCKS.AIR);
            chunk.createMesh();
        }
    } else if (event.button === 2) { // Right click - place block
        const normal = new THREE.Vector3();
        normal.subVectors(intersection.position, camera.position).normalize();
        
        const placeX = intersection.x - Math.round(normal.x);
        const placeY = intersection.y - Math.round(normal.y);
        const placeZ = intersection.z - Math.round(normal.z);
        
        const chunkX = Math.floor(placeX / SETTINGS.CHUNK_SIZE);
        const chunkZ = Math.floor(placeZ / SETTINGS.CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk) {
            const localX = ((placeX % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
            const localZ = ((placeZ % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
            const selectedBlock = INVENTORY.slots[INVENTORY.selectedSlot];
            if (selectedBlock) {
                chunk.setBlock(localX, placeY, localZ, selectedBlock);
                chunk.createMesh();
            }
        }
    }
});

document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

document.addEventListener('wheel', (event) => {
    INVENTORY.selectedSlot = (INVENTORY.selectedSlot + (event.deltaY > 0 ? 1 : -1) + 9) % 9;
});

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

function getWorldBlock(x, y, z) {
    const chunkX = Math.floor(x / SETTINGS.CHUNK_SIZE);
    const chunkZ = Math.floor(z / SETTINGS.CHUNK_SIZE);
    const chunk = chunks.get(`${chunkX},${chunkZ}`);
    if (!chunk) return BLOCKS.AIR;

    const localX = ((x % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
    const localZ = ((z % SETTINGS.CHUNK_SIZE) + SETTINGS.CHUNK_SIZE) % SETTINGS.CHUNK_SIZE;
    return chunk.getBlock(localX, y, localZ);
}

function updateLoadedChunks() {
    const playerChunkX = Math.floor(player.position.x / SETTINGS.CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / SETTINGS.CHUNK_SIZE);

    for (let dx = -SETTINGS.RENDER_DISTANCE; dx <= SETTINGS.RENDER_DISTANCE; dx++) {
        for (let dz = -SETTINGS.RENDER_DISTANCE; dz <= SETTINGS.RENDER_DISTANCE; dz++) {
            const chunkX = playerChunkX + dx;
            const chunkZ = playerChunkZ + dz;
            const key = `${chunkX},${chunkZ}`;
            
            if (!chunks.has(key)) {
                const chunk = new Chunk(chunkX, chunkZ);
                chunks.set(key, chunk);
                chunk.generate();
            }
        }
    }

    // Remove chunks that are too far away
    for (const [key, chunk] of chunks.entries()) {
        const [x, z] = key.split(',').map(Number);
        if (Math.abs(x - playerChunkX) > SETTINGS.RENDER_DISTANCE + 1 ||
            Math.abs(z - playerChunkZ) > SETTINGS.RENDER_DISTANCE + 1) {
            if (chunk.mesh) scene.remove(chunk.mesh);
            if (chunk.waterMesh) scene.remove(chunk.waterMesh);
            chunks.delete(key);
        }
    }
}

function isBlockBelow() {
    const x = Math.floor(player.position.x);
    const y = Math.floor(player.position.y - 0.1);
    const z = Math.floor(player.position.z);
    return getWorldBlock(x, y, z) !== BLOCKS.AIR;
}

function checkCollision(position) {
    const positions = [
        // Check player's body bounds
        {x: position.x - SETTINGS.PLAYER_WIDTH/2, y: position.y, z: position.z - SETTINGS.PLAYER_WIDTH/2},
        {x: position.x + SETTINGS.PLAYER_WIDTH/2, y: position.y, z: position.z - SETTINGS.PLAYER_WIDTH/2},
        {x: position.x - SETTINGS.PLAYER_WIDTH/2, y: position.y, z: position.z + SETTINGS.PLAYER_WIDTH/2},
        {x: position.x + SETTINGS.PLAYER_WIDTH/2, y: position.y, z: position.z + SETTINGS.PLAYER_WIDTH/2},
        // Check player's head
        {x: position.x, y: position.y + SETTINGS.PLAYER_HEIGHT, z: position.z}
    ];

    for (const pos of positions) {
        if (getWorldBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) !== BLOCKS.AIR) {
            return true;
        }
    }
    return false;
}

function animate() {
    requestAnimationFrame(animate);

    dayNightCycle.update(renderer);
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

// Create day/night cycle instance
const dayNightCycle = new DayNightCycle(scene);

// Start the animation loop
animate();