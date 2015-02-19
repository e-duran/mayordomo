"use strict";

exports.register = function (app) {
    var mongoose = require('mongoose'),
        Movie = require('../schemas/movie.js'),
        basePath = '/api/movies';

    app.get(basePath, function (req, res, next) {
        mongoose.connect(global.config.mongoUrl);
        mongoose.connection.on('error', function (connectionError) {
            res.status(500).send('Connection error: ' + connectionError.message);
            return;
        });
        Movie.find({ needsReview: false }).sort('-releasedDate').exec().then(function (movies) {
            res.json(movies);
            mongoose.connection.close();
        });
    });

    app.get(basePath + '/:id', function (req, res, next) {
        mongoose.connect(global.config.mongoUrl);
        mongoose.connection.on('error', function (connectionError) {
            res.status(500).send('Connection error: ' + connectionError.message);
            return;
        });
        Movie.findById(req.params.id, function (error, movie) {
            if (error) {
                res.status(500).send('Error: ' + error);
                return;
            }
            res.json(movie);
            mongoose.connection.close();
        });
    });

    app.put(basePath + '/:id', function (req, res, next) {
        mongoose.connect(global.config.mongoUrl);
        mongoose.connection.on('error', function (connectionError) {
            res.status(500).send('Connection error: ' + connectionError.message);
            return;
        });
        Movie.findByIdAndUpdate(req.params.id, { $set: req.body }, function (error, movie) {
            if (error) {
                res.status(500).send('Error: ' + error);
                return;
            }
            res.json(movie);
            mongoose.connection.close();
        });
    });

    app.delete(basePath + '/:id', function (req, res, next) {
        mongoose.connect(global.config.mongoUrl);
        mongoose.connection.on('error', function (connectionError) {
            res.status(500).send('Connection error: ' + connectionError.message);
            return;
        });
        Movie.findByIdAndRemove(req.params.id, function (error) {
            if (error) {
                res.status(500).send('Error: ' + error);
                return;
            }
            res.end();
            mongoose.connection.close();
        });
    });
};