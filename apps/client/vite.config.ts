import { defineConfig } from 'vite'

export default defineConfig({
  // Chemins d'assets relatifs : l'appli peut être servie sous un préfixe (ex. /coplarpon/).
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
})
