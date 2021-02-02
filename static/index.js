const supportsRecording = easyrtc.supportsRecording();
const url = new URL(window.location);
const transaction_id = url.searchParams.get("transaction_id");
const office_id = url.searchParams.get("office_id");
const token = url.searchParams.get("token");
let audiosArr = [];
const baseAudiosArr = [];
let buttonStopRecording;
let statusCall;
let timerElement;

let selfRecorder = null;
let callerRecorder = null;
let timmerRecording;
let totalSeconds = 0;
const socket = io.connect("https://localhost:8443/");
easyrtc.useThisSocketConnection(socket);

function connect() {
  buttonStopRecording = document.getElementById("stopRecording");
  timerElement = document.getElementById("timer");
  statusCall = document.getElementById("inCall");
  if (!supportsRecording) {
    window.alert(
      "This browser does not support recording. Try chrome or firefox."
    );
  } else {
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
  easyrtc.setRoomOccupantListener(loggedInListener);
}
function loggedInListener(type, connections, conn) {
  if (!!Object.keys(connections).length) {
    startRecording();
  } else {
    endRecording();
  }
  checkPermissionMicrophone();
}
function checkPermissionMicrophone() {
  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;

  if (navigator.getUserMedia) {
    navigator.getUserMedia(
      { audio: true, video: { width: 1280, height: 720 } },
      function (stream) {
        console.log("Accessed the Microphone");
      },
      function (err) {
        console.log("The following error occured: " + err.name);
      }
    );
  } else {
    console.log("getUserMedia not supported");
  }
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
function conenecteds() {
  if (!office_id) {
    document.getElementById("action-buttons").remove();
  }
}

function loginSuccess(easyrtcid) {
  if (office_id) {
    document.getElementById("iam1").innerHTML = "Você";
  } else {
    document.getElementById("iam2").innerHTML = "Operador";
  }

  performCall(easyrtcid);
}

function loginFailure(errorCode, message) {
  easyrtc.showError(errorCode, message);
}

function startRecording() {
  selfRecorder = recordToFile(easyrtc.getLocalStream());
  statusCall.classList.remove("ended");
  document
    .querySelectorAll(".avatar")
    .forEach((avatar) => (avatar.style.backgroundColor = "#1e7e34"));
  statusCall.innerHTML = "Em chamada";
  statusCall.classList.add("active");
  buttonStopRecording.classList.add("show");

  if (easyrtc.getIthCaller(0)) {
    callerRecorder = recordToFile(
      easyrtc.getRemoteStream(easyrtc.getIthCaller(0), null)
    );
  } else {
    callerRecorder = null;
    setTimeout(() => {
      clearInterval(timmerRecording);
      startRecording();
    }, 2000);
  }
  timmerRecording = setInterval(setTime, 1000);
}

function setTime() {
  ++totalSeconds;
  timerElement.innerHTML = `${pad(parseInt(totalSeconds / 60))}:${pad(
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
function saveAudios(base64AudioMessage) {
  baseAudiosArr.push(base64AudioMessage);
  if (baseAudiosArr.length === 2) {
    fetch(`/recordings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
        self: baseAudiosArr[0],
        caller: baseAudiosArr[1],
        transaction_id,
        office_id,
      }),
    })
      .then((res) => {
        console.log("Validate status saving audio message: " + res.status);
        window.close();
      })
      .catch((error) => {
        console.log("Invalid status saving audio message: " + error);
        window.close();
      });
  }
}
async function endRecording() {
  statusCall.classList.remove("active");
  statusCall.innerHTML = "Aguardando...";
  timer.innerHTML = "00:00";
  buttonStopRecording.classList.remove("show");
  clearInterval(timmerRecording);
  totalSeconds = 0;
  if (selfRecorder) {
    selfRecorder.stop();
  }
  if (callerRecorder) {
    callerRecorder.stop();
  }
}
