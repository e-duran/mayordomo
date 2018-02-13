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

var port = process.env.PORT || 8080,
    ip = process.env.IP   || '0.0.0.0',
    mongoURL = process.env.MONGO_URL;

global.getConnection = async function (res) {
    const MongoClient = require('mongodb').MongoClient;
    let client = await MongoClient.connect(mongoURL);
    let db = client.db('mayordomo');
    return { client: client, db: db };
};
global.getConfig = async function () {
    let connection = await global.getConnection();
    const configs = await connection.db.collection('configs');
    let config = await configs.findOne({});
    connection.client.close();
    return config;
};

var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var app = express();
app.use(morgan('tiny'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(favicon('favicon.ico'));
app.disable('strict routing');

app.get('/ui', function (req, res) {
    res.redirect('/ui/index.html');
});
app.use('/ui/', express.static(__dirname + '/ui'));

var processorsMap = {
    blush: '/processors/blush',
    movies: '/processors/newMovies',
    stocks: '/processors/stocks',
    supercuts: '/processors/supercuts'
};
global.processorsMap = processorsMap;

var reloadConfigProcessor = require('./processors/reloadConfig.js');
app.get('/processors/reloadConfig', reloadConfigProcessor.execute);

app.use(function (err, req, res, next) {
    if(!err) return next();
    console.log('Unhandled exception: ' + err);
    return next(err);
});

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