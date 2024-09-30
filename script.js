// Variables globales
let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let selectedObject = null;
let selectedWall = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let gltfLoader = new THREE.GLTFLoader();
let actionHistory = [];
let redoStack = [];
let selectedTexture = null;
let draggedTexture = null;
let sinkModel = null;
let clickCount = 0;
let tripleClickTimeout;
let isWallMerged = false;
let ambientLight, directionalLight;

// Initialisation de la scène et des écouteurs d'événements
document.addEventListener('DOMContentLoaded', function () {
    init();
    addEventListeners();
    loadTexturesFromJSON();
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

    ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    loadSinkModel();

    renderer.domElement.addEventListener('click', handleInteraction, false);
    renderer.domElement.addEventListener('dblclick', onDoubleClick, false);
    renderer.domElement.addEventListener('click', handleTripleClick, false);
    window.addEventListener('resize', onWindowResize, false);

    initializeTextureEvents();
    animate();
}

function loadSinkModel() {
    gltfLoader.load('/images/LAVABO.glb', function (gltf) {
        sinkModel = gltf.scene;
        sinkModel.scale.set(0.1, 0.1, 0.1);
        console.log('Modèle de sanitaire chargé avec succès.');
    }, undefined, function (error) {
        console.error('Erreur lors du chargement du modèle de sanitaire:', error);
    });
}

function createWalls() {
    const largeurMur = 5;
    const hauteurMur = 3;
    const epaisseurMur = 0.3;

    const textureLoader = new THREE.TextureLoader();
    const textureMur1 = textureLoader.load('/images/1Chalet_Cervinia-honey_20_122cm.jpg');
    const textureMur2 = textureLoader.load('/images/TOGA_GREY_120x120.jpg');

    // Créer le Mur 1 (à l'arrière du coin)
    const materiauMur1 = new THREE.MeshStandardMaterial({ map: textureMur1, side: THREE.DoubleSide, color: 0xcccccc });
    const mur1 = new THREE.Mesh(new THREE.BoxGeometry(largeurMur, hauteurMur, epaisseurMur), materiauMur1);
    mur1.position.set(0, hauteurMur / 2, -largeurMur / 2 + epaisseurMur / 2); // Positionner le mur à l'arrière
    mur1.rotation.y = Math.PI;
    mur1.userData.isPartie1 = true;
    scene.add(mur1);
    walls.push(mur1);

    // Créer le Mur 2 (perpendiculaire à Mur 1)
    const materiauMur2 = new THREE.MeshStandardMaterial({ map: textureMur2, side: THREE.DoubleSide, color: 0xcccccc });
    const mur2 = new THREE.Mesh(new THREE.BoxGeometry(largeurMur, hauteurMur, epaisseurMur), materiauMur2);
    mur2.position.set(-largeurMur / 2 + epaisseurMur / 2, hauteurMur / 2, 0); // Positionner pour former un angle droit
    mur2.rotation.y = Math.PI / 2;
    mur2.userData.isPartie2 = true;
    scene.add(mur2);
    walls.push(mur2);
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-2.5, 0, -2.5); // Positionner le sol pour qu'il s'aligne avec les deux murs
    floor.userData.type = 'floor';
    scene.add(floor);
    objects.push(floor);
}

function dimensionScene() {
    // Demander les dimensions du sol : largeur et profondeur
    const floorWidth = prompt("Entrez la largeur du sol :", 5);
    const floorDepth = prompt("Entrez la profondeur du sol :", 5);

    // Demander les dimensions des murs : largeur et hauteur
    const wall1Width = prompt("Entrez la largeur du Mur 1 :", 5);
    const wall2Width = prompt("Entrez la largeur du Mur 2 :", 5);
    const wallHeight = prompt("Entrez la hauteur des murs :", 3);

    // Vérifier que toutes les valeurs sont valides
    if (floorWidth && floorDepth && wall1Width && wall2Width && wallHeight) {
        // Ajuster les dimensions du sol
        floor.scale.set(floorWidth, 1, floorDepth);
        floor.position.set(-floorWidth / 2, 0, -floorDepth / 2); // Ajuster la position pour former un coin

        // Ajuster la largeur et la hauteur du Mur 1
        const mur1 = walls.find(wall => wall.userData.isPartie1);
        if (mur1) {
            mur1.scale.set(wall1Width, wallHeight, mur1.scale.z);
            mur1.position.set(0, wallHeight / 2, -floorDepth / 2 + mur1.scale.z / 2); // Ajuster pour aligner avec le coin
        }

        // Ajuster la largeur et la hauteur du Mur 2
        const mur2 = walls.find(wall => wall.userData.isPartie2);
        if (mur2) {
            mur2.scale.set(wall2Width, wallHeight, mur2.scale.z);
            mur2.position.set(-floorWidth / 2 + mur2.scale.z / 2, wallHeight / 2, 0); // Ajuster pour aligner avec le coin
        }

        console.log('Scène redimensionnée : Sol et murs ajustés pour former un coin rectangulaire.');
    } else {
        alert('Veuillez entrer des valeurs valides pour les dimensions.');
    }
}

