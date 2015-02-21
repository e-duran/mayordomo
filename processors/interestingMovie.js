"use strict";
exports.execute = function (req, res) {
    var Movie = require('../schemas/movie.js'),
        id = req.params.id,
        message;
    res.type('text');
    Movie.update({ _id: id }, { isInteresting: true }, function (error, numberAffected) {
        if (error) {
            message = 'Error while updating movie {0}: {1}'.format(id, error);
        } else if (numberAffected === 0) {
            message = 'Cannot find movie with ID ' + id;
        } else {
            message = 'Movie {0} was marked as interesting.'.format(id);
        }
        res.send(message);
    });
};