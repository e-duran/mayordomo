/* global $, gapi, toastr */
var lastPlaylistId, nextPageToken, prevPageToken, videosMap;

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
            console.log(`Processing ${playlists.length} playlists - ${new Date()}`);
            videosMap = videos;
            $.each(playlists, function(index, item) {
                requestVideoPlaylist(item);
            });
            toastr.options = {
              "closeButton": true,
              "timeOut": 0,
              "extendedTimeOut": 0,
            };
        });
    });
}

// Retrieve the list of videos in the specified playlist.
function requestVideoPlaylist(playlistId, pageToken) {
  lastPlaylistId = playlistId;
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
          getUploadPlaylistByChannelId(videos[0].snippet.channelId);
        }
    });
}

function getUploadPlaylistByChannelId(channelId) {
  var requestOptions = {
      part: 'contentDetails',
      id: channelId,
      fields: 'items/contentDetails/relatedPlaylists/uploads'
    };
    var request = gapi.client.youtube.channels.list(requestOptions);
    request.execute(function(response) {
      if (!response.items) { console.error(`Didn't find Uploaded playlist for channel ${channelId}`); return; }
      let uploadsPlaylistId = response.items[0].contentDetails.relatedPlaylists.uploads;
      getVideosByPlaylistId(uploadsPlaylistId);
    });
}

