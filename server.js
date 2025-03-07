// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { config } = require('dotenv');
const connectDb = require('./db/connectDB');
const scheduleSchems = require('./models/schedule');
// const {setJobs} = require('./utils/cron-job');
const downloadAndMergeSongs = require('./utils/merge-file')
const fs = require('fs');
const cors = require('cors');
const subtractOneMinute = require('./utils/subtractOneMinutes');
const userModel = require('./models/user')
const songModel = require('./models/song')
const historyModel = require('./models/history')
const playlistModel = require('./models/playlisyt')
const autoDJListModel = require('./models/autoDJList')
const mongoose = require('mongoose');
const { spawn } = require('child_process');
// const uploadRouter = require('./upload');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const schedule = require('node-schedule');
const { mergeSongs, areArraysEqual, getSongDuration } = require('./utils/merge-song');
const { changeAllSongsTags, createplaylist } = require('./utils/changeTagChange');
const { checkIsStreamingDay, checkInTimeRange } = require('./utils/djFunction');


config({ path: path.join(__dirname, './config/.env') });
connectDb();
const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb' }));
app.use(cors());
app.use('', express.static(path.join(__dirname, './public')));
// app.use('',uploadRouter);



const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*'
  }
});

const roomsowners = {};
const ownersSocketId = {};
const scheduleActive = {};
const roomCurrentSongPlay = {};

let cronJobRefs = {}
const songsStartTime = {}
const songsStartTimeByUser = {}
const listeners = {};
let prevPlaylist = [];
let prevSongs = [];
let timerRef = null;
let currentIndex = 0;
let songsDurations = {};
let preparing = false;
const sleep = (ms) => new Promise((res, rej) => setTimeout(() => res(), ms))
let startFirstTime
let currentSong = {}
let processLiq = null;
const djPanelId = "655347b59c00a7409d9181c3"


const processAudio = (inputFile, outputFile) => {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', inputFile,
      '-b:a', '192k',
      '-ar', '44100',
      outputFile
    ]);

    // Capture and log standard output
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    // Capture and log standard error
    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    // Capture exit event and log the exit code
    ffmpegProcess.on('close', (code) => {
      console.log(`Liquidsoap process exited with code ${code}`);
      resolve(true);
    });
  })
}

function runLiquidsoap() {
  processLiq = spawn('/root/.opam/default/bin/liquidsoap', ['rr.liq']);

  // Capture and log standard output
  processLiq.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  // Capture and log standard error
  processLiq.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  // Capture exit event and log the exit code
  processLiq.on('close', (code) => {
    console.log(`Liquidsoap process exited with code ${code}`);
  });
}


async function playAutoDjSong(song, nextSong, _id) {
  if (!song?.audio) return;

  currentSong[_id] = { url: `${process.env.SOCKET_URL}${song.audio}`, currentTime: Date.now(), nextSong, currentSong: song }
  io.to(_id.toString()).emit('song-change', { currentSong: currentSong[_id] });
  try {
    const owner = roomsowners[_id.toString()]
    if (!owner) {
      const { title, cover, audio, album, artist } = song;
      await historyModel.create({ title, cover, album: album || 'unknown', audio, artist: artist || 'unknown', owner: _id.toString() })
    }

  } catch (error) {
    console.log(error.message)
  }

  return true;
}





async function channelAutoDj(_id) {
  if ('65bcba4b6181d5d912ac53d7' == _id) return;



  await changeAllSongsTags(_id);
  await createplaylist(_id);
  if (!processLiq) {
    runLiquidsoap();
  }
}

//auto dj start
async function autoDj() {
  let users = await userModel.find();
  users = users.filter((data) => {
    return !data.isDJ
  })



  const autoDjPromises = users.map(async ({ _id }) => {
    try {

      await channelAutoDj(_id);
    } catch (error) {
      console.error(`Error in autoDj for user ${_id}:`, error);
    }
  });

  try {
    await Promise.all(autoDjPromises);
    console.log('All autoDj processes completed successfully');
  } catch (error) {
    console.error('Error in autoDj:', error);
  }
}


// autoDj();






const welcomeTonesPlayed = { "655347b59c00a7409d9181c3": false };



