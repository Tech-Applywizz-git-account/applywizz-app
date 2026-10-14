const WHOOSH = require("./assets/sfx/pay-whoosh.mp3");
const SUCCESS = require("./assets/sfx/pay-success.mp3");

let audioApi = null;
let tried = false;
let armed = false;

function loadAudio() {
  if (tried) return audioApi;
  tried = true;
  try {
    const mod = require("expo-audio");
    if (mod?.createAudioPlayer) audioApi = mod;
  } catch {
    audioApi = null;
  }
  return audioApi;
}

async function play(source) {
  const audio = loadAudio();
  if (!audio) return;
  try {
    if (!armed && audio.setAudioModeAsync) {
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      });
      armed = true;
    }
    const player = audio.createAudioPlayer(source);
    player.play();
  } catch {
    audioApi = null;
  }
}

export function playPayWhoosh() {
  return play(WHOOSH);
}

export function playPaySuccess() {
  return play(SUCCESS);
}
