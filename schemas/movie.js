var mongoose = require('mongoose');

// The properties of the movie schema will be in Pascal case because that's how OMDb returns them in their JSON.
var MovieSchema = new mongoose.Schema({
  Title: String
}, { strict: false });

module.exports = mongoose.model('Movie', MovieSchema);