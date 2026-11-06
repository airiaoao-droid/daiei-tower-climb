import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG, PIXEL_RATIO, type Quality } from '../game/config';
import {
  getCourseRow,
  laneToX,
  moduleY,
  movingLoadX,
  type GameState,
  type ItemType,
} from '../game/simulation';

export interface Telemetry {
  fps: number;
  calls: number;
  geometries: number;
  modules: number;
}

interface PooledRowVisual {
  group: THREE.Group;
  beamLowNodes: THREE.Object3D[];
  beamHighNodes: THREE.Object3D[];
  missingNodes: THREE.Object3D[];
  movingLoadGroup: THREE.Group;
  coinMeshes: THREE.Mesh[];
  itemMesh: THREE.Mesh;
}

const POOLED_ROW_COUNT = 11;

// Visuals only. Models can be replaced without changing fixed-step state or input rules.
export class TowerScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(49, 1, 0.1, 240);
  private modules: THREE.Group[] = [];
  private rowPool: PooledRowVisual[] = [];
  private character = new THREE.Group();
  private characterFallback = new THREE.Group();
  private characterGlbRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animActions: { climb?: THREE.AnimationAction; idle?: THREE.AnimationAction } = {};
  private currentAnim: 'climb' | 'idle' | null = null;
  private lastAnimTime = 0;
  private auraRing!: THREE.Mesh;
  private pickupRing!: THREE.Mesh;
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private city = new THREE.Group();
  private earthHorizon!: THREE.Mesh;
  private bgPlanes: THREE.Mesh[] = [];
  private spaceDome!: THREE.Mesh;
  private stars: THREE.Points;
  private windParticles: THREE.Points;
  private meteors: THREE.Mesh[] = [];
  private flag: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private resizeObserver: ResizeObserver;
  private quality: Quality;
  private sky = new THREE.Color();
  private palette = [0x1b2f3d, 0x3b6e8c, 0x9e4f47, 0x090f24].map(c => new THREE.Color(c));
  private box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private sphere = this.geometry(new THREE.SphereGeometry(1, 16, 12));
  private cylinder = this.geometry(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 6));
  private plane = this.geometry(new THREE.PlaneGeometry(1, 1));
  private torus = this.geometry(new THREE.TorusGeometry(0.68, 0.06, 8, 24));
  private steel = this.material(0x526d77, 0.65);
  private silver = this.material(0xa4b5b8, 0.55);
  private orange = this.material(0xef743f);
  private hazardYellow = this.material(0xf6be4f, 0.25);
  private dangerRed = this.material(0xe54b4b, 0.2);
  private gold = this.material(0xffcf48, 0.75);
  private cream = this.material(0xffe6b0);
  private navy = this.material(0x203843);
  private itemMaterials: Record<ItemType, THREE.MeshStandardMaterial> = {
    magnet: this.material(0x45d9ff, 0.4),
    double: this.material(0xffc940, 0.5),
    slow: this.material(0xb57cff, 0.4),
    high_jump: this.material(0x4ce08a, 0.4),
  };
  private frames = 0;
  private sampleTime = 0;
  private fps = 0;
  private disposed = false;

  constructor(private host: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', '3レーンの鉄塔を下から上へ登る3D画面');
    this.renderer.domElement.setAttribute('role', 'img');
    host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x1b2f3d, 64, 175);
    this.scene.add(new THREE.HemisphereLight(0xf3f7ff, 0x657f78, 2.7));
    this.sun = new THREE.DirectionalLight(0xffddb2, 3.2);
    this.sun.position.set(-18, 28, 24);
    this.scene.add(this.sun);

    this.makeBackgroundLayers();

    for (let i = 0; i < CONFIG.moduleCount; i++) {
      const group = this.makeModule(i);
      this.modules.push(group);
      this.scene.add(group);
    }

    for (let i = 0; i < POOLED_ROW_COUNT; i++) {
      const rowVis = this.makePooledRow();
      this.rowPool.push(rowVis);
      this.scene.add(rowVis.group);
    }

    this.makeCharacter();
    this.scene.add(this.character);
    this.makeCity();
    this.scene.add(this.city);

    const earthMat = this.material(0x2868a8, 0.15);
    this.earthHorizon = this.mesh(this.scene, this.sphere, earthMat, [0, -78, -95], [120, 42, 42]);
    this.earthHorizon.visible = false;

    const cloudMaterial = this.material(0xf4eee2);
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        this.mesh(cloud, this.sphere, cloudMaterial, [j * 3, Math.sin(j * 2) * 0.7, 0], [3.6, 1.25, 2]);
      }
      cloud.position.set((i % 2 ? -1 : 1) * (12 + (i % 4) * 5), i * 9 - 30, -16 - (i % 3) * 9);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }

    const starPositions = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      starPositions[i * 3] = Math.sin(i * 127.1) * 95;
      starPositions[i * 3 + 1] = Math.cos(i * 311.7) * 95;
      starPositions[i * 3 + 2] = -70 - (i % 40);
    }
    const starGeo = this.geometry(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffefdb, size: 0.28, transparent: true, opacity: 0 });
    this.materials.add(starMat);
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);

    // Shooting stars / meteors in space stage (>500m)
    const meteorMat = this.material(0xffffff);
    for (let i = 0; i < 3; i++) {
      const m = this.mesh(this.scene, this.box, meteorMat, [0, 0, -55], [2.4, 0.08, 0.08]);
      m.rotation.z = -0.35;
      m.visible = false;
      this.meteors.push(m);
    }

    // Wind particle streaks
    const windPos = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      windPos[i * 3] = ((i * 19) % 24) - 12;
      windPos[i * 3 + 1] = ((i * 13) % 28) - 4;
      windPos[i * 3 + 2] = 2.6 + (i % 3) * 0.4;
    }
    const windGeo = this.geometry(new THREE.BufferGeometry());
    windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
    const windMat = new THREE.PointsMaterial({ color: 0xe8fbff, size: 0.18, transparent: true, opacity: 0 });
    this.materials.add(windMat);
    this.windParticles = new THREE.Points(windGeo, windMat);
    this.scene.add(this.windParticles);

    this.flag = this.mesh(this.scene, this.box, this.orange, [4.95, 13, 1.5], [1.5, 0.8, 0.06]);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this.loadExternalAssets();
  }

  private geometry<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.add(g);
    return g;
  }

  private material(color: number, metalness = 0) {
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.58 });
    this.materials.add(mat);
    return mat;
  }

  private mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: number[],
    scale: number[]
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...(position as [number, number, number]));
    mesh.scale.set(...(scale as [number, number, number]));
    parent.add(mesh);
    return mesh;
  }

  private makeBackgroundLayers() {
    // 4 stage backdrop planes placed behind the tower & clouds
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.materials.add(mat);
      const planeMesh = this.mesh(
        this.scene,
        this.plane,
        mat,
        [0, 14, -88 - i * 0.5],
        [145, 145, 1]
      );
      planeMesh.visible = false;
      this.bgPlanes.push(planeMesh);
    }

    const domeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.materials.add(domeMat);
    this.spaceDome = this.mesh(this.scene, this.sphere, domeMat, [0, 8, -10], [150, 150, 150]);
    this.spaceDome.visible = false;
  }

  private loadExternalAssets() {
    if (typeof window === 'undefined') return;

    const texLoader = new THREE.TextureLoader();
    const bgPaths = [
      '/assets/images/bg_01_ground_1920x1080.png',
      '/assets/images/bg_02_bluesky_clouds_1920x1080.png',
      '/assets/images/bg_03_sunset_cloudsea_1920x1080.png',
      '/assets/images/bg_04_space_stars_1920x1080.png',
    ];
    bgPaths.forEach((path, idx) => {
      texLoader.load(
        path,
        tex => {
          if (this.disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          this.textures.add(tex);
          const planeMesh = this.bgPlanes[idx];
          if (planeMesh) {
            const mat = planeMesh.material as THREE.MeshBasicMaterial;
            mat.map = tex;
            mat.needsUpdate = true;
            planeMesh.visible = true;
          }
        },
        undefined,
        () => {}
      );
    });

    texLoader.load(
      '/assets/images/bg_04_space_stars_2048x1024.png',
      tex => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        this.textures.add(tex);
        const mat = this.spaceDome.material as THREE.MeshBasicMaterial;
        mat.map = tex;
        mat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    texLoader.load(
      '/assets/images/item_01_energy_coin_512x512.png',
      tex => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textures.add(tex);
        this.gold.map = tex;
        this.gold.color.setHex(0xffffff);
        this.gold.metalness = 0.35;
        this.gold.roughness = 0.35;
        this.gold.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    const gltfLoader = new GLTFLoader();

    // 1. Character 3D Model (chr_01_climber_rigged.glb)
    gltfLoader.load(
      '/assets/models/chr_01_climber_rigged.glb',
      gltf => {
        if (this.disposed) return;
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        model.scale.set(1.05, 1.05, 1.05);
        this.character.add(model);
        this.characterGlbRoot = model;
        this.characterFallback.visible = false;

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);
          const climbClip =
            THREE.AnimationClip.findByName(gltf.animations, 'Climb_Run_Loop') ?? gltf.animations[0];
          const idleClip =
            THREE.AnimationClip.findByName(gltf.animations, 'Idle_Ready_Loop') ?? gltf.animations[0];
          if (climbClip) {
            this.animActions.climb = this.mixer.clipAction(climbClip);
          }
          if (idleClip) {
            this.animActions.idle = this.mixer.clipAction(idleClip);
          }
          this.switchCharacterAnimation('idle');
        }
      },
      undefined,
      () => {}
    );

    // 2. Tower Base Section 3D Model (st_01_tower_base_10m.glb)
    gltfLoader.load(
      '/assets/models/st_01_tower_base_10m.glb',
      gltf => {
        if (this.disposed) return;
        const template = gltf.scene;
        for (const modGroup of this.modules) {
          const clone = template.clone(true);
          // Scale 10m tower section to seamlessly match the 8m module height and 3-lane width
          clone.position.set(0, 0, 0);
          clone.scale.set(2.2, 0.8, 1.1);
          modGroup.add(clone);
        }
      },
      undefined,
      () => {}
    );

    // 3. Obstacle 01: Broken Girder (obs_01_broken_girder.glb) -> beam_low & beam_high
    gltfLoader.load(
      '/assets/models/obs_01_broken_girder.glb',
      gltf => {
        if (this.disposed) return;
        const template = gltf.scene;
        for (const rowVis of this.rowPool) {
          for (let lane = 0; lane < 3; lane++) {
            const lowNode = rowVis.beamLowNodes[lane] as THREE.Group;
            lowNode.clear();
            const lowClone = template.clone(true);
            lowClone.scale.set(0.88, 0.95, 0.95);
            lowNode.add(lowClone);

            const highNode = rowVis.beamHighNodes[lane] as THREE.Group;
            highNode.clear();
            const highClone = template.clone(true);
            highClone.scale.set(0.92, 1.25, 1.05);
            highNode.add(highClone);
          }
        }
      },
      undefined,
      () => {}
    );

    // 4. Obstacle 02: High Voltage Coil (obs_02_high_voltage_coil.glb) -> missing_foothold hazard
    gltfLoader.load(
      '/assets/models/obs_02_high_voltage_coil.glb',
      gltf => {
        if (this.disposed) return;
        const template = gltf.scene;
        for (const rowVis of this.rowPool) {
          for (let lane = 0; lane < 3; lane++) {
            const missNode = rowVis.missingNodes[lane] as THREE.Group;
            missNode.clear();
            const coilClone = template.clone(true);
            coilClone.position.set(0, -0.35, 0.15);
            coilClone.scale.set(1.15, 0.88, 1.15);
            missNode.add(coilClone);
          }
        }
      },
      undefined,
      () => {}
    );

    // 5. Obstacle 03: Patrol Mine (obs_03_patrol_mine.glb) -> moving_load
    gltfLoader.load(
      '/assets/models/obs_03_patrol_mine.glb',
      gltf => {
        if (this.disposed) return;
        const template = gltf.scene;
        for (const rowVis of this.rowPool) {
          rowVis.movingLoadGroup.clear();
          const mineClone = template.clone(true);
          mineClone.position.set(0, 0.95, 2.95);
          mineClone.scale.set(1.08, 1.08, 1.08);
          rowVis.movingLoadGroup.add(mineClone);
        }
      },
      undefined,
      () => {}
    );
  }

  private switchCharacterAnimation(target: 'climb' | 'idle') {
    if (!this.mixer || this.currentAnim === target) return;
    const nextAction = this.animActions[target];
    const prevAction = this.currentAnim ? this.animActions[this.currentAnim] : undefined;
    if (nextAction) {
      nextAction.reset().fadeIn(0.15).play();
      if (prevAction && prevAction !== nextAction) {
        prevAction.fadeOut(0.15);
      }
      this.currentAnim = target;
    }
  }

  private makePooledRow(): PooledRowVisual {
    const group = new THREE.Group();
    group.visible = false;

    const beamLowNodes: THREE.Object3D[] = [];
    const beamHighNodes: THREE.Object3D[] = [];
    const missingNodes: THREE.Object3D[] = [];

    for (let lane = 0; lane < 3; lane++) {
      const lx = laneToX(lane);

      const lowGroup = new THREE.Group();
      lowGroup.position.set(lx, 0.32, 2.75);
      lowGroup.visible = false;
      this.mesh(lowGroup, this.box, this.orange, [0, 0, 0], [1.95, 0.36, 0.42]);
      group.add(lowGroup);
      beamLowNodes.push(lowGroup);

      const highGroup = new THREE.Group();
      highGroup.position.set(lx, 1.55, 2.85);
      highGroup.visible = false;
      this.mesh(highGroup, this.box, this.hazardYellow, [0, 0, 0], [2.05, 0.68, 0.48]);
      group.add(highGroup);
      beamHighNodes.push(highGroup);

      const missGroup = new THREE.Group();
      missGroup.position.set(lx, 0.05, 2.42);
      missGroup.visible = false;
      this.mesh(missGroup, this.box, this.dangerRed, [0, 0, 0], [1.55, 0.95, 0.22]);
      group.add(missGroup);
      missingNodes.push(missGroup);
    }

    const movingLoadGroup = new THREE.Group();
    this.mesh(movingLoadGroup, this.box, this.hazardYellow, [0, 0.85, 2.95], [1.75, 0.95, 0.72]);
    this.mesh(movingLoadGroup, this.box, this.steel, [0, 2.2, 2.95], [0.12, 1.8, 0.12]);
    movingLoadGroup.visible = false;
    group.add(movingLoadGroup);

    const coinMeshes: THREE.Mesh[] = [];
    for (let c = 0; c < 4; c++) {
      const coin = this.mesh(group, this.cylinder, this.gold, [0, 0.95, 2.85], [1, 1, 1]);
      coin.rotation.x = Math.PI / 2;
      coin.visible = false;
      coinMeshes.push(coin);
    }

    const itemMesh = this.mesh(group, this.sphere, this.itemMaterials.magnet, [0, 1.0, 2.9], [0.46, 0.46, 0.46]);
    itemMesh.visible = false;

    return {
      group,
      beamLowNodes,
      beamHighNodes,
      missingNodes,
      movingLoadGroup,
      coinMeshes,
      itemMesh,
    };
  }

  private makeModule(index: number) {
    const group = new THREE.Group();
    const beams: { a: number[]; b: number[]; width: number }[] = [];
    const beam = (a: number[], b: number[], width = 0.14) => beams.push({ a, b, width });
    for (const x of [-4, 4]) for (const z of [-2, 2]) beam([x, 0, z], [x, 8, z], 0.3);
    for (const z of [-2, 2]) {
      beam([-4, 0, z], [4, 0, z], 0.22);
      if (z === -2) {
        beam([-4, 0, z], [4, 8, z]);
        beam([4, 0, z], [-4, 8, z]);
      }
    }
    for (const x of [-4, 4]) {
      beam([x, 0, -2], [x, 8, 2]);
      beam([x, 0, 2], [x, 8, -2]);
      beam([x, 0, -2], [x, 0, 2], 0.22);
    }
    for (const lane of [-2.4, 0, 2.4]) {
      for (const offset of [-0.65, 0.65]) beam([lane + offset, 0, 2.3], [lane + offset, 8, 2.3], 0.09);
      for (let y = 0; y < 8; y += 0.5) beam([lane - 0.65, y, 2.36], [lane + 0.65, y, 2.36], 0.075);
    }
    const instanced = new THREE.InstancedMesh(this.box, this.steel, beams.length);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    beams.forEach(({ a, b, width }, i) => {
      const start = new THREE.Vector3(...(a as [number, number, number]));
      const end = new THREE.Vector3(...(b as [number, number, number]));
      const dir = end.clone().sub(start);
      dummy.position.copy(start).add(end).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      dummy.scale.set(width, dir.length(), width);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.computeBoundingSphere();
    group.add(instanced);
    for (const x of [-4, 4]) {
      this.mesh(group, this.box, index % 3 === 0 ? this.orange : this.silver, [x, 0.3, 2.1], [0.42, 0.6, 0.35]);
    }
    return group;
  }

  private makeCharacter() {
    this.character.add(this.characterFallback);
    this.mesh(this.characterFallback, this.sphere, this.orange, [0, 0.9, 0], [0.43, 0.58, 0.28]);
    this.mesh(this.characterFallback, this.box, this.navy, [0, 0.9, 0.26], [0.48, 0.65, 0.19]);
    this.mesh(this.characterFallback, this.box, this.cream, [0, 1, 0.37], [0.32, 0.1, 0.025]);
    this.mesh(this.characterFallback, this.sphere, this.cream, [0, 1.65, 0], [0.36, 0.33, 0.33]);
    this.mesh(this.characterFallback, this.sphere, this.orange, [0, 1.8, 0], [0.43, 0.28, 0.4]);
    this.mesh(this.characterFallback, this.box, this.orange, [0, 1.71, -0.2], [0.85, 0.07, 0.65]);

    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.39, 1.2, 0);
      this.characterFallback.add(arm);
      this.mesh(arm, this.sphere, this.orange, [side * 0.12, -0.24, 0], [0.15, 0.4, 0.15]);
      this.mesh(arm, this.sphere, this.navy, [side * 0.15, -0.55, 0], [0.16, 0.17, 0.17]);
      this.arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 0.23, 0.45, 0);
      this.characterFallback.add(leg);
      this.mesh(leg, this.sphere, this.navy, [0, -0.35, 0], [0.19, 0.42, 0.2]);
      this.mesh(leg, this.box, this.navy, [0, -0.67, -0.1], [0.31, 0.19, 0.45]);
      this.legs.push(leg);
    }

    this.auraRing = this.mesh(this.character, this.torus, this.itemMaterials.magnet, [0, 0.95, 0], [1, 1, 1]);
    this.auraRing.visible = false;
    this.pickupRing = this.mesh(this.character, this.torus, this.gold, [0, 1.0, 0.25], [1, 1, 1]);
    this.pickupRing.visible = false;
  }

  private makeCity() {
    const ground = this.material(0x7f9c79);
    const building = this.material(0xd0ceba);
    const roof = this.material(0x658887);
    this.mesh(this.city, this.box, ground, [0, -1, -30], [170, 1, 120]);
    for (let i = 0; i < 48; i++) {
      const x = ((i * 17) % 100) - 50;
      const z = -8 - ((i * 13) % 65);
      const height = 2 + (i % 7) * 1.3;
      this.mesh(this.city, this.box, i % 3 ? building : roof, [x, height / 2, z], [3 + (i % 3), height, 3]);
    }
    const tree = this.material(0x4f7c69);
    for (let i = 0; i < 20; i++) {
      this.mesh(this.city, this.sphere, tree, [Math.sin(i * 5) * 38, 1, -5 - i * 3], [2.3, 2.5, 2]);
    }
  }

  setQuality(quality: Quality) {
    this.quality = quality;
    this.resize();
  }

  private resize() {
    const { clientWidth: width, clientHeight: height } = this.host;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[this.quality]));
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    // Optimized for 9:16 portrait smartphone view so all 3 lanes fit with maximum vertical sightline
    const portrait = aspect < 0.75;
    this.camera.fov = portrait ? 54 : 49;
    const extraZ = portrait ? Math.max(0, (0.58 - aspect) * 20) : 0;
    this.camera.position.set(0, -2.6, (portrait ? 22.6 : 21) + extraZ);
    this.camera.lookAt(0, portrait ? 6.2 : 5.5, 0);
    this.camera.updateProjectionMatrix();
  }

  private renderCourseRows(state: GameState, altitudeMeters: number, tSeconds: number) {
    if (!state.hazardsEnabled) {
      for (const slot of this.rowPool) slot.group.visible = false;
      return;
    }

    const baseRow = Math.floor(state.altitudeMm / CONFIG.rowSpacingMm) - 1;
    for (let idx = 0; idx < POOLED_ROW_COUNT; idx++) {
      const slot = this.rowPool[idx];
      const rowIndex = baseRow + idx;
      if (rowIndex < 1) {
        slot.group.visible = false;
        continue;
      }

      const row = getCourseRow(state.courseSeed, rowIndex);
      const rowY = row.altitudeMm / 1000 - altitudeMeters;
      if (rowY < -18 || rowY > 98) {
        slot.group.visible = false;
        continue;
      }

      slot.group.visible = true;
      slot.group.position.set(0, rowY, 0);

      for (let l = 0; l < 3; l++) {
        slot.beamLowNodes[l].visible = false;
        slot.beamHighNodes[l].visible = false;
        slot.missingNodes[l].visible = false;
      }

      for (const obs of row.obstacles) {
        if (obs.type === 'beam_low') slot.beamLowNodes[obs.lane].visible = true;
        else if (obs.type === 'beam_high') slot.beamHighNodes[obs.lane].visible = true;
        else if (obs.type === 'missing_foothold') slot.missingNodes[obs.lane].visible = true;
      }

      if (row.movingLoad) {
        slot.movingLoadGroup.visible = true;
        slot.movingLoadGroup.position.x = movingLoadX(row.movingLoad, state.tick);
        slot.movingLoadGroup.position.y = Math.sin(tSeconds * 5 + rowIndex) * 0.12;
      } else {
        slot.movingLoadGroup.visible = false;
      }

      const isCurrentRow = rowIndex === state.lastProcessedRow;
      row.coins.forEach((coin, cIdx) => {
        const mesh = slot.coinMeshes[cIdx];
        if (!mesh) return;
        const collected = isCurrentRow && (state.collectedMask & (1 << (cIdx + 1))) !== 0;
        const passedAndCollected = rowIndex < state.lastProcessedRow && coin.lane === state.lane;
        mesh.visible = !collected && !passedAndCollected;
        if (mesh.visible) {
          let coinX = laneToX(coin.lane);
          const coinWorldY = rowY + coin.offsetMm / 1000;
          if (state.items.magnet > 0 && coinWorldY > -1.5 && coinWorldY < 7.5) {
            const pull = 1 - Math.max(0, Math.min(1, coinWorldY / 7.5));
            coinX = coinX + (state.x - coinX) * pull * 0.85;
          }
          mesh.position.set(coinX, 0.95 + coin.offsetMm / 1000, 2.88);
          mesh.rotation.z = tSeconds * 3.8 + cIdx;
        }
      });
      for (let cIdx = row.coins.length; cIdx < slot.coinMeshes.length; cIdx++) {
        slot.coinMeshes[cIdx].visible = false;
      }

      if (row.item && !(isCurrentRow && (state.collectedMask & 1) !== 0)) {
        slot.itemMesh.visible = true;
        slot.itemMesh.material = this.itemMaterials[row.item.type];
        slot.itemMesh.position.set(
          laneToX(row.item.lane),
          1.05 + row.item.offsetMm / 1000 + Math.sin(tSeconds * 4 + rowIndex) * 0.14,
          2.92
        );
        slot.itemMesh.rotation.y = tSeconds * 2.5;
      } else {
        slot.itemMesh.visible = false;
      }
    }
  }

  render(state: GameState, now: number) {
    const altitude = state.altitudeMm / 1000;
    this.modules.forEach((module, i) => (module.position.y = moduleY(i, altitude)));

    const t = state.tick / CONFIG.stepHz;
    const jumpTotal = state.items.high_jump > 0 ? CONFIG.highJumpSteps : CONFIG.jumpSteps;
    const jumpBoost = state.items.high_jump > 0 ? 1.55 : 1.0;
    const jump =
      state.motion === 'jump'
        ? Math.sin(Math.PI * (1 - state.motionSteps / jumpTotal)) * jumpBoost
        : 0;
    const slide =
      state.motion === 'slide' ? Math.sin(Math.PI * (1 - state.motionSteps / CONFIG.slideSteps)) : 0;
    const hitOffset = state.motion === 'hit' ? 0.55 : 0;

    this.character.position.set(
      state.x,
      Math.sin(t * 12) * 0.05 + jump * 0.72 - hitOffset * 0.35,
      3.15 + jump * 1.65 + hitOffset
    );
    this.character.scale.y = state.motion === 'land' ? 0.88 : 1 - slide * 0.45;
    this.character.rotation.x = state.motion === 'hit' ? 0.55 : 0;
    this.character.rotation.z = state.laneSteps
      ? -(state.lane - 1 - state.fromX / CONFIG.laneWidth) *
        Math.sin((state.laneSteps / CONFIG.laneChangeSteps) * Math.PI) *
        0.18
      : 0;

    // Update GLB animation mixer if loaded
    if (this.mixer) {
      const targetAnim = state.status === 'running' ? 'climb' : 'idle';
      this.switchCharacterAnimation(targetAnim);
      const dt = this.lastAnimTime > 0 ? Math.min(0.1, (now - this.lastAnimTime) / 1000) : 1 / 60;
      this.lastAnimTime = now;
      const speedScale = state.status === 'running' ? (state.items.slow > 0 ? 0.65 : 1.35) : 1.0;
      this.mixer.update(dt * speedScale);
    }

    // Active item aura ring
    const activeItemKey = (['high_jump', 'magnet', 'double', 'slow'] as const).find(
      k => state.items[k] > 0
    );
    if (activeItemKey) {
      this.auraRing.visible = true;
      this.auraRing.material = this.itemMaterials[activeItemKey];
      this.auraRing.rotation.z = t * 4;
    } else {
      this.auraRing.visible = false;
    }

    // Item pickup burst effect ring
    if (state.pickupEffectSteps > 0 && state.lastPickedItem) {
      const progress = 1 - state.pickupEffectSteps / CONFIG.itemPickupEffectSteps;
      const scale = 0.8 + progress * 1.45;
      this.pickupRing.visible = true;
      this.pickupRing.material = this.itemMaterials[state.lastPickedItem];
      this.pickupRing.scale.set(scale, scale, 1);
      this.pickupRing.rotation.z = -t * 6;
    } else {
      this.pickupRing.visible = false;
    }

    if (this.characterFallback.visible) {
      for (let i = 0; i < 2; i++) {
        this.arms[i].rotation.x =
          state.motion === 'climb' ? -1.7 + Math.sin(t * 8 + i * Math.PI) * 0.65 : -2.2 + slide;
        this.legs[i].rotation.x =
          state.motion === 'climb' ? Math.sin(t * 8 + i * Math.PI) * 0.5 : -jump * 0.6;
      }
    }

    this.renderCourseRows(state, altitude, t);

    this.city.position.y = -9 - altitude;
    this.city.visible = altitude < 130;
    this.earthHorizon.visible = altitude > 420;
    if (this.earthHorizon.visible) {
      this.earthHorizon.position.y = -68 - Math.min(25, (altitude - 420) * 0.05);
      this.earthHorizon.rotation.z = t * 0.02;
    }

    this.clouds.forEach((cloud, i) => {
      cloud.position.y = ((i * 9 - altitude * 0.32 + 200000) % 125) - 35;
      cloud.visible = altitude < 540;
    });

    this.flag.position.y = 13 - (altitude % 24);
    this.flag.rotation.y = Math.sin(t * 4) * 0.15 + state.windDirection * 0.35;

    // Wind particle animation
    const windMat = this.windParticles.material as THREE.PointsMaterial;
    const windDir = state.windDirection || state.windWarningDirection;
    windMat.opacity = state.windDirection !== 0 ? 0.72 : state.windWarningDirection !== 0 ? 0.35 : 0;
    if (windDir !== 0) {
      this.windParticles.position.x = (t * 14 * windDir) % 6;
    }

    // 4-stage altitude sky & background art transition (0-100m, 100-300m, 300-500m, 500m+)
    let stage = 0;
    let blend = 0;
    if (altitude > 70) {
      stage = 0;
      blend = THREE.MathUtils.smoothstep(altitude, 70, 130);
    }
    if (altitude > 260) {
      stage = 1;
      blend = THREE.MathUtils.smoothstep(altitude, 260, 340);
    }
    if (altitude > 460) {
      stage = 2;
      blend = THREE.MathUtils.smoothstep(altitude, 460, 540);
    }
    this.sky.copy(this.palette[stage]).lerp(this.palette[stage + 1], blend);
    this.scene.background = this.sky;
    (this.scene.fog as THREE.Fog).color.copy(this.sky);

    // Update backdrop image plane opacities for each stage
    const weights = [0, 0, 0, 0];
    weights[stage] = 1 - blend;
    weights[Math.min(3, stage + 1)] += blend;
    this.bgPlanes.forEach((planeMesh, idx) => {
      const mat = planeMesh.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.opacity = weights[idx] * 0.85;
        planeMesh.visible = mat.opacity > 0.01;
      }
    });

    const domeMat = this.spaceDome.material as THREE.MeshBasicMaterial;
    if (domeMat.map) {
      domeMat.opacity = weights[3] * 0.75;
      this.spaceDome.visible = domeMat.opacity > 0.01;
      this.spaceDome.rotation.y = t * 0.015;
    }

    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.smoothstep(
      altitude,
      430,
      540
    );

    // Shooting stars in space stage (500m+)
    this.meteors.forEach((meteor, idx) => {
      meteor.visible = altitude >= 500;
      if (meteor.visible) {
        const cycle = (t * 0.65 + idx * 1.7) % 4;
        meteor.position.set(35 - cycle * 24, 28 - cycle * 14 + idx * 5, -52 - idx * 6);
      }
    });

    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (now - this.sampleTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.sampleTime));
      this.frames = 0;
      this.sampleTime = now;
    }
  }

  telemetry(): Telemetry {
    return {
      fps: this.fps,
      calls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      modules: this.modules.length,
    };
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    if (this.mixer && this.characterGlbRoot) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.characterGlbRoot);
    }
    this.scene.traverse(object => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
