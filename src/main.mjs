import Vue from 'https://cdn.jsdelivr.net/npm/vue/dist/vue.esm.browser.min.js';
import App from "./App.vue";
import Socket from "./socket.mjs";
import "./index.css";

/**
 * Hot reload part
 */
const socket = new Socket();
socket.on("reload:system", () => {
    location.reload();
})

/**
 * Vue Application
 */
const app = new Vue(App).$mount("#app");