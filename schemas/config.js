var mongoose = require('mongoose');

var PlaylistSchema = new mongoose.Schema({
    id: String,
    name: String,
    isDefault: Boolean
});

var ConfigSchema = new mongoose.Schema({
        publicHost: String,
        enableCors: Boolean,
        stockWatchList: String,
        mailgunApiKey: String,
        mailgunDomain: String,
        stockWatchListFrom: String,
        stockWatchListTo: String,
        stylistId: Number,
        stylistName: String,
        stylistInfoUrl: String,
        videoPlaylists: [PlaylistSchema],
        videoClientId: String,
        maxPlaylistToProcess: Number,
        playlistItemsListMaxResults: Number,
        googleApiTokens: Object,
        googleApiCredentials: Object
    });

module.exports = mongoose.model('Config', ConfigSchema);