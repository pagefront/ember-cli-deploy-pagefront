var CoreObject = require('core-object');
var RSVP = require('rsvp');
var request = require('request');

var HOST = 'https://api.pagefronthq.com';
var BODYLESS = ['HEAD', 'GET', 'DELETE'];
var MEDIA_TYPE = 'application/json';
var ERROR_THRESHOLD = 400;
var HEAD = 'HEAD';
var GET = 'GET';
var POST = 'POST';
var PUT = 'PUT';
var PATCH = 'PATCH';
var DELETE = 'DELETE';

module.exports = CoreObject.extend({
  init: function(key) {
    this.key = key;
  },

  createDifference: function(app, params) {
    var path = ['apps', app, 'differences'].join('/');

    return this.request(POST, path, params);
  },

  createRelease: function(app, params) {
    var path = ['apps', app, 'releases'].join('/');

    return this.request(POST, path, params);
  },

  listReleases: function(app) {
    var path = ['apps', app, 'releases'].join('/');

    return this.request(GET, path);
  },

  exchangeCredentials: function(params) {
    return this.request(PUT, 'keys/exchange', params);
  },

  bootstrapApp: function(params) {
    return this.request(POST, 'apps/bootstrap', params);
  },

  request: function(method, path, params) {
    var options = {
      method: method,
      url: this.urlFor(path),
      headers: {
        'Authorization': 'Token token="' + this.key + '"',
        'Content-Type': MEDIA_TYPE,
        'Accept': MEDIA_TYPE
      }
    };

    if (params) {
      if (BODYLESS.indexOf(method) === -1) {
        options.body = JSON.stringify(params);
      } else {
        options.qs = params;
      }
    }

    return new RSVP.Promise(function(resolve, reject) {
      request(options, function (error, response, body) {
        if (error) {
          reject(error);
        } else if (response.statusCode >= ERROR_THRESHOLD) {
          reject(response);
        } else {
          resolve(body && JSON.parse(body).data);
        }
      });
    });
  },

  urlFor: function(path) {
    return [HOST, path].join('/');
  }
});
