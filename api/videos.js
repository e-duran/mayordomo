'use strict';

exports.register = function (app) {
    var basePath = '/api/videos';

    app.get(basePath, async function (req, res) {
        var videoStore;
        try {
            videoStore = await global.getStore('videos');
            var videos = await videoStore.find().toArray();
            videoStore.client.close();
            res.json(videos);
        } catch (e) {
            global.jsonApiError(res, e, videoStore);
        }
    });

    app.post(basePath, async function (req, res) {
        var videoStore;
        try {
            var channelId = req.body.channelId,
                videoId = req.body.videoId;
            if (!channelId) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'channelId' in request body`, { 'data': 'channelId' });
                return;
            }
            if (!videoId) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'videoId' in request body`, { 'data': 'videoId' });
                return;
            }
            
            var result;
            var filter = { channel: channelId };
            videoStore = await global.getStore('videos');
            var video = await videoStore.findOne(filter);
            if (video) {
                result = await videoStore.findOneAndUpdate(filter, { $set: { lastVideoSeen: videoId, modifiedAt: new Date() } }, { returnOriginal: false });
                res.json(result.value);
            } else {
                video = {
                    channel: channelId,
                    lastVideoSeen: videoId,
                    modifiedAt: new Date()
                };
                result = await videoStore.insertOne(video);
                res.json(result.ops[0]);
            }
            videoStore.client.close();
        } catch (e) {
            global.jsonApiError(res, e, videoStore);
        }
    });
    
    app.get(basePath + '/playlists', async function (req, res) {
        try {
            if (!global.config) global.config = await global.getConfig(); 
            var playlists = global.config.videoPlaylists.split(',');
            res.json(playlists);
        } catch (e) {
            global.jsonApiError(res, e);
        }
    });
    
    app.get(basePath + '/clients/1', async function (req, res) {
        try {
            if (!global.config) global.config = await global.getConfig(); 
            res.json(global.config.videoClientId);
        } catch (e) {
            global.jsonApiError(res, e);
        }
    });
};
