'use strict';

exports.register = function (app) {
    let basePath = '/api/notifications';

    app.post(basePath, async function (req, res) {
        let notificationStore;
        try {
            let source = req.body.source,
                content = req.body.content;
            if (!source) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'source' in request body`, { 'data': 'source' });
                return;
            }
            if (!content) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'content' in request body`, { 'data': 'content' });
                return;
            }
            
            let notification = {
                source: source,
                content : content,
                createdAt: new Date()
            };
            notificationStore = await global.getStore('notifications');
            let result = await notificationStore.insertOne(notification);
            res.json(result.ops[0]);
            notificationStore.client.close();
        } catch (e) {
            global.jsonApiError(res, e, notificationStore);
        }
    });

    app.get(basePath, async function (req, res) {
        let notificationStore;
        const lastObjectId = req.query.lastObjectId;
        const ObjectID = require('mongodb').ObjectID;
        try {
            notificationStore = await global.getStore('notifications');
            const cursor = lastObjectId ? notificationStore.find({_id: { $lt: new ObjectID(lastObjectId)}}) : notificationStore.find();
            let notifications = await cursor.sort({_id: -1}).limit(100).toArray();
            notificationStore.client.close();
            res.json(notifications);
        } catch (e) {
            global.jsonApiError(res, e, notificationStore);
        }
    });
};
