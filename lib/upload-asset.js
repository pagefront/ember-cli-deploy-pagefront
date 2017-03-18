var RSVP = require('rsvp');
var mime = require('mime');
var join = require('path').join;
var put = require('request').put;
var readFile = RSVP.denodeify(require('fs').readFile);

var GZIP = 'gzip';
var ERROR_THRESHOLD = 400;
var FINGERPRINT_REGEX = /[0-9a-f]{32}/;
var MINUTE = 60;
var DAY = MINUTE * 60 * 24;

function isFingerprinted(name) {
  return FINGERPRINT_REGEX.test(name);
}

module.exports = function(distDir, asset, gzipped) {
  var fullPath = join(distDir, asset.name);
  var cacheDuration = isFingerprinted(asset.name) ? DAY : MINUTE;

  return readFile(fullPath).then(function(file) {
    return new RSVP.Promise(function(resolve, reject) {
      put({
        url: asset.upload_url,
        body: file,
        headers: {
          'Content-Encoding': gzipped ? GZIP : undefined,
          'Content-Type': mime.lookup(fullPath),
          'Cache-Control': 'max-age=' + String(cacheDuration) + ', public'
        }
      }, function(error, response, body) {
        if (error) {
          reject(error);
        } else if (response.statusCode >= ERROR_THRESHOLD) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  });
};
