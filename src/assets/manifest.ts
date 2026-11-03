export interface ModelAssetSpec {
  id: string;
  fileName: string;
  path: string;
  format: 'GLB (glTF 2.0 Binary)';
  dimensionsMeters: { width: number; height: number; depth: number };
  origin: string;
  animations?: string[];
  description: string;
}

export interface ImageAssetSpec {
  id: string;
  fileName: string;
  path: string;
  format: 'PNG' | 'WEBP';
  aspectRatio: string;
  pixelSize: { width: number; height: number };
  description: string;
}

export interface AudioAssetSpec {
  id: string;
  fileName: string;
  path: string;
  category: 'bgm' | 'se' | 'ambience';
  format: 'MP3 / WAV';
  durationSeconds: string;
  loop: boolean;
  description: string;
}

export const MODEL_ASSETS: readonly ModelAssetSpec[] = [
  {
    id: 'character',
    fileName: 'climber.glb',
    path: '/assets/models/climber.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.9, height: 1.8, depth: 0.7 },
    origin: '足元中央 (0, 0, 0)、+Yが上、-Zが鉄塔側（正面）',
    animations: ['climb', 'move_left', 'move_right', 'jump', 'land', 'slide', 'hit'],
    description: 'プレイヤーキャラクター（作業員クライマー）モデル',
  },
  {
    id: 'tower_module',
    fileName: 'tower-module-8m.glb',
    path: '/assets/models/tower-module-8m.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 8.4, height: 8.0, depth: 4.8 },
    origin: '下部中央 (0, 0, 0)、高さ8.0mで上下シームレス連結',
    description: '3レーン（X = -2.4m, 0m, +2.4m）のはしごを含む鉄塔基本モジュール',
  },
  {
    id: 'obstacle_beam_low',
    fileName: 'obstacle-beam-low.glb',
    path: '/assets/models/obstacle-beam-low.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 2.1, height: 0.65, depth: 0.6 },
    origin: 'レーン中央下部 (0, 0, 0)',
    description: 'ジャンプで飛び越える低位置の水平鉄骨・梁',
  },
  {
    id: 'obstacle_beam_high',
    fileName: 'obstacle-beam-high.glb',
    path: '/assets/models/obstacle-beam-high.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 2.1, height: 0.9, depth: 0.7 },
    origin: 'レーン頭上中央 (0, 1.1, 0)',
    description: 'スライドでくぐり抜ける高位置の看板・上部鉄骨',
  },
  {
    id: 'obstacle_missing_foothold',
    fileName: 'obstacle-missing-rung.glb',
    path: '/assets/models/obstacle-missing-rung.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 1.8, height: 1.4, depth: 0.5 },
    origin: 'レーン中央 (0, 0, 0)',
    description: '足場の欠損（破損ステップ・警告表示）',
  },
  {
    id: 'obstacle_moving_load',
    fileName: 'obstacle-moving-load.glb',
    path: '/assets/models/obstacle-moving-load.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 1.9, height: 1.3, depth: 0.9 },
    origin: '中心 (0, 0.65, 0)',
    description: '左右に周期移動する吊り荷・可動鉄骨ユニット',
  },
  {
    id: 'coin',
    fileName: 'coin.glb',
    path: '/assets/models/coin.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.7, height: 0.7, depth: 0.18 },
    origin: '中心 (0, 0, 0)',
    description: '回転する大栄コインモデル',
  },
  {
    id: 'item_magnet',
    fileName: 'item-magnet.glb',
    path: '/assets/models/item-magnet.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.85, height: 0.85, depth: 0.85 },
    origin: '中心 (0, 0, 0)',
    description: '特殊アイテム：コインマグネット（10秒間）',
  },
  {
    id: 'item_double',
    fileName: 'item-double.glb',
    path: '/assets/models/item-double.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.85, height: 0.85, depth: 0.85 },
    origin: '中心 (0, 0, 0)',
    description: '特殊アイテム：コイン2倍（10秒間）',
  },
  {
    id: 'item_slow',
    fileName: 'item-slow.glb',
    path: '/assets/models/item-slow.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.85, height: 0.85, depth: 0.85 },
    origin: '中心 (0, 0, 0)',
    description: '特殊アイテム：スローモーション（10秒間）',
  },
  {
    id: 'item_high_jump',
    fileName: 'item-high-jump.glb',
    path: '/assets/models/item-high-jump.glb',
    format: 'GLB (glTF 2.0 Binary)',
    dimensionsMeters: { width: 0.85, height: 0.85, depth: 0.85 },
    origin: '中心 (0, 0, 0)',
    description: '特殊アイテム：ハイジャンプ（10秒間）',
  },
];

