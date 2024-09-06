// Global Variables
let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let selectedObject = null;
let selectedWall = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let loadedTextures = {};
let gltfLoader = new THREE.GLTFLoader();
let objLoader = new THREE.OBJLoader();
let fbxLoader = new THREE.FBXLoader();
let sinkModel = null;
let mirrorModel = null;
let bidetModel = null;
let actionHistory = [];
let redoStack = [];
let selectedTexture = null;
let textureRotationAngle = 0;
let clickCount = 0;
let clickTimer;
let lastTapTime = 0;

// Models to Load
const modelsToLoad = [
    { path: '/images/LAVABO.glb', type: 'sink', loader: gltfLoader },
    { path: '/images/bidet.glb', type: 'bidet', loader: gltfLoader },
    { path: '/images/mdlwclock02.obj', type: 'mirror', loader: objLoader },
];

// Initialize Scene and Add Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    init();
    addEventListeners();
    loadMultipleModels();
});

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });

    createWalls();
    createFloor();

    camera.position.set(0, 2, 6);
    camera.lookAt(0, 1.5, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    renderer.domElement.addEventListener('click', handleInteraction, false);
    renderer.domElement.addEventListener('touchstart', handleInteraction, false);
    renderer.domElement.addEventListener('dblclick', onDoubleClick, false);
    window.addEventListener('resize', onWindowResize, false);

    initializeTextureEvents();
    animate();
}

function addEventListeners() {
    const translateButton = document.getElementById('modeTranslate');
    const rotateButton = document.getElementById('modeRotate');
    const lightSlider = document.getElementById('lightIntensity');
    const searchTileInput = document.getElementById('searchTile');
    const sinkModelInput = document.getElementById('sinkModelInput');
    const addSinkButton = document.getElementById('addSink');
    const addMirrorButton = document.getElementById('addMirror');
    const addBidetButton = document.getElementById('addBidet');
    const removeObjectButton = document.getElementById('removeObject');
    const saveSceneButton = document.getElementById('saveScene');
    const loadSceneButton = document.getElementById('loadSceneButton');
    const loadSceneInput = document.getElementById('loadSceneInput');
    const tileTextureInput = document.getElementById('tileTextureInput');

    if (translateButton) translateButton.addEventListener('click', () => setTransformMode('translate'), false);
    if (rotateButton) rotateButton.addEventListener('click', () => setTransformMode('rotate'), false);
    if (lightSlider) lightSlider.addEventListener('input', function (event) {
        const intensity = parseFloat(event.target.value);
        const ambientLight = scene.getObjectByProperty('type', 'AmbientLight');
        if (ambientLight) {
            ambientLight.intensity = intensity;
        }
    });
    if (searchTileInput) searchTileInput.addEventListener('input', filterTiles);
    if (sinkModelInput) sinkModelInput.addEventListener('change', event => handleModelFile(event), false);
    if (addSinkButton) addSinkButton.addEventListener('click', () => {
        if (sinkModel) {
            addObject(sinkModel.clone(), 'sink');
        } else {
            alert('Veuillez d\'abord charger un modèle de lavabo.');
        }
    });
    if (addMirrorButton) addMirrorButton.addEventListener('click', () => {
        if (mirrorModel) {
            addObject(mirrorModel.clone(), 'mirror');
        } else {
            alert('Veuillez d\'abord charger un modèle de miroir.');
        }
    });
    if (addBidetButton) addBidetButton.addEventListener('click', () => {
        if (bidetModel) {
            addObject(bidetModel.clone(), 'bidet');
        } else {
            alert('Veuillez d\'abord charger un modèle de bidet.');
        }
    });
    if (removeObjectButton) removeObjectButton.addEventListener('click', removeObject);
    if (saveSceneButton) saveSceneButton.addEventListener('click', saveScene);
    if (loadSceneButton) {
        loadSceneButton.addEventListener('click', () => {
            loadSceneInput.click();
        });
    }
    loadSceneInput.addEventListener('change', function (event) {
        if (event.target.files.length > 0) {
            loadScene(event.target.files[0]);
        }
    });
    if (tileTextureInput) tileTextureInput.addEventListener('change', handleTileTextureInput);
}

function loadMultipleModels() {
    modelsToLoad.forEach(model => {
        loadModel(model.path, model.type, model.loader);
    });
}

function loadModel(path, type, loader) {
    loader.load(path, function (model) {
        let sceneObject;
        if (type === 'sink' || type === 'bidet') {
            sceneObject = model.scene;
        } else {
            sceneObject = model;
        }

        if (type === 'bidet') {
            sceneObject.scale.set(0.001, 0.001, 0.001);
        } else if (type === 'mirror') {
            sceneObject.scale.set(0.01, 0.01, 0.01);
        } else {
            sceneObject.scale.set(0.1, 0.1, 0.1);
        }

        sceneObject.position.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 2.4);
        sceneObject.userData.type = type;
        sceneObject.userData.isMovable = true;

        scene.add(sceneObject);
        objects.push(sceneObject);

        if (type === 'sink') {
            sinkModel = sceneObject;
        } else if (type === 'mirror') {
            mirrorModel = sceneObject;
        } else if (type === 'bidet') {
            bidetModel = sceneObject;
        }

        console.log(`Modèle ${type} chargé depuis ${path}.`);
    }, undefined, function (error) {
        console.error(`Erreur de chargement du modèle ${type} depuis ${path} :`, error);
    });
}

