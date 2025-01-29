import * as THREE from 'three';
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

// Sky objects
const skyRadius = 50;
const sunGeometry = new THREE.SphereGeometry(2);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

const moonGeometry = new THREE.SphereGeometry(1);
const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
const moon = new THREE.Mesh(moonGeometry, moonMaterial);
scene.add(moon);

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

// Animation loop
let time = 0;
function animate() {
    requestAnimationFrame(animate);

    // Day/night cycle
    time += 0.001;
    const daylight = Math.cos(time) * 0.5 + 0.5;
    scene.background = new THREE.Color(daylight * 0.5, daylight * 0.5, daylight);

    // Sun and moon movement
    sun.position.x = Math.cos(time) * skyRadius;
    sun.position.y = Math.sin(time) * skyRadius;
    moon.position.x = Math.cos(time + Math.PI) * skyRadius;
    moon.position.y = Math.sin(time + Math.PI) * skyRadius;

    // Updated movement code
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

animate();