function addEventListeners() {
    document.getElementById('addSink').addEventListener('click', addSink);
    document.getElementById('removeObject').addEventListener('click', removeObject);
    document.getElementById('lightIntensity').addEventListener('input', adjustLightIntensity);
    document.getElementById('undoAction').addEventListener('click', undoAction);
    document.getElementById('redoAction').addEventListener('click', redoAction);
    document.getElementById('tileTextureInput').addEventListener('change', handleTileTextureInput);
    document.getElementById('saveScene').addEventListener('click', saveScene);
    document.getElementById('loadSceneButton').addEventListener('click', () => document.getElementById('loadSceneInput').click());
    document.getElementById('loadSceneInput').addEventListener('change', event => loadScene(event.target.files[0]));
    document.getElementById('modeTranslate').addEventListener('click', () => setTransformMode('translate'));
    document.getElementById('modeRotate').addEventListener('click', () => setTransformMode('rotate'));
    document.getElementById('sinkModelInput').addEventListener('change', handleModelFile);
    document.getElementById('searchTile').addEventListener('input', filterTextures);
    document.getElementById('dimensionScene').addEventListener('click', dimensionScene);
}

// Ajoutez les fonctions restantes comme dans le code précédent, car elles sont déjà en vigueur et n'ont pas besoin de modifications spécifiques pour ce changement de disposition.




function handleModelFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            gltfLoader.parse(e.target.result, '', function (gltf) {
                sinkModel = gltf.scene;
                sinkModel.scale.set(0.1, 0.1, 0.1);
                sinkModel.userData.type = 'sink';
                sinkModel.userData.isMovable = true;
                console.log('Modèle de sanitaire chargé.');
            }, undefined, function (error) {
                console.error('Erreur lors du chargement du modèle de sanitaire :', error);
            });
        };
        reader.readAsArrayBuffer(file);
    }
}

function handleInteraction(event) {
    event.preventDefault();
    let clientX = event.clientX || (event.touches && event.touches[0].clientX);
    let clientY = event.clientY || (event.touches && event.touches[0].clientY);

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...walls, floor, ...objects], true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        if (walls.includes(clickedObject) || clickedObject === floor) {
            selectedWall = clickedObject;
            console.log('Mur ou sol sélectionné :', selectedWall);
        } else if (clickedObject.userData.isMovable) {
            selectedObject = clickedObject;
            transformControls.attach(selectedObject);
            console.log('Objet sélectionné pour transformation :', selectedObject);
        } else {
            resetSelection();
        }
    } else {
        resetSelection();
    }
}

function resetSelection() {
    transformControls.detach();
    selectedObject = null;
    selectedWall = null;
}

function onDoubleClick(event) {
    event.preventDefault();
    let clientX = event.clientX || (event.touches && event.touches[0].clientX);
    let clientY = event.clientY || (event.touches && event.touches[0].clientY);

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;

        while (clickedObject.parent && clickedObject.parent !== scene) {
            clickedObject = clickedObject.parent;
        }

        if (clickedObject.userData.isMovable) {
            selectedObject = clickedObject;
            transformControls.attach(selectedObject);
            transformControls.setMode('translate');
        } else {
            transformControls.detach();
            selectedObject = null;
        }
    } else {
        transformControls.detach();
        selectedObject = null;
    }
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

function addSink() {
    if (sinkModel) {
        const clone = sinkModel.clone();
        clone.position.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 2.4);
        clone.userData.type = 'sink';
        clone.userData.isMovable = true;

        scene.add(clone);
        objects.push(clone);
        actionHistory.push({ type: 'add', object: clone });
        console.log('Sanitaire ajouté.');
    } else {
        alert('Veuillez d\'abord charger un modèle de sanitaire.');
    }
}

