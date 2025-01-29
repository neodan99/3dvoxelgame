import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x33aa33 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Sky objects with emissive materials
const skyRadius = 400;

// Sun - using MeshBasicMaterial for guaranteed brightness
const sunGeometry = new THREE.SphereGeometry(20);
const sunMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffff00,
    fog: false,
    toneMapped: false
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);

// Add glow effect to sun
const sunGlow = new THREE.PointLight(0xffff00, 2, 1000);
sun.add(sunGlow);
scene.add(sun);

// Moon - using MeshBasicMaterial for guaranteed brightness
const moonGeometry = new THREE.SphereGeometry(15);
const moonMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    fog: false,
    toneMapped: false
});
const moon = new THREE.Mesh(moonGeometry, moonMaterial);

// Add subtle blue glow to moon
const moonGlow = new THREE.PointLight(0x4444ff, 1, 500);
moon.add(moonGlow);
scene.add(moon);

// Stars - bright white points
const starsGeometry = new THREE.BufferGeometry();
const starsVertices = [];
const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.8,
    toneMapped: false,
    fog: false
});

// Generate more visible stars
for (let i = 0; i < 3000; i++) {
    const radius = 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.65;
    
    starsVertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        Math.abs(radius * Math.cos(phi)),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Player setup
const player = {
    height: 2,
    speed: 0.1,
    turnSpeed: 0.002,
    rotation: new THREE.Euler(0, 0, 0, 'YXZ')  // Important: use YXZ order
};

camera.position.y = player.height;
camera.rotation.order = 'YXZ';  // Match player rotation order

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Event listeners
document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        player.rotation.y -= e.movementX * player.turnSpeed;
        player.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, 
            player.rotation.x - e.movementY * player.turnSpeed));
        
        // Update camera to match player rotation
        camera.rotation.copy(player.rotation);
    }
});

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

// City generation with instanced meshes
const CITY_SIZE = 100;
const BUILDING_SPACING = 15; // Increased spacing for walking
const BUILDING_TYPES = 5;

// Create building geometries
const buildingGeometry = new THREE.BoxGeometry(8, 1, 8); // Base geometry
const buildingMaterial = new THREE.MeshPhongMaterial({
    color: 0x808080,
    emissive: 0x000000,
    emissiveIntensity: 0
});

// Create instanced mesh for buildings
const INSTANCES = 1000; // Maximum number of visible buildings
const buildingInstanced = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    INSTANCES
);
scene.add(buildingInstanced);

// Create matrices for instance positions
const matrix = new THREE.Matrix4();
const color = new THREE.Color();
const buildings = new Set();

function generateBuilding(x, z) {
    const key = `${x},${z}`;
    if (buildings.has(key)) return;

    // Deterministic random based on position
    const rand = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    
    const height = 10 + rand * 30; // Building height
    matrix.makeScale(1, height, 1);
    matrix.setPosition(
        x * BUILDING_SPACING,
        height / 2,
        z * BUILDING_SPACING
    );

    // Add building instance
    const index = buildings.size;
    if (index < INSTANCES) {
        buildingInstanced.setMatrixAt(index, matrix);
        color.setHSL(rand * 0.1 + 0.05, 0.5, 0.5);
        buildingInstanced.setColorAt(index, color);
        buildings.add(key);
    }

    buildingInstanced.instanceMatrix.needsUpdate = true;
    if (buildingInstanced.instanceColor) buildingInstanced.instanceColor.needsUpdate = true;
}

// Ground plane
const groundSize = 1000;
ground.geometry = new THREE.PlaneGeometry(groundSize, groundSize);
ground.material = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
});

// Simplified street lights using instanced mesh
const lightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4);
const lightMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });
const LIGHT_INSTANCES = 200;
const streetLights = new THREE.InstancedMesh(
    lightGeometry,
    lightMaterial,
    LIGHT_INSTANCES
);
scene.add(streetLights);

