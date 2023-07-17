'use strict';

let log, config, youtube;
let allVideosMap = {};
const printPlaylistName = (playlist) => `${playlist.name} (${playlist.id})`;

async function processVideosInPlaylist(playlist) {
    let playlistItemStore;
    try {
        const params = {
            part: 'snippet,contentDetails,status',
            playlistId: playlist.id,
            maxResults: config.playlistItemsListMaxResults || 50
        };
        const playlistItemsResponse = await youtube.playlistItems.list(params);
        const playlistItems = playlistItemsResponse.data.items;
        if (!playlistItems || playlistItems.length === 0) {
            log(`Warning: No videos for playlist ${printPlaylistName(playlist)}`);
            return;
        }

        log(`Processing playlist ${printPlaylistName(playlist)}`);
        playlistItemStore = await global.getStore('playlistItems');
        const save = async (video) => {
            video.modifiedAt = new Date();
            await playlistItemStore.findOneAndReplace({ playlistItemId: { $eq: video.playlistItemId } }, video, { returnOriginal: false, upsert: true });
        }
        const savedPlaylistItems = await playlistItemStore.find({ playlistId: { $eq: playlist.id } }).toArray();
        savedPlaylistItems.forEach(savedPlaylistItem => {
            const foundPlaylistItem = playlistItems.find(playlistItem => playlistItem.id === savedPlaylistItem.playlistItemId);
            savedPlaylistItem.isInPlaylist = foundPlaylistItem !== undefined;
            savedPlaylistItem.isMissing == !savedPlaylistItem.isInPlaylist;
            if (!savedPlaylistItem.isInPlaylist) {
                savedPlaylistItems.action = 'was not returned by the list operation of youtube.playlistItems';
                save(savedPlaylistItem);
                allVideosMap[savedPlaylistItem.playlistItemId] = savedPlaylistItem;
            }
        });

        for (const playlistItem of playlistItems) {
            const videoId = playlistItem.snippet.resourceId.videoId;
            const savedPlaylistItem = savedPlaylistItems.find(item => item.playlistItemId === playlistItem.id);
            const video = {
                videoId: videoId,
                playlistItemId: playlistItem.id,
                playlistId: playlist.id,
                playlistName: playlist.name,
                status: playlistItem.status.privacyStatus,
                channelId: savedPlaylistItem ? savedPlaylistItem.channelId : '',
                channelTitle: savedPlaylistItem ? savedPlaylistItem.channelTitle : '',
                channelUrl: savedPlaylistItem ? savedPlaylistItem.channelUrl : '',
                title: savedPlaylistItem ? savedPlaylistItem.title : '',
                changes: savedPlaylistItem ? savedPlaylistItem.changes : ''
            };
            allVideosMap[playlistItem.id] = video;
            log(`Processing video ${videoId}`);
            await processVideo(video, playlist, save, savedPlaylistItem);
        }
        playlistItemStore.client.close();
    } catch (error) {
        if (playlistItemStore) {
            playlistItemStore.client.close();
        }
        log(`Exception processing playlist ${printPlaylistName(playlist)}`, error, true);
    }
}

async function processVideo(video, playlist, save, savedPlaylistItem) {
    try {
        const videoId = video.videoId;
        
        if (video.status === 'private') {
            video.isMissing = true;
            video.action = 'was set to private';
            log(`Video ${videoId} ${video.action}`);
            await save(video);
            return;
        }

        const params = {
            id: videoId,
            part: 'snippet'
        };
        const response = await youtube.videos.list(params);
        if (response.data.items.length > 0) {
            const videoInfo = response.data.items[0];
            const today = new Date().toDateString();
            const change = (property) => `${today} => ${property} was ${savedPlaylistItem[property]}\n`;
            video.channelId = videoInfo.snippet.channelId;
            video.channelTitle = videoInfo.snippet.channelTitle;
            video.title = videoInfo.snippet.title;
            video.channelUrl = `https://www.youtube.com/channel/${video.channelId}/videos`;
            if (savedPlaylistItem && savedPlaylistItem.channelTitle !== video.channelTitle) {
                video.changes += change('channelTitle');
            }
            if (savedPlaylistItem && savedPlaylistItem.title !== video.title) {
                video.changes += change('title');
            }
        } else {
            video.isMissing = true;
            video.wasDeleted = true;
            video.action = 'was deleted';
            log(`Video ${videoId} ${video.action}`);
        }
        await save(video);
    } catch (error) {
        log(`Exception processing video ${videoId} in playlist ${printPlaylistName(playlist)}`, error, true);
    }
}

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');

    try {
        log = function (message, error, noEnd) { global.log(res, message, error, noEnd) };
        if (!global.config) global.config = await global.getConfig();
        config = global.config;
        const sendMail = async (message) => {
            var mail = {
                from: config.stockWatchListFrom,
                to: config.stockWatchListTo,
                subject: `Videos in playlists where deleted or set to private`,
                html: message
            };
            await global.sendMail(res, config, mail, log);
        };

        const { google } = require('googleapis');
        const authClient = require('./oauthClient');
        const scopes = ['https://www.googleapis.com/auth/youtube'];
        const authenticatedClient = await authClient.authenticate(scopes);
        youtube = google.youtube({
            version: 'v3',
            auth: authenticatedClient,
        });

        allVideosMap = {};
        for (const playlist of global.config.videoPlaylistsForProcessing) {
            await processVideosInPlaylist(playlist);
        }

        let message = '';
        Object.values(allVideosMap).forEach(video => {
            if (video.isMissing) {
                message += `Video ${video.videoId} from playlist ${video.playlistName || playlist.name} ${video.action}<br>`;
            }
        });
        if (message.length > 0) {
            await sendMail(message);
        }
        log("Processing of all playlists completed.");
        res.end();
    } catch (e) {
        log('Exception', e);
    }
};