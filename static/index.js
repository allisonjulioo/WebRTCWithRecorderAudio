let selfEasyrtcid = "";
const supportsRecording = easyrtc.supportsRecording();
const url = new URL(window.location);
const connection_id = url.searchParams.get("id");
let audiosArr = [];

function connect() {
  if (!supportsRecording) {
    window.alert(
      "This browser does not support recording. Try chrome or firefox."
    );
  } else {
    document.getElementById("startRecording").style.display = "block";
    document.getElementById("stopRecording").style.display = "none";
    easyrtc.setRecordingVideoCodec("vp8");
  }

  easyrtc.setVideoDims(640, 480);
  easyrtc.setRoomOccupantListener(getListUsersRoom);
  easyrtc.easyApp(
    "easyrtc.audioSimple",
    "selfVideo",
    ["callerVideo"],
    loginSuccess,
    loginFailure
  );
  conenecteds();
}
function performCall(otherEasyrtcid) {
  easyrtc.hangupAll();
  var successCB = function () {};
  var failureCB = function () {};
  easyrtc.call(otherEasyrtcid, successCB, failureCB);
}
function getListUsersRoom(roomName, data, isPrimary) {
  for (var easyrtcid in data) {
    performCall(easyrtcid);
  }
}
async function conenecteds() {
  if (!connection_id) {
    document.getElementById("action-buttons").remove();
  }
  const res = await fetch("/recordings");
  if (res.status === 200) {
    return res.json().then((json) => {
      json.messageFilenames.forEach((filename) => {});
    });
  }
  console.log("Invalid status getting recordings: " + res.status);
}

function loginSuccess(easyrtcid) {
  selfEasyrtcid = easyrtcid;
  if (connection_id) {
    document.getElementById("iam1").innerHTML = connection_id;
  } else {
    document.getElementById("iam2").innerHTML =
      "server-" + easyrtc.cleanId(easyrtcid);
  }

  performCall(easyrtcid);
}

function loginFailure(errorCode, message) {
  easyrtc.showError(errorCode, message);
}

let selfRecorder = null;
let callerRecorder = null;
let t;

function startRecording() {
  selfRecorder = recordToFile(easyrtc.getLocalStream());
  if (selfRecorder) {
    document.getElementById("startRecording").style.display = "none";
    document.getElementById("stopRecording").style.display = "block";
  } else {
    window.alert("failed to start recorder for self");
    return;
  }
  if (easyrtc.getIthCaller(0)) {
    callerRecorder = recordToFile(
      easyrtc.getRemoteStream(easyrtc.getIthCaller(0), null)
    );
  } else {
    callerRecorder = null;
  }
  t = setInterval(setTime, 1000);
}
let totalSeconds = 0;

function setTime() {
  const timer = document.getElementById("timer");
  ++totalSeconds;
  timer.innerHTML = `${pad(parseInt(totalSeconds / 60))}:${pad(
    totalSeconds % 60
  )}`;
}

function pad(val) {
  const valString = val + "";
  if (valString.length < 2) {
    return "0" + valString;
  }
  return valString;
}

function recordToFile(mediaStream) {
  function blobCallback(blob) {
    const videoURL = window.URL.createObjectURL(blob);
    getAudiosByBlobUrl(videoURL);
  }

  const mediaRecorder = easyrtc.recordToBlob(mediaStream, blobCallback);
  return mediaRecorder;
}
function getAudiosByBlobUrl(videoURL) {
  audiosArr.push(videoURL);
  if (audiosArr.length === 2) {
    audiosArr.map(async (blobUrl) => {
      let file = await fetch(blobUrl)
        .then((res) => res.blob())
        .then(
          (blobFile) =>
            new File([blobFile], `fileName`, {
              type: "audio/mp3",
            })
        );
      sendAudioFile(file);
    });
  }
}
async function sendAudioFile(blob) {
  const reader = new window.FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = () => saveAudios(reader.result);
}
const baseAudiosArr = [];
function saveAudios(base64AudioMessage) {
  baseAudiosArr.push(base64AudioMessage);
  if (baseAudiosArr.length === 2) {
    fetch("/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: baseAudiosArr }),
    }).then((res) => {
      if (res.status === 201) {
        const snd = new Audio(base64AudioMessage);
        snd.play();
      } else {
        console.log("Invalid status saving audio message: " + res.status);
      }
    });
  }
}
async function endRecording() {
  clearInterval(t);
  if (selfRecorder) {
    selfRecorder.stop();
  }
  if (callerRecorder) {
    callerRecorder.stop();
  }

  document.getElementById("startRecording").style.display = "block";
  document.getElementById("stopRecording").style.display = "none";
}
