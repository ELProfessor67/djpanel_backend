// const fs = require('fs');
// const { spawn } = require('child_process');
// const path = require('path')

// const fifoPath = '/tmp/ffmpeg_fifo';

// const songs = [
//     '/upload/songs/bgm.mp3-1730414566065.mp3',
//     '/upload/songs/welcome.mp3-1730414831506.mp3',
//     '/upload/songs/bgm.mp3-1730414566065.mp3',
//     '/upload/songs/welcome.mp3-1730414831506.mp3',
//     '/upload/songs/bgm.mp3-1730414566065.mp3',
//     '/upload/songs/welcome.mp3-1730414831506.mp3',
// ]

// let currentIndex = 0;


// // Create FFmpeg command
// const ffmpegProcess = spawn('ffmpeg', [
//     '-re',
//     '-i', fifoPath, // Input from FIFO
//     '-codec:a', 'libmp3lame',
//     '-b:a', '128k',
//     '-f', 'mp3',
//     'icecast://source:hgdjpanel@icecast.hgdjlive.com:8000/655347b59c00a7409d9181c3'
// ]);

// ffmpegProcess.on('close', (code) => {
//     console.log(`ffmpeg process exited with code ${code}`);
//   });
// // Create write stream to the FIFO


// // Function to stream the next song
// const fifoWriteStream = fs.createWriteStream(fifoPath);
// async function streamNextSong() {
//     if (currentIndex >= songs.length) {
//         console.log('All Songs played');
//         return;
//     }
//     const song = songs[currentIndex];
//     const songPath = path.resolve(path.join(__dirname, `./public${song}`));

//     const songStream = fs.createReadStream(songPath);
//     const duration = await getSongDuration(songPath);
//     console.log(`Duration: ${duration} seconds`);


//     setTimeout(() => {
//         currentIndex++;
//         console.log(`Finished streaming: ${songPath}`);
//         streamNextSong(); // Start the next song
//     }, duration * 1000);

//     songStream.pipe(fifoWriteStream, { end: false });

//     songStream.on('end', () => {
//         console.log(`Finished streaming: ${songPath}`);
//         currentIndex++;
//         // fifoWriteStream.end()
//     });

//     songStream.on('error', (err) => {
//         console.error('Error in song stream:', err);
//         // fifoWriteStream.end();
//         currentIndex++;
//     });
// }


// function getSongDuration(filePath) {
//     return new Promise((resolve, reject) => {
//         const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);

//         let duration = '';
//         ffprobe.stdout.on('data', (data) => {
//             duration += data;
//         });

//         ffprobe.stderr.on('data', (data) => {
//             reject(`ffprobe stderr: ${data}`);
//         });

//         ffprobe.on('close', (code) => {
//             if (code === 0) {
//                 resolve(parseFloat(duration.trim()));
//             } else {
//                 reject(`ffprobe process exited with code ${code}`);
//             }
//         });
//     });
// }

// // Start the streaming process
// // streamNextSong();



const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const fifoPath = '/tmp/ffmpeg_fifo';

// List of songs to stream
const songs = [
    '/upload/songs/bgm.mp3-1730414566065.mp3',
    '/upload/songs/welcome.mp3-1730414831506.mp3',
    '/upload/songs/bgm.mp3-1730414566065.mp3',
    '/upload/songs/welcome.mp3-1730414831506.mp3',
    '/upload/songs/bgm.mp3-1730414566065.mp3',
    '/upload/songs/welcome.mp3-1730414831506.mp3',
];

let currentIndex = 0;

// Create a write stream to the FIFO
const fifoWriteStream = fs.createWriteStream(fifoPath, { flags: 'r+', autoClose: false });

// Create FFmpeg command
const ffmpegProcess = spawn('ffmpeg', [
    '-re',
    '-i', fifoPath, // Input from FIFO
    '-codec:a', 'libmp3lame',
    '-b:a', '128k',
    '-f', 'mp3',
    'icecast://source:hgdjpanel@icecast.hgdjlive.com:8000/655347b59c00a7409d9181c3'
]);

ffmpegProcess.on('close', (code) => {
    console.log(`ffmpeg process exited with code ${code}`);
});

// Function to stream the next song
async function streamNextSong() {
    if (currentIndex >= songs.length) {
        console.log('All songs played');
        return;
    }

    const song = songs[currentIndex];
    const songPath = path.resolve(__dirname, `./public${song}`);

    try {
        const duration = await getSongDuration(songPath);
        console.log(`Duration of ${song}: ${duration} seconds`);

        // Create a read stream for the current song
        const songStream = fs.createReadStream(songPath);

        // Pipe the song stream into the FIFO
        songStream.pipe(fifoWriteStream, { end: false });

        setTimeout(() => {
            currentIndex++;
            streamNextSong(); // Start the next song
        }, duration * 1000); // Wait for the song duration

        songStream.on('end', () => {
            console.log(`Finished streaming: ${songPath}`);
            // Call next stream after the song duration
           
        });

        songStream.on('error', (err) => {
            console.error(`Error in song stream: ${err}`);
            currentIndex++;
        });

    } catch (error) {
        console.error(`Error getting duration for ${song}: ${error}`);
        currentIndex++;
        // Call next stream after a brief delay on error
       
    }
}

function getSongDuration(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);

        let duration = '';
        ffprobe.stdout.on('data', (data) => {
            duration += data;
        });

        ffprobe.stderr.on('data', (data) => {
            reject(`ffprobe stderr: ${data}`);
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                resolve(parseFloat(duration.trim()));
            } else {
                reject(`ffprobe process exited with code ${code}`);
            }
        });
    });
}


streamNextSong()