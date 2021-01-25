const http = require("http");
const fs = require("fs");
const express = require("express");
const serveStatic = require("serve-static");
const socketIo = require("socket.io");
const { promisify } = require("util");
const bodyParser = require("body-parser");

const easyrtc = require("./lib/easyrtc_server");
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const messageFolder = "./public/recordings/";
if (!fs.existsSync(messageFolder)) {
  fs.mkdirSync(messageFolder);
}

const app = express();
app.use(
  bodyParser.urlencoded({
    limit: "5mb",
    parameterLimit: 100000,
    extended: false,
  })
);

app.use(
  bodyParser.json({
    limit: "5mb",
  })
);
app.use(bodyParser.json());
app.use(serveStatic("static", { index: ["index.html"] }));

const webServer = http.createServer(app);

// Start Socket.io so it attaches itself to Express server
const socketServer = socketIo.listen(webServer, { "log level": 1 });

easyrtc.setOption("logLevel"); //can use debug easyrtc.setOption("logLevel", "debug");

// Overriding the default easyrtcAuth listener, only so we can directly access its callback
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

// Start EasyRTC server
const rtc = easyrtc.listen(app, socketServer, null, (err, rtcRef) => {
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
app.post("/recordings", (req, res) => {
  if (!req.body.message) {
    return res.status(400).json({ error: "No req.body.message" });
  }
  const messageId = `${req.body.message
    .replace("data:audio/mp3;base64,", "")
    .substr(0, 30)}.mp3`;

  const base64Data = req.body.message.replace("data:audio/mp3;base64,", "");
  writeFile(messageFolder + messageId, base64Data, "base64")
    .then(() => {
      res.status(201).json({ message: req.body.message });
    })
    .catch((err) => {
      console.log("Error writing message to file", err);
      res.sendStatus(500);
    });
});
app.get("/recordings", (req, res) => {
  readdir(messageFolder)
    .then((messageFilenames) => {
      res.status(200).json({ messageFilenames });
    })
    .catch((err) => {
      console.log("Error reading message directory", err);
      res.sendStatus(500);
    });
});
// Listen on port 1233
webServer.listen(1233, "0.0.0.0", () => {
  console.log("listening on http://localhost:1233");
});
