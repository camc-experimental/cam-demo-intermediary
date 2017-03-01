
// Native imports
var fs        = require ('fs');
var http      = require ('http');
var spawnSync = require ('child_process').spawnSync;

// Custom imports
var WatsonTextToSpeechV1 = require ('watson-developer-cloud/text-to-speech/v1');
var VisualRecognitionV3  = require ('watson-developer-cloud/visual-recognition/v3');
var base64               = require ('base64-js');
var toArray              = require ('stream-to-array');

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

  console.log ('Received request from IP:  ' + httpRequest.connection.remoteAddress);
  console.log ('Method:  ' + httpRequest.method)

  if (httpRequest.method === 'POST' && httpRequest.url === '/vrdemo') {

    console.log ('Correct URL found:  ' + httpRequest.url);

    var imageData = "";
    httpRequest.on ('data', function (data) {

      console.log ('Received some data');
      imageData += data;
    });
    httpRequest.on ('end', function () {

      console.log ('Received end-of-data');

      fs.writeFileSync ("./imagetest.png", imageData);

      const imageBuffer = imageBase64ToBuffer (imageData);
      performRecognition (imageBuffer, function (classJson) {
        
        const description = generateDescription (classJson);
        console.log ("Description:  " + description);

        getAudioByteArray (description, function (audioByteArray) {
        
          const audio64 = audioByteArray.toString ('base64');
          httpResponse.end (audio64);
        })
      });
    });

  } else {

    httpResponse.writeHead (404);
    httpResponse.end ("Invalid URL\n");  
  }

});
httpServer.listen (8000);
 









function imageBase64ToBuffer (imageData) {

  if (imageData.indexOf (',') !== -1) {
    console.log ("I found a comma.");
    imageData = imageData.substring (imageData.indexOf (',') + 1);
  }

  // Convert Base64 image text data to an array of bytes
//  console.log ("Converting original image data:  " + imageData);
  imageData = base64.toByteArray (imageData);

  // Copy each byte in the array into the buffer
  var buff = new Buffer (imageData.length);
  for (var i = 0; i < imageData.length; i++) {

    buff[i] = imageData[i];
  }

  return buff;
}

function performRecognition (imageBuffer, callback) {

  console.log (imageBuffer);

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

  // For each class, search for the highest score and keep a pointer to the class name
  for (var i = 0; i < classes.length; i++) {

    // console.log ("Class name:  " + classes[i].class);
    // console.log ("Score:       " + classes[i].score);
    
    if (highScore === -1 || highScore < classes[i].score) {

      highScoreClass = classes[i];
      highScore      = classes[i].score;
    }
  }

  console.log ("High score class:  " + highScoreClass.class);
  console.log ("High score:        " + highScore);

  sentence = "It looks like you're looking at something that could be described by " + highScoreClass.class;

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

