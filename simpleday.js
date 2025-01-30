import * as THREE from 'three';

// Basic Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Player Settings
const player = {
    height: 2,
    speed: 0.1,
    turnSpeed: 0.002,
    rotation: new THREE.Euler(0, 0, 0, 'YXZ')
};

camera.position.y = player.height;
camera.rotation.order = 'YXZ';

// Movement Controls
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

// Ground
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshPhongMaterial({ color: 0x1a1a1a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Lighting
const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
const moonLight = new THREE.DirectionalLight(0x666666, 0.5);
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(sunLight);
scene.add(moonLight);
scene.add(ambientLight);

// Sun (yellow sphere)
const sun = new THREE.Mesh(
    new THREE.SphereGeometry(20),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
scene.add(sun);

// Moon (white sphere)
const moon = new THREE.Mesh(
    new THREE.SphereGeometry(15),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
scene.add(moon);

// Stars
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];

for (let i = 0; i < 1000; i++) {
    const x = Math.random() * 2000 - 1000;
    const y = Math.random() * 1000;
    const z = Math.random() * 2000 - 1000;
    starVertices.push(x, y, z);
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Sky colors (just day and night)
const skyColors = {
    day: new THREE.Color(0x87CEEB),    // Light blue
    night: new THREE.Color(0x000000)    // Black
};

let skyColor = new THREE.Color();

// Animation Loop
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.001;

    const skyRadius = 400;
    const sunHeight = Math.sin(time);
    const moonHeight = Math.sin(time + Math.PI);

    // Update sun position
    sun.position.x = Math.cos(time) * skyRadius + camera.position.x;
    sun.position.y = Math.max(0, sunHeight * skyRadius);
    sun.position.z = camera.position.z;
    sun.visible = sunHeight > -0.1;

    // Update moon position
    moon.position.x = Math.cos(time + Math.PI) * skyRadius + camera.position.x;
    moon.position.y = Math.max(0, moonHeight * skyRadius);
    moon.position.z = camera.position.z;
    moon.visible = moonHeight > -0.1;

    // Update sky color based on sun height
    if (sunHeight > 0) {  // Sun is above horizon
        skyColor.copy(skyColors.day);
    } else {              // Sun is below horizon
        skyColor.copy(skyColors.night);
    }

    // Update scene background
    scene.background = skyColor;

    // Update lights
    sunLight.position.copy(sun.position);
    sunLight.intensity = Math.max(0, sunHeight);
    moonLight.position.copy(moon.position);
    moonLight.intensity = Math.max(0, -sunHeight);

    // Update stars
    stars.visible = sunHeight < 0;
    stars.position.copy(camera.position);

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

    // Move ground with camera
    ground.position.x = camera.position.x;
    ground.position.z = camera.position.z;

    renderer.render(scene, camera);
}

animate();