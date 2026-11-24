import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, EdgesGeometry, GridHelper, HemisphereLight, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera,
  PlaneGeometry, Points, PointsMaterial, Raycaster, Scene, Vector2, Vector3, WebGLRenderer,
} from './vendor/three.min.js';
import {
  SIZE, MAX_HEIGHT, MATERIALS, SYMMETRY_MODES, BRIDGE_PLAN, applyBatchPlace, applyBatchRemove, applyClear,
  bridgeProgress, canPlace, createHistory, createPracticeWorld, hasBlock, mirrorPositions,
} from './world.js';
import { blockFinish, editFeedback } from './finishes.js';
import { bindProjects } from './project-panel.js';

const t = (key, params) => window.I18N.t(key, params);
const MATERIAL_LABELS = {
  grass: '草地',
  stone: '石头',
  wood: '木板',
  sand: '沙子',
  iron: '铁',
  copper: '铜',
  gold: '金',
  diamond: '钻石',
  brick: '红砖',
  leaves: '树叶',
  glass: '玻璃',
  snow: '白雪',
};
const SYMMETRY_LABELS = {
  off: '对称: 关',
  x: '对称: X 轴',
  z: '对称: Z 轴',
  xz: '对称: 四向',
};

const canvas = document.querySelector('#world');
const stage = canvas.parentElement;
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const materialButtons = [...document.querySelectorAll('[data-material]')];
const turnButtons = [...document.querySelectorAll('[data-turn]')];
const overview = document.querySelector('#workshop-overview');
const viewButtons = [...turnButtons, overview];
const undoButton = document.querySelector('#workshop-undo');
const redoButton = document.querySelector('#workshop-redo');
const symmetryButton = document.querySelector('#workshop-symmetry');
const exportButton = document.querySelector('#workshop-export');
const finishTutorialButton = document.querySelector('#workshop-finish-tutorial');
const libraryDialog = document.querySelector('#workshop-library');
const namingDialog = document.querySelector('#workshop-naming');
const controls = [
  ...toolButtons,
  ...materialButtons,
  ...viewButtons,
  undoButton,
  redoButton,
  symmetryButton,
  exportButton,
  ...document.querySelectorAll('.workshop-panel .workshop-actions button'),
].filter(Boolean);
const sound = document.querySelector('#workshop-sound');
const help = document.querySelector('#workshop-help');
const status = document.querySelector('#workshop-status');
const blueprint = document.querySelector('#workshop-blueprint');
const workshop = canvas.closest('.workshop');
const tip = document.querySelector('#workshop-gesture-tip');
const dismissTip = document.querySelector('#workshop-dismiss-tip');
const tipKey = 'game_tutorial_block-workshop_gestures';

for (const button of materialButtons) {
  button.style.setProperty('--material-color', MATERIALS[button.dataset.material]);
}

const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
if (gl) {
  start(new WebGLRenderer({ canvas, context: gl, preserveDrawingBuffer: true }));
} else {
  const message = document.querySelector('#graphics-error');
  const showError = () => { message.textContent = t('此设备暂无法运行 3D 场景。'); };
  for (const button of controls) button.disabled = true;
  canvas.hidden = true;
  status.hidden = true;
  message.hidden = false;
  showError();
  document.addEventListener('i18n:change', showError);
}

