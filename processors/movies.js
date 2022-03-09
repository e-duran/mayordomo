'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var movieStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        
        var axios = require('axios');
        var movieCalendar = await axios.get(config.movieCalendarUrl);
        
        var cheerio = require('cheerio');
        var $ = cheerio.load(movieCalendar.data);
        var movieTitles = [],
            movieUrls = [];
        $('h3 > a').each(function (i, anchor) {
            movieUrls[i] = $(anchor).attr('href');
            movieTitles[i] = $(anchor).text().trim();
        });
        if (movieUrls.length > 0) {
            log(`Got list of ${movieUrls.length} movies opening this week`);
        } else {
            log('Error: Initial media-heading selector did not return any nodes');
        }
        
        var movies = [];
        for (let i = 0; i < movieUrls.length; i++) {
            let movie = await getMovieFromPage(log, axios, cheerio, movieUrls[i], movieTitles[i]);
            if (!movie) continue;
            if (!movie.imdbId) {
                movie = await getImdbId(log, axios, cheerio, movie);
            }
            movies.push(movie);
        }
        
        var moment = require('moment-timezone');
        movieStore = await global.getStore('movies');
        for (let i = 0; i < movies.length; i++) {
            let movie = movies[i];
            var action = 'created';
            var result = null;
            var filterByUrl = { movieInsiderUrl: movie.movieInsiderUrl };
            var existingMovie = await movieStore.findOne(filterByUrl);
            if (existingMovie) {
                action = 'updated';
                movie.modifiedAt = new Date();
                movie.createdAt = existingMovie.createdAt;
                movie.nextPostProcessingDate = existingMovie.nextPostProcessingDate;
                movie.remainingPostProcessingTimes = existingMovie.remainingPostProcessingTimes;
                movie.isInteresting = !!existingMovie.isInteresting;
                movie.needsReview = (!!existingMovie.needsReview) == false ? false : movie.needsReview;
                movie.acquired = !!existingMovie.acquired;
                movie.seen = !!existingMovie.seen;
                movie._id = existingMovie._id;
                result = await movieStore.replaceOne(filterByUrl, movie);
            } else {
                movie.createdAt = new Date();
                movie.nextPostProcessingDate = moment().add(2, 'months').startOf('day').toDate();
                movie.remainingPostProcessingTimes = 5;
                result = await movieStore.insertOne(movie);
            }
            action = result.acknowledged ? action : 'not stored';
            var needsReview = movie.needsReview ? ' and its info needs to be reviewed' : '';
            log(`Movie "${movie.title}" ${action}${needsReview}`);
        }
        movieStore.client.close();
        
        log(`End of processing.`);
        res.end();
    } catch (e) {
        log('Exception', e);
        if (movieStore) {
            movieStore.client.close();
        }
    }
};

async function getMovieFromPage(log, axios, cheerio, moviePageUrl, movieTitle) {
    try {
        var moviePageResponse = await axios.get(moviePageUrl);
        var moviePageData = moviePageResponse.data;
        var movie = {};
        var $ = cheerio.load(moviePageData);

        movie.movieInsiderUrl = moviePageUrl;
        movie.title = movieTitle;
        movie.poster = $('img[itemprop="image"]');
        movie.poster = movie.poster.length ? movie.poster.attr('src').replace('/p/175/', '/p/') : null;
        movie.rated = $('.rating-box').text().trim();
        movie.genre = '';
        $('a[itemprop="genre"]').each(function() {
           movie.genre += $(this).text().trim() + ', ';
        });
        if (movie.genre) { movie.genre = movie.genre.substring(0, movie.genre.length - 2); }
        movie.duration = $('span[itemprop="duration"] strong').eq(0).text().trim();
        movie.plot = $('p[itemprop="description"]').text().trim();
        let releaseParagraph = $('.fa.fa-calendar-o.fa-fw').eq(0).parent().parent().next();
        let releaseScope = releaseParagraph.contents().eq(-1).text().trim();
        movie.releaseScope = releaseScope.substring(1, releaseScope.length - 1);
        if (movie.releaseScope.startsWith('(') && movie.releaseScope.endsWith(')')) {
            movie.releaseScope = releaseScope.substring(1, releaseScope.length - 1);
        }
        let releaseDate = releaseParagraph.find('a').eq(0).text();
        movie.releasedDate = releaseDate ? new Date(releaseDate) : moment().startOf('week').add(5, 'days').toDate();
        movie.year = movie.releasedDate.isValid() ? movie.releasedDate.getFullYear() : new Date().getFullYear();
        movie.actors = '';
        $('b[itemprop="actor"]').each(function() {
           movie.actors += $(this).text().trim() + ', ';
        });
        if (movie.actors) { movie.actors = movie.actors.substring(0, movie.actors.length - 2); }
        movie.director = $('p[itemprop="director"] a').text().trim().replace(/  /g, ', ');
        movie.writer = $('.credits').eq(0).children('a').text().trim().replace(/  /g, ', ');
        
        var imdbIdUrl = 'https://www.imdb.com/title/tt';
        var imdbUrlStartIndex = moviePageData.indexOf(imdbIdUrl);
        if (imdbUrlStartIndex > 0) {
            var imdbIdStartIndex = imdbUrlStartIndex + imdbIdUrl.length - 2;
            movie.imdbId = moviePageData.substring(imdbIdStartIndex, moviePageData.indexOf('/', imdbIdStartIndex));
            movie.hasCanonicalImdbId = true;
        }

        movie.isInteresting = false;
        movie.acquired = false;
        movie.seen = false;
        movie.needsReview = !movie.plot || !movie.actors;
    } catch (e) {
        log(`Error getting details for movie ${movieTitle}`);
        throw e;
    }
    
    return movie;
}

async function getImdbId(log, axios, cheerio, movie) {
    if (!movie.year) return movie;
    try {
        var searchUrl = `https://www.imdb.com/find?q=${encodeURI(movie.title)}&s=tt&ttype=ft&exact=true`;
        var searchResponse = await axios.get(searchUrl);
        var $ = cheerio.load(searchResponse.data);
        var results = $('.result_text');
        for (var i = 0; i < Math.min(results.length, 5); i++) {
            var resultText = $(results[i]).text();
            var startYear = resultText.lastIndexOf('(') + 1;
            var year = resultText.substring(startYear, startYear + 4);
            if (isNaN(year)) continue;
            if (year >= (movie.year - 2)) {
                var imdbUrl = $(results[i]).find('a').attr('href');
                var start  = imdbUrl.indexOf('/tt') + 1;
                movie.imdbId = imdbUrl.substring(start, imdbUrl.indexOf('/', start));
                movie.hasCanonicalImdbId = false;
                break;
            }
        }
    } catch (e) {
        log(`Error getting IMDb ID for movie ${movie.title}`);
        throw e;
    }
    return movie;
}
