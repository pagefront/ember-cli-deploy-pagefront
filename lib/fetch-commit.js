var fs = require('fs');
var join = require('path').join;
var findFile = require('./find-file');

var GIT = '.git';
var HEAD = 'HEAD';
var UTF8 = 'utf8';
var MESSAGE = 'COMMIT_EDITMSG';
var FILE_OPTIONS = { encoding: UTF8 };

function tryRead(path) {
  var contents;

  try {
    contents = fs.readFileSync(path, FILE_OPTIONS);
  } catch (e) { }

  return contents;
}

function isRef(contents) {
  return /^ref/.test(contents);
}

function fetchSha(git) {
  var head = tryRead(join(git, HEAD));

  if (head && isRef(head)) {
    var ref = join(git, head.split(' ')[1].trim());
    var contents = tryRead(ref);

    return contents && contents.trim();
  } else {
    return head;
  }
}

function fetchMessage(git) {
  var message = tryRead(join(git, MESSAGE));

  return message && message.trim();
}

module.exports = function() {
  var git = findFile(GIT);

  return {
    sha: fetchSha(git),
    message: fetchMessage(git)
  };
};
