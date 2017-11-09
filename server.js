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
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     'use strict';
     if (this == null) {
       throw new TypeError('Array.prototype.find called on null or undefined');
     }
     if (typeof predicate !== 'function') {
       throw new TypeError('predicate must be a function');
     }
     var list = Object(this);
     var length = list.length >>> 0;
     var thisArg = arguments[1];
     var value;

     for (var i = 0; i < length; i++) {
       value = list[i];
       if (predicate.call(thisArg, value, i, list)) {
         return value;
       }
     }
     return undefined;
    }
  });
}

var port = process.env.PORT || 8080,
    ip = process.env.IP   || '0.0.0.0',
    mongoURL = process.env.MONGO_URL;
if (!mongoURL && process.env.DATABASE_SERVICE_NAME) {
    mongoURL = 'mongodb://';
    var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
        mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
        mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
        mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
        mongoPassword = process.env[mongoServiceName + '_PASSWORD'],
        mongoUser = process.env[mongoServiceName + '_USER'];
    
    if (mongoHost && mongoPort && mongoDatabase) {
        if (mongoUser && mongoPassword) {
            mongoURL += mongoUser + ':' + mongoPassword + '@';
        }
        mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;
    }
}
global.mongoURL = mongoURL + '?connectTimeoutMS=2000&retries=1&reconnectWait=500';
global.getDB = function (res) {
    var mongoose = require('mongoose');
    var db = mongoose.createConnection(global.mongoURL);
    db.on('error', function (connectionError) {
        var msg = 'DB Connection ' + connectionError;
        console.log(msg);
        if (db.readyState === 0 && res) {
            res.send(msg);
        }
    });
    return db;
};
global.getConfig = function () {
    var Promise = require('bluebird');
    if (global.config) return Promise.resolve(global.config);
    var db = global.getDB();
    var Config = require('./schemas/config.js');
    Config = db.model('Config');
    return Config.findOne().exec().then(function (config) {
        db.close();
        global.config = config;
        return Promise.resolve(config);
    });
};

var express = require('express');
var app = express();
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.disable('strict routing');

app.get('/ui', function (req, res) {
    res.redirect('/ui/index.html');
});
app.use('/ui/', express.static(__dirname + '/ui'));
app.use(express.favicon("favicon.ico"));

var processorsMap = {
    blush: '/processors/blush',
    movies: '/processors/newMovies',
    stocks: '/processors/stocks',
    supercuts: '/processors/supercuts'
};
global.processorsMap = processorsMap;
var blushProcessor = require('./processors/blush');
app.get(processorsMap.blush, blushProcessor.execute);
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
var newMoviesProcessor = require('./processors/newMovies');
app.get(processorsMap.movies, newMoviesProcessor.execute);

var stockProcessor = require('./processors/stocks');
app.get(processorsMap.stocks, stockProcessor.execute);

var supercutsProcessor = require('./processors/supercuts');
app.get(processorsMap.supercuts, supercutsProcessor.execute);

var taskProcessor = require('./processors/task.js');
app.get('/processors/task', taskProcessor.execute);

var reloadConfigProcessor = require('./processors/reloadConfig.js');
app.get('/processors/reloadConfig', reloadConfigProcessor.execute);

var movieApi = require('./api/movies');
movieApi.register(app);

app.use(function (err, req, res, next) {
    if(!err) return next();
    console.log('Unhandled exception: ' + err);
    return next(err);
});

app.listen(port, ip);
console.log('Express server for Mayordomo started on port %s', port);

global.getConfig();