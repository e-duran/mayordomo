"use strict";

exports.generate = function (req, res) {
    var mongoose = require('mongoose'),
        Movie = require('../schemas/movie.js'),
        Rss = require('rss'),
        today = new Date(),
        noPoster = 'http://www.sourcecreative.net/wp-content/uploads/2013/11/values-are-not-a-poster.jpg',
        addToWatchListUrl = '{0}/processors/addToWatchList/{1}',
        attributes,
        attributesOffset,
        i,
        content,
        movie,
        feed;
    res.type('xml');
    feed = new Rss({
        title: 'Movies',
        description: "Calendar of movies' releases",
        feed_url: '{0}/rss/movies'.format(global.config.publicHost),
        site_url: 'http://www.firstshowing.net/schedule' + today.getFullYear(),
        image_url: 'http://media2.firstshowing.net/firstshowing/images/FirstShowing-MinLogoRcopv1-12.png',
        language: 'en',
        pubDate: today
    });

    mongoose.connect(global.config.mongoUrl);
    attributes = ['Rated', 'Runtime', 'Genre', 'Director', 'Writer', 'Actors', 'Plot', 'Country', 'Awards'];
    content = '<p><img src="{0}"></p>';
    attributesOffset = 1;
    for (i = 0; i < attributes.length; i++) {
        content += '{0}: {1}<br/>'.format(attributes[i], '{' + (i + attributesOffset) + '}');
    }
    content += '<p><a href="{' + (attributesOffset + attributes.length) + '}">Add to Watch list</a></p>';
    Movie.find().limit(20).sort('-createdAt').exec().then(function (movies) {
        for (i = 0; i < movies.length; i++) {
            movie = movies[i].toObject(); // Required because schema doesn't have all attributes defined in it
            feed.item({
                title:  movie.Title,
                description: content.format(movie.Poster === "N/A" ? noPoster : movie.Poster, movie.Rated, movie.Runtime, movie.Genre, movie.Director, movie.Writer, movie.Actors, movie.Plot, movie.Country, movie.Awards, addToWatchListUrl.format(global.config.publicHost, movies[i].id)),
                url: 'http://www.imbd.com/title/' + movie.imdbID,
                guid: movies[i].id,
                author: 'Mayordomo',
                date: movie.createdAt
            });
        }
        mongoose.connection.close();
        res.send(feed.xml({indent: true}));
    });
};