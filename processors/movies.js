"use strict";

function requestMovieCalendar(request) {
    var today = new Date(),
        thisYear = today.getFullYear(),
        thisMonth = today.getMonth() + 1,
        nextMonth = today.getMonth() + 2,
        day = nextMonth === 12 ? "31" : "01",
        movieCalendar = 'https://www.google.com/calendar/feeds/pfutdblf1gi8jmfsvroh76f6jg%40group.calendar.google.com/public/basic?start-min={0}-{1}-01T00:00:00&start-max={0}-{2}-{3}T00:00:00&orderby=starttime&sortorder=a';

    thisMonth = thisMonth < 10 ? '0' + thisMonth : thisMonth;
    nextMonth = nextMonth === 13 ? 12 : nextMonth;
    nextMonth = nextMonth < 10 ? '0' + nextMonth : nextMonth;
    movieCalendar = movieCalendar.format(thisYear, thisMonth, nextMonth, day);

    return request(movieCalendar);
}

function processMovieRequests(res, promise, movies, Movie, movieTitles, movieRequestResults) {
    var findMoviePromises = movieRequestResults.map(function (movieRequestResult, index) {
        var errorMessage,
            resultValue,
            movieResponse,
            movieResponseBody,
            movie;

        if (movieRequestResult.isFulfilled()) {
            resultValue = movieRequestResult.value();
            movieResponse = resultValue[0];
            movieResponseBody = resultValue[1];
            if (movieResponse.statusCode !== 200) {
                errorMessage = "Cannot retrieve movie information for '{0}' via GET request, got status code: {0}\r\n".format(movieTitles[index], movieResponse.statusCode);
                res.write(errorMessage);
                return promise.reject(errorMessage);
            }
            movie = JSON.parse(movieResponseBody);
            if (movie.Response) {
                movies[index] = movie;
                return Movie.findOne({ imdbID: movie.imdbID }).exec();
            }
            errorMessage = "Movie information for '{0}' was not found at OMDb\r\n".format(movieTitles[index]);
            res.write(errorMessage);
            return promise.reject({ handled: true });
        }
        errorMessage = "Cannot retrieve movie information for '{0}' via GET request, got error: {1}\r\n".format(movieTitles[index], movieRequestResult.reason());
        res.write(errorMessage);
        return promise.reject({ handled: true });
    });
    return findMoviePromises;
}

function saveMovies(res, promise, movies, Movie, findMoviePromiseResults) {
    var createMoviePromises = findMoviePromiseResults.map(function (findMovieResult, index) {
        var errorMessage,
            rejectionReason,
            movieExistsInStore,
            movie = movies[index];
        if (findMovieResult.isFulfilled()) {
            movieExistsInStore = findMovieResult.value() !== null;
            if (movieExistsInStore) {
                errorMessage = "Movie '{0}' already exists\r\n".format(movie.Title);
                res.write(errorMessage);
                return promise.resolve({ movieExists: true });
            }
            return Movie.create(movie);
        }
        rejectionReason = findMovieResult.reason();
        if (rejectionReason.handled === undefined) {
            errorMessage = "Error while finding movie '{0}': {1}\r\n".format(movie.Title, rejectionReason);
            res.write(errorMessage);
        }
        return promise.reject({ handled: true });
    });
    return createMoviePromises;
}

function processMovieCalendar(res, request, promise, calendarResponse, calendarBody) {
    var xpath = require('xpath'),
        Dom = require('xmldom').DOMParser,
        mongoose = require('mongoose'),
        Movie = require('../schemas/movie.js'),
        movieInfo = 'http://www.omdbapi.com/?t={0}&type=movie&plot=full&r=json',
        movies = [],
        doc,
        select,
        nodes,
        db,
        movieTitles,
        movieRequests;

    if (calendarResponse.statusCode !== 200) {
        res.write("Cannot retrieve movie calendar via GET request, got status code: " + calendarResponse.statusCode);
        res.end();
        return;
    }

    res.write("Retrieved movie calendar via GET request\r\n");
    doc = new Dom().parseFromString(calendarBody);
    select = xpath.useNamespaces({"atom": "http://www.w3.org/2005/Atom"});
    nodes = select('//atom:feed/atom:entry/atom:title/text()', doc);
    if (nodes === null || (nodes !== null && nodes.length === 0)) {
        res.write("Cannot find movie entries in calendar feed");
        res.end();
        return;
    }
    mongoose.connect(global.config.mongoUrl);
    db = mongoose.connection;
    movieTitles = nodes.map(function (titleNode) { return titleNode.nodeValue; });
    movieRequests = movieTitles.map(function (movieTitle) {
        return request(movieInfo.format(movieTitle));
    });
    promise.settle(movieRequests).then(function (movieRequestResults) {
        return processMovieRequests(res, promise, movies, Movie, movieTitles, movieRequestResults);
    }).settle().then(function (findMoviePromiseResults) {
        return saveMovies(res, promise, movies, Movie, findMoviePromiseResults);
    }).settle().then(function (createMoviePromisesResults) {
        createMoviePromisesResults.map(function (createMoviePromisesResult, index) {
            var resultValue,
                rejectionReason;
            if (createMoviePromisesResult.isFulfilled()) {
                resultValue = createMoviePromisesResult.value();
                if (resultValue.movieExists === undefined) {
                    res.write("Movie '{0}' created\r\n".format(movies[index].Title));
                }
            } else {
                rejectionReason = createMoviePromisesResult.reason();
                if (rejectionReason.handled === undefined) {
                    res.write("Error while creating movie '{0}': {1}\r\n".format(movies[index].Title), rejectionReason);
                }
            }
        });
        db.close();
        res.write("Finished processing movie calendar\r\n");
        res.end();
    });
}

exports.execute = function (req, res) {
    var promise = require("bluebird"),
        request = promise.promisify(require('request'));
    res.type('text');
    requestMovieCalendar(request).spread(function (calendarResponse, calendarBody) {
        processMovieCalendar(res, request, promise, calendarResponse, calendarBody);
    }).catch(function (calendarRequestError) {
        res.write("Cannot retrieve movie calendar via GET request, got error " + calendarRequestError);
        res.end();
    });
};