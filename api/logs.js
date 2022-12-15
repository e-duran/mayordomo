'use strict';

exports.register = function (app) {
    app.get('/api/logCategories', async function (req, res) {
        res.json(Object.keys(global.processorsMap));
    });
    
    app.get('/api/logs', async function (req, res) {
        var logsStore;
        try {
            logsStore = await global.getStore('logs');
            var logs = await logsStore.find({ category: req.query.category }).sort('timestamp', -1).limit(50).toArray();
            logsStore.client.close();
            res.json(logs);
        } catch (e) {
            global.jsonApiError(res, logsStore, e);
        }
    });
};
