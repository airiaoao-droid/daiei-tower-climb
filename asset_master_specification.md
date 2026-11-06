# 最終版：ゲーム素材一式 ファイル名・保存先・制作仕様一覧

| 素材カテゴリ | ファイル名 | 保存先（推奨ディレクトリ） | ファイル形式 | 制作仕様・実装詳細 |
| :---- | :---- | :---- | :---- | :---- |
| キャラクター画像 | `chr_01_climber_2048x2048.png` | `Assets/Sprites/Characters/` | 透過PNG (RGBA) | 2048×2048px・1:1、背景完全透過処理済み、レトロ×緊張感の登攀作業員全身イラスト |
| キャラクター3D | `chr_01_climber_rigged.glb` | `Assets/Models/Characters/` | GLB (glTF 2.0) | 全高約1.8m（Y=0.0m接地）、8ボーン階層（Root/Pelvis/Spine/Head/Arm\_L,R/Leg\_L,R）＋スキニング＋2種のアニメーション（Climb\_Run\_Loop / Idle\_Ready\_Loop）内蔵 |
| 鉄塔基本区間 | `st_01_tower_base_10m.glb` | `Assets/Models/Tower/` | GLB (glTF 2.0) | 高さ10.0m（Y=0.0m〜10.0m）×幅3.5m、メートル基準、上下フランジ一致によりY軸+10m周期で無限連結可能 |
| 障害物（鉄骨） | `obs_01_broken_girder.glb` | `Assets/Models/Obstacles/` | GLB (glTF 2.0) | 幅2.4m×高さ0.44m×奥行0.44m、独立モデル（崩落・突出H鋼＋警戒ストライプ、中心原点） |
| 障害物（高圧放電器） | `obs_02_high_voltage_coil.glb` | `Assets/Models/Obstacles/` | GLB (glTF 2.0) | 半径0.38m×高さ1.60m、独立モデル（高圧トランス＋発光プラズマリング、底面中央原点） |
| 障害物（警備機雷） | `obs_03_patrol_mine.glb` | `Assets/Models/Obstacles/` | GLB (glTF 2.0) | 半径0.65m、独立モデル（自律浮遊型ドローン機雷＋赤色発光センサー、中心原点） |
| アイテムアイコン | `item_01_energy_coin_512x512.png` | `Assets/Sprites/Items/` | 透過PNG (RGBA) | 512×512px・1:1、背景完全透過処理済み、六角形レトロSFエネルギーコインアイコン |
| 背景参考画像（地上） | `bg_01_ground_1920x1080.png / .jpg` | `Assets/Sprites/Backgrounds/` | PNG / JPG | 1920×1080px・16:9、サーチライトが照らす霧の地上発射施設と鉄塔基部 |
| 背景参考画像（青空・雲） | `bg_02_bluesky_clouds_1920x1080.png / .jpg` | `Assets/Sprites/Backgrounds/` | PNG / JPG | 1920×1080px・16:9、高高度の寒色コバルトブルー空と積乱雲・気流 |
| 背景参考画像（夕焼け・雲海） | `bg_03_sunset_cloudsea_1920x1080.png / .jpg` | `Assets/Sprites/Backgrounds/` | PNG / JPG | 1920×1080px・16:9、成層圏手前の茜色・深紫のトワイライトと雲海 |
| 背景参考画像（宇宙・星空） | `bg_04_space_stars_1920x1080.png / .jpg (および 2048x1024)` | `Assets/Sprites/Backgrounds/` | PNG / JPG | 1920×1080px・16:9（＋全天球/パノラマ用 2048×1024px・2:1 水平シームレス版同梱） |
| 通常BGM | `bgm_01_normal_stage_loop.mp3` | `Assets/Audio/BGM/` | MP3 (192kbps) | 76.8秒（100BPM・32小節・60〜120秒基準）、ループあり（終端ディレイ折り返し処理済み）、重厚なFMベース＆緊張感あるアルペジオ |
| 宇宙BGM | `bgm_02_space_stage_loop.mp3` | `Assets/Audio/BGM/` | MP3 (192kbps) | 80.0秒（96BPM・32小節・60〜120秒基準）、ループあり（シームレス折り返し処理済み）、無重力感と冷徹なFMベル・サブベース |
| コイン効果音 | `se_04_coin_pickup.wav / .mp3` | `Assets/Audio/SFX/` | WAV / MP3 | 0.26秒（0.1〜0.4秒基準）、ループなし、レトロアーケード風2音階（B5→E6）金属クリスタルチャイム |
| ゲームオーバー音 | `se_05_gameover.wav / .mp3` | `Assets/Audio/SFX/` | WAV / MP3 | 2.20秒（1〜3秒基準）、ループなし、マイナー・ディミニッシュ下降和音＋システムシャットダウンピッチドロップ |
| 環境効果音（風・雲・宇宙） | `se_01_wind_loop / se_02_clouds_loop / se_03_space_loop (.wav / .mp3)` | `Assets/Audio/SFX/` | WAV / MP3 | 5.0〜8.0秒、シームレスループ対応（高所の風切り音・雲海乱気流・宇宙空間ドローン） |

