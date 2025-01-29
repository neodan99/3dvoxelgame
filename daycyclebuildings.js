import * as THREE from 'three';

// 1. Basic Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Player Settings
const player = {
    height: 2,
    speed: 0.1,
    turnSpeed: 0.002,
    rotation: new THREE.Euler(0, 0, 0, 'YXZ')
};

camera.position.y = player.height;
camera.rotation.order = 'YXZ';

// 3. Movement Controls
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Mouse look controls
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        player.rotation.y -= e.movementX * player.turnSpeed;
        player.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, 
            player.rotation.x - e.movementY * player.turnSpeed));
        camera.rotation.copy(player.rotation);
    }
});
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());

// 4. Lighting
const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
const moonLight = new THREE.DirectionalLight(0x666666, 0.5);
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(sunLight);
scene.add(moonLight);
scene.add(ambientLight);

// 5. Chunk system for terrain and buildings
const CHUNK_SIZE = 16;
const CELL_SIZE = 50;
const BUILD_CHANCE = 0.3;

const buildingGeometry = new THREE.BoxGeometry(10, 30, 10);
const buildingMaterial = new THREE.MeshPhongMaterial({ color: 0x404040 });
const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });

class Chunk {
    constructor(chunkX, chunkZ) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.key = `${chunkX},${chunkZ}`;

        // Create ground for this chunk
        const groundSize = CHUNK_SIZE * CELL_SIZE;
        this.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(groundSize, groundSize),
            groundMaterial
        );
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(
            (chunkX * CHUNK_SIZE + CHUNK_SIZE/2) * CELL_SIZE,
            0,
            (chunkZ * CHUNK_SIZE + CHUNK_SIZE/2) * CELL_SIZE
        );

        // Create buildings for this chunk
        this.buildings = new THREE.InstancedMesh(
            buildingGeometry,
            buildingMaterial,
            CHUNK_SIZE * CHUNK_SIZE
        );
        
        this.generateBuildings();
        
        scene.add(this.ground);
        scene.add(this.buildings);
    }

    generateBuildings() {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);
        const rotation = new THREE.Quaternion();
        let instanceCount = 0;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = (this.chunkX * CHUNK_SIZE + x) * CELL_SIZE;
                const worldZ = (this.chunkZ * CHUNK_SIZE + z) * CELL_SIZE;
                
                const seed = worldX * 10000 + worldZ;
                const random = Math.abs(Math.sin(seed)) * 0.999999;
                
                if (random < BUILD_CHANCE) {
                    const height = 20 + random * 40;
                    position.set(worldX, height/2, worldZ);
                    scale.setY(height/30);
                    
                    matrix.compose(position, rotation, scale);
                    this.buildings.setMatrixAt(instanceCount, matrix);
                    instanceCount++;
                }
            }
        }
        
        this.buildings.count = instanceCount;
        this.buildings.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        scene.remove(this.ground);
        scene.remove(this.buildings);
        this.ground.geometry.dispose();
        this.ground.material.dispose();
        this.buildings.geometry.dispose();
        this.buildings.material.dispose();
    }
}

// Chunk management
const chunks = new Map();

function updateChunks(playerX, playerZ) {
    const currentChunkX = Math.floor(playerX / (CELL_SIZE * CHUNK_SIZE));
    const currentChunkZ = Math.floor(playerZ / (CELL_SIZE * CHUNK_SIZE));
    
    const newChunks = new Set();
    const renderDistance = 2;
    
    // Create or maintain needed chunks
    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const chunkX = currentChunkX + x;
            const chunkZ = currentChunkZ + z;
            const key = `${chunkX},${chunkZ}`;
            newChunks.add(key);
            
            if (!chunks.has(key)) {
                chunks.set(key, new Chunk(chunkX, chunkZ));
            }
        }
    }
    
    // Remove distant chunks
    for (const [key, chunk] of chunks) {
        if (!newChunks.has(key)) {
            chunk.dispose();
            chunks.delete(key);
        }
    }
}

// 6. Celestial Objects
const sun = new THREE.Mesh(
    new THREE.SphereGeometry(20),
    new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        toneMapped: false 
    })
);
scene.add(sun);

const moon = new THREE.Mesh(
    new THREE.SphereGeometry(15),
    new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        toneMapped: false
    })
);
scene.add(moon);

