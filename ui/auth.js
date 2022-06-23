/* global $, gapi, handleAPILoaded */
const googleApiLoadPromise = new Promise((resolve, reject) => {
  onGoogleApiLoad = resolve;
  onGoogleApiLoadError = reject;
});
const googleIdentityLoadPromise = new Promise((resolve, reject) => {
  onGoogleIdentityLoad = resolve;
  onGoogleIdentityLoadError = reject;
});

let tokenClient;
(async () => {
  // First, load and initialize the gapi.client
  await googleApiLoadPromise;
  const oAuth2ClientId = await $.ajax({ url: '/api/videos/clients/1' });
  await new Promise((resolve, reject) => {
    // NOTE: the 'auth2' module is no longer loaded.
    gapi.load('client', {callback: resolve, onerror: reject});
  });
  await gapi.client.init({
    // NOTE: OAuth2 'scope' and 'client_id' parameters have moved to initTokenClient().
  })
  .then(function() {  // Load the YouTube API discovery document.
    gapi.client.load('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest');
  });

  // Now load the Google Identity Services (GIS) client
  await googleIdentityLoadPromise;
  await new Promise((resolve, reject) => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: oAuth2ClientId,
          scope: 'https://www.googleapis.com/auth/youtube',
          prompt: '',
          callback: '',  // defined at request time in await/promise scope.
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
  await requestAccessToken();
  if (gapi.client.getToken()) {
    $('#login-container').hide();
    handleAPILoaded();
  }
})();

async function requestAccessToken() {
  await new Promise((resolve, reject) => {
    try {
      // Settle this promise in the response callback for requestAccessToken()
      tokenClient.callback = (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          reject(tokenResponse);
        }
        // GIS has automatically updated gapi.client with the newly issued access token.
        resolve(tokenResponse);
      };
      tokenClient.requestAccessToken();
    } catch (error) {
      console.log(error)
    }
  });
}