function removeObject() {
    if (selectedObject && selectedObject.userData.isMovable) {
        scene.remove(selectedObject);
        objects = objects.filter(obj => obj !== selectedObject);
        actionHistory.push({ type: 'remove', object: selectedObject });
        transformControls.detach();
        selectedObject = null;
        console.log('Objet supprimé.');
    } else {
        alert('Aucun objet sélectionné ou l\'objet ne peut pas être supprimé.');
    }
}

function adjustLightIntensity(event) {
    const intensity = parseFloat(event.target.value);
    if (ambientLight) {
        ambientLight.intensity = intensity;
    }
    if (directionalLight) {
        directionalLight.intensity = intensity * 0.7;
    }
    console.log('Intensité de la lumière ajustée à', intensity);
}

function undoAction() {
    if (actionHistory.length > 0) {
        const lastAction = actionHistory.pop();
        redoStack.push(lastAction);

        if (lastAction.type === 'add') {
            scene.remove(lastAction.object);
            objects = objects.filter(obj => obj !== lastAction.object);
        } else if (lastAction.type === 'remove') {
            scene.add(lastAction.object);
            objects.push(lastAction.object);
        }
        console.log('Action annulée.');
    }
}

function redoAction() {
    if (redoStack.length > 0) {
        const lastUndo = redoStack.pop();
        actionHistory.push(lastUndo);

        if (lastUndo.type === 'add') {
            scene.add(lastUndo.object);
            objects.push(lastUndo.object);
        } else if (lastUndo.type === 'remove') {
            scene.remove(lastUndo.object);
            objects = objects.filter(obj => obj !== lastUndo.object);
        }
        console.log('Action rétablie.');
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

function saveScene() {
    const sceneData = {
        objects: [],
        walls: [],
        floor: null,
        camera: {
            position: camera.position.toArray(),
            rotation: camera.rotation.toArray(),
            fov: camera.fov,
            near: camera.near,
            far: camera.far
        },
        lights: []
    };

    walls.forEach(wall => {
        if (wall && wall.material) {
            sceneData.walls.push({
                position: wall.position.toArray(),
                rotation: wall.rotation.toArray(),
                scale: wall.scale.toArray(),
                texture: wall.material.map ? wall.material.map.image.src : null,
                isMerged: wall.userData.isMerged || false,
                type: wall.userData.isPartie1 ? 'partie1' : (wall.userData.isPartie2 ? 'partie2' : 'other'),
                originalDimensions: {
                    width: wall.geometry.parameters.width,
                    height: wall.geometry.parameters.height,
                    depth: wall.geometry.parameters.depth
                }
            });
        } else {
            console.warn('Encountered a wall without proper properties', wall);
        }
    });

    if (floor && floor.material) {
        sceneData.floor = {
            position: floor.position.toArray(),
            rotation: floor.rotation.toArray(),
            scale: floor.scale.toArray(),
            texture: floor.material.map ? floor.material.map.image.src : null
        };
    }

    objects.forEach(obj => {
        if (obj.userData.isMovable) {
            sceneData.objects.push({
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray(),
                type: obj.userData.type,
                uuid: obj.uuid
            });
        }
    });

    scene.children.forEach(child => {
        if (child.isLight) {
            sceneData.lights.push({
                type: child.type,
                color: child.color.getHex(),
                intensity: child.intensity,
                position: child.position.toArray()
            });
        }
    });

    const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);

    console.log('Scène sauvegardée avec succès.');
}

function loadScene(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const sceneData = JSON.parse(e.target.result);
            clearScene();

            sceneData.walls.forEach(wallData => {
                const material = new THREE.MeshStandardMaterial({
                    map: wallData.texture ? new THREE.TextureLoader().load(wallData.texture) : null,
                    side: THREE.DoubleSide,
                    color: 0xcccccc
                });

                let wall;
                if (wallData.isMerged) {
                    wall = new THREE.Mesh(
                        new THREE.BoxGeometry(wallData.originalDimensions.width, wallData.originalDimensions.height, wallData.originalDimensions.depth),
                        material
                    );
                    wall.userData.isMerged = true;
                } else {
                    wall = new THREE.Mesh(
                        new THREE.BoxGeometry(wallData.originalDimensions.width, wallData.originalDimensions.height, wallData.originalDimensions.depth),
                        material
                    );
                    wall.userData.isPartie1 = wallData.type === 'partie1';
                    wall.userData.isPartie2 = wallData.type === 'partie2';
                }

                wall.position.fromArray(wallData.position);
                wall.rotation.fromArray(wallData.rotation);
                wall.scale.fromArray(wallData.scale);
                scene.add(wall);
                walls.push(wall);
            });

            if (sceneData.floor) {
                const floorMaterial = new THREE.MeshStandardMaterial({
                    map: sceneData.floor.texture ? new THREE.TextureLoader().load(sceneData.floor.texture) : null,
                    side: THREE.DoubleSide,
                    color: 0xcccccc
                });

                floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), floorMaterial);
                floor.position.fromArray(sceneData.floor.position);
                floor.rotation.fromArray(sceneData.floor.rotation);
                floor.scale.fromArray(sceneData.floor.scale);
                floor.rotation.x = -Math.PI / 2;
                scene.add(floor);
                objects.push(floor);
            }

            sceneData.objects.forEach(objData => {
                if (objData.type === 'sink' && sinkModel) {
                    const model = sinkModel.clone();
                    model.position.fromArray(objData.position);
                    model.rotation.fromArray(objData.rotation);
                    model.scale.fromArray(objData.scale);
                    model.userData.type = objData.type;
                    model.userData.isMovable = true;
                    scene.add(model);
                    objects.push(model);
                }
            });

            let ambientIntensity = 0;
            let directionalIntensity = 0;

            sceneData.lights.forEach(lightData => {
                if (lightData.type === 'AmbientLight') {
                    ambientIntensity = lightData.intensity;
                } else if (lightData.type === 'DirectionalLight') {
                    directionalIntensity = lightData.intensity;
                }
            });

            if (ambientLight) {
                ambientLight.intensity = Math.min(ambientIntensity, 0.7);
            } else {
                ambientLight = new THREE.AmbientLight(0xffffff, Math.min(ambientIntensity, 0.7));
                scene.add(ambientLight);
            }

            if (directionalLight) {
                directionalLight.intensity = Math.min(directionalIntensity, 0.5);
            } else {
                directionalLight = new THREE.DirectionalLight(0xffffff, Math.min(directionalIntensity, 0.5));
                directionalLight.position.set(5, 5, 5);
                scene.add(directionalLight);
            }

            camera.position.fromArray(sceneData.camera.position);
            camera.rotation.fromArray(sceneData.camera.rotation);
            camera.fov = sceneData.camera.fov;
            camera.near = sceneData.camera.near;
            camera.far = sceneData.camera.far;
            camera.updateProjectionMatrix();

            console.log('Scène chargée avec succès!');
        } catch (error) {
            console.error('Erreur lors du chargement de la scène :', error);
            alert('Erreur lors du chargement de la scène. Veuillez vérifier le fichier.');
        }
    };
    reader.readAsText(file);
}

