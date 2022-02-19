const cache = {};
const ebirdToken = process.env.EBIRD;
const API_HOST = 'https://api.inaturalist.org/v1';
const SPECIES_API = `${API_HOST}/observations/species_counts`;
import iNatToEbird from './inat-ebird.json';
import iNatToWikidata from './inat-wikidata.json';
import inatlogo from './inatlogo.png';
import { getLocation } from './geo.js';

const invertObj = (obj) => {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
        newObj[obj[key]] = key
    });
    return newObj;
}

// special cases:
const ebirdSpecialCases = {
    reevir1: 891704,
    mewgul: 471767,
    mewgul2: 471767,
    whwsco2:  144222,
    whwdov: 3460,
    y00478: 471767
};

const ebirdToINat = Object.assign(
    invertObj(iNatToEbird),
    ebirdSpecialCases
);

const SF_PROJECT = 'birds-of-san-francisco-excluding-farallon-islands';
const API_LOCAL_STORAGE_CACHE_KEY = 'api-cache';
const LOCAL_STORAGE_CACHE_AGE_MINUTES = 10;

const apiCache = localStorage.getItem( API_LOCAL_STORAGE_CACHE_KEY )
if ( apiCache ) {
    const apiCacheParsed = JSON.parse( apiCache );
    Object.keys( apiCacheParsed ).forEach((key) => {
        const item = apiCacheParsed[key];
        const ageMinutes = ( new Date() - new Date( item.date ) ) / 1000 / 60;
        if ( ageMinutes < LOCAL_STORAGE_CACHE_AGE_MINUTES ) {
            cache[key] = Promise.resolve( item.json );
        }
    })
} else {
    localStorage.setItem( API_LOCAL_STORAGE_CACHE_KEY, '{}' );
}

const fetchCache = (url, options) => {
    if ( !cache[url] ) {
        cache[url] = fetch(url, options).then((r) => {
            return r.json();
        }).then((json) => {
            const lsCache = JSON.parse(
                localStorage.getItem( API_LOCAL_STORAGE_CACHE_KEY )
            );
            lsCache[url] = {
                json,
                date: new Date()
            };
            // cache to localStorage
            localStorage.setItem( API_LOCAL_STORAGE_CACHE_KEY, JSON.stringify(lsCache) );
            return json;
        })
    }
    return cache[url];
};

const getINatSpeciesForUserInternal = ( project_id, username, page, data = null ) => {
    if ( data == null ) {
        data = {
            results: []
        };
    }
    return fetchCache(`${SPECIES_API}?page=${page}&verifiable=true&project_id=${project_id}&user_id=${username}&locale=en`)
        .then((pageData) => {
            const finalPass = pageData.per_page !== pageData.results.length;
            const newPages = pageData.results.map((d) => {
                const ebird = iNatToEbird[d.taxon.id];
                return Object.assign(
                d,
                { ebird })
            });
            data.results = data.results.concat( newPages );
            return finalPass ? data : getSpeciesInProjectInternal(
                project_id,
                username,
                page + 1,
                data
            );
        })
};

const getINatSpeciesForUser = ( project_id, username ) => {
    return getINatSpeciesForUserInternal( project_id, username, 1 );
};

