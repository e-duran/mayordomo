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
        sylisttName: String,
        stylistInfoUrl: String
    });

module.exports = mongoose.model('Config', ConfigSchema);