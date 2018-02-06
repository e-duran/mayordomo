var mongoose = require('mongoose');

var VideoSchema = new mongoose.Schema({
        channel: String,
        lastVideoSeen: String,
        modifiedAt: Date
    });

module.exports = mongoose.model('Video', VideoSchema);