// Add point lights strategically instead of per street light
const lights = [];
for (let i = 0; i < 10; i++) {
    const light = new THREE.PointLight(0xffffaa, 0.5, 30);
    lights.push(light);
    scene.add(light);
}

// Animation loop
let time = 0;
function animate() {
    requestAnimationFrame(animate);

    time += 0.001;
    
    // Adjust time calculation for day/night cycle
    const daylight = (Math.cos(time) + 1) * 0.5; // Value between 0 and 1
    
    // Calculate sun and moon angles
    const sunAngle = time % (Math.PI * 2);
    const moonAngle = (time + Math.PI) % (Math.PI * 2);
    
    // Only show sun during day (when it's above horizon)
    if (Math.sin(sunAngle) > -0.1) {
        sun.visible = true;
        sun.position.x = Math.cos(sunAngle) * skyRadius + camera.position.x;
        sun.position.y = Math.max(0, Math.sin(sunAngle) * skyRadius);
        sun.position.z = camera.position.z;
        sunGlow.intensity = Math.max(0, Math.sin(sunAngle)) * 2;
    } else {
        sun.visible = false;
    }
    
    // Only show moon during night (when it's above horizon)
    if (Math.sin(moonAngle) > -0.1) {
        moon.visible = true;
        moon.position.x = Math.cos(moonAngle) * skyRadius + camera.position.x;
        moon.position.y = Math.max(0, Math.sin(moonAngle) * skyRadius);
        moon.position.z = camera.position.z;
        moonGlow.intensity = Math.max(0, Math.sin(moonAngle)) * 0.5;
    } else {
        moon.visible = false;
    }
    
    // Update sky color - much darker at night
    const skyR = Math.max(0.0, daylight * 0.5);
    const skyG = Math.max(0.0, daylight * 0.5);
    const skyB = Math.max(0.0, daylight * 0.7);
    scene.background = new THREE.Color(skyR, skyG, skyB);
    
    // Update ambient light for day/night cycle
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    // Update stars
    stars.visible = true; // Always visible
    // Make stars more visible at night
    starsMaterial.opacity = Math.max(0.8, 1 - daylight * 2);
    stars.position.x = camera.position.x;
    stars.position.z = camera.position.z;
    
    // Update building lights - brighter at night
    buildingMaterial.emissiveIntensity = Math.max(0.2, 1 - daylight * 2);

    // Get player grid position
    const playerX = Math.floor(camera.position.x / BUILDING_SPACING);
    const playerZ = Math.floor(camera.position.z / BUILDING_SPACING);

    // Generate buildings in view distance
    const viewDistance = 8;
    buildings.clear();
    for (let x = playerX - viewDistance; x <= playerX + viewDistance; x++) {
        for (let z = playerZ - viewDistance; z <= playerZ + viewDistance; z++) {
            if ((x + z) % 2 === 0) { // Checker pattern for buildings
                generateBuilding(x, z);
            }
        }
    }

    // Update lights position around player
    lights.forEach((light, i) => {
        const angle = (i / lights.length) * Math.PI * 2 + time;
        light.position.set(
            camera.position.x + Math.cos(angle) * 20,
            10,
            camera.position.z + Math.sin(angle) * 20
        );
    });

    // Update movement
    if (document.pointerLockElement === renderer.domElement) {
        const forward = new THREE.Vector3();
        forward.setFromMatrixColumn(camera.matrix, 0);
        forward.crossVectors(camera.up, forward);

        const right = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);

        const moveSpeed = player.speed;
        if (keys.w) camera.position.addScaledVector(forward, moveSpeed);
        if (keys.s) camera.position.addScaledVector(forward, -moveSpeed);
        if (keys.a) camera.position.addScaledVector(right, -moveSpeed);
        if (keys.d) camera.position.addScaledVector(right, moveSpeed);
    }

    renderer.render(scene, camera);
}

// Update lighting
scene.fog = new THREE.Fog(new THREE.Color(0.5, 0.5, 0.7), 1, 1000);
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Optimize renderer
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Update renderer to support bright colors
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;

animate();