function clearScene() {
    objects.forEach(obj => {
        if (obj.userData.isMovable) {
            scene.remove(obj);
        }
    });
    walls.forEach(wall => scene.remove(wall));
    if (floor) scene.remove(floor);

    objects = [];
    walls = [];
    isWallMerged = false;
}

function setTransformMode(mode) {
    if (selectedObject) {
        transformControls.setMode(mode);
        console.log(`Mode de transformation réglé sur ${mode}.`);
    } else {
        alert('Veuillez sélectionner un objet pour appliquer la transformation.');
    }
}

function handleTripleClick(event) {
    clickCount++;
    clearTimeout(tripleClickTimeout);

    tripleClickTimeout = setTimeout(() => {
        clickCount = 0;
    }, 500);

    if (clickCount === 3) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(walls, true);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            if (clickedObject.userData.isPartie1 || clickedObject.userData.isMerged) {
                toggleWallMerge(clickedObject);
            }
        }

        clickCount = 0;
    }
}

function toggleWallMerge(clickedPart) {
    if (!isWallMerged) {
        // Fusionner les parties du mur
        mergeWall(clickedPart);
        isWallMerged = true;
    } else {
        // Revenir à l'état initial
        restoreOriginalMur1();
        isWallMerged = false;
    }
}

function mergeWall(clickedPart) {
    const largeurMur = 5;
    const hauteurMur = 3;
    const epaisseurMur = 0.3;
    const selectedTexture = clickedPart.material.map;

    // Supprimer les parties originales de mur1 si elles existent dans la scène
    removeOriginalParts();

    // Créer le mur fusionné
    const mergedWall = new THREE.Mesh(
        new THREE.BoxGeometry(largeurMur, hauteurMur, epaisseurMur),
        new THREE.MeshStandardMaterial({ map: selectedTexture, side: THREE.DoubleSide, color: 0xcccccc })
    );

    mergedWall.position.set(0, hauteurMur / 2, -largeurMur / 2 + epaisseurMur / 2);
    mergedWall.rotation.y = Math.PI;
    mergedWall.userData.isMerged = true;

    // Ajouter le mur fusionné à la scène et mettre à jour le tableau des murs
    scene.add(mergedWall);
    walls = [mergedWall, ...walls.filter(wall => !wall.userData.isPartie1)];
    console.log('Mur fusionné avec la texture de la partie cliquée.');
}

