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
            global.jsonApiError(res, videoStore, e);
        }
    });

    app.post(basePath, async function (req, res) {
        var videoStore;
        var video = req.body;
        try {
            var channelId = video.channelId,
                videoId = video.videoId;
            if (!channelId) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'channelId' in request body`, { 'data': 'channelId' });
                return;
            }
            if (!videoId) {
                global.jsonApiError(res, null, null, 400, 'Missing data', `Missing value for property 'videoId' in request body`, { 'data': 'videoId' });
                return;
            }
            
            video.modifiedAt = new Date();
            var result;
            var filter = { channelId: channelId };
            videoStore = await global.getStore('videos');
            var existingVideo = await videoStore.findOne(filter);
            if (!existingVideo) {
                filter = { channel: channelId };
                existingVideo = await videoStore.findOne(filter);
            }
            if (existingVideo) {
                video._id = existingVideo._id;
                result = await videoStore.findOneAndReplace(filter, video, { returnOriginal: false });
                res.json(result.value);
            } else {
                result = await videoStore.insertOne(video);
                res.json(result.insertedId);
            }
            videoStore.client.close();
        } catch (e) {
            global.jsonApiError(res, videoStore, e);
        }
    });
    
    app.get(basePath + '/playlists', async function (req, res) {
        try {
            if (!global.config) global.config = await global.getConfig(); 
            var playlists = global.config.videoPlaylists;
            res.json(playlists);
        } catch (e) {
            global.jsonApiError(res, null, e);
        }
    });
    
    app.get(basePath + '/clients/1', async function (req, res) {
        try {
            if (!global.config) global.config = await global.getConfig(); 
            res.json(global.config.videoClientId);
        } catch (e) {
            global.jsonApiError(res, null, e);
        }
    });
};
