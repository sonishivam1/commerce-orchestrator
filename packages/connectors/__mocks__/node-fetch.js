// Manual mock for node-fetch (ESM-only v3) so Jest can load it in CommonJS test runs.
// The test files override this with jest.mock('node-fetch') + mockResolvedValue.
const fetch = jest.fn();
module.exports = fetch;
module.exports.default = fetch;