export const IMAGE_ASSETS: readonly ImageAssetSpec[] = [
  {
    id: 'title_logo',
    fileName: 'logo-daiei-tower-climb.png',
    path: '/assets/images/logo-daiei-tower-climb.png',
    format: 'PNG',
    aspectRatio: '16:5',
    pixelSize: { width: 1280, height: 400 },
    description: 'スタート画面用タイトルロゴ（透過PNG）',
  },
  {
    id: 'character_portrait',
    fileName: 'character-reference.png',
    path: '/assets/images/character-reference.png',
    format: 'PNG',
    aspectRatio: '1:1',
    pixelSize: { width: 1024, height: 1024 },
    description: 'キャラクター立ち絵・アイコン用画像（透過PNG）',
  },
  {
    id: 'bg_stage1_city',
    fileName: 'bg-stage1-city.png',
    path: '/assets/images/bg-stage1-city.png',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    description: '高度0〜100m：街並み・緑・工事現場の背景テクスチャ／参考画像',
  },
  {
    id: 'bg_stage2_sky',
    fileName: 'bg-stage2-sky.png',
    path: '/assets/images/bg-stage2-sky.png',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    description: '高度100〜300m：青空・雲・霧の背景テクスチャ／参考画像',
  },
  {
    id: 'bg_stage3_sunset',
    fileName: 'bg-stage3-sunset.png',
    path: '/assets/images/bg-stage3-sunset.png',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    description: '高度300〜500m：夕日・雲海の背景テクスチャ／参考画像',
  },
  {
    id: 'bg_stage4_space',
    fileName: 'bg-stage4-space.png',
    path: '/assets/images/bg-stage4-space.png',
    format: 'PNG',
    aspectRatio: '16:9',
    pixelSize: { width: 1920, height: 1080 },
    description: '高度500m以降：宇宙・星・地球の輪郭の背景テクスチャ／参考画像',
  },
];

export const AUDIO_ASSETS: readonly AudioAssetSpec[] = [
  {
    id: 'bgm_normal',
    fileName: 'bgm-climb-normal.mp3',
    path: '/assets/audio/bgm-climb-normal.mp3',
    category: 'bgm',
    format: 'MP3 / WAV',
    durationSeconds: '60〜120秒（シームレスループ推奨）',
    loop: true,
    description: '通常BGM（高度0〜500m）',
  },
  {
    id: 'bgm_space',
    fileName: 'bgm-climb-space.mp3',
    path: '/assets/audio/bgm-climb-space.mp3',
    category: 'bgm',
    format: 'MP3 / WAV',
    durationSeconds: '60〜120秒（シームレスループ推奨）',
    loop: true,
    description: '宇宙BGM（高度500m以降）',
  },
  {
    id: 'se_coin',
    fileName: 'se-coin.mp3',
    path: '/assets/audio/se-coin.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.15〜0.35秒',
    loop: false,
    description: 'コイン取得音',
  },
  {
    id: 'se_jump',
    fileName: 'se-jump.mp3',
    path: '/assets/audio/se-jump.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.20〜0.40秒',
    loop: false,
    description: 'ジャンプ音',
  },
  {
    id: 'se_land',
    fileName: 'se-land.mp3',
    path: '/assets/audio/se-land.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.15〜0.30秒',
    loop: false,
    description: '着地・鉄骨グリップ音',
  },
  {
    id: 'se_lane',
    fileName: 'se-lane-move.mp3',
    path: '/assets/audio/se-lane-move.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.12〜0.25秒',
    loop: false,
    description: '左右レーン移動音',
  },
  {
    id: 'se_item',
    fileName: 'se-item-get.mp3',
    path: '/assets/audio/se-item-get.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.40〜0.80秒',
    loop: false,
    description: '特殊アイテム取得音',
  },
  {
    id: 'se_gameover',
    fileName: 'se-gameover.mp3',
    path: '/assets/audio/se-gameover.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '0.80〜1.50秒',
    loop: false,
    description: '障害物接触・ゲームオーバー音',
  },
  {
    id: 'se_newrecord',
    fileName: 'se-new-record.mp3',
    path: '/assets/audio/se-new-record.mp3',
    category: 'se',
    format: 'MP3 / WAV',
    durationSeconds: '1.00〜2.00秒',
    loop: false,
    description: '週間自己ベスト更新時の新記録ファンファーレ',
  },
  {
    id: 'ambience_wind',
    fileName: 'ambience-wind-loop.mp3',
    path: '/assets/audio/ambience-wind-loop.mp3',
    category: 'ambience',
    format: 'MP3 / WAV',
    durationSeconds: '15〜30秒（シームレスループ）',
    loop: true,
    description: '高所・強風エリアの風切り環境音',
  },
];
