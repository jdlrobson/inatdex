const cache = {};

const fetchCache = (url) => {
    if ( !cache[url] ) {
        cache[url] = fetch(url).then((r) => {
            return r.json();
        });
    }
    return cache[url];
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

export {
    getUserId, fetchCache, getAvatar
};
