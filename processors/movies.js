"use strict";

function requestMovieCalendar(request, startDate, endDate) {
    var today = new Date(),
        thisYear = today.getFullYear(),
        thisMonth = today.getMonth() + 1,
        nextMonth = thisMonth + 1,
        day,
        startMin,
        startMax,
        timePart = 'T00:00:00',
        movieCalendar = 'https://www.google.com/calendar/feeds/pfutdblf1gi8jmfsvroh76f6jg%40group.calendar.google.com/public/basic?start-min={0}&start-max={1}&orderby=starttime&sortorder=a';

    nextMonth = nextMonth === 13 ? 12 : nextMonth;
    day = nextMonth === 12 ? '31' : '01';
    thisMonth = thisMonth < 10 ? '0' + thisMonth : thisMonth;
    nextMonth = nextMonth < 10 ? '0' + nextMonth : nextMonth;

    if (startDate) {
        startMin = startDate + timePart;
    } else {
        startMin = '{0}-{1}-01'.format(thisYear, thisMonth) + timePart;
    }
    if (endDate) {
        startMax = endDate + timePart;
    } else {
        startMax = '{0}-{1}-{2}'.format(thisYear, nextMonth, day) + timePart;
    }
    movieCalendar = movieCalendar.format(startMin, startMax);

    return request(movieCalendar);
}

var getMovieDocument = function (Movie, movieInfo, firstShowingUrl) {
    var none = 'N/A',
        noPoster = 'http://www.sourcecreative.net/wp-content/uploads/2013/11/values-are-not-a-poster.jpg',
        previousYear = new Date().getFullYear() - 1,
        movie,
        runtimeInMinutes,
        runtimeInMinutesEndIndex;
    runtimeInMinutes = movieInfo.Runtime === none ? null : movieInfo.Runtime;
    if (runtimeInMinutes !== null) {
        runtimeInMinutesEndIndex = runtimeInMinutes.indexOf(' ');
        if (runtimeInMinutesEndIndex > 0) {
            runtimeInMinutes = Number(runtimeInMinutes.substring(0, runtimeInMinutesEndIndex));
            if (isNaN(runtimeInMinutes)) {
                runtimeInMinutes = null;
            }
        }
    }
    movie = new Movie({
        title: movieInfo.Title,
        year: movieInfo.Year === none ? null : Number(movieInfo.Year),
        rated: movieInfo.Rated,
        releasedDate: movieInfo.Released === none ? null : new Date(movieInfo.Released),
        runtimeInMinutes: runtimeInMinutes,
        genre: movieInfo.Genre,
        director: movieInfo.Director,
        writer: movieInfo.Writer,
        actors: movieInfo.Actors,
        plot: movieInfo.Plot,
        language: movieInfo.Language,
        country: movieInfo.Country,
        awards: movieInfo.Awards,
        poster: movieInfo.Poster === none ? noPoster : movieInfo.Poster,
        imdbId: movieInfo.imdbID,
        firstShowingUrl: firstShowingUrl
    });
    if (isNaN(movie.year)) {
        movie.year = null;
    }
    if (!movie.releasedDate.isValid()) {
        movie.releasedDate = null;
    }
    if (movie.year === null || movie.releasedDate === null || movie.runtime === null || movie.year < previousYear || movie.imdbId.substring(0, 2).toLowerCase() !== 'tt') {
        movie.needsReview = true;
    }
    return movie;
};

function processMovieRequests(res, Promise, movies, Movie, movieTitles, firstShowingUrls, movieRequestResults) {
    var findMoviePromises = movieRequestResults.map(function (movieRequestResult, index) {
        var errorMessage,
            resultValue,
            movieResponse,
            movieResponseBody,
            movieInfo;

        if (movieRequestResult.isFulfilled()) {
            resultValue = movieRequestResult.value();
            movieResponse = resultValue[0];
            movieResponseBody = resultValue[1];
            if (movieResponse.statusCode !== 200) {
                errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got status code: {0}\r\n'.format(movieTitles[index], movieResponse.statusCode);
                res.write(errorMessage);
                return Promise.reject(errorMessage);
            }
            movieInfo = JSON.parse(movieResponseBody);
            if (movieInfo.Response) {
                movies[index] = getMovieDocument(Movie, movieInfo, firstShowingUrls[index]);
                return Movie.findOne({ imdbId: movies[index].imdbId }).exec();
            }
            errorMessage = 'Movie information for "{0}" was not found at the Open Movie Database (OMDb)\r\n'.format(movieTitles[index]);
            res.write(errorMessage);
            return Promise.reject({ handled: true });
        }
        errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got: {1}\r\n'.format(movieTitles[index], movieRequestResult.reason());
        res.write(errorMessage);
        return Promise.reject({ handled: true });
    });
    return findMoviePromises;
}

