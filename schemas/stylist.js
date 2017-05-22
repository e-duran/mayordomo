var mongoose = require('mongoose');

var StylistSchema = new mongoose.Schema({
        stylistId: Number,
        name: String,
        lastTime: Date,
        createdAt: Date
    });

module.exports = mongoose.model('Stylist', StylistSchema);