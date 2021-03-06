
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

if (typeof (process.env.AEM_PATH) !== 'undefined' && process.env.AEM_PATH !== "" && process.env.AEM_PATH !== null) {
  require (process.env.AEM_PATH + 'knj_index');
  require (process.env.AEM_PATH + 'knj_deepdive.js');
  require (process.env.AEM_PATH + 'knj_methodtrace.js');
}



const audioDir = '/tmp';

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

  var sentence = "Sorry, it looks like something went wrong.";

  // Navigate through the response to the actual classes
  var classes        = classJson.images[0].classifiers[0].classes;

  // Bubble Sort!  Do not try this at home.
  let sorted = false;
  while (! sorted) {

    sorted = true;
    for (let i = 1; i < classes.length; i++) {

      if (classes[i].score > classes[i-1].score) {

        let temp = classes[i-1];
        classes[i-1] = classes[i];
        classes[i] = temp;
        sorted = false;
      }
    }
  }

  // Parse out the top 3 descriptive words, and the colour
  let descWords = [];
  let colourWords = "";
  for (let i = 0; i < classes.length; i++) {

    if (classes[i].class.indexOf ('color') === -1) {

      if (descWords.length < 3) {

        descWords.push (classes[i].class);
      }
    } else {

      if (colourWords === "") colourWords = classes[i].class;
    }
  }

  // Build an intelligent sentence
  if (descWords.length === 1 && colourWords === "") {
    sentence = "This photo can be described as " + descWords[0] + ".";
  } else if (descWords.length === 1 && colourWords !== "") {
    sentence = "This photo can be described as " + descWords[0] + " and is a " + colourWords + ".";
  } else if (descWords.length === 2 && colourWords === "") {
    sentence = "This photo can be described as " + descWords[0] + " and " + descWords[1] + ".";
  } else if (descWords.length === 2 && colourWords !== "") {
    sentence = "This photo can be described as " + descWords[0] + " and " + descWords[1] + ", and is a " + colourWords + ".";
  } else if (descWords.length === 3 && colourWords === "") {
    sentence = "This photo can be described as " + descWords[0] + ", " + descWords[1] + ", and " + descWords[2] + ".";
  } else if (descWords.length === 3 && colourWords !== "") {
    sentence = "This photo can be described as " + descWords[0] + ", " + descWords[1] + ", and " + descWords[2] + ", and is a " + colourWords + ".";
  }

  console.log ("TTS sentence is:  " + sentence);

  return sentence;
}

function getAudioByteArray (description, callback) {

  var ttsParams = {
    text: description,
    voice: 'en-US_AllisonVoice', // Optional voice 
    accept: 'audio/ogg;codecs=opus'
  };

  var byteArrays = [];  
  var ttsStream = tts.synthesize (ttsParams);

  ttsStream.on ('data', function (chunk) {

    byteArrays.push (chunk);

  });

  ttsStream.on ('end', function () {

    var mybuff = Buffer.concat (byteArrays);

    var fileid = Math.floor (Math.random () * 10000);
    var filePath = audioDir + '/audiofile' + fileid + '.ogg';
    var outputPath = audioDir + '/audiofile' + fileid + '.mp4';

    fs.writeFile (filePath, mybuff, function (error) {

      if (error) {

        console.log ("Error:  Received error while writing file:  " + filePath);
        callback (new Buffer (''));

      } else {

        const spawn = require('child_process').spawn;
        const ffmpeg = spawn ('ffmpeg', ['-i', filePath, '-strict', '-2', outputPath]);
        var stderr;

        ffmpeg.on ('error', function (error) {

          console.log ("Error:  Received an error while running ffmpeg:  " + error);
          callback (new Buffer (''));
        });

//        ffmpeg.stderr.on ('data', function (data) {
//
//          console.log ("Error:  Received output on stderr from ffmpeg:  " + data);
//          ffmpeg.kill ();
//          callback (new Buffer (''));
//        });

        ffmpeg.stderr.on ('data', function (data) {

          stderr += data;
        });

        ffmpeg.on ('close', function (exitCode) {

//          if (exitCode !== 0) {
//
//            console.log ("Error:  Received non-zero exit code from ffmpeg:  " + exitCode);
//            callback (new Buffer (''));
//
//          } else {

//            console.log ("Output from ffmpeg:  \n" + stderr);
            fs.readFile (outputPath, function (error, data) {

              if (error) {

                console.log ("Received error while reading ffmpeg output file:  " + error);
                callback (new Buffer (''));

              } else {

                callback (data);
                setTimeout (function (oggFile, mp4File) {

                  console.log ("Deleting file:  " + oggFile);
                  fs.unlink (oggFile, function (error) {

                    console.log ("Error:  Unable to delete file:  " + oggFile);
                  });

                  console.log ("Deleting file:  " + mp4File);
                  fs.unlink (mp4File, function (error) {

                    console.log ("Error:  Unable to delete file:  " + mp4File);
                  });

                }, 3600000, filePath, outputPath);
              }
            });
//          }
        });
      }
    })
  });
}
