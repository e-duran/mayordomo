"use strict";

exports.generate = function (req, res) {
    var Movie = require('../schemas/movie.js'),
        Rss = require('rss'),
        today = new Date(),
        markAsInterestingUrl = '{0}/processors/markAsInteresting/{1}',
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
        site_url: 'http://www.firstshowing.net/schedule' + today.getFullYear(),
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
    Movie.find().limit(20).sort('-createdAt').exec().then(function (movies) {
        for (i = 0; i < movies.length; i++) {
            movie = movies[i];
            description = content.format(movie.poster, movie.rated, movie.releasedDate.toDateString().substring(4), 
                                         !movie.runtimeInMinutes ? "N/A" : (movie.runtimeInMinutes + ' minutes'), 
                                         movie.genre, movie.director, movie.writer, movie.actors, movie.plot, movie.country, movie.awards);
            if (movie.needsReview) {
                description += "<p><strong>Some information of this movie needs to be reviewed.</strong>";
            } else {
                description += '<p><a href="{0}">Mark as interesting</a></p>'.format(markAsInterestingUrl.format(global.config.publicHost, movie.id));
            }
            feed.item({
                title:  movie.title,
                description: description,
                url: 'http://www.imdb.com/title/' + movie.imdbId,
                guid: movie.id,
                author: 'Mayordomo',
                date: movie.createdAt
            });
        }
        res.send(feed.xml({indent: true}));
    });
};