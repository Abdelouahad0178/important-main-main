// Variables globales
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

// Liste des modèles à charger avec leurs types et chargeurs respectifs
const modelsToLoad = [
    { path: '/images/LAVABO.glb', type: 'sink', loader: gltfLoader },
    { path: '/images/bidet.glb', type: 'bidet', loader: gltfLoader },
    { path: '/images/mdlwclock02.obj', type: 'mirror', loader: objLoader },
];

document.addEventListener('DOMContentLoaded', function () {
    init();
    addEventListeners();
    loadMultipleModels(); // Charge tous les modèles de la liste
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

// Charge plusieurs modèles à partir de la liste
function loadMultipleModels() {
    modelsToLoad.forEach(model => {
        loadModel(model.path, model.type, model.loader);
    });
}

// Fonction générique pour charger un modèle avec le bon chargeur
function loadModel(path, type, loader) {
    loader.load(path, function (model) {
        let sceneObject;
        if (type === 'sink' || type === 'bidet') {
            sceneObject = model.scene; // Pour GLTFLoader
        } else {
            sceneObject = model; // Pour OBJLoader
        }

        // Ajuster l'échelle en fonction du type de modèle
        if (type === 'bidet') {
            sceneObject.scale.set(0.001, 0.001, 0.001); // Réduction de l'échelle pour bidet
        } else if (type === 'mirror') {
            sceneObject.scale.set(0.01, 0.01, 0.01); // Réduction de l'échelle pour miroir
        } else {
            sceneObject.scale.set(0.1, 0.1, 0.1); // Échelle par défaut pour les autres objets
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

function addEventListeners() {
    document.getElementById('modeTranslate').addEventListener('click', () => setTransformMode('translate'), false);
    document.getElementById('modeRotate').addEventListener('click', () => setTransformMode('rotate'), false);
    document.getElementById('lightIntensity').addEventListener('input', function (event) {
        const intensity = parseFloat(event.target.value);
        const ambientLight = scene.getObjectByProperty('type', 'AmbientLight');
        if (ambientLight) {
            ambientLight.intensity = intensity;
        }
    });
    document.getElementById('searchTile').addEventListener('input', filterTiles);
    document.getElementById('sinkModelInput').addEventListener('change', event => handleModelFile(event), false);
    document.getElementById('addSink').addEventListener('click', () => {
        if (sinkModel) {
            addObject(sinkModel.clone(), 'sink');
        } else {
            alert('Veuillez d\'abord charger un modèle de lavabo.');
        }
    });
    document.getElementById('addMirror').addEventListener('click', () => {
        if (mirrorModel) {
            addObject(mirrorModel.clone(), 'mirror');
        } else {
            alert('Veuillez d\'abord charger un modèle de miroir.');
        }
    });
    document.getElementById('addBidet').addEventListener('click', () => {
        if (bidetModel) {
            addObject(bidetModel.clone(), 'bidet');
        } else {
            alert('Veuillez d\'abord charger un modèle de bidet.');
        }
    });
    document.getElementById('removeObject').addEventListener('click', removeObject);
    document.getElementById('saveScene').addEventListener('click', saveScene);
    document.getElementById('saveImageButton').addEventListener('click', saveSceneAsImage);
    document.getElementById('tileTextureInput').addEventListener('change', handleTileTextureInput);
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

function selectWall(wall) {
    selectedWall = wall;
}

function handleInteraction(event) {
    event.preventDefault();

    let clientX, clientY;

    if (event.type === 'touchstart' && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
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
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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

    // Ajuster l'échelle en fonction du type de modèle
    if (type === 'bidet') {
        model.scale.set(0.05, 0.05, 0.05); // Réduction de l'échelle pour bidet
    } else if (type === 'mirror') {
        model.scale.set(0.03, 0.03, 0.03); // Réduction de l'échelle pour miroir
    } else {
        model.scale.set(0.1, 0.1, 0.1); // Échelle par défaut pour les autres objets
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
                texture: wall.material.map ? wall.material.map.image.src : null
            })),
            floor: {
                position: floor.position.toArray(),
                rotation: floor.rotation.toArray(),
                texture: floor.material.map ? floor.material.map.image.src : null
            },
            objects: objects.filter(obj => obj.userData.isMovable).map(obj => ({
                type: obj.userData.type,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray()
            }))
        };

        localStorage.setItem('bathroomScene', JSON.stringify(sceneData));
        alert('Scène sauvegardée avec succès!');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la scène :', error);
        alert('Erreur lors de la sauvegarde de la scène. Veuillez vérifier les paramètres et réessayer.');
    }
}

function loadScene() {
    const sceneData = JSON.parse(localStorage.getItem('bathroomScene'));
    if (sceneData) {
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
    } else {
        console.log('Aucune scène sauvegardée trouvée');
    }
}

function applyTextureToObject(object, textureSrc) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(textureSrc, (texture) => {
        object.material.map = texture;
        object.material.needsUpdate = true;
    });
}

function saveSceneAsImage() {
    try {
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'bathroom_scene.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert('La scène a été sauvegardée en tant qu\'image!');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la scène en image :', error);
        alert('Erreur lors de la sauvegarde de l\'image. Veuillez réessayer.');
    }
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
