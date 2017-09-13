exports.execute = function (req, res) {
    var Promise = require('bluebird'),
        request = Promise.promisify(require('request')),
        cheerio = require('cheerio'),
        $,
        movieTitles = [],
        movieUrls = [],
        movies = [],
        db = global.getDB(res);
    res.type('text/plain; charset=utf-8');
    request('http://www.movieinsider.com/movies/this-week/').spread(function (movieCalendarResponse, movieCalendar) {
        var moviePageRequests;
        
        if (movieCalendarResponse.statusCode !== 200) {
            return Promise.reject('Cannot get movie calendar via GET request, got status code: ' + movieCalendarResponse.statusCode);
        }
        $ = cheerio.load(movieCalendar);
        $('h4.media-heading > a').each(function (i, anchor) {
            movieUrls[i] = $(anchor).attr("href");
            movieTitles[i] = $(anchor).text().trim();
        });
        res.write('Got list of {0} movies opening this week\r\n'.format(movieTitles.length));
        moviePageRequests = movieUrls.map(function (url) {
            return request(url);
        });
        return Promise.settle(moviePageRequests);
    }).then(function (moviePageResponses) {
        var storeMoviePromises = moviePageResponses.map(function (moviePageResponse, index) {
            var errorMessage,
                resultValue,
                movieResponse,
                movieResponseBody,
                movie = {},
                rejectionReason,
                imdbIdUrl = 'http://www.imdb.com/title/tt',
                imdbUrlStartIndex,
                imdbIdStartIndex,
                Movie = require('../schemas/movie.js');
    
            Movie = db.model('Movie');
            if (moviePageResponse.isFulfilled()) {
                resultValue = moviePageResponse.value();
                movieResponse = resultValue[0];
                movieResponseBody = resultValue[1];
                if (movieResponse.statusCode !== 200) {
                    errorMessage = 'Cannot retrieve movie information for "{0}" via GET request, got status code: {1}\r\n'.format(movieTitles[index], movieResponse.statusCode);
                    res.write(errorMessage);
                    return Promise.reject({ message: errorMessage, handled: true });
                }
                
                $ = cheerio.load(movieResponseBody);
                movie.movieInsiderUrl = movieUrls[index];
                movie.title = movieTitles[index];
                movie.poster = $('.img-thumbnail').attr('src').replace('/150/', '/600/');
                movie.year = $('.year').text();
                movie.rated = $('.mpaa').text();
                movie.genre = '';
                $('.white.tag').each(function(genre) {
                   movie.genre += $(this).text() + ', ';
                });
                if (movie.genre) { movie.genre = movie.genre.substr(0, movie.genre.length - 2); }
                movie.duration = $("small[itemprop='duration']").text().trim();
                $('.plot').children().remove();
                movie.plot = $('.plot').text().trim();
                movie.releasedDate = new Date($('h4.rs').next().text() + $('h4.rs').next().next().text());
                movie.actors = '';
                $("b[itemprop='actor']").each(function(actor) {
                   movie.actors +=  $(this).text() + ', ';
                });
                if (movie.actors) { movie.actors = movie.actors.substr(0, movie.actors.length - 2); }
                movie.director = $('.credits').eq(0).children('a').text().trim().replace('  ', ', ');
                movie.writer = $('.credits').eq(1).children('a').text().trim().replace('  ', ', ');
                imdbUrlStartIndex = movieResponseBody.indexOf(imdbIdUrl);
                if (imdbUrlStartIndex > 0) {
                    imdbIdStartIndex = imdbUrlStartIndex + imdbIdUrl.length - 2;
                    movie.imdbId = movieResponseBody.substring(imdbIdStartIndex, movieResponseBody.indexOf('/', imdbIdStartIndex));
                }
                movie.needsReview = false;
                movie.createdAt = new Date();
                
                if (isNaN(movie.year)) {
                    movie.year = null;
                }
                if (movie.releasedDate && !movie.releasedDate.isValid()) {
                    movie.releasedDate = null;
                }
                if (movie.releasedDate === null || (movie.imdbId && movie.imdbId.substring(0, 2).toLowerCase() !== 'tt') || movie.poster === '') {
                    movie.needsReview = true;
                }
                
                movies.push(movie);
                return Movie.findOneAndUpdate({ movieInsiderUrl: movie.movieInsiderUrl }, movie, { new: false, upsert: true }).exec();
            }
            rejectionReason = moviePageResponse.reason();
            if (rejectionReason.handled) return Promise.reject(rejectionReason);
            errorMessage = 'Error while processing request for "{0}": }\r\n'.format(movieTitles[index]);
            res.write(errorMessage);
            return Promise.reject({ message: errorMessage, handled: true });
        });
        return Promise.settle(storeMoviePromises);
    }).then(function (storeMoviePromises) {
        storeMoviePromises.map(function (storeMoviePromise, index) {
            var resultValue,
                rejectionReason,
                needsReview,
                storeAction = 'created';
            if (storeMoviePromise.isRejected()) {
                rejectionReason = storeMoviePromise.reason();
                if (rejectionReason.handled) return;
                res.write('Error while storing movie "{0}": {1}\r\n'.format(movies[index].title, rejectionReason));
                return;
            }
            resultValue = storeMoviePromise.value();
            if (resultValue && !resultValue.isNew) {
                storeAction = 'updated';
            }
            needsReview = movies[index].needsReview ? ' but its info needs to be reviewed' : '';
            res.write('Movie "{0}" {1}{2}\r\n'.format(movies[index].title, storeAction, needsReview));
        });
    }).catch(function (error) {
        if (error.stack) {
            res.write('Unhandled ' + error.stack);
        } else {
            res.write(error + '\r\n');
        }
    }).finally(function () {
        db.close();
        res.write('End of processing.\r\n');
        res.end();
    });
};