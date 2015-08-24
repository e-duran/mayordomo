"use strict";

function updateMovie(movie, movieInfo) {
    var today = new Date(),
        none = 'N/A';
    movie.awards = movieInfo.Awards;
    movie.metascore = movieInfo.Metascore === none ? null : Number(movieInfo.Metascore);
    movie.imdbRating = movieInfo.imdbRating === none ? null : Number(movieInfo.imdbRating);
    movie.imdbVotes = movieInfo.imdbVotes === none ? null : Number(movieInfo.imdbVotes.replace(',', ''));
    movie.tomatoMeter = movieInfo.tomatoMeter === none ? null : Number(movieInfo.tomatoMeter);
    movie.tomatoImage = movieInfo.tomatoImage;
    movie.tomatoRating = movieInfo.tomatoRating === none ? null : Number(movieInfo.tomatoRating);
    movie.tomatoReviews = movieInfo.tomatoReviews === none ? null : Number(movieInfo.tomatoReviews);
    movie.tomatoFresh = movieInfo.tomatoFresh === none ? null : Number(movieInfo.tomatoFresh);
    movie.tomatoRotten = movieInfo.tomatoRotten === none ? null : Number(movieInfo.tomatoRotten);
    movie.tomatoConsensus = movieInfo.tomatoConsensus;
    movie.tomatoUserMeter = movieInfo.tomatoUserMeter === none ? null : Number(movieInfo.tomatoUserMeter);
    movie.tomatoUserRating = movieInfo.tomatoUserRating === none ? null : Number(movieInfo.tomatoUserRating);
    movie.tomatoUserReviews = movieInfo.tomatoUserReviews === none ? null : Number(movieInfo.tomatoUserReviews.replace(',', ''));
    movie.releasedToDvdDate = movieInfo.DVD === none ? null : new Date(movieInfo.DVD);
    movie.producer = movieInfo.Production;
    movie.webSite = movieInfo.Website;
    movie.modifiedAt = today;
    movie.postProcessedAt = today;
    movie.postProcessingCompleted = !movie.releasedToDvdDate ? false : true;
    return movie;
}

function processMovieInfoRequests(res, Promise, movies, movieInfoRequestResults) {
    var promises = movieInfoRequestResults.map(function (movieRequestResult, index) {
        var errorMessage,
            resultValue,
            movieResponse,
            movieResponseBody,
            movieInfo,
            movie;

        movie = movies[index];
        if (movieRequestResult.isFulfilled()) {
            resultValue = movieRequestResult.value();
            movieResponse = resultValue[0];
            movieResponseBody = resultValue[1];
            if (movieResponse.statusCode !== 200) {
                errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got status code: {0}\r\n'.format(movie.title, movieResponse.statusCode);
                res.write(errorMessage);
                return Promise.reject(errorMessage);
            }
            movieInfo = JSON.parse(movieResponseBody);
            if (movieInfo.Response) {
                movie = updateMovie(movie, movieInfo);
                return Promise.resolve(movie);
            }
            errorMessage = 'Movie information for "{0}" was not found at the Open Movie Database (OMDb)\r\n'.format(movie.title);
            res.write(errorMessage);
            return Promise.reject({ handled: true });
        }
        errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got: {1}\r\n'.format(movie.title, movieRequestResult.reason());
        res.write(errorMessage);
        return Promise.reject({ handled: true });
    });
    return promises;
}

exports.execute = function (req, res) {
    var Promise = require("bluebird"),
        request = Promise.promisify(require('request')),
        Movie = require('../schemas/movie.js'),
        cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180);
    res.type('text');
    Movie.find({ needsReview: false, postProcessingCompleted: false, createdAt: { $gt: cutoff } }).exec().then(function (movies) {
        res.write('Movies to be post-processed: {0}\r\n'.format(movies.length));
        var movieInfoRequests = movies.map(function (movie) {
            return request('http://www.omdbapi.com/?i={0}&plot=full&r=json&tomatoes=true'.format(movie.imdbId));
        });
        Promise.settle(movieInfoRequests).then(function (movieInfoRequestResults) {
            return processMovieInfoRequests(res, Promise, movies, movieInfoRequestResults);
        }).then(function (postProcessResults) {
            return postProcessResults.map(function (postProcessResult, index) {
                var movie,
                    rejectionReason,
                    saveMovie;
                if (postProcessResult.isFulfilled()) {
                    movie = postProcessResult.value();
                    saveMovie = Promise.promisify(movie.save, movie);
                    return saveMovie();
                }
                rejectionReason = postProcessResult.reason();
                if (rejectionReason.handled === undefined) {
                    res.write('Error while saving additional information for movie "{0}": {1}\r\n'.format(movies[index].title), rejectionReason);
                }
                return Promise.reject({ handled: true });
            });
        }).settle().then(function (saveResults) {
            saveResults.map(function (saveResult, index) {
                var movie;
                if (saveResult.isRejected()) {
                    res.write('Error while saving additional information for movie "{0}": {1}\r\n'.format(movies[index].title), saveResult.reason());
                    return;
                }
                movie = saveResult.value()[0];
                if (movie.postProcessingCompleted) {
                    res.write('Saved latest information as a result of succesfully post-processing movie "{0}"\r\n'.format(movie.title));
                    return;
                }
                res.write('Saved latest information but post-procesing is not complete for movie "{0}"\r\n'.format(movie.title));
            });
            res.end();
        });
    });
};