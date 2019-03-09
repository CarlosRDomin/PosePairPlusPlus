// This library is a wrapper around 'express-sse', modifying the Cache-Control header from 'no-cache' to 'no-transform'
// so that SSEs are sent even through React's proxy (otherwise events aren't received on the front-end)
// [solved according to https://github.com/facebook/create-react-app/issues/1633]

const origSSE = require("express-sse");
const INIT_MSG = "INIT";

class SSE extends origSSE {

  constructor() {
    /* super.init will set res's Cache-Control header to 'no-cache'. In order to overwrite it, we can't let super.init
     * send anything, otherwise res.setHeader crashes (since the header has already been sent)
     * However, we want to send an intial message such that the front-end's SSE.onopen is triggered. We will manually
     * send this "INIT" message in this.init -> Call super constructor with no initial message (null) */
    super(null, {isSerialized: false}); // super() sets initial to [] even if it is null, so we need to set isSerialized=false to prevent sending this.initial
  }

  init(req, res) {
    super.init(req, res);
    res.setHeader('Cache-Control', 'no-transform'); // Overwrite the Cache-Control header to work even through React's proxy
    this.send(INIT_MSG);  // Send a known initial message in order to trigger the front-end's SSE.onopen
  }
}

module.exports = {SSE, INIT_MSG};