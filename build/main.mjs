import o from"https://cdn.jsdelivr.net/npm/vue/dist/vue.esm.browser.min.js";import m from"./App.mjs";import e from"./socket.mjs";import"./index.css";(new e).on("reload:system",()=>{location.reload()});new o(m).$mount("#app");