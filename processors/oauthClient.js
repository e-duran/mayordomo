'use strict';

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');

class SampleClient {
  constructor(options) {
    this._options = options || { scopes: [] };
  }

  async authenticate(scopes) {
    return new Promise(async (resolve, reject) => {
      if (!global.config) global.config = await global.getConfig();
      const config = global.config;
      const credentials = config.googleApiCredentials.web;
      const redirectUri = credentials.redirect_uris[credentials.redirect_uris.length - 1];
      this.oAuth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        redirectUri
      );

      this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes.join(' '),
      });

      if (config.googleApiTokens) {
        this.oAuth2Client.setCredentials({
          refresh_token: config.googleApiTokens.refresh_token
        });
        resolve(this.oAuth2Client);
      } else {
        const server = http
          .createServer(async (req, res) => {
            try {
              if (req.url.indexOf('/oauth2callback') > -1) {
                const qs = new url.URL(req.url, 'http://localhost:3000')
                  .searchParams;
                res.end(
                  'Authentication successful!'
                );
                server.destroy();
                const { tokens } = await this.oAuth2Client.getToken(qs.get('code'));
                this.oAuth2Client.credentials = tokens;

                const configStore = await global.getStore('configs');
                var updatedProperties = {
                  googleApiTokens: tokens,
                };
                var result = await configStore.updateOne({ _id: config._id }, { $set: updatedProperties }, { returnOriginal: false });
                configStore.client.close();
                console.log(result);

                resolve(this.oAuth2Client);
              }
            } catch (e) {
              reject(e);
            }
          })
          .listen(3000, () => {
            // open the browser to the authorize url to start the workflow
            opn(this.authorizeUrl, { wait: false }).then(cp => cp.unref());
          });
        destroyer(server);
      }
    });
  }
}
module.exports = new SampleClient();