//auto played welcometone
let djUsers = null;
setInterval(() => djUsers = null, 60000);
async function autoPlayWelcomeTone() {

  if (!djUsers) {
    djUsers = await userModel.find({ isDJ: true, djOwner: djPanelId });
  }

  const users = djUsers;
  users.forEach((user) => {
    const copyUser = JSON.parse(JSON.stringify(user));

    const isStreamDay = checkIsStreamingDay(copyUser);
    if (isStreamDay) {
      const { inRange, secondsToStart } = checkInTimeRange(user.djStartTime, user.djEndTime, copyUser);

      const user_id = copyUser._id.toString();
      if (inRange && !welcomeTonesPlayed[user_id]) {
        setTimeout(() => {
          if (!welcomeTonesPlayed[user_id] && copyUser.welcomeTone) {
            welcomeTonesPlayed[user_id] = true;
            console.log(welcomeTonesPlayed[user_id], user_id)
            let welcomeTone = copyUser.welcomeTone;
            console.log('welcome tone started')
            io.to(djPanelId.toString()).emit('play-welcome-tone', { welcomeTone });
          }
        }, 10);

      } else {
        if (welcomeTonesPlayed[user_id] && !inRange) {
          welcomeTonesPlayed[user_id] = false;
        }
      }
    } else {
      if (welcomeTonesPlayed[user_id] && !isStreamDay) {
        welcomeTonesPlayed[user_id] = false;
      }
    }

  })


}

autoPlayWelcomeTone();
setInterval(() => {
  autoPlayWelcomeTone();
}, 1000);











// app.post('/upload',async (req,res) => {
//   try{
//     const {filename,base64} = req.body;
//     const filterData = base64.substr(base64.indexOf(',')+1);
//     console.log('uploading...')
//     const buffer = new Buffer(filterData,'base64');
//     const tempPath = path.join(__dirname,`./public/temp/${Date.now()}.mp3`);
//     fs.writeFileSync(tempPath,buffer,'binary');
//     res.status(201).json({success: true});
//     console.log('uploading end...')
//     await processAudio(tempPath,path.join(__dirname,`./public/${filename}`));
//     if(fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
//     console.log('upload success')
//   }catch(err){
//     console.log('err')
//     res.status(501).json({success: false,message: err.message});
//   }
// });

app.post('/upload', async (req, res) => {
  try {
    const { filename, base64 } = req.body;
    const filterData = base64.substr(base64.indexOf(',') + 1);
    console.log('Uploading...');

    const buffer = Buffer.from(filterData, 'base64');
    const tempDir = path.join(__dirname, './public/temp');

    // Ensure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${Date.now()}.mp3`);
    fs.writeFileSync(tempPath, buffer, 'binary');
    res.status(201).json({ success: true });
    console.log('Uploading end...');

    await processAudio(tempPath, path.join(__dirname, `./public/${filename}`));

    // Remove temp file after processing
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.log('Upload success');
  } catch (err) {
    console.error('Error:', err);
    res.status(501).json({ success: false, message: err.message });
  }
});


app.get('/api/v1/channel-detail/:id', async (req, res) => {
  const id = req.params.id;
  const result = await fetch("https://hgdjlive.com/api/v1/channel-detail/" + id);
  const data = await result.json();
  res.status(200).json({
    ...data
  })
})


app.get('/api/v1/all-djs', async (req, res) => {
  const id = req.params.id;
  const result = await fetch("https://hgdjlive.com/api/v1/dj", {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-US,en;q=0.9,hi;q=0.8",
      "sec-ch-ua": "\"Not)A;Brand\";v=\"99\", \"Google Chrome\";v=\"127\", \"Chromium\";v=\"127\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "cookie": "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NTUzNDdiNTljMDBhNzQwOWQ5MTgxYzMiLCJpYXQiOjE3MjQzNTU1MTIsImV4cCI6MTcyNTY1MTUxMn0.KSHTxOBb4U5iE34Gl_Z69c1EPnkWhQ7-KY50ZVhbrGs"
    },
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET"
  });
  const data = await result.json();
  res.status(200).json({
    ...data
  })
})


app.get('/api/v1/song-history/:id', async (req, res) => {
  const id = req.params.id;
  const data = await historyModel.find({ owner: id }).sort({ createdAt: -1 }).limit(100);
  console.log(data);
  res.status(200).json(data)
})


app.post('/api/v1/change-metadata', async (req, res) => {
  const { songId } = req.body;
  const autoDJList = await autoDJListModel.findOne({ owner: djPanelId }).populate('songs.data').sort({ 'songs.index': -1 });
  const copy = JSON.parse(JSON.stringify(autoDJList?.songs || []));
  let songs = copy.map((song) => {
    data = song.data,
      data.cover = song.cover;
    data.album = song.album;
    data.artist = song.artist;
    return data;
  });
  const index = songs.findIndex(s => s._id.toString() == songId);

  const currentSong = songs[index];
  const nextSong = songs[index + 1];

  playAutoDjSong(currentSong, nextSong, djPanelId);

  console.log('song change : ', currentSong?.title, nextSong?.title);

  res.send(songId);
})

