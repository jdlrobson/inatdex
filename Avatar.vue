<template>
    <img class="avatar" width=50 height=50
        @error="onError"
        @click="$emit('click')">
</template>
<script>
export default {
    name: 'Avatar',
    methods: {
        onError(e) {
            e.target.src = e.target.src.replace(/jpeg/, 'jpg?440034');
        }
    }
}
</script>

<style scoped>
img {
    width: 50px;
    height: 50px;
    border-radius: 50px;
}
</style>