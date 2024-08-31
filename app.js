// Global variables
let scene, camera, renderer, controls;
let walls = [], floor;
let objects = [];
let directionalLight, ambientLight;
let undoStack = [], redoStack = [];

document.addEventListener('DOMContentLoaded', function () {
    init();
    setupEventListeners();
});

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    createWalls();
    createFloor();

    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', onMouseClick, false);

    animate();
}

function setupEventListeners() {
    const applyTextureBtn = document.getElementById('applyTexture');
    const textureOptions = document.getElementById('textureOptions');
    const choosePaintBtn = document.getElementById('choosePaint');
    const chooseTileBtn = document.getElementById('chooseTile');
    const tileInput = document.getElementById('tileInput');
    const colorPicker = document.getElementById('colorPicker');
    const lightSlider = document.getElementById('lightSlider');
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    applyTextureBtn.addEventListener('click', () => {
        textureOptions.style.display = 'flex';
    });

    choosePaintBtn.addEventListener('click', () => {
        tileInput.style.display = 'none';
        colorPicker.style.display = 'inline-block';
        textureOptions.style.display = 'none';
    });

    chooseTileBtn.addEventListener('click', () => {
        colorPicker.style.display = 'none';
        tileInput.style.display = 'inline-block';
        textureOptions.style.display = 'none';
    });

    colorPicker.addEventListener('input', () => {
        applyPaintToAllWalls(colorPicker.value);
    });

    tileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function() {
                    applyTileToFloor(img);
                }
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    lightSlider.addEventListener('input', (event) => {
        const intensity = parseFloat(event.target.value);
        updateLightIntensity(intensity);
    });

    undoBtn.addEventListener('click', () => undoAction());
    redoBtn.addEventListener('click', () => redoAction());
}

function createWalls() {
    const wallGeometry = new THREE.PlaneGeometry(5, 3);

    for (let i = 0; i < 3; i++) {
        let wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);

        walls[i].position.set(i === 0 ? 0 : i === 1 ? -2.5 : 2.5, 1.5, i === 0 ? -2.5 : 0);
        walls[i].rotation.y = i === 1 ? Math.PI / 2 : i === 2 ? -Math.PI / 2 : 0;
        walls[i].userData.type = `wall${i + 1}`;

        scene.add(walls[i]);
        objects.push(walls[i]);
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
        bumpScale: 0.05,
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.type = 'floor';
    scene.add(floor);
    objects.push(floor);
}

function applyTileToFloor(tileImage) {
    const floorWidth = floor.geometry.parameters.width;
    const floorHeight = floor.geometry.parameters.height;

    const tilesX = 5; // Number of tiles in X direction
    const tilesY = 5; // Number of tiles in Y direction

    const tileWidth = tileImage.width;
    const tileHeight = tileImage.height;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = tileWidth * tilesX;
    canvas.height = tileHeight * tilesY;

    // Function to draw a single tile with grout
    function drawTile(x, y) {
        ctx.drawImage(tileImage, x * tileWidth, y * tileHeight);
        
        // Draw grout
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x * tileWidth, y * tileHeight);
        ctx.lineTo((x + 1) * tileWidth, y * tileHeight);
        ctx.moveTo(x * tileWidth, y * tileHeight);
        ctx.lineTo(x * tileWidth, (y + 1) * tileHeight);
        ctx.stroke();
    }

    // Draw tiles
    for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
            drawTile(x, y);
        }
    }

    // Draw right and bottom edges of the last row and column
    ctx.beginPath();
    ctx.moveTo(canvas.width, 0);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Calculate the aspect ratio of the floor and the tiled texture
    const floorAspect = floorWidth / floorHeight;
    const textureAspect = canvas.width / canvas.height;

    // Adjust repeat to maintain the aspect ratio
    if (floorAspect > textureAspect) {
        texture.repeat.set(1, textureAspect / floorAspect);
        texture.offset.set(0, (1 - texture.repeat.y) / 2);
    } else {
        texture.repeat.set(floorAspect / textureAspect, 1);
        texture.offset.set((1 - texture.repeat.x) / 2, 0);
    }

    floor.material.map = texture;
    floor.material.needsUpdate = true;

    saveState();
}

function applyPaintToAllWalls(color) {
    walls.forEach(wall => {
        wall.material.color.set(color);
        wall.material.needsUpdate = true;
    });
    saveState();
}

function updateLightIntensity(value) {
    directionalLight.intensity = value;
    ambientLight.intensity = value * 0.5; // Adjust ambient light intensity proportionally
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseClick(event) {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        if (clickedObject === floor && clickedObject.material.map) {
            const currentRotation = clickedObject.material.map.rotation;
            clickedObject.material.map.rotation = (currentRotation + Math.PI / 2) % (Math.PI * 2);
            clickedObject.material.needsUpdate = true;
            saveState();
        }

        if (walls.includes(clickedObject)) {
            const originalColor = clickedObject.material.color.getHex();
            const newColor = new THREE.Color(originalColor).offsetHSL(0.05, 0, 0);
            clickedObject.material.color.set(newColor);
            clickedObject.material.needsUpdate = true;
            saveState();
        }
    }
}

function saveState() {
    undoStack.push(scene.toJSON());
    redoStack.length = 0;
}

function undoAction() {
    if (undoStack.length > 0) {
        redoStack.push(scene.toJSON());
        const previousState = undoStack.pop();
        scene = new THREE.ObjectLoader().parse(previousState);
    }
}

function redoAction() {
    if (redoStack.length > 0) {
        undoStack.push(scene.toJSON());
        const nextState = redoStack.pop();
        scene = new THREE.ObjectLoader().parse(nextState);
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}