// Stars with different sizes
const starMaterials = [
    new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 2,
        sizeAttenuation: false
    }),
    new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1.5,
        sizeAttenuation: false
    }),
    new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1,
        sizeAttenuation: false
    })
];

const starGroups = [];
const starSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 850);

for (let i = 0; i < 3; i++) {
    const positions = [];
    const count = i === 0 ? 50 : (i === 1 ? 250 : 700);
    
    for (let j = 0; j < count; j++) {
        const position = new THREE.Vector3();
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        
        position.x = starSphere.radius * Math.sin(phi) * Math.cos(theta);
        position.y = Math.abs(starSphere.radius * Math.sin(phi) * Math.sin(theta));
        position.z = starSphere.radius * Math.cos(phi);
        
        if (position.y > 0) {
            positions.push(position.x, position.y, position.z);
        }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starGroup = new THREE.Points(geometry, starMaterials[i]);
    starGroups.push(starGroup);
    scene.add(starGroup);
}

// Sky colors
const skyColors = {
    day: new THREE.Color(0x87CEEB),
    sunset: new THREE.Color(0xFFA07A),
    night: new THREE.Color(0x000000),
    sunrise: new THREE.Color(0xFFA07A)
};

// Animation Loop
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.001;

    const skyRadius = 400;
    const sunHeight = Math.sin(time);
    const moonHeight = Math.sin(time + Math.PI);
    let skyColor = new THREE.Color();

    // Sun position
    sun.position.x = Math.cos(time) * skyRadius + camera.position.x;
    sun.position.y = Math.max(0, sunHeight * skyRadius);
    sun.position.z = camera.position.z;
    sun.visible = sunHeight > -0.1;

    // Moon position
    moon.position.x = Math.cos(time + Math.PI) * skyRadius + camera.position.x;
    moon.position.y = Math.max(0, moonHeight * skyRadius);
    moon.position.z = camera.position.z;
    moon.visible = moonHeight > -0.1;

    // Sky color based on sun height
    if (sunHeight < -0.1) {
        skyColor.copy(skyColors.night);
    }
    else if (sunHeight < 0.2) {
        const t = (sunHeight + 0.1) / 0.3;
        skyColor.lerpColors(skyColors.night, skyColors.sunrise, t);
    }
    else if (sunHeight < 0.3) {
        const t = (sunHeight - 0.2) / 0.1;
        skyColor.lerpColors(skyColors.sunrise, skyColors.day, t);
    }
    else if (sunHeight > 0.3) {
        skyColor.copy(skyColors.day);
    }
    else if (sunHeight > 0) {
        const t = sunHeight / 0.3;
        skyColor.lerpColors(skyColors.sunset, skyColors.day, t);
    }
    else {
        const t = (sunHeight + 0.1) / 0.1;
        skyColor.lerpColors(skyColors.night, skyColors.sunset, t);
    }

    scene.background = skyColor;

    // Update lights
    sunLight.position.copy(sun.position);
    sunLight.intensity = Math.max(0, sunHeight);
    moonLight.position.copy(moon.position);
    moonLight.intensity = Math.max(0, moonHeight) * 0.5;

    // Update stars
    starGroups.forEach(group => {
        group.visible = sunHeight < 0;
    });

    // Update chunks based on player position
    updateChunks(camera.position.x, camera.position.z);

    // Player movement
    if (document.pointerLockElement === renderer.domElement) {
        const forward = new THREE.Vector3();
        forward.setFromMatrixColumn(camera.matrix, 0);
        forward.crossVectors(camera.up, forward);

        const right = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);

        if (keys.w) camera.position.addScaledVector(forward, player.speed);
        if (keys.s) camera.position.addScaledVector(forward, -player.speed);
        if (keys.a) camera.position.addScaledVector(right, -player.speed);
        if (keys.d) camera.position.addScaledVector(right, player.speed);
    }

    renderer.render(scene, camera);
}

animate();
/*
Key features of the new system:
Truly infinite terrain using chunks
Each chunk contains:
Ground plane section
Building instances
Chunks load/unload based on player position
Efficient memory usage
Consistent building generation
You can adjust:
CHUNK_SIZE (currently 16)
CELL_SIZE (currently 50)
renderDistance (currently 2)
BUILD_CHANCE (currently 0.3)
Building sizes and colors*/