function initializeTextureEvents() {
    document.querySelectorAll('.texture-option').forEach((img) => {
        img.addEventListener('click', () => {
            const textureLoader = new THREE.TextureLoader();
            selectedTexture = textureLoader.load(img.src, () => {
                applySelectedTexture();
            });
        });
    });
}

function filterTiles() {
    const searchInput = document.getElementById('searchTile').value.toLowerCase();
    const textureOptions = document.querySelectorAll('.texture-option');

    textureOptions.forEach((texture) => {
        const altText = texture.alt.toLowerCase();
        if (altText.includes(searchInput)) {
            texture.style.display = 'block';
        } else {
            texture.style.display = 'none';
        }
    });
}

function createWalls() {
    const wallWidth = 5;
    const wallHeight = 3;
    const wallThickness = 0.2;

    const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
    const wallColor = 0xf4f4f9;

    for (let i = 0; i < 2; i++) {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);

        if (i === 0) {
            walls[i].position.set(0, wallHeight / 2, -wallWidth / 2 - wallThickness / 2);
        } else {
            walls[i].position.set(-wallWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
            walls[i].rotation.y = Math.PI / 2;
        }

        scene.add(walls[i]);
        objects.push(walls[i]);
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    objects.push(floor);
}

function applySelectedTexture() {
    if (selectedWall && selectedTexture) {
        const textureAspectRatio = selectedTexture.image.width / selectedTexture.image.height;
        let objectAspectRatio = selectedWall.geometry.parameters.width / selectedWall.geometry.parameters.height;

        let repeatX = 1, repeatY = 1;
        if (textureAspectRatio > objectAspectRatio) {
            repeatX = 3;
            repeatY = 3 * (objectAspectRatio / textureAspectRatio);
        } else {
            repeatY = 3;
            repeatX = 3 * (textureAspectRatio / objectAspectRatio);
        }

        selectedTexture.wrapS = THREE.RepeatWrapping;
        selectedTexture.wrapT = THREE.RepeatWrapping;
        selectedTexture.repeat.set(repeatX, repeatY);
        selectedTexture.center.set(0.5, 0.5);
        selectedWall.material.map = selectedTexture;
        selectedWall.material.color.set(0xffffff);
        selectedWall.material.needsUpdate = true;
    } else {
        console.error('Veuillez sélectionner un mur ou le sol, puis une texture.');
    }
}

function handleTripleClick() {
    clickCount++;
    if (clickCount === 3) {
        adjustTextureRotation();
        clickCount = 0;
    }

    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        clickCount = 0;
    }, 500);
}

function adjustTextureRotation() {
    if (selectedWall && selectedWall.material.map) {
        textureRotationAngle += Math.PI / 2;
        if (textureRotationAngle >= 2 * Math.PI) {
            textureRotationAngle = 0;
        }
        selectedWall.material.map.rotation = textureRotationAngle;
        selectedWall.material.needsUpdate = true;
    } else {
        console.error('Veuillez sélectionner un mur ou le sol, puis une texture.');
    }
}

function selectWall(wall) {
    selectedWall = wall;
}

function handleInteraction(event) {
    event.preventDefault();

    let clientX, clientY;

    if (event.type === 'touchstart' && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;

        const currentTime = new Date().getTime();
        const tapGap = currentTime - lastTapTime;
        if (tapGap < 300 && tapGap > 0) {
            onDoubleClick(event);
        }
        lastTapTime = currentTime;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...walls, floor], true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (walls.includes(clickedObject) || clickedObject === floor) {
            selectWall(clickedObject);
            handleTripleClick();
        }
    }
}

function onDoubleClick(event) {
    let clientX = event.clientX || event.touches[0].clientX;
    let clientY = event.clientY || event.touches[0].clientY;

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let parentObject = clickedObject;

        while (parentObject && !parentObject.userData.isMovable) {
            parentObject = parentObject.parent;
        }

        if (parentObject && parentObject.userData.isMovable) {
            selectObject(parentObject);
        }
    } else {
        selectObject(null);
    }
}

function selectObject(object) {
    if (selectedObject) {
        transformControls.detach(selectedObject);
    }
    selectedObject = object;
    if (object && object.userData.isMovable) {
        transformControls.attach(object);
        transformControls.setMode('translate');
    }
}

function removeObject() {
    if (selectedObject && selectedObject.userData.isMovable) {
        saveAction('remove', selectedObject);
        scene.remove(selectedObject);
        objects = objects.filter(obj => obj !== selectedObject);
        transformControls.detach();
        selectedObject = null;
    }
}