const getSpeciesInProjectInternal = ( project_id, page, data = null ) => {
    if ( data === null ) {
        data = {
            results: []
        };
    }
    const foundSpecies = [];
    return fetchCache(`${SPECIES_API}?page=${page}&project_id=${project_id}&back=10&ttl=900&v=1630551347000&preferred_place_id=&locale=en`)
        .then((pageData) => {
            const finalPass = pageData.per_page !== pageData.results.length;
            data.results = data.results.concat(
                pageData.results
            );

            if ( finalPass && project_id === SF_PROJECT ) {
                data.results.forEach((d) => {
                    const ebird = iNatToEbird[d.taxon.id];
                    foundSpecies.push( ebird );
                });
                return getEbirdObservations().then((d) => {
                    const additionial = d.map((ebird) => {
                        const specialCase = ebirdSpecialCases[ebird.speciesCode];
                        if ( specialCase ) {
                            ebird.speciesCode = iNatToEbird[specialCase]
                        }
                        return ebird;
                    } ).filter((ebird) =>
                        !foundSpecies.includes(
                            // Map to iNat and back again in case there are 2 ebird
                            // species codes linked to subspecies.
                            iNatToEbird[
                                ebirdToINat[ebird.speciesCode]
                            ]
                        )
                    );
                    data.results = data.results.concat(
                        additionial.map((ebirdObs) => {
                            const id = ebirdObs.inat;
                            const wikidata = iNatToWikidata[id];
                            return {
                                count: 0,
                                taxon: {
                                    preferred_common_name: ebirdObs.comName,
                                    rank: 'species',
                                    wikipedia_url: wikidata ?
                                        `https://www.wikidata.org/wiki/${wikidata}` : undefined,
                                    id,
                                    default_photo: {
                                        medium_url: inatlogo
                                    }
                                }
                            }
                        })
                    )
                    return data;
                }, () => {
                    return Promise.resolve( data );
                });
            }
            return finalPass ? data : getSpeciesInProjectInternal(
                project_id,
                page + 1,
                data
            );
        } );
};

const getSpeciesInProject = ( project_id ) => {
    return getSpeciesInProjectInternal( project_id, 1, null );
};

const getUserId = ( username ) => {
    return fetchCache(`https://api.inaturalist.org/v1/users/autocomplete?q=${encodeURIComponent(username)}`)
        .then((data) => {
            const result = data.results[0];
            if ( result ) {
                return result.id;
            } else {
                return Promise.reject();
            }
        });
}

const getAvatar = (username) => {
    return getUserId(username).then((id) =>
        `https://static.inaturalist.org/attachments/users/icons/${id}/medium.jpeg`
    );
}

const getEbirdObservations = () => {
    if ( !ebirdToken ) {
        return Promise.reject( 'No ebird token set. export EBIRD=xxx')
    }
    return fetchCache(`https://api.ebird.org/v2/data/obs/US-CA-075/recent`, {
        headers: {
            'X-eBirdApiToken': ebirdToken
        }
    }).then((data) => {
        return data.filter((ebird) => {
            // Filter out hard to find things (need a boat)
            return ebird.locName && !ebird.locName.toLowerCase().match(
                    /(auto selected|farallon islands|sefi)/
                // cross species are too complicated for now.
                ) && ebird.speciesCode.charAt(0) !== 'x' &&
                // make sure they are valid observations.
                ebird.obsValid
        } ).map((ebird) => {
            if(!ebirdToINat[ebird.speciesCode]) {
                console.warn( `Missing ebird to iNat ${ebird.speciesCode}. Usually indicates a species not recorded on iNat. Please edit manually.`)
            }
            return Object.assign(ebird, {
                inat: ebirdToINat[ebird.speciesCode]
            });
        });
    })
}

const getWikidataFromWikipedia = ( wikipediaTitle ) => {
    const title = wikipediaTitle.replace(/ /g, '_');
    return fetchCache(`https://en.wikipedia.org/w/api.php?origin=*&redirects=1&formatversion=2&action=query&format=json&prop=pageprops%7Cpageterms&titles=${title}`)
        .then((data) => {
            try {
                return data.query.pages[0].pageprops.wikibase_item;
            } catch (e) {
                console.warn( `${wikipediaTitle} has no Wikidata page` );
                return false;
            }
        });
};

const getEbirdFromWikidata = ( qid, ignoreCache ) => {
    let url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    if (ignoreCache) {
        url += '?cache=' + Math.random();
    }
    return fetchCache(url)
        .then((data) => {
            const ebirdClaim = data.entities[qid].claims.P3444;
            if ( ebirdClaim ) {
                return ebirdClaim[0].mainsnak.datavalue.value;
            } else {
                console.warn( `No ebird claim for ${qid}`);
                return false;
            }
        });
}


/**
 * Used by Jon for maintenance for populating the inat-wikidata.json
 * Run loadWikidataIds() and follow instructions in console.
 */
