/* global $, gapi, toastr */
let lastPlaylistId;
let nextPageToken;
let prevPageToken;
let watchedVideos;
let allVideos;

// After the API loads, call a function to get bookmarked videos stored in pre-defined playlists
async function handleAPILoaded() {
  watchedVideos = await $.ajax({ url: '/api/videos', cache: false });
  let playlists = await $.ajax({ url: '/api/videos/playlists', cache: false });
  let urlSearchParams = new URLSearchParams(location.search);
  let requestedPlaylistId = urlSearchParams.get('playlistId');
  let requestedPlaylist = playlists.find(x => requestedPlaylistId ? x.id === requestedPlaylistId : x.isDefault);

  let playlistsControl = $("#playlists");
  for (let playlist of playlists) {
    let select = playlist.id === requestedPlaylist.id;
    playlistsControl.append(new Option(playlist.name, playlist.id, select, select));
  }

  $(() => {
    playlistsControl.selectmenu({
      change: (event, data) => {
        const playlistId = data.item.value;
        if (!playlistId) return;
        urlSearchParams.set('playlistId', playlistId);
        window.location.search = urlSearchParams.toString();
      },
      width: 140
    });
  });

  toastr.options = {
    "closeButton": true,
    "timeOut": 0,
    "extendedTimeOut": 0,
  };

  console.log(`Processing playlist ${requestedPlaylist.name} (ID ${requestedPlaylist.id}) at ${new Date()}`);
  requestVideoPlaylist(requestedPlaylist.id);
}

async function requestVideoPlaylist(playlistId, pageToken) {
  lastPlaylistId = playlistId;
  let maxResults = new URLSearchParams(location.search).get('maxResults');
  maxResults = maxResults ? parseInt(maxResults) : null;
  let requestOptions = {
    playlistId: playlistId,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId',
    maxResults: maxResults || 50,
    pageToken: pageToken || ''
  };
  let response = await gapi.client.youtube.playlistItems.list(requestOptions);

  // Only show pagination buttons if there is a pagination token for the
  // next or previous page of results.
  nextPageToken = response.result.nextPageToken;
  let nextVis = nextPageToken ? 'visible' : 'hidden';
  $('#next-button').css('visibility', nextVis);
  prevPageToken = response.result.prevPageToken;
  let prevVis = prevPageToken ? 'visible' : 'hidden';
  $('#prev-button').css('visibility', prevVis);

  $('#video-container').html('');

  let playlistItems = response.result.items;
  if (!playlistItems) {
    console.warn('Sorry, no videos for playlist ' + playlistId);
    return;
  }
  allVideos = {};
  playlistItems.forEach(playlistItem => getChannelByBookmarkedVideoId(playlistItem.contentDetails.videoId));
}

async function getChannelByBookmarkedVideoId(bookmarkedVideoId) {
  let requestOptions = {
    id: bookmarkedVideoId,
    part: 'snippet',
    fields: 'items/snippet/channelId'
  };
  let response = await gapi.client.youtube.videos.list(requestOptions);
  let videos = response.result.items;
  if (videos && videos.length > 0) {
    await getUploadPlaylistByChannelId(videos[0].snippet.channelId);
  } else {
    console.error(`No video info response returned for bookmarked video ${bookmarkedVideoId} (likely because it was set to private or deleted)`);
    toastr.error(`<span class="notification">Couldn't get channel of video ${bookmarkedVideoId}</span>`);
  }
}

async function getUploadPlaylistByChannelId(channelId) {
  let requestOptions = {
    part: 'contentDetails',
    id: channelId,
    fields: 'items/contentDetails/relatedPlaylists/uploads'
  };
  let response = await gapi.client.youtube.channels.list(requestOptions);
  if (!response.result.items) {
    console.error(`Didn't find Uploaded playlist for channel ${channelId}`);
    return;
  }
  let uploadsPlaylistId = response.result.items[0].contentDetails.relatedPlaylists.uploads;
  getVideosByPlaylistId(uploadsPlaylistId);
}

async function getVideosByPlaylistId(playlistId) {
  let requestOptions = {
    part: 'snippet,contentDetails',
    playlistId: playlistId,
    fields: 'items(contentDetails(videoId,videoPublishedAt),snippet(channelId,channelTitle,thumbnails(default,medium),title))',
    maxResults: 10
  };
  let response = await gapi.client.youtube.playlistItems.list(requestOptions);
  let sortedPlaylistItems = response.result.items.sort((a, b) => {
    a = new Date(a.contentDetails.videoPublishedAt);
    b = new Date(b.contentDetails.videoPublishedAt);
    return a > b ? -1 : a < b ? 1 : 0;
  });
  let newPlaylistItems = filterNewVideos(sortedPlaylistItems);
  let videos = newPlaylistItems.map(playlistItem => {
    return {
      channelId: playlistItem.snippet.channelId,
      channelTitle: playlistItem.snippet.channelTitle,
      id: playlistItem.contentDetails.videoId,
      title: playlistItem.snippet.title,
      publishedAt: playlistItem.contentDetails.videoPublishedAt,
      publishedAtDate: new Date(playlistItem.contentDetails.videoPublishedAt),
      thumbnail: playlistItem.snippet.thumbnails.medium || playlistItem.snippet.thumbnails.default
    };
  });
  for (const video of videos) {
    await getVideoDetails(video);
  }
  let newVideos = videos.filter(video => !video.isScheduled);
  if (newVideos.length > 0) {
    newVideos.forEach(video => allVideos[video.id] = video);
    renderChannel(newVideos);
  }
}

