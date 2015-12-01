var Promise = require('ember-cli/lib/ext/promise');
var mime = require('mime');
var join = require('path').join;
var put = require('request').put;
var readFile = Promise.denodeify(require('fs').readFile);

var GZIP = 'gzip';
var ERROR_THRESHOLD = 400;
var FINGERPRINT_REGEX = /[0-9a-f]{32}/;
var MINUTE = 60;
var DAY = MINUTE * 60 * 24;

function isFingerprinted(name) {
  return FINGERPRINT_REGEX.test(name);
}

module.exports = function(distDir, asset) {
  var fullPath = join(distDir, asset.name);
  var cacheDuration = isFingerprinted(asset.name) ? DAY : MINUTE;

  return readFile(fullPath).then(function(file) {
    return new Promise(function(resolve, reject) {
      put({
        url: asset.upload_url,
        body: file,
        headers: {
          'Content-Encoding': GZIP,
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
