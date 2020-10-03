<template>
    <button class="maButton" @click="count++">You clicked me {{ count }} times.</button>
</template>

<script>

console.log("Coucou les gens :D");

export default {
    data: function () {
        return {
            count: 0
        }
    },
}
</script>

<style>
    .maButton{
        color: blue;
    }
</style>