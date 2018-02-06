"use strict";

exports.register = function (app) {
    var Video = require('../schemas/video.js'),
        basePath = '/api/videos';

    app.get(basePath, function (req, res) {
        var db = global.getDB(res);
        Video = db.model('Video');
        Video.find().exec(function (error, videos) {
            if (error) {
                res.status(500).type('text').send('Error: ' + error);
                return;
            }
            res.json(videos);
        });
    });

    app.post(basePath, function (req, res) {
        var db = global.getDB(res);
        Video = db.model('Video');
        var channelId = req.body.channelId,
            videoId = req.body.videoId;
        if (!channelId) {
            res.status(400).type('text').send("Missing value for property 'channelId' in request body");
            return;
        }
        Video.findOne({ channel: channelId }, function (error, video) {
            if (error) {
                res.status(500).type('text').send("Error while checking if info for channel ID {0} exists: {1}".format(channelId, error));
                return;
            }
            if (video) {
                video.lastVideoSeen = videoId;
                video.modifiedAt = new Date();
                video.save(function (error, savedVideo) {
                    if (error) {
                        res.status(500).type('text').send("Error while updating channel: " + channelId);
                        return;
                    }
                    res.json(savedVideo);
                });
                return;
            }
            
            var newVideo = new Video({
                channel: channelId,
                lastVideoSeen: videoId,
                modifiedAt: new Date()
            });
            Video.create(newVideo, function (error, createdVideo) {
                if (error) {
                    res.status(500).type('text').send("Error while creating video: " + error);
                    return;
                }
                res.json(createdVideo);
            });
        });
    });
    
    app.get(basePath + '/playlists', function (req, res) {
        global.getConfig().then(function (config) {
            var playlists = config.videoPlaylists.split(',');
            res.json(playlists);
        });
    });
    
    app.get(basePath + '/clients/1', function (req, res) {
        global.getConfig().then(function (config) {
            res.json(config.videoClientId);
        });
    });
};