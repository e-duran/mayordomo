/* global $, gapi, handleAPILoaded */
var GoogleAuth;
var SCOPE = 'https://www.googleapis.com/auth/youtube';
var oauth2ClientId;

async function handleClientLoad() {
  oauth2ClientId = await $.ajax({ url: '/api/videos/clients/1' });
    // Load the API's client and auth2 modules.
    // Call the initClient function after the modules load.
  gapi.load('client:auth2', initClient);
}

async function initClient() {
  // Retrieve the discovery document for version 3 of Google YouTube API.
  var discoveryUrl = 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest';

  // Initialize the gapi.client object, which app uses to make API requests.
  // 'scope' field specifies space-delimited list of access scopes.
  await gapi.client.init({
    'discoveryDocs': [discoveryUrl],
    'clientId': oauth2ClientId,
    'scope': SCOPE
  });
  GoogleAuth = gapi.auth2.getAuthInstance();

  // Listen for sign-in state changes.
  GoogleAuth.isSignedIn.listen(setSigninStatus);

  // Handle initial sign-in state. (Determine if user is already signed in.)
  setSigninStatus();

  // Call handleAuthClick function when user clicks on the "login" link
  $('#login-link').on('click', handleAuthClick);
}

function handleAuthClick() {
  if (GoogleAuth.isSignedIn.get()) {
    // User is authorized and has clicked 'Sign out' button.
    GoogleAuth.signOut();
  } else {
    // User is not signed in. Start Google auth flow.
    GoogleAuth.signIn();
  }
}

function setSigninStatus() {
  var user = GoogleAuth.currentUser.get();
  var isAuthorized = user.hasGrantedScopes(SCOPE);
  if (isAuthorized) {
    $('.pre-auth').hide();
    $('.post-auth').show();
    loadAPIClientInterfaces();
  }
}

// Load the client interfaces for the YouTube Analytics and Data APIs, which
// are required to use the Google APIs JS client. More info is available at
// https://developers.google.com/api-client-library/javascript/dev/dev_jscript#loading-the-client-library-and-the-api
function loadAPIClientInterfaces() {
  gapi.client.load('youtube', 'v3', handleAPILoaded);
}
