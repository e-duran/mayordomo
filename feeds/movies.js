"use strict";
function na(v) {
    return v || 'N/A';
}
exports.generate = function (req, res) {
    var Movie = require('../schemas/movie.js'),
        Rss = require('rss'),
        today = new Date(),
        markAsInterestingUrl = '{0}/processors/markAsInteresting/{1}',
        missingPoster = 'http://icons.iconarchive.com/icons/oxygen-icons.org/oxygen/256/Status-image-missing-icon.png',
        attributes,
        attributesOffset,
        i,
        content,
        description,
        movie,
        feed;
    res.type('xml');
    feed = new Rss({
        title: 'Movies',
        description: 'Calendar of nation-wide releases of movies to theaters',
        feed_url: '{0}/rss/movies'.format(global.config.publicHost),
        //site_url: 'http://www.firstshowing.net/schedule' + today.getFullYear(),
        site_url: 'http://www.movieinsider.com/movies/this-week/',
        image_url: 'http://icons.iconarchive.com/icons/fatcow/farm-fresh/32/movies-icon.png',
        language: 'en',
        pubDate: today
    });
    attributes = ['Rated', 'Released', 'Runtime', 'Genre', 'Director', 'Writer', 'Actors', 'Plot', 'Country', 'Awards'];
    content = '<p><img src="{0}"></p>';
    attributesOffset = 1;
    for (i = 0; i < attributes.length; i++) {
        content += '<strong>{0}</strong>: {1}<br/>'.format(attributes[i], '{' + (i + attributesOffset) + '}');
    }
    // Find the most recently created movies (don't use modified date because reviewed movies or movies changed via the UI would be included)
    Movie.find().sort('-createdAt').limit(20).exec().then(function (movies) {
        for (i = 0; i < movies.length; i++) {
            movie = movies[i];
            description = content.format(movie.poster || missingPoster, na(movie.rated), movie.releasedDate ? movie.releasedDate.toDateString().substring(4) : 'N/A', 
                                         movie.runtimeInMinutes ? (movie.runtimeInMinutes + ' minutes') : na(movie.duration), 
                                         na(movie.genre), na(movie.director), na(movie.writer), na(movie.actors), na(movie.plot), na(movie.country), na(movie.awards));
            if (movie.needsReview) {
                description += '<p><strong>Some information of this movie needs to be reviewed.</strong>';
            } else {
                description += '<p><a href="{0}">Mark as interesting</a></p>'.format(markAsInterestingUrl.format(global.config.publicHost, movie.id));
            }
            feed.item({
                title:  movie.title,
                description: description,
                url: movie.imdbId ? 'http://www.imdb.com/title/' + movie.imdbId : movie.movieInsiderUrl,
                guid: movie.id,
                author: 'Mayordomo',
                date: movie.modifiedAt || movie.createdAt // but use the modified date as the item/movie's publication date
            });
        }
        res.send(feed.xml({indent: true}));
    });
};