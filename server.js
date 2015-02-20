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

var env = process.env.NODE_ENV || "c9";
var config = require(__dirname + '/config/' + env + '.js');
global.config = config;

var express = require('express');
var app = express();

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    if ('OPTIONS' === req.method) {
        res.send(200);
    } else {
        next();
    }
});

app.disable('strict routing');
app.get('/ui', function (req, res) {
    res.redirect('/ui/index.html');
});
app.use('/ui/', express.static(__dirname + '/ui'));

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

var movieApi = require('./api/movies');
movieApi.register(app);

app.listen(config.port, config.host);
console.log('Express server for Mayordomo started on port %s', config.port);