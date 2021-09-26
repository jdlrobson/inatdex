<template>
    <div class="species" @click="clicked">
        <div
            v-if="recent && !seen"
            :class="recentClasses" title="Seen recently">❗</div>
        <img :src="photo" :alt="name"
            :class="photoClasses"
            :title="name">
        <slot/>
    </div>
</template>

<script>

export default {
    name: 'Species',
    methods: {
        clicked( ev ) {
            ev.stopPropagation();
            this.$emit( 'click', this.name, {
                id: this.id,
                count: this.count,
                url: this.url,
                wikipedia: this.wikipedia,
                totalCount: this.totalCount
            } );
        }
    },
    computed: {
        recentClasses() {
            return {
                'species__recent': true,
                'species__recent--seen': this.invertHighlight ? !this.seen : this.seen

            }
        },
        photoClasses() {
            return {
                'species__photo': true,
                'species__photo--seen': this.invertHighlight ? !this.seen : this.seen
            }
        }
    },
    props: {
        id: String,
        recent: Boolean,
        invertHighlight: Boolean,
        count: Number,
        totalCount: Number,
        wikipedia: String,
        seen: Boolean,
        url: String,
        name: String,
        photo: String
    }
}
</script>

<style scoped>
.species {
    position: relative;
}

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

.species__recent {
    position: absolute;
    right: 0;
}

</style>