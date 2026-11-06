export interface ModelAssetSpec {
  id: string;
  fileName: string;
  path: string;
  saveFolder: string;
  format: 'GLB (glTF 2.0 Binary)';
  dimensionsMeters: { width: number; height: number; depth: number };
  origin: string;
  animations: string[];
  description: string;
  status: '反映済み（Google Drive素材適用）';
}

export interface ImageAssetSpec {
  id: string;
  fileName: string;
  path: string;
  saveFolder: string;
  format: 'PNG' | 'JPG / PNG';
  aspectRatio: string;
  pixelSize: { width: number; height: number };
  transparentRequired: boolean;
  usageLocation: string;
  description: string;
  status: '反映済み（Google Drive素材適用）';
}

export interface AudioAssetSpec {
  id: string;
  fileName: string;
  path: string;
  saveFolder: string;
  category: 'bgm' | 'se' | 'ambience';
  format: 'MP3 / WAV';
  durationSeconds: string;
  loop: boolean;
  sampleRateHz: string;
  description: string;
  status: '反映済み（Google Drive素材適用）';
}

export const MODEL_ASSETS: readonly ModelAssetSpec[] = [
  {
    id: 'character',
    fileName: 'chr_01_climber_rigged.glb',
    path: '/assets/models/chr_01_climber_rigged.glb',
    saveFolder: 'public/assets/models/',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.78, height: 1.8, depth: 0.46 },
    origin: '足元中央 (0, 0, 0)、8ボーン階層＋スキニング',
    animations: ['Climb_Run_Loop', 'Idle_Ready_Loop'],
    description: 'プレイヤーキャラクター（レトロ×緊張感の登攀作業員3Dモデル）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'tower_module',
    fileName: 'st_01_tower_base_10m.glb',
    path: '/assets/models/st_01_tower_base_10m.glb',
    saveFolder: 'public/assets/models/',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 3.5, height: 10.0, depth: 3.5 },
    origin: '下部中央 (0, 0, 0)、上下フランジ一致により無限連結可能',
    animations: [],
    description: '鉄塔基本区間3Dモデル（8mモジュールへシームレス統合）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'obstacle_beam_low',
    fileName: 'obs_01_broken_girder.glb',
    path: '/assets/models/obs_01_broken_girder.glb',
    saveFolder: 'public/assets/models/',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 2.4, height: 0.44, depth: 0.44 },
    origin: '中心原点 (0, 0, 0)',
    animations: [],
    description: '障害物①：突出鉄骨（崩落・突出H形鋼＋警戒帯、ジャンプ/スライド対象）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'obstacle_high_voltage',
    fileName: 'obs_02_high_voltage_coil.glb',
    path: '/assets/models/obs_02_high_voltage_coil.glb',
    saveFolder: 'public/assets/models/',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.76, height: 1.6, depth: 0.76 },
    origin: '底面中央原点 (0, 0, 0)',
    animations: [],
    description: '障害物②：高圧放電器（高圧トランス＋発光プラズマリング）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'obstacle_patrol_mine',
    fileName: 'obs_03_patrol_mine.glb',
    path: '/assets/models/obs_03_patrol_mine.glb',
    saveFolder: 'public/assets/models/',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 1.3, height: 1.3, depth: 1.3 },
    origin: '中心原点 (0, 0, 0)',
    animations: [],
    description: '障害物③：警備ドローン機雷（自律浮遊型機雷＋赤色センサーアイ、左右移動障害物）',
    status: '反映済み（Google Drive素材適用）',
  },
];

