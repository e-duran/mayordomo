var mongoose = require('mongoose');

var MovieSchema = new mongoose.Schema({
  Title: String
}, { strict: false });

module.exports = mongoose.model('Movie', MovieSchema);