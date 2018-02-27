'use strict';

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{(\d+)\}/g, function (match, number) {
        return args[number] !== undefined ? args[number] : match;
    });
};
Date.prototype.isValid = function () {
    if (Object.prototype.toString.call(this) !== '[object Date]') {
        return false;
    }
    return !isNaN(this.getTime());
};

global.getStore = async function (collectionName) {
    const MongoClient = require('mongodb').MongoClient;
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db('mayordomo');
    if (collectionName) {
        const collection = db.collection(collectionName);
        collection.client = client;
        return collection;
    }
    return { client: client, db: db };
};
global.getConfig = async function () {
    const configStore = await global.getStore('configs');
    const config = await configStore.findOne();
    configStore.client.close();
    return config;
};
global.log = function (res, message, error) {
    res.write(message);
    if (error) {
        res.write(' - ' + (error.stack ? error.stack : error));
        res.end();
    } else {
        res.write('\r\n');
    }
};
global.jsonApiError = function (res, store, e, status, title, detail, source) {
    if (store) {
        store.client.close();
    }
    var error = {
        status: status || 500,
        title: title || 'Unhandled exception',
        detail: detail || e.toString(),
        source: source
    };
    res.status(status || 500);
    res.json({ errors: [ error ] });
};

var port = process.env.PORT || 8080;
var ip = process.env.IP   || '0.0.0.0';
var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var app = express();
var dateToken = process.env.LOG_DATE === 'true' ? '[:date[iso]] ' : '';
var logTokens = `${dateToken}":method :url" :status :res[content-length] ":response-time ms" ":referrer" ":user-agent"`;
app.use(morgan(logTokens));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(favicon('favicon.ico'));
app.disable('strict routing');

if (process.env.ALLOW_CORS === 'true') {
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
}

app.get('/ui', function (req, res) {
    res.redirect('/ui/index.html');
});
app.use('/ui/', express.static(__dirname + '/ui'));

app.use('/ux/', express.static(__dirname + '/ux'));

app.use(function (err, req, res, next) {
    if(!err) return next();
    console.log('Unhandled exception: ' + err);
    return next(err);
});

var processorsMap = {
    blush: '/processors/blush',
    movies: '/processors/movies',
    moviesOnDvd: '/processors/moviesOnDvd',
    stocks: '/processors/stocks',
    supercuts: '/processors/supercuts'
};
global.processorsMap = processorsMap;

var reloadConfigProcessor = require('./processors/reloadConfig.js');
app.get('/processors/reloadConfig', reloadConfigProcessor.execute);

var blushProcessor = require('./processors/blush');
app.get(processorsMap.blush, blushProcessor.execute);
var blushFeed = require('./feeds/blush');
app.get('/rss/blush', blushFeed.generate);

var moviesProcessor = require('./processors/movies');
app.get(processorsMap.movies, moviesProcessor.execute);
var moviesOnDvdProcessor = require('./processors/moviesOnDvd');
app.get(processorsMap.moviesOnDvd, moviesOnDvdProcessor.execute);
var interestingMovieProcessor = require('./processors/interestingMovie');
app.get('/processors/markAsInteresting/:id', interestingMovieProcessor.execute);
var moviesFeed = require('./feeds/movies');
app.get('/rss/movies', moviesFeed.generate);

var stockProcessor = require('./processors/stocks');
app.get(processorsMap.stocks, stockProcessor.execute);

var supercutsProcessor = require('./processors/supercuts');
app.get(processorsMap.supercuts, supercutsProcessor.execute);

var taskProcessor = require('./processors/task.js');
app.get('/processors/task', taskProcessor.execute);

var movieApi = require('./api/movies');
movieApi.register(app);
var videoApi = require('./api/videos');
videoApi.register(app);
var logsApi = require('./api/logs');
logsApi.register(app);

app.listen(port, ip, null, async function() {
    console.log('Started Express server for Mayordomo on IP %s and port %s', ip, port);
    try {
        global.config = null;
        let config = await global.getConfig();
        if (config) {
            global.config = config;
            console.log('Configuration loaded');
        }
    } catch (e) {
        console.log('Cannot retrieve configuration - %s', e);
    }
});
