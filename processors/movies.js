"use strict";

var promise = require("bluebird");
var request = promise.promisify(require('request'));
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var mongoose = require('mongoose');
var Movie = require('../schemas/movie.js');

var response;

function error(res, message) {
    res.status(500).write(message);
    res.end();
}

exports.execute = function (req, res) {
    response = res;
    res.type('text');

    var today = new Date();
    var thisYear = today.getFullYear();
    var thisMonth = today.getMonth() + 1; if (thisMonth < 10) thisMonth = '0' + thisMonth;
    var nextMonth = today.getMonth() + 2; if (nextMonth == 13) nextMonth = 12; if (nextMonth < 10) nextMonth = '0' + nextMonth;
    var day = nextMonth == 12 ? "31" : "01";
    var movieCalendar = 'https://www.google.com/calendar/feeds/pfutdblf1gi8jmfsvroh76f6jg%40group.calendar.google.com/public/basic?start-min={0}-{1}-01T00:00:00&start-max={0}-{2}-{3}T00:00:00&orderby=starttime&sortorder=a';
    var movieInfo = 'http://www.omdbapi.com/?t={0}&type=movie&plot=full&r=json';
    movieCalendar = movieCalendar.format(thisYear, thisMonth, nextMonth, day);
    request(movieCalendar).spread(function(calendarResponse, calendarBody) {
        if (calendarResponse.statusCode != 200) error(res, "Cannot retrieve movie calendar via GET request, got status code: " + calendarResponse.statusCode);
        
        res.write("Retrieved movie calendar via GET request\r\n");
        
        var doc = new dom().parseFromString(calendarBody);
        var select = xpath.useNamespaces({"atom": "http://www.w3.org/2005/Atom"});
        var nodes = select('//atom:feed/atom:entry/atom:title/text()', doc);
        if (nodes === null || (nodes !== null && nodes.length == 0)) return error(res, "Cannot find movie entries in calendar feed");
        
        mongoose.connect('mongodb://{0}/mayordomo'.format(process.env.IP));
        var db = mongoose.connection;
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function (callback) {
          console.log("connected!");
        });
        
        var movies = [];
        var movieTitles = nodes.map(function(titleNode) { return titleNode.nodeValue; });
        var movieRequests = movieTitles.map(function(movieTitle) {
            return request(movieInfo.format(movieTitle));
        });
        promise.settle(movieRequests).then(function(movieRequestResults) {
            var findMoviePromises = movieRequestResults.map(function(movieRequestResult, index) {
                var errorMessage;
                if (movieRequestResult.isFulfilled()) {
                    var resultValue = movieRequestResult.value();
                    var movieResponse = resultValue[0];
                    var movieResponseBody = resultValue[1];
                    
                    if (movieResponse.statusCode != 200) {
                        errorMessage = "Cannot retrieve movie information for '{0}' via GET request, got status code: {0}\r\n".format(movieTitles[index], movieResponse.statusCode);
                        response.write(errorMessage);
                        //return promise.reject(errorMessage);
                    }
                    
                    var movie = JSON.parse(movieResponseBody);
                    if (movie.Response) {
                        movies[index] = movie;
                        return Movie.findOne({ imdbID: movie.imdbID }).exec();
                    }
                    else {
                        errorMessage = "Movie information for '{0}' was not found at OMDb\r\n".format(movieTitles[index]);
                        response.write(errorMessage);
                        //return promise.reject(errorMessage);
                    }
                    
                }
                else {
                    errorMessage = "Cannot retrieve movie information for '{0}' via GET request, got error: {1}\r\m".format(movieTitles[index], movieRequestResult.reason());
                    res.write(errorMessage);
                    //return promise.reject(errorMessage);
                }
            });
            return findMoviePromises;
        }).settle().then(function (findMoviePromiseResults) {
            var createMoviePromises = findMoviePromiseResults.map(function(findMovieResult, index) {
                var errorMessage;
                var movie = movies[index];
                if (findMovieResult.isFulfilled()) {
                    var resultValue = findMovieResult.value();
                    var movieExistsInStore = resultValue !== null;
                    if (movieExistsInStore) {
                        errorMessage = "Movie '{0}' already existed\r\n".format(movie.Title);
                        response.write(errorMessage);
                        return promise.resolve(true);
                    }
                    else {
                        return Movie.create(movie);
                    }
                }
                else {
                    errorMessage = "Error while finding movie '{0}': {1}\r\n".format(movieTitles[index], findMovieResult.reason());
                    res.write(errorMessage);
                    //return promise.reject(errorMessage);
                }
            });
            return createMoviePromises;
        }).settle().then(function (createMoviePromisesResults) {
            createMoviePromisesResults.map(function(createMoviePromisesResult, index) {
                if (createMoviePromisesResult.isFulfilled()) {
                    var resultValue = createMoviePromisesResult.value();
                    if (typeof resultValue != 'boolean') {
                        response.write("Movie '{0}' created\r\n".format(movies[index].Title));
                    }
                }
                else {
                    res.write("Error while creating movie '{0}': {1}\r\n".format(movies[index].Title), createMoviePromisesResult.reason());
                }
            });
            db.close();
            res.write("Finished processing movie calendar\r\n");
            res.end();
        });
    }).catch(function(calendarRequestError) {
        error(res, "Cannot retrieve movie calendar via GET request, got error " + calendarRequestError);
    });
};