// Generated on 2015-08-24 using generator-web-data-connector 0.0.0

var express = require('express'),
    request = require('request'),
    env = require('node-env-file'),
    sha1 = require('sha1'),
    app = express(),
    port;

// For local development, load in environment variables.
env(__dirname + '/.env');
port = process.env.PORT || 9001;

if (!process.env.CLIENTID || !process.env.CLIENTSECRET) {
  console.error('Please ensure GitHub oauth CLIENTID and CLIENTSECRET environment variables are set.');
  process.exit(1);
}

// Serve files as if this were a static file server.
app.use(express.static('./'));

// Proxy the index.html file.
app.get('/', function (req, res) {
  res.sendFile('./index.html');
});

// A redirect to initialize GitHub oauth flow.
app.get('/authorize', function (req, res) {
  var clientIP = req.ips.join('|'),
      redirectTo = 'https://github.com/login/oauth/authorize' +
        '?client_id=' + process.env.CLIENTID +
        '&redirect_uri=' + encodeURIComponent(process.env.REDIRECTURI) +
        '&state=' + sha1(clientIP + process.env.SALT) +
        '&scope=public_repo,repo';

  res.redirect(redirectTo);
});

// Validates a given GitHub oauth state value.
app.get('/validate_state', function (req, res) {
  var state = req.query.state,
      clientIP = req.ips.join('|'),
      expectedState = sha1(clientIP + process.env.SALT);

  if (state === expectedState) {
    res.sendStatus(200);
  }
  else {
    res.sendStatus(403);
  }
});

// Create an endpoint to manage oauth bits.
app.post('/travis_token', function (req, res) {
  var gitHubRequestOptions = {
        url: 'https://github.com/login/oauth/access_token',
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        json: true,
        body: {
          client_id: process.env.CLIENTID,
          client_secret: process.env.CLIENTSECRET,
          code: req.query.code
        }
      };

  // Post the supplied code to GitHub to return a GitHub oauth token.
  request(gitHubRequestOptions, function (gError, gResponse, gBody) {
    var travisEndpoint = req.query.isPrivate ? 'https://api.travis-ci.com' : 'https://api.travis-ci.org',
        travisRequestOptions = {
          url: travisEndpoint + '/auth/github',
          method: 'POST',
          headers: {
            Accept: 'application/json'
          },
          json: true,
          body: {
            github_token: gBody.access_token
          }
        };

    // If GitHub responded favorably, proceed.
    if (!gError && gResponse.statusCode == 200) {
      // Post the supplied GitHub oauth token to Travis to return an auth token.
      request(travisRequestOptions, function (tError, tResponse, tBody) {
        if (!tError && tResponse.statusCode == 200) {
          // If Travis responded favorably, return the Travis auth token.
          res.set('Content-type', 'application/json');
          res.send(tBody);
        }
        else {
          res.sendStatus(500);
        }
      });
    }
    else {
      res.sendStatus(500);
    }
  });
});

var server = app.listen(port, function () {
  var port = server.address().port;
  console.log('Express server listening on port ' + port);
});

module.exports = app;
