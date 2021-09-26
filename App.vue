<template>
    <div class="app">
        <form v-if="!enabled" @submit="loadiNatDex">
            <p>The iNatdex is an <a href="https://inaturalist.org">iNaturalist</a> companion app that tells you what species you have seen and haven't seen
            in your favorite iNaturalist projects.</p>
            <p>It is not associated or endorsed by the iNaturalist project.</p>
            <div v-if="!usernameSet">
                <label class="label-input">Please enter your iNaturalist username:</label>
                <input type="text" v-model="username"
                    placeholder="Please enter your iNaturalist username"
                    name="username" @blur="setUsername">
                <p>Type "~" if you do not have an iNaturalist account.</p>
                <button @click="setUsername" :disabled="!username">Next</button>
            </div>
            <div v-if="usernameSet && !project_id">
                <p>Let's create an iNatDex (checklist) for {{username}}.</p>
                <label class="label-input">Which San Francisco project shall we use?</label>
                <button data-id="birds-of-san-francisco-excluding-farallon-islands" @click="selectProject">All San Francisco</button>
                <button data-id="birds-of-san-francisco-botanical-garden" @click="selectProject">Botanical Gardens</button>
                <button data-id="birds-of-ocean-beach" @click="selectProject">Ocean Beach</button>
                <button data-id="animals-of-lands-end-san-francisco" @click="selectProject">Lands End</button>
                <button data-id="birds-of-presidio" @click="selectProject">Birds of the Presidio</button>
                <button data-id="birds-of-fort-mason" @click="selectProject">Fort Mason</button>
                <button data-id="birds-of-golden-gate-park" @click="selectProject">Birds of Golden Gate Park</button>
                <button data-id="animals-of-mount-sutro" @click="selectProject">Mount Sutro</button>
                <button data-id="birds-of-lake-merced" @click="selectProject">Lake Merced</button>
                <p class="footer-text">If you live outside San Francisco and want to include your own place, drop me a mail
                    at jdlrobson@gmail.com</p>
            </div>
        </form>
        <header v-if="enabled">
            <h2>iNatdex for {{displayUsername}}</h2>
            <img
                width=50 height=50
                :src="avatar" :alt="displayUsername">
            <h3>{{ projectName }}</h3>
            <em v-if="items">Seen: {{ seen ? seen.length : '_' }} / {{ items.length }} <a :href="leaderboard">📈</a></em>
        </header>
        <loader v-if="!items && enabled"></loader>
        <main v-if="items">
            <nav>
                <label>sort by:</label>
                <a href="#count"
                    :class="filterClass('sort', 'count')"
                    @click="setSort('count', -1)">count</a>
                <a href="#name" :class="filterClass('sort', 'name')"
                    @click="setSort('name', 1)">name</a>
                <label>highlight:</label>
                <a href="#seen"
                    :class="filterClass('invertHighlight', false)"
                    @click="setHighlightMode(false)">seen</a>
                <a href="#notseen"
                    :class="filterClass('invertHighlight', true)"
                    @click="setHighlightMode(true)">not seen</a>
                <input placeholder="Filter by species name" v-model="filterName">
            </nav>
            <div class="species-grid" @click="clearToggle">
                <loader v-if="!seen">s</loader>
                <species v-for="(item, i) in filteredItems"
                    :invert-highlight="invertHighlight"
                    @click="toggleSelected"
                    :key="i"
                    :recent="recent && recent[item.id] !== undefined"
                    :name="item.name"
                    :url="item.url"
                    :id="item.id"
                    :count="item.count"
                    :total-count="item.totalCount"
                    :wikipedia="item.wikipedia"
                    :seen="seen && seen.includes(item.name)"
                    :photo="item.photo"
                ></species>
            </div>
        </main>
        <footer v-if="selected && seen">
            <h2>{{ selected }}</h2>
            <p>{{ seenMessage }}, {{ rarity }}</p>
            <a :href="url">View observations</a>
            <a :href="wikipedia">View on Wikipedia.org</a>
            <div v-if="recent[selectedId]">
                Seen recently @
                <a v-for="(recent, i) in recent[selectedId]"
                    :key="i"
                    target="_blank"
                    :href="`https://www.google.com/maps/@${recent.lat},${recent.lng},17z`"
                >
                {{recent.location}} {{recent.date}}
                </a>
            </div>
            <div class="footer-seen" v-if="username === '~'">
                <input
                    type="checkbox"
                    id="mark-seen"
                    :checked="seen.includes(selected)"
                    @change="markSeen"/>
                <label for="mark-seen">mark as seen (save privately to this device)</label>
                <p class="footer-text">
                    The iNatDex is more fun with an iNaturalist account and friends. <a href="https://www.inaturalist.org/signup">Sign up.</a>
                </p>
            </div>
            <a class="footer-close" @click="clearToggle">Close</a>
        </footer>
        <nav class="nav-end">
            <button v-if="isResetEnabled" class="btn-reset" @click="reset"
                >Try a different location or username</button>
        </nav>
    </div>
