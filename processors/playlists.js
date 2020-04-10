'use strict';

let log, config, youtube;
const allVideos = [];

async function processVideosInPlaylist(playlist) {
    try {
        const params = {
            part: 'snippet,contentDetails',
            playlistId: playlist.id,
            maxResults: config.playlistItemsListMaxResults || 50
        };
        const playlistItemsResponse = await youtube.playlistItems.list(params);
        var playlistItems = playlistItemsResponse.data.items;
        if (playlistItems) {
            for (let i = 0; i < playlistItems.length; i++) {
                const playlistItem = playlistItems[i];
                const videoId = playlistItem.snippet.resourceId.videoId;
                allVideos[videoId] = {
                    id: videoId,
                    playlistItemId: playlistItem.id,
                    playlistId: playlist.id,
                    playlistName: playlist.name,
                    resourceId: playlistItem.snippet.resourceId,
                    note: playlistItem.contentDetails.note || ""
                };
                await processVideo(videoId);
            }
        } else {
            log('Error: No videos for playlist ' + playlistId);
        }
    } catch (error) {
        log('Exception processing playlist ' + playlist.name, error, true);
    }
}

async function processVideo(videoId) {
    try {
        const separator = '********';
        const params = {
            id: videoId,
            part: 'snippet'
        };
        const response = await youtube.videos.list(params);
        const video = allVideos[videoId];
        if (response.data.items.length > 0) {
            const videoInfo = response.data.items[0].snippet;
            video.channelId = videoInfo.channelId;
            video.channelTitle = videoInfo.channelTitle;
            video.title = videoInfo.title;

            let info = separator + '\n';
            info += `Channel: ${video.channelTitle}\n`;
            info += `Channel Id: ${video.channelId}\n`;
            info += `Video title: ${video.title}\n`;
            const sepPos = video.note.indexOf(separator);
            if (sepPos >= 0) {
                video.note = video.note.substring(0, sepPos) + info;
            } else {
                video.note += (video.note ? '\n' : '') + info;
            }
            if (video.note.length > 280) {
                video.note = video.note.substr(0, 280);
                video.maxNoteLenOver = true;
            }

            const request = {
                part: 'snippet,contentDetails',
                requestBody: {
                    id: video.playlistItemId,
                    snippet: {
                        playlistId: video.playlistId,
                        resourceId: video.resourceId
                    },
                    contentDetails: {
                        note: video.note
                    }
                }
            }
            await youtube.playlistItems.update(request);
        } else {
            video.isMissing = true;
        }
    } catch (error) {
        log('Exception processing video ' + videoId, error, true);
    }
}

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');

    try {
        log = function (message, error, noEnd) { global.log(res, message, error, noEnd) };
        if (!global.config) global.config = await global.getConfig();
        config = global.config;

        const { google } = require('googleapis');
        const authClient = require('./oauthClient');
        const scopes = ['https://www.googleapis.com/auth/youtube'];
        const authenticatedClient = await authClient.authenticate(scopes);
        youtube = google.youtube({
            version: 'v3',
            auth: authenticatedClient,
        });
        const playlists = global.config.videoPlaylists;
        for (let i = 0; i < Math.min(config.maxPlaylistToProcess || playlists.length, playlists.length); i++) {
            const playlist = playlists[i];
            await processVideosInPlaylist(playlist);
        }

        let message = '';
        allVideos.forEach(video => {
            if (video.isMissing) {
                message += `Video ${video.id} from playlist ${playlist.name} was deleted or set to private<br>`;
            }
            if (video.maxNoteLenOver) {
                message += `The note of video ${video.id} from playlist ${playlist.name} was truncated because it exceeded 280 chars<br>`;
            }
        });
        if (message) {
            sendMail(message);
            res.write(message.replace('<br>', '\n'));
        } else {
            res.write("Processing of all playlists completed.");
        }
        res.end();
    } catch (e) {
        log('Exception', e);
    }
};

function sendMail(message) {
    const Mailgun = require('mailgun-js');
    const mailgun = new Mailgun({ apiKey: config.mailgunApiKey, domain: config.mailgunDomain });

    var mail = {
        from: config.stockWatchListFrom,
        to: config.stockWatchListTo,
        subject: `Videos in playlists where deleted or set to private`,
        html: message
    };
    mailgun.messages().send(mail, function (error) {
        if (error) {
            log('Error while sending mail', error);
        }
    });
}