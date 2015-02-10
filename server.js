"use strict";

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{(\d+)\}/g, function (match, number) {
        return args[number] !== undefined ? args[number] : match;
    });
};
Date.prototype.isValid = function () {
    if (Object.prototype.toString.call(this) !== "[object Date]") {
        return false;
    }
    return !isNaN(this.getTime());
};

var express = require('express');
var app = express();

app.use(express.logger());

var blushProcessor = require('./processors/blush');
app.get('/processors/blush', blushProcessor.execute);
var blushFeed = require('./feeds/blush');
app.get('/rss/blush', blushFeed.generate);

var moviesProcessor = require('./processors/movies');
app.get('/processors/movies', moviesProcessor.execute);
var moviesFeed = require('./feeds/movies');
app.get('/rss/movies', moviesFeed.generate);
var interestingMovieProcessor = require('./processors/interestingMovie');
app.get('/processors/markAsInteresting/:id', interestingMovieProcessor.execute);
var moviesOnDvdProcessor = require('./processors/moviesOnDvd');
app.get('/processors/moviesOnDvd', moviesOnDvdProcessor.execute);

var env = process.env.NODE_ENV || "c9";
var config = require(__dirname + '/config/' + env + '.js');
global.config = config;

app.listen(config.port, config.host);
console.log('Express server for Mayordomo started on port %s', config.port);