function removeOriginalParts() {
    // Supprimer les parties originales de mur1 de la scène
    walls.forEach(wall => {
        if (wall.userData.isPartie1) {
            scene.remove(wall);
        }
    });
}

function restoreOriginalMur1() {
    // Supprimer le mur fusionné de la scène
    walls.forEach(wall => {
        if (wall.userData.isMerged) {
            scene.remove(wall);
        }
    });

    // Vider le tableau des murs pour supprimer les références résiduelles au mur fusionné
    walls = walls.filter(wall => !wall.userData.isMerged);

    // Réajouter les parties originales de mur1
    scene.add(originalMurBas);
    scene.add(originalMurHaut);
    walls.push(originalMurBas, originalMurHaut);

    console.log('Mur1 restauré à son état initial.');
}

function initializeTextureEvents() {
    document.querySelectorAll('.texture-option').forEach((img) => {
        img.addEventListener('click', () => {
            const textureLoader = new THREE.TextureLoader();
            selectedTexture = textureLoader.load(img.src, () => {
                applySelectedTexture();
            });
        });

        img.setAttribute('draggable', true);
        img.addEventListener('dragstart', onTextureDragStart);
    });

    renderer.domElement.addEventListener('dragover', onDragOver);
    renderer.domElement.addEventListener('drop', onTextureDrop);
}

function onDragOver(event) {
    event.preventDefault();
}

function onTextureDragStart(event) {
    const imgSrc = event.target.src;
    const textureLoader = new THREE.TextureLoader();
    draggedTexture = textureLoader.load(imgSrc);
}

function onTextureDrop(event) {
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...walls, floor], true);

    if (intersects.length > 0 && draggedTexture) {
        const targetObject = intersects[0].object;
        targetObject.material.map = draggedTexture;
        targetObject.material.needsUpdate = true;
        draggedTexture = null;
    }
}

function filterTextures() {
    const searchInput = document.getElementById('searchTile').value.toLowerCase();
    const textures = document.querySelectorAll('.texture-option');

    textures.forEach(texture => {
        const altText = texture.alt.toLowerCase();
        if (altText.includes(searchInput)) {
            texture.style.display = 'block';
        } else {
            texture.style.display = 'none';
        }
    });
}

function loadTexturesFromJSON() {
    fetch('merged.json')
        .then(response => response.json())
        .then(data => {
            const textureList = document.querySelector('.texture-list');
            textureList.innerHTML = '';

            data.forEach(texture => {
                const img = document.createElement('img');
                img.src = texture.src;
                img.alt = texture.alt;
                img.classList.add('texture-option');
                img.setAttribute('draggable', true);

                img.addEventListener('click', () => {
                    const textureLoader = new THREE.TextureLoader();
                    selectedTexture = textureLoader.load(img.src, () => {
                        applySelectedTexture();
                    });
                });

                img.addEventListener('dragstart', onTextureDragStart);
                textureList.appendChild(img);
            });
        })
        .catch(error => console.error('Erreur lors du chargement des textures :', error));
}

function applySelectedTexture() {
    if (!selectedWall) {
        console.error('Erreur : Aucun mur ou sol sélectionné. Veuillez sélectionner un mur ou le sol avant d\'appliquer une texture.');
        alert('Veuillez sélectionner un mur ou le sol avant d\'appliquer une texture.');
        return;
    }

    if (!selectedTexture) {
        console.error('Erreur : Aucune texture sélectionnée. Veuillez sélectionner une texture avant de l\'appliquer.');
        alert('Veuillez sélectionner une texture avant de l\'appliquer.');
        return;
    }

    // Appliquer la texture si le mur et la texture sont sélectionnés
    selectedTexture.wrapS = THREE.RepeatWrapping;
    selectedTexture.wrapT = THREE.RepeatWrapping;
    selectedWall.material.map = selectedTexture;
    selectedWall.material.needsUpdate = true;

    selectedTexture = null;
    selectedWall = null;
    console.log('Texture appliquée.');
}
