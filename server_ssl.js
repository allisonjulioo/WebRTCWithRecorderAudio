// Load required modules
const https = require("https");
const fs = require("fs");
const express = require("express");
const io = require("socket.io");
const { promisify } = require("util");
const bodyParser = require("body-parser");

const easyrtc = require("./lib/easyrtc_server");
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const audioFolder = "./public/recordings/";
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder);
}

// Setup and configure Express http server. Expect a subfolder called "static" to be the web root.
const httpApp = express();
httpApp.use(
  bodyParser.urlencoded({
    limit: "5mb",
    parameterLimit: 100000,
    extended: false,
  })
);

httpApp.use(
  bodyParser.json({
    limit: "5mb",
  })
);
httpApp.use(bodyParser.json());
httpApp.use(express.static(__dirname + "/static/"));

// Start Express https server on port 8443
const webServer = https.createServer(
  {
    key: fs.readFileSync(__dirname + "/certs/localhost.key"),
    cert: fs.readFileSync(__dirname + "/certs/localhost.crt"),
  },
  httpApp
);

// Start Socket.io so it attaches itself to Express server
const socketServer = io.listen(webServer, { "log level": 1 });

// Start EasyRTC server
easyrtc.events.on(
  "easyrtcAuth",
  (socket, easyrtcid, msg, socketCallback, callback) => {
    easyrtc.events.defaultListeners.easyrtcAuth(
      socket,
      easyrtcid,
      msg,
      socketCallback,
      (err, connectionObj) => {
        if (err || !msg.msgData || !msg.msgData.credential || !connectionObj) {
          callback(err, connectionObj);
          return;
        }

        connectionObj.setField("credential", msg.msgData.credential, {
          isShared: false,
        });

        console.log(
          "[" + easyrtcid + "] Credential saved!",
          connectionObj.getFieldValueSync("credential")
        );

        callback(err, connectionObj);
      }
    );
  }
);

// To test, lets print the credential to the console for every room join!
easyrtc.events.on(
  "roomJoin",
  (connectionObj, roomName, roomParameter, callback) => {
    console.log(
      "[" + connectionObj.getEasyrtcid() + "] Credential retrieved!",
      connectionObj.getFieldValueSync("credential")
    );
    easyrtc.events.defaultListeners.roomJoin(
      connectionObj,
      roomName,
      roomParameter,
      callback
    );
  }
);

const rtc = easyrtc.listen(httpApp, socketServer, null, (err, rtcRef) => {
  console.log("Initiated");

  rtcRef.events.on(
    "roomCreate",
    (appObj, creatorConnectionObj, roomName, roomOptions, callback) => {
      console.log("roomCreate fired! Trying to create: " + roomName);

      appObj.events.defaultListeners.roomCreate(
        appObj,
        creatorConnectionObj,
        roomName,
        roomOptions,
        callback
      );
    }
  );
});
httpApp.post("/recordings", (req, res) => {
  if (!req.body.audios) {
    return res.status(400).json({ error: "No req.body.audios" });
  }
  const arrAudios = req.body.audios;
  const audioId = `${arrAudios[0]
    .replace("data:audio/mp3;base64,", "")
    .substr(0, 30)}.mp3`;

  const base64Data = arrAudios[0].replace("data:audio/mp3;base64,", "");

  writeFile(audioFolder + audioId, base64Data, "base64")
    .then(() => {
      res.status(201).json({ audio: "audio saved" });
    })
    .catch((err) => {
      console.log("Error writing audio to file", err);
      res.sendStatus(500);
    });
});
httpApp.get("/recordings", (req, res) => {
  readdir(audioFolder)
    .then((audioFilenames) => {
      res.status(200).json({ audioFilenames });
    })
    .catch((err) => {
      console.log("Error reading audio directory", err);
      res.sendStatus(500);
    });
});

// Listen on port 8443
webServer.listen(8443, "0.0.0.0", () => {
  console.log("listening on http://localhost:8443");
});