</template>
<script>
import Species from './Species.vue';
import Loader from './Loader.vue';
import { getAvatar, getEbirdObservations,
    getINatSpecies, getSpeciesInProject
} from './api.js';
const SF_PROJECT = 'birds-of-san-francisco-excluding-farallon-islands';

const getRarity = ( max, count ) => {
    const pc = Math.ceil( ( count / max ) * 100 );
    switch ( true ) {
        case pc > 80:
            return 'regulars at this location';
        case pc > 25:
            return `common for this location`;
        case pc > 5:
            return `sometimes at this location`;
        case pc > 1:
            return `unusual for this location ${pc}`;
        default:
            return 'rare for this location';
    }
};

const getHeader = ( countTotal, count, max ) => {
    const pc = Math.ceil(count / countTotal * 100);
    return `${pc}% of observations here (${getRarity(max, count)})`;
};

export default {
    name: 'App',
    data() {
        return {
            recent: null,
            avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            filterName: '',
            invertHighlight: false,
            sort: 'count',
            sortDir: -1,
            usernameSet: false,
            selected: '',
            totalCount: '',
            wikipedia: '',
            selectedId: null,
            url: '',
            totalLocalCount: 0,
            count: 0,
            max: 0,
            min: 0,
            username: null,
            items: null,
            project_id: null,
            seen: null
        };
    },
    computed: {
        filteredItems() {
            const searchTerm = this.filterName && this.filterName.toLowerCase();
            return this.items.filter((item) =>
                item.name && item.name.toLowerCase().indexOf( searchTerm ) > -1
            );
        },
        leaderboard() {
            return `https://www.inaturalist.org/projects/${this.project_id}?tab=observers`;
        },
        rarity() {
            return `${getHeader(this.totalLocalCount, this.count, this.max)}. Observed globally ${this.totalCount} times.`;
        },
        displayUsername() {
            return this.username === '~' ? 'your personal use' : this.username;
        },
        isResetEnabled() {
            return this.username && this.project_id && this.seen && this.items;
        },
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
        isLoaded() {
            return this.seen && this.items;
        },
        enabled() {
            return this.username !== null && this.project_id;
        }
    },
    components: {
        Species,
        Loader
    },
    methods: {
        filterClass( key, value ) {
            return {
                'filter--selected': this[key] === value,
                'filter': true
            };
        },
        setHighlightMode( mode ) {
            this.invertHighlight = mode;
        },
        setSort( sort, dir ) {
            this.sort = sort;
            this.sortDir = dir;
        },
        clearToggle() {
            this.selected = ''
        },
        markSeen( ev ) {
            const isSeen = ev.target.checked;
            const key = 'seen-' + this.project_id;
            let seen = JSON.parse(
                localStorage.getItem( key ) || '[]'
            );
            if ( isSeen && !seen.includes( this.selected ) ) {
                seen.push( this.selected )
            } else if ( !isSeen && seen.includes( this.selected ) ) {
                seen = seen.filter((a) => a !== this.selected);
            }
            this.seen = seen;
            localStorage.setItem(key, JSON.stringify(seen));
        },
        setUsername() {
            this.usernameSet = true;
        },
        selectProject(ev) {
            const project = ev.target.dataset.id;
            if ( project ) {
                this.project_id = project;
            }
        },
        getProjectName() {
            return this.project_id.replace(/-/g, ' ');
        },
        toggleSelected( selection, data ) {
            this.count = data.count;
            this.url = data.url;
            this.selectedId = data.id;
            this.wikipedia = data.wikipedia;
            this.totalCount = data.totalCount;
            if ( selection !== this.selected ) {
                this.selected = selection;
            } else {
                this.selected = '';
            }
        },
        loadiNatDex(ev) {
            ev.preventDefault();
            if ( this.project_id ) {
                this.loadSpecies( this.project_id ).then(() => this.loadSeenByUser() );
            }
        },
        loadSeenByUser() {
            const project_id = this.project_id;
            const username = this.username;
            getAvatar( username ).then((avatar) => {
                this.avatar = avatar;
            });
            if ( username === '~' ) {
                this.seen = JSON.parse(
                    localStorage.getItem( 'seen-' + project_id ) || '[]'
                );
                return;
            }
            if ( !project_id || !username ) {
                return;
            }
            return getINatSpecies( project_id, username )
                .then((r) => {
                    return r.results.map((r) => {
                        return r.taxon.preferred_common_name;
                    });
                }).then((names) => {
                    this.seen = names;
                });
        },
        reset() {
            this.items = null;
            this.seen = null;
            this.project_id = '';
            this.username = '';
            history.replaceState( null, null, '?' )
        },
        loadSpecies( project_id ) {
            return getSpeciesInProject( project_id )
                .then((d) => {
                    return d.results.map((r) => {
                        const taxon = r.taxon;
                        return {
                            id: '' + r.taxon.id,
                            rank: r.taxon.rank,
                            url: `https://www.inaturalist.org/observations?place_id=any&project_id=${this.project_id}&subview=map&taxon_id=${taxon.id}&verifiable=any`,
                            count: r.count,
                            totalCount: taxon.observations_count,
                            wikipedia: taxon.wikipedia_url,
                            name: taxon.preferred_common_name,
                            photo: taxon.default_photo.medium_url
                        }
                    }).sort(
                        (r1, r2) => r1[this.sort] > r2[this.sort] ? this.sortDir : -this.sortDir
                    );
                }).then((items) => {
                    this.items = items;
                    const counts = this.items.map((c) => c.count);
                    this.max = Math.max.apply(null, counts);
                    this.totalLocalCount = counts.reduce((previousValue, currentValue) => {
                        return previousValue + currentValue
                    }, 0);
                })
        },
        route() {
            const m = location.search.match(/project_id=([^&]*)/);
            if ( m && m[1] && m[1] !== 'null' ) {
                this.project_id = m[1];
            } else {
                this.project_id = null;
            }
            const u = location.search.match(/username=([^&]*)/);
            if ( u && u[1] !== 'null' ) {
                this.username = u[1];
            } else {
                this.username = null;
            }

            if ( this.project_id && !this.username ) {
                this.username = '~';
            }
        }
    },
    mounted() {
        if ( location.search ) {
            this.route();
        }
    },
    updated() {
        const project_fragment = this.project_id ? `project_id=${this.project_id}` : '';
        const username_fragment = this.username ? `username=${this.username}` : '';
        const url = project_fragment && username_fragment ?
            `?${project_fragment}&${username_fragment}` : `?${project_fragment}${username_fragment}`;
        if (
            (
                project_fragment && window.location.search.indexOf( 'project_id' ) === -1
            ) ||
            (
                username_fragment && window.location.search.indexOf( 'username' ) === -1
            )
        ) {
            // Mark change in steps by new url.
            history.pushState( null, null, url )
        } else {
            history.replaceState( null, null, url )
        }
        if ( this.project_id &&  !this.items && this.username && !this.seen ) {
            this.loadSpecies( this.project_id ).then(
                () => this.loadSeenByUser()
            );
        }
        if ( this.project_id === SF_PROJECT && !this.recent ) {
            this.recent = {};
            getEbirdObservations().then((ebird) => {
                ebird.filter((ebird) => ebird.inat)
                    .forEach(( match ) => {
                        const location = match.locName;
                        if (
                            !location.toLowerCase().match(
                                /(auto selected|farallon islands)/
                            )
                        ) {
                            if (!this.recent[match.inat]) {
                                this.recent[match.inat] = [];
                            }
                            this.recent[match.inat].push(
                                {
                                    lat: match.lat,
                                    lng: match.lng,
                                    date: match.obsDt,
                                    location: match.locName
                                }
                            );
                        }
                    })
            })
        }
        window.onpopstate = () => {
            this.seen = null;
            this.items = null;
            this.route();
            if ( location.search.indexOf('username=') > -1 ) {
                this.usernameSet = true;
            } else {
                this.usernameSet = false;
            }
        };
    }
}
</script>

