var mongoose = require('mongoose');

// Some properties of the movie schema will be in Pascal case because that's how the Open Movie database API returns movie information in their JSON format.
var MovieSchema = new mongoose.Schema({
  Title: String,
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Movie', MovieSchema);