function getVideosByPlaylistId(playlistId) {
    var requestOptions = {
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        fields: 'items(contentDetails(videoId,videoPublishedAt),snippet(channelId,channelTitle,thumbnails(default,medium),title))',
        maxResults: 10
    };
    var request = gapi.client.youtube.playlistItems.list(requestOptions);
    request.execute(function(response) {
        var videoItems = response.result.items;
        var container = $('#video-container');
        if (videoItems) {
          var channelId = videoItems[0].snippet.channelId;
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
              var videoId = item.contentDetails.videoId;
              if (videoId !== lastVideoId && !stop) {
                  displayResult(videoId, item.contentDetails, item.snippet, row);
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
function displayResult(videoId, contentDetails, snippet, row) {
  var title = snippet.title;
  var date = new Date(contentDetails.videoPublishedAt);
  var dateString = date.toDateString() + ' ';
  var time = date.toTimeString().substr(0, 8);
  dateString += time.charAt(0) == 0 ? time.substr(1) : time;
  var image = snippet.thumbnails.medium || snippet.thumbnails.default;
  var channelId = snippet.channelId;
  var openHandler = `onclick="openVideo('${channelId}', '${videoId}')"`;
  var markHandler = `onclick="markVideo('${channelId}', '${videoId}')"`;
  var infoHandler = `onclick="logVideoInfo('${channelId}', '${videoId}')"`;
  
  var video = `<td id="${videoId}">
					<div><img src="${image.url}" ${openHandler}></div>
					<div id="${videoId}-title">${title}</div>
					<div><span class="metadata">${dateString} <span id="${videoId}-duration" class="vid-duration"></span></span>
					    <i class="fas fa-check-circle toolbar" ${markHandler}></i>
					    <i class="fas fa-info-circle tool" ${infoHandler} title="Info"></i>
					    <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank"><i class="fas fa-external-link-alt tool"></i></a>
					</div>
				</td>`;
  
  row.append(video);
  getVideoDuration(videoId);
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
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        var videoName = $(`#${videoId}-title`).text();
        var status = textStatus || 'N/A';
        var error = errorThrown || 'N/A';
        console.log(`Video "${videoName}" with ID ${videoId} could not be marked as seen. Status: ${status}. Error: ${error}`);
        toastr.error(`<span class="notification">Couldn't mark video as seen</span>`);
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
        duration = duration.substr(2);
        var minuteMarker = duration.indexOf('M');
        var minutes = minuteMarker == -1 ? '00' : duration.substring(0, minuteMarker); 
        duration = duration.replace('S', '');
        var seconds = duration.substring(minuteMarker + 1) | 0;
        if (seconds < 10) {
            seconds = '0' + seconds;
        }
        $('#' + videoId + '-duration').text(`(${minutes}:${seconds})`);
    });
}

function logVideoInfo(channelId, videoId) {
    console.log('Channedl ID: ' + channelId);
    console.log('Video ID: ' + videoId);
}

// Retrieve the next page of videos in the playlist.
function nextPage() {
  requestVideoPlaylist(lastPlaylistId, nextPageToken);
}

// Retrieve the previous page of videos in the playlist.
function previousPage() {
  requestVideoPlaylist(lastPlaylistId, prevPageToken);
}

function initAddVideoDialog() {
    var dialog, form,
	  videoId = $( '#videoIdToSearch'),
      notes = $( "#notes" ),
      allFields = $( [] ).add( notes ).add( videoId ),
      tips = $( ".validateTips" );
 
    function updateTips( t ) {
      tips
        .text( t )
        .addClass( "ui-state-highlight" );
      setTimeout(function() {
        tips.removeClass( "ui-state-highlight", 1500 );
      }, 500 );
    }
 
    function checkLength( o, n, min, max ) {
      if ( o.val().length > max || o.val().length < min ) {
        o.addClass( "ui-state-error" );
        updateTips( "Length of " + n + " must be between " +
          min + " and " + max + "." );
        return false;
      } else {
        return true;
      }
    }
 
    function validateVideoToAdd() {
      var valid = true;
      allFields.removeClass( "ui-state-error" );
 
      valid = valid && checkLength( videoId, "video ID", 1, 16 );
	  valid = valid && checkLength( notes, "notes", 1, 150 );
 
      if ( valid ) {
        addVideoToFavorites(videoId.val(), notes.text());
        dialog.dialog( "close" );
      }
      return valid;
    }
 
    dialog = $( "#dialog-form" ).dialog({
      autoOpen: false,
      height: 400,
      width: 350,
      modal: true,
      buttons: {
        "Add Video To Favorites": validateVideoToAdd,
        Cancel: function() {
          dialog.dialog( "close" );
        }
      },
      close: function() {
        form[ 0 ].reset();
        allFields.removeClass( "ui-state-error" );
      }
    });
 
    form = dialog.find( "form" ).on( "submit", function( event ) {
      event.preventDefault();
      validateVideoToAdd();
    });
 
    $( "#addVideo" ).on( "click", function() {
      dialog.dialog( "open" );
    });
	$( "#searchVideoIcon" ).on( "click", function() {
        if ( checkLength( videoId, "video ID", 1, 16 ) ) {
            searchVideo( videoId.val(), notes );
        }
	});
}

function searchVideo(videoId, $notes) {
    var requestOptions = {
        id: videoId,
        part: 'snippet',
        fields: 'items(snippet(channelId,channelTitle))'
    };
    var request = gapi.client.youtube.videos.list(requestOptions);
    request.execute(function(response) {
        var draft = `Channel: ${response.result.items[0].snippet.channelTitle}\r\n`;
        draft += `https://www.youtube.com/channel/${response.result.items[0].snippet.channelId}/videos\r\n`;
        $notes.text(draft);
        $notes.focus();
    });
}

function createResource(properties) {
    var resource = {};
    var normalizedProps = properties;
    for (var p in properties) {
      var value = properties[p];
      if (p && p.substr(-2, 2) == '[]') {
        var adjustedName = p.replace('[]', '');
        if (value) {
          normalizedProps[adjustedName] = value.split(',');
        }
        delete normalizedProps[p];
      }
    }
    for (var p in normalizedProps) {
      // Leave properties that don't have values out of inserted resource.
      if (normalizedProps.hasOwnProperty(p) && normalizedProps[p]) {
        var propArray = p.split('.');
        var ref = resource;
        for (var pa = 0; pa < propArray.length; pa++) {
          var key = propArray[pa];
          if (pa == propArray.length - 1) {
            ref[key] = normalizedProps[p];
          } else {
            ref = ref[key] = ref[key] || {};
          }
        }
      }
    }
    return resource;
}

function removeEmptyParams(params) {
    for (var p in params) {
      if (!params[p] || params[p] == 'undefined') {
        delete params[p];
      }
    }
    return params;
}

function executeRequest(request) {
    request.execute(function(response) {
      console.log(response);
    });
}

function buildApiRequest(requestMethod, path, params, properties) {
    params = removeEmptyParams(params);
    var request;
    if (properties) {
      var resource = createResource(properties);
      request = gapi.client.request({
          'body': resource,
          'method': requestMethod,
          'path': path,
          'params': params
      });
    } else {
      request = gapi.client.request({
          'method': requestMethod,
          'path': path,
          'params': params
      });
    }
    executeRequest(request);
}

function addVideoToFavorites(videoId, notes) {
    buildApiRequest('POST',
        '/youtube/v3/playlistItems',
        { 'part': 'snippet,contentDetails' },
        { 'snippet.playlistId': lastPlaylistId,
          'snippet.resourceId.kind': 'youtube#video',
          'snippet.resourceId.videoId': videoId,
          'contentDetails.note': notes
        });
}

initAddVideoDialog();