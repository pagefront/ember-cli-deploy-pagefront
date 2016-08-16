/* jshint node: true */
'use strict';

var PluginBase = require('ember-cli-deploy-plugin');
var Promise = require('ember-cli/lib/ext/promise');
var readFileSync = require('fs').readFileSync;
var joinPath = require('path').join;

var API = require('./lib/api');
var uploadAsset = require('./lib/upload-asset');
var fetchCommit = require('./lib/fetch-commit');

var INDEX = 'index.html';
var NEW_LINE = '\n';
var MISSING_KEY = 'Pagefront API key not found. Please log in using `ember login` or set the PAGEFRONT_KEY environment variable.' + NEW_LINE;
var INVALID_ENVIRONMENT = 'Environment must be one of: production, staging, development' + NEW_LINE;
var VALID_ENVIRONMENTS = ['production', 'staging', 'development'];

function mungeRelease(release) {
  return {
    revision: release.attributes.version,
    version: 'v' + release.attributes.version,
    timestamp: new Date(release.attributes.created_at).getTime(),
    active: false
  };
}

function validEnvironment(environment) {
  return VALID_ENVIRONMENTS.indexOf(environment) > -1;
}

function urlFor(app, environment) {
 var subdomain = environment === 'production' ? app : app + '.' + environment;

 return 'https://' + subdomain + '.pagefrontapp.com';
}

module.exports = {
  name: 'ember-cli-deploy-pagefront',

  createDeployPlugin: function(options) {
    var Plugin = PluginBase.extend({
      name: options.name,
      requiredConfig: ['app', 'key'],

      configure: function(context) {
        if (!validEnvironment(context.deployTarget)) {
          return Promise.reject(INVALID_ENVIRONMENT);
        }

        if (!this.pluginConfig.key) {
          return Promise.reject(MISSING_KEY);
        }

        this._super.configure.call(this, context);
        this.api = new API(this.readConfig('key'));
      },

      willDeploy: function(context) {
        this.log('Preparing for deploy...', { color: 'white' });
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
        var uploadAssets = this._uploadAssets.bind(this, context.distDir, context.gzippedFiles);
        var didUploadAssets = this._didUploadAssets.bind(this);
        var uploadIndex = this._uploadIndex.bind(this, app, context.deployTarget, manifest, index);
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

      _uploadAssets: function(distDir, gzippedFiles, diff) {
        var uploads = diff.attributes.missing.map(function(asset) {
          return uploadAsset(distDir, asset, gzippedFiles && gzippedFiles.indexOf(asset.name) > -1);
        });

        return Promise.all(uploads);
      },

      _didUploadAssets: function(assets) {
        var inflected = assets.length === 1 ? 'asset' : 'assets';

        this.log('Uploaded ' + assets.length + ' ' + inflected, { color: 'white' });
      },

      _uploadIndex: function(app, environment, manifest, index) {
        var commit = fetchCommit();

        return this.api.createRelease(app, {
          index: index,
          environment: environment,
          commit_sha: commit.sha,
          commit_message: commit.message,
          manifest: manifest
        });
      },

      _didUploadIndex: function(release) {
        var url = urlFor(this.readConfig('app'), release.attributes.environment);

        this.log('Success! Released v' + release.attributes.version + ' to ' + url, { color: 'green' });
      },

      _didActivate: function(version) {
        this.log('Success! Activated v' + version, { color: 'green' });
      }
    });

    return new Plugin();
  }
};
