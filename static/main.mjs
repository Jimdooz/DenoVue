import Vue from 'https://cdn.jsdelivr.net/npm/vue/dist/vue.esm.browser.min.js';

function importComponent(path){
    return async () => {
        return (await import(path)).default;
    }
}

const app = new Vue({
    el: '#app',
    data: {
        message: 'Hello Vue!'
    },
    components: {
        'button-counter': importComponent("./button-counter.mjs"),
    }
})