const cache = {};
const ebirdToken = process.env.EBIRD;
const SPECIES_API = 'https://api.inaturalist.org/v1/observations/species_counts';
import iNatToEbird from './inat-ebird.json';
import iNatToWikidata from './inat-wikidata.json';
import inatlogo from './inatlogo.png';

const invertObj = (obj) => {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
        newObj[obj[key]] = key
    });
    return newObj;
}
const ebirdToINat = invertObj(iNatToEbird);
// special cases:
ebirdToINat['reevir1'] = 891704;

const SF_PROJECT = 'birds-of-san-francisco-excluding-farallon-islands';

const fetchCache = (url, options) => {
    if ( !cache[url] ) {
        cache[url] = fetch(url, options).then((r) => {
            return r.json();
        });
    }
    return cache[url];
};

const getINatSpecies = ( project_id, username ) => {
    return fetch(`${SPECIES_API}?verifiable=true&project_id=${project_id}&user_id=${username}&locale=en`)
        .then((r) => r.json())
        .then((data) => {
            data.results = data.results.map((d) => {
                const ebird = iNatToEbird[d.taxon.id];
                return Object.assign(
                d,
                { ebird })
            });
            return data;
        })
};

const getSpeciesInProject = ( project_id ) => {
    const foundSpecies = [];
    return fetchCache(`${SPECIES_API}?project_id=${project_id}&ttl=900&v=1630551347000&preferred_place_id=&locale=en`)
        .then((data) => {
            if ( project_id === SF_PROJECT ) {
                data.results.forEach((d) => {
                    const ebird = iNatToEbird[d.taxon.id];
                    foundSpecies.push( ebird );
                });
                return getEbirdObservations().then((d) => {
                    const additionial = d.filter((ebird) =>
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
                });
            }
            return data;
        } );
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
                    /(auto selected|farallon islands)/
                // cross species are too complicated for now.
                ) && ebird.speciesCode.charAt(0) !== 'x' &&
                // make sure they are valid observations.
                ebird.obsValid
        } ).map((ebird) => {
            if(!ebirdToINat[ebird.speciesCode]) {
                console.warn( `Missing ebird to iNat ${ebird.speciesCode}.`)
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
                console.log(
                    JSON.stringify(newData)
                )
            });
        }
    });
}

export {
    SF_PROJECT,
    loadWikidataIds,
    getEbirdObservations,
    getINatSpecies,
    getSpeciesInProject,
    getUserId, fetchCache, getAvatar
};
