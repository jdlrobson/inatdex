<template>
    <div class="app">
        <form v-if="!enabled" @submit="loadiNatDex">
            Project: 
            <select name="project" v-model="project_id">
                <option value="">none</option> 
                <option value="4181">birds of golden gate park</option> 
                <option value="birds-of-presidio">birds of presidio</option>
            </select>
            Username: <input type="text" v-model="username" name="username" @blur="loadSeenByUser">
            <input type="submit" value="Show iNatDex">
        </form>
        <header v-if="enabled">
            <h2>iNatdex for {{username}}</h2>
            <h3>{{ projectName }}</h3>
            <em v-if="items">Seen: {{ seen ? seen.length : '_' }} / {{ items.length }}</em>
        </header>
        <div class="species-grid" v-if="items">
            <species v-for="(item, i) in items"
                @click="toggleSelected"
                :key="i"
                :name="item.name"
                :url="item.url"
                :count="item.count"
                :seen="seen && seen.includes(item.name)"
                :photo="item.photo"
            ></species>
        </div>
        <footer v-if="selected">
            <h2>{{ selected }}</h2>
            <p>{{ seenMessage }}</p>
            <a :href="url">View observations</a>
        </footer>
        <button @click="reset">Try a different location or username</button>
    </div>
</template>
<script>
import Species from './Species.vue';

const SPECIES_API = 'https://api.inaturalist.org/v1/observations/species_counts';

export default {
    name: 'App',
    data() {
        return {
            selected: '',
            url: '',
            count: 0,
            username: null,
            items: null,
            project_id: null,
            seen: null
        };
    },
    computed: {
        seenMessage() {
            const project = this.getProjectName();
           if ( this.count === 1 ) {
               return `Observed once in ${project}`;
           } else {
               return `Observed ${this.count} times in ${project}`;
           }
        },
        projectName() {
            return this.getProjectName();
        },
        enabled() {
            return this.username !== null && this.project_id && this.seen !== null;
        }
    },
    components: {
        Species
    },
    methods: {
        getProjectName() {
            switch ( this.project_id ) {
                case '4181':
                    return 'Golden Gate Park birds';
                default:
                    return this.project_id.replace(/-/g, ' ');
            }
        },
        toggleSelected( selection, count, url ) {
            this.count = count;
            this.url = url;
            if ( selection !== this.selected ) {
                this.selected = selection;
            } else {
                this.selected = '';
            }
        },
        loadiNatDex(ev) {
            ev.preventDefault();
            this.loadSeenByUser();
        },
        loadSeenByUser() {
            const project_id = this.project_id;
            const username = this.username;
            this.seen = [];
            fetch(`${SPECIES_API}?verifiable=true&project_id=${project_id}&user_id=${username}&locale=en`)
                .then((r) => r.json())
                .then((r) => {
                    return r.results.map((r) => {
                        return r.taxon.preferred_common_name;
                    });
                }).then((names) => {
                    this.seen = names;
                })
        },
        reset() {
            this.items = null;
            this.seen = null;
            this.project_id = '';
            this.username = '';
            history.replaceState( null, null, '?' )
        },
        loadSpecies() {
            const project_id = this.project_id;
            fetch(`${SPECIES_API}?project_id=${project_id}&ttl=900&v=1630551347000&preferred_place_id=&locale=en`)
                .then((r) => r.json())
                .then((d) => {
                    return d.results.sort((r1, r2) => r1.count > r2.count ? -1 : 1 ).map((r) => {
                        const taxon = r.taxon;
                        return {
                            url: `https://www.inaturalist.org/observations?place_id=any&project_id=${this.project_id}&subview=map&taxon_id=${taxon.id}&verifiable=any`,
                            count: r.count,
                            name: taxon.preferred_common_name,
                            photo: taxon.default_photo.medium_url
                        }
                    })
                }).then((items) => {
                    this.items = items;
                })
        }
    },
    mounted() {
        if ( location.search ) {
            const m = location.search.match(/project_id=([^&]*)/);
            if ( m && m[1] && m[1] !== this.project_id ) {
                this.project_id = m[1];
            }
            const u = location.search.match(/username=([^&]*)/);
            if ( u && u[1] !== this.username ) {
                this.username = u[1];
                if ( this.project_id ) {
                    this.loadSeenByUser();
                }
            }
        }
    },
    updated() {
        if ( this.items === null && this.project_id ) {
            this.loadSpecies();
            const uquery = this.username ? `&username=${this.username}` : '';
            history.replaceState( null, null, `?project_id=${this.project_id}${uquery}` )
            if ( uquery && this.seen === null ) {
                this.loadSeenByUser();
            }
        }
        if ( this.username ) {
            history.replaceState( null, null, `?project_id=${this.project_id}&username=${this.username}` )
        }
    }
}
</script>

<style scoped>
header {
    position: sticky;
    width: 100%;
    height: 80px;
    top: 0;
    background: #faf9ff;
    padding: 5px;
    border-bottom: solid 1px #847792;
    z-index: 2;
}

form {
    padding: 10px;
    margin: auto;
    text-align: center;
}

header > * {
    display: block;
    text-transform: uppercase;
    margin: auto;
    text-align: center;
    color: #847792;
    font-size: 1em;
    font-weight: 700;
}

h3 {
    margin-top: 10px;
}
h3,
em {
    font-size: 0.8em;
    font-weight: 500;
    font-style: normal;
    color: #ccc5eb;
}

.species-grid {
    padding: 10px;
    display: flex;
    flex-direction: row;
    width: 100%;
    flex-wrap: wrap;
    row-gap: 10px;
    column-gap: 10px;
    justify-content: center;
    background: #caddff;
    background: linear-gradient(180deg, #f6f2fe 0%, #caddff 100%); 
}

button {
    margin: 10px auto auto;
    display: block;
}

footer {
    position: sticky;
    bottom: 0;
    padding: 10px 40px;
    background: #faf9ff;
}
</style>