export const IMAGE_ASSETS: readonly ImageAssetSpec[] = [
  {
    id: 'character_portrait',
    fileName: 'chr_01_climber_2048x2048.png',
    path: '/assets/images/chr_01_climber_2048x2048.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '1:1',
    pixelSize: { width: 2048, height: 2048 },
    transparentRequired: true,
    usageLocation: 'タイトル画面・チュートリアル・リザルト画面',
    description: 'キャラクター画像（透過PNG・レトロ×緊張感の登攀作業員全身イラスト）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'energy_coin_icon',
    fileName: 'item_01_energy_coin_512x512.png',
    path: '/assets/images/item_01_energy_coin_512x512.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '1:1',
    pixelSize: { width: 512, height: 512 },
    transparentRequired: true,
    usageLocation: '上部HUDコイン表示・3Dコインテクスチャ・リザルト画面',
    description: 'アイテムアイコン（六角形レトロSFエネルギーコイン透過PNG）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bg_stage1_ground',
    fileName: 'bg_01_ground_1920x1080.png',
    path: '/assets/images/bg_01_ground_1920x1080.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    transparentRequired: false,
    usageLocation: '高度0〜100m 遠景背景',
    description: '背景①（地上）：サーチライトが照らす霧の地上発射施設と鉄塔基部',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bg_stage2_bluesky',
    fileName: 'bg_02_bluesky_clouds_1920x1080.png',
    path: '/assets/images/bg_02_bluesky_clouds_1920x1080.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    transparentRequired: false,
    usageLocation: '高度100〜300m 遠景背景',
    description: '背景②（青空・雲）：高高度の寒色コバルトブルー空と積乱雲・気流',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bg_stage3_sunset',
    fileName: 'bg_03_sunset_cloudsea_1920x1080.png',
    path: '/assets/images/bg_03_sunset_cloudsea_1920x1080.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    transparentRequired: false,
    usageLocation: '高度300〜500m 遠景背景',
    description: '背景③（夕焼け・雲海）：成層圏手前の茜色・深紫のトワイライトと雲海',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bg_stage4_space',
    fileName: 'bg_04_space_stars_1920x1080.png',
    path: '/assets/images/bg_04_space_stars_1920x1080.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    transparentRequired: false,
    usageLocation: '高度500m以降 遠景背景（16:9）',
    description: '背景④（宇宙 16:9）：宇宙・星雲・星空背景',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bg_stage4_space_panorama',
    fileName: 'bg_04_space_stars_2048x1024.png',
    path: '/assets/images/bg_04_space_stars_2048x1024.png',
    saveFolder: 'public/assets/images/',
    format: 'PNG',
    aspectRatio: '2:1',
    pixelSize: { width: 2048, height: 1024 },
    transparentRequired: false,
    usageLocation: '高度500m以降 宇宙パノラマスカイドーム（2:1水平シームレス）',
    description: '背景⑤（宇宙 2:1 パノラマ）：全天球・水平シームレス星空テクスチャ',
    status: '反映済み（Google Drive素材適用）',
  },
];

export const AUDIO_ASSETS: readonly AudioAssetSpec[] = [
  {
    id: 'bgm_normal',
    fileName: 'bgm-climb-normal.mp3',
    path: '/assets/audio/bgm-climb-normal.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'bgm',
    format: 'MP3 / WAV',
    durationSeconds: '76.80秒',
    loop: true,
    sampleRateHz: '44.1kHz / 192kbps',
    description: '1. 通常BGM（地上〜夕焼け：高度 0〜500m）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'bgm_space',
    fileName: 'bgm-climb-space.mp3',
    path: '/assets/audio/bgm-climb-space.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'bgm',
    format: 'MP3 / WAV',
    durationSeconds: '80.00秒',
    loop: true,
    sampleRateHz: '44.1kHz / 192kbps',
    description: '2. 宇宙BGM（宇宙エリア：高度 500m以降）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'ambience_wind',
    fileName: 'ambience-wind-loop.mp3',
    path: '/assets/audio/ambience-wind-loop.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'ambience',
    format: 'MP3 / WAV',
    durationSeconds: '20.00秒',
    loop: true,
    sampleRateHz: '44.1kHz / 192kbps',
    description: '3. 強風エリア環境音（強風エリア通過中ループ）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_coin',
    fileName: 'se-coin.mp3',
    path: '/assets/audio/se-coin.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.24秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '4. コイン取得音（コイン獲得時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_jump',
    fileName: 'se-jump.mp3',
    path: '/assets/audio/se-jump.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.28秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '5. ジャンプ音（ジャンプ入力時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_land',
    fileName: 'se-land.mp3',
    path: '/assets/audio/se-land.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.21秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '6. 着地・鉄骨グリップ音（ジャンプ着地時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_lane',
    fileName: 'se-lane-move.mp3',
    path: '/assets/audio/se-lane-move.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.17秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '7. 左右レーン移動音（左右レーン切替時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_item',
    fileName: 'se-item-get.mp3',
    path: '/assets/audio/se-item-get.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.58秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '8. 特殊アイテム取得音（特殊アイテム獲得時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_gameover',
    fileName: 'se-gameover.mp3',
    path: '/assets/audio/se-gameover.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '1.18秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '9. ゲームオーバー音（障害物接触・落下時）',
    status: '反映済み（Google Drive素材適用）',
  },
  {
    id: 'se_newrecord',
    fileName: 'se-new-record.mp3',
    path: '/assets/audio/se-new-record.mp3',
    saveFolder: 'public/assets/audio/',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '1.55秒',
    loop: false,
    sampleRateHz: '44.1kHz',
    description: '10. 週間新記録ファンファーレ（週間自己ベスト更新時）',
    status: '反映済み（Google Drive素材適用）',
  },
];
