
/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Native imports
var fs        = require ('fs');
var http      = require ('http');

// Custom imports
var WatsonTextToSpeechV1 = require ('watson-developer-cloud/text-to-speech/v1');
var VisualRecognitionV3  = require ('watson-developer-cloud/visual-recognition/v3');
var base64               = require ('base64-js');

// Initialize Watson services
var tts = new WatsonTextToSpeechV1 ({
  username: process.env.TTS_USERNAME,
  password: process.env.TTS_PWD
});

var vr = new VisualRecognitionV3 ({
  api_key: process.env.VR_API_KEY,
  version_date: '2016-05-19'
});

// Initialize the HTTP server
const httpServer = http.createServer (function (httpRequest, httpResponse) {

  console.log (httpRequest.connection.remoteAddress + '|' + httpRequest.method | httpRequest.url);

  var output = {};

  if (httpRequest.method === 'POST' && httpRequest.url === '/vrdemo') {

    var imageDataBase64 = "";
    httpRequest.on ('data', function (data) {
      imageDataBase64 += data;
    });

    httpRequest.on ('end', function () {
      const imageBuffer = imageBase64ToBuffer (imageDataBase64);
      performRecognition (imageBuffer, function (classJson) {

        console.log ("Received classification information from Watson API");
        var description = "Hmm, something went wrong here.";
        output.classes = {};

        if (typeof (classJson.images[0].classifiers[0].classes) !== 'undefined') {

          console.log ("Classification data looks valid");
          output.classes = classJson;
          description = generateDescription (classJson);

          getAudioByteArray (description, function (audioByteArray) {
          
            console.log ("Received Text-to-Speech information from Watson API");
            const audio64 = audioByteArray.toString ('base64');
            output.audioBase64 = audio64;

            httpResponse.end (JSON.stringify (output));;
          })
        }
      });
    });

  } else {

    httpResponse.writeHead (404);
    httpResponse.end ("Invalid URL\n");  
  }

});
httpServer.listen (8000);
 

function imageBase64ToBuffer (imageDataBase64) {

  if (imageDataBase64.indexOf (',') !== -1) {
    imageDataBase64 = imageDataBase64.substring (imageDataBase64.indexOf (',') + 1);
  }

  imageDataBase64 = base64.toByteArray (imageDataBase64);

  var buff = new Buffer (imageDataBase64.length);
  for (var i = 0; i < imageDataBase64.length; i++) {

    buff[i] = imageDataBase64[i];
  }

  return buff;
}

function performRecognition (imageBuffer, callback) {

  vr.classify ({images_file: imageBuffer}, function (error, response) {

    if (error) {

        console.log ("An error was received while classifying:  " + error);
        callback ({});

    } else {

      console.log ("Response:  " + response);
      callback (response);
    }
  });
}

function generateDescription (classJson) {

  var sentence = "Hmm, it looks like something went wrong.";

  // Navigate through the response to the actual classes
  var classes        = classJson.images[0].classifiers[0].classes;
  var highScoreClass = null;
  var highScore      = -1;
  var colour         = "";

  // For each class, search for the highest score and keep a pointer to the class name
  for (var i = 0; i < classes.length; i++) {

    if ((highScore === -1 || highScore < classes[i].score) && classes[i].class.indexOf ('color') === -1) {

      highScoreClass = classes[i];
      highScore      = classes[i].score;

    } else if (classes[i].class.indexOf ('color') !== -1) {

      colour = classes[i].class;
    }
  }

  sentence = "It looks like you're looking at something that could be described by " + highScoreClass.class;

  if (colour !== "") sentence += " and is a " + colour;
  sentence += ".";

  return sentence;
}

function getAudioByteArray (description, callback) {

  var ttsParams = {
    text: description,
    voice: 'en-US_AllisonVoice', // Optional voice 
    accept: 'audio/wav'
  };

  var byteArrays = [];  
  var ttsStream = tts.synthesize (ttsParams);

  ttsStream.on ('data', function (chunk) {

    byteArrays.push (chunk);

  });

  ttsStream.on ('end', function () {

    var mybuff = Buffer.concat (byteArrays);
    callback (mybuff);

  });
}