function handleModelFile(event) {
    const file = event.target.files[0];
    const type = event.target.dataset.type;
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const extension = file.name.split('.').pop().toLowerCase();

            if (extension === 'gltf' || extension === 'glb') {
                gltfLoader.parse(arrayBuffer, '', function (gltf) {
                    handleModelLoad(gltf.scene, type);
                });
            } else if (extension === 'obj') {
                const text = new TextDecoder().decode(arrayBuffer);
                const objModel = objLoader.parse(text);
                handleModelLoad(objModel, type);
            } else if (extension === 'fbx') {
                fbxLoader.parse(arrayBuffer, function (fbx) {
                    handleModelLoad(fbx, type);
                });
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function handleModelLoad(model, type) {
    model.rotation.set(0, 0, 0);

    if (type === 'bidet') {
        model.scale.set(0.05, 0.05, 0.05);
    } else if (type === 'mirror') {
        model.scale.set(0.03, 0.03, 0.03);
    } else {
        model.scale.set(0.1, 0.1, 0.1);
    }

    centerModel(model);

    if (type === 'sink') {
        sinkModel = model;
    } else if (type === 'mirror') {
        mirrorModel = model;
    } else if (type === 'bidet') {
        bidetModel = model;
    }
}

function centerModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.25 / maxDim;
    model.scale.multiplyScalar(scale);

    model.position.sub(center.multiplyScalar(scale));
    model.position.y = size.y * scale / 2;
    model.position.z = -2.4;
}

function addObject(model, type) {
    model.userData.type = type;
    model.userData.isMovable = true;
    scene.add(model);
    objects.push(model);
    selectObject(model);
    saveAction('add', model);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function saveAction(action, object) {
    actionHistory.push({ action, object });
    redoStack = [];
}

function setTransformMode(mode) {
    if (['translate', 'rotate'].includes(mode)) {
        transformControls.setMode(mode);
    } else {
        console.error('Mode de transformation non reconnu :', mode);
    }
}

function saveScene() {
    try {
        const sceneData = {
            walls: walls.map(wall => ({
                position: wall.position.toArray(),
                rotation: wall.rotation.toArray(),
                texture: wall.material.map ? {
                    src: wall.material.map.image.src,
                    repeat: wall.material.map.repeat.toArray(),
                    wrapS: wall.material.map.wrapS,
                    wrapT: wall.material.map.wrapT
                } : null
            })),
            floor: {
                position: floor.position.toArray(),
                rotation: floor.rotation.toArray(),
                texture: floor.material.map ? {
                    src: floor.material.map.image.src,
                    repeat: floor.material.map.repeat.toArray(),
                    wrapS: floor.material.map.wrapS,
                    wrapT: floor.material.map.wrapT
                } : null
            },
            objects: objects.filter(obj => obj.userData.isMovable).map(obj => ({
                type: obj.userData.type,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray()
            }))
        };

        const sceneJSON = JSON.stringify(sceneData, null, 2);
        const blob = new Blob([sceneJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('Scène sauvegardée en tant que fichier JSON!');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la scène :', error);
        alert('Erreur lors de la sauvegarde de la scène. Veuillez vérifier les paramètres et réessayer.');
    }
}

function loadScene(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const sceneData = JSON.parse(e.target.result);

            objects.forEach(obj => {
                if (obj.userData.isMovable) {
                    scene.remove(obj);
                }
            });
            objects = objects.filter(obj => !obj.userData.isMovable);

            sceneData.walls.forEach((wallData, index) => {
                walls[index].position.fromArray(wallData.position);
                walls[index].rotation.fromArray(wallData.rotation);
                if (wallData.texture) {
                    applyTextureToObject(walls[index], wallData.texture);
                }
            });

            floor.position.fromArray(sceneData.floor.position);
            floor.rotation.fromArray(sceneData.floor.rotation);
            if (sceneData.floor.texture) {
                applyTextureToObject(floor, sceneData.floor.texture);
            }

            sceneData.objects.forEach(objData => {
                let model;
                switch (objData.type) {
                    case 'sink':
                        model = sinkModel;
                        break;
                    case 'mirror':
                        model = mirrorModel;
                        break;
                    case 'bidet':
                        model = bidetModel;
                        break;
                }
                if (model) {
                    const newObj = model.clone();
                    newObj.position.fromArray(objData.position);
                    newObj.rotation.fromArray(objData.rotation);
                    newObj.scale.fromArray(objData.scale);
                    newObj.userData.type = objData.type;
                    newObj.userData.isMovable = true;
                    scene.add(newObj);
                    objects.push(newObj);
                }
            });

            alert('Scène chargée avec succès!');
        } catch (error) {
            console.error("Erreur lors du chargement de la scène :", error);
            alert("Erreur lors du chargement de la scène. Veuillez vérifier le fichier.");
        }
    };
    reader.readAsText(file);
}

function applyTextureToObject(object, textureData) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(textureData.src, (texture) => {
        texture.wrapS = textureData.wrapS || THREE.RepeatWrapping;
        texture.wrapT = textureData.wrapT || THREE.RepeatWrapping;
        texture.repeat.fromArray(textureData.repeat || [1, 1]);
        object.material.map = texture;
        object.material.needsUpdate = true;
    });
}

function handleTileTextureInput(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(e.target.result, () => {
                selectedTexture = texture;
                applySelectedTexture();
            });
        };
        reader.readAsDataURL(file);
    }
}
