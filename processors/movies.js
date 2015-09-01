+"use strict";

var getMovieDocument = function (Movie, movieInfo) {
    var none = 'N/A',
        noPoster = 'http://www.sourcecreative.net/wp-content/uploads/2013/11/values-are-not-a-poster.jpg',
        previousYear = new Date().getFullYear() - 1,
        movie,
        runtimeInMinutes,
        runtimeInMinutesEndIndex;
    runtimeInMinutes = (movieInfo.Runtime === none || !movieInfo.Runtime) ? null : movieInfo.Runtime;
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
        imdbId: movieInfo.imdbID
    });
    if (isNaN(movie.year)) {
        movie.year = null;
    }
    if (!movie.releasedDate.isValid()) {
        movie.releasedDate = null;
    }
    if (movie.year === null || movie.releasedDate === null || movie.runtimeInMinutes === null || movie.year < previousYear || movie.imdbId.substring(0, 2).toLowerCase() !== 'tt') {
        movie.needsReview = true;
    }
    return movie;
};

function processMovieRequests(res, Promise, movies, Movie, movieTitles, movieRequestResults) {
    var findMoviePromises = movieRequestResults.map(function (movieRequestResult, index) {
        var errorMessage,
            resultValue,
            movieResponse,
            movieResponseBody,
            movieInfo,
            rejectionReason;

        if (movieRequestResult.isFulfilled()) {
            resultValue = movieRequestResult.value();
            movieResponse = resultValue[0];
            movieResponseBody = resultValue[1];
            if (movieResponse.statusCode !== 200) {
                errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got status code: {1}\r\n'.format(movieTitles[index], movieResponse.statusCode);
                res.write(errorMessage);
                return Promise.reject(errorMessage);
            }
            movieInfo = JSON.parse(movieResponseBody);
            if (movieInfo.Response === "True") {
                movies[index] = getMovieDocument(Movie, movieInfo);
                return Movie.findOne({ imdbId: movies[index].imdbId }).exec();
            }
            errorMessage = 'Movie information for "{0}" was not found at the Open Movie Database (OMDb)\r\n'.format(movieTitles[index]);
            res.write(errorMessage);
            return Promise.reject({ handled: true });
        }
        rejectionReason = movieRequestResult.reason();
        if (rejectionReason.handled === undefined) {
            errorMessage = 'Error while processing request for "{0}": }\r\n'.format(movieTitles[index]);
            res.write(errorMessage);
        }
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

function processInsiderMovieRequests(res, movieTitles, insiderMoviesUrls, movieRequestResults) {
    var findMoviePromises = movieRequestResults.map(function (movieRequestResult, index) {
        var errorMessage,
            resultValue,
            movieResponse,
            movieResponseBody,
            imdbIdUrl = 'http://www.imdb.com/title/tt',
            imdbUrlStartIndex,
            imdbIdStartIndex;

        if (movieRequestResult.isFulfilled()) {
            resultValue = movieRequestResult.value();
            movieResponse = resultValue[0];
            movieResponseBody = resultValue[1];
            if (movieResponse.statusCode !== 200) {
                errorMessage = 'Cannot retrieve movie information from Movie Insider site for "{0}" via GET request, got status code: {1}\r\n'.format(movieTitles[index], movieResponse.statusCode);
                res.write(errorMessage);
                return null;
            }
            imdbUrlStartIndex = movieResponseBody.indexOf(imdbIdUrl);
            if (imdbUrlStartIndex < 0) {
                errorMessage = 'Cannot find ID in IMDb URL for "{0}" in content of Movie Insider Web page {1}\r\n'.format(movieTitles[index], insiderMoviesUrls[index]);
                res.write(errorMessage);
                return null;
            }
            imdbIdStartIndex = imdbUrlStartIndex + imdbIdUrl.length - 2;
            return movieResponseBody.substring(imdbIdStartIndex, movieResponseBody.indexOf('/', imdbIdStartIndex));
        }
        errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got: {1}\r\n'.format(movieTitles[index], movieRequestResult.reason());
        res.write(errorMessage);
        return null;
    });
    return findMoviePromises;
}

function processMovieCalendar(res, request, Promise, calendarResponse, calendarBody) {
    var Movie = require('../schemas/movie.js'),
        cheerio = require('cheerio'),
        movieInfo = 'http://www.omdbapi.com/?i={0}&plot=full&r=json',
        movies = [],
        movieTitles = [],
        insiderMoviesUrls = [],
        insiderMoviesRequests,
        $;

    if (calendarResponse.statusCode !== 200) {
        res.write("Cannot retrieve movies via GET request, got status code: " + calendarResponse.statusCode);
        res.end();
        return;
    }
    res.write("Retrieved movies via GET request\r\n");
    $ = cheerio.load(calendarBody);
    $("h4.media-heading > a").each(function (i, anchor) {
        insiderMoviesUrls[i] = $(anchor).attr("href");
        movieTitles[i] = $(anchor).text().trim();
    });

    insiderMoviesRequests = insiderMoviesUrls.map(function (url) {
        return request(url);
    });
    Promise.settle(insiderMoviesRequests).then(function (insiderMovieRequestResults) {
        var imdbIds = processInsiderMovieRequests(res, movieTitles, insiderMoviesUrls, insiderMovieRequestResults);
        return imdbIds.map(function (imdbId) {
            return imdbId === null ? Promise.reject({ handled: true }) : request(movieInfo.format(imdbId));
        });
    }).settle().then(function (movieRequestResults) {
        return processMovieRequests(res, Promise, movies, Movie, movieTitles, movieRequestResults);
    }).settle().then(function (findMoviePromiseResults) {
        return saveMovies(res, Promise, movies, Movie, findMoviePromiseResults);
    }).settle().then(function (createMoviePromisesResults) {
        createMoviePromisesResults.map(function (createMoviePromisesResult, index) {
            var resultValue,
                rejectionReason,
                needsReview;
            if (createMoviePromisesResult.isFulfilled()) {
                resultValue = createMoviePromisesResult.value();
                if (resultValue.movieExists === undefined) {
                    needsReview = movies[index].needsReview ? ' but its info needs to be reviewed' : '';
                    res.write('Movie "{0}" created{1}\r\n'.format(movies[index].title, needsReview));
                }
            } else {
                rejectionReason = createMoviePromisesResult.reason();
                if (rejectionReason.handled === undefined) {
                    res.write('Error while creating movie "{0}": {1}\r\n'.format(movies[index].title), rejectionReason);
                }
            }
            res.write("Finished processing movie calendar\r\n");
            res.end();
        });
    });
}

exports.execute = function (req, res) {
    var Promise = require("bluebird"),
        request = Promise.promisify(require('request'));
    res.type('text');
    request('http://www.movieinsider.com/movies/this-week/').spread(function (moviesResponse, moviesBody) {
        processMovieCalendar(res, request, Promise, moviesResponse, moviesBody);
    }).catch(function (moviesRequestError) {
        res.write("Cannot retrieve movies via GET request, got " + moviesRequestError);
        res.end();
    });
};
exports.getMovieDocument = getMovieDocument;