<style scoped>
.app {
    text-align: center;
}

header {
    position: sticky;
    width: 100%;
    height: 130px;
    top: 0;
    background: #faf9ff;
    padding: 5px;
    border-bottom: solid 1px #847792;
    z-index: 2;
}

header img {
    width: 50px;
    height: 50px;
    border-radius: 50px;
}

form {
    padding: 10px;
    margin: auto;
    text-align: center;
    max-width: 400px;
}

input[type="text"],
.label-input {
    display: block;
    font-weight: bold;
    margin: auto;
    height: 40px;
    min-width: 300px;
}

input[type="text"] {
    text-align: center;
    margin-bottom: 40px;
    color: #555;
    background-color: #fff;
    background-image: none;
    border: 1px solid #ccc;
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

nav input {
    margin: 8px auto 0;
    display: block;
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
    padding: 10px 10px 50px;
    display: flex;
    flex-direction: row;
    width: 100%;
    flex-wrap: wrap;
    row-gap: 10px;
    column-gap: 10px;
    justify-content: center;
}
main {
    background: #caddff;
    background: linear-gradient(180deg, #f6f2fe 0%, #caddff 100%); 
}

main > nav {
    padding: 10px 0;
}

.species-grid .loader {
    position: absolute;
}

input[type="submit"],
button {
    cursor: pointer;
    margin: 10px auto auto;
    display: block;
    background-color: #74ac00;
    color: white;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 20px 10px;
    line-height: 15px;
    margin: 3px 0;
    border-radius: 100px;
    font-size: 0.875rem;
    box-sizing: border-box;
    user-select: none;
    background-image: none;
    border: 1px solid transparent;
    outline: 0;
    display: inline-block;
}

button:hover {
    opacity: .8;
}

button:focus {
    outline: auto;
    border-color: #74ac00;
}

.app > nav {
    position: fixed;
    bottom: 2px;
    left: 0;
    right: 0;
    width: 100%;
    text-align: center;
}

.btn-reset {
    background-color: white;
    color: #333;
    border-color: #ccc;
    margin: auto;
    text-align: center;
}

.btn-reset:hover {
    background-color: #e6e6e6;
    border-color: #adadad;
}

button:disabled {
    opacity: 0.2;
}

footer {
    position: sticky;
    bottom: 0;
    padding: 10px 40px 60px;
    background: #faf9ff;
}

footer h2,
footer p {
    margin: 8px 0;
}

footer p {
    margin-bottom: 20px;
}

footer > a {
    display: block;
}

.footer-seen {
    margin-top: 40px;
}
.footer-text {
    font-size: 0.75em;
}

.footer-close {
    position: absolute;
    right: 8px;
    top: 8px;
    font-weight: bold;
}

label {
    font-style: italic;
}

.filter {
    color: #666;
    text-decoration: none;
}

.filter--selected {
    color: #333;
    font-weight: bold;
}
</style>
