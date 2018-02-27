'use strict';

exports.register = function (app) {
    var basePath = '/api/movies';
    
    app.get(basePath, async function (req, res) {
        var movieStore;
        try {
            movieStore = await global.getStore('movies');
            var movies = await movieStore.find({ needsReview: false }).sort('releasedDate', -1).toArray();
            movieStore.client.close();
            res.json(movies);
        } catch (e) {
            global.jsonApiError(res, movieStore);
        }
    });

    app.put(basePath + '/:id', async function (req, res) {
        var movieStore;
        try {
            var ObjectID = require('mongodb').ObjectID;
            var movieID = new ObjectID(req.params.id);
            var updated = {
                isInteresting: req.body.isInteresting,
                acquired: req.body.acquired,
                seen: req.body.seen,
                modifiedAt: new Date()
            };
            
            movieStore = await global.getStore('movies');
            var result = await movieStore.findOneAndUpdate({ _id: movieID }, { $set: updated }, { returnOriginal: false });
            movieStore.client.close();
            if (result.ok && result.value) {
                res.json(result.value);
            } else {
                global.jsonApiError(res, null, null, 404, 'Not Found', `Cannot find movie with ID ${req.params.id}`, { 'parameter': 'id' });
            }
        } catch (e) {
            global.jsonApiError(res, movieStore, e);
        }
    });
};
