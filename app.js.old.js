var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
var fs = require('fs');
 
var text_to_speech = new TextToSpeechV1({
  username: '7b01295c-6d61-476c-b539-4a9be9290ab9',
  password: 'GQevRJ7ZpywG'
});
 

 

var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
var fs = require('fs');
 
var visual_recognition = new VisualRecognitionV3({
  api_key: '1fc85814f67575a15cb58f045e138d23d0bc165b',
  version_date: '2016-05-19'
});
 
var params = {
  images_file: fs.createReadStream('./image.png')
};
 
visual_recognition.classify(params, function(err, res) {

  var sentence = "Hmm, it looks like something went wrong.";

  if (err) {
    console.log(err);
  } else {
    console.log(JSON.stringify(res, null, 2));

    var classes = res.images[0].classifiers[0].classes;
    var highScoreClass = null;
    var highScore      = -1;
    for (var i = 0; i < classes.length; i++) {

      console.log ("Class name:  " + classes[i].class);
      console.log ("Score:       " + classes[i].score);
      
      if (highScore === -1 || highScore < classes[i].score) {

        highScoreClass = classes[i];
        highScore      = classes[i].score;
      }
    }

    console.log ("High score class:  " + highScoreClass.class);
    console.log ("High score:        " + highScore);

    sentence = "It looks like you're looking at something that could be described by " + highScoreClass.class;
  }

  var params = {
    text: sentence,
    voice: 'en-US_AllisonVoice', // Optional voice 
    accept: 'audio/wav'
  };
    
  // Pipe the synthesized text to a file 
  text_to_speech.synthesize(params).pipe(fs.createWriteStream('output.wav'));
  const spawn = require ('child_process').spawn;
  setTimeout (function () {
    const vlc   = spawn ("/Applications/VLC.app/Contents/MacOS/VLC", ["/Users/fwhipple/Box Sync/Interconnect CAM Demo/Watson Speech Test/output.wav"]);
  //child_process.execSync ("/Applications/VLC.app/Contents/MacOS/VLC", "/Users/fwhipple/Box Sync/Interconnect CAM Demo/Watson Speech Test/output.wav");
  }, 2000);

});