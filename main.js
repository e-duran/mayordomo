"use strict";

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match;
    });
  };
}

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

var test = require('./test');
app.get('/test', test.handle);

var models = require("./models");
models.sequelize.sync({ force: false }).then(function () {
    app.listen(process.env.PORT);
});

console.log('Express server for Mayordomo started on port %s', process.env.PORT);