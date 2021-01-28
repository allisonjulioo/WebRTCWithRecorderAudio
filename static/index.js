let selfEasyrtcid = "";
const supportsRecording = easyrtc.supportsRecording();
const url = new URL(window.location);
const transaction_id = url.searchParams.get("transaction_id");
const office_id = url.searchParams.get("office_id");
const token =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMTAsInVzZXJuYW1lIjoiMTIzNCIsImV4cCI6MTY0Mjg5OTg3Nn0.jNSSjiyRl1_Z7I9J2AKb3UHe-P2F2mOzg3GFdIZ1s34";
let audiosArr = [];
let buttonStopRecording;
let statusCall;
let list = [];
const baseAudiosArr = [];

function connect() {
  buttonStopRecording = document.getElementById("stopRecording");
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
}
function performCall(otherEasyrtcid) {
  easyrtc.hangupAll();
  var successCB = function () {};
  var failureCB = function () {};
  easyrtc.call(otherEasyrtcid, successCB, failureCB);
  list.push(otherEasyrtcid);
  list.length >= 2 ? startRecording() : "";
}
function getListUsersRoom(roomName, data, isPrimary) {
  for (var easyrtcid in data) {
    performCall(easyrtcid);
  }
}
function conenecteds() {
  if (!transaction_id) {
    document.getElementById("action-buttons").remove();
  }
}

function loginSuccess(easyrtcid) {
  selfEasyrtcid = easyrtcid;
  if (transaction_id) {
    document.getElementById("iam1").innerHTML = transaction_id;
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
  statusCall.classList.remove("ended");
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
      clearInterval(t);
      startRecording();
    }, 2000);
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
function saveAudios(base64AudioMessage) {
  baseAudiosArr.push(base64AudioMessage);
  if (baseAudiosArr.length === 2) {
    let params;
    if (transaction_id) {
      params = `?officeId=${office_id}&transaction_id=${transaction_id}`;
    } else {
      params = `?officeId=${office_id}`;
    }
    fetch(`http://localhost:3333/api/office/post-office-recordings/${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
        self: baseAudiosArr[0],
        caller: baseAudiosArr[1],
      }),
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
  statusCall.classList.remove("active");
  statusCall.innerHTML = "Chamada encerrada";
  statusCall.classList.add("ended");
  buttonStopRecording.classList.remove("show");
  clearInterval(t);
  if (selfRecorder) {
    selfRecorder.stop();
  }
  if (callerRecorder) {
    callerRecorder.stop();
  }
}
