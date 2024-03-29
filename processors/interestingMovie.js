'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    let movieStore;
    const id = req.params.id;
    const ObjectId = require('mongodb').ObjectId;
    
    try {
        movieStore = await global.getStore('movies');
        var result = await movieStore.updateOne({ _id: new ObjectId(id)}, { $set: { isInteresting: true } });
        movieStore.client.close();
        var message = result.matchedCount == 1 ? `Movie ${id} was marked as interesting.` : 'Cannot find movie with ID ' + id;
        res.send(message);
    } catch (e) {
        global.log(res, `Error while updating movie ${id}`, e);
        if (movieStore) {
            movieStore.client.close();
        }
    }
};
