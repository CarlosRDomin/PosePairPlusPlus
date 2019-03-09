class CircularBuffer {

  constructor(size, bufferType) {
    this._startIdx = 0;
    this._hasBeenFilled = false;  // Keep track of whether more than 'size' elements have been pushed or not
    this.size = size;
    bufferType = bufferType || Float32Array;
    this._isTypedArray = (bufferType !== Array);
    this._buffer = new bufferType(this._isTypedArray? 2*size : size);  // TypedArray doesn't support concat -> Use twice as much memory but simply call subarray() for quick "slicing"
  }

  _clampIndex(index) {
    if (index >= this.size) {
      this._hasBeenFilled = true;
    }
    let mod = (this._hasBeenFilled)? this.size:this._startIdx;

    let modIndex = (index % mod);
    if (modIndex < 0) modIndex += mod;
    return modIndex;
  }

  values() {
    let startInd = (this._hasBeenFilled? this._startIdx : this.size); // Slice the array if fewer than size elements have been added

    if (this._isTypedArray) {
      return this._buffer.subarray(startInd, this._startIdx+this.size);
    }else {
      return this._buffer.slice(startInd).concat(this._buffer.slice(0,this._startIdx));
    }
  }

  push(arr) {
    if (arr.length > this.size) { // Only need to copy the last 'size' elements of the array
      arr = arr.slice(arr.length-this.size);
    }

    if (this._isTypedArray) {
      // Memory scheme: (for this example, size=7, _startIdx=6, arr[w,x,y,z]). Caps indicate which values are modified by each line of code below
      // ---------------------------------      ---------------------------------      ---------------------------------      ---------------------------------
      // | a b c d e f g | a b c d e f g |  ->  | a b c d e f W | X Y Z d e f g |  ->  | a b c d e f w | x y z d e f W |  ->  | X Y Z d e f w | x y z d e f w |
      // ---------------------------------      ---------------------------------      ---------------------------------      ---------------------------------
      this._buffer.set(arr, this._startIdx); // Paste the values from arr
      this._buffer.copyWithin(this._startIdx + this.size, this._startIdx, this._startIdx + arr.length);  // Copy the same values on the second half of the buffer
      this._buffer.copyWithin(0, this.size, this._startIdx + arr.length);  // Copy overflowing values from the second half back into the first half (if necessary)
      let newStartIdx = this._startIdx + arr.length; // Update start index
      if (newStartIdx >= this.size) this._hasBeenFilled = true; // Update this._hasBeenFilled if necessary
      this._startIdx = newStartIdx % this.size; // Clamp index: keep it within [0~size)
    } else {
      for (let i=0; i<arr.length; i++) {
        this._buffer[this._startIdx++] = arr[i];
        if (this._startIdx === this.size) {
          this._startIdx = 0;
          this._hasBeenFilled = true;
        }
      }
    }
  }

  at(index) {
    return this._buffer[this._clampIndex(this._startIdx+index)];
  }

  set(index, val) {
    let pos = this._clampIndex(this._startIdx+index);
    this._buffer[pos] = val;
    if (this._isTypedArray) this._buffer[pos+this.size] = val;  // Copy the value also in the 2nd half of the buffer if needed
    return pos;
  }
}

export default CircularBuffer;