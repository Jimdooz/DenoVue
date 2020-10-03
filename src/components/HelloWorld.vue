<template>
    <section class="container">
        <h1>{{msg}}</h1>
        <button @click="count++">count is: {{ count }}</button>
        <p>Edit <code>src/components/HelloWorld.vue</code> to test hot module replacement</p>
    </section>
</template>

<script>

export default {
    props : {
        msg: String,
    },
    data: function () {
        return {
            count: 0
        }
    },
}
</script>

<style>
    code{
        font-weight: bold;
        padding: 2px 4px;
        margin: 0px 5px;
        background-color: rgb(200,200,200);
        border-radius: 5px;
    }

    .container{
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        text-align: center;
    }
</style>
