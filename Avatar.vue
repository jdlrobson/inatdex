<template>
    <img class="avatar" width=50 height=50 @click="$emit('click')">
</template>
<script>
export default {
    name: 'Avatar'
}
</script>

<style scoped>
img {
    width: 50px;
    height: 50px;
    border-radius: 50px;
}
</style>