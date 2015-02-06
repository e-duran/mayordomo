var mongoose = require('mongoose');

var DancerSchema = new mongoose.Schema({
  name: String,
  dates: String,
  url: String,
  photoUrl: String,
  fullResolutionPhotoUrl: String,
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dancer', DancerSchema);