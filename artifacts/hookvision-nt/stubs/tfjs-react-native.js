// Stub for @tensorflow/tfjs-react-native in Expo Go.
// Expo Go does not ship ExpoGL, so the real package crashes at import time
// with "Cannot find native module 'ExpoGL'".  The side-effect import in
// vision.native.ts only registers the WebGL backend — stubbing it means
// TF.js falls back to the CPU backend which *is* available.
// decodeJpeg is called inside quickScan's try-catch, so returning null
// gracefully lets the Analyze screen render normally.
module.exports = {
  decodeJpeg: function () {
    return null;
  },
};