function start(renderer) {
  let blocks;
  let practice = null;
  let history = createHistory(100);
  const scene = new Scene();
  const background = new Color('#c4d8e8');
  scene.background = background;
  const camera = new OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  const defaultAngle = Math.PI / 4;
  const defaultElevation = Math.atan2(12.5, 13 * Math.SQRT2);
  const distance = SIZE * 1.8;
  const elevationLimit = Math.PI / 2 - 0.025;
  const homeFocus = new Vector3(0, 3, 0);
  const focus = homeFocus.clone();
  const offset = new Vector3();
  const beforeZoom = new Vector3();
  const afterZoom = new Vector3();
  const quarterTurn = Math.PI / 2;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let angle = defaultAngle;
  let elevation = defaultElevation;
  let turnTarget = angle;
  let turnFrame = null;
  let tool = 'place';
  let material = 'grass';
  let symmetry = 'off';
  let blocked = false;
  let pickedMaterial = null;
  let statusNoticeKey = '';
  let gesture = null;
  let drag = null;
  const contacts = new Map();
  let contextLost = false;
  let redrawFrame = 0;

  const hemiLight = new HemisphereLight('#f8fbff', '#729291', 2);
  scene.add(hemiLight);
  const sunlight = new DirectionalLight('#fff4d9', 2.15);
  sunlight.position.set(4, 9, 6);
  scene.add(sunlight);

  const baseGeometry = new BoxGeometry(SIZE + 0.18, 0.6, SIZE + 0.18);
  const baseMaterial = new MeshStandardMaterial({ color: '#435f61' });
  const base = new Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.32;
  scene.add(base);
  const edgeMaterial = new LineBasicMaterial({ color: '#557a83' });
  const edge = new LineSegments(new EdgesGeometry(baseGeometry), edgeMaterial);
  edge.position.copy(base.position);
  scene.add(edge);

  const undersideRail = new BoxGeometry(SIZE + 0.18, 0.4, 0.23);
  const undersideMaterial = new MeshStandardMaterial({ color: '#365860', roughness: 0.9 });
  const undersideRails = [];
  for (let side = 0; side < 4; side += 1) {
    const rail = new Mesh(undersideRail, undersideMaterial);
    rail.rotation.y = side * quarterTurn;
    const radius = SIZE / 2 + 0.13;
    rail.position.set(Math.sin(rail.rotation.y) * radius, -0.42, Math.cos(rail.rotation.y) * radius);
    rail.visible = false;
    undersideRails.push(rail);
    scene.add(rail);
  }

  const floorMaterial = new MeshStandardMaterial({ color: '#9bb2a4' });
  const floor = new Mesh(new PlaneGeometry(SIZE, SIZE), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  let majorGrid = new GridHelper(SIZE, SIZE / 4, '#516568', '#617b79');
  majorGrid.position.y = 0.005;
  majorGrid.material.transparent = true;
  majorGrid.material.depthWrite = false;
  scene.add(majorGrid);
  let grid = new GridHelper(SIZE, SIZE, '#596f72', '#6f8986');
  grid.position.y = 0.008;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const xGuideMaterial = new LineBasicMaterial({ color: '#0284c7', transparent: true, opacity: 0.72, depthTest: false });
  const zGuideMaterial = new LineBasicMaterial({ color: '#0284c7', transparent: true, opacity: 0.72, depthTest: false });
  const xGuide = new LineSegments(
    new BufferGeometry().setFromPoints([new Vector3(0, 0.02, -SIZE / 2), new Vector3(0, 0.02, SIZE / 2)]),
    xGuideMaterial,
  );
  const zGuide = new LineSegments(
    new BufferGeometry().setFromPoints([new Vector3(-SIZE / 2, 0.02, 0), new Vector3(SIZE / 2, 0.02, 0)]),
    zGuideMaterial,
  );
  xGuide.renderOrder = 3;
  zGuide.renderOrder = 3;
  xGuide.visible = false;
  zGuide.visible = false;
  scene.add(xGuide);
  scene.add(zGuide);

  const cube = new BoxGeometry(1, 1, 1);
  const blueprintGeometry = new BoxGeometry(0.97, 0.97, 0.97);
  const blueprintEdges = new EdgesGeometry(blueprintGeometry);
  const guideFill = new MeshBasicMaterial({ color: '#7bceef', transparent: true, opacity: 0.27, depthWrite: false });
  const guideLines = new LineBasicMaterial({ color: '#214a70', transparent: true, opacity: 0.82, depthWrite: false });
  const guides = BRIDGE_PLAN.map((cell) => {
    const mesh = new Mesh(blueprintGeometry, guideFill);
    const edges = new LineSegments(blueprintEdges, guideLines);
    mesh.position.set(cell.x - SIZE / 2 + 0.5, cell.y + 0.5, cell.z - SIZE / 2 + 0.5);
    mesh.renderOrder = 2;
    edges.renderOrder = 3;
    mesh.add(edges);
    scene.add(mesh);
    return { cell, mesh };
  });
  const instances = new Map();
  const pickable = [];
  for (const name of Object.keys(MATERIALS)) {
    const mesh = new InstancedMesh(cube, blockFinish(name), SIZE * SIZE * MAX_HEIGHT);
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (name === 'glass') mesh.renderOrder = 1;
    const cells = [];
    mesh.userData.cells = cells;
    instances.set(name, { mesh, cells });
    pickable.push(mesh);
    scene.add(mesh);
  }

  const previewGhostGeo = new BoxGeometry(0.994, 0.994, 0.994);
  const previewEdgeGeo = new EdgesGeometry(new BoxGeometry(1.03, 1.03, 1.03));
  const previewSlots = Array.from({ length: 4 }, () => {
    const ghostMat = new MeshBasicMaterial({ color: MATERIALS.grass, transparent: true, opacity: 0.42, depthWrite: false });
    const edgeMat = new LineBasicMaterial({ color: '#164e63', transparent: true, opacity: 0.92, depthTest: false });
    const ghost = new Mesh(previewGhostGeo, ghostMat);
    const frame = new LineSegments(previewEdgeGeo, edgeMat);
    ghost.renderOrder = 4;
    frame.renderOrder = 5;
    ghost.visible = false;
    frame.visible = false;
    scene.add(ghost);
    scene.add(frame);
    return { ghost, ghostMat, frame, edgeMat };
  });

  const themeColors = {
    place: '#164e63',
    remove: '#dc2626',
    pick: '#d97706',
  };

  function isDarkTheme() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function rebuildGrid(targetGrid, divisions, c1, c2, opacity, y) {
    scene.remove(targetGrid);
    targetGrid.geometry.dispose();
    targetGrid.material.dispose();
    const next = new GridHelper(SIZE, divisions, c1, c2);
    next.position.y = y;
    next.material.transparent = true;
    next.material.depthWrite = false;
    next.material.opacity = opacity;
    scene.add(next);
    return next;
  }

  function applyTheme() {
    const dark = isDarkTheme();
    background.set(dark ? '#121d2d' : '#c4d8e8');
    hemiLight.color.set(dark ? '#9ec5f0' : '#f8fbff');
    hemiLight.groundColor.set(dark ? '#27394d' : '#729291');
    hemiLight.intensity = dark ? 1.65 : 2;
    sunlight.color.set(dark ? '#ffe4b5' : '#fff4d9');
    sunlight.intensity = dark ? 1.95 : 2.15;
    floorMaterial.color.set(dark ? '#2c3e4c' : '#9bb2a4');
    baseMaterial.color.set(dark ? '#1c2a3a' : '#435f61');
    edgeMaterial.color.set(dark ? '#4b6b88' : '#557a83');
    undersideMaterial.color.set(dark ? '#1a2b3c' : '#365860');
    majorGrid = rebuildGrid(majorGrid, SIZE / 4, dark ? '#3f566a' : '#516568', dark ? '#34495b' : '#617b79', 1, 0.005);
    grid = rebuildGrid(grid, SIZE, dark ? '#394f62' : '#596f72', dark ? '#455f73' : '#6f8986', 0.55, 0.008);
    xGuideMaterial.color.set(dark ? '#38bdf8' : '#0284c7');
    zGuideMaterial.color.set(dark ? '#f59e0b' : '#b45309');
    themeColors.place = dark ? '#7dd3fc' : '#164e63';
    themeColors.remove = dark ? '#ff6b6b' : '#dc2626';
    themeColors.pick = dark ? '#fbbf24' : '#d97706';
    updateView();
  }

  const chips = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0 }));
  const chipPositions = new BufferAttribute(new Float32Array(chips.length * 3), 3);
  const chipGeometry = new BufferGeometry();
  chipGeometry.setAttribute('position', chipPositions);
  const chipMaterial = new PointsMaterial({ size: 0.13, transparent: true, depthWrite: false });
  const keyboardPoint = new Vector2(0.5, 0.5);
  const debris = new Points(chipGeometry, chipMaterial);
  debris.frustumCulled = false;
  debris.visible = false;
  scene.add(debris);
  let debrisFrame = 0;

  function showDebris(cell, name, removing) {
    if (reducedMotion.matches) return;
    cancelAnimationFrame(debrisFrame);
    const start = performance.now();
    const duration = name === 'diamond' && !removing ? 135 : removing ? 260 : 170;
    debris.position.set(cell.x - SIZE / 2 + 0.5, cell.y + (removing ? 0.52 : 0.98), cell.z - SIZE / 2 + 0.5);
    chipMaterial.color.set(MATERIALS[name]).lerp(new Color('#ffffff'), name === 'gold' || name === 'diamond' ? 0.62 : 0.27);
    chipMaterial.size = name === 'sand' ? 0.08 : removing ? 0.17 : 0.12;
    for (const [index, chip] of chips.entries()) {
      const angle = Math.PI * 2 * index / chips.length;
      const speed = removing ? 0.72 : 0.48;
      chip.x = Math.cos(angle) * speed;
      chip.y = 0.36 + Math.random() * 0.42;
      chip.z = Math.sin(angle) * speed;
      chipPositions.setXYZ(index, 0, 0.03, 0);
    }
    chipPositions.needsUpdate = true;
    chipMaterial.opacity = 0.86;
    debris.visible = true;
    function frame(now) {
      const progress = Math.max(0, (now - start) / duration);
      if (progress >= 1 || contextLost) {
        debris.visible = false;
        draw();
        return;
      }
      for (const [index, chip] of chips.entries()) {
        chipPositions.setXYZ(index, chip.x * progress, chip.y * progress - progress * progress * 0.65, chip.z * progress);
      }
      chipPositions.needsUpdate = true;
      chipMaterial.opacity = 0.86 * (1 - progress);
      draw();
      debrisFrame = requestAnimationFrame(frame);
    }
    debrisFrame = requestAnimationFrame(frame);
  }

  const matrix = new Matrix4();
  const ray = new Raycaster();
  const pointer = new Vector2();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  function draw() {
    if (!contextLost) renderer.render(scene, camera);
  }

  function syncBlocks(changed) {
    const materialSet = !changed ? null : typeof changed === 'string' ? new Set([changed]) : changed;
    const targets = materialSet
      ? [...materialSet].map((name) => instances.get(name)).filter(Boolean)
      : [...instances.values()];
    for (const { cells } of targets) cells.length = 0;
    for (const cell of blocks.values()) {
      if (materialSet && !materialSet.has(cell.material)) continue;
      const { mesh, cells } = instances.get(cell.material);
      matrix.makeTranslation(cell.x - SIZE / 2 + 0.5, cell.y + 0.5, cell.z - SIZE / 2 + 0.5);
      mesh.setMatrixAt(cells.length, matrix);
      cells.push(cell);
    }
    for (const { mesh, cells } of targets) {
      mesh.count = cells.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
      mesh.boundingBox = null;
    }
    renderBlueprint();
  }

  function renderBlueprint() {
    const progress = practice ? bridgeProgress(blocks) : null;
    for (const { cell, mesh } of guides) {
      mesh.visible = Boolean(progress?.step?.cells.includes(cell) && !hasBlock(blocks, cell));
    }
    if (!progress) {
      if (finishTutorialButton) finishTutorialButton.hidden = true;
      return;
    }
    const total = BRIDGE_PLAN.length;
    const completed = progress.placed === total && progress.clear;
    blueprint.toggleAttribute('data-complete', completed);
    if (finishTutorialButton) finishTutorialButton.hidden = !completed;
    let text = completed ? t('小桥完成！') : t('拆掉桥面下多余的方块。');
    if (progress.step) {
      text = t('{step}（{placed}/{total}）', { step: t(progress.step.prompt), placed: progress.placed, total });
    }
    if (blueprint.textContent !== text) blueprint.textContent = text;
  }

  function activeSymmetry() {
    return practice ? 'off' : symmetry;
  }

  function hidePreviewSlots() {
    let any = false;
    for (const slot of previewSlots) {
      if (slot.ghost.visible || slot.frame.visible) any = true;
      slot.ghost.visible = false;
      slot.frame.visible = false;
    }
    return any;
  }

  function updateView() {
    const radius = distance * Math.cos(elevation);
    offset.set(Math.sin(angle) * radius, distance * Math.sin(elevation), Math.cos(angle) * radius);
    camera.position.copy(focus).add(offset);
    camera.lookAt(focus);
    const fromBelow = elevation < 0;
    base.visible = floor.visible = grid.visible = !fromBelow;
    majorGrid.material.opacity = fromBelow ? 0.19 : 1;
    majorGrid.position.y = fromBelow ? -0.62 : 0.005;
    for (const rail of undersideRails) rail.visible = fromBelow;
    grid.material.opacity = Math.min(0.55, 0.27 + (camera.zoom - 1) * 0.14);
    const sym = activeSymmetry();
    const showGuides = !fromBelow && sym !== 'off';
    xGuide.visible = showGuides && (sym === 'x' || sym === 'xz');
    zGuide.visible = showGuides && (sym === 'z' || sym === 'xz');
    hidePreviewSlots();
    draw();
  }

  function pointOnView(target, x, y, bounds) {
    return target.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2, 0)
      .unproject(camera);
  }

  function zoomAt(scale, from, to = from) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !Number.isFinite(scale)) return;
    pointOnView(beforeZoom, from.x, from.y, bounds);
    camera.zoom = Math.max(0.85, Math.min(8, camera.zoom * scale));
    camera.updateProjectionMatrix();
    pointOnView(afterZoom, to.x, to.y, bounds);
    focus.add(beforeZoom.sub(afterZoom));
    focus.x = Math.max(-SIZE / 2, Math.min(SIZE / 2, focus.x));
    focus.y = Math.max(-1, Math.min(MAX_HEIGHT + 1, focus.y));
    focus.z = Math.max(-SIZE / 2, Math.min(SIZE / 2, focus.z));
    updateView();
  }

  function finishTurn() {
    turnFrame = null;
    angle = turnTarget % (Math.PI * 2);
    for (const button of viewButtons) button.removeAttribute('aria-disabled');
  }

  function turn(direction) {
    if (contextLost || turnFrame !== null) return;
    clearContacts();
    turnTarget = angle - direction * quarterTurn;
    if (reducedMotion.matches) {
      finishTurn();
      updateView();
      return;
    }

    const from = angle;
    const started = performance.now();
    for (const button of viewButtons) button.setAttribute('aria-disabled', 'true');
    function frame(now) {
      const progress = Math.min(1, Math.max(0, (now - started) / 300));
      if (progress === 1) {
        finishTurn();
      } else {
        const eased = progress * progress * (3 - 2 * progress);
        angle = from + (turnTarget - from) * eased;
        turnFrame = requestAnimationFrame(frame);
      }
      updateView();
    }
    turnFrame = requestAnimationFrame(frame);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (contextLost || !width || !height) return;
    const aspect = width / height;
    const overview = SIZE * 0.76;
    const halfHeight = Math.max(SIZE * 0.65, overview / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    updateView();
  }

  function renderStatus() {
    if (statusNoticeKey) {
      status.textContent = t(statusNoticeKey);
    } else if (pickedMaterial) {
      status.textContent = t('已吸取材质：{material}', { material: t(MATERIAL_LABELS[pickedMaterial]) });
    } else if (blocked) {
      status.textContent = t('这里不能放置方块。');
    } else if (tool === 'remove') {
      status.textContent = t('点方块将它拆除。');
    } else if (tool === 'pick') {
      status.textContent = t('点击已有方块吸取它的材质。');
    } else {
      status.textContent = t('点地面或方块表面放置。');
    }
  }

  function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = contextLost || !history.canUndo();
    if (redoButton) redoButton.disabled = contextLost || !history.canRedo();
  }

  function updateSymmetryButton() {
    if (!symmetryButton) return;
    const mode = activeSymmetry();
    const labelKey = SYMMETRY_LABELS[mode] || SYMMETRY_LABELS.off;
    symmetryButton.dataset.i18n = labelKey;
    symmetryButton.textContent = t(labelKey);
    symmetryButton.setAttribute('aria-pressed', String(mode !== 'off'));
    symmetryButton.disabled = contextLost || Boolean(practice);
  }

  function selectTool(nextTool) {
    if (!toolButtons.some((button) => button.dataset.tool === nextTool)) return;
    tool = nextTool;
    blocked = false;
    pickedMaterial = null;
    statusNoticeKey = '';
    for (const control of toolButtons) {
      control.setAttribute('aria-pressed', String(control.dataset.tool === tool));
    }
    renderStatus();
  }

  function selectMaterial(nextMaterial) {
    if (!Object.hasOwn(MATERIALS, nextMaterial)) return;
    material = nextMaterial;
    pickedMaterial = null;
    statusNoticeKey = '';
    for (const control of materialButtons) {
      control.setAttribute('aria-pressed', String(control.dataset.material === material));
    }
    renderStatus();
  }

  function cycleSymmetry() {
    if (contextLost || practice) return;
    const index = SYMMETRY_MODES.indexOf(symmetry);
    symmetry = SYMMETRY_MODES[(index + 1) % SYMMETRY_MODES.length];
    statusNoticeKey = '';
    updateSymmetryButton();
    updateView();
  }

  function floorIndex(coordinate) {
    return Math.max(0, Math.min(SIZE - 1, Math.floor(coordinate + SIZE / 2)));
  }

  function pick(event, activeTool = tool) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    pointer.set(x * 2 - 1, 1 - y * 2);
    ray.setFromCamera(pointer, camera);
    const [blockHit] = ray.intersectObjects(pickable, false);
    const [groundHit] = floor.visible && activeTool === 'place' ? ray.intersectObject(floor, false) : [];
    const hit = !blockHit || (groundHit && groundHit.distance < blockHit.distance) ? groundHit : blockHit;
    if (!hit) return null;
    if (hit.object === floor) {
      return activeTool === 'place' ? { x: floorIndex(hit.point.x), y: 0, z: floorIndex(hit.point.z) } : null;
    }
    const cell = hit.object.userData.cells[hit.instanceId];
    if (!cell) return null;
    if (activeTool === 'remove' || activeTool === 'pick') return cell;
    const normal = hit.face.normal;
    return { x: cell.x + normal.x, y: cell.y + normal.y, z: cell.z + normal.z };
  }

  function preview(event) {
    const activeTool = event.altKey ? 'pick' : tool;
    const cell = pick(event, activeTool);
    hidePreviewSlots();
    if (cell) {
      let targets = [];
      if (activeTool === 'pick') {
        targets = [cell];
      } else if (activeTool === 'remove') {
        targets = mirrorPositions(cell, activeSymmetry()).filter((pos) => hasBlock(blocks, pos));
      } else {
        targets = mirrorPositions(cell, activeSymmetry()).filter((pos) => canPlace(blocks, pos));
      }
      const edgeColor = themeColors[activeTool] || themeColors.place;
      targets.forEach((pos, index) => {
        const slot = previewSlots[index];
        if (!slot) return;
        const wx = pos.x - SIZE / 2 + 0.5;
        const wy = pos.y + 0.5;
        const wz = pos.z - SIZE / 2 + 0.5;
        slot.edgeMat.color.set(edgeColor);
        slot.frame.position.set(wx, wy, wz);
        slot.frame.visible = true;
        if (activeTool === 'place') {
          slot.ghostMat.color.set(MATERIALS[material]);
          slot.ghostMat.opacity = material === 'glass' ? 0.3 : 0.44;
          slot.ghost.position.set(wx, wy, wz);
          slot.ghost.visible = true;
        }
      });
    }
    draw();
  }

  function movedTooFar(event) {
    return Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10;
  }

  function hidePreview() {
    if (!hidePreviewSlots()) return;
    draw();
  }

  function cancelGesture() {
    gesture = null;
    drag = null;
    hidePreview();
  }

  function clearContacts() {
    contacts.clear();
    cancelGesture();
  }

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && gesture?.pointerType === 'touch' && gesture.id !== event.pointerId) {
      cancelGesture();
    }
  }, { capture: true });

  canvas.addEventListener('pointerdown', (event) => {
    if (contextLost || turnFrame !== null || ![0, 1, 2].includes(event.button) || contacts.size >= 2) return;
    if (event.button === 1) event.preventDefault();
    if (!event.isPrimary && (event.pointerType !== 'touch' || contacts.size === 0)) return;
    const point = { x: event.clientX, y: event.clientY, pointerType: event.pointerType, button: event.button };
    if (contacts.size && (point.pointerType !== 'touch' || contacts.values().next().value.pointerType !== 'touch')) return;
    contacts.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    if (contacts.size === 1) {
      const panDrag = event.pointerType === 'mouse' && (event.button === 1 || event.button === 2 || event.shiftKey);
      const clickTool = event.pointerType === 'mouse'
        ? (event.button === 2 ? 'remove' : (event.button === 1 || event.altKey ? 'pick' : null))
        : null;
      gesture = { id: event.pointerId, ...point, panDrag, clickTool };
      if (event.button === 0 && !panDrag) preview(event);
    } else {
      cancelGesture();
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (contextLost || turnFrame !== null) return;
    const previous = contacts.get(event.pointerId);
    if (!previous) {
      if (event.pointerType === 'mouse' && event.buttons === 0) preview(event);
      return;
    }
    const next = { ...previous, x: event.clientX, y: event.clientY };
    contacts.set(event.pointerId, next);
    if (contacts.size === 2) {
      const other = [...contacts.entries()].find(([id]) => id !== event.pointerId)[1];
      const length = Math.hypot(previous.x - other.x, previous.y - other.y);
      if (length < 1) return;
      zoomAt(Math.hypot(next.x - other.x, next.y - other.y) / length,
        { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 },
        { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 });
      return;
    }
    if (gesture) {
      if (!movedTooFar(event)) return;
      drag = { id: event.pointerId, pan: gesture.panDrag };
      gesture = null;
      hidePreview();
    }
    if (drag?.id === event.pointerId && drag.pan) {
      zoomAt(1, previous, next);
    } else {
      angle = (angle - (next.x - previous.x) * 0.012) % (Math.PI * 2);
      elevation = Math.max(-elevationLimit, Math.min(elevationLimit, elevation + (next.y - previous.y) * 0.01));
      updateView();
    }
  });
  function edit(cell, activeTool = tool) {
    statusNoticeKey = '';
    if (activeTool !== 'pick') pickedMaterial = null;
    if (!cell) {
      if (activeTool === 'pick') pickedMaterial = null;
      renderStatus();
      return;
    }
    if (activeTool === 'pick') {
      if (cell.material) {
        selectMaterial(cell.material);
        selectTool('place');
        pickedMaterial = cell.material;
        blocked = false;
        editFeedback(cell.material, false);
        renderStatus();
      }
      return;
    }
    const targets = mirrorPositions(cell, activeSymmetry());
    if (activeTool === 'remove') {
      const changes = applyBatchRemove(blocks, targets);
      blocked = false;
      if (changes.length) {
        history.push(changes);
        syncBlocks(new Set(changes.map((c) => c.before)));
        if (!practice) projects.edited();
        editFeedback(changes[0].before, true);
        showDebris(changes[0], changes[0].before, true);
        updateHistoryButtons();
      }
      renderStatus();
      return;
    }
    const changes = applyBatchPlace(blocks, targets, material);
    blocked = !changes.length;
    if (changes.length) {
      history.push(changes);
      syncBlocks(material);
      if (!practice) projects.edited();
      editFeedback(material, false);
      showDebris(changes[0], material, false);
      updateHistoryButtons();
    }
    renderStatus();
  }

  function applyHistoryStep(isUndo) {
    if (contextLost || turnFrame !== null) return false;
    const result = isUndo ? history.undo(blocks) : history.redo(blocks);
    if (!result) return false;
    blocked = false;
    pickedMaterial = null;
    statusNoticeKey = '';
    syncBlocks(result.materials);
    if (!practice) projects.edited();
    const sample = result.changes[0];
    const soundMaterial = sample.after || sample.before || material;
    const removing = isUndo ? sample.before === null : sample.after === null;
    editFeedback(soundMaterial, removing);
    updateHistoryButtons();
    renderStatus();
    hidePreviewSlots();
    draw();
    return true;
  }

  canvas.addEventListener('pointerup', (event) => {
    contacts.delete(event.pointerId);
    if (drag?.id === event.pointerId) drag = null;
    if (gesture?.id !== event.pointerId) {
      if (event.pointerType === 'mouse' && event.buttons === 0) preview(event);
      return;
    }
    const activeTool = gesture.clickTool || (event.altKey ? 'pick' : tool);
    const cell = movedTooFar(event) ? null : pick(event, activeTool);
    gesture = null;
    edit(cell, activeTool);
    if (event.pointerType === 'mouse') {
      preview(event);
    } else {
      hidePreviewSlots();
      draw();
    }
  });
  function cancelPointer(event) {
    contacts.delete(event.pointerId);
    if (drag?.id === event.pointerId) drag = null;
    if (gesture?.id === event.pointerId) cancelGesture();
  }
  canvas.addEventListener('keydown', (event) => {
    if (contextLost || turnFrame !== null || event.ctrlKey || event.metaKey || event.altKey) return;
    const dx = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const dy = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    const bounds = canvas.getBoundingClientRect();
    const point = {
      x: bounds.left + keyboardPoint.x * bounds.width,
      y: bounds.top + keyboardPoint.y * bounds.height,
    };
    if (dx || dy) {
      if (event.shiftKey) {
        angle = (angle - dx * 0.12) % (Math.PI * 2);
        elevation = Math.max(-elevationLimit, Math.min(elevationLimit, elevation + dy * 0.1));
        updateView();
      } else {
        const step = Math.max(3, bounds.width * camera.zoom / ((camera.right - camera.left) * 3));
        keyboardPoint.x = Math.max(0.01, Math.min(0.99, keyboardPoint.x + dx * step / bounds.width));
        keyboardPoint.y = Math.max(0.01, Math.min(0.99, keyboardPoint.y + dy * step / bounds.height));
        point.x = bounds.left + keyboardPoint.x * bounds.width;
        point.y = bounds.top + keyboardPoint.y * bounds.height;
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) edit(pick({ clientX: point.x, clientY: point.y }));
    } else if (['+', '=', '-'].includes(event.key)) {
      zoomAt(event.key === '-' ? 1 / 1.2 : 1.2, point);
    } else {
      return;
    }
    event.preventDefault();
    preview({ clientX: point.x, clientY: point.y });
  });
  canvas.addEventListener('blur', hidePreview);
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('lostpointercapture', cancelPointer);
  canvas.addEventListener('pointerleave', hidePreview);
  canvas.addEventListener('wheel', (event) => {
    if (contextLost || turnFrame !== null || event.ctrlKey) return;
    event.preventDefault();
    cancelGesture();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoomAt(Math.exp(-delta * 0.0015), { x: event.clientX, y: event.clientY });
  }, { passive: false });

  // Three.js 先恢复渲染资源，应用随后重画当前场景。
  canvas.addEventListener('webglcontextlost', () => {
    contextLost = true;
    cancelAnimationFrame(redrawFrame);
    cancelAnimationFrame(debrisFrame);
    debris.visible = false;
    if (turnFrame !== null) {
      cancelAnimationFrame(turnFrame);
      finishTurn();
    }
    clearContacts();
    for (const button of controls) button.disabled = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    redrawFrame = requestAnimationFrame(() => {
      contextLost = false;
      for (const button of controls) button.disabled = false;
      updateHistoryButtons();
      updateSymmetryButton();
      resize();
    });
  });

  for (const button of toolButtons) {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  }
  for (const button of materialButtons) {
    button.addEventListener('click', () => selectMaterial(button.dataset.material));
  }
  for (const button of turnButtons) {
    button.addEventListener('click', () => turn(Number(button.dataset.turn)));
  }
  undoButton?.addEventListener('click', () => applyHistoryStep(true));
  redoButton?.addEventListener('click', () => applyHistoryStep(false));
  symmetryButton?.addEventListener('click', cycleSymmetry);

  function resetView() {
    if (turnFrame !== null) {
      cancelAnimationFrame(turnFrame);
      finishTurn();
    }
    clearContacts();
    focus.copy(homeFocus);
    angle = defaultAngle;
    elevation = defaultElevation;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    updateView();
  }

  overview.addEventListener('click', () => { if (!contextLost) resetView(); });
  function updateHelp() {
    const active = Boolean(practice);
    workshop.toggleAttribute('data-tutorial', active);
    help.setAttribute('aria-pressed', String(active));
    help.dataset.i18n = active ? '退出教学' : '教学';
    help.dataset.i18nAttr = active ? 'aria-label:退出教学' : 'aria-label:小桥教学';
    help.setAttribute('aria-label', t(active ? '退出教学' : '小桥教学'));
    help.textContent = t(help.dataset.i18n);
    blueprint.hidden = !active;
    updateSymmetryButton();
  }

  try { tip.hidden = localStorage.getItem(tipKey) === '1'; } catch { tip.hidden = false; }
  dismissTip.addEventListener('click', (event) => {
    tip.hidden = true;
    if (practice) practice.tipHidden = true;
    try { localStorage.setItem(tipKey, '1'); } catch {}
    if (event.detail === 0) canvas.focus({ preventScroll: true });
  });

  function toggleTutorial() {
    if (turnFrame !== null) return;
    clearContacts();
    cancelAnimationFrame(debrisFrame);
    debris.visible = false;
    if (practice) {
      blocks = practice.blocks;
      history = practice.history;
      symmetry = practice.symmetry;
      focus.copy(practice.focus);
      angle = practice.angle;
      elevation = practice.elevation;
      camera.zoom = practice.zoom;
      tip.hidden = practice.tipHidden;
      practice = null;
    } else {
      practice = {
        blocks,
        history,
        symmetry,
        focus: focus.clone(),
        angle,
        elevation,
        zoom: camera.zoom,
        tipHidden: tip.hidden,
      };
      blocks = createPracticeWorld();
      history = createHistory(100);
      symmetry = 'off';
      focus.set(-0.5, 1.25, 2);
      angle = defaultAngle;
      elevation = defaultElevation;
      camera.zoom = 2;
      tip.hidden = false;
    }
    blocked = false;
    pickedMaterial = null;
    statusNoticeKey = '';
    camera.updateProjectionMatrix();
    updateHelp();
    updateHistoryButtons();
    syncBlocks();
    renderStatus();
    updateView();
  }

  help.addEventListener('click', toggleTutorial);
  finishTutorialButton?.addEventListener('click', () => {
    if (practice) toggleTutorial();
  });

  function exportImage() {
    if (contextLost) return;
    const wasGuides = [xGuide.visible, zGuide.visible];
    const wasSlots = previewSlots.map((slot) => ({ ghost: slot.ghost.visible, frame: slot.frame.visible }));
    const wasDebris = debris.visible;
    xGuide.visible = false;
    zGuide.visible = false;
    debris.visible = false;
    hidePreviewSlots();
    try {
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const rawName = (projects.getProjectName() || '').trim();
      const safeName = rawName.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 40) || 'block-workshop';
      link.download = `${safeName}.png`;
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      statusNoticeKey = '已导出作品图片。';
    } catch {
      statusNoticeKey = '导出图片失败，请稍后重试。';
    } finally {
      xGuide.visible = wasGuides[0];
      zGuide.visible = wasGuides[1];
      debris.visible = wasDebris;
      wasSlots.forEach((state, index) => {
        previewSlots[index].ghost.visible = state.ghost;
        previewSlots[index].frame.visible = state.frame;
      });
      draw();
      renderStatus();
    }
  }
  exportButton?.addEventListener('click', exportImage);

  document.addEventListener('keydown', (event) => {
    if (contextLost || turnFrame !== null) return;
    if (window.SiteData?.isDialogOpen() || window.GameKit?.isTutorialOpen() || libraryDialog?.open || namingDialog?.open) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && !event.isComposing) {
      const lower = event.key.toLowerCase();
      if (lower === 'z' && !event.shiftKey) {
        event.preventDefault();
        applyHistoryStep(true);
      } else if ((lower === 'z' && event.shiftKey) || lower === 'y') {
        event.preventDefault();
        applyHistoryStep(false);
      }
      return;
    }
    if (event.altKey || event.shiftKey || window.GameKit?.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
    const materialKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
    const materialIndex = materialKeys.indexOf(event.code);
    if (materialIndex >= 0 && materialButtons[materialIndex]) {
      event.preventDefault();
      selectMaterial(materialButtons[materialIndex].dataset.material);
      return;
    }
    if (event.code === 'KeyB') {
      event.preventDefault();
      selectTool('place');
    } else if (event.code === 'KeyX') {
      event.preventDefault();
      selectTool('remove');
    } else if (event.code === 'KeyI') {
      event.preventDefault();
      selectTool('pick');
    } else if (event.code === 'KeyM') {
      event.preventDefault();
      cycleSymmetry();
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      resetView();
    }
  });

  function renderSound() {
    const enabled = window.SiteData.getSound();
    sound.setAttribute('aria-pressed', String(enabled));
    sound.textContent = t('音效');
    sound.setAttribute('aria-label', t(enabled ? '音效已开启，点击关闭' : '音效已关闭，点击开启'));
  }
  sound.addEventListener('click', () => {
    window.SiteData.setSound(!window.SiteData.getSound());
    renderSound();
  });
  renderSound();

  window.GameKit.bindMobileLayout('block-workshop', document.querySelector('#workshop-immersive'), clearContacts,
    { portraitOnly: true, onRender(immersive) {
      const button = document.querySelector('#workshop-immersive');
      button.setAttribute('aria-label', t(immersive ? '退出沉浸' : '沉浸模式'));
      button.dataset.i18nAttr = immersive ? 'aria-label:退出沉浸' : 'aria-label:沉浸模式';
      button.dataset.i18n = immersive ? '退出' : '沉浸';
      button.textContent = t(button.dataset.i18n);
    } });

  const projects = bindProjects((nextBlocks, { resetHistory = true } = {}) => {
    blocks = nextBlocks;
    if (resetHistory) history.clear();
    blocked = false;
    pickedMaterial = null;
    statusNoticeKey = '';
    updateHistoryButtons();
    syncBlocks();
    renderStatus();
    resetView();
  }, {
    onClear() {
      const changes = applyClear(blocks);
      if (!changes.length) return false;
      history.push(changes);
      blocked = false;
      pickedMaterial = null;
      statusNoticeKey = '';
      syncBlocks();
      updateHistoryButtons();
      renderStatus();
      hidePreviewSlots();
      draw();
      projects.edited();
      return true;
    },
  });
  blocks = projects.blocks;

  document.addEventListener('theme:change', applyTheme);
  document.addEventListener('i18n:change', () => {
    renderStatus();
    renderBlueprint();
    updateHelp();
    updateSymmetryButton();
    renderSound();
  });
  updateHistoryButtons();
  updateSymmetryButton();
  syncBlocks();
  applyTheme();
  resize();
  new ResizeObserver(resize).observe(stage);
}
