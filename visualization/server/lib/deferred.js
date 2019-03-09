//////////////////////////
// Class Implementation //
//////////////////////////

/*
    Class: Deferred
    Basic implementation of a deferred object. It represents work that is not yet finished.
 */
class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject)=> {
      this.reject = reject;
      this.hasResolved = false;
      this.resolve = ()=> {
      	this.hasResolved = true;
      	resolve();
      }
    })
  }
}

/////////////
// Exports //
/////////////
module.exports = Deferred;