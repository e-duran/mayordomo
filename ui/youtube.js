/* global $, gapi */
var nextPageToken, prevPageToken, videosMap;

// After the API loads, call a function to get bookmarked videos stored in pre-defined playlists
function handleAPILoaded() {
    $.ajax({
        url: '/api/videos',
        cache: false
    })
    .done(function(videos) {
        videosMap = videos;
        $.ajax({
            url: '/api/videos/playlists',
            cache: false
        })
        .done(function(playlists) {
            videosMap = videos;
            $.each(playlists, function(index, item) {
                requestVideoPlaylist(item);
            });
        });
    });
}

// Retrieve the list of videos in the specified playlist.
function requestVideoPlaylist(playlistId, pageToken) {
  $('#video-container').html('');
  var requestOptions = {
    playlistId: playlistId,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId',
    maxResults: 50
  };
  if (pageToken) {
    requestOptions.pageToken = pageToken;
  }
  var request = gapi.client.youtube.playlistItems.list(requestOptions);
  request.execute(function(response) {
    // Only show pagination buttons if there is a pagination token for the
    // next or previous page of results.
    nextPageToken = response.result.nextPageToken;
    var nextVis = nextPageToken ? 'visible' : 'hidden';
    $('#next-button').css('visibility', nextVis);
    prevPageToken = response.result.prevPageToken;
    var prevVis = prevPageToken ? 'visible' : 'hidden';
    $('#prev-button').css('visibility', prevVis);

    var playlistItems = response.result.items;
    if (playlistItems) {
      $.each(playlistItems, function(index, item) {
        getVideosByBookmarkedVideoId(item.contentDetails.videoId);
      });
    } else {
      console.log('Sorry, no videos for playlist ' + playlistId);
    }
  });
}

function getVideosByBookmarkedVideoId(bookmarkedVideoId) {
    var requestOptions = {
        id: bookmarkedVideoId,
        part: 'snippet',
        fields: 'items/snippet/channelId'
    };
    var request = gapi.client.youtube.videos.list(requestOptions);
    request.execute(function(response) {
        var videos = response.result.items;
        if (videos && videos.length > 0) {
            getVideosByChannelId(videos[0].snippet.channelId);
        }
    });
}

function getVideosByChannelId(channelId) {
    var requestOptions = {
        part: 'snippet',
        channelId: channelId,
        order: 'date',
        type: 'video',
        fields: 'items(id,snippet(channelId,channelTitle,publishedAt,thumbnails(default,medium),title))',
        maxResults: 10
    };
    var request = gapi.client.youtube.search.list(requestOptions);
    request.execute(function(response) {
        var videoItems = response.result.items;
        var container = $('#video-container');
        if (videoItems) {
            var channelName = videoItems[0].snippet.channelTitle;
            var channelDiv = $("<div/>").addClass("channelName").text(channelName);
            var videosDiv = $("<div/>").addClass("videos");
            var table = $('<table/>');
            var tableWidth = 0;
            var row = $('<tr/>');
            var lastVideoPair = videosMap.find(function(videoPair){
                return videoPair.channel === channelId;
            });
            var lastVideoId = lastVideoPair ? lastVideoPair.lastVideoSeen : null;
            var stop = false;
            
            $.each(videoItems, function(index, item) {
                var videoId = item.id.videoId;
                if (videoId !== lastVideoId && !stop) {
                    displayResult(videoId, item.snippet, row);
                    tableWidth += 320 + 20; 
                } else {
                    stop = true;
                }
            });
            if (tableWidth > 0) {
                table.width(tableWidth);
                table.append(row);
                videosDiv.append(table);
                
                container.append(channelDiv);
                container.append(videosDiv);
            }
        }
    });
}

// Create a listing for a video.
function displayResult(videoId, snippet, row) {
  var title = snippet.title;
  var date = new Date(snippet.publishedAt).toDateString();
  var image = snippet.thumbnails.medium || snippet.thumbnails.default;
  var channelId = snippet.channelId;
  var openHandler = `onclick="openVideo('${channelId}', '${videoId}')"`;
  var markHandler = `onclick="markVideo('${channelId}', '${videoId}')"`;
  var durationHandler = `onclick="getVideoDuration('${videoId}')"`;
  var infoHandler = `onclick="logVideoInfo('${channelId}', '${videoId}')"`;
  
  var video = `<td id="${videoId}">
					<div><img src="${image.url}" ${openHandler}></div>
					<div>${title}</div>
					<div>${date} <span id="${videoId}-duration" class="vd"></span>
					    <i class="fas fa-check-circle tool" ${markHandler}></i>
					    <i class="fas fa-clock tool" ${durationHandler}></i>
					    <i class="fas fa-info-circle tool" ${infoHandler} title="Info"></i>
					</div>
				</td>`;
  
  row.append(video);
}

function openVideo(channelId, videoId) {
    window.open('https://www.youtube.com/watch?v=' + videoId, '_blank');
    markVideo(channelId, videoId);
}

function markVideo(channelId, videoId) {
    $.ajax({
        type: "POST",
        url: "/api/videos",
        data: JSON.stringify({ channelId: channelId, videoId: videoId }),
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        processData: false
    })
    .done(function(markedVideo) {
        $('#' + videoId).css('opacity', '0.2');
    });
}

function getVideoDuration(videoId) {
    var requestOptions = {
        id: videoId,
        part: 'contentDetails',
        fields: 'items/contentDetails/duration'
    };
    var request = gapi.client.youtube.videos.list(requestOptions);
    request.execute(function(response) {
        var duration = response.result.items[0].contentDetails.duration;
        duration = duration.substr(2, duration.length - 3);
        var minuteMarker = duration.indexOf('M');
        if (minuteMarker == -1) {
            duration += ':00'; 
        } else {
            duration = duration.replace('M', ':');
            var seconds = duration.substring(minuteMarker + 1);
            if (seconds < 10) {
                duration = duration.substring(0, minuteMarker) + ':0' + seconds;
            }
        }
        $('#' + videoId + '-duration').text(`(${duration})`);
    });
}

function logVideoInfo(channelId, videoId) {
    console.log('Channedl ID: ' + channelId);
    console.log('Video ID: ' + videoId);
}

// Retrieve the next page of videos in the playlist.
function nextPage() {
  requestVideoPlaylist(playlistId, nextPageToken);
}

// Retrieve the previous page of videos in the playlist.
function previousPage() {
  requestVideoPlaylist(playlistId, prevPageToken);
}
