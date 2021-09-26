const cache = {};
const ebirdToken = process.env.EBIRD;
import ebirdToINat from './ebird-inat.json';
const SPECIES_API = 'https://api.inaturalist.org/v1/observations/species_counts';
import iNatToEbird from './inat-ebird.json';
import iNatToWikidata from './inat-wikidata.json';

const fetchCache = (url, options) => {
    if ( !cache[url] ) {
        cache[url] = fetch(url, options).then((r) => {
            return r.json();
        });
    } else {
        console.log('use cache', url );
    }
    return cache[url];
};

const getINatSpecies = ( project_id, username ) => {
    return fetch(`${SPECIES_API}?verifiable=true&project_id=${project_id}&user_id=${username}&locale=en`)
        .then((r) => r.json())
        .then((data) => {
            data.results = data.results.map((d) => {
                return Object.assign(
                d,
                {
                    ebird: iNatToEbird[d.taxon.id]
                })
            });
            return data;
        })
};

const getSpeciesInProject = ( project_id ) => {
    return fetchCache(`${SPECIES_API}?project_id=${project_id}&ttl=900&v=1630551347000&preferred_place_id=&locale=en`)
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
        return data.map((ebird) => Object.assign(ebird, {
            inat: ebirdToINat[ebird.speciesCode]
        }));
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

const getEbirdFromWikidata = ( qid ) => {
    return fetchCache(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
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
 */

function loadWikidataIds( mode = 'wikidata' ) {
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
                            console.warn( `${m.taxon.preferred_common_name} (${id}) has no Wikipedia page (${wiki})` );
                        }
                        return Promise.resolve( {
                            [id]: wikidata
                        } );
                    }
                } else if ( mode === 'ebird' ) {
                    if ( wikidata === false ) {
                        console.warn( `${m.taxon.preferred_common_name} (${id}) has no Wikidata`)
                        return Promise.resolve({
                            [id]: false
                        });
                    } else if ( iNatToEbird[id] ) {
                        return Promise.resolve({
                            [id]: iNatToEbird[id]
                        });
                    } else {
                        return getEbirdFromWikidata(wikidata).then((ebird) => {
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

                const newData = Object.assign(
                        {},
                        base,
                        Object.assign.apply(null, results)
                    );
                if ( mode === 'ebird' ) {
                    const ebirdToINat = {}
                    Object.keys(newData).forEach((key) => {
                        ebirdToINat[newData[key]] = key;
                    });
                    console.log(
                        JSON.stringify(ebirdToINat)
                    )
                }
                console.log(
                    JSON.stringify(newData)
                )
            });
        }
    });
}

export {
    loadWikidataIds,
    getEbirdObservations,
    getINatSpecies,
    getSpeciesInProject,
    getUserId, fetchCache, getAvatar
};