app.get('/api/v1/list-change', async (req, res) => {
  channelAutoDj(djPanelId);
  res.send("restarting server...");
})

app.delete('/delete', async (req, res) => {
  try {
    const { id: filename } = req.query;
    console.log(filename)
    fs.unlink(path.join(__dirname, `./public${filename}`), (err) => {
      if (err) {
        console.log(err)
      }
      console.log(`delete file: ${filename}`)
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(501).json({ success: false, message: err.message });
  }
});

//auto dj end


// add cron jobs
async function addCrobJobs() {
  const scheduleItems = await scheduleSchems.find().populate('songs');
  // console.log(JSON.stringify(scheduleItems[0]))
  scheduleItems.forEach(({ date, time, songs, owner, _id, status }) => {

    // songs = songs.map(data => `${process.env.FRONTEND_URL}${data.audio}`);
    songs = songs.map(data => `${data.audio}`);
    // console.log(songs)
    // console.log(time);
    time = subtractOneMinute(time);
    const datetime = `${date}T${time}:00`
    // console.log(datetime)
    const isExist = cronJobRefs[_id];
    // console.log('set ho raha ab ',_id);
    if (isExist) {
      console.log('is already set');
      return
    }
    if (status != 'pending') {
      console.log(`is already ${status}`);
      return
    }
    const user = { _id: owner }
    // console.log(user)
    setJobs(datetime, songs, user, _id, status);
  });
}

addCrobJobs()

app.get('/', (req, res) => res.send('its working'));
app.get('/refresh', (req, res) => {
  cronJobRefs = {};
  schedule.gracefulShutdown();
  addCrobJobs();
  console.log('refresh....');
  res.send('refresh successfully');
});


app.get('/start-time/:id', (req, res) => {
  console.log('id', songsStartTimeByUser[req.params.id])
  console.log(req.params)
  res.json({ starttime: songsStartTimeByUser[req.params.id] });
});





// socket connections 
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('owner-join', (data) => {

    socket.join(data?.user?._id.toString());
    if (data.user) data.user.socketId = socket.id;
    roomsowners[data?.user?._id] = data?.user;
    ownersSocketId[socket.id] = data?.user?._id;

    const currentRoomDetails = roomCurrentSongPlay[data?.user?._id.toString()];
    let nextSong = null;
    let currentSong = null;

    if (currentRoomDetails) {
      ({ nextSong, currentSong } = currentRoomDetails);
    }

    io.to(data?.user?._id).emit('room-active-now', { user: data?.user, nextSong, currentSong });
  });


  socket.on('user-join', (data) => {
    socket.join(data.roomId);
    const owner = roomsowners[data.roomId];
    listeners[socket.id] = data.roomId;
    console.log("hello world")

    if (owner) {
      console.log(owner, "owner")
      if (roomCurrentSongPlay[data.roomId]) {
        const { nextSong, currentSong } = roomCurrentSongPlay[data.roomId];
        io.to(socket.id).emit('room-active', { user: owner, nextSong, currentSong });
      } else {
        io.to(socket.id).emit('room-active', { user: owner });
      }
    } else {
      const butScheduleActive = scheduleActive[data.roomId];
      console.log('butScheduleActive', butScheduleActive);
      io.to(socket.id).emit('room-unactive', { butScheduleActive });
    }
  });


  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('receive-message', { ...data });
  })

  socket.on('call-admin', (data) => {
    const socketId = roomsowners[data.roomId].socketId;

    io.to(socketId).emit('call-coming', { ...data, callerID: socket.id });
  })

  socket.on('cut-admin', (data) => {

    const socketId = roomsowners[data.roomId].socketId;

    io.to(socketId).emit('cut-admin', { ...data, callerID: socket.id });
  })

  socket.on('admin-call-cut', (data) => {
    io.to(data.callerId).emit('admin-call-cut', {});
  })

  socket.on('call-response', (data) => {
    io.to(data.callerId).emit('call-response', { ...data });
  })


  socket.on('offer', (data) => {
    io.to(data.recieverId).emit('offer', { offer: data?.offer, senderId: socket.id, isCall: data.isCall });
  });

  socket.on('answer', (data) => {
    io.to(data?.recieverId).emit('answer', { answer: data?.answer });
  });

  socket.on('auto-dj', (data) => {
    io.to(socket.id).emit("song-change", { currentSong: currentSong[data?.roomId] })
  });

  socket.on('ice-candidate', (data) => socket.broadcast.emit('ice-candidate', data));


  socket.on('send-request-song', (data) => {
    const owner = roomsowners[data?.roomId];
    console.log(owner);
    if (owner) {
      io.to(owner.socketId).emit('recieve-request-song', { ...data });
    }
  })


  socket.on('next-song', async ({ roomId, nextSong, currentSong }) => {
    roomCurrentSongPlay[roomId] = { nextSong, currentSong };
    try {


      const { title, cover, album, audio, artist } = currentSong;
      await historyModel.create({ title, cover, album: album || 'unknown', audio, artist: artist || 'unknown', owner: roomId.toString() })
    } catch (error) {
      console.log(error.message)
    }

    io.to(roomId).emit('next-song', { nextSong, currentSong });
  })

  socket.on('disconnect', () => {
    const userId = ownersSocketId[socket.id];

    let user;
    if (userId) {
      user = roomsowners[userId];
    }
    delete roomsowners[userId];
    delete ownersSocketId[socket.id];
    io.to(userId).emit('owner-left', {});
    io.to(userId).emit('room-unactive', {});

    const roomId = listeners[socket.id];
    if (roomsowners[roomId]) {
      io.to(roomsowners[roomId].socketId).emit('user-disconnet', { id: socket.id });
    }

  });
});




