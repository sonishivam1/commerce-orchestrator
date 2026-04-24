const path = require('path');

module.exports = function(options) {
  return {
    ...options,
    externals: [
      function({ context, request }, callback) {
        if (/^@cdo\//.test(request) || request.startsWith('.') || path.isAbsolute(request)) {
          return callback();
        }
        return callback(null, 'commonjs ' + request);
      },
    ],
  };
};
