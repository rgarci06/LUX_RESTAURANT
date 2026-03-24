import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  // Definim l'arrel on Vite buscarà els fitxers
  root: './', 
  
  build: {
    outDir: 'dist', // On es guardarà el projecte acabat
    rollupOptions: {
      input: {
        // Punts d'entrada per a cada pàgina
        main: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'pages/menu.html'),
        login: resolve(__dirname, 'pages/login.html'),
        ubicacion: resolve(__dirname, 'pages/ubicacion.html'),
        reservas: resolve(__dirname, 'pages/reserva.html'),
        admin: resolve(__dirname, 'pages/admin.html'),
        recovery: resolve(__dirname, 'pages/recovery.html'),
        // Si crees més pàgines, afegeix-les aquí sota
      },
    },
  },
  server: {
    port: 5173,
    open: true // S'obrirà el navegador automàticament
  }
})