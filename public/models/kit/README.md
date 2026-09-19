外部の 3D モデル（glb）を置く場所。manifest.json に書けば差し替わる。無ければプリミティブのまま。

manifest.json の例：
{
  "police": { "url": "models/kit/cars/police.glb", "scale": 3.5, "yaw": 0 },
  "tank":   { "url": "models/kit/tanks/tank.glb",  "scale": 4,   "yaw": 3.14159 },
  "jet":    { "url": "models/kit/jets/jet.glb",    "scale": 6,   "yaw": 0 }
}
scale は「モデルの 1 単位を何 m にするか」、yaw は前方向の補正（ラジアン）、y は上下の補正（m）。
候補（CC0）：Kenney Car Kit / Kenney Toy Car Kit / Quaternius Ultimate Modular Vehicles / Quaternius Ultimate Spaceships

今入っているもの（出典は SOURCES.md）：
- cars/police.glb：Kenney Car Kit のパトカー
- houses/*.glb：Kenney City Kit (Suburban) の家。住宅街の家に使う（src/config/game.ts の STAGE.kit）
- buildings/*.glb：Kenney City Kit (Commercial) のビル。ビル街に使う
