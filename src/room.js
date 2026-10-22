import * as THREE from 'three';
import {portraits} from './portrait-assets.js';
import {drawPaper} from './documents.js';

/** Procedural room. The parent owns input events, the canvas, and the animation loop. */
export function createRoom({ canvas, onInteract = () => {}, onTarget = () => {} } = {}) {
  if (!canvas) throw new Error('createRoom requires a canvas');
  // Let construction errors propagate so the parent can offer its WebGL fallback.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#292d35');
  scene.fog = new THREE.FogExp2('#796b56', 0.022);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.06, 40);
  camera.rotation.order = 'YXZ';
  const targets = [];
  const colliders = [];
  const textures = new Set();
  const keys = new Set();
  const coins = [];
  const safes = [];
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const clock = { time: 0 };
  let yaw = 0, pitch = 0, disposed = false, currentTarget = null, lastTarget = '';
  const eyeHeight = 1.65, playerRadius = 0.25, reach = 3.15;
  const palette = { wood: '#80512f', darkWood: '#3e2b23', trim: '#b68a53', brass: '#d7ac55', plaster: '#c5b58e', ink: '#382f2b' };
  const materials = new Set();
  function mat(color, extra = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
    materials.add(material);
    return material;
  }
  const wood = mat(palette.wood), darkWood = mat(palette.darkWood), trim = mat(palette.trim);
  const brass = mat(palette.brass, { metalness: 0.7, roughness: 0.3 });
  const black = mat('#232b2f', { metalness: 0.35 });
  const plaster = mat(palette.plaster);
  const paper = mat('#eadbb4');
  const linen = mat('#596f68');
  function mesh(geometry, material, position, parent = scene) {
    const result = new THREE.Mesh(geometry, material);
    if (position) result.position.set(...position);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function box(w, h, d, material, position, parent) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, position, parent);
  }
  function cylinder(top, bottom, height, material, position, parent, segments = 12) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, position, parent);
  }
  function group(position = [0, 0, 0], parent = scene) {
    const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g;
  }
  function target(root, id, label) {
    root.userData.id = id;
    root.userData.targetId = id;
    root.userData.label = label;
    root.traverse(child => { child.userData.targetId = id; child.userData.id = id; child.userData.label = label; });
    targets.push(root);
    return root;
  }
  function collider(x, z, width, depth) {
    colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  }
  function texture(draw, width = 768, height = 768) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas textures are unavailable');
    draw(ctx, width, height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(t); return t;
  }
  function panel(w, h, map, position, parent = scene) {
    return mesh(new THREE.PlaneGeometry(w, h), mat('#ffffff', { map, roughness: 1 }), position, parent);
  }
  function textTexture(lines, bg = '#eddfb9', ink = '#352e29') {
    return texture((c, w, h) => {
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ae8b55'; c.lineWidth = 6; c.strokeRect(25, 25, w - 50, h - 50);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      lines.forEach((line, i) => {
        c.fillStyle = ink; c.font = `${i === 0 ? 'bold 66' : '45'}px Georgia, serif`;
        c.fillText(line, w / 2, h * (0.22 + i * 0.19), w - 75);
      });
    });
  }

  // Alternating boards, inset panels, and timber ribs make the room a real volume.
  const floorMats = ['#8d633e', '#97704a', '#a07850', '#88603e'].map(c => mat(c));
  box(10.4, 0.16, 10.4, darkWood, [0, -0.12, 0]);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 5; col++) {
      const z = -4.75 + row * 0.5;
      box(1.984, 0.06, 0.486, floorMats[(row * 3 + col) % 4], [-4 + col * 2, -0.015, z]);
    }
  }
  box(10.3, 4, 0.22, plaster, [0, 2, -5.1]);
  box(10.3, 4, 0.22, plaster, [0, 2, 5.1]);
  box(0.22, 4, 10, plaster, [-5.1, 2, 0]);
  box(0.22, 4, 10, plaster, [5.1, 2, 0]);
  box(10.3, 0.14, 10.3, mat('#534333'), [0, 4.08, 0]);
  for (const z of [-4.94, 4.94]) {
    box(10, 0.18, 0.12, darkWood, [0, 0.15, z]);
    box(10, 0.12, 0.16, trim, [0, 1.08, z]);
    box(10, 0.2, 0.2, darkWood, [0, 3.83, z]);
    for (let x = -4.5; x < 5; x += 1) box(0.055, 0.85, 0.055, trim, [x, 0.57, z]);
  }
  for (const x of [-4.94, 4.94]) {
    box(0.12, 0.18, 10, darkWood, [x, 0.15, 0]);
    box(0.14, 0.12, 10, trim, [x, 1.08, 0]);
    box(0.2, 0.2, 10, darkWood, [x, 3.83, 0]);
    for (const z of [-4.85, 0, 4.85]) box(0.22, 3.8, 0.22, darkWood, [x, 1.95, z]);
  }
  for (const z of [-3, 0, 3]) box(10, 0.25, 0.22, darkWood, [0, 3.87, z]);
  // Woven rug leaves broad walkways on all sides.
  box(4.5, 0.018, 4.1, mat('#496563'), [0, 0.027, 0.3]);
  for (const x of [-2.12, 2.12]) box(0.06, 0.005, 3.9, trim, [x, 0.04, 0.3]);
  for (const z of [-1.6, 2.2]) box(4.25, 0.005, 0.06, trim, [0, 0.04, z]);

  // Oil paintings carry the clues in ordinary scene details. Neither the
  // artwork nor its hover labels spells out the symbol/color combination.
  const portraitLoader = new THREE.TextureLoader();
  for (let i = 0; i < 4; i++) {
    const root = group([-3.3 + i * 2.2, 2.35, -4.84]);
    box(1.74, 2.05, 0.14, darkWood, [0, 0, 0], root);
    box(1.64, 1.95, 0.08, brass, [0, 0, 0.09], root);
    box(1.5, 1.81, 0.05, darkWood, [0, 0, 0.145], root);
    const artwork = portraitLoader.load(portraits[i].src, () => fit());
    artwork.colorSpace = THREE.SRGBColorSpace;
    artwork.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(artwork);
    // The artwork is fit to its original proportions when loaded, avoiding
    // stretched faces and keeping the natural shape of each hidden detail.
    const painting = panel(1.4, 1.71, artwork, [0, 0, 0.177], root);
    const fit = () => {
      if(disposed)return;
      const aspect=artwork.image.width/artwork.image.height;
      const width=Math.min(1.4,1.71*aspect),height=width/aspect;
      painting.geometry.dispose();
      painting.geometry=new THREE.PlaneGeometry(width,height);
    };
    if(artwork.image?.complete)fit();
    target(root, `portrait${i}`, portraits[i].title+' — inspect painting');
  }

  // A worn writing desk; the seven loose sheets are independent inspection targets.
  const desk = group([-3.15, 0, -1.8]);
  let deskSeed = 1739;
  const deskRandom = () => {
    deskSeed = (Math.imul(deskSeed, 1664525) + 1013904223) >>> 0;
    return deskSeed / 4294967296;
  };
  const deskGrain = texture((c, w, h) => {
    c.fillStyle = '#493022'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1100; i++) {
      const y = deskRandom() * h;
      c.strokeStyle = i % 3 ? 'rgba(21,12,8,0.19)' : 'rgba(183,130,75,0.17)';
      c.lineWidth = 0.4 + deskRandom() * 1.6;
      c.beginPath(); c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + deskRandom() * 16 - 8,
        w * 0.7, y + deskRandom() * 18 - 9, w, y + deskRandom() * 10 - 5);
      c.stroke();
    }
    for (let i = 0; i < 85; i++) {
      const x = deskRandom() * w, y = deskRandom() * h;
      c.strokeStyle = i % 4 ? 'rgba(198,154,98,0.23)' : 'rgba(13,8,5,0.5)';
      c.lineWidth = 0.5 + deskRandom();
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + 8 + deskRandom() * 100, y + deskRandom() * 5 - 2.5); c.stroke();
    }
  }, 1024, 512);
  const antiqueWood = mat('#bfa58d', { map: deskGrain, roughness: 0.86 });
  const wornEdge = mat('#715036', { map: deskGrain, roughness: 0.78 });
  const agedBrass = mat('#9c783f', { metalness: 0.72, roughness: 0.53 });
  box(2.45, 0.13, 1.25, antiqueWood, [0, 1.025, 0], desk);
  // Slightly varied board widths and ends preserve the original tabletop footprint.
  const boardWidths = [0.252, 0.267, 0.257, 0.269, 0.255];
  let boardZ = -0.66;
  boardWidths.forEach((depth, i) => {
    box(2.52 - (i % 2) * 0.012, 0.08, depth - 0.004, antiqueWood,
      [(i % 3 - 1) * 0.003, 1.11, boardZ + depth / 2], desk);
    boardZ += depth;
  });
  for (const z of [-0.642, 0.642]) box(2.51, 0.035, 0.026, wornEdge, [0, 1.075, z], desk);
  for (const x of [-1.244, 1.244]) box(0.026, 0.035, 1.28, wornEdge, [x, 1.075, 0], desk);
  // Transparent stains sit just above the wood, beneath the loose papers.
  const patina = texture((c, w, h) => {
    for (const [x, y, radius] of [[0.13, 0.24, 0.063], [0.82, 0.7, 0.055]]) {
      c.strokeStyle = 'rgba(22,12,6,0.28)'; c.lineWidth = 5;
      c.beginPath(); c.ellipse(x * w, y * h, radius * w, radius * h, 0, 0.18, 5.9); c.stroke();
      c.strokeStyle = 'rgba(175,133,83,0.18)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(x * w, y * h, radius * w + 4, radius * h + 2, 0, 0.4, 5.7); c.stroke();
    }
  }, 1024, 512);
  const stains = mesh(new THREE.PlaneGeometry(2.5, 1.3),
    mat('#ffffff', { map: patina, transparent: true, depthWrite: false }), [0, 1.151, 0], desk);
  stains.rotation.x = -Math.PI / 2;
  const legProfile = [[0.065, 0], [0.087, 0.045], [0.062, 0.11], [0.044, 0.19],
    [0.054, 0.39], [0.084, 0.48], [0.091, 0.54], [0.06, 0.62],
    [0.06, 0.73], [0.087, 0.78], [0.087, 0.99]];
  for (const x of [-1.04, 1.04]) for (const z of [-0.45, 0.45]) {
    mesh(new THREE.LatheGeometry(legProfile.map(([r, y]) => new THREE.Vector2(r, y)), 16),
      antiqueWood, [x, 0.025, z], desk);
    box(0.18, 0.15, 0.18, wornEdge, [x, 0.91, z], desk);
  }
  box(2.23, 0.23, 0.09, antiqueWood, [0, 0.91, -0.5], desk);
  for (const x of [-1.05, 1.05]) box(0.09, 0.24, 1, antiqueWood, [x, 0.9, 0], desk);
  box(2.2, 0.045, 0.09, wornEdge, [0, 0.73, 0.52], desk);
  for (const x of [-0.76, 0, 0.76]) {
    box(0.72, 0.29, 1.02, darkWood, [x, 0.875, 0], desk);
    box(0.69, 0.24, 0.055, antiqueWood, [x, 0.875, 0.537], desk);
    box(0.59, 0.16, 0.018, wornEdge, [x, 0.875, 0.571], desk);
    for (const dx of [-0.1, 0.1]) {
      cylinder(0.025, 0.025, 0.025, agedBrass, [x + dx, 0.9, 0.594], desk).rotation.x = Math.PI / 2;
    }
    mesh(new THREE.TorusGeometry(0.095, 0.012, 6, 20, Math.PI), agedBrass,
      [x, 0.9, 0.615], desk).rotation.z = Math.PI;
    cylinder(0.017, 0.017, 0.012, agedBrass, [x, 0.82, 0.592], desk).rotation.x = Math.PI / 2;
  }
  // A squat ink bottle and a single feather quill replace the modern pen cup.
  cylinder(0.065, 0.085, 0.12, black, [-1.055, 1.21, -0.43], desk, 16);
  cylinder(0.043, 0.046, 0.045, agedBrass, [-1.055, 1.292, -0.43], desk, 16);
  cylinder(0.032, 0.032, 0.006, mat('#110f12'), [-1.055, 1.317, -0.43], desk, 16);
  const quill = group([-1.055, 1.3, -0.43], desk);
  quill.rotation.z = -0.35; quill.rotation.x = -0.15;
  cylinder(0.004, 0.006, 0.45, mat('#beaa7e'), [0, 0.18, 0], quill, 6);
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, 0.1); featherShape.bezierCurveTo(-0.085, 0.2, -0.09, 0.36, 0.015, 0.49);
  featherShape.bezierCurveTo(0.09, 0.34, 0.07, 0.21, 0, 0.1);
  mesh(new THREE.ShapeGeometry(featherShape), mat('#d5c7aa', { side: THREE.DoubleSide }), [0, 0, 0], quill);
  // Register the furniture first: target() recursively tags existing children.
  target(desk, 'desk', 'Old writing desk — scattered papers');
  const paperLayout = [
    { x: -0.69, z: -0.23, y: 1.157, angle: -0.18, width: 0.46, height: 0.61 },
    { x: -0.22, z: -0.26, y: 1.160, angle: 0.13, width: 0.45, height: 0.59 },
    { x: 0.28, z: -0.26, y: 1.163, angle: -0.12, width: 0.46, height: 0.60 },
    { x: 0.67, z: 0.08, y: 1.175, angle: 0.17, width: 0.45, height: 0.61 },
    { x: -0.83, z: 0.27, y: 1.166, angle: 0.22, width: 0.44, height: 0.58 },
    { x: -0.34, z: 0.25, y: 1.169, angle: -0.15, width: 0.46, height: 0.60 },
    { x: 0.16, z: 0.29, y: 1.172, angle: 0.09, width: 0.43, height: 0.58 },
  ];
  paperLayout.forEach(({x, y, z, angle, width, height}, index) => {
    const sheet = group([x, y, z], desk);
    sheet.rotation.y = angle;
    box(width, 0.002, height, paper, [0, -0.0015, 0], sheet);
    const face = panel(width, height,
      texture((ctx, w, h) => drawPaper(ctx, w, h, index), 512, 700), [0, 0, 0], sheet);
    face.rotation.x = -Math.PI / 2;
    target(sheet, `paper${index}`, 'Loose paper — inspect');
  });
  collider(-3.15, -1.8, 2.52, 1.32);
  const chair = group([-3.1, 0, 0.08]);
  box(0.85, 0.13, 0.85, wood, [0, 0.57, 0], chair);
  box(0.76, 0.09, 0.75, linen, [0, 0.67, 0], chair);
  for (const x of [-0.33, 0.33]) for (const z of [-0.32, 0.32]) box(0.1, 0.58, 0.1, darkWood, [x, 0.29, z], chair);
  for (const x of [-0.33, 0.33]) box(0.1, 1.25, 0.1, wood, [x, 0.95, 0.36], chair);
  for (const y of [1.05, 1.35]) box(0.75, 0.17, 0.1, wood, [0, y, 0.36], chair);
  const legend = panel(0.55, 0.48, textTexture(['DECODING KEY', 'Symbols → colors', 'Unfold to reveal']), [0, 0.741, -0.08], chair);
  legend.rotation.x = -Math.PI / 2;
  box(0.012, 0.018, 0.48, trim, [0, 0.745, -0.08], chair);
  target(chair, 'chair', 'Chair — folded decoding legend');
  collider(-3.1, 0.08, 0.85, 0.85);

  // Bookshelf on the left wall, deliberately open and shallow.
  const shelf = group([-4.58, 0, 2.7]);
  for (const z of [-0.95, 0.95]) box(0.67, 2.85, 0.12, darkWood, [0, 1.425, z], shelf);
  box(0.08, 2.85, 2, wood, [-0.31, 1.425, 0], shelf);
  for (const y of [0.12, 0.93, 1.76, 2.66, 2.87]) box(0.72, 0.1, 2.08, trim, [0, y, 0], shelf);
  const bookMats = ['#546b61', '#a76d4e', '#475f7a', '#926c78', '#c5a66b'].map(c => mat(c));
  for (let level = 0; level < 3; level++) for (let j = 0; j < 9; j++) {
    if (level === 1 && j > 5) continue;
    const h = 0.44 + ((j * 3 + level) % 4) * 0.065;
    box(0.39, h, 0.12, bookMats[(j + level) % 5], [0.04, [0.17, 0.98, 1.81][level] + h / 2, -0.8 + j * 0.18], shelf);
    box(0.006, 0.025, 0.105, brass, [0.239, [0.17, 0.98, 1.81][level] + 0.12, -0.8 + j * 0.18], shelf);
  }
  collider(-4.58, 2.7, 0.72, 2.08);
  function barrel(x, z, scale = 1) {
    const g = group([x, 0, z]);
    cylinder(0.39 * scale, 0.4 * scale, 0.96 * scale, wood, [0, 0.48 * scale, 0], g, 14);
    for (const y of [0.12, 0.46, 0.83]) cylinder(0.414 * scale, 0.414 * scale, 0.065 * scale, black, [0, y * scale, 0], g, 14);
    cylinder(0.37 * scale, 0.37 * scale, 0.04, trim, [0, 0.97 * scale, 0], g, 14);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      box(0.014, 0.87 * scale, 0.016, darkWood, [Math.sin(a) * 0.399 * scale, 0.48 * scale, Math.cos(a) * 0.399 * scale], g);
    }
    collider(x, z, 0.85 * scale, 0.85 * scale);
    return g;
  }
  barrel(3.83, 3.83); barrel(4.35, 2.7, 0.78);

  function makeSafe(n, z) {
    const root = group([4.13, 0, z]); root.rotation.y = -Math.PI / 2;
    box(1.18, 0.16, 1.05, darkWood, [0, 0.13, 0], root);
    const shell = mat('#455359', { metalness: 0.6, roughness: 0.46 });
    box(1.07, 0.98, 0.08, shell, [0, 0.71, -0.45], root);
    for (const x of [-0.5, 0.5]) box(0.1, 1.02, 0.94, shell, [x, 0.71, 0], root);
    for (const y of [0.24, 1.18]) box(1.08, 0.1, 0.94, shell, [0, y, 0], root);
    box(0.9, 0.85, 0.03, black, [0, 0.71, -0.39], root);
    const hinge = group([-0.48, 0.71, 0.5], root);
    box(0.97, 0.9, 0.12, shell, [0.48, 0, 0], hinge);
    box(0.8, 0.73, 0.025, black, [0.48, 0, 0.07], hinge);
    const dial = cylinder(0.12, 0.12, 0.06, brass, [0.5, 0.04, 0.12], hinge, 20); dial.rotation.x = Math.PI / 2;
    box(0.05, 0.25, 0.06, brass, [0.75, -0.05, 0.13], hinge);
    panel(0.46, 0.18, textTexture([`SAFE 0${n}`]), [0.46, 0.29, 0.089], hinge);
    const key = group([0, 0.5, -0.2], root);
    const ring = mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 16), brass, [0, 0.14, 0], key);
    ring.rotation.x = -0.25;
    box(0.035, 0.23, 0.035, brass, [0, -0.01, 0], key);
    box(0.09, 0.035, 0.035, brass, [0.03, -0.1, 0], key);
    key.visible = false;
    safes.push({ root, hinge, key, angle: 0, open: false });
    target(root, `safe${n}`, `Safe ${n} — locked combination safe`);
    collider(4.13, z, 1.2, 1.22);
  }
  makeSafe(1, -1.8); makeSafe(2, 0.3);

  const door = group([1.2, 0, 4.88]); door.rotation.y = Math.PI;
  box(1.82, 2.94, 0.17, darkWood, [0, 1.47, 0], door);
  box(1.53, 2.72, 0.12, wood, [0, 1.38, 0.12], door);
  for (const x of [-0.79, 0.79]) box(0.12, 2.87, 0.2, trim, [x, 1.44, 0.18], door);
  for (const y of [0.68, 1.84]) {
    box(1.25, 0.94, 0.04, darkWood, [0, y, 0.2], door);
    box(1.12, 0.81, 0.045, wood, [0, y, 0.23], door);
  }
  box(0.16, 0.36, 0.05, brass, [0.55, 1.25, 0.25], door);
  mesh(new THREE.SphereGeometry(0.065, 12, 8), brass, [0.55, 1.3, 0.32], door);
  panel(1.35, 0.29, textTexture(['TO FREEDOM']), [0, 2.51, 0.2], door);
  target(door, 'door', 'Exit door — the path to freedom');

  // Cool window light balances the amber brass lamps.
  const windowRoot = group([-4.86, 2.45, -2.9]); windowRoot.rotation.y = Math.PI / 2;
  box(1.55, 1.75, 0.14, darkWood, [0, 0, 0], windowRoot);
  const glass = mat('#adc8cf', { emissive: '#8dafc4', emissiveIntensity: 0.65, roughness: 0.4 });
  box(1.34, 1.54, 0.03, glass, [0, 0, 0.09], windowRoot);
  for (const x of [-0.68, 0, 0.68]) box(0.055, 1.65, 0.08, trim, [x, 0, 0.14], windowRoot);
  box(1.4, 0.055, 0.08, trim, [0, 0, 0.14], windowRoot);
  box(1.8, 0.09, 0.32, trim, [0, -0.89, 0.12], windowRoot);
  function lamp(x, z) {
    const g = group([x, 2.8, z]);
    box(0.13, 0.45, 0.15, darkWood, [0, 0, -0.08], g);
    cylinder(0.2, 0.29, 0.3, brass, [0, 0.05, 0.16], g);
    cylinder(0.14, 0.14, 0.27, mat('#ffe5a4', { emissive: '#ffd080', emissiveIntensity: 2 }), [0, -0.21, 0.16], g);
    cylinder(0.22, 0.16, 0.07, brass, [0, -0.39, 0.16], g);
    const light = new THREE.PointLight('#ffd798', 17, 8, 2); light.position.set(0, -0.3, 0.4); g.add(light);
  }
  lamp(-4.52, -4.75); lamp(4.52, -4.75);
  scene.add(new THREE.HemisphereLight('#dceaf4', '#92704d', 2.05));
  const sun = new THREE.DirectionalLight('#ffe4b9', 2.6);
  sun.position.set(-3, 3.6, 1); sun.target.position.set(1, 0, -2);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 18 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const fill = new THREE.PointLight('#bddcf6', 23, 10, 2); fill.position.set(-4, 2.6, -2.8); scene.add(fill);
  const overhead = new THREE.PointLight('#ffe0ac', 28, 11, 2); overhead.position.set(0, 3.4, 1); scene.add(overhead);
  cylinder(0.3, 0.53, 0.23, brass, [0, 3.5, 1]);
  cylinder(0.025, 0.025, 0.4, darkWood, [0, 3.8, 1]);

  const coinMaterial = mat('#ffcf58', { metalness: 0.8, roughness: 0.23, emissive: '#8f5810', emissiveIntensity: 0.16 });
  const coinLocations = [[-2.10, 1.32, -1.39], [-3.1, 0.89, -0.1], [-4.12, 1.18, 3.28], [3.83, 1.15, 3.83], [0.95, 0.18, -2.5]];
  coinLocations.forEach((position, i) => {
    const root = group(position);
    const disc = cylinder(0.135, 0.135, 0.038, coinMaterial, [0, 0, 0], root, 24);
    disc.rotation.x = Math.PI / 2;
    for (const z of [-0.023, 0.023]) {
      mesh(new THREE.TorusGeometry(0.106, 0.009, 5, 24), brass, [0, 0, z], root);
      box(0.015, 0.115, 0.008, brass, [0, 0, z * 1.1], root);
      box(0.07, 0.012, 0.008, brass, [0, 0.025, z * 1.1], root);
    }
    target(root, `coin${i}`, `Gold coin ${i + 1} — ${['on the desk', 'on the chair', 'on the bookshelf', 'on the barrel', 'on the floor'][i]}`);
    coins.push({ root, baseY: position[1], collected: false });
  });
  // Deterministic floating dust, kept out of all interaction raycasts.
  const dustPositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    dustPositions[i * 3] = Math.sin(i * 127.1) * 4.7;
    dustPositions[i * 3 + 1] = 0.3 + ((i * 0.618034) % 1) * 3.3;
    dustPositions[i * 3 + 2] = Math.sin(i * 311.7) * 4.7;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({ color: '#ffe9b9', size: 0.018, transparent: true, opacity: 0.38, depthWrite: false });
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.raycast = () => {}; scene.add(dust);

  function visible(object) {
    for (let p = object; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  function pick() {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    raycaster.setFromCamera(center, camera);
    raycaster.far = reach;
    const hits = raycaster.intersectObjects(scene.children, true);
    // The first visible surface wins, including non-interactive furniture and walls.
    const hit = hits.find(h => h.object.isMesh && visible(h.object));
    if (!hit || !hit.object.userData.targetId) return null;
    const id = hit.object.userData.targetId;
    const root = targets.find(t => t.userData.id === id);
    return root ? { id, label: root.userData.label, distance: hit.distance } : null;
  }
  function reportTarget(force = false) {
    currentTarget = pick();
    const signature = currentTarget ? `${currentTarget.id}:${currentTarget.distance.toFixed(2)}` : '';
    if (force || signature !== lastTarget) {
      lastTarget = signature;
      onTarget(currentTarget ? { ...currentTarget } : null);
    }
  }
  function blocked(x, z) {
    if (x < -4.75 || x > 4.75 || z < -4.75 || z > 4.75) return true;
    return colliders.some(c => {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      return (x - nx) ** 2 + (z - nz) ** 2 < playerRadius ** 2;
    });
  }
  function move(dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 0; i < steps; i++) {
      const x = camera.position.x + dx / steps;
      if (!blocked(x, camera.position.z)) camera.position.x = x;
      const z = camera.position.z + dz / steps;
      if (!blocked(camera.position.x, z)) camera.position.z = z;
    }
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const height = Math.max(1, canvas.clientHeight || canvas.height || 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function setLook(dx, dy) {
    if (disposed) return;
    yaw -= (Number.isFinite(dx) ? dx : 0) * 0.0025;
    pitch = THREE.MathUtils.clamp(pitch - (Number.isFinite(dy) ? dy : 0) * 0.0025, -1.25, 1.25);
    camera.rotation.set(pitch, yaw, 0);
  }
  function setKey(code, pressed) { if (pressed) keys.add(code); else keys.delete(code); }
  function update(dt, enabled = true) {
    if (disposed) return;
    dt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    clock.time += dt;
    if (enabled) {
      yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * dt * 1.55;
      pitch = THREE.MathUtils.clamp(pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * dt, -1.25, 1.25);
      camera.rotation.set(pitch, yaw, 0);
      let forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      let right = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const length = Math.hypot(forward, right) || 1;
      forward /= length; right /= length;
      move((right * Math.cos(yaw) - forward * Math.sin(yaw)) * dt * 2.5,
        (-forward * Math.cos(yaw) - right * Math.sin(yaw)) * dt * 2.5);
    } else {
      keys.clear();
    }
    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];
      coin.root.rotation.y = clock.time * 0.65 + i * 0.7;
      coin.root.position.y = coin.baseY + Math.sin(clock.time * 1.8 + i) * 0.025;
    }
    for (const safe of safes) {
      safe.angle = THREE.MathUtils.damp(safe.angle, safe.open ? -1.8 : 0, 7, dt);
      safe.hinge.rotation.y = safe.angle;
    }
    dust.rotation.y = Math.sin(clock.time * 0.04) * 0.035;
    reportTarget();
    renderer.render(scene, camera);
  }
  function interact() {
    if (disposed) return;
    reportTarget();
    if (currentTarget) onInteract(currentTarget.id);
  }
  function setCollected(id) {
    const coin = coins.find(c => c.root.userData.id === id);
    if (coin) { coin.collected = true; coin.root.visible = false; reportTarget(true); }
  }
  function setSafeOpen(n) {
    const index = typeof n === 'string' && n.startsWith('safe') ? Number(n.slice(4)) : Number(n);
    const safe = safes[index - 1];
    if (!safe) return;
    safe.open = true; safe.key.visible = true;
    const label = `Safe ${index} — open, a golden key inside`;
    safe.root.traverse(child => { child.userData.label = label; });
    reportTarget(true);
  }
  function reset() {
    keys.clear(); yaw = 0; pitch = 0; clock.time = 0;
    camera.position.set(0, eyeHeight, 1.8); camera.rotation.set(0, 0, 0);
    coins.forEach(c => { c.collected = false; c.root.visible = true; c.root.position.y = c.baseY; });
    safes.forEach((s, i) => {
      s.open = false; s.angle = 0; s.hinge.rotation.y = 0; s.key.visible = false;
      s.root.traverse(child => { child.userData.label = `Safe ${i + 1} — locked combination safe`; });
    });
    currentTarget = null; lastTarget = ''; onTarget(null);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; keys.clear(); onTarget(null);
    const geometries = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
    geometries.forEach(g => g.dispose());
    textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
    dustMaterial.dispose(); sun.shadow.dispose(); renderer.dispose();
    scene.clear();
  }
  reset(); resize(); renderer.render(scene, camera);
  return { update, resize, setKey, setLook, interact, setCollected, setSafeOpen, reset, dispose, camera, scene, renderer, targets, colliders };
}
