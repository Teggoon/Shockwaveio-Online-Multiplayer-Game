//https://stackoverflow.com/questions/5203407/how-to-detect-if-multiple-keys-are-pressed-at-once-using-javascript

const RESPAWN_TIMER = 40;
const TWO_PI = Math.PI * 2;

var canvasWidth = window.innerWidth;
var canvasHeight = window.innerHeight;
var MAP_SIZE;
var shakeX = 0;
var shakeY = 0;

var keyMap = {};
onkeydown = onkeyup = function(e){
    e = e || event;
    keyMap[e.keyCode] = e.type == 'keydown';
}



var holes = [];
var characterDatas = new Map();
var shockwaves = new Map();
var myID = -1;
var myCharacter;
var mouseX = 0;
var mouseY = 0;
var c = document.getElementById("myCanvas");
c.setAttribute("width", window.innerWidth);
c.setAttribute("height", window.innerHeight);
var playerAlive = true;
var thisWaitTimer = -1;
var waitingForRespawning = false;
var myName = "";
var connectedToServer = false;


const holeImage = document.getElementById("hole_image");
const backgroundImage = document.getElementById("background_image");

//from https://nerdparadise.com/programming/javascriptmouseposition
function updateMouse(mouseEvent) {
  var obj = document.getElementById("myCanvas");

  var obj_left = 0;
  var obj_top = 0;
  var xpos;
  var ypos;
  while (obj.offsetParent)
  {
    obj_left += obj.offsetLeft;
    obj_top += obj.offsetTop;
    obj = obj.offsetParent;
  }
  if (mouseEvent)
  {
    //FireFox
    xpos = mouseEvent.pageX;
    ypos = mouseEvent.pageY;
  }
  else
  {
    //IE
    xpos = window.event.x + document.body.scrollLeft - 2;
    ypos = window.event.y + document.body.scrollTop - 2;
  }
  xpos -= obj_left;
  ypos -= obj_top;
  mouseX = xpos;
  mouseY = ypos;
}

function CharacterData(id, name, x, y, z, r, score, velocity) {
  this.id = id;
  this.x = -1000;
  this.y = y;
  this.z = z;
  this.r = r;
  this.prevR = r;
  this.name = name;
  this.score = score;
  this.vx = 0;
  this.vy = 0;
  this.vz = 0;
  this.velocity = velocity;
  this.onGround = true;
  this.life = 100;
  this.reload = 0;
  this.reloadSpeed = 0.05;
  this.angleWidth = 80;
  this.radius = 30;
}

CharacterData.prototype.display = function(ctx, x, y) {
  var scaleSize = 1 + this.z;
  var shift = 3 + (this.z) * 20;
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.translate(1 + shift, -1- shift);
    ctx.beginPath(); 
  ctx.rotate(this.r);
    ctx.arc(0,0, 15 * scaleSize, 0, TWO_PI);
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.8 - (scaleSize) / 2.5;
    ctx.closePath();
  ctx.fill();
  ctx.restore();


  ctx.save();
  ctx.rotate(this.r);
  ctx.scale(scaleSize / 2, scaleSize / 2);
  ctx.beginPath();
  ctx.arc(0,0, this.radius, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.fillStyle = "#fc9403";
  ctx.fill();
  ctx.closePath();

  ctx.beginPath();
  ctx.rect(5,-8,6,6);
  ctx.rect(5,8,6,6);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.closePath();

  ctx.restore();

  ctx.beginPath();
  ctx.arc(0,0, 12 * scaleSize, -1.35, -0.16);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(166,80,0)";
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.closePath();



  ctx.beginPath();
  ctx.arc(0,0, 12 * scaleSize, 1.8, 3);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255)";
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.closePath();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;





    ctx.beginPath();
    ctx.globalAlpha =  1;
    ctx.font = "20px Arial";
    ctx.rect(-20, -32, 40, 6);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.rect(-20, -32, this.life / 100 * 40, 6);
    ctx.fillStyle = "green";
    ctx.fill();
    ctx.closePath();
  ctx.strokeText(this.name, - 20, - 38);
  ctx.restore();


};

CharacterData.prototype.acceptPositionUpdate = function(x, y, z, r, vel) {
  this.x = x;
  this.y = y;
  this.z = z;
  this.r = r;
  this.velocity = vel;
  this.onGround = (z <= 0);
}

CharacterData.prototype.acceptStatsUpdate = function(score, life) {
  this.score = score;
  this.life = life;
};

