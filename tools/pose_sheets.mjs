// 三面図のポーズ下敷きを書き出す（ComfyUI の ControlNet 用。docs/PIPELINE_ART.md）
// 使い方：npm run build && npx vite preview --port 4173 を動かした状態で
//   node tools/pose_sheets.mjs [出力フォルダ=tools/pose_sheets]
// Chromium の場所は環境変数 CHROMIUM で変えられる（無ければ Playwright の既定）
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = process.argv[2] ?? 'tools/pose_sheets'
fs.mkdirSync(out, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:4173/'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
for (const who of ['imouto', 'bro']) {
  for (const mode of ['openpose', 'depth', 'shade', 'sil']) {
    await page.goto(`${base}?posesheet&who=${who}&mode=${mode}`)
    await page.waitForFunction(() => window.__pose?.ready, null, { timeout: 180000 })
    await page.waitForTimeout(300)
    const el = await page.$(mode === 'openpose' ? '#pose' : '#gl')
    const file = `${out}/${who}_${mode}.png`
    await el.screenshot({ path: file })
    console.log(file, await page.evaluate(() => window.__pose))
  }
}
await browser.close()
