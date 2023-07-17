'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var movieStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        const sendMail = async (message) => {
            var mail = {
                from: config.stockWatchListFrom,
                to: config.stockWatchListTo,
                subject: `Error in processing of movies`,
                html: message
            };
            await global.sendMail(res, config, mail, log);
        };
        let isRerun = false;
        var movieTitles = [],
            movieUrls = []; 
    
        var axios = require('axios');
        var getRequestConfig = {
            headers: {
                'User-Agent': config.moviesPostProcessorUserAgent,
                'Accept': 'text/html'
            }
        }
        var cheerio = require('cheerio');
        let existingMovies = [];

        if (req.query.from) {
            isRerun = true;
            movieStore = await global.getStore('movies');
            const filter = { createdAt: { $gt: new Date(req.query.from) } };
            existingMovies = await movieStore.find(filter).toArray();
            existingMovies.forEach(movie => {
                movieTitles.push(movie.title);
                movieUrls.push(movie.movieInsiderUrl);
            });
        } else {
            var movieCalendar = await axios.get(config.movieCalendarUrl, getRequestConfig);
            var $ = cheerio.load(movieCalendar.data);
            $('h3 > a').each(function (i, anchor) {
                movieUrls[i] = $(anchor).attr('href');
                movieTitles[i] = $(anchor).text().trim();
            });
            if (movieUrls.length > 0) {
                log(`Got list of ${movieUrls.length} movies opening this week`);
            } else {
                log('Error: Initial media-heading selector did not return any nodes');
            }
        }
        
        var movies = [];
        for (let i = 0; i < movieUrls.length; i++) {
            let movie = await getMovieFromPage(log, axios, getRequestConfig, cheerio, movieUrls[i], movieTitles[i]);
            if (!movie) continue;
            if (!movie.imdbId) {
                movie = await getImdbId(log, axios, getRequestConfig, cheerio, movie);
            }
            movies.push(movie);
        }
        
        const keyPropertiesErrorMessages = [];
        const keyProperties = ['poster', 'rated', 'genre', 'releaseScope', 'releasedDate', 'director', 'writer', 'needsReview', 'imdbId'];
        let hasSameKeyValues = false;
        for (const keyProperty of keyProperties) {
            const allValues = movies.map(movie => movie[keyProperty]);
            let allValuesAreSame = allValues.every(value => value === allValues[0]);
            allValuesAreSame = keyProperty === 'needsReview' ? allValuesAreSame === true : allValuesAreSame;
            hasSameKeyValues = hasSameKeyValues || allValuesAreSame;
            if (allValuesAreSame) {
                const message = `ERROR: Property ${keyProperty} is the same for all movies.`;
                keyPropertiesErrorMessages.push(message);
                log(message);
            }
        }
        if (hasSameKeyValues) {
            const message = 'There is a problem with the query selectors used to parse the following properties: <br>' + keyPropertiesErrorMessages.join('<br>');
            await sendMail(message);
            movies = [];
        }

        var moment = require('moment-timezone');
        movieStore = movieStore || await global.getStore('movies');
        for (let i = 0; i < movies.length; i++) {
            let movie = movies[i];
            var action = 'created';
            var result = null;
            var filterByUrl = { movieInsiderUrl: { $eq: movie.movieInsiderUrl } };
            var existingMovie = existingMovies[i] || await movieStore.findOne(filterByUrl);
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
        const message = 'Unhandled exception - ' + (e.stack ? e.stack : e);
        await sendMail(message);
        if (movieStore) {
            movieStore.client.close();
        }
    }
};

async function getMovieFromPage(log, axios, getRequestConfig, cheerio, moviePageUrl, movieTitle) {
    try {
        var moviePageResponse = await axios.get(moviePageUrl, getRequestConfig);
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
        //movie.duration = $('span[itemprop="duration"] strong').eq(0).text().trim();
        movie.plot = $('p[itemprop="description"]').text().trim();
        let releaseParagraph = $('.fa.fa-calendar-o.fa-fw').eq(1).parent().parent().next();
        let releaseScope = releaseParagraph.contents().eq(-1).text().trim();
        movie.releaseScope = releaseScope;
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

async function getImdbId(log, axios, getRequestConfig, cheerio, movie) {
    if (!movie.year) return movie;
    try {
        var searchUrl = `https://www.imdb.com/find?q=${encodeURI(movie.title)}&s=tt&ttype=ft&exact=true`;
        var searchResponse = await axios.get(searchUrl, getRequestConfig);
        var $ = cheerio.load(searchResponse.data);
        var results = $('.ipc-metadata-list-summary-item');
        for (var i = 0; i < Math.min(results.length, 5); i++) {
            var year = $(results[i]).find('.ipc-metadata-list-summary-item__li').first().text();
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
