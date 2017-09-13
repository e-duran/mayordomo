"use strict";

exports.register = function (app) {
    var Movie = require('../schemas/movie.js'),
        basePath = '/api/movies';

    app.get(basePath, function (req, res) {
        var db = global.getDB(res);
        Movie = db.model('Movie');
        Movie.find({ needsReview: false }).sort('-releasedDate').exec(function (error, movies) {
            if (error) {
                res.status(500).type('text').send('Error: ' + error);
                return;
            }
            res.json(movies);
        });
    });

    app.get(basePath + '/:id', function (req, res) {
        var db = global.getDB(res);
        Movie = db.model('Movie');
        Movie.findById(req.params.id, function (error, movie) {
            if (error) {
                res.status(500).type('text').send('Error: ' + error);
                return;
            }
            res.json(movie);
        });
    });

    app.post(basePath + '/missing/', function (req, res) {
        var db = global.getDB(res);
        Movie = db.model('Movie');
        var request = require('request'),
            imdbId = req.body.imdbId;
        if (!imdbId) {
            res.status(400).type('text').send("Missing value for property 'imdbId' in request body");
        }
        Movie.findOne({ imdbId: imdbId }, function (error, movie) {
            if (error) {
                res.status(500).type('text').send("Error while checking if movie with IMDb ID {0} exists: {1}".format(imdbId, error));
                return;
            }
            if (movie) {
                res.status(409).type('text').send("A movie with IMDb ID {0} already exists".format(imdbId, error));
                return;
            }
            request('http://www.omdbapi.com/?i={0}&plot=full&r=json'.format(imdbId), function (error, response, body) {
                var movieInfo,
                    newMovie,
                    movieProcessor = require('../processors/movies');
                if (error) {
                    res.type('text').send('Error while requesting movie info: ' + error);
                    return;
                }
                if (response.statusCode !== 200) {
                    res.type('text').send('Error while requesting movie info, got status code: ' + response.statusCode);
                    return;
                }
                movieInfo = JSON.parse(body);
                if (movieInfo.Response) {
                    newMovie = movieProcessor.getMovieDocument(Movie, movieInfo);
                    Movie.create(newMovie, function (error, createdMovie) {
                        if (error) {
                            res.status(500).type('text').send("Error while creating movie: " + error);
                            return;
                        }
                        res.json(createdMovie);
                    });
                } else {
                    res.type('text').send("The Open Movie Database does not have information about the movie");
                }
            });
        });
    });

    app.put(basePath + '/:id', function (req, res) {
        var db = global.getDB(res);
        Movie = db.model('Movie');
        delete req.body._id;
        req.body.modifiedAt = new Date();
        Movie.findByIdAndUpdate(req.params.id, { $set: req.body }, function (error, movie) {
            if (error) {
                res.status(500).send('Error: ' + error);
                return;
            }
            res.json(movie);
        });
    });

    app.delete(basePath + '/:id', function (req, res) {
        var db = global.getDB(res);
        Movie = db.model('Movie');
        Movie.findByIdAndRemove(req.params.id, function (error) {
            if (error) {
                res.status(500).send('Error: ' + error);
                return;
            }
            res.end();
        });
    });
};