function filterNewVideos(playlistItems) {
  let channelId = playlistItems[0].snippet.channelId;
  let lastVideoWatched = watchedVideos.find(watchedVideo => (watchedVideo.channelId || watchedVideo.channel) === channelId);
  if (!lastVideoWatched) {
    return playlistItems;
  }
  if (lastVideoWatched.publishedAt) {
    return playlistItems.filter(playlistItem => playlistItem.contentDetails.videoPublishedAt > lastVideoWatched.publishedAt);
  }
  let newPlaylistItems = [];
  let lastVideoId = lastVideoWatched.lastVideoSeen;
  for (let playlistItem of playlistItems) {
    if (playlistItem.contentDetails.videoId === lastVideoId) {
      break;
    }
    newPlaylistItems.push(playlistItem);
  }
  return newPlaylistItems;
}

async function getVideoDetails(video) {
  let requestOptions = {
    id: video.id,
    part: 'contentDetails,liveStreamingDetails',
    fields: 'items/contentDetails/duration,items/liveStreamingDetails/scheduledStartTime'
  };
  let response = await gapi.client.youtube.videos.list(requestOptions);
  let videoItem = response.result.items[0];
  
  if (videoItem.liveStreamingDetails && videoItem.liveStreamingDetails.scheduledStartTime) {
    video.isScheduled = new Date(videoItem.liveStreamingDetails.scheduledStartTime) > new Date();
  }
  if (video.isScheduled) {
    return;
  }
  
  let duration = videoItem.contentDetails.duration;
  let iso8601DurationRegex = /^P([0-9]+(?:[,\.][0-9]+)?Y)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?D)?(?:T([0-9]+(?:[,\.][0-9]+)?H)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?S)?)?$/;
  let result = iso8601DurationRegex.exec(duration);
  if (!result) {
    console.warn(`Cannot parse duration string ${duration} for video ${video.Id} of channel ${video.channelTitle}`);
    return;
  }
  let hours = result[4] ? result[4].replace('H', '') : '';
  let minutes = result[5] ? result[5].replace('M', '') : '';
  let seconds = result[6] ? result[6].replace('S', '') : '';
  hours = hours ? hours + ':' : '';
  minutes = minutes.length === 0 ? '0' : minutes;
  minutes = minutes.length === 1 && hours ? '0' + minutes : minutes;
  seconds = seconds.length === 0 ? '0' : seconds;
  seconds = seconds.length === 1 ? '0' + seconds : seconds;
  video.duration = `${hours}${minutes}:${seconds}`;
}

function renderChannel(videos) {
  let channelTitle = videos[0].channelTitle;
  let channelTitleDiv = $('<div/>').addClass('channelTitle').text(channelTitle);
  let videosDiv = $('<div/>').addClass('videos');
  let table = $('<table/>');
  let tableWidth = 0;
  let row = $('<tr/>');

  videos.forEach(video => {
    renderVideo(video, row);
    tableWidth += 320 + 20;
  });
  
  table.width(tableWidth);
  table.append(row);
  videosDiv.append(table);

  let container = $('#video-container');
  container.append(channelTitleDiv);
  container.append(videosDiv);
}

// Create a listing for a video.
function renderVideo(video, row) {
  let dateString = video.publishedAtDate.toDateString() + ' ';
  let time = video.publishedAtDate.toTimeString().substring(0, 8);
  dateString += time.charAt(0) == 0 ? time.substring(1) : time;
  let openHandler = `onclick="openVideo('${video.id}')"`;
  let markHandler = `onclick="markVideo('${video.id}')"`;
  let infoHandler = `onclick="logVideoInfo('${video.id}')"`;
  let videoCell = `<td id="${video.id}">
					<div><img src="${video.thumbnail.url}" ${openHandler}></div>
					<div id="${video.id}-title">${video.title}</div>
					<div><span class="metadata">${dateString} <span class="vid-duration">${video.duration}</span></span>
					    <i class="fas fa-check-circle toolbar" ${markHandler}></i>
					    <i class="fas fa-info-circle tool" ${infoHandler} title="Info"></i>
					    <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank"><i class="fas fa-external-link-alt tool"></i></a>
					</div>
				</td>`;
  row.append(videoCell);
}

function openVideo(videoId) {
  window.open('https://www.youtube.com/watch?v=' + videoId, '_blank');
  markVideo(videoId);
}

async function markVideo(videoId) {
  let video = allVideos[videoId];
  let dto = {
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    videoId: video.id,
    videoTitle: video.title,
    publishedAt: video.publishedAt,
    duration: video.duration,
    thumbnailUrl: video.thumbnail.url
  };
  try {
    await $.ajax({
      type: "POST",
      url: "/api/videos",
      data: JSON.stringify(dto),
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      processData: false
    });
    $('#' + videoId).css('opacity', '0.2');
  } catch (error) {
    console.error(`Video "${video.title}" with ID ${videoId} could not be marked as seen. Error:`, error);
    toastr.error(`<span class="notification">Couldn't mark video as seen</span>`);
  }
}

function logVideoInfo(videoId) {
  let video = allVideos[videoId];
  console.log(video);
}

// Retrieve the next page of videos in the playlist.
function nextPage() {
  requestVideoPlaylist(lastPlaylistId, nextPageToken);
}

// Retrieve the previous page of videos in the playlist.
function previousPage() {
  requestVideoPlaylist(lastPlaylistId, prevPageToken);
}
