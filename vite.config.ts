import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages では https://<user>.github.io/ImoteControllDandy/ 配下になる
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/ImoteControllDandy/' : '/',
})
