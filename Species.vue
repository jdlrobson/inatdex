<template>
    <div class="species">
        <img :src="photo" :alt="name"
            :class="photoClasses"
            :title="name">
    </div>
</template>

<script>

export default {
    name: 'Species',
    computed: {
        photoClasses() {
            return {
                'species__photo': true,
                'species__photo--seen': this.seen
            }
        }
    },
    props: {
        seen: Boolean,
        name: String,
        photo: String
    }
}
</script>

<style scoped>

.species__photo {
    width: 100px;
    height: 100px;
    object-fit: cover;
    opacity: 0.3;
    filter: grayscale(1);
    border-radius: 200px;
}

.species__photo--seen {
    opacity: 1;
    filter: none;
}
</style>