CharacterData.prototype.movement = function() {
    this.r = Math.atan2(mouseY - canvasHeight / 2, mouseX - canvasWidth / 2);
    this.reload += this.reloadSpeed;
    this.slowDownVertical();
    this.slowDownHorizontal();
    if (keyMap[87]) {
      this.moveUp();
    }
    if (keyMap[83]) {
      this.moveDown();
    }
    if (keyMap[65]) {
      this.moveLeft();
    }
    if (keyMap[68]) {
      this.moveRight();
    }

    if (keyMap[32] && this.onGround) {
        this.onGround = false;
        this.vz = 0.06;
    }

    if (!this.onGround) {
        this.vz -= 0.003;
        this.z += this.vz;
    }
    if (this.z < 0) {
        this.z = 0;
        this.vz = 0;
        this.onGround = true;
    }


    this.x += this.vx;
    this.y += this.vy;


    if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01 || this.prevR != this.r){
        this.sendPositionToServer();
    }

    if (this.prevR != this.r) {
      this.prevR = this.r;
    }
}

CharacterData.prototype.sendPositionToServer = function  () {
  socket.emit('update position', this.id, this.x, this.y, this.z, this.r);
}

CharacterData.prototype.slowDownHorizontal = function() {
  if (Math.abs(this.vx) > 0.01){
      this.vx *= 0.9;
  } else {
      this.vx = 0;
  }
}

CharacterData.prototype.slowDownVertical = function() {
  if (Math.abs(this.vy) > 0.01){
      this.vy *= 0.9;
  } else {
      this.vy = 0;
  }
}

CharacterData.prototype.moveUp = function() {
  this.vy += (-this.velocity - this.vy) / 10;

}

CharacterData.prototype.moveDown = function() {
  this.vy += (this.velocity - this.vy) / 10;
}

CharacterData.prototype.moveLeft = function() {
  this.vx += (-this.velocity - this.vx) / 10;
}

CharacterData.prototype.moveRight = function() {
  this.vx += (this.velocity - this.vx) / 10;
}


