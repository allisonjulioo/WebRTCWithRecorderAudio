// Load required modules
const https = require("https");
const fs = require("fs");
const express = require("express");
const io = require("socket.io");
const bodyParser = require("body-parser");
const axios = require("axios");

const easyrtc = require("./lib/easyrtc_server");

// Setup and configure Express http server. Expect a subfolder called "static" to be the web root.
const httpApp = express();

httpApp.use(
  bodyParser.json({
    limit: "50mb",
  })
);
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
httpApp.post("/recordings", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "No req.body.message" });
  }
  const { authorization } = req.headers;
  console.log("Authorazrtiuosjjado~íb", authorization);
  const { office_id, transaction_id, self, caller } = req.body;
  let params;
  if (transaction_id) {
    params = `?office_id=${office_id}&transaction_id=${transaction_id}`;
  } else {
    params = `?office_id=${office_id}`;
  }

  axios
    .post(
      `http://127.0.0.1:3333/api/office/post-office-recordings/`,
      JSON.stringify({
        office_id,
        transaction_id,
        self,
        caller,
      }),
      {
        params: {
          transaction_id,
          office_id,
        },
        headers: {
          Authorization: authorization,
        },
      }
    )
    .then((response) => {
      console.log(response.status);
      res.status(200).json({ message: "Deu certo caraiu", data: response });
    })
    .catch((err) =>
      res.status(500).json({ message: "Deu errado caraiu", data: err })
    );
});

// Listen on port 8443
webServer.listen(8443, "0.0.0.0", () => {
  console.log("listening on http://localhost:8443");
});
