const cache = {};
const ebirdToken = process.env.EBIRD;
import ebirdToINat from './ebird-inat.json';
const SPECIES_API = 'https://api.inaturalist.org/v1/observations/species_counts';
import iNatToEbird from './inat-ebird.json';

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

export {
    getEbirdObservations,
    getINatSpecies,
    getSpeciesInProject,
    getUserId, fetchCache, getAvatar
};