function saveMovies(res, Promise, movies, Movie, findMoviePromiseResults) {
    var createMoviePromises = findMoviePromiseResults.map(function (findMovieResult, index) {
        var errorMessage,
            rejectionReason,
            movieExistsInStore,
            movie = movies[index];
        if (findMovieResult.isFulfilled()) {
            movieExistsInStore = findMovieResult.value() !== null;
            if (movieExistsInStore) {
                errorMessage = 'Movie "{0}" already exists\r\n'.format(movie.title);
                res.write(errorMessage);
                return Promise.resolve({ movieExists: true });
            }
            return Movie.create(movie);
        }
        rejectionReason = findMovieResult.reason();
        if (rejectionReason.handled === undefined) {
            errorMessage = 'Error while finding movie "{0}": {1}\r\n'.format(movie.title, rejectionReason);
            res.write(errorMessage);
        }
        return Promise.reject({ handled: true });
    });
    return createMoviePromises;
}

function processMovieCalendar(res, request, Promise, calendarResponse, calendarBody) {
    var xpath = require('xpath'),
        Dom = require('xmldom').DOMParser,
        Movie = require('../schemas/movie.js'),
        movieInfo = 'http://www.omdbapi.com/?t={0}&type=movie&plot=full&r=json',
        movies = [],
        doc,
        select,
        nodes,
        movieTitles,
        firstShowingUrls,
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
    if (!nodes || nodes.length === 0) {
        res.write("Cannot find movie entries in calendar feed");
        res.end();
        return;
    }
    movieTitles = nodes.map(function (titleNode) {
        return titleNode.nodeValue;
    });
    nodes = select('//atom:feed/atom:entry/atom:summary/text()', doc);
    firstShowingUrls = nodes.map(function (summaryNode) {
        var summary = summaryNode.nodeValue,
            urlStartIndex = summary.indexOf('http://'),
            url = null;
        if (urlStartIndex > 0) {
            url = summary.substring(urlStartIndex);
        }
        return url;
    });
    movieRequests = movieTitles.map(function (movieTitle) {
        return request(movieInfo.format(movieTitle));
    });
    Promise.settle(movieRequests).then(function (movieRequestResults) {
        return processMovieRequests(res, Promise, movies, Movie, movieTitles, firstShowingUrls, movieRequestResults);
    }).settle().then(function (findMoviePromiseResults) {
        return saveMovies(res, Promise, movies, Movie, findMoviePromiseResults);
    }).settle().then(function (createMoviePromisesResults) {
        createMoviePromisesResults.map(function (createMoviePromisesResult, index) {
            var resultValue,
                rejectionReason;
            if (createMoviePromisesResult.isFulfilled()) {
                resultValue = createMoviePromisesResult.value();
                if (resultValue.movieExists === undefined) {
                    res.write('Movie "{0}" created\r\n'.format(movies[index].title));
                }
            } else {
                rejectionReason = createMoviePromisesResult.reason();
                if (rejectionReason.handled === undefined) {
                    res.write('Error while creating movie "{0}": {1}\r\n'.format(movies[index].title), rejectionReason);
                }
            }
        });
        res.write("Finished processing movie calendar\r\n");
        res.end();
    });
}

exports.execute = function (req, res) {
    var Promise = require("bluebird"),
        request = Promise.promisify(require('request'));
    res.type('text');
    requestMovieCalendar(request, req.query.startDate, req.query.endDate).spread(function (calendarResponse, calendarBody) {
        processMovieCalendar(res, request, Promise, calendarResponse, calendarBody);
    }).catch(function (calendarRequestError) {
        res.write("Cannot retrieve movie calendar via GET request, got " + calendarRequestError);
        res.end();
    });
};
exports.getMovieDocument = getMovieDocument;