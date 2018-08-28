'use strict';

function na(v) {
    return v || 'N/A';
}

exports.generate = async function (req, res) {
    var movieStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        
        var Rss = require('rss');
        var feed = new Rss({
            title: 'Movies',
            description: 'Calendar of movies releases to theaters',
            feed_url: `${config.publicHost}/rss/movies`,
            site_url: 'http://www.movieinsider.com/movies/this-week/',
            image_url: config.moviesFeedImageUrl,
            language: 'en',
            pubDate: new Date()
        });
        
        var attributes = ['Rated', 'Released', 'Release type', 'Runtime', 'Genre', 'Director', 'Writer', 'Actors', 'Plot'];
        var content = '<p><img src="{0}"></p>';
        var attributesOffset = 1;
        for (let i = 0; i < attributes.length; i++) {
            content += '<strong>{0}</strong>: {1}<br/>'.format(attributes[i], '{' + (i + attributesOffset) + '}');
        }
        
        movieStore = await global.getStore('movies');
        var movies = await movieStore.find().sort('createdAt', -1).limit(40).toArray();
        movieStore.client.close();
        for (let i = 0; i < movies.length; i++) {
            var movie = movies[i];
            var markAsInterestingUrl = `${config.publicHost}/processors/markAsInteresting/${movie._id}`;
            var description = content.format(movie.poster || config.missingPosterUrl, na(movie.rated), movie.releasedDate ? movie.releasedDate.toDateString().substring(4) : 'N/A', 
                                         na(movie.releaseScope), movie.runtimeInMinutes ? (movie.runtimeInMinutes + ' minutes') : na(movie.duration), 
                                         na(movie.genre), na(movie.director), na(movie.writer), na(movie.actors), na(movie.plot));
            if (movie.needsReview) {
                description += '<p><strong>Some information of this movie needs to be reviewed.</strong>';
            } else {
                description += `<p><a href="${markAsInterestingUrl}">Mark as interesting</a></p>`;
            }
            feed.item({
                title:  movie.title,
                description: description,
                url: movie.imdbId ? 'http://www.imdb.com/title/' + movie.imdbId : movie.movieInsiderUrl,
                guid: movie._id.toString(),
                author: 'Mayordomo',
                date: movie.modifiedAt || movie.createdAt // but use the modified date as the item/movie's publication date
            });
        }
        
        res.type('xml');
        res.send(feed.xml({ indent: true }));
    } catch (e) {
        res.type('text/plain; charset=utf-8');
        global.log(res, 'Exception', e);
        if (movieStore) {
            movieStore.client.close();
        }
    }
};
