import * as THREE from 'three';
import { CONFIG, PIXEL_RATIO, type Quality } from '../game/config';
import { moduleY, type GameState } from '../game/simulation';

export interface Telemetry { fps: number; calls: number; geometries: number; modules: number; }
// Visuals only. Models can be replaced without changing fixed-step state or input rules.
export class TowerScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(49, 1, 0.1, 220);
  private modules: THREE.Group[] = [];
  private character = new THREE.Group();
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private city = new THREE.Group();
  private stars: THREE.Points;
  private flag: THREE.Mesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private resizeObserver: ResizeObserver;
  private quality: Quality;
  private sky = new THREE.Color();
  private palette = [0xa5cbd0, 0x83b6d1, 0xc38579, 0x111e39].map(c => new THREE.Color(c));
  private box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private sphere = this.geometry(new THREE.SphereGeometry(1, 12, 8));
  private steel = this.material(0x526d77, 0.65);
  private silver = this.material(0xa4b5b8, 0.55);
  private orange = this.material(0xef743f);
  private cream = this.material(0xffe6b0);
  private navy = this.material(0x203843);
  private frames = 0;
  private sampleTime = 0;
  private fps = 0;
  constructor(private host: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', '3レーンの鉄塔を下から上へ登る3D画面');
    this.renderer.domElement.setAttribute('role', 'img');
    host.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xa5cbd0, 55, 155);
    this.scene.add(new THREE.HemisphereLight(0xf3f7ff, 0x657f78, 2.6));
    const sun = new THREE.DirectionalLight(0xffddb2, 3.2); sun.position.set(-18, 28, 24); this.scene.add(sun);
    for (let i = 0; i < CONFIG.moduleCount; i++) { const group = this.makeModule(i); this.modules.push(group); this.scene.add(group); }
    this.makeCharacter(); this.scene.add(this.character);
    this.makeCity(); this.scene.add(this.city);
    const cloudMaterial = this.material(0xf4eee2);
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) this.mesh(cloud, this.sphere, cloudMaterial, [j * 3, Math.sin(j * 2) * 0.7, 0], [3.6, 1.25, 2]);
      cloud.position.set((i % 2 ? -1 : 1) * (12 + i % 4 * 5), i * 9 - 30, -16 - i % 3 * 9);
      this.clouds.push(cloud); this.scene.add(cloud);
    }
    const positions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { positions[i * 3] = Math.sin(i * 127.1) * 90; positions[i * 3 + 1] = Math.cos(i * 311.7) * 90; positions[i * 3 + 2] = -70 - (i % 40); }
    const starGeo = this.geometry(new THREE.BufferGeometry()); starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffefdb, size: 0.25, transparent: true, opacity: 0 }); this.materials.add(starMat);
    this.stars = new THREE.Points(starGeo, starMat); this.scene.add(this.stars);
    this.flag = this.mesh(this.scene, this.box, this.orange, [4.95, 13, 1.5], [1.5, 0.8, 0.06]);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
  }
  private geometry<T extends THREE.BufferGeometry>(g: T): T { this.geometries.add(g); return g; }
  private material(color: number, metalness = 0) {
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.64 }); this.materials.add(mat); return mat;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale: number[]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position as [number, number, number]); mesh.scale.set(...scale as [number, number, number]); parent.add(mesh); return mesh;
  }
  private makeModule(index: number) {
    const group = new THREE.Group();
    const beams: { a: number[]; b: number[]; width: number }[] = [];
    const beam = (a: number[], b: number[], width = 0.14) => beams.push({ a, b, width });
    for (const x of [-4, 4]) for (const z of [-2, 2]) beam([x, 0, z], [x, 8, z], 0.3);
    for (const z of [-2, 2]) {
      beam([-4, 0, z], [4, 0, z], 0.22);
      if (z === -2) { beam([-4, 0, z], [4, 8, z]); beam([4, 0, z], [-4, 8, z]); }
    }
    for (const x of [-4, 4]) { beam([x, 0, -2], [x, 8, 2]); beam([x, 0, 2], [x, 8, -2]); beam([x, 0, -2], [x, 0, 2], 0.22); }
    for (const lane of [-2.4, 0, 2.4]) {
      for (const offset of [-0.65, 0.65]) beam([lane + offset, 0, 2.3], [lane + offset, 8, 2.3], 0.09);
      for (let y = 0; y < 8; y += 0.5) beam([lane - 0.65, y, 2.36], [lane + 0.65, y, 2.36], 0.075);
    }
    const instanced = new THREE.InstancedMesh(this.box, this.steel, beams.length);
    const dummy = new THREE.Object3D(); const up = new THREE.Vector3(0, 1, 0);
    beams.forEach(({ a, b, width }, i) => {
      const start = new THREE.Vector3(...a as [number, number, number]); const end = new THREE.Vector3(...b as [number, number, number]);
      const dir = end.clone().sub(start); dummy.position.copy(start).add(end).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize()); dummy.scale.set(width, dir.length(), width); dummy.updateMatrix(); instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.computeBoundingSphere(); group.add(instanced);
    for (const x of [-4, 4]) this.mesh(group, this.box, index % 3 === 0 ? this.orange : this.silver, [x, 0.3, 2.1], [0.42, 0.6, 0.35]);
    return group;
  }
  private makeCharacter() {
    this.mesh(this.character, this.sphere, this.orange, [0, 0.9, 0], [0.43, 0.58, 0.28]);
    this.mesh(this.character, this.box, this.navy, [0, 0.9, 0.26], [0.48, 0.65, 0.19]);
    this.mesh(this.character, this.box, this.cream, [0, 1, 0.37], [0.32, 0.10, 0.025]);
    this.mesh(this.character, this.sphere, this.cream, [0, 1.65, 0], [0.36, 0.33, 0.33]);
    this.mesh(this.character, this.sphere, this.orange, [0, 1.8, 0], [0.43, 0.28, 0.4]);
    this.mesh(this.character, this.box, this.orange, [0, 1.71, -0.2], [0.85, 0.07, 0.65]);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.39, 1.2, 0); this.character.add(arm);
      this.mesh(arm, this.sphere, this.orange, [side * 0.12, -0.24, 0], [0.15, 0.4, 0.15]);
      this.mesh(arm, this.sphere, this.navy, [side * 0.15, -0.55, 0], [0.16, 0.17, 0.17]); this.arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(side * 0.23, 0.45, 0); this.character.add(leg);
      this.mesh(leg, this.sphere, this.navy, [0, -0.35, 0], [0.19, 0.42, 0.2]);
      this.mesh(leg, this.box, this.navy, [0, -0.67, -0.1], [0.31, 0.19, 0.45]); this.legs.push(leg);
    }
  }
  private makeCity() {
    const ground = this.material(0x7f9c79); const building = this.material(0xd0ceba); const roof = this.material(0x658887);
    this.mesh(this.city, this.box, ground, [0, -1, -30], [170, 1, 120]);
    for (let i = 0; i < 48; i++) {
      const x = ((i * 17) % 100) - 50; const z = -8 - ((i * 13) % 65); const height = 2 + i % 7 * 1.3;
      this.mesh(this.city, this.box, i % 3 ? building : roof, [x, height / 2, z], [3 + i % 3, height, 3]);
    }
    const tree = this.material(0x4f7c69);
    for (let i = 0; i < 20; i++) this.mesh(this.city, this.sphere, tree, [Math.sin(i * 5) * 38, 1, -5 - i * 3], [2.3, 2.5, 2]);
  }
  setQuality(quality: Quality) { this.quality = quality; this.resize(); }
  private resize() {
    const { clientWidth: width, clientHeight: height } = this.host;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[this.quality]));
    this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(1, height);
    const narrow = width < 700;
    this.camera.position.set(narrow ? 0 : 1.5, -3, narrow ? 24 : 21);
    this.camera.lookAt(0, 5.5, 0); this.camera.updateProjectionMatrix();
  }
  render(state: GameState, now: number) {
    const altitude = state.altitudeMm / 1000;
    this.modules.forEach((module, i) => module.position.y = moduleY(i, altitude));
    const t = state.tick / CONFIG.stepHz;
    const jump = state.motion === 'jump' ? Math.sin(Math.PI * (1 - state.motionSteps / CONFIG.jumpSteps)) : 0;
    const slide = state.motion === 'slide' ? Math.sin(Math.PI * (1 - state.motionSteps / CONFIG.slideSteps)) : 0;
    this.character.position.set(state.x, Math.sin(t * 12) * 0.05 + jump * 0.6, 3.15 + jump * 1.6);
    this.character.scale.y = 1 - slide * 0.45;
    this.character.rotation.z = state.laneSteps ? -(state.lane - 1 - state.fromX / CONFIG.laneWidth) * Math.sin(state.laneSteps / CONFIG.laneChangeSteps * Math.PI) * 0.18 : 0;
    for (let i = 0; i < 2; i++) {
      this.arms[i].rotation.x = state.motion === 'climb' ? -1.7 + Math.sin(t * 8 + i * Math.PI) * 0.65 : -2.2 + slide;
      this.legs[i].rotation.x = state.motion === 'climb' ? Math.sin(t * 8 + i * Math.PI) * 0.5 : -jump * 0.6;
    }
    this.city.position.y = -9 - altitude; this.city.visible = altitude < 120;
    this.clouds.forEach((cloud, i) => { cloud.position.y = ((i * 9 - altitude * 0.32 + 200000) % 125) - 35; });
    this.flag.position.y = 13 - altitude % 24; this.flag.rotation.y = Math.sin(t * 4) * 0.15;
    let stage = 0; let blend = 0;
    if (altitude > 70) { stage = 0; blend = THREE.MathUtils.smoothstep(altitude, 70, 130); }
    if (altitude > 260) { stage = 1; blend = THREE.MathUtils.smoothstep(altitude, 260, 340); }
    if (altitude > 460) { stage = 2; blend = THREE.MathUtils.smoothstep(altitude, 460, 540); }
    this.sky.copy(this.palette[stage]).lerp(this.palette[stage + 1], blend);
    this.scene.background = this.sky; (this.scene.fog as THREE.Fog).color.copy(this.sky);
    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.smoothstep(altitude, 450, 550);
    this.clouds.forEach(cloud => cloud.visible = altitude < 550);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (now - this.sampleTime >= 1000) { this.fps = Math.round(this.frames * 1000 / (now - this.sampleTime)); this.frames = 0; this.sampleTime = now; }
  }
  telemetry(): Telemetry { return { fps: this.fps, calls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, modules: this.modules.length }; }
  dispose() {
    this.resizeObserver.disconnect(); this.renderer.setAnimationLoop(null);
    this.scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.scene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