function loadWikidataIds( mode = 'wikidata' ) {
    console.warn(`begin loadWikidataIds for mode ${mode}`);
    let errors = 0;
    getSpeciesInProject('birds-of-san-francisco-excluding-farallon-islands').then((species) => {
        const promises = species.results
            .filter((m) => m.taxon.rank !== 'hybrid')
            .map((m) => {
                const wikidata = iNatToWikidata[m.taxon.id];
                const id = '' + m.taxon.id;
                if ( mode === 'wikidata' ) {
                    const wiki = m.taxon.wikipedia_url;
                    if ( !wikidata ) {
                        return getWikidataFromWikipedia(
                            wiki ? wiki.split('wiki/')[1] : m.taxon.preferred_common_name
                        ).then((qid) => {
                            return {
                                [id]: qid
                            }
                        });
                    } else {
                        if (!wikidata ) {
                            console.warn( `[update script] ${m.taxon.preferred_common_name} (${id}) has no Wikipedia page (${wiki}). Manual edit required.` );
                            errors += 1;
                        }
                        return Promise.resolve( {
                            [id]: wikidata
                        } );
                    }
                } else if ( mode === 'ebird' ) {
                    if ( wikidata === false ) {
                        console.warn( `[update script] ${m.taxon.preferred_common_name} (${id}) has no Wikidata. Manual edit required.`)
                        errors += 1;

                        return Promise.resolve({
                            [id]: false
                        });
                    } else if ( iNatToEbird[id] ) {
                        return Promise.resolve({
                            [id]: iNatToEbird[id]
                        });
                    } else {
                        return getEbirdFromWikidata(wikidata, true).then((ebird) => {
                            return {
                                [id]: ebird
                            }
                        })
                    }
                }
            });
        if ( promises.length) {
            return Promise.all( promises ).then((results) => {
                const base = mode === 'wikidata' ? iNatToWikidata
                    : iNatToEbird;
                const file = mode === 'wikidata' ? 'inat-wikidata.json' : 'inat-ebird.json';
                const newData = Object.assign(
                        {},
                        base,
                        Object.assign.apply(null, results)
                    );
                if (
                    Object.keys(newData).filter((key) => newData[key] !== false).length !==
                    Object.keys(base).filter((key) => base[key] !== false).length
                ) {
                    console.log(`[update script] Changes detected. Please save the following to ${file} and refresh page:`)
                    console.log(
                        JSON.stringify(newData)
                    )
                } else if ( errors > 0 ) {
                    console.log('[update script] Some entries require manual updates. See above.')
                } else {
                    if ( mode === 'wikidata' ) {
                        console.log('[update script] Wikidata JSON up to date. Checking eBird to iNat mappings.');
                        loadWikidataIds('ebird');
                    } else {
                        console.log('[update script] All JSONs are up to date.');
                    }
                }
            });
        }
    });
}

const getProjects = () => {
    return getLocation().then((location) => {
        const { latitude, longitude } = location.coords;
        // San Francisco
        if ( latitude > 36 && latitude < 39 && longitude < -121 && longitude > -123 ) {
           return Promise.resolve( [
                { id: 'birds-of-san-francisco-excluding-farallon-islands', title:'All San Francisco' },
                { id: 'birds-of-san-francisco-botanical-garden', title: 'Botanical Gardens' },
                { id: 'birds-of-ocean-beach', title: 'Ocean Beach' },
                { id: 'animals-of-lands-end-san-francisco', title: 'Lands End' },
                { id: 'birds-of-presidio', title: 'Birds of the Presidio' },
                { id: 'birds-of-fort-mason', title: 'Fort Mason' },
                { id: 'birds-of-golden-gate-park', title: 'Birds of Golden Gate Park' },
                { id: 'animals-of-mount-sutro', title: 'Mount Sutro' },
                { id: 'birds-of-lake-merced', title: 'Lake Merced' },
                { id: 'birds-of-california', title: 'Birds of California'}
            ] );
        } else {
            return Promise.resolve( [] );
        }
    });
}
export {
    getProjects,
    SF_PROJECT,
    loadWikidataIds,
    getLocation,
    getEbirdObservations,
    getINatSpeciesForUser,
    getSpeciesInProject,
    getUserId, fetchCache, getAvatar
};
