import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let worldModel = new THREE.Group();
let isLoaded = false;

// --- 时间循环控制变量 ---
let gameTime = 9.0; 
let timeDirection = 1; 
const TIME_SPEED = 10 / 60 / 60; // 每秒10分钟

let isInteracting = false; 
let interactionTimer;      
let sunLight, ambientLight, sunSphere;

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    
    // 空气雾效果
    const fogColor = 0xdde5ed; 
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.002);

    // 光照系统
    ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfff5ea, 2.8); 
    sunLight.castShadow = true;

    // --- 核心修复：提升阴影质量与范围 ---
    sunLight.shadow.mapSize.set(4096, 4096); // 提升分辨率
    sunLight.shadow.bias = -0.0002;          // 解决条纹阴影

    const d = 800; // 确保阴影相机范围足够大
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 4000;
    
    scene.add(sunLight);
    scene.add(sunLight.target); // 必须在场景中

    sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(20, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(sunSphere);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // OrbitControls 配置
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.screenSpacePanning = true; 
    controls.autoRotate = true;
    controls.autoRotateSpeed = -0.5; 

    camera.position.set(200, 200, 200);

    controls.addEventListener('start', () => {
        isInteracting = true;
        controls.autoRotate = false;
        clearTimeout(interactionTimer);
    });

    controls.addEventListener('end', () => {
        isInteracting = false;
        interactionTimer = setTimeout(() => {
            if (!isInteracting) controls.autoRotate = true;
        }, 3000); 
    });

    // 加载模型
    const loader = new GLTFLoader();
    loader.load('ZHANGZIZHONG.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(n => {
            if (n.isMesh) {
                n.castShadow = true; 
                n.receiveShadow = true;
                // 解决模型背面的阴影计算问题
                if(n.material) n.material.shadowSide = THREE.FrontSide;
            }
        });
        worldModel.add(model);
        scene.add(worldModel);
        
        const box = new THREE.Box3().setFromObject(model);
        controls.target.copy(box.getCenter(new THREE.Vector3()));
        controls.update();
        isLoaded = true;
    });

    const slider = document.getElementById('time-slider');
    if(slider) {
        slider.addEventListener('input', (e) => {
            gameTime = parseFloat(e.target.value);
            updateUIDisplay();
        });
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function updateUIDisplay() {
    const hours = Math.floor(gameTime).toString().padStart(2, '0');
    const minutes = Math.floor((gameTime % 1) * 60).toString().padStart(2, '0');
    const display = document.getElementById('time-display');
    const slider = document.getElementById('time-slider');
    if(display) display.innerText = `${hours}:${minutes}`;
    if(slider) slider.value = gameTime;
}

function updateEnvironment() {
    if (!controls) return;
    const lookAtPos = controls.target;

    // 太阳角度计算
    const angle = ((gameTime - 6) / 12) * Math.PI;
    const sunY = Math.sin(angle);
    const sunZ = Math.cos(angle);
    
    const sunDist = 1800; // 太阳拉远一点，阴影平行度更好
    sunLight.position.set(
        lookAtPos.x + 600, // 侧方偏移
        lookAtPos.y + sunY * sunDist,
        lookAtPos.z + sunZ * sunDist
    );

    // --- 修复阴影：强制更新灯光目标 ---
    sunLight.target.position.copy(lookAtPos);
    sunLight.target.updateMatrixWorld(); 
    
    sunSphere.position.copy(sunLight.position);

    // 亮度随高度变化
    if (gameTime > 6 && gameTime < 18) {
        sunLight.intensity = sunY * 3.5; 
        ambientLight.intensity = 0.35 + sunY * 0.15;
    } else {
        sunLight.intensity = 0;
        ambientLight.intensity = 0.1;
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (!isLoaded) return;

    controls.update();

    if (controls.autoRotate) {
        gameTime += TIME_SPEED * timeDirection;
        if (gameTime >= 18.0) { gameTime = 18.0; timeDirection = -1; }
        else if (gameTime <= 6.0) { gameTime = 6.0; timeDirection = 1; }
        updateUIDisplay();
    }

    updateEnvironment();
    renderer.render(scene, camera);
}
