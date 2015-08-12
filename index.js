/* jshint node: true */
'use strict';

var PluginBase = require('ember-cli-deploy-plugin');
var Promise = require('ember-cli/lib/ext/promise');
var readFileSync = require('fs').readFileSync;
var joinPath = require('path').join;

var API = require('./lib/api');
var uploadAsset = require('./lib/upload-asset');
var fetchCommit = require('./lib/fetch-commit');
var findFile = require('./lib/find-file');

var PAGEFRONTRC = '.pagefrontrc';
var INDEX = 'index.html';

function mungeRelease(release) {
  return {
    revision: release.attributes.version,
    version: 'v' + release.attributes.version,
    timestamp: new Date(release.attributes.created_at).getTime(),
    active: false
  };
}

module.exports = {
  name: 'ember-cli-deploy-pagefront',

  createDeployPlugin: function(options) {
    var Plugin = PluginBase.extend({
      name: options.name,
      requiredConfig: ['app', 'key'],
      defaultConfig: {
        key: function() {
          var rawPagefrontrc = readFileSync(findFile(PAGEFRONTRC));

          return JSON.parse(rawPagefrontrc).key
        }
      },

      configure: function(context) {
        this._super.configure.call(this, context);
        this.api = new API(this.readConfig('key'));
      },

      fetchRevisions: function(context) {
        var app = this.readConfig('app');

        return this.api.listReleases(app).then(function(payload) {
          context.revisions = payload.map(mungeRelease);

          if (context.revisions.length) {
            context.revisions[0].active = true;
          }
        });
      },

      activate: function(context) {
        var app = this.readConfig('app');
        var revision = context.commandOptions.revision;
        var didActivate = this._didActivate.bind(this, revision);

        return this.api.createRelease(app, {
          release: revision
        }).then(didActivate);
      },

      upload: function(context) {
        var app = this.readConfig('app');
        var manifestPath = joinPath(context.distDir, context.manifestPath);
        var manifest = readFileSync(manifestPath).toString().split("\n");
        var indexPath = joinPath(context.distDir, INDEX);
        var index = readFileSync(indexPath).toString();
        var uploadAssets = this._uploadAssets.bind(this, context.distDir);
        var didUploadAssets = this._didUploadAssets.bind(this);
        var uploadIndex = this._uploadIndex.bind(this, app, manifest, index);
        var didUploadIndex = this._didUploadIndex.bind(this);

        return this._createDifference(app, manifest)
          .then(uploadAssets)
          .then(didUploadAssets)
          .then(uploadIndex)
          .then(didUploadIndex);
      },

      _createDifference: function(app, manifest) {
        return this.api.createDifference(app, {
          manifest: manifest
        });
      },

      _uploadAssets: function(distDir, diff) {
        var uploads = diff.attributes.missing.map(function(asset) {
          return uploadAsset(distDir, asset);
        });

        return Promise.all(uploads);
      },

      _didUploadAssets: function(assets) {
        this.log('uploaded ' + assets.length + ' assets');
      },

      _uploadIndex: function(app, manifest, index) {
        var commit = fetchCommit();

        return this.api.createRelease(app, {
          index: index,
          commit_sha: commit.sha,
          commit_message: commit.message,
          manifest: manifest
        });
      },

      _didUploadIndex: function(release) {
        this.log('released v' + release.attributes.version);
      },

      _didActivate: function(version) {
        this.log('activated v' + version);
      }
    });

    return new Plugin();
  }
};