async function playSong(filePath, res, req, _id) {
  try {
    const stat = fs.statSync(filePath);
    console.log('file read successfully');
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      res.writeHead(206, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Start-Time': songsStartTime[_id]
      });

      console.log('time start', songsStartTime[_id])

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);

      console.log('uper wala')
    } else {
      // If no range header is provided, send the entire file
      console.log('niche wala')
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': stat.size,
        'Start-Time': songsStartTime[_id]
      });
      console.log('time start', songsStartTime[_id])

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.log(err.message);
    res.send(err.message)
  }
}


function deleteRoute(route) {
  console.log('progressing deleting route')
  app._router.stack.forEach((routeLayer, index, routes) => {
    if (routeLayer.route && routeLayer.route.path === route) {
      routes.splice(index, 1);
    }
  });
  console.log('after deleting route')
}

async function setJobs(datetime, song, user, _id, status) {

  cronJobRefs[_id] = schedule.scheduleJob(new Date(datetime), async () => {

    // scheduleItems.forEach((ele,i) => {
    //   if(ele._id == _id){
    //     scheduleItems[i].status = 'processing'
    //   }
    // });

    await scheduleSchems.findByIdAndUpdate(_id, { status: 'processing' });

    // console.log(scheduleItems);
    const mergedFilePath = path.join(__dirname, `./${user._id}.mp3`);
    const isFileCreated = await downloadAndMergeSongs(song, mergedFilePath);
    console.log('isFileCreated', isFileCreated);
    scheduleActive[user._id] = true;
    songsStartTime[_id] = Date.now();
    songsStartTimeByUser[user._id] = Date.now();


    io.to(user?._id.toString()).emit('schedule-active', {});

    console.log('ids', Array.from(io?.sockets?.adapter.rooms.get(user?._id.toString()) || []));
    console.log('user id', user._id.toString());

    app.get(`/schedule/${user._id}`, async (req, res) => {
      console.log('url hit kiya kisi ne')
      if (isFileCreated) {
        playSong(mergedFilePath, res, req, _id);
      } else {
        res.send('something wants wrong')
      }
    });
    setExpireRoute(mergedFilePath, _id, user);
  });
}

async function setExpireRoute(outputFileName, _id, user) {
  ffmpeg.ffprobe(outputFileName, (err, metadata) => {
    if (err) {
      console.log(err)
    } else {
      duration = metadata.format.duration;
      const songLengthInMilliseconds = duration * 1000 // Adjust as needed
      setTimeout(async () => {
        // Delete the route only if there are no active streams for this route
        // scheduleItems.forEach((ele,i) => {
        //   if(ele._id == _id){
        //     scheduleItems[i].status = 'complete'
        //   }
        // });
        await scheduleSchems.findByIdAndUpdate(_id, { status: 'complete' });

        // console.log(scheduleItems)
        // Remove the client ID when the connection is closed
        delete cronJobRefs[_id];
        delete songsStartTime[_id];
        delete scheduleActive[user._id];
        delete songsStartTimeByUser[user._id]
        console.log('before deleting route')
        deleteRoute(`/schedule/${user._id}`);


        io.to(user?._id.toString()).emit('schedule-unactive', {});
        // console.log('user id',user._id.toString);
        console.log('ids', Array.from(io?.sockets?.adapter.rooms.get(user?._id.toString) || []));

        fs.unlink(outputFileName, (err) => {
          if (err) {
            // console.error(`Error deleting file: ${err}`);
          } else {
            console.log(`File ${outputFileName} has been deleted successfully`);
          }
        });

      }, songLengthInMilliseconds);
    }
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});