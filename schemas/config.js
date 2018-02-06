var mongoose = require('mongoose');

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
        videoPlaylists: String,
        videoClientId: String,
    });

module.exports = mongoose.model('Config', ConfigSchema);