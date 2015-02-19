var mongoose = require('mongoose');

var MovieSchema = new mongoose.Schema({
        title: String,
        year: Number,
        rated: String,
        releasedDate: Date,
        runtimeInMinutes: Number,
        genre: String,
        director: String,
        writer: String,
        actors: String,
        plot: String,
        language: String,
        country: String,
        awards: String,
        poster: String,
        metascore: Number,
        imdbRating: Number,
        imdbVotes: Number,
        imdbId: String,
        tomatoMeter: Number,
        tomatoImage: String,
        tomatoRating: Number,
        tomatoReviews: Number,
        tomatoFresh: Number,
        tomatoRotten: Number,
        tomatoConsensus: String,
        tomatoUserMeter: Number,
        tomatoUserRating: Number,
        tomatoUserReviews: Number,
        releasedToDvdDate: Date,
        producer: String,
        webSite: String,
        firstShowingUrl: String,
        needsReview: { type: Boolean, 'default': false },
        isInteresting: Boolean,
        postProcessingCompleted: { type: Boolean, 'default': false },
        createdAt: { type: Date, 'default': Date.now },
        modifiedAt: Date,
        postProcessedAt: Date,
        acquired: { type: Boolean, 'default': false },
        seen: { type: Boolean, 'default': false }
    });

module.exports = mongoose.model('Movie', MovieSchema);