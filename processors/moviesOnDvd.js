'use strict';

function updateMovie(movie, movieInfo, config) {
    var today = new Date();
    movie.awards = movieInfo.Awards;
    movie.actors = movie.actors || movieInfo.Cast;
    movie.comboScore = movieInfo.ComboScore;
    movie.releasedToDvdDate = movieInfo.DVD ? new Date(Number(movieInfo.DVD.substring(6, movieInfo.DVD.indexOf(')')))) : null;
    movie.director = movie.director || movieInfo.Director;
    movie.genre = movie.genre || movie.Genre;
    movie.letterboxdScore = movieInfo.LetterboxdScore;
    movie.letterboxdVotes = movieInfo.letterboxdVotes;
    movie.metascore = movieInfo.Metacritic;
    movie.plot = movie.plot || movieInfo.Plot;
    movie.poster = movie.poster.indexOf('none_') > 0 ? (movieInfo.Poster ? movieInfo.Poster : config.cinesiftPosterPrefix + movieInfo.PosterPath) : movie.poster;
    movie.producer = movieInfo.Production;
    movie.tomatoConsensus = movieInfo.RTConsensus;
    movie.tomatoFresh = movieInfo.RTCriticFresh;
    movie.tomatoMeter = movieInfo.RTCriticMeter;
    movie.tomatoRating = movieInfo.RTCriticRating;
    movie.tomatoReviews = movieInfo.RTCriticReviews;
    movie.tomatoRotten = movieInfo.RTCriticRotten;
    movie.tomatoUserMeter = movieInfo.RTUserMeter;
    movie.tomatoUserRating = movieInfo.RTUserRating;
    movie.tomatoUserReviews = movieInfo.RTUserReviews;
    movie.imdbRating = movieInfo.imdbRating;
    movie.imdbVotes = movieInfo.imdbVotes;
    movie.modifiedAt = today;
    movie.postProcessedAt = today;
    return movie;
}

function sendMail(config, body, log) {
    var Mailgun = require('mailgun-js');
    var mailgun = new Mailgun({apiKey: config.mailgunApiKey, domain: config.mailgunDomain});
    var mail = {
        from: config.stockWatchListFrom,
        to: config.stockWatchListTo,
        subject: `Error in movies post-processing`,
        html: body
    };
    mailgun.messages().send(mail, function (error, body) {
        if (error) {
            log('Error while sending mail', error);
        }
    });
}

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error, noEnd) { global.log(res, message, error, noEnd) };
    var movieStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        
        var axios = require('axios');
        axios.defaults.headers['Referer'] = config.moviesPostProcessorReferer;
        axios.defaults.headers['User-Agent'] = config.moviesPostProcessorUserAgent;
        axios.defaults.headers['Response'] = config.moviesPostProcessorResponse;
        var moment = require('moment-timezone');
        movieStore = await global.getStore('movies');
        var movies = await movieStore.find({ needsReview: false, nextPostProcessingDate: moment().startOf('day').toDate() }).toArray();
        var action;
        var lastError;
        for (var i = 0; i < movies.length; i++) {
            var movieResponse = null;
            var movieInfo = null;
            try {
                var movie = movies[i];
                var movieApiUrl = config.cinesiftUrl.format(encodeURI(movie.title), movie.year, movie.year);
                movieResponse = await axios.get(movieApiUrl);
                movieInfo = JSON.parse(movieResponse.data);
                if (movieInfo.length > 0) {
                    if (movieInfo.length > 1) { log(`WARNING: Movie API returned ${movieInfo.length} matches for "${movie.title}" (${movie.year})`); }
                    movieInfo = movieInfo[0];
                    updateMovie(movie, movieInfo, config);
                    action = 'post-processed';
                } else {
                    action = 'not found in Movie API database';
                }
                movie.remainingPostProcessingTimes--;
                movie.nextPostProcessingDate = movie.remainingPostProcessingTimes ? moment().add(1, 'months').startOf('day').toDate() : null;
                var result = await movieStore.replaceOne({ _id: movie._id }, movie);
                action += ' and ' + (result.modifiedCount ? 'saved' : 'not saved');
                var times = movie.remainingPostProcessingTimes ? movie.remainingPostProcessingTimes : 'no';
                log(`Movie "${movie.title}" was ${action} with ${times} remaining rounds.`);
            } catch (e) {
                log(`Error post-processing movie ${movies[i].title}`, e, true);
                if (!movieResponse || !movieInfo) {
                    lastError = movieResponse ? 'Movie API did not returned valid JSON response' : 'Error in GET request to movie API';
                }
            }
        }
        if (lastError) {
            sendMail(config, lastError, log);
        }
        movieStore.client.close();
        log(`Finished post-processing of ${movies.length} movies.`);
        res.end();
    } catch (e) {
        log('Exception', e);
        if (movieStore) {
            movieStore.client.close();
        }
    }
};