//JELAN
//id, shockwaveID, x, y, angle, angleWidth, velocity, transparency, tV
function Shockwave (id, shockwaveID, x, y, angle, angleWidth, velocity, transparency, tV) {
    this.angle = angle;
    //this.width = 0;
    this.angleWidth = 30;
    this.x=x;
    this.y=y;
    this.velocity = velocity;
    this.transparency = transparency;
    this.transparencyV = tV;
    this.radius = 0;
    this.id = id;
    this.shockwaveID = shockwaveID;
}
Shockwave.prototype.display = function(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.translate(this.x, this.y);
  ctx.rotate(this.angle);
  ctx.shadowBlur = 20;
  ctx.shadowColor = "black";
  ctx.strokeStyle = "101010";
  ctx.arc(0,0, this.radius, -this.angleWidth/2, this.angleWidth/2);
  ctx.stroke();

  ctx.closePath();
  ctx.beginPath();

  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "101010";
  ctx.arc(0,0, this.radius * 0.9, -this.angleWidth/2, this.angleWidth/2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.closePath();

  ctx.restore();
}
Shockwave.prototype.acceptPositionUpdate = function(angle, angleWidth, radius, transparency){
  this.radius = radius;
  this.angle = angle;
  this.angleWidth = angleWidth;
  this.transparency = transparency;
}

//JELAN
var Hole = function (x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
};
Hole.prototype.display = function(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.drawImage(holeImage, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
  ctx.restore();
};



/**
* Socket.io connection handler portion BEGINS
*/

var updated = false;
var numOfMessages = 0;


// var socket = io.connect('shockwave-io.com:40000');
var socket = io.connect('localhost:5000');
socket.on('message', function(message) {
  var messagesElem = document.getElementById("messages");
    messagesElem.innerHTML += message +"<br/>";
    numOfMessages++;
    messagesElem.scrollTop = messagesElem.scrollHeight;
});


socket.on('init synchronization',function(id, map_size) {
  myID = id;
  MAP_SIZE = map_size;
});

socket.on('set user myCharacter', function(bool) {
    myCharacter = characterDatas.get(myID);
});

//for updating a character on the client side when the character may
//not have been constructed yet
socket.on('update new character', function(id, name, x, y, z, r, vel, score) {

  //try to get the character in the map with this id
  var currentCharacter = characterDatas.get(id);

  //if there is no such character, make new
  if (currentCharacter == null)
  {
      characterDatas.set(id, new CharacterData(id, name, x, y, z, r, vel, score));
  } else {

      currentCharacter.score = score;
      currentCharacter.acceptPositionUpdate(x, y, z, r, vel);
  }
});

//for updating a character stats on the client side when it's already initialized
//stats: weapon stats, score,
socket.on('update stats', function(id, score, life) {

  var currentCharacter = characterDatas.get(id);
  if (currentCharacter != null)
  {
    currentCharacter.acceptStatsUpdate(score, life);
  }
});
//for updating a character stats on the client side when it's already initialized
//stats: weapon stats, score,
socket.on('update position', function(id, x, y, z, r, vel) {

  if (id == myID && this.x != -1000) {
    return;
  }
  var currentCharacter = characterDatas.get(id);
  if (currentCharacter != null)
  {
    currentCharacter.acceptPositionUpdate(x, y, z, r, vel);
  }
});

socket.on('OVERRIDE position', function(id, x, y, z, r, vel) {

  var currentCharacter = characterDatas.get(id);
  if (currentCharacter != null)
  {
    currentCharacter.acceptPositionUpdate(x, y, z, r, vel);
  }
});

socket.on("confirm updated", function(str) {
  updated = true;
});



socket.on("delete user", function(id) {
  characterDatas.delete(id);
});

socket.on("your death", function(str) {
  playerAlive = false;
});

socket.on("add hole", function(x,y,size) {
  holes.push(new Hole(x, y, size));
});

//s.id, s.x, s.y, s.angle, s.width, s.velocity, s.transparencyV
socket.on("update shockwave", function(id, shockwaveID, x, y, angle, angleWidth, radius, velocity, transparency, tV){
  var s = shockwaves.get(id);
  if (s == null) {
    //function Shockwave (id, x, y, angle, radius, velocity, tV) {
    shockwaves.set(id, new Map());
  }
  s = shockwaves.get(id);
  if (s.get(shockwaveID) == null){
    s.set(shockwaveID, new Shockwave(id, shockwaveID, x, y, angle, angleWidth, velocity, transparency, tV));
  }

  var currentShockwave = s.get(shockwaveID);
  currentShockwave.acceptPositionUpdate(angle, angleWidth, radius, transparency);

});

socket.on("kill shockwave", function(id, shockwaveID) {
    shockwaves.get(id).delete(shockwaveID);
});



var givenName = false;
function sendStuff() {

    var x = document.getElementById("inputbox").value;
    if (x == "") {
      return;
    }
    myName = x;
    if (givenName) {
        socket.emit("message", x);
    } else {
        socket.emit("name", x);
        //document.getElementById("button").innerHTML = "Enter Message";
        givenName = true;
        var hideObjects = document.getElementsByClassName ("toHide");
        for (var i = 0; i < hideObjects.length; i++){
          hideObjects[i].style.visibility = "hidden";
        }
        document.getElementById("textBlock").style.left = "74px";
        document.getElementById("textBlock").style.top = "70%";
    }
    document.getElementById("inputbox").value = "";


}


/**Socket.io connection handler portion ENDS*/


//should be updated == TRUE, temporarily this
function drawCanvas () {
      var ctx = c.getContext("2d");

      ctx.beginPath();
      ctx.rect(-10, -10, canvasWidth + 20, canvasHeight + 20);
      ctx.fillStyle = "rgb(252, 209, 79)"

      ctx.fill();
  


      ctx.font = "30px Arial";

      if (playerAlive && myCharacter != null) {
        ctx.save();
        ctx.translate(canvasWidth/2 - myCharacter.x, canvasHeight/2 - myCharacter.y);
        ctx.translate(shakeX, shakeY);

        ctx.drawImage(backgroundImage, -MAP_SIZE / 2, -MAP_SIZE / 2);

        ctx.beginPath();
        ctx.rect(-MAP_SIZE / 2, -MAP_SIZE / 2, MAP_SIZE, MAP_SIZE);
        ctx.strokeStyle = "black";
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 20;
        ctx.stroke();
        ctx.closePath();

        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;


        for (var i = 0; i < holes.length; i++) {
          holes[i].display(ctx);
        }


        //ctx.fillText("Hello I'm a test canvas", 10, 50);
        for (let [k, c] of characterDatas) {
          if (k != myID) {
            c.display(ctx, c.x, c.y);
          }
        }
        ctx.restore();

          ctx.save();
          myCharacter.display(ctx, canvasWidth / 2, canvasHeight / 2);
          ctx.restore();


        ctx.save();
        ctx.translate(canvasWidth/2 - myCharacter.x, canvasHeight/2 - myCharacter.y);
        //display all shockwaves
        for (let [k, v] of shockwaves){
            ctx.save();
            for (let [ks, s] of v){
              s.display(ctx);
            }
            ctx.restore();
        }
        ctx.restore();
      } else {
          
      }



      ctx.font = "20px Arial";

      if (!playerAlive && !waitingForRespawning){
        ctx.textAlign = "center";
        ctx.strokeText("You're dead! Click to respawn", canvasWidth / 2, canvasHeight / 2);
        ctx.textAlign = "left";
      } else if (waitingForRespawning){
        ctx.textAlign = "center";
        ctx.strokeText("Respawning...", canvasWidth / 2, canvasHeight / 2);
        ctx.textAlign = "left";
      }

      if (myID != -1 && characterDatas.size == 1){
        ctx.textAlign = "center";
        ctx.strokeText("Waiting for players...", canvasWidth / 2, canvasHeight / 3);
        ctx.textAlign = "left";
      }

      if (shockwaves.get(myID) != null) {
        var ssizes =  shockwaves.get(myID).size;
        if (ssizes > 0) {
          shakeX = -5 + Math.random() * 10;
          shakeY = -5 + Math.random() * 10;
        } else {
          shakeX = 0;
          shakeY = 0;
        }
      } 
      
      ctx.beginPath();
      ctx.rect(canvasWidth / 32 - 12, canvasHeight / 8 - 29, 260, 90);
      ctx.fillStyle = 'rgb(140,140,140)';

      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = 'rgb(245,245,245)';
      ctx.font = "21px arial";
      ctx.fillText("WASD to move", canvasWidth / 32, canvasHeight / 8);
      ctx.fillText("Mouse to aim and shoot", canvasWidth / 32, canvasHeight / 8 + 22);
      ctx.fillText("Space to jump", canvasWidth / 32, canvasHeight / 8 + 44);
      ctx.textAlign = "left";
      ctx.closePath();
}

function incrementScore(){
    characterDatas.get(myID).score += 3;
    socket.emit("update stats", myID, myCharacter.score, myCharacter.life);
}


function requestShockwave() {
    if (myCharacter.reload > 1 && myCharacter.onGround){
      myCharacter.reload = 0;
      //id, x, y, angle, angleWidth, velocity, tV
      socket.emit("add shockwave", myID, myCharacter.x, myCharacter.y, myCharacter.r, myCharacter.angleWidth, 10, 5);

      //shockwaves.set(myID, new Shockwave());
    }

}

function deathHandler () {
  this.thisWaitTimer = RESPAWN_TIMER;
  waitingForRespawning = true;
  characterDatas.clear();
  shockwaves.clear();
  holes.length = 0;
}

function clickHandler () {
  if (playerAlive){
    requestShockwave();
  } else {
    deathHandler();
  }
}

document.getElementById("myCanvas").addEventListener("click", clickHandler, false);



document.addEventListener('keydown', function(event) {
});

function gameSingleFrame() {
    
    connectedToServer = socket.connected;
    if (connectedToServer) {
        document.getElementById("connStatus").innerHTML = "Connection Status: Connected";
        document.getElementById("connStatus").setAttribute("connected", "true");
    } else {
        document.getElementById("connStatus").innerHTML = "Connection Status: Disconnected";
        document.getElementById("connStatus").setAttribute("connected", "false");
    }
    
    drawCanvas();
    if (playerAlive && characterDatas.get(myID) != null) {
      characterDatas.get(myID).movement();
    }

    if (waitingForRespawning) {
      thisWaitTimer--;
    }

    if (thisWaitTimer <= 0 && waitingForRespawning) {
    waitingForRespawning = false;
    playerAlive = true;
    thisWaitTimer = -1;
      socket.emit("name", myName);
    }


}

setInterval(gameSingleFrame, 24);


function getStats() {
  alert("Character data length: " + characterDatas.size + "\n");
  for (let [k, v] of characterDatas){
    alert("character with id" + k + ": "+ v.x + ", " + v.y + "," + v.score);
  }
}

document.getElementById("myCanvas").